import type { DeclsModule, DefinitionDescription, DefinitionExport } from "../decls/contract.js";
import type { Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { DefId, DefinitionPath, ModuleId, NodeId } from "../ids/contract.js";
import { decodeBodyId, decodeModuleId } from "../ids/index.js";
import type { LowerDeps, ModuleDefinitions, ModuleExports, ModuleSourceOccurrence, RawModule, RawNodeRef } from "../front/contract.js";
import type { HirBindingViews, HirDeclarationScopes, HirModule } from "../ir-hir/contract.js";
import { createModuleBindingViews, deriveDeclarationScopes, indexSyntaxTree, resolveModuleExport, verifyHir } from "../ir-hir/index.js";
import type { Libraries, ProviderLibraryModel, ProviderLibraryOrigin, ProviderLibraryText } from "../libraries/contract.js";
import { admitGuarantees, bindProviderLibraries } from "../libraries/index.js";
import type { NominalDefinition, TypeInterner, TypePublicationWork } from "../ir-types/contract.js";
import { createTypeInterner, createTypePublicationWork, viewTypes } from "../ir-types/index.js";
import type { PackageModule } from "../snapshot/contract.js";
import type { HostAnalysisInputs } from "./contract.js";
import { checkedSourceViews } from "./checked-inputs.js";
import type { CheckedSourceViews } from "./checked-inputs.js";
import { pipelineWiring } from "./wiring.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export interface SourceModule extends DeclsModule {
  readonly role: PackageModule["role"];
}

export interface SourceBarrier extends HirBindingViews {
  readonly checked: CheckedSourceViews;
  readonly modules: readonly SourceModule[];
  readonly types: TypeInterner;
  readonly typeWork: TypePublicationWork;
  readonly descriptions: ReadonlyMap<DefId, DefinitionDescription>;
  readonly definitionPaths: ReadonlyMap<DefId, DefinitionPath>;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly libraries: Libraries;
}

