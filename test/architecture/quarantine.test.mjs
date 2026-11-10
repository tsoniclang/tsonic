import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createQuarantineDeps, verifyQuarantine } from "../scripts/quarantine.mjs";

const repository = fileURLToPath(new URL("../..", import.meta.url));
const referencePin = "e9a3764bc1291823d9ef97ffe2879c7d58d87cfd";
const modularPin = "ad9beca6c46dd5bdb9c3ed302e26fbd9f9975363";
const dataPath = "test/architecture/quarantine/areas.json";
const data = JSON.parse(readFileSync(join(repository, dataPath), "utf8"));
const referenceSource = `${data.oldRoots.hostSource}/build.ts`;
const referenceFile = `${data.areas[0].directory}/${referenceSource}`;
const modularFile = `${data.areas[1].directory}/${data.oldRoots.hostSource}/context/contract.ts`;
const mixedReference = `${data.areas[0].directory}/package.json`;
const mixedModular = `${data.areas[1].directory}/package.json`;
const archiveRoot = data.areas[0].directory.split("/")[0];
const packagePath = name => `packages/${name}`;
const packageName = name => `@tsonic/${name}`;
const [oldCli, , oldSourceCore, oldTargetApi] = data.oldPackages;
const real = createQuarantineDeps(repository);
const trees = new Map();
const blobs = new Map();
const baseline = new Map();
let fixture;

const deps = Object.freeze({
  ...real,
  gitTree: pin => trees.get(pin) ?? null,
  gitBlob: oid => blobs.get(oid) ?? null,
});
const scalar = findings => JSON.stringify(findings);
const expected = (code, path) => [{ code, path }];
const write = (path, bytes, kind = "regular") => {
  const absolute = join(fixture, path);
  mkdirSync(dirname(absolute), { recursive: true });
  if (existsSync(absolute) || real.entry(fixture, path)?.kind === "symlink") unlinkSync(absolute);
  if (kind === "symlink") symlinkSync(bytes.toString("utf8"), absolute);
  else {
    writeFileSync(absolute, bytes);
    chmodSync(absolute, kind === "executable" ? 0o755 : 0o644);
  }
};
const restore = path => {
  const original = baseline.get(path);
  if (original) write(path, original.bytes, original.kind);
  else if (real.entry(fixture, path) !== null) unlinkSync(join(fixture, path));
};
const mutate = (paths, operation) => {
  try { operation(); } finally { for (const path of paths) restore(path); }
};
const changeJson = (path, operation) => {
  const document = JSON.parse(baseline.get(path).bytes.toString("utf8"));
  operation(document);
  write(path, Buffer.from(`${JSON.stringify(document)}\n`));
};
const check = (findings, label, supplied = deps) => {
  const actual = verifyQuarantine(supplied, fixture);
  assert.equal(actual.length, findings.length, `${label}: finding count`);
  assert.equal(scalar(actual), scalar(findings), label);
};

before(() => {
  mkdirSync(join(repository, ".temp"), { recursive: true });
  fixture = mkdtempSync(join(repository, ".temp", "s0-quarantine-"));
  for (const [pin, area] of [
    [referencePin, data.areas[0]],
    [modularPin, data.areas[1]],
  ]) {
    const tree = real.gitTree(pin);
    assert.equal(tree !== null, true, `real Git pin exists: ${pin}`);
    trees.set(pin, tree);
    const entries = new Map(tree.entries.map(entry => [entry.path, entry]));
    const paths = readFileSync(join(repository, area.manifest), "utf8").trimEnd().split("\n");
    for (const path of paths) {
      const entry = entries.get(path);
      assert.equal(entry !== undefined, true, `pinned entry exists: ${path}`);
      if (!blobs.has(entry.oid)) blobs.set(entry.oid, real.gitBlob(entry.oid));
      const record = { bytes: blobs.get(entry.oid), kind: entry.kind };
      const destination = `${area.directory}/${path}`;
      baseline.set(destination, record);
      write(destination, record.bytes, record.kind);
    }
  }
  const active = [
    "package.json", "package-lock.json", "tsconfig.json", "tsconfig.base.json",
    "packages/host/package.json", "packages/host/tsconfig.json", "packages/tsts/package.json",
    "scripts/build/all.sh", "test/scripts/build.mjs", "test/scripts/build.sh",
    "test/scripts/suite-definition.mjs", "test/scripts/smoke-set.json", "scripts/release/npm-wave.json",
    "test/scripts/quarantine.mjs", "test/architecture/quarantine.test.mjs",
    "test/architecture/quarantine/reference.paths", "test/architecture/quarantine/host-modular.paths",
    dataPath,
    "scripts/check-branch-hygiene.sh", "scripts/run-bounded.sh",
    ...["bounded-run.sh", "bounded-test-scope.sh", "guard-command.mjs", "guard-cgroup.mjs",
      "guard-report.mjs", "guard-snapshot.mjs", "memory-admission.mjs", "test-resource-budget.mjs",
      "calibrate-utilization.mjs"].map(name => `test/scripts/${name}`),
  ];
  for (const path of active) {
    const bytes = readFileSync(join(repository, path));
    const kind = (lstatSync(join(repository, path)).mode & 0o111) !== 0 ? "executable" : "regular";
    baseline.set(path, { bytes, kind });
    write(path, bytes, kind);
  }
});

