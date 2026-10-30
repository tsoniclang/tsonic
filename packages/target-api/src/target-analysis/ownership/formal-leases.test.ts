import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../source-semantics/target-source-program.js";
import { createSourceStorageQuery } from "../source-storage/queries.js";
import { defaultSourceStorageLimits } from "../source-storage/model/resource-budget.js";
import { createSourceDeclarationOwnershipBudget, defaultSourceDeclarationOwnershipLimits,
  createSourceDeclarationParameterUseQuery } from "./contracts.js";
import { createSourceDeclarationOwnershipQuery } from "./query.js";
import { createSourceControlFlowDomain } from "../flow/graph.js";
import { createSourceDeclarationOwnershipValues } from "./flow.js";
import { createSourceDeclarationRetentionQuery } from "./retention.js";
import { decideSourceDeclarationAsyncResultUse } from "./result-decision.js";
import { resolveSourceDeclarationAsyncResultDisposition } from "./result-use.js";
import type { SourceDeclarationOwnershipPremises, SourceDeclarationRetentionPremise,
  SourceDeclarationRetentionReadSelection } from "./model.js";

function fixture(kind: "input-duration" | "type-argument",
  amend: (premise: SourceDeclarationRetentionPremise) => SourceDeclarationRetentionPremise = premise => premise,
  extraSource = "") {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `
    interface Lease<Value, Region> { readonly value: Value; readonly region: Region; }
    declare function pending(): Promise<void>;
    declare function read<Value, Region>(value: Lease<Value, Region>): Value;
    async function keep<Region>(value: Lease<number, Region>): Promise<number> {
      await pending(); return read(value);
    }
    async function immediate<Region>(value: Lease<number, Region>) { return await keep(value); }
    async function escaped<Region>(value: Lease<number, Region>) {
      keep(value); const stored = keep(value); return stored;
    }
    async function independent(): Promise<number> { return 7; }
    function ownedRoot(): void { independent(); }
    async function consume(value: Promise<number>): Promise<void> { await value; }
    function passedRoot(): void { void consume(independent()); }
    function receiverRoot(): void { independent().then(() => 0); }
    ${extraSource}
  ` }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true,
    formatDiagnostics(checked.diagnostics.filter(diagnostic => diagnostic !== undefined).slice(0, 4)).slice(0, 1024));
  const source = createTargetSourceProgram(checked);
  const nodes = source.navigation.nodes;
  const storage = createSourceStorageQuery(source, source.sourceFiles, defaultSourceStorageLimits, {
    call(node, selected) {
      const declaration = source.semantics.forNode(node).declarations.signatureDeclaration(selected.selectedSignature);
      return declaration !== undefined && source.ast.is.IsFunctionDeclaration(declaration) && source.ast.body(declaration) === undefined
        ? { resultAllocation: node } : undefined;
    },
  });
  const budget = createSourceDeclarationOwnershipBudget(nodes[0]!, defaultSourceDeclarationOwnershipLimits);
  const context = createSourceDeclarationOwnershipValues({ source, nodes, budget, limits: {} });
  const parameterUses = createSourceDeclarationParameterUseQuery({ source, budget });
  const declaration = (name: string): Node => {
    const selected = nodes.find(node => source.ast.is.IsFunctionDeclaration(node) &&
      source.ast.text(source.ast.name(node)) === name);
    assert.equal(selected !== undefined, true, name);
    return selected!;
  };
  const selectedDeclaration = (node: Node): Node | undefined => {
    if (!source.ast.is.IsCallExpression(node)) return undefined;
    const semantics = source.semantics.forNode(node);
    const selected = semantics.operations.call(node);
    return selected?.sourceSelectedSignatureKind === "resolved"
      ? semantics.declarations.signatureDeclaration(selected.selectedSignature) : undefined;
  };
  const premises: SourceDeclarationOwnershipPremises = {
    completionFor(call, selected) {
      const owner = selectedDeclaration(call);
      return owner !== undefined && source.ast.hasModifierKind(owner, "async")
        ? { kind: "async", resultPolicy: "observe-rejection",
            contract: { kind: "declaration", declaration: owner,
              component: { selectedType: selected.sourceResultType, contextualCall: selected } } }
        : { kind: "not-async" };
    },
    suspensionFor(value) {
      const owner = selectedDeclaration(value.node);
      return { kind: owner === declaration("pending") || owner !== undefined && source.ast.hasModifierKind(owner, "async")
          ? "may-suspend" : "never", value,
        contract: { kind: "expression", expression: value.node, component: value.component } };
    },
    retentionFor({ value }) {
      const semantics = source.semantics.forNode(value.node);
      const call = source.ast.is.IsCallExpression(value.node) ? semantics.operations.call(value.node) : undefined;
      const nativeResult = selectedDeclaration(value.node) === declaration("keep") && call?.sourceSelectedSignatureKind === "resolved";
      const reference = source.navigation.sourceReferenceFor(value.node)?.declaration;
      const formal = nativeResult ? source.ast.parameters(declaration("keep"))[0]
        : source.ast.is.IsParameterDeclaration(value.node) ? value.node
        : reference !== undefined && source.ast.is.IsParameterDeclaration(reference) ? reference : undefined;
      const contract = { kind: "expression" as const, expression: value.node, component: value.component };
      if (formal === undefined) return { kind: "resolved", premises: [{ kind: "retained",
        value, reason: "owned-value", contract }] };
      const owner = nativeResult ? declaration("keep") : source.ast.parent(formal)!;
      const regionDeclaration = source.ast.typeParameters(value.region.owner)[0];
      const direct = nativeResult ? call.sourceSelectedMethodTypeArguments?.[0] : undefined;
      const binding = direct === undefined ? semantics.types.typeArgumentBindings(value.component.selectedType)?.find(argument => {
        const symbol = semantics.declarations.typeSymbol(argument.argumentType);
        return symbol !== undefined && semantics.declarations.symbolDeclarations(symbol).includes(regionDeclaration!);
      }) : { declaration: source.ast.typeParameters(owner)[0]!, parameterType: direct.typeParameter,
        argumentType: direct.selectedType, scope: "local" as const };
      assert.equal(kind !== "type-argument" || binding !== undefined && regionDeclaration !== undefined, true,
        "exact native formal-region substitution");
      const premise: SourceDeclarationRetentionPremise = { kind: "formal-borrowed", value, executionOwner: owner, mode: "shared",
        region: kind === "input-duration" ? { kind, parameter: formal }
          : { kind, binding: binding!, declaration: regionDeclaration! }, contract };
      return { kind: "resolved", premises: [amend(premise)] };
    },
  };
  const query = createSourceDeclarationOwnershipQuery({ source, nodes, budget, premises });
  const calls = nodes.filter(node => source.ast.is.IsCallExpression(node) && selectedDeclaration(node) === declaration("keep"));
  assert.equal(calls.length, 3, "all actual result-use demands");
  return { source, nodes, storage, budget, context, values: context.values, parameterUses, premises, query,
    declaration, selectedDeclaration, calls };
}

