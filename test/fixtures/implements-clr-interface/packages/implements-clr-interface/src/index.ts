import { Console } from "@tsonic/dotnet/System.js";
import type { IDisposable, Type } from "@tsonic/dotnet/System.js";

export class Thing implements IDisposable {
  Dispose(): void {
    Console.WriteLine("disposed");
  }
}

export function main(): void {
  const t = new Thing().GetType() as Type;
  const ifaces = t.GetInterfaces();
  let ok = false;
  for (const i of ifaces) {
    if (i.FullName === "System.IDisposable") {
      ok = true;
      break;
    }
  }
  Console.WriteLine(`IDisposable: ${ok ? "ok" : "fail"}`);
}
