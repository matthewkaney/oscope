#!/usr/bin/env node

import { createSocket, Socket } from "dgram";
import { createInterface } from "readline";

import { bold, dim, blue, red, inverse } from "chalk";

import { parse, message as oscMessage } from "./osc";
import {
  OSCArgumentValueList,
  OSCArgumentTagList,
  OSCBundle,
  OSCMessage,
} from "./types";

let [action = "", ...args] = process.argv.slice(2);

switch (action.toLowerCase()) {
  case "help":
    break;
  case "talk":
    talk(args);
    break;
  case "listen":
    listen(args);
    break;
  case "snoop":
    snoop(args);
    break;
  default:
    //error
    break;
}

// Sub-programs
function help() {}

function talk(args: string[]) {
  let [address, port] = parseAddress(args[0]);

  let socket = createSocket("udp4");

  socket.connect(port, address);

  socket.on("connect", () => {
    let { address, port } = socket.remoteAddress();
    console.log(inverse(center(`Sending OSC to ${address}:${port}`)));

    input.prompt();
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  let input = createInterface({ input: process.stdin, output: process.stdout });

  input.on("line", (line) => {
    try {
      // Parse message
      let [oscAddress, oscArgs = ""] = line.trim().split(/\s+(.*)/);

      let oscArgValues = [];

      while (oscArgs.length > 0) {
        let arg: string;
        let match: RegExpMatchArray | null;

        if ((match = oscArgs.match(/^([+-]?\d+)(?:$|\s+(.*)$)/))) {
          [, arg, oscArgs = ""] = match;
          oscArgValues.push({ i: parseInt(arg) });
        } else if (
          (match = oscArgs.match(
            /^([+-]?(?:\d+\.\d*|\.\d+|\d+f))(?:$|\s+(.*)$)/
          ))
        ) {
          [, arg, oscArgs = ""] = match;
          oscArgValues.push({ f: parseFloat(arg) });
        } else if ((match = oscArgs.match(/^"([^"]*)"(?:$|\s+(.*)$)/))) {
          [, arg, oscArgs = ""] = match;
          oscArgValues.push({ s: arg });
        } else {
          throw Error(`Didn't recognize character "${oscArgs[0]}"`);
        }
      }

      socket.send(oscMessage(oscAddress, ...oscArgValues));
    } catch (e) {
      console.log(red(e.message));
    }
  });
}

function listen(args: string[]) {
  let [address, port] = parseAddress(args[0]);

  let socket = createSocket("udp4");

  socket.on("listening", () => {
    const info = socket.address();

    console.log(
      inverse(center(`Listening for OSC on ${info.address}:${info.port}`))
    );
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  socket.bind(port, address);
}

function snoop(args: string[]) {
  let [address1, port1] = parseAddress(args[0]);
  let [address2, port2] = parseAddress(args[1]);

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

// Utils
function parseAddress(args: string): [string | undefined, number] {
  let match = args.match(/^(?:(\d+\.\d+\.\d+\.\d+):)?(\d+)$/);

  if (!match) throw Error("Please specify a port");

  let [, address, portString] = match;

  return [address || undefined, parseInt(portString)];
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
