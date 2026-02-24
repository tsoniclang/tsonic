import { Console } from "@tsonic/dotnet/System.js";

export async function main(): Promise<void> {
  // Pattern 1: resolve() — common case
  await new Promise<void>((resolve) => {
    resolve();
  });
  // Pattern 2: resolve(undefined) — uncommon but valid
  await new Promise<void>((resolve) => {
    resolve(undefined);
  });
  Console.WriteLine("OK");
}
