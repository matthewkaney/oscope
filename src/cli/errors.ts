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
