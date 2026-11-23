import type { CallerRefusal, DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Diagnostic, Result, UnitAnswerPosition, UnitDiagnostic, UnitRequest } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId } from "../ids/contract.js";
import type { BodyFacts, BodyObservations, DependencyInventory, FactsVerificationContext,
  SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import type { MirBody } from "../ir-mir/contract.js";
import { verifyMir } from "../ir-mir/index.js";
import type { BodyInstance, Execution } from "../ir-types/contract.js";
import { executionKey, instanceKey, internType, readSignature, readType, viewTypes } from "../ir-types/index.js";
import type { Query } from "../query/contract.js";
import type { ConvergenceMember } from "../summaries/contract.js";
import type { ProgramInitialization } from "../ir-program/contract.js";
import type { ErrorValue } from "../diag/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { InternalBodyInput } from "../lower-mir/contract.js";
import type { CheckedBodyNodeRange } from "./checked-inputs.js";
import { analysisStop } from "./analysis-stop.js";
import { checkedSourceViews } from "./checked-inputs.js";
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
  const observations = new Map<string, BodyObservations>();
  const facts = new Map<string, BodyFacts>();
  const summaries = new Map<string, SummaryAnswer>();
  const { operations, operationIdentities, operationsByBody, dependencies, moduleExecutions } = typed.required;
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
    if (body.bindings.kind !== "instantiated") continue;
    const instance: BodyInstance = { body: body.body, bindings: body.bindings };
    const identity = instanceKey(instance);
    const safe = typed.database.run(safety, instance);
    if (safe.kind === "refused") return safe;
    if (safe.value !== null) {
      const first = safe.diagnostics[0];
      if (first === undefined) return fail("A safety error requires its actual original diagnostic.");
      return { kind: "refused", diagnostics: [first, ...safe.diagnostics.slice(1)] };
    }
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
    const requiredEntries = typed.required.provided.get(identity) ?? fail("Each selected body needs its independently required entries.");
    const lowered = pipelineWiring.lowerMir.lowerToMir(lowerMirDeps(run,
      { request: { query: "mirBody", key: identity }, position: { kind: "result" } }), body, internal, requiredEntries);
    if (lowered.kind === "refused") return lowered;
    const verified = verifyMir(lowered.value, mirVerificationContext(run, body, requiredEntries));
    if (verified.kind === "resource-limit") return analysisStop(verified, unit);
    if (verified.violations.length !== 0) return fail(`The actual LowerMir result violates ${verified.violations[0]?.rule}.`);
    const growth = chargeResultEntries(account, 3);
    if (growth !== null) return analysisStop(growth, unit);
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
      if (observation.kind !== "available" || observation.value !== null)
        return fail("The actual observation capture requires its checked descriptor-to-MetadataKey Layout producer.");
    }
    observationRanges.delete(body.body);
    observations.set(identity, { instance, rows: [] });
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
  const verification: FactsVerificationContext = { types: table, limits: inputs.limits.analyses,
    bindingScopeOf: definition => source.descriptions.get(definition)?.generics ?? null,
    sourceBindingScopesOf: () => null,
    nominalOf: source.nominalOf, nodeExists: node => sources.nodeOf(node) !== null, localExists: sources.localExists,
    definitionExists: definition => source.descriptions.has(definition), metadataOf: () => null,
    bodyOwner: body => sources.bodies.get(body)?.owner ?? null, tirBody: readyBody,
    mirBody: instance => mir.get(instanceKey(instance)) ?? null,
    signatureIdOf: typed.signatureIdOf, declarationSourceOf: sources.declarationSourceOf,
    diagnostics: source.modules.flatMap(module => module.module.checkerDiagnostics),
    bindingDependentOf: definition => bindingDependence.get(definition) ?? null,
    captureCount: key => key.kind === "body" ? readyBody(key.execution.instance).captures.length : null,
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
        environment: { types: table, typeOf: type => readType(source.types, type),
          signatureOf: signature => readSignature(source.types, signature),
          staticModuleBindingsOf: module => moduleExecutions.get(module)?.instance.bindings ?? null,
          staticTypeOf: reference => reference.kind === "item" ? typed.staticStorageOf(reference.value) : null,
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
    if (component.kind !== "body") return fail("A declared component needs its genuine admitted selected native association.");
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
  return { kind: "ok", diagnostics, value: { inventory: components.value, mir, observations, facts, summaries, verification, initialization } };
}
