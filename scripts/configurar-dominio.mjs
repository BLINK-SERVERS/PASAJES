#!/usr/bin/env node
// Deja https://pasajes.blink.com.ve sirviendo el sitio de PASAJES.
//
// Hace tres cosas, en orden y sin repetir lo que ya está hecho:
//   1. Crea (o corrige) el CNAME `pasajes` en Cloudflare hacia GitHub Pages.
//   2. Fija `pasajes.blink.com.ve` como dominio personalizado del repo.
//   3. Espera el certificado y activa "Enforce HTTPS".
//
// Uso:
//   npm run dominio              aplica los cambios
//   npm run dominio -- --simular solo muestra lo que haría
//   npm run dominio -- --esperar-https=900   espera más el certificado
//
// Tokens: CLOUDFLARE_API_TOKEN (con Zone → DNS → Edit) y el de GitHub desde
// `gh auth token` o GH_TOKEN. Si faltan, se leen de ~/Escritorio/.env.
// Nunca se imprimen.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ZONA = process.env.DOMINIO_ZONA ?? "blink.com.ve";
const SUBDOMINIO = "pasajes";
const HOST = `${SUBDOMINIO}.${ZONA}`;
const DESTINO = "blink-servers.github.io";
const REPO = "BLINK-SERVERS/PASAJES";
const ARCHIVO_ENV = join(homedir(), "Escritorio", ".env");

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const igual = args.find((a) => a.startsWith(`--${nombre}=`));
  if (!igual) return porDefecto;
  const valor = Number(igual.split("=")[1]);
  return Number.isFinite(valor) && valor >= 0 ? valor : porDefecto;
};
const SIMULAR = args.includes("--simular");
const ESPERA_DNS = opcion("esperar-dns", 90);
const ESPERA_HTTPS = opcion("esperar-https", 120);

const pasos = [];
const anotar = (titulo, estado, detalle = "") => pasos.push({ titulo, estado, detalle });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

class ErrorDeUso extends Error {}

function leerEnv(ruta) {
  if (!existsSync(ruta)) return {};
  const datos = {};
  for (const linea of readFileSync(ruta, "utf8").split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte < 1) continue;
    datos[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, "");
  }
  return datos;
}

function tokenNube() {
  const directo = process.env.CLOUDFLARE_API_TOKEN;
  if (directo) return directo;
  const guardado = leerEnv(ARCHIVO_ENV).CLOUDFLARE_API_TOKEN;
  if (guardado) return guardado;
  throw new ErrorDeUso(
    "Falta CLOUDFLARE_API_TOKEN.\n" +
      "Crea un token en Cloudflare → Mi perfil → API Tokens con el permiso\n" +
      "Zone → DNS → Edit sobre blink.com.ve, y guárdalo en ~/Escritorio/.env."
  );
}

function tokenGitHub() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
    return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  }
  try {
    const salida = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (salida) return salida;
  } catch {
    /* gh no está instalado o no hay sesión */
  }
  const filas = leerEnv(ARCHIVO_ENV);
  const encontrado =
    filas.GITHUB_TOKEN || filas.GH_TOKEN || Object.values(filas).find((v) => /^gh[pousr]_/.test(v));
  if (encontrado) return encontrado;
  throw new ErrorDeUso(
    "Falta el token de GitHub. Inicia sesión con `gh auth login` o\nguarda GITHUB_TOKEN en ~/Escritorio/.env."
  );
}

async function api(base, token, ruta, opciones = {}) {
  const respuesta = await fetch(base + ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta sin JSON */
  }
  return { estado: respuesta.status, datos, texto };
}

const nube = (token, ruta, opciones) =>
  api("https://api.cloudflare.com/client/v4", token, ruta, opciones);
const github = (token, ruta, opciones) =>
  api("https://api.github.com", token, ruta, opciones);

function mensajeNube(respuesta) {
  const errores = respuesta.datos?.errors ?? [];
  return errores.map((e) => `${e.code}: ${e.message}`).join(" · ") || `HTTP ${respuesta.estado}`;
}

// ---------------------------------------------------------------- 0. Permisos
const tokenCF = tokenNube();
const tokenGH = tokenGitHub();

async function zona() {
  const respuesta = await nube(tokenCF, `/zones?name=${encodeURIComponent(ZONA)}`);
  const encontrada = respuesta.datos?.result?.[0];
  if (!encontrada) throw new ErrorDeUso(`El token no ve la zona ${ZONA}.`);
  return encontrada.id;
}

