import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Context } from "mocha";

type NativeAotProbeResult =
  | { readonly ok: true; readonly rid: string }
  | { readonly ok: false; readonly rid: string; readonly reason: string };

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

let cachedProbe: NativeAotProbeResult | undefined;

export const detectNativeAotRid = (): string => {
  const platform = process.platform;
  const arch = process.arch;

  const ridMap: Record<string, string> = {
    "darwin-x64": "osx-x64",
    "darwin-arm64": "osx-arm64",
    "linux-x64": "linux-x64",
    "linux-arm64": "linux-arm64",
    "win32-x64": "win-x64",
    "win32-arm64": "win-arm64",
  };

  return ridMap[`${platform}-${arch}`] ?? "linux-x64";
};

const formatProcessFailure = (
  command: string,
  output: {
    readonly status: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly stdout?: string | Buffer | null;
    readonly stderr?: string | Buffer | null;
    readonly error?: Error;
  }
): string => {
  const stdout = String(output.stdout ?? "").trim();
  const stderr = String(output.stderr ?? "").trim();
  const detail = [stdout, stderr].filter(Boolean).join("\n").trim();
  const status =
    output.status !== null
      ? `exit ${output.status}`
      : output.signal !== null
        ? `signal ${output.signal}`
        : "unknown status";
  const error = output.error ? ` (${output.error.message})` : "";
  return detail
    ? `${command} failed with ${status}${error}:\n${detail}`
    : `${command} failed with ${status}${error}`;
};

export const probeNativeAotSupport = (): NativeAotProbeResult => {
  if (cachedProbe) return cachedProbe;

  const rid = detectNativeAotRid();
  const forced = process.env.TSONIC_NATIVEAOT_AVAILABLE;
  if (forced === "1") {
    cachedProbe = { ok: true, rid };
    return cachedProbe;
  }
  if (forced === "0") {
    cachedProbe = {
      ok: false,
      rid,
      reason: "TSONIC_NATIVEAOT_AVAILABLE=0",
    };
    return cachedProbe;
  }

  const tempRoot = join(repoRoot, ".tests");
  mkdirSync(tempRoot, { recursive: true });
  const probeRoot = mkdtempSync(join(tempRoot, "native-aot-probe-"));
  const projectDir = join(probeRoot, "AotProbe");

  try {
    const create = spawnSync(
      "dotnet",
      [
        "new",
        "console",
        "--framework",
        "net10.0",
        "--use-program-main",
        "--name",
        "AotProbe",
        "--output",
        projectDir,
        "--no-restore",
        "--force",
      ],
      { encoding: "utf-8" }
    );
    if (create.status !== 0) {
      cachedProbe = {
        ok: false,
        rid,
        reason: formatProcessFailure("dotnet new", create),
      };
      return cachedProbe;
    }

    writeFileSync(
      join(projectDir, "Program.cs"),
      "internal static class Program { private static int Main() => 0; }\n",
      "utf-8"
    );

    const publish = spawnSync(
      "dotnet",
      [
        "publish",
        join(projectDir, "AotProbe.csproj"),
        "-c",
        "Release",
        "-r",
        rid,
        "--self-contained",
        "true",
        "/p:PublishAot=true",
        "/p:PublishTrimmed=true",
        "/p:PublishSingleFile=true",
        "--nologo",
      ],
      { encoding: "utf-8" }
    );

    cachedProbe =
      publish.status === 0
        ? { ok: true, rid }
        : {
            ok: false,
            rid,
            reason: formatProcessFailure("dotnet publish", publish),
          };
    return cachedProbe;
  } finally {
    rmSync(probeRoot, { recursive: true, force: true });
  }
};

export const skipIfNativeAotUnavailable = (context: Context): void => {
  const probe = probeNativeAotSupport();
  if (probe.ok) return;
  context.skip();
};
