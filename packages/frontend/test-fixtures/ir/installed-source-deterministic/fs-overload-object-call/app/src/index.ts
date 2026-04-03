import { fs } from "@fixture/js/fs.js";

export function ensure(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}
