import { existsSync } from "fs";
import { join } from "node:path";

export function main(): void {
  const file = join(import.meta.dirname, "src", "index.ts");
  console.log(existsSync(file).toString());
}
