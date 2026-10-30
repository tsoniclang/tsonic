import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedMember, namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";
import { sourceStorageProjectComponents } from "../../packages/target-api/dist/target-analysis/source-storage/graph/component-projections.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `
      export {};
      class Box {
        items: [object, object][] = [];
        constructor(public value: object, other: object) { value = other; }
        get current(): object { return this.value; }
        set current(next: object) { this.value = next; }
        reset(next: object): void { this.value = next; }
      }
      const original = {}; const replacement = {}; const box = new Box(original, replacement);
    ` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the authored fixture checks without annotations compensating for transport");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  assert.equal(storage.failureReason() === undefined, true);
  return { source, file, storage, box: namedDeclaration(source.ast, file, "Box") };
}

function selected(selection) {
  assert.equal(selection.kind === "resolved", true, "the exact canonical subject exists");
  return selection.subject;
}

test("shared member selection distinguishes physical properties, getter results, methods and parameter bindings", () => {
  const { source, file, storage, box } = fixture();
  const { ast } = source;
  const parameter = requiredNode(ast, box, node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value");
  assert.equal(ast.text(ast.name(parameter)), "value");
  const input = selected(storage.subject(parameter, "input"));
  const binding = selected(storage.subject(parameter, "value"));
  const member = selected(storage.memberSubjectFor(parameter));
  assert.equal(input !== binding && binding !== member && member !== input, true, "one declaration owns three distinct semantic roles");
  assert.equal(member === selected(storage.subject(parameter, "member")), true);
  assert.equal(selected(storage.subjectFor(parameter)) === binding, true, "a local parameter read remains a binding");
  for (const [predicate, kind] of [[ast.is.IsGetAccessorDeclaration, "return"], [ast.is.IsSetAccessorDeclaration, "value"]]) {
    const accessor = ast.members(box).find(predicate);
    assert.equal(selected(storage.memberSubjectFor(accessor)) === selected(storage.subject(accessor, kind)), true);
  }
  const method = namedMember(ast, box, "reset");
  const field = namedMember(ast, box, "items");
  assert.equal(selected(storage.memberSubjectFor(method)) === selected(storage.subject(method, "value")), true);
  assert.equal(selected(storage.memberSubjectFor(field)) === selected(storage.subject(field, "member")), true);
  const variable = namedVariable(ast, file, "original");
  const other = ast.parameters(ast.members(box).find(ast.is.IsConstructorDeclaration))[1];
  for (const node of [variable, other, box, fixture().box]) {
    assert.equal(storage.memberSubjectFor(node).kind, "unresolved", "only an exact checked member is admitted");
  }
});

test("canonical Error carrier queries preserve entry versus local binding roles and projected member identities", () => {
  const { source, file, storage, box } = fixture();
  const { ast } = source;
  const parameter = requiredNode(ast, box, node => ast.is.IsParameterDeclaration(node) && ast.text(ast.name(node)) === "value");
  const input = selected(storage.subject(parameter, "input"));
  const binding = selected(storage.subject(parameter, "value"));
  const demand = createSourceErrorDeclarationQuery(source, { fields: [], constructors: [], scalarMutators: [] });
  const original = Node_Initializer(ast, namedVariable(ast, file, "original"));
  const replacement = Node_Initializer(ast, namedVariable(ast, file, "replacement"));
  const entries = storage.originsFor(input);
  const locals = storage.originsFor(binding);
  assert.equal(entries.kind === "resolved" && locals.kind === "resolved", true);
  assert.equal(entries.origins.some(origin => origin.subject.node === original), true);
  assert.equal(entries.origins.some(origin => origin.subject.node === replacement), false, "rebinding is not an entry-input producer");
  assert.equal(locals.origins.some(origin => origin.subject.node === original) && locals.origins.some(origin => origin.subject.node === replacement), true,
    "the identical Node cannot erase the mutable binding's distinct producer set");
  const field = namedMember(ast, box, "items");
  const projection = [{ kind: "array-element" }, { kind: "tuple-element", index: 1 }];
  const projected = selected(storage.subject(field, "member", projection));
  assert.equal(selected(storage.storageSubjectFor(field, projection)) === projected, true);
  assert.equal(projected.kind, "member");
  assert.equal(Object.isFrozen(projected) && Object.isFrozen(projected.projection), true);
  const projectedDemand = demand.mutationFor(projected.node);
  assert.equal(projectedDemand.kind, "not-applicable", "the exact projected member has no Error mutation owner");
  const formal = demand.parameterFor(parameter);
  assert.equal(formal.kind === "resolved" && formal.value.parameter.node === parameter && formal.value.access === "writable", true,
    "the original constructor binding publishes its own checked local rebinding contract, not a merged entry/member carrier");
  assert.equal(storage.failureReason() === undefined, true);
});

test("nested storage projections preserve a proven never prefix without closing unknown or invalid paths", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {}; class Box { items: [object, object][] = []; }
      declare const unproved: unknown;` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the actual source collection and unknown input check");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  const field = namedMember(source.ast, namedDeclaration(source.ast, file, "Box"), "items");
  const semantics = source.semantics.forNode(field);
  const empty = semantics.types.expressionType(Node_Initializer(source.ast, field));
  const target = semantics.declarations.declaredValueType(field);
  const unproved = semantics.declarations.declaredValueType(namedVariable(source.ast, file, "unproved"));
  assert.equal(empty !== undefined && target !== undefined && unproved !== undefined, true,
    "all projection inputs retain exact checked types");
  assert.equal(semantics.types.isUnknown(unproved), true, "the negative source really is unknown, not bottom");
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const project = (from, remaining) => {
    const paths = [];
    sourceStorageProjectComponents([], from, target, remaining, semantics, source.ast, budget, path => paths.push(path));
    return paths;
  };
  const remaining = [{ kind: "array-element" }, { kind: "tuple-element", index: 1 }];
  const absent = project(empty, remaining);
  assert.equal(absent.length === 1 && absent[0].length === 1 && absent[0][0].kind === "array-element", true,
    "the exact empty element prefix survives the later tuple projection");
  const present = project(target, remaining);
  assert.equal(present.length === 1 && present[0].length === 2 && present[0][0].kind === "array-element" &&
    present[0][1].kind === "tuple-element" && present[0][1].index === 1, true,
  "inhabited source components retain their complete selected path");
  assert.equal(project(unproved, remaining).length, 0, "unknown never fabricates a proven empty prefix");
  assert.equal(project(empty, [{ kind: "array-element" }, { kind: "tuple-element", index: 9 }]).length, 0,
    "bottom cannot admit a destination tuple slot that does not exist");
  assert.equal(project(empty, [...remaining, { kind: "array-element" }]).length, 0,
    "the entire remaining destination path is validated before publication");
  assert.equal(budget.failure() === undefined, true, "all actual projection work stays within the unchanged finite limits");
});

