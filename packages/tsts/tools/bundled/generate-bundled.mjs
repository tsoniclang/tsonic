#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const generatedKind = "bundled-generated";
const generatedBy = "porter:bundled";

export function bundledConfig(config = {}) {
  const tsRoot = config.tsRoot ?? "packages/tsts/src";
  const sourceRoot = config.sourceRoot ?? "packages/tsts/_vendor/typescript-go";
  const sourceLibDir = config.bundledSourceLibDir ?? `${sourceRoot}/internal/bundled/libs`;
  const generatedDir = config.bundledGeneratedDir ?? "internal/bundled";
  const targetDir = `${tsRoot.replace(/\/$/, "")}/${generatedDir}`;
  return {
    sourceLibDir,
    targetDir,
    targetLibDir: `${targetDir}/libs`,
    libsGeneratedPath: `${targetDir}/libs_generated.ts`,
    embedGeneratedPath: `${targetDir}/embed_generated.ts`,
  };
}

export function buildExpectedBundledArtifacts(config = {}, sourceRevision = undefined) {
  sourceRevision ??= currentSourceRevision(config.sourceRoot);
  const bc = bundledConfig(config);
  const sourceRoot = resolveRepo(bc.sourceLibDir);
  const libNames = readLibNames(sourceRoot);
  const artifacts = new Map();

  const libsBody = renderLibsGeneratedBody(libNames);
  artifacts.set(bc.libsGeneratedPath, withGeneratedHeader({
    path: path.posix.relative(config.tsRoot ?? "packages/tsts/src", bc.libsGeneratedPath),
    sourceRevision,
    body: libsBody,
  }));

  const embedBody = renderEmbedGeneratedBody(sourceRoot, libNames);
  artifacts.set(bc.embedGeneratedPath, withGeneratedHeader({
    path: path.posix.relative(config.tsRoot ?? "packages/tsts/src", bc.embedGeneratedPath),
    sourceRevision,
    body: embedBody,
  }));

  for (const name of libNames) {
    const relativePath = `${bc.targetLibDir}/${name}`;
    const body = readFileSync(path.join(sourceRoot, name), "utf8");
    artifacts.set(relativePath, withGeneratedHeader({
      path: path.posix.relative(config.tsRoot ?? "packages/tsts/src", relativePath),
      sourceRevision,
      body,
    }));
  }

  return artifacts;
}

export function buildBundledGeneratedArtifactStatus(config = {}, sourceRevision = undefined) {
  sourceRevision ??= currentSourceRevision(config.sourceRoot);
  const expected = buildExpectedBundledArtifacts(config, sourceRevision);
  const expectedPaths = new Set(expected.keys());
  const bc = bundledConfig(config);
  const actualFiles = actualBundledArtifactPaths(bc);
  const actualPaths = new Set(actualFiles);
  const missing = [];
  const stale = [];
  const orphan = [];
  const untracked = [];
  const invalid = [];

  for (const relativePath of [...expectedPaths].sort()) {
    if (!actualPaths.has(relativePath)) {
      missing.push({ path: relativePath, reason: "Expected bundled generated artifact is missing." });
    }
  }

  for (const relativePath of actualFiles) {
    const text = readFileSync(resolveRepo(relativePath), "utf8");
    const metadataResult = parseGeneratedArtifactMetadata(text);
    if (metadataResult.error) {
      invalid.push({ path: relativePath, reason: metadataResult.error });
      continue;
    }
    if (!metadataResult.metadata) {
      untracked.push({ path: relativePath, reason: "Bundled generated artifacts must carry @tsgo-generated metadata." });
      continue;
    }
    if (metadataResult.metadata.kind !== generatedKind || metadataResult.metadata.generator !== generatedBy) {
      invalid.push({ path: relativePath, reason: `Bundled generated artifact metadata kind/generator must be ${generatedKind}/${generatedBy}.` });
      continue;
    }
    const expectedPath = path.posix.relative(config.tsRoot ?? "packages/tsts/src", relativePath);
    if (metadataResult.metadata.path !== expectedPath) {
      invalid.push({ path: relativePath, reason: `Bundled generated artifact metadata path must be ${expectedPath}.` });
      continue;
    }
    if (!expectedPaths.has(relativePath)) {
      orphan.push({
        path: relativePath,
        metadata: metadataResult.metadata,
        reason: "Bundled generated artifact metadata exists, but this artifact is no longer generated from the current TS-Go snapshot.",
      });
      continue;
    }
    const expectedText = expected.get(relativePath);
    if (text !== expectedText) {
      stale.push({
        path: relativePath,
        metadata: metadataResult.metadata,
        expectedHash: hashText(stripGeneratedHeader(expectedText)),
        actualHash: hashText(stripGeneratedHeader(text)),
        reason: "Bundled generated artifact contents differ from the current deterministic output.",
      });
    }
  }

  return { missing, stale, orphan, untracked, invalid };
}

export function emptyBundledGeneratedArtifactStatus() {
  return { missing: [], stale: [], orphan: [], untracked: [], invalid: [] };
}