test("native read erasure omits only its selected callee and preserves the real suspended formal lease", () => {
  const current = fixture("type-argument");
  const erased = new Set(current.storage.nodes.filter(node => {
    if (!current.source.ast.is.IsIdentifier(node)) return false;
    const call = current.source.ast.parent(node);
    return call !== undefined && current.source.ast.is.IsCallExpression(call) &&
      current.selectedDeclaration(call) === current.declaration("read") &&
      current.source.semantics.forNode(call).operations.call(call)?.sourceCallee.expression === node;
  }));
  assert.equal(erased.size, 1, "the selected native load has one original callee reference");
  const premises: SourceDeclarationOwnershipPremises = { ...current.premises, retentionFor(request) {
    if (request.kind === "read-value" && erased.has(request.reference) ||
      request.kind === "value" && request.value.node === current.declaration("read"))
      return { kind: "unresolved", cause: { kind: "required-fact" }, at: request.value.node, reason: "A lowered native callee has no runtime value storage." };
    return current.premises.retentionFor(request);
  } };
  const source = createSourceDeclarationOwnershipQuery({ ...current, premises });
  assert.equal(source.continuationFor(current.calls[1]!).kind, "unresolved", "the source domain still requires the callee read");
  const selected = createSourceControlFlowDomain(current.source, current.storage.nodes.filter(node => !erased.has(node)));
  assert.equal(selected.kind, "resolved", "the native read inventory retains original checked parent and child identities");
  if (selected.kind !== "resolved") return;
  const runtime = createSourceDeclarationOwnershipQuery({ ...current, premises, nodes: current.nodes.filter(node => !erased.has(node)) });
  const continuation = runtime.continuationFor(current.calls[1]!);
  assert.equal(continuation.kind === "resolved", true,
    continuation.kind === "unresolved" ? continuation.reason : "native continuation closes");
  if (continuation.kind !== "resolved") return;
  assert.equal(continuation.dependencies.some(dependency => dependency.retention.kind === "formal-borrowed"), true,
    "the native operand's actual formal borrow is still retained across the await");
  const decision = runtime.forCall(current.calls[1]!);
  assert.equal(decision.kind === "resolved" && decision.decision === "rejected" &&
    decision.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES", true,
  decision.kind === "unresolved" ? decision.reason : "erased function references never admit the borrowed result");
});

