#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { cpus, availableParallelism } from "node:os";

const tsonicRoot = resolve(new URL("../..", import.meta.url).pathname);
const repos = Object.freeze({
  tsonic: tsonicRoot,
  tsonicCsharp: resolve(tsonicRoot, "../tsonic-csharp"),
  csharpJs: resolve(tsonicRoot, "../csharp-js"),
  csharpNodejs: resolve(tsonicRoot, "../csharp-nodejs"),
  csharpRuntime: resolve(tsonicRoot, "../csharp-runtime"),
});

const artifactDefinitions = Object.freeze([
  ["tsonic.sourceCoreDist", resolve(repos.tsonic, "packages/source-core/dist"), true],
  ["tsonic.targetApiDist", resolve(repos.tsonic, "packages/target-api/dist"), true],
  ["tsonic.hostDist", resolve(repos.tsonic, "packages/host/dist"), true],
  ["tsonic.cliDist", resolve(repos.tsonic, "packages/cli/dist"), true],
  ["tsonicCsharp.dist", resolve(repos.tsonicCsharp, "dist"), true],
  ["csharpJs.runtimeDll", resolve(repos.csharpJs, "runtimes/net10.0/Tsonic.CSharp.Js.dll"), true],
  ["csharpNodejs.dist", resolve(repos.csharpNodejs, "dist"), true],
  ["csharpNodejs.runtimeDll", resolve(repos.csharpNodejs, "runtimes/net10.0/Tsonic.CSharp.Node.dll"), true],
  ["csharpNodejs.testDll", resolve(repos.csharpNodejs, "artifacts/bin/Tsonic.CSharp.Node.Tests/Debug/net10.0/Tsonic.CSharp.Node.Tests.dll"), true],
  ["csharpRuntime.runtimeDll", resolve(repos.csharpRuntime, "runtimes/net10.0/Tsonic.CSharp.Runtime.dll"), true],
]);

const runId = `${timestamp()}-${gitValue(repos.tsonic, ["rev-parse", "--short", "HEAD"]) || "nogit"}`;
const runRoot = resolve(tsonicRoot, ".temp/test-runs/prepared", runId);
mkdirSync(runRoot, { recursive: true });

