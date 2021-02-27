import { AddressInfo } from 'node:net';

export function parseAddress(input: string): AddressInfo {
  let match: RegExpMatchArray | null;
  let address: string, portString: string;
  let family: 'IPv4' | 'IPv6';
  if (match = input.match(/^(?:([0-9a-z\.]*):)?(\d+)$/)) {
    [, address, portString] = match;
    family = 'IPv4';
  } else if (match = input.match(/^(?:\[([0-9a-f:]*)\]:)?(\d+)$/)) {
    [, address, portString] = match;
    family = 'IPv6';
  } else {
    throw Error(`Unrecognized address: "${input}"`);
  }
  
  return { address, port: parseInt(portString), family};
}

export function printAddress(info: AddressInfo) {
  if (info.family === 'IPv6') {
    return `[${info.address}]:${info.port}`;
  } else {
    return `${info.address}:${info.port}`;
  }
}