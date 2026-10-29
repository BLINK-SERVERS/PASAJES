import { UNIDADES, type Unidad, type Viaje } from "./datos";

export interface ResumenUnidad {
  unidad: Unidad;
  activa: boolean;
  ultimoCobro: string | null;
  pasajeros: number;
  recaudado: number;
  cuotaCumplida: boolean;
}

export interface ResumenFiscal {
  unidades: ResumenUnidad[];
  pasajeros: number;
  recaudado: number;
  porHora: { hora: number; pasajeros: number }[];
}

function esMismoDia(iso: string, referencia: Date) {
  const fecha = new Date(iso);
  return (
    fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth() &&
    fecha.getDate() === referencia.getDate()
  );
}

/** Agrega los viajes del día por unidad y por hora (solo cobros aprobados). */
export function resumenDelDia(
  viajes: Viaje[],
  cuota: number,
  referencia: Date = new Date(),
  unidades: Unidad[] = UNIDADES
): ResumenFiscal {
  const aprobados = viajes.filter(
    (viaje) => viaje.resultado === "aprobado" && esMismoDia(viaje.at, referencia)
  );

  let pasajeros = 0;
  let recaudado = 0;
  const porHora = new Map<number, number>();

  for (const viaje of aprobados) {
    pasajeros += 1;
    recaudado += viaje.monto;

    const hora = new Date(viaje.at).getHours();
    porHora.set(hora, (porHora.get(hora) ?? 0) + 1);
  }

  const resumenUnidades = unidades.map((unidad) => {
    const propios = aprobados.filter((viaje) => viaje.unidad === unidad.id);
    const total = propios.reduce((suma, viaje) => suma + viaje.monto, 0);
    const ultimo = propios.reduce<string | null>((mayor, viaje) => {
      if (!mayor) return viaje.at;
      return new Date(viaje.at) > new Date(mayor) ? viaje.at : mayor;
    }, null);

    return {
      unidad,
      activa: propios.length > 0,
      ultimoCobro: ultimo,
      pasajeros: propios.length,
      recaudado: Math.round(total * 100) / 100,
      cuotaCumplida: total >= cuota,
    };
  });

  return {
    unidades: resumenUnidades,
    pasajeros,
    recaudado: Math.round(recaudado * 100) / 100,
    porHora: [...porHora.entries()]
      .map(([hora, total]) => ({ hora, pasajeros: total }))
      .sort((a, b) => a.hora - b.hora),
  };
}
