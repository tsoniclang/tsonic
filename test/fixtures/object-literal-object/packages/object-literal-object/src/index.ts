import { Console } from "@tsonic/dotnet/System.js";

function sink(_x: object): void {}

export function main(): void {
  sink({ ok: true });
  Console.WriteLine("ok");
}
