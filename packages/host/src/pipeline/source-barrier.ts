import type { DeclsModule, DefinitionDescription, DefinitionExport } from "../decls/contract.js";
import type { Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId, DefinitionPath, ModuleId, NodeId } from "../ids/contract.js";
import { decodeBodyId, decodeModuleId } from "../ids/index.js";
import type { LowerDeps, LoweredModule, ModuleDefinitions, ModuleExports, ModuleSourceOccurrence, RawInterfaceGroupEvidence, RawModule, RawNodeRef } from "../front/contract.js";
import type { CheckedPhase, EnumDeclaration, HirBindingViews, HirDeclarationScopes, NativeArrayAnnotation } from "../ir-hir/contract.js";
import { createModuleBindingViews, deriveDeclarationScopes, indexSyntaxTree, resolveModuleExport, verifyHir } from "../ir-hir/index.js";
import type { AdmittedNativeGuarantee, Libraries, ProviderLibraryModel, ProviderLibraryOrigin, ProviderLibraryText } from "../libraries/contract.js";
import { bindProviderLibraries } from "../libraries/index.js";
import type { CheckedInterfaceDescription, InterfaceDescriptionRecipe, NominalDefinition, TypeInterner, TypePublicationWork } from "../ir-types/contract.js";
import { admitTypePublicationStep, createTypeInterner, createTypePublicationWork, refuseTypeConstruction, viewTypes } from "../ir-types/index.js";
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

export interface EnumSource {
  readonly module: SourceModule;
  readonly declaration: EnumDeclaration<CheckedPhase>;
}

export interface SourceBarrier extends HirBindingViews {
  readonly checked: CheckedSourceViews;
  readonly modules: readonly SourceModule[];
  readonly types: TypeInterner;
  readonly typeWork: TypePublicationWork;
  readonly descriptions: ReadonlyMap<DefId, DefinitionDescription>;
  readonly enums: readonly EnumSource[];
  readonly enumInitializers: ReadonlySet<BodyId>;
  readonly layoutOperands: ReadonlySet<BodyId> | null;
  readonly definitionPaths: ReadonlyMap<DefId, DefinitionPath>;
  readonly nominalOf: (definition: DefId) => NominalDefinition | null;
  readonly nativeArrayAnnotationOf: (module: ModuleId, node: NodeId) => NativeArrayAnnotation | null;
  readonly interfaceDescriptionOf: (definition: DefId) => CheckedInterfaceDescription | null;
  readonly libraries: Libraries;
  readonly nativeGuaranteeOf: (declaration: DefId) => AdmittedNativeGuarantee | null;
}

type InterfaceGroup = Extract<NominalDefinition, { readonly kind: "merged-interface" }>;

