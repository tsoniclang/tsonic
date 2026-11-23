import type { DeclsModule } from "../decls/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, LocalRef, ModuleId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type { CheckedTypingCut, CheckedTypingCuts, HirBody, HirNode } from "../ir-hir/contract.js";
import { checkedParameterHeadersOf, childrenOfSyntax } from "../ir-hir/index.js";
import type { StructuralTypingCuts } from "../infer/contract.js";
import type { FormDiagnosticSite, FormsScope } from "../validate/contract.js";

export interface CheckedSourceViews {
  readonly bodies: ReadonlyMap<BodyId, HirBody>;
  readonly nodeOf: (reference: SourceNodeRef) => HirNode | null;
  readonly localExists: (reference: LocalRef) => boolean;
  readonly declarationSourceOf: (definition: DefId) => SourceNodeRef | null;
  readonly cuts: CheckedTypingCuts;
  readonly structuralCuts: StructuralTypingCuts;
  readonly formScopeOf: (node: HirNode) => FormsScope;
  readonly formOfSyntax: (node: HirNode) => FormDiagnosticSite | null;
  readonly formOfDeclaration: (definition: DefId) => FormDiagnosticSite | null;
  readonly formOfBody: (body: BodyId) => FormDiagnosticSite | null;
  readonly formOfInitializer: (definition: DefId, index: number) => FormDiagnosticSite | null;
  readonly bindForms: (reportOf: (site: FormDiagnosticSite) => CheckedTypingCut | undefined) => CheckedTypingCuts;
}

interface Namespace {
  readonly module: DeclsModule;
  readonly bodies: readonly (BodyId | null)[];
  readonly items: readonly (DefId | null)[];
}

export interface CheckedBodyNodeRange {
  readonly nodes: readonly HirNode[];
  readonly start: number;
  readonly end: number;
}

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

