#!/usr/bin/env node

import { createSocket, Socket } from "dgram";
import { createInterface } from "readline";

import { bold, dim, blue, red, inverse } from "chalk";

import { parseAddress, printAddress } from "./address";
import {
  errAddressInUse,
  errAddressNotAvailable,
  errConnectionRefused,
} from "./errors";
import { lexer } from "./lexer";

import { parse, message as oscMessage } from "../osc/osc";
import {
  OSCArgumentValueList,
  OSCArgumentTagList,
  OSCBundle,
  OSCMessage,
} from "../osc/types";

let [action = "", ...args] = process.argv.slice(2);

switch (action.toLowerCase()) {
  case "talk":
    talk(args);
    break;
  case "listen":
    listen(args);
    break;
  case "help":
    help();
    break;
  default:
    // Check for a different action
    if (action != "") {
      console.log(`I don't understand the command "${action}"\n`);
    }

    console.log("Supported commands:\n");

    help(); // Print help info

    break;
}

// Sub-programs
function help() {
  console.log(bold("oscope listen <address>"));
  console.log("  Open a UDP port on <address> and print received messages.\n");

  console.log(bold("oscope talk <address>"));
  console.log(
    "  Open a text prompt for sending messages to another piece of software listening on <address>.\n"
  );

  console.log(bold("oscope help"));
  console.log("  Print this help information.\n");

  console.log(`(oscope version ${process.env.npm_package_version})`);
}

function talk(args: string[]) {
  let { address, port, family } = parseAddress(args[0]);

  let socket = createSocket(family === "IPv4" ? "udp4" : "udp6");

  socket.connect(port, address || undefined);

  socket.on("connect", () => {
    let info = socket.remoteAddress();
    console.log(inverse(center(`Sending OSC to ${printAddress(info)}`)));

    input.prompt();
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  socket.on("error", (err) => {
    if (errConnectionRefused(err)) {
      console.log(
        red(`Error: Could not connect to the remote port ${address}:${port}`)
      );
    }
  });

  let input = createInterface({ input: process.stdin, output: process.stdout });

  input.on("line", (line) => {
    try {
      let [oscAddress, ...oscArgs] = lexer.reset(line);

      if (
        oscAddress.type === "address" &&
        typeof oscAddress.value === "string"
      ) {
        socket.send(
          oscMessage(
            oscAddress.value,
            ...oscArgs.filter((a) => a.type !== "ws").map((a) => a.value)
          )
        );
      } else {
        throw Error("Unrecognized address");
      }
    } catch (e) {
      console.log(red(e.message));
    }
  });
}

function listen(args: string[]) {
  let { address, port, family } = parseAddress(args[0]);

  let socket = createSocket(family === "IPv4" ? "udp4" : "udp6");

  socket.on("listening", () => {
    const info = socket.address();

    console.log(
      inverse(center(`Listening for OSC on ${info.address}:${info.port}`))
    );
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  socket.on("error", (err) => {
    if (errAddressInUse(err)) {
      console.log(
        red(
          `Error: Another program is already listening to the UPD socket ${err.address}:${err.port}`
        )
      );
    } else if (errAddressNotAvailable(err)) {
      console.log(
        red(
          `Error: The address ${err.address}:${err.port} is not available on this machine`
        )
      );
    } else {
      // Unknown error
      console.log(err);
    }
  });

  socket.bind(port, address);
}

function snoop(args: string[]) {
  let { address: address1, port: port1 } = parseAddress(args[0]);
  let { address: address2, port: port2 } = parseAddress(args[1]);

  console.log(address2, port2);

  let socket1 = createSocket("udp4");

  let remotes = new Map<number, Socket>();

  socket1.on("listening", () => {
    console.log(
      inverse(`  Snooping between ${socket1.address().port} and ${port2}  `)
    );
  });

  socket1.on("message", (message, rinfo) => {
    let remote: Socket;

    if (remotes.has(rinfo.port)) {
      remote = remotes.get(rinfo.port) as Socket;
      remote.send(message);
    } else {
      remote = createSocket("udp4");
      remote.connect(port2, address2);

      remote.on("connect", () => {
        remote.send(message);
        remotes.set(rinfo.port, remote);
      });

      remote.on("message", (message, rinfo2) => {
        socket1.send(message, rinfo.port, rinfo.address);
      });
    }

    printDatagram(message, rinfo.address, rinfo.port);
  });

  socket1.bind(port1, address1);
}

function printDatagram(packet: Uint8Array, address: string, port: number) {
  try {
    console.log(
      "\n" + blue(`${address}:${port} (received ${printTime(new Date())})`)
    );

    let result = parse(packet);
    printPacket(result);
  } catch (error) {
    console.log(red(error.message));
  }
}

const NTPOffset = 2208988800;

function printPacket(packet: OSCBundle | OSCMessage, indent = 0) {
  if ("packets" in packet) {
    let {
      ntpTime: [seconds, fracSeconds],
      packets,
    } = packet;
    let time = new Date((seconds - NTPOffset + fracSeconds / 2 ** 32) * 1000);
    console.log("  ".repeat(indent) + dim(`Bundle (${printTime(time)})`));

    for (let subPacket of packets) {
      printPacket(subPacket, indent + 1);
    }
  } else {
    let { address, args, argTypes } = packet;
    console.log(
      "  ".repeat(indent) + `${bold(address)} ${serializeArgs(args, argTypes)}`
    );
  }
}

function serializeArgs(args: OSCArgumentValueList, types: OSCArgumentTagList) {
  return args
    .map((arg, i) => {
      if (typeof arg === "number") {
        if (types[i] === "f") {
          return arg.toFixed(3);
        } else {
          return arg.toString();
        }
      } else if (typeof arg === "string") {
        return `"${arg}"`;
      } else if (arg instanceof Uint8Array) {
        return `<Blob (${arg.length}B)>`;
      }
    })
    .join(" ");
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});

function printTime(time: Date) {
  return (
    dateFormatter.format(time) +
    " " +
    timeFormatter.format(time) +
    "." +
    time.getMilliseconds().toString().padStart(3, "0")
  );
}

function center(text: String) {
  // Default padding
  let pad: number = 2;

  if (process.stdout.isTTY) {
    let [width] = process.stdout.getWindowSize();
    pad = Math.max(pad, (width - text.length) / 2);
  }

  return " ".repeat(Math.ceil(pad)) + text + " ".repeat(Math.floor(pad));
}
