import type { Diagnostic, Result } from "../diag/contract.js";
import { orderDiagnostics, resourceLimitDiagnostic, throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, ModuleId, SourceNodeRef } from "../ids/contract.js";
import type { DataflowAccount, DataflowResult } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { CheckedPhase, CheckedTypingCut, Declaration, HirBody, HirNode, SourceFile } from "../ir-hir/contract.js";
import type { InferenceDeclaration, InferenceGroup, InferSite, PlacedSignature } from "../ir-infer/contract.js";
import { inferenceBindingSites, inferredPartKey } from "../ir-infer/index.js";
import type { BindingScope, BodyInstance, Signature, SignatureRequest } from "../ir-types/contract.js";
import { instanceKey, readSignature, readType, signatureRequestKey, typePublicationRefusalOf, verifyBindings, viewTypes } from "../ir-types/index.js";
import type { ProgramEvidenceInput, ProgramMemberEvidence, ProgramStaticStorageEvidence, ProgramVerificationWork, TirSpecializationPlacement } from "../ir-program/contract.js";
import { createProgramVerificationWork, specializeTir, tirReadyReadAdmission } from "../ir-program/index.js";
import type { StaticStorageOf, TirBindingOwnerVisit, TirBindingTarget, TirBody, TirModule, TirVerifierInput } from "../ir-tir/contract.js";
import { verifyTir, verifyTirModule } from "../ir-tir/index.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { ScopedInferencePublication, SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { Database } from "../query/contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { ElaborationChild, ElaborationNoResult } from "../elaborate/contract.js";
import type { QueryRefusal } from "../query/contract.js";
import type { FormDiagnosticSite } from "../validate/contract.js";
import type { SourceBarrier, SourceModule } from "./source-barrier.js";
import { checkedSourceViews } from "./checked-inputs.js";
import { inferDepsOf } from "./infer-deps-step.js";
import { candidateReplayOf } from "./inference-step.js";
import { completedFormCut, formDiagnosticsQuery } from "./semantic-queries.js";
import { createSourceSemanticDatabase } from "./semantic-queries.js";
import { pipelineWiring } from "./wiring.js";
import { analysisStop } from "./analysis-stop.js";
import { selectExternalEntries, type ExternalEntrySelection } from "./external-entries.js";
import { prepareRequiredExecutions, type RequiredExecutions } from "./required-executions.js";
import { planModuleInitialization } from "./module-initialization.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function isDeclaration(node: HirNode): node is Declaration<CheckedPhase> {
  switch (node.kind) {
    case "VariableDeclaration": case "Parameter": case "BindingElement": case "MissingDeclaration":
    case "FunctionDeclaration": case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration":
    case "TypeAliasDeclaration": case "EnumMember": case "EnumDeclaration": case "ImportDeclaration":
    case "NamespaceImport": case "ExportAssignment": case "NamespaceExportDeclaration": case "NamespaceExport":
    case "ExportSpecifier": case "CallSignature": case "ConstructSignature": case "Constructor":
    case "GetAccessor": case "SetAccessor": case "IndexSignature": case "MethodSignature": case "MethodDeclaration":
    case "PropertySignature": case "PropertyDeclaration": case "SemicolonClassElement": case "ClassStaticBlockDeclaration":
    case "NoSubstitutionTemplateLiteral": case "BinaryExpression": case "ArrowFunction": case "FunctionExpression":
    case "CallExpression": case "ObjectLiteralExpression": case "SpreadAssignment": case "PropertyAssignment":
    case "ShorthandPropertyAssignment": case "MappedType": case "TypeLiteral": case "NamedTupleMember":
    case "FunctionType": case "ConstructorType": case "JsxAttributes": case "JsxAttribute": case "JSDocSignature":
    case "SourceFile": case "ModuleDeclaration": case "ImportEqualsDeclaration": case "ExportDeclaration":
    case "ImportClause": case "ImportSpecifier": case "TypeParameter": case "JSDocTypeLiteral": return true;
    default: return false;
  }
}

export interface TypedSourceBarrier {
  readonly source: SourceBarrier;
  readonly initializationRoots: readonly SourceFile<CheckedPhase>[];
  readonly exposure: ExternalEntrySelection;
  readonly required: RequiredExecutions;
  readonly bodies: {
    readonly get: (key: string) => TirBody | undefined;
    readonly values: () => IterableIterator<TirBody>;
  };
  readonly placedSignatureOf: (instance: BodyInstance) => PlacedSignature | null;
  readonly signatureIdOf: (request: SignatureRequest) => PlacedSignature["signature"]["id"] | null;
  readonly programEvidence: (account: DataflowAccount) => DataflowResult<ProgramEvidenceInput>;
  readonly modules: ReadonlyMap<ModuleId, TirModule>;
  readonly verifierOf: (module: ModuleId) => TirVerifierInput | null;
  readonly sourceNodeOf: (node: SourceNodeRef) => HirNode | null;
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly staticStorageOf: StaticStorageOf;
  readonly database: Database<SourceSemanticInputs, SourceSemanticWitness, DeclaredSignatureErrorData>;
}

