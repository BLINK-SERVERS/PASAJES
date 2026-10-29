import { describe, expect, it } from "vitest";
import { procesarLectura, type Tarjeta } from "./datos";
import { parsearLinea } from "./serial";

const tarjetas: Tarjeta[] = [
  { uid: "3981BF06", serial: "23-1-0000001-0", titular: "Blanca", saldo: 500, estado: "activa" },
  { uid: "AABBCCDD", serial: "23-1-0000002-0", titular: "Azul", saldo: 0, estado: "activa" },
  { uid: "11223344", serial: "23-1-0000003-0", titular: "Bloqueada", saldo: 500, estado: "bloqueada" },
];

const ahora = new Date("2026-10-28T18:00:00.000Z");

describe("parsearLinea", () => {
  it("reconoce el arranque", () => {
    expect(parsearLinea("READY,BLINK,1\r")).toEqual({ tipo: "listo", version: "BLINK,1" });
  });

  it("reconoce una tarjeta y normaliza el UID", () => {
    expect(parsearLinea("CARD,3981bf06")).toEqual({ tipo: "tarjeta", uid: "3981BF06" });
  });

  it("reconoce PONG", () => {
    expect(parsearLinea("PONG")).toEqual({ tipo: "pong" });
  });

  it("ignora líneas vacías", () => {
    expect(parsearLinea("  \r")).toBeNull();
  });

  it("marca como desconocido un UID inválido", () => {
    expect(parsearLinea("CARD,ZZ")).toEqual({ tipo: "desconocido", texto: "CARD,ZZ" });
  });
});

describe("procesarLectura", () => {
  it("aprueba y descuenta la tarifa", () => {
    const { resultado, tarjetas: nuevas, viaje } = procesarLectura(tarjetas, "3981bf06", 20, ahora);

    expect(resultado.resultado).toBe("aprobado");
    expect(resultado.monto).toBe(20);
    expect(resultado.saldoDespues).toBe(480);
    expect(resultado.tarjeta?.serial).toBe("23-1-0000001-0");
    expect(nuevas[0].saldo).toBe(480);
    expect(nuevas[1].saldo).toBe(0);
    expect(viaje.resultado).toBe("aprobado");
    expect(viaje.serial).toBe("23-1-0000001-0");
    expect(viaje.at).toBe("2026-10-28T18:00:00.000Z");
  });

  it("rechaza una tarjeta no registrada sin tocar saldos", () => {
    const { resultado, tarjetas: nuevas } = procesarLectura(tarjetas, "DEADBEEF", 20, ahora);

    expect(resultado.resultado).toBe("rechazado");
    expect(resultado.motivo).toBe("no-registrada");
    expect(resultado.monto).toBe(0);
    expect(nuevas).toEqual(tarjetas);
  });

  it("rechaza por saldo insuficiente", () => {
    const { resultado } = procesarLectura(tarjetas, "AABBCCDD", 20, ahora);

    expect(resultado.resultado).toBe("rechazado");
    expect(resultado.motivo).toBe("saldo-insuficiente");
    expect(resultado.saldoDespues).toBe(0);
  });

  it("rechaza una tarjeta bloqueada aunque tenga saldo", () => {
    const { resultado } = procesarLectura(tarjetas, "11223344", 20, ahora);

    expect(resultado.resultado).toBe("rechazado");
    expect(resultado.motivo).toBe("bloqueada");
    expect(resultado.saldoDespues).toBe(500);
  });

  it("no muta el arreglo original", () => {
    procesarLectura(tarjetas, "3981BF06", 20, ahora);
    expect(tarjetas[0].saldo).toBe(500);
  });
});
