import type { Diagnostic, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, ModuleId } from "../ids/contract.js";
import type { CheckedPhase, Declaration, HirBody, HirNode } from "../ir-hir/contract.js";
import type { InferenceDeclaration, InferenceGroup, InferSite } from "../ir-infer/contract.js";
import { inferenceBindingSites } from "../ir-infer/index.js";
import type { BindingScope, BodyInstance } from "../ir-types/contract.js";
import { instanceKey, readSignature, readType, viewTypes } from "../ir-types/index.js";
import type { TirBody, TirModule, TirVerifierInput } from "../ir-tir/contract.js";
import { tirBindingOwners, verifyTir, verifyTirModule } from "../ir-tir/index.js";
import type { HostAnalysisInputs } from "./contract.js";
import type { InferencePublication } from "./inference-step.js";
import type { SourceSemanticInputs, SourceSemanticWitness } from "./semantic-queries.js";
import type { Database } from "../query/contract.js";
import type { DeclaredSignatureErrorData } from "../decls/contract.js";
import type { RefusedOccurrence } from "../validate/contract.js";
import type { Query } from "../query/contract.js";
import type { SourceBarrier } from "./source-barrier.js";
import { checkedSourceViews } from "./checked-inputs.js";
import { inferDepsOf } from "./infer-deps-step.js";
import { createSourceSemanticDatabase } from "./semantic-queries.js";
import { pipelineWiring } from "./wiring.js";

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
  readonly bodies: ReadonlyMap<string, TirBody>;
  readonly modules: ReadonlyMap<ModuleId, TirModule>;
  readonly verifierOf: (module: ModuleId) => TirVerifierInput | null;
  readonly declarationOf: (definition: DefId) => InferenceDeclaration | null;
  readonly database: Database<SourceSemanticInputs, SourceSemanticWitness, DeclaredSignatureErrorData>;
}

