import * as fs from "node:fs";
import * as crypto from "node:crypto";

export function describeFileState(filePath: string): string {
  const present = fs.existsSync(filePath);
  const token = crypto.randomUUID();
  return present ? `present:${token}` : `missing:${token}`;
}
