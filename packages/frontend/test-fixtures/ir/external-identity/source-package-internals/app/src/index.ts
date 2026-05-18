import type { Date } from "@tsonic/js-temp/date.js";
import { statSync } from "node:fs";

const maybeDate: Date | undefined = undefined;
export const resolved = maybeDate ?? statSync("package.json").mtime;
export const iso = resolved.toISOString();
