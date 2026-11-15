import type { DeclsModule, DefinitionDescription, DefinitionExports } from "../decls/contract.js";
import type { Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { DefId, DefinitionPath, ModuleId, NodeId } from "../ids/contract.js";
import { decodeBodyId } from "../ids/index.js";
import type { LowerDeps, ModuleDefinitions, ModuleExports, ModuleSourceOccurrence, RawModule, RawNodeRef } from "../front/contract.js";
import type { HirBindingViews, HirModule } from "../ir-hir/contract.js";
import { createModuleBindingViews, indexSyntaxTree, projectExportDeclarations, verifyHir } from "../ir-hir/index.js";
import type { Libraries, LibraryCatalogue } from "../libraries/contract.js";
import { admitGuarantees, bindRoles, libraryExportKey } from "../libraries/index.js";
import type { NominalDefinition, TypeInterner } from "../ir-types/contract.js";
import { createTypeInterner, viewTypes } from "../ir-types/index.js";
import type { HostAnalysisInputs } from "./contract.js";
import { checkedSourceViews } from "./checked-inputs.js";
import { pipelineWiring } from "./wiring.js";

function fail(message: string): never {
  return throwInvariant({ owner: "pipeline", query: null, origin: null, message });
}

export interface SourceBarrier extends HirBindingViews {
  readonly modules: readonly DeclsModule[];
  readonly types: TypeInterner;
  readonly descriptions: ReadonlyMap<DefId, DefinitionDescription>;
  readonly definitionPaths: ReadonlyMap<DefId, DefinitionPath>;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly libraries: Libraries;
}

export function captureSourceBarrier(inputs: HostAnalysisInputs): Result<SourceBarrier> {
  const front = pipelineWiring.front;
  const capture = { extensions: inputs.extensions, navigationCapture: inputs.limits.navigationCapture };
  const opened = front.openCheckedProgram(capture, inputs.snapshot, inputs.preparation);
  if (opened.kind === "refused") return opened;
  const set = front.captureProgramModules(capture, opened.value);
  const raw = new Map<ModuleId, RawModule>();
  const definitions = new Map<ModuleId, ModuleDefinitions>();
  const paths = new Map<DefId, DefinitionPath>();
  const names = new Map<ModuleId, string>();
  const fileText = new Map(inputs.snapshot.packages.files.map(file => [file.path, file.text]));
  const snapshotModules = new Map(inputs.snapshot.packages.modules.map(module => [module.id, module]));
  for (const entry of set.modules) {
    const module = entry.kind === "snapshot" ? entry.module : entry.document.module;
    const captured = front.captureModule(capture, opened.value, module);
    if (captured.kind === "refused") return captured;
    const identified = front.lowerModuleDefinitions(captured.value);
    if (identified.kind === "refused") return identified;
    if (raw.has(module)) return fail("The actual opened module inventory cannot repeat a module identity.");
    raw.set(module, captured.value);
    definitions.set(module, identified.value);
    for (const row of identified.value.rows) paths.set(row.definition, { module, segments: row.segments });
    const path = snapshotModules.get(module)?.path;
    const text = entry.kind === "session-document" ? entry.document.text : path === undefined ? undefined : fileText.get(path);
    if (text === undefined) return fail("Every captured module needs its actual snapshot or admitted session-document text.");
    names.set(module, text);
  }
  const defined = new Map<ModuleId, ReadonlyMap<NodeId, DefId>>();
  const occurrences = new Map<ModuleId, ReadonlyMap<NodeId, ModuleSourceOccurrence>>();
  for (const [module, rows] of definitions) {
    defined.set(module, new Map(rows.rows.map(row => [row.node, row.definition])));
    occurrences.set(module, new Map(rows.sourceOccurrences.map(row => [row.node, row])));
  }
  const definitionOf = (reference: RawNodeRef): DefId => defined.get(reference.module)?.get(reference.node)
    ?? fail("A declaration projection must name its genuine complete F1 row.");
  const native = new Map<string, DefId>();
  for (const module of raw.values()) for (const row of module.providerDeclarations) {
    const definition = defined.get(row.node.module)?.get(row.node.node);
    if (definition === undefined) continue;
    const key = libraryExportKey(row.identity);
    const known = native.get(key);
    if (known !== undefined && known !== definition)
      return fail("The singleton native declaration port cannot choose a representative of a complete declaration group.");
    native.set(key, definition);
  }
  if (inputs.snapshot.packages.libraryData.length !== 0)
    return fail("The ready native LibraryCatalogue producer has not yet been connected to public Host analysis.");
  const catalogue: LibraryCatalogue = { sources: [] };
  const bound = bindRoles(catalogue, identity => native.get(libraryExportKey(identity))
    ?? fail("A selected library role requires its actual checked provider declaration."));
  if (bound.kind === "refused") return bound;
  const admitted = admitGuarantees(bound.value, [], []);
  if (admitted.kind === "refused") return admitted;
  const exported = new Map<ModuleId, ModuleExports>();
  const types = createTypeInterner();
  const lowering: LowerDeps = {
    types, libraries: catalogue,
    definitionOf, sourceOccurrenceOf: reference => occurrences.get(reference.module)?.get(reference.node) ?? null,
    definitionOfExport: identity => native.get(libraryExportKey(identity))
      ?? fail("A native declaration projection must name its actually captured selected provider receipt."),
    exportsOf: module => exported.get(module) ?? null,
    sourceTextOf: module => names.get(module) ?? fail("A source projection cannot borrow another module's text."),
    typeExpansion: inputs.limits.instantiation.typeExpansion,
    typePublication: { maximumWork: inputs.limits.instantiation.maximumWork,
      maximumCreatedRecords: inputs.limits.instantiation.maximumCreatedRecords },
    literalCapture: inputs.limits.evaluation,
  };
  for (const [module, captured] of raw) {
    const result = front.lowerModuleExports(lowering, captured);
    if (result.kind === "refused") return result;
    exported.set(module, result.value);
  }
  const checked = new Map<ModuleId, HirModule>();
  const modules: DeclsModule[] = [];
  for (const [module, captured] of raw) {
    const result = front.lowerModule(lowering, captured);
    if (result.kind === "refused") return result;
    checked.set(module, result.value);
    modules.push({ module: result.value, nodes: indexSyntaxTree(result.value.tree) });
  }
  const sources = checkedSourceViews(modules);
  const views = { ...createModuleBindingViews(modules.map(module => module.module.bindings)), declarationSourceOf: sources.declarationSourceOf };
  const exportNames = new Map<DefId, DefinitionExports>();
  for (const module of modules) for (const entry of module.module.exports) {
    const resolution = projectExportDeclarations(views, entry).target;
    if (resolution.kind !== "available" || resolution.value.kind !== "declarations")
      return fail("The public external-entry projection needs the actual completed exported declaration group.");
    for (const definition of resolution.value.definitions) {
      const previous = exportNames.get(definition);
      const name = { module: module.module.module, name: entry.name };
      exportNames.set(definition, { definition, exports: previous === undefined ? [name] : [...previous.exports, name] });
    }
  }
  const descriptions = new Map<DefId, DefinitionDescription>();
  for (const module of modules) {
    const names = [...exportNames.values()].filter(row => paths.get(row.definition)?.module === module.module.module);
    const described = pipelineWiring.decls.describeDefinitions(module, names);
    for (const row of described.definitions) descriptions.set(row.definition, row);
  }
  const table = viewTypes(types);
  const nominalOf = (definition: DefId): NominalDefinition | null => descriptions.get(definition)?.kind === "InterfaceDeclaration"
    ? { kind: "declared", facets: ["instance"] } : null;
  for (const module of modules) {
    const violations = verifyHir(module.module, {
      types: table, moduleOf: identity => checked.get(identity) ?? null,
      bodyPathOf: identity => { const path = decodeBodyId(identity); return path.kind === "decoded" ? path.value : null; },
      definitionPathOf: identity => paths.get(identity) ?? null,
      bindingScopeOf: identity => descriptions.get(identity)?.generics ?? null,
      bindingScopeAt: reference => {
        const source = sources.nodeOf(reference);
        const owner = reference.kind === "item" ? reference.value.owner : sources.bodies.get(reference.value.body)?.owner;
        return source === null || owner === undefined ? null : descriptions.get(owner)?.generics ?? null;
      },
      nominalOf,
      nodeOf: sources.nodeOf, localExists: sources.localExists,
    });
    if (violations.length !== 0) return fail(`The actual Front checked module failed its owning HIR verification barrier: ${violations[0]?.rule}.`);
  }
  return { kind: "ok", diagnostics: opened.diagnostics,
    value: { modules, types, descriptions, definitionPaths: paths, nominalOf, libraries: admitted.value, bindingOf: views.bindingOf } };
}
