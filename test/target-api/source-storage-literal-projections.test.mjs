import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; ${body}` } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const storage = createSourceStorageQuery(source, [file]);
  const variable = name => namedVariable(source.ast, file, name);
  const initializer = name => Node_Initializer(source.ast, variable(name));
  const subject = name => {
    const selected = storage.subjectFor(variable(name));
    assert.equal(selected.kind === "resolved", true, name);
    return selected.subject;
  };
  return { source, file, storage, variable, initializer, subject };
}

test("checked tuple and array spread storage retains the original complete producer type", async context => {
  const current = fixture(`function pair(): [number, number] { return [2, 3]; }
    function total(...values: number[]): number { return values[0]; }
    function sum3(first: number, second: number, third: number): number { return first + second + third; }
    const values: number[] = [4, 5, 6];
    const fixed = sum3(1, ...pair()); const repeated = total(...values);`);
  const { ast } = current.source;
  for (const name of ["pair()", "values"]) await context.test(name, () => {
    const spread = requiredNode(ast, current.file, node => {
      if (!ast.is.IsSpreadElement(node)) return false;
      const operand = ast.as.AsSpreadElement(node)?.Expression;
      return name === "pair()" ? operand !== undefined && ast.is.IsCallExpression(operand) &&
        ast.text(ast.as.AsCallExpression(operand)?.Expression) === "pair"
        : operand !== undefined && ast.is.IsIdentifier(operand) && ast.text(operand) === name;
    });
    const expression = ast.as.AsSpreadElement(spread)?.Expression;
    assert.equal(expression !== undefined, true, "spread has its actual checked source operand");
    const selected = current.storage.storageSubjectFor(spread);
    assert.equal(selected.kind === "resolved", true, `original spread storage: ${selected.reason ?? ""}`);
    const actual = current.storage.typeFor(selected.subject);
    const expected = current.source.semantics.forNode(expression).types.expressionType(expression);
    assert.equal(actual.kind === "resolved" && actual.type === expected, true,
      "spread syntax retains the original tuple/array source value, not its element or callable");
    const component = current.storage.subject(selected.subject.node, selected.subject.kind,
      [...selected.subject.projection, name === "pair()" ? { kind: "tuple-element", index: 1 } : { kind: "array-element" }]);
    assert.equal(component.kind === "resolved", true, `exact spread component: ${component.reason ?? ""}`);
  });
});

test("a checked guarded array element retains its exact source type without erasing other union arms", () => {
  const current = fixture(`function read(value: string | bigint | readonly string[] | undefined): bigint {
    if (value === undefined || typeof value === "string" || typeof value === "bigint") return 0n;
    const selected = value[0];
    return selected === "wide" ? 9007199254740993n : 0n;
  }
  const exact = 9007199254740993n; const result = read(exact);`);
  const { ast } = current.source;
  const access = current.initializer("selected");
  const receiver = ast.as.AsElementAccessExpression(access)?.Expression;
  assert.equal(receiver !== undefined, true, "the exact checked element access retains its original receiver");
  const component = current.storage.storageSubjectFor(receiver, [{ kind: "array-element" }]);
  assert.equal(component.kind === "resolved", true, `guarded array component: ${component.reason ?? ""}`);
  const actual = current.storage.typeFor(component.subject);
  const expected = current.source.semantics.forNode(access).types.expressionType(access);
  assert.equal(actual.kind === "resolved" && actual.type === expected, true,
    "the exact guarded occurrence supplies its checked element without selecting a guessed union arm");
  const root = current.storage.subjectFor(requiredNode(ast, current.file,
    node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value"));
  assert.equal(root.kind === "resolved", true);
  const selected = current.storage.typeFor(root.subject);
  const types = current.source.semantics.forNode(root.subject.node).types;
  assert.equal(selected.kind === "resolved" && types.isUnion(selected.type), true,
    "projecting the array branch never replaces the original parameter's complete union");
});

test("source spread arguments transport their actual backing element producers", () => {
  const current = fixture(`const first = {}; const second = {}; const values = [first, second];
    function take(...items: {}[]): void {} take(...values);`);
  const { ast } = current.source;
  const spread = requiredNode(ast, current.file, node => ast.is.IsSpreadElement(node));
  const projected = current.storage.storageSubjectFor(spread, [{ kind: "array-element" }]);
  assert.equal(projected.kind === "resolved", true, `backing projection: ${projected.reason ?? ""}`);
  const selected = current.storage.closedOriginsFor(projected.subject);
  assert.equal(selected.kind === "complete", true, `backing producers: ${selected.reason ?? ""}`);
  for (const name of ["first", "second"]) assert.equal(
    selected.origins.some(origin => origin.subject.node === current.initializer(name)), true, name);
  assert.equal(selected.origins.length, 2, "spread syntax is not an extra allocation or element producer");
});

test("all-array union projections retain the exact checked union of element types", async context => {
  for (const [label, annotation] of [
    ["distinct mutable arrays", "number[] | string[]"],
    ["mutable and readonly", "number[] | readonly bigint[]"],
    ["three exact elements", "string[] | bigint[] | readonly boolean[]"],
  ]) await context.test(label, () => {
    const current = fixture(`function select(value: ${annotation}) { return value[0]; }`);
    const { ast } = current.source;
    const parameter = requiredNode(ast, current.file, node => ast.is.IsParameterDeclaration(node));
    const access = requiredNode(ast, current.file, node => ast.is.IsElementAccessExpression(node));
    const selected = current.storage.subject(parameter, "input", [{ kind: "array-element" }]);
    assert.equal(selected.kind === "resolved", true, `${label}: ${selected.reason ?? ""}`);
    const actual = current.storage.typeFor(selected.subject);
    const expected = current.source.semantics.forNode(access).types.expressionType(access);
    assert.equal(actual.kind === "resolved" && actual.type === expected, true,
      `${label}: every array arm contributes its original checked element type`);
  });
});

test("unrefined non-array and unknown arms never become a completed array element proof", () => {
  for (const annotation of ["string[] | number", "string[] | string", "unknown", "any"]) {
    const current = fixture(`function select(value: ${annotation}): void {}`);
    const parameter = requiredNode(current.source.ast, current.file,
      node => current.source.ast.is.IsParameterDeclaration(node));
    assert.equal(current.storage.subject(parameter, "input", [{ kind: "array-element" }]).kind === "unresolved", true,
      `${annotation}: a non-array arm is not silently discarded`);
  }
});

test("an empty array allocation has container identity but no manufactured projected element", () => {
  const current = fixture(`const values: {}[] = []; const read = values[0];`);
  const identity = current.storage.closedOriginsFor(current.subject("values"));
  assert.equal(identity.kind === "complete" && identity.origins.length === 1 &&
    identity.origins[0].subject.node === current.initializer("values"), true);
  const contents = current.storage.originsFor(current.subject("read"));
  assert.equal(contents.kind === "resolved" && contents.origins.length === 0, true,
    "an initial element cannot be invented from the empty container's identity");
  assert.equal(current.storage.closedOriginsFor(current.subject("read")).kind === "unresolved", true,
    "an empty element domain cannot certify an actual closed value");
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("nested empty literal projections do not become element values while nonempty siblings survive", () => {
  const current = fixture(`const token = {}; const values: {}[][] = [[], [token]]; const read = values[0][0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("token"), true,
    "only real nested element producers survive the exact array projection");
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("later indexed writes retain actual contents without reviving an empty initial producer", () => {
  const current = fixture(`const token = {}; const values: {}[] = []; values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete" && selected.origins.length === 1 &&
    selected.origins[0].subject.node === current.initializer("token"), true);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("class member transport consumes real projected contents rather than an empty array seed", () => {
  const current = fixture(`
    class Base {}
    class Entry extends Base { constructor(readonly token: {}) { super(); } }
    const token = {};
    const values: Base[] = [];
    values[0] = new Entry(token);
    function select(value: Base): {} { if (value instanceof Entry) return value.token; return {}; }
    const read = select(values[0]);
  `);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete", true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("external element writers remain open even when the allocation was initially empty", () => {
  const current = fixture(`const token = {}; export const values: {}[] = []; values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true,
    `discarding an empty seed is not proof against external writes (${selected.kind}; ${selected.reason ?? ""})`);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("physical element writes preserve possible initial contents as well as replacement producers", () => {
  const current = fixture(`const initial = {}; const replacement = {}; const values: {}[] = [initial];
    values[0] = replacement; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "complete", true);
  for (const name of ["initial", "replacement"]) {
    assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer(name)), true, name);
  }
  assert.equal(selected.origins.length, 2);
  assert.equal(current.storage.failureReason() === undefined, true);
});

test("publication through an alias retains an empty backing slot's external writer evidence", () => {
  const current = fixture(`const token = {}; const values: {}[] = []; export const exposed = values;
    values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "external-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("opaque element writers are not closed by a later local write to an empty array", () => {
  const current = fixture(`declare function mutate(values: {}[]): void;
    const token = {}; const values: {}[] = []; mutate(values); values[0] = token; const read = values[0];`);
  const selected = current.storage.closedOriginsFor(current.subject("read"));
  assert.equal(selected.kind === "open", true);
  assert.equal(selected.boundaries.some(boundary => boundary.kind === "opaque-write"), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("token")), true);
  assert.equal(selected.origins.some(origin => origin.subject.node === current.initializer("values")), false);
});

test("a rootless recursive value remains unresolved rather than becoming proven empty contents", () => {
  const current = fixture(`function recurse<Value>(value: Value): Value { return recurse(value); }
    const read = recurse({});`);
  assert.equal(current.storage.closedOriginsFor(current.subject("read")).kind === "unresolved", true);
  assert.equal(current.storage.failureReason() === undefined, true);
});
