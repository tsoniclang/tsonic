#!/usr/bin/env node

// Forward to @tsonic/cli.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const realBinPath = require.resolve("@tsonic/cli");

const child = spawn(process.execPath, [realBinPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
