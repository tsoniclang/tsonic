import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "../../..");
const creator = resolve(repoRoot, "packages/create-tsonic/dist/src/index.js");
const creatorVersion = readJson(resolve(repoRoot, "packages/create-tsonic/package.json")).version;
const fixtureRoot = resolve(repoRoot, ".temp/test-fixtures/project-creator");

test("project creator publishes a complete target-owned starter atomically", () => {
  const runRoot = createRunRoot("success");
  const result = runCreator(runRoot, "success", ["hello-fixture", "--target", "fixture"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const projectRoot = resolve(runRoot, "hello-fixture");
  assert.equal(existsSync(resolve(projectRoot, "package-lock.json")), true);
  assert.deepEqual(readJson(resolve(projectRoot, "package.json")), {
    name: "hello-fixture",
    private: true,
    type: "module",
    scripts: {
      build: "tsonic build --project tsonic.json",
      start: "npm run build && native-run",
      check: "npm run build && native-check",
    },
    devDependencies: {
      "@tsonic/cli": creatorVersion,
      "@tsonic/target-fixture": creatorVersion,
    },
  });
  assert.deepEqual(readJson(resolve(projectRoot, "tsonic.json")), {
    entryPoint: "App.ts",
    rootDir: "src",
    outDir: "out",
    targets: [{ id: "fixture", options: { outputType: "bin" } }],
  });
  assert.equal(readFileSync(resolve(projectRoot, "src/App.ts"), "utf8"), "export {};\n");
  assert.equal(readFileSync(resolve(projectRoot, ".gitignore"), "utf8"), "node_modules/\nout/\n.tsonic/\n");
  assert.equal(stagingDirectories(runRoot, "hello-fixture").length, 0);
});

test("project creator enforces its declared Node.js floor", async () => {
  const { requireSupportedNodeVersion } = await import(
    "../../../packages/create-tsonic/dist/src/scaffold.js"
  );
  assert.doesNotThrow(() => requireSupportedNodeVersion("22.18.0", "22.18.0"));
  assert.doesNotThrow(() => requireSupportedNodeVersion("22.18.0+build.1", "22.18.0"));
  assert.doesNotThrow(() => requireSupportedNodeVersion("23.0.0", "22.18.0"));
  assert.throws(
    () => requireSupportedNodeVersion("22.17.9", "22.18.0"),
    /Node\.js 22\.18\.0 or newer is required; found 22\.17\.9/u,
  );
  assert.throws(
    () => requireSupportedNodeVersion("22.18.0-rc.1", "22.18.0"),
    /Node\.js 22\.18\.0 or newer is required; found 22\.18\.0-rc\.1/u,
  );
});

test("project creator preserves explicit source surfaces", () => {
  const runRoot = createRunRoot("surface");
  const result = runCreator(runRoot, "success", [
    "hello-surface",
    "--target",
    "fixture",
    "--surface",
    "js",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(readJson(resolve(runRoot, "hello-surface/tsonic.json")).targets, [{
    id: "fixture",
    options: { outputType: "bin" },
    surfaces: ["js"],
  }]);
});

test("project creator leaves no destination when a native requirement fails", () => {
  const runRoot = createRunRoot("missing-toolchain");
  const result = runCreator(runRoot, "missing-toolchain", [
    "hello-missing",
    "--target",
    "fixture",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Native toolchain requirements are not satisfied/u);
  assert.match(result.stderr, /Install the fixture SDK/u);
  assert.match(result.stderr, /https:\/\/example\.com\/fixture/u);
  assert.equal(existsSync(resolve(runRoot, "hello-missing")), false);
  assert.equal(stagingDirectories(runRoot, "hello-missing").length, 0);
});

test("project creator rejects target paths that escape the project transaction", () => {
  const runRoot = createRunRoot("escaping-path");
  const result = runCreator(runRoot, "escaping-path", [
    "hello-escape",
    "--target",
    "fixture",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Starter file path '\.\.\/escape\.ts' is not allowed/u);
  assert.equal(existsSync(resolve(runRoot, "hello-escape")), false);
  assert.equal(existsSync(resolve(runRoot, "escape.ts")), false);
  assert.equal(stagingDirectories(runRoot, "hello-escape").length, 0);
});

function createRunRoot(name) {
  const root = resolve(fixtureRoot, `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  const bin = resolve(root, "bin");
  mkdirSync(bin);
  const fakeNpm = resolve(bin, "npm");
  writeFileSync(fakeNpm, fakeNpmSource(), { mode: 0o755 });
  chmodSync(fakeNpm, 0o755);
  return root;
}

function runCreator(runRoot, scenario, args) {
  return spawnSync(process.execPath, [creator, ...args], {
    cwd: runRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${resolve(runRoot, "bin")}:${process.env.PATH ?? ""}`,
      TSONIC_CREATE_TEST_SCENARIO: scenario,
    },
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function stagingDirectories(runRoot, projectName) {
  const prefix = `.${projectName}.tsonic-create-`;
  return readdirSync(runRoot).filter((entry) => entry.startsWith(prefix));
}

function fakeNpmSource() {
  return `#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const project = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const packageRoot = resolve("node_modules/@tsonic/target-fixture");
mkdirSync(packageRoot, { recursive: true });
writeFileSync(resolve(packageRoot, "package.json"), JSON.stringify({
  name: "@tsonic/target-fixture",
  type: "module",
  exports: "./index.js",
}));
const scenario = process.env.TSONIC_CREATE_TEST_SCENARIO;
const command = scenario === "missing-toolchain" ? "missing-fixture-sdk-command" : process.execPath;
const path = scenario === "escaping-path" ? "../escape.ts" : "src/App.ts";
writeFileSync(resolve(packageRoot, "index.js"), \`export function createTsonicPlugin() {
  return {
    kind: "target",
    id: "@tsonic/target-fixture",
    targetId: "fixture",
    createTargetPack() {
      return { surfaces: [{ id: "js" }] };
    },
    createStarterProject() {
      return {
        target: { id: "fixture", options: { outputType: "bin" } },
        scripts: {
          build: "tsonic build --project tsonic.json",
          start: "npm run build && native-run",
          check: "npm run build && native-check"
        },
        files: [{ path: \${JSON.stringify(path)}, contents: "export {};\\\\n" }],
        requirements: [{
          id: "fixture-sdk",
          displayName: "Fixture SDK",
          checks: [{ command: \${JSON.stringify(command)}, args: ["--version"] }],
          installUrl: "https://example.com/fixture",
          installInstructions: "Install the fixture SDK."
        }]
      };
    }
  };
}\`);
writeFileSync(resolve("package-lock.json"), JSON.stringify({
  name: project.name,
  lockfileVersion: 3,
  packages: { "": { name: project.name, devDependencies: project.devDependencies } }
}, null, 2) + "\\n");
`;
}