test("completed empty value frontiers do not close rootless or opaque producer demands", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    files: { "/src/index.ts": `export {};
      const values: object[] = [];
      declare const foreign: object[];
      const unproved = foreign[0];
      function recurse<Value>(value: Value): Value { return recurse(value); }
      const recursive = recurse({});` },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, "the original empty, opaque and recursive producers check");
  const source = createTargetSourceProgram(checked);
  const file = source.navigation.sourceFiles.find(file => source.ast.getFileName(file) === "/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const variable = name => namedVariable(source.ast, file, name);
  const empty = selected(storage.subject(Node_Initializer(source.ast, variable("values")), "value", [{ kind: "array-element" }]));
  const frontier = storage.boundValueFrontierFor(empty, storage.emptyBindings, []);
  assert.equal(frontier.kind === "resolved" && frontier.frontier.length === 0, true,
    "an exact empty initializer has a completed frontier without a fabricated value");
  assert.equal(storage.closedOriginsFor(empty).kind, "unresolved", "an empty frontier cannot certify an actual closed element");
  const recursive = selected(storage.subjectFor(variable("recursive")));
  assert.equal(storage.boundValueFrontierFor(recursive, storage.emptyBindings, []).kind, "unresolved",
    "a rootless cycle still has no completed producer proof");
  const unproved = selected(storage.subjectFor(variable("unproved")));
  const opaque = storage.boundValueFrontierFor(unproved, storage.emptyBindings, []);
  assert.equal(opaque.kind === "resolved" && opaque.frontier.length === 0, false,
    "an opaque external element never becomes a proven empty frontier");
  assert.equal(storage.failureReason() === undefined, true, "independent empty and unresolved demands do not poison the source graph");
});