for (const kind of ["input-duration", "type-argument"] as const) {
  test(`actual owned completion evidence preserves passed and receiver uses beside ${kind} lease negatives`, () => {
    const current = fixture(kind);
    const calls = current.storage.invocations.filter(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === current.declaration("independent"));
    assert.equal(calls.length, 3, "discarded, passed and receiver-consumed uses retain their exact source calls");
    for (const [index, call] of calls.entries()) {
      const selected = current.query.forCall(call);
      assert.equal(selected.kind === "resolved", true,
        selected.kind === "unresolved" ? selected.reason : `owned result ${index} resolves`);
      if (selected.kind !== "resolved") continue;
      assert.equal(selected.decision, index === 0 ? "observe-discarded-rejection" : "admitted",
        `owned result ${index} requires no invented source borrow`);
      assert.equal(selected.disposition.kind, ["discarded", "passed", "consumed"][index],
        `owned result ${index} preserves its actual selected use`);
      const unknown = { kind: "unresolved" as const, cause: { kind: "required-fact" as const }, at: call, reason: "No completed native or source retention evidence." };
      const checked = current.source.semantics.forNode(call).operations.call(call);
      assert.equal(checked?.sourceSelectedSignatureKind === "resolved", true, "actual selected source call");
      if (checked?.sourceSelectedSignatureKind !== "resolved") continue;
      const completion = current.premises.completionFor(call, checked);
      for (const retention of [unknown, { kind: "resolved" as const, reference: call, premises: [] }]) {
        const rejected = decideSourceDeclarationAsyncResultUse({ ...current, call, completion, disposition: selected.disposition,
          continuation: () => retention.kind === "unresolved" ? retention : unknown, retention: () => retention });
        assert.equal(rejected.kind === "unresolved", true,
          `${selected.disposition.kind}: use syntax does not replace unknown or empty retention evidence`);
      }
    }
    for (const call of current.calls.slice(1)) {
      const selected = current.query.forCall(call);
      assert.equal(selected.kind === "resolved" && selected.decision === "rejected", true,
        "owned results never erase the independent real formal-lease rejections");
    }
  });

  test(`a checked ${kind} formal lease admits the actual immediate await and rejects both escaping calls`, () => {
    const current = fixture(kind);
    const decisions = current.calls.map(call => current.query.forCall(call));
    assert.equal(decisions[0]?.kind === "resolved" && decisions[0].decision === "admitted", true,
      decisions[0]?.kind === "unresolved" ? decisions[0].reason : "immediate await keeps the exact formal execution");
    for (const [index, call] of current.calls.entries()) {
      if (index === 0) continue;
      const selected = decisions[index];
      assert.equal(selected?.kind === "resolved" && selected.decision === "rejected" &&
        selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && selected.diagnostic.at === call,
      true, selected?.kind === "unresolved" ? selected.reason : `escaping actual demand ${index}`);
    }
  });
}

test("formal-region admission rejects foreign owners, parameters and region declarations", () => {
  for (const wrong of ["owner", "parameter", "region"] as const) {
    let foreign: ReturnType<typeof fixture>;
    const current = fixture("type-argument", premise => {
      if (premise.kind !== "formal-borrowed") return premise;
      if (wrong === "owner") return { ...premise, executionOwner: foreign.declaration("keep") };
      if (wrong === "parameter") return { ...premise, region: { kind: "input-duration",
        parameter: foreign.source.ast.parameters(foreign.declaration("keep"))[0]! } };
      return { ...premise, region: premise.region.kind === "type-argument"
        ? { ...premise.region, declaration: foreign.source.ast.typeParameters(foreign.declaration("keep"))[0]! }
        : premise.region };
    });
    foreign = fixture("type-argument");
    const selected = current.query.forCall(current.calls[1]!);
    assert.equal(selected.kind, "unresolved", `${wrong}: no copied or foreign formal evidence`);
  }
});

