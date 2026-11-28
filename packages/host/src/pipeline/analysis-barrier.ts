import type { CallerRefusal, DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { accountFailure, chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Diagnostic, Result, UnitAnswerPosition, UnitDiagnostic, UnitRequest } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, NodeId, SigId, TyId } from "../ids/contract.js";
import { checkedSourceObjectFieldsOf, checkedSourceObjectHoldingOf } from "../ir-hir/index.js";
import type { BodyFacts, BodyObservations, DependencyInventory, FactsVerificationContext, ParameterSlot, Summary,
  MetadataRecord, ObservationFact, ObservationSourceEvidence, SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitArtifactIdentity, admitSummaryIdentity, summaryKey, verifySummary } from "../ir-facts/index.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { TirBody } from "../ir-tir/contract.js";
import { verifyMir } from "../ir-mir/index.js";
import type { BindingScope, BodyInstance, Execution } from "../ir-types/contract.js";
import { executionKey, instanceKey, internType, nativeCarrierHoldingOf, readSignature, readType, viewTypes } from "../ir-types/index.js";
import type { Query } from "../query/contract.js";
import type { ConvergenceMember, DeclaredSummaryInput } from "../summaries/contract.js";
import type { ConstantRecord, ProgramInitialization } from "../ir-program/contract.js";
import type { ErrorValue } from "../diag/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { InternalBodyInput } from "../lower-mir/contract.js";
import type { CheckedBodyNodeRange } from "./checked-inputs.js";
import { analysisStop } from "./analysis-stop.js";
import { checkedSourceViews } from "./checked-inputs.js";
import { produceStaticValues } from "./static-values.js";
import type { ObservationDemand } from "./layout-queries.js";
import { layoutIdentity } from "./layout-queries.js";
import { bindExternalStorage } from "./external-entries.js";
import { lowerMirDeps, mirVerificationContext } from "./lower-mir-step.js";
import { pipelineWiring } from "./wiring.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export interface AnalysisBarrier {
  readonly inventory: DependencyInventory;
  readonly mir: ReadonlyMap<string, MirBody>;
  readonly observations: ReadonlyMap<string, BodyObservations>;
  readonly facts: ReadonlyMap<string, BodyFacts>;
  readonly summaries: ReadonlyMap<string, SummaryAnswer>;
  readonly constants: readonly ConstantRecord[];
  readonly metadata: readonly MetadataRecord[];
  readonly verification: FactsVerificationContext;
  readonly initialization: ProgramInitialization;
}

