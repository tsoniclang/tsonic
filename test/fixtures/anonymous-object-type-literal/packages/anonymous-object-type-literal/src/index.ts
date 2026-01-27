// Test: Anonymous object type in type position should be lowered
// to a generated named type and work correctly

import { Console } from "@tsonic/dotnet/System.js";

const config: { value: number } = { value: 42 };

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const err: ErrorResponse = { error: { code: "E1", message: "oops" } };

export function main(): void {
  Console.WriteLine(config.value.ToString());
  Console.WriteLine(err.error.code);
}
