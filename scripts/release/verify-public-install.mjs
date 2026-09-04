import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hostRoot, validateWaveManifests } from "./npm-wave.mjs";
import { npmRegistry } from "./npm-registry.mjs";

const publicRegistryOrigin = new URL(npmRegistry).origin;

export function assertPublicInstallLock(
  lock,
  expectedVersion,
  requiredDirectPackages,
) {
  if (!isRecord(lock) || !isRecord(lock.packages) ||
      typeof lock.lockfileVersion !== "number" || lock.lockfileVersion < 2) {
    throw new Error("Public install did not produce a supported package lock.");
  }
  const root = lock.packages[""];
  if (!isRecord(root)) {
    throw new Error("Public install package lock has no project root.");
  }
  const direct = {
    ...(isRecord(root.dependencies) ? root.dependencies : {}),
    ...(isRecord(root.devDependencies) ? root.devDependencies : {}),
    ...(isRecord(root.optionalDependencies) ? root.optionalDependencies : {}),
  };
  for (const name of requiredDirectPackages) {
    if (direct[name] !== expectedVersion) {
      throw new Error(
        `Public install must select exact dependency '${name}@${expectedVersion}'.`,
      );
    }
    if (!isRecord(lock.packages[`node_modules/${name}`])) {
      throw new Error(`Public install did not install direct dependency '${name}'.`);
    }
  }

  const installed = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!isFirstPartyPackagePath(path)) continue;
    if (!isRecord(entry) || entry.link === true) {
      throw new Error(`Public install contains linked first-party package '${path}'.`);
    }
    if (entry.version !== expectedVersion) {
      throw new Error(
        `Public install selected '${path}' at '${String(entry.version)}', expected '${expectedVersion}'.`,
      );
    }
    if (typeof entry.resolved !== "string" || !isPublicRegistryTarball(entry.resolved)) {
      throw new Error(
        `Public install resolved '${path}' outside ${npmRegistry}.`,
      );
    }
    installed.push(path);
  }
  if (installed.length === 0) {
    throw new Error("Public install contains no installed Tsonic packages.");
  }
  return Object.freeze(installed.sort());
}

export function assertNoLocalDependencySpecifiers(value) {
  const serialized = JSON.stringify(value);
  if (/(?:file|link|workspace):/iu.test(serialized)) {
    throw new Error("Public install contains a local dependency specifier.");
  }
}

if (process.argv[1] !== undefined &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPublicInstall(readVersion(process.argv.slice(2)));
}

function verifyPublicInstall(version) {
  const wave = validateWaveManifests();
  if (version !== wave.version) {
    throw new Error(
      `Public install version '${version}' does not match release wave '${wave.version}'.`,
    );
  }
  const scratchRoot = mkdtempSync(resolve(ensureScratchRoot(), `public-install-${version}-`));
  const npmConfigPath = resolve(scratchRoot, "npmrc");
  const npmCachePath = resolve(scratchRoot, "npm-cache");
  mkdirSync(npmCachePath);
  writeFileSync(resolve(scratchRoot, "package.json"), `${JSON.stringify({
    name: "tsonic-public-install-root",
    private: true,
  }, null, 2)}\n`);
  writeFileSync(npmConfigPath, [
    `registry=${npmRegistry}`,
    "audit=false",
    "fund=false",
    "package-lock=true",
    "",
  ].join("\n"));
  const environment = createPublicInstallEnvironment(npmConfigPath, npmCachePath);

  verifyTarget({
    name: "public-csharp",
    targetId: "csharp",
    targetPackage: "@tsonic/target-csharp",
    capabilityPackage: "@tsonic/csharp-nodejs",
    version,
    scratchRoot,
    environment,
    source: [
      'import { ok } from "node:assert";',
      'import { readFileSync } from "node:fs";',
      "",
      'ok(readFileSync("message.txt", "utf8") === "C# public install\\n");',
      "",
    ].join("\n"),
    message: "C# public install\n",
  });
  verifyTarget({
    name: "public-rust",
    targetId: "rust",
    targetPackage: "@tsonic/target-rust",
    capabilityPackage: "@tsonic/rust-nodejs",
    version,
    scratchRoot,
    environment,
    source: [
      'import { ok } from "node:assert";',
      'import { readFileSync } from "node:fs";',
      "",
      "export function main(): void {",
      '  ok(readFileSync("message.txt", "utf8") === "Rust public install\\n");',
      "}",
      "",
    ].join("\n"),
    message: "Rust public install\n",
  });
  process.stdout.write(
    `Public npm install verified for C#, Rust, and both Node capabilities at ${version}.\n`,
  );
}

