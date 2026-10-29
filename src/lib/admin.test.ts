import { describe, expect, it } from "vitest";
import {
  aprobarRecarga,
  liquidacionDelDia,
  rechazarRecarga,
  siguienteSerial,
} from "./admin";
import type { Recarga, Tarjeta, Viaje } from "./datos";

const HOY = new Date(2026, 9, 28, 12, 0, 0);
const AYER = new Date(2026, 9, 27, 12, 0, 0);

function tarjeta(overrides: Partial<Tarjeta> = {}): Tarjeta {
  return {
    uid: "3981BF06",
    serial: "23-1-0000001-0",
    titular: "Tarjeta blanca",
    cedula: "V-12345678",
    saldo: 500,
    estado: "activa",
    ...overrides,
  };
}

function recarga(overrides: Partial<Recarga> = {}): Recarga {
  return {
    id: "recarga-1",
    serial: "23-1-0000001-0",
    monto: 100,
    telefono: "04141234567",
    banco: "Banesco",
    referencia: "4321",
    at: HOY.toISOString(),
    estado: "pendiente",
    ...overrides,
  };
}

function viaje(
  unidad: string,
  monto: number,
  at: Date = HOY,
  resultado: Viaje["resultado"] = "aprobado"
): Viaje {
  return {
    id: `${unidad}-${at.getTime()}-${Math.random()}`,
    uid: "3981BF06",
    serial: "23-1-0000001-0",
    unidad,
    monto,
    saldoDespues: 0,
    resultado,
    motivo: resultado === "aprobado" ? null : "saldo-insuficiente",
    at: at.toISOString(),
  };
}

describe("siguienteSerial", () => {
  it("empieza en el primer serial si no hay tarjetas", () => {
    expect(siguienteSerial([])).toBe("23-1-0000001-0");
  });

  it("continúa desde el mayor serial emitido", () => {
    const tarjetas = [
      tarjeta({ serial: "23-1-0000002-0" }),
      tarjeta({ serial: "23-1-0000001-0" }),
    ];
    expect(siguienteSerial(tarjetas)).toBe("23-1-0000003-0");
  });

  it("no reutiliza seriales si hay huecos", () => {
    expect(siguienteSerial([tarjeta({ serial: "23-1-0000007-0" })])).toBe(
      "23-1-0000008-0"
    );
  });

  it("ignora seriales con formato ajeno", () => {
    expect(siguienteSerial([tarjeta({ serial: "sin-serial" })])).toBe(
      "23-1-0000001-0"
    );
  });
});

describe("aprobarRecarga", () => {
  it("acredita el monto y marca la recarga como aprobada", () => {
    const original = [tarjeta()];
    const resultado = aprobarRecarga(original, recarga());

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.tarjetas[0].saldo).toBe(600);
    expect(resultado.recarga.estado).toBe("aprobado");
    expect(original[0].saldo).toBe(500);
  });

  it("rechaza el abono si la tarjeta no está enrolada", () => {
    const resultado = aprobarRecarga([tarjeta()], recarga({ serial: "23-1-0009999-0" }));
    expect(resultado).toEqual({
      ok: false,
      error: "No hay una tarjeta enrolada con el serial 23-1-0009999-0.",
    });
  });

  it("rechaza el abono si la tarjeta está bloqueada", () => {
    const resultado = aprobarRecarga(
      [tarjeta({ estado: "bloqueada" })],
      recarga()
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("bloqueada");
  });

  it("no concilia dos veces la misma recarga", () => {
    const resultado = aprobarRecarga([tarjeta()], recarga({ estado: "aprobado" }));
    expect(resultado.ok).toBe(false);
  });

  it("no acredita dos veces la misma referencia bancaria", () => {
    const yaAprobada = recarga({ id: "recarga-0", estado: "aprobado" });
    const resultado = aprobarRecarga(
      [tarjeta({ saldo: 600 })],
      recarga({ id: "recarga-2" }),
      [yaAprobada]
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("ya fue acreditada");
  });

  it("permite reintentar una referencia que había sido rechazada", () => {
    const rechazada = recarga({ id: "recarga-0", estado: "rechazado" });
    const resultado = aprobarRecarga(
      [tarjeta()],
      recarga({ id: "recarga-2" }),
      [rechazada]
    );
    expect(resultado.ok).toBe(true);
  });

  it("no compara referencias de tarjetas distintas", () => {
    const otraTarjeta = recarga({
      id: "recarga-0",
      serial: "23-1-0000002-0",
      estado: "aprobado",
    });
    const resultado = aprobarRecarga(
      [tarjeta()],
      recarga({ id: "recarga-2" }),
      [otraTarjeta]
    );
    expect(resultado.ok).toBe(true);
  });
});

describe("rechazarRecarga", () => {
  it("marca la recarga como rechazada", () => {
    expect(rechazarRecarga(recarga()).estado).toBe("rechazado");
  });
});

describe("liquidacionDelDia", () => {
  const viajes = [
    viaje("Demo-01", 20),
    viaje("Demo-01", 20),
    viaje("Demo-01", 20, HOY, "rechazado"),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-03", 20),
    viaje("Demo-02", 20, AYER),
  ];

  it("solo liquida unidades con pasajeros de hoy", () => {
    const { filas } = liquidacionDelDia(viajes, 200, 10, HOY);
    expect(filas.map((fila) => fila.unidad.id)).toEqual(["Demo-01", "Demo-03"]);
  });

  it("descuenta comisión y cuota sin dejar neto negativo", () => {
    const { filas } = liquidacionDelDia(viajes, 200, 10, HOY);
    const demo01 = filas[0];
    expect(demo01.recaudado).toBe(40);
    expect(demo01.comision).toBe(4);
    expect(demo01.cuota).toBe(36);
    expect(demo01.neto).toBe(0);
    expect(demo01.cuotaCumplida).toBe(false);

    const demo03 = filas[1];
    expect(demo03.recaudado).toBe(300);
    expect(demo03.comision).toBe(30);
    expect(demo03.cuota).toBe(200);
    expect(demo03.neto).toBe(70);
    expect(demo03.cuotaCumplida).toBe(true);
  });

  it("suma los totales del día", () => {
    const { totales } = liquidacionDelDia(viajes, 200, 10, HOY);
    expect(totales).toEqual({
      pasajeros: 17,
      recaudado: 340,
      comision: 34,
      cuota: 236,
      neto: 70,
    });
  });

  it("devuelve una liquidación vacía si no hubo cobros", () => {
    const { filas, totales } = liquidacionDelDia([], 200, 10, HOY);
    expect(filas).toEqual([]);
    expect(totales.neto).toBe(0);
  });
});
