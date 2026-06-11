import path from "node:path";

export function Join(...args: Array<string>): string {
  return path.posix.join(...args);
}

export function Split(pathValue: string): [string, string] {
  const directory = path.posix.dirname(pathValue);
  const file = path.posix.basename(pathValue);
  if (directory === ".") {
    return ["", file];
  }
  return [directory.endsWith("/") ? directory : `${directory}/`, file];
}
