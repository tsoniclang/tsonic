import type { GoError, GoSlice } from "../compat.js";
import * as nodeChildProcess from "node:child_process";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";
import process from "node:process";

export class Cmd {
  Path: string;
  Args: GoSlice<string>;
  Dir = "";
  Env: GoSlice<string> | undefined;

  constructor(name: string, args: GoSlice<string>) {
    this.Path = name;
    this.Args = [name, ...args];
  }

  Run(): GoError {
    const [, err] = this.CombinedOutput();
    return err;
  }

  Output(): [GoSlice<number>, GoError] {
    try {
      const result = nodeChildProcess.execFileSync(this.Path, this.Args.slice(1), {
        cwd: this.Dir === "" ? undefined : this.Dir,
        env: envObject(this.Env),
        stdio: ["ignore", "pipe", "inherit"],
      });
      return [Array.from(result), undefined];
    } catch (error) {
      return [[], normalizeExecError(error)];
    }
  }

  CombinedOutput(): [GoSlice<number>, GoError] {
    try {
      const result = nodeChildProcess.execFileSync(this.Path, this.Args.slice(1), {
        cwd: this.Dir === "" ? undefined : this.Dir,
        env: envObject(this.Env),
        stdio: ["ignore", "pipe", "pipe"],
      });
      return [Array.from(result), undefined];
    } catch (error) {
      const execError = error as { stdout?: Buffer | string; stderr?: Buffer | string };
      const output = Buffer.concat([bufferFromExecOutput(execError.stdout), bufferFromExecOutput(execError.stderr)]);
      return [Array.from(output), normalizeExecError(error)];
    }
  }

  String(): string {
    return this.Args.join(" ");
  }
}

export function Command(name: string, ...arg: GoSlice<string>): Cmd {
  return new Cmd(name, arg);
}

export function LookPath(file: string): [string, GoError] {
  const pathEnv = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  const candidates = file.includes("/") || file.includes(nodePath.sep)
    ? [file]
    : pathEnv.split(nodePath.delimiter).flatMap((dir) => extensions.map((ext) => nodePath.join(dir, file + ext)));
  for (const candidate of candidates) {
    if (candidate !== "" && isExecutable(candidate)) {
      return [candidate, undefined];
    }
  }
  return ["", new globalThis.Error(`exec: "${file}": executable file not found in $PATH`)];
}

function isExecutable(file: string): boolean {
  try {
    nodeFs.accessSync(file, nodeFs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function envObject(env: GoSlice<string> | undefined): NodeJS.ProcessEnv | undefined {
  if (env === undefined) {
    return undefined;
  }
  const result: NodeJS.ProcessEnv = {};
  for (const entry of env) {
    const index = entry.indexOf("=");
    if (index >= 0) {
      result[entry.slice(0, index)] = entry.slice(index + 1);
    }
  }
  return result;
}

function bufferFromExecOutput(value: Buffer | string | undefined): Buffer {
  if (value === undefined) {
    return Buffer.alloc(0);
  }
  return typeof value === "string" ? Buffer.from(value) : value;
}

function normalizeExecError(error: unknown): GoError {
  if (error instanceof globalThis.Error) {
    return error;
  }
  return new globalThis.Error(String(error));
}
