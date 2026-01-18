// Test: Anonymous object type in type position should be lowered
// to a generated named type and work correctly

import { Console } from "@tsonic/dotnet/System.js";

const config: { value: number } = { value: 42 };

export function main(): void {
  Console.WriteLine(config.value.ToString());
}
