import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { isValidTargetId } from "@tsonic/target-api";
import type { TargetArtifact } from "@tsonic/target-api";

export interface BuildOutputRecoveryOptions {
  readonly outputRoot: string;
  readonly protectedPaths?: readonly string[];
}

export interface BuildOutputTarget {
  readonly targetId: string;
  readonly artifacts: readonly TargetArtifact[];
}

export interface BuildOutputPublicationOptions extends BuildOutputRecoveryOptions {
  readonly expectedTargetIds: readonly string[];
  readonly targets: readonly BuildOutputTarget[];
}

interface ValidatedArtifact {
  readonly relativePath: string;
  readonly text: string;
}

interface ValidatedTarget {
  readonly targetId: string;
  readonly artifacts: readonly ValidatedArtifact[];
}

interface OutputScratchPaths {
  readonly outputRoot: string;
  readonly parent: string;
  readonly backup: string;
  readonly lock: string;
  readonly lockOwner: string;
  readonly stagePrefix: string;
  readonly staleLockPrefix: string;
  readonly releasedLockPrefix: string;
}

interface OutputLockOwner {
  readonly token: string;
  readonly pid: number;
  readonly createdAt: number;
  readonly processStart?: string;
}

const lockOwnerFileName = "owner.json";
const unownedLockGraceMilliseconds = 30_000;
const unverifiableLiveLockMaximumAgeMilliseconds = 30 * 60_000;

export async function recoverBuildOutput(options: BuildOutputRecoveryOptions): Promise<void> {
  const scratch = getOutputScratchPaths(options);
  await mkdir(scratch.parent, { recursive: true });
  await withOutputLock(scratch, async () => {
    await recoverBuildOutputWithoutLock(scratch);
  });
}

export async function publishBuildOutput(options: BuildOutputPublicationOptions): Promise<void> {
  const scratch = getOutputScratchPaths(options);
  const targets = validatePublication(options, scratch.outputRoot);
  await mkdir(scratch.parent, { recursive: true });
  await withOutputLock(scratch, async () => {
    await recoverBuildOutputWithoutLock(scratch);
    const stageRoot = await mkdtemp(scratch.stagePrefix);
    let stageExists = true;
    try {
      await writeStagedOutput(stageRoot, targets);
      const previousOutputExists = await pathExists(scratch.outputRoot);
      let previousOutputMoved = false;
      try {
        if (previousOutputExists) {
          await rename(scratch.outputRoot, scratch.backup);
          previousOutputMoved = true;
        }
        await rename(stageRoot, scratch.outputRoot);
        stageExists = false;
      } catch (publicationError: unknown) {
        const recoveryErrors: unknown[] = [];
        if (previousOutputMoved && !await pathExists(scratch.outputRoot)) {
          try {
            await rename(scratch.backup, scratch.outputRoot);
          } catch (recoveryError: unknown) {
            recoveryErrors.push(recoveryError);
          }
        }
        if (recoveryErrors.length > 0) {
          throw new AggregateError(
            [publicationError, ...recoveryErrors],
            `Target output publication failed and the previous output could not be restored at '${scratch.outputRoot}'.`,
          );
        }
        throw publicationError;
      }
      if (await pathExists(scratch.backup)) {
        await rm(scratch.backup, { recursive: true, force: true });
      }
    } finally {
      if (stageExists) {
        await rm(stageRoot, { recursive: true, force: true });
      }
    }
  });
}

