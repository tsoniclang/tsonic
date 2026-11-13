// The one test path from source text to a checked module: a verifier-valid snapshot, the checker opened by Front, and Front's
// production operations (captureModule, lowerModuleDefinitions, lowerModuleExports, lowerModule). Cases of Front, Decls and the
// composed pipeline import it, so there is one copy of the path. The built modules are imported when loadFrontFixture is called,
// so a case that measures coverage starts its measurement first.
import assert from "node:assert/strict";

export const navigationCapture = { maximumCallableExpressionDepth: 64, maximumCallableSelectionDepth: 64, maximumCallableAliasDeclarations: 64,
  maximumCallableReceiverDeclarations: 64, maximumCallableReceiverSteps: 64, maximumCallableMemberReferences: 64, maximumLexicalEnvironmentSteps: 64,
  maximumLexicalEvaluationSteps: 64, maximumSyntaxDepth: 256, maximumCapturedNodesPerModule: 100000, maximumCapturedFactsPerModule: 100000,
  maximumCapturedEdgesPerModule: 100000 };
export const preparation = { roots: [], files: [], diagnostics: [] };
const byId = (left, right) => left.id < right.id ? -1 : 1;

export async function loadFrontFixture() {
  const front = await import("../../../../packages/host/dist/front/index.js");
  const ids = await import("../../../../packages/host/dist/ids/index.js");
  const snapshots = await import("../../../../packages/host/dist/snapshot/index.js");
  const types = await import("../../../../packages/host/dist/ir-types/index.js");
  const hir = await import("../../../../packages/host/dist/ir-hir/index.js");
  const sdk = await import("@tsonic/tsts");
  const packageOf = root => ids.encodePackageId(root);
  const moduleOf = (owner, path) => ids.encodeModuleId({ package: owner, path });
  const bundled = () => sdk.getBundledLibraryClosure(["lib.es2024.d.ts"]).map(library => ({ name: library.name, text: library.text }));

  /** A verifier-valid snapshot: a project package with source modules, a package holding the bundled libraries, and packages of providers. */
  function projectSnapshot({ sourceFiles, libraries, providerPackages = [], declarationProviders = [], compilerExtensions = [], requiredProviderModules = [],
    otherPackages = [], extraFiles = {}, installedDeclarations = "none", semanticModules = [] }) {
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
    return {
      packages: { fingerprint: "captured", rootPackage: project, packages, modules, files, libraryData: [],
        components: packages.map(entry => ({ representative: entry.id, packages: [entry.id], dependencies: [] })) },
      entryPoint: moduleOf(project, `src/${Object.keys(sourceFiles)[0]}`),
      roots: [...Object.keys(sourceFiles).map(name => moduleOf(project, `src/${name}`)), ...otherRoots].sort(),
      selection: { target: { id: "native", surfaces: [], options: { kind: "record", fields: [] } }, providerId: "native-provider", capabilityIds: [], surfaceIds: [] },
      contributions: { declarationModules: [], declarationPolicy: { bundledLibraries: libraries.map(library => moduleOf(checker, library.name)).sort(), installedDeclarations },
        requiredProviderModules, compilerExtensions, declarationProviders, semanticModules, safetyProviders: [], dataLayouts: [] },
      platform: { layouts: [] },
    };
  }

  /** Opens the snapshot through Front (after the snapshot verifier accepts it) and captures the program's module set. */
  function openAndCapture(snapshot, registrations = []) {
    const deps = { extensions: front.createCheckerExtensions(registrations), navigationCapture };
    assert.deepEqual(snapshots.verifySnapshot(snapshot, front.extensionReferencesOf(deps.extensions)), [], "the case's snapshot is one the snapshot verifier accepts");
    const opened = front.openCheckedProgram(deps, snapshot, preparation);
    assert.equal(opened.kind, "ok");
    return { deps, program: opened.value, set: front.captureProgramModules(deps, opened.value) };
  }

  /** One source module `/project/src/main.ts` holding the text, opened with the bundled libraries. */
  function openedModule(sourceText) {
    const snapshot = projectSnapshot({ sourceFiles: { "main.ts": sourceText }, libraries: bundled() });
    const { deps, program } = openAndCapture(snapshot);
    return { deps, program, module: moduleOf(packageOf("/project"), "src/main.ts") };
  }

  /** The dependencies of lowerModuleExports and lowerModule for a program whose declarations are all in one module. */
  function lowerDepsFor(definitions, interner, sourceText) {
    const byNode = new Map(definitions.rows.map(row => [row.node, row.definition]));
    return {
      definitionOf: reference => {
        assert.equal(reference.module, definitions.module, "every declaration of this program is in its one module");
        const definition = byNode.get(reference.node);
        assert.notEqual(definition, undefined, `node ${reference.node} has a definition identity`);
        return definition;
      },
      definitionOfExport: () => assert.fail("no library export is named by this program"),
      sourceTextOf: () => sourceText, libraries: { sources: [] }, types: interner,
      typeExpansion: { maximumDepth: 64, maximumVisits: 10000, maximumUnionMembers: 1000, maximumIntersectionMembers: 1000 },
      literalCapture: { maximumIntermediateBits: 4096, maximumResultBits: 4096, maximumArithmeticWork: 100000 },
    };
  }

  /**
   * The whole path for one module of source text: the raw module, its definition rows, a fresh type interner, the export entries
   * and the checked module. Each operation must succeed; a refusal fails the calling case.
   */
  function checkedModuleOf(sourceText) {
    const { deps, program, module } = openedModule(sourceText);
    const raw = front.captureModule(deps, program, module);
    assert.equal(raw.kind, "ok", "captureModule");
    const definitions = front.lowerModuleDefinitions(raw.value);
    assert.equal(definitions.kind, "ok", "lowerModuleDefinitions");
    const interner = types.createTypeInterner();
    const lowerDeps = lowerDepsFor(definitions.value, interner, sourceText);
    const exported = front.lowerModuleExports(lowerDeps, raw.value);
    assert.equal(exported.kind, "ok", "lowerModuleExports");
    const checked = front.lowerModule(lowerDeps, raw.value);
    assert.equal(checked.kind, "ok", "lowerModule");
    return { module, raw: raw.value, definitions: definitions.value, interner, exports: exported.value, checked: checked.value };
  }

  /**
   * The HIR verifier's violations of a checked module. The checked module holds the interner's own type and signature
   * identities, so the table it is verified against is the interner's rows in that numbering, read back one by one; the
   * publication gives only the row counts (its table is renumbered canonically, and Pipeline has no publication step yet).
   */
  function verifyChecked(checked, interner) {
    const published = types.exportTypes(interner, { maximumWork: 1000000, maximumCreatedRecords: 100000 });
    assert.equal(published.kind, "complete");
    const table = { terms: published.value.types.map((unusedValue, position) => types.readType(interner, position)),
      signatures: published.value.signatures.map((unusedValue, position) => types.readSignature(interner, position)) };
    const byId = new Map(hir.indexSyntaxTree(checked.tree).map(node => [node.id, node]));
    const scope = () => ({ classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] });
    return hir.verifyHir(checked, {
      types: table,
      bodyPathOf: body => { const decoded = ids.decodeBodyId(body); return decoded.kind === "decoded" ? decoded.value : null; },
      definitionPathOf: identity => { const decoded = ids.decodeDefId(identity); return decoded.kind === "decoded" ? decoded.value : null; },
      bindingScopeOf: scope, bindingScopeAt: scope, nominalOf: () => null, nodeOf: reference => byId.get(reference.value.node) ?? null,
      localExists: reference => checked.bodies.some(body => body.body === reference.body && body.locals[reference.local] !== undefined),
    });
  }

  return { front, ids, snapshots, types, hir, sdk, packageOf, moduleOf, bundled, projectSnapshot, openAndCapture, openedModule, lowerDepsFor, checkedModuleOf, verifyChecked };
}