export function typeSourceBarrier(inputs: HostAnalysisInputs, source: SourceBarrier, account: DataflowAccount): Result<TypedSourceBarrier> {
  const roots = source.modules;
  const project = new Set(inputs.snapshot.source.input.packages.modules.filter(module => module.package === inputs.snapshot.source.input.packages.rootPackage)
    .map(module => module.id));
  const base: SourceSemanticInputs = { declarations: { modules: source.modules, types: source.types, typeWork: source.typeWork,
    typeExpansion: inputs.limits.instantiation.typeExpansion }, instantiation: inputs.limits.instantiation };
  const { database, bind } = createSourceSemanticDatabase(base, inputs.limits.query);
  const checkedModules = new Map<ModuleId, SourceModule>();
  for (const module of roots) checkedModules.set(module.module.module, module);
  const sitesByModule = new Map<ModuleId, readonly FormDiagnosticSite[]>();
  const sites = new Map<ModuleId, Map<number, FormDiagnosticSite>>();
  const sitesByBody = new Map<BodyId, FormDiagnosticSite[]>();
  for (const entry of roots) {
    const indexed = pipelineWiring.validate.indexFormDiagnostics({ role: entry.role, scopeOf: source.checked.formScopeOf }, entry.module);
    sitesByModule.set(entry.module.module, indexed);
    if (indexed.length === 0) continue;
    const qualified = new Map<number, FormDiagnosticSite>();
    const moduleBody = entry.module.bodies.find(body => body.root === entry.module.tree);
    for (const site of indexed) {
      if (site.module !== entry.module.module || entry.nodes[site.report.id] !== site.report || entry.nodes[site.cut.id] !== site.cut
        || qualified.has(site.report.id)) return fail("A Forms index requires its actual unique qualified detector and cut root.");
      qualified.set(site.report.id, site);
      const owner = site.scope.kind === "execution" ? site.scope.body : site.scope.kind === "module-header" ? moduleBody?.body : undefined;
      if (owner !== undefined) {
        const existing = sitesByBody.get(owner);
        if (existing === undefined) sitesByBody.set(owner, [site]);
        else existing.push(site);
      }
    }
    sites.set(entry.module.module, qualified);
  }
  const sources = checkedSourceViews(source.modules, undefined, sitesByModule);
  const forms = formDiagnosticsQuery(base, site => sites.get(site.module)?.get(site.report.id) === site);
  const reports = new Map<FormDiagnosticSite, CheckedTypingCut>();
  const elaborationDiagnostics: Diagnostic[] = [];
  const refusal = (...retained: readonly QueryRefusal[]): QueryRefusal => {
    const [first, ...rest] = orderDiagnostics([...new Set([...database.diagnostics(), ...elaborationDiagnostics,
      ...retained.flatMap(stop => stop.diagnostics)])]);
    if (first === undefined) return fail("A typing refusal must retain its actual diagnostic.");
    return { kind: "refused", diagnostics: [first, ...rest] };
  };
  const typesRefusal = (): QueryRefusal | null => {
    const stopped = typePublicationRefusalOf(source.typeWork);
    if (stopped?.kind === "resource-limit") return fail("A synchronous Types publication stop must retain its actual owning refusal.");
    return stopped;
  };
  const settleReport = (site: FormDiagnosticSite): CheckedTypingCut | QueryRefusal => {
    const result = database.run(forms, site);
    const shared = typesRefusal();
    if (result.kind === "refused" && database.isRecordLimitRefusal(result)) return shared === null ? refusal(result) : refusal(result, shared);
    if (shared !== null) return refusal(shared);
    if (result.kind === "refused") return refusal(result);
    return completedFormCut(site, result.value, database.errorOf);
  };
  for (const module of roots) {
    if (!project.has(module.module.module)) continue;
    for (const site of sitesByModule.get(module.module.module) ?? []) {
      const result = settleReport(site);
      if ("kind" in result) return result;
      reports.set(site, result);
    }
  }
  const cuts = sources.bindForms(site => reports.get(site));
  const items = new Map<DefId, Declaration<CheckedPhase>>();
  for (const module of source.modules) {
    items.set(module.module.tree.tsonic.definition, module.module.tree);
    for (const item of module.module.items) {
      const node = module.nodes[item.node];
      if (node === undefined || !isDeclaration(node)) return fail("A checked declaration has no actual canonical declaration source node.");
      items.set(item.definition, node);
    }
  }
  const itemOf = (definition: DefId): Declaration<CheckedPhase> => items.get(definition)
    ?? fail("An actual checked declaration is absent from its complete F1 inventory.");
  const scopeOf = (definition: DefId): BindingScope => source.descriptions.get(definition)?.generics
    ?? fail("A binding environment needs its actual checked declaration scope.");
  const bodyOf = (body: BodyId): HirBody => sources.bodies.get(body)
    ?? fail("A requested body is absent from the actual checked source inventory.");
  const checkerDiagnosticsOf = (module: ModuleId) => checkedModules.get(module)?.module.checkerDiagnostics
    ?? fail("A semantic fact needs its actual checked module's diagnostic inventory.");
  const declarationOf = (definition: DefId): InferenceDeclaration | null => {
    const item = items.get(definition);
    if (item === undefined) return null;
    return { scope: scopeOf(definition), parameterCount: "parameters" in item && item.parameters !== null
      && "nodes" in item.parameters ? item.parameters.nodes.length : null,
      endpoints: item.tsonic !== null && "signatures" in item.tsonic ? item.tsonic.signatures : [] };
  };
  const inference = inferDepsOf({ rules: { libraries: source.libraries, types: source.types, selectedNativeFacts: inputs.snapshot.nativeFacts,
    typeExpansion: inputs.limits.instantiation.typeExpansion }, hirBody: bodyOf, itemOf, bindingScopeOf: scopeOf,
    checkerDiagnosticsOf, checkedNodeOf: sources.nodeOf, typeWork: source.typeWork,
    bindings: source.modules.map(module => module.module.bindings), bindingOf: source.bindingOf, limits: inputs.limits.inference,
    graph: inputs.limits.dataflow, structuralCuts: sources.structuralCuts, cuts });
  const grouped = pipelineWiring.infer.groupsOf(inference, [...sources.bodies.keys()].filter(body => !sources.structuralCuts.body(body)));
  if (grouped.kind === "refused") return refusal(grouped);
  const groupOf = new Map<BodyId, { readonly group: InferenceGroup; result?: ScopedInferencePublication | QueryRefusal }>();
  for (const group of grouped.value) {
    const root = { group };
    for (const body of group.bodies) groupOf.set(body, root);
  }
  const { queries, productionRefusalOf } = bind({ inference, groups: grouped.value, sources: { ...sources, cuts }, forms, projectForms: reports,
    groupForms: function* (group) {
      for (const body of group.bodies) for (const site of sitesByBody.get(body) ?? [])
        yield { kind: "forms-prerequisite", site, source: { kind: "body", value: { body, node: bodyOf(body).root.id } } };
    }, bindingScopeOf: scopeOf,
  verification: (_group, constraints, result) => {
    const owners = new Map<number, BodyId>();
    for (const system of constraints.constraints) for (const variable of system.variables) owners.set(variable.id, system.body);
    const ownerAt = (site: InferSite): DefId => {
      if (site.kind === "body") return bodyOf(site.body).owner;
      if (site.kind === "constraint" || site.kind === "proof") return bodyOf(site.constraint.body).owner;
      if (site.kind === "variable") {
        const body = owners.get(site.variable);
        if (body !== undefined) return bodyOf(body).owner;
      }
      return fail("A binding occurrence requires its actual qualified inference producer owner.");
    };
    return { types: viewTypes(source.types), declarationOf, nominalOf: source.nominalOf,
      nodeExists: reference => sources.nodeOf(reference) !== null, localExists: sources.localExists,
      bindingScopes: inferenceBindingSites({ group: _group, constraints: constraints.constraints, solution: result.solution })
        .map(binding => scopeOf(binding.definition ?? ownerAt(binding.site))) };
  } });
  const solve = (body: BodyId): QueryRefusal | null => {
    const root = groupOf.get(body);
    if (root === undefined) return fail("Every project body requires its actual canonical inference group.");
    if (root.result !== undefined) return null;
    const completed = database.run(queries.solutionOf, root.group.id);
    const typeStopped = typesRefusal();
    const productionStopped = productionRefusalOf();
    const shared = [typeStopped, productionStopped].filter(stop => stop !== null);
    if (completed.kind === "refused" && database.isRecordLimitRefusal(completed)) return refusal(completed, ...shared);
    if (shared.length !== 0) return refusal(...shared);
    root.result = completed.kind === "refused" ? completed : completed.value;
    return null;
  };
  for (const entry of roots) if (project.has(entry.module.module)) for (const body of entry.module.bodies) {
    if (sources.structuralCuts.body(body.body)) continue;
    const stop = solve(body.body);
    if (stop !== null) return stop;
  }
  const bodies = new Map<string, { readonly body: TirBody; readonly placed: PlacedSignature; scopes: readonly BindingScope[] | null }>();
  const memberInventoriesOf = (body: BodyId) => {
    const publication = groupOf.get(body)?.result;
    return publication === undefined || "kind" in publication ? undefined : publication.memberInventories.get(body);
  };
  const refusedInstances = new Map<string, ElaborationNoResult>();
  const instanceResult = (key: string, missing: string): TirBody | ElaborationNoResult => {
    const ready = bodies.get(key)?.body;
    return ready ?? refusedInstances.get(key) ?? fail(missing);
  };
  const blocked = (instance: BodyInstance, refusal: QueryRefusal): ElaborationNoResult =>
    ({ kind: "no-result", instance, causes: [{ kind: "producer", refusal }], diagnostics: [] });
  const staticStorageOf: StaticStorageOf = declaration => {
    const checked = sources.nodeOf({ kind: "item", value: declaration });
    if (checked?.kind !== "VariableDeclaration" || checked.tsonic.declaration.kind !== "definition"
      || checked.tsonic.declaration.definition !== declaration.owner || checked.tsonic.declaredType.kind !== "available") return null;
    if (checked.tsonic.declaredType.value !== null) return checked.tsonic.declaredType.value;
    const initializer = checked.tsonic.initializer;
    if (initializer === null) return null;
    const publication = groupOf.get(initializer)?.result;
    if (publication === undefined || "kind" in publication) return null;
    const part = inferredPartKey({ definition: declaration.owner, part: { kind: "variable" } });
    const variable = publication.signatureVariables.get(part);
    if (variable?.occurrence.body !== initializer) return null;
    const finalized = publication.solution.variables[variable.id];
    return finalized?.variable === variable.id && finalized.error === null ? finalized.value.type : null;
  };
  const elaboration = { cuts, types: source.types, typeWork: source.typeWork, rules: inference.rules, nodeOf: sources.nodeOf, itemOf,
    bindingOf: source.bindingOf, staticStorageOf,
    typeOf: (type: Parameters<typeof readType>[1]) => readType(source.types, type),
    signatureOf: (signature: Parameters<typeof readSignature>[1]) => readSignature(source.types, signature),
    checkerDiagnosticsOf };
  type Work =
    | { readonly kind: "visit"; readonly body: BodyId }
    | { readonly kind: "elaborate"; readonly body: HirBody; readonly instance: BodyInstance; readonly key: string;
        readonly scope: BindingScope; readonly publication: ScopedInferencePublication | QueryRefusal; readonly template: TirBody | null;
        readonly initializers: readonly BodyId[] };
  const unit = { query: "AnalyzeHostProgram", key: inputs.snapshot.source.input.packages.fingerprint };
  const exposure = selectExternalEntries(source, sources, inputs.snapshot.contributions.externalEntries, account);
  if (exposure.kind !== "complete") return analysisStop(exposure, unit);
  const initialization = planModuleInitialization(inputs.snapshot.entryPoint, source, exposure.value.selections, account);
  if (initialization.kind !== "complete") return analysisStop(initialization, unit);
  const attachments: { readonly key: string; readonly complete: (ready: TirBody) => Result<void> }[] = [];
  const scoped = (scope: BindingScope): boolean => scope.classParameters.length !== 0 || scope.methodParameters.length !== 0
    || scope.capturedParameters.length !== 0 || scope.selfOwners.length !== 0;
  const unopenedChild = (parent: HirBody, child: BodyId, bindings: BodyInstance["bindings"]): HirBody | null => {
    const inProject = project.has(parent.root.origin.module);
    if (inProject && bindings.kind === "parametric") return null;
    const checked = bodyOf(child);
    const item = items.get(checked.owner);
    if (!inProject && item?.kind === "Parameter" && item.initializer === checked.root && item.tsonic.initializer === child) return checked;
    return parent.root.kind === "SourceFile" && item?.kind === "FunctionDeclaration"
      && item.body === checked.root && item.tsonic.body === child && (!inProject || scoped(scopeOf(checked.owner))) ? checked : null;
  };
  const checkedChildOf = (child: HirBody, instance: BodyInstance, key: string): Extract<ElaborationChild, { kind: "checked" }> =>
    ({ kind: "checked", body: child, instance, onRequired: complete => {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 2);
      if (stop !== null) return analysisStop(stop, unit);
      attachments.push({ key, complete });
      return { kind: "ok", diagnostics: [], value: undefined };
    } });
  const produce = (seeds: readonly BodyId[], bindings: BodyInstance["bindings"]): QueryRefusal | null => {
      const mode = bindings.kind;
      const pending: Work[] = seeds.map((body): Work => ({ kind: "visit", body })).reverse();
      while (pending.length !== 0) {
        const next = pending.pop();
        if (next === undefined) return fail("The actual typed work vector is dense.");
        if (next.kind === "visit") {
          const checked = bodyOf(next.body);
          const instance: BodyInstance = { body: checked.body, bindings };
          const key = instanceKey(instance);
          if (bodies.has(key) || refusedInstances.has(key)) continue;
          const site = sources.formOfBody(checked.body);
          if (site !== null) {
            const cut = reports.get(site) ?? settleReport(site);
            if ("kind" in cut) return cut;
            refusedInstances.set(key, { kind: "no-result", instance, causes: [{ kind: "form", cut }], diagnostics: [] });
            continue;
          }
          const scope = scopeOf(checked.owner);
          if (mode === "instantiated" && scoped(scope)) continue;
          const stopped = solve(checked.body);
          if (stopped !== null) return stopped;
          const publication = groupOf.get(checked.body)?.result;
          if (publication === undefined) return fail("Elaboration requires the actual completed inference attempt.");
          if ("kind" in publication && checked.root.kind !== "SourceFile") {
            refusedInstances.set(key, blocked(instance, publication));
            continue;
          }
          const prior = mode === "parametric" ? null : instanceResult(
            instanceKey({ body: checked.body, bindings: { kind: "parametric" } }), "A selected body requires its actual completed template.");
          if (prior !== null && "kind" in prior) { refusedInstances.set(key, { ...prior, instance, diagnostics: [] }); continue; }
          const template = prior;
          const initializers = checked.params.flatMap(parameter => parameter.initializer === null ? [] : [parameter.initializer]);
          pending.push({ kind: "elaborate", body: checked, instance, key, scope, publication, template, initializers });
          const eagerDefaults = project.has(checked.root.origin.module) ? initializers : [];
          for (const children of [eagerDefaults, checked.nestedBodies]) {
            for (let index = children.length - 1; index >= 0; index -= 1) {
              const child = children[index];
              if (child === undefined) return fail("The checked nested body inventory is dense.");
              if (unopenedChild(checked, child, bindings) === null) pending.push({ kind: "visit", body: child });
            }
          }
          continue;
        }
        const { body: checked, instance, key, scope, publication, template } = next;
        const nestedBodies = checked.nestedBodies.map((body): ElaborationChild => {
          const child = { body, bindings };
          const checkedChild = unopenedChild(checked, body, bindings);
          const childKey = instanceKey(child);
          if (checkedChild !== null && !bodies.has(childKey) && !refusedInstances.has(childKey))
            return checkedChildOf(checkedChild, child, childKey);
          return instanceResult(childKey, "A required nested occurrence needs its actual same-binding body.");
        });
        const initializers = next.initializers.map((body): ElaborationChild => {
          const child = { body, bindings };
          const childKey = instanceKey(child);
          return bodies.has(childKey) || refusedInstances.has(childKey)
            ? instanceResult(childKey, "A required default needs its actual same-binding body.")
            : checkedChildOf(bodyOf(body), child, childKey);
        });
        const constraints = "kind" in publication ? undefined : publication.constraints.constraints.find(system => system.body === checked.body);
        const result = pipelineWiring.elaborate.elaborate("kind" in publication ? elaboration : { ...elaboration, cuts: publication.checkedCuts },
          { instance, scope, body: checked,
          typing: "kind" in publication ? blocked(instance, publication) : {
            kind: "ready", constraints: constraints ?? fail("Elaboration requires the actual verified completed group solution."),
            solution: publication.solution, template,
          }, nestedBodies, initializers });
        for (const diagnostic of result.diagnostics) elaborationDiagnostics.push(diagnostic);
        const stopped = typesRefusal();
        if (stopped !== null) return refusal(stopped);
        if (result.kind === "no-result") refusedInstances.set(key, result);
        else {
          if ("kind" in publication) return fail("An incomplete inference attempt cannot publish a Typed body.");
          const placed = publication.placed.get(checked.body);
          const body = result.value;
          if (placed === undefined || body.body !== checked.body || body.owner !== checked.owner
            || body.signature !== placed.signature.id || body.bindings !== instance.bindings)
            return fail("Elaboration must preserve the actual completed body and its placed signature.");
          if (body.bindings.kind === "parametric") {
            bodies.set(key, { body, placed, scopes: null });
          } else {
            const { classBindings, methodBindings, capturedBindings, selfBindings } = body.bindings.bindings;
            if (template === null || template.body !== body.body || template.owner !== body.owner
              || template.bindings.kind !== "parametric" || template.signature !== placed.signature.id
              || classBindings.length !== 0 || methodBindings.length !== 0 || capturedBindings.length !== 0 || selfBindings.length !== 0
              || scope.classParameters.length !== 0 || scope.methodParameters.length !== 0
              || scope.capturedParameters.length !== 0 || scope.selfOwners.length !== 0)
              return fail("A selected placement must use its verified template and actual complete empty scope.");
            const request = placed.request;
            bodies.set(key, { body, scopes: null, placed: request === null ? placed : {
              request: { ...request, bindings: body.bindings }, signature: placed.signature,
            } });
          }
        }
      }
      return null;
  };
  const parametric = { kind: "parametric" } satisfies BodyInstance["bindings"];
  const empty = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } } satisfies BodyInstance["bindings"];
  for (const module of roots) {
    if (!project.has(module.module.module)) continue;
    const seeds = module.module.bodies.map(body => body.body);
    const stop = produce(seeds, parametric) ?? (module.role === "source" ? produce(seeds, empty) : null);
    if (stop !== null) return stop;
  }
  const diagnostics = [...new Set([...database.diagnostics(), ...elaborationDiagnostics])];
  if (refusedInstances.size !== 0 || diagnostics.some(diagnostic => diagnostic.severity === "error")) {
    const [first, ...remaining] = orderDiagnostics(diagnostics);
    if (first === undefined) return fail("A typing refusal must retain its actual diagnostic.");
    return { kind: "refused", diagnostics: [first, ...remaining] };
  }
  const admit = tirReadyReadAdmission(account);
  let replayResources: ProgramVerificationWork | null = null;
  const declaredSignature = (request: SignatureRequest): Result<Signature> => {
    const selected = database.run(queries.declaredSignatureOf, request);
    const stopped = typesRefusal();
    if (stopped !== null) return selected.kind === "refused" ? refusal(selected, stopped) : refusal(stopped);
    return selected.kind === "refused" ? selected : { kind: "ok", value: selected.value, diagnostics: [] };
  };
  const requireBody = (instance: BodyInstance): Result<TirBody> => {
    const key = instanceKey(instance);
    const existing = bodies.get(key);
    if (existing !== undefined) return { kind: "ok", diagnostics: [], value: existing.body };
    const stop = produce([instance.body], parametric);
    if (stop !== null) return stop;
    if (refusedInstances.has(key)) return refusal();
    if (instance.bindings.kind === "instantiated") {
      const checked = bodyOf(instance.body);
      const scope = scopeOf(checked.owner);
      if (scoped(scope)) {
        const source = bodies.get(instanceKey({ body: instance.body, bindings: parametric }));
        if (source === undefined) return refusal();
        const request = source.placed.request;
        const verified = verifyBindings([{ vector: instance.bindings.bindings, scope }], viewTypes(elaboration.types).terms.length,
          (work, scratch) => chargeWork(account, work + scratch));
        if (verified.kind === "resource-stop") return analysisStop(verified.stop, unit);
        if (verified.violations.length !== 0) return fail("A required specialization needs its actual complete checked bindings.");
        let placement: TirSpecializationPlacement;
        if (request === null) placement = { kind: "execution", template: source.placed };
        else {
          const selectedRequest = { ...request, bindings: instance.bindings };
          const selected = declaredSignature(selectedRequest);
          if (selected.kind === "refused") return refusal(selected);
          placement = { kind: "endpoint", template: source.placed, selected: { request: selectedRequest, signature: selected.value } };
        }
        replayResources ??= createProgramVerificationWork(inputs.limits.instantiation, account);
        const specialized = specializeTir(source.body, instance, placement, elaboration.types, replayResources,
          candidateReplayOf(elaboration, account, checked, instance, declaredSignature));
        if (specialized.kind === "refused") return refusal(specialized);
        if (specialized.kind === "resource-limit") return refusal({ kind: "refused", diagnostics: [resourceLimitDiagnostic({
          owner: "ir-program", limit: specialized.dimension, maximum: specialized.maximum,
          site: { kind: "source", origin: source.body.root.origin }, unit: { request: unit, position: { kind: "result" } },
        })] });
        const placed = placement.kind === "endpoint" ? placement.selected
          : { request: null, signature: readSignature(elaboration.types, specialized.value.signature) };
        for (let position = 0; position < specialized.value.params.length; position += 1) {
          const step = chargeWork(account, 1);
          if (step !== null) return analysisStop(step, unit);
          const formal = specialized.value.params[position];
          if (formal === undefined) return fail("A selected generic body retains its complete actual formals.");
          const unopened = formal.initializer;
          if (unopened.kind !== "checked-default") continue;
          const initializer = formal.tsonic.initializer;
          if (initializer === null) return fail("A selected generic default must have its actual initializer body.");
          const declared = bodyOf(initializer);
          if (declared.owner !== formal.tsonic.declaration || declared.root !== unopened.root)
            return fail("A selected generic default must retain its actual checked declaration and root.");
          const requested = { body: initializer, bindings: instance.bindings };
          const reserve = admit({ kind: "artifact", instance: requested }) ?? chargeResultEntries(account, 2);
          if (reserve !== null) return analysisStop(reserve, unit);
          const key = instanceKey(requested);
          attachments.push({ key, complete: ready => pipelineWiring.elaborate.attachFormalDefault(elaboration, formal, unopened, ready) });
        }
        bodies.set(key, { placed, body: specialized.value, scopes: null });
        return { kind: "ok", diagnostics: [], value: specialized.value };
      }
    }
    const selectionStop = produce([instance.body], instance.bindings);
    if (selectionStop !== null) return selectionStop;
    if (refusedInstances.has(key)) return refusal();
    const ready = bodies.get(key);
    if (ready === undefined) return fail("A required execution needs its actual bound local Typed producer.");
    return { kind: "ok", diagnostics: [], value: ready.body };
  };
  const explicit: TirBody[] = [];
  for (const root of initialization.value) if (!project.has(root.origin.module)) {
    const result = requireBody({ body: root.tsonic.body, bindings: empty });
    if (result.kind === "refused") return result;
    explicit.push(result.value);
  }
  for (const body of exposure.value.bodies) if (!project.has(bodyOf(body).root.origin.module)) {
    const result = requireBody({ body, bindings: empty });
    if (result.kind === "refused") return result;
    explicit.push(result.value);
  }
  const readDeclared = (request: SignatureRequest): Signature | null => {
    const answer = database.readCompleted(queries.declaredSignatureOf, request);
    return answer?.kind === "completed" ? answer.value : null;
  };
  const required = prepareRequiredExecutions(source, sources, (function* () {
    for (const row of bodies.values()) if (project.has(row.body.root.origin.module)) yield row.body;
    yield* explicit;
  })(), requireBody, readDeclared, account, unit);
  if (required.kind === "refused") return required;
  for (let index = 0; index < attachments.length; index += 1) {
    const stop = chargeWork(account, 1);
    if (stop !== null) return analysisStop(stop, unit);
    const slot = attachments[index];
    if (slot === undefined) return fail("The retained unopened declaration slots must be dense.");
    const ready = bodies.get(slot.key);
    if (ready === undefined) continue;
    const attached = slot.complete(ready.body);
    if (attached.kind === "refused") return refusal(attached);
  }
  const modules = new Map<ModuleId, TirModule & { readonly bodies: TirBody[] }>();
  for (const module of roots) {
    const own: TirBody[] = [];
    for (const checked of module.module.bodies) {
      const row = bodies.get(instanceKey({ body: checked.body, bindings: parametric }));
      if (row !== undefined) own.push(row.body);
    }
    const root = bodies.get(instanceKey({ body: module.module.tree.tsonic.body, bindings: parametric }))?.body.root;
    if (root !== undefined && root.kind !== "SourceFile") return fail("The module initializer requires its actual SourceFile.");
    modules.set(module.module.module, { module: module.module.module, tree: root === undefined
      ? { kind: "checked-root", root: module.module.tree } : { kind: "ready-root", root }, bodies: own });
  }
  for (const { body } of bodies.values()) {
    if (body.bindings.kind !== "instantiated") continue;
    const module = modules.get(body.root.origin.module);
    if (module === undefined) return fail("A selected typed body requires its actual checked module.");
    module.bodies.push(body);
  }
  const verifiers = new Map<ModuleId, TirVerifierInput>();
  const prepareVerifier = (module: ModuleId): { readonly input: TirVerifierInput; readonly finish: () => void } | null => {
    const original = checkedModules.get(module)?.module;
    const typed = modules.get(module);
    if (original === undefined || typed === undefined) return null;
    let moduleScopes: readonly BindingScope[] | null = null;
    const scopesFrom = <Stop extends object>(target: TirBindingTarget, visit: TirBindingOwnerVisit<Stop>): {
      readonly kind: "complete"; readonly scopes: readonly BindingScope[];
    } | { readonly kind: "resource-stop"; readonly stop: Stop } => {
      const scopes: BindingScope[] = [];
      const stop = visit(owner => {
        const actual = owner ?? (target.kind === "body" ? bodyOf(target.instance.body).owner
          : fail("An unowned module binding needs its actual checked lexical owner."));
        scopes.push(scopeOf(actual));
        return null;
      });
      return stop === null ? { kind: "complete", scopes } : { kind: "resource-stop", stop };
    };
    const scopeRow = (instance: BodyInstance) => {
      const row = bodies.get(instanceKey(instance));
      return row?.body.root.origin.module === module ? row : null;
    };
    let scopeReader: TirVerifierInput["bindingScopesOf"] = (target, subject, visit) => {
      if (target.kind === "module") {
        if (target.module !== module || subject !== typed) return { kind: "complete", scopes: null };
        if (moduleScopes !== null) return { kind: "complete", scopes: moduleScopes };
        if (visit === null) return fail("An initial typed module scope requires its owned binding roles.");
        const result = scopesFrom(target, visit);
        if (result.kind === "complete") moduleScopes = result.scopes;
        return result;
      }
      const row = scopeRow(target.instance);
      if (row === null || row.body !== subject) return { kind: "complete", scopes: null };
      if (row.scopes !== null) return { kind: "complete", scopes: row.scopes };
      if (visit === null) return fail("An initial typed body scope requires its owned binding roles.");
      const result = scopesFrom(target, visit);
      if (result.kind === "complete") row.scopes = result.scopes;
      return result;
    };
    const input: TirVerifierInput = { source: original, module: typed, types: viewTypes(source.types),
      declarationOf, declarationSourceOf: sources.declarationSourceOf, nominalOf: source.nominalOf,
      nodeOf: sources.nodeOf, bindingOf: source.bindingOf, localExists: sources.localExists, staticStorageOf,
      diagnostics: original.checkerDiagnostics, bodyOf: instance => bodies.get(instanceKey(instance))?.body ?? null,
      requiredEntriesOf: instance => required.value.provided.get(instanceKey(instance)) ?? null,
      memberTableOf: (instance, occurrence) => occurrence.kind === "selection" && occurrence.ordinal === 0
        ? memberInventoriesOf(instance.body)?.get(occurrence.node)
          ?? fail("A selected member needs its actual ready canonical member inventory.")
        : fail("A constructed member needs its actual ready canonical inventory."),
      bindingScopesOf: (target, subject, visit) => scopeReader(target, subject, visit) };
    return { input, finish: () => {
      scopeReader = target => ({ kind: "complete", scopes: target.kind === "module" ? target.module === module ? moduleScopes : null
        : scopeRow(target.instance)?.scopes ?? null });
    } };
  };
  for (const module of modules.values()) {
    const prepared = prepareVerifier(module.module);
    if (prepared === null) return fail("A published typed module needs its actual checked source verification input.");
    const { input, finish } = prepared;
    const checkedModule = verifyTirModule(input, module, admit);
    if (checkedModule.kind === "resource-stop") return analysisStop(checkedModule.stop, unit);
    const violations = checkedModule.violations;
    if (violations.length !== 0) return fail(`The actual typed module violates ${violations[0]?.rule}.`);
    const verifyBody = verifyTir(input, admit);
    for (const body of module.bodies) {
      const checkedBody = verifyBody(body);
      if (checkedBody.kind === "resource-stop") return analysisStop(checkedBody.stop, unit);
      const violations = checkedBody.violations;
      if (violations.length !== 0) return fail(`The actual typed body violates ${violations[0]?.rule}.`);
    }
    finish();
    verifiers.set(module.module, input);
  }
  const verifierOf = (module: ModuleId): TirVerifierInput | null => verifiers.get(module) ?? null;
  const placedSignatureOf = (instance: BodyInstance): PlacedSignature | null => bodies.get(instanceKey(instance))?.placed ?? null;
  const signatureIdOf = (request: SignatureRequest): PlacedSignature["signature"]["id"] | null => {
    let ordinal = 0;
    for (const endpoint of declarationOf(request.definition)?.endpoints ?? []) {
      if (endpoint.role !== request.endpoint) continue;
      if (ordinal++ !== request.ordinal) continue;
      if (endpoint.body === null) return required.value.declaredPlacements?.get(signatureRequestKey(request))?.signature.id ?? null;
      const placed = placedSignatureOf({ body: endpoint.body, bindings: request.bindings });
      return placed?.request !== null && placed !== null && signatureRequestKey(placed.request) === signatureRequestKey(request)
        ? placed.signature.id : null;
    }
    return null;
  };
  const programEvidence = (account: DataflowAccount): DataflowResult<ProgramEvidenceInput> => {
    const setup = chargeWork(account, 1) ?? chargeResultEntries(account, 5);
    if (setup !== null) return setup;
    const checked: ProgramEvidenceInput["checked"][number][] = [];
    const members: ProgramMemberEvidence[] = [];
    const signatures: PlacedSignature[] = [];
    const storage: ProgramStaticStorageEvidence[] = [];
    for (let position = 0; position < source.modules.length; position += 1) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      const entry = source.modules[position];
      if (entry === undefined) return fail("The actual checked module evidence inventory is dense.");
      checked.push(entry.module);
    }
    const bodyRows = bodies.values();
    for (let position = 0; position < bodies.size; position += 1) {
      const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
      if (stop !== null) return stop;
      const row = bodyRows.next();
      if (row.done) return fail("The completed placed body evidence retains every original row.");
      const { body, placed } = row.value;
      signatures.push(placed);
      const inventory = memberInventoriesOf(body.body);
      if (inventory === undefined) continue;
      const entries = inventory.entries();
      for (let index = 0; index < inventory.size; index += 1) {
        const admission = chargeWork(account, 1) ?? chargeResultEntries(account, 4);
        if (admission !== null) return admission;
        const member = entries.next();
        if (member.done) return fail("The actual member evidence inventory is dense.");
        const [node, inventory] = member.value;
        members.push({ instance: { body: body.body, bindings: body.bindings }, occurrence: { kind: "selection", node, ordinal: 0 }, inventory });
      }
    }
    const declared = required.value.declaredPlacements;
    if (declared !== null) {
      const placements = declared.values();
      for (let position = 0; position < declared.size; position += 1) {
        const stop = chargeWork(account, 1) ?? chargeResultEntries(account, 1);
        if (stop !== null) return stop;
        const row = placements.next();
        if (row.done) return fail("The completed selected declaration evidence retains every original row.");
        signatures.push(row.value);
      }
    }
    const itemRows = items.entries();
    for (let position = 0; position < items.size; position += 1) {
      const stop = chargeWork(account, 1);
      if (stop !== null) return stop;
      const row = itemRows.next();
      if (row.done) return fail("The checked static storage candidates are complete.");
      const [owner, node] = row.value;
      if (node.kind !== "VariableDeclaration") continue;
      const admission = chargeResultEntries(account, 3);
      if (admission !== null) return admission;
      const declaration = { owner, node: node.id };
      storage.push({ declaration, storage: staticStorageOf(declaration) });
    }
    return { kind: "complete", value: { checked, members, signatures, storage } };
  };
  return { kind: "ok", diagnostics, value: { source, modules, verifierOf, sourceNodeOf: sources.nodeOf, declarationOf, database, staticStorageOf,
    bodies: { get: key => bodies.get(key)?.body, *values() { for (const entry of bodies.values()) yield entry.body; } },
    placedSignatureOf, signatureIdOf, programEvidence, required: required.value, exposure: exposure.value, initializationRoots: initialization.value } };
}
