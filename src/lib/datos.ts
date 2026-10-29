// Dominio de BLINK PASAJES: tarjetas, cobro y viajes.

export interface Tarjeta {
  /** UID de fábrica del chip (lo lee el RC522). Vacío = aún sin enrolar. */
  uid: string;
  /** Serial público impreso en el plástico: 23-1-0000001-0. */
  serial: string;
  titular: string;
  /** Cédula del titular, para buscarla en el portal (V-12345678). */
  cedula?: string;
  saldo: number;
  estado: "activa" | "bloqueada";
}

export interface Recarga {
  id: string;
  serial: string;
  monto: number;
  telefono: string;
  banco: string;
  referencia: string;
  at: string;
  estado: "pendiente" | "aprobado" | "rechazado";
}

/** Datos de demostración para el Pago Móvil de BLINK. */
export const DATOS_PAGO_MOVIL = {
  banco: "Banco de prueba",
  rif: "J-00000000-0",
  telefono: "0414-0000000",
};

export const BANCOS_EMISORES = [
  "Banesco",
  "Banco de Venezuela",
  "Mercantil",
  "Provincial",
  "BNC",
  "Banplus",
  "Bicentenario",
  "Otro",
];

export interface DatosPagoMovil {
  banco: string;
  rif: string;
  telefono: string;
}

export interface Patrocinio {
  nombre: string;
  enlace: string;
}

/** Variables globales que el Admin controla y el resto de la app consume. */
export interface Configuracion {
  /** Porcentaje que BLINK retiene de cada pasaje para la liquidación. */
  comision: number;
  pagoMovil: DatosPagoMovil;
  patrocinio: Patrocinio;
}

export const COMISION_POR_DEFECTO = 10;
export const PATROCINIO_POR_DEFECTO: Patrocinio = {
  nombre: "Patrocinante / QR",
  enlace: "",
};
export const CONFIGURACION_POR_DEFECTO: Configuracion = {
  comision: COMISION_POR_DEFECTO,
  pagoMovil: DATOS_PAGO_MOVIL,
  patrocinio: PATROCINIO_POR_DEFECTO,
};

export type MotivoRechazo =
  | "no-registrada"
  | "bloqueada"
  | "saldo-insuficiente";

export interface Viaje {
  id: string;
  uid: string;
  serial: string | null;
  /** Unidad que hizo el cobro (el lector está asignado a una unidad). */
  unidad: string;
  monto: number;
  saldoDespues: number | null;
  resultado: "aprobado" | "rechazado";
  motivo: MotivoRechazo | null;
  at: string;
}

export interface Unidad {
  id: string;
  chofer: string;
}

/** Unidades de demostración de la línea. El lector se asigna a una de ellas. */
export const UNIDADES: Unidad[] = [
  { id: "Demo-01", chofer: "Demo" },
  { id: "Demo-02", chofer: "Sin asignar" },
  { id: "Demo-03", chofer: "Sin asignar" },
];

export const UNIDAD_POR_DEFECTO = UNIDADES[0].id;
export const CUOTA_POR_DEFECTO = 200;

export interface Resultado {
  resultado: "aprobado" | "rechazado";
  motivo: MotivoRechazo | null;
  tarjeta: Tarjeta | null;
  monto: number;
  saldoDespues: number | null;
}

export interface Cobro {
  resultado: Resultado;
  tarjetas: Tarjeta[];
  viaje: Viaje;
}

/** Cobra un pasaje: descuenta la tarifa y registra el viaje. */
export function procesarLectura(
  tarjetas: Tarjeta[],
  uidLeido: string,
  tarifa: number,
  at: Date = new Date(),
  unidad: string = UNIDAD_POR_DEFECTO
): Cobro {
  const uid = uidLeido.trim().toUpperCase();
  const indice = tarjetas.findIndex((t) => t.uid && t.uid.toUpperCase() === uid);
  const tarjeta = indice >= 0 ? tarjetas[indice] : null;
  const viajeBase = {
    id: `${at.getTime()}-${uid || "sin-uid"}`,
    uid,
    serial: tarjeta?.serial ?? null,
    unidad,
    at: at.toISOString(),
  };

  if (!tarjeta) {
    return {
      resultado: {
        resultado: "rechazado",
        motivo: "no-registrada",
        tarjeta: null,
        monto: 0,
        saldoDespues: null,
      },
      tarjetas,
      viaje: {
        ...viajeBase,
        monto: 0,
        saldoDespues: null,
        resultado: "rechazado",
        motivo: "no-registrada",
      },
    };
  }

  if (tarjeta.estado === "bloqueada") {
    return {
      resultado: {
        resultado: "rechazado",
        motivo: "bloqueada",
        tarjeta,
        monto: 0,
        saldoDespues: tarjeta.saldo,
      },
      tarjetas,
      viaje: {
        ...viajeBase,
        monto: 0,
        saldoDespues: tarjeta.saldo,
        resultado: "rechazado",
        motivo: "bloqueada",
      },
    };
  }

  if (tarjeta.saldo < tarifa) {
    return {
      resultado: {
        resultado: "rechazado",
        motivo: "saldo-insuficiente",
        tarjeta,
        monto: 0,
        saldoDespues: tarjeta.saldo,
      },
      tarjetas,
      viaje: {
        ...viajeBase,
        monto: 0,
        saldoDespues: tarjeta.saldo,
        resultado: "rechazado",
        motivo: "saldo-insuficiente",
      },
    };
  }

  const saldoDespues = redondear(tarjeta.saldo - tarifa);
  const actualizadas = tarjetas.map((t, i) =>
    i === indice ? { ...t, saldo: saldoDespues } : t
  );

  return {
    resultado: {
      resultado: "aprobado",
      motivo: null,
      tarjeta: { ...tarjeta, saldo: saldoDespues },
      monto: tarifa,
      saldoDespues,
    },
    tarjetas: actualizadas,
    viaje: {
      ...viajeBase,
      monto: tarifa,
      saldoDespues,
      resultado: "aprobado",
      motivo: null,
    },
  };
}