test("the native result-use owner admits explicit void only after actual continuation ownership", () => {
  const current = fixture("input-duration", premise => premise, "function explicitRoot(): void { void (independent()); }");
  const premises: SourceDeclarationOwnershipPremises = {
    ...current.premises,
    completionFor(call, selected) {
      const completion = current.premises.completionFor(call, selected);
      return completion.kind === "async" ? { ...completion, resultPolicy: "must-observe" } : completion;
    },
  };
  const calls = current.storage.invocations.filter(call => current.source.ast.is.IsCallExpression(call) &&
    current.selectedDeclaration(call) === current.declaration("independent"));
  const selected = calls.map(call => ({ call,
    disposition: resolveSourceDeclarationAsyncResultDisposition({ source: current.source, expression: call, budget: current.budget,
      regionFor: current.values.regionFor, parameterUses: current.parameterUses }) }));
  const explicit = selected.find(value => value.disposition.kind === "discarded" &&
    current.source.ast.is.IsVoidExpression(value.disposition.use));
  const implicit = selected.find(value => value.disposition.kind === "discarded" &&
    !current.source.ast.is.IsVoidExpression(value.disposition.use));
  assert.equal(explicit !== undefined && implicit !== undefined, true, "both actual source discard forms remain distinct");
  if (explicit === undefined || implicit === undefined) throw new Error("missing checked discard forms");
  const completionFor = (call: Node) => {
    const selected = current.source.semantics.forNode(call).operations.call(call);
    assert.equal(selected?.sourceSelectedSignatureKind === "resolved", true, "the actual native completion contract");
    if (selected?.sourceSelectedSignatureKind !== "resolved") throw new Error("missing checked completion contract");
    return premises.completionFor(call, selected);
  };
  let continuationReads = 0;
  let retentionReads = 0;
  const unknown = { kind: "unresolved" as const, cause: { kind: "required-fact" as const }, at: explicit.call, reason: "No completed continuation ownership." };
  const rejected = decideSourceDeclarationAsyncResultUse({ ...current, call: implicit.call, completion: completionFor(implicit.call),
    disposition: implicit.disposition,
    continuation: () => { continuationReads += 1; return unknown; },
    retention: () => { retentionReads += 1; return unknown; } });
  assert.equal(rejected.kind === "resolved" && rejected.decision === "rejected" &&
    rejected.diagnostic.code === "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", true,
  "an implicit native drop keeps its precise refusal independently of unknown continuation ownership");
  assert.equal(continuationReads, 0, "the result-use owner refuses implicit native discard before asking for continuation ownership");
  assert.equal(retentionReads, 0, "the result-use owner does not request irrelevant retention on that refusal");
  const unresolved = decideSourceDeclarationAsyncResultUse({ ...current, call: explicit.call, completion: completionFor(explicit.call),
    disposition: explicit.disposition,
    continuation: () => { continuationReads += 1; return unknown; },
    retention: () => { retentionReads += 1; return unknown; } });
  assert.equal(unresolved.kind === "unresolved" && unresolved.reason === unknown.reason, true,
    "explicit void is not an ownership waiver when both continuation and retention remain unknown");
  assert.equal(continuationReads, 1, "an explicit native discard requests its actual continuation evidence");
  assert.equal(retentionReads, 1, "unknown continuation requests the independent retained-origin evidence");
  const query = createSourceDeclarationOwnershipQuery({ ...current, premises });
  const admitted = query.forCall(explicit.call);
  assert.equal(admitted.kind === "resolved" && admitted.decision === "discard-native-result", true,
    admitted.kind === "unresolved" ? admitted.reason : "actual checked owned explicit void remains supported");
  const implicitDecision = query.forCall(implicit.call);
  assert.equal(implicitDecision.kind === "resolved" && implicitDecision.decision === "rejected" &&
    implicitDecision.diagnostic.code === "TSONIC_NATIVE_ASYNC_RESULT_DISCARDED", true,
  "the composed query preserves the independent native implicit-discard rule");
});