async function comprobarDns(idZona) {
  const respuesta = await nube(tokenCF, `/zones/${idZona}/dns_records?per_page=1`);
  if (respuesta.datos?.success) return;
  if (respuesta.estado === 401 || respuesta.estado === 403) {
    throw new ErrorDeUso(
      "El token de Cloudflare no puede leer ni crear DNS.\n" +
        `Cloudflare responde: ${mensajeNube(respuesta)}.\n` +
        "Edita el token y agrégale Zone → DNS → Edit sobre blink.com.ve;\n" +
        "guárdalo como CLOUDFLARE_API_TOKEN en ~/Escritorio/.env y vuelve a correr esto."
    );
  }
  throw new ErrorDeUso(`No pude consultar el DNS: ${mensajeNube(respuesta)}`);
}

// --------------------------------------------------------------- 1. El CNAME
async function asegurarCname(idZona) {
  const respuesta = await nube(
    tokenCF,
    `/zones/${idZona}/dns_records?name=${encodeURIComponent(HOST)}`
  );
  if (!respuesta.datos?.success) throw new ErrorDeUso(`No pude leer ${HOST}: ${mensajeNube(respuesta)}`);

  const registros = respuesta.datos.result ?? [];
  const cname = registros.find((r) => r.type === "CNAME");
  const otro = registros.find((r) => r.type !== "CNAME");

  if (otro) {
    throw new ErrorDeUso(
      `${HOST} ya tiene un registro ${otro.type} apuntando a ${otro.content}.\n` +
        "Bórralo o cámbialo a CNAME desde Cloudflare y vuelve a intentar; no lo toco automáticamente."
    );
  }

  if (cname && cname.content === DESTINO) {
    if (cname.proxied) {
      anotar("CNAME", "corregido", "estaba proxificado; GitHub no puede emitir el certificado así");
      if (!SIMULAR) await corregirCname(idZona, cname.id, { proxied: false });
      return;
    }
    anotar("CNAME", "ya estaba", `${HOST} → ${DESTINO}`);
    return;
  }

  if (cname) {
    anotar("CNAME", "corregido", `apuntaba a ${cname.content}`);
    if (!SIMULAR) await corregirCname(idZona, cname.id, { content: DESTINO, proxied: false });
    return;
  }

  anotar("CNAME", "creado", `${HOST} → ${DESTINO}`);
  if (SIMULAR) return;
  const creado = await nube(tokenCF, `/zones/${idZona}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: "CNAME",
      name: SUBDOMINIO,
      content: DESTINO,
      proxied: false,
      ttl: 1,
      comment: "GitHub Pages · BLINK PASAJES",
    }),
  });
  if (!creado.datos?.success) throw new ErrorDeUso(`No pude crear el CNAME: ${mensajeNube(creado)}`);
}

async function corregirCname(idZona, idRegistro, cambios) {
  const respuesta = await nube(tokenCF, `/zones/${idZona}/dns_records/${idRegistro}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });
  if (!respuesta.datos?.success) throw new ErrorDeUso(`No pude corregir el CNAME: ${mensajeNube(respuesta)}`);
}

// --------------------------------------------------------- 2. Dominio en Pages
async function estadoPages() {
  const respuesta = await github(tokenGH, `/repos/${REPO}/pages`);
  if (respuesta.estado === 404) {
    throw new ErrorDeUso(
      `GitHub Pages no está activado en ${REPO}. Actívalo con origen "GitHub Actions" y vuelve a intentar.`
    );
  }
  if (respuesta.estado !== 200) {
    throw new ErrorDeUso(`No pude leer Pages de ${REPO}: HTTP ${respuesta.estado} ${respuesta.datos?.message ?? ""}`);
  }
  return respuesta.datos;
}

async function fijarDominio(actual) {
  if (actual.cname === HOST) {
    anotar("Dominio en Pages", "ya estaba", HOST);
    return actual;
  }
  anotar("Dominio en Pages", "configurado", actual.cname ? `antes ${actual.cname}` : "sin dominio propio");
  if (SIMULAR) return { ...actual, cname: HOST };

  const respuesta = await github(tokenGH, `/repos/${REPO}/pages`, {
    method: "PUT",
    body: JSON.stringify({ cname: HOST, build_type: actual.build_type }),
  });
  // Pages responde 204 sin cuerpo cuando aplica el cambio.
  if (respuesta.estado < 200 || respuesta.estado >= 300) {
    throw new ErrorDeUso(`No pude fijar el dominio: HTTP ${respuesta.estado} ${respuesta.datos?.message ?? ""}`);
  }
  return respuesta.datos ?? { ...actual, cname: HOST };
}