export function captureSourceBarrier(inputs: HostAnalysisInputs): Result<SourceBarrier> {
  const front = pipelineWiring.front;
  const capture = { extensions: inputs.extensions, navigationCapture: inputs.limits.navigationCapture,
    literalCapture: inputs.limits.evaluation };
  const opened = front.openCheckedProgram(capture, inputs.snapshot);
  if (opened.kind === "refused") return opened;
  const set = front.captureProgramModules(capture, opened.value);
  const raw = new Map<ModuleId, RawModule>();
  const definitions = new Map<ModuleId, ModuleDefinitions>();
  const paths = new Map<DefId, DefinitionPath>();
  const documents = new Map<ModuleId, { readonly text: string; readonly role: PackageModule["role"] }>();
  const fileText = new Map(inputs.snapshot.source.input.packages.files.map(file => [file.path, file.text]));
  const snapshotModules = new Map(inputs.snapshot.source.input.packages.modules.map(module => [module.id, module]));
  for (const entry of set.modules) {
    const module = entry.kind === "snapshot" ? entry.module : entry.document.module;
    const captured = front.captureModule(capture, opened.value, module);
    if (captured.kind === "refused") return captured;
    if (raw.has(module)) return fail("The actual opened module inventory cannot repeat a module identity.");
    raw.set(module, captured.value);
    if (entry.kind === "session-document") documents.set(module, { text: entry.document.text, role: "declaration" });
    else {
      const receipt = snapshotModules.get(module);
      const text = receipt === undefined ? undefined : fileText.get(receipt.path);
      if (receipt === undefined || text === undefined) return fail("Every captured snapshot module needs its actual document and role.");
      documents.set(module, { text, role: receipt.role });
    }
  }
  const componentRoots = new Map<ModuleId, RawNodeRef[]>();
  const request = (root: RawNodeRef): void => {
    if (!raw.has(root.module)) return fail("A captured source occurrence must belong to the actual captured program module inventory.");
    const requested = componentRoots.get(root.module) ?? [];
    requested.push(root);
    componentRoots.set(root.module, requested);
  };
  for (const captured of raw.values()) {
    for (const component of captured.types.components) request(component.root);
    for (const entry of captured.exports) if (entry.typeOnlyStar !== null) request(entry.typeOnlyStar);
    for (const table of captured.types.members) for (const member of table.members) {
      for (const origin of member.origins) if (origin.kind === "source-member") request(origin.occurrence);
    }
  }
  for (const [module, captured] of raw) {
    const identified = front.lowerModuleDefinitions({ module: captured, componentRoots: componentRoots.get(module) ?? [] });
    if (identified.kind === "refused") return identified;
    definitions.set(module, identified.value);
    for (const row of identified.value.rows) paths.set(row.definition, { module, segments: row.segments });
  }
  const defined = new Map<ModuleId, ReadonlyMap<NodeId, DefId>>();
  const occurrences = new Map<ModuleId, ReadonlyMap<NodeId, ModuleSourceOccurrence>>();
  for (const [module, rows] of definitions) {
    defined.set(module, new Map(rows.rows.map(row => [row.node, row.definition])));
    occurrences.set(module, new Map(rows.sourceOccurrences.map(row => [row.node, row])));
  }
  const definitionOf = (reference: RawNodeRef): DefId => defined.get(reference.module)?.get(reference.node)
    ?? fail("A declaration projection must name its genuine complete F1 row.");
  const exported = new Map<ModuleId, ModuleExports>();
  const types = createTypeInterner();
  const typeWork = createTypePublicationWork(inputs.limits.instantiation);
  const lowering: LowerDeps = {
    types,
    definitionOf, sourceOccurrenceOf: reference => occurrences.get(reference.module)?.get(reference.node) ?? null,
    exportsOf: module => exported.get(module) ?? null,
    sourceTextOf: module => documents.get(module)?.text ?? fail("A source projection cannot borrow another module's text."),
    typeExpansion: inputs.limits.instantiation.typeExpansion,
    typeWork,
    literalCapture: inputs.limits.evaluation,
  };
  for (const [module, captured] of raw) {
    const result = front.lowerModuleExports(lowering, captured);
    if (result.kind === "refused") return result;
    exported.set(module, result.value);
  }
  const checked = new Map<ModuleId, HirModule>();
  const modules: SourceModule[] = [];
  for (const [module, captured] of raw) {
    const result = front.lowerModule(lowering, captured);
    if (result.kind === "refused") return result;
    checked.set(module, result.value);
    const document = documents.get(module);
    if (document === undefined) return fail("A checked module retains its actual captured document and role.");
    modules.push({ module: result.value, nodes: indexSyntaxTree(result.value.tree), role: document.role });
  }
  const sources = checkedSourceViews(modules);
  const scopes = new Map<ModuleId, HirDeclarationScopes>();
  for (const { module, nodes } of modules) scopes.set(module.module, deriveDeclarationScopes(module, nodes));
  const scopesOf = (definition: DefId): HirDeclarationScopes | null => {
    const path = paths.get(definition);
    return path === undefined ? null : scopes.get(path.module) ?? null;
  };
  const bindingScopeOf = (definition: DefId) => scopesOf(definition)?.bindingScopeOf(definition) ?? null;
  const nominalOf = (definition: DefId) => scopesOf(definition)?.nominalOf(definition) ?? null;
  const table = viewTypes(types);
  for (const { module } of modules) {
    const violations = verifyHir(module, {
      types: table, moduleOf: identity => checked.get(identity) ?? null,
      bodyPathOf: identity => { const path = decodeBodyId(identity); return path.kind === "decoded" ? path.value : null; },
      definitionPathOf: identity => paths.get(identity) ?? null,
      bindingScopeOf,
      bindingScopeAt: reference => {
        const source = sources.nodeOf(reference);
        const owner = reference.kind === "item" ? reference.value.owner : sources.bodies.get(reference.value.body)?.owner;
        return source === null || owner === undefined ? null : bindingScopeOf(owner);
      },
      nominalOf,
      nodeOf: sources.nodeOf, localExists: sources.localExists,
    });
    if (violations.length !== 0) return fail(`The actual Front checked module failed its owning HIR verification barrier: ${violations[0]?.rule}.`);
  }
  const views = createModuleBindingViews(modules.map(module => module.module.bindings));
  const exportNames = new Map<ModuleId, Map<DefId, DefinitionExport[]>>();
  for (const module of modules) for (const entry of module.module.exports) {
    const resolution = resolveModuleExport(views, entry).target;
    if (resolution.kind === "available" && (resolution.value.kind === "module" || resolution.value.kind === "unresolved")) continue;
    if (resolution.kind !== "available" || resolution.value.kind !== "declarations")
      return fail("The public external-entry projection needs the actual completed exported declaration group.");
    for (const definition of resolution.value.definitions) {
      const declaringModule = paths.get(definition)?.module;
      if (declaringModule === undefined) return fail("An exported declaration must belong to its actual assigned module.");
      let definitions = exportNames.get(declaringModule);
      if (definitions === undefined) {
        definitions = new Map();
        exportNames.set(declaringModule, definitions);
      }
      const previous = definitions.get(definition);
      const name = { module: module.module.module, name: entry.name };
      if (previous === undefined) definitions.set(definition, [name]);
      else previous.push(name);
    }
  }
  const descriptions = new Map<DefId, DefinitionDescription>();
  for (const module of modules) {
    const names = Array.from(exportNames.get(module.module.module) ?? [], ([definition, exports]) => ({ definition, exports }));
    const declarationScopes = scopes.get(module.module.module) ?? fail("Every verified module needs its actual checked declaration scopes.");
    const described = pipelineWiring.decls.describeDefinitions(module, declarationScopes, names);
    for (const row of described.definitions) descriptions.set(row.definition, row);
  }
  const libraryModels: ProviderLibraryModel[] = [];
  const libraryTexts: ProviderLibraryText[] = [];
  const libraryOrigins: ProviderLibraryOrigin[] = [];
  for (const entry of set.modules) {
    if (entry.kind !== "session-document") continue;
    const { document } = entry;
    const captured = raw.get(document.module);
    const location = decodeModuleId(document.module);
    if (captured === undefined || location.kind !== "decoded" || location.value.package !== document.package)
      return fail("A provider library must retain its opened source document and registering package.");
    libraryTexts.push({ package: document.package, identity: document.provider, fileName: location.value.path, sourceText: document.text });
    if (document.artifact === "public") {
      const model = captured.publicLibraryModule;
      if (model?.identity !== document.provider || captured.providerDeclarations.length !== 0)
        return fail("The actual public provider document supplies a model, not a canonical declaration.");
      libraryModels.push({ package: document.package, model });
      continue;
    }
    if (captured.publicLibraryModule !== null) return fail("A canonical declaration cannot supply a second public model.");
    for (const row of captured.providerDeclarations) {
      const definition = definitionOf(row.node);
      const source = sources.nodeOf({ kind: "item", value: { owner: definition, node: row.node.node } });
      if (row.node.module !== document.module || row.identity.module !== document.provider || source === null
        || source.origin.module !== document.module || source.tsonic === null || !("core" in source.tsonic)
        || source.tsonic.core.provider.kind !== "available" || source.tsonic.core.provider.value !== definition)
        return fail("A native declaration receipt must name its original qualified checked declaration.");
      libraryOrigins.push({ package: document.package, identity: row.identity, definition });
    }
  }
  const bound = bindProviderLibraries({ models: libraryModels, texts: libraryTexts, origins: libraryOrigins },
    inputs.snapshot.source.input.packages.libraryData);
  if (bound.kind === "refused") return bound;
  const admitted = admitGuarantees(bound.value.bound, bound.value.declaredSummaries, []);
  if (admitted.kind === "refused") return admitted;
  return { kind: "ok", diagnostics: opened.diagnostics,
    value: { checked: sources, modules, types, typeWork, descriptions, definitionPaths: paths, nominalOf, libraries: admitted.value, bindingOf: views.bindingOf } };
}
