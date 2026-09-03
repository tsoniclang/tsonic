import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  hostRoot,
  run,
  validateWaveManifests,
} from "./npm-wave.mjs";

const wave = validateWaveManifests();
const scratchRoot = mkdtempSync(resolve(ensureScratchRoot(), "packed-install-"));
const tarballRoot = resolve(scratchRoot, "tarballs");
mkdirSync(tarballRoot);

const packed = wave.packages.map((entry) => pack(entry));
const registry = await startRegistry(packed);
try {
  await verifyCsharp(registry.origin);
  await verifyRust(registry.origin);
} finally {
  await new Promise((resolveClose, rejectClose) => {
    registry.server.close((error) => error === undefined ? resolveClose() : rejectClose(error));
  });
}

const aggregateHash = createHash("sha256");
for (const entry of packed) {
  aggregateHash.update(entry.name);
  aggregateHash.update("\0");
  aggregateHash.update(entry.integrity);
  aggregateHash.update("\n");
}
const aggregateSha256 = aggregateHash.digest("hex");
if (process.env.TSONIC_NPM_PACK_RESULT !== undefined) {
  writeFileSync(
    process.env.TSONIC_NPM_PACK_RESULT,
    `${JSON.stringify({
      version: wave.version,
      aggregateSha256,
      packages: packed.map(({ name, version, tarballPath, integrity, fileCount }) => ({
        name,
        version,
        tarballPath,
        integrity,
        fileCount,
      })),
    }, null, 2)}\n`,
  );
}
process.stdout.write(
  `Packed install verified: ${packed.length} packages, aggregate SHA-256 ${aggregateSha256}\n`,
);

function ensureScratchRoot() {
  const root = resolve(hostRoot, ".temp/npm-release");
  mkdirSync(root, { recursive: true });
  return root;
}

function pack(entry) {
  const output = run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", tarballRoot],
    { cwd: entry.packageRoot, capture: true },
  );
  const result = JSON.parse(output);
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error(`npm pack returned no unique artifact for '${entry.name}'.`);
  }
  const item = result[0];
  if (item.name !== entry.name || item.version !== wave.version ||
      typeof item.filename !== "string" || !Array.isArray(item.files)) {
    throw new Error(`npm pack returned an invalid artifact record for '${entry.name}'.`);
  }
  const forbidden = item.files
    .map(({ path }) => path)
    .filter((path) =>
      path.includes("node_modules/") ||
      path.endsWith(".tsbuildinfo") ||
      /(?:^|\/)\.temp(?:\/|$)/u.test(path));
  if (forbidden.length !== 0) {
    throw new Error(
      `Package '${entry.name}' contains forbidden build state: ${forbidden.join(", ")}.`,
    );
  }
  const tarballPath = resolve(tarballRoot, item.filename);
  const bytes = readFileSync(tarballPath);
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  const shasum = createHash("sha1").update(bytes).digest("hex");
  return Object.freeze({
    name: entry.name,
    version: wave.version,
    manifest: entry.manifest,
    filename: item.filename,
    tarballPath,
    integrity,
    shasum,
    fileCount: item.files.length,
  });
}

async function startRegistry(packages) {
  const byName = new Map(packages.map((entry) => [entry.name, entry]));
  const byTarball = new Map(packages.map((entry) => [entry.filename, entry]));
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const tarballPrefix = "/tarballs/";
    if (url.pathname.startsWith(tarballPrefix)) {
      const entry = byTarball.get(decodeURIComponent(url.pathname.slice(tarballPrefix.length)));
      if (entry === undefined) return notFound(response);
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": String(readFileSync(entry.tarballPath).length),
      });
      createReadStream(entry.tarballPath).pipe(response);
      return;
    }
    const name = decodeURIComponent(url.pathname.slice(1));
    const entry = byName.get(name);
    if (entry === undefined) return notFound(response);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const manifest = {
      ...entry.manifest,
      dist: {
        tarball: `${origin}/tarballs/${encodeURIComponent(entry.filename)}`,
        integrity: entry.integrity,
        shasum: entry.shasum,
      },
    };
    const body = JSON.stringify({
      name,
      "dist-tags": { latest: entry.version },
      versions: { [entry.version]: manifest },
    });
    response.writeHead(200, {
      "content-type": "application/json",
      "content-length": String(Buffer.byteLength(body)),
    });
    response.end(body);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return Object.freeze({
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
  });
}

