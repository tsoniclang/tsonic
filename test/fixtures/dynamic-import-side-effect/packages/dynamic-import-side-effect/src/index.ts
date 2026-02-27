import { Console } from "@tsonic/dotnet/System.js";

async function load(): Promise<void> {
  await import("./module.js");
  Console.WriteLine("dynamic import done");
}

void load();
