import { Assert } from "xunit-types/Xunit.js";
import { Path } from "@tsonic/dotnet/System.IO.js";

declare const sep: string;

export function run(): void {
  Assert.Equal(Path.DirectorySeparatorChar, sep);
}
