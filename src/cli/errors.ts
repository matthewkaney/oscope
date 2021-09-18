// Checks/typeguards for common socket errors

interface AddressInUseError extends NodeJS.ErrnoException {
  code: "EADDRINUSE";
  errno: number;
  syscall: string;
  address: string;
  port: number;
}

export function errAddressInUse(e: Error): e is AddressInUseError {
  return (e as NodeJS.ErrnoException).code === "EADDRINUSE";
}

interface AddressNotAvailableError extends NodeJS.ErrnoException {
  code: "EADDRNOTAVAIL";
  errno: number;
  syscall: string;
  address: string;
  port: number;
}

export function errAddressNotAvailable(
  e: Error
): e is AddressNotAvailableError {
  return (e as NodeJS.ErrnoException).code === "EADDRNOTAVAIL";
}

export function errConnectionRefused(e: Error) {
  return (e as NodeJS.ErrnoException).code === "ECONNREFUSED";
}
