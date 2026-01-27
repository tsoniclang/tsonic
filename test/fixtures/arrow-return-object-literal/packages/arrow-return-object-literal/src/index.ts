// Regression test (tsumo): anonymous type lowering must update arrow *inferredType*
// in addition to arrow.returnType, otherwise the emitter still sees objectType and ICEs.

import { Console } from "@tsonic/dotnet/System.js";

const toObj = (s: string): { value: string } => {
  return { value: s };
};

export function main(): void {
  const result = toObj("hello");
  Console.WriteLine(result.value);
}
