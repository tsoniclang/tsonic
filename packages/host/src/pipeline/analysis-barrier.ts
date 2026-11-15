import type { CallerRefusal, DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Diagnostic, Result, UnitRequest } from "../diag/contract.js";
import { resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, NodeRef } from "../ids/contract.js";
import type { BodyFacts, BodyObservations, DependencyInventory, ExecutionDependency, FactsVerificationContext,
  SummaryAnswer, SummaryKey } from "../ir-facts/contract.js";
import { admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import type { MirBody, MirTerminator } from "../ir-mir/contract.js";
import { verifyMir } from "../ir-mir/index.js";
import type { BodyInstance, Execution } from "../ir-types/contract.js";
import { executionKey, instanceKey, internType, readSignature, readType, viewTypes } from "../ir-types/index.js";
import type { Query } from "../query/contract.js";
import type { BodyRoundValue } from "../analyses/body/contract.js";
import type { ErrorValue } from "../diag/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { TypedSourceBarrier } from "./typed-barrier.js";
import type { InternalBodyInput } from "../lower-mir/contract.js";
import type { NodeId } from "../ids/contract.js";
import type { ParameterDeclaration } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { checkedSourceViews } from "./checked-inputs.js";
import { lowerMirDeps, mirVerificationContext } from "./lower-mir-step.js";
import { pipelineWiring } from "./wiring.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export function analysisStop(stop: DataflowStop, unit: UnitRequest): Extract<Result<never>, { readonly kind: "refused" }> {
  if (stop.kind === "refused") return stop;
  return { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline", limit: stop.dimension,
    maximum: stop.maximum, site: { kind: "none" }, unit: { request: unit, position: { kind: "result" } } })] };
}

export interface AnalysisBarrier {
  readonly inventory: DependencyInventory;
  readonly mir: ReadonlyMap<string, MirBody>;
  readonly observations: ReadonlyMap<string, BodyObservations>;
  readonly facts: ReadonlyMap<string, BodyFacts>;
  readonly summaries: ReadonlyMap<string, SummaryAnswer>;
  readonly verification: FactsVerificationContext;
}