function notFound(response) {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
}

async function verifyCsharp(registryOrigin) {
  const root = resolve(scratchRoot, "hello-csharp");
  writeProject(root, {
    "package.json": JSON.stringify({
      name: "tsonic-install-proof-csharp",
      private: true,
      type: "module",
      devDependencies: {
        "@tsonic/cli": wave.version,
        "@tsonic/target-csharp": wave.version,
      },
    }, null, 2),
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          assemblyName: "HelloCsharp",
          namespace: "Hello.Generated",
          outputType: "Exe",
        },
      }],
    }, null, 2),
    "src/App.ts": [
      'import { Console } from "@tsonic/dotnet/System.js";',
      "",
      "function message(name: string): string {",
      "  return `Hello, ${name}!`;",
      "}",
      "",
      'Console.WriteLine(message("C#"));',
      "",
    ].join("\n"),
  });
  await install(root, registryOrigin);
  assertTarget(root, "csharp");
  const installedPackages = installedTsonicTreeDigest(root);
  runLocalTsonic(root);
  const output = run(
    "dotnet",
    ["run", "--project", "out/csharp/HelloCsharp.csproj", "--nologo"],
    { cwd: root, capture: true },
  );
  if (normalizeLines(output) !== "Hello, C#!\n") {
    throw new Error(`Packed C# install produced unexpected output: ${JSON.stringify(output)}.`);
  }
  assertCacheDirectory(root, ".tsonic/cache/csharp/dotnet-type-provider-tool", "C#");
  assertInstalledPackagesUnchanged(root, installedPackages, "C#");
}

async function verifyRust(registryOrigin) {
  const root = resolve(scratchRoot, "hello-rust");
  writeProject(root, {
    "package.json": JSON.stringify({
      name: "tsonic-install-proof-rust",
      private: true,
      type: "module",
      devDependencies: {
        "@tsonic/cli": wave.version,
        "@tsonic/target-rust": wave.version,
      },
    }, null, 2),
    "tsonic.json": JSON.stringify({
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      cacheDir: ".cache/tsonic",
      targets: [{
        id: "rust",
        surfaces: ["js"],
        options: {
          crateName: "hello_rust",
          edition: "2024",
          outputType: "bin",
        },
      }],
    }, null, 2),
    "src/App.ts": [
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
    ].join("\n"),
  });
  await install(root, registryOrigin);
  assertTarget(root, "rust");
  const installedPackages = installedTsonicTreeDigest(root);
  runLocalTsonic(root);
  const output = run(
    "cargo",
    ["run", "--manifest-path", "out/rust/Cargo.toml", "--quiet"],
    { cwd: root, capture: true },
  );
  if (normalizeLines(output) !== "2,4,6\n") {
    throw new Error(`Packed Rust install produced unexpected output: ${JSON.stringify(output)}.`);
  }
  assertCacheDirectory(root, ".cache/tsonic/rust/compiler-provider", "Rust");
  assertInstalledPackagesUnchanged(root, installedPackages, "Rust");
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

async function install(root, registryOrigin) {
  await runAsync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry",
      registryOrigin,
    ],
    root,
  );
  run("npm", ["ls", "--all"], { cwd: root, capture: true });
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

function runLocalTsonic(root) {
  run(
    "npx",
    ["--no-install", "tsonic", "build", "--project", "tsonic.json"],
    { cwd: root, capture: true },
  );
}

function writeProject(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const path = resolve(root, relativePath);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
  }
}

function runAsync(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
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
