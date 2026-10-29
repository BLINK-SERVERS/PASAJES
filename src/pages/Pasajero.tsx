import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import {
  BANCOS_EMISORES,
  cargarConfig,
  cargarRecargas,
  cargarTarifa,
  cargarTarjetas,
  cargarViajes,
  formatearBs,
  formatearFechaHora,
  formatearHora,
  guardarRecargas,
  type Configuracion,
  type Recarga,
  type Tarjeta,
  type Viaje,
} from "../lib/datos";
import {
  buscarRecargaDuplicada,
  buscarTarjeta,
  CAMPOS_RECARGA,
  erroresRecarga,
  formatearEntrada,
  formatearTelefono,
  pasajesEquivalentes,
  type BorradorRecarga,
  type CampoRecarga,
  type ErroresRecarga,
} from "../lib/pasajero";

const BORRADOR_VACIO: BorradorRecarga = {
  monto: "",
  telefono: "",
  banco: "",
  referencia: "",
};

const MONTOS_RAPIDOS = [50, 100, 200, 500];

type PasoRecarga = "formulario" | "revision" | "comprobante";

function etiquetaEstado(estado: Recarga["estado"]) {
  if (estado === "aprobado") return "Aprobada";
  if (estado === "rechazado") return "Rechazada";
  return "Pendiente";
}

