import { Console } from "@tsonic/dotnet/System.js";
import type { ptr } from "@tsonic/core/types.js";
import { int } from "@tsonic/core/types.js";

export function accept(p: ptr<int>): void {}

export function accept2(p: ptr<ptr<int>>): void {}

export function main(): void {
  Console.WriteLine("OK");
}
