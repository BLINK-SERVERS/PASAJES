import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import {
  cargarConfig,
  cargarCuota,
  cargarRecargas,
  cargarTarifa,
  cargarTarjetas,
  cargarViajes,
  formatearBs,
  formatearFechaHora,
  guardarConfig,
  guardarRecargas,
  guardarTarifa,
  guardarTarjetas,
  type Configuracion,
  type Recarga,
  type Tarjeta,
  type Viaje,
} from "../lib/datos";
import {
  aprobarRecarga,
  liquidacionDelDia,
  rechazarRecarga,
  siguienteSerial,
} from "../lib/admin";
import { LectorSerial, type MensajeLector } from "../lib/serial";

type Aviso = { tipo: "success" | "danger" | "warning"; texto: string };
type EstadoLector = "desconectado" | "conectando" | "conectado";

interface BorradorConfig {
  tarifa: string;
  comision: string;
  banco: string;
  rif: string;
  telefono: string;
  patrocinioNombre: string;
  patrocinioEnlace: string;
}

export function Admin() {
  const [soportado] = useState(
    () => typeof navigator !== "undefined" && "serial" in navigator
  );
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(cargarTarjetas);
  const [viajes] = useState<Viaje[]>(cargarViajes);
  const [recargas, setRecargas] = useState<Recarga[]>(cargarRecargas);
  const [config, setConfig] = useState<Configuracion>(cargarConfig);
  const [tarifa, setTarifa] = useState(cargarTarifa);
  const [cuota] = useState(cargarCuota);

  const [borrador, setBorrador] = useState<BorradorConfig>(() =>
    borradorDesde(cargarConfig(), cargarTarifa())
  );
  const [avisoConfig, setAvisoConfig] = useState<Aviso | null>(null);

  const [estadoLector, setEstadoLector] = useState<EstadoLector>("desconectado");
  const [avisoLector, setAvisoLector] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [enrolo, setEnrolo] = useState({ titular: "", cedula: "", saldo: "0" });
  const [avisoEnrolo, setAvisoEnrolo] = useState<Aviso | null>(null);
  const [avisoRecargas, setAvisoRecargas] = useState<Aviso | null>(null);

  const lectorRef = useRef<LectorSerial | null>(null);
  const tarjetasRef = useRef(tarjetas);
  const ultimaLectura = useRef({ uid: "", at: 0 });

  useEffect(() => {
    tarjetasRef.current = tarjetas;
  }, [tarjetas]);

  const manejarMensaje = useCallback((mensaje: MensajeLector) => {
    if (mensaje.tipo !== "tarjeta") return;

    const ahora = Date.now();
    if (
      mensaje.uid === ultimaLectura.current.uid &&
      ahora - ultimaLectura.current.at < 1500
    ) {
      return;
    }
    ultimaLectura.current = { uid: mensaje.uid, at: ahora };

    const ocupada = tarjetasRef.current.find(
      (tarjeta) => tarjeta.uid && tarjeta.uid.toUpperCase() === mensaje.uid
    );
    if (ocupada) {
      setAvisoEnrolo({
        tipo: "danger",
        texto: `El UID ${mensaje.uid} ya pertenece a ${ocupada.serial}. Acerca una tarjeta virgen.`,
      });
      return;
    }

    setUid(mensaje.uid);
    setAvisoEnrolo(null);
  }, []);

  useEffect(() => {
    if (!soportado) return;
    const alDesconectar = () => {
      if (!lectorRef.current) return;
      lectorRef.current = null;
      setEstadoLector("desconectado");
      setAvisoLector("El lector se desconectó. Vuelve a conectarlo.");
    };
    navigator.serial.addEventListener("disconnect", alDesconectar);
    return () => {
      navigator.serial.removeEventListener("disconnect", alDesconectar);
      void lectorRef.current?.desconectar();
      lectorRef.current = null;
    };
  }, [soportado]);

  const conectar = useCallback(async () => {
    setAvisoLector(null);
    setEstadoLector("conectando");
    const lector = new LectorSerial();
    try {
      await lector.conectar(manejarMensaje);
      lectorRef.current = lector;
      setEstadoLector("conectado");
    } catch (error) {
      setEstadoLector("desconectado");
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setAvisoLector("No elegiste ningún puerto. Pulsa Conectar y selecciona el CH340.");
      } else {
        setAvisoLector(`No se pudo abrir el lector: ${mensajeDeError(error)}`);
      }
    }
  }, [manejarMensaje]);

  const desconectar = useCallback(async () => {
    const lector = lectorRef.current;
    lectorRef.current = null;
    setEstadoLector("desconectado");
    await lector?.desconectar();
  }, []);

  function guardarConfiguracion(evento: FormEvent) {
    evento.preventDefault();

    const nuevaTarifa = Number(borrador.tarifa);
    if (!Number.isFinite(nuevaTarifa) || nuevaTarifa <= 0) {
      setAvisoConfig({ tipo: "danger", texto: "La tarifa debe ser mayor que cero." });
      return;
    }

    const comision = Number(borrador.comision);
    if (!Number.isFinite(comision) || comision < 0 || comision > 100) {
      setAvisoConfig({
        tipo: "danger",
        texto: "La comisión debe estar entre 0 y 100 por ciento.",
      });
      return;
    }

    const banco = borrador.banco.trim();
    const rif = borrador.rif.trim().toUpperCase();
    const telefono = borrador.telefono.trim();
    if (!banco || !rif || !telefono) {
      setAvisoConfig({
        tipo: "danger",
        texto: "Completa banco, RIF y teléfono del Pago Móvil.",
      });
      return;
    }

    const patrocinioNombre = borrador.patrocinioNombre.trim();
    if (!patrocinioNombre) {
      setAvisoConfig({ tipo: "danger", texto: "Escribe el nombre del patrocinante." });
      return;
    }

    const patrocinioEnlace = borrador.patrocinioEnlace.trim();
    if (patrocinioEnlace && !/^https?:\/\//i.test(patrocinioEnlace)) {
      setAvisoConfig({
        tipo: "danger",
        texto: "El enlace del QR debe empezar por http:// o https://.",
      });
      return;
    }

    const nueva: Configuracion = {
      comision,
      pagoMovil: { banco, rif, telefono },
      patrocinio: { nombre: patrocinioNombre, enlace: patrocinioEnlace },
    };
    guardarTarifa(nuevaTarifa);
    guardarConfig(nueva);
    setTarifa(nuevaTarifa);
    setConfig(nueva);
    setBorrador(borradorDesde(nueva, nuevaTarifa));
    setAvisoConfig({
      tipo: "success",
      texto: `Guardado: ${formatearBs(nuevaTarifa)} por pasaje y ${comision}% de comisión.`,
    });
  }

  function enrolar(evento: FormEvent) {
    evento.preventDefault();

    if (!uid) {
      setAvisoEnrolo({
        tipo: "danger",
        texto: "Acerca una tarjeta virgen al lector antes de guardar.",
      });
      return;
    }

    const titular = enrolo.titular.trim();
    if (!titular) {
      setAvisoEnrolo({ tipo: "danger", texto: "Escribe el nombre del titular." });
      return;
    }

    const cedula = normalizarCedula(enrolo.cedula);
    if (cedula && !/^[VE]-\d{6,9}$/.test(cedula)) {
      setAvisoEnrolo({
        tipo: "danger",
        texto: "Escribe la cédula como V-12345678.",
      });
      return;
    }

    const saldo = Number(enrolo.saldo);
    if (!Number.isFinite(saldo) || saldo < 0) {
      setAvisoEnrolo({
        tipo: "danger",
        texto: "El saldo inicial debe ser cero o mayor.",
      });
      return;
    }

    if (tarjetas.some((tarjeta) => tarjeta.uid && tarjeta.uid.toUpperCase() === uid)) {
      setAvisoEnrolo({
        tipo: "danger",
        texto: `El UID ${uid} ya está enrolado.`,
      });
      return;
    }

    const serial = siguienteSerial(tarjetas);
    const nueva: Tarjeta = {
      uid,
      serial,
      titular,
      saldo,
      estado: "activa",
      ...(cedula ? { cedula } : {}),
    };
    const nuevas = [...tarjetas, nueva];
    setTarjetas(nuevas);
    guardarTarjetas(nuevas);
    setUid(null);
    setEnrolo({ titular: "", cedula: "", saldo: "0" });
    setAvisoEnrolo({
      tipo: "success",
      texto: `Tarjeta ${serial} enrolada para ${titular} con ${formatearBs(saldo)}.`,
    });
  }

  function aprobar(id: string) {
    const recarga = recargas.find((item) => item.id === id);
    if (!recarga) return;

    const resultado = aprobarRecarga(tarjetas, recarga, recargas);
    if (!resultado.ok) {
      setAvisoRecargas({ tipo: "danger", texto: resultado.error });
      return;
    }

    setTarjetas(resultado.tarjetas);
    guardarTarjetas(resultado.tarjetas);
    const nuevas = recargas.map((item) => (item.id === id ? resultado.recarga : item));
    setRecargas(nuevas);
    guardarRecargas(nuevas);

    const tarjeta = resultado.tarjetas.find((item) => item.serial === recarga.serial);
    setAvisoRecargas({
      tipo: "success",
      texto: `Acreditamos ${formatearBs(recarga.monto)} a ${recarga.serial}. Saldo nuevo: ${formatearBs(
        tarjeta?.saldo ?? 0
      )}.`,
    });
  }

  function rechazar(id: string) {
    const recarga = recargas.find((item) => item.id === id);
    if (!recarga) return;

    const nuevas = recargas.map((item) =>
      item.id === id ? rechazarRecarga(item) : item
    );
    setRecargas(nuevas);
    guardarRecargas(nuevas);
    setAvisoRecargas({
      tipo: "warning",
      texto: `Rechazamos la recarga de ${formatearBs(recarga.monto)} de ${recarga.serial}. No se tocó el saldo.`,
    });
  }

  function alternarTarjeta(serial: string) {
    const nuevas = tarjetas.map((tarjeta) => {
      if (tarjeta.serial !== serial) return tarjeta;
      const estado: Tarjeta["estado"] =
        tarjeta.estado === "activa" ? "bloqueada" : "activa";
      return { ...tarjeta, estado };
    });
    setTarjetas(nuevas);
    guardarTarjetas(nuevas);
  }

  const pendientes = recargas.filter((recarga) => recarga.estado === "pendiente");
  const conciliadas = recargas
    .filter((recarga) => recarga.estado !== "pendiente")
    .slice(0, 5);
  const liquidacion = liquidacionDelDia(viajes, cuota, config.comision);
  const proximoSerial = siguienteSerial(tarjetas);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="muted">
            Tarifa, enrolamiento de tarjetas y conciliación de la línea.
          </p>
        </div>
        <div className="actions">
          <span className="badge badge--accent">Tarifa {formatearBs(tarifa)}</span>
          <span className={`badge ${pendientes.length ? "badge--warning" : "badge--success"}`}>
            {pendientes.length
              ? `${pendientes.length} por conciliar`
              : "Sin pendientes"}
          </span>
        </div>
      </header>

      <div className="admin-grid">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Configuración global</h2>
              <p className="card__hint">
                Se aplica de inmediato en el Lector y en el Portal.
              </p>
            </div>
          </div>

          <form className="config-form" onSubmit={guardarConfiguracion}>
            <fieldset className="config-grupo">
              <legend>Economía</legend>
              <div className="campo-fila">
                <div className="field">
                  <label className="field__label" htmlFor="tarifa">
                    Tarifa del pasaje (Bs)
                  </label>
                  <input
                    id="tarifa"
                    className="input mono"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={borrador.tarifa}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, tarifa: evento.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="comision">
                    Comisión BLINK (%)
                  </label>
                  <input
                    id="comision"
                    className="input mono"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    inputMode="decimal"
                    value={borrador.comision}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, comision: evento.target.value })
                    }
                  />
                  <span className="field__hint">
                    Se descuenta del recaudado en la liquidación.
                  </span>
                </div>
              </div>
            </fieldset>

            <fieldset className="config-grupo">
              <legend>Pago Móvil de BLINK</legend>
              <div className="campo-fila">
                <div className="field">
                  <label className="field__label" htmlFor="banco">
                    Banco
                  </label>
                  <input
                    id="banco"
                    className="input"
                    value={borrador.banco}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, banco: evento.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="rif">
                    RIF
                  </label>
                  <input
                    id="rif"
                    className="input mono"
                    value={borrador.rif}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, rif: evento.target.value })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="telefono-pago">
                  Teléfono
                </label>
                <input
                  id="telefono-pago"
                  className="input mono"
                  inputMode="tel"
                  value={borrador.telefono}
                  onChange={(evento) =>
                    setBorrador({ ...borrador, telefono: evento.target.value })
                  }
                />
              </div>
            </fieldset>

            <fieldset className="config-grupo">
              <legend>Patrocinio del QR</legend>
              <div className="campo-fila">
                <div className="field">
                  <label className="field__label" htmlFor="patrocinio-nombre">
                    Nombre del patrocinante
                  </label>
                  <input
                    id="patrocinio-nombre"
                    className="input"
                    value={borrador.patrocinioNombre}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, patrocinioNombre: evento.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="patrocinio-enlace">
                    Enlace del QR
                  </label>
                  <input
                    id="patrocinio-enlace"
                    className="input"
                    type="url"
                    placeholder="https://…"
                    value={borrador.patrocinioEnlace}
                    onChange={(evento) =>
                      setBorrador({ ...borrador, patrocinioEnlace: evento.target.value })
                    }
                  />
                </div>
              </div>
            </fieldset>

            <button type="submit" className="btn btn--primary btn--block">
              <Icon name="check" />
              Guardar configuración
            </button>
            {avisoConfig && <AvisoInline aviso={avisoConfig} />}
          </form>
        </section>

        <section className="card enrolador">
          <div className="card__head">
            <div>
              <h2 className="card__title">Enrolador de tarjetas</h2>
              <p className="card__hint">
                Acerca una tarjeta virgen al RC522; se le asigna el siguiente serial.
              </p>
            </div>
            <span
              className={`badge ${estadoLector === "conectado" ? "badge--success" : ""}`}
            >
              <span
                className={`punto ${estadoLector === "conectado" ? "" : "punto--gris"}`}
                aria-hidden="true"
              />
              {estadoLector === "conectado"
                ? "Lector conectado"
                : estadoLector === "conectando"
                  ? "Conectando…"
                  : "Sin lector"}
            </span>
          </div>

          {!soportado ? (
            <div className="aviso aviso--warning aviso--inline" role="alert">
              <Icon name="alerta" />
              <div>Web Serial solo funciona en Chrome o Edge de escritorio.</div>
            </div>
          ) : (
            <div className="acciones">
              {estadoLector === "conectado" ? (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => void desconectar()}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => void conectar()}
                  disabled={estadoLector === "conectando"}
                >
                  <Icon name="conectar" />
                  {estadoLector === "conectando" ? "Conectando…" : "Conectar lector"}
                </button>
              )}
            </div>
          )}

          {avisoLector && (
            <div className="aviso aviso--danger aviso--inline" role="alert">
              <Icon name="alerta" />
              <div>{avisoLector}</div>
            </div>
          )}

          <div className="enrolador__serial">
            <span>Serial a asignar</span>
            <strong className="mono">{proximoSerial}</strong>
          </div>

          {uid ? (
            <div className="uid-capturado">
              <div>
                <span>UID capturado</span>
                <strong className="mono">{uid}</strong>
              </div>
              <button
                type="button"
                className="btn btn--xs btn--plain"
                onClick={() => setUid(null)}
              >
                Descartar
              </button>
            </div>
          ) : (
            <p className="empty">
              Acerca una tarjeta virgen al RC522 para capturar su UID.
            </p>
          )}

          <form className="recarga-form" onSubmit={enrolar}>
            <div className="field">
              <label className="field__label" htmlFor="titular">
                Titular
              </label>
              <input
                id="titular"
                className="input"
                placeholder="Nombre y apellido"
                autoComplete="off"
                value={enrolo.titular}
                onChange={(evento) =>
                  setEnrolo({ ...enrolo, titular: evento.target.value })
                }
              />
            </div>
            <div className="campo-fila">
              <div className="field">
                <label className="field__label" htmlFor="cedula">
                  Cédula
                </label>
                <input
                  id="cedula"
                  className="input mono"
                  placeholder="V-12345678"
                  autoComplete="off"
                  value={enrolo.cedula}
                  onChange={(evento) =>
                    setEnrolo({ ...enrolo, cedula: evento.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="saldo-inicial">
                  Saldo inicial (Bs)
                </label>
                <input
                  id="saldo-inicial"
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={enrolo.saldo}
                  onChange={(evento) =>
                    setEnrolo({ ...enrolo, saldo: evento.target.value })
                  }
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={!uid}
            >
              <Icon name="tarjeta" />
              Enrolar tarjeta
            </button>
          </form>
          {avisoEnrolo && <AvisoInline aviso={avisoEnrolo} />}

          {import.meta.env.DEV && (
            <p className="dev-hint">
              Modo desarrollo:{" "}
              <button
                type="button"
                className="btn btn--xs btn--plain"
                onClick={() => manejarMensaje({ tipo: "tarjeta", uid: "A1B2C3D4" })}
              >
                simular tarjeta virgen
              </button>{" "}
              <button
                type="button"
                className="btn btn--xs btn--plain"
                onClick={() => manejarMensaje({ tipo: "tarjeta", uid: "3981BF06" })}
              >
                simular UID ya enrolado
              </button>
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Conciliación de recargas</h2>
            <p className="card__hint">
              Reportadas desde el Portal del Pasajero por Pago Móvil.
            </p>
          </div>
          <span
            className={`badge ${pendientes.length ? "badge--warning" : "badge--success"}`}
          >
            {pendientes.length
              ? `${pendientes.length} pendientes`
              : "Todo conciliado"}
          </span>
        </div>

        {avisoRecargas && <AvisoInline aviso={avisoRecargas} />}

        {pendientes.length === 0 ? (
          <p className="empty">No hay recargas pendientes.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tarjeta</th>
                  <th className="num">Monto</th>
                  <th>Pago</th>
                  <th className="num">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((recarga) => {
                  const tarjeta = tarjetas.find(
                    (item) => item.serial === recarga.serial
                  );
                  return (
                    <tr key={recarga.id}>
                      <td className="mono">{formatearFechaHora(recarga.at)}</td>
                      <td>
                        <div className="mono">{recarga.serial}</div>
                        <div className="dim">
                          {tarjeta ? tarjeta.titular : "Sin tarjeta enrolada"}
                          {tarjeta?.estado === "bloqueada" ? " · bloqueada" : ""}
                        </div>
                      </td>
                      <td className="num mono">{formatearBs(recarga.monto)}</td>
                      <td>
                        <div>
                          {recarga.banco} · <span className="mono">{recarga.referencia}</span>
                        </div>
                        <div className="dim mono">{recarga.telefono}</div>
                      </td>
                      <td className="num">
                        <div className="acciones acciones--fin">
                          <button
                            type="button"
                            className="btn btn--xs btn--soft"
                            onClick={() => aprobar(recarga.id)}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn btn--xs btn--plain"
                            onClick={() => rechazar(recarga.id)}
                          >
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {conciliadas.length > 0 && (
          <>
            <h3 className="config__subtitulo">Conciliadas recientemente</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tarjeta</th>
                    <th className="num">Monto</th>
                    <th>Banco / Ref.</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {conciliadas.map((recarga) => (
                    <tr key={recarga.id}>
                      <td className="mono">{formatearFechaHora(recarga.at)}</td>
                      <td className="mono">{recarga.serial}</td>
                      <td className="num mono">{formatearBs(recarga.monto)}</td>
                      <td>
                        {recarga.banco} ·{" "}
                        <span className="mono">{recarga.referencia}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            recarga.estado === "aprobado"
                              ? "badge--success"
                              : "badge--danger"
                          }`}
                        >
                          {recarga.estado === "aprobado" ? "Aprobada" : "Rechazada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Tarjetas emitidas</h2>
            <p className="card__hint">
              Un UID vacío es una tarjeta que todavía no se ha acercado al lector.
            </p>
          </div>
          <span className="badge">{tarjetas.length} emitidas</span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Titular</th>
                <th>Cédula</th>
                <th>UID</th>
                <th>Estado</th>
                <th className="num">Saldo</th>
                <th className="num">Acción</th>
              </tr>
            </thead>
            <tbody>
              {tarjetas.map((tarjeta) => (
                <tr key={tarjeta.serial}>
                  <td className="mono">{tarjeta.serial}</td>
                  <td>{tarjeta.titular}</td>
                  <td className="mono">{tarjeta.cedula ?? "—"}</td>
                  <td className="mono">{tarjeta.uid || "—"}</td>
                  <td>
                    <span
                      className={`badge ${
                        tarjeta.estado === "activa" ? "badge--success" : "badge--danger"
                      }`}
                    >
                      {tarjeta.estado}
                    </span>
                  </td>
                  <td className="num mono">{formatearBs(tarjeta.saldo)}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="btn btn--xs btn--plain"
                      onClick={() => alternarTarjeta(tarjeta.serial)}
                    >
                      {tarjeta.estado === "activa" ? "Bloquear" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Liquidación del día</h2>
            <p className="card__hint">
              Recaudado de hoy menos comisión BLINK y cuota de la línea.
            </p>
          </div>
          <div className="actions">
            <span className="badge">Comisión {config.comision}%</span>
            <span className="badge">Cuota {formatearBs(cuota)}</span>
          </div>
        </div>

        {liquidacion.filas.length === 0 ? (
          <p className="empty">Sin cobros registrados hoy.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Chofer</th>
                  <th className="num">Pasajeros</th>
                  <th className="num">Recaudado</th>
                  <th className="num">Comisión</th>
                  <th className="num">Cuota</th>
                  <th className="num">Neto al chofer</th>
                </tr>
              </thead>
              <tbody>
                {liquidacion.filas.map((fila) => (
                  <tr key={fila.unidad.id}>
                    <td className="mono">{fila.unidad.id}</td>
                    <td>
                      {fila.unidad.chofer}
                      <span
                        className={`badge badge--sep ${
                          fila.cuotaCumplida ? "badge--success" : "badge--warning"
                        }`}
                      >
                        {fila.cuotaCumplida ? "Cuota completa" : "Cuota parcial"}
                      </span>
                    </td>
                    <td className="num">{fila.pasajeros}</td>
                    <td className="num mono">{formatearBs(fila.recaudado)}</td>
                    <td className="num mono">−{formatearBs(fila.comision)}</td>
                    <td className="num mono">−{formatearBs(fila.cuota)}</td>
                    <td className="num mono">
                      <strong>{formatearBs(fila.neto)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total de la línea</td>
                  <td className="num">{liquidacion.totales.pasajeros}</td>
                  <td className="num mono">
                    {formatearBs(liquidacion.totales.recaudado)}
                  </td>
                  <td className="num mono">
                    −{formatearBs(liquidacion.totales.comision)}
                  </td>
                  <td className="num mono">−{formatearBs(liquidacion.totales.cuota)}</td>
                  <td className="num mono">
                    <strong>{formatearBs(liquidacion.totales.neto)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function AvisoInline({ aviso }: { aviso: Aviso }) {
  return (
    <div
      className={`aviso aviso--${aviso.tipo} aviso--inline`}
      role={aviso.tipo === "danger" ? "alert" : "status"}
    >
      <Icon name={aviso.tipo === "success" ? "check" : "alerta"} />
      <div>{aviso.texto}</div>
    </div>
  );
}

function borradorDesde(config: Configuracion, tarifa: number): BorradorConfig {
  return {
    tarifa: String(tarifa),
    comision: String(config.comision),
    banco: config.pagoMovil.banco,
    rif: config.pagoMovil.rif,
    telefono: config.pagoMovil.telefono,
    patrocinioNombre: config.patrocinio.nombre,
    patrocinioEnlace: config.patrocinio.enlace,
  };
}

function normalizarCedula(valor: string) {
  const limpio = valor.trim().toUpperCase().replace(/\s+/g, "");
  const partes = limpio.match(/^([VE])-?(\d{6,9})$/);
  return partes ? `${partes[1]}-${partes[2]}` : limpio;
}

function mensajeDeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
