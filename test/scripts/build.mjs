#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const tsonicRoot = resolve(new URL("../..", import.meta.url).pathname);
const repos = Object.freeze({
  tsonic: tsonicRoot,
  tsonicCsharp: resolve(tsonicRoot, "../tsonic-csharp"),
  csharpJs: resolve(tsonicRoot, "../csharp-js"),
  csharpNodejs: resolve(tsonicRoot, "../csharp-nodejs"),
  csharpRuntime: resolve(tsonicRoot, "../csharp-runtime"),
});

const commands = Object.freeze([
  {
    id: "tsonic.build",
    cwd: repos.tsonic,
    command: "npm",
    args: ["run", "build"],
  },
  {
    id: "tsonic-csharp.build",
    cwd: repos.tsonicCsharp,
    command: "npm",
    args: ["run", "build"],
    env: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
  },
  {
    id: "csharp-runtime.build",
    cwd: repos.csharpRuntime,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Runtime.sln", "--verbosity", "minimal"],
  },
  {
    id: "csharp-js.build",
    cwd: repos.csharpJs,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Js.sln", "--verbosity", "minimal"],
  },
  {
    id: "csharp-nodejs.install",
    cwd: repos.csharpNodejs,
    command: "npm",
    args: ["install", "--ignore-scripts"],
  },
  {
    id: "csharp-nodejs.build",
    cwd: repos.csharpNodejs,
    command: "npm",
    args: ["run", "build"],
    env: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
  },
  {
    id: "csharp-nodejs.test-build",
    cwd: repos.csharpNodejs,
    command: "dotnet",
    args: ["build", "Tsonic.CSharp.Node.slnx", "--verbosity", "minimal"],
  },
]);

const requiredArtifacts = Object.freeze([
  ["tsonic.sourceCoreDist", resolve(repos.tsonic, "packages/source-core/dist")],
  ["tsonic.jsSourceProfileDist", resolve(repos.tsonic, "packages/js-source-profile/dist")],
  ["tsonic.targetApiDist", resolve(repos.tsonic, "packages/target-api/dist")],
  ["tsonic.hostDist", resolve(repos.tsonic, "packages/host/dist")],
  ["tsonic.cliDist", resolve(repos.tsonic, "packages/cli/dist")],
  ["tsonic.createTsonicDist", resolve(repos.tsonic, "packages/create-tsonic/dist")],
  ["tsonic.tstsBundledLibs", resolve(repos.tsonic, "packages/tsts/dist/src/internal/bundled/libs")],
  ["tsonicCsharp.dist", resolve(repos.tsonicCsharp, "dist")],
  ["csharpJs.runtimeDll", resolve(repos.csharpJs, "runtimes/net10.0/Tsonic.CSharp.Js.dll")],
  ["csharpNodejs.dist", resolve(repos.csharpNodejs, "dist")],
  ["csharpNodejs.tstsPeer", resolve(repos.csharpNodejs, "node_modules/@tsonic/tsts/package.json")],
  ["csharpNodejs.targetApiPeer", resolve(repos.csharpNodejs, "node_modules/@tsonic/target-api/package.json")],
  ["csharpNodejs.targetCsharpPeer", resolve(repos.csharpNodejs, "node_modules/@tsonic/target-csharp/package.json")],
  ["csharpNodejs.runtimeDll", resolve(repos.csharpNodejs, "runtimes/net10.0/Tsonic.CSharp.Node.dll")],
  ["csharpNodejs.testDll", resolve(repos.csharpNodejs, "artifacts/bin/Tsonic.CSharp.Node.Tests/Debug/net10.0/Tsonic.CSharp.Node.Tests.dll")],
  ["csharpRuntime.runtimeDll", resolve(repos.csharpRuntime, "runtimes/net10.0/Tsonic.CSharp.Runtime.dll")],
]);

for (const command of commands) {
  console.log(`test-build: ${command.id}`);
  const result = spawnSync(command.command, command.args, {
    cwd: command.cwd,
    env: { ...process.env, ...command.env },
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const missingArtifacts = requiredArtifacts.filter(([_key, path]) => !existsSync(path));
if (missingArtifacts.length > 0) {
  console.error("test-build: missing required artifacts");
  for (const [key, path] of missingArtifacts) {
    console.error(`  - ${key}: ${path}`);
  }
  process.exit(1);
}

console.log(`test-build: artifacts ready (${requiredArtifacts.length})`);
