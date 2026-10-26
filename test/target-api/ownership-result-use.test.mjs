import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceContinuationDependencyQuery, createSourceContinuationTransfer, createSourceSuspensionQuery,
  createSourceStorageBudget, createSourceStorageQuery, defaultSourceStorageLimits,
  decideSourceAsyncResultUse, resolveSourceAsyncResultDisposition } from "../../packages/target-api/dist/public/analysis.js";
import { ownershipFixture } from "./ownership-fixture.mjs";

const fixture = ownershipFixture();

function dependencyFor(owner, native = fixture.native) {
  const { source, storage, budget } = fixture;
  const transfer = createSourceContinuationTransfer(budget);
  const call = fixture.readCall(owner);
  const bindings = fixture.invocationBindings(call);
  const suspensions = createSourceSuspensionQuery({ source, storage, budget, premises: native });
  const suspension = suspensions.forAwait(fixture.awaitNode(fixture.declaration("read")), bindings);
  assert.equal(suspension.kind === "resolved", true, "native pending guarantee");
  const state = transfer.suspend(transfer.lattice.empty(), suspension.pending);
  assert.equal(state !== undefined, true, "bounded suspension transfer");
  const selected = createSourceContinuationDependencyQuery({ source, storage, budget, premises: native, transfer, suspensions })
    .forRead(state, fixture.readReference(), fixture.declaration("read"), bindings);
  assert.equal(selected.kind === "resolved", true, "actual bound continuation dependency");
  transfer.release();
  return selected;
}

for (const surface of ["csharp", "rust"]) {
  for (const [name, expected] of [["awaited", "admitted"], ["discarded", "rejected"], ["stored", "rejected"],
    ["returned", "rejected"], ["forwarded", "admitted"], ["forwardedAsserted", "admitted"], ["passedToStorage", "rejected"]]) {
    test(`${surface}: the identical source-bound lease has the shared ${name} decision`, () => {
      const owner = fixture.declaration(name);
      const call = fixture.readCall(owner);
      const disposition = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
      const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call), disposition,
        continuation: () => dependencyFor(owner),
        retention: () => assert.fail("the complete continuation already supplies its exact leases") });
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
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call, "must-observe"),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
    continuation: () => ({ kind: "unresolved", at: call, reason: "The shared CFG adapter has not supplied continuation closure." }),
    retention: () => assert.fail("the implicit native discard rule precedes retention lookup") });
  assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true);
  assert.equal(selected.diagnostic?.code, "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED");
});

test("D11 marks a discarded completed owning computation without a new runtime representation", () => {
  const call = fixture.readCall(fixture.declaration("discarded"));
  const dependency = dependencyFor(fixture.declaration("discarded"), { ...fixture.native,
    retentionFor(request) {
      if (request.kind === "read-value") return undefined;
      const { value } = request;
      const selected = fixture.native.retentionFor(request);
      return { kind: "resolved", premises: selected.premises.map(premise => ({ kind: "retained", value,
        reason: "owned-value", checkedType: premise.checkedType, contractDeclaration: premise.contractDeclaration })) };
    } });
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget), continuation: () => dependency,
    retention: () => assert.fail("the complete owning continuation already supplies its exact leases") });
  assert.equal(selected.kind === "resolved" && selected.decision === "observe-discarded-rejection", true);
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained"), true);
  assert.equal(selected.diagnostic === undefined, true, "observation is a sealed mark, not an ownership rejection");
});

test("missing continuation proof remains unresolved, never an empty borrowed-input success", () => {
  for (const name of ["awaited", "discarded", "stored", "returned"]) {
    const call = fixture.readCall(fixture.declaration(name));
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
      continuation: () => ({ kind: "unresolved", at: call, reason: "The shared CFG owner has not closed the continuation." }),
      retention: () => ({ kind: "unresolved", at: call, reason: "No native retention premise describes this call." }) });
    assert.equal(selected.kind, "unresolved", name);
    assert.match(selected.reason, /shared CFG/u);
  }
});

