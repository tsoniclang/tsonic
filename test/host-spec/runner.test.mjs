import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import test from "node:test";
import { uniqueAnchor } from "./runner/anchors.mjs";
import { orderedDomain, sameIdentity, scalarEqual } from "./runner/assertions.mjs";
import { runHostCase } from "./runner/case.mjs";
import { withSpecProject } from "./runner/project.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));

test("projects preserve complete authored files, exact text and callback result", async () => {
  let projectRoot;
  const result = {};
  const files = [
    { path: "src/日本語.ts", text: "export const greeting = 'こんにちは';\r\n" },
    { path: "other.ts", text: "\uFEFFexport const value = 1;\n" },
  ];
  assert.equal(await withSpecProject(files, async project => {
    projectRoot = project.root;
    assert.equal(Object.isFrozen(project), true);
    assert.equal(Object.isFrozen(project.files), true);
    orderedDomain(project.files, files.map(file => file.path), Object.is, "all authored files");
    for (const file of files) {
      assert.equal(await readFile(resolve(project.root, file.path), "utf8"), file.text, file.path);
    }
    return result;
  }), result);
  assert.equal(existsSync(projectRoot), false, "success removes the disposable project");
});

test("all invalid and colliding paths reject before project creation", async () => {
  const parent = resolve(repository, ".temp/host-spec");
  await mkdir(parent, { recursive: true });
  const before = (await readdir(parent)).sort();
  for (const path of ["", "/absolute.ts", "C:\\absolute.ts", "\\\\server\\share", "../escape.ts",
    "nested/../../escape.ts", "nested/./value.ts", "nested//value.ts", "nested/", "back\\slash.ts", "nul\0.ts"]) {
    let entered = false;
    await assert.rejects(withSpecProject([{ path, text: "" }], () => { entered = true; }),
      /Invalid authored file path at index 0/u);
    assert.equal(entered, false, "invalid path never reaches the callback");
  }
  for (const paths of [["same.ts", "same.ts"], ["directory", "directory/child.ts"],
    ["directory/child.ts", "directory"]]) {
    await assert.rejects(withSpecProject(paths.map(path => ({ path, text: "" })), () => {}),
      /Colliding authored file path at index/u);
  }
  orderedDomain((await readdir(parent)).sort(), before, Object.is, "validation has no filesystem effect");
});

test("project cleanup preserves sync and async callback failures", async () => {
  for (const asynchronous of [false, true]) {
    const original = new Error("original callback failure");
    let projectRoot;
    await assert.rejects(withSpecProject([{ path: "input.ts", text: "export {};" }], project => {
      projectRoot = project.root;
      if (asynchronous) return Promise.reject(original);
      throw original;
    }), error => error === original);
    assert.equal(existsSync(projectRoot), false, "failed callback removes its actual project");
  }
});

test("project validation snapshots the authored input before asynchronous filesystem work", async () => {
  const files = [{ path: "safe.ts", text: "export const original = 1;" }];
  const pending = withSpecProject(files, async project => {
    orderedDomain(project.files, ["safe.ts"], Object.is, "validated file domain");
    scalarEqual(await readFile(resolve(project.root, "safe.ts"), "utf8"),
      "export const original = 1;", "validated exact text");
  });
  files[0].path = "../unvalidated.ts";
  files[0].text = "changed";
  files.push({ path: "extra.ts", text: "extra" });
  await pending;
});

test("partial setup failure cleans every already-created file without entering action", async () => {
  const parent = resolve(repository, ".temp/host-spec");
  await mkdir(parent, { recursive: true });
  const before = (await readdir(parent)).sort();
  let entered = false;
  await assert.rejects(withSpecProject([
    { path: "created/input.ts", text: "export {};" },
    { path: `${"x".repeat(256)}.ts`, text: "" },
  ], () => { entered = true; }), error => error.code === "ENAMETOOLONG");
  assert.equal(entered, false);
  orderedDomain((await readdir(parent)).sort(), before, Object.is, "partial setup leaves no project");
});

test("two nested projects have independent resources and cleanup", async () => {
  let firstRoot;
  let secondRoot;
  await withSpecProject([], async first => {
    firstRoot = first.root;
    await withSpecProject([{ path: "input.ts", text: "export {};" }], second => {
      secondRoot = second.root;
      assert.equal(first.root === second.root, false);
      assert.equal(existsSync(first.root), true);
      assert.equal(existsSync(second.root), true);
    });
    assert.equal(existsSync(secondRoot), false);
    assert.equal(existsSync(firstRoot), true);
  });
  assert.equal(existsSync(firstRoot), false);
});

