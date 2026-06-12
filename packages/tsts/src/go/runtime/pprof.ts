import type { byte, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../compat.js";
import type { Writer } from "../io.js";

export interface Profile {
  WriteTo(writer: Writer, debug: int): GoError;
}

let activeCpuProfile: { readonly writer: Writer; readonly startedAt: number } | undefined;

export function Lookup(name: string): Profile | undefined {
  switch (name) {
    case "heap":
    case "allocs":
      return {
        WriteTo: (writer: Writer, debug: int): GoError => writeProfile(writer, name, debug, undefined),
      };
    default:
      return undefined;
  }
}

export function StartCPUProfile(writer: Writer): GoError {
  if (activeCpuProfile !== undefined) {
    return new globalThis.Error("CPU profiling already in progress");
  }
  activeCpuProfile = { writer, startedAt: globalThis.Date.now() };
  return undefined;
}

export function StopCPUProfile(): void {
  if (activeCpuProfile === undefined) {
    return;
  }
  const session = activeCpuProfile;
  activeCpuProfile = undefined;
  writeProfile(session.writer, "cpu", 0 as int, session.startedAt);
}

const encoder = new globalThis.TextEncoder();

function writeProfile(writer: Writer, name: string, debug: int, startedAt: number | undefined): GoError {
  const endedAt = globalThis.Date.now();
  const payload = {
    format: "tsts-runtime-pprof",
    profile: name,
    debug,
    startedAt,
    endedAt,
    durationMs: startedAt === undefined ? 0 : endedAt - startedAt,
  };
  const bytes = globalThis.Array.from(encoder.encode(globalThis.JSON.stringify(payload) + "\n")) as GoSlice<byte>;
  const [, err] = writer.Write(bytes);
  return err;
}
