import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, TstsSourceProviderContractVersion } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { createSourceStorageEdges } from "../../packages/target-api/dist/target-analysis/source-storage/edges.js";
import { createSourceStorageSubjects } from "../../packages/target-api/dist/target-analysis/source-storage/subjects.js";
import { createSourceStorageBudget } from "../../packages/target-api/dist/target-analysis/source-storage/resource-budget.js";
import { sourceStorageSubjectType } from "../../packages/target-api/dist/target-analysis/source-storage/components.js";
import { namedVariable, projectSourceFile, requiredNode } from "../fixtures/source-navigation.mjs";

const model = {
  moduleSpecifier: "test:storage-context",
  providerModuleId: "storage.context",
  exports: [{
    id: "export.Record", name: "Record", kind: "interface",
    members: [{ id: "member.value", name: "value", kind: "property", type: { kind: "number" } }],
  }, ...["record", "array", "tuple"].map(name => ({
    id: `export.${name}`, name, kind: "function", signatures: [{
      id: `signature.${name}`,
      parameters: [{ name: "input", type: name === "record"
        ? { kind: "provider-ref", moduleSpecifier: "test:storage-context", exportName: "Record" }
        : name === "array" ? { kind: "array", elementType: { kind: "number" } }
          : { kind: "tuple", elementTypes: [{ kind: "number" }, { kind: "number" }] } }],
      returnType: { kind: "void" },
    }],
  }))],
};

function checked(limits = defaultSourceStorageLimits) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: {
      "/src/index.ts": `
        import { record, array, tuple } from "test:storage-context";
        import { checkAgain } from "./second.js";
        const original = { value: 3 };
        const alias = original;
        const values = [3, 7];
        const pair: [number, number] = [3, 7];
        record(alias); array(values); tuple(pair); checkAgain();
      `,
      "/src/second.ts": `
        import { record } from "test:storage-context";
        export function checkAgain(): void { const independent = { value: 11 }; record(independent); }
      `,
    },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
    extensionHostOptions: { extensions: [{
      identity: { id: "test.storage.context", version: "1" },
      initialize(context) {
        context.registerSourceDeclarationProvider({
          identity: { id: "test.storage.provider", version: "1", extensionContractVersion: TstsSourceProviderContractVersion },
          declarationMaterialization: "complete",
          ownsModule: specifier => ({ kind: specifier === model.moduleSpecifier ? "owned" : "unowned" }),
          resolveModule: specifier => ({ kind: "virtual", moduleSpecifier: specifier,
            providerModuleId: model.providerModuleId, virtualFileName: "/virtual/storage-context.d.ts" }),
          getDeclarationModel: () => model,
        });
      },
    }] },
  }).checkSource();
  assert.equal(checked.extensionDiagnostics.length === 0, true, "provider admission succeeds");
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics, "/src"));
  const source = createTargetSourceProgram(checked);
  return { source, storage: createSourceStorageQuery(source, source.navigation.sourceFiles, limits),
    file: projectSourceFile(source, "/src/index.ts"), second: projectSourceFile(source, "/src/second.ts") };
}

function invocation(source, file, name) {
  return requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node) &&
    source.ast.text(source.ast.as.AsCallExpression(node).Expression) === name);
}