test("anchors authenticate the caller's exact identity predicate over the full domain", () => {
  const original = {};
  const foreign = {};
  const records = [{ name: "same", original: foreign }, { name: "same", original },
    { name: "other", original: foreign }];
  let visits = 0;
  sameIdentity(uniqueAnchor(records, record => {
    visits += 1;
    return record.original === original;
  }, "exact original"), records[1], "selected record unchanged");
  scalarEqual(visits, records.length, "all anchors inspected before selection");
  assert.throws(() => uniqueAnchor(records, record => record.name === "same", "ambiguous spelling"),
    /ambiguous spelling: expected exactly one anchor; found 2/u);
  assert.throws(() => uniqueAnchor(records, record => record.original === {}, "foreign original"),
    /foreign original: expected exactly one anchor; found 0/u);
  assert.throws(() => uniqueAnchor([], () => true, "missing"), /found 0/u);
  scalarEqual(uniqueAnchor([undefined], () => true, "undefined record"), undefined, "generic record");
});

test("scalar identity preserves exact bigint, fractions, NaN, signed zero and absence", () => {
  for (const value of [undefined, null, true, false, "text", 1, 1.25, 2n ** 200n + 1n, NaN, Infinity, -Infinity, 0, -0]) {
    scalarEqual(value, value, "same exact scalar");
  }
  for (const [actual, expected] of [[undefined, null], [1n, 1], [2n ** 200n, 2n ** 200n + 1n],
    [1.25, 1.5], [NaN, 0], [0, -0], ["1", 1]]) {
    assert.throws(() => scalarEqual(actual, expected, "distinct exact scalars"), /distinct exact scalars/u);
  }
});

test("identity and ordered domains never format supplied graph objects", () => {
  const graph = { [inspect.custom]() { throw new Error("graph must not be formatted"); } };
  graph.self = graph;
  sameIdentity(graph, graph, "same graph");
  orderedDomain([graph, undefined], [graph, undefined], Object.is, "complete graph domain");
  for (const action of [() => sameIdentity(graph, {}, "different graph"),
    () => orderedDomain([graph], [{}], Object.is, "wrong graph domain")]) {
    assert.throws(action, error => {
      assert.equal(error.code, "ERR_ASSERTION");
      assert.equal(error.message.length < 1024, true);
      assert.equal(error.message.includes("must not be formatted"), false);
      return true;
    });
  }
});

test("ordered-domain cardinality precedes comparisons and retains every ordered member", () => {
  const expected = [1, 2, 3];
  orderedDomain(expected, expected, Object.is, "full domain");
  orderedDomain([], [], Object.is, "genuine empty domain");
  for (const actual of [[], [1, 2], [1, 2, 3, 4]]) {
    let compared = false;
    assert.throws(() => orderedDomain(actual, expected, () => { compared = true; return true; }, "cardinality"),
      /cardinality/u);
    assert.equal(compared, false, "never compare a truncated or extra domain");
  }
  for (const actual of [[3, 2, 1], [1, 2, 2]]) {
    assert.throws(() => orderedDomain(actual, expected, Object.is, "ordered member"), /ordered member/u);
  }
  assert.throws(() => orderedDomain(Array(1), [undefined], Object.is, "sparse actual"), /actual slot 0/u);
  assert.throws(() => orderedDomain([undefined], Array(1), Object.is, "sparse expected"), /expected slot 0/u);
});

test("case bracket forwards exact input/resource and closes only after sync or async verification", async () => {
  for (const asynchronous of [false, true]) {
    const input = {};
    const events = [];
    const resource = { close() { events.push("close"); } };
    const entry = received => {
      sameIdentity(received, input, "exact input");
      events.push("entry");
      return asynchronous ? Promise.resolve(resource) : resource;
    };
    await runHostCase(entry, input, received => {
      sameIdentity(received, resource, "exact returned resource");
      events.push("verify");
      return asynchronous ? Promise.resolve() : undefined;
    });
    orderedDomain(events, ["entry", "verify", "close"], Object.is, "one close after verification");
  }
});

test("entry throw/rejection forwards the actual error without closing an imaginary resource", async () => {
  for (const asynchronous of [false, true]) {
    const original = new Error("entry failure");
    let verified = false;
    await assert.rejects(runHostCase(() => {
      if (asynchronous) return Promise.reject(original);
      throw original;
    }, {}, () => { verified = true; }), error => error === original);
    assert.equal(verified, false);
  }
});

