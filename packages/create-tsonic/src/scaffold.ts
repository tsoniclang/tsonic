import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface CreateTsonicProjectOptions {
  readonly currentDirectory: string;
  readonly destination: string;
  readonly targetId: string;
  readonly surfaces: readonly string[];
}

interface CreatedTsonicProject {
  readonly projectName: string;
  readonly targetId: string;
  readonly relativeDestination: string;
}

interface StarterProject {
  readonly target: Readonly<Record<string, unknown>>;
  readonly scripts: {
    readonly build: string;
    readonly start: string;
    readonly check: string;
  };
  readonly files: readonly {
    readonly path: string;
    readonly contents: string;
  }[];
  readonly requirements: readonly StarterRequirement[];
}

interface StarterRequirement {
  readonly id: string;
  readonly displayName: string;
  readonly checks: readonly {
    readonly command: string;
    readonly args: readonly string[];
    readonly expectedOutputPattern?: string;
  }[];
  readonly installUrl: string;
  readonly installInstructions: string;
}

interface StarterPlugin {
  readonly kind: "target";
  readonly id: string;
  readonly targetId: string;
  createTargetPack(): {
    readonly surfaces: readonly { readonly id: string }[];
  };
  createStarterProject(context: { readonly projectName: string }): unknown;
}

const reservedPaths = new Set([
  ".gitignore",
  "package-lock.json",
  "package.json",
  "tsonic.json",
]);

export async function createTsonicProject(
  options: CreateTsonicProjectOptions,
): Promise<CreatedTsonicProject> {
  const destination = resolve(options.currentDirectory, options.destination);
  await requireMissing(destination);
  const projectName = basename(destination);
  requireProjectName(projectName);
  const targetPackageName = `@tsonic/target-${options.targetId}`;
  const version = await readCreatorVersion();
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const staging = resolve(parent, `.${projectName}.tsonic-create-${process.pid}-${randomUUID()}`);
  await mkdir(staging, { recursive: false });
  try {
    const packageManifest = {
      name: projectName,
      private: true,
      type: "module",
      scripts: {},
      devDependencies: {
        "@tsonic/cli": version,
        [targetPackageName]: version,
      },
    };
    await writeJson(resolve(staging, "package.json"), packageManifest);
    installDependencies(staging);
    const plugin = await loadStarterPlugin(staging, targetPackageName, options.targetId);
    validateSelectedSurfaces(plugin, options.surfaces);
    const starter = validateStarterProject(
      plugin.createStarterProject({ projectName }),
      options.targetId,
    );
    verifyRequirements(starter.requirements);
    const target = {
      ...starter.target,
      ...(options.surfaces.length === 0 ? {} : { surfaces: options.surfaces }),
    };
    await writeJson(resolve(staging, "package.json"), {
      ...packageManifest,
      scripts: starter.scripts,
    });
    await writeJson(resolve(staging, "tsonic.json"), {
      entryPoint: "App.ts",
      rootDir: "src",
      outDir: "out",
      targets: [target],
    });
    await writeFile(
      resolve(staging, ".gitignore"),
      ["node_modules/", "out/", ".tsonic/", ""].join("\n"),
      "utf8",
    );
    for (const file of starter.files) {
      const filePath = resolveStarterPath(staging, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.contents, "utf8");
    }
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return {
    projectName,
    targetId: options.targetId,
    relativeDestination: relative(options.currentDirectory, destination) || ".",
  };
}

async function readCreatorVersion(): Promise<string> {
  const packagePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../package.json",
  );
  const value = JSON.parse(await readFile(packagePath, "utf8")) as unknown;
  if (!isRecord(value) || typeof value.version !== "string" ||
      !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value.version)) {
    throw new Error("create-tsonic package version is invalid.");
  }
  return value.version;
}

function installDependencies(projectDirectory: string): void {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["install", "--no-audit", "--no-fund"], {
    cwd: projectDirectory,
    stdio: "inherit",
  });
  if (result.error !== undefined) {
    throw new Error(`Could not start npm install: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${String(result.status)}.`);
  }
}

async function loadStarterPlugin(
  projectDirectory: string,
  packageName: string,
  targetId: string,
): Promise<StarterPlugin> {
  const requireFromProject = createRequire(resolve(projectDirectory, "package.json"));
  const entry = requireFromProject.resolve(packageName);
  const module = await import(pathToFileURL(entry).href) as Readonly<Record<string, unknown>>;
  if (typeof module.createTsonicPlugin !== "function") {
    throw new Error(`Target package '${packageName}' does not export createTsonicPlugin().`);
  }
  const value = module.createTsonicPlugin() as unknown;
  if (!isRecord(value) || value.kind !== "target" || value.id !== packageName ||
      value.targetId !== targetId || typeof value.createTargetPack !== "function" ||
      typeof value.createStarterProject !== "function") {
    throw new Error(
      `Target package '${packageName}' does not provide the '${targetId}' starter contract.`,
    );
  }
  return value as unknown as StarterPlugin;
}

function validateSelectedSurfaces(
  plugin: StarterPlugin,
  selectedSurfaces: readonly string[],
): void {
  const pack = plugin.createTargetPack();
  if (!isRecord(pack) || !Array.isArray(pack.surfaces) ||
      !pack.surfaces.every((surface) => isRecord(surface) && typeof surface.id === "string")) {
    throw new Error(`Target package '${plugin.id}' returned an invalid target pack surface catalog.`);
  }
  const supported = new Set(pack.surfaces.map((surface) => surface.id));
  for (const surface of selectedSurfaces) {
    if (!supported.has(surface)) {
      throw new Error(
        `Target '${plugin.targetId}' does not provide source surface '${surface}'.`,
      );
    }
  }
}