function getOutputScratchPaths(options: BuildOutputRecoveryOptions): OutputScratchPaths {
  const outputRoot = resolve(options.outputRoot);
  const parent = dirname(outputRoot);
  if (parent === outputRoot) {
    throw new Error(`Target output root '${outputRoot}' cannot be a filesystem root.`);
  }
  for (const protectedPath of options.protectedPaths ?? []) {
    const protectedRoot = resolve(protectedPath);
    if (pathContainsOrEquals(outputRoot, protectedRoot)) {
      throw new Error(`Target output root '${outputRoot}' cannot contain protected project path '${protectedRoot}'.`);
    }
  }
  const key = createHash("sha256").update(outputRoot).digest("hex").slice(0, 24);
  const prefix = `.tsonic-output-${key}`;
  const lock = resolve(parent, `${prefix}.lock`);
  return {
    outputRoot,
    parent,
    backup: resolve(parent, `${prefix}.backup`),
    lock,
    lockOwner: resolve(lock, lockOwnerFileName),
    stagePrefix: resolve(parent, `${prefix}.stage-`),
    staleLockPrefix: `${prefix}.stale-lock-`,
    releasedLockPrefix: `${prefix}.released-lock-`,
  };
}

function validatePublication(
  options: BuildOutputPublicationOptions,
  outputRoot: string,
): readonly ValidatedTarget[] {
  if (options.expectedTargetIds.length === 0) {
    throw new Error("Target output publication requires at least one expected target.");
  }
  const expectedIds = validateTargetIds(options.expectedTargetIds, "expected target");
  const suppliedIds = validateTargetIds(options.targets.map((target) => target.targetId), "target result");
  const missingIds = [...expectedIds].filter((targetId) => !suppliedIds.has(targetId)).sort();
  const unexpectedIds = [...suppliedIds].filter((targetId) => !expectedIds.has(targetId)).sort();
  if (missingIds.length > 0 || unexpectedIds.length > 0) {
    throw new Error([
      "Target output publication received an incomplete target set.",
      ...(missingIds.length > 0 ? [`Missing: ${missingIds.join(", ")}.`] : []),
      ...(unexpectedIds.length > 0 ? [`Unexpected: ${unexpectedIds.join(", ")}.`] : []),
    ].join(" "));
  }
  const targetsById = new Map(options.targets.map((target) => [target.targetId, target]));
  return options.expectedTargetIds.map((targetId): ValidatedTarget => {
    const target = targetsById.get(targetId);
    if (target === undefined) {
      throw new Error(`Target output publication is missing target '${targetId}'.`);
    }
    return {
      targetId,
      artifacts: validateArtifacts(outputRoot, target),
    };
  });
}

function validateTargetIds(targetIds: readonly string[], subject: string): ReadonlySet<string> {
  const validated = new Set<string>();
  for (const targetId of targetIds) {
    if (!isValidTargetId(targetId)) {
      throw new Error(`Target output publication ${subject} id '${targetId}' is not a safe canonical target id.`);
    }
    if (validated.has(targetId)) {
      throw new Error(`Target output publication ${subject} id '${targetId}' is duplicated.`);
    }
    validated.add(targetId);
  }
  return validated;
}

function validateArtifacts(outputRoot: string, target: BuildOutputTarget): readonly ValidatedArtifact[] {
  const targetRoot = resolve(outputRoot, target.targetId);
  assertContainedPath(outputRoot, targetRoot, `target '${target.targetId}' output root`);
  const artifactsByPath = new Map<string, ValidatedArtifact>();
  for (const artifact of target.artifacts) {
    if (typeof artifact.path !== "string" || artifact.path.length === 0 || artifact.path.includes("\0")) {
      throw new Error(`Target '${target.targetId}' produced an invalid empty or NUL-containing artifact path.`);
    }
    if (typeof artifact.text !== "string") {
      throw new Error(`Target '${target.targetId}' artifact '${artifact.path}' has non-text content.`);
    }
    if (isAbsolute(artifact.path)) {
      throw new Error(`Target artifact path '${artifact.path}' must be project-relative inside the target output root.`);
    }
    const outputPath = resolve(targetRoot, artifact.path);
    assertContainedPath(targetRoot, outputPath, `target artifact '${artifact.path}'`);
    const relativePath = relative(targetRoot, outputPath);
    if (relativePath.length === 0) {
      throw new Error(`Target artifact path '${artifact.path}' must name a file inside the target output root.`);
    }
    if (artifactsByPath.has(relativePath)) {
      throw new Error(`Target '${target.targetId}' produced duplicate artifact path '${relativePath}'.`);
    }
    artifactsByPath.set(relativePath, { relativePath, text: artifact.text });
  }
  for (const relativePath of artifactsByPath.keys()) {
    let parentPath = dirname(relativePath);
    while (parentPath !== ".") {
      if (artifactsByPath.has(parentPath)) {
        throw new Error(
          `Target '${target.targetId}' artifact '${relativePath}' conflicts with file artifact '${parentPath}'.`,
        );
      }
      parentPath = dirname(parentPath);
    }
  }
  return [...artifactsByPath.values()];
}

