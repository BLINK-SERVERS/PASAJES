// Operaciones del panel administrativo: seriales, recargas y liquidación.

import { UNIDADES, type Recarga, type Tarjeta, type Unidad, type Viaje } from "./datos";
import { resumenDelDia } from "./fiscal";

const PREFIJO_SERIAL = "23-1";

/** Siguiente serial correlativo a partir del mayor ya emitido. */
export function siguienteSerial(tarjetas: Tarjeta[]): string {
  const mayor = tarjetas.reduce((maximo, tarjeta) => {
    const parte = tarjeta.serial.split("-")[2];
    const numero = Number(parte);
    return Number.isInteger(numero) ? Math.max(maximo, numero) : maximo;
  }, 0);

  return `${PREFIJO_SERIAL}-${String(mayor + 1).padStart(7, "0")}-0`;
}

export type Aprobacion =
  | { ok: true; tarjetas: Tarjeta[]; recarga: Recarga }
  | { ok: false; error: string };

/**
 * Acredita una recarga pendiente al saldo de su tarjeta. Con la lista de
 * recargas a la vista evita acreditar dos veces la misma referencia bancaria.
 */
export function aprobarRecarga(
  tarjetas: Tarjeta[],
  recarga: Recarga,
  recargas: Recarga[] = []
): Aprobacion {
  if (recarga.estado !== "pendiente") {
    return { ok: false, error: "Esa recarga ya fue conciliada." };
  }

  const duplicada = recargas.find(
    (item) =>
      item.id !== recarga.id &&
      item.estado === "aprobado" &&
      item.serial === recarga.serial &&
      item.banco === recarga.banco &&
      item.referencia === recarga.referencia
  );
  if (duplicada) {
    return {
      ok: false,
      error: `La referencia ${recarga.referencia} de ${recarga.banco} ya fue acreditada a esta tarjeta. Revísala antes de aprobar de nuevo.`,
    };
  }

  const indice = tarjetas.findIndex((tarjeta) => tarjeta.serial === recarga.serial);
  if (indice < 0) {
    return {
      ok: false,
      error: `No hay una tarjeta enrolada con el serial ${recarga.serial}.`,
    };
  }

  const tarjeta = tarjetas[indice];
  if (tarjeta.estado === "bloqueada") {
    return {
      ok: false,
      error: "La tarjeta está bloqueada; actívala antes de acreditar la recarga.",
    };
  }

  const actualizada: Tarjeta = {
    ...tarjeta,
    saldo: redondear(tarjeta.saldo + recarga.monto),
  };

  return {
    ok: true,
    tarjetas: tarjetas.map((item, i) => (i === indice ? actualizada : item)),
    recarga: { ...recarga, estado: "aprobado" },
  };
}

/** Marca una recarga como rechazada sin tocar el saldo. */
export function rechazarRecarga(recarga: Recarga): Recarga {
  return { ...recarga, estado: "rechazado" };
}

export interface LiquidacionUnidad {
  unidad: Unidad;
  pasajeros: number;
  recaudado: number;
  comision: number;
  cuota: number;
  neto: number;
  cuotaCumplida: boolean;
}

export interface Liquidacion {
  filas: LiquidacionUnidad[];
  totales: {
    pasajeros: number;
    recaudado: number;
    comision: number;
    cuota: number;
    neto: number;
  };
}

/**
 * Reparto del día por unidad: recaudado menos comisión BLINK y cuota de la
 * línea. La cuota solo se descuenta de lo que queda después de la comisión,
 * así el neto nunca es negativo.
 */
export function liquidacionDelDia(
  viajes: Viaje[],
  cuota: number,
  comisionPct: number,
  referencia: Date = new Date(),
  unidades: Unidad[] = UNIDADES
): Liquidacion {
  const porcentaje = Math.min(100, Math.max(0, comisionPct));
  const resumen = resumenDelDia(viajes, cuota, referencia, unidades);

  const filas = resumen.unidades
    .filter((unidad) => unidad.pasajeros > 0)
    .map((unidad) => {
      const comision = redondear((unidad.recaudado * porcentaje) / 100);
      const cuotaAplicada = Math.min(cuota, redondear(unidad.recaudado - comision));
      return {
        unidad: unidad.unidad,
        pasajeros: unidad.pasajeros,
        recaudado: unidad.recaudado,
        comision,
        cuota: cuotaAplicada,
        neto: redondear(unidad.recaudado - comision - cuotaAplicada),
        cuotaCumplida: unidad.cuotaCumplida,
      };
    });

  const totales = filas.reduce(
    (suma, fila) => ({
      pasajeros: suma.pasajeros + fila.pasajeros,
      recaudado: redondear(suma.recaudado + fila.recaudado),
      comision: redondear(suma.comision + fila.comision),
      cuota: redondear(suma.cuota + fila.cuota),
      neto: redondear(suma.neto + fila.neto),
    }),
    { pasajeros: 0, recaudado: 0, comision: 0, cuota: 0, neto: 0 }
  );

  return { filas, totales };
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}
