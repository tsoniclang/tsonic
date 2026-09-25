import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  run,
  validateWaveManifests,
} from "../npm-wave.mjs";
import { verifyCsharpFrameworks } from "../verify-csharp-frameworks.mjs";

const wave = validateWaveManifests();
const [target, scratchRoot, registryOrigin, ...extra] = process.argv.slice(2);
if (extra.length !== 0 || !scratchRoot || !registryOrigin) throw new Error("Expected a packed target, scratch root and registry.");
if (target === "csharp") await verifyCsharp(registryOrigin);
else if (target === "rust") await verifyRust(registryOrigin);
else throw new Error(`Unknown packed-install target '${target}'.`);

async function verifyCsharp(registryOrigin) {
  const root = await createProject("hello-csharp", "csharp", registryOrigin);
  assertCreatedPackage(root, "@tsonic/target-csharp");
  const config = readJson(resolve(root, "tsonic.json"));
  if (config.targets?.[0]?.options?.assemblyName !== "HelloCsharp") {
    throw new Error("Packed C# creator did not preserve its target-owned assembly name.");
  }
  assertTarget(root, "csharp");
  const installedPackages = installedTsonicTreeDigest(root);
  const output = run(
    "npm",
    ["start", "--silent"],
    { cwd: root, capture: true },
  );
  if (!normalizeLines(output).endsWith("Hello from hello-csharp!\n")) {
    throw new Error(`Packed C# install produced unexpected output: ${JSON.stringify(output)}.`);
  }
  writeFileSync(resolve(root, "src/App.ts"), [
    'import { Console } from "@tsonic/dotnet/System.js";',
    "",
    "function message(name: string): string {",
    "  return `Hello, ${name}!`;",
    "}",
    "",
    'Console.WriteLine(message("C#"));',
    "",
  ].join("\n"));
  const richerOutput = run(
    "npm",
    ["start", "--silent"],
    { cwd: root, capture: true },
  );
  if (!normalizeLines(richerOutput).endsWith("Hello, C#!\n")) {
    throw new Error(`Packed C# install produced unexpected output: ${JSON.stringify(richerOutput)}.`);
  }
  assertCacheDirectory(root, ".tsonic/cache/csharp/dotnet-type-provider-tool", "C#");
  assertInstalledPackagesUnchanged(root, installedPackages, "C#");

  await installCapability(root, "@tsonic/csharp-nodejs", registryOrigin);
  const installedNodePackages = installedTsonicTreeDigest(root);
  writeFileSync(resolve(root, "message.txt"), "C# Node capability\n");
  writeFileSync(resolve(root, "src/App.ts"), [
    'import { ok } from "node:assert";',
    'import { readFileSync } from "node:fs";',
    "",
    'ok(readFileSync("message.txt", "utf8") === "C# Node capability\\n");',
    "",
  ].join("\n"));
  run("npm", ["start", "--silent"], { cwd: root, capture: true });
  assertInstalledPackagesUnchanged(root, installedNodePackages, "C# Node");
  verifyCsharpFrameworks(root, {
    run,
    environment: process.env,
    message: "C# Node capability\n",
    verifyInstallation: (selection) => assertInstalledPackagesUnchanged(root, installedNodePackages, `C# ${selection}`),
  });
}

async function verifyRust(registryOrigin) {
  const root = await createProject("hello-rust", "rust", registryOrigin);
  assertCreatedPackage(root, "@tsonic/target-rust");
  const config = readJson(resolve(root, "tsonic.json"));
  if (config.targets?.[0]?.options?.crateName !== "hello_rust") {
    throw new Error("Packed Rust creator did not preserve its target-owned crate name.");
  }
  assertTarget(root, "rust");
  const installedPackages = installedTsonicTreeDigest(root);
  run("npm", ["start", "--silent"], { cwd: root, capture: true });
  assertCacheDirectory(root, ".tsonic/cache/rust/compiler-provider", "Rust");
  writeFileSync(resolve(root, "tsonic.json"), `${JSON.stringify({
    ...config,
    cacheDir: ".cache/tsonic",
    targets: [{
      ...config.targets[0],
      surfaces: ["js"],
    }],
  }, null, 2)}\n`);
  writeFileSync(resolve(root, "src/App.ts"), [
    'import type { int32 } from "@tsonic/core/types.js";',
    'import { HashMap } from "@tsonic/rust/std/collections.js";',
    "",
    "export function main(): void {",
    "  const values = new HashMap<string, int32>();",
    '  values.insert("answer", 42);',
    '  if ((values.get("answer") ?? 0) !== 42) {',
    '    throw new Error("missing answer");',
    "  }",
    '  console.log([1, 2, 3].map((value) => value * 2).join(","));',
    "}",
    "",
  ].join("\n"));
  const richerOutput = run(
    "npm",
    ["start", "--silent"],
    { cwd: root, capture: true },
  );
  if (!normalizeLines(richerOutput).endsWith("2,4,6\n")) {
    throw new Error(`Packed Rust install produced unexpected output: ${JSON.stringify(richerOutput)}.`);
  }
  assertCacheDirectory(root, ".cache/tsonic/rust/compiler-provider", "Rust");
  assertInstalledPackagesUnchanged(root, installedPackages, "Rust");

  await installCapability(root, "@tsonic/rust-nodejs", registryOrigin);
  const installedNodePackages = installedTsonicTreeDigest(root);
  writeFileSync(resolve(root, "tsonic.json"), `${JSON.stringify({
    ...config,
    cacheDir: ".cache/tsonic",
  }, null, 2)}\n`);
  writeFileSync(resolve(root, "message.txt"), "Rust Node capability\n");
  writeFileSync(resolve(root, "src/App.ts"), [
    'import { ok } from "node:assert";',
    'import { readFileSync } from "node:fs";',
    "",
    "export function main(): void {",
    '  ok(readFileSync("message.txt", "utf8") === "Rust Node capability\\n");',
    "}",
    "",
  ].join("\n"));
  run("npm", ["start", "--silent"], { cwd: root, capture: true });
  assertInstalledPackagesUnchanged(root, installedNodePackages, "Rust Node");
}

