# oScope, the OSC Scope

This is a command line utility for sending and receiving [Open Sound Control](https://en.wikipedia.org/wiki/Open_Sound_Control) messages. This can be useful for debugging and testing.

It's currently in an early release—if you see something missing, [please reach out](https://github.com/mindofmatthew/oscope/issues)!

## Installation

You can use it two ways. Both require you to have Node.js installed.

If you want to install the tool so you can have it available in your path, run:

```bash
npm install -g oscope

#Then run it with
oscope <command> [options...]
```

A simpler solution is to run it with NPX like so:

```bash
npx oscope <command> [options...]
```

## Usage

Currently, oscope can be used with two commands, `listen` and `talk`. Both take a UDP address as an argument.

### Address Patterns

Addresses consist of a hostname and a port such as `127.0.0.1:8000` or `localhost:1234`. A port by itself (such as `8888`) is also allowed.

### `listen`

```bash
oscope listen <address>
```

This opens a connection at the given local address and prints the contents of any OSC messages received. If only the port is specified, then it listens for messages sent to that port on all addresses.

### `talk`

```bash
oscope listen <address>
```

This opens a connection to a piece of software at a given remote address. You can use the command line to send messages to that program and then view any messages sent in response on the console.
