import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, createSourceSemanticsExtension, formatDiagnostics } from "@tsonic/tsts";
import { createTsonicCoreSourceExtension, tsonicCoreSourceSemanticsModules } from "../../packages/source-core/dist/public/index.js";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits }
  from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";
import { createSourceDeclarationOwnershipBudget, createSourceDeclarationOwnershipValues,
  createSourceDeclarationSuspensionQuery, createSourceDeclarationRetentionQuery,
  createSourceDeclarationOwnershipQuery, sourceDeclarationOwnershipUnresolved, defaultSourceDeclarationOwnershipLimits }
  from "../../packages/target-api/dist/public/analysis.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    import { loadptr } from "@tsonic/core/lang.js";
    import type { Pointer } from "@tsonic/core/types.js";
    export function read(pointer: Pointer<object>): object { return loadptr(pointer); }
    const unrelated = 0;
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" },
    extensionHostOptions: { extensions: [createSourceSemanticsExtension({ modules: tsonicCoreSourceSemanticsModules() }),
      createTsonicCoreSourceExtension()] },
  }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  assert.equal(checked.extensionDiagnostics.length === 0, true, "the native pointer read has exact checked evidence");
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const call = requiredNode(source.ast, file, node => source.ast.is.IsCallExpression(node));
  const storage = createSourceStorageQuery(source, [file]);
  const subject = storage.subjectFor(call);
  assert.equal(subject.kind === "resolved", true, "the native invocation has its original canonical subject");
  const selected = source.semantics.forNode(call).operations.call(call);
  assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "the native invocation has a checked selected signature");
  const contractDeclaration = source.semantics.forNode(call).declarations.signatureDeclaration(selected.selectedSignature);
  const type = storage.typeFor(subject.subject);
  assert.equal(type.kind === "resolved" && contractDeclaration !== undefined, true, "exact contract type and native declaration");
  const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
  const nodes = source.navigation.nodesForFiles([file]);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const value = context.values.forNode(call);
  assert.equal("kind" in value, false, "the original operation has its required checked component and declaration region");
  const evidence = { kind: "never", value, contract: { kind: "declaration", declaration: contractDeclaration, component: value.component } };
  return { source, file, call, storage, subject: value, values: context.values, budget, evidence };
}

for (const resultFirst of [false, true]) {
  test(`native invocation completion does not require an invented external pointee (${resultFirst})`, () => {
    const current = fixture();
    const query = createSourceDeclarationSuspensionQuery({ ...current,
      premises: { suspensionFor: (value, use) => use === "operation" && value === current.subject ? current.evidence : undefined } });
    const inspectValue = () => {
      const selected = query.forResult(current.call);
      assert.equal(selected.kind, "unresolved", "result adoption still requires the actual unknown pointee's producer proof");
    };
    const inspectInvocation = () => {
      const selected = query.forCall(current.call);
      assert.equal(selected.kind, "never", "the original native operation's declared completion contract is independent of its unknown payload");
      assert.equal(query.forCall(current.call) === selected, true, "one exact invocation/context decision");
    };
    for (const inspect of resultFirst ? [inspectValue, inspectInvocation] : [inspectInvocation, inspectValue]) inspect();
    assert.equal(current.storage.storageProducersFor(current.storage.subjectFor(current.call).subject).kind, "unresolved", "no pointee, allocation or stored value was fabricated");
    assert.equal(current.storage.failureReason(), undefined, "an unknown input is not global budget exhaustion");
    assert.equal(current.budget.failure(), undefined, "both legitimate questions retain finite shared ownership evidence");
  });
}

test("native invocation completion still requires the exact declared operation contract", () => {
  const current = fixture();
  const unrelated = sourceType(current, current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast,
    current.file, "unrelated")).Initializer);
  for (const replacement of [undefined, { value: { ...current.subject } }, { contract: { ...current.evidence.contract, component: { selectedType: unrelated } } },
    { contract: { ...current.evidence.contract, declaration: namedVariable(current.source.ast, current.file, "unrelated") } }]) {
    const query = createSourceDeclarationSuspensionQuery({ ...current, premises: { suspensionFor: () => replacement === undefined
      ? undefined : { ...current.evidence, ...replacement } } });
    assert.equal(query.forCall(current.call).kind, "unresolved",
      "missing, foreign, mistyped and unrelated declarations never authorize an empty native continuation");
  }
  const query = createSourceDeclarationSuspensionQuery({ ...current, premises: { suspensionFor: () => current.evidence } });
  const foreign = fixture();
  assert.equal(query.forCall(foreign.call).kind, "unresolved", "foreign calls stay outside the checked source");
  assert.equal(createSourceDeclarationSuspensionQuery({ ...current,
    premises: { suspensionFor: () => ({ ...current.evidence, value: { ...current.subject } }) } }).forCall(current.call).kind, "unresolved", "copied checked operand descriptors remain foreign");
});