async function createProject(name, targetId, registryOrigin) {
  await runAsync(
    "npm",
    ["create", `tsonic@${wave.version}`, name, "--", "--target", targetId],
    scratchRoot,
    {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_registry: registryOrigin,
      npm_config_yes: "true",
      ...(targetId === "csharp" ? { npm_config_install_strategy: "nested" } : {}),
    },
  );
  return resolve(scratchRoot, name);
}

function assertCreatedPackage(root, targetPackageName) {
  const manifest = readJson(resolve(root, "package.json"));
  if (manifest.devDependencies?.["@tsonic/cli"] !== wave.version ||
      manifest.devDependencies?.[targetPackageName] !== wave.version ||
      typeof manifest.scripts?.build !== "string" ||
      typeof manifest.scripts?.check !== "string" ||
      typeof manifest.scripts?.start !== "string") {
    throw new Error(`Packed creator produced an invalid project manifest at '${root}'.`);
  }
  for (const path of ["package-lock.json", "tsonic.json", ".gitignore", "src/App.ts"]) {
    if (!existsSync(resolve(root, path))) {
      throw new Error(`Packed creator omitted '${path}' from '${root}'.`);
    }
  }
}

async function installCapability(root, packageName, registryOrigin) {
  await runAsync(
    "npm",
    [
      "install",
      "--save-dev",
      "--save-exact",
      `${packageName}@${wave.version}`,
      "--registry",
      registryOrigin,
      "--no-audit",
      "--no-fund",
    ],
    root,
  );
  const manifest = readJson(resolve(root, "package.json"));
  if (manifest.devDependencies?.[packageName] !== wave.version) {
    throw new Error(`Packed project did not record capability '${packageName}'.`);
  }
  if (!existsSync(resolve(root, "node_modules", ...packageName.split("/")))) {
    throw new Error(`Packed project did not install capability '${packageName}'.`);
  }
}

function assertCacheDirectory(root, relativePath, target) {
  if (!existsSync(resolve(root, relativePath))) {
    throw new Error(`Packed ${target} build did not use host-owned cache directory '${relativePath}'.`);
  }
}

function assertInstalledPackagesUnchanged(root, expected, target) {
  const actual = installedTsonicTreeDigest(root);
  if (actual !== expected) {
    throw new Error(
      `Packed ${target} build mutated an installed @tsonic package; target caches must use the host-owned cache root.`,
    );
  }
}

function installedTsonicTreeDigest(root) {
  const packageRoot = resolve(root, "node_modules/@tsonic");
  const hash = createHash("sha256");
  appendDirectoryDigest(hash, packageRoot, "");
  return hash.digest("hex");
}

function appendDirectoryDigest(hash, directory, relativeDirectory) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath = relativeDirectory.length === 0
      ? entry.name
      : `${relativeDirectory}/${entry.name}`;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      hash.update(`directory\0${relativePath}\n`);
      appendDirectoryDigest(hash, path, relativePath);
    } else if (entry.isFile()) {
      hash.update(`file\0${relativePath}\0`);
      hash.update(readFileSync(path));
      hash.update("\n");
    } else if (entry.isSymbolicLink()) {
      hash.update(`link\0${relativePath}\0${readlinkSync(path)}\n`);
    } else {
      throw new Error(`Installed package contains unsupported filesystem entry '${relativePath}'.`);
    }
  }
}

function assertTarget(root, targetId) {
  const output = run(
    "npx",
    ["--no-install", "tsonic", "targets", "--project", "tsonic.json"],
    { cwd: root, capture: true },
  );
  if (!normalizeLines(output).split("\n").some((line) => line.startsWith(`${targetId}\t`))) {
    throw new Error(`Packed install did not discover target '${targetId}': ${output}`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function runAsync(command, args, cwd, env = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => {
      stdout += value;
    });
    child.stderr.on("data", (value) => {
      stderr += value;
    });
    child.once("error", rejectRun);
    child.once("close", (code) => {
      if (code === 0) {
        resolveRun(stdout);
      } else {
        rejectRun(new Error(
          `${command} ${args.join(" ")} failed with exit code ${String(code)}.\n${stdout}${stderr}`,
        ));
      }
    });
  });
}

function normalizeLines(value) {
  return value.replace(/\r\n/gu, "\n");
}
