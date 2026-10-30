# Changelog — BLINK PASAJES

Formato basado en [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/)
y versionado [SemVer 2.0.0](https://semver.org/lang/es/).

## [No publicado]

### Añadido

- Documentación de arquitectura, operación y manual de usuario.

### Pendiente

- Migrar el panel al esquema compartido `bt_*` de Supabase.
- Aprobación de recargas contra la nube desde el módulo Admin.
- Exportación fiscal descargable.

## [0.1.0] — 2026-10-29

Primera versión publicada en dominio propio.

### Añadido

- Publicación en `https://pasajes.blink.com.ve` con HTTPS forzado.
- Script `npm run dominio` para fijar el dominio de Pages vía API.
- Flujo guiado de recargas del Portal del Pasajero (monto → revisión → comprobante).
- Módulos Lector, Fiscal y Admin.
- Compilación en la raíz (`base: "/"`) para servir el dominio completo.

### Corregido

- El script de dominio trataba como error la respuesta **HTTP 204** que devuelve
  Pages al aplicar un cambio; ahora cualquier 2xx se considera éxito.

### Historial

| Fecha | Commit | Cambio |
| --- | --- | --- |
| 2026-10-29 | `08dd5e9` | Flujo guiado de recargas al Portal del Pasajero. |
| 2026-10-29 | `737bb3a` | Publicación en GitHub Pages. |
| 2026-10-29 | `59327d1` | Script para publicar en `pasajes.blink.com.ve`. |
| 2026-10-29 | `4de8843` | Compilar en la raíz para el dominio. |
| 2026-10-29 | `8584a0e` | Reconocer el 204 de Pages al fijar dominio y HTTPS. |