export function analyzeTypedSource(inputs: HostAnalysisInputs, typed: TypedSourceBarrier, account: DataflowAccount): Result<AnalysisBarrier> {
  const unit: UnitRequest = { query: "AnalyzeHostProgram", key: inputs.snapshot.packages.fingerprint };
  const callIndexGrowth = chargeResultEntries(account, 1);
  if (callIndexGrowth !== null) return analysisStop(callIndexGrowth, unit);
  const { source } = typed;
  const sources = checkedSourceViews(source.modules);
  const table = viewTypes(source.types);
  const mir = new Map<string, MirBody>();
  const callSites = new Map<MirBody, ReadonlyMap<NodeId, readonly Extract<MirTerminator, { readonly kind: "call" }>[]>>();
  const observations = new Map<string, BodyObservations>();
  const parameterHeaders = new Map<string, ReadonlyMap<NodeId, ParameterDeclaration<TypedPhase>>>();
  const facts = new Map<string, BodyFacts>();
  const summaries = new Map<string, SummaryAnswer>();
  const operations: SummaryKey[] = [];
  const known = new Set<string>();
  const dependencies: ExecutionDependency[] = [];
  const moduleExecutions: Execution[] = [];
  const entries: Execution[] = [];
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
  const add = (key: SummaryKey): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const identityWork = admitSummaryIdentity(key, account);
    if (identityWork !== null) return identityWork;
    const identity = summaryKey(key);
    if (known.has(identity)) return null;
    const growth = chargeResultEntries(account, 2);
    if (growth !== null) return growth;
    known.add(identity);
    operations.push(key);
    return null;
  };
  for (const body of typed.bodies.values()) {
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
    const headers = new Map<NodeId, ParameterDeclaration<TypedPhase>>();
    const include = (child: BodyId): DataflowStop | null => {
      const work = chargeWork(account, 1);
      if (work !== null) return work;
      if (included.has(child)) return null;
      const growth = chargeResultEntries(account, 3);
      if (growth !== null) return growth;
      const instance: BodyInstance = { body: child, bindings: body.bindings };
      const selected = readyBody(instance);
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
      headers.set(header.id, header);
      if (header.tsonic.initializer !== null) {
        const stop = include(header.tsonic.initializer);
        if (stop !== null) return analysisStop(stop, unit);
      }
    }
    const lowered = pipelineWiring.lowerMir.lowerToMir(lowerMirDeps(run,
      { request: { query: "mirBody", key: identity }, position: { kind: "result" } }), body, internal);
    if (lowered.kind === "refused") return lowered;
    const verified = verifyMir(lowered.value, mirVerificationContext(run, body));
    if (verified.kind === "resource-limit") return analysisStop(verified, unit);
    if (verified.violations.length !== 0) return fail(`The actual LowerMir result violates ${verified.violations[0]?.rule}.`);
    const callGrowth = chargeResultEntries(account, 2);
    if (callGrowth !== null) return analysisStop(callGrowth, unit);
    const calls = new Map<NodeId, Extract<MirTerminator, { readonly kind: "call" }>[]>();
    for (let index = 0; index < lowered.value.blocks.length; index += 1) {
      const read = chargeWork(account, 1);
      if (read !== null) return analysisStop(read, unit);
      const block = lowered.value.blocks[index];
      if (block === undefined) return fail("The actual verified graph block inventory is dense.");
      const terminator = block.terminator;
      if (terminator.kind !== "call" || terminator.callee.kind === "body") continue;
      const rows = calls.get(terminator.tir.node);
      const growth = chargeResultEntries(account, rows === undefined ? 3 : 1);
      if (growth !== null) return analysisStop(growth, unit);
      if (rows === undefined) calls.set(terminator.tir.node, [terminator]);
      else rows.push(terminator);
    }
    callSites.set(lowered.value, calls);
    const growth = chargeResultEntries(account, 3);
    if (growth !== null) return analysisStop(growth, unit);
    mir.set(identity, lowered.value);
    parameterHeaders.set(identity, headers);
    const checked = sources.bodies.get(body.body);
    if (checked === undefined) return fail("An observation inventory requires its actual checked execution.");
    const original = source.modules.find(module => module.module.module === body.root.origin.module);
    if (original === undefined) return fail("A selected execution has no original module.");
    for (const node of original.nodes) {
      if (sources.nodeOf({ kind: "body", value: { body: checked.body, node: node.id } }) !== node) continue;
      const captured = node.tsonic;
      if (captured !== null && "observation" in captured && (captured.observation.kind !== "available" || captured.observation.value !== null))
        return fail("The actual observation capture requires its checked descriptor-to-MetadataKey Layout producer.");
    }
    observations.set(identity, { instance, rows: [] });
    for (const entry of lowered.value.entries) {
      const execution: Execution = { instance, provided: entry.provided };
      const stopped = add({ kind: "body", execution });
      if (stopped !== null) return analysisStop(stopped, unit);
      if (body.root.kind === "SourceFile") moduleExecutions.push(execution);
      else if ((source.descriptions.get(body.owner)?.exports.length ?? 0) !== 0) entries.push(execution);
    }
  }
  const callableEntriesAt = (at: NodeRef, definition: DefId): readonly SummaryKey[] | null => {
    const current = sources.bodies.get(at.body);
    const sourceNode = current === undefined ? null : sources.nodeOf({ kind: "body", value: at });
    if (sourceNode === null) return null;
    const itemSource = sources.declarationSourceOf(definition);
    const declaration = itemSource === null ? null : sources.nodeOf(itemSource);
    if (declaration === null || declaration.kind !== "FunctionDeclaration") return null;
    if (declaration.tsonic.body === null) return null;
    const result: SummaryKey[] = [];
    for (const key of operations) if (key.kind === "body" && key.execution.instance.body === declaration.tsonic.body) {
      const currentBody = readyBody(key.execution.instance);
      if (currentBody.owner !== definition || !declaration.tsonic.signatures.some(endpoint => endpoint.role === "api-body"
        && endpoint.body === currentBody.body && endpoint.signature === currentBody.signature)) continue;
      result.push(key);
    }
    return result.length === 0 ? null : result;
  };
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    if (operation === undefined || operation.kind !== "body")
      return fail("A declared required operation needs its actual selected native guarantee association and binder.");
    const body = readyBody(operation.execution.instance);
    const headers = parameterHeaders.get(instanceKey(operation.execution.instance));
    if (headers === undefined) return fail("A selected execution retains its actual verified parameter-header inventory.");
    const initializerAt = (at: NodeRef, initializer: BodyId | BodyInstance): SummaryKey | null => {
      if (at.body !== body.body) return fail("An initializer occurrence must belong to the requesting actual selected execution.");
      const header = headers.get(at.node);
      const occurrence = header ?? sources.nodeOf({ kind: "body", value: at });
      if (occurrence === null || occurrence.kind !== "Parameter" && occurrence.kind !== "VariableDeclaration"
        && occurrence.kind !== "PropertyDeclaration" && occurrence.kind !== "EnumMember") return null;
      if (occurrence.tsonic.initializer === null) return null;
      const instance: BodyInstance = typeof initializer === "string"
        ? { body: initializer, bindings: operation.execution.instance.bindings } : initializer;
      if (instance.body !== occurrence.tsonic.initializer || instanceKey(instance) !== instanceKey({
        body: occurrence.tsonic.initializer, bindings: operation.execution.instance.bindings })) return null;
      const selected = readyBody(instance);
      const graph = mir.get(instanceKey(instance));
      const signature = readSignature(source.types, selected.signature);
      const entry = graph?.entries[0];
      if (graph === undefined || entry === undefined || graph.entries.length !== 1 || signature.receiver !== null
        || signature.parameters.length !== 0 || entry.provided !== 0)
        return fail("A placed initializer requires its actual selected parameterless entry and verified graph.");
      return { kind: "body", execution: { instance, provided: entry.provided } };
    };
    const calleeAt: Parameters<typeof pipelineWiring.summaries.dependenciesOf>[0]["calleeAt"] = (at, callee) => {
      if (at.body !== body.body) return fail("A selected call occurrence belongs to its actual requesting execution.");
      const original = sources.nodeOf({ kind: "body", value: at });
      if (original?.kind !== "CallExpression" || original.tsonic.application.kind !== "available") return null;
      const captured = original.tsonic.application.value;
      const decision = callee.decision;
      const currentGraph = mir.get(instanceKey(operation.execution.instance));
      const calls = currentGraph === undefined ? undefined : callSites.get(currentGraph)?.get(at.node);
      let selectedCall: Extract<MirTerminator, { readonly kind: "call" }> | null = null;
      for (let position = 0; position < (calls?.length ?? 0); position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return null;
        const call = calls?.[position];
        if (call === undefined) return fail("The actual selected call-site projection is dense.");
        if (call.callee.kind !== "body" && call.callee.resolution === callee) {
          if (selectedCall !== null) return fail("A selected call must name one actual verified MIR occurrence.");
          selectedCall = call;
        }
      }
      if (selectedCall === null || selectedCall.callee.kind !== "direct") return null;
      if (captured.kind !== "call" || captured.receiver !== null || captured.arguments.length !== decision.parameters.length
        || decision.api.body === null || callee.activation === null
        || callee.activation.body !== decision.api.body) return null;
      if (selectedCall.arguments.length !== decision.parameters.length)
        return fail("The actual selected call retains its complete MIR argument dispositions.");
      const execution: Execution = { instance: callee.activation, provided: selectedCall.arguments.length };
      const stop = admitSummaryIdentity({ kind: "body", execution }, account);
      if (stop !== null) return null;
      const selected = readyBody(execution.instance);
      const graph = mir.get(instanceKey(execution.instance));
      const signatureRead = chargeWork(account, 1);
      if (signatureRead !== null) return null;
      const signature = readSignature(source.types, decision.api.signature);
      if (selected.owner !== decision.api.declaration || selected.signature !== signature.id
        || signature.parameters.length !== decision.parameters.length || signature.receiver !== null || graph === undefined)
        return fail("A selected call retains its actual API body, authoritative signature and offered entry.");
      for (let parameter = 0; parameter < decision.parameters.length; parameter += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return null;
        const mapping = decision.parameters[parameter];
        const argument = selectedCall.arguments[parameter];
        const original = captured.arguments[parameter];
        if (mapping?.kind !== "argument" || mapping.parameter !== parameter || mapping.argument !== parameter
          || mapping.component !== null || mapping.passing !== "by-value" || original?.kind !== "value"
          || argument?.kind !== "value" || argument.passing !== mapping.passing)
          return null;
      }
      let found = false;
      for (let position = 0; position < graph.entries.length; position += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return null;
        const entry = graph.entries[position];
        if (entry === undefined) return fail("The actual offered entry inventory is dense.");
        if (entry.provided === execution.provided) {
          if (found) return fail("A selected provided count names one actual offered entry.");
          found = true;
        }
      }
      if (!found) return fail("A selected call requires its actual offered provided-count entry.");
      return { kind: "body", execution };
    };
    const discovered = pipelineWiring.summaries.dependenciesOf({ account, callableEntriesAt,
      signatureOf: signature => readSignature(source.types, signature), calleeAt, initializerAt,
      operationEntriesAt: () => null, dispatchEntriesAt: () => null },
    { execution: operation.execution, tir: body });
    if (discovered.kind !== "complete") return analysisStop(discovered, unit);
    for (const key of discovered.value.operations) {
      const stop = add(key);
      if (stop !== null) return analysisStop(stop, unit);
    }
    for (const edge of discovered.value.dependencies) {
      const stop = chargeResultEntries(account, 1);
      if (stop !== null) return analysisStop(stop, unit);
      dependencies.push(edge);
    }
  }
  const conditionRefusal: CallerRefusal = { kind: "refused", diagnostics: [resourceLimitDiagnostic({ owner: "pipeline",
    limit: "condition alternatives", maximum: inputs.limits.analyses.maximumConditionAlternatives,
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
    signatureIdOf: request => {
      const description = typed.declarationOf(request.definition);
      const endpoint = description?.endpoints.filter(endpoint => endpoint.role === request.endpoint)[request.ordinal];
      return endpoint?.signature ?? null;
    }, declarationSourceOf: sources.declarationSourceOf,
    diagnostics: source.modules.flatMap(module => module.module.checkerDiagnostics),
    bindingDependentOf: definition => {
      const candidates = [...typed.bodies.values()].filter(body => body.owner === definition);
      return candidates.length === 0 ? null : candidates.some(body => body.dependence === "binding-dependent");
    },
    captureCount: key => key.kind === "body" ? readyBody(key.execution.instance).captures.length : null,
    callbackSignaturesOf: () => null,
    arenaOf: owner => {
      const answer = summaries.get(summaryKey(owner.kind === "body" ? { kind: "body", execution: owner.execution } : owner.key));
      return answer !== undefined && !("kind" in answer.value) ? answer.value.arena : null;
    },
    summaryOf: key => {
      const answer = summaries.get(summaryKey(key));
      return answer !== undefined && !("kind" in answer.value) ? answer.value : null;
    },
    libraryExportExists: () => false, declaredSiteCount: () => null };
  const componentOf = new Map<string, number>();
  for (const [index, component] of components.value.components.entries()) if (component.kind === "body")
    for (const member of component.members) {
      const operation = operations[member];
      if (operation === undefined) return fail("The canonical component inventory is dense.");
      componentOf.set(summaryKey(operation), index);
    }
  const bodyFactsOf: Query<SourceSemanticInputs, Execution, BodyRoundValue | ErrorValue, SourceSemanticWitness, DeclaredSignatureErrorData> = {
    name: "bodyFactsOf", keyData: executionKey, answerPolicy: { kind: "refusal-only" },
    compute: (context, execution) => {
      const index = componentOf.get(summaryKey({ kind: "body", execution }));
      const component = index === undefined ? undefined : components.value.components[index];
      if (component === undefined || component.kind !== "body" || component.members.length !== 1)
        return fail("The actual multi-member convergence requires its genuine stable-batch producer and per-member unit positions.");
      const outsideGrowth = chargeResultEntries(account, 2);
      if (outsideGrowth !== null) return analysisStop(outsideGrowth, unit);
      const outside: { readonly key: SummaryKey; readonly answer: SummaryAnswer }[] = [];
      const outsideKeys = new Set<string>();
      for (const row of component.rows) {
        const read = chargeWork(account, 1);
        if (read !== null) return analysisStop(read, unit);
        const dependency = dependencies[row];
        if (dependency === undefined) return fail("A component dependency row must retain its actual closed inventory index.");
        const admission = admitSummaryIdentity(dependency.target, account);
        if (admission !== null) return analysisStop(admission, unit);
        const key = summaryKey(dependency.target);
        if (outsideKeys.has(key)) continue;
        const answer = summaries.get(key);
        if (answer === undefined) return fail("The selected component requires its already completed exact outside answer.");
        const growth = chargeResultEntries(account, 3);
        if (growth !== null) return analysisStop(growth, unit);
        outsideKeys.add(key);
        outside.push({ key: dependency.target, answer });
      }
      const graph = mir.get(instanceKey(execution.instance));
      if (graph === undefined || index === undefined) return fail("A body round requires its actual verified graph and component.");
      const result = pipelineWiring.summaries.convergeComponent({
        analyzeStorageUse: pipelineWiring.liveness.analyzeStorageUse, analyzeBodyRound: pipelineWiring.bodyAnalysis.analyzeBodyRound,
        environment: { types: table, typeOf: type => readType(source.types, type),
          signatureOf: signature => readSignature(source.types, signature), limits: inputs.limits.analyses },
        verification, resources: { account, conditionRefusal },
      }, { inventory: components.value, component: index,
        members: [{ execution, mir: graph, tir: readyBody(execution.instance), unit: { query: context.fact.query, key: context.fact.key } }],
        outside, maximumIterations: inputs.limits.summaries.maximumIterationsPerComponent, iterationRefusal: conditionRefusal });
      if (result.kind !== "complete") return analysisStop(result, unit);
      const actual = result.value[0];
      if (actual === undefined) return fail("A singleton component returns its one actual round result.");
      return actual.result;
    },
  };
  const diagnostics: Diagnostic[] = [];
  for (const component of components.value.components) {
    if (component.kind !== "body") return fail("A declared component needs its genuine admitted selected native association.");
    for (const member of component.members) {
      const operation = operations[member];
      if (operation?.kind !== "body") return fail("The selected body component retains actual body operations.");
      const result = typed.database.run(bodyFactsOf, operation.execution);
      if (result.kind === "refused") return result;
      diagnostics.push(...result.diagnostics);
      const answer: SummaryAnswer = { value: "facts" in result.value ? result.value.summary : result.value,
        unit: { request: { query: bodyFactsOf.name, key: executionKey(operation.execution) }, position: { kind: "result" } } };
      summaries.set(summaryKey(operation), answer);
      if (!("facts" in result.value)) {
        const first = result.diagnostics[0];
        if (first === undefined) return fail("An error-valued body requires its original grounded diagnostic.");
        return { kind: "refused", diagnostics: [first, ...result.diagnostics.slice(1)] };
      }
      facts.set(executionKey(operation.execution), result.value.facts);
    }
  }
  const initialized = pipelineWiring.bodyAnalysis.proveInitialization({ account, unit, summaryOf: key => summaries.get(summaryKey(key))
    ?? fail("Initialization proof requires each actual completed stable summary.") }, { modules: moduleExecutions, entries, storage: [] });
  if (initialized.kind !== "complete") return analysisStop(initialized, unit);
  if (initialized.value.kind === "refused") return initialized.value;
  if ("kind" in initialized.value.value) return fail("The original initialization error requires its actual source diagnostics.");
  return { kind: "ok", diagnostics, value: { inventory: components.value, mir, observations, facts, summaries, verification } };
}
