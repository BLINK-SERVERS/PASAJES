# BLINK PASAJES

Panel de la línea para cobrar el pasaje con tarjeta MIFARE y lector RC522.
React 19 + Vite 8 + TypeScript estricto + Web Serial.

- **Sitio publicado:** https://pasajes.blink.com.ve/
- **Portal del pasajero:** https://blink-servers.github.io/TARJETA/
- **Comercio:** https://www.blink.com.ve/
- **Versión:** 0.1.0 · [CHANGELOG](CHANGELOG.md)

## Módulos

| Pestaña | Para qué sirve |
| --- | --- |
| **Pasajero** | Flujo guiado de recarga: monto → revisión → comprobante. |
| **Lector** | Conecta el lector ESP32 por Web Serial y muestra el resultado del cobro. |
| **Fiscal** | Resumen fiscal del día (viajes, tarifa y totales). |
| **Admin** | Aprueba/rechaza recargas y liquida el día. |

Estado actual: los datos del panel se guardan en el navegador
(`localStorage`). La migración al esquema compartido `bt_*` de Supabase está
planificada; ver [docs/arquitectura.md](docs/arquitectura.md).

## Puesta en marcha

```bash
npm ci
npm run dev        # http://localhost:5174
npm run typecheck
npm test           # 56 pruebas
npm run build
npm run dominio    # fija pasajes.blink.com.ve + HTTPS (requiere token de Cloudflare)
```

## Lector

Protocolo del firmware `BLINK_Lector` (115200 baudios, una línea por mensaje):

```text
READY,BLINK,1     firmware listo
CARD,3981BF06     tarjeta detectada (UID en hexadecimal)
PONG              respuesta a PING
```

Web Serial solo existe en **Chromium de escritorio** (Chrome/Edge en Linux,
Windows o macOS). En móviles el módulo Lector no está disponible.

## Despliegue

Cada push a `main` dispara `.github/workflows/pages.yml`: `typecheck` → `test` →
`build` (raíz) → GitHub Pages, servido en `pasajes.blink.com.ve` con HTTPS.

## Documentación

- [docs/arquitectura.md](docs/arquitectura.md) — componentes, protocolo y estado.
- [docs/operacion.md](docs/operacion.md) — despliegue, dominio y solución de problemas.
- [docs/manual-de-usuario.md](docs/manual-de-usuario.md) — guía del operador y del pasajero.
- Documentación completa del ecosistema (modelo de datos, API, seguridad):
  repositorio [TARJETA › docs](https://github.com/BLINK-SERVERS/TARJETA/tree/main/docs).
