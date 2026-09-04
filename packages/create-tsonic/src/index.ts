#!/usr/bin/env node
import { runCreateTsonic } from "./run.js";

const result = await runCreateTsonic(process.argv.slice(2), process.cwd())
  .catch((error: unknown) => ({
    exitCode: 1,
    stdout: undefined,
    stderr: `${error instanceof Error ? error.message : String(error)}\n`,
  }));

if (result.stdout !== undefined) {
  process.stdout.write(result.stdout);
}
if (result.stderr !== undefined) {
  process.stderr.write(result.stderr);
}
process.exitCode = result.exitCode;
