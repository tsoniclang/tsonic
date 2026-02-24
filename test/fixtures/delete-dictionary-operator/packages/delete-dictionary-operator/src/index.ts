import { Console } from "@tsonic/dotnet/System.js";

type Counters = {
  [key: string]: number;
};

function hasKey(dict: Counters, key: string): boolean {
  return dict[key] !== undefined;
}

export function main(): void {
  const counters: Counters = {};
  counters["a"] = 1;
  counters["b"] = 2;

  delete counters["a"];

  Console.WriteLine(hasKey(counters, "a") ? "HAS_A" : "NO_A");
  Console.WriteLine(hasKey(counters, "b") ? "HAS_B" : "NO_B");
}