function validateStarterProject(value: unknown, targetId: string): StarterProject {
  requireExactRecord(value, "starter project", ["target", "scripts", "files", "requirements"]);
  requireExactRecord(value.target, "starter target", ["id", "options"]);
  if (value.target.id !== targetId || !isJsonValue(value.target.options)) {
    throw new Error(`Starter target must select '${targetId}' with JSON-compatible options.`);
  }
  requireExactRecord(value.scripts, "starter scripts", ["build", "check", "start"]);
  for (const name of ["build", "check", "start"] as const) {
    if (typeof value.scripts[name] !== "string" || value.scripts[name].length === 0) {
      throw new Error(`Starter script '${name}' must be a non-empty string.`);
    }
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new Error("Starter project must contain at least one source file.");
  }
  const paths = new Set<string>();
  for (const file of value.files) {
    requireExactRecord(file, "starter file", ["contents", "path"]);
    if (typeof file.path !== "string" || typeof file.contents !== "string") {
      throw new Error("Starter files require string path and contents fields.");
    }
    validateStarterRelativePath(file.path);
    if (paths.has(file.path)) {
      throw new Error(`Starter file path '${file.path}' is duplicated.`);
    }
    paths.add(file.path);
  }
  if (!paths.has("src/App.ts")) {
    throw new Error("Starter project must provide src/App.ts.");
  }
  if (!Array.isArray(value.requirements) || value.requirements.length === 0) {
    throw new Error("Starter project must declare its native toolchain requirements.");
  }
  const requirementIds = new Set<string>();
  for (const requirement of value.requirements) {
    validateRequirement(requirement, requirementIds);
  }
  return value as unknown as StarterProject;
}

function validateRequirement(value: unknown, ids: Set<string>): void {
  requireExactRecord(value, "starter requirement", [
    "checks",
    "displayName",
    "id",
    "installInstructions",
    "installUrl",
  ]);
  if (typeof value.id !== "string" || value.id.length === 0 || ids.has(value.id)) {
    throw new Error("Starter requirement ids must be unique non-empty strings.");
  }
  ids.add(value.id);
  if (typeof value.displayName !== "string" || value.displayName.length === 0 ||
      typeof value.installInstructions !== "string" || value.installInstructions.length === 0 ||
      typeof value.installUrl !== "string" || !value.installUrl.startsWith("https://")) {
    throw new Error(`Starter requirement '${value.id}' has invalid installation guidance.`);
  }
  if (!Array.isArray(value.checks) || value.checks.length === 0) {
    throw new Error(`Starter requirement '${value.id}' must contain checks.`);
  }
  for (const check of value.checks) {
    const keys = isRecord(check) && check.expectedOutputPattern !== undefined
      ? ["args", "command", "expectedOutputPattern"]
      : ["args", "command"];
    requireExactRecord(check, `starter requirement '${value.id}' check`, keys);
    if (typeof check.command !== "string" || check.command.length === 0 ||
        !Array.isArray(check.args) || !check.args.every((argument) => typeof argument === "string")) {
      throw new Error(`Starter requirement '${value.id}' contains an invalid command check.`);
    }
    if (check.expectedOutputPattern !== undefined) {
      if (typeof check.expectedOutputPattern !== "string") {
        throw new Error(`Starter requirement '${value.id}' output pattern must be a string.`);
      }
      try {
        new RegExp(check.expectedOutputPattern, "mu");
      } catch {
        throw new Error(`Starter requirement '${value.id}' output pattern is invalid.`);
      }
    }
  }
}

function verifyRequirements(requirements: readonly StarterRequirement[]): void {
  const failures: string[] = [];
  for (const requirement of requirements) {
    for (const check of requirement.checks) {
      const result = spawnSync(check.command, check.args, {
        encoding: "utf8",
        timeout: 15_000,
      });
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
      const matches = check.expectedOutputPattern === undefined ||
        new RegExp(check.expectedOutputPattern, "mu").test(output);
      if (result.error !== undefined || result.status !== 0 || !matches) {
        failures.push([
          `${requirement.displayName} is not ready (${check.command} ${check.args.join(" ")}).`,
          requirement.installInstructions,
          requirement.installUrl,
        ].join("\n"));
        break;
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`Native toolchain requirements are not satisfied:\n\n${failures.join("\n\n")}`);
  }
}

async function requireMissing(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  throw new Error(`Destination '${path}' already exists.`);
}

function requireProjectName(value: string): void {
  if (value.length > 214 || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value)) {
    throw new Error(
      `Project directory '${value}' must be a lowercase, unscoped npm package name beginning with a letter.`,
    );
  }
}

function resolveStarterPath(root: string, relativePath: string): string {
  validateStarterRelativePath(relativePath);
  const resolved = resolve(root, relativePath);
  if (!resolved.startsWith(`${root}${sep}`)) {
    throw new Error(`Starter file '${relativePath}' resolves outside the project.`);
  }
  return resolved;
}

function validateStarterRelativePath(path: string): void {
  if (path.length === 0 || path.startsWith("/") || path.includes("\\") ||
      path.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..") ||
      reservedPaths.has(path) || path.startsWith("node_modules/") ||
      path.startsWith("out/") || path.startsWith(".tsonic/")) {
    throw new Error(`Starter file path '${path}' is not allowed.`);
  }
}

function requireExactRecord(
  value: unknown,
  subject: string,
  expectedKeys: readonly string[],
): asserts value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error(`${subject} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${subject} must contain exactly: ${expected.join(", ")}.`);
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
