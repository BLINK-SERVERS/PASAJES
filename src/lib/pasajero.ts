import type { Recarga, Tarjeta } from "./datos";

const GRUPOS_SERIAL = [2, 1, 7, 1];

export function soloDigitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/** 23100000010 → 23-1-0000001-0 (máscara del serial BLINK). */
export function formatearSerial(digitos: string): string {
  let salida = "";
  let desde = 0;
  for (const tamano of GRUPOS_SERIAL) {
    if (desde >= digitos.length) break;
    salida += (salida ? "-" : "") + digitos.slice(desde, desde + tamano);
    desde += tamano;
  }
  return salida;
}

/** Aplica la máscara del serial mientras se escribe (deja la cédula tal cual). */
export function formatearEntrada(texto: string): string {
  const limpio = texto.replace(/[^0-9vVeE]/g, "");
  if (/[vVeE]/.test(limpio)) {
    const digito = soloDigitos(limpio);
    const numeros = digito.length > 8 ? digito.slice(0, 8) : digito;
    return `${limpio[0].toUpperCase()}-${numeros}`;
  }
  return limpio.length > 8 ? formatearSerial(limpio) : limpio;
}

export function buscarTarjeta(tarjetas: Tarjeta[], texto: string): Tarjeta | null {
  const digitos = soloDigitos(texto);
  if (!digitos) return null;

  if (digitos.length <= 8) {
    return (
      tarjetas.find((tarjeta) => soloDigitos(tarjeta.cedula ?? "") === digitos) ?? null
    );
  }

  const serial = formatearSerial(digitos);
  return tarjetas.find((tarjeta) => tarjeta.serial === serial) ?? null;
}

export function pasajesEquivalentes(saldo: number, tarifa: number) {
  if (!Number.isFinite(tarifa) || tarifa <= 0) return 0;
  return Math.max(0, Math.floor(saldo / tarifa));
}

export interface BorradorRecarga {
  monto: string;
  telefono: string;
  banco: string;
  referencia: string;
}

export type CampoRecarga = keyof BorradorRecarga;

export const CAMPOS_RECARGA: CampoRecarga[] = ["monto", "telefono", "banco", "referencia"];

export type ErroresRecarga = Partial<Record<CampoRecarga, string>>;

/** 04141234567 → 0414-1234567 (máscara de teléfono venezolano). */
export function formatearTelefono(texto: string): string {
  const digitos = soloDigitos(texto).slice(0, 11);
  if (digitos.length <= 4) return digitos;
  return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
}

/** Errores por campo para mostrarlos junto a cada input. */
export function erroresRecarga(borrador: BorradorRecarga): ErroresRecarga {
  const errores: ErroresRecarga = {};

  const monto = Number(borrador.monto);
  if (borrador.monto.trim() === "" || !Number.isFinite(monto) || monto <= 0) {
    errores.monto = "Escribe el monto que transferiste (mayor que 0).";
  }

  if (!/^0\d{10}$/.test(soloDigitos(borrador.telefono))) {
    errores.telefono = "El teléfono debe tener 11 dígitos y empezar por 0 (ej. 0414-1234567).";
  }

  if (!borrador.banco) {
    errores.banco = "Selecciona el banco emisor.";
  }

  if (!/^\d{4}$/.test(soloDigitos(borrador.referencia))) {
    errores.referencia = "Escribe los últimos 4 dígitos de la referencia.";
  }

  return errores;
}

/** Devuelve el primer error del formulario, o null si está completo. */
export function validarRecarga(borrador: BorradorRecarga): string | null {
  const errores = erroresRecarga(borrador);
  for (const campo of CAMPOS_RECARGA) {
    if (errores[campo]) return errores[campo];
  }
  return null;
}

/**
 * Busca un reporte previo con la misma referencia de un pago aún vigente.
 * Si ya fue rechazado, el pasajero puede volver a reportarlo.
 */
export function buscarRecargaDuplicada(
  recargas: Recarga[],
  consulta: { serial: string; banco: string; referencia: string }
): Recarga | null {
  const referencia = soloDigitos(consulta.referencia).slice(-4);
  return (
    recargas.find(
      (recarga) =>
        recarga.serial === consulta.serial &&
        recarga.banco === consulta.banco &&
        recarga.referencia === referencia &&
        recarga.estado !== "rechazado"
    ) ?? null
  );
}
