import { fs, MkdirOptions } from "@fixture/js/fs.js";

export function ensure(dir: string): void {
  const options = new MkdirOptions();
  options.recursive = true;
  fs.mkdirSync(dir, options);
}
