# Manual de usuario de BLINK PASAJES

| Campo | Valor |
| --- | --- |
| Documento | BLINK-PAS-DOC-03 |
| Versión | 1.0.0 |
| Fecha | 2026-10-29 |
| Estado | Vigente |
| Público | Chofer, administrador de línea, pasajero |

Sitio: https://pasajes.blink.com.ve/

## 1. Antes de empezar

- Usa **Chrome o Edge de escritorio**. El lector necesita Web Serial, que no existe
  en móviles ni en Safari/Firefox.
- Conecta el lector ESP32 por USB.
- Ten la tarjeta del pasajero a mano.

## 2. Módulo Lector (chofer)

1. Abre la pestaña **Lector**.
2. Toca **Conectar** y elige el puerto serie del lector.
3. Espera el mensaje `READY,BLINK,1` en el panel.
4. Acerca la tarjeta al lector: se muestra el UID y el resultado del cobro.
5. Si no hay respuesta, usa **Probar** (envía `PING`): debe responder `PONG`.
6. Al terminar, desconecta el lector desde el panel antes de cerrar el navegador.

**Si el lector no aparece:** cierra cualquier monitor serie abierto, revisa el
cable y que el controlador CH340 esté instalado. En Linux, `brltty` puede ocupar el
puerto; desactívalo o desconecta el servicio.

## 3. Módulo Admin (administrador)

1. Revisa las recargas pendientes del día.
2. Verifica en el banco el monto y la referencia antes de aprobar.
3. **Aprobar** acredita el saldo; **Rechazar** deja el movimiento sin efecto.
4. Al final del día, revisa la liquidación: viajes, bruto, comisión, aporte de línea
   y neto.
5. Descarga o anota el cierre para la conciliación bancaria.

> En la versión actual estos datos viven en el navegador. Cuando la app migre a la
> nube, la aprobación afectará el saldo real de BLINK TARJETA.

## 4. Módulo Fiscal (administrador)

- Muestra los viajes del día, la tarifa aplicada y el total recaudado.
- Sirve de respaldo para la declaración de la línea.
- El detalle por unidad y por ruta depende de la telemetría del validador.

## 5. Módulo Pasajero (taquilla)

1. El pasajero indica el serial de su tarjeta.
2. Escribe el monto y confirma los datos de Pago Móvil.
3. Registra banco, teléfono y referencia.
4. Revisa el comprobante antes de confirmar.
5. Entrega al pasajero el comprobante con el número de referencia.

## 6. Preguntas frecuentes

| Pregunta | Respuesta |
| --- | --- |
| ¿Funciona sin internet? | El panel sí (datos locales); el lector no depende de internet. |
| ¿Puedo usar el celular? | No para el lector; el resto del panel es visible pero Web Serial no existe en móvil. |
| ¿Dónde veo el saldo del pasajero? | En su portal, BLINK TARJETA; el panel muestra los datos locales. |
| ¿Qué hago si el lector se desconecta? | Vuelve a conectar; el estado se reinicia y las lecturas anteriores se conservan. |

## 7. Soporte

- Atención al cliente: 0800-BLINK-00.
- Para problemas técnicos del panel, adjunta una captura del módulo Lector con el
  mensaje de estado.