for (const name of ["record", "array", "tuple"]) {
  test(`selected virtual ${name} formal retains its exact checked context without admitting foreign syntax`, () => {
    const { source, storage, file } = checked();
    assert.equal(storage.failureReason() === undefined, true);
    const call = invocation(source, file, name);
    const transport = storage.argumentTransportsFor(call);
    assert.equal(transport.kind === "resolved" && transport.arguments.length === 1, true, "one exact selected argument");
    const selected = transport.arguments[0];
    const virtualFile = source.ast.getSourceFile(selected.formal.node);
    assert.equal(virtualFile !== undefined && !source.semantics.includes(virtualFile), true, "provider syntax is not an authored checked file");
    assert.equal(storage.subjectFor(selected.formal.node).kind === "unresolved", true, "no public foreign-node ownership bypass");
    const type = storage.typeFor(selected.formal);
    assert.equal(type.kind === "resolved" && source.semantics.includes(type.sourceFile), true, "transport owns an exact checked query context");
    const semantics = source.semantics.forFile(type.sourceFile);
    assert.equal(semantics.types.isIdentical(type.type, selected.binding.selectedParameterType), true, "formal type belongs to the existing source checker");
    assert.equal(Object.isFrozen(type) && Object.isFrozen(selected) && Object.isFrozen(selected.binding), true);
    if (name !== "record") {
      const budget = createSourceStorageBudget(defaultSourceStorageLimits);
      const subject = createSourceStorageSubjects(budget.subject, budget.reject);
      const formal = subject(selected.formal.node);
      const actual = subject(selected.actual.node);
      const context = owner => owner.node === formal.node ? type.sourceFile : source.ast.getSourceFile(owner.node);
      const edges = createSourceStorageEdges(source, budget, subject, context);
      assert.equal(edges.add(formal, actual), true, "exact aggregate relation");
      const projection = [{ kind: name === "array" ? "array-element" : "tuple-element", ...(name === "tuple" ? { index: 1 } : {}) }];
      const component = subject(actual.node, actual.kind, projection);
      const origins = [...edges.incomingFor(component)];
      assert.equal(origins.length === 1 && origins[0].node === formal.node, true, "lazy foreign component retains the exact formal origin");
      const componentType = sourceStorageSubjectType(source, origins[0], context(origins[0]));
      assert.equal(componentType !== undefined && semantics.types.isNumberLike(componentType), true, "component uses the same checked context");
      assert.equal(budget.failure() === undefined, true, "lazy aggregate projection stays bounded");
    }
    const forged = { ...selected.formal };
    assert.equal(storage.typeFor(forged).kind === "unresolved", true, "shape cannot forge graph ownership");
  });
}

test("virtual structural members transport aliases, fields and cross-file calls through one bounded graph", () => {
  const { source, storage, file, second } = checked();
  const original = namedVariable(source.ast, file, "original");
  const property = source.ast.properties(source.ast.as.AsVariableDeclaration(original).Initializer)[0];
  const record = storage.argumentTransportsFor(invocation(source, file, "record")).arguments[0].formal;
  const semantics = source.semantics.forFile(file);
  const relation = semantics.types.structuralMembers(storage.typeFor(storage.subjectFor(original).subject).type, storage.typeFor(record).type);
  assert.equal(relation.kind === "available" && relation.members.length === 1 && relation.members[0].kind === "present", true, "exact checked field correspondence");
  const field = storage.subjects.find(subject => subject.node === relation.members[0].destination.declarations[0]);
  assert.equal(field !== undefined, true, "checked structural relation interns the selected provider field");
  const type = storage.typeFor(field);
  assert.equal(type.kind === "resolved" && source.semantics.includes(type.sourceFile), true, "nested field context is retained");
  const incoming = storage.incomingFor(field);
  assert.equal(incoming.kind === "resolved" && incoming.subjects.some(subject => subject.node === property), true, "exact authored property origin");
  const again = storage.argumentTransportsFor(invocation(source, second, "record")).arguments[0];
  assert.equal(again.formal === record, true, "one provider formal identity across files");
  assert.equal(again.actual.node === namedVariable(source.ast, second, "independent"), true, "independent source remains exact");
  const originalSubject = storage.subjectFor(original).subject;
  assert.equal(storage.typeFor(originalSubject).sourceFile === file, true, "authored source context never changes");
  const origins = storage.originsFor(originalSubject);
  assert.equal(origins.kind === "resolved" && origins.origins.every(origin => origin.sourceFile === file), true, "immutable typed origins carry their checked owner");
  assert.equal(storage.failureReason() === undefined, true);
});

test("virtual context accounting remains finite and foreign graph subjects remain rejected", () => {
  const first = checked();
  const other = checked();
  const formal = first.storage.argumentTransportsFor(invocation(first.source, first.file, "record")).arguments[0].formal;
  assert.equal(other.storage.typeFor(formal).kind === "unresolved", true, "a second graph cannot reuse a subject");
  const bounded = checked({ ...defaultSourceStorageLimits, maximumTransportRows: 1 });
  assert.equal(typeof bounded.storage.failureReason() === "string", true, "context/transport rows share the finite owner budget");
  assert.equal(bounded.storage.typeFor(formal).kind === "unresolved", true, "budget failure cannot expose an unchecked type");
});
