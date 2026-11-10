export const lexicalCaptureConversionSource = `
import type { int32 } from "@tsonic/core/types.js";

class Failure extends Error {
  constructor(public readonly code: int32) { super("lexical capture"); }
}

export function run(): boolean {
  const integer: int32 = 17;
  function read(): number { return integer; }
  const original = new Failure(integer);
  function fail(): void { throw original; }
  let recovered = false;
  try { fail(); }
  catch (reason) {
    recovered = reason instanceof Failure && reason === original && reason.code === integer;
  }
  return read() === 17 && recovered;
}

export function main(): void {
  if (!run()) throw new Error("lexical capture conversion");
}
`;