// ------------------------------------------------------------- 3. Propagación
async function esperarDns(segundos) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    const respuesta = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${HOST}&type=CNAME`,
      { headers: { accept: "application/dns-json" } }
    ).catch(() => null);
    const datos = respuesta ? await respuesta.json().catch(() => null) : null;
    const respuestas = datos?.Answer ?? [];
    const objetivo = respuestas.find((a) => a.type === 5)?.data?.replace(/\.$/, "");
    if (objetivo === DESTINO) return true;
    await dormir(5000);
  }
  return false;
}

async function esperarHttps(segundos) {
  const limite = Date.now() + segundos * 1000;
  let ultimo = "sin respuesta";
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(`https://${HOST}/`, { redirect: "follow" });
      if (respuesta.ok) return { ok: true, html: await respuesta.text() };
      ultimo = `HTTP ${respuesta.status}`;
    } catch (error) {
      ultimo = error.cause?.code ?? error.message;
    }
    await dormir(10000);
  }
  return { ok: false, motivo: ultimo };
}

async function forzarHttps(actual) {
  if (actual.https_enforced) {
    anotar("HTTPS forzado", "ya estaba", "");
    return;
  }
  anotar("HTTPS forzado", "activado", "");
  if (SIMULAR) return;
  const respuesta = await github(tokenGH, `/repos/${REPO}/pages`, {
    method: "PUT",
    body: JSON.stringify({ https_enforced: true }),
  });
  if (respuesta.estado < 200 || respuesta.estado >= 300) {
    throw new ErrorDeUso(`No pude forzar HTTPS: HTTP ${respuesta.estado} ${respuesta.datos?.message ?? ""}`);
  }
}

// El sitio en la raíz del dominio necesita rutas absolutas desde la raíz;
// mientras el workflow compile con --base=/PASAJES/ los assets dan 404.
function revisarBaseDelBuild() {
  const ruta = fileURLToPath(new URL("../.github/workflows/pages.yml", import.meta.url));
  if (!existsSync(ruta)) {
    anotar("Rutas del build", "pendiente", "no encontré .github/workflows/pages.yml; revisa el base a mano");
    return;
  }
  const base = readFileSync(ruta, "utf8").match(/--base=(\S+)/)?.[1] ?? "/";
  if (base !== "/") {
    anotar("Rutas del build", "pendiente", `el workflow compila con --base=${base}; cámbialo a / y despliega`);
  } else {
    anotar("Rutas del build", "listo", "");
  }
}

// --------------------------------------------------------------------- Flujo
const simbolo = {
  creado: "✓",
  corregido: "✓",
  configurado: "✓",
  activado: "✓",
  listo: "✓",
  "ya estaba": "=",
  pendiente: "…",
};

try {
  console.log(`\nDominio: https://${HOST}\n${SIMULAR ? "Modo simulación: no se escribe nada.\n" : ""}`);

  const idZona = await zona();
  await comprobarDns(idZona);
  revisarBaseDelBuild();
  await asegurarCname(idZona);

  let pages = await fijarDominio(await estadoPages());

  if (!SIMULAR) {
    process.stdout.write("Esperando la propagación del DNS… ");
    const propagado = await esperarDns(ESPERA_DNS);
    console.log(propagado ? "listo" : "todavía no");
    anotar("DNS propagado", propagado ? "listo" : "pendiente", propagado ? "" : `revisa con: dig CNAME ${HOST}`);

    if (propagado) {
      process.stdout.write("Esperando el certificado de GitHub… ");
      const https = await esperarHttps(ESPERA_HTTPS);
      console.log(https.ok ? "listo" : "todavía no");
      anotar(
        "Certificado HTTPS",
        https.ok ? "listo" : "pendiente",
        https.ok ? "" : `${https.motivo}; GitHub suele tardar hasta 1 hora`
      );
      if (https.ok) await forzarHttps(pages);
    }
  }

  console.log("");
  for (const paso of pasos) {
    console.log(`  ${simbolo[paso.estado] ?? "·"} ${paso.titulo}: ${paso.estado}${paso.detalle ? ` — ${paso.detalle}` : ""}`);
  }
  console.log(`\nSitio: https://${HOST}`);

  const pendientes = pasos.filter((p) => p.estado === "pendiente").map((p) => p.titulo);
  if (pendientes.length) {
    console.log(`Pendiente: ${pendientes.join(", ")}.`);
    if (pendientes.includes("Rutas del build")) {
      console.log("Este aviso desaparece cuando el workflow compile con base / y vuelvas a desplegar.");
    }
    if (pendientes.some((t) => t !== "Rutas del build")) {
      console.log("El resto se resuelve solo: vuelve a correr `npm run dominio` en unos minutos.");
    }
  }
  console.log("");
} catch (error) {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(error instanceof ErrorDeUso ? 2 : 1);
}