test("verification throw/rejection closes exactly once and preserves the actual failure", async () => {
  for (const asynchronous of [false, true]) {
    const original = new Error("verification failure");
    let closed = 0;
    await assert.rejects(runHostCase(() => ({ close() { closed += 1; } }), {}, () => {
      if (asynchronous) return Promise.reject(original);
      throw original;
    }), error => error === original);
    scalarEqual(closed, 1, "one close after verification failure");
  }
});

test("cleanup failures remain visible and retain both exact primary and cleanup failures", async () => {
  const cleanup = new Error("close failed");
  await assert.rejects(runHostCase(() => ({ close() { throw cleanup; } }), {}, () => {}),
    error => error === cleanup);
  for (const primary of [new Error("assertion failed"), undefined]) {
    let closed = 0;
    await assert.rejects(runHostCase(() => ({ close() { closed += 1; throw cleanup; } }), {}, () => {
      throw primary;
    }), error => {
      assert.equal(error instanceof AggregateError, true);
      orderedDomain(error.errors, [primary, cleanup], Object.is, "both original failures");
      return true;
    });
    scalarEqual(closed, 1, "failed close is never retried");
  }
});

test("independent brackets do not share resource or close state", async () => {
  const closed = [];
  for (const id of ["first", "second"]) {
    await runHostCase(() => ({ id, close() { closed.push(id); } }), {}, resource => {
      scalarEqual(resource.id, id, "own resource");
    });
  }
  orderedDomain(closed, ["first", "second"], Object.is, "independent close domains");
});

test("strict declarations bind bidirectionally to the actual JavaScript exports", async () => {
  const runner = resolve(repository, "test/host-spec/runner");
  const imports = [
    `import type * as Contract from ${JSON.stringify(`${runner}/contracts.d.mts`)};`,
    `import { withSpecProject } from ${JSON.stringify(`${runner}/project.mjs`)};`,
    `import { uniqueAnchor } from ${JSON.stringify(`${runner}/anchors.mjs`)};`,
    `import { scalarEqual, sameIdentity, orderedDomain } from ${JSON.stringify(`${runner}/assertions.mjs`)};`,
    `import { runHostCase } from ${JSON.stringify(`${runner}/case.mjs`)};`,
  ].join("\n");
  const binding = `${imports}\nconst actual = {withSpecProject, uniqueAnchor, scalarEqual, sameIdentity, orderedDomain, runHostCase};
const declared: typeof Contract = actual;
const implementation: typeof actual = declared;
const files: readonly Contract.AuthoredFile[] = [{path: 'input.ts', text: 'export {};'}];
const result: Promise<number> = implementation.withSpecProject(files, project => project.files.length);
const anchor: undefined = implementation.uniqueAnchor([undefined], () => true, 'generic anchor');
const bracket: Promise<void> = implementation.runHostCase((input: number) => ({ input, close() {} }), 1,
  program => implementation.scalarEqual(program.input, 1, 'typed resource'));
implementation.orderedDomain([1], [1], (actual, expected) => actual === expected, 'typed domain');
implementation.sameIdentity(files, files, 'typed identity');
void result; void anchor; void bracket;\n`;
  const compiler = resolve(repository, "node_modules/.bin/tsgo");
  const args = ["--ignoreConfig", "--strict", "--noEmit", "--allowJs", "--checkJs",
    "--module", "nodenext", "--target", "es2022", "--types", "node"];
  const compile = path => {
    const result = spawnSync(compiler, [...args, path], {
      cwd: repository, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536,
    });
    assert.equal(result.error === undefined, true, "strict compiler completed");
    assert.equal(result.signal, null, "strict compiler not killed");
    return result;
  };
  await withSpecProject([{ path: "bindings.mts", text: binding }], async project => {
    const path = resolve(project.root, "bindings.mts");
    const positive = compile(path);
    assert.equal(positive.status, 0, `actual JS and declared contract: ${positive.stdout.slice(0, 4096)}`);
    await writeFile(path, `${binding}\nscalarEqual({}, 1, 'object is not scalar');\nrunHostCase(() => ({}), 1, () => {});\n`, "utf8");
    const negative = compile(path);
    assert.equal(negative.status, 1, `invalid scalar and nonclosable resources are rejected: ${negative.stdout.slice(0, 4096)}`);
    assert.equal((negative.stdout.match(/error TS/g) ?? []).length, 2, "both exact boundary opposites");
    assert.match(negative.stdout, /TS2345/u);
    assert.match(negative.stdout, /TS2322/u);
  });
});
