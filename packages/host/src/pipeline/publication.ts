import type { CallerRefusal, DataflowAccount, DataflowResult, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Result } from "../diag/contract.js";
import { orderDiagnostics, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { DefId, ItemNodeRef, ModuleId, SigId, SourceNodeRef, TyId } from "../ids/contract.js";
import { decodeModuleId, encodeKey } from "../ids/index.js";
import type {
  BodyRecord, HostProgram, ModuleBodies, ProgramEvidence, ProgramIdentityImage, ProgramIndex, ProgramVerificationContext,
  ProgramVerificationWork, SignatureRecord,
} from "../ir-program/contract.js";
import { admitProgramReadyRow, canonicalizeProgram, createProgramVerificationWork, verifyModuleBodies, verifyProgramIndex } from "../ir-program/index.js";
import type { BindingScope, BodyInstance, MemberInventory } from "../ir-types/contract.js";
import { executionKey, exportTypes, instanceKey, nativeFactsKey, signatureRequestKey, viewTypes } from "../ir-types/index.js";
import type { InferenceDeclaration } from "../ir-infer/contract.js";
import type { TirBody, TirMemberOccurrence, TirVerifierInput } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { AnalysisBarrier } from "./analysis-barrier.js";
import { analysisStop } from "./analysis-stop.js";
import type { BodyFacts, RelationalArena, Summary } from "../ir-facts/contract.js";
import { admitArtifactIdentity, admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function storageKey(declaration: ItemNodeRef): string {
  return encodeKey([declaration.owner, declaration.node]);
}

function memberKey(instance: BodyInstance, occurrence: TirMemberOccurrence): string | null {
  return occurrence.kind === "selection" ? encodeKey([instanceKey(instance), occurrence.node, occurrence.ordinal]) : null;
}

function finalContext(inputs: HostAnalysisInputs, typed: TypedSourceBarrier, analysis: AnalysisBarrier, program: HostProgram,
  image: ProgramIdentityImage, evidence: ProgramEvidence, conditionRefusal: CallerRefusal, resources: ProgramVerificationWork,
  account: DataflowAccount, selectedNativeFactsKey: string,
): DataflowResult<ProgramVerificationContext> | NonNullable<ReturnType<typeof admitProgramReadyRow>> {
  const admit = (records: number) => admitProgramReadyRow(resources, 1, records);
  const setup = admit(15);
  if (setup !== null) return setup;
  const checked = new Map<ModuleId, ProgramEvidence["checked"][number]>();
  const tirInputs = new Map<ModuleId, TirVerifierInput>();
  const declarations = new Map<DefId, InferenceDeclaration>();
  const signatures = new Map<string, SigId>();
  const storage = new Map<string, TyId | null>();
  const members = new Map<string, MemberInventory | null>();
  const typedBodies = new Map<string, TirBody>();
  const requiredEntries = new Map<string, readonly number[]>();
  const graphs = new Map<string, MirBody>();
  const arenas = new Map<string, RelationalArena>();
  const summaries = new Map<string, Summary>();
  const scopes = new Map<string, readonly BindingScope[] | null>();
  const moduleScopes = new Map<ModuleId, readonly BindingScope[] | null>();
  const types = program.index.types;
  for (let position = 0; position < evidence.checked.length; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const entry = evidence.checked[position];
    if (entry === undefined) return fail("Publication evidence retains every original checked module.");
    checked.set(entry.module.module, entry);
  }
  for (let position = 0; position < evidence.signatures.length; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const row = evidence.signatures[position];
    if (row === undefined) return fail("Publication evidence retains every actual placed signature answer.");
    const request = row.request;
    if (request !== null) {
      const admission = chargeWork(account, request.definition.length) ?? admitArtifactIdentity(request.bindings, account);
      if (admission !== null) return admission;
      const key = signatureRequestKey(request);
      const previous = signatures.get(key);
      if (previous !== undefined && previous !== row.signature) return fail("An exact placement request must retain one original answer.");
      signatures.set(key, row.signature);
    }
  }
  for (let position = 0; position < evidence.storage.length; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const row = evidence.storage[position];
    if (row === undefined) return fail("Publication evidence retains every actual qualified storage row.");
    const keyWork = chargeWork(account, row.declaration.owner.length);
    if (keyWork !== null) return keyWork;
    storage.set(storageKey(row.declaration), row.storage);
  }
  for (let position = 0; position < evidence.members.length; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const row = evidence.members[position];
    if (row === undefined) return fail("Publication evidence retains every actual qualified member inventory.");
    const identity = chargeWork(account, row.instance.body.length) ?? admitArtifactIdentity(row.instance.bindings, account);
    if (identity !== null) return identity;
    const key = memberKey(row.instance, row.occurrence);
    if (key !== null) members.set(key, row.inventory);
  }
  const scopedNode = (reference: SourceNodeRef) => {
    const source = typed.sourceNodeOf(reference);
    return source === null ? null : checked.get(source.origin.module)?.syntax.nodeOf(source) ?? null;
  };
  const bodyOf = (instance: BodyInstance) => typedBodies.get(instanceKey(instance)) ?? null;
  const declarationOf = (definition: DefId) => declarations.get(definition) ?? null;
  for (let position = 0; position < typed.source.modules.length; position += 1) {
    const admission = admit(4);
    if (admission !== null) return admission;
    const original = typed.source.modules[position];
    if (original === undefined) return fail("Publication proof requires its original checked source inventory.");
    const module = original.module.module;
    const checkedImage = checked.get(module);
    const originalTir = typed.verifierOf(module);
    if (checkedImage === undefined || originalTir === null) return fail("The final chapter needs its actual checked and typed owners.");
    const tree = image.treeOf(originalTir.module.tree);
    if (tree === null) return fail("The actual typed root was not transported into this Program.");
    const rootDeclaration = checkedImage.module.tree.tsonic.definition;
    const rootScope = originalTir.declarationOf(rootDeclaration);
    if (rootScope === null) return fail("The actual checked module root needs its completed declaration evidence.");
    declarations.set(rootDeclaration, rootScope);
    const originalModuleScopes = originalTir.bindingScopesOf<DataflowStop>({ kind: "module", module }, originalTir.module, null);
    if (originalModuleScopes.kind !== "complete") return originalModuleScopes.stop;
    moduleScopes.set(module, originalModuleScopes.scopes);
    const bodies: TirBody[] = [];
    for (let index = 0; index < originalTir.module.bodies.length; index += 1) {
      const stop = admit(3);
      if (stop !== null) return stop;
      const originalBody = originalTir.module.bodies[index];
      if (originalBody === undefined) return fail("The actual typed body inventory is dense.");
      if (typed.constantEntriesOf(originalBody) !== null) continue;
      const body = image.tirOf(originalBody);
      if (body === null) return fail("The actual typed body has no final identity-domain image.");
      const identity = chargeWork(account, body.body.length) ?? admitArtifactIdentity(body.bindings, account);
      if (identity !== null) return identity;
      const key = instanceKey({ body: body.body, bindings: body.bindings });
      const originalIdentity = chargeWork(account, originalBody.body.length) ?? admitArtifactIdentity(originalBody.bindings, account);
      if (originalIdentity !== null) return originalIdentity;
      const originalInstance = { body: originalBody.body, bindings: originalBody.bindings };
      if (originalBody.bindings.kind === "instantiated") {
        const keep = admit(1);
        if (keep !== null) return keep;
        const provided = originalTir.requiredEntriesOf(originalInstance);
        if (provided === null) return fail("A selected final body requires its actual independently sealed entries.");
        requiredEntries.set(key, provided);
      }
      const originalScopes = originalTir.bindingScopesOf<DataflowStop>({ kind: "body", instance: originalInstance }, originalBody, null);
      if (originalScopes.kind !== "complete") return originalScopes.stop;
      scopes.set(key, originalScopes.scopes);
      typedBodies.set(key, body);
      bodies.push(body);
    }
    for (let index = 0; index < original.module.items.length; index += 1) {
      const stop = admit(2);
      if (stop !== null) return stop;
      const item = original.module.items[index];
      if (item === undefined) return fail("The actual declaration inventory is dense.");
      const sourceNode = original.nodes[item.node];
      const old = originalTir.declarationOf(item.definition);
      if (old === null || sourceNode === undefined) return fail("Publication proof needs the actual checked declaration answer.");
      const node = checkedImage.syntax.nodeOf(sourceNode);
      if (node === null) return fail("The actual checked declaration syntax was not transported.");
      const payload = node.tsonic;
      declarations.set(item.definition, { scope: old.scope, parameterCount: old.parameterCount,
        endpoints: payload !== null && "signatures" in payload ? payload.signatures : [] });
    }
    tirInputs.set(module, { ...originalTir, source: checkedImage.module, module: { module, tree, bodies }, types,
      declarationOf, nodeOf: scopedNode, bodyOf, requiredEntriesOf: instance => requiredEntries.get(instanceKey(instance)) ?? null,
      bindingScopesOf: target => ({ kind: "complete", scopes: target.kind === "module"
        ? moduleScopes.get(target.module) ?? null : scopes.get(instanceKey(target.instance)) ?? null }),
      staticStorageOf: declaration => storage.get(storageKey(declaration)) ?? null,
      memberTableOf: (instance, occurrence) => {
        const key = memberKey(instance, occurrence);
        return key === null ? null : members.get(key) ?? null;
      },
    });
  }
  const originalGraphs = analysis.mir.values();
  for (let position = 0; position < analysis.mir.size; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const original = originalGraphs.next();
    if (original.done) return fail("The retained analysis graph inventory is dense.");
    const mapped = image.mirOf(original.value);
    if (mapped === null) return fail("The actual analyzed MIR graph was not transported.");
    const identity = chargeWork(account, mapped.body.length) ?? admitArtifactIdentity(mapped.bindings, account);
    if (identity !== null) return identity;
    graphs.set(instanceKey({ body: mapped.body, bindings: mapped.bindings }), mapped);
  }
  const originalFacts = analysis.facts.values();
  for (let position = 0; position < analysis.facts.size; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const row = originalFacts.next();
    if (row.done) return fail("The retained Facts inventory is dense.");
    const mapped = image.factsOf(row.value);
    if (mapped === null || analysis.verification.arenaOf({ kind: "body", execution: row.value.execution }) !== row.value.arena)
      return fail("The final Facts arena needs exact independent original execution ownership.");
    const identity = admitSummaryIdentity({ kind: "body", execution: mapped.execution }, account);
    if (identity !== null) return identity;
    arenas.set(executionKey(mapped.execution), mapped.arena);
  }
  const originalSummaries = analysis.summaries.values();
  let declaredCaptures: Map<string, number> | null = null;
  for (let position = 0; position < analysis.summaries.size; position += 1) {
    const stop = admit(1);
    if (stop !== null) return stop;
    const row = originalSummaries.next();
    if (row.done || "kind" in row.value.value) return fail("The retained stable Summary inventory is complete.");
    const original = row.value.value;
    const mapped = image.summaryOf(original);
    if (mapped === null || analysis.verification.summaryOf(original.key) !== original
      || analysis.verification.arenaOf({ kind: "summary", key: original.key }) !== original.arena)
      return fail("Final Summary evidence needs exact independent original summary ownership.");
    const identity = admitSummaryIdentity(mapped.key, account);
    if (identity !== null) return identity;
    const key = summaryKey(mapped.key);
    if (original.key.kind === "declared") {
      const read = admitSummaryIdentity(original.key, account) ?? admit(declaredCaptures === null ? 2 : 1);
      if (read !== null) return read;
      const captured = analysis.verification.captureCount(original.key);
      if (captured === null || mapped.key.kind !== "declared") return fail("A final declared Summary requires its actual capture inventory.");
      declaredCaptures ??= new Map();
      declaredCaptures.set(key, captured);
    }
    summaries.set(key, mapped);
  }
  const initialization = image.initializationOf(analysis.initialization);
  if (initialization === null) return fail("Final verification needs its actual retained initialization proof.");
  const signatureIdOf = (definition: DefId, endpoint: SignatureRecord["kind"], ordinal: number, bindings: BodyInstance["bindings"]): SigId | null =>
    signatures.get(signatureRequestKey({ definition, endpoint, ordinal, bindings })) ?? null;
  return { kind: "complete", value: {
    initialization, nativeFactsKey: selectedNativeFactsKey, selectedNativeFacts: inputs.snapshot.nativeFacts, resources,
    conditionRefusal, mirVerification: inputs.limits.mirVerification,
    modulePathOf: module => { const path = decodeModuleId(module); return path.kind === "decoded" ? path.value : null; },
    definitionPathOf: definition => typed.source.definitionPaths.get(definition) ?? null,
    tirOf: module => tirInputs.get(module) ?? null,
    signatureIdOf,
    facts: { ...analysis.verification, types, nodeExists: reference => scopedNode(reference) !== null,
      tirBody: instance => bodyOf(instance) ?? fail("An exact final Facts owner requires its actual typed body."),
      mirBody: instance => graphs.get(instanceKey(instance)) ?? null,
      signatureIdOf: request => signatureIdOf(request.definition, request.endpoint, request.ordinal, request.bindings),
      arenaOf: owner => owner.kind === "body" ? arenas.get(executionKey(owner.execution)) ?? null
        : summaries.get(summaryKey(owner.key))?.arena ?? null,
      summaryOf: key => summaries.get(summaryKey(key)) ?? null,
      captureCount: key => key.kind === "body" ? bodyOf(key.execution.instance)?.captures.length ?? null
        : declaredCaptures?.get(summaryKey(key)) ?? null,
    },
  } };
}

export function publishHostProgram(inputs: HostAnalysisInputs, typed: TypedSourceBarrier,
  analysis: AnalysisBarrier, account: DataflowAccount): Result<HostProgram> {
  const { source } = typed;
  const unit = { query: "AnalyzeHostProgram", key: inputs.snapshot.source.input.packages.fingerprint };
  const bodies: BodyRecord[] = [];
  const modules: ModuleBodies[] = [];
  const signatures = new Map<string, SignatureRecord>();
  for (const module of typed.modules.values()) {
    const published: ModuleBodies["bodies"][number][] = [];
    for (const tir of module.bodies) {
      if (typed.constantEntriesOf(tir) !== null) continue;
      const instance = { body: tir.body, bindings: tir.bindings };
      const common = { instance, module: module.module, owner: tir.owner, root: tir.root.id };
      if (tir.bindings.kind === "parametric") {
        bodies.push({ ...common, kind: "template" });
        published.push({ kind: "template", instance, tir });
      } else {
        const mir = analysis.mir.get(instanceKey(instance));
        const observations = analysis.observations.get(instanceKey(instance));
        if (mir === undefined || observations === undefined)
          return fail("A selected publication requires its actual verified MIR and completed observations.");
        const inventory = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (inventory !== null) return analysisStop(inventory, unit);
        const facts: BodyFacts[] = [];
        for (let position = mir.entries.length - 1; position >= 0; position -= 1) {
          const row = chargeWork(account, 1) ?? chargeResultEntries(account, 3);
          if (row !== null) return analysisStop(row, unit);
          const entry = mir.entries[position];
          if (entry === undefined) return fail("The verified selected entry inventory is dense.");
          const execution = { instance, provided: entry.provided };
          const identity = admitSummaryIdentity({ kind: "body", execution }, account);
          if (identity !== null) return analysisStop(identity, unit);
          facts.push(analysis.facts.get(executionKey(execution))
            ?? fail("A selected execution requires its actual verified stable Facts projection."));
        }
        bodies.push({ ...common, kind: "selected", mirLocalCount: mir.locals.length, mirConstantCount: mir.constants.length,
          mirPlaceCount: mir.places.length, mirBlockCount: mir.blocks.length });
        published.push({ kind: "selected", instance, tir, mir, observations, facts });
      }
      const placed = typed.placedSignatureOf(instance);
      if (placed === null) return fail("Each published TIR body needs its actual placed signature answer.");
      const request = placed.request;
      if (request !== null) {
        const common = { definition: request.definition, bindings: request.bindings, ordinal: request.ordinal, signature: placed.signature.id };
        const record: SignatureRecord = request.endpoint === "api-body" ? { ...common, kind: "api-body", body: tir.body }
          : { ...common, kind: request.endpoint };
        signatures.set(signatureRequestKey(request), record);
      }
    }
    modules.push({ module: module.module, tree: module.tree, bodies: published });
  }
  const declared = typed.required.declaredPlacements;
  if (declared !== null) {
    const placements = declared.entries();
    for (let position = 0; position < declared.size; position += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return analysisStop(read, unit);
      const row = placements.next();
      if (row.done) return fail("The retained declared signature inventory is dense.");
      const [key, { request, signature }] = row.value;
      if (request.endpoint !== "api-signature") return fail("A declared execution retains its bodyless API signature.");
      const previous = signatures.get(key);
      if (previous !== undefined) {
        if (previous.signature !== signature.id) return fail("One selected declared signature request retains one actual answer.");
        continue;
      }
      const keep = chargeResultEntries(account, 2);
      if (keep !== null) return analysisStop(keep, unit);
      signatures.set(key, { definition: request.definition, bindings: request.bindings, ordinal: request.ordinal,
        signature: signature.id, kind: request.endpoint });
    }
  }
  modules.sort((left, right) => compareText(left.module, right.module));
  const selectedNativeFactsKey = nativeFactsKey(inputs.snapshot.nativeFacts);
  const index: ProgramIndex = {
    schema: 1, nativeFactsKey: selectedNativeFactsKey, rootPackage: inputs.snapshot.source.input.packages.rootPackage,
    packages: inputs.snapshot.source.input.packages.packages.map(record => ({ id: record.id, name: record.name,
      packageRoot: record.packageRoot, sourceRoot: record.sourceRoot,
      dependencies: record.dependencies.flatMap(dependency => dependency.resolved === null ? [] : [dependency.resolved]).sort(compareText), exports: record.exports })),
    modules: source.modules.map(({ module }) => {
      const decoded = decodeModuleId(module.module);
      if (decoded.kind !== "decoded") return fail("A checked module retains its actual qualified package identity.");
      const items = [...module.items, { definition: module.tree.tsonic.definition, node: module.tree.id }]
        .sort((left, right) => compareText(left.definition, right.definition));
      return { module: module.module, package: decoded.value.package, items, exports: module.exports,
        bindings: module.bindings, checkerDiagnostics: module.checkerDiagnostics };
    }), types: viewTypes(source.types), signatures: [...signatures.values()],
    bodies, dependencyInventory: analysis.inventory, metadata: [], constants: analysis.constants,
    summaries: [],
    diagnostics: orderDiagnostics(typed.database.diagnostics()),
    initialization: analysis.initialization,
  };
  const conditionRefusal: CallerRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: "condition alternatives", maximum: inputs.limits.analyses.maximumConditionAlternatives, site: { kind: "none" },
    unit: { request: unit, position: { kind: "result" } } })] };
  const summaryRows = [];
  const summaryAnswers = analysis.summaries.values();
  for (let position = 0; position < analysis.summaries.size; position += 1) {
    const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (stop !== null) return analysisStop(stop, unit);
    const answer = summaryAnswers.next();
    if (answer.done || "kind" in answer.value.value) return fail("Publication uses only actual completed stable summary answers.");
    summaryRows.push(answer.value.value);
  }
  const publication = exportTypes(source.types, inputs.limits.instantiation);
  const refusal = (limit: string, maximum: number): Result<HostProgram> => ({ kind: "refused", diagnostics: [resourceLimitDiagnostic({
    owner: "ir-program", limit, maximum, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } },
  })] });
  if (publication.kind === "resource-limit") return refusal(publication.dimension, publication.maximum);
  const resources = createProgramVerificationWork(inputs.limits.instantiation, account);
  const projected = canonicalizeProgram({ index: { ...index, summaries: summaryRows }, modules }, publication.value, resources,
    { kind: "with-evidence", read: typed.programEvidence });
  if (projected.kind === "refused") return projected;
  if (projected.kind === "resource-limit") return refusal(projected.dimension, projected.maximum);
  if (projected.kind === "evidence-input-stop") return analysisStop(projected.stop, unit);
  if (projected.mode !== "with-evidence") return fail("Publication requires its actual independent verification evidence.");
  const ready = finalContext(inputs, typed, analysis, projected.value, projected.image, projected.evidence, conditionRefusal,
    resources, account, selectedNativeFactsKey);
  if (ready.kind !== "complete") {
    if (ready.kind === "resource-limit" && ready.dimension === "created-records") return refusal(ready.dimension, ready.maximum);
    return analysisStop(ready, unit);
  }
  const context = ready.value;
  const final = projected.value;
  const verifiedIndex = verifyProgramIndex(final.index, context);
  if (verifiedIndex.kind === "refused") return verifiedIndex;
  if (verifiedIndex.kind === "resource-limit") return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: verifiedIndex.dimension, maximum: verifiedIndex.maximum, site: { kind: "none" },
    unit: { request: unit, position: { kind: "result" } } })] };
  if (verifiedIndex.violations.length !== 0) {
    const first = verifiedIndex.violations[0];
    return fail(`The actual Program index violates ${first?.rule}: ${first?.detail[0]?.kind === "text" ? first.detail[0].value : ""}.`);
  }
  for (const module of final.modules) {
    const result = verifyModuleBodies(final.index, module, context);
    if (result.kind === "refused") return result;
    if (result.kind === "resource-limit") return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
      limit: result.dimension, maximum: result.maximum, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
    if (result.violations.length !== 0) {
      const first = result.violations[0];
      return fail(`The actual Program publication violates ${first?.rule}: ${first?.detail[0]?.kind === "text" ? first.detail[0].value : ""}.`);
    }
  }
  return { kind: "ok", diagnostics: final.index.diagnostics, value: final };
}
