import { Console } from "@tsonic/dotnet/System.js";

async function load(): Promise<number> {
  const module = await import("./module.js");
  Console.WriteLine(module.value);
  return module.value;
}

void load();
