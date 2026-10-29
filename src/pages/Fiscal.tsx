import { useState, type FormEvent } from "react";
import {
  cargarCuota,
  cargarViajes,
  formatearBs,
  formatearHora,
  guardarCuota,
} from "../lib/datos";
import { resumenDelDia } from "../lib/fiscal";

export function Fiscal() {
  const [viajes] = useState(cargarViajes);
  const [cuota, setCuota] = useState(cargarCuota);
  const [borrador, setBorrador] = useState(String(cuota));
  const [error, setError] = useState<string | null>(null);

  const resumen = resumenDelDia(viajes, cuota);
  const enRuta = resumen.unidades.filter((item) => item.activa).length;
  const maximoHora = Math.max(1, ...resumen.porHora.map((item) => item.pasajeros));
  const fecha = new Date().toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  function aplicarCuota(evento: FormEvent) {
    evento.preventDefault();
    const valor = Number(borrador);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError("La cuota debe ser un monto mayor que cero.");
      return;
    }
    setError(null);
    setCuota(valor);
    guardarCuota(valor);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Fiscal de línea</h1>
          <p className="muted">Línea Demo · {fecha}</p>
        </div>
        <span className="badge badge--accent">{enRuta} de {resumen.unidades.length} en ruta</span>
      </header>

      <section className="card">
        <div className="stats stats--tres">
          <div>
            <span className="stats__label">Pasajeros hoy</span>
            <strong className="stats__valor">{resumen.pasajeros}</strong>
          </div>
          <div>
            <span className="stats__label">Recaudado hoy</span>
            <strong className="stats__valor mono">{formatearBs(resumen.recaudado)}</strong>
          </div>
          <div>
            <span className="stats__label">Cuota por unidad</span>
            <strong className="stats__valor mono">{formatearBs(cuota)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Unidades de la línea</h2>
            <p className="card__hint">
              Último cobro registrado por el lector de cada unidad.
            </p>
          </div>
        </div>
        <div className="tabla-unidades">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Unidad</th>
                  <th>Chofer</th>
                  <th>Estado</th>
                  <th>Último cobro</th>
                  <th className="num">Pasajeros</th>
                  <th className="num">Cuota</th>
                </tr>
              </thead>
              <tbody>
                {resumen.unidades.map((item) => (
                  <tr key={item.unidad.id}>
                    <td className="mono">{item.unidad.id}</td>
                    <td>{item.unidad.chofer}</td>
                    <td>
                      <span
                        className={`badge ${item.activa ? "badge--success" : ""}`}
                      >
                        {item.activa ? "En ruta" : "Sin actividad"}
                      </span>
                    </td>
                    <td className="mono">
                      {item.ultimoCobro ? formatearHora(item.ultimoCobro) : "—"}
                    </td>
                    <td className="num mono">{item.pasajeros}</td>
                    <td className="num">
                      <CuotaUnidad
                        recaudado={item.recaudado}
                        cuota={cuota}
                        cumplida={item.cuotaCumplida}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="unidad-cards">
          {resumen.unidades.map((item) => (
            <article className="unidad-card" key={item.unidad.id}>
              <div className="unidad-card__head">
                <div>
                  <strong className="mono">{item.unidad.id}</strong>
                  <span className="muted"> · {item.unidad.chofer}</span>
                </div>
                <span className={`badge ${item.activa ? "badge--success" : ""}`}>
                  {item.activa ? "En ruta" : "Sin actividad"}
                </span>
              </div>
              <div className="unidad-card__datos">
                <span>
                  Último cobro:{" "}
                  <strong className="mono">
                    {item.ultimoCobro ? formatearHora(item.ultimoCobro) : "—"}
                  </strong>
                </span>
                <span>
                  Pasajeros: <strong className="mono">{item.pasajeros}</strong>
                </span>
              </div>
              <CuotaUnidad
                recaudado={item.recaudado}
                cuota={cuota}
                cumplida={item.cuotaCumplida}
              />
            </article>
          ))}
        </div>
      </section>

      <div className="fiscal-grid">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Flujo de pasajeros por hora</h2>
              <p className="card__hint">Cobros aprobados de hoy.</p>
            </div>
          </div>
          {resumen.porHora.length === 0 ? (
            <p className="empty">Sin cobros registrados hoy.</p>
          ) : (
            <div className="flujo">
              {resumen.porHora.map((item) => (
                <div className="flujo__item" key={item.hora}>
                  <span className="flujo__valor mono">{item.pasajeros}</span>
                  <div
                    className="flujo__barra"
                    style={{ height: `${Math.max(6, (item.pasajeros / maximoHora) * 120)}px` }}
                    role="img"
                    aria-label={`${item.pasajeros} pasajeros a las ${item.hora}:00`}
                  />
                  <span className="flujo__hora mono">{String(item.hora).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">Cuota diaria</h2>
              <p className="card__hint">
                Se descuenta de los primeros pasajes de cada unidad.
              </p>
            </div>
          </div>
          <form className="cuota-form" onSubmit={aplicarCuota}>
            <label className="field__label" htmlFor="cuota">
              Monto por unidad (Bs)
            </label>
            <div className="cuota-form__fila">
              <input
                id="cuota"
                className="input"
                type="number"
                min="1"
                step="1"
                inputMode="decimal"
                value={borrador}
                onChange={(evento) => setBorrador(evento.target.value)}
              />
              <button type="submit" className="btn btn--sm btn--primary">
                Aplicar
              </button>
            </div>
          </form>
          {error ? (
            <p className="aviso aviso--danger aviso--inline" role="alert">
              {error}
            </p>
          ) : (
            <p className="card__hint">
              {resumen.unidades.filter((item) => item.cuotaCumplida).length} de{" "}
              {resumen.unidades.length} unidades ya cubrieron su cuota.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function CuotaUnidad({
  recaudado,
  cuota,
  cumplida,
}: {
  recaudado: number;
  cuota: number;
  cumplida: boolean;
}) {
  return (
    <div className="cuota">
      <div className="cuota__fila">
        <span className="mono">
          {formatearBs(recaudado)} / {formatearBs(cuota)}
        </span>
        <span className={`badge ${cumplida ? "badge--success" : "badge--warning"}`}>
          {cumplida ? "Cumplida" : "Pendiente"}
        </span>
      </div>
      <div className="progreso" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (recaudado / cuota) * 100)}%` }} />
      </div>
    </div>
  );
}