function redondear(valor: number) {
  return Math.round(valor * 100) / 100;
}

const CLAVE_TARJETAS = "blink:pasajes:tarjetas";
const CLAVE_VIAJES = "blink:pasajes:viajes";
const CLAVE_TARIFA = "blink:pasajes:tarifa";
const CLAVE_CUOTA = "blink:pasajes:cuota";
const CLAVE_UNIDAD = "blink:pasajes:unidad";
const CLAVE_RECARGAS = "blink:pasajes:recargas";
const CLAVE_CONFIG = "blink:pasajes:config";
const MAX_VIAJES = 50;
const MAX_RECARGAS = 50;

const TARJETAS_INICIALES: Tarjeta[] = [
  {
    uid: "3981BF06",
    serial: "23-1-0000001-0",
    titular: "Tarjeta blanca",
    cedula: "V-12345678",
    saldo: 500,
    estado: "activa",
  },
  {
    uid: "058151954F3400",
    serial: "23-1-0000002-0",
    titular: "Llavero azul",
    cedula: "V-87654321",
    saldo: 0,
    estado: "activa",
  },
];

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(clave);
    if (!crudo) return porDefecto;
    return JSON.parse(crudo) as T;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: la app sigue funcionando en memoria */
  }
}

export function cargarTarjetas(): Tarjeta[] {
  const guardadas = leer<Tarjeta[]>(CLAVE_TARJETAS, TARJETAS_INICIALES);

  // Completa los datos de demostración que se guardaron antes de existir
  // el UID físico del llavero o la cédula del titular.
  let cambio = false;
  const completas = guardadas.map((tarjeta) => {
    const inicial = TARJETAS_INICIALES.find((t) => t.serial === tarjeta.serial);
    if (!inicial) return tarjeta;

    let actual = tarjeta;
    if (!actual.uid && inicial.uid) actual = { ...actual, uid: inicial.uid };
    if (!actual.cedula && inicial.cedula) actual = { ...actual, cedula: inicial.cedula };
    if (actual !== tarjeta) cambio = true;
    return actual;
  });

  if (cambio) guardarTarjetas(completas);
  return completas;
}

export function guardarTarjetas(tarjetas: Tarjeta[]) {
  escribir(CLAVE_TARJETAS, tarjetas);
}

export function cargarViajes(): Viaje[] {
  const viajes = leer<Viaje[]>(CLAVE_VIAJES, []);
  // Los viajes guardados antes de existir la unidad pertenecen al lector único.
  return viajes.map((viaje) => ({
    ...viaje,
    unidad: viaje.unidad ?? UNIDAD_POR_DEFECTO,
  }));
}

export function guardarViajes(viajes: Viaje[]) {
  escribir(CLAVE_VIAJES, viajes.slice(0, MAX_VIAJES));
}

export function cargarTarifa(): number {
  const tarifa = leer<number>(CLAVE_TARIFA, 20);
  return Number.isFinite(tarifa) && tarifa > 0 ? tarifa : 20;
}

export function guardarTarifa(tarifa: number) {
  escribir(CLAVE_TARIFA, tarifa);
}

export function cargarRecargas(): Recarga[] {
  return leer<Recarga[]>(CLAVE_RECARGAS, []);
}

export function guardarRecargas(recargas: Recarga[]) {
  escribir(CLAVE_RECARGAS, recargas.slice(0, MAX_RECARGAS));
}

export function cargarConfig(): Configuracion {
  const guardada = leer<Partial<Configuracion>>(CLAVE_CONFIG, {});
  const comision = Number(guardada.comision);
  const pagoMovil =
    guardada.pagoMovil && typeof guardada.pagoMovil === "object" ? guardada.pagoMovil : {};
  const patrocinio =
    guardada.patrocinio && typeof guardada.patrocinio === "object"
      ? guardada.patrocinio
      : {};

  return {
    comision:
      Number.isFinite(comision) && comision >= 0 && comision <= 100
        ? comision
        : COMISION_POR_DEFECTO,
    pagoMovil: { ...DATOS_PAGO_MOVIL, ...pagoMovil },
    patrocinio: { ...PATROCINIO_POR_DEFECTO, ...patrocinio },
  };
}

export function guardarConfig(config: Configuracion) {
  escribir(CLAVE_CONFIG, config);
}

export function cargarCuota(): number {
  const cuota = leer<number>(CLAVE_CUOTA, CUOTA_POR_DEFECTO);
  return Number.isFinite(cuota) && cuota > 0 ? cuota : CUOTA_POR_DEFECTO;
}

export function guardarCuota(cuota: number) {
  escribir(CLAVE_CUOTA, cuota);
}

export function cargarUnidadActual(): string {
  const id = leer<string>(CLAVE_UNIDAD, UNIDAD_POR_DEFECTO);
  return UNIDADES.some((unidad) => unidad.id === id) ? id : UNIDAD_POR_DEFECTO;
}

export function guardarUnidadActual(id: string) {
  escribir(CLAVE_UNIDAD, id);
}

export function formatearBs(monto: number) {
  return `${new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)} Bs`;
}

export function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

/** Fecha corta con hora, para tablas de movimientos y recargas. */
export function formatearFechaHora(iso: string) {
  const fecha = new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
  });
  const hora = new Date(iso).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${fecha} ${hora}`;
}
