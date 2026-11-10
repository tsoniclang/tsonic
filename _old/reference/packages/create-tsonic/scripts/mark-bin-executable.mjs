import { chmod } from "node:fs/promises";
import { resolve } from "node:path";

await chmod(resolve(import.meta.dirname, "../dist/src/index.js"), 0o755);
