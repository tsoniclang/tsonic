import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceDeclarationContinuationDependencyQuery, createSourceContinuationTransfer, createSourceDeclarationSuspensionQuery,
  createSourceDeclarationRetentionQuery, createSourceDeclarationOwnershipBudget, createSourceDeclarationOwnershipValues,
  defaultSourceDeclarationOwnershipLimits,
  decideSourceDeclarationAsyncResultUse, resolveSourceDeclarationAsyncResultDisposition } from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();
const dispositionFor = call => resolveSourceDeclarationAsyncResultDisposition({ source: fixture.source, expression: call,
  budget: fixture.budget, regionFor: fixture.values.regionFor });

function dependencyFor(owner, native = fixture.native) {
  const { source, values, budget } = fixture;
  const transfer = createSourceContinuationTransfer(fixture.transferBudget);
  const call = fixture.readCall(owner);
  const reference = source.ast.arguments(call)[0];
  const suspensions = createSourceDeclarationSuspensionQuery({ source, values, budget, premises: native });
  const suspension = suspensions.forAwait(fixture.awaitNode(fixture.declaration("read")));
  assert.equal(suspension.kind === "resolved", true, "native pending guarantee");
  const state = transfer.suspend(transfer.lattice.empty(), suspension.pending);
  assert.equal(state !== undefined, true, "bounded suspension transfer");
  const retention = createSourceDeclarationRetentionQuery({ source, values, budget, premises: native });
  const selected = createSourceDeclarationContinuationDependencyQuery({ source, budget, retention, suspensions })
    .forRead(state, reference, owner);
  assert.equal(selected.kind === "resolved", true, "actual checked-read continuation dependency");
  transfer.release();
  return selected;
}

for (const surface of ["csharp", "rust"]) {
  for (const [name, expected] of [["awaited", "admitted"], ["discarded", "rejected"], ["stored", "rejected"],
    ["returned", "rejected"], ["forwarded", "admitted"], ["forwardedAsserted", "admitted"], ["passedToStorage", "rejected"]]) {
    test(`${surface}: the identical source-bound lease has the shared ${name} decision`, () => {
      const owner = fixture.declaration(name);
      const call = fixture.readCall(owner);
      const disposition = dispositionFor(call);
      const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call), disposition,
        continuation: () => dependencyFor(owner) });
      assert.equal(selected.kind, "resolved", `${name}: complete shared proof`);
      assert.equal(selected.decision, expected, name);
      assert.equal(selected.dependencies.length > 0, true, "a real continuation lease was preserved");
      assert.equal(selected.dependencies.every(item => item.retention.kind === "scoped-borrowed"), true);
      assert.equal(selected.diagnostic?.code, expected === "rejected" ? "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" : undefined);
      assert.equal(Object.isFrozen(selected), true);
      if (name === "awaited" || name === "forwarded" || name === "forwardedAsserted") assert.equal(selected.disposition.completionReturned, true);
      if (name === "stored") assert.equal(selected.disposition.kind, "stored", "a later await does not erase Promise storage");
    });
  }
}

test("native discarded async values reject independently of an unresolved continuation", () => {
  const call = fixture.readCall(fixture.declaration("discarded"));
  const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call, "must-observe"),
    disposition: dispositionFor(call),
    continuation: () => ({ kind: "unresolved", at: call, reason: "The shared CFG adapter has not supplied continuation closure." }) });
  assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true);
  assert.equal(selected.diagnostic?.code, "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED");
});

test("D11 marks a discarded completed owning computation without a new runtime representation", () => {
  const call = fixture.readCall(fixture.declaration("discarded"));
  const dependency = dependencyFor(fixture.declaration("discarded"), { ...fixture.native,
    retentionFor(request) {
      const { value } = request;
      const selected = fixture.native.retentionFor(request);
      return { kind: "resolved", premises: selected.premises.map(premise => ({ kind: "retained", value,
        reason: "owned-value", contract: premise.contract })) };
    } });
  const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: dispositionFor(call), continuation: () => dependency });
  assert.equal(selected.kind === "resolved" && selected.decision === "observe-discarded-rejection", true);
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained"), true);
  assert.equal(selected.diagnostic === undefined, true, "observation is a sealed mark, not an ownership rejection");
});