async function writeStagedOutput(stageRoot: string, targets: readonly ValidatedTarget[]): Promise<void> {
  for (const target of targets) {
    const targetRoot = resolve(stageRoot, target.targetId);
    await mkdir(targetRoot, { recursive: true });
    for (const artifact of target.artifacts) {
      const outputPath = resolve(targetRoot, artifact.relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, artifact.text, { encoding: "utf8", flag: "wx" });
    }
  }
}

async function recoverBuildOutputWithoutLock(scratch: OutputScratchPaths): Promise<void> {
  const outputExists = await pathExists(scratch.outputRoot);
  const backupExists = await pathExists(scratch.backup);
  if (backupExists && outputExists) {
    await rm(scratch.backup, { recursive: true, force: true });
  } else if (backupExists) {
    await rename(scratch.backup, scratch.outputRoot);
  }
  for (const entry of await readdir(scratch.parent, { withFileTypes: true })) {
    const path = resolve(scratch.parent, entry.name);
    if (
      path.startsWith(scratch.stagePrefix)
      || entry.name.startsWith(scratch.staleLockPrefix)
      || entry.name.startsWith(scratch.releasedLockPrefix)
    ) {
      await rm(path, { recursive: true, force: true });
    }
  }
}

async function withOutputLock<Result>(
  scratch: OutputScratchPaths,
  action: () => Promise<Result>,
): Promise<Result> {
  const owner = await acquireOutputLock(scratch);
  let outcome:
    | { readonly kind: "succeeded"; readonly value: Result }
    | { readonly kind: "failed"; readonly error: unknown };
  try {
    outcome = { kind: "succeeded", value: await action() };
  } catch (error: unknown) {
    outcome = { kind: "failed", error };
  }
  try {
    await releaseOutputLock(scratch, owner);
  } catch (releaseError: unknown) {
    if (outcome.kind === "failed") {
      throw new AggregateError(
        [outcome.error, releaseError],
        `Target output operation and publication-lock release both failed for '${scratch.outputRoot}'.`,
      );
    }
    throw releaseError;
  }
  if (outcome.kind === "failed") {
    throw outcome.error;
  }
  return outcome.value;
}

async function acquireOutputLock(scratch: OutputScratchPaths): Promise<OutputLockOwner> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await mkdir(scratch.lock);
      const processStart = await readProcessStart(process.pid);
      const owner: OutputLockOwner = {
        token: randomUUID(),
        pid: process.pid,
        createdAt: Date.now(),
        ...(processStart !== undefined ? { processStart } : {}),
      };
      try {
        await writeFile(scratch.lockOwner, `${JSON.stringify(owner)}\n`, { encoding: "utf8", flag: "wx" });
      } catch (error: unknown) {
        await rm(scratch.lock, { recursive: true, force: true });
        throw error;
      }
      return owner;
    } catch (error: unknown) {
      if (!isFileSystemError(error, "EEXIST")) {
        throw error;
      }
      if (await outputLockIsActive(scratch)) {
        throw new Error(`Another Tsonic process is publishing target output '${scratch.outputRoot}'.`);
      }
      const staleLockPath = resolve(scratch.parent, `${scratch.staleLockPrefix}${randomUUID()}`);
      try {
        await rename(scratch.lock, staleLockPath);
        await rm(staleLockPath, { recursive: true, force: true });
      } catch (recoveryError: unknown) {
        if (!isFileSystemError(recoveryError, "ENOENT")) {
          throw recoveryError;
        }
      }
    }
  }
  throw new Error(`Could not acquire target output publication lock for '${scratch.outputRoot}'.`);
}

