// Protocolo del lector BLINK (firmware BLINK_Lector).
//
// Una línea por mensaje, 115200 baudios:
//   READY,BLINK,1
//   CARD,3981BF06
//   PONG

export type MensajeLector =
  | { tipo: "listo"; version: string }
  | { tipo: "tarjeta"; uid: string }
  | { tipo: "pong" }
  | { tipo: "desconocido"; texto: string };

const UID_VALIDO = /^[0-9A-F]{4,20}$/;

export function parsearLinea(linea: string): MensajeLector | null {
  const texto = linea.replace(/\r/g, "").trim();
  if (!texto) return null;

  if (texto === "PONG") return { tipo: "pong" };

  const [cabecera, ...resto] = texto.split(",");
  if (cabecera === "READY") return { tipo: "listo", version: resto.join(",") };

  if (cabecera === "CARD") {
    const uid = (resto[0] ?? "").trim().toUpperCase();
    if (UID_VALIDO.test(uid)) return { tipo: "tarjeta", uid };
    return { tipo: "desconocido", texto };
  }

  return { tipo: "desconocido", texto };
}

export class LectorSerial {
  private puerto: SerialPort | null = null;
  private lector: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private escritor: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private tareaLectura: Promise<void> | null = null;
  private cancelado = false;

  get conectado() {
    return this.puerto !== null;
  }

  async conectar(alRecibir: (mensaje: MensajeLector) => void): Promise<void> {
    const puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: 115200 });
    this.puerto = puerto;
    this.cancelado = false;

    if (puerto.writable) {
      this.escritor = puerto.writable.getWriter();
    }

    this.tareaLectura = this.leer(alRecibir);
  }

  private async leer(alRecibir: (mensaje: MensajeLector) => void) {
    const puerto = this.puerto;
    if (!puerto?.readable) return;

    const lector = puerto.readable.getReader();
    this.lector = lector;
    const decoder = new TextDecoder();
    let pendiente = "";

    try {
      while (!this.cancelado) {
        const { value, done } = await lector.read();
        if (done) break;
        pendiente += decoder.decode(value, { stream: true });

        let corte = pendiente.indexOf("\n");
        while (corte >= 0) {
          const linea = pendiente.slice(0, corte);
          pendiente = pendiente.slice(corte + 1);
          const mensaje = parsearLinea(linea);
          if (mensaje) alRecibir(mensaje);
          corte = pendiente.indexOf("\n");
        }
      }
    } catch {
      // La placa se desconectó o se cerró el puerto: se informa al llamador
      // mediante el evento "desconectado" del navegador.
    } finally {
      lector.releaseLock();
      if (this.lector === lector) this.lector = null;
    }
  }

  async ping(): Promise<void> {
    await this.escritor?.write(new TextEncoder().encode("PING\n"));
  }

  async desconectar(): Promise<void> {
    this.cancelado = true;
    try {
      await this.lector?.cancel();
    } catch {
      /* ya estaba cerrado */
    }
    await this.tareaLectura;
    this.tareaLectura = null;

    try {
      this.escritor?.releaseLock();
    } catch {
      /* con una escritura pendiente */
    }
    this.escritor = null;

    const puerto = this.puerto;
    this.puerto = null;
    try {
      await puerto?.close();
    } catch {
      /* el dispositivo ya no estaba */
    }
  }
}