test("S0 complete pinned two-area filesystem fixture and empty active configuration", () => {
  check([], "complete fixture");
});

test("S0 mixed file retains its two independently pinned, different versions", () => {
  assert.equal(baseline.get(mixedReference).bytes.equals(baseline.get(mixedModular).bytes), false, "the two real package versions differ");
  check([], "different versions are each compared only with their own pin");
});

for (const path of [referenceFile, modularFile]) {
  test(`S0 exact missing-file: ${path}`, () => mutate([path], () => {
    unlinkSync(join(fixture, path));
    check(expected("missing-file", path), "one removed pinned entry");
  }));
  test(`S0 exact different-bytes: ${path}`, () => mutate([path], () => {
    const record = baseline.get(path);
    const bytes = Buffer.from(record.bytes);
    bytes[0] ^= 1;
    write(path, bytes, record.kind);
    check(expected("different-bytes", path), "one changed byte");
  }));
}

for (const area of data.areas) {
  test(`S0 exact unexpected-file in ${area.directory}`, () => {
    const path = `${area.directory}/undeclared.ts`;
    mutate([path], () => {
      write(path, Buffer.from("not a manifest entry\n"));
      check(expected("unexpected-file", path), "one added entry");
    });
  });
}

test("S0 undeclared third archive area is not an integrity escape", () => {
  const path = `${archiveRoot}/undeclared/extra.ts`;
  mutate([path], () => {
    write(path, Buffer.from("not a third reference area\n"));
    check(expected("unexpected-file", path), "only the two declared archive areas exist");
  });
});

test("S0 file-to-symlink mismatch never reads the foreign target", () => mutate([referenceFile], () => {
  write(referenceFile, Buffer.from("/unreadable-foreign-target"), "symlink");
  let mismatchedReads = 0;
  const observed = { ...deps, bytes: (root, path) => {
    if (path === referenceFile) { mismatchedReads += 1; throw new Error("mismatched link must not be read"); }
    return deps.bytes(root, path);
  } };
  check(expected("different-kind", referenceFile), "link is a kind mismatch", observed);
  assert.equal(mismatchedReads, 0, "no bytes operation on the mismatched link");
}));

test("S0 executable mode is part of the pinned kind", () => {
  const path = `${data.areas[0].directory}/scripts/build/all.sh`;
  mutate([path], () => {
    chmodSync(join(fixture, path), 0o644);
    check(expected("different-kind", path), "executable bit lost");
  });
});

test("S0 missing and wrong Git pins fail closed", () => {
  check(expected("bad-pin", referencePin), "missing reference pin", { ...deps,
    gitTree: pin => pin === referencePin ? null : deps.gitTree(pin) });
  check(expected("bad-pin", modularPin), "wrong resolved pin", { ...deps,
    gitTree: pin => pin === modularPin ? { ...deps.gitTree(pin), pin: referencePin } : deps.gitTree(pin) });
});

test("S0 missing Git blob is bad-pin rather than a guessed source", () => {
  const tree = trees.get(referencePin);
  const source = tree.entries.find(entry => entry.path === referenceSource);
  check(expected("bad-pin", `${referencePin}:${referenceSource}`), "missing blob", {
    ...deps, gitBlob: oid => oid === source.oid ? null : deps.gitBlob(oid),
  });
});

for (const path of [referenceSource, `${data.oldRoots.tests.hostSpec}/runner/case.mjs`]) {
  test(`S0 exact active-old-source: ${path}`, () => mutate([path], () => {
    write(path, Buffer.from("export const forbidden = true;\n"));
    check(expected("active-old-source", path), "old product or old helper remains active");
  }));
}

