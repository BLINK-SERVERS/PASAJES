import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import {
  cargarTarifa,
  cargarTarjetas,
  cargarUnidadActual,
  cargarViajes,
  formatearBs,
  formatearHora,
  guardarTarjetas,
  guardarUnidadActual,
  guardarViajes,
  procesarLectura,
  UNIDADES,
  type Resultado,
  type Tarjeta,
  type Viaje,
} from "../lib/datos";
import { LectorSerial, type MensajeLector } from "../lib/serial";

type EstadoConexion = "desconectado" | "conectando" | "conectado";

const MOTIVOS: Record<NonNullable<Resultado["motivo"]>, { titulo: string; pista: string }> = {
  "no-registrada": {
    titulo: "Tarjeta no registrada",
    pista: "Este UID no está vinculado a ningún serial. Enrola la tarjeta en el panel Admin.",
  },
  bloqueada: {
    titulo: "Tarjeta bloqueada",
    pista: "La tarjeta está bloqueada en el sistema. No se descontó nada.",
  },
  "saldo-insuficiente": {
    titulo: "Saldo insuficiente",
    pista: "El pasajero debe recargar desde el portal usando su serial.",
  },
};

export function Lector() {
  const [soportado] = useState(
    () => typeof navigator !== "undefined" && "serial" in navigator
  );
  const [estado, setEstado] = useState<EstadoConexion>("desconectado");
  const [aviso, setAviso] = useState<string | null>(null);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(cargarTarjetas);
  const [viajes, setViajes] = useState<Viaje[]>(cargarViajes);
  const [tarifa] = useState(cargarTarifa);
  const [unidad, setUnidad] = useState(cargarUnidadActual);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [ultimoPing, setUltimoPing] = useState<number | null>(null);
  const [turno, setTurno] = useState({ pasajeros: 0, monto: 0 });

  const lectorRef = useRef<LectorSerial | null>(null);
  const tarjetasRef = useRef(tarjetas);
  const unidadRef = useRef(unidad);
  const ultimaLectura = useRef({ uid: "", at: 0 });

  useEffect(() => {
    tarjetasRef.current = tarjetas;
  }, [tarjetas]);

  useEffect(() => {
    unidadRef.current = unidad;
  }, [unidad]);

  const manejar = useCallback(
    (mensaje: MensajeLector) => {
      if (mensaje.tipo === "listo") {
        setAviso(null);
        return;
      }
      if (mensaje.tipo === "pong") {
        setUltimoPing(Date.now());
        return;
      }
      if (mensaje.tipo !== "tarjeta") return;

      const ahora = Date.now();
      if (
        mensaje.uid === ultimaLectura.current.uid &&
        ahora - ultimaLectura.current.at < 1200
      ) {
        return;
      }
      ultimaLectura.current = { uid: mensaje.uid, at: ahora };

      const cobro = procesarLectura(
        tarjetasRef.current,
        mensaje.uid,
        tarifa,
        new Date(),
        unidadRef.current
      );
      tarjetasRef.current = cobro.tarjetas;
      setTarjetas(cobro.tarjetas);
      guardarTarjetas(cobro.tarjetas);
      setResultado(cobro.resultado);

      setViajes((prev) => {
        const siguiente = [cobro.viaje, ...prev].slice(0, 50);
        guardarViajes(siguiente);
        return siguiente;
      });

      if (cobro.resultado.resultado === "aprobado") {
        setTurno((t) => ({
          pasajeros: t.pasajeros + 1,
          monto: Math.round((t.monto + tarifa) * 100) / 100,
        }));
      }
    },
    [tarifa]
  );

  const conectar = useCallback(async () => {
    setAviso(null);
    setEstado("conectando");
    const lector = new LectorSerial();
    try {
      await lector.conectar(manejar);
      lectorRef.current = lector;
      setEstado("conectado");
      window.setTimeout(() => void lector.ping(), 600);
    } catch (error) {
      setEstado("desconectado");
      if (error instanceof DOMException && error.name === "NotFoundError") {
        setAviso("No elegiste ningún puerto. Pulsa Conectar y selecciona el CH340.");
      } else {
        setAviso(`No se pudo abrir el lector: ${mensajeDeError(error)}`);
      }
    }
  }, [manejar]);

  const desconectar = useCallback(async () => {
    const lector = lectorRef.current;
    lectorRef.current = null;
    setEstado("desconectado");
    await lector?.desconectar();
  }, []);

  const cambiarUnidad = (id: string) => {
    setUnidad(id);
    guardarUnidadActual(id);
    setTurno({ pasajeros: 0, monto: 0 });
    setResultado(null);
  };

  useEffect(() => {
    if (!soportado) return;
    const alDesconectar = () => {
      if (!lectorRef.current) return;
      lectorRef.current = null;
      setEstado("desconectado");
      setAviso("El lector se desconectó. Vuelve a conectarlo.");
    };
    navigator.serial.addEventListener("disconnect", alDesconectar);
    return () => {
      navigator.serial.removeEventListener("disconnect", alDesconectar);
      void lectorRef.current?.desconectar();
      lectorRef.current = null;
    };
  }, [soportado]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Lector / Chofer</h1>
          <p className="muted">
            Cobra el pasaje acercando la tarjeta o el llavero al módulo RC522.
          </p>
        </div>
        <div className="actions">
          <EstadoBadge estado={estado} />
          {estado === "conectado" ? (
            <button type="button" className="btn btn--ghost" onClick={() => void desconectar()}>
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void conectar()}
              disabled={!soportado || estado === "conectando"}
            >
              <Icon name="conectar" />
              {estado === "conectando" ? "Conectando…" : "Conectar lector"}
            </button>
          )}
        </div>
      </header>

      {!soportado && (
        <div className="aviso aviso--warning" role="alert">
          <Icon name="alerta" />
          <div>
            <strong>Este navegador no puede leer el puerto serie.</strong>
            <p>
              Web Serial solo existe en Chrome o Edge de escritorio. Abre esta página en
              la laptop, conecta la placa por USB y vuelve a intentar.
            </p>
          </div>
        </div>
      )}

      {aviso && (
        <div className="aviso aviso--danger" role="alert">
          <Icon name="alerta" />
          <div>{aviso}</div>
        </div>
      )}

      <div className="lector-grid">
        <div className="columna">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Lector NFC-01</h2>
                <p className="card__hint">ESP32 + RC522 por USB</p>
              </div>
              <Icon name="onda" className="icon--lg dim" />
            </div>
            <dl className="datos">
              <div>
                <dt>Unidad</dt>
                <dd>
                  <select
                    className="select select--inline"
                    value={unidad}
                    aria-label="Unidad asignada al lector"
                    onChange={(evento) => cambiarUnidad(evento.target.value)}
                  >
                    {UNIDADES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div>
                <dt>Chofer</dt>
                <dd>{UNIDADES.find((item) => item.id === unidad)?.chofer ?? "Sin asignar"}</dd>
              </div>
              <div>
                <dt>Tarifa vigente</dt>
                <dd className="mono">{formatearBs(tarifa)}</dd>
              </div>
              <div>
                <dt>Protocolo</dt>
                <dd className="mono">
                  {estado === "conectado" ? "BLINK v1" : "—"}
                </dd>
              </div>
              <div>
                <dt>Último PING</dt>
                <dd className="mono">
                  {ultimoPing
                    ? formatearHora(new Date(ultimoPing).toISOString())
                    : "—"}
                </dd>
              </div>
            </dl>
            {estado === "conectado" && (
              <button
                type="button"
                className="btn btn--sm btn--soft"
                onClick={() => void lectorRef.current?.ping()}
              >
                <Icon name="actualizar" />
                Probar conexión
              </button>
            )}
          </section>

          <section className={`resultado resultado--${claseResultado(resultado)}`}>
            {!resultado && (
              <>
                <Icon name="tarjeta" className="icon--xl" />
                <h2>Acerca la tarjeta</h2>
                <p>El resultado del cobro aparecerá aquí.</p>
              </>
            )}

            {resultado?.resultado === "aprobado" && (
              <>
                <Icon name="check" className="icon--xl" />
                <h2>Pasaje aprobado</h2>
                <p className="resultado__serial mono">{resultado.tarjeta?.serial}</p>
                <p className="resultado__monto mono">−{formatearBs(resultado.monto)}</p>
                <p>
                  Saldo restante:{" "}
                  <strong className="mono">{formatearBs(resultado.saldoDespues ?? 0)}</strong>
                </p>
              </>
            )}

            {resultado?.resultado === "rechazado" && resultado.motivo && (
              <>
                <Icon name="alerta" className="icon--xl" />
                <h2>{MOTIVOS[resultado.motivo].titulo}</h2>
                <p>{MOTIVOS[resultado.motivo].pista}</p>
                {resultado.tarjeta && (
                  <p className="resultado__serial mono">{resultado.tarjeta.serial}</p>
                )}
                <p className="resultado__uid mono">UID {resultado.tarjeta ? resultado.tarjeta.uid || "sin enrolar" : "no encontrado"}</p>
              </>
            )}
          </section>
        </div>

        <div className="columna">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Turno de hoy</h2>
                <p className="card__hint">Solo cuenta este turno en pantalla</p>
              </div>
              <button
                type="button"
                className="btn btn--xs btn--plain"
                onClick={() => setTurno({ pasajeros: 0, monto: 0 })}
              >
                Reiniciar
              </button>
            </div>
            <div className="stats">
              <div>
                <span className="stats__label">Pasajeros</span>
                <strong className="stats__valor">{turno.pasajeros}</strong>
              </div>
              <div>
                <span className="stats__label">Total cobrado</span>
                <strong className="stats__valor mono">{formatearBs(turno.monto)}</strong>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Movimientos</h2>
                <p className="card__hint">Últimos 50 toques, el más reciente primero</p>
              </div>
            </div>
            {viajes.length === 0 ? (
              <p className="empty">Todavía no hay lecturas.</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Unidad</th>
                      <th>Tarjeta</th>
                      <th>Resultado</th>
                      <th className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viajes.map((viaje) => (
                      <tr key={viaje.id}>
                        <td className="mono">{formatearHora(viaje.at)}</td>
                        <td className="mono">{viaje.unidad}</td>
                        <td className="mono">{viaje.serial ?? viaje.uid}</td>
                        <td>
                          <span
                            className={`badge ${
                              viaje.resultado === "aprobado" ? "badge--success" : "badge--danger"
                            }`}
                          >
                            {viaje.resultado === "aprobado"
                              ? "Aprobado"
                              : MOTIVOS[viaje.motivo ?? "no-registrada"].titulo}
                          </span>
                        </td>
                        <td className="num mono">
                          {viaje.resultado === "aprobado" ? formatearBs(viaje.monto) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {import.meta.env.DEV && (
        <p className="dev-hint">
          Modo desarrollo:{" "}
          <button
            type="button"
            className="btn btn--xs btn--plain"
            onClick={() => manejar({ tipo: "tarjeta", uid: "3981BF06" })}
          >
            simular tarjeta blanca
          </button>{" "}
          <button
            type="button"
            className="btn btn--xs btn--plain"
            onClick={() => manejar({ tipo: "tarjeta", uid: "DEADBEEF" })}
          >
            simular desconocida
          </button>{" "}
          <button
            type="button"
            className="btn btn--xs btn--plain"
            onClick={() => manejar({ tipo: "tarjeta", uid: "058151954F3400" })}
          >
            simular llavero
          </button>
        </p>
      )}
    </>
  );
}

function EstadoBadge({ estado }: { estado: EstadoConexion }) {
  if (estado === "conectado") {
    return (
      <span className="badge badge--success">
        <span className="punto" aria-hidden="true" />
        Conectado
      </span>
    );
  }
  return (
    <span className="badge">
      <span className="punto punto--gris" aria-hidden="true" />
      {estado === "conectando" ? "Conectando…" : "Desconectado"}
    </span>
  );
}

function claseResultado(resultado: Resultado | null) {
  if (!resultado) return "idle";
  return resultado.resultado;
}

function mensajeDeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
