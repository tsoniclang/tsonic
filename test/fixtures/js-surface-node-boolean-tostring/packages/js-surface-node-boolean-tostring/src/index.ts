import { existsSync } from "fs";
import { join } from "node:path";

export function main(): void {
  const file = join("src", "index.ts");
  console.log(existsSync(file).toString());
}