test("S0 workspace configuration rejects an old package", () => mutate(["package.json"], () => {
  changeJson("package.json", document => document.workspaces.push(packagePath(oldSourceCore)));
  check(expected("old-config-edge", "package.json"), "workspace edge");
}));

test("S0 TypeScript project-reference configuration rejects an old package", () => mutate(["tsconfig.json"], () => {
  changeJson("tsconfig.json", document => document.references.push({ path: `./${packagePath(oldTargetApi)}` }));
  check(expected("old-config-edge", "tsconfig.json"), "TS reference edge");
}));

test("S0 bootstrap build registry rejects an old command", () => mutate(["scripts/build/all.sh"], () => {
  write("scripts/build/all.sh", Buffer.from(`bash ${packagePath(oldCli)}/scripts/mark-bin-executable.mjs\n`));
  check(expected("old-config-edge", "scripts/build/all.sh"), "build command edge");
}));

test("S0 test registry rejects an old helper", () => mutate(["test/scripts/suite-definition.mjs"], () => {
  write("test/scripts/suite-definition.mjs", Buffer.from(`export const suites = [{ files: [${JSON.stringify(`${data.oldRoots.tests.hostSpec}/context.test.mjs`)}] }];\n`));
  check(expected("old-config-edge", "test/scripts/suite-definition.mjs"), "suite registry edge");
}));

test("S0 release registry rejects an old package", () => mutate(["scripts/release/npm-wave.json"], () => {
  changeJson("scripts/release/npm-wave.json", document => document.packages.push({ directory: packagePath(oldCli) }));
  check(expected("old-config-edge", "scripts/release/npm-wave.json"), "release registry edge");
}));

test("S0 root script rejects execution of an archive", () => mutate(["package.json"], () => {
  changeJson("package.json", document => { document.scripts.forbidden = `node ${referenceFile}`; });
  check(expected("old-config-edge", "package.json"), "archive execution edge");
}));

test("S0 lockfile rejects an old workspace link", () => mutate(["package-lock.json"], () => {
  changeJson("package-lock.json", document => { document.packages[`node_modules/${packageName(oldTargetApi)}`] = { link: true, resolved: packagePath(oldTargetApi) }; });
  check(expected("old-config-edge", "package-lock.json"), "stale lock workspace");
}));

test("S0 Host package has no public runtime entry or export", () => mutate(["packages/host/package.json"], () => {
  changeJson("packages/host/package.json", document => { document.main = "./dist/index.js"; });
  check(expected("old-config-edge", "packages/host/package.json"), "runtime entry forbidden");
}));

test("S0 malformed active JSON is a configuration failure", () => mutate(["tsconfig.json"], () => {
  write("tsconfig.json", Buffer.from("{broken\n"));
  check(expected("old-config-edge", "tsconfig.json"), "invalid JSON");
}));

test("S0 missing configuration is a failure, not an empty success", () => mutate(["scripts/release/npm-wave.json"], () => {
  unlinkSync(join(fixture, "scripts/release/npm-wave.json"));
  check(expected("old-config-edge", "scripts/release/npm-wave.json"), "missing registry");
}));

test("S0 a changed or missing path manifest cannot redefine a pin", () => {
  const path = "test/architecture/quarantine/reference.paths";
  mutate([path], () => {
    write(path, Buffer.from(`${referenceSource}\n`));
    check(expected("bad-pin", path), "truncated manifest rejected");
  });
  mutate([path], () => {
    unlinkSync(join(fixture, path));
    check(expected("bad-pin", path), "missing manifest rejected");
  });
});

test("S0 legitimate unchanged guard and vendored checker are not old Host source", () => {
  const tree = trees.get(referencePin);
  for (const path of ["test/scripts/guard-command.mjs", "packages/tsts/package.json"]) {
    const entry = tree.entries.find(item => item.path === path);
    const pinned = real.gitBlob(entry.oid);
    assert.equal(baseline.get(path).bytes.equals(pinned), true, `retained bytes: ${path}`);
  }
  check([], "guard/checker are legitimate active dependency infrastructure");
});

test("S0 actual active gate entry cannot import archived product", () => {
  const path = "test/scripts/quarantine.mjs";
  mutate([path], () => {
    write(path, Buffer.concat([baseline.get(path).bytes, Buffer.from(`\nimport "../../${referenceFile}";\n`)]));
    check(expected("old-config-edge", path), "even the gate's own imports are checked");
  });
});