function sourceType(current, node) {
  const selected = current.source.semantics.forNode(node).types.expressionType(node);
  assert.equal(selected !== undefined, true, "exact negative-control source type");
  return selected;
}

function declarationFixture(hideNativeDeclaration = false) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/declared", files: {
    "/declared/native.d.ts": "export declare function nativeRead<Value>(value: Value): Promise<Value>;",
    "/declared/index.ts": `
      import { nativeRead } from "./native.js";
      export async function read<Value>(value: Value) { return await nativeRead(value); }
      export async function another() { return await nativeRead(true); }
      const unrelated = "wrong component";
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext", moduleResolution: "bundler" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined)).slice(0, 1024));
  const source = createTargetSourceProgram(hideNativeDeclaration ? { ...checked,
    sourceFiles: checked.sourceFiles.filter(file => file !== undefined && !checked.ast.isDeclarationFile(file)) } : checked);
  const file = checked.getSourceFile("/declared/index.ts");
  assert.equal(file !== undefined, true, "the declaration-local owner is checked");
  const nodes = source.navigation.nodesForFiles([file]);
  const call = nodes.find(node => source.ast.is.IsCallExpression(node));
  assert.equal(call !== undefined, true, "the exact native invocation exists");
  const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const selected = source.semantics.forNode(call).operations.call(call);
  assert.equal(selected?.sourceSelectedSignatureKind === "resolved", true, "a real checked generic native signature");
  const declaration = source.semantics.forNode(call).declarations.signatureDeclaration(selected.selectedSignature);
  assert.equal(declaration !== undefined, true, "the external declaration is real, not an invented source body");
  const premises = {
    completionFor(node, selection) {
      const owner = source.semantics.forNode(node).declarations.signatureDeclaration(selection.selectedSignature);
      return { kind: "async", resultPolicy: "must-observe",
        contract: { kind: "declaration", declaration: owner, component: { selectedType: selection.sourceResultType } } };
    },
    retentionFor({ value }) {
      return { kind: "resolved", premises: [{ kind: "retained", reason: "owned-value", value,
        contract: { kind: "expression", expression: value.node, component: value.component } }] };
    },
    suspensionFor(value) {
      return { kind: "may-suspend", value,
        contract: { kind: "expression", expression: value.node, component: value.component } };
    },
  };
  return { source, file, nodes, call, selected, declaration, budget, context, premises };
}

test("declaration-native completion accepts an exact external generic operation without source storage", () => {
  const current = declarationFixture();
  const query = createSourceDeclarationOwnershipQuery({ ...current, premises: current.premises });
  const selected = query.forCall(current.call);
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true, "the actual native operation is immediately awaited");
  assert.equal(selected.disposition.kind === "awaited-in-scope", true, "the original caller's await is retained");
  assert.equal(query.forCall(current.call) === selected, true, "one immutable declaration-local decision");
});

test("declaration-native completion keeps checked provider identity outside the emitted-source inventory", () => {
  const current = declarationFixture(true);
  const provider = current.source.ast.getSourceFile(current.declaration);
  assert.equal(provider !== undefined && !current.source.semantics.includes(provider), true,
    "the real checked native declaration has no emitted body or synthetic project region");
  const query = createSourceDeclarationOwnershipQuery({ ...current, premises: current.premises });
  const selected = query.forCall(current.call);
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
    "selected checked-signature identity, not project-file membership, authorizes the provider contract");
  const foreign = declarationFixture(true);
  const wrong = createSourceDeclarationOwnershipQuery({ ...current, premises: { ...current.premises,
    completionFor(node, selection) {
      const completed = current.premises.completionFor(node, selection);
      return { ...completed, contract: { ...completed.contract, declaration: foreign.declaration } };
    } } });
  assert.equal(wrong.forCall(current.call).kind === "unresolved", true,
    "a same-URI declaration from another checked program cannot replace that selected native declaration");
});

test("declaration-native values preserve exact region identity independently of unrelated call order", () => {
  const current = declarationFixture();
  const first = current.context.values.forNode(current.call);
  assert.equal("kind" in first, false, "the original native value is published");
  const other = current.nodes.filter(node => current.source.ast.is.IsCallExpression(node))[1];
  assert.equal(other !== undefined, true, "an unrelated native call exists");
  current.context.values.forNode(other);
  const repeated = current.context.values.forNode(current.call);
  assert.equal(first === repeated, true, "unrelated queries cannot retarget the earlier declared value");
  assert.equal(current.source.ast.text(current.source.ast.name(first.region.owner)) === "read" &&
    first.region.root === current.source.ast.body(first.region.owner) && first.region.role === "body", true,
    "the region identifies the original read declaration and actual body, not an invocation");
  assert.equal(Object.isFrozen(first) && Object.isFrozen(first.component), true, "immutable checked value and component");
});

test("declaration-native suspension distinguishes completed operation output from a TS payload reconstruction", () => {
  const current = declarationFixture();
  const query = createSourceDeclarationSuspensionQuery({ ...current, values: current.context.values });
  const selected = query.forCall(current.call);
  assert.equal(selected.kind === "resolved", true, "the completed native operation may suspend");
  assert.equal(selected.pending.expression === current.call, true, "the pending witness identifies the actual operation output");
  assert.equal(query.owns(selected.pending), true, "the pending witness belongs to this immutable query");
  assert.equal(query.owns({ ...selected.pending }), false, "a copied pending witness grants no native ownership");
  assert.equal("bindings" in selected.pending, false, "no caller activation is transported");
});

test("declaration-native suspension rejects foreign declaration and incompatible component evidence", () => {
  const current = declarationFixture();
  const foreign = declarationFixture();
  const wrongType = sourceType(current, current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast,
    current.file, "unrelated")).Initializer);
  for (const [label, amend] of [
    ["foreign declaration", value => ({ kind: "declaration", declaration: foreign.declaration, component: value.component })],
    ["wrong component", value => ({ kind: "expression", expression: value.node, component: { selectedType: wrongType } })],
  ]) {
    const query = createSourceDeclarationSuspensionQuery({ ...current, values: current.context.values,
      premises: { suspensionFor: value => ({ kind: "never", value, contract: amend(value) }) } });
    assert.equal(query.forCall(current.call).kind === "unresolved", true, label);
  }
});

test("missing declaration-native evidence stays unresolved and is never cached as a completed contract", () => {
  const current = declarationFixture();
  let complete = false;
  const query = createSourceDeclarationSuspensionQuery({ ...current, values: current.context.values,
    premises: { suspensionFor: value => complete ? current.premises.suspensionFor(value) : undefined } });
  const absent = query.forCall(current.call);
  assert.equal(absent.kind === "unresolved" && absent.cause.kind === "required-fact", true, "missing native output is not non-suspension");
  complete = true;
  assert.equal(query.forCall(current.call).kind === "resolved", true, "an unresolved lookup was not retained as successful completion");
});

for (const category of ["required-fact", "resource-limit"]) {
  test(`declared result retention cannot hide an unresolved native continuation (${category})`, () => {
    const current = declarationFixture();
    let complete = false;
    const failure = category === "required-fact"
      ? sourceDeclarationOwnershipUnresolved(current.call, "missing completed native operation")
      : Object.freeze({ kind: "unresolved", at: current.call, reason: "native continuation work exhausted",
          cause: Object.freeze({ kind: "resource-limit", subject: current.call, category: "step", limit: 1 }) });
    const query = createSourceDeclarationOwnershipQuery({ ...current, premises: { ...current.premises,
      suspensionFor: value => complete ? current.premises.suspensionFor(value) : failure } });
    assert.equal(query.forCall(current.call) === failure, true,
      "an independently retained output does not replace the required continuation evidence or its exact failure");
    complete = true;
    const selected = query.forCall(current.call);
    assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
      "the failed lookup was not cached as successful or permanent completion");
  });
}

test("declaration-native retention rejects a copied descriptor and preserves both native borrow modes", () => {
  const current = declarationFixture();
  const value = current.context.values.forNode(current.call);
  assert.equal("kind" in value, false, "the actual local descriptor is available");
  const parameter = current.source.ast.parameters(value.region.owner)[0];
  const owner = current.context.values.forNode(parameter);
  assert.equal("kind" in owner, false, "the native lease owner is a checked parameter in the same declaration");
  for (const mode of ["shared", "mutable"]) {
    const query = createSourceDeclarationRetentionQuery({ ...current, values: current.context.values,
      premises: { retentionFor: ({ value: actual }) => ({ kind: "resolved", premises: [{ kind: "scoped-borrowed", value: actual,
        owner, region: value.region.owner, mode, contract: { kind: "expression", expression: actual.node, component: actual.component } }] }) } });
    assert.equal(query.forValue(value).kind === "resolved", true, mode);
    assert.equal(query.forValue({ ...value }).kind === "unresolved", true, `${mode}: copied local value`);
  }
});

for (const kind of ["input-duration", "type-argument"]) {
  for (const mode of ["shared", "mutable"]) {
    test(`declaration-native results retain the exact selected ${kind} ${mode} formal contract`, () => {
      const current = declarationFixture();
      const value = current.context.values.forNode(current.call);
      assert.equal("kind" in value, false, "the result has its actual checked caller region");
      const parameter = current.selected.sourceSelectedSignatureParameters[0]?.parameterDeclaration;
      const formals = current.source.ast.typeParameters(current.declaration);
      const arguments_ = current.selected.sourceSelectedMethodTypeArguments;
      const regionDeclarations = current.source.ast.typeParameters(value.region.owner);
      assert.equal(parameter !== undefined && formals.length === 1 && arguments_?.length === 1 && regionDeclarations.length === 1,
        true, "exact native input and generic correspondence on the unchanged source");
      const region = kind === "input-duration" ? { kind, parameter }
        : { kind, declaration: regionDeclarations[0], binding: { declaration: formals[0],
            parameterType: arguments_[0].typeParameter, argumentType: arguments_[0].selectedType } };
      const premiseFor = actual => ({ kind: "formal-borrowed", value: actual, executionOwner: current.declaration, region, mode,
        contract: { kind: "expression", expression: actual.node, component: actual.component } });
      const premises = { ...current.premises, retentionFor: ({ value: actual }) => ({ kind: "resolved", premises: [premiseFor(actual)] }) };
      const retention = createSourceDeclarationRetentionQuery({ ...current, values: current.context.values, premises });
      const retained = retention.forValue(value);
      assert.equal(retained.kind === "resolved" && retained.premises.length === 1 && retained.premises[0].value === value &&
        retained.premises[0].mode === mode, true, "the borrowed result retains its real selected native formal and mode");
      const query = createSourceDeclarationOwnershipQuery({ ...current, premises });
      const selected = query.forCall(current.call);
      assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
        "the actual immediate await uses the caller's substituted native region, not the callee's declaration environment");
      const foreign = declarationFixture();
      const foreignValue = foreign.context.values.forNode(foreign.call);
      assert.equal("kind" in foreignValue, false, "the foreign region negative is a real declaration in its own checked program");
      for (const wrong of ["owner", "region"]) {
        const invalid = createSourceDeclarationRetentionQuery({ ...current, values: current.context.values,
          premises: { retentionFor: ({ value: actual }) => {
            const premise = premiseFor(actual);
            return { kind: "resolved", premises: [{ ...premise, ...(wrong === "owner" ? { executionOwner: foreign.declaration }
              : { region: kind === "input-duration"
                ? { kind, parameter: foreign.selected.sourceSelectedSignatureParameters[0].parameterDeclaration }
                : { ...region, declaration: foreign.source.ast.typeParameters(foreignValue.region.owner)[0] } }) }] };
          } } });
        assert.equal(invalid.forValue(value).kind === "unresolved", true, `${wrong}: a foreign formal/lifetime cannot replace exact native evidence`);
      }
    });
  }
}

test("declaration-native finite work and row exhaustion retain subject and exact limit without false invalid-config exhaustion", () => {
  const current = declarationFixture();
  const work = createSourceDeclarationOwnershipBudget(current.call, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 1 });
  assert.equal(work.step(current.call), true, "one admitted work step");
  assert.equal(work.step(current.call), false, "the next work step exhausts the unchanged finite input");
  assert.equal(work.failure().cause.kind === "resource-limit" && work.failure().cause.subject === current.call &&
    work.failure().cause.category === "step" && work.failure().cause.limit === 1, true, "typed actual work limit");
  const rows = createSourceDeclarationOwnershipBudget(current.call, { ...defaultSourceDeclarationOwnershipLimits, maximumTransportRows: 1 });
  assert.equal(rows.createRows(current.call).add(2), false, "no partial row reservation");
  assert.equal(rows.failure().cause.kind === "resource-limit" && rows.failure().cause.category === "row" &&
    rows.failure().cause.limit === 1, true, "typed actual row limit");
  const invalid = createSourceDeclarationOwnershipBudget(current.call, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: Infinity });
  assert.equal(invalid.failure().cause.kind === "invalid-input", true, "an invalid requested limit is not exhaustion");
  assert.equal(sourceDeclarationOwnershipUnresolved(current.call, "missing native premise").cause.kind === "required-fact", true,
    "missing native evidence has a distinct cause");
});