function verifyTarget(options) {
  run(
    "npm",
    [
      "create",
      `tsonic@${options.version}`,
      options.name,
      "--",
      "--target",
      options.targetId,
    ],
    { cwd: options.scratchRoot, env: options.environment },
  );
  const projectRoot = resolve(options.scratchRoot, options.name);
  assertPublicProject(
    projectRoot,
    options.version,
    ["@tsonic/cli", options.targetPackage],
  );
  run("npm", ["ls", "--all"], { cwd: projectRoot, env: options.environment });
  run("npm", ["start", "--silent"], { cwd: projectRoot, env: options.environment });

  run(
    "npm",
    [
      "install",
      "--save-dev",
      "--save-exact",
      `${options.capabilityPackage}@${options.version}`,
      "--registry",
      npmRegistry,
      "--no-audit",
      "--no-fund",
    ],
    { cwd: projectRoot, env: options.environment },
  );
  writeFileSync(resolve(projectRoot, "message.txt"), options.message);
  writeFileSync(resolve(projectRoot, "src/App.ts"), options.source);
  assertPublicProject(
    projectRoot,
    options.version,
    ["@tsonic/cli", options.targetPackage, options.capabilityPackage],
  );
  run("npm", ["ls", "--all"], { cwd: projectRoot, env: options.environment });
  run("npm", ["start", "--silent"], { cwd: projectRoot, env: options.environment });
}

function assertPublicProject(root, expectedVersion, requiredDirectPackages) {
  for (const path of ["package.json", "package-lock.json", "tsonic.json", "src/App.ts"]) {
    if (!existsSync(resolve(root, path))) {
      throw new Error(`Public install omitted '${path}' from '${root}'.`);
    }
  }
  const manifest = readJson(resolve(root, "package.json"));
  assertNoLocalDependencySpecifiers(manifest);
  const lock = readJson(resolve(root, "package-lock.json"));
  assertNoLocalDependencySpecifiers(lock);
  if (JSON.stringify(lock).includes(hostRoot)) {
    throw new Error("Public install package lock contains the Tsonic source root.");
  }
  const installed = assertPublicInstallLock(lock, expectedVersion, requiredDirectPackages);
  for (const path of installed) {
    const installedPath = resolve(root, path);
    if (!existsSync(installedPath) || lstatSync(installedPath).isSymbolicLink()) {
      throw new Error(`Public install package '${path}' is missing or linked.`);
    }
  }
}

function createPublicInstallEnvironment(npmConfigPath, npmCachePath) {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^npm_/iu.test(name)) delete environment[name];
  }
  for (const name of [
    "INIT_CWD",
    "NODE_PATH",
    "TSONICLANG_WORKSPACE_ROOT",
    "TSONIC_ROOT",
  ]) {
    delete environment[name];
  }
  return {
    ...environment,
    npm_config_audit: "false",
    npm_config_cache: npmCachePath,
    npm_config_fund: "false",
    npm_config_registry: npmRegistry,
    npm_config_userconfig: npmConfigPath,
    npm_config_yes: "true",
  };
}

function readVersion(args) {
  if (args.length !== 2 || args[0] !== "--version" ||
      !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(args[1])) {
    throw new Error("Usage: node scripts/release/verify-public-install.mjs --version <version>");
  }
  return args[1];
}

function isFirstPartyPackagePath(path) {
  return /(?:^|\/)node_modules\/(?:@tsonic\/[^/]+|create-tsonic)$/u.test(path);
}

function isPublicRegistryTarball(value) {
  try {
    const url = new URL(value);
    return url.origin === publicRegistryOrigin && url.protocol === "https:";
  } catch {
    return false;
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    throw new Error(`Could not start ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${String(result.status)}.`,
    );
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function ensureScratchRoot() {
  const root = resolve(hostRoot, ".temp/npm-release");
  mkdirSync(root, { recursive: true });
  return root;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