export function Pasajero() {
  const [texto, setTexto] = useState("");
  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null);
  const [buscado, setBuscado] = useState(false);
  const [recargas, setRecargas] = useState<Recarga[]>(cargarRecargas);
  const [tarifa] = useState(cargarTarifa);
  const [config] = useState(cargarConfig);
  const [viajes] = useState<Viaje[]>(cargarViajes);
  const [borrador, setBorrador] = useState<BorradorRecarga>(BORRADOR_VACIO);
  const [errores, setErrores] = useState<ErroresRecarga>({});
  const [paso, setPaso] = useState<PasoRecarga>("formulario");
  const [recargaReportada, setRecargaReportada] = useState<Recarga | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const tituloPasoRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (paso !== "formulario") tituloPasoRef.current?.focus();
  }, [paso]);

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    const encontrada = buscarTarjeta(cargarTarjetas(), texto);
    setTarjeta(encontrada);
    setBuscado(true);
    setBorrador(BORRADOR_VACIO);
    setErrores({});
    setPaso("formulario");
    setRecargaReportada(null);
  }

  function cambiarTexto(valor: string) {
    setTexto(formatearEntrada(valor));
  }

  async function copiar(valor: string, clave: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(clave);
      window.setTimeout(() => setCopiado((actual) => (actual === clave ? null : actual)), 1600);
    } catch {
      setCopiado("error");
    }
  }

  function copiarPagoMovil() {
    const { banco, rif, telefono } = config.pagoMovil;
    void copiar(
      `Pago Móvil BLINK\nBanco: ${banco}\nRIF: ${rif}\nTeléfono: ${telefono}`,
      "pago-movil"
    );
  }

  function cambiar(campo: CampoRecarga, valor: string) {
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => {
      if (!actual[campo]) return actual;
      const siguiente = { ...actual };
      delete siguiente[campo];
      return siguiente;
    });
  }

  function enfocarCampo(campo: CampoRecarga) {
    requestAnimationFrame(() => document.getElementById(campo)?.focus());
  }

  function revisar(evento: FormEvent) {
    evento.preventDefault();
    if (!tarjeta) return;

    const problemas = erroresRecarga(borrador);
    const primerCampo = CAMPOS_RECARGA.find((campo) => problemas[campo]);
    if (primerCampo) {
      setErrores(problemas);
      enfocarCampo(primerCampo);
      return;
    }

    const duplicada = buscarRecargaDuplicada(recargas, {
      serial: tarjeta.serial,
      banco: borrador.banco,
      referencia: borrador.referencia,
    });
    if (duplicada) {
      setErrores({
        referencia: `Ya reportaste esta referencia el ${formatearFechaHora(
          duplicada.at
        )} (${etiquetaEstado(duplicada.estado).toLowerCase()}). Revisa «Recargas recientes».`,
      });
      enfocarCampo("referencia");
      return;
    }

    setErrores({});
    setPaso("revision");
  }

  function confirmar() {
    if (!tarjeta) return;

    const recarga: Recarga = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      serial: tarjeta.serial,
      monto: Math.round(Number(borrador.monto) * 100) / 100,
      telefono: borrador.telefono.replace(/\D/g, ""),
      banco: borrador.banco,
      referencia: borrador.referencia.replace(/\D/g, "").slice(-4),
      at: new Date().toISOString(),
      estado: "pendiente",
    };

    const nuevas = [recarga, ...recargas].slice(0, 50);
    setRecargas(nuevas);
    guardarRecargas(nuevas);
    setBorrador(BORRADOR_VACIO);
    setErrores({});
    setRecargaReportada(recarga);
    setPaso("comprobante");
  }

  function volverAlFormulario() {
    setPaso("formulario");
    enfocarCampo("monto");
  }

  function reportarOtra() {
    setRecargaReportada(null);
    volverAlFormulario();
  }

  const recargasTarjeta = tarjeta
    ? recargas.filter((recarga) => recarga.serial === tarjeta.serial).slice(0, 5)
    : [];
  const viajesTarjeta = tarjeta
    ? viajes
        .filter((viaje) => viaje.serial === tarjeta.serial && viaje.resultado === "aprobado")
        .slice(0, 5)
    : [];
  const montoBorrador = Number(borrador.monto);
  const pasajesMonto =
    Number.isFinite(montoBorrador) && montoBorrador > 0
      ? pasajesEquivalentes(montoBorrador, tarifa)
      : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Portal del pasajero</h1>
          <p className="muted">
            Consulta tu saldo y reporta recargas con el serial impreso en la tarjeta.
          </p>
        </div>
        <span className="badge badge--accent">Tarifa {formatearBs(tarifa)}</span>
      </header>

      <section className="card">
        <form className="buscador" onSubmit={buscar}>
          <div className="field">
            <label className="field__label" htmlFor="buscar">
              Serial o cédula
            </label>
            <input
              id="buscar"
              className="input mono"
              placeholder="23-1-0000001-0 o V-12345678"
              value={texto}
              onChange={(evento) => cambiarTexto(evento.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <span className="field__hint">
              El serial está impreso en el plástico; también sirve la cédula del titular.
            </span>
          </div>
          <button type="submit" className="btn btn--primary">
            <Icon name="tarjeta" />
            Buscar tarjeta
          </button>
        </form>

        {buscado && !tarjeta && (
          <div className="aviso aviso--danger aviso--inline" role="alert">
            <Icon name="alerta" />
            <div>No encontramos esa tarjeta. Revisa el serial o la cédula.</div>
          </div>
        )}
      </section>

      {tarjeta && (
        <>
          <div className="portal-grid">
            <div className="columna">
              <TarjetaVirtual
                tarjeta={tarjeta}
                tarifa={tarifa}
                patrocinio={config.patrocinio}
              />

              <section className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Cómo recargar</h2>
                    <p className="card__hint">Tres pasos, sin acercar la tarjeta al teléfono.</p>
                  </div>
                </div>
                <ol className="pasos">
                  <li>Haz el Pago Móvil a los datos de BLINK.</li>
                  <li>Reporta aquí el monto y la referencia.</li>
                  <li>El saldo se acredita cuando Admin aprueba la recarga.</li>
                </ol>
              </section>
            </div>

            <div className="columna">
              <section className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Pago Móvil de BLINK</h2>
                    <p className="card__hint">Datos de demostración.</p>
                  </div>
                </div>
                <dl className="datos datos--copiar">
                  <DatoCopiable
                    etiqueta="Banco"
                    valor={config.pagoMovil.banco}
                    clave="banco"
                    copiado={copiado}
                    alCopiar={copiar}
                  />
                  <DatoCopiable
                    etiqueta="RIF"
                    valor={config.pagoMovil.rif}
                    clave="rif"
                    copiado={copiado}
                    alCopiar={copiar}
                  />
                  <DatoCopiable
                    etiqueta="Teléfono"
                    valor={config.pagoMovil.telefono}
                    clave="telefono"
                    copiado={copiado}
                    alCopiar={copiar}
                  />
                </dl>
                <button
                  type="button"
                  className="btn btn--sm btn--soft btn--block"
                  onClick={copiarPagoMovil}
                >
                  <Icon name="tarjeta" />
                  {copiado === "pago-movil" ? "Datos copiados" : "Copiar todos los datos"}
                </button>
                {copiado === "error" && (
                  <p className="card__hint">No se pudo copiar; selecciona el dato a mano.</p>
                )}
              </section>

              <section className="card">
                <div className="card__head">
                  <div>
                    <h2 className="card__title">Reportar recarga</h2>
                    <p className="card__hint">
                      Tarjeta {tarjeta.serial}
                      {tarjeta.estado === "bloqueada" ? " · bloqueada" : ""}
                    </p>
                  </div>
                  {tarjeta.estado !== "bloqueada" && paso !== "comprobante" && (
                    <span className="badge">
                      Paso {paso === "formulario" ? 1 : 2} de 2
                    </span>
                  )}
                </div>

                {tarjeta.estado === "bloqueada" ? (
                  <div className="aviso aviso--danger aviso--inline" role="status">
                    <Icon name="alerta" />
                    <div>
                      Esta tarjeta está bloqueada. Pasa por atención al cliente para
                      activarla antes de reportar una recarga.
                    </div>
                  </div>
                ) : paso === "formulario" ? (
                  <form className="recarga-form" onSubmit={revisar} noValidate>
                    {Object.keys(errores).length > 0 && (
                      <div className="aviso aviso--danger aviso--inline" role="alert">
                        <Icon name="alerta" />
                        <div>Revisa los campos marcados antes de continuar.</div>
                      </div>
                    )}

                    <div className="field">
                      <span className="field__label" id="montos-etiqueta">
                        Monto transferido (Bs)
                      </span>
                      <div className="montos" role="group" aria-labelledby="montos-etiqueta">
                        {MONTOS_RAPIDOS.map((monto) => (
                          <button
                            key={monto}
                            type="button"
                            className="monto-chip"
                            aria-pressed={borrador.monto === String(monto)}
                            onClick={() => cambiar("monto", String(monto))}
                          >
                            {formatearBs(monto)}
                          </button>
                        ))}
                      </div>
                      <label className="field__label" htmlFor="monto">
                        Otro monto
                      </label>
                      <input
                        id="monto"
                        className="input"
                        type="number"
                        min="1"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={borrador.monto}
                        onChange={(evento) => cambiar("monto", evento.target.value)}
                        aria-invalid={errores.monto ? true : undefined}
                        aria-describedby={
                          errores.monto ? "monto-ayuda monto-error" : "monto-ayuda"
                        }
                      />
                      <span className="field__hint" id="monto-ayuda">
                        {pasajesMonto > 0
                          ? `Equivale a ${pasajesMonto} ${
                              pasajesMonto === 1 ? "pasaje" : "pasajes"
                            } a la tarifa de ${formatearBs(tarifa)}.`
                          : "Elige una opción rápida o escribe el monto exacto."}
                      </span>
                      {errores.monto && (
                        <p className="field__error" id="monto-error">
                          {errores.monto}
                        </p>
                      )}
                    </div>

                    <div className="campo-fila">
                      <div className="field">
                        <label className="field__label" htmlFor="telefono">
                          Teléfono de origen
                        </label>
                        <input
                          id="telefono"
                          className="input mono"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          placeholder="0414-1234567"
                          maxLength={12}
                          value={borrador.telefono}
                          onChange={(evento) =>
                            cambiar("telefono", formatearTelefono(evento.target.value))
                          }
                          aria-invalid={errores.telefono ? true : undefined}
                          aria-describedby={errores.telefono ? "telefono-error" : undefined}
                        />
                        {errores.telefono && (
                          <p className="field__error" id="telefono-error">
                            {errores.telefono}
                          </p>
                        )}
                      </div>
                      <div className="field">
                        <label className="field__label" htmlFor="banco">
                          Banco emisor
                        </label>
                        <select
                          id="banco"
                          className="select"
                          value={borrador.banco}
                          onChange={(evento) => cambiar("banco", evento.target.value)}
                          aria-invalid={errores.banco ? true : undefined}
                          aria-describedby={errores.banco ? "banco-error" : undefined}
                        >
                          <option value="">Selecciona…</option>
                          {BANCOS_EMISORES.map((banco) => (
                            <option key={banco} value={banco}>
                              {banco}
                            </option>
                          ))}
                        </select>
                        {errores.banco && (
                          <p className="field__error" id="banco-error">
                            {errores.banco}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="field">
                      <label className="field__label" htmlFor="referencia">
                        Últimos 4 de la referencia
                      </label>
                      <input
                        id="referencia"
                        className="input mono"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={4}
                        placeholder="1234"
                        value={borrador.referencia}
                        onChange={(evento) =>
                          cambiar(
                            "referencia",
                            evento.target.value.replace(/\D/g, "").slice(0, 4)
                          )
                        }
                        aria-invalid={errores.referencia ? true : undefined}
                        aria-describedby={errores.referencia ? "referencia-ayuda referencia-error" : "referencia-ayuda"}
                      />
                      <span className="field__hint" id="referencia-ayuda">
                        Aparece en tu comprobante bancario; nos ayuda a verificarlo.
                      </span>
                      {errores.referencia && (
                        <p className="field__error" id="referencia-error">
                          {errores.referencia}
                        </p>
                      )}
                    </div>

                    <button type="submit" className="btn btn--primary btn--block">
                      <Icon name="check" />
                      Revisar recarga
                    </button>
                  </form>
                ) : paso === "revision" ? (
                  <section className="paso-panel" aria-labelledby="revision-titulo">
                    <h3
                      className="paso-panel__titulo"
                      id="revision-titulo"
                      tabIndex={-1}
                      ref={tituloPasoRef}
                    >
                      Revisa antes de reportar
                    </h3>
                    <p className="paso-panel__intro">
                      Confirma que estos datos coinciden con tu Pago Móvil. Si algo no
                      cuadra, vuelve y edítalo.
                    </p>
                    <dl className="datos revision__datos">
                      <div>
                        <dt>Tarjeta</dt>
                        <dd className="mono">{tarjeta.serial}</dd>
                      </div>
                      <div>
                        <dt>Monto</dt>
                        <dd className="mono">{formatearBs(Number(borrador.monto))}</dd>
                      </div>
                      <div>
                        <dt>Pasajes equivalentes</dt>
                        <dd>{pasajesEquivalentes(Number(borrador.monto), tarifa)}</dd>
                      </div>
                      <div>
                        <dt>Teléfono de origen</dt>
                        <dd className="mono">{formatearTelefono(borrador.telefono)}</dd>
                      </div>
                      <div>
                        <dt>Banco emisor</dt>
                        <dd>{borrador.banco}</dd>
                      </div>
                      <div>
                        <dt>Referencia</dt>
                        <dd className="mono">…{borrador.referencia}</dd>
                      </div>
                    </dl>
                    <div className="aviso aviso--warning aviso--inline">
                      <Icon name="alerta" />
                      <div>
                        El saldo se acredita cuando Admin confirma el Pago Móvil.
                      </div>
                    </div>
                    <div className="paso-panel__acciones">
                      <button
                        type="button"
                        className="btn btn--primary btn--block"
                        onClick={confirmar}
                      >
                        <Icon name="check" />
                        Confirmar reporte
                      </button>
                      <button
                        type="button"
                        className="btn btn--plain btn--block"
                        onClick={volverAlFormulario}
                      >
                        Volver y editar
                      </button>
                    </div>
                  </section>
                ) : (
                  recargaReportada && (
                    <section className="comprobante" aria-labelledby="comprobante-titulo">
                      <span className="comprobante__icono">
                        <Icon name="check" />
                      </span>
                      <h3
                        className="comprobante__titulo"
                        id="comprobante-titulo"
                        tabIndex={-1}
                        ref={tituloPasoRef}
                      >
                        Recarga reportada
                      </h3>
                      <p className="comprobante__monto mono">
                        {formatearBs(recargaReportada.monto)}
                      </p>
                      <span className="badge badge--warning">Pendiente de aprobación</span>
                      <dl className="datos comprobante__datos">
                        <div>
                          <dt>Tarjeta</dt>
                          <dd className="mono">{recargaReportada.serial}</dd>
                        </div>
                        <div>
                          <dt>Banco y referencia</dt>
                          <dd>
                            {recargaReportada.banco} ·{" "}
                            <span className="mono">…{recargaReportada.referencia}</span>
                          </dd>
                        </div>
                        <div>
                          <dt>Teléfono de origen</dt>
                          <dd className="mono">
                            {formatearTelefono(recargaReportada.telefono)}
                          </dd>
                        </div>
                        <div>
                          <dt>Fecha y hora</dt>
                          <dd className="mono">{formatearFechaHora(recargaReportada.at)}</dd>
                        </div>
                        <div>
                          <dt>N.º de reporte</dt>
                          <dd className="mono">
                            {recargaReportada.id.slice(0, 8).toUpperCase()}
                          </dd>
                        </div>
                      </dl>
                      <p className="comprobante__nota">
                        Guarda este comprobante. Admin verificará el Pago Móvil y
                        acreditará el saldo; puedes seguir el estado en «Recargas
                        recientes».
                      </p>
                      <button
                        type="button"
                        className="btn btn--primary btn--block"
                        onClick={reportarOtra}
                      >
                        <Icon name="actualizar" />
                        Reportar otra recarga
                      </button>
                    </section>
                  )
                )}
              </section>
            </div>
          </div>

          <div className="historial-grid">
            <section className="card">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Recargas recientes</h2>
                  <p className="card__hint">Últimas 5 de esta tarjeta.</p>
                </div>
              </div>
              {recargasTarjeta.length === 0 ? (
                <p className="empty">Sin recargas reportadas todavía.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th className="num">Monto</th>
                        <th>Banco</th>
                        <th>Ref.</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recargasTarjeta.map((recarga) => (
                        <tr key={recarga.id}>
                          <td className="mono">{formatearFechaHora(recarga.at)}</td>
                          <td className="num mono">{formatearBs(recarga.monto)}</td>
                          <td>{recarga.banco}</td>
                          <td className="mono">{recarga.referencia}</td>
                          <td>
                            <span
                              className={`badge ${
                                recarga.estado === "aprobado"
                                  ? "badge--success"
                                  : recarga.estado === "rechazado"
                                    ? "badge--danger"
                                    : "badge--warning"
                              }`}
                            >
                              {recarga.estado === "aprobado"
                                ? "Aprobada"
                                : recarga.estado === "rechazado"
                                  ? "Rechazada"
                                  : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <div className="card__head">
                <div>
                  <h2 className="card__title">Últimos viajes</h2>
                  <p className="card__hint">Cobros aprobados con esta tarjeta.</p>
                </div>
              </div>
              {viajesTarjeta.length === 0 ? (
                <p className="empty">Sin viajes registrados todavía.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Unidad</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viajesTarjeta.map((viaje) => (
                        <tr key={viaje.id}>
                          <td className="mono">{formatearHora(viaje.at)}</td>
                          <td className="mono">{viaje.unidad}</td>
                          <td className="num mono">{formatearBs(viaje.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function TarjetaVirtual({
  tarjeta,
  tarifa,
  patrocinio,
}: {
  tarjeta: Tarjeta;
  tarifa: number;
  patrocinio: Configuracion["patrocinio"];
}) {
  const pasajes = pasajesEquivalentes(tarjeta.saldo, tarifa);

  return (
    <article className="tarjeta-virtual" aria-label={`Tarjeta ${tarjeta.serial}`}>
      <div className="tarjeta-virtual__top">
        <span className="tarjeta-virtual__marca">
          BLINK <em>PASAJES</em>
        </span>
        <span className="tarjeta-virtual__chip" aria-hidden="true" />
      </div>

      <div className="tarjeta-virtual__serial">
        <span>Serial</span>
        <strong className="mono">{tarjeta.serial}</strong>
      </div>

      <div className="tarjeta-virtual__saldo">
        <span>Saldo disponible</span>
        <strong className="mono">{formatearBs(tarjeta.saldo)}</strong>
        <span className="tarjeta-virtual__pasajes">
          {pasajes} {pasajes === 1 ? "pasaje" : "pasajes"} a la tarifa actual
        </span>
      </div>

      <div className="tarjeta-virtual__pie">
        <div>
          <span className="tarjeta-virtual__etiqueta">Titular</span>
          <strong>{tarjeta.titular}</strong>
          <span className="mono tarjeta-virtual__cedula">{tarjeta.cedula ?? "sin cédula"}</span>
        </div>
        {patrocinio.enlace ? (
          <a
            className="tarjeta-virtual__patrocinio"
            href={patrocinio.enlace}
            target="_blank"
            rel="noreferrer"
            title={`Patrocinante: ${patrocinio.nombre}`}
          >
            {patrocinio.nombre}
          </a>
        ) : (
          <span className="tarjeta-virtual__patrocinio">{patrocinio.nombre}</span>
        )}
      </div>

      {tarjeta.estado === "bloqueada" && (
        <span className="tarjeta-virtual__bloqueada">Bloqueada</span>
      )}
    </article>
  );
}

function DatoCopiable({
  etiqueta,
  valor,
  clave,
  copiado,
  alCopiar,
}: {
  etiqueta: string;
  valor: string;
  clave: string;
  copiado: string | null;
  alCopiar: (valor: string, clave: string) => void;
}) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>
        <span className="mono">{valor}</span>
        <button
          type="button"
          className="btn btn--xs btn--plain"
          onClick={() => alCopiar(valor, clave)}
        >
          {copiado === clave ? "Copiado" : "Copiar"}
        </button>
      </dd>
    </div>
  );
}