test("native discard and provider rejection observation remain distinct selected actions", () => {
  const current = fixture("input-duration", premise => premise, "function explicitRoot(): void { void (independent()); }");
  const calls = current.storage.invocations.filter(call => current.source.ast.is.IsCallExpression(call) &&
    current.selectedDeclaration(call) === current.declaration("independent"));
  const discarded = calls.filter(call =>
    resolveSourceDeclarationAsyncResultDisposition({ source: current.source, expression: call, budget: current.budget,
      regionFor: current.values.regionFor, parameterUses: current.parameterUses }).kind === "discarded");
  assert.equal(discarded.length, 2, "the implicit and explicit owned result uses both remain present");
  for (const policy of ["native-discard", "observe-rejection"] as const) {
    const premises: SourceDeclarationOwnershipPremises = {
      ...current.premises,
      completionFor(call, selected) {
        const completion = current.premises.completionFor(call, selected);
        return completion.kind === "async" ? { ...completion, resultPolicy: policy } : completion;
      },
    };
    const query = createSourceDeclarationOwnershipQuery({ ...current, premises });
    for (const call of discarded) {
      const selected = query.forCall(call);
      assert.equal(selected.kind === "resolved", true, selected.kind === "unresolved" ? selected.reason : policy);
      assert.equal(selected.kind === "resolved" && selected.decision ===
        (policy === "native-discard" ? "discard-native-result" : "observe-discarded-rejection"), true,
      `${policy}: a native discard is never relabelled as provider rejection observation`);
      assert.equal(selected.kind === "resolved" && selected.dependencies.length === 0, true,
        `${policy}: the actual independent body introduces no invented lease`);
      const contract = current.source.semantics.forNode(call).operations.call(call);
      assert.equal(contract?.sourceSelectedSignatureKind === "resolved", true, `${policy}: exact selected source call`);
      if (contract?.sourceSelectedSignatureKind !== "resolved") throw new Error("missing checked discard contract");
      const unknown = { kind: "unresolved" as const, cause: { kind: "required-fact" as const }, at: call, reason: "No completed native continuation or retention." };
      const unresolved = decideSourceDeclarationAsyncResultUse({ ...current, call,
        completion: premises.completionFor(call, contract),
        disposition: resolveSourceDeclarationAsyncResultDisposition({ source: current.source, expression: call, budget: current.budget,
          regionFor: current.values.regionFor, parameterUses: current.parameterUses }),
        continuation: () => unknown, retention: () => unknown });
      assert.equal(unresolved.kind === "unresolved" && unresolved.reason === unknown.reason, true,
        `${policy}: an admitted native discard policy is not a fabricated ownership proof`);
    }
  }
});

for (const kind of ["input-duration", "type-argument"] as const) {
  test(`native discard preserves the actual ${kind} await and rejects both borrowed escapes`, () => {
    const current = fixture(kind);
    const premises: SourceDeclarationOwnershipPremises = {
      ...current.premises,
      completionFor(call, selected) {
        const completion = current.premises.completionFor(call, selected);
        return completion.kind === "async" ? { ...completion, resultPolicy: "native-discard" } : completion;
      },
    };
    const query = createSourceDeclarationOwnershipQuery({ ...current, premises });
    for (const [index, call] of current.calls.entries()) {
      const selected = query.forCall(call);
      if (index === 0) {
        assert.equal(selected.kind === "resolved" && selected.decision === "admitted", true,
          selected.kind === "unresolved" ? selected.reason : `${kind}: the actual caller await remains in scope`);
      } else {
        assert.equal(selected.kind === "resolved" && selected.decision === "rejected" &&
          selected.diagnostic.code === "TSONIC_BORROWED_ASYNC_RESULT_ESCAPES" && selected.diagnostic.at === call, true,
        selected.kind === "unresolved" ? selected.reason : `${kind}: discarded and stored source borrows cannot escape`);
      }
    }
  });
}

test("formal lease admission keeps the actual origin and does not accept a copied subject", () => {
  const current = fixture("input-duration", premise => ({ ...premise, value: { ...premise.value } }));
  const owner = current.declaration("keep");
  const bindings = current.storage.bindingsForLexicalOwner(owner);
  assert.equal(bindings.kind, "resolved", "checked declaration-local bindings");
  const reference = current.storage.nodes.find(node => current.source.ast.is.IsIdentifier(node) &&
    current.source.ast.text(node) === "value" && current.source.ast.is.IsCallExpression(current.source.ast.parent(node)));
  assert.equal(reference !== undefined, true, "the actual formal read");
  const retention = createSourceDeclarationRetentionQuery(current);
  const selected = bindings.kind === "resolved" ? retention.forReference(reference!) : bindings;
  assert.equal(selected.kind, "unresolved", "copied subjects are not canonical native evidence");
});