export function collectBundledArtifactFailures(status) {
  const failures = [];
  if (status.missing.length > 0) failures.push(`${status.missing.length} missing bundled artifacts`);
  if (status.stale.length > 0) failures.push(`${status.stale.length} stale bundled artifacts`);
  if (status.orphan.length > 0) failures.push(`${status.orphan.length} orphan bundled artifacts`);
  if (status.untracked.length > 0) failures.push(`${status.untracked.length} untracked bundled artifacts`);
  if (status.invalid.length > 0) failures.push(`${status.invalid.length} invalid bundled artifacts`);
  return failures;
}

export function writeBundledGenerated(config = {}, sourceRevision = undefined) {
  sourceRevision ??= currentSourceRevision(config.sourceRoot);
  const artifacts = buildExpectedBundledArtifacts(config, sourceRevision);
  const bc = bundledConfig(config);
  rmSync(resolveRepo(bc.targetLibDir), { force: true, recursive: true });
  for (const [relativePath, text] of artifacts) {
    const absolutePath = resolveRepo(relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, text);
  }
  return artifacts.size;
}

function actualBundledArtifactPaths(bc) {
  const paths = [];
  for (const relativePath of [bc.libsGeneratedPath, bc.embedGeneratedPath]) {
    if (existsSync(resolveRepo(relativePath))) paths.push(relativePath);
  }
  const libRoot = resolveRepo(bc.targetLibDir);
  if (existsSync(libRoot)) {
    for (const file of walk(libRoot)) {
      if (file.endsWith(".d.ts")) {
        paths.push(path.relative(repoRoot, file).split(path.sep).join("/"));
      }
    }
  }
  return paths.sort();
}

function renderLibsGeneratedBody(names) {
  const entries = names.map((name) => `  ${JSON.stringify(name)},`).join("\n");
  return `export const LibNames: readonly string[] = [\n${entries}\n];\n`;
}

function renderEmbedGeneratedBody(sourceRoot, names) {
  const entries = names.map((name) => {
    const content = readFileSync(path.join(sourceRoot, name), "utf8");
    return `  [${JSON.stringify(`libs/${name}`)}, ${Buffer.byteLength(content, "utf8")}],`;
  });
  return `export const embeddedContentSizes: ReadonlyMap<string, number> = new Map<string, number>([\n${entries.join("\n")}\n]);\n\nexport const embeddedContentNames: ReadonlySet<string> = new Set<string>(embeddedContentSizes.keys());\n`;
}

function withGeneratedHeader({ path: artifactPath, sourceRevision, body }) {
  const metadata = {
    schemaVersion: 1,
    kind: generatedKind,
    generator: generatedBy,
    sourceRevision,
    path: artifactPath,
    contentHash: hashText(body),
  };
  return `// Code generated by TSTS bundled generator. DO NOT EDIT.\n// @tsgo-generated ${JSON.stringify(metadata)}\n\n${body}`;
}

function readLibNames(sourceRoot) {
  return readdirSync(sourceRoot)
    .filter((name) => name.endsWith(".d.ts"))
    .sort((left, right) => left.localeCompare(right));
}

function parseGeneratedArtifactMetadata(text) {
  const match = /^\/\/ @tsgo-generated\s+({[^\n\r]+})/m.exec(text);
  if (!match) return { metadata: undefined, error: undefined };
  try {
    const metadata = JSON.parse(match[1]);
    if (metadata.schemaVersion !== 1) return { metadata, error: "Unsupported @tsgo-generated schemaVersion." };
    if (!metadata.kind) return { metadata, error: "Missing @tsgo-generated kind." };
    if (!metadata.generator) return { metadata, error: "Missing @tsgo-generated generator." };
    if (!metadata.path) return { metadata, error: "Missing @tsgo-generated path." };
    if (!metadata.sourceRevision) return { metadata, error: "Missing @tsgo-generated sourceRevision." };
    if (!metadata.contentHash) return { metadata, error: "Missing @tsgo-generated contentHash." };
    return { metadata, error: undefined };
  } catch (error) {
    return { metadata: undefined, error: `Invalid @tsgo-generated JSON: ${error.message}` };
  }
}

function stripGeneratedHeader(text) {
  return text.replace(/^\/\/ Code generated by TSTS bundled generator\. DO NOT EDIT\.\r?\n\/\/ @tsgo-generated {[^}\r\n]+}\r?\n\r?\n/, "");
}

function currentSourceRevision(sourceRoot = "packages/tsts/_vendor/typescript-go") {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: resolveRepo(sourceRoot), encoding: "utf8" });
  if (result.status !== 0) return "unknown";
  return result.stdout.trim();
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function resolveRepo(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const absolute = path.join(dir, name);
    const stat = statSync(absolute);
    if (stat.isDirectory()) out.push(...walk(absolute));
    else out.push(absolute);
  }
  return out;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const write = args.has("--write") || !check;

  if (args.has("--help")) {
    console.log("Usage: node packages/tsts/tools/bundled/generate-bundled.mjs [--check|--write]");
    process.exit(0);
  }

  if (check) {
    const status = buildBundledGeneratedArtifactStatus();
    const failures = collectBundledArtifactFailures(status);
    if (failures.length > 0) {
      throw new Error(`bundled generated artifact check failed: ${failures.join(", ")}`);
    }
    const bc = bundledConfig();
    const libCount = readLibNames(resolveRepo(bc.sourceLibDir)).length;
    console.log(`bundled generated files are current (${libCount} libs)`);
  } else if (write) {
    const count = writeBundledGenerated();
    console.log(`bundled generated files written (${count - 2} libs)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
