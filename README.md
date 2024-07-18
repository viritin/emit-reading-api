# Emit250 eCard reader integration for Vaadin (and example project for Vaadin with clean pom and without production profile)

Provides a Java/Vaadin API for [Emit 250 reader](https://emit.no/en/nettbutikk/avlesningsenhet-usb/) USB device. The device, although a USB devices, essentially shows as a serial port to the operating system. Builds on [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Serial) and TypeScript [Emit250 eCard reader utility library by @mikaello](https://github.com/mikaello/emit-punch-cards-communication).

Tested with Mac & Chrome, but probably works on all Chromium based browsers and Chrome OS.

The TypeScript library supports also some other Emit gear, so extending should be easy if needed. The older 250 variant with basic Serial port can be supported probably just by dropping off the serial port filter.
