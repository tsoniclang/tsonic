import type { DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { Result, UnitRequest } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, ModuleId, NodeRef, SourceNodeRef } from "../ids/contract.js";
import type { ExecutionDependency, SummaryKey } from "../ir-facts/contract.js";
import type { ParameterMapping, PlacedSignature } from "../ir-infer/contract.js";
import { admitArtifactIdentity, admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import type { TirBody } from "../ir-tir/contract.js";
import type { BindingScope, BodyInstance, DeclaredExecution, Execution, Signature, SignatureRequest } from "../ir-types/contract.js";
import { artifactBindingsKey, instanceKey, readSignature, signatureRequestKey } from "../ir-types/index.js";
import type { AdmittedNativeGuarantee } from "../libraries/contract.js";
import type { SourceBarrier } from "./source-barrier.js";
import type { CheckedSourceViews } from "./checked-inputs.js";
import { analysisStop } from "./analysis-stop.js";
import { pipelineWiring } from "./wiring.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

type BodyOperation = Extract<SummaryKey, { readonly kind: "body" }>;
type DeclaredPlacement = PlacedSignature & { readonly request: SignatureRequest };

export interface ReadyDeclaredExecution {
  readonly execution: DeclaredExecution;
  readonly placement: DeclaredPlacement;
  readonly source: SourceNodeRef;
  readonly scope: BindingScope;
  readonly parameters: readonly ParameterMapping[];
  readonly guarantee: AdmittedNativeGuarantee | null;
}

export interface RequiredExecutions {
  readonly operations: readonly SummaryKey[];
  readonly operationIdentities: readonly string[];
  readonly operationsByBody: ReadonlyMap<BodyId, readonly BodyOperation[]>;
  readonly dependencies: readonly ExecutionDependency[];
  readonly moduleExecutions: ReadonlyMap<ModuleId, Execution>;
  readonly provided: ReadonlyMap<string, readonly number[]>;
  readonly declared: ReadonlyMap<string, ReadyDeclaredExecution> | null;
  readonly declaredPlacements: ReadonlyMap<string, DeclaredPlacement> | null;
}

export function prepareRequiredExecutions(source: SourceBarrier, sources: CheckedSourceViews, roots: Iterable<TirBody>,
  requireBody: (instance: BodyInstance) => Result<TirBody>, readDeclared: (request: SignatureRequest) => Signature | null,
  account: DataflowAccount, unit: UnitRequest): Result<RequiredExecutions> {
  const setup = chargeResultEntries(account, 7);
  if (setup !== null) return analysisStop(setup, unit);
  const operations: SummaryKey[] = [];
  const operationIdentities: string[] = [];
  const operationsByBody = new Map<BodyId, BodyOperation[]>();
  const known = new Set<string>();
  const dependencies: ExecutionDependency[] = [];
  const moduleExecutions = new Map<ModuleId, Execution>();
  const counts = new Map<string, { readonly values: Set<number>; minimum: number; maximum: number }>();
  let declared: Map<string, ReadyDeclaredExecution> | null = null;
  let declaredPlacements: Map<string, DeclaredPlacement> | null = null;
  const declaredOf = (identity: string): ReadyDeclaredExecution | undefined => declared?.get(identity);

  const add = (key: SummaryKey): DataflowStop | null => {
    const work = chargeWork(account, 1);
    if (work !== null) return work;
    const identityWork = admitSummaryIdentity(key, account);
    if (identityWork !== null) return identityWork;
    const identity = summaryKey(key);
    if (known.has(identity)) return null;
    let offered: BodyOperation[] | undefined;
    if (key.kind === "body") {
      const indexWork = chargeWork(account, 1);
      if (indexWork !== null) return indexWork;
      offered = operationsByBody.get(key.execution.instance.body);
    }
    const growth = chargeResultEntries(account, 3 + (key.kind !== "body" ? 0 : offered === undefined ? 3 : 1));
    if (growth !== null) return growth;
    known.add(identity);
    operations.push(key);
    operationIdentities.push(identity);
    if (key.kind === "body") {
      if (offered === undefined) operationsByBody.set(key.execution.instance.body, [key]);
      else offered.push(key);
      const admitted = chargeWork(account, 1);
      if (admitted !== null) return admitted;
      const selected = instanceKey(key.execution.instance);
      const group = counts.get(selected);
      const retain = chargeResultEntries(account, group === undefined ? 4 : 1);
      if (retain !== null) return retain;
      const { provided } = key.execution;
      if (group === undefined) counts.set(selected, { values: new Set([provided]), minimum: provided, maximum: provided });
      else { group.values.add(provided); group.minimum = Math.min(group.minimum, provided); group.maximum = Math.max(group.maximum, provided); }
    }
    return null;
  };

  for (const body of roots) {
    if (body.bindings.kind !== "instantiated") continue;
    const instance = { body: body.body, bindings: body.bindings };
    const signatureWork = chargeWork(account, 1);
    if (signatureWork !== null) return analysisStop(signatureWork, unit);
    const formals = readSignature(source.types, body.signature).parameters;
    for (let provided = formals.length; ; provided -= 1) {
      const execution: Execution = { instance, provided };
      const stopped = add({ kind: "body", execution });
      if (stopped !== null) return analysisStop(stopped, unit);
      if (provided === 0) break;
      const formalWork = chargeWork(account, 1);
      if (formalWork !== null) return analysisStop(formalWork, unit);
      const formal = formals[provided - 1];
      if (formal === undefined) return fail("The selected signature has a dense ordinary formal inventory.");
      if (!formal.acceptsOmission) break;
    }
  }

  const callableEntriesAt = (at: NodeRef, definition: DefId): readonly SummaryKey[] | null => {
    if (sources.nodeOf({ kind: "body", value: at }) === null) return null;
    const itemSource = sources.declarationSourceOf(definition);
    const declaration = itemSource === null ? null : sources.nodeOf(itemSource);
    if (declaration?.kind !== "FunctionDeclaration" || declaration.tsonic.definition !== definition) return null;
    const body = declaration.tsonic.body;
    if (body === null || sources.bodies.get(body)?.owner !== definition) return null;
    const scope = source.descriptions.get(definition)?.generics;
    if (scope === undefined || scope.classParameters.length + scope.capturedParameters.length + scope.methodParameters.length
      + scope.selfOwners.length !== 0) return null;
    for (let index = 0; index < declaration.tsonic.signatures.length; index += 1) {
      if (chargeWork(account, 1) !== null) return null;
      const endpoint = declaration.tsonic.signatures[index];
      if (endpoint === undefined) return fail("The checked callable's signature inventory is dense.");
      if (endpoint.role !== "api-body" || endpoint.body !== body || endpoint.declaration !== definition) continue;
      const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 7);
      if (setup !== null) return null;
      const signature = readSignature(source.types, endpoint.signature);
      const instance: BodyInstance = { body, bindings: { kind: "instantiated",
        bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } };
      const entries: SummaryKey[] = [];
      for (let provided = signature.parameters.length; ; provided -= 1) {
        if (chargeWork(account, 1) ?? chargeResultEntries(account, 2)) return null;
        entries.push({ kind: "body", execution: { instance, provided } });
        if (provided === 0 || !signature.parameters[provided - 1]?.acceptsOmission) break;
      }
      return entries;
    }
    return null;
  };
  for (let index = 0; index < operations.length; index += 1) {
    const operation = operations[index];
    if (operation === undefined) return fail("The required execution inventory must be dense.");
    if (operation.kind === "declared") {
      const identity = operationIdentities[index];
      if (identity === undefined || declaredOf(identity) === undefined)
        return fail("A declared required operation needs its actual completed signature and scope.");
      continue;
    }
    const required = requireBody(operation.execution.instance);
    if (required.kind === "refused") return required;
    const body = required.value;
    if (body.root.kind === "SourceFile") {
      const admit = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (admit !== null) return analysisStop(admit, unit);
      if (operation.execution.provided !== 0 || moduleExecutions.has(body.root.origin.module)) return fail("A source module must have one actual initializer execution.");
      moduleExecutions.set(body.root.origin.module, operation.execution);
    }
    const initializerAt: Parameters<typeof pipelineWiring.summaries.dependenciesOf>[0]["initializerAt"] = (at, initializer) => {
      if (at.body !== body.body) return fail("An initializer occurrence must belong to the requesting actual selected execution.");
      let occurrence = sources.nodeOf({ kind: "body", value: at });
      if (occurrence === null && typeof initializer === "string") {
        const checked = sources.bodies.get(body.body);
        for (let index = 0; index < (checked?.params.length ?? 0); index += 1) {
          if (chargeWork(account, 1) !== null) return null;
          const parameter = checked?.params[index];
          if (parameter?.initializer !== initializer) continue;
          occurrence = sources.nodeOf({ kind: "item", value: { owner: parameter.declaration, node: at.node } });
          break;
        }
      }
      let bindings = operation.execution.instance.bindings;
      if (typeof initializer !== "string") {
        if (occurrence?.kind !== "CallExpression" || occurrence.tsonic.application.kind !== "available") return null;
        const captured = occurrence.tsonic.application.value;
        const { instance, parameter, callee: { activation, decision } } = initializer;
        if (activation === null || captured.kind !== "call") return null;
        const keys = admitArtifactIdentity(instance.bindings, account) ?? admitArtifactIdentity(activation.bindings, account);
        if (keys !== null || artifactBindingsKey(instance.bindings) !== artifactBindingsKey(activation.bindings)) return null;
        const mappingRead = chargeWork(account, 1);
        if (mappingRead !== null) return null;
        const mapping = decision.parameters[parameter];
        if (mapping?.kind !== "default" || mapping.parameter !== parameter
          || mapping.initializer !== instance.body) return null;
        const formalRead = chargeWork(account, 1);
        if (formalRead !== null) return null;
        const formal = readSignature(source.types, decision.completion.signature).parameters[parameter];
        if (formal?.kind !== "default" || !formal.acceptsOmission || formal.initializer !== instance.body) return null;
        bindings = activation.bindings;
        const reference = sources.declarationSourceOf(formal.declaration);
        occurrence = reference === null ? null : sources.nodeOf(reference);
        if (reference?.kind !== "item" || reference.value.owner !== formal.declaration || occurrence?.kind !== "Parameter"
          || occurrence.tsonic.parent !== decision.api.declaration) return null;
      }
      if (occurrence === null || occurrence.kind !== "Parameter" && occurrence.kind !== "VariableDeclaration"
        && occurrence.kind !== "PropertyDeclaration" && occurrence.kind !== "BindingElement") return null;
      const instance: BodyInstance = typeof initializer === "string"
        ? { body: initializer, bindings } : initializer.instance;
      if (occurrence.kind !== "BindingElement" && (!("initializer" in occurrence.tsonic) || instance.body !== occurrence.tsonic.initializer))
        return null;
      const checked = sources.bodies.get(instance.body);
      if (checked === undefined || checked.params.length !== 0 || checked.root !== occurrence.initializer)
        return fail("A placed initializer requires its actual separately owned parameterless source.");
      if (occurrence.kind === "BindingElement") {
        const admit = chargeWork(account, 1 + checked.owner.length);
        if (admit !== null) return null;
        if (typeof initializer !== "string" || sources.nodeOf({ kind: "item", value: { owner: checked.owner, node: occurrence.id } }) !== occurrence)
          return fail("A selected binding default requires its actual checked named leaf and lexical execution.");
      }
      return { kind: "body", execution: { instance, provided: 0 } };
    };
    const calleeAt: Parameters<typeof pipelineWiring.summaries.dependenciesOf>[0]["calleeAt"] = (at, callee) => {
      if (at.body !== body.body) return fail("A selected call occurrence belongs to its actual requesting execution.");
      const original = sources.nodeOf({ kind: "body", value: at });
      if (original?.kind !== "CallExpression" || original.tsonic.application.kind !== "available") return null;
      const captured = original.tsonic.application.value;
      const decision = callee.decision;
      const activation = callee.activation;
      if (captured.kind !== "call" || captured.receiver !== null
        || (activation === null ? decision.api.body !== null : activation.body !== decision.api.body)) return null;
      const signatureRead = chargeWork(account, 1);
      if (signatureRead !== null) return null;
      const checked = sources.bodies.get(body.body);
      const list = captured.candidates.kind === "available" ? checked?.candidateLists[captured.candidates.value] : undefined;
      const candidate = list?.candidates[decision.candidate];
      if (captured.candidates.kind !== "available" || list?.id !== captured.candidates.value
        || candidate?.ordinal !== decision.candidate || candidate.declaration !== decision.advertised.declaration
        || activation !== null && (activation.bindings.kind !== "instantiated" || activation.bindings.bindings !== decision.implementationBindings)) return null;
      const signature = readSignature(source.types, decision.completion.signature);
      if (activation !== null && sources.bodies.get(activation.body)?.owner !== decision.api.declaration || signature.declaration !== decision.api.declaration
        || signature.parameters.length !== decision.parameters.length || signature.receiver !== null)
        return fail("A selected call retains its actual API body, authoritative signature and offered entry.");
      let provided = 0;
      let authored = 0;
      let component = 0;
      for (let parameter = 0; parameter < decision.parameters.length; parameter += 1) {
        const read = chargeWork(account, 1);
        if (read !== null) return null;
        const mapping = decision.parameters[parameter];
        const formal = signature.parameters[parameter];
        if (mapping?.kind !== "argument") {
          if (mapping?.parameter !== parameter || formal === undefined || !formal.acceptsOmission)
            return fail("The omitted typed disposition requires the actual selected omission capability.");
          if (mapping.kind === "omitted") {
            if (formal.kind !== "optional" || formal.initializer !== null || mapping.type !== formal.type)
              return fail("The selected absence omission requires its actual formal type without an initializer.");
          } else if (mapping.kind !== "default" || formal.kind !== "default" || formal.initializer !== mapping.initializer)
            return fail("The omitted typed disposition must name its actual selected default.");
          continue;
        }
        let original = captured.arguments[authored];
        while (original?.kind === "spread" && original.tuple.kind === "available" && original.tuple.value?.length === 0) {
          if (chargeWork(account, 1) !== null) return null;
          original = captured.arguments[++authored];
        }
        if (parameter !== provided || mapping.parameter !== parameter || mapping.argument !== authored
          || original === undefined || mapping.passing !== "by-value" || formal?.passing !== mapping.passing) return null;
        if (original.kind === "value") {
          if (mapping.component !== null) return null;
          authored += 1;
        } else {
          const slots = original.tuple.kind === "available" ? original.tuple.value : null;
          if (slots === null || component >= slots.length || mapping.component !== component) return null;
          component += 1;
          if (component === slots.length) { authored += 1; component = 0; }
        }
        provided += 1;
      }
      for (; authored < captured.arguments.length; authored += 1) {
        if (chargeWork(account, 1) !== null) return null;
        const trailing = captured.arguments[authored];
        if (trailing?.kind !== "spread" || trailing.tuple.kind !== "available" || trailing.tuple.value?.length !== 0) return null;
      }
      if (activation === null) {
        if (decision.api.role !== "api-signature" || candidate.declaration !== decision.api.declaration) return null;
        const witnessRead = chargeWork(account, 1);
        if (witnessRead !== null) return null;
        const site = sources.declarationSourceOf(decision.api.declaration);
        const item = site === null ? null : sources.nodeOf(site);
        const endpoint = item?.tsonic;
        const scope = source.descriptions.get(decision.api.declaration)?.generics;
        if (site === null || endpoint === undefined || endpoint === null || !("signatures" in endpoint)
          || endpoint.definition !== decision.api.declaration || scope === undefined) return null;
        let ordinal = 0;
        for (let position = 0; position < endpoint.signatures.length; position += 1) {
          const read = chargeWork(account, 1);
          if (read !== null) return null;
          const selected = endpoint.signatures[position];
          if (selected === undefined) return fail("A declared endpoint inventory must be dense.");
          if (selected.role !== decision.api.role) continue;
          if (selected.declaration === decision.api.declaration && selected.body === null && selected.signature === decision.api.signature) {
            const request: SignatureRequest = { definition: selected.declaration, endpoint: selected.role, ordinal,
              bindings: { kind: "instantiated", bindings: decision.implementationBindings } };
            const execution: DeclaredExecution = { request, provided };
            const key: SummaryKey = { kind: "declared", execution };
            const stop = admitSummaryIdentity(key, account);
            if (stop !== null) return null;
            const actual = readDeclared(request);
            if (actual !== signature) return fail("A declared execution must borrow its actual completed Decls signature.");
            const identity = summaryKey(key);
            const previous = declaredOf(identity);
            if (previous !== undefined) return { kind: "declared", execution: previous.execution };
            const claim = chargeWork(account, 2 * selected.declaration.length) ?? admitArtifactIdentity(request.bindings, account);
            if (claim !== null) return null;
            const placementKey = signatureRequestKey(request);
            const previousPlacement = declaredPlacements?.get(placementKey);
            if (previousPlacement !== undefined && previousPlacement.signature !== actual)
              return fail("A declared request retains one actual completed signature.");
            const guarantee = source.nativeGuaranteeOf(selected.declaration);
            if (guarantee !== null && (!("core" in endpoint) || endpoint.core.provider.kind !== "available"
              || endpoint.core.provider.value !== guarantee.declaration))
              return fail("A selected native guarantee borrows its actual checked canonical declaration.");
            const retain = chargeResultEntries(account, 4 + (declared === null ? 1 : 0)
              + (previousPlacement === undefined ? 4 : 0) + (declaredPlacements === null ? 1 : 0));
            if (retain !== null) return null;
            declared ??= new Map();
            declaredPlacements ??= new Map();
            const placement = previousPlacement ?? { request, signature: actual };
            if (previousPlacement === undefined) declaredPlacements.set(placementKey, placement);
            const ready: DeclaredExecution = { request: placement.request, provided };
            declared.set(identity, { execution: ready, placement, source: site, scope, parameters: decision.parameters, guarantee });
            return { kind: "declared", execution: ready };
          }
          ordinal += 1;
        }
        return null;
      }
      const execution: Execution = { instance: activation, provided };
      const stop = admitSummaryIdentity({ kind: "body", execution }, account);
      if (stop !== null) return null;
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

  const retain = chargeResultEntries(account, 1);
  if (retain !== null) return analysisStop(retain, unit);
  const provided = new Map<string, readonly number[]>();
  for (const [key, group] of counts) {
    const row = chargeResultEntries(account, 2 + group.values.size);
    if (row !== null) return analysisStop(row, unit);
    const ordered: number[] = [];
    for (let count = group.maximum; count >= group.minimum; count -= 1) {
      const stop = chargeWork(account, 1);
      if (stop !== null) return analysisStop(stop, unit);
      if (group.values.has(count)) ordered.push(count);
    }
    provided.set(key, ordered);
  }
  return { kind: "ok", diagnostics: [], value: { operations, operationIdentities, operationsByBody, dependencies, moduleExecutions, provided,
    declared, declaredPlacements } };
}