test("missing continuation proof remains unresolved, never an empty borrowed-input success", () => {
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const call = fixture.readCall(fixture.declaration(name));
    const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: dispositionFor(call),
      continuation: () => ({ kind: "unresolved", at: call, reason: "The shared CFG owner has not closed the continuation." }) });
    assert.equal(selected.kind, "unresolved", name);
    assert.match(selected.reason, /shared CFG/u);
  }
});

test("passing to an asynchronous consumer is not proof of an await in the caller's region", () => {
  const owner = fixture.declaration("passedToAsync");
  const call = fixture.readCall(owner);
  const disposition = dispositionFor(call);
  assert.equal(disposition.kind, "passed");
  const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call), disposition,
    continuation: () => dependencyFor(owner) });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /caller's exact borrowed-input lifetime/u);
});

test("result disposition rejects a different checked source owner before reading its storage", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const foreign = ownershipFixture();
  const selected = resolveSourceDeclarationAsyncResultDisposition({ source: fixture.source,
    expression: foreign.readCall(foreign.declaration("awaited")), budget: fixture.budget,
    regionFor: fixture.values.regionFor });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /original checked declaration-local expression/u);
});

test("the awaited lease must contain the actual await, not only the callee's body", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const proof = dependencyFor(fixture.declaration("awaited"));
  const continuation = { kind: "resolved", dependencies: proof.dependencies.map(item => ({ ...item,
    retention: { ...item.retention, region: fixture.source.ast.body(fixture.declaration("returned")) } })) };
  const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: dispositionFor(call), continuation: () => continuation });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /same checked region and native lease owner/u);
});

test("selected completion contracts reject foreign declarations and incompatible checked types", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const completion = fixture.completion(call);
  const disposition = dispositionFor(call);
  for (const contract of [{ ...completion.contract, declaration: fixture.declaration("identity") },
    { ...completion.contract, component: { selectedType: fixture.source.semantics.forNode(call).types.expressionType(fixture.source.ast.arguments(call)[0]) } }]) {
    const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: { ...completion, contract },
      disposition, continuation: () => ({ kind: "resolved", dependencies: [] }) });
    assert.equal(selected.kind, "unresolved", "a checked type or declaration mismatch cannot authorize a policy");
  }
});

