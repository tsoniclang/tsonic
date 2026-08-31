import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";

const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const documentationRoot = resolve(repositoryRoot, "docs");

const sharedTargetReferencePages = Object.freeze([
  "README.md",
  "configuration.md",
  "source-modules.md",
  "type-mapping.md",
  "native-apis.md",
  "javascript-surface.md",
  "node-capability.md",
  "provider-api.md",
  "language-support.md",
  "support-inventory.md",
  "limitations.md",
]);

test("canonical documentation navigation is complete", () => {
  const sidebars = JSON.parse(readFileSync(resolve(documentationRoot, "sidebars.json"), "utf8"));
  const entries = Object.values(sidebars).flat();
  assert.equal(new Set(entries).size, entries.length, "documentation navigation contains duplicates");
  for (const entry of entries) {
    assert.equal(existsSync(resolve(documentationRoot, entry)), true, `missing navigation entry '${entry}'`);
  }

  const markdownFiles = collectMarkdownFiles(documentationRoot)
    .map((path) => normalize(relative(documentationRoot, path)))
    .filter((path) => path !== "README.md")
    .sort();
  assert.deepEqual([...entries].sort(), markdownFiles);
});

test("every relative documentation link resolves", () => {
  for (const path of collectMarkdownFiles(documentationRoot)) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      const destination = match[1].trim();
      if (
        destination.length === 0 ||
        destination.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/iu.test(destination)
      ) {
        continue;
      }
      const localPath = decodeURIComponent(destination.split("#", 1)[0]);
      assert.equal(
        existsSync(resolve(dirname(path), localPath)),
        true,
        `${normalize(relative(repositoryRoot, path))}: unresolved link '${destination}'`,
      );
    }
  }
});

test("C# and Rust references share the canonical target structure", () => {
  for (const target of ["csharp", "rust"]) {
    const root = resolve(documentationRoot, "reference/targets", target);
    const actual = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name);
    for (const page of sharedTargetReferencePages) {
      assert.ok(actual.includes(page), `${target} reference is missing '${page}'`);
    }
  }

  assert.equal(
    existsSync(resolve(documentationRoot, "reference/targets/rust/ownership-and-lifetimes.md")),
    true,
  );
});

test("project configuration documentation matches the host parser", () => {
  const parser = readFileSync(resolve(repositoryRoot, "packages/host/src/project-config.ts"), "utf8");
  const reference = readFileSync(resolve(documentationRoot, "reference/project-config.md"), "utf8");
  const projectKeys = extractQuotedList(
    parser,
    /rejectUnknownKeys\(value, new Set\(\[([^\]]+)\]\), "Project config"\)/u,
  );
  const targetKeys = extractQuotedList(
    parser,
    /rejectUnknownKeys\(value, new Set\(\[([^\]]+)\]\), `Target at index/u,
  );
  for (const key of [...projectKeys, ...targetKeys]) {
    assert.ok(reference.includes("| `" + key + "` |"), key);
  }
  assert.match(reference, /`rootDir`[^\n]*project-file directory/u);
  assert.match(reference, /`outDir`[^\n]*`dist\/tsonic`/u);
});

test("neutral source exports are represented in the canonical reference", () => {
  const modules = readFileSync(
    resolve(repositoryRoot, "packages/source-core/src/extension/source-modules.ts"),
    "utf8",
  );
  const nativePointers = readFileSync(
    resolve(repositoryRoot, "packages/source-core/src/pointers/provider-declarations.ts"),
    "utf8",
  );
  const safety = readFileSync(
    resolve(repositoryRoot, "packages/source-core/src/safety/declarations.ts"),
    "utf8",
  );
  const reference = readFileSync(resolve(documentationRoot, "reference/source-core.md"), "utf8");
  const exports = new Set([
    ...[...modules.matchAll(/sourcePrimitive\("([^"]+)"/gu)].map((match) => match[1]),
    ...[...modules.matchAll(/exportName:\s*"([^"]+)"/gu)].map((match) => match[1]),
    ...extractObjectStringValues(nativePointers, "tsonicCoreNativePointerProviderNames"),
    ...extractObjectStringValues(safety, "tsonicCoreSafetyProviderNames"),
  ]);
  for (const name of exports) {
    if (name.startsWith("__")) continue;
    assert.ok(reference.includes("`" + name), name);
  }
});

function collectMarkdownFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

function extractQuotedList(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match?.[1] !== undefined, `source list did not match ${pattern}`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function extractObjectStringValues(source, objectName) {
  const match = source.match(new RegExp(`${objectName}[^=]*= Object\\.freeze\\(\\{([\\s\\S]*?)\\}\\);`, "u"));
  assert.ok(match?.[1] !== undefined, `source object '${objectName}' was not found`);
  return [...match[1].matchAll(/:\s*"([^"]+)"/gu)].map((entry) => entry[1]);
}

function normalize(path) {
  return path.replaceAll("\\", "/");
}