function sameGroup(left: InterfaceGroup, right: InterfaceGroup): boolean {
  return left.definitions.length === right.definitions.length && left.slots.length === right.slots.length
    && left.definitions.every((definition, index) => right.definitions[index] === definition)
    && left.slots.every((slot, index) => {
      const other = right.slots[index];
      return other !== undefined && other.scope === slot.scope && other.parameters.length === slot.parameters.length
        && slot.parameters.every((parameter, position) => other.parameters[position] === parameter);
    });
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
  const captured = front.captureModules(capture, opened.value, set.modules.map(entry =>
    entry.kind === "snapshot" ? entry.module : entry.document.module));
  if (captured.kind === "refused") return captured;
  for (let position = 0; position < set.modules.length; ++position) {
    const entry = set.modules[position];
    if (entry === undefined) return fail("The actual opened module inventory must be dense.");
    const module = entry.kind === "snapshot" ? entry.module : entry.document.module;
    const moduleCapture = captured.value[position];
    if (moduleCapture?.module !== module) return fail("Raw capture must retain the actual opened module at its position.");
    if (raw.has(module)) return fail("The actual opened module inventory cannot repeat a module identity.");
    raw.set(module, moduleCapture);
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
    for (const row of captured.types.types) {
      if (row.form.kind !== "available") continue;
      const form = row.form.value;
      const path = captured.types.components[row.component]?.path;
      if (form.kind === "conditional" && form.application === null && path?.step.kind === "member") {
        request(path.step.declaration);
        request(form.operator);
      }
      if (row.alias.kind !== "available" || row.alias.value === null) continue;
      if (form.kind !== "indexed-access" && form.kind !== "indexed-alias-dependency") continue;
      request(row.alias.value.declaration);
      if (form.operator !== null) request(form.operator);
    }
    for (const signature of captured.types.signatures) {
      const receiver = signature.receiver.kind === "available" ? signature.receiver.value?.declaration : null;
      if (receiver != null) request(receiver);
    }
    for (const entry of captured.exports) if (entry.typeOnlyStar !== null) request(entry.typeOnlyStar);
    for (const table of captured.types.members) for (const member of table.members) {
      for (const origin of member.origins) if (origin.kind === "source-member") request(origin.occurrence);
    }
  }
  const identified = front.lowerModuleDefinitions({ componentRootsOf: module => componentRoots.get(module) ?? [] }, [...raw.values()]);
  if (identified.kind === "refused") return identified;
  for (const inventory of identified.value) {
    definitions.set(inventory.module, inventory);
    for (const row of inventory.rows) paths.set(row.definition, { module: inventory.module, segments: row.segments });
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
  const checked = new Map<ModuleId, LoweredModule>();
  const modules: SourceModule[] = [];
  for (const [module, captured] of raw) {
    const result = front.lowerModule(lowering, captured);
    if (result.kind === "refused") return result;
    checked.set(module, result.value);
    const document = documents.get(module);
    if (document === undefined) return fail("A checked module retains its actual captured document and role.");
    modules.push({ module: result.value.module, nodes: indexSyntaxTree(result.value.module.tree), role: document.role });
  }
  const nativeArrayAnnotationOf = (module: ModuleId, node: NodeId): NativeArrayAnnotation | null =>
    checked.get(module)?.nativeArrayAnnotationOf(node) ?? null;
  const sources = checkedSourceViews(modules);
  const scopes = new Map<ModuleId, HirDeclarationScopes>();
  for (const { module, nodes } of modules) scopes.set(module.module, deriveDeclarationScopes(module, nodes));
  const scopesOf = (definition: DefId): HirDeclarationScopes | null => {
    const path = paths.get(definition);
    return path === undefined ? null : scopes.get(path.module) ?? null;
  };
  const bindingScopeOf = (definition: DefId) => scopesOf(definition)?.bindingScopeOf(definition) ?? null;
  const groups = new Map<DefId, InterfaceGroup>();
  const interfaceDescriptions = new Map<InterfaceGroup, CheckedInterfaceDescription>();
  const exactGroups = new Map<RawInterfaceGroupEvidence, InterfaceGroup>();
  const retainDescription = (group: InterfaceGroup, recipe: InterfaceDescriptionRecipe | undefined): void => {
    if (recipe === undefined) return;
    const previous = interfaceDescriptions.get(group);
    if (previous !== undefined && previous.recipe !== recipe)
      return fail("One checked declaration group cannot supply different neutral descriptions.");
    if (previous === undefined) interfaceDescriptions.set(group, { group, recipe });
  };
  for (const captured of raw.values()) {
    const groupRows = captured.types.interfaceGroups;
    const completed = checked.get(captured.module)?.interfaceDescriptions ?? fail("A captured module must have its actual lowered descriptions.");
    const localDescriptions = new Map<number, InterfaceDescriptionRecipe>();
    for (const row of completed) {
      const stop = admitTypePublicationStep(typeWork);
      if (stop !== null) return refuseTypeConstruction(typeWork, stop, captured.tree.origin,
        { query: "checkedInterfaceGroups", key: [captured.module, row.ordinal] });
      if (localDescriptions.has(row.ordinal)) return fail("A completed neutral description cannot be repeated in its own source.");
      localDescriptions.set(row.ordinal, row.recipe);
    }
    for (let position = 0; position < groupRows.length; ++position) {
      const admit = (count = 1) => {
        const stopped = admitTypePublicationStep(typeWork, count);
        const module = checked.get(captured.module)?.module;
        return stopped === null ? null : refuseTypeConstruction(typeWork, stopped,
          module?.tree.origin ?? fail("A captured type group must belong to its checked source."),
          { query: "checkedInterfaceGroups", key: [captured.module, position] });
      };
      const stopped = admit();
      if (stopped !== null) return stopped;
      const group = groupRows[position];
      if (group === undefined || group.ordinal !== position) return fail("A captured type group must retain its actual dense position.");
      const evidence = group.evidence;
      const recipe = localDescriptions.get(position);
      const exact = exactGroups.get(evidence);
      if (exact !== undefined) { retainDescription(exact, recipe); continue; }
      const definitionsInGroup: DefId[] = [];
      for (let index = 0; index < evidence.declarations.length; ++index) {
        const step = admit();
        if (step !== null) return step;
        const reference = evidence.declarations[index];
        if (reference === undefined) return fail("A merged interface retains every original fragment.");
        const definition = definitionOf(reference);
        const node = sources.nodeOf({ kind: "item", value: { owner: definition, node: reference.node } });
        if (node?.kind !== "InterfaceDeclaration" || node.tsonic.definition !== definition)
          return fail("A merged interface fragment must name its actual independent checked declaration.");
        definitionsInGroup.push(definition);
      }
      const slots: InterfaceGroup["slots"][number][] = [];
      let local = 0;
      for (let index = 0; index < evidence.slots.length; ++index) {
        const step = admit();
        if (step !== null) return step;
        const slot = evidence.slots[index];
        if (slot === undefined || slot.scope === "outer" && local !== 0)
          return fail("A merged interface retains its outer and local slots in native order.");
        const parameters: DefId[] = [];
        for (let parameter = 0; parameter < slot.parameters.length; ++parameter) {
          const paid = admit();
          if (paid !== null) return paid;
          const reference = slot.parameters[parameter];
          if (reference === undefined) return fail("A merged interface retains every actual parameter declaration.");
          const definition = definitionOf(reference);
          const node = sources.nodeOf({ kind: "item", value: { owner: definition, node: reference.node } });
          if (node?.kind !== "TypeParameter" || node.tsonic.parameter.declaration !== definition)
            return fail("A merged interface parameter must name its actual checked binder.");
          parameters.push(definition);
        }
        for (let fragment = 0; fragment < definitionsInGroup.length; ++fragment) {
          const paid = admit();
          if (paid !== null) return paid;
          const definition = definitionsInGroup[fragment];
          const scope = definition === undefined ? null : bindingScopeOf(definition);
          if (scope === null) return fail("A merged interface fragment must retain its actual parameter scope.");
          if (slot.scope === "local") {
            if (parameters.length !== definitionsInGroup.length || scope.classParameters[local] !== parameters[fragment])
              return fail("A merged interface local slot must pair the actual parameter of every fragment.");
          } else {
            const allowed = scope.capturedParameters;
            const cost = admit(allowed.length * parameters.length);
            if (cost !== null) return cost;
            if (!parameters.some(parameter => allowed.includes(parameter)))
              return fail("A merged interface outer slot must remain in the actual checked lexical scope.");
          }
        }
        if (slot.scope === "local") ++local;
        slots.push({ scope: slot.scope, parameters });
      }
      const result: InterfaceGroup = { kind: "merged-interface", definitions: definitionsInGroup, slots };
      let prior: InterfaceGroup | undefined;
      for (const definition of definitionsInGroup) {
        const step = admit();
        if (step !== null) return step;
        if (bindingScopeOf(definition)?.classParameters.length !== local)
          return fail("A merged interface application must retain all local slots of every actual fragment.");
        const recorded = groups.get(definition);
        if (recorded === undefined) continue;
        if (prior !== undefined && recorded !== prior) return fail("Completed merged interface groups cannot overlap.");
        prior = recorded;
      }
      const remember = admit();
      if (remember !== null) return remember;
      if (prior !== undefined) {
        const step = admit(definitionsInGroup.length + slots.length + slots.reduce((count, slot) => count + slot.parameters.length, 0));
        if (step !== null) return step;
        if (!sameGroup(prior, result)) return fail("Repeated capture must retain one exact checked declaration group.");
      } else for (const definition of definitionsInGroup) groups.set(definition, result);
      const authority = prior ?? result;
      exactGroups.set(evidence, authority);
      retainDescription(authority, recipe);
    }
  }
  const nominalOf = (definition: DefId) => groups.get(definition) ?? scopesOf(definition)?.nominalOf(definition) ?? null;
  const interfaceDescriptionOf = (definition: DefId): CheckedInterfaceDescription | null => {
    const group = groups.get(definition);
    return group === undefined ? null : interfaceDescriptions.get(group) ?? null;
  };
  const table = viewTypes(types);
  for (const { module } of modules) {
    const violations = verifyHir(module, {
      types: table, moduleOf: identity => checked.get(identity)?.module ?? null,
      bodyPathOf: identity => { const path = decodeBodyId(identity); return path.kind === "decoded" ? path.value : null; },
      definitionPathOf: identity => paths.get(identity) ?? null,
      bindingScopeOf,
      bindingScopeAt: reference => {
        const source = sources.nodeOf(reference);
        const owner = reference.kind === "item" ? reference.value.owner : sources.bodies.get(reference.value.body)?.owner;
        return source === null || owner === undefined ? null : bindingScopeOf(owner);
      },
      nominalOf, nativeArrayAnnotationOf,
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
  const enums: EnumSource[] = [];
  const enumInitializers = new Set<BodyId>();
  let layoutOperands: Set<BodyId> | null = null;
  for (const module of modules) {
    const captured = raw.get(module.module.module);
    if (captured !== undefined && captured.types.memoryDescriptors.length !== 0) {
      for (const checked of module.module.bodies) {
        const path = decodeBodyId(checked.body);
        if (path.kind === "decoded" && path.value.role === "layout-operand") (layoutOperands ??= new Set()).add(checked.body);
      }
    }
    const names = Array.from(exportNames.get(module.module.module) ?? [], ([definition, exports]) => ({ definition, exports }));
    const declarationScopes = scopes.get(module.module.module) ?? fail("Every verified module needs its actual checked declaration scopes.");
    const described = pipelineWiring.decls.describeDefinitions(module, declarationScopes, names);
    for (const row of described.definitions) {
      descriptions.set(row.definition, row);
      if (row.kind !== "EnumDeclaration") continue;
      const reference = sources.declarationSourceOf(row.definition);
      const declaration = reference === null ? null : sources.nodeOf(reference);
      if (declaration?.kind !== "EnumDeclaration" || declaration.tsonic.definition !== row.definition)
        return fail("A described enum requires its actual checked declaration.");
      enums.push({ module, declaration });
      for (const member of declaration.members.nodes) {
        const body = member.tsonic.initializer;
        if (body !== null) {
          if (enumInitializers.has(body) || sources.bodies.get(body)?.root !== member.initializer)
            return fail("An enum initializer belongs to its one actual declaration and expression.");
          enumInitializers.add(body);
        }
      }
    }
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
      if (source.kind === "FunctionType" || source.kind === "ConstructorType") continue;
      libraryOrigins.push({ package: document.package, identity: row.identity, definition });
    }
  }
  const admitted = bindProviderLibraries({ models: libraryModels, texts: libraryTexts, origins: libraryOrigins },
    inputs.snapshot.source.input.packages.libraryData);
  if (admitted.kind === "refused") return admitted;
  const nativeGuarantees = admitted.value.guarantees.length === 0 ? null : new Map<DefId, AdmittedNativeGuarantee>();
  if (nativeGuarantees !== null) for (const guarantee of admitted.value.guarantees) {
    if (nativeGuarantees.has(guarantee.declaration)) return fail("An actual canonical provider signature owns one authored guarantee.");
    nativeGuarantees.set(guarantee.declaration, guarantee);
  }
  return { kind: "ok", diagnostics: opened.diagnostics,
    value: { checked: sources, modules, types, typeWork, descriptions, enums, enumInitializers, layoutOperands, definitionPaths: paths, nominalOf, interfaceDescriptionOf, libraries: admitted.value,
      nativeArrayAnnotationOf, nativeGuaranteeOf: declaration => nativeGuarantees?.get(declaration) ?? null, bindingOf: views.bindingOf } };
}
