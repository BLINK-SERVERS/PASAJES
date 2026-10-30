# Operación y despliegue de BLINK PASAJES

| Campo | Valor |
| --- | --- |
| Documento | BLINK-PAS-DOC-02 |
| Versión | 1.0.0 |
| Fecha | 2026-10-29 |
| Estado | Vigente |

## 1. Entorno local

```bash
npm ci
npm run dev        # http://localhost:5174
npm run typecheck
npm test           # 56 pruebas
npm run build      # dist/
npm run preview    # http://localhost:4174
```

## 2. Publicación

Cada push a `main` ejecuta `.github/workflows/pages.yml`:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build` (con `base: "/"`)
5. `upload-pages-artifact` + `deploy-pages`

Verificación:

```bash
gh run list --repo BLINK-SERVERS/PASAJES --limit 3
curl -sS -o /dev/null -w "%{http_code}\n" https://pasajes.blink.com.ve/
```

## 3. Dominio y HTTPS

El dominio se fija una vez con:

```bash
CLOUDFLARE_API_TOKEN=<token> npm run dominio
```

El script (`scripts/configurar-dominio.mjs`) hace tres cosas:

1. Crea o actualiza el registro CNAME `pasajes` → `blink-servers.github.io`
   **sin proxy** en Cloudflare.
2. Fija el dominio personalizado del sitio de Pages.
3. Fuerza HTTPS.

Consideraciones:

- El CNAME debe ser **DNS only**. Con el proxy activo, GitHub no emite el
  certificado y el sitio queda en error.
- Pages responde **HTTP 204** cuando aplica un cambio; el script lo trata como
  éxito (corrección del 2026-10-29).
- El token de Cloudflare necesita permiso de edición de DNS en la zona
  `blink.com.ve`; los tokens personales suelen no tenerlo.

Comprobación:

```bash
dig +short pasajes.blink.com.ve CNAME
curl -sSI https://pasajes.blink.com.ve/ | head -3
```

## 4. Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| El sitio abre en `github.io/PASAJES/` pero no en el dominio. | CNAME ausente o con proxy. | Revisar DNS (DNS only) y volver a ejecutar `npm run dominio`. |
| "No pude fijar el dominio: HTTP 403". | Token sin permiso sobre la zona. | Usar un token con acceso a `blink.com.ve`. |
| El módulo Lector no muestra el puerto. | Navegador sin Web Serial o sin contexto seguro. | Usar Chromium de escritorio sobre HTTPS o `localhost`. |
| El puerto está ocupado o no aparece. | Otro programa usa el CH340 (p. ej. `brltty`). | Cerrar el monitor serie y liberar el dispositivo. |
| Lecturas vacías | Baudios incorrectos o firmware distinto. | Verificar 115200 y `READY,BLINK,1`. |
| 404 al recargar una ruta. | Falta `404.html`. | Pages sirve `index.html`; esta app no usa router, así que solo aplica a rutas externas. |

## 5. Rollback

1. `git revert <commit>` y push: el workflow republica la versión anterior.
2. Si el fallo es de despliegue (no de código), relanzar el último run correcto:
   `gh run rerun <id> --repo BLINK-SERVERS/PASAJES`.

## 6. Datos

Hoy el panel guarda todo en `localStorage` del navegador:

- No hay sincronización entre dispositivos.
- Borrar los datos del sitio reinicia la demostración.
- La migración a Supabase debe definir la fuente de verdad antes de usar el panel
  en producción real (ver [arquitectura](arquitectura.md) §5).

## 7. Lista de verificación

- [ ] `typecheck` y `test` en verde.
- [ ] Workflow de Pages en verde.
- [ ] `https://pasajes.blink.com.ve/` responde 200.
- [ ] Lector probado con una tarjeta real (si cambió el protocolo).
- [ ] CHANGELOG actualizado.
