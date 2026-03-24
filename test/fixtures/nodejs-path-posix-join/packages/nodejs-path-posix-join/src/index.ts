import { posix } from "@tsonic/nodejs/path.js";

export function main(): void {
  console.log(posix.join("a", "b", "c"));
}
