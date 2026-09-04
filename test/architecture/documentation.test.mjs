import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { testWorkspaceRoot } from "../scripts/workspace-layout.mjs";

const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const documentationRoot = resolve(repositoryRoot, "docs");
const workspaceRoot = testWorkspaceRoot;

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

test("documentation examples have balanced fences and valid JSON", () => {
  for (const path of collectMarkdownFiles(documentationRoot)) {
    const source = readFileSync(path, "utf8");
    const fences = [...source.matchAll(/^```/gmu)];
    assert.equal(
      fences.length % 2,
      0,
      `${normalize(relative(repositoryRoot, path))}: unbalanced fenced block`,
    );
    for (const match of source.matchAll(/^```json\s*\n([\s\S]*?)^```\s*$/gmu)) {
      assert.doesNotThrow(
        () => JSON.parse(match[1]),
        `${normalize(relative(repositoryRoot, path))}: invalid JSON example`,
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
  assert.match(reference, /`cacheDir`[^\n]*`\.tsonic\/cache`/u);
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

test("the pinned TypeScript utility inventory is represented in the canonical reference", () => {
  const source = readFileSync(
    resolve(repositoryRoot, "packages/target-api/src/typescript-no-lib-utilities.ts"),
    "utf8",
  );
  const reference = readFileSync(
    resolve(documentationRoot, "reference/typescript-types.md"),
    "utf8",
  );
  const names = [...source.matchAll(/^(?:type|interface)\s+([A-Za-z_$][\w$]*)/gmu)]
    .map((match) => match[1]);
  assert.ok(names.length > 0, "the pinned utility declaration inventory is empty");
  for (const name of names) {
    assert.ok(reference.includes("`" + name + "`"), name);
  }
});

test("target option references match the target parsers", () => {
  const targets = [{
    name: "C#",
    source: resolve(workspaceRoot, "tsonic-csharp/src/options/csharp-target-options.ts"),
    listName: "supportedCsharpTargetOptionKeys",
    reference: resolve(documentationRoot, "reference/targets/csharp/configuration.md"),
  }, {
    name: "Rust",
    source: resolve(workspaceRoot, "tsonic-rust/src/options/rust-target-options.ts"),
    listName: "supportedRustTargetOptionKeys",
    reference: resolve(documentationRoot, "reference/targets/rust/configuration.md"),
  }];

  for (const target of targets) {
    const source = readFileSync(target.source, "utf8");
    const expected = extractFrozenStringList(source, target.listName).sort();
    const reference = readFileSync(target.reference, "utf8");
    const firstSection = reference.split(/^## /mu, 1)[0];
    const actual = [...firstSection.matchAll(/^\| `([^`]+)` \|/gmu)]
      .map((match) => match[1])
      .sort();
    assert.deepEqual(actual, expected, `${target.name} option reference drifted`);
  }
});

test("C# target-owned project properties use their documented controls", () => {
  const source = readFileSync(
    resolve(workspaceRoot, "tsonic-csharp/src/analysis/project/classification.ts"),
    "utf8",
  );
  const reference = readFileSync(
    resolve(documentationRoot, "reference/targets/csharp/configuration.md"),
    "utf8",
  );
  for (const property of extractStringSet(source, "targetOwnedProjectProperties")) {
    assert.ok(reference.includes("`" + property + "`"), property);
  }
});

test("application entry and native project ownership are explicit", () => {
  const applications = readFileSync(
    resolve(documentationRoot, "manual/applications-and-libraries.md"),
    "utf8",
  );
  const projects = readFileSync(resolve(documentationRoot, "manual/projects.md"), "utf8");
  const csharp = readFileSync(
    resolve(documentationRoot, "manual/targets/csharp/projects-and-output.md"),
    "utf8",
  );
  const rust = readFileSync(
    resolve(documentationRoot, "manual/targets/rust/projects-and-output.md"),
    "utf8",
  );

  assert.match(applications, /exported function named `main` is an\s+ordinary function/u);
  assert.match(csharp, /`TsonicEntrypoint\.Main`/u);
  assert.match(csharp, /`Microsoft\.NET\.Sdk`/u);
  assert.match(rust, /export function main\(\): void/u);
  assert.match(rust, /Promise<void>/u);
  assert.match(rust, /`core` and `alloc` generated outputs are\s+libraries/u);
  assert.match(projects, /never edits the project you\s+named/u);
  assert.match(projects, /There is no generic override bag/u);
  assert.doesNotMatch(
    rust,
    /cargo build --manifest-path out\/rust\/Cargo\.toml --locked/u,
    "the first documented Cargo build cannot require a lockfile that does not exist",
  );
});

test("CLI outcomes and publication are documented", () => {
  const reference = readFileSync(resolve(documentationRoot, "reference/cli.md"), "utf8");
  for (const code of ["0", "1", "2"]) {
    assert.match(reference, new RegExp("^\\| `" + code + "` \\|", "mu"));
  }
  assert.match(reference, /publishes the complete output tree only when every selected target/u);
  assert.match(reference, /previous successful output in place/u);
});

test("onboarding uses supported local packages and official native toolchains", () => {
  const gettingStarted = readFileSync(
    resolve(documentationRoot, "manual/get-started.md"),
    "utf8",
  );
  const toolchains = readFileSync(
    resolve(documentationRoot, "reference/toolchains.md"),
    "utf8",
  );
  const documentation = collectMarkdownFiles(documentationRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.match(gettingStarted, /https:\/\/nodejs\.org\/en\/download/u);
  assert.match(gettingStarted, /https:\/\/dotnet\.microsoft\.com\/en-us\/download\/dotnet\/10\.0/u);
  assert.match(gettingStarted, /https:\/\/www\.rust-lang\.org\/tools\/install/u);
  assert.match(gettingStarted, /npm create tsonic@latest hello-csharp -- --target csharp/u);
  assert.match(gettingStarted, /npm create tsonic@latest hello-rust -- --target rust/u);
  assert.match(gettingStarted, /npm run build/u);
  assert.match(gettingStarted, /npm run check/u);
  assert.match(gettingStarted, /npm start/u);
  assert.match(gettingStarted, /--surface js/u);
  assert.match(gettingStarted, /@tsonic\/csharp-nodejs@\^0\.1\.0/u);
  assert.match(gettingStarted, /@tsonic\/rust-nodejs@\^0\.1\.0/u);
  assert.match(toolchains, /Node\.js \| 22\.18 or newer/u);
  assert.match(toolchains, /\.NET 10 SDK/u);
  assert.match(toolchains, /rustup component add rustfmt/u);
  assert.match(toolchains, /rustup component add clippy/u);
  assert.doesNotMatch(
    documentation,
    /\bnpx tsonic\b/u,
    "documentation must not let npx download an unselected CLI when the local install is missing",
  );
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

function extractFrozenStringList(source, listName) {
  const match = source.match(new RegExp(
    `const ${listName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`,
    "u",
  ));
  assert.ok(match?.[1] !== undefined, `source list '${listName}' was not found`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function extractStringSet(source, setName) {
  const match = source.match(new RegExp(
    `const ${setName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`,
    "u",
  ));
  assert.ok(match?.[1] !== undefined, `source set '${setName}' was not found`);
  return [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
}

function normalize(path) {
  return path.replaceAll("\\", "/");
}
