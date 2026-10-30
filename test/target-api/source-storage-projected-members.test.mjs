import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceErrorDeclarationQuery, createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedDeclaration, namedMember, namedVariable } from "../fixtures/source-navigation.mjs";

test("inline optional declaration members preserve correlated absence and real callback stores", () => {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
    compilerOptions: { strict: true, target: "es2022", module: "esnext" }, files: { "/src/index.ts": `
      export {};
      function deliver(callback: (value: object) => void, value: object): void { callback(value); }
      const receiver: { value?: object } = {};
      const absent: { value?: object } = {};
      const other: { value?: object } = {};
      const original = {};
      const unrelated = {};
      const callback = (value: object): void => { receiver.value = value; };
      const otherCallback = (value: object): void => { other.value = value; };
      deliver(callback, original);
      deliver(otherCallback, unrelated);
      const read = receiver.value;
    ` } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, "the original inline optional storage checks");
  const source = createTargetSourceProgram(checked);
  const { ast } = source;
  const file = source.navigation.sourceFiles.find(value => ast.getFileName(value) === "/src/index.ts");
  assert.equal(file !== undefined, true, "the original checked file is present");
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
  const demand = createSourceErrorDeclarationQuery(source, { fields: [], constructors: [], scalarMutators: [] });
  const original = Node_Initializer(ast, namedVariable(ast, file, "original"));
  const unrelated = Node_Initializer(ast, namedVariable(ast, file, "unrelated"));
  for (const name of ["receiver", "absent"]) {
    const declaration = namedVariable(ast, file, name);
    const member = namedMember(ast, ast.typeNode(declaration), "value");
    const subject = storage.subject(declaration, "value", [{ kind: "member", declaration: member }]);
    assert.equal(subject.kind === "resolved", true, `${name}: the exact inline declaration member is admitted`);
    const frontier = storage.boundValueFrontierFor(subject.subject, storage.emptyBindings, []);
    assert.equal(frontier.kind === "resolved", true, `${name}: declaration member completion retains its absence proof`);
    assert.equal(frontier.frontier.some(value => value.kind === "origin" && value.subject.node === original), name === "receiver",
      `${name}: only the actual callback store contributes its checked origin`);
    assert.equal(frontier.frontier.some(value => value.subject.node === unrelated), false,
      `${name}: another receiver's real callback store remains separate`);
    if (name === "absent") assert.equal(frontier.frontier.length, 0, "omitted inline initialization is completed absence, not an unknown producer");
    assert.equal(demand.mutationFor(subject.subject.node).kind, "not-applicable", `${name}: a projected native declaration does not acquire an Error mutation owner`);
  }
  const read = storage.subject(Node_Initializer(ast, namedVariable(ast, file, "read")), "value");
  assert.equal(read.kind === "resolved", true, "the actual property read is admitted");
  assert.equal(demand.fieldFor(read.subject.node).kind, "not-applicable", "the property read does not acquire a same-spelling Error member owner");
  assert.equal(storage.failureReason() === undefined, true, "the original query completes within the unchanged budget");
});