for (const kind of ["input-duration", "type-argument"] as const) {
  test(`unresolved async admission requires a validated ${kind} lease, never an unknown or exhausted continuation alone`, () => {
    const current = fixture(kind);
    const call = current.calls[1]!;
    const budget = createSourceDeclarationOwnershipBudget(call, { ...defaultSourceDeclarationOwnershipLimits, maximumSteps: 1 });
    const unresolved = createSourceDeclarationOwnershipQuery({ ...current, budget }).forCall(call);
    assert.equal(unresolved.kind === "unresolved" && budget.failure() !== undefined, true, "the actual continuation budget is exhausted");
    const unknown = { kind: "unresolved" as const, cause: { kind: "required-fact" as const }, at: call, reason: "The native projection has no completed lease premise." };
    const decide = (retention: SourceDeclarationRetentionReadSelection, selectedBudget = current.budget, selectedCall = call) => {
      const selected = current.source.semantics.forNode(selectedCall).operations.call(selectedCall);
      assert.equal(selected?.sourceSelectedSignatureKind === "resolved", true, "the actual async call contract");
      if (selected?.sourceSelectedSignatureKind !== "resolved") throw new Error("missing checked async contract");
      const completion = current.premises.completionFor(selectedCall, selected);
      return decideSourceDeclarationAsyncResultUse({ ...current, budget: selectedBudget, call: selectedCall, completion,
        disposition: resolveSourceDeclarationAsyncResultDisposition({ source: current.source, expression: selectedCall, budget: selectedBudget,
          regionFor: current.values.regionFor, parameterUses: current.parameterUses }),
        continuation: () => retention.kind === "unresolved" ? retention : unknown, retention: () => retention });
    };
    const unknownDecision = decide(unknown);
    assert.equal(unknownDecision.kind === "unresolved", true,
      "unresolved native evidence is neither native-safe admission nor a fabricated source rejection");
    const emptyDecision = decide({ kind: "resolved", reference: call, premises: [] });
    assert.equal(emptyDecision.kind === "unresolved", true,
      "an empty possible-lease set is not a fabricated retention proof");
    const reference = current.source.ast.arguments(call)[0];
    assert.equal(reference !== undefined, true, "the real formal read");
    const bindings = current.storage.bindingsForLexicalOwner(call);
    assert.equal(bindings.kind, "resolved", "the actual native formal execution");
    if (bindings.kind !== "resolved") return;
    const retention = createSourceDeclarationRetentionQuery(current).forReference(reference!);
    assert.equal(retention.kind === "resolved" && retention.premises.some(premise => premise.kind === "formal-borrowed"), true,
      "the possible lease was admitted by the canonical retention validator");
    const borrowedDecision = decide(retention);
    assert.equal(borrowedDecision.kind === "unresolved", true,
      "even a validated argument lease is not evidence about the call's retained asynchronous result");
    const exhaustedDecision = decide(retention, budget);
    assert.equal(exhaustedDecision.kind === "unresolved", true,
      "even a validated native premise cannot turn exhausted analysis into a resolved decision");
    const rejected = current.query.forCall(call);
    assert.equal(rejected.kind === "resolved" && rejected.decision === "rejected", true,
      "a resolved source rejection does not depend on inventing another premise");
    const admitted = current.query.forCall(current.calls[0]!);
    assert.equal(admitted.kind === "resolved" && admitted.decision === "admitted", true,
      "a real formal lease remains valid for its proven immediate await");
    const nativeCall = current.storage.invocations.find(node => current.source.ast.is.IsCallExpression(node) &&
      current.selectedDeclaration(node) === current.declaration("independent"));
    assert.equal(nativeCall !== undefined, true, "the actual owned native completion has a distinct source call");
    const nativeBindings = current.storage.bindingsForLexicalOwner(nativeCall!);
    assert.equal(nativeBindings.kind, "resolved", "the owned native completion has its exact caller activation");
    if (nativeBindings.kind !== "resolved") return;
    const nativeRetention = createSourceDeclarationRetentionQuery(current).forReference(nativeCall!);
    const unrelatedDecision = decide(nativeRetention);
    assert.equal(unrelatedDecision.kind === "unresolved", true,
      "owned native evidence from another call cannot discharge this result's unresolved lease");
    const nativeDecision = decide(nativeRetention, current.budget, nativeCall!);
    assert.equal(nativeRetention.kind === "resolved" && nativeRetention.premises.length > 0 &&
      nativeRetention.premises.every(premise => premise.kind === "retained") &&
      nativeDecision.kind === "resolved" && nativeDecision.decision === "observe-discarded-rejection", true,
    "actual nonempty validated native retention remains authoritative when the source continuation is unresolved");
  });
}
