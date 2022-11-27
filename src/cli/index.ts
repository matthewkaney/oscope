#!/usr/bin/env node
import { networkInterfaces } from "os";
import { createSocket } from "dgram";
import { createInterface } from "readline";

import chalk from "chalk";

import { parseAddress, printAddress } from "./address.js";
import {
  errAddressInUse,
  errAddressNotAvailable,
  errConnectionRefused,
} from "./errors.js";
import { lexer } from "./lexer.js";

import { parse, message as oscMessage } from "../osc/osc.js";
import {
  OSCArgumentValueList,
  OSCArgumentTagList,
  OSCBundle,
  OSCMessage,
} from "../osc/types.js";

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
  default: // Print help info
    // Check for a different action
    if (action != "") {
      console.log(`I don't understand the command "${action}"\n`);
    }

    help();

    break;
}

// Sub-programs
function help() {
  console.log(chalk.bold("Supported commands:\n"));

  console.log(chalk.bold(chalk.blue("oscope listen <address>")));
  console.log("  Open a UDP port on <address> and print received messages.\n");

  console.log(chalk.bold(chalk.blue("oscope talk <address>")));
  console.log(
    "  Open a text prompt for sending messages to another piece of software listening on <address>.\n"
  );

  console.log(chalk.bold(chalk.blue("oscope help")));
  console.log("  Print this help information.\n");

  console.log(chalk.bold("Network devices on this computer:\n"));

  let nets = networkInterfaces();

  for (const deviceID in nets) {
    let interfaceList = nets[deviceID];
    if (interfaceList) {
      console.log(chalk.dim(`${deviceID}:`));
      for (let { address, family, internal, netmask } of interfaceList) {
        let addressString = family === "IPv6" ? `[${address}]` : address;
        let familyString = chalk.dim(
          `(${family}${internal ? ", internal" : ""})`
        );
        console.log(`  ${addressString} ${familyString}`);
        console.log(`    ${netmask}`);
      }
      console.log("");
    }
  }

  console.log(`(oscope version ${process.env.npm_package_version})`);
}

function talk(args: string[]) {
  let { address, port, family } = parseAddress(args[0]);

  let socket = createSocket(family === "IPv4" ? "udp4" : "udp6");

  socket.connect(port, address || undefined);

  socket.on("connect", () => {
    let info = socket.remoteAddress();

    socket.setBroadcast(true);

    console.log(chalk.inverse(center(`Sending OSC to ${printAddress(info)}`)));

    input.prompt();
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  socket.on("error", (err) => {
    if (errConnectionRefused(err)) {
      console.log(
        chalk.red(
          `Error: Could not connect to the remote port ${address}:${port}`
        )
      );
    } else if (err instanceof Error) {
      console.log(chalk.red(`Error: ${err.message}`));
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
      } else if (oscAddress.type === "command") {
        if (oscAddress.value === "q" || oscAddress.value === "quit") {
          console.log("oh, i should quit");
        }
      } else {
        throw Error("Unrecognized address");
      }
    } catch (e) {
      if (e instanceof Error) {
        console.log(chalk.red(e.message));
      }
    }
  });
}

function listen(args: string[]) {
  let { address, port, family } = parseAddress(args[0]);

  let socket = createSocket(family === "IPv4" ? "udp4" : "udp6");

  socket.on("listening", () => {
    const info = socket.address();

    socket.setBroadcast(true);

    console.log(
      chalk.inverse(center(`Listening for OSC on ${info.address}:${info.port}`))
    );
  });

  socket.on("message", (message, { address, port }) => {
    printDatagram(message, address, port);
  });

  socket.on("error", (err) => {
    if (errAddressInUse(err)) {
      console.log(
        chalk.red(
          `Error: Another program is already listening to the UPD socket ${err.address}:${err.port}`
        )
      );
    } else if (errAddressNotAvailable(err)) {
      console.log(
        chalk.red(
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

function printDatagram(packet: Uint8Array, address: string, port: number) {
  try {
    console.log(
      "\n" +
        chalk.blue(`${address}:${port} (received ${printTime(new Date())})`)
    );

    let result = parse(packet);
    printPacket(result);
  } catch (e) {
    if (e instanceof Error) {
      console.log(chalk.red(e.message));
    }
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
    console.log("  ".repeat(indent) + chalk.dim(`Bundle (${printTime(time)})`));

    for (let subPacket of packets) {
      printPacket(subPacket, indent + 1);
    }
  } else {
    let { address, args, argTypes } = packet;
    console.log(
      "  ".repeat(indent) +
        `${chalk.bold(address)} ${serializeArgs(args, argTypes)}`
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
