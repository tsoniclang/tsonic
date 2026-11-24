// The one test path from source text to a checked module: a verifier-valid snapshot, the checker opened by Front, and Front's
// production operations (captureModules, lowerModuleDefinitions, lowerModuleExports, lowerModule). Cases of Front, Decls and the
// composed pipeline import it, so there is one copy of the path. The built modules are imported when loadFrontFixture is called,
// so a case that measures coverage starts its measurement first.
import assert from "node:assert/strict";
import { nativeFactsFixture } from "../native-facts.mjs";

export const navigationCapture = { maximumCallableExpressionDepth: 64, maximumCallableSelectionDepth: 64, maximumCallableAliasDeclarations: 64,
  maximumCallableReceiverDeclarations: 64, maximumCallableReceiverSteps: 64, maximumCallableMemberReferences: 64, maximumLexicalEnvironmentSteps: 64,
  maximumLexicalEvaluationSteps: 64, maximumSyntaxDepth: 256, maximumCapturedNodesPerModule: 100000, maximumCapturedFactsPerModule: 100000,
  maximumCapturedEdgesPerModule: 100000 };
const literalCapture = { maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 100000 };
const byId = (left, right) => left.id < right.id ? -1 : 1;

export function captureSingleModule(front, deps, program, module) {
  const result = front.captureModules(deps, program, [module]);
  if (result.kind !== "ok") return result;
  assert.equal(result.value.length, 1);
  assert.equal(result.value[0].module, module);
  return { ...result, value: result.value[0] };
}

export function identifySingleModule(front, { module, componentRoots }) {
  const result = front.lowerModuleDefinitions({ componentRootsOf: requested => {
    assert.equal(requested, module.module);
    return componentRoots;
  } }, [module]);
  if (result.kind !== "ok") return result;
  assert.equal(result.value.length, 1);
  assert.equal(result.value[0].module, module.module);
  return { ...result, value: result.value[0] };
}

export function lowerSingleCheckedModule(front, deps, raw) {
  const result = front.lowerModule(deps, raw);
  if (result.kind !== "ok") return result;
  assert.equal(result.value.module.module, raw.module);
  return { ...result, value: result.value.module };
}

export function rawComponentPath(components, component) {
  const path = [];
  let current = component;
  while (current.path !== null) {
    const { step, prefix } = current.path;
    path.push(step);
    if (prefix === null) break;
    const parent = components[prefix];
    assert.ok(parent?.id === prefix && prefix < current.id);
    assert.deepEqual(parent.root, component.root);
    current = parent;
  }
  return path.reverse();
}

export function propertyRows(shape, type) {
  const selected = shape.getStructuredInventory(type, () => null);
  assert.equal(selected.kind, "complete", "An actual native property inventory retains its checker.");
  const inventory = selected.value.properties;
  const rows = [];
  while (true) {
    const row = inventory.next();
    assert.equal(row.kind, "complete");
    if (row.value === null) return rows;
    rows.push(row.value);
  }
}

export function primeCaptureReader(run, maximum, stop) {
  assert.throws(() => run(maximum), error => error === stop,
    "the genuine source reader is reached after completing its native prerequisites");
}

export function observeSourceType(checker, observe) {
  return (request, admit) => {
    const result = checker.acquireSourceType(request, admit);
    if (result.kind !== "complete") return result;
    const replacement = observe(request, result.value);
    return replacement === undefined ? result : { kind: "complete", value: replacement };
  };
}