const commands = [
  {
    id: "tsonic.build",
    cwd: repos.tsonic,
    command: "npm",
    args: ["run", "build"],
    env: { TSONIC_PREPARE_BUILD: "1" },
  },
  {
    id: "tsonic-csharp.build",
    cwd: repos.tsonicCsharp,
    command: "npm",
    args: ["run", "build"],
    env: { TSONIC_PREPARE_BUILD: "1", TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
  },
  {
    id: "csharp-runtime.build",
    cwd: repos.csharpRuntime,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Runtime.sln", "--verbosity", "minimal"],
    env: { TSONIC_PREPARE_BUILD: "1" },
  },
  {
    id: "csharp-js.build",
    cwd: repos.csharpJs,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Js.sln", "--verbosity", "minimal"],
    env: { TSONIC_PREPARE_BUILD: "1" },
  },
  {
    id: "csharp-nodejs.build",
    cwd: repos.csharpNodejs,
    command: "npm",
    args: ["run", "build"],
    env: { TSONIC_PREPARE_BUILD: "1", TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
  },
  {
    id: "csharp-nodejs.test-build",
    cwd: repos.csharpNodejs,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Node.slnx", "--verbosity", "minimal"],
    env: { TSONIC_PREPARE_BUILD: "1" },
  },
];

const executedCommands = [];
for (const command of commands) {
  const startedAt = Date.now();
  console.log(`prepare: ${command.id}`);
  const result = spawnSync(command.command, command.args, {
    cwd: command.cwd,
    env: { ...process.env, ...command.env },
    encoding: "utf8",
    stdio: "inherit",
  });
  const endedAt = Date.now();
  executedCommands.push({
    id: command.id,
    cwd: pathForManifest(command.cwd),
    command: command.command,
    args: command.args,
    durationMs: endedAt - startedAt,
    status: result.status,
  });
  if (result.status !== 0) {
    writeManifest("failed", executedCommands);
    process.exit(result.status ?? 1);
  }
}

const artifacts = artifactFingerprints();
const missingArtifacts = Object.entries(artifacts)
  .filter(([_key, artifact]) => artifact.required && !artifact.exists)
  .map(([key, artifact]) => `${key}: ${artifact.path}`);
if (missingArtifacts.length > 0) {
  writeManifest("failed", executedCommands, artifacts);
  console.error("prepare: missing required artifacts");
  for (const artifact of missingArtifacts) {
    console.error(`  - ${artifact}`);
  }
  process.exit(1);
}

const manifestPath = writeManifest("passed", executedCommands, artifacts);
writeFileSync(resolve(tsonicRoot, ".temp/test-runs/prepared/latest-manifest.json"), readFileSync(manifestPath));
writeFileSync(resolve(tsonicRoot, ".temp/test-runs/prepared/latest-run-id"), `${runId}\n`);
console.log(`prepare: manifest ${pathForManifest(manifestPath)}`);

function writeManifest(status, commandRecords, artifacts = artifactFingerprints()) {
  const manifest = {
    schemaVersion: 1,
    runId,
    status,
    createdAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      arch: process.arch,
      cpus: typeof availableParallelism === "function" ? availableParallelism() : cpus().length,
    },
    versions: {
      node: process.version,
      dotnetSdk: commandOutput(repos.tsonic, "dotnet", ["--version"]),
      tsgo: commandOutput(repos.tsonic, resolve(repos.tsonic, "node_modules/.bin/tsgo"), ["--version"]),
    },
    repos: Object.fromEntries(Object.entries(repos).map(([name, repoPath]) => [name, repoInfo(repoPath)])),
    commands: commandRecords,
    artifacts,
  };
  const manifestPath = resolve(runRoot, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

function repoInfo(repoPath) {
  return {
    path: pathForManifest(repoPath),
    head: gitValue(repoPath, ["rev-parse", "HEAD"]),
    branch: gitValue(repoPath, ["branch", "--show-current"]),
    dirty: (gitValue(repoPath, ["status", "--porcelain"]) ?? "").length > 0,
  };
}

function artifactFingerprints() {
  return Object.fromEntries(artifactDefinitions.map(([key, path, required]) => [
    key,
    { ...fingerprintPath(path), required },
  ]));
}

function fingerprintPath(path) {
  if (!existsSync(path)) {
    return { path: pathForManifest(path), exists: false };
  }
  const stats = statSync(path);
  if (stats.isFile()) {
    return {
      path: pathForManifest(path),
      exists: true,
      kind: "file",
      bytes: stats.size,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    };
  }
  const hash = createHash("sha256");
  let files = 0;
  let bytes = 0;
  for (const filePath of walkFiles(path).sort()) {
    const relativePath = toPosix(relative(path, filePath));
    const fileStats = statSync(filePath);
    const content = readFileSync(filePath);
    files += 1;
    bytes += fileStats.size;
    hash.update(relativePath);
    hash.update("\0");
    hash.update(String(fileStats.size));
    hash.update("\0");
    hash.update(createHash("sha256").update(content).digest("hex"));
    hash.update("\n");
  }
  return {
    path: pathForManifest(path),
    exists: true,
    kind: "directory",
    files,
    bytes,
    sha256: hash.digest("hex"),
  };
}

function walkFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(filePath, output);
    } else if (entry.isFile()) {
      output.push(filePath);
    }
  }
  return output;
}

function gitValue(cwd, args) {
  return commandOutput(cwd, "git", args);
}

function commandOutput(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}

function timestamp() {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    "-",
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
  ].join("");
}

function pathForManifest(path) {
  return toPosix(path);
}

function toPosix(path) {
  return path.split(sep).join("/");
}
