import { console, path } from "@tsonic/nodejs/index.js";

export function main(): void {
  console.log(path.posix.join("a", "b", "c"));
}
