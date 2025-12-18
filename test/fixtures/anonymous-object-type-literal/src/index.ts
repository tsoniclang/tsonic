// Test: Anonymous object type in type position should be lowered
// to a generated named type and work correctly

import { Console } from "@tsonic/dotnet/System";

const config: { value: number } = { value: 42 };

export function main(): void {
  Console.writeLine(config.value.toString());
}