test("S0 findings sort deterministically by code then path", () => {
  const extra = `${data.areas[0].directory}/extra.ts`;
  mutate([referenceFile, modularFile, extra], () => {
    unlinkSync(join(fixture, referenceFile));
    unlinkSync(join(fixture, modularFile));
    write(extra, Buffer.from("extra\n"));
    check([
      { code: "missing-file", path: modularFile },
      { code: "missing-file", path: referenceFile },
      { code: "unexpected-file", path: extra },
    ], "deterministic finding order");
  });
});

test("S0 thin CLI exits zero exactly for an empty finding vector", () => {
  const run = root => spawnSync(process.execPath, [join(repository, "test/scripts/quarantine.mjs"), root, repository],
    { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024 });
  const positive = run(fixture);
  assert.equal(positive.status, 0, "complete fixture CLI exit");
  assert.equal(positive.stdout.trim(), "[]", "complete fixture CLI findings");
  mutate([referenceFile], () => {
    unlinkSync(join(fixture, referenceFile));
    const negative = run(fixture);
    assert.equal(negative.status, 1, "missing entry CLI exit");
    assert.equal(scalar(JSON.parse(negative.stdout)), scalar(expected("missing-file", referenceFile)), "missing entry CLI findings");
  });
  const missing = spawnSync(process.execPath, [join(repository, "test/scripts/quarantine.mjs"), fixture, fixture],
    { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_DIR: join(fixture, "absent-git-directory"), GIT_WORK_TREE: fixture } });
  assert.equal(missing.status, 1, "missing Git pins CLI exit");
  assert.equal(scalar(JSON.parse(missing.stdout)), scalar([
    { code: "bad-pin", path: modularPin }, { code: "bad-pin", path: referencePin },
  ]), "missing Git pins CLI findings");
});

test("S0 actual final worktree has exact 1556/61 archives and no old active input", () => {
  for (const [manifest, count] of [["reference.paths", 1556], ["host-modular.paths", 61]]) {
    const lines = readFileSync(join(repository, "test/architecture/quarantine", manifest), "utf8").trimEnd().split("\n");
    assert.equal(lines.length, count, `literal manifest count: ${manifest}`);
  }
  assert.equal(scalar(verifyQuarantine(real, resolve(repository))), "[]", "actual disk bytes/kinds and active closure");
});

