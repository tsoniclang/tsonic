import * as nodePath from "@tsonic/nodejs/path.js";

export function run(): string {
  const parsed = nodePath.parse("file.txt");
  return nodePath.basename(parsed.base);
}