export function typeSourceBarrier(inputs: HostAnalysisInputs, source: SourceBarrier): Result<TypedSourceBarrier> {
  const sources = checkedSourceViews(source.modules);
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
  const declarationOf = (definition: DefId): InferenceDeclaration | null => {
    const item = items.get(definition);
    if (item === undefined) return null;
    return { scope: scopeOf(definition), parameterCount: "parameters" in item && item.parameters !== null
      && "nodes" in item.parameters ? item.parameters.nodes.length : null,
      endpoints: item.tsonic !== null && "signatures" in item.tsonic ? item.tsonic.signatures : [] };
  };
  const inference = inferDepsOf({ rules: { libraries: source.libraries, types: source.types,
    typeExpansion: inputs.limits.instantiation.typeExpansion }, hirBody: bodyOf, itemOf,
    bindings: source.modules.map(module => module.module.bindings), limits: inputs.limits.inference,
    graph: inputs.limits.dataflow });
  const grouped = pipelineWiring.infer.groupsOf(inference, [...sources.bodies.keys()]);
  if (grouped.kind === "refused") return grouped;
  const groupOf = new Map<BodyId, InferenceGroup>();
  for (const group of grouped.value) for (const body of group.bodies) groupOf.set(body, group);
  const { database, queries } = createSourceSemanticDatabase({ declarations: {
    modules: source.modules, types: source.types, typeExpansion: inputs.limits.instantiation.typeExpansion,
  }, inference, groups: grouped.value, sources, verification: (_group, constraints, result) => {
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
  } }, inputs.limits.query);
  const solved = new Map<BodyId, InferencePublication>();
  const project = new Set(inputs.snapshot.packages.modules.filter(module => module.package === inputs.snapshot.packages.rootPackage)
    .map(module => module.id));
  const roots = source.modules;
  const forms: Query<SourceSemanticInputs, ModuleId, readonly RefusedOccurrence[], SourceSemanticWitness, DeclaredSignatureErrorData> = {
    name: "formDiagnostics", keyData: module => module, answerPolicy: { kind: "refusal-only" },
    compute: (context, key) => {
      const module = roots.find(module => module.module.module === key);
      const receipt = inputs.snapshot.packages.modules.find(module => module.id === key);
      if (module === undefined || receipt === undefined) return fail("Forms requires its actual checked project module and captured document role.");
      return pipelineWiring.validate.formDiagnostics({ libraries: source.libraries, role: receipt.role }, module.module,
        { query: context.fact.query, key: context.fact.key });
    },
  };
  const formDiagnostics: Diagnostic[] = [];
  for (const module of roots) {
    const result = database.run(forms, module.module.module);
    formDiagnostics.push(...result.diagnostics);
  }
  const formError = formDiagnostics.find(diagnostic => diagnostic.severity === "error");
  if (formError !== undefined) return { kind: "refused", diagnostics: [formError, ...formDiagnostics.filter(diagnostic => diagnostic !== formError)] };
  for (const module of roots) for (const body of module.module.bodies) {
    const group = groupOf.get(body.body);
    if (group === undefined) return fail("Every project body requires its actual canonical inference group.");
    const completed = database.run(queries.solutionOf, group.id);
    if (completed.kind === "refused") return completed;
    for (const member of group.bodies) solved.set(member, completed.value);
  }
  const bodies = new Map<string, TirBody>();
  const modules = new Map<ModuleId, TirModule>();
  const elaboration = { types: source.types, rules: inference.rules, nodeOf: sources.nodeOf,
    typeOf: (type: Parameters<typeof readType>[1]) => readType(source.types, type),
    signatureOf: (signature: Parameters<typeof readSignature>[1]) => readSignature(source.types, signature),
    checkerDiagnosticsOf: (module: ModuleId) => source.modules.find(checked => checked.module.module === module)?.module.checkerDiagnostics
      ?? fail("A typed occurrence needs its original module's checker diagnostic inventory.") };
  const modes: readonly ("parametric" | "instantiated")[] = ["parametric", "instantiated"];
  for (const module of roots) {
    for (const mode of modes) {
      if (mode === "instantiated" && !project.has(module.module.module)) continue;
      const pending = module.module.bodies.map(body => ({ body: body.body, build: false })).reverse();
      while (pending.length !== 0) {
        const next = pending.pop();
        if (next === undefined) return fail("The actual typed work vector is dense.");
        const checked = bodyOf(next.body);
        const scope = scopeOf(checked.owner);
        if (mode === "instantiated" && (scope.classParameters.length !== 0 || scope.methodParameters.length !== 0
          || scope.capturedParameters.length !== 0 || scope.selfOwners.length !== 0)) continue;
        const bindings: BodyInstance["bindings"] = mode === "parametric" ? { kind: "parametric" }
          : { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
        const instance: BodyInstance = { body: checked.body, bindings };
        const key = instanceKey(instance);
        if (bodies.has(key)) continue;
        const dependencies = [...checked.nestedBodies, ...checked.params.flatMap(parameter => parameter.initializer === null ? [] : [parameter.initializer])];
        if (!next.build) {
          pending.push({ body: checked.body, build: true });
          for (let index = dependencies.length - 1; index >= 0; index -= 1) {
            const child = dependencies[index];
            if (child === undefined) return fail("The checked nested body inventory is dense.");
            pending.push({ body: child, build: false });
          }
          continue;
        }
        const publication = solved.get(checked.body);
        const constraints = publication?.constraints.constraints.find(system => system.body === checked.body);
        if (publication === undefined || constraints === undefined) return fail("Elaboration requires the actual verified completed group solution.");
        const ready = (body: BodyId): TirBody => bodies.get(instanceKey({ body, bindings }))
          ?? fail("Elaboration requires the actual same-binding nested body, not a substituted template.");
        const result = pipelineWiring.elaborate.elaborate(elaboration, { instance, scope, body: checked, constraints,
          solution: publication.solution, template: mode === "parametric" ? null
            : bodies.get(instanceKey({ body: checked.body, bindings: { kind: "parametric" } }))
              ?? fail("A selected body requires its actual completed template."),
          nestedBodies: checked.nestedBodies.map(ready),
          initializers: checked.params.flatMap(parameter => parameter.initializer === null ? [] : [ready(parameter.initializer)]) });
        if (result.kind === "refused") return result;
        bodies.set(key, result.value);
      }
    }
    const own = module.module.bodies.map(body => bodies.get(instanceKey({ body: body.body, bindings: { kind: "parametric" } }))
      ?? fail("Every required source body has one authentic template."));
    const moduleBody = own.find(body => body.root.kind === "SourceFile");
    if (moduleBody === undefined || moduleBody.root.kind !== "SourceFile") return fail("A typed module retains its actual canonical SourceFile root.");
    const selected = [...bodies.values()].filter(body => body.root.origin.module === module.module.module && body.bindings.kind === "instantiated");
    modules.set(module.module.module, { module: module.module.module, tree: moduleBody.root, bodies: [...own, ...selected] });
  }
  const verifierOf = (module: ModuleId): TirVerifierInput | null => {
    const original = source.modules.find(checked => checked.module.module === module)?.module;
    const typed = modules.get(module);
    if (original === undefined || typed === undefined) return null;
    const input: TirVerifierInput = { source: original, module: typed, types: viewTypes(source.types),
      declarationOf, nominalOf: source.nominalOf, nodeOf: sources.nodeOf, localExists: sources.localExists,
      diagnostics: original.checkerDiagnostics, bodyOf: instance => bodies.get(instanceKey(instance)) ?? null,
      memberTableOf: () => fail("A selected member needs its actual ready canonical member inventory."),
      bindingScopesOf: target => tirBindingOwners(input, target).map(owner => {
        if (owner !== null) return scopeOf(owner);
        if (target.kind === "body") return scopeOf(bodyOf(target.instance.body).owner);
        return fail("An unowned module binding needs its actual checked lexical owner.");
      }) };
    return input;
  };
  for (const module of modules.values()) {
    const input = verifierOf(module.module);
    if (input === null) return fail("A published typed module needs its actual checked source verification input.");
    const violations = verifyTirModule(input, module);
    if (violations.length !== 0) return fail(`The actual typed module violates ${violations[0]?.rule}.`);
    for (const body of module.bodies) {
      const violations = verifyTir(input, body);
      if (violations.length !== 0) return fail(`The actual typed body violates ${violations[0]?.rule}.`);
    }
  }
  const diagnostics: readonly Diagnostic[] = database.diagnostics();
  const first = diagnostics.find(diagnostic => diagnostic.severity === "error");
  if (first !== undefined) return { kind: "refused", diagnostics: [first, ...diagnostics.filter(diagnostic => diagnostic !== first)] };
  return { kind: "ok", diagnostics, value: { source, bodies, modules, verifierOf, declarationOf, database } };
}
