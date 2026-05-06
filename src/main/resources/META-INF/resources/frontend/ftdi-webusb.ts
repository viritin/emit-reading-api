// Minimal Web-Serial-like adapter on top of WebUSB for FTDI FT232 family chips
// (FT232R / FT232BM / FT2232 / FT4232 single-port use).
//
// Used as a fallback on Android, where navigator.serial does not surface
// USB-serial adapters. The Google web-serial-polyfill only implements
// CDC-ACM and the Emit 250 reader uses an FT232R, which speaks FTDI's
// vendor-specific bulk protocol — hence this shim.
//
// Surface intentionally narrow: only the bits emit-reading.ts actually uses
// (requestPort / getPorts, port.open / close, port.readable, port.getInfo).

const FTDI_VENDOR = 0x0403;

const SIO_RESET = 0x00;
const SIO_SET_FLOW_CTRL = 0x02;
const SIO_SET_BAUDRATE = 0x03;
const SIO_SET_DATA = 0x04;

interface FtdiPortFilter {
  usbVendorId: number;
  usbProductId?: number;
}

interface FtdiOpenOptions {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "odd" | "even" | "mark" | "space";
}

// Port of libftdi's ftdi_to_clkbits for the FT232R/FT232BM family
// (reference clock 48 MHz, predivider 16). Returns the 32-bit encoded
// divisor split into the wValue / wIndex fields of SIO_SET_BAUDRATE.
function ftdiBaudDivisor(baud: number): { value: number; index: number } {
  const fracCode = [0, 3, 2, 4, 1, 5, 6, 7];
  const clk = 48_000_000;
  const clkDiv = 16;

  if (baud >= Math.floor(clk / clkDiv)) return { value: 0, index: 0 };
  if (baud >= Math.floor(clk / (clkDiv + clkDiv / 2))) return { value: 1, index: 0 };
  if (baud >= Math.floor(clk / (2 * clkDiv))) return { value: 2, index: 0 };

  const divisor = Math.floor((clk * 16) / clkDiv / baud);
  let best = divisor & 1 ? (divisor >> 1) + 1 : divisor >> 1;
  if (best > 0x20000) best = 0x1ffff;

  const encoded = (best >> 3) | (fracCode[best & 7] << 14);
  return { value: encoded & 0xffff, index: (encoded >>> 16) & 0xffff };
}

class FtdiSerialPort {
  private device: any;
  private inEndpoint = 1;
  private outEndpoint = 2;
  private packetSize = 64;
  private cancelled = false;

  public readable!: ReadableStream<Uint8Array>;
  public writable!: WritableStream<Uint8Array>;

  constructor(device: any) {
    this.device = device;
  }

  getInfo() {
    return {
      usbVendorId: this.device.vendorId,
      usbProductId: this.device.productId,
    };
  }

  async open(options: FtdiOpenOptions) {
    if (!this.device.opened) {
      await this.device.open();
    }
    if (this.device.configuration === null) {
      await this.device.selectConfiguration(1);
    }
    await this.device.claimInterface(0);

    const alt = this.device.configuration?.interfaces?.[0]?.alternate;
    if (alt) {
      for (const ep of alt.endpoints) {
        if (ep.type !== "bulk") continue;
        if (ep.direction === "in") {
          this.inEndpoint = ep.endpointNumber;
          this.packetSize = ep.packetSize;
        } else if (ep.direction === "out") {
          this.outEndpoint = ep.endpointNumber;
        }
      }
    }

    await this.controlOut(SIO_RESET, 0, 0);

    const baud = options.baudRate ?? 9600;
    const div = ftdiBaudDivisor(baud);
    await this.controlOut(SIO_SET_BAUDRATE, div.value, div.index);

    const dataBits = options.dataBits ?? 8;
    const parityMap: Record<string, number> = { none: 0, odd: 1, even: 2, mark: 3, space: 4 };
    const parity = parityMap[options.parity ?? "none"] ?? 0;
    const stopBits = options.stopBits === 2 ? 2 : 0;
    const lineCfg = (dataBits & 0xff) | (parity << 8) | (stopBits << 11);
    await this.controlOut(SIO_SET_DATA, lineCfg, 0);

    // No flow control (low byte of wIndex = port 0, high byte = flow type 0).
    await this.controlOut(SIO_SET_FLOW_CTRL, 0, 0);

    this.installStreams();
  }

  async close() {
    this.cancelled = true;
    try { await this.readable?.cancel(); } catch { /* already cancelled */ }
    try { await this.device.releaseInterface(0); } catch { /* not claimed */ }
    try { await this.device.close(); } catch { /* already closed */ }
  }

  private controlOut(request: number, value: number, index: number) {
    return this.device.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    });
  }

  private installStreams() {
    const device = this.device;
    const ep = this.inEndpoint;
    const outEp = this.outEndpoint;
    const pkt = this.packetSize;
    const self = this;

    this.readable = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          while (!self.cancelled) {
            const result = await device.transferIn(ep, pkt);
            if (result.status !== "ok" || !result.data) continue;
            // FTDI prepends 2 modem-status bytes to every USB packet; with
            // transferIn(ep, pkt) we get at most one packet per call, so we
            // only need to skip the first 2 bytes of the buffer.
            if (result.data.byteLength <= 2) continue;
            const view = new Uint8Array(
              result.data.buffer,
              result.data.byteOffset + 2,
              result.data.byteLength - 2,
            );
            controller.enqueue(view);
            return;
          }
          controller.close();
        } catch (e) {
          if (self.cancelled) return;
          controller.error(e);
        }
      },
      cancel() {
        self.cancelled = true;
      },
    });

    this.writable = new WritableStream<Uint8Array>({
      async write(chunk) {
        await device.transferOut(outEp, chunk);
      },
    });
  }
}

export const ftdiSerial = {
  async requestPort(options?: { filters?: FtdiPortFilter[] }): Promise<FtdiSerialPort> {
    // WebUSB's requestDevice rejects an empty filter list, so when the caller
    // doesn't supply one we fall back to "any FTDI device".
    const filters: any[] = options?.filters?.length
      ? options.filters.map((f) => ({ vendorId: f.usbVendorId, productId: f.usbProductId }))
      : [{ vendorId: FTDI_VENDOR }];
    const device = await (navigator as any).usb.requestDevice({ filters });
    return new FtdiSerialPort(device);
  },

  async getPorts(): Promise<FtdiSerialPort[]> {
    const devices = await (navigator as any).usb.getDevices();
    return devices
      .filter((d: any) => d.vendorId === FTDI_VENDOR)
      .map((d: any) => new FtdiSerialPort(d));
  },
};