export async function loadFrontFixture() {
  const front = await import("../../../../packages/host/dist/front/index.js");
  const ids = await import("../../../../packages/host/dist/ids/index.js");
  const snapshots = await import("../../../../packages/host/dist/snapshot/index.js");
  const types = await import("../../../../packages/host/dist/ir-types/index.js");
  const hir = await import("../../../../packages/host/dist/ir-hir/index.js");
  const { checkedSourceViews } = await import("../../../../packages/host/dist/pipeline/checked-inputs.js");
  const sdk = await import("@tsonic/tsts");
  const packageOf = root => ids.encodePackageId(root);
  const moduleOf = (owner, path) => ids.encodeModuleId({ package: owner, path });
  const bundled = () => sdk.getBundledLibraryClosure(["lib.es2024.d.ts"]).map(library => ({ name: library.name, text: library.text }));

  /** A verifier-valid snapshot: a project package with source modules, a package holding the bundled libraries, and packages of providers. */
  function projectSnapshot({ sourceFiles, libraries, providerPackages = [], declarationProviders = [], compilerExtensions = [], requiredProviderModules = [],
    otherPackages = [], extraFiles = {}, installedDeclarations = "none", semanticModules = [], externalEntries = [] }) {
    const project = packageOf("/project");
    const checker = packageOf("/checker");
    const packages = [
      { id: project, name: null, version: null, packageRoot: "/project", sourceRoot: "/project/src", manifestPath: null, dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
      { id: checker, name: "checker-libraries", version: "1.0.0", packageRoot: "/checker", sourceRoot: "/checker", manifestPath: "/checker/package.json", dependencies: [], exports: [], pluginEntry: null, libraryEntry: null },
      ...providerPackages.map(entry => ({ id: packageOf(entry.root), name: entry.name, version: "1.0.0", packageRoot: entry.root, sourceRoot: entry.root,
        manifestPath: `${entry.root}/package.json`, dependencies: [], exports: [], pluginEntry: `${entry.root}/plugin.js`, libraryEntry: null })),
      ...otherPackages.map(entry => ({ id: packageOf(entry.root), name: entry.name, version: "1.0.0", packageRoot: entry.root, sourceRoot: entry.root,
        manifestPath: `${entry.root}/package.json`, dependencies: [], exports: [], pluginEntry: null, libraryEntry: null })),
    ].sort(byId);
    const modules = [];
    const files = [];
    for (const [name, text] of Object.entries(sourceFiles)) {
      modules.push({ id: moduleOf(project, `src/${name}`), package: project, path: `/project/src/${name}`, role: "source" });
      files.push({ kind: "physical", path: `/project/src/${name}`, realPath: `/project/src/${name}`, text });
    }
    for (const library of libraries) {
      modules.push({ id: moduleOf(checker, library.name), package: checker, path: `/checker/${library.name}`, role: "declaration" });
      files.push({ kind: "virtual", path: `/checker/${library.name}`, text: library.text, owner: checker });
    }
    const otherRoots = [];
    for (const entry of otherPackages) {
      for (const [name, [role, text, rooted]] of Object.entries(entry.modules)) {
        modules.push({ id: moduleOf(packageOf(entry.root), name), package: packageOf(entry.root), path: `${entry.root}/${name}`, role });
        files.push({ kind: "physical", path: `${entry.root}/${name}`, realPath: `${entry.root}/${name}`, text });
        if (rooted === true) otherRoots.push(moduleOf(packageOf(entry.root), name));
      }
    }
    for (const [path, text] of Object.entries(extraFiles)) files.push({ kind: "physical", path, realPath: path, text });
    modules.sort(byId);
    files.sort((left, right) => left.path < right.path ? -1 : 1);
    const input = {
      packages: { fingerprint: "captured", rootPackage: project, packages, modules, files, libraryData: [],
        components: packages.map(entry => ({ representative: entry.id, packages: [entry.id], dependencies: [] })) },
      roots: [...Object.keys(sourceFiles).map(name => moduleOf(project, `src/${name}`)), ...otherRoots].sort(),
      currentDirectory: "/project", caseSensitive: true,
      declarationModules: [], declarationPolicy: { bundledLibraries: libraries.map(library => ({ name: library.name, module: moduleOf(checker, library.name) }))
        .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0), installedDeclarations },
    };
    return {
      source: preparedSource(input),
      entryPoint: moduleOf(project, `src/${Object.keys(sourceFiles)[0]}`),
      selection: { target: { id: "native", surfaces: [], options: { kind: "record", fields: [] } }, providerId: "native-provider", capabilityIds: [], surfaceIds: [] },
      contributions: { requiredProviderModules, compilerExtensions, declarationProviders, semanticModules, safetyProviders: [], dataLayouts: [], externalEntries },
      nativeFacts: nativeFactsFixture(),
    };
  }

  function preparedSource(input) {
    const prepared = front.prepareSourceImports({ navigationCapture }, input);
    assert.equal(prepared.kind, "ok", JSON.stringify(prepared.diagnostics));
    return prepared.value;
  }

  /** Opens the snapshot through Front (after the snapshot verifier accepts it) and captures the program's module set. */
  function openAndCapture(snapshot, registrations = []) {
    const deps = { extensions: front.createCheckerExtensions(registrations), navigationCapture, literalCapture };
    assert.deepEqual(snapshots.verifySnapshot(snapshot, front.extensionReferencesOf(deps.extensions)), [], "the case's snapshot is one the snapshot verifier accepts");
    const opened = front.openCheckedProgram(deps, snapshot);
    assert.equal(opened.kind, "ok");
    return { deps, program: opened.value, set: front.captureProgramModules(deps, opened.value) };
  }

  /** One source module `/project/src/main.ts` holding the text, opened with the bundled libraries. */
  function openedModule(sourceText) {
    const snapshot = projectSnapshot({ sourceFiles: { "main.ts": sourceText }, libraries: bundled() });
    const { deps, program } = openAndCapture(snapshot);
    return { deps, program, snapshot, module: moduleOf(packageOf("/project"), "src/main.ts") };
  }

  /** The dependencies of lowerModuleExports and lowerModule for a program whose declarations are all in one module. */
  function lowerDepsFor(definitions, interner, sourceText, typeLimits = {}) {
    const byNode = new Map(definitions.rows.map(row => [row.node, row.definition]));
    const occurrences = new Map(definitions.sourceOccurrences.map(row => [row.node, row]));
    return {
      exportsOf: () => null,
      definitionOf: reference => {
        assert.equal(reference.module, definitions.module, "every declaration of this program is in its one module");
        const definition = byNode.get(reference.node);
        assert.notEqual(definition, undefined, `node ${reference.node} has a definition identity`);
        return definition;
      },
      sourceOccurrenceOf: reference => {
        assert.equal(reference.module, definitions.module, "every binding of this fixture is in its actual module");
        return occurrences.get(reference.node) ?? null;
      },
      sourceTextOf: () => sourceText, types: interner,
      typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 },
      typeWork: types.createTypePublicationWork({ maximumWork: 100000, maximumCreatedRecords: 100000, ...typeLimits }),
      literalCapture,
    };
  }

  function* occurrenceRoots(raw) {
    for (const component of raw.types.components) yield component.root;
    for (const row of raw.types.types) {
      if (row.form.kind !== "available") continue;
      const form = row.form.value;
      const step = raw.types.components[row.component]?.path?.step;
      if (form.kind === "conditional" && form.application === null && step?.kind === "member") {
        yield step.declaration;
        yield form.operator;
      }
      if (row.alias.kind === "available" && row.alias.value !== null
        && (form.kind === "indexed-access" || form.kind === "indexed-alias-dependency")) {
        yield row.alias.value.declaration;
        if (form.operator !== null) yield form.operator;
      }
    }
    for (const signature of raw.types.signatures) {
      const receiver = signature.receiver.kind === "available" ? signature.receiver.value?.declaration : null;
      if (receiver != null) yield receiver;
    }
    for (const entry of raw.exports) if (entry.typeOnlyStar !== null) yield entry.typeOnlyStar;
    for (const table of raw.types.members) for (const member of table.members) {
      for (const origin of member.origins) if (origin.kind === "source-member") yield origin.occurrence;
    }
  }

  /**
   * The whole path for one module of source text: the raw module, its definition rows, a fresh type interner, the export entries
   * and the checked module. Each operation must succeed; a refusal fails the calling case.
   */
  function checkedModuleOf(sourceText) {
    const { deps, program, snapshot, module } = openedModule(sourceText);
    const raw = captureSingleModule(front, deps, program, module);
    assert.equal(raw.kind, "ok", "captureModules");
    const definitions = identifySingleModule(front, { module: raw.value, componentRoots: [...occurrenceRoots(raw.value)].filter(root => root.module === raw.value.module) });
    assert.equal(definitions.kind, "ok", "lowerModuleDefinitions");
    const interner = types.createTypeInterner();
    const lowerDeps = lowerDepsFor(definitions.value, interner, sourceText);
    const exported = front.lowerModuleExports(lowerDeps, raw.value);
    assert.equal(exported.kind, "ok", "lowerModuleExports");
    const checked = lowerSingleCheckedModule(front, { ...lowerDeps, exportsOf: actual => actual === module ? exported.value : null }, raw.value);
    assert.equal(checked.kind, "ok", "lowerModule");
    return { module, snapshot, raw: raw.value, definitions: definitions.value, interner, typeWork: lowerDeps.typeWork,
      exports: exported.value, checked: checked.value };
  }

  function captureModulesOf(snapshot, modules = snapshot.source.input.packages.modules) {
    const opened = openAndCapture(snapshot);
    const interner = types.createTypeInterner();
    const fileTexts = new Map(snapshot.source.input.packages.files.map(file => [file.path, file.text]));
    const raw = front.captureModules(opened.deps, opened.program, modules.map(row => row.id));
    assert.equal(raw.kind, "ok");
    const captures = modules.map(({ id: module, path }, position) => {
      const text = fileTexts.get(path);
      assert.equal(typeof text, "string", "the captured module has its original snapshot text");
      assert.equal(raw.value[position]?.module, module);
      return { module, text, raw: raw.value[position] };
    });
    const requests = new Map();
    for (const entry of captures) for (const occurrence of occurrenceRoots(entry.raw)) {
      const roots = requests.get(occurrence.module) ?? [];
      roots.push(occurrence);
      requests.set(occurrence.module, roots);
    }
    const identified = front.lowerModuleDefinitions({ componentRootsOf: module => requests.get(module) ?? [] }, raw.value);
    assert.equal(identified.kind, "ok");
    const captured = captures.map((entry, position) => {
      assert.equal(identified.value[position]?.module, entry.module);
      return { ...entry, definitions: identified.value[position] };
    });
    const definitions = new Map(captured.map(entry => [entry.module, new Map(entry.definitions.rows.map(row => [row.node, row.definition]))]));
    const occurrences = new Map(captured.map(entry => [entry.module, new Map(entry.definitions.sourceOccurrences.map(row => [row.node, row]))]));
    const text = new Map(captured.map(entry => [entry.module, entry.text]));
    const first = captured[0];
    assert.equal(first !== undefined, true, "an actual captured module inventory is nonempty");
    const exported = new Map();
    const deps = { ...lowerDepsFor(first.definitions, interner, first.text),
      definitionOf: reference => definitions.get(reference.module)?.get(reference.node) ?? assert.fail("an actual cross-module F1 declaration is required"),
      sourceOccurrenceOf: reference => occurrences.get(reference.module)?.get(reference.node) ?? null,
      sourceTextOf: module => text.get(module) ?? assert.fail("actual captured source text is required"),
      exportsOf: module => exported.get(module) ?? null };
    for (const entry of captured) {
      const result = front.lowerModuleExports(deps, entry.raw);
      assert.equal(result.kind, "ok");
      exported.set(entry.module, result.value);
    }
    return { interner, captured, deps, opened };
  }

  function checkedModulesOf(sourceFiles) {
    const snapshot = projectSnapshot({ sourceFiles, libraries: bundled() });
    const available = new Map(snapshot.source.input.packages.modules.map(module => [module.id, module]));
    const requested = Object.keys(sourceFiles).map(name => available.get(moduleOf(packageOf("/project"), "src/" + name)));
    const { interner, captured, deps } = captureModulesOf(snapshot, requested);
    const modules = captured.map(entry => {
      const result = lowerSingleCheckedModule(front, deps, entry.raw);
      assert.equal(result.kind, "ok");
      return result.value;
    });
    return { modules, interner, snapshot, captured, deps };
  }

  /**
   * The HIR verifier's violations of a checked module. The checked module holds the interner's own type and signature
   * identities, so the table it is verified against is the interner's rows in that numbering, read back one by one; the
   * publication gives only the row counts (its table is renumbered canonically, and Pipeline has no publication step yet).
   */
  function verifyChecked(checked, interner, otherModules = [], bindingScopeOf = () =>
    ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] })) {
    const published = types.exportTypes(interner, { maximumWork: 1000000, maximumCreatedRecords: 100000 });
    assert.equal(published.kind, "complete");
    const table = { terms: published.value.types.map((unusedValue, position) => types.readType(interner, position)),
      signatures: published.value.signatures.map((unusedValue, position) => types.readSignature(interner, position)) };
    const modules = new Map([checked, ...otherModules].map(module => [module.module, module]));
    const domain = checkedSourceViews([...modules.values()].map(module => ({ module, nodes: hir.indexSyntaxTree(module.tree) })));
    return hir.verifyHir(checked, {
      moduleOf: actual => modules.get(actual) ?? null,
      types: table,
      bodyPathOf: body => { const decoded = ids.decodeBodyId(body); return decoded.kind === "decoded" ? decoded.value : null; },
      definitionPathOf: identity => { const decoded = ids.decodeDefId(identity); return decoded.kind === "decoded" ? decoded.value : null; },
      bindingScopeOf, bindingScopeAt: reference => {
        const owner = reference.kind === "item" ? reference.value.owner : domain.bodies.get(reference.value.body)?.owner;
        return owner === undefined ? null : bindingScopeOf(owner);
      }, nominalOf: () => null, nodeOf: domain.nodeOf,
      localExists: domain.localExists,
    });
  }

  async function captureSyntaxOf(sourceText, module) {
    const { captureNode } = await import("../../../../packages/host/dist/front/syntax-capture.js");
    const { capturePragmas } = await import("../../../../packages/host/dist/front/syntax-support.js");
    const session = sdk.createCompilerSessionFromFiles({ currentDirectory: "/project", files: new Map([["/project/src/main.ts", sourceText]]),
      rootFiles: ["/project/src/main.ts"], compilerOptions: { noLib: true, noEmit: true }, useCaseSensitiveFileNames: true });
    const checked = session.checkSource();
    const file = checked.getSourceFile("/project/src/main.ts");
    const nodes = [];
    const numbers = new Map();
    const parents = new Map();
    const pending = [{ node: file, parent: null }];
    for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
      const id = ids.nodeId(nodes.length);
      nodes.push(current.node);
      numbers.set(current.node, id);
      parents.set(current.node, current.parent);
      const children = [];
      checked.ast.forEachChild(current.node, child => { if (child !== undefined) children.push(child); });
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push({ node: children[index], parent: id });
    }
    const ranges = { ast: checked.ast, file, displacement: 0 };
    const pragmas = capturePragmas(ranges, () => true);
    assert.ok(pragmas);
    return captureNode({ ...ranges, ...pragmas, module, sourceText, numericLiterals: new Map(),
      numbering: { nodes, ids: numbers, parents } }, file, null).tree;
  }

  return { front, ids, snapshots, types, hir, sdk, packageOf, moduleOf, bundled, projectSnapshot, preparedSource, openAndCapture,
    openedModule, lowerDepsFor, checkedModuleOf, captureModulesOf, checkedModulesOf, verifyChecked, captureSyntaxOf };
}