function ordinal(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

export function checkedSourceViews(modules: readonly DeclsModule[],
  bodyRange?: (body: BodyId, range: CheckedBodyNodeRange) => void,
  forms?: ReadonlyMap<ModuleId, readonly FormDiagnosticSite[]>): CheckedSourceViews {
  const bodies = new Map<BodyId, HirBody>();
  const bodyNamespaces = new Map<BodyId, Namespace>();
  const namespaces = new Map<ModuleId, Namespace>();
  const declarations = new Map<DefId, { readonly namespace: Namespace; readonly source: SourceNodeRef }>();
  const syntaxCuts = new Map<HirNode, FormDiagnosticSite>();
  const bodyCuts = new Map<BodyId, FormDiagnosticSite>();
  let initializerCuts: Map<DefId, Map<number, FormDiagnosticSite>> | undefined;
  const declarationCut = (definition: DefId): FormDiagnosticSite | null => {
    const actual = declarations.get(definition);
    const node = actual?.namespace.module.nodes[actual.source.value.node];
    return node === undefined ? null : syntaxCuts.get(node) ?? null;
  };
  for (const module of modules) {
    const roots = new Map<HirNode, FormDiagnosticSite>();
    for (const cut of forms?.get(module.module.module) ?? []) {
      const node = cut.cut;
      if (cut.module !== module.module.module || module.nodes[node.id] !== node || module.nodes[cut.report.id] !== cut.report)
        return fail("A Forms cut requires its actual checked syntax in the qualified module.");
      if (!roots.has(node)) roots.set(node, cut);
    }
    const atBody = new Map<NodeId, BodyId>();
    const atItem = new Map<NodeId, DefId>();
    const bodiesOfOwner = new Map<DefId, HirBody[]>();
    const bodyOwners: (BodyId | null)[] = [];
    const itemOwners: (DefId | null)[] = [];
    const namespace: Namespace = { module, bodies: bodyOwners, items: itemOwners };
    namespaces.set(module.module.module, namespace);
    for (const body of module.module.bodies) {
      if (bodies.has(body.body) || atBody.has(body.root.id))
        return fail("Ready checked executions must have unique body identities and canonical root occurrences.");
      bodies.set(body.body, body);
      bodyNamespaces.set(body.body, namespace);
      atBody.set(body.root.id, body.body);
      const owned = bodiesOfOwner.get(body.owner);
      if (owned === undefined) bodiesOfOwner.set(body.owner, [body]);
      else owned.push(body);
    }
    const item = (definition: DefId, node: NodeId): void => {
      if (declarations.has(definition) || atItem.has(node))
        fail("Ready checked declarations must have unique identities and source occurrences.");
      atItem.set(node, definition);
      declarations.set(definition, { namespace, source: { kind: "item", value: { owner: definition, node } } });
    };
    item(module.module.tree.tsonic.definition, module.module.tree.id);
    for (const declaration of module.module.items) item(declaration.definition, declaration.node);
    const definitionAt = (node: NodeId): DefId | undefined => atItem.get(node);
    const pending: { readonly node: HirNode; readonly body: BodyId | null; readonly item: DefId | null;
      readonly cut: FormDiagnosticSite | null }[] =
      [{ node: module.module.tree, body: null, item: null, cut: null }];
    let count = 0;
    let rangeBody: BodyId | null = null;
    let rangeStart = 0;
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      const id = next.node.id;
      if (!ordinal(id) || id !== count || module.nodes[id] !== next.node)
        return fail("A ready source namespace must use its actual dense canonical checked syntax table.");
      const body = atBody.get(id) ?? next.body;
      const actualOwner = atItem.get(id);
      const owner = actualOwner ?? (atBody.has(id) ? null : next.item);
      const cut = next.cut ?? roots.get(next.node) ?? null;
      if (cut !== null) {
        syntaxCuts.set(next.node, cut);
        const detached = atBody.get(id);
        if (detached !== undefined && !bodyCuts.has(detached)) bodyCuts.set(detached, cut);
      }
      if (actualOwner !== undefined) {
        const owned = bodiesOfOwner.get(actualOwner);
        if (owned !== undefined) {
          bodiesOfOwner.delete(actualOwner);
          for (const execution of owned) {
            if (cut !== null) { if (!bodyCuts.has(execution.body)) bodyCuts.set(execution.body, cut); continue; }
            const callable = next.node;
            let headerCut: FormDiagnosticSite | undefined;
            if (roots.size !== 0 && "parameters" in callable && callable.parameters !== null)
              for (const header of callable.parameters.nodes) {
                headerCut = roots.get(header);
                if (headerCut !== undefined) break;
              }
            if (headerCut !== undefined) { bodyCuts.set(execution.body, headerCut); continue; }
            if (execution.params.length === 0) continue;
            const headers = checkedParameterHeadersOf(callable, execution, definitionAt);
            if (headers === null) return fail("A checked parameter domain requires its actual checked callable, declarations and parameter locals.");
            let formalIndex = 0;
            for (const [position, header] of headers.entries()) {
              if (module.nodes[header.id] !== header || atBody.has(header.id))
                return fail("A checked parameter domain requires unique headers in its actual syntax inventory.");
              atBody.set(header.id, execution.body);
              if (roots.size === 0) continue;
              const parameter = execution.params[position];
              if (parameter === undefined) return fail("A checked header must retain its actual formal row.");
              if (parameter.role === "this") continue;
              const index = formalIndex;
              formalIndex += 1;
              const initializer = header.initializer;
              if (initializer === null) continue;
              const defaultCut = roots.get(initializer);
              if (defaultCut === undefined) continue;
              const actual = parameter.initializer === null ? undefined : bodies.get(parameter.initializer);
              if (parameter.role !== "default" || actual?.root !== initializer || actual.owner !== parameter.declaration
                || atBody.get(initializer.id) !== actual.body)
                return fail("A cut formal initializer must retain its actual separately placed execution.");
              const all = initializerCuts ??= new Map();
              let byIndex = all.get(actualOwner);
              if (byIndex === undefined) { byIndex = new Map(); all.set(actualOwner, byIndex); }
              if (byIndex.has(index)) return fail("A cut formal initializer must retain one owning formal position.");
              byIndex.set(index, defaultCut);
            }
          }
        }
      }
      if (bodyRange !== undefined && body !== rangeBody) {
        if (rangeBody !== null) bodyRange(rangeBody, { nodes: module.nodes, start: rangeStart, end: count });
        rangeBody = body;
        rangeStart = count;
      }
      bodyOwners.push(body);
      itemOwners.push(owner);
      count += 1;
      const children = childrenOfSyntax(next.node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child === undefined) return fail("A checked syntax child inventory must not contain a hole.");
        pending.push({ node: child, body, item: owner, cut });
      }
    }
    if (rangeBody !== null) bodyRange?.(rangeBody, { nodes: module.nodes, start: rangeStart, end: count });
    if (count !== module.nodes.length) return fail("A ready source namespace cannot contain syntax rows outside its actual tree.");
    if (bodiesOfOwner.size !== 0) return fail("Every ready checked execution requires its actual declaration occurrence.");
    for (const root of atBody.keys()) if (!ordinal(root) || bodyOwners[root] !== atBody.get(root))
      return fail("A ready execution domain entry must occur in its actual checked tree.");
    for (const [node, definition] of atItem) if (!ordinal(node) || itemOwners[node] !== definition)
      return fail("A ready declaration must occur at its actual checked source node.");
  }
  const bodyCut = (body: BodyId): FormDiagnosticSite | null => {
    const actual = bodies.get(body);
    return actual === undefined ? null : bodyCuts.get(body) ?? declarationCut(actual.owner);
  };
  const initializerCut = (definition: DefId, index: number): FormDiagnosticSite | null => initializerCuts?.get(definition)?.get(index) ?? null;
  const bindForms = (reportOf: (site: FormDiagnosticSite) => CheckedTypingCut | undefined): CheckedTypingCuts => {
    const ready = (site: FormDiagnosticSite | null): CheckedTypingCut | null => {
      if (site === null) return null;
      const cut = reportOf(site);
      if (cut === undefined || cut.node !== site.cut || cut.module !== site.module)
        return fail("A protected checked role requires its exact completed Forms report.");
      return cut;
    };
    return { syntax: node => ready(syntaxCuts.get(node) ?? null), body: body => ready(bodyCut(body)),
      declaration: definition => ready(declarationCut(definition)), parameterInitializer: (definition, index) => ready(initializerCut(definition, index)) };
  };
  return {
    bodies,
    nodeOf: reference => {
      const node = reference.value.node;
      if (!ordinal(node)) return null;
      if (reference.kind === "body") {
        const namespace = bodyNamespaces.get(reference.value.body);
        return namespace?.bodies[node] === reference.value.body ? namespace.module.nodes[node] ?? null : null;
      }
      const namespace = declarations.get(reference.value.owner)?.namespace;
      return namespace?.items[node] === reference.value.owner ? namespace.module.nodes[node] ?? null : null;
    },
    localExists: reference => ordinal(reference.local) && bodies.get(reference.body)?.locals[reference.local]?.id === reference.local,
    declarationSourceOf: definition => declarations.get(definition)?.source ?? null,
    cuts: bindForms(() => undefined),
    structuralCuts: { syntax: node => syntaxCuts.has(node), body: body => bodyCut(body) !== null,
      declaration: definition => declarationCut(definition) !== null, parameterInitializer: (definition, index) => initializerCut(definition, index) !== null },
    bindForms, formOfSyntax: node => syntaxCuts.get(node) ?? null, formOfDeclaration: declarationCut,
    formOfBody: bodyCut, formOfInitializer: initializerCut,
    formScopeOf: node => {
      const namespace = namespaces.get(node.origin.module);
      if (namespace === undefined || namespace.module.nodes[node.id] !== node)
        return fail("A Forms site requires its actual admitted checked occurrence.");
      const bodyId = namespace.bodies[node.id];
      const body = bodyId === null || bodyId === undefined ? undefined : bodies.get(bodyId);
      const definition = namespace.items[node.id];
      const declaration = definition === null || definition === undefined ? undefined : declarations.get(definition)?.source;
      if (body?.root === node && node.kind !== "SourceFile") return { kind: "execution", body: body.body, root: body.root };
      if (declaration?.kind === "item" && declaration.value.node === node.id && node.kind !== "SourceFile")
        return { kind: "declaration-header", declaration: declaration.value };
      const tree = namespace.module.module.tree;
      if (node.kind === "VariableStatement" && node.parent !== null && namespace.module.nodes[node.parent] === tree
        && definition === tree.tsonic.definition)
        return { kind: "declaration-header", declaration: { owner: definition, node: node.id } };
      if (node.kind === "SourceFile" || node.kind === "ImportDeclaration" || node.kind === "ImportEqualsDeclaration"
        || node.kind === "ExportDeclaration" || node.kind === "ExportAssignment")
        return { kind: "module-header", module: namespace.module.module.module };
      if (body !== undefined) return { kind: "execution", body: body.body, root: body.root };
      if (declaration?.kind === "item") return { kind: "declaration-header", declaration: declaration.value };
      return fail("A Forms site requires its actual authored role.");
    },
  };
}
