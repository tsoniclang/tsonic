import type { bool, int } from "../../scalars.js";
import process from "node:process";
import type { GoError } from "../../compat.js";
import type { File } from "../../os.js";

type TerminalDescriptor = int | File | { Fd(): int };

interface TerminalStream {
  readonly fd?: number;
  readonly isTTY?: boolean;
  readonly columns?: number;
  readonly rows?: number;
}

export function GetSize(descriptor: TerminalDescriptor): [int, int, GoError] {
  const stream = streamForDescriptor(descriptor);
  const width = positiveInt(stream?.columns);
  const height = positiveInt(stream?.rows);
  if (width === 0 || height === 0) {
    return [width, height, new globalThis.Error("terminal size is unavailable")];
  }
  return [width, height, undefined];
}

export function IsTerminal(descriptor: TerminalDescriptor): bool {
  return streamForDescriptor(descriptor)?.isTTY === true;
}

function streamForDescriptor(descriptor: TerminalDescriptor): TerminalStream | undefined {
  const fd = descriptorFd(descriptor);
  return terminalStreams().find((stream) => stream.fd === fd);
}

function descriptorFd(descriptor: TerminalDescriptor): number {
  if (typeof descriptor === "number") {
    return descriptor;
  }
  return descriptor.Fd();
}

function positiveInt(value: number | undefined): int {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return 0 as int;
  }
  return value as int;
}

function terminalStreams(): readonly TerminalStream[] {
  return [process.stdin, process.stdout, process.stderr];
}