test("S0 active bootstrap entries report no product and claim no typechecking", () => {
  for (const [command, argumentsList] of [["npm", ["run", "build"]], [process.execPath, ["test/scripts/build.mjs"]]]) {
    const result = spawnSync(command, argumentsList, { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, `bootstrap entry: ${command}`);
    assert.equal(result.stdout.includes("no Host product to compile; no compiler typechecking or capability proof is performed."), true,
      `truthful empty Host build: ${command}`);
  }
});

test("S0 FIRST file locator cannot hide a dependency into an archive", () => mutate(["package.json"], () => {
  changeJson("package.json", document => {
    document.dependencies = { "archived-tooling": `file:${data.areas[0].directory}/${packagePath(oldCli)}` };
  });
  check(expected("old-config-edge", "package.json"), "file protocol reference");
}));

test("S0 FIRST multiline import appended to the gate is a forbidden static reference", () => {
  const path = "test/scripts/quarantine.mjs";
  mutate([path], () => {
    write(path, Buffer.concat([baseline.get(path).bytes, Buffer.from(`\nimport {\n} from "../../${referenceFile}";\n`)]));
    check(expected("old-config-edge", path), "multiline gate reference");
  });
});

test("S0 npm alias cannot hide a retired package identity", () => mutate(["package.json"], () => {
  changeJson("package.json", document => {
    document.dependencies = { "archived-tooling": `npm:${packageName(oldCli)}@1` };
  });
  check(expected("old-config-edge", "package.json"), "npm alias reference");
}));

test("S0 link locator cannot hide an archive dependency", () => mutate(["package.json"], () => {
  changeJson("package.json", document => {
    document.dependencies = { "archived-tooling": `link:${data.areas[0].directory}/${packagePath(oldCli)}` };
  });
  check(expected("old-config-edge", "package.json"), "link protocol reference");
}));

test("S0 reference policy normalizes backslash path separators", () => mutate(["package.json"], () => {
  changeJson("package.json", document => {
    document.dependencies = { "archived-tooling": `file:${referenceFile.replaceAll("/", "\\")}` };
  });
  check(expected("old-config-edge", "package.json"), "backslash archive reference");
}));

test("S0 active symlink target cannot point into an archive", () => {
  const path = "test/tools";
  mutate([path], () => {
    write(path, Buffer.from(`../${data.areas[0].directory}/${data.oldRoots.tests.helpers}`), "symlink");
    check(expected("old-config-edge", path), "active archive symlink");
  });
});

test("S0 ordinary active symlink is not followed or rejected as an archive", () => {
  const path = "tools/current-link";
  mutate([path], () => {
    write(path, Buffer.from("../package.json"), "symlink");
    check([], "ordinary active link target");
  });
});

test("S0 source in a new top-level directory is in the active scan", () => {
  const path = "tools/run.mjs";
  mutate([path], () => {
    write(path, Buffer.from(`import "../${referenceFile}";\n`));
    check(expected("old-config-edge", path), "new top-level source");
  });
});

test("S0 root-level source is in the same active scan", () => {
  const path = "run.mjs";
  mutate([path], () => {
    write(path, Buffer.from(`import "./${referenceFile}";\n`));
    check(expected("old-config-edge", path), "root-level source");
  });
});

test("S0 extensionless executable cannot name an archive", () => {
  const path = "scripts/run-old";
  mutate([path], () => {
    write(path, Buffer.from(`#!/usr/bin/env node\nimport "../${referenceFile}";\n`), "executable");
    check(expected("old-config-edge", path), "extensionless executable reference");
  });
});

for (const path of ["scripts/x.json", "packages/host/tsconfig.build.json"]) {
  test(`S0 additional JSON configuration is scanned: ${path}`, () => mutate([path], () => {
    write(path, Buffer.from(JSON.stringify({ include: [referenceFile] })));
    check(expected("old-config-edge", path), "new JSON owner");
  }));
}

test("S0 JSON exclusion remains permitted without allowing other references", () => {
  const path = "tools/config.json";
  mutate([path], () => {
    write(path, Buffer.from(JSON.stringify({ exclude: [data.areas[0].directory] })));
    check([], "JSON exclude entry only");
    write(path, Buffer.from(JSON.stringify({ exclude: [data.areas[0].directory], include: [referenceFile] })));
    check(expected("old-config-edge", path), "exclude does not exempt other fields");
  });
});

test("S0 static reference rule respects complete path and package-name boundaries", () => {
  const path = "tools/current.mjs";
  mutate([path], () => {
    write(path, Buffer.from(`const paths = ${JSON.stringify([`${archiveRoot}ish/file`, `${packageName(oldCli)}-tools`])};\n`));
    check([], "not the archive segment or retired package name");
  });
});

for (const extension of ["js", "mjs", "cjs", "ts", "mts", "cts", "sh", "json", "jsonc", "yaml", "yml", "toml"]) {
  test(`S0 declared text extension uses the same reference policy: ${extension}`, () => {
    const path = `tools/extension.${extension}`;
    mutate([path], () => {
      const text = ["json", "jsonc"].includes(extension) ? JSON.stringify({ input: referenceFile })
        : `input = ${JSON.stringify(referenceFile)}\n`;
      write(path, Buffer.from(text));
      check(expected("old-config-edge", path), `source/configuration extension ${extension}`);
    });
  });
}

test("S0 a missing path in an otherwise identified Git tree is a bad pin", () => {
  check(expected("bad-pin", `${referencePin}:${referenceSource}`), "missing pinned-tree entry", {
    ...deps,
    gitTree: pin => pin === referencePin ? {
      ...deps.gitTree(pin), entries: deps.gitTree(pin).entries.filter(entry => entry.path !== referenceSource),
    } : deps.gitTree(pin),
  });
});

test("S0 an unsupported pinned entry kind is a bad pin", () => {
  check(expected("bad-pin", `${referencePin}:${referenceSource}`), "unsupported pinned-tree kind", {
    ...deps,
    gitTree: pin => pin === referencePin ? {
      ...deps.gitTree(pin), entries: deps.gitTree(pin).entries.map(entry => entry.path === referenceSource ? { ...entry, kind: "other" } : entry),
    } : deps.gitTree(pin),
  });
});

test("S0 missing filesystem ancestor is absence, not a thrown or guessed read", () => {
  const directory = join(fixture, "test/architecture/quarantine");
  mkdirSync(join(fixture, ".temp"), { recursive: true });
  const held = join(fixture, ".temp/quarantine-held");
  renameSync(directory, held);
  try {
    check(expected("bad-pin", dataPath), "missing data-file ancestor");
  } finally {
    renameSync(held, directory);
  }
});

test("S0 gate data is immutable rather than a policy bypass", () => mutate([dataPath], () => {
  write(dataPath, Buffer.from("{}\n"));
  check(expected("bad-pin", dataPath), "changed policy data rejected");
}));
