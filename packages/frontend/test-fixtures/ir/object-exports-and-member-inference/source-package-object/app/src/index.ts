import { path } from "@demo/pkg";

export function run(): string {
  const parsed = path.parse("file.txt");
  return path.basename(parsed.base) + path.sep;
}
