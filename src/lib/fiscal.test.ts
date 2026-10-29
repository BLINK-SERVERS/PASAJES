import { describe, expect, it } from "vitest";
import type { Viaje } from "./datos";
import { resumenDelDia } from "./fiscal";

const HOY = new Date(2026, 9, 28, 12, 0);
const UNIDADES = [
  { id: "Demo-01", chofer: "Demo" },
  { id: "Demo-02", chofer: "Sin asignar" },
];

function viaje(parcial: Partial<Viaje>): Viaje {
  return {
    id: `viaje-${Math.random()}`,
    uid: "3981BF06",
    serial: "23-1-0000001-0",
    unidad: "Demo-01",
    monto: 20,
    saldoDespues: 480,
    resultado: "aprobado",
    motivo: null,
    at: HOY.toISOString(),
    ...parcial,
  };
}

describe("resumenDelDia", () => {
  it("suma pasajeros y recaudado por unidad", () => {
    const viajes = [
      viaje({ unidad: "Demo-01", at: new Date(2026, 9, 28, 8, 10).toISOString() }),
      viaje({ unidad: "Demo-01", at: new Date(2026, 9, 28, 9, 5).toISOString() }),
      viaje({ unidad: "Demo-02", at: new Date(2026, 9, 28, 9, 40).toISOString() }),
    ];

    const resumen = resumenDelDia(viajes, 200, HOY, UNIDADES);

    expect(resumen.pasajeros).toBe(3);
    expect(resumen.recaudado).toBe(60);
    expect(resumen.unidades[0]).toMatchObject({
      pasajeros: 2,
      recaudado: 40,
      activa: true,
      cuotaCumplida: false,
    });
    expect(resumen.unidades[1]).toMatchObject({
      pasajeros: 1,
      recaudado: 20,
      activa: true,
    });
  });

  it("marca la cuota cuando lo recaudado la alcanza", () => {
    const viajes = Array.from({ length: 10 }, (_, i) =>
      viaje({ at: new Date(2026, 9, 28, 10, i).toISOString() })
    );

    const resumen = resumenDelDia(viajes, 200, HOY, UNIDADES);

    expect(resumen.unidades[0].recaudado).toBe(200);
    expect(resumen.unidades[0].cuotaCumplida).toBe(true);
  });

  it("ignora cobros rechazados y de otros días", () => {
    const viajes = [
      viaje({ resultado: "rechazado", motivo: "saldo-insuficiente", monto: 0 }),
      viaje({ at: new Date(2026, 9, 27, 23, 59).toISOString() }),
      viaje({ at: new Date(2026, 9, 28, 7, 30).toISOString() }),
    ];

    const resumen = resumenDelDia(viajes, 200, HOY, UNIDADES);

    expect(resumen.pasajeros).toBe(1);
    expect(resumen.recaudado).toBe(20);
    expect(resumen.porHora).toEqual([{ hora: 7, pasajeros: 1 }]);
  });

  it("deja sin actividad a la unidad que no cobró", () => {
    const resumen = resumenDelDia([], 200, HOY, UNIDADES);

    expect(resumen.unidades[1]).toMatchObject({
      activa: false,
      pasajeros: 0,
      recaudado: 0,
      cuotaCumplida: false,
      ultimoCobro: null,
    });
  });

  it("ordena el flujo por hora", () => {
    const viajes = [
      viaje({ at: new Date(2026, 9, 28, 15, 0).toISOString() }),
      viaje({ at: new Date(2026, 9, 28, 6, 0).toISOString() }),
      viaje({ at: new Date(2026, 9, 28, 15, 30).toISOString() }),
    ];

    const resumen = resumenDelDia(viajes, 200, HOY, UNIDADES);

    expect(resumen.porHora).toEqual([
      { hora: 6, pasajeros: 1 },
      { hora: 15, pasajeros: 2 },
    ]);
  });

  it("guarda la hora del último cobro por unidad", () => {
    const viajes = [
      viaje({ unidad: "Demo-01", at: new Date(2026, 9, 28, 9, 0).toISOString() }),
      viaje({ unidad: "Demo-01", at: new Date(2026, 9, 28, 10, 0).toISOString() }),
      viaje({ unidad: "Demo-02", at: new Date(2026, 9, 28, 8, 0).toISOString() }),
    ];

    const resumen = resumenDelDia(viajes, 200, HOY, UNIDADES);

    expect(new Date(resumen.unidades[0].ultimoCobro!).getHours()).toBe(10);
    expect(new Date(resumen.unidades[1].ultimoCobro!).getHours()).toBe(8);
  });
});
