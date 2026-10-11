import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

const model = `
  class Base {}
  class Left extends Base { constructor(readonly token: object) { super(); } }
  class Right extends Base { constructor(readonly token: object) { super(); } }
  class Child extends Left {}
`;

function fixture(first, second, options = {}) {
  const files = { "/src/index.ts": `
    export {};
    ${options.crossFile ? 'import { Base, Left, Right, Child } from "./model.js";' : model}
    declare function unknownInput(): Base;
    declare const stop: boolean;
    const fallback = {}; const own = {};
    function first(input: Base): Base | undefined {
      ${options.recursive ? "if (stop) return first(input);" : ""}
      if (${first}) { ${options.selected ?? "return input;"} }
      return undefined;
    }
    function second(input: Base | undefined): object {
      if (${second}) return input.token;
      return fallback;
    }
    const original = ${options.input ?? "unknownInput()"};
    const result = second(first(original));
    const direct = second(original);
  ` };
  if (options.crossFile) files["/src/model.ts"] = model.replaceAll("class ", "export class ");
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles,
    { ...defaultSourceStorageLimits, maximumSteps: 65_536, ...options.limits });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const query = name => {
    const subject = storage.subjectFor(initializer(name));
    return subject.kind === "resolved" ? storage.closedOriginsFor(subject.subject) : subject;
  };
  const expect = (name, expected) => {
    const selected = query(name);
    assert.equal(selected.kind !== "unresolved", true, `${name}: ${storage.failureReason() ?? selected.kind}`);
    assert.equal(selected.origins.length === expected.length && expected.every(origin =>
      selected.origins.some(value => value.subject.node === initializer(origin))), true,
    `${name}: only original producers ${expected.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "strict proof and resource guards remain live");
    return selected;
  };
  return { storage, query, expect };
}

for (const [first, second] of [
  ["input instanceof Left", "input instanceof Right"],
  ["input instanceof Right", "input instanceof Left"],
  ["input instanceof Child", "input instanceof Right"],
  ["input instanceof Left || input instanceof Child", "input instanceof Right"],
  ["input instanceof Left && !(input instanceof Right)", "input instanceof Right"],
  ["!(input instanceof Left) && input instanceof Right", "input instanceof Left"],
]) {
  test(`returned nominal filters exclude impossible native storage: ${first}; ${second}`, () => {
    const current = fixture(first, second);
    const result = current.expect("result", ["fallback"]);
    assert.equal(result.kind === "open" && result.boundaries.some(boundary => boundary.kind === "opaque-result"), true,
      "removing an impossible member read does not certify the opaque provider or invent a native allocation");
  });
}

for (const [first, second] of [
  ["input instanceof Right", "input instanceof Right"],
  ["!(input instanceof Left)", "input instanceof Right"],
  ["input instanceof Left || input instanceof Right", "input instanceof Right"],
  ["input instanceof Base", "input instanceof Right"],
  ["input instanceof Left", "input instanceof Child"],
]) {
  test(`possible unknown member storage retains strict rejection: ${first}; ${second}`, () => {
    const current = fixture(first, second);
    assert.equal(current.query("result").kind === "unresolved", true);
    assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true,
      "a true or unknown predicate is not physical allocation or member correspondence evidence");
  });
}

for (const options of [
  { crossFile: true },
  { recursive: true },
  { selected: "const alias = input; return alias;" },
]) {
  test(`nominal filters survive checked alias/recursive/cross-file transport ${JSON.stringify(options)}`, () => {
    const current = fixture("input instanceof Left", "input instanceof Right", options);
    current.expect("result", ["fallback"]);
  });
}

test("overlapping inherited filters preserve a real derived allocation's exact backing", () => {
  const current = fixture("input instanceof Left", "input instanceof Child", { input: "new Child(own)" });
  current.expect("result", ["fallback", "own"]);
});

test("a write after the original guard cannot constrain the replacement to the old class", () => {
  const current = fixture("input instanceof Left", "input instanceof Right",
    { input: "new Left(own)", selected: "input = new Right(own); return input;" });
  current.expect("result", ["fallback", "own"]);
});

for (const originalFirst of [false, true]) {
  test(`guarded and bare terminal query caches remain distinct (bare first ${originalFirst})`, () => {
    const current = fixture("input instanceof Left", "input instanceof Right");
    if (originalFirst) current.expect("original", ["original"]);
    current.expect("result", ["fallback"]);
    current.expect("original", ["original"]);
    assert.equal(current.query("direct").kind === "unresolved", true,
      "an unrelated bare read cannot inherit the earlier query's filtering predicate");
    assert.equal(current.storage.failureReason() === "Source storage members require exact checked correspondence.", true);
  });
}

for (const [name, limits] of [
  ["work", { maximumSteps: 32 }],
  ["rows", { maximumTransportRows: 32 }],
]) {
  test(`nominal filtering cannot hide exhausted ${name} evidence`, () => {
    const current = fixture("input instanceof Left", "input instanceof Right", { limits });
    assert.equal(current.query("result").kind === "unresolved", true);
    assert.equal(current.storage.failureReason()?.includes("budget") === true, true);
  });
}