async function releaseOutputLock(scratch: OutputScratchPaths, owner: OutputLockOwner): Promise<void> {
  const currentOwner = await readOutputLockOwner(scratch.lockOwner);
  if (currentOwner?.token !== owner.token) {
    throw new Error(`Target output publication lock ownership changed for '${scratch.outputRoot}'.`);
  }
  const releasedLockPath = resolve(scratch.parent, `${scratch.releasedLockPrefix}${owner.token}`);
  await rename(scratch.lock, releasedLockPath);
  await rm(releasedLockPath, { recursive: true, force: true });
}

async function outputLockIsActive(scratch: OutputScratchPaths): Promise<boolean> {
  const lockStatus = await lstat(scratch.lock);
  const owner = await readOutputLockOwner(scratch.lockOwner);
  if (owner === undefined) {
    return timestampIsRecent(lockStatus.mtimeMs, unownedLockGraceMilliseconds);
  }
  if (!processIsRunning(owner.pid)) {
    return false;
  }
  if (owner.processStart !== undefined) {
    const currentProcessStart = await readProcessStart(owner.pid);
    if (currentProcessStart !== undefined) {
      return currentProcessStart === owner.processStart;
    }
  }
  return timestampIsRecent(owner.createdAt, unverifiableLiveLockMaximumAgeMilliseconds);
}

async function readOutputLockOwner(path: string): Promise<OutputLockOwner | undefined> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error: unknown) {
    if (isFileSystemError(error, "ENOENT")) {
      return undefined;
    }
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const owner = value as Readonly<Record<string, unknown>>;
  if (
    typeof owner.token !== "string"
    || typeof owner.pid !== "number"
    || !Number.isSafeInteger(owner.pid)
    || owner.pid <= 0
    || typeof owner.createdAt !== "number"
    || !Number.isFinite(owner.createdAt)
    || (owner.processStart !== undefined && typeof owner.processStart !== "string")
  ) {
    return undefined;
  }
  return {
    token: owner.token,
    pid: owner.pid,
    createdAt: owner.createdAt,
    ...(owner.processStart !== undefined ? { processStart: owner.processStart } : {}),
  };
}

async function readProcessStart(pid: number): Promise<string | undefined> {
  if (process.platform !== "linux") {
    return undefined;
  }
  let text: string;
  try {
    text = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch (error: unknown) {
    if (isFileSystemError(error, "ENOENT") || isFileSystemError(error, "EACCES")) {
      return undefined;
    }
    throw error;
  }
  const commandEnd = text.lastIndexOf(")");
  if (commandEnd < 0) {
    return undefined;
  }
  const fieldsAfterCommand = text.slice(commandEnd + 2).trim().split(/\s+/u);
  return fieldsAfterCommand[19];
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (isFileSystemError(error, "ESRCH")) {
      return false;
    }
    if (isFileSystemError(error, "EPERM")) {
      return true;
    }
    throw error;
  }
}

function timestampIsRecent(timestamp: number, maximumAgeMilliseconds: number): boolean {
  const age = Date.now() - timestamp;
  return age >= -unownedLockGraceMilliseconds && age < maximumAgeMilliseconds;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error: unknown) {
    if (isFileSystemError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function assertContainedPath(root: string, candidate: string, subject: string): void {
  if (pathContainsOrEquals(root, candidate)) {
    return;
  }
  throw new Error(`${subject} resolves outside '${root}'.`);
}

function pathContainsOrEquals(root: string, candidate: string): boolean {
  const relation = relative(root, candidate);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function isFileSystemError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
