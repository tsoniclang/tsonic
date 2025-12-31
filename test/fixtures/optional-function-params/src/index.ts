import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

type Callback = (result: int) => void;

// Optional callback parameter
function compute(value: int, callback?: Callback): int {
  const result = value * 2;
  if (callback !== undefined) {
    callback(result);
  }
  return result;
}

// Nullable function type
function maybeTransform(value: int, transform: ((x: int) => int) | null): int {
  if (transform !== null) {
    return transform(value);
  }
  return value;
}

export function main(): void {
  const r1 = compute(5);
  Console.writeLine(`Without callback: ${r1}`);

  compute(10, result => {
    Console.writeLine(`Callback received: ${result}`);
  });

  const r2 = maybeTransform(7, x => x + 3);
  Console.writeLine(`Transformed: ${r2}`);

  const r3 = maybeTransform(7, null);
  Console.writeLine(`Not transformed: ${r3}`);
}
