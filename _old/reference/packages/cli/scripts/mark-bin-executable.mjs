import { chmod } from "node:fs/promises";

await chmod(new URL("../dist/src/index.js", import.meta.url), 0o755);
