import { describe, expect, it } from "vitest";
import type { Recarga, Tarjeta } from "./datos";
import {
  buscarRecargaDuplicada,
  buscarTarjeta,
  erroresRecarga,
  formatearEntrada,
  formatearSerial,
  formatearTelefono,
  pasajesEquivalentes,
  validarRecarga,
} from "./pasajero";

const tarjetas: Tarjeta[] = [
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
    saldo: 0,
    estado: "activa",
  },
];

describe("formatearSerial", () => {
  it("arma el serial completo", () => {
    expect(formatearSerial("23100000010")).toBe("23-1-0000001-0");
  });

  it("respeta lo que se lleva escrito", () => {
    expect(formatearSerial("23")).toBe("23");
    expect(formatearSerial("231")).toBe("23-1");
    expect(formatearSerial("2310")).toBe("23-1-0");
  });
});

describe("formatearEntrada", () => {
  it("aplica la máscara al serial", () => {
    expect(formatearEntrada("23100000010")).toBe("23-1-0000001-0");
  });

  it("deja la cédula con su prefijo", () => {
    expect(formatearEntrada("v12345678")).toBe("V-12345678");
    expect(formatearEntrada("V-12.345.678")).toBe("V-12345678");
  });

  it("no deja escribir una cédula de más de 8 dígitos", () => {
    expect(formatearEntrada("V123456789")).toBe("V-12345678");
  });
});

describe("buscarTarjeta", () => {
  it("encuentra por serial escrito sin guiones", () => {
    expect(buscarTarjeta(tarjetas, "23100000010")?.serial).toBe("23-1-0000001-0");
  });

  it("encuentra por serial con guiones", () => {
    expect(buscarTarjeta(tarjetas, "23-1-0000002-0")?.titular).toBe("Llavero azul");
  });

  it("encuentra por cédula", () => {
    expect(buscarTarjeta(tarjetas, "V-12.345.678")?.titular).toBe("Tarjeta blanca");
  });

  it("devuelve null si no existe", () => {
    expect(buscarTarjeta(tarjetas, "V-00000000")).toBeNull();
    expect(buscarTarjeta(tarjetas, "23-1-0000099-0")).toBeNull();
    expect(buscarTarjeta(tarjetas, "   ")).toBeNull();
  });
});

describe("pasajesEquivalentes", () => {
  it("divide el saldo entre la tarifa", () => {
    expect(pasajesEquivalentes(500, 20)).toBe(25);
    expect(pasajesEquivalentes(19.99, 20)).toBe(0);
    expect(pasajesEquivalentes(0, 20)).toBe(0);
  });

  it("no divide entre cero", () => {
    expect(pasajesEquivalentes(500, 0)).toBe(0);
  });
});

describe("validarRecarga", () => {
  const base = {
    monto: "500",
    telefono: "04141234567",
    banco: "Banesco",
    referencia: "1234",
  };

  it("acepta un reporte completo", () => {
    expect(validarRecarga(base)).toBeNull();
  });

  it("exige un monto mayor que cero", () => {
    expect(validarRecarga({ ...base, monto: "0" })).toMatch(/monto/i);
    expect(validarRecarga({ ...base, monto: "" })).toMatch(/monto/i);
  });

  it("exige teléfono venezolano de 11 dígitos", () => {
    expect(validarRecarga({ ...base, telefono: "041412345" })).toMatch(/teléfono/i);
    expect(validarRecarga({ ...base, telefono: "14141234567" })).toMatch(/teléfono/i);
  });

  it("exige banco y referencia de 4 dígitos", () => {
    expect(validarRecarga({ ...base, banco: "" })).toMatch(/banco/i);
    expect(validarRecarga({ ...base, referencia: "12" })).toMatch(/referencia/i);
  });
});

describe("erroresRecarga", () => {
  const base = {
    monto: "500",
    telefono: "0414-1234567",
    banco: "Banesco",
    referencia: "1234",
  };

  it("no marca nada si el reporte está completo", () => {
    expect(erroresRecarga(base)).toEqual({});
  });

  it("marca cada campo inválido por separado", () => {
    const errores = erroresRecarga({
      monto: "",
      telefono: "0414",
      banco: "",
      referencia: "12",
    });
    expect(Object.keys(errores).sort()).toEqual([
      "banco",
      "monto",
      "referencia",
      "telefono",
    ]);
  });

  it("acepta montos decimales y referencias numéricas", () => {
    expect(
      erroresRecarga({ ...base, monto: "150.50", referencia: "0123" })
    ).toEqual({});
  });
});

describe("formatearTelefono", () => {
  it("agrupa el prefijo de 4 dígitos", () => {
    expect(formatearTelefono("04141234567")).toBe("0414-1234567");
  });

  it("aplica la máscara mientras se escribe", () => {
    expect(formatearTelefono("0414")).toBe("0414");
    expect(formatearTelefono("04141")).toBe("0414-1");
  });

  it("ignora letras y no pasa de 11 dígitos", () => {
    expect(formatearTelefono("0414 abc 1234567")).toBe("0414-1234567");
    expect(formatearTelefono("0414123456789")).toBe("0414-1234567");
  });
});

describe("buscarRecargaDuplicada", () => {
  function recarga(overrides: Partial<Recarga> = {}): Recarga {
    return {
      id: "recarga-1",
      serial: "23-1-0000001-0",
      monto: 100,
      telefono: "04141234567",
      banco: "Banesco",
      referencia: "1234",
      at: "2026-10-28T12:00:00.000Z",
      estado: "pendiente",
      ...overrides,
    };
  }

  it("encuentra un reporte pendiente con la misma referencia", () => {
    const existente = recarga();
    expect(
      buscarRecargaDuplicada([existente], {
        serial: "23-1-0000001-0",
        banco: "Banesco",
        referencia: "1234",
      })?.id
    ).toBe(existente.id);
  });

  it("ignora las recargas rechazadas", () => {
    expect(
      buscarRecargaDuplicada([recarga({ estado: "rechazado" })], {
        serial: "23-1-0000001-0",
        banco: "Banesco",
        referencia: "1234",
      })
    ).toBeNull();
  });

  it("no cruza referencias entre tarjetas o bancos distintos", () => {
    const existente = recarga();
    expect(
      buscarRecargaDuplicada([existente], {
        serial: "23-1-0000002-0",
        banco: "Banesco",
        referencia: "1234",
      })
    ).toBeNull();
    expect(
      buscarRecargaDuplicada([existente], {
        serial: "23-1-0000001-0",
        banco: "Mercantil",
        referencia: "1234",
      })
    ).toBeNull();
  });
});
