import fs from "node:fs";

export function main(): void {
  console.log(fs.existsSync("."));
}
