import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createQuarantineDeps, verifyQuarantine } from "../scripts/quarantine.mjs";

const repository = fileURLToPath(new URL("../..", import.meta.url));
const dataPath = "test/architecture/quarantine/areas.json";
const data = JSON.parse(readFileSync(join(repository, dataPath), "utf8"));
const archiveRoot = data.areas[0].directory.split("/")[0];
const archived = `${data.areas[0].directory}/reading.ts`;
const hostContract = `${data.currentRoots.hostSource}/ids/contract.ts`;
const real = createQuarantineDeps();
const scalar = value => JSON.stringify(value);
const finding = path => [{ code: "old-config-edge", path }];

function fixture(action) {
  const parent = join(repository, ".temp/quarantine-current");
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "case-"));
  const write = (path, value, executable = false) => {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, typeof value === "string" ? value : JSON.stringify(value));
    if (executable) chmodSync(destination, 0o755);
  };
  const check = expected => assert.equal(scalar(verifyQuarantine(real, root)), scalar(expected));
  write(dataPath, data);
  write("package.json", { type: "module" });
  write("tsconfig.json", { files: [], references: [] });
  write("tsconfig.base.json", { compilerOptions: { strict: true, target: "ES2022", module: "NodeNext" } });
  write("packages/host/tsconfig.json", { extends: "../../tsconfig.base.json", include: ["src/**/*.ts"], references: [] });
  write(hostContract, "export interface Id { readonly value: number; }\n");
  try { action({ root, write, check }); }
  finally { rmSync(root, { recursive: true }); }
}

test("new current-root source and nonempty strict Host configuration are ordinary active inputs", () => fixture(({ check }) => check([])));

test("the reading tree has no integrity, manifest, kind or content role in the gate", () => fixture(({ root, write }) => {
  write(archived, "reading material may be incomplete or edited\n");
  const observed = { ...real,
    bytes: (base, path) => { assert.equal(path.startsWith(`${archiveRoot}/`), false, "no old file is read"); return real.bytes(base, path); },
    children: (base, path) => { assert.equal(path.startsWith(archiveRoot), false, "no old directory is traversed"); return real.children(base, path); },
  };
  assert.equal(scalar(verifyQuarantine(observed, root)), "[]");
}));

for (const [name, path, text] of [
  ["root source", "run.mjs", `import "./${archived}";\n`],
  ["new top-level source", "tools/run.mjs", `import "../${archived}";\n`],
  ["multiline import", "test/scripts/current.mjs", `import {\n} from "../../${archived}";\n`],
  ["build script", "scripts/build/all.sh", `node ${archived}\n`],
  ["test registry", "test/scripts/suite-definition.mjs", `export const files = [${JSON.stringify(archived)}];\n`],
]) test(`active ${name} cannot import or refer to the reading tree`, () => fixture(({ write, check }) => {
  write(path, text);
  check(finding(path));
}));

for (const protocol of ["file:", "link:"]) test(`active ${protocol} dependency cannot refer to the reading tree`, () => fixture(({ write, check }) => {
  write("package.json", { dependencies: { tool: `${protocol}${archived}` } });
  check(finding("package.json"));
}));

test("JSON commands do not acquire an exclusion exemption from their property name", () => fixture(({ write, check }) => {
  write("package.json", { scripts: { exclude: `node ${archived}` } });
  check(finding("package.json"));
}));

test("archive references normalize backslash separators", () => fixture(({ write, check }) => {
  write("package.json", { scripts: { run: `node ${archived.replaceAll("/", "\\")}` } });
  check(finding("package.json"));
}));

test("an active symlink cannot target the reading tree", () => fixture(({ root, check }) => {
  mkdirSync(join(root, "tools"), { recursive: true });
  symlinkSync(`../${archived}`, join(root, "tools/current"));
  check(finding("tools/current"));
}));

test("an ordinary active symlink is not followed or treated as an archive reference", () => fixture(({ root, check }) => {
  mkdirSync(join(root, "tools"), { recursive: true });
  symlinkSync("../package.json", join(root, "tools/current"));
  check([]);
}));

test("extensionless executables have the same total reference rule", () => fixture(({ write, check }) => {
  write("scripts/current", `#!/usr/bin/env node\nimport "../${archived}";\n`, true);
  check(finding("scripts/current"));
}));