for (const [name, container, prefix, fieldType = "object", stored = "value", suffix = []] of [
  ["direct", "const container = receiver; const absentContainer = absent; const unknownContainer = external;", []],
  ["tuple", "const container: [Slot] = [receiver]; const absentContainer: [Slot] = [absent]; const unknownContainer: [Required] = [external];", [{ kind: "tuple-element", index: 0 }]],
  ["array", "const container: Slot[] = [receiver]; const absentContainer: Slot[] = [absent]; const unknownContainer: Required[] = [external];", [{ kind: "array-element" }]],
  ["tuple-array", "const container: [Slot[]] = [[receiver]]; const absentContainer: [Slot[]] = [[absent]]; const unknownContainer: [Required[]] = [[external]];",
    [{ kind: "tuple-element", index: 0 }, { kind: "array-element" }]],
  ["member-tuple", "const container = receiver; const absentContainer = absent; const unknownContainer = external;",
    [], "[object]", "[value]", [{ kind: "tuple-element", index: 0 }]],
  ["member-array", "const container = receiver; const absentContainer = absent; const unknownContainer = external;",
    [], "object[]", "[value]", [{ kind: "array-element" }]],
]) {
  test(`projected optional member ${name} retains absence and correlated callback writes`, () => {
    const checked = createCompilerSessionFromFiles({ currentDirectory: "/src",
      compilerOptions: { strict: true, target: "es2022", module: "esnext" },
      files: { "/src/index.ts": `
        export {};
        interface Slot { value?: ${fieldType}; }
        interface Foreign { value?: ${fieldType}; }
        interface Required { value: ${fieldType}; }
        declare const external: Required;
        function deliver(callback: (value: object) => void, value: object): void { callback(value); }
        const original = {};
        const unrelated = {};
        const receiver: Slot = {};
        const otherReceiver: Slot = {};
        const absent: Slot = {};
        const alias = receiver;
        const callback = (value: object): void => { alias.value = ${stored}; };
        const otherCallback = (value: object): void => { otherReceiver.value = ${stored}; };
        deliver(callback, original);
        deliver(otherCallback, unrelated);
        ${container}
      ` },
    }).checkSource();
    assert.equal(checked.diagnostics.length, 0, `${name}: the original source checks`);
    const source = createTargetSourceProgram(checked);
    const { ast } = source;
    const file = source.navigation.sourceFiles.find(value => ast.getFileName(value) === "/src/index.ts");
    assert.equal(file !== undefined, true, `${name}: the original file is present`);
    const storage = createSourceStorageQuery(source, source.navigation.sourceFiles);
    const member = namedMember(ast, namedDeclaration(ast, file, "Slot"), "value");
    const projection = [...prefix, { kind: "member", declaration: member }, ...suffix];
    const subject = storage.subject(namedVariable(ast, file, "container"), "value", projection);
    const absentSubject = storage.subject(namedVariable(ast, file, "absentContainer"), "value", projection);
    assert.equal(subject.kind === "resolved" && absentSubject.kind === "resolved", true,
      `${name}: both exact projected subjects are admitted`);
    const frontier = storage.boundValueFrontierFor(subject.subject, storage.emptyBindings, []);
    const absentFrontier = storage.boundValueFrontierFor(absentSubject.subject, storage.emptyBindings, []);
    assert.equal(frontier.kind === "resolved", true, `${name}: a callback store does not erase the initial absence proof`);
    assert.equal(absentFrontier.kind === "resolved" && absentFrontier.frontier.length === 0, true,
      `${name}: proven absence is a completed empty frontier rather than a missing producer`);
    const original = Node_Initializer(ast, namedVariable(ast, file, "original"));
    const unrelated = Node_Initializer(ast, namedVariable(ast, file, "unrelated"));
    assert.equal(frontier.frontier.some(value => value.kind === "origin" && value.subject.node === original), true,
      `${name}: the exact live callback producer is retained`);
    assert.equal(frontier.frontier.some(value => value.subject.node === unrelated), false,
      `${name}: a distinct receiver origin is not joined`);
    const demand = createSourceErrorDeclarationQuery(source, { fields: [], constructors: [], scalarMutators: [] });
    assert.equal(demand.mutationFor(subject.subject.node).kind, "not-applicable", `${name}: the completed member has no Error mutation owner`);
    assert.equal(demand.mutationFor(absentSubject.subject.node).kind, "not-applicable", `${name}: exact absence is not a fabricated Error owner`);
    const required = namedMember(ast, namedDeclaration(ast, file, "Required"), "value");
    const unknown = storage.subject(namedVariable(ast, file, "unknownContainer"), "value", [...prefix, { kind: "member", declaration: required }, ...suffix]);
    assert.equal(unknown.kind === "resolved", true, `${name}: the required external member has its original checked identity`);
    const unknownOrigins = storage.closedOriginsFor(unknown.subject);
    assert.equal(unknownOrigins.kind === "open" || unknownOrigins.kind === "unresolved" &&
      typeof unknownOrigins.reason === "string" && unknownOrigins.reason.length !== 0, true,
      `${name}: an unknown required producer cannot become proven optional absence`);
    const foreign = namedMember(ast, namedDeclaration(ast, file, "Foreign"), "value");
    const invalid = storage.subject(namedVariable(ast, file, "container"), "value", [...prefix, { kind: "member", declaration: foreign }, ...suffix]);
    assert.equal(invalid.kind === "unresolved" ||
      storage.boundValueFrontierFor(invalid.subject, storage.emptyBindings, []).kind === "unresolved", true,
      `${name}: same-spelling unrelated member identity cannot manufacture a producer`);
    assert.equal(storage.failureReason() === undefined, true, `${name}: the finite query has no global budget failure`);
  });
}
