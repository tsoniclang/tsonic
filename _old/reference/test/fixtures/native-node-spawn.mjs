export const incompatibleNodeStdioSource = `
import type { SpawnSyncOptionsWithBufferEncoding } from "node:child_process";
export function run(): void {
  const options: SpawnSyncOptionsWithBufferEncoding = { encoding: "buffer" };
  const stdio: Array<"pipe" | "ignore" | number> = ["pipe", "ignore", "pipe"];
  options.stdio = stdio;
  stdio[1] = "pipe";
}`;

export function nativeNodeSpawnSource(executable) {
  return `
import { spawnSync } from "node:child_process";
import type { SpawnSyncOptionsWithBufferEncoding } from "node:child_process";
import type { ProcessEnv } from "node:process";

export function run(): boolean {
  const environment: ProcessEnv = {};
  environment["TSONIC_CHILD_EXACT"] = "only-child";
  const options: SpawnSyncOptionsWithBufferEncoding = { encoding: "buffer", maxBuffer: 4096 };
  options.env = environment;
  const bytes = new Uint8Array([9, 0, 255, 42, 9]);
  options.input = bytes.subarray(1, 4);
  bytes[3] = 43;
  const stdio: Array<"pipe" | "ignore" | "inherit" | number | null | undefined> = ["pipe", "ignore", "pipe"];
  options.stdio = stdio;
  stdio[1] = "pipe";
  const result = spawnSync(${JSON.stringify(executable)}, ["-e", "process.stdin.pipe(process.stdout)"], options);
  const output = result.stdout;
  const errors = result.stderr;
  if (result.status !== 0 || result.pid === undefined || result.signal !== null || result.error !== undefined || output === null || errors === null) return false;
  if (output.length !== 3 || output.readUInt8(0) !== 0 || output.readUInt8(1) !== 255 || output.readUInt8(2) !== 43 || errors.length !== 0) return false;
  const envResult = spawnSync(${JSON.stringify(executable)}, ["-e", "process.stdout.write(process.env.TSONIC_CHILD_EXACT)"], { env: environment });
  const envOutput = envResult.stdout;
  if (envResult.status !== 0 || envOutput === null || envOutput.toString("utf8") !== "only-child") return false;
  const missing = spawnSync("__tsonic_nonexistent_spawn_contract_executable__", []);
  const error = missing.error;
  return missing.status === null && missing.pid === undefined && missing.stdout === null && missing.stderr === null && missing.signal === null &&
    error !== undefined && error.code === "ENOENT" && error.message.length > 0;
}
`;
}