for (const extension of ["js", "mjs", "cjs", "ts", "mts", "cts", "sh", "json", "jsonc", "yaml", "yml", "toml"])
  test(`active ${extension} files use the same archive reference rule`, () => fixture(({ write, check }) => {
    const path = `tools/current.${extension}`;
    write(path, ["json", "jsonc"].includes(extension) ? { input: archived } : `input = ${JSON.stringify(archived)}\n`);
    check(finding(path));
  }));

test("JSON exclusion lists may exclude the reading tree but cannot admit another active reference", () => fixture(({ write, check }) => {
  const path = "tools/config.json";
  write(path, { exclude: [archiveRoot] });
  check([]);
  write(path, { exclude: [archiveRoot], input: archived });
  check(finding(path));
}));

test("reference matching preserves complete path-segment boundaries", () => fixture(({ write, check }) => {
  write("tools/current.mjs", `export const name = ${JSON.stringify(`${archiveRoot}ish/file`)};\n`);
  check([]);
}));

test("a tsconfig input cannot compile the reading tree", () => fixture(({ write, check }) => {
  write("tsconfig.json", { files: [archived] });
  check(finding("tsconfig.json"));
}));

test("a tsconfig project reference cannot select the reading tree", () => fixture(({ write, check }) => {
  write("tsconfig.json", { files: [], references: [{ path: `${archiveRoot}/project` }] });
  check(finding("tsconfig.json"));
}));

test("resolved tsconfig inputs must belong to a current source root", () => fixture(({ write, check }) => {
  write("test/outside.ts", "export const outside = true;\n");
  write("tsconfig.json", { files: ["test/outside.ts"] });
  check(finding("tsconfig.json"));
}));

test("the Host project cannot compile a different current root", () => fixture(({ write, check }) => {
  const path = `${data.currentRoots.cliSource}/entry.ts`;
  write(path, "export const current = true;\n");
  write("packages/host/tsconfig.json", { files: [relative("packages/host", path)] });
  check(finding("packages/host/tsconfig.json"));
}));

test("actual config resolution rebases inherited include patterns", () => fixture(({ write, check }) => {
  write("config/base.json", { include: ["../packages/host/src/**/*.ts"] });
  write("tsconfig.json", { extends: "./config/base.json" });
  check([]);
  write("test/outside.ts", "export const outside = true;\n");
  write("config/base.json", { include: ["../test/**/*.ts"] });
  check(finding("tsconfig.json"));
}));

test("project references use actual current projects, never a missing or foreign project", () => fixture(({ write, check }) => {
  write("tsconfig.json", { files: [], references: [{ path: "./packages/host" }] });
  check([]);
  write("tsconfig.json", { files: [], references: [{ path: "../foreign" }] });
  check(finding("tsconfig.json"));
}));

test("malformed active configuration and missing rule data fail closed", () => fixture(({ root, write, check }) => {
  write("tsconfig.json", "{broken\n");
  check(finding("tsconfig.json"));
  write("tsconfig.json", { files: [] });
  rmSync(join(root, dataPath));
  check(finding(dataPath));
}));

test("the CLI exits zero exactly for an empty active-reference finding vector", () => fixture(({ root, write }) => {
  const run = () => spawnSync(process.execPath, [join(repository, "test/scripts/quarantine.mjs"), root],
    { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024 });
  const positive = run();
  assert.equal(positive.status, 0, positive.stderr);
  assert.equal(positive.stdout.trim(), "[]");
  write("tools/current.mjs", `import "../${archived}";\n`);
  const negative = run();
  assert.equal(negative.status, 1, negative.stderr);
  assert.equal(scalar(JSON.parse(negative.stdout)), scalar(finding("tools/current.mjs")));
}));

test("the actual active tree has no reference into the reading tree", () => {
  assert.equal(scalar(verifyQuarantine(real, resolve(repository))), "[]");
});

test("normal build entries strictly emit the current Host modules without claiming compiler capability", () => {
  const reports = mkdtempSync(join(repository, ".temp/host-build-"));
  const reportPath = join(reports, "build.guard.json");
  for (const [command, argumentsList] of [["npm", ["run", "build"]], [process.execPath, ["test/scripts/build.mjs"]]]) {
    const guarded = command === "npm";
    const result = spawnSync(command, argumentsList, { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024,
      env: guarded ? { ...process.env, TSONIC_TEST_GUARD_REPORT: reportPath } : process.env });
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    let output = result.stdout;
    if (guarded) {
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      assert.equal(report.exitCode, 0);
      assert.equal(report.scopeDrained, true);
      output = readFileSync(report.log, "utf8");
    }
    assert.equal(output.includes("Host modules: strict build passed; current JavaScript and declarations emitted."), true);
  }
});