test("passing to an asynchronous consumer is not proof of an await in the caller's region", () => {
  // The disposition records the pass; the result-use decision refuses it for a borrowed lease.
  const owner = fixture.declaration("passedToAsync");
  const call = fixture.readCall(owner);
  const disposition = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
  assert.equal(disposition.kind, "passed");
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call), disposition,
    continuation: () => dependencyFor(owner),
    retention: () => assert.fail("the complete consumer continuation already supplies its exact leases") });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /source-scoped consumer/u);
});

test("result disposition rejects a different checked source owner before reading its storage", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const selected = resolveSourceAsyncResultDisposition({ ...fixture.source }, fixture.storage, call, fixture.budget);
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /identical checked source program/u);
});

test("the awaited lease must contain the actual await, not only the callee's body", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const proof = dependencyFor(fixture.declaration("awaited"));
  const continuation = { kind: "resolved", dependencies: proof.dependencies.map(item => ({ ...item,
    retention: { ...item.retention, region: fixture.source.ast.body(fixture.declaration("returned")) } })) };
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget), continuation: () => continuation,
    retention: () => assert.fail("the complete scoped continuation already supplies its exact leases") });
  assert.equal(selected.kind, "unresolved");
  assert.match(selected.reason, /valid region/u);
});

test("selected completion contracts reject foreign declarations and incompatible checked types", () => {
  const call = fixture.readCall(fixture.declaration("awaited"));
  const completion = fixture.completion(call);
  const disposition = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
  for (const replacement of [{ contractDeclaration: fixture.declaration("identity") },
    { checkedType: fixture.source.semantics.forNode(call).types.expressionType(fixture.source.ast.arguments(call)[0]) }]) {
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: { ...completion, ...replacement },
      disposition, continuation: () => ({ kind: "resolved", dependencies: [] }),
      retention: () => assert.fail("a malformed selected completion cannot request retention lookup") });
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
  const storage = createSourceStorageQuery(source, source.navigation.sourceFiles, defaultSourceStorageLimits);
  const budget = createSourceStorageBudget(defaultSourceStorageLimits);
  const completion = { kind: "async", resultPolicy: "observe-rejection",
    contractDeclaration: declaration, checkedType: selected.sourceResultType };
  const decide = contract => decideSourceAsyncResultUse({ source, storage, budget, call, completion: contract,
    disposition: resolveSourceAsyncResultDisposition(source, storage, call, budget),
    continuation: () => ({ kind: "resolved", dependencies: [] }),
    retention: () => assert.fail("the exact empty continuation needs no retention substitution") });
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
  const rejected = decide({ ...completion, contractDeclaration: foreignDeclaration });
  assert.equal(rejected.kind, "unresolved", "a foreign same-URI declaration cannot authorize completion");
  assert.match(rejected.reason, /selected declaration/u);
  const unrelated = source.ast.statements(providerFile)[1];
  const mismatched = decide({ ...completion, contractDeclaration: unrelated });
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
    const selected = resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget);
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
    const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
      disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
      continuation: () => dependencyFor(fixture.declaration(name), native),
      retention: () => assert.fail("the complete mutable continuation already supplies its exact leases") });
    assert.equal(selected.kind, "resolved", name);
    assert.equal(selected.decision, name === "awaited" ? "admitted" : "rejected", name);
    assert.equal(selected.dependencies.every(item => item.retention.mode === "mutable"), true);
  }
});

test("a program-duration native owner does not create a D12 storage prohibition", () => {
  const owner = fixture.declaration("moduleStored");
  const call = fixture.readCall(owner);
  const selected = decideSourceAsyncResultUse({ ...fixture, call, completion: fixture.completion(call),
    disposition: resolveSourceAsyncResultDisposition(fixture.source, fixture.storage, call, fixture.budget),
    continuation: () => dependencyFor(owner),
    retention: () => assert.fail("the complete program-duration continuation already supplies its exact leases") });
  assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true);
  assert.equal(selected.disposition.kind, "stored");
  assert.equal(selected.dependencies.every(item => item.retention.kind === "retained" && item.retention.reason === "module-owner"), true);
});