export function analyzeTypedSource(inputs: HostAnalysisInputs, typed: TypedSourceBarrier, account: DataflowAccount): Result<AnalysisBarrier> {
  const unit: UnitRequest = { query: "AnalyzeHostProgram", key: inputs.snapshot.source.input.packages.fingerprint };
  const setup = chargeResultEntries(account, 4);
  if (setup !== null) return analysisStop(setup, unit);
  const { source } = typed;
  const observationRanges = new Map<BodyId, CheckedBodyNodeRange[]>();
  const sources = checkedSourceViews(source.modules, (body, range) => {
    const existing = observationRanges.get(body);
    if (existing === undefined) observationRanges.set(body, [range]);
    else existing.push(range);
  });
  const table = viewTypes(source.types);
  const mir = new Map<string, MirBody>();
  let constantMir: Map<string, MirBody> | null = null;
  const observations = new Map<string, { readonly instance: BodyInstance; readonly rows: ObservationFact[] }>();
  let observationDemands: ObservationDemand[] | null = null;
  const facts = new Map<string, BodyFacts>();
  const summaries = new Map<string, SummaryAnswer>();
  const { operations, operationIdentities, operationsByBody, dependencies, moduleExecutions, declared } = typed.required;
  const bindingDependence = new Map<DefId, boolean>();
  const exposedBodies = typed.exposure.bodies;
  const safety: Query<SourceSemanticInputs, BodyInstance, ErrorValue | null, SourceSemanticWitness, DeclaredSignatureErrorData> = {
    name: "safetyDiagnostics", keyData: instanceKey, answerPolicy: { kind: "refusal-only" },
    compute: (context, instance) => {
      const body = typed.bodies.get(instanceKey(instance));
      const verification = body === undefined ? null : typed.verifierOf(body.root.origin.module);
      if (body === undefined || verification === null) return fail("Safety requires its actual verified typed body and source relation.");
      return pipelineWiring.validate.safetyDiagnostics({ libraries: source.libraries, verification }, body,
        { query: context.fact.query, key: context.fact.key });
    },
  };
  const readyBody = (instance: BodyInstance) => typed.bodies.get(instanceKey(instance))
    ?? fail("The selected dependency needs its actual verified typed body instance.");
  const lower = (body: TirBody, identity: string, requiredEntries: readonly number[]): Result<MirBody> => {
    const run = { selectedNativeFacts: inputs.snapshot.nativeFacts, interner: source.types, table,
      defs: { completionSelector: internType(source.types, { kind: "primitive", primitive: "int32" }),
        exceptionStorage: internType(source.types, { kind: "intrinsic", intrinsic: "unknown" }) },
      lowering: inputs.limits.lowering, verification: inputs.limits.mirVerification,
      declarationOf: typed.declarationOf, bodyOwner: (body: BodyId) => sources.bodies.get(body)?.owner ?? null,
      bodyOf: (instance: BodyInstance) => typed.bodies.get(instanceKey(instance)) ?? null };
    const internal: InternalBodyInput[] = [];
    const included = new Set<BodyId>();
    const include = (child: BodyId): DataflowStop | null => {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (included.has(child)) return null;
      const instance: BodyInstance = { body: child, bindings: body.bindings };
      const selected = typed.bodies.get(instanceKey(instance));
      if (selected === undefined) {
        const nested = sources.bodies.get(child);
        const reference = nested === undefined ? null : sources.declarationSourceOf(nested.owner);
        const original = reference === null ? null : sources.nodeOf(reference);
        if (body.root.kind === "SourceFile" && original?.kind === "FunctionDeclaration" && original.tsonic.body === child && original.body === nested?.root
          || original?.kind === "Parameter" && original.tsonic.initializer === child && original.initializer === nested?.root) return null;
      }
      if (selected === undefined) return fail("A required lowered initializer needs its actual verified typed body.");
      const growth = chargeResultEntries(account, 3);
      if (growth !== null) return growth;
      included.add(child);
      internal.push({ instance, signature: selected.signature, captures: selected.captures });
      return null;
    };
    for (const child of body.nestedBodies) {
      const stop = include(child);
      if (stop !== null) return analysisStop(stop, unit);
    }
    for (const header of body.params) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return analysisStop(stop, unit);
      if (header.initializer.kind === "ready-default" && header.tsonic.initializer !== null) {
        const stop = include(header.tsonic.initializer);
        if (stop !== null) return analysisStop(stop, unit);
      }
    }
    const lowered = pipelineWiring.lowerMir.lowerToMir(lowerMirDeps(run,
      { request: { query: "mirBody", key: identity }, position: { kind: "result" } }), body, internal, requiredEntries);
    if (lowered.kind === "refused") return lowered;
    const verified = verifyMir(lowered.value, mirVerificationContext(run, body, requiredEntries));
    if (verified.kind === "resource-limit") return analysisStop(verified, unit);
    if (verified.violations.length !== 0) return fail(`The actual LowerMir result violates ${verified.violations[0]?.rule}.`);
    return lowered;
  };
  for (const body of typed.bodies.values()) {
    const declarationWork = chargeWork(account, 1);
    if (declarationWork !== null) return analysisStop(declarationWork, unit);
    const previous = bindingDependence.get(body.owner);
    const dependent = body.dependence === "binding-dependent";
    if (previous === undefined) {
      const declarationGrowth = chargeResultEntries(account, 1);
      if (declarationGrowth !== null) return analysisStop(declarationGrowth, unit);
      bindingDependence.set(body.owner, dependent);
    } else if (!previous && dependent) bindingDependence.set(body.owner, true);
    if (body.bindings.kind !== "instantiated" || typed.layoutOnly(body)) continue;
    const instance: BodyInstance = { body: body.body, bindings: body.bindings };
    const identity = instanceKey(instance);
    const safe = typed.database.run(safety, instance);
    if (safe.kind === "refused") return safe;
    if (safe.value !== null) {
      const first = safe.diagnostics[0];
      if (first === undefined) return fail("A safety error requires its actual original diagnostic.");
      return { kind: "refused", diagnostics: [first, ...safe.diagnostics.slice(1)] };
    }
    const constantEntries = typed.constantEntriesOf(body);
    const requiredEntries = constantEntries ?? typed.required.provided.get(identity) ?? fail("Each selected body needs its independently required entries.");
    const lowered = lower(body, identity, requiredEntries);
    if (lowered.kind === "refused") return lowered;
    const growth = chargeResultEntries(account, constantEntries === null ? 3 : constantMir === null ? 2 : 1);
    if (growth !== null) return analysisStop(growth, unit);
    if (constantEntries !== null) {
      constantMir ??= new Map();
      constantMir.set(identity, lowered.value);
      continue;
    }
    mir.set(identity, lowered.value);
    if (sources.bodies.get(body.body)?.owner !== body.owner)
      return fail("A selected execution requires its actual checked body and declaration.");
    for (const range of observationRanges.get(body.body) ?? []) for (let position = range.start; position < range.end; position += 1) {
      const node = range.nodes[position];
      if (node === undefined) return fail("The actual checked body node inventory is dense.");
      const metadata = node.tsonic;
      const value = metadata !== null && "value" in metadata ? metadata.value : metadata;
      if (value === null || !("observation" in value)) continue;
      const observation = value.observation;
      if (observation.kind === "unavailable") return fail("A selected execution cannot borrow unavailable observation capture.");
      if (observation.value !== null) {
        const stop = chargeWork(account, 1) ?? chargeResultEntries(account, observationDemands === null ? 4 : 3);
        if (stop !== null) return analysisStop(stop, unit);
        (observationDemands ??= []).push({ instance, at: observation.value.occurrence });
      }
    }
    observations.set(identity, { instance, rows: [] });
  }
  const staticValues = produceStaticValues(inputs, typed, table, mir, constantMir, (instance, identity) => {
    const body = readyBody(instance);
    const signature = readSignature(source.types, body.signature);
    if (body.params.length !== 0 || body.captures.length !== 0 || signature.parameters.length !== 0)
      return fail("A Layout operand requires the actual argumentless capture-free prepared execution.");
    return lower(body, identity, [0]);
  }, observationDemands, account, unit);
  if (staticValues.kind === "refused") return staticValues;
  let observationProofs: Map<string, { readonly values: Map<NodeId, ObservationSourceEvidence>; readonly scopes: BindingScope[] }> | null = null;
  for (const row of staticValues.value.rows) {
    const paid = chargeWork(account, 1 + row.instance.body.length) ?? admitArtifactIdentity(row.instance.bindings, account);
    if (paid !== null) return analysisStop(paid, unit);
    const identity = instanceKey(row.instance);
    const actual = observations.get(identity);
    if (actual === undefined) return fail("A completed observation belongs to its actual selected MIR body.");
    const offered = observationProofs?.get(identity);
    if (offered?.values.has(row.observation.node) === true) return fail("An observation evidence row must be qualified once.");
    const scope = source.descriptions.get(sources.bodies.get(row.instance.body)?.owner
      ?? fail("An observation source scope retains its actual checked body."))?.generics;
    if (scope === undefined) return fail("An observation source scope requires its actual enclosing declaration.");
    const retained = chargeResultEntries(account, observationProofs === null ? 7 : offered === undefined ? 6 : 2);
    if (retained !== null) return analysisStop(retained, unit);
    if (offered === undefined) (observationProofs ??= new Map()).set(identity, { values: new Map([[row.observation.node, row.evidence]]), scopes: [scope] });
    else {
      offered.values.set(row.observation.node, row.evidence);
      offered.scopes.push(scope);
    }
    actual.rows.push(row.observation);
  }
  let metadata: Map<string, MetadataRecord> | null = null;
  for (const record of staticValues.value.metadata) {
    const read = chargeWork(account, 1) ?? chargeWork(account, record.key.definition.length) ?? admitArtifactIdentity(record.key.bindings, account)
      ?? chargeResultEntries(account, metadata === null ? 2 : 1);
    if (read !== null) return analysisStop(read, unit);
    const identity = layoutIdentity(record.key);
    if (metadata?.has(identity) === true) return fail("One actual metadata identity cannot publish two distinct descriptor records.");
    (metadata ??= new Map()).set(identity, record);
  }
  const conditionRefusal: CallerRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: "condition alternatives", maximum: inputs.limits.analyses.maximumConditionAlternatives,
    site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
  const iterationRefusal: CallerRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: "component iterations", maximum: inputs.limits.summaries.maximumIterationsPerComponent,
    site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
  const components = pipelineWiring.summaries.componentsOf({ account, maximumComponentSize: inputs.limits.summaries.maximumComponentSize,
    componentRefusal: { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline", limit: "component members",
      maximum: inputs.limits.summaries.maximumComponentSize, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] } },
  { operations, dependencies });
  if (components.kind !== "complete") return analysisStop(components, unit);
  const verification: FactsVerificationContext = { types: table, nativeFacts: inputs.snapshot.nativeFacts, limits: inputs.limits.analyses,
    bindingScopeOf: definition => source.descriptions.get(definition)?.generics ?? null,
    sourceBindingScopesOf: target => target.kind === "observations" ? observationProofs?.get(instanceKey(target.instance))?.scopes ?? null : null,
    nominalOf: source.nominalOf, nodeExists: node => sources.nodeOf(node) !== null, localExists: sources.localExists,
    definitionExists: definition => source.descriptions.has(definition),
    metadataOf: key => metadata?.get(layoutIdentity(key)) ?? null,
    observationSourceOf: (meter, instance, node) => {
      const admitted = chargeWork(meter, 1 + instance.body.length) ?? admitArtifactIdentity(instance.bindings, meter);
      return admitted ?? { kind: "complete", value: observationProofs?.get(instanceKey(instance))?.values.get(node) ?? null };
    },
    bodyOwner: body => sources.bodies.get(body)?.owner ?? null, tirBody: readyBody,
    mirBody: instance => mir.get(instanceKey(instance)) ?? null,
    signatureIdOf: typed.signatureIdOf, declarationSourceOf: sources.declarationSourceOf,
    diagnostics: source.modules.flatMap(module => module.module.checkerDiagnostics),
    bindingDependentOf: definition => bindingDependence.get(definition) ?? null,
    captureCount: key => {
      if (key.kind === "body") return readyBody(key.execution.instance).captures.length;
      const ready = declared?.get(summaryKey(key));
      return ready === undefined ? null : ready.guarantee?.statement.captures.length ?? 0;
    },
    callbackSignaturesOf: () => null,
    arenaOf: owner => {
      if (owner.kind === "body") return facts.get(executionKey(owner.execution))?.arena ?? null;
      const answer = summaries.get(summaryKey(owner.key));
      return answer !== undefined && !("kind" in answer.value) ? answer.value.arena : null;
    },
    summaryOf: key => {
      const answer = summaries.get(summaryKey(key));
      return answer !== undefined && !("kind" in answer.value) ? answer.value : null;
    },
    libraryExportExists: () => false, declaredSiteCount: () => null };
  const componentSetup = chargeResultEntries(account, 3);
  if (componentSetup !== null) return analysisStop(componentSetup, unit);
  const componentOf = new Map<string, number>();
  const componentIndices = new Map<string, number>();
  const componentKeys = [];
  for (let index = 0; index < components.value.components.length; index += 1) {
    const row = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (row !== null) return analysisStop(row, unit);
    const component = components.value.components[index];
    if (component === undefined) return fail("The canonical component inventory is dense.");
    let first: string | null = null;
    if (component.kind === "body") for (let position = 0; position < component.members.length; position += 1) {
      const read = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (read !== null) return analysisStop(read, unit);
      const member = component.members[position];
      const operation = member === undefined ? undefined : operations[member];
      if (operation?.kind !== "body") return fail("The canonical body component inventory is dense.");
      const identity = member === undefined ? undefined : operationIdentities[member];
      if (identity === undefined) return fail("A component member borrows the actual admitted operation identity.");
      componentOf.set(identity, index);
      if (first === null) {
        const key = admitSummaryIdentity(operation, account) ?? chargeResultEntries(account, 1);
        if (key !== null) return analysisStop(key, unit);
        first = executionKey(operation.execution);
        componentIndices.set(first, index);
      }
    }
    componentKeys.push(first);
  }
  interface PublishedBody {
    readonly key: string;
    readonly summaryKey: string;
    readonly facts: BodyFacts | null;
    readonly answer: SummaryAnswer;
  }
  const bodyFactsOf: Query<SourceSemanticInputs, string, readonly PublishedBody[], SourceSemanticWitness, DeclaredSignatureErrorData> = {
    name: "bodyFactsOf", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: (context, key) => {
      const index = componentIndices.get(key);
      const component = index === undefined ? undefined : components.value.components[index];
      if (component === undefined || component.kind !== "body" || index === undefined)
        return fail("A convergence request needs its actual closed body component.");
      const outsideGrowth = chargeResultEntries(account, 4);
      if (outsideGrowth !== null) return analysisStop(outsideGrowth, unit);
      const outside: { readonly key: SummaryKey; readonly answer: SummaryAnswer }[] = [];
      const outsideKeys = new Set<string>();
      for (let position = 0; position < component.rows.length; position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return analysisStop(read, unit);
        const row = component.rows[position];
        const dependency = row === undefined ? undefined : dependencies[row];
        if (dependency === undefined) return fail("A component dependency row must retain its actual closed inventory index.");
        const admission = admitSummaryIdentity(dependency.target, account);
        if (admission !== null) return analysisStop(admission, unit);
        const key = summaryKey(dependency.target);
        if (componentOf.get(key) === index) continue;
        if (outsideKeys.has(key)) continue;
        const answer = summaries.get(key);
        if (answer === undefined) return fail("The selected component requires its already completed exact outside answer.");
        const growth = chargeResultEntries(account, 3);
        if (growth !== null) return analysisStop(growth, unit);
        outsideKeys.add(key);
        outside.push({ key: dependency.target, answer });
      }
      const requested: UnitRequest = { query: context.fact.query, key: context.fact.key };
      const members: ConvergenceMember[] = [];
      for (let position = 0; position < component.members.length; position += 1) {
        const read = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
        if (read !== null) return analysisStop(read, unit);
        const member = component.members[position];
        const selected = member === undefined ? undefined : operations[member];
        if (selected?.kind !== "body") return fail("A body component requires its exact selected executions.");
        const paid = admitSummaryIdentity(selected, account);
        if (paid !== null) return analysisStop(paid, unit);
        const graph = mir.get(instanceKey(selected.execution.instance));
        if (graph === undefined) return fail("A body round requires its actual verified graph.");
        members.push({ execution: selected.execution, mir: graph, tir: readyBody(selected.execution.instance), unit: requested });
      }
      const result = pipelineWiring.summaries.convergeComponent({
        analyzeStorageUse: pipelineWiring.liveness.analyzeStorageUse, analyzeBodyRound: pipelineWiring.bodyAnalysis.analyzeBodyRound,
        environment: { types: table, nativeFacts: inputs.snapshot.nativeFacts, bindingScopeOf: verification.bindingScopeOf,
          typeOf: type => readType(source.types, type), mirBody: instance => mir.get(instanceKey(instance)) ?? null,
          signatureOf: signature => readSignature(source.types, signature),
          staticModuleBindingsOf: module => moduleExecutions.get(module)?.instance.bindings ?? null,
          staticTypeOf: reference => reference.kind === "item" ? typed.staticStorageOf(reference.value) : null,
          carrierHoldingOf: (meter, carrier) => {
            const setup = chargeWork(meter, 1);
            if (setup !== null) return setup;
            const rows = inputs.snapshot.nativeFacts.carrierHolding;
            const read = chargeWork(meter, rows.length);
            return read ?? { kind: "complete", value: nativeCarrierHoldingOf(rows, carrier) };
          },
          enumValueOf: staticValues.value.enumValueOf,
          observationOf: (meter, instance, at) => {
            const paid = chargeWork(meter, 1 + instance.body.length) ?? admitArtifactIdentity(instance.bindings, meter);
            if (paid !== null) return paid;
            const selected = observations.get(instanceKey(instance));
            if (selected === undefined || at.body !== instance.body) return { kind: "complete", value: null };
            for (let index = 0; index < selected.rows.length; index += 1) {
              const read = chargeWork(meter, 1);
              if (read !== null) return read;
              const row = selected.rows[index];
              if (row === undefined) return fail("A completed observation inventory is dense.");
              if (row.node === at.node) return { kind: "complete", value: row };
            }
            return { kind: "complete", value: null };
          },
          sourceObjectHolding: (account, local, storage) => {
            const admitted = chargeWork(account, 1 + local.body.length);
            if (admitted !== null) return admitted;
            const body = sources.bodies.get(local.body);
            if (body === undefined) return fail("An executable source local belongs to its actual checked body.");
            const localRead = chargeWork(account, 5);
            if (localRead !== null) return localRead;
            const holding = checkedSourceObjectHoldingOf(body, local, storage, {
              bodyOf: id => sources.bodies.get(id) ?? null,
              bindingOf: source.bindingOf,
              typeOf: type => readType(source.types, type),
              nodeOf: reference => {
                const owner = reference.kind === "item" ? reference.value.owner : reference.value.body;
                return chargeWork(account, 18 + owner.length) === null ? sources.nodeOf(reference) : null;
              }, itemOf: definition => {
                if (chargeWork(account, 12 + definition.length) !== null) return null;
                const reference = sources.declarationSourceOf(definition);
                return reference === null ? null : sources.nodeOf(reference);
              }, admit: (work, records) => (chargeWork(account, work) ?? chargeResultEntries(account, records)) === null,
            });
            return accountFailure(account) ?? { kind: "complete", value: holding };
          },
          sourceObjectFields: (meter, identity) => {
            const admitted = chargeWork(meter, 1 + identity.length) ?? chargeResultEntries(meter, 4);
            if (admitted !== null) return admitted;
            const body = sources.bodies.get(identity);
            if (body === undefined) return fail("An executable field belongs to its actual checked body.");
            const nodeOf = (reference: Parameters<typeof sources.nodeOf>[0]) => {
              const owner = reference.kind === "item" ? reference.value.owner : reference.value.body;
              return chargeWork(meter, 18 + owner.length) === null ? sources.nodeOf(reference) : null;
            };
            const fields = checkedSourceObjectFieldsOf(body, {
              bodyOf: id => sources.bodies.get(id) ?? null, nodeOf, bindingOf: source.bindingOf,
              itemOf: definition => {
                if (chargeWork(meter, 12 + definition.length) !== null) return null;
                const reference = sources.declarationSourceOf(definition);
                return reference === null ? null : nodeOf(reference);
              }, typeOf: type => readType(source.types, type),
              admit: (work, records) => (chargeWork(meter, work) ?? chargeResultEntries(meter, records)) === null,
            });
            return { kind: "complete", value: node => {
              const paid = chargeWork(meter, 1);
              if (paid !== null) return paid;
              const access = nodeOf({ kind: "body", value: { body: identity, node } });
              const field = access?.kind === "PropertyAccessExpression" ? fields.field(access) : null;
              return accountFailure(meter) ?? { kind: "complete", value: field };
            } };
          },
          limits: inputs.limits.analyses },
        verification, resources: { account, conditionRefusal },
      }, { inventory: components.value, component: index, members,
        outside, maximumIterations: inputs.limits.summaries.maximumIterationsPerComponent, iterationRefusal });
      if (result.kind !== "complete") return analysisStop(result, unit);
      const setup = chargeResultEntries(account, 5);
      if (setup !== null) return analysisStop(setup, unit);
      const positions: UnitAnswerPosition[] = [];
      const endings: UnitAnswerPosition[] = [];
      const diagnostics: Diagnostic[] = [];
      const emissions: UnitDiagnostic[] = [];
      const published: PublishedBody[] = [];
      for (let position = 0; position < result.value.length; position += 1) {
        const read = chargeWork(account, 1) ?? chargeResultEntries(account, 7);
        if (read !== null) return analysisStop(read, unit);
        const row = result.value[position];
        if (row?.result.kind !== "ok") return fail("The actual component returns only final round results.");
        for (const items of [row.result.positions, row.result.diagnostics, row.result.emissions]) {
          const admitted = chargeWork(account, items.length) ?? chargeResultEntries(account, items.length);
          if (admitted !== null) return analysisStop(admitted, unit);
        }
        for (const entry of row.result.positions) if (entry.position.kind === "execution-source-node") positions.push(entry);
        for (const entry of row.result.diagnostics) diagnostics.push(entry);
        for (const entry of row.result.emissions) emissions.push(entry);
        const value = row.result.value;
        const answerPosition: UnitAnswerPosition = {
          position: { kind: "execution-result", execution: row.key }, error: "facts" in value ? null : value,
        };
        endings.push(answerPosition);
        published.push({ key: row.key, summaryKey: row.identity, facts: "facts" in value ? value.facts : null,
          answer: { value: "facts" in value ? value.summary : value, unit: { request: requested, position: answerPosition.position } } });
      }
      for (const ending of endings) positions.push(ending);
      return { kind: "ok", value: published, diagnostics, emissions, positions };
    },
  };
  const declaredSummaryOf: Query<SourceSemanticInputs, string, Summary, SourceSemanticWitness, DeclaredSignatureErrorData> = {
    name: "declaredSummaryOf", keyData: key => key, answerPolicy: { kind: "refusal-only" },
    compute: (_context, key) => {
      const selectedRead = chargeWork(account, 1);
      if (selectedRead !== null) return analysisStop(selectedRead, unit);
      const selected = declared?.get(key);
      if (selected === undefined) return fail("A declared Summary requires its actual selected ready declaration.");
      const { execution, placement, parameters, scope, guarantee } = selected;
      const { signature } = placement;
      const setup = chargeResultEntries(account, 1);
      if (setup !== null) return analysisStop(setup, unit);
      const callables: { readonly slot: ParameterSlot; readonly signatures: readonly [SigId, ...SigId[]] }[] = [];
      const given = (type: TyId, parameter: number | null): DataflowStop | null => {
        const read = chargeWork(account, 1);
        if (read !== null) return read;
        const term = readType(source.types, type);
        if (term.kind !== "callable" && term.kind !== "shape") return null;
        if (term.calls.length === 0) return null;
        const retained = chargeWork(account, term.calls.length) ?? chargeResultEntries(account, 4 + term.calls.length);
        if (retained !== null) return retained;
        const first = term.calls[0];
        if (first === undefined) return fail("A callable retains its actual dense signature inventory.");
        const signatures: [SigId, ...SigId[]] = [first];
        for (let index = 1; index < term.calls.length; index += 1) {
          const signature = term.calls[index];
          if (signature === undefined) return fail("A callable retains its actual dense signature inventory.");
          signatures.push(signature);
        }
        callables.push({ slot: parameter === null ? { kind: "receiver" } : { kind: "parameter", index: parameter }, signatures });
        return null;
      };
      if (signature.receiver !== null) {
        const stop = given(signature.receiver, null);
        if (stop !== null) return analysisStop(stop, unit);
      }
      for (let index = 0; index < parameters.length; index += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return analysisStop(read, unit);
        const mapping = parameters[index];
        if (mapping === undefined) return fail("A selected declared call retains ordered actual parameter mappings.");
        if (mapping.kind !== "argument" && mapping.kind !== "reference-argument" && mapping.kind !== "rest") continue;
        const formal = signature.parameters[index];
        if (formal === undefined) return fail("A selected declared call requires its corresponding formal.");
        const stop = given(formal.type, index);
        if (stop !== null) return analysisStop(stop, unit);
      }
      const bindingRead = chargeWork(account, 4);
      if (bindingRead !== null) return analysisStop(bindingRead, unit);
      const dependent = guarantee === null
        ? scope.classParameters.length + scope.methodParameters.length + scope.capturedParameters.length + scope.selfOwners.length !== 0
        : guarantee.statement.bindingDependent;
      let binding: DeclaredSummaryInput;
      if (guarantee === null) binding = { kind: "unknown", execution, scope, bindingDependent: dependent, suspends: false };
      else {
        const admission = chargeWork(account, 4);
        if (admission !== null) return analysisStop(admission, unit);
        const { statement } = guarantee;
        const { identity } = statement;
        if (identity.memberId !== null || statement.writes.length !== 0 || statement.captures.length !== 0 || statement.callbacks.length !== 0)
          return fail("The selected native guarantee requires its actual member, declared cell and callback relations.");
        const output = chargeResultEntries(account, 28);
        if (output !== null) return analysisStop(output, unit);
        binding = { kind: "native", guarantee, execution, associations: [{ kind: "callable", identity, request: placement.request,
          signature, scope, member: null, guarantee: identity }], cells: { execution, origin: identity, cells: [], producers: [], captures: [] },
          relations: { callbacks: [], resultCells: [], backing: [], concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [],
            returns: true, unwinds: true, initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }],
              points: [{ kind: "return" }, { kind: "unwind" }], rows: [{ point: 0, cell: null, condition: 0 }, { point: 1, cell: null, condition: 0 }] } } };
      }
      const built = pipelineWiring.summaries.bindDeclaredSummary({ account, signature, parameters, source: selected.source, callables }, binding);
      if (built.kind !== "complete") return analysisStop(built, unit);
      if (built.value.kind === "refused") return built.value;
      const summary = built.value.value;
      const checked = verifySummary(summary, { ...verification,
        bindingDependentOf: definition => definition === placement.request.definition ? dependent : verification.bindingDependentOf(definition),
        arenaOf: owner => owner.kind === "summary" && owner.key.kind === "declared" && owner.key.execution === execution
          ? summary.arena : verification.arenaOf(owner),
        callbackSignaturesOf: (requested, subject) => {
          if (requested !== summary.key) return verification.callbackSignaturesOf(requested, subject);
          const bound = summary.arena.boundProducers[subject];
          const producer = bound === undefined ? undefined : summary.arena.producers[bound.producer];
          if (producer?.kind !== "receiver" && producer?.kind !== "parameter") return null;
          return callables.find(row => row.slot.kind === "receiver" ? producer.kind === "receiver"
            : producer.kind === "parameter" && row.slot.index === producer.index)?.signatures ?? null;
        },
      }, { account, conditionRefusal });
      const stopped = accountFailure(account);
      if (stopped !== null) return analysisStop(stopped, unit);
      if (checked.kind !== "complete") return analysisStop(checked, unit);
      if (checked.violations.length !== 0) return fail(`The actual declared Summary violates ${checked.violations[0]?.rule}.`);
      const retained = chargeResultEntries(account, 11);
      if (retained !== null) return analysisStop(retained, unit);
      return { kind: "ok", value: summary, diagnostics: [], emissions: [], positions: [{ position: { kind: "result" }, error: null }] };
    },
  };
  const refusedAfterConvergence = (refusal?: Extract<Result<never>, { readonly kind: "refused" }>): Result<AnalysisBarrier> => {
    const diagnostics = typed.database.diagnostics();
    if (refusal !== undefined && diagnostics.length === refusal.diagnostics.length
      && diagnostics.every((diagnostic, index) => diagnostic === refusal.diagnostics[index])) return refusal;
    const [first, ...rest] = diagnostics;
    if (first === undefined) return fail("An unsuccessful convergence retains its actual diagnostic.");
    return { kind: "refused", diagnostics: [first, ...rest] };
  };
  let errorValued = false;
  for (let index = 0; index < components.value.components.length; index += 1) {
    const read = chargeWork(account, 1);
    if (read !== null) return analysisStop(read, unit);
    const component = components.value.components[index];
    if (component === undefined) return fail("The canonical component inventory is dense.");
    if (component.kind === "declared") {
      const operationRead = chargeWork(account, 1);
      if (operationRead !== null) return analysisStop(operationRead, unit);
      const selected = operations[component.operation];
      const key = operationIdentities[component.operation];
      if (selected?.kind !== "declared" || key === undefined) return fail("A declared component retains its actual admitted execution.");
      const result = typed.database.run(declaredSummaryOf, key);
      if (result.kind === "refused") return refusedAfterConvergence(result);
      const previous = bindingDependence.get(selected.execution.request.definition);
      if (previous !== undefined && previous !== result.value.bindingDependent)
        return fail("All selected entries retain the same authored declaration dependence.");
      bindingDependence.set(selected.execution.request.definition, result.value.bindingDependent);
      summaries.set(key, { value: result.value, unit: { request: { query: declaredSummaryOf.name, key }, position: { kind: "result" } } });
      continue;
    }
    const key = componentKeys[index];
    if (key === null || key === undefined) return fail("A component requires its actual first complete execution key.");
    const result = typed.database.run(bodyFactsOf, key);
    if (result.kind === "refused") return refusedAfterConvergence(result);
    for (const row of result.value) {
      summaries.set(row.summaryKey, row.answer);
      if (row.facts !== null) facts.set(row.key, row.facts);
      else errorValued = true;
    }
  }
  if (errorValued) return refusedAfterConvergence();
  const diagnostics = typed.database.diagnostics();
  const entries: Execution[] = [];
  for (const body of exposedBodies) {
    const read = chargeWork(account, 1);
    if (read !== null) return analysisStop(read, unit);
    const actual = operationsByBody.get(body);
    if (actual !== undefined) {
      const growth = chargeWork(account, actual.length) ?? chargeResultEntries(account, actual.length);
      if (growth !== null) return analysisStop(growth, unit);
      for (const operation of actual) entries.push(operation.execution);
      continue;
    }
    const checked = sources.bodies.get(body);
    const scope = checked === undefined ? undefined : source.descriptions.get(checked.owner)?.generics;
    const template = typed.bodies.get(instanceKey({ body, bindings: { kind: "parametric" } }));
    if (template === undefined || scope === undefined || scope.classParameters.length + scope.methodParameters.length
      + scope.capturedParameters.length + scope.selfOwners.length === 0)
      return fail("An external callable entry requires its actual completed execution or generic template.");
  }
  const plan: Execution[] = [];
  for (let index = 0; index < typed.initializationRoots.length; index += 1) {
    const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
    if (stop !== null) return analysisStop(stop, unit);
    const root = typed.initializationRoots[index];
    const execution = root === undefined ? undefined : moduleExecutions.get(root.origin.module);
    if (execution === undefined || execution.instance.body !== root?.tsonic.body || execution.provided !== 0)
      return fail("A reachable source module requires its actual selected initializer execution.");
    plan.push(execution);
  }
  const summaryOf = (key: SummaryKey): SummaryAnswer => summaries.get(summaryKey(key))
    ?? fail("Initialization proof requires each actual completed stable summary.");
  const exposed = bindExternalStorage(typed.exposure.selections, plan, sources, summaryOf, account);
  if (exposed.kind !== "complete") return analysisStop(exposed, unit);
  const initialized = pipelineWiring.bodyAnalysis.proveInitialization({
    account, unit, conditionRefusal, maximumConditionAlternatives: inputs.limits.analyses.maximumConditionAlternatives,
    summaryOf,
    originOf: reference => sources.nodeOf(reference)?.origin ?? null,
    declarationOriginOf: definition => {
      const reference = sources.declarationSourceOf(definition);
      return reference === null ? null : sources.nodeOf(reference)?.origin ?? null;
    },
    originAt: position => {
      if (position.kind === "declared") return sources.nodeOf(position.source)?.origin ?? null;
      const block = mir.get(instanceKey(position.execution.instance))?.blocks[position.point.block];
      const operation = position.point.statement === null ? block?.terminator : block?.statements[position.point.statement];
      return operation?.origin ?? null;
    },
  }, { modules: plan, entries, storage: exposed.value.storage });
  if (initialized.kind !== "complete") return analysisStop(initialized, unit);
  if (initialized.value.kind === "refused") return initialized.value;
  if ("kind" in initialized.value.value) {
    const reported = initialized.value.diagnostics;
    const first = reported[0];
    if (first === undefined) return fail("The original initialization error requires its actual source diagnostics.");
    const growth = chargeWork(account, diagnostics.length + reported.length)
      ?? chargeResultEntries(account, diagnostics.length + reported.length + 1);
    return growth === null ? { kind: "refused", diagnostics: [first, ...reported.slice(1), ...diagnostics] } : analysisStop(growth, unit);
  }
  const planGrowth = chargeResultEntries(account, 1);
  if (planGrowth !== null) return analysisStop(planGrowth, unit);
  const initialization: ProgramInitialization = { entry: inputs.snapshot.entryPoint, external: exposed.value.external,
    modules: plan, entries };
  return { kind: "ok", diagnostics, value: { inventory: components.value, mir, observations, facts, summaries,
    constants: staticValues.value.constants, metadata: staticValues.value.metadata, verification, initialization } };
}
