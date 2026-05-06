import {
  Ecard250,
  EmitEkt250TransformStream,
  serialOptions250,
} from "@mikaello/emit-punch-cards-communication";
import { ftdiSerial } from "./ftdi-webusb";
import { SerialPort, SerialOptions } from "./serial-types";

// On Android, navigator.serial doesn't surface USB-serial adapters and the
// stock CDC-ACM polyfills can't drive an FTDI FT232 (which speaks a
// vendor-specific protocol). Route through our FTDI-over-WebUSB shim there.
// Everywhere else, prefer the native Web Serial API.
const isAndroid = /android/i.test(navigator.userAgent);
const serial: any = (!isAndroid && (navigator as any).serial) || ftdiSerial;

let port250: SerialPort | null = null;
let inputDone250: Promise<void> | null = null;
let reader250: ReadableStreamReader<Ecard250> | null = null;

const reportError = (error: DOMException) => {
  document.body.dispatchEvent(new CustomEvent("reader250-error", { detail: error.message }));
}

export const open250 = async () => {
  try {
    if (port250 == null) {
      throw new Error("Port not ready");
    }

    await port250.open(<SerialOptions>serialOptions250);

    const info = port250.getInfo();
    const connectedEvent = new Event("connect-device-250");
    document.body.dispatchEvent(connectedEvent);

    let emitTransformer = new EmitEkt250TransformStream(false);
    inputDone250 = port250.readable.pipeTo(emitTransformer.writable);
    reader250 = emitTransformer.readable.getReader();

    while (true) {
      const { value, done } = await reader250.read();

      if (done) {
        console.log("[readLoop] DONE", done);
        break;
      }

      if (value) {
        console.log("250 value", value);
        const readoutEvent = new CustomEvent("ecard-readout", { detail: value });
        document.body.dispatchEvent(readoutEvent);
      }
    }

    reader250.releaseLock();
  } catch (e) {
    reportError(e);
  }

}

export const reconnect250 = async () => {
  try {
    if(!serial) {
      throw new Error("Web Serial API not supported, use Chrome instead!");
    }

    const ports = await serial.getPorts();
    if (ports.length) {
      port250 = ports[0];
      console.log("Already granted 250 port selected", port250);
      open250();
    }
  } catch(e) {
    reportError(e);
  }
}

export const connect250 = async (filterUsbOnly: boolean) => {
  try {
    // When no specific filter is requested, still constrain to the FTDI
    // vendor: native Web Serial accepts an empty filter object, but the
    // WebUSB picker (used by our Android shim) rejects an empty filter list.
    const filter = filterUsbOnly
      ? { filters: [{ usbVendorId: 0x0403, usbProductId: 0x6001 }] }
      : { filters: [{ usbVendorId: 0x0403 }] };

    port250 = await serial.requestPort(filter);

    console.log("250 port acquired", port250);

    open250();

  } catch (e) {
    console.error("250 serial", e);
    // Permission to access a device was denied implicitly or explicitly by the user.
  }
};

/**
 * Credits to the web-serial Codelab: https://codelabs.developers.google.com/codelabs/web-serial/#0
 */
export const disconnect250 = async () => {
  if (reader250 && inputDone250 && port250) {
    await reader250.cancel();
    await inputDone250.catch(() => { });
    reader250 = null;
    inputDone250 = null;

    await port250?.close();
    port250 = null;
    //toggleHtmlElementsWithId(["connect-device-250", "disconnect-device-250"]);
  } else {
    console.error(
      "something is not defined when disconnecting 250 (reader/inputDone/port)",
      reader250,
      inputDone250,
      port250,
    );
  }
};


export function concatArrayBuffers(buffers: ArrayBuffer[]) {
  let offset = 0;
  let bytes = 0;
  buffers.forEach(function (buffer) {
    bytes += buffer.byteLength;
  });

  const mergedBuffer = new ArrayBuffer(bytes);
  const store = new Uint8Array(mergedBuffer);
  buffers.forEach(function (buffer) {
    store.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  });
  return mergedBuffer;
}

window.reconnect250 = reconnect250;
window.connect250 = connect250;
window.disconnect250 = disconnect250;

console.log("Hello from emit-reading.ts!");
