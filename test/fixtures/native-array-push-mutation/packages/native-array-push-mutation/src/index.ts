import { Console } from "@tsonic/dotnet/System.js";

function main(): void {
  const parts: string[] = [];
  parts.push("hello");
  parts.push("world");
  Console.WriteLine(parts.join("-"));
}

main();