test("selected completion contracts retain checked dependency identity without exposing its body", () => {
  const files = {
    "/src/index.ts": `import { pending } from "./provider.js";
      export async function run(): Promise<number> { return await pending(); }`,
    "/src/provider.d.ts": `export declare function pending(): Promise<number>;
      export declare function unrelated(): Promise<number>;`,
  };
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0,
    formatDiagnostics(checked.diagnostics.filter(item => item !== undefined)).slice(0, 2048));
  const source = createTargetSourceProgram({ ...checked,
    sourceFiles: checked.sourceFiles.filter(file => file !== undefined && !checked.ast.isDeclarationFile(file)) });
  const file = checked.getSourceFile("/src/index.ts");
  const nodes = [];
  const visit = node => {
    nodes.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const call = nodes.find(node => source.ast.is.IsCallExpression(node));
  assert.equal(call !== undefined, true, "the original source call is checked");
  const semantics = source.semantics.forNode(call);
  const selected = semantics.operations.call(call);
  assert.equal(selected?.sourceSelectedSignatureKind, "resolved", "the call owns its actual selected signature");
  const declaration = semantics.declarations.signatureDeclaration(selected.selectedSignature);
  const providerFile = source.ast.getSourceFile(declaration);
  assert.equal(checked.containsSourceFile(providerFile), true, "the hidden declaration belongs to the exact SDK program");
  assert.equal(source.semantics.includes(providerFile), false, "provider bodies are not added to emitted-source traversal");
  assert.equal(source.sourceFiles.length, 1, "only the original project source is exposed");
  const budget = createSourceDeclarationOwnershipBudget(file, defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const completion = { kind: "async", resultPolicy: "observe-rejection",
    contract: { kind: "declaration", declaration, component: { selectedType: selected.sourceResultType } } };
  const decide = contract => decideSourceDeclarationAsyncResultUse({ source, budget, call, completion: contract,
    disposition: resolveSourceDeclarationAsyncResultDisposition({ source, expression: call, budget, regionFor: context.values.regionFor }),
    continuation: () => ({ kind: "resolved", dependencies: [] }) });
  const admitted = decide(completion);
  assert.equal(admitted.kind === "resolved" && admitted.decision === "admitted", true,
    "the actual selected dependency declaration authorizes its completion contract");
  const foreign = createCompilerSessionFromFiles({ currentDirectory: "/src", files,
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  const foreignProvider = foreign.getSourceFile("/src/provider.d.ts");
  const foreignDeclaration = foreign.ast.statements(foreignProvider)[0];
  assert.equal(source.ast.getFileName(providerFile), foreign.ast.getFileName(foreignProvider),
    "foreign evidence deliberately reuses the identical source URI");
  assert.equal(declaration === foreignDeclaration, false, "the foreign declaration has a different original node");
  const rejected = decide({ ...completion, contract: { ...completion.contract, declaration: foreignDeclaration } });
  assert.equal(rejected.kind, "unresolved", "a foreign same-URI declaration cannot authorize completion");
  assert.match(rejected.reason, /selected declaration/u);
  const unrelated = source.ast.statements(providerFile)[1];
  const mismatched = decide({ ...completion, contract: { ...completion.contract, declaration: unrelated } });
  assert.equal(mismatched.kind, "unresolved", "another real declaration in the same checked program remains invalid");
  assert.match(mismatched.reason, /selected declaration/u);
});

test("all four historically observed scoped source call shapes stay immediately awaited", () => {
  const historical = fixture.declaration("historicalScoped");
  const generic = fixture.declaration("genericForward");
  const calls = [...fixture.calls(historical), ...fixture.calls(generic)].filter(call => {
    const parent = fixture.source.ast.parent(call);
    return parent !== undefined && fixture.source.ast.is.IsAwaitExpression(parent);
  });
  assert.equal(calls.length, 4, "two receivers and both generic forwards, not generic declaration counts");
  for (const call of calls) {
    const selected = dispositionFor(call);
    assert.equal(selected.kind, "awaited-in-scope", "a temporary native receiver borrow cannot change source result use");
  }
});

test("mutable source leases obey the same scoped-await and escape decision as shared leases", () => {
  const native = { ...fixture.native, retentionFor(request) {
    if (request.kind === "read-value") return undefined;
    const selected = fixture.native.retentionFor(request);
    return { kind: "resolved", premises: selected.premises.map(premise => ({ ...premise, mode: "mutable" })) };
  } };
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const call = fixture.readCall(fixture.declaration(name));
    const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: dispositionFor(call),
      continuation: () => dependencyFor(fixture.declaration(name), native) });
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.decision, name === "awaited" ? "admitted" : "rejected", name);
    assert.equal(selected.dependencies.every(item => item.retention.mode === "mutable"), true);
  }
});

test("a program-duration native owner does not create a D12 storage prohibition", () => {
  const owner = fixture.declaration("moduleStored");
  const call = fixture.readCall(owner);
  const selected = decideSourceDeclarationAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: dispositionFor(call),
    continuation: () => dependencyFor(owner) });
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true);
  assert.equal(selected.disposition.kind, "stored");
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained" && item.retention.reason === "module-owner"), true);
});
