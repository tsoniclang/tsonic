import { admitFixtureTable, fixtureTypeAdmission } from "./fixtures/types-construction.mjs";
import { createAccount, remainingWork, chargeWork, accountFailure, refuseAccount } from "../../packages/host/dist/dataflow/index.js";
import { conditionRefusal } from "./fixtures/facts-verification.mjs";
import assert from "node:assert/strict";
import { capturedCauses } from "./fixtures/captured-causes.mjs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, relative, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { serialize } from "node:v8";
import { runCase } from "../host-cases/case.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { encodeBodyId, encodeDefId, encodeKey, encodeModuleId, expansionId, localId, nodeId, sigId, tyId } from "../../packages/host/dist/ids/index.js";
import { hostDiagnosticCode } from "../../packages/host/dist/diag/index.js";
import { summaryKey } from "../../packages/host/dist/ir-facts/index.js";
import { artifactBindingsData, executionKey } from "../../packages/host/dist/ir-types/index.js";
import { cellTransportCases } from "./fixtures/program-cells.mjs";
import { checkInterruptedModuleInitialization, checkRepeatedStaticInitialization, checkSelectedStaticExposure } from "./fixtures/program-static-exposure.mjs";
import { checkCallShapedComputedDeclarationName, checkComputedDeclarationNames, checkNestedComputedDeclarationNames, checkParenthesizedComputedDeclarationNames } from "./fixtures/computed-declaration-name.mjs";
import { typeParameterDeclaration } from "./fixtures/type-parameter-declarations.mjs";
import { captureCheckedMarkers } from "./fixtures/front/checked-markers.mjs";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";
import { analysisInput } from "./fixtures/front/analysis-input.mjs";
import { memberScenario } from "./fixtures/tir-member-scenario.mjs";
import { programForEvidence } from "./fixtures/program-executions.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeNames = [
  "index", "canonical", "canonical-types", "canonical-tir",
  "canonical-facts", "canonical-syntax", "chapter-projection", "print", "parse", "verify-index", "verify-module", "instantiate",
  "canonical-phase", "syntax-arena",
  "text-module-bindings", "verify-module-bindings", "text-values", "text-types", "text-inference", "text-phase", "print-syntax-statements",
  "print-syntax-expressions", "print-syntax-types", "print-syntax-auxiliary",
  "text-core", "text-causes", "text-tir", "text-phase-declarations", "print-syntax",
  "parse-values", "parse-types", "parse-diagnostics",
  "program-values", "verify-structure", "parse-core", "parse-inference",
  "parse-tir", "parse-phase-declarations", "parse-phase",
  "parse-syntax-values", "parse-syntax-statements", "parse-syntax-expressions", "parse-syntax-types",
  "parse-syntax-auxiliary", "parse-syntax-jsdoc", "parse-syntax-references", "parse-syntax", "instantiate-phase",
  "verification-work", "work", "verify-metadata-operands",
  "instantiate-tir", "instantiate-facts", "instantiate-syntax", "initialization-text", "verify-initialization",
];
const typeOnlyNames = ["contract", "data", "work-data"];
const sourceFiles = [...typeOnlyNames, ...runtimeNames].map(name => `packages/host/src/ir-program/${name}.ts`);
const runtimeFiles = runtimeNames.map(name => resolve(repository, `packages/host/dist/ir-program/${name}.js`));
const casePaths = ["function", "verifier"].flatMap(level => {
  const directory = `test/host-cases/ir-program/${level}`;
  return readdirSync(resolve(repository, directory)).filter(name => name.endsWith(".case.json")).sort()
    .map(name => `${directory}/${name}`);
});
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "the owner requires aggregate admission before loading product fixtures");
session.connect();
await post("Debugger.enable");
await post("Profiler.enable");
await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
const { createInstantiationMeter, ProgramWork } = await import("../../packages/host/dist/ir-program/work.js");
const { programTypeWork } = await import("../../packages/host/dist/ir-program/verification-work.js");
const { publicationFixture } = await import("./fixtures/program-publication.mjs");
const { declaredInvocationFixture } = await import("./fixtures/program-invocations.mjs");
const { projectFixtureProgram } = await import("./fixtures/program-executions.mjs");
const { encodeContextKey, authoredMethodGraph, callerComponentCycle, callerSyntaxCycle, dualInstanceFixture, joinModuleFixtures, moduleBoundaryFixture, moduleFixture, pairedModuleFixture, verificationContext } = await import("./ir-program-fixtures.mjs");
const { genericMetadataSelectionFixture, metadataBindingFixture, metadataFieldFixture, metadataOperationFixture, publishedArtifactFixture,
  repeatedMetadataFixture } = await import("./fixtures/program-metadata.mjs");
const { expectedSyntaxKinds, genericCarrierCase, mirTransportCases, nullableSyntaxCases, relationalTransportArtifacts, syntaxPhysicalNodes, syntaxTransportFamilies, syntaxTransportModule, transportTypeTable } = await import("./ir-program-transport-fixtures.mjs");
let product;
function moduleViolations(index, module, context) {
  const outcome = product.verifyModuleBodies(index, module, context);
  assert.equal(outcome.kind, "complete", outcome.kind === "complete" ? undefined
    : `module body verification stopped: ${outcome.dimension} (${outcome.maximum})`);
  return outcome.violations;
}
let typeProduct;

function paidSeedOf(table, limits) {
  const meter = createInstantiationMeter(limits);
  assert.equal(typeProduct.admitTypeTable(table, programTypeWork(meter)).kind, "complete");
  return { maximumWork: limits.maximumWork - remainingWork(meter.account), maximumCreatedRecords: meter.created };
}

function pairedPublications() {
  return joinModuleFixtures(publicationFixture(), publicationFixture(moduleFixture("src/other.ts", "/z-dependency")));
}

function completeProgramValue(actual, expected, label) {
  const equal = isDeepStrictEqual(actual, expected);
  if (!equal) {
    const root = resolve(repository, ".temp/ir-program-comparisons");
    mkdirSync(root, { recursive: true });
    const directory = mkdtempSync(resolve(root, "comparison-"));
    const actualPath = resolve(directory, "actual.v8");
    const expectedPath = resolve(directory, "expected.v8");
    writeFileSync(actualPath, serialize(actual));
    writeFileSync(expectedPath, serialize(expected));
    label = `${label}; complete actual: ${actualPath}; complete expected: ${expectedPath}`;
  }
  assert.equal(equal, true, label);
}

function decodeFixtureJson(text) {
  return JSON.parse(text, (_key, value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1) return value;
    if (Object.hasOwn(value, "$bigint")) {
      assert.equal(typeof value.$bigint, "string", "authored bigint digits");
      const integer = BigInt(value.$bigint);
      assert.equal(String(integer), value.$bigint, "canonical authored bigint digits");
      return integer;
    }
    if (Object.hasOwn(value, "$number")) {
      switch (value.$number) {
        case "-0": return -0;
        case "NaN": return NaN;
        case "+Infinity": return Infinity;
        case "-Infinity": return -Infinity;
        default: throw new Error("Unlisted authored host number");
      }
    }
    return value;
  });
}

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "own whole unit requires aggregate admission");
  product = await import("../../packages/host/dist/ir-program/index.js");
  typeProduct = await import("../../packages/host/dist/ir-types/index.js");
});

test("Program canonical logical-cell transport and pre-copy budget", cellTransportCases);
test("Program verifies and round-trips a real externally selected static cell", checkSelectedStaticExposure);
test("Program verifies the module prefix that can execute before an authored throw", checkInterruptedModuleInitialization);
test("module initialization proof and Program only retain each initialized static once", checkRepeatedStaticInitialization);
test("Program keeps declaration-only computed names as nonexecuting syntax through instantiation", checkComputedDeclarationNames);
test("Program instantiates computed names in aliases and nested annotations without execution", checkNestedComputedDeclarationNames);
test("Program preserves parenthesized declaration keys and executing parentheses separately", checkParenthesizedComputedDeclarationNames);
test("Program keeps call-shaped declaration keys separate from the runtime call inventory", checkCallShapedComputedDeclarationName);

function evaluate(input) {
  switch (input.operation) {
    case "six-codec": {
      const text = product.printModuleBodies(input.index, input.module);
      return { parsed: product.parseModuleBodies(input.index, text),
        canonical: projectFixtureProgram({ index: input.index, modules: [input.module] }, input.publication) };
    }
    case "index-roundtrip": {
      const printed = product.printProgramIndex(input.index);
      const parsed = product.parseProgramIndex(printed);
      return { printed, parsed };
    }
    case "phase-codec":
    case "phase-inline-sharing": {
      if (input.operation === "phase-inline-sharing") {
        input.module.bodies[0].tir.root = input.module.tree.root;
        const alternatives = input.module.bodies[0].tir.evidence[0].category.alternatives;
        alternatives[1] = alternatives[0];
      }
      const printed = product.printModuleBodies(input.index, input.module);
      return { printed, parsed: product.parseModuleBodies(input.index, printed),
        canonical: projectFixtureProgram({ index: input.index, modules: [input.module] }, input.publication) };
    }
    case "canonicalize": return projectFixtureProgram(input.program, input.publication);
    case "canonicalize-pair-issue-order": {
      const { first, second } = pairedModuleFixture("/program", { kind: "instantiated", bindings: {
        classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
      } });
      const modules = [first.module, second.module];
      first.index.packages[0].exports = [{ specifier: "./main", module: first.module.module }];
      first.index.packages[1].exports = [{ specifier: "./other", module: second.module.module }];
      first.index.modules[0].exports = [{ name: "main", typeOnlyStar: null, target: { kind: "declarations", definitions: [first.definition] } }];
      first.index.modules[1].exports = [{ name: "other", typeOnlyStar: null, target: { kind: "declarations", definitions: [second.definition] } }];
      const voidType = input.reverse ? 1 : 0;
      const firstSignature = input.reverse ? 1 : 0;
      const secondSignature = input.reverse ? 0 : 1;
      const signatures = first.index.types.signatures.map(signature => ({ ...signature, result: voidType }));
      first.index.types.terms = input.reverse ? [{ kind: "string" }, { kind: "intrinsic", intrinsic: "void" }]
        : [{ kind: "intrinsic", intrinsic: "void" }, { kind: "string" }];
      first.index.types.signatures = input.reverse ? [{ ...signatures[1], id: 0 }, { ...signatures[0], id: 1 }] : signatures;
      for (const [position, module] of modules.entries()) {
        module.bodies[0].tir.signature = position === 0 ? firstSignature : secondSignature;
        module.bodies[0].tir.completion = voidType;
        module.bodies[0].mir.result = voidType;
      }
      const key = { definition: first.definition, bindings: { kind: "instantiated", bindings: {
        classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
      } } };
      first.index.metadata = [{ key, kind: "data-layout", occurrence: { kind: "item", value: { owner: first.definition, node: 0 } },
        fingerprint: "native64-le", byteOrder: "little", addressWidth: 64 }];
      first.index.summaries = [{ key: { kind: "body", execution: { instance: first.instance, provided: 0 } }, signature: firstSignature, arena: { cells: [], projections: [], producers: [], contexts: [],
        boundProducers: [], origins: [{ id: 0, producers: [], includesAbsence: false, kind: "complete" }], boundaries: [] },
      parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
      suspends: false, bindingDependent: false, concurrentWrites: [], contentsOnReturn: [], contentsOnUnwind: [], returns: true, unwinds: false, initialization: { cells: [], events: [], conditions: [{ alternatives: [] }, { alternatives: [[]] }], points: [{ kind: "return" }], rows: [{ point: 0, cell: null, condition: 0 }] }, resultCells: [], backing: [] }];
      first.index.constants = [{ reference: { initializer: first.instance, context: "compile-time" }, value: { kind: "absence", type: voidType } }];
      const publication = { table: { terms: [{ kind: "string" }, { kind: "intrinsic", intrinsic: "void" }],
        signatures: signatures.map(signature => ({ ...signature, result: 1 })) },
      types: input.reverse ? [0, 1] : [1, 0], signatures: input.reverse ? [1, 0] : [0, 1] };
      const program = projectFixtureProgram({ index: first.index, modules }, publication);
      const parsedModules = program.modules.map(module => product.parseModuleBodies(program.index, product.printModuleBodies(program.index, module)));
      return { program, printedIndex: product.printProgramIndex(program.index),
        printedModules: program.modules.map(module => product.printModuleBodies(program.index, module)),
        sharedRoots: program.modules.map(module => Object.is(module.tree.root, module.bodies[0].tir.root)),
        parsedIndex: product.parseProgramIndex(product.printProgramIndex(program.index)),
        parsedModules, parsedModuleRoots: parsedModules.map(parsed => parsed.kind === "parsed"
          && Object.is(parsed.value.tree.root, parsed.value.bodies[0].tir.root)) };
    }
    case "canonicalize-method-fixture":
      authoredMethodGraph(input.program.modules[0]);
      return projectFixtureProgram(input.program, input.publication);
    case "method-program-roundtrip": {
      const { program } = decodeFixtureJson(readFileSync(resolve(repository,
        "test/host-cases/ir-program/function/binding-value-publication-identity.input.json"), "utf8"));
      const module = program.modules[0];
      authoredMethodGraph(module);
      const index = product.parseProgramIndex(product.printProgramIndex(program.index));
      const parsed = product.parseModuleBodies(program.index, product.printModuleBodies(program.index, module));
      if (parsed.kind !== "parsed") return { index, parsed };
      const method = parsed.value.tree.root.statements.nodes[0].node.members.nodes[0];
      const nested = method.body.statements.nodes[0];
      const shares = parsed.value.bodies.map(body => body.instance.body === method.tsonic.template.body
        ? Object.is(body.tir.root, method.body) : body.instance.body === nested.tsonic.template.body
          && Object.is(body.tir.root, nested.body));
      return { index, parsed, shares };
    }
    case "parse-index": return product.parseProgramIndex(input.text);
    case "deep-syntax-roundtrip": {
      const fixture = moduleBoundaryFixture("control", publicationFixture());
      const tree = fixture.module.tree.root;
      const nodes = [];
      let statement = { id: input.depth + 1, origin: tree.origin, parent: input.depth, flags: [], loc: tree.loc,
        kind: "EmptyStatement", tsonic: null };
      nodes.push(statement);
      for (let position = input.depth; position > 0; position -= 1) {
        statement = { id: position, origin: tree.origin, parent: position - 1, flags: [], loc: tree.loc,
          kind: "Block", statements: { loc: tree.loc, nodes: [statement] }, multiLine: false, tsonic: null };
        nodes.push(statement);
      }
      tree.statements.nodes = [{ kind: "ready-statement", node: statement }];
      tree.endOfFileToken.id = input.depth + 2;
      const checked = fixture.tirInput.source.tree;
      checked.statements = { loc: tree.statements.loc, nodes: [statement] };
      const scopes = [{ node: 0, parent: null, attributes: [] }];
      for (let position = 1; position <= input.depth; position += 1) scopes.push({ node: position, parent: position - 1, attributes: [] });
      fixture.module.bodies[0].tir.scopes = scopes;
      fixture.tirInput.source.bodies[0].scopes = scopes;
      for (const node of [...nodes, tree.endOfFileToken]) {
        for (const reference of [{ kind: "body", value: { body: fixture.bodyId, node: node.id } },
          { kind: "item", value: { owner: fixture.definition, node: node.id } }]) {
          fixture.answers.set(encodeContextKey(["nodeExists", reference]), true);
          fixture.answers.set(encodeContextKey(["nodeOf", reference]), node);
        }
      }
      const parsed = product.parseModuleBodies(fixture.index, product.printModuleBodies(fixture.index, fixture.module));
      if (parsed.kind !== "parsed") return { parsed };
      const shape = module => ({ ...module, tree: null, bodies: module.bodies.map(body => ({ ...body, tir: { ...body.tir, root: null } })) });
      const flat = node => node.kind === "Block" || node.kind === "SourceFile"
        ? { ...node, statements: { ...node.statements, nodes: [] } } : node;
      let original = tree;
      let actual = parsed.value.tree.root;
      let complete = isDeepStrictEqual(shape(parsed.value), shape(fixture.module));
      let count = 0;
      for (;;) {
        complete = isDeepStrictEqual(flat(actual), flat(original)) && complete;
        count += 1;
        if (original.kind === "EmptyStatement") break;
        complete = actual.statements.nodes.length === 1 && complete;
        actual = actual.kind === "SourceFile" ? actual.statements.nodes[0].node : actual.statements.nodes[0];
        original = original.kind === "SourceFile" ? original.statements.nodes[0].node : original.statements.nodes[0];
      }
      fixture.context.resources = product.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, createAccount({ maximumWork: 10000 + (input.depth + 3) * (64 + 8 * fixture.bodyId.length), maximumResultEntries: 1000000000 }));
      return { complete, chainNodes: count, sharedRoot: Object.is(parsed.value.tree.root, parsed.value.bodies[0].tir.root),
        violations: moduleViolations(fixture.index, fixture.module, fixture.context) };
    }
    case "parse-module": return product.parseModuleBodies(input.index, input.text);
    case "parse-module-sharing": {
      const parsed = product.parseModuleBodies(input.index, input.text);
      return { parsed, shared: parsed.kind === "parsed" &&
        Object.is(parsed.value.tree.root.statements.nodes[0].node, parsed.value.tree.root.statements.nodes[1].node) };
    }
    case "verify-index": return product.verifyProgramIndex(input.index, verificationContext(input));
    case "verify-path-fixture": {
      const { first, second } = pairedPublications();
      switch (input.change) {
        case "none": break;
        case "module-null": first.answers.set(encodeContextKey(["modulePathOf", first.module.module]), null); break;
        case "definition-null": first.answers.set(encodeContextKey(["definitionPathOf", first.definition]), null); break;
        case "module-other": {
          const actual = encodeContextKey(["modulePathOf", second.module.module]);
          assert.equal(first.answers.has(actual), true, "actual second module path");
          first.answers.set(encodeContextKey(["modulePathOf", first.module.module]), first.answers.get(actual));
          break;
        }
        case "definition-other": {
          const actual = encodeContextKey(["definitionPathOf", second.definition]);
          assert.equal(first.answers.has(actual), true, "actual second definition path");
          first.answers.set(encodeContextKey(["definitionPathOf", first.definition]), first.answers.get(actual));
          break;
        }
        default: throw new Error("Unlisted authored canonical path answer");
      }
      return product.verifyProgramIndex(first.index, first.context);
    }
    case "verify-index-pair": {
      const { first, second } = pairedPublications();
      const index = first.index;
      switch (input.change) {
        case "none": break;
        case "package-order": index.packages.reverse(); break;
        case "dependencies-duplicate": index.packages[0].dependencies.push(second.index.rootPackage); break;
        case "package-exports-order": index.packages[0].exports = [
          { specifier: "z", module: first.module.module }, { specifier: "a", module: first.module.module },
        ]; break;
        case "package-export-missing": index.packages[0].exports = [
          { specifier: "missing", module: encodeModuleId({ package: index.rootPackage, path: "src/missing.ts" }) },
        ]; break;
        case "modules-order": index.modules.reverse(); break;
        case "module-package": index.modules[0].package = second.index.rootPackage; break;
        case "items-duplicate": index.modules[0].items.push({ ...index.modules[0].items[0] }); break;
        case "exports-order": index.modules[0].exports = [
          { name: "z", typeOnlyStar: null, target: { kind: "declarations", definitions: [first.definition] } },
          { name: "a", typeOnlyStar: null, target: { kind: "declarations", definitions: [first.definition] } },
        ]; break;
        case "export-definition-missing": index.modules[0].exports = [
          { name: "missing", typeOnlyStar: null, target: { kind: "declarations", definitions: [encodeDefId({ module: first.module.module, segments: [{ name: "missing", ordinal: 0 }] })] } },
        ]; break;
        case "body-order": index.bodies = [...index.bodies.slice(2), ...index.bodies.slice(0, 2)]; break;
        default: throw new Error("Unlisted authored package/module pair change");
      }
      return product.verifyProgramIndex(index, first.context);
    }
    case "verify-signature-fixture": {
      const fixture = publicationFixture();
      const endpoints = ["advertised", "api-signature", "advertised"].map(role => ({
        declaration: fixture.definition, role, signature: 0, body: null,
      }));
      fixture.answers.set(encodeContextKey(["declarationOf", fixture.definition]), { scope: fixture.scope, parameterCount: 0, endpoints });
      const record = { definition: fixture.definition, kind: "advertised", ordinal: input.ordinal,
        signature: input.signature, bindings: input.bindings };
      fixture.index.signatures.push(record);
      if (input.duplicate === true) fixture.index.signatures.push(record);
      for (const answer of input.answers) fixture.answers.set(encodeContextKey([
        "signatureIdOf", [fixture.definition, "advertised", answer.ordinal, answer.bindings],
      ]), answer.signature);
      return product.verifyProgramIndex(fixture.index, fixture.context);
    }
    case "instantiate": return product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
    case "instantiate-other-metadata-binding": return genericMetadataSelectionFixture().then(({ index, module, metadata, ready, other, artifact }) => {
      const exact = product.instantiate(index, module, artifact, ready, input.limits);
      assert.equal(exact.kind, "instantiated");
      assert.equal(exact.artifact.kind, "metadata");
      assert.equal(exact.artifact.metadata === metadata && exact.types !== index.types, true);
      assert.deepEqual(exact.types, index.types);
      return product.instantiate(index, module, artifact, other, input.limits);
    });
    case "instantiate-invalid-limits": {
      let observed;
      assert.throws(() => product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits), error => {
        if (!(error instanceof TypeError) || error.message !== input.expectedError) return false;
        observed = { kind: "caller-defect", name: error.name, message: error.message };
        return true;
      });
      return observed;
    }
    case "instantiate-method-fixture":
      authoredMethodGraph(input.module);
      return product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
    case "instantiate-module-fixture": {
      const published = input.module.bodies[0];
      const root = input.module.tree.root;
      assert.equal(published.instance.body, root.tsonic.template.body, "authored module template body");
      published.tir.root = root;
      return product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
    }
    case "instantiate-preserves-input": {
      const result = product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
      return { result, index: input.index, module: input.module };
    }
    case "instantiate-method-preserves-input": {
      authoredMethodGraph(input.module);
      const result = product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
      return { result, index: input.index, module: input.module };
    }
    case "instantiate-wide-fixture": {
      const fixture = moduleFixture();
      const root = fixture.module.tree.root;
      const statement = {
        id: 1, origin: root.origin, parent: root.id, flags: [], loc: root.loc, kind: "EmptyStatement", tsonic: null,
      };
      const tree = {
        ...root, statements: { loc: root.loc, nodes: new Array(input.children).fill({ kind: "ready-statement", node: statement }) },
        endOfFileToken: { ...root.endOfFileToken, id: 2 },
      };
      const module = {
        ...fixture.module, tree: { kind: "ready-root", root: tree },
        bodies: fixture.module.bodies.map(body => ({ ...body, tir: { ...body.tir, root: tree } })),
      };
      return product.instantiate(fixture.index, module, { kind: "tir", body: fixture.bodyId }, {
        classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
      }, input.limits);
    }
    case "verify-module-boundary-fixture": {
      const fixture = moduleBoundaryFixture(input.change, publicationFixture());
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-module-fixture": {
      const fixture = publicationFixture();
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-constant-reference-fixture": {
      const fixture = publicationFixture();
      fixture.selected.mir.constants.push({ id: 0, type: 0,
        value: { kind: "constant", reference: { initializer: fixture.instance, context: "compile-time" } } });
      fixture.index.bodies.find(body => body.kind === "selected").mirConstantCount = 1;
      if (input.present) fixture.index.constants.push({ reference: { initializer: fixture.instance, context: "compile-time" }, value: { kind: "absence", type: 0 } });
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-module-change-fixture": {
      const fixture = publicationFixture();
      switch (input.change) {
        case "missing-input": fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null); break;
        case "foreign-chunk":
          fixture.module.module = encodeModuleId({ package: fixture.index.rootPackage, path: "foreign.ts" });
          fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null);
          break;
        case "mir-bindings": fixture.selected.mir.bindings = fixture.template.instance.bindings; break;
        default: throw new Error("Unlisted authored module proof change");
      }
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-metadata-operation-fixture": {
      const { first } = metadataOperationFixture(input.operationKind, input.fact, input.key);
      return { index: product.verifyProgramIndex(first.index, first.context),
        module: moduleViolations(first.index, first.module, first.context) };
    }
    case "verify-repeated-metadata-fixture": {
      const { first } = repeatedMetadataFixture(input.uses, input.ownerSize, input.fact);
      first.context.resources = product.createProgramVerificationWork(ProgramWork.state(first.context.resources).limits, createAccount({ maximumWork: 10000 + (input.uses + 16) * (128 + 16 * first.definition.length), maximumResultEntries: 1000000000 }));
      return { index: product.verifyProgramIndex(first.index, first.context),
        module: moduleViolations(first.index, first.module, first.context) };
    }
    case "verify-artifact-index-fixture": {
      const { first } = publishedArtifactFixture(input.change);
      return product.verifyProgramIndex(first.index, first.context);
    }
    case "verify-field-offset-fixture": {
      const { first } = metadataFieldFixture(input.key);
      return { index: product.verifyProgramIndex(first.index, first.context),
        module: moduleViolations(first.index, first.module, first.context) };
    }
    case "verify-binding-metadata-fixture": {
      const { first, third } = metadataBindingFixture(input.proof, input.key);
      if (input.unrelatedLayout === true) {
        const field = first.tirInput.nodeOf({ kind: "body", value: { body: third.bodyId, node: 2 } });
        field.tsonic.value.memory.value.fieldLayout = { kind: "available", value: { kind: "body", value: { body: first.bodyId, node: 4 } } };
      }
      return { index: product.verifyProgramIndex(first.index, first.context),
        module: moduleViolations(first.index, first.module, first.context) };
    }
    case "verify-qualified-scopes-fixture": {
      const fixture = publicationFixture();
      return { index: product.verifyProgramIndex(fixture.index, fixture.context),
        module: moduleViolations(fixture.index, fixture.module, fixture.context) };
    }
    case "verify-module-inventory-fixture": {
      const fixture = publicationFixture();
      switch (input.change.kind) {
        case "missing-module": fixture.index.modules = []; break;
        case "missing-instance": fixture.index.bodies = fixture.index.bodies.filter(body => body.kind === "template"); break;
        case "mir-count":
          assert.equal(["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"].includes(input.change.field), true, "authored MIR inventory field");
          fixture.index.bodies.find(body => body.kind === "selected")[input.change.field] = input.change.value;
          break;
        default: throw new Error("Unlisted authored module inventory change");
      }
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-index-fixture": {
      const fixture = publicationFixture();
      if (input.change !== undefined) {
        const record = fixture.index.bodies.find(body => body.kind === "selected");
        switch (input.change.kind) {
          case "schema": fixture.index.schema = input.change.value; break;
          case "type-reference": fixture.index.types.terms.push({ kind: "array", element: 2, readonly: false }); break;
          case "constant-owner": {
            const missing = encodeBodyId({ owner: fixture.definition, role: "function", ordinal: 0 });
            fixture.index.constants.push({ reference: { initializer: { body: missing, bindings: { kind: "parametric" } }, context: "compile-time" },
              value: { kind: "absence", type: 0 } });
            fixture.answers.set(encodeContextKey(["bodyOwner", missing]), null);
            break;
          }
          case "shared-types":
            fixture.context.facts.types = { ...fixture.index.types, terms: [...fixture.index.types.terms, { kind: "string" }] };
            break;
          case "diagnostics-order": {
            const common = { severity: "error", site: { kind: "none" }, source: "checker", evidence: [],
              message: "authored diagnostic", arguments: [], related: [], fix: null };
            fixture.index.diagnostics.push({ ...common, code: { kind: "checker", number: 1001, rendered: "TS1001" } },
              { ...common, code: { kind: "checker", number: 1000, rendered: "TS1000" } });
            break;
          }
          case "definition-node-owner":
          case "source-item-unlisted": {
            const root = fixture.module.tree.root;
            const path = { module: fixture.module.module, segments: [{ name: "Alias", ordinal: 0 }] };
            const definition = encodeDefId(path);
            const origin = input.change.kind === "definition-node-owner"
              ? { ...root.origin, module: encodeModuleId({ package: fixture.index.rootPackage, path: "foreign.ts" }) } : root.origin;
            const header = { origin: root.origin, flags: [], loc: root.loc };
            const alias = { ...header, id: 1, parent: 0, origin, kind: "TypeAliasDeclaration", modifiers: null, typeParameters: null,
              name: { ...header, id: 2, parent: 1, kind: "Identifier", text: "Alias",
                tsonic: { role: "declaration-name", declaration: { kind: "definition", definition }, storage: null } },
              type: { ...header, id: 3, parent: 1, kind: "VoidKeyword", tsonic: { type: 0, declarations: [] } },
              tsonic: { definition, parameters: [], type: 0 } };
            root.statements.nodes.push({ kind: "ready-statement", node: alias });
            root.endOfFileToken = { ...root.endOfFileToken, id: 4 };
            const source = fixture.tirInput.source.tree;
            const core = source.tsonic.core;
            const available = value => ({ kind: "available", value });
            source.statements.nodes.push({ ...alias,
              name: { ...alias.name, tsonic: { core, role: "declaration-name", declaration: { kind: "definition", definition } } },
              type: { ...alias.type, tsonic: { core, type: available(0), referencedDefinitions: [] } },
              tsonic: { core, parent: fixture.definition, attributes: [], memory: available(null), definition,
                parameters: [], type: available(0) },
            });
            source.endOfFileToken = { ...root.endOfFileToken };
            const item = { definition, node: alias.id };
            fixture.index.modules[0].items.unshift(item);
            if (input.change.kind === "definition-node-owner") fixture.tirInput.source.items.unshift(item);
            fixture.answers.set(encodeContextKey(["definitionPathOf", definition]), path);
            break;
          }
          case "item-node": fixture.index.modules[0].items[0].node = input.change.value; break;
          case "node-density": fixture.module.tree.root.endOfFileToken.id = 2; break;
          case "body-source-owner":
            fixture.selected.tir.owner = encodeDefId({ module: fixture.module.module, segments: [{ name: "other", ordinal: 0 }] });
            break;
          case "body-count":
            assert.equal(["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"].includes(input.change.field), true, "authored body count field");
            assert.equal(typeof input.change.value, "number", "authored body count");
            record[input.change.field] = input.change.value;
            break;
          case "body-root": record.root = input.change.value; break;
          case "body-owner":
            record.owner = encodeDefId({ module: fixture.module.module, segments: [{ name: "missing", ordinal: 0 }] });
            fixture.answers.set(encodeContextKey(["bindingScopeOf", record.owner]), null);
            break;
          case "body-module":
            record.module = encodeModuleId({ package: fixture.index.rootPackage, path: "other.ts" });
            break;
          case "bound-body": {
            if (input.change.scopeMissing) fixture.answers.set(encodeContextKey(["bindingScopeOf", fixture.definition]), null);
            if (input.change.maximum !== undefined) ProgramWork.state(fixture.context.resources).limits.maximumBindingVectorsPerArtifact = input.change.maximum;
            break;
          }
          default: throw new Error("Unlisted authored fixture change");
        }
      }
      return product.verifyProgramIndex(fixture.index, fixture.context);
    }
    default: throw new Error(`Unlisted authored program operation: ${input.operation}`);
  }
}

for (const path of casePaths) {
  test(`ir-program authored function case ${basename(path, ".case.json")}`, async () => {
    const executeInput = async input => ({ kind: "accepted", value: await evaluate(decodeFixtureJson(input.text)), diagnostics: [] });
    const deps = {
      modules: ["ir-program"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return decodeFixtureJson(text); },
      adapters: { function: executeInput, verifier: executeInput },
    };
    const result = await runCase(deps, path);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { path }).slice(0, 6000));
  });
}

test("ir-program binding inventories retain real checked aliases and closed targets through their owning barrier", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verifyModuleBindings } = await import("../../packages/host/dist/ir-program/verify-module-bindings.js");
  const source = await loadFrontFixture();
  const actual = source.checkedModuleOf("function add(a:number,b:number):number { return a+b; } export { add, add as sum };");
  assert.deepStrictEqual(source.verifyChecked(actual.checked, actual.interner), []);
  const domain = checkedSourceViews([{ module: actual.checked, nodes: source.hir.indexSyntaxTree(actual.checked.tree) }]);
  const fixture = moduleFixture();
  const record = { module: actual.module, package: fixture.index.rootPackage,
    items: [{ definition: actual.checked.tree.tsonic.definition, node: actual.checked.tree.id }, ...actual.checked.items],
    exports: actual.checked.exports, bindings: actual.checked.bindings, checkerDiagnostics: actual.checked.checkerDiagnostics };
  const bodies = new Map(actual.checked.bodies.map(body => [body.body, body.owner]));
  const context = { ...fixture.context, facts: { ...fixture.context.facts, bodyOwner: body => bodies.get(body) ?? null } };
  const ready = new Map([[actual.module, { nodeOf: domain.nodeOf }]]);
  const verify = records => {
    const index = { ...fixture.index, modules: records };
    return verifyModuleBindings(programLookup(index), index, context, ready);
  };
  const violation = (rule, detail) => ({ rule, site: { kind: "module", module: actual.module }, detail: [{ kind: "text", value: detail }] });
  assert.deepStrictEqual(verify([record]), []);
  const first = record.bindings[0];
  const replacing = value => ({ ...record, bindings: [{ ...first, target: { kind: "available", value } }, ...record.bindings.slice(1)] });
  const roundtrip = changed => {
    const index = { ...fixture.index, modules: [changed] };
    assert.deepStrictEqual(product.parseProgramIndex(product.printProgramIndex(index)), { kind: "parsed", value: index });
  };
  roundtrip(record);
  for (const value of [{ kind: "binding", occurrence: record.bindings[1].occurrence }, { kind: "module", module: actual.module },
    { kind: "member", through: { kind: "declarations", definitions: [record.items[0].definition] },
      key: { kind: "available", value: { kind: "text", value: "member" } }, origins: { kind: "available", value: [] } }]) {
    const changed = replacing(value);
    assert.deepStrictEqual(verify([changed]), []);
    roundtrip(changed);
  }
  const diagnostic = { severity: "error", code: { kind: "checker", number: 2304, rendered: "TS2304" }, arguments: [],
    site: { kind: "none" }, source: null, evidence: [], message: "name is not defined", related: [], fix: null };
  const diagnosed = { ...replacing({ kind: "unresolved", diagnostics: [{ module: actual.module, index: 0 }] }), checkerDiagnostics: [diagnostic] };
  assert.deepStrictEqual(verify([diagnosed]), []);
  roundtrip(diagnosed);
  for (const reason of ["not-provided", "checker-error", "parameter-dependent", "missing-original-component", "incomplete-association", "unsupported-checked-structure"]) {
    const changed = { ...record, bindings: [{ ...first, target: { kind: "unavailable", reason, causes: [] } }, ...record.bindings.slice(1)] };
    assert.deepStrictEqual(verify([changed]), []);
    roundtrip(changed);
  }
  const missing = { ...first.occurrence, value: { ...first.occurrence.value, node: actual.checked.tree.endOfFileToken.id } };
  assert.deepStrictEqual(verify([replacing({ kind: "binding", occurrence: missing })]), [
    violation("binding-target-resolves", "a binding edge must retain its actual nearest-target row"),
  ]);
  assert.deepStrictEqual(verify([replacing({ kind: "module", module: encodeModuleId({ package: fixture.index.rootPackage, path: "absent.ts" }) })]), [
    violation("binding-target-resolves", "a module target must retain an actual module"),
  ]);
  for (const index of [-0, -1, 0, 0.5, NaN]) assert.deepStrictEqual(verify([replacing({ kind: "unresolved", diagnostics: [{ module: actual.module, index }] })]), [
    violation("binding-diagnostic-resolves", "a checker root must resolve in its actual module diagnostic inventory"),
  ]);
  const reversed = { ...record, exports: [{ name: "invalid", typeOnlyStar: null, target: { kind: "declarations", definitions: [record.items[1].definition, record.items[0].definition] } }] };
  assert.deepStrictEqual(verify([reversed]), [violation("export-target-resolves", "a declaration group must retain distinct source inventory order")]);
  const empty = { ...record, exports: [{ name: "invalid", typeOnlyStar: null, target: { kind: "declarations", definitions: [] } }] };
  assert.deepStrictEqual(verify([empty]), [violation("export-target-resolves", "a declaration group must be nonempty")]);
  assert.equal(product.parseProgramIndex(product.printProgramIndex({ ...fixture.index, modules: [empty] })).kind, "invalid-text");
  const noRoots = replacing({ kind: "unresolved", diagnostics: [] });
  assert.deepStrictEqual(verify([noRoots]), [violation("binding-diagnostic-resolves", "an unresolved target requires its original checker diagnostic roots")]);
  assert.equal(product.parseProgramIndex(product.printProgramIndex({ ...fixture.index, modules: [noRoots] })).kind, "invalid-text");
  const missingRows = [violation("binding-capture-owner", "binding rows require distinct preorder syntax and their exact qualified owner"),
    ...record.exports.map(() => violation("binding-target-resolves", "a binding edge must retain its actual nearest-target row"))];
  const badOwner = encodeDefId({ module: actual.module, segments: [{ name: "missing", ordinal: 0 }] });
  for (const occurrence of [{ ...first.occurrence, value: { ...first.occurrence.value, node: -0 } },
    { ...first.occurrence, value: { ...first.occurrence.value, node: actual.checked.tree.endOfFileToken.id } },
    { kind: "item", value: { owner: badOwner, node: first.occurrence.value.node } },
    { kind: "body", value: { body: fixture.bodyId, node: first.occurrence.value.node } }]) {
    assert.deepStrictEqual(verify([{ ...record, bindings: [{ ...first, occurrence }, ...record.bindings.slice(1)] }]), missingRows);
  }
  assert.deepStrictEqual(verify([{ ...record, bindings: [...record.bindings, first] }]), missingRows);
  const executing = actual.checked.bodies.find(body => body.root === actual.checked.tree);
  assert.notEqual(executing, undefined);
  const bodyRows = record.bindings.map(row => ({ ...row, occurrence: { kind: "body", value: { body: executing.body, node: row.occurrence.value.node } } }));
  assert.deepStrictEqual(verify([{ ...record, bindings: bodyRows,
    exports: record.exports.map((entry, index) => ({ ...entry, target: { kind: "binding", occurrence: bodyRows[index].occurrence } })) }]), []);
  const emptyRecord = { ...record, bindings: [], exports: [] };
  assert.deepStrictEqual(verify([emptyRecord, emptyRecord]), [
    violation("binding-capture-owner", "a binding table must have exactly one module owner"),
  ]);
  const noDefault = new Map([[actual.module, { nodeOf: reference => {
    const node = domain.nodeOf(reference);
    return reference.value.node === first.occurrence.value.node ? { ...node, kind: "ImportClause", name: null } : node;
  } }]]);
  const index = { ...fixture.index, modules: [record] };
  assert.deepStrictEqual(verifyModuleBindings(programLookup(index), index, context, noDefault), missingRows);
});

test("Program verifies the original type-only star and round-trips native static and intrinsic resolutions", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verifyModuleBindings } = await import("../../packages/host/dist/ir-program/verify-module-bindings.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal");
  input.snapshot = fixture.projectSnapshot({ sourceFiles: {
    "main.ts": "export * from './types.js';",
    "types.ts": "export type * from './provider.js';",
    "values.ts": "export * from './provider.js'; import { state as current } from './provider.js'; "
      + "export function fromAlias(): boolean { return current; }",
    "provider.ts": "export const state: boolean = true; export function stored(): boolean { return state; } "
      + "export function absent(): undefined { return undefined; }",
  }, libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const published = analyzeHostProgram(input);
  assert.equal(published.kind, "ok", JSON.stringify(published.diagnostics));
  const { index, modules } = published.value;
  const moduleOf = name => fixture.moduleOf(fixture.packageOf("/project"), `src/${name}.ts`);
  const checkedOf = name => source.value.modules.find(row => row.module.module === moduleOf(name)).module;
  const views = checkedSourceViews(source.value.modules);
  const ready = new Map(source.value.modules.map(row => [row.module.module, { nodeOf: views.nodeOf }]));
  const context = { facts: { bodyOwner: body => views.bodies.get(body)?.owner ?? null } };
  const main = index.modules.find(row => row.module === moduleOf("main"));
  const exported = main.exports.find(row => row.name === "stored");
  assert.equal(views.nodeOf(exported.typeOnlyStar) === checkedOf("types").tree.statements.nodes[0], true);
  const verify = candidate => verifyModuleBindings(programLookup(candidate), candidate, context, ready);
  assert.deepEqual(verify(index), []);
  const runtime = checkedOf("values");
  const runtimeStar = runtime.tree.statements.nodes[0];
  const execution = runtime.bodies.find(body => body.root === runtime.tree);
  const authoredValue = { kind: "body", value: { body: execution.body, node: runtimeStar.id } };
  assert.equal(views.nodeOf(authoredValue) === runtimeStar, true);
  assert.equal(runtimeStar.isTypeOnly, false);
  const absentBody = encodeBodyId({ owner: encodeDefId({ module: runtime.module, segments: [{ name: "missing", ordinal: 0 }] }),
    role: "function", ordinal: 0 });
  for (const typeOnlyStar of [authoredValue, { kind: "body", value: { body: absentBody, node: runtimeStar.id } }]) {
    const opposite = { ...index, modules: index.modules.map(row => row !== main ? row : { ...row,
      exports: row.exports.map(entry => entry !== exported ? entry : { ...entry, typeOnlyStar }) }) };
    assert.deepEqual(verify(opposite), [{ rule: "export-target-resolves", site: { kind: "module", module: main.module },
      detail: [{ kind: "text", value: "a type-only star must name the actual authored export declaration" }] }]);
  }
  const indexText = product.printProgramIndex(index);
  assert.deepEqual(product.parseProgramIndex(indexText), { kind: "parsed", value: index });
  const template = /BodyRecord\(kind="template"[^]*?root=n:\d+(?=\))/u.exec(indexText);
  assert.ok(template);
  const closing = template.index + template[0].length;
  const malformed = product.parseProgramIndex(indexText.slice(0, closing) + " @" + indexText.slice(closing));
  assert.deepEqual({ kind: malformed.kind, offset: malformed.offset, expected: malformed.expected },
    { kind: "invalid-text", offset: closing + 1, expected: [")"] });
  const provider = modules.find(row => row.module === moduleOf("provider"));
  const text = product.printModuleBodies(index, provider);
  assert.equal(text.includes("static(declaration="), true);
  assert.equal(text.includes('intrinsic-value(intrinsic="undefined")'), true);
  const decoded = product.parseModuleBodies(index, text);
  assert.equal(decoded.kind, "parsed");
  assert.equal(product.printModuleBodies(index, decoded.value), text);
  const consumer = modules.find(row => row.module === moduleOf("values"));
  const printedConsumer = product.printModuleBodies(index, consumer);
  const decodedConsumer = product.parseModuleBodies(index, printedConsumer);
  assert.equal(decodedConsumer.kind, "parsed");
  assert.equal(product.printModuleBodies(index, decodedConsumer.value), printedConsumer);
  const resolution = module => module.tree.root.statements.nodes
    .find(slot => slot.kind === "ready-callable" && slot.node.name.text === "fromAlias")
    .node.body.statements.nodes[0].expression.tsonic.resolution;
  for (const current of [consumer, decodedConsumer.value]) {
    const selected = resolution(current);
    assert.equal(selected.kind, "static");
    assert.deepEqual(selected.aliases, checkedOf("values").bindings.map(binding => binding.occurrence));
    assert.equal(selected.aliases.length, 1);
  }
});

test("Program wire distinguishes bodyless callable and noncallable index formals from an executing formal", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal",
    "export interface Table { lookup(key: string): boolean; [key: number]: boolean; } "
    + "export function read(key: boolean): boolean { return key; }");
  const program = analyzeHostProgram(input);
  assert.equal(program.kind, "ok", JSON.stringify(program.diagnostics));
  const { index, modules } = program.value;
  const main = modules.find(module => module.module === input.snapshot.entryPoint);
  const record = index.modules.find(module => module.module === main.module);
  const printed = product.printModuleBodies(index, main);
  const decoded = product.parseModuleBodies(index, printed);
  assert.equal(decoded.kind, "parsed");
  assert.equal(product.printModuleBodies(index, decoded.value) === printed, true);
  for (const module of [main, decoded.value]) {
    const [tableSlot, readSlot] = module.tree.root.statements.nodes;
    assert.deepEqual([tableSlot.kind, readSlot.kind], ["ready-statement", "ready-callable"]);
    const { node: table } = tableSlot;
    const { node: read } = readSlot;
    const [method, indexed] = table.members.nodes;
    assert.deepEqual([method.kind, indexed.kind, read.kind], ["MethodSignature", "IndexSignature", "FunctionDeclaration"]);
    const formals = [method, indexed, read].map(node => node.parameters.nodes[0]);
    assert.deepEqual(formals.map(formal => [formal.tsonic.local === null, formal.tsonic.passing]),
      [[true, "by-value"], [true, null], [false, "by-value"]]);
    assert.equal(new Set(formals.map(formal => formal.tsonic.declaration)).size, formals.length);
    for (const formal of formals)
      assert.equal(record.items.some(row => row.definition === formal.tsonic.declaration && row.node === formal.id), true);
    const executions = module.bodies.filter(body => body.kind === "selected");
    assert.deepEqual(executions.map(body => body.tir.root.kind).sort(), ["Block", "SourceFile"]);
    assert.equal(formals[2].tsonic.local.body, executions.find(body => body.tir.root.kind === "Block").instance.body);
  }
});

test("Program type publication borrows the real captured location and entry producer vectors", async () => {
  const { loadFrontFixture } = await import("./fixtures/front/checked-module.mjs");
  const { analysisInput } = await import("./fixtures/front/analysis-input.mjs");
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", "export function select(a: string, b = a): string { return b; }");
  const accepted = analyzeHostProgram(input);
  assert.equal(accepted.kind, "ok", JSON.stringify(accepted.diagnostics));
  const { index, modules } = accepted.value;
  const main = modules.find(module => module.module === input.snapshot.entryPoint);
  const caller = main.bodies.find(body => body.kind === "selected" && body.tir.params.length === 2);
  const [omitted, supplied] = caller.facts;
  assert.deepEqual([omitted.execution.provided, supplied.execution.provided], [1, 2]);
  const local = omitted.arena.producers.find(row => row.kind === "local");
  assert.deepEqual(local?.local, caller.tir.params[0].tsonic.local);
  assert.equal(supplied.arena.producers.some(row => row.kind === "local"), false);
  const rewritten = projectFixtureProgram(accepted.value, { table: index.types,
    types: index.types.terms.map((_term, position) => position), signatures: index.types.signatures.map((_signature, position) => position) });
  const mainAfter = rewritten.modules.find(module => module.module === main.module);
  const callerAfter = mainAfter.bodies.find(body => body.kind === "selected" && body.instance.body === caller.instance.body);
  for (const [before, after] of caller.facts.map((facts, position) => [facts, callerAfter.facts[position]])) {
    assert.equal(before.arena.producers === after.arena.producers, true, `provided ${before.execution.provided}`);
    assert.equal(before.arena.boundProducers === after.arena.boundProducers, false);
  }
  for (const [position, summary] of index.summaries.entries()) {
    assert.equal(summary.arena.producers === rewritten.index.summaries[position].arena.producers, true);
  }
  completeProgramValue(rewritten, accepted.value, "the shared producer vectors do not change any published value or identity number");
  const text = product.printModuleBodies(rewritten.index, mainAfter);
  completeProgramValue(product.parseModuleBodies(rewritten.index, text), { kind: "parsed", value: mainAfter },
    "the actual local's owner and selected entry relations survive the Program wire");
});

test("ir-program public values are exactly its locked ports", () => {
  assert.deepEqual(Object.keys(product).sort(), [
    "admitProgramReadyRow", "canonicalizeProgram", "createProgramVerificationWork", "instantiate", "parseModuleBodies", "parseProgramIndex",
    "printModuleBodies", "printProgramIndex", "specializeTir", "tirReadyReadAdmission", "verifyModuleBodies", "verifyProgramIndex",
  ].sort());
});

test("paid generic body projection rejects a crossed real placement and never reads past an original stop", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", `function echo<T>(value:T):T { return value; }
export function first(value:boolean):boolean { return echo(value); }
export function second(value:string):string { return echo<string>(value); }`);
  const checked = captureSourceBarrier(input);
  assert.equal(checked.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, checked.value, account);
  assert.equal(typed.kind, "ok");
  const bodies = [...typed.value.bodies.values()];
  const template = bodies.find(body => body.bindings.kind === "parametric" && body.lexicalBindings.methodBindings.length === 1);
  const choices = bodies.filter(body => body.body === template.body && body.bindings.kind === "instantiated");
  assert.equal(choices.length, 2);
  const instanceOf = body => ({ body: body.body, bindings: body.bindings });
  const instance = instanceOf(choices[0]);
  const original = typed.value.placedSignatureOf(instanceOf(template));
  const selected = typed.value.placedSignatureOf(instance);
  const crossed = typed.value.placedSignatureOf(instanceOf(choices[1]));
  const resources = product.createProgramVerificationWork(input.limits.instantiation, account);
  const unusedReplay = () => assert.fail("a substitution-ready body does not request candidate replay");
  const specialize = (placement, resources) =>
    product.specializeTir(template, instance, placement, typed.value.source.types, resources, unusedReplay);
  assert.throws(() => product.specializeTir(template, instance, { kind: "endpoint", template: original, selected },
    typed.value.source.types, resources), /actual substitution-ready template and placed signature/u);
  assert.throws(() => specialize({ kind: "endpoint", template: original, selected: crossed }, resources),
    /actual substitution-ready template and placed signature/u);
  const placement = { kind: "endpoint", template: original, selected };
  const complete = specialize(placement, resources);
  assert.equal(complete.kind, "complete");
  assert.deepEqual(complete.value, choices[0]);
  assert.notStrictEqual(complete.value.root, choices[0].root);
  assert.equal(complete.value.bindings === instance.bindings, true);
  const exhausted = createAccount({ ...input.limits.dataflow, maximumWork: 0 });
  const stopped = product.createProgramVerificationWork(input.limits.instantiation, exhausted);
  const poison = { get body() { assert.fail("a stopped projection reads no source body"); } };
  const refusal = product.specializeTir(poison, instance, placement, typed.value.source.types, stopped, unusedReplay);
  assert.equal(refusal.kind === "resource-limit" && refusal === accountFailure(exhausted), true);
  assert.strictEqual(product.specializeTir(poison, instance, placement, typed.value.source.types, stopped, unusedReplay), refusal);
});

test("candidate replay refusal preserves the actual stop without opening another prepared call", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", `function echo<T>(value:T):T { return value; }
function take<T>(value:T):T { echo(value); return echo(value); }
export function run(value:boolean):boolean { return take(value); }`);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok");
  const bodies = [...typed.value.bodies.values()];
  const template = bodies.find(body => body.bindings.kind === "parametric" && body.root.kind === "Block"
    && body.root.statements.nodes.length === 2 && body.root.statements.nodes[0].kind === "ExpressionStatement");
  const ready = bodies.find(body => body.body === template.body && body.bindings.kind === "instantiated");
  const target = { body: ready.body, bindings: ready.bindings };
  const placement = { kind: "endpoint", template: typed.value.placedSignatureOf({ body: template.body, bindings: template.bindings }),
    selected: typed.value.placedSignatureOf(target) };
  const maximumWork = input.limits.dataflow.maximumWork;
  const account = createAccount(input.limits.dataflow);
  const resources = product.createProgramVerificationWork(input.limits.instantiation, account);
  const calls = [];
  const replay = (candidate, result) => {
    calls.push(candidate.context.occurrence);
    assert.equal(result, ready.completion);
    return chargeWork(account, maximumWork + 1);
  };
  const stopped = product.specializeTir(template, target, placement, source.value.types, resources, replay);
  assert.equal(stopped.kind === "resource-limit" && stopped === accountFailure(account), true);
  assert.deepEqual(calls, [{ body: template.body, node: template.root.statements.nodes[0].expression.id }]);
  const unread = { get body() { assert.fail("a stopped replay must not reopen its body"); } };
  assert.equal(product.specializeTir(unread, target, placement, source.value.types, resources, replay) === stopped, true);
  assert.equal(calls.length, 1);
});

test("Program completed evidence growth borrows the existing work and created-record allowance", () => {
  const fixture = publicationFixture();
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const run = (maximumWork, maximumCreatedRecords) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 0 });
    const resources = product.createProgramVerificationWork({ ...limits, maximumCreatedRecords }, account);
    return { account, resources, state: ProgramWork.state(resources) };
  };
  const actual = run(9, 3);
  assert.equal(product.admitProgramReadyRow(actual.resources, 0, 1), null);
  assert.equal(remainingWork(actual.account), 9);
  assert.equal(actual.state.created, 1);
  assert.equal(product.admitProgramReadyRow(actual.resources, 9, 2), null);
  assert.equal(remainingWork(actual.account), 0);
  assert.equal(actual.state.created, 3);
  const tied = run(8, 0);
  const before = product.admitProgramReadyRow(tied.resources, 9, 2);
  assert.equal(before, accountFailure(tied.account));
  assert.equal(tied.state.created, 0);
  assert.equal(product.admitProgramReadyRow(tied.resources, 0, 1), before);
  const created = run(9, 1);
  const allocation = product.admitProgramReadyRow(created.resources, 9, 2);
  assert.equal(allocation, created.state.failure);
  assert.equal(allocation.dimension, "created-records");
  assert.equal(remainingWork(created.account), 0);
  assert.equal(product.admitProgramReadyRow(created.resources, 1, 0), allocation);
  const refused = run(9, 3);
  const original = refuseAccount(refused.account, conditionRefusal);
  assert.equal(product.admitProgramReadyRow(refused.resources, 0, 1), original);
  assert.equal(refused.state.created, 0);
});

test("Program source and signature verifier reads require their complete paid identity operands", () => {
  const maximum = 100000;
  const run = limit => {
    const fixture = publicationFixture();
    const { index, definition, scope, context: originalContext } = fixture;
    const bindings = { kind: "parametric" };
    const signature = { kind: "advertised", definition, ordinal: 0, signature: 0, bindings };
    fixture.answers.set(encodeContextKey(["declarationOf", definition]), { scope, parameterCount: 0,
      endpoints: [{ declaration: definition, role: "advertised", signature: 0, body: null }] });
    fixture.answers.set(encodeContextKey(["signatureIdOf", [definition, "advertised", 0, bindings]]), 0);
    const account = createAccount({ maximumWork: limit, maximumResultEntries: maximum });
    const resources = product.createProgramVerificationWork(ProgramWork.state(originalContext.resources).limits, account);
    const reads = [];
    const read = (kind, width) => reads.push({ kind, width, work: limit - remainingWork(account) });
    index.signatures = [];
    Object.defineProperty(index.signatures, 0, { get() { read("signature row", 0); return signature; } });
    const context = { ...originalContext, resources, tirOf: module => {
      const original = originalContext.tirOf(module);
      return original === null ? null : { ...original, bodyOf: instance => {
        read("body key", instance.body.length + (instance.bindings.kind === "parametric" ? 1 : 2));
        return original.bodyOf(instance);
      } };
    }, signatureIdOf: (...key) => {
      read("signature request", definition.length + 1);
      return originalContext.signatureIdOf(...key);
    } };
    const result = product.verifyProgramIndex(index, context);
    return { reads, result, original: accountFailure(account), work: limit - remainingWork(account) };
  };
  const full = run(maximum);
  assert.equal(full.result.kind, "complete");
  assert.equal(full.result.violations.length, 0);
  const firstSignature = full.reads.findIndex(row => row.kind === "signature row");
  assert.equal(firstSignature > 0, true);
  assert.deepEqual(full.reads.slice(0, firstSignature).map(row => row.kind), ["body key", "body key"]);
  const signature = full.reads[firstSignature + 1];
  assert.equal(signature.kind, "signature request");
  assert.equal(signature.work - full.reads[firstSignature].work, signature.width);
  assert.equal(run(full.work).result.kind, "complete");
  for (const [index, row] of full.reads.slice(0, firstSignature + 2).entries()) {
    for (let cut = row.work - Math.max(1, row.width); cut < row.work; cut += 1) {
      const stopped = run(cut);
      assert.equal(stopped.result === stopped.original && stopped.result.dimension === "work", true, row.kind);
      assert.deepEqual(stopped.reads.filter(read => read.work < row.work).slice(0, index), full.reads.slice(0, index));
      assert.equal(stopped.reads.length <= index, true, row.kind);
    }
  }
});

test("ir-program print rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax child cycle at ModuleBodies.tree.root.statements.nodes[0].expression.left";
  assert.throws(() => product.printModuleBodies(fixture.index, fixture.module),
    error => error instanceof TypeError && error.message === expected);
});

test("ir-program canonicalization rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax child cycle at HostProgram.modules[0].tree.root.statements.nodes[0].expression.left";
  assert.throws(() => projectFixtureProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  }), error => error instanceof TypeError && error.message === expected);
});

test("ir-program module verification rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax child cycle at ModuleBodies.tree.root.statements.nodes[0].expression.left";
  assert.throws(() => product.verifyModuleBodies(fixture.index, fixture.module, fixture.context),
    error => error instanceof TypeError && error.message === expected);
});

test("Program chapter verification cannot use the candidate tree or bodies as independent Typed evidence", () => {
  const exact = publicationFixture();
  assert.deepEqual(product.verifyModuleBodies(exact.index, exact.module, exact.context), { kind: "complete", violations: [] });
  for (const family of ["root", "body"]) {
    const fixture = publicationFixture();
    const other = publicationFixture();
    const original = fixture.context.tirOf;
    assert.equal(other.tirInput.module.module, fixture.tirInput.module.module);
    assert.equal(other.tirInput.module.tree.root.id, fixture.tirInput.module.tree.root.id);
    assert.notEqual(other.tirInput.module.tree, fixture.tirInput.module.tree);
    const expected = fixture.tirInput.module;
    const module = family === "root" ? { ...expected, tree: other.tirInput.module.tree }
      : { ...expected, bodies: [expected.bodies[0], other.selected.tir] };
    const context = { ...fixture.context, tirOf: identity => {
      const ready = original(identity);
      return identity === module.module ? { ...ready, module } : ready;
    } };
    const result = product.verifyModuleBodies(fixture.index, fixture.module, context);
    assert.equal(result.kind, "complete");
    const expectedChild = family === "root" ? "module-node-identity" : "template-shared-once";
    assert.equal(result.violations.some(row => row.rule === "tir-valid" && row.detail[0]?.value === expectedChild), true, family);
  }
});

test("instantiation-preserves-existing-ids rejects a nonpublication that merges old IDs", () => {
  const fixture = moduleFixture();
  fixture.index.types.terms.push({ kind: "intrinsic", intrinsic: "void" });
  const limits = {
    maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 128, maximumVisits: 100000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 },
  };
  const result = product.instantiate(fixture.index, fixture.module, { kind: "tir", body: fixture.bodyId }, {
    classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
  }, limits);
  assert.equal(result.kind, "refused");
  assert.deepEqual(result.diagnostics.map(row => [row.code.rendered, row.arguments]), [["TSONIC_PROGRAM_TYPE_TABLE_INVALID", [
    { kind: "text", value: "canonical-representative" }, { kind: "text", value: "type" }, { kind: "number", value: 1 },
    { kind: "text", value: "terms" },
  ]]]);
});

for (const maximum of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`ir-program invalid binding-vector maximum fails at its index boundary: ${Object.is(maximum, -0) ? "-0" : String(maximum)}`, () => {
    const fixture = moduleFixture();
    assert.throws(() => product.createProgramVerificationWork({
      ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: maximum }, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000000 })), error => error instanceof TypeError
      && error.message === "Invalid InstantiationLimits.maximumBindingVectorsPerArtifact");
  });
}

test("Program verification work is opaque in current emitted public declarations", () => {
  const stage = mkdtempSync(resolve(repository, ".temp/program-work-public-"));
  const input = resolve(stage, "consumer.ts");
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ extends: resolve(repository, "packages/host/tsconfig.json"),
    compilerOptions: { noEmit: true, rootDir: repository }, files: [input], include: [] }));
  const prefix = `import { createProgramVerificationWork } from "${resolve(repository, "packages/host/dist/ir-program/index.js")}";
import type { ProgramVerificationLimits, ProgramVerificationWork } from "${resolve(repository, "packages/host/dist/ir-program/contract.js")}";
import type { DataflowAccount } from "${resolve(repository, "packages/host/dist/dataflow/contract.js")}";
`;
  const compile = () => spawnSync(process.execPath, [resolve(repository, "node_modules/@typescript/native-preview/bin/tsgo.js"),
    "--project", config, "--pretty", "false"], { cwd: repository, encoding: "utf8", maxBuffer: 1048576 });
  writeFileSync(input, prefix + "export function create(limits: ProgramVerificationLimits, account: DataflowAccount): ProgramVerificationWork { return createProgramVerificationWork(limits, account); }");
  const valid = compile();
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  writeFileSync(input, prefix + `export function forbidden(limits: ProgramVerificationLimits, account: DataflowAccount, work: ProgramVerificationWork): void {
const old: ProgramVerificationWork = { limits, work: 0, created: 0, seed: { kind: "unseeded" } };
const actual = createProgramVerificationWork(limits, account);
work.work = 1;
work.created = 1;
work.seed = { kind: "unseeded" };
work.value;
void old;
void actual;
}`);
  const invalid = compile();
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  assert.deepEqual([...invalid.stdout.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])),
    [2353, 2339, 2339, 2339, 2341], invalid.stdout.slice(-8000));
  writeFileSync(input, `import type { ProgramVerificationResult } from "${resolve(repository, "packages/host/dist/ir-program/contract.js")}";
export function current(result: ProgramVerificationResult): number {
return result.kind === "complete" ? result.violations.length : result.kind === "refused" ? result.diagnostics.length : result.maximum;
}`);
  const currentResult = compile();
  assert.equal(currentResult.status, 0, currentResult.stdout + currentResult.stderr);
  writeFileSync(input, `import type { ProgramVerificationResult } from "${resolve(repository, "packages/host/dist/ir-program/contract.js")}";
export function removed(result: ProgramVerificationResult): readonly unknown[] { return result; }`);
  const removedResult = compile();
  assert.equal(removedResult.status, 1, removedResult.stdout + removedResult.stderr);
  assert.deepEqual([...removedResult.stdout.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])), [2322], removedResult.stdout.slice(-8000));
});

test("constant publication receipts retain each selected producer context", async () => {
  const { constantReferenceKey } = await import("../../packages/host/dist/ir-types/index.js");
  const fixture = publicationFixture();
  const references = ["fixed-array-extent", "compile-time"].map(context => ({ initializer: fixture.instance, context }));
  fixture.index.constants = references.map(reference => ({ reference, value: { kind: "absence", type: 0 } }))
    .sort((left, right) => {
      const first = constantReferenceKey(left.reference), second = constantReferenceKey(right.reference);
      return first < second ? -1 : first > second ? 1 : 0;
    });
  const published = fixture.selected;
  published.mir.constants = [{ id: 0, type: 0, value: { kind: "constant", reference: references[0] } }];
  fixture.index.bodies.find(body => body.kind === "selected").mirConstantCount = 1;
  assert.deepEqual(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  const printed = product.printProgramIndex(fixture.index);
  completeProgramValue(product.parseProgramIndex(printed), { kind: "parsed", value: fixture.index }, "all actual contexts round-trip");
  const removed = printed.replace(/reference=ConstantReference\(initializer=(BodyInstance\(.*?\)), context="[^"]+"\)/u, "initializer=$1");
  assert.notEqual(removed, printed);
  assert.equal(product.parseProgramIndex(removed).kind, "invalid-text", "the old context-free publication record is removed");
  assert.equal(product.parseProgramIndex(printed.replace('context="compile-time"', 'context="enum-member"')).kind, "invalid-text",
    "an enum publication reference cannot be constructed from an initializer instance");
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [], "an exact selected context has its receipt");
  const missingReceipt = { ...fixture.index, constants: fixture.index.constants.filter(row => row.reference.context !== "fixed-array-extent") };
  assert.equal(moduleViolations(missingReceipt, fixture.module, fixture.context).some(row => row.rule === "binding-artifact-present"), true,
    "a receipt for another context never answers this reference");
});

test("Program charges every selected floating format row to the original verification account", () => {
  const fixture = publicationFixture();
  const original = fixture.context.selectedNativeFacts.floatingFormats[0];
  const formatPairs = [["float16", "ieee754-binary16"], ["float32", "ieee754-binary32"], ["float64", "ieee754-binary64"]];
  const selectedNativeFacts = { ...fixture.context.selectedNativeFacts, floatingFormats: formatPairs.map(([carrier, interchange]) =>
    ({ ...original, carrier, interchange })) };
  const nativeFactsKey = typeProduct.nativeFactsKey(selectedNativeFacts);
  const index = { ...fixture.index, nativeFactsKey };
  const typeOffset = index.types.terms.length;
  index.types.terms.push(...formatPairs.map(([primitive]) => ({ kind: "primitive", primitive })));
  const reference = { initializer: fixture.instance, context: "compile-time" };
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const run = (constants, maximumWork, initialization = index.initialization) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 1000000 });
    const resources = product.createProgramVerificationWork(limits, account);
    const published = { ...index, constants, initialization };
    const context = { ...fixture.context, initialization, selectedNativeFacts, nativeFactsKey, resources };
    const result = product.verifyProgramIndex(published, context);
    if (result.kind !== "complete") {
      assert.equal(result === accountFailure(account), true);
      assert.equal(product.verifyProgramIndex(published, context) === result, true);
    }
    return { result, work: maximumWork - remainingWork(account) };
  };
  const complete = { kind: "complete", violations: [] };
  const baseline = run([], 1000000);
  assert.deepEqual(baseline.result, complete);
  for (const [position, [carrier]] of formatPairs.entries()) {
    const constants = [{ reference, value: { kind: "floating", type: typeOffset + position, bits: 0n } }];
    const exact = baseline.work + 1 + position + 1;
    assert.deepEqual(run(constants, 1000000), { result: complete, work: exact }, carrier);
    for (let maximum = baseline.work; maximum < exact; maximum += 1) {
      const { result } = run(constants, maximum);
      assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum }, carrier);
    }
    assert.deepEqual(run(constants, exact), { result: complete, work: exact }, carrier);
  }
  const withoutScheduledEffects = { ...index.initialization, modules: [], entries: [] };
  const prefix = run([], 1000000, withoutScheduledEffects);
  assert.deepEqual(prefix.result, complete);
  const lastFormat = [{ reference, value: { kind: "floating", type: typeOffset + 2, bits: 0n } }];
  for (const maximum of [prefix.work + 1, prefix.work + 2])
    assert.deepEqual(run(lastFormat, maximum, withoutScheduledEffects).result, { kind: "resource-limit", dimension: "work", maximum });
  assert.deepEqual(run(lastFormat, prefix.work + 4, withoutScheduledEffects), { result: complete, work: prefix.work + 4 });
  const populated = { ...index, constants: [{ reference, value: { kind: "floating", type: typeOffset, bits: 0n } }] };
  const resources = product.createProgramVerificationWork(limits, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 }));
  const incomplete = [...selectedNativeFacts.floatingFormats];
  delete incomplete[1];
  assert.throws(() => product.verifyProgramIndex(populated, { ...fixture.context, resources, nativeFactsKey,
    selectedNativeFacts: { ...selectedNativeFacts, floatingFormats: incomplete } }),
  /Program verification requires the matching selected native facts record/u);
  const empty = { ...selectedNativeFacts, floatingFormats: [] };
  const emptyKey = typeProduct.nativeFactsKey(empty);
  assert.throws(() => product.verifyProgramIndex({ ...populated, nativeFactsKey: emptyKey }, { ...fixture.context, nativeFactsKey: emptyKey,
    resources: product.createProgramVerificationWork(limits, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 })),
    selectedNativeFacts: empty }), /Program floating constants require the selected carrier format/u);
  const otherFormats = { ...selectedNativeFacts, floatingFormats: selectedNativeFacts.floatingFormats.slice(1) };
  const otherKey = typeProduct.nativeFactsKey(otherFormats);
  assert.throws(() => product.verifyProgramIndex({ ...populated, nativeFactsKey: otherKey }, { ...fixture.context, nativeFactsKey: otherKey,
    resources: product.createProgramVerificationWork(limits, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000 })),
    selectedNativeFacts: otherFormats }), /Program floating constants require the selected carrier format/u);
});

test("ir-program retains one actual selected-native identity at its ready and publication boundaries", () => {
  const fixture = publicationFixture();
  assert.deepEqual(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  for (const key of [undefined, null, "", 1]) assert.throws(() =>
    product.verifyProgramIndex(fixture.index, { ...fixture.context, nativeFactsKey: key }),
    { name: "TypeError", message: "Program verification requires the selected native facts identity" });
  assert.throws(() => product.verifyProgramIndex(fixture.index, { ...fixture.context, nativeFactsKey: "different" }),
    { name: "TypeError", message: "Program verification requires the matching selected native facts record" });
  assert.throws(() => product.verifyProgramIndex(fixture.index, { ...fixture.context,
    selectedNativeFacts: { ...fixture.context.selectedNativeFacts, nativeIntegerWidths: [{ carrier: "native-int", bits: 0 }] } }),
    { name: "TypeError", message: "Program verification requires the matching selected native facts record" });
  for (const key of [undefined, null, "", "different"]) assert.deepEqual(
    product.verifyProgramIndex({ ...fixture.index, nativeFactsKey: key }, fixture.context),
    { kind: "complete", violations: [{ rule: "native-facts-identity", site: { kind: "index" }, detail: [] }] });
  const printed = product.printProgramIndex(fixture.index);
  const without = printed.slice(0, printed.lastIndexOf(", nativeFactsKey=")) + ")\n";
  assert.equal(product.parseProgramIndex(without).kind, "invalid-text", "removed identity-free index grammar is rejected");
});

test("ir-program negative-zero binding maximum is a caller-input defect", () => {
  const fixture = moduleFixture();
  assert.throws(() => product.createProgramVerificationWork({
    ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: -0 }, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000000 })), TypeError);
});

for (const ordinal of [-1, -0, NaN]) test(`ir-program signature ordinal ${Object.is(ordinal, -0) ? "-0" : String(ordinal)} retains its complete endpoint finding`, () => {
  const fixture = publicationFixture();
  fixture.index.signatures = [{ kind: "advertised", definition: fixture.definition, ordinal, signature: 0, bindings: { kind: "parametric" } }];
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [{ rule: "signature-endpoints-exact",
    site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: fixture.definition }, { kind: "text", value: "advertised" },
      { kind: "number", value: ordinal }] }] }, "invalid ordinals do not invoke or fabricate an endpoint-reader result");
});

test("ir-program an unpublished declaration retains its complete endpoint failure without inventing an owner", () => {
  const fixture = publicationFixture();
  const definition = moduleFixture("src/other.ts").definition;
  const bindings = { kind: "parametric" };
  fixture.index.signatures = [{ kind: "advertised", definition, ordinal: 0, signature: 0, bindings }];
  fixture.answers.set(encodeContextKey(["signatureIdOf", [definition, "advertised", 0, bindings]]), null);
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [{ rule: "signature-endpoints-exact",
    site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: definition }, { kind: "text", value: "advertised" },
      { kind: "number", value: 0 }] }] }, "a genuine missing publication remains distinct from a made-up lower answer");
});

test("ir-program missing checked module data retains all index and module-boundary findings", () => {
  const fixture = publicationFixture();
  fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null);
  const missing = { rule: "tir-valid", site: { kind: "module", module: fixture.module.module },
    detail: [{ kind: "text", value: "missing-module-data" }] };
  const missingRoots = [fixture.template.instance, fixture.instance].map(instance => ({ rule: "body-root-resolves",
    site: { kind: "body", instance }, detail: [{ kind: "number", value: 0 }] }));
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [missing, ...missingRoots] },
    "the complete source inventory does not drop either body finding");
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [missing,
    { rule: "facts-valid", site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "text", value: "missing-observation-source" }] }],
    "the complete chunk boundary reports the unavailable checked source once");
});

test("Program index and chapter share the paid, owned Types rows rather than a mutable caller table", () => {
  const fixture = publicationFixture();
  const accepted = { kind: "complete", violations: [] };
  assert.deepEqual(product.verifyProgramIndex(fixture.index, fixture.context), accepted);
  const seed = ProgramWork.state(fixture.context.resources).seed;
  assert.equal(seed.kind, "seeded");
  const original = fixture.index.types;
  const ownedSignature = seed.adopted.signatures[0];
  assert.equal(seed.adopted === original || ownedSignature === original.signatures[0], false);
  const alternate = { ...fixture.index, bodies: fixture.index.bodies.filter(body => body.kind === "template") };
  const verified = ProgramWork.state(fixture.context.resources).verifiedIndex;
  assert.equal(verified.index === fixture.index, true);
  Object.defineProperty(fixture.index.bodies, 0, { get: () => assert.fail("do not rebuild a verified index's body lookup") });
  original.signatures[0].result = 99;
  original.terms[0].kind = "unknown";
  assert.deepEqual(product.verifyModuleBodies(fixture.index, fixture.module, fixture.context), accepted);
  assert.deepEqual(product.verifyModuleBodies(alternate, fixture.module, fixture.context), { kind: "complete", violations: [
    { rule: "body-levels-total", site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "text", value: fixture.module.module }] },
  ] });
  assert.equal(ProgramWork.state(fixture.context.resources).verifiedIndex === verified, true);
  assert.equal(seed.adopted.signatures[0] === ownedSignature, true);
  assert.equal(ownedSignature.result, 0);
});

test("Program checkpoints retain the precise foreign Types site before any artifact is read", () => {
  const fixture = publicationFixture();
  const tested = [fixture.index, { ...fixture.module }];
  fixture.index.types.terms.push({ ...fixture.index.types.terms[0] });
  const detail = [{ kind: "text", value: "canonical-representative" },
    { kind: "text", value: "type" }, { kind: "number", value: 1 }, { kind: "text", value: "terms" }];
  const rejected = { kind: "complete", violations: [{ rule: "types-valid", site: { kind: "index" }, detail }] };
  const context = { ...fixture.context, tirOf: () => assert.fail("a rejected type table does not consult a chapter") };
  assert.deepEqual(product.verifyProgramIndex(fixture.index, context), rejected);
  assert.deepEqual(product.verifyModuleBodies(fixture.index, fixture.module, context), rejected);
  Object.defineProperty(tested[1], "bodies", { get: () => assert.fail("unadmitted Types must not select even an exact artifact") });
  const artifact = { kind: "tir", body: fixture.bodyId };
  const bindings = fixture.instance.bindings.bindings;
  const limits = { ...ProgramWork.state(context.resources).limits, maximumWork: 1000000 };
  const actual = product.instantiate(tested[0], tested[1], artifact, bindings, limits);
  assert.equal(actual.kind, "refused");
  assert.deepEqual(actual.diagnostics.map(row => [row.code.rendered, row.arguments]), [
    ["TSONIC_PROGRAM_TYPE_TABLE_INVALID", detail],
  ]);
  assert.deepEqual(product.instantiate(tested[0], tested[1], artifact, bindings, { ...limits, maximumWork: 0 }),
    { kind: "resource-limit", dimension: "work", maximum: 0 });
});

test("standalone Instantiate skips only a rowless missing artifact and pays each actual selector slot before reading it", async () => {
  const { selectArtifact } = await import("../../packages/host/dist/ir-program/instantiate.js");
  const fixture = publicationFixture();
  const bindings = fixture.instance.bindings.bindings;
  const table = { terms: [], signatures: [] };
  const index = { ...fixture.index, types: table };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 0, maximumCreatedRecords: 0 };
  const artifact = { kind: "facts", body: fixture.instance.body, provided: 7 };
  let bodyReads = 0;
  const factsReads = [];
  const first = fixture.selected.facts[0];
  const facts = [first, { ...first, execution: { ...first.execution, provided: 1 } }];
  const executions = [...facts];
  for (const [position, row] of facts.entries()) Object.defineProperty(executions, position,
    { get: () => { factsReads.push(position); return row; } });
  const bodies = Array(1);
  Object.defineProperty(bodies, 0, { get: () => { bodyReads += 1; return { ...fixture.selected, facts: executions }; } });
  const module = { ...fixture.module, bodies };
  const stop = maximum => ({ kind: "resource-limit", dimension: "work", maximum });
  const missing = { kind: "missing-binding-artifact", artifact, bindings };
  assert.deepEqual(product.instantiate(index, { ...module, bodies: [] }, artifact, bindings, limits), missing);
  for (const maximumWork of [0, 1, 2, 3]) {
    bodyReads = 0;
    factsReads.length = 0;
    assert.deepEqual(product.instantiate(index, module, artifact, bindings, { ...limits, maximumWork }), maximumWork === 3 ? missing : stop(maximumWork));
    assert.equal(bodyReads, Number(maximumWork > 0));
    assert.deepEqual(factsReads, facts.map((_row, position) => position).slice(0, Math.max(0, maximumWork - 1)));
  }
  const meter = createInstantiationMeter({ ...limits, maximumWork: 2 });
  const selectedStop = selectArtifact(meter, index, module, artifact, bindings);
  assert.equal(selectedStop === accountFailure(meter.account), true);
  assert.equal(selectArtifact(meter, index, module, artifact, bindings) === selectedStop, true);

  const corrupt = { ...index, types: { terms: new Array(1), signatures: [] } };
  const unread = { ...fixture.module, get bodies() { return assert.fail("malformed foreign Types must precede selecting even an absent artifact"); } };
  const refused = product.instantiate(corrupt, unread, artifact, bindings, { ...limits, maximumWork: 1000, maximumCreatedRecords: 1000 });
  assert.equal(refused.kind, "refused");
  assert.deepEqual(refused.diagnostics.map(row => [row.code.rendered, row.arguments]), [["TSONIC_PROGRAM_TYPE_TABLE_INVALID", [
    { kind: "text", value: "type-reference" }, { kind: "text", value: "type" }, { kind: "number", value: 0 },
    { kind: "text", value: "terms" },
  ]]]);

  const metadata = { kind: "data-layout", key: { definition: fixture.definition, bindings: { kind: "parametric" } },
    occurrence: { kind: "item", value: { owner: fixture.definition, node: 0 } }, fingerprint: "native64-le", byteOrder: "little", addressWidth: 64 };
  const metadataRef = { kind: "metadata", definition: fixture.definition };
  const exactWork = 1 + 5 + 8 + 4 + 4 + 1;
  const exactRecords = 5 + 8 + 4 + 4 + 1;
  const match = (maximumWork, maximumCreatedRecords) => product.instantiate({ ...index, metadata: [metadata] }, module,
    metadataRef, bindings, { ...limits, maximumWork, maximumCreatedRecords });
  assert.deepEqual(match(exactWork - 1, exactRecords), stop(exactWork - 1));
  assert.deepEqual(match(exactWork, exactRecords - 1), { kind: "resource-limit", dimension: "created-records", maximum: exactRecords - 1 });
  const exact = match(exactWork, exactRecords);
  assert.deepEqual(exact, { kind: "instantiated", artifact: { kind: "metadata", metadata }, types: table });
  assert.equal(exact.artifact.metadata === metadata && exact.types !== table, true);
});

test("Program rejects a malformed Types table field at its header before an otherwise missing artifact", () => {
  const fixture = publicationFixture();
  const bindings = fixture.instance.bindings.bindings;
  const artifact = { kind: "tir", body: fixture.instance.body };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000, maximumCreatedRecords: 1000 };
  const terms = [fixture.index.types.terms[0]];
  Object.defineProperty(terms, 0, { get: () => assert.fail("the invalid signature envelope precedes valid term rows") });
  for (const [types, field, rule] of [
    [{ terms: { length: 0 }, signatures: [] }, "terms", "type-reference"],
    [{ terms: { length: 1, 0: fixture.index.types.terms[0] }, signatures: [] }, "terms", "type-reference"],
    [{ terms, signatures: { length: 0 } }, "signatures", "signature-reference"],
  ]) {
    const index = { ...fixture.index, types };
    const actual = product.instantiate(index, { ...fixture.module, bodies: [] }, artifact, bindings, limits);
    const detail = [rule, "table", field].map(value => ({ kind: "text", value }));
    assert.equal(actual.kind, "refused");
    assert.deepEqual(actual.diagnostics.map(row => [row.code.rendered, row.arguments]), [["TSONIC_PROGRAM_TYPE_TABLE_INVALID", detail]]);
    const context = { ...fixture.context, tirOf: () => assert.fail("no checked chapter read for an invalid Types envelope"),
      resources: product.createProgramVerificationWork(limits, createAccount({ maximumWork: 1000, maximumResultEntries: 1000 })) };
    const rejected = { kind: "complete", violations: [{ rule: "types-valid", site: { kind: "index" }, detail }] };
    assert.deepEqual(product.verifyProgramIndex(index, context), rejected);
    assert.deepEqual(product.verifyModuleBodies(index, fixture.module, context), rejected);
  }
});

test("Typed Source retains the actual placed endpoint through selected empty-scope replay", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const fixture = await loadFrontFixture();
  const inputs = analysisInput(fixture, "sdk-minimal");
  inputs.snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts":
    "export function left(flag: boolean): boolean { return flag; } "
    + "export function right(flag: boolean): boolean { return !flag; }" },
  libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }] });
  const source = captureSourceBarrier(inputs);
  assert.equal(source.kind, "ok", JSON.stringify(source.diagnostics));
  const typed = typeSourceBarrier(inputs, source.value, createAccount(inputs.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const ready = typed.value;
  const table = typeProduct.viewTypes(source.value.types);
  const bodies = [...ready.bodies.values()];
  const callable = bodies.filter(body => body.root.kind !== "SourceFile" && body.bindings.kind === "parametric");
  assert.equal(callable.length, 2);
  for (const template of callable) {
    const placed = ready.placedSignatureOf({ body: template.body, bindings: template.bindings });
    const own = ready.declarationOf(template.owner).endpoints;
    assert.equal(own.length, 1);
    assert.equal(own[0].body, template.body);
    assert.deepEqual(placed.request, { definition: template.owner, endpoint: own[0].role, ordinal: 0, bindings: template.bindings });
    assert.equal(placed.signature === table.signatures[template.signature], true);
    const selected = bodies.find(body => body.body === template.body && body.bindings.kind === "instantiated");
    const instantiation = { body: selected.body, bindings: selected.bindings };
    const replayed = ready.placedSignatureOf(instantiation);
    assert.equal(replayed.request.bindings === selected.bindings && replayed.signature === placed.signature, true);
    assert.deepEqual(replayed.request, { ...placed.request, bindings: selected.bindings });
    assert.deepEqual(Object.values(selected.bindings.bindings).map(family => family.length), [0, 0, 0, 0]);
    assert.equal(ready.placedSignatureOf(instantiation) === replayed, true, "a ready read borrows its completed evidence");
  }
  const module = bodies.find(body => body.root.kind === "SourceFile" && body.bindings.kind === "parametric");
  const execution = ready.placedSignatureOf({ body: module.body, bindings: module.bindings });
  assert.equal(execution.request, null);
  assert.equal(execution.signature === table.signatures[module.signature], true);
  assert.notEqual(ready.placedSignatureOf({ body: callable[0].body, bindings: callable[0].bindings }).signature.id,
    ready.placedSignatureOf({ body: callable[1].body, bindings: callable[1].bindings }).signature.id);
});

test("Program keeps the same ready adopted evidence, exact foreign signature site and contextual nominal findings", async () => {
  const { verificationContext, verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const ready = publicationFixture();
  const prepared = verificationTypes(ready.index, ready.context.resources);
  assert.equal(prepared.kind, "complete");
  const adopted = prepared.index;
  const retained = verificationContext(ready.context, ready.index.types, adopted.types);
  assert.equal(verificationContext(retained, adopted.types, adopted.types) === retained, true);
  const verified = verificationTypes(adopted, retained.resources);
  assert.equal(verified.kind, "complete");
  assert.equal(verified.index === adopted && verified.types === prepared.types, true);
  assert.deepEqual(product.verifyModuleBodies(adopted, ready.module, retained), { kind: "complete", violations: [] });
  const other = { ...ready.index, types: structuredClone(adopted.types) };
  assert.throws(() => verificationTypes(other, retained.resources), /another published type table/u);

  const broken = publicationFixture();
  broken.index.types.signatures[0] = { ...broken.index.types.signatures[0], id: 9 };
  const detail = [{ kind: "text", value: "signature-order" }, { kind: "text", value: "signature" },
    { kind: "number", value: 0 }, { kind: "text", value: "id" }];
  assert.deepEqual(product.verifyProgramIndex(broken.index, broken.context), { kind: "complete", violations: [
    { rule: "types-valid", site: { kind: "index" }, detail },
  ] });

  const nominal = publicationFixture();
  nominal.index.types.terms.push({ kind: "declared", definition: nominal.definition, facet: "instance", arguments: [], extent: null });
  nominal.context.facts.nominalOf = () => null;
  assert.deepEqual(product.verifyProgramIndex(nominal.index, nominal.context), { kind: "complete", violations: [
    { rule: "types-valid", site: { kind: "index" }, detail: [{ kind: "text", value: "nominal-definition" },
      { kind: "text", value: "definition" }] },
  ] });

  const meter = createInstantiationMeter({ ...ProgramWork.state(ready.context.resources).limits, maximumWork: 0 });
  const stopped = chargeWork(meter.account, 1);
  assert.equal(stopped === accountFailure(meter.account) && programTypeWork(meter).retain(1) === stopped, true);
  assert.equal(meter.created, 0);
});

test("ir-program api-body endpoints retain the exact canonical body identity", () => {
  const fixture = publicationFixture();
  const bindings = { kind: "parametric" };
  const other = moduleFixture("src/other.ts").bodyId;
  const endpoint = { declaration: fixture.definition, role: "api-body", signature: 0, body: fixture.bodyId };
  fixture.index.signatures = [{ kind: "api-body", definition: fixture.definition, ordinal: 0, signature: 0, body: other, bindings }];
  fixture.answers.set(encodeContextKey(["declarationOf", fixture.definition]), { scope: fixture.scope, parameterCount: 0, endpoints: [endpoint] });
  fixture.answers.set(encodeContextKey(["signatureIdOf", [fixture.definition, "api-body", 0, bindings]]), 0);
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [{ rule: "signature-endpoints-exact",
    site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: fixture.definition }, { kind: "text", value: "api-body" },
      { kind: "number", value: 0 }] }] }, "a real endpoint cannot be relabelled with another complete body identity");
});

test("ir-program an external instantiated signature retains both absent declaration and scope findings", () => {
  const fixture = publicationFixture();
  const definition = moduleFixture("src/external.ts").definition;
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  fixture.index.signatures = [{ kind: "advertised", definition, ordinal: 0, signature: 0, bindings }];
  fixture.answers.set(encodeContextKey(["signatureIdOf", [definition, "advertised", 0, bindings]]), null);
  fixture.answers.set(encodeContextKey(["bindingScopeOf", definition]), null);
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [
    { rule: "signature-endpoints-exact", site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: definition },
      { kind: "text", value: "advertised" }, { kind: "number", value: 0 }] },
    { rule: "bindings-complete", site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: definition }] },
  ] }, "null denotes an actually unavailable external declaration scope, not a forged canonical answer");
});

for (const change of ["control", "missing-scope"]) test(`ir-program instantiated constant ${change} retains the complete binding domain`, () => {
  const fixture = publicationFixture();
  const initializer = fixture.instance;
  fixture.index.constants = [{ reference: { initializer, context: "compile-time" }, value: { kind: "absence", type: 0 } }];
  let expected = [];
  let index = fixture.index;
  if (change === "missing-scope") {
    const external = moduleFixture("src/external.ts");
    const absent = { body: external.bodyId, bindings: initializer.bindings };
    index = { ...index, constants: [{ reference: { initializer: absent, context: "compile-time" }, value: { kind: "absence", type: 0 } }] };
    fixture.answers.set(encodeContextKey(["bodyOwner", absent.body]), external.definition);
    fixture.answers.set(encodeContextKey(["bindingScopeOf", external.definition]), null);
    expected = [{ rule: "bindings-complete", site: { kind: "body", instance: absent }, detail: [{ kind: "text", value: external.definition }] }];
  }
  completeProgramValue(product.verifyProgramIndex(index, fixture.context), { kind: "complete", violations: expected }, "the complete initializer retains its own real external scope availability");
});

for (const change of ["control", "missing-parameter", "wrong-bound-type", "wrong-self-owner"]) test(`ir-program instantiated signature ${change} preserves every forwarded binding finding`, () => {
  const fixture = moduleFixture();
  const parameter = typeParameterDeclaration(fixture.definition, 0);
  const initialization = { ...fixture.index.initialization, modules: [] };
  const index = { ...fixture.index, bodies: [], initialization,
    dependencyInventory: { operations: [], dependencies: [], components: [] } };
  const context = { ...fixture.context, initialization };
  const vector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const bindings = { kind: "instantiated", bindings: vector };
  const endpoint = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  index.signatures = [{ kind: endpoint.role, definition: fixture.definition, ordinal: 0, signature: 0, bindings }];
  const expected = [];
  const failure = (rule, child, field, value) => ({ rule, site: { kind: "signature", signature: 0 },
    detail: [{ kind: "text", value: child }, { kind: "text", value: field }, ...(value === undefined ? [] : [{ kind: "number", value }])] });
  if (change === "missing-parameter" || change === "wrong-bound-type") fixture.scope.classParameters = [parameter];
  if (change === "missing-parameter") expected.push(failure("bindings-complete", "binding-vector-complete", "length", 0));
  if (change === "wrong-bound-type") {
    vector.classBindings = [{ kind: "bound", parameter, type: 999 }];
    expected.push(failure("types-valid", "type-reference", "type", 999));
  }
  if (change === "wrong-self-owner") {
    fixture.scope.selfOwners = [fixture.definition];
    vector.selfBindings = [{ kind: "rigid", owner: moduleFixture("src/other.ts").definition }];
    expected.push(failure("types-valid", "self-owner", "owner"), failure("bindings-complete", "self-binding-order", "owner"));
  }
  fixture.answers.set(encodeContextKey(["declarationOf", fixture.definition]), { scope: fixture.scope, parameterCount: 0, endpoints: [endpoint] });
  fixture.answers.set(encodeContextKey(["signatureIdOf", [fixture.definition, endpoint.role, 0, bindings]]), 0);
  completeProgramValue(product.verifyProgramIndex(index, context), { kind: "complete", violations: expected },
    "the entire lower vector is independently specified, including multiple findings at one signature site");
});

for (const identity of [-1, 0.5, NaN, Infinity]) test(`ir-program publication rejects the complete invalid issued type ${String(identity)} at its actual owner`, () => {
  const fixture = moduleFixture();
  fixture.module.bodies[0].tir.completion = identity;
  assert.throws(() => projectFixtureProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  }), error => error instanceof TypeError && error.message === `Type publication has no issued type mapping for ${String(identity)}`);
});

for (const kind of ["tir", "mir", "facts", "summary", "metadata"]) {
  test(`ir-program exact borrowed ${kind} creates no artifact records beyond paid Types admission`, () => {
    const input = decodeFixtureJson(readFileSync(resolve(repository,
      `test/host-cases/ir-program/function/instantiate-bound-${kind}-created-zero.input.json`), "utf8"));
    const source = kind === "summary" ? input.index.summaries[0]
      : kind === "metadata" ? input.index.metadata[0] : kind === "facts" ? input.module.bodies[0].facts[0] : input.module.bodies[0][kind];
    const expectedArtifact = kind === "facts" ? { kind, facts: source }
      : kind === "summary" ? { kind, summary: source } : kind === "metadata" ? { kind, metadata: source } : { kind, body: source };
    assert.deepEqual(product.instantiate(input.index, input.module, input.artifact, input.bindings,
      { ...input.limits, maximumCreatedRecords: 0 }),
      { kind: "resource-limit", dimension: "created-records", maximum: 0 });
    const capacity = { ...input.limits, maximumWork: 10000, maximumCreatedRecords: 10000 };
    const seed = paidSeedOf(input.index.types, capacity);
    assert.equal(seed.maximumCreatedRecords > 0, true);
    const selectionWork = kind === "facts" ? 3 : kind === "metadata" ? 1 : 2;
    const limits = { ...input.limits,
      maximumWork: seed.maximumWork + selectionWork, maximumCreatedRecords: seed.maximumCreatedRecords };
    const actual = product.instantiate(input.index, input.module, input.artifact, input.bindings, limits);
    assert.equal(isDeepStrictEqual(actual, { kind: "instantiated", artifact: expectedArtifact, types: input.index.types }), true, `${kind} complete borrowed result`);
    const returned = actual.kind !== "instantiated" ? null : kind === "facts" ? actual.artifact.facts
      : kind === "summary" ? actual.artifact.summary : kind === "metadata" ? actual.artifact.metadata : actual.artifact.body;
    assert.equal(Object.is(returned, source), true, `${kind} actual artifact identity`);
    assert.equal(actual.kind === "instantiated" && actual.types !== input.index.types, true, `${kind} verified owned table`);
    assert.deepEqual(product.instantiate(input.index, input.module, input.artifact, input.bindings,
      { ...limits, maximumCreatedRecords: seed.maximumCreatedRecords - 1 }),
    { kind: "resource-limit", dimension: "created-records", maximum: seed.maximumCreatedRecords - 1 });
    assert.deepEqual(product.instantiate(input.index, input.module, input.artifact, input.bindings,
      { ...limits, maximumWork: limits.maximumWork - 1 }),
    { kind: "resource-limit", dimension: "work", maximum: limits.maximumWork - 1 });
  });
}

for (const [name, message] of [
  ["missing-type-image", "Type publication has no issued type mapping for 0"],
  ["missing-signature-image", "Type publication has no issued signature mapping for 0"],
  ["negative-zero-type", "Type publication has no issued type mapping for -0"],
  ["duplicate-parameter", "Duplicate requested parameter binding"],
  ["duplicate-self", "Duplicate requested self binding"],
  ["duplicate-template", "Duplicate parametric artifact"],
  ["duplicate-exact", "Duplicate instantiated artifact"],
  ["sparse-packages", "Inline array hole at ProgramIndex.packages[0]"],
  ["undefined-packages", "Inline array hole at ProgramIndex.packages[0]"],
  ["inline-record-cycle", "Inline cycle at ModuleBodies.bodies[0].tir.evidence[0].category.alternatives[0]"],
  ["inline-array-cycle", "Inline cycle at ModuleBodies.bodies[0].tir.evidence[0].category.alternatives[0].alternatives"],
  ["artifact-component-cycle", "Inline cycle in instantiation TypeComponent"],
]) {
  test(`ir-program genuine caller defect: ${name}`, () => {
    const fixture = name === "artifact-component-cycle" ? callerComponentCycle()
      : name === "duplicate-exact" ? publicationFixture() : moduleFixture();
    const program = { index: fixture.index, modules: [fixture.module] };
    const publication = { table: fixture.index.types, types: [0], signatures: [0] };
    const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    let invoke = () => projectFixtureProgram(program, publication);
    switch (name) {
      case "missing-type-image": publication.types = []; break;
      case "missing-signature-image": publication.signatures = []; break;
      case "negative-zero-type": fixture.module.bodies[0].tir.completion = tyId(-0); break;
      case "duplicate-parameter": {
        const binding = { kind: "rigid", parameter: typeParameterDeclaration(fixture.definition, 0) };
        bindings.classBindings = [binding, binding]; break;
      }
      case "duplicate-self": {
        const binding = { kind: "rigid", owner: fixture.definition };
        bindings.selfBindings = [binding, binding]; break;
      }
      case "duplicate-template": fixture.module.bodies.push(fixture.module.bodies[0]); break;
      case "duplicate-exact":
        fixture.module.bodies.push(fixture.selected); break;
      case "sparse-packages":
        fixture.index.packages = Array(1);
        invoke = () => product.printProgramIndex(fixture.index); break;
      case "undefined-packages":
        fixture.index.packages = [undefined];
        invoke = () => product.printProgramIndex(fixture.index); break;
      case "inline-record-cycle":
      case "inline-array-cycle": {
        const category = { kind: "choice", alternatives: [] };
        category.alternatives.push(name === "inline-record-cycle" ? category
          : { kind: "choice", alternatives: category.alternatives });
        fixture.module.bodies[0].tir.evidence = [{ type: 0,
          component: { kind: "body", value: { body: fixture.bodyId, node: 0 } },
          category, numeric: null, sum: null, nominal: null, pointer: null }];
        invoke = () => product.printModuleBodies(fixture.index, fixture.module); break;
      }
    }
    if (name.startsWith("duplicate-") || name === "artifact-component-cycle") invoke = () => product.instantiate(fixture.index, fixture.module,
      { kind: "tir", body: fixture.bodyId }, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 });
    assert.throws(invoke, error => error instanceof TypeError && error.message === message);
  });
}

test("ir-program canonicalization rejects the genuine recursive expression component", () => {
  for (const side of ["to", "from"]) {
    const fixture = callerComponentCycle();
    const step = fixture.module.tree.root.statements.nodes[0].node.expression.tsonic.narrowing.proof.steps[0];
    if (side === "to") Object.defineProperty(step, "from", { get() { assert.fail("FROM must remain unread when TO fails first"); } });
    else step.to = { root: step.to.root, path: [] };
    assert.throws(() => projectFixtureProgram({ index: fixture.index, modules: [fixture.module] }, {
      table: fixture.index.types, types: [0, 1], signatures: [0],
    }), error => error instanceof TypeError && error.message ===
      `Inline cycle at HostProgram.modules[0].StringLiteral.tsonic.narrowing.proof.steps[0].${side}.path[0].family.component`);
  }
});

test("ir-program rejects a foreign seed component cycle as the exact owning Types refusal", () => {
  const fixture = moduleFixture();
  const component = { root: { kind: "body", value: { body: fixture.bodyId, node: 0 } }, path: [] };
  component.path.push({ kind: "sum-arm", family: { origin: "authored", component, parameters: [], roles: [] }, index: 0 });
  fixture.index.types.terms.push({ kind: "projection", source: 0, projection: { kind: "component", component } });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  Object.defineProperty(fixture.module, "bodies", { get: () => assert.fail("a foreign inline cycle precedes artifact selection") });
  const result = product.instantiate(fixture.index, fixture.module, { kind: "tir", body: fixture.bodyId }, bindings,
    { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 });
  assert.equal(result.kind, "refused");
  assert.deepEqual(result.diagnostics.map(row => [row.code.rendered, row.arguments]), [["TSONIC_PROGRAM_TYPE_TABLE_INVALID", [
    { kind: "text", value: "type-reference" }, { kind: "text", value: "type" }, { kind: "number", value: 1 },
    { kind: "text", value: "$.projection.component.path[0].family.component" },
  ]]]);
});

test("ir-program finite shared expression components retain the complete canonical publication", () => {
  const fixture = callerComponentCycle();
  fixture.component.path = [];
  const expected = { index: fixture.index, modules: [fixture.module] };
  const actual = projectFixtureProgram(expected, {
    table: fixture.index.types, types: [0, 1], signatures: [0],
  });
  assert.equal(isDeepStrictEqual(actual, expected), true, "complete finite canonical publication");
  assert.equal(Object.is(actual.modules[0].tree.root, actual.modules[0].bodies[0].tir.root), true,
    "actual shared finite template root");
});

for (const field of ["maximumWork", "maximumCreatedRecords", "maximumBindingVectorsPerArtifact"]) {
  for (const maximum of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`ir-program Instantiate rejects malformed ${field}: ${String(maximum)}`, () => {
      const fixture = moduleFixture();
      const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
      const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000, [field]: maximum };
      assert.throws(() => product.instantiate(fixture.index, fixture.module,
        { kind: "tir", body: fixture.bodyId }, bindings, limits),
      error => error instanceof TypeError && error.message === `Invalid InstantiationLimits.${field}`);
    });
  }
}

test("ir-program finite shared expression components retain complete instantiation values", () => {
  const fixture = callerComponentCycle();
  fixture.component.path = [];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const body = structuredClone(fixture.module.bodies[0].tir);
  body.bindings = { kind: "instantiated", bindings };
  const expected = { kind: "instantiated", artifact: { kind: "tir", body }, types: fixture.index.types };
  const actual = product.instantiate(fixture.index, fixture.module,
    { kind: "tir", body: fixture.bodyId }, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 });
  assert.equal(isDeepStrictEqual(actual, expected), true, "complete finite expression component result");
});

const fieldFaults = new Map();
const valueFaults = new Map();
const closingFaults = new Map();
const punctuationFaults = new Map();
const recordFaults = new Map();
const extraFieldFaults = new Map();
const recordChoices = new Map([
  ...["ProgramIndex", "PackageRecord", "PackageExport", "ModuleRecord", "DefinitionNode", "HirModuleExport", "HirModuleBinding", "CheckerDiagnosticRef", "BodyRecord", "ConstantRecord",
    "Diagnostic", "RelatedDiagnostic", "DiagnosticFix", "TextEdit", "LocalRef", "NodeRef", "ItemNodeRef", "LibraryModuleIdentity",
    "CommentDirective", "HirAttribute", "BindingVector"].map(name => [name, [name]]),
  ...["advertised", "api-signature", "api-body"].map(name => [name, ["advertised", "api-signature", "api-body"]]),
  ...["ConstantReference", "EnumConstantReference"].map(name => [name, ["ConstantReference", "EnumConstantReference"]]),
  ...["parametric", "instantiated"].map(name => [name, ["parametric", "instantiated"]]),
  ...["bound", "rigid"].map(name => [name, ["bound", "rigid"]]),
  ...["host", "checker", "extension"].map(name => [name, ["host", "checker", "extension"]]),
  ...["lowering", "expansion"].map(name => [name, ["lowering", "expansion"]]),
]);
const delegatedRecords = new Set(["TypeTable", "BodyFacts", "BodyObservations", "MirBody", "Summary", "DependencyInventory", "data-layout", "memory-layout", "memory-field"]);
const declarationNamePhases = new Set(["TypedName", "TypedString", "TypedNumber", "TypedMember"]);
const alternateFirstFields = new Map([
  ...["TypedName", "TypedString", "TypedNumber", "TypedBigInt", "TypedKeyword", "TypedPrefix", "TypedMember", "TypedConstruction", "TypedInstantiation"]
    .map(name => [name, ["type", "role"]]),
  ["TypedBindingElement", ["declaration", "role"]],
]);
const authoredDocuments = [];
for (const path of casePaths.filter(path => path.includes("/function/"))) {
  const descriptor = JSON.parse(readFileSync(resolve(repository, path), "utf8"));
  const input = decodeFixtureJson(readFileSync(resolve(repository, descriptor.input), "utf8"));
  const expected = decodeFixtureJson(readFileSync(resolve(repository, descriptor.expected), "utf8"));
  const documents = [expected.value?.printed, expected.value?.printedIndex, ...(expected.value?.printedModules ?? [])]
    .filter(value => typeof value === "string");
  for (const text of documents) authoredDocuments.push({ text, index: expected.value?.program?.index ?? input.index });
}
const signatureFixture = moduleFixture();

test("Program binding facts retain the same complete original cause relation through the required schema", () => {
  const fixture = moduleFixture();
  const causes = [...capturedCauses(fixture.module.module, fixture.definition, fixture.bodyId), ...[
    { kind: "execution-result", execution: "opaque provided count 1" },
    { kind: "execution-source-node", execution: "opaque provided count 2", node: { body: fixture.bodyId, node: 0 } },
  ].map(position => ({ kind: "unit", unit: { request: { query: "bodyFactsOf", key: "first" }, position } }))];
  const target = { kind: "unavailable", reason: "checker-error", causes };
  const index = { ...fixture.index, modules: [{ ...fixture.index.modules[0], bindings: [
    { occurrence: { kind: "item", value: { owner: fixture.definition, node: 0 } }, target },
  ] }] };
  const text = product.printProgramIndex(index);
  const parsed = product.parseProgramIndex(text);
  assert.equal(parsed.kind, "parsed", parsed.kind === "parsed" ? undefined : JSON.stringify(parsed));
  assert.deepEqual(parsed.value.modules[0].bindings[0].target, target);
  assert.equal(product.parseProgramIndex(text.replace("causes=[diagnostic(", "removedCauses=[diagnostic(")).kind, "invalid-text");
  assert.equal(product.parseProgramIndex(text.replace("execution-source-node(execution=", "execution-source-node(removed=")).kind, "invalid-text");
  assert.equal(product.parseProgramIndex(text.replace('execution-source-node(execution="opaque provided count 2", node=NodeRef(',
    'execution-source-node(execution="opaque provided count 2", node=ItemNodeRef(')).kind, "invalid-text");
  const group = causes.find(cause => cause.kind === "unit" && cause.unit.position.kind === "inference-variable").unit.position.group;
  for (const malformed of ["7", JSON.stringify("not-a-group")])
    assert.equal(product.parseProgramIndex(text.replace(`group=${JSON.stringify(group)}`, `group=${malformed}`)).kind, "invalid-text");
});
const emptyWireIndex = { schema: 1, nativeFactsKey: signatureFixture.index.nativeFactsKey, rootPackage: signatureFixture.index.rootPackage, packages: [], modules: [],
  types: { terms: [], signatures: [] }, signatures: [], bodies: [], dependencyInventory: { operations: [], dependencies: [], components: [] }, metadata: [], summaries: [], constants: [], diagnostics: [],
  initialization: { entry: signatureFixture.module.module, external: [], modules: [], entries: [] } };
const emptyInitializationWire = `ProgramInitialization(entry=mod:${JSON.stringify(emptyWireIndex.initialization.entry)}, external=[], modules=[], entries=[])`;
for (const kind of ["advertised", "api-signature", "api-body"]) for (const body of kind === "api-body" ? [null, signatureFixture.bodyId] : [undefined]) {
  const record = { definition: signatureFixture.definition, bindings: { kind: "parametric" }, ordinal: 0, signature: 0, kind,
    ...(body === undefined ? {} : { body }) };
  const text = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[${kind}(definition=def:${JSON.stringify(record.definition)}, bindings=parametric(), ordinal=0, signature=sig:0${body === undefined ? "" : `, body=${body === null ? "null" : `body:${JSON.stringify(body)}`}`})], bodies=[], dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[]), metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)}, initialization=${emptyInitializationWire})`;
  const index = { ...emptyWireIndex, signatures: [record] };
  authoredDocuments.push({ text, index });
  test(`ir-program independent ${kind}/${String(body)} complete literal retains every signature-record field`, () => {
    completeProgramValue(product.parseProgramIndex(text), { kind: "parsed", value: index }, "complete independent signature-record grammar");
    assert.equal(product.printProgramIndex(index), text + "\n", "one canonical document and exactly one final newline");
  });
  for (const prefix of ["pkg", "def", ...(body === null || body === undefined ? [] : ["body"])]) test(`ir-program independent ${kind}/${String(body)} rejects the complete malformed ${prefix} identity at its actual first byte`, () => {
    const offset = text.indexOf(`${prefix}:"`) + prefix.length + 2;
    const changed = text.slice(0, offset) + "X" + text.slice(offset + 1);
    completeProgramValue(product.parseProgramIndex(changed), { kind: "invalid-text", offset, line: 1, column: offset + 1,
      expected: [`${prefix} identity`], found: "X" }, "public identity decoding owns the complete malformed identity result");
  });
  test(`ir-program independent ${kind}/${String(body)} rejects trailing text after the whole index`, () => {
    completeProgramValue(product.parseProgramIndex(text + " @"), { kind: "invalid-text", offset: text.length + 1,
      line: 1, column: text.length + 2, expected: ["end of input"], found: "@" }, "sole root EOF authority");
  });
}
{
  const other = moduleFixture("src/other.ts").definition;
  const parameter = index => typeParameterDeclaration(signatureFixture.definition, index);
  const vector = { classBindings: [{ kind: "rigid", parameter: parameter(0) }, { kind: "bound", parameter: parameter(1), type: 0 }],
    methodBindings: [], capturedBindings: [], selfBindings: [{ kind: "rigid", owner: signatureFixture.definition }, { kind: "bound", owner: other, type: 0 }] };
  const definition = JSON.stringify(signatureFixture.definition);
  const bindings = `instantiated(bindings=BindingVector(classBindings=[rigid(parameter=def:${JSON.stringify(parameter(0))}), bound(parameter=def:${JSON.stringify(parameter(1))}, type=t:0)], methodBindings=[], capturedBindings=[], selfBindings=[rigid(owner=def:${definition}), bound(owner=def:${JSON.stringify(other)}, type=t:0)]))`;
  const text = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[advertised(definition=def:${definition}, bindings=${bindings}, ordinal=0, signature=sig:0)], bodies=[], dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[]), metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)}, initialization=${emptyInitializationWire})`;
  const index = { ...emptyWireIndex, signatures: [{ kind: "advertised", definition: signatureFixture.definition,
    bindings: { kind: "instantiated", bindings: vector }, ordinal: 0, signature: 0 }] };
  authoredDocuments.push({ text, index });
  test("ir-program independent complete binding records preserve both rigid and bound owner-qualified forms", () => {
    completeProgramValue(product.parseProgramIndex(text), { kind: "parsed", value: index }, "the complete structural binding grammar does not pretend that this deliberately unverified index is semantically valid");
    assert.equal(product.printProgramIndex(index), text + "\n");
    const retired = text.replace(`parameter=def:${JSON.stringify(parameter(0))}`,
      `parameter=TypeParameterIdentity(owner=def:${definition}, index=0)`);
    assert.equal(product.parseProgramIndex(retired).kind, "invalid-text");
  });
}
{
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.input.json"), "utf8"));
  const prior = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.expected.json"), "utf8")).value.printed;
  const node = input.module.tree.root.statements.nodes[0].node.expression;
  const body = signatureFixture.bodyId;
  const definition = signatureFixture.definition;
  const ref = { kind: "item", value: { owner: definition, node: 2 } };
  const bodyRef = { body, node: 2 };
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  const captured = Object.fromEntries(["provider", "markers", "pointerType", "pointerOperation", "fieldBinding", "recordBinding", "attribute", "safety", "argumentPassing", "flowState"].map(name => [name, unavailable]));
  captured.pointerOperation = { kind: "available", value: { family: "raw-memory", operation: "raw-to-address-integer", raw: ref,
    integer: { width: 32, runtimeBase: "number", signedness: "unsigned" }, dataLayout: ref } };
  const evidence = { type: 0, component: { kind: "body", value: bodyRef }, category: { kind: "known", category: "number" },
    numeric: null, sum: null, nominal: null, pointer: null };
  const invocation = { rule: "core", input: { context: { occurrence: bodyRef, origin: node.origin, bindings: empty },
    captured, declaration: definition, operands: [], result: evidence, permissionScope: bodyRef } };
  const parameterless = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
  const sourceRef = `item(value=ItemNodeRef(owner=def:${JSON.stringify(definition)}, node=n:2))`;
  const nodeRef = `NodeRef(body=body:${JSON.stringify(body)}, node=n:2)`;
  const origin = `Origin(module=mod:${JSON.stringify(node.origin.module)}, start=0, length=0, derived=[])`;
  const pointer = `available(value=HirPointerOperationCapture(family="raw-memory", operation="raw-to-address-integer", raw=${sourceRef}, integer=HirAddressIntegerCapture(width=32, runtimeBase="number", signedness="unsigned"), dataLayout=${sourceRef}))`;
  const core = `HirCoreCapture(provider=unavailable(reason="not-provided", causes=[]), markers=unavailable(reason="not-provided", causes=[]), pointerType=unavailable(reason="not-provided", causes=[]), pointerOperation=${pointer}, fieldBinding=unavailable(reason="not-provided", causes=[]), recordBinding=unavailable(reason="not-provided", causes=[]), attribute=unavailable(reason="not-provided", causes=[]), safety=unavailable(reason="not-provided", causes=[]), argumentPassing=unavailable(reason="not-provided", causes=[]), flowState=unavailable(reason="not-provided", causes=[]))`;
  const result = `TypeEvidence(type=t:0, component=body(value=${nodeRef}), category=known(category="number"), numeric=null, sum=null, nominal=null, pointer=null)`;
  const decision = `DeferredDecision(invocation=DeferredInvocation(rule="core", input=CoreInput(context=RuleContext(occurrence=${nodeRef}, origin=${origin}, bindings=${parameterless}), captured=${core}, declaration=def:${JSON.stringify(definition)}, operands=[], result=${result}, permissionScope=${nodeRef})), result=t:0)`;
  const phase = `TypedNumber(type=t:0, convertedType=t:0, conversion=deferred(deferred=${decision}), narrowing=null, evidenceIndex=null, demand=always(), role="value", value=ExactRational(numerator=1n, denominator=1n, negativeZero=false))`;
  const original = `TypedNumber(role="declaration-name", declaration=definition(definition=def:${JSON.stringify(node.tsonic.declaration.definition)}))`;
  assert.equal(prior.includes(original), true, "the independent base literal contains exactly the preauthored phase being replaced");
  const text = prior.replace(original, phase);
  node.tsonic = { role: "value", type: 0, convertedType: 0, conversion: { kind: "deferred", deferred: { invocation, result: 0 } },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" }, value: { numerator: 1n, denominator: 1n, negativeZero: false } };
  authoredDocuments.push({ text, index: input.index });
  test("ir-program independently authored complete core capture and qualified item reference retain their whole values", () => {
    completeProgramValue(product.parseModuleBodies(input.index, text), { kind: "parsed", value: input.module }, "all fields follow the hand-authored shared-record wire, not printer output");
    assert.equal(product.printModuleBodies(input.index, input.module), text);
    const offset = text.indexOf("width=32") + "width=".length;
    completeTextFault(input.index, text.slice(0, offset) + "7" + text.slice(offset + 2), offset, ["32", "64"], false);
  });
}
{
  const definition = signatureFixture.definition;
  const module = signatureFixture.module.module;
  const owner = `def:${JSON.stringify(definition)}`;
  const moduleText = `mod:${JSON.stringify(module)}`;
  const item = node => `item(value=ItemNodeRef(owner=${owner}, node=n:${node}))`;
  const body = node => `body(value=NodeRef(body=body:${JSON.stringify(signatureFixture.bodyId)}, node=n:${node}))`;
  const occurrence = node => node === 1 ? { kind: "body", value: { body: signatureFixture.bodyId, node } }
    : { kind: "item", value: { owner: definition, node } };
  const values = [
    [{ kind: "available", value: { kind: "declarations", definitions: [definition] } }, `available(value=declarations(definitions=[${owner}]))`],
    [{ kind: "available", value: { kind: "binding", occurrence: occurrence(0) } }, `available(value=binding(occurrence=${item(0)}))`],
    [{ kind: "available", value: { kind: "module", module } }, `available(value=module(module=${moduleText}))`],
    [{ kind: "available", value: { kind: "member", through: { kind: "binding", occurrence: occurrence(0) },
      key: { kind: "available", value: { kind: "text", value: "field" } }, origins: { kind: "available", value: [{ kind: "declared", declaration: definition }] } } },
      `available(value=member(through=binding(occurrence=${item(0)}), key=available(value=text(value="field")), origins=available(value=[declared(declaration=${owner})])))`],
    [{ kind: "available", value: { kind: "unresolved", diagnostics: [{ module, index: 0 }] } },
      `available(value=unresolved(diagnostics=[CheckerDiagnosticRef(module=${moduleText}, index=0)]))`],
    [{ kind: "unavailable", reason: "incomplete-association", causes: [] }, 'unavailable(reason="incomplete-association", causes=[])'],
  ];
  const bindings = values.map(([target], node) => ({ occurrence: occurrence(node), target }));
  const exports = [{ name: "direct", typeOnlyStar: occurrence(1), target: { kind: "declarations", definitions: [definition] } },
    { name: "alias", typeOnlyStar: null, target: { kind: "binding", occurrence: occurrence(0) } }];
  const moduleRecord = `ModuleRecord(module=${moduleText}, package=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, items=[DefinitionNode(definition=${owner}, node=n:0)], exports=[HirModuleExport(name="direct", target=declarations(definitions=[${owner}]), typeOnlyStar=${body(1)}), HirModuleExport(name="alias", target=binding(occurrence=${item(0)}), typeOnlyStar=null)], bindings=[${values.map(([, target], node) => `HirModuleBinding(occurrence=${node === 1 ? body(node) : item(node)}, target=${target})`).join(", ")}], checkerDiagnostics=[])`;
  const text = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[${moduleRecord}], types=TypeTable(terms=[], signatures=[]), signatures=[], bodies=[], dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[]), metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)}, initialization=${emptyInitializationWire})`;
  const index = { ...emptyWireIndex, modules: [{ module, package: emptyWireIndex.rootPackage, items: [{ definition, node: 0 }], exports, bindings, checkerDiagnostics: [] }] };
  authoredDocuments.push({ text, index });
  test("ir-program independently authored binding grammar retains every closed target without claiming semantic verification", () => {
    completeProgramValue(product.parseProgramIndex(text), { kind: "parsed", value: index }, "the complete independently authored structural binding grammar");
    assert.equal(product.printProgramIndex(index), text + "\n");
    for (const [needle, choices] of [["target=declarations(", ["declarations", "binding"]],
      ["value=declarations(", ["declarations", "binding", "module", "member", "unresolved"]]]) {
      const offset = text.indexOf(needle) + needle.indexOf("=") + 1;
      const changed = text.slice(0, offset) + "wrong" + text.slice(offset + "declarations".length);
      completeTextFault(index, changed, offset, choices);
    }
  });
}

{
  const path = "test/host-cases/ir-program/function/phase-name-value";
  const input = decodeFixtureJson(readFileSync(resolve(repository, `${path}.input.json`), "utf8"));
  const prior = decodeFixtureJson(readFileSync(resolve(repository, `${path}.expected.json`), "utf8")).value.printed;
  const node = input.module.tree.root.statements.nodes[0].node.expression;
  const body = input.module.tree.root.tsonic.template.body;
  const binding = { kind: "body", value: { body, node: node.id } };
  const start = prior.lastIndexOf("tsonic=TypedName(");
  const end = prior.indexOf("\n", start);
  const phase = `tsonic=TypedName(role="binding-name", binding=body(value=NodeRef(body=body:${JSON.stringify(body)}, node=n:${node.id}))))`;
  const text = prior.slice(0, start) + phase + prior.slice(end);
  node.tsonic = { role: "binding-name", binding };
  authoredDocuments.push({ text, index: input.index });
  test("ir-program independently authored binding-name wire retains its qualified occurrence without a fake definition", () => {
    completeProgramValue(product.parseModuleBodies(input.index, text), { kind: "parsed", value: input.module }, "structural binding-name transport, not semantic source verification");
    assert.equal(product.printModuleBodies(input.index, input.module), text);
  });
}

for (const { text, index } of authoredDocuments) {
    const records = [];
    const tokens = /"(?:[^"\\]|\\.)*"|([A-Za-z_$][A-Za-z0-9_$-]*)([=(])|([()[\]])/g;
    for (const token of text.matchAll(tokens)) {
      if (token[2] === "(") {
        if (!records.some(record => delegatedRecords.has(record.name)) && !delegatedRecords.has(token[1])) {
          const firstField = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)=/.exec(text.slice(token.index + token[0].length))?.[1] ?? "";
          const key = `${records.at(-1)?.name}/${token[1]}:${firstField}:open`;
          if (!punctuationFaults.has(key)) punctuationFaults.set(key, { text, index, offset: token.index + token[1].length, expectedItems: ["("] });
          const choices = recordChoices.get(token[1]) ?? (["body", "item"].includes(token[1]) && /^\s*value=/.test(text.slice(token.index + token[0].length))
            ? ["body", "item"] : undefined);
          if (choices !== undefined && !recordFaults.has(key)) recordFaults.set(key, { text, index, offset: token.index, choices });
        }
        records.push({ name: token[1], fields: 0, firstField: null, open: token.index + token[0].length });
      }
      else if (token[2] === "=") {
        const record = records.at(-1);
        const first = record.fields++ === 0;
        if (first) record.firstField = token[1];
        if (record.name === "PragmaArguments") continue;
        const key = `${records.slice(-2).map(value => value.name).join("/")}:${record.firstField}.${token[1]}`;
        if (!records.some(record => delegatedRecords.has(record.name))) {
          if (!punctuationFaults.has(`${key}:equals`)) punctuationFaults.set(`${key}:equals`, {
            text, index, offset: token.index + token[1].length, expectedItems: ["="],
          });
          let comma = token.index - 1;
          while (/\s/.test(text[comma])) comma -= 1;
          if (text[comma] === "," && !punctuationFaults.has(`${key}:comma`)) punctuationFaults.set(`${key}:comma`, {
            text, index, offset: comma, expectedItems: [","],
          });
        }
        const fields = first && alternateFirstFields.has(record.name) ? alternateFirstFields.get(record.name) : [token[1]];
        if (!records.some(record => delegatedRecords.has(record.name)) && !fieldFaults.has(key)) fieldFaults.set(key, { index, text, offset: token.index, field: token[1], fields });
        if (!records.some(record => delegatedRecords.has(record.name))) {
          let offset = token.index + token[1].length + 1;
          while (/\s/.test(text[offset])) offset += 1;
          const tail = text.slice(offset);
          let expectedItems;
          let replacement = "@";
          if (tail.startsWith("[")) expectedItems = ["["];
          else if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?(?=[\s,)\]])/.test(tail)
            || /^(?:NaN|\+Infinity|-Infinity)(?=[\s,)\]])/.test(tail)) expectedItems = ["number"];
          else if (/^-?(?:0|[1-9][0-9]*)n(?=[\s,)\]])/.test(tail)) expectedItems = ["bigint"];
          else if (/^(?:true|false)(?=[\s,)\]])/.test(tail)) expectedItems = ["true", "false"];
          else if (tail.startsWith("null") && (token[1] === "tsonic" || record.name === "DefaultClause" && token[1] === "expression")) expectedItems = ["null"];
          else if (/^[a-z]+:/.test(tail)) expectedItems = [/^[a-z]+:/.exec(tail)[0]];
          else if (/^[A-Z][A-Za-z0-9_]*\(/.test(tail)) {
            const label = /^[A-Z][A-Za-z0-9_]*/.exec(tail)[0];
            const nameable = token[1] === "tsonic" && (declarationNamePhases.has(label)
              || (record.name === "ParenthesizedExpression" || record.name === "NonNullExpression") && label === "TypedValue"
              || record.name === "CallExpression" && label === "TypedApplication");
            expectedItems = record.name === "CheckJsDirective" && token[1] === "range"
              ? ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]
              : record.name === "ConstantRecord" && token[1] === "reference" ? ["ConstantReference", "EnumConstantReference"]
                : nameable ? [label, "DeclarationNameExpression"] : [label];
            replacement = tail[0] === "Z" ? "Y" : "Z";
          }
          if (expectedItems !== undefined && !valueFaults.has(key)) valueFaults.set(key, {
            index, isIndex: text.startsWith("ProgramIndex("), text, offset, expectedItems, replacement,
          });
          if (tail.startsWith('"') && !valueFaults.has(`${key}:escape`)) valueFaults.set(`${key}:escape`, {
            index, isIndex: text.startsWith("ProgramIndex("), text, offset: offset + 1, expectedItems: ["JSON escape"], replacement: "\\q", insert: true,
          });
          const identity = /^[a-z]+:\s*"/.exec(tail);
          if (identity !== null && !valueFaults.has(`${key}:identity-string`)) valueFaults.set(`${key}:identity-string`, {
            index, text, offset: offset + identity[0].length - 1, expectedItems: ["string"], replacement: "@",
          });
          if (identity !== null && !valueFaults.has(`${key}:identity-escape`)) valueFaults.set(`${key}:identity-escape`, {
            index, text, offset: offset + identity[0].length, expectedItems: ["JSON escape"], replacement: "\\q", insert: true,
          });
        }
      } else if (token[3] === "[") records.push({ name: "array", fields: 0 });
      else if (token[3] === ")" || token[3] === "]") {
        if (token[3] === ")" && !records.some(record => delegatedRecords.has(record.name))) {
          const record = records.at(-1);
          const key = `${records.slice(-2).map(record => record.name).join("/")}:${record.firstField ?? ""}`;
          const expectedItems = record.name === "PragmaArguments" ? [text.slice(record.open, token.index).trim().length === 0 ? "pragma key" : ","]
            : record.name === "CheckedDeclarations" ? ["newline"] : record.name === "TypedDeclarations" ? ["n:"] : [")"];
          if (!closingFaults.has(key)) closingFaults.set(key, { index, isIndex: text.startsWith("ProgramIndex("), text, offset: token.index, expectedItems });
          if (record.name !== "PragmaArguments" && record.firstField !== null && !extraFieldFaults.has(key))
            extraFieldFaults.set(key, { index, text, offset: token.index, firstField: record.firstField });
        }
        records.pop();
        if (records.at(-1)?.name === "array" && !records.some(record => delegatedRecords.has(record.name))) {
          let offset = token.index + 1;
          while (/\s/.test(text[offset])) offset += 1;
          const key = `${records.slice(-2).map(record => record.name).join("/")}:element-comma`;
          if (text[offset] === "," && !punctuationFaults.has(key)) punctuationFaults.set(key, { text, index, offset, expectedItems: [","] });
        }
      }
    }
}

function completeTextFault(index, text, offset, expected, isIndex = true) {
  const lines = text.slice(0, offset).split(/\r\n|\r|\n/);
  completeProgramValue(isIndex ? product.parseProgramIndex(text) : product.parseModuleBodies(index, text), {
    kind: "invalid-text", offset, line: lines.length, column: lines.at(-1).length + 1, expected, found: text[offset] ?? null,
  }, "the entire first-fault result follows the independently authored literal grammar and source coordinates");
}

test("ir-program retains exact first faults from the delegated dependency codec at their whole-document coordinates", () => {
  const { value } = decodeFixtureJson(readFileSync(resolve(repository,
    "test/host-cases/ir-program/function/publication-pair-forward-issue-order.expected.json"), "utf8"));
  const { printedIndex: text, program: { index } } = value;
  const inventory = text.indexOf("dependencyInventory=DependencyInventory(") + "dependencyInventory=".length;
  assert.equal(text.startsWith("DependencyInventory(", inventory), true);
  for (const [offset, expected] of [
    [inventory, ["DependencyInventory"]],
    [text.indexOf("operations=[", inventory) + "operations=".length, ["array"]],
    [text.indexOf("members=[", inventory) + "members=".length, ["array"]],
  ]) {
    assert.equal(offset >= inventory, true);
    completeTextFault(index, text.slice(0, offset) + "@" + text.slice(offset + 1), offset, expected);
  }
});

for (const [name, { index, text, offset, field, fields }] of fieldFaults) test(`ir-program authored ${name} first-field deviation retains its complete original document location`, () => {
  const found = field[0] === "z" ? "y" : "z";
  const changed = text.slice(0, offset) + found + text.slice(offset + 1);
  completeTextFault(index, changed, offset, fields, text.startsWith("ProgramIndex("));
});

test("ir-program refuses an unknown value and a missing last field of each check, location, activation, execution and failure field at its own position", () => {
  for (const [name, slot, unknown, values] of [
    ["s2-11-conversion-check-required-abort", 'check=required(failure="abort")', "proved()", ["none", "required"]],
    ["s2-11-member-data-required-unwind-by-reference", 'location=data(check=required(failure="unwind"), receiver="by-reference")', "proved()", ["data", "accessor"]],
    ["s2-11-application-activation-when-first-driven", 'activation="when-first-driven"', '"proved"', ['"at-creation"', '"when-first-driven"']],
    ["s2-11-operation-invocation-writes-abort", 'execution=invocation(writesStorage=true, failure="abort")', "proved()", ["pure", "invocation"]],
    ["s2-11-narrowing-failure-abort", 'failure="abort"', '"proved"', ['"unwind"', '"abort"']],
  ]) {
    const input = decodeFixtureJson(readFileSync(resolve(repository, `test/host-cases/ir-program/function/${name}.input.json`), "utf8"));
    const text = product.printModuleBodies(input.index, input.module);
    const start = text.indexOf(slot);
    assert.equal(start >= 0 && text.indexOf(slot, start + 1) === -1, true, `${name} states the field once`);
    assert.equal(text.slice(start - 2, start) === ", " && text[start + slot.length] === ")", true, `${name}: the field is the last of its record`);
    const value = start + slot.indexOf("=") + 1;
    completeTextFault(input.index, text.slice(0, value) + unknown + text.slice(start + slot.length), value, values, false);
    completeTextFault(input.index, text.slice(0, start - 2) + text.slice(start + slot.length), start - 2, [","], false);
  }
  const location = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/s2-11-member-data-required-unwind-by-reference.input.json"), "utf8"));
  const text = product.printModuleBodies(location.index, location.module);
  const data = 'data(check=required(failure="unwind"), receiver="by-reference")';
  for (const [changed, at, expected] of [
    ['data(receiver="by-reference", check=required(failure="unwind"))', "data(".length, ["check"]],
    ['data(check=required(failure="none"), receiver="by-reference")', 'data(check=required(failure='.length, ['"unwind"', '"abort"']],
    ['data(check=required(failure="unwind"), receiver="proved")', 'data(check=required(failure="unwind"), receiver='.length, ['"in-place"', '"by-reference"']],
  ]) completeTextFault(location.index, text.replace(data, changed), text.indexOf(data) + at, expected, false);
});

test("ir-program refuses the earlier capture forms at their own position: a typed closure's list, bare logical captures, saved evidence without its incoming storage, a resolved callee's list", () => {
  const load = name => decodeFixtureJson(readFileSync(resolve(repository, `test/host-cases/ir-program/function/${name}.input.json`), "utf8"));
  const decided = load("s2-9-closure-capture-value");
  const decidedText = product.printModuleBodies(decided.index, decided.module);
  const row = decidedText.match(/CaptureRow\(local=LocalRef\([^)]*\), capture="captured-value"\)/u)[0];
  const closureAt = decidedText.indexOf(", closure=decided(");
  assert.equal(closureAt > 0 && decidedText.indexOf(", closure=decided(", closureAt + 1) === -1, true, "one decided closure");
  const local = row.slice("CaptureRow(local=".length, row.indexOf("), capture=") + 1);
  // the field name is read against the expected one character by character: the fault is at the first that differs
  completeTextFault(decided.index, `${decidedText.slice(0, closureAt)}, captures=[${local}]${decidedText.slice(closureAt)}`, closureAt + 3, ["closure"], false);
  const bare = decidedText.replace(row, '"captured-value"');
  completeTextFault(decided.index, bare, bare.indexOf('"captured-value"'), ["CaptureRow"], false);
  const deferredCase = load("s2-9-closure-deferred");
  const deferredText = product.printModuleBodies(deferredCase.index, deferredCase.module);
  const incoming = ", incoming=binding()";
  const incomingAt = deferredText.indexOf(incoming);
  assert.equal(incomingAt > 0, true, "the saved evidence states its incoming storage");
  completeTextFault(deferredCase.index, deferredText.slice(0, incomingAt) + deferredText.slice(incomingAt + incoming.length), incomingAt, [","], false);
  const callee = /ResolvedCallee\(decision=/u;
  const calleeInput = load("s2-11-application-activation-at-creation");
  const calleeText = product.printModuleBodies(calleeInput.index, calleeInput.module);
  assert.equal(callee.test(calleeText), true, "the case prints a resolved callee");
  const start = calleeText.search(callee);
  let depth = 0; let end = start;
  for (; end < calleeText.length; end += 1) { if (calleeText[end] === "(") depth += 1; if (calleeText[end] === ")") { depth -= 1; if (depth === 0) break; } }
  completeTextFault(calleeInput.index, `${calleeText.slice(0, end)}, captures=[]${calleeText.slice(end)}`, end + 2, ["end of record"], false);
});

test("ir-program carries every incoming storage of a saved captured binding and every capture of a body row through its text", () => {
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/s2-9-closure-deferred.input.json"), "utf8"));
  const sources = [{ kind: "binding" },
    ...["by-value", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut", "move"].map(passing => ({ kind: "parameter", passing })),
    { kind: "capture", capture: "captured-value" }, { kind: "capture", capture: "captured-location" }];
  const pending = [input.module];
  let saved = null;
  for (let value = pending.pop(); value !== undefined && saved === null; value = pending.pop()) {
    if (value === null || typeof value !== "object") continue;
    if (!Array.isArray(value) && value.rule === "closure" && value.input !== undefined) saved = value.input;
    else for (const child of Object.values(value)) pending.push(child);
  }
  assert.notEqual(saved, null, "the case saves the closure rule's input");
  const [first] = saved.captures;
  saved.captures = sources.map(incoming => ({ ...first, incoming }));
  const text = product.printModuleBodies(input.index, input.module);
  for (const source of sources) assert.equal(text.includes(source.kind === "binding" ? "incoming=binding()" : source.kind === "parameter"
    ? `incoming=parameter(passing="${source.passing}")` : `incoming=capture(capture="${source.capture}")`), true, JSON.stringify(source));
  completeProgramValue(product.parseModuleBodies(input.index, text), { kind: "parsed", value: input.module }, "every incoming storage parses back");
  const fixture = moduleFixture();
  const body = fixture.module.bodies[0].tir;
  const local = { body: fixture.bodyId, local: 0 };
  body.captures = [{ local, capture: null }, { local, capture: "captured-value" }, { local, capture: "captured-location" }];
  const rows = product.printModuleBodies(fixture.index, fixture.module);
  assert.equal(rows.includes("capture=null)") && rows.includes('capture="captured-value")') && rows.includes('capture="captured-location")'), true);
  completeProgramValue(product.parseModuleBodies(fixture.index, rows), { kind: "parsed", value: fixture.module }, "a body row's capture, null included, parses back");
});

test("ir-program all native source newline forms retain the same complete first-fault coordinates", () => {
  for (const newline of ["\n", "\r", "\r\n"]) {
    const text = `${newline}ProgramIndex(schema=@)`;
    completeProgramValue(product.parseProgramIndex(text), { kind: "invalid-text", offset: newline.length + 20,
      line: 2, column: 21, expected: ["number"], found: "@" }, "CR, LF and CRLF each denote one source line break");
  }
});

for (const [name, fault] of valueFaults) test(`ir-program independently authored ${name} value fault retains its complete first-fault result`, () => {
  const { index, text, offset, expectedItems, replacement, insert } = fault;
  const changed = text.slice(0, offset) + replacement + text.slice(offset + (insert ? 0 : 1));
  completeTextFault(index, changed, offset, expectedItems, text.startsWith("ProgramIndex("));
});

for (const [name, { index, text, offset, expectedItems }] of closingFaults) test(`ir-program independently authored ${name} record must close at its exact whole-document coordinate`, () => {
  const changed = text.slice(0, offset) + " @" + text.slice(offset + 1);
  completeTextFault(index, changed, offset + 1, expectedItems, text.startsWith("ProgramIndex("));
});

for (const [name, { index, text, offset, expectedItems }] of punctuationFaults) test(`ir-program authored ${name} punctuation fault preserves the exact complete parser result`, () => {
  const changed = text.slice(0, offset) + " @" + text.slice(offset + 1);
  completeTextFault(index, changed, offset + 1, expectedItems, text.startsWith("ProgramIndex("));
});

for (const [name, { index, text, offset, choices }] of recordFaults) test(`ir-program independently authored ${name} rejects the wrong complete record kind`, () => {
  completeTextFault(index, text.slice(0, offset) + "Z" + text.slice(offset + 1), offset, choices, text.startsWith("ProgramIndex("));
});

for (const [name, { index, text, offset, firstField }] of extraFieldFaults)
  test(`ir-program independently authored ${name} rejects both duplicate and unknown fields after its complete payload`, () => {
    for (const [field, expected] of [[firstField, "unique record field"], ["@", "end of record"], ["unexpectedField", "end of record"]])
      completeTextFault(index, text.slice(0, offset) + `, ${field}=null` + text.slice(offset), offset + 2, [expected], text.startsWith("ProgramIndex("));
  });

test("ir-program independent complete escaped package strings retain every decoded UTF16 code unit", () => {
  const pkg = JSON.stringify(emptyWireIndex.rootPackage);
  const text = `ProgramIndex("sch\\u0065ma"=1, rootPackage=pkg:${pkg}, packages=[PackageRecord(id=pkg:${pkg}, name="quote\\\"\\/slash\\\\\\b\\f\\n\\r\\t\\u00AF\\uD800", packageRoot="/program", sourceRoot="/program/src", dependencies=[], exports=[])], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[], bodies=[], dependencyInventory=DependencyInventory(operations=[], dependencies=[], components=[]), metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)}, initialization=${emptyInitializationWire})`;
  const index = { ...emptyWireIndex, packages: [{ id: emptyWireIndex.rootPackage, name: 'quote"/slash\\\b\f\n\r\t\u00af\ud800',
    packageRoot: "/program", sourceRoot: "/program/src", dependencies: [], exports: [] }] };
  completeProgramValue(product.parseProgramIndex(text), { kind: "parsed", value: index }, "complete escapes include uppercase hexadecimal, quoted field spelling and a lone UTF16 surrogate");
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(index)), { kind: "parsed", value: index }, "the one canonical printer preserves the complete independently authored value");
});

test("ir-program root EOF and empty decoded identities retain their complete original failure", () => {
  for (const [text, offset, expected] of [["", 0, ["ProgramIndex"]], ["ProgramIndex(", 13, ["schema"]],
    ['ProgramIndex(schema=1, rootPackage=pkg:"")', 40, ["pkg identity"]]]) completeTextFault(emptyWireIndex, text, offset, expected);
});

test("ir-program a malformed opaque child retains its complete own first-fault result at both delimiters", () => {
  const prefix = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[], types=`;
  for (const suffix of [",", ")"]) completeTextFault(emptyWireIndex, prefix + "@" + suffix, prefix.length, ["identifier"]);
  const modulePrefix = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[ModuleRecord(module=mod:`;
  completeTextFault(emptyWireIndex, modulePrefix + '"")])', modulePrefix.length + 1, ["mod identity"]);
});

test("ir-program syntax journal boundaries retain complete literal coordinates and trailing whitespace", () => {
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.input.json"), "utf8"));
  const text = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.expected.json"), "utf8")).value.printed;
  completeProgramValue(product.parseModuleBodies(input.index, text + " \t\n"), { kind: "parsed", value: input.module }, "journal trailing whitespace reaches the sole EOF authority");
  const newline = text.indexOf("\n");
  completeTextFault(input.index, text.slice(0, newline) + " " + text.slice(newline + 1), newline, ["newline"], false);
  const equals = text.indexOf("n:0=TirModuleRoot") + "n:0".length;
  completeTextFault(input.index, text.slice(0, equals) + " @" + text.slice(equals + 1), equals + 1, ["="], false);
  const kind = equals + 1;
  completeTextFault(input.index, text.slice(0, kind) + "Z" + text.slice(kind + 1), kind,
    [...expectedSyntaxKinds.filter(name => name !== "Parameter"), "TirModuleRoot", "TirReadyCallable", "TirFormal"], false);
});

test("ir-program pragma faults retain lexical and UTF16-order first-fault precedence", () => {
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.input.json"), "utf8"));
  const original = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.expected.json"), "utf8")).value.printed;
  const argument = 'PragmaArgument(pos=0, end=1, name="a", value="a")';
  for (const [args, key, expected] of [[`b=${argument}, "a\\q"=${argument}`, '"a\\q"', ["pragma key in UTF-16 order"]],
    [`a=${argument}, "b\\q"=${argument}`, '\\q', ["JSON escape"]], [`a@${argument}`, "@", ["="]]]) {
    const text = original.replace("pragmas=[]", `pragmas=[SingleLineCommentTrivia(pos=0, end=1, hasTrailingNewLine=false, name="a", args=PragmaArguments(${args}))]`);
    const position = text.indexOf(key, text.indexOf("PragmaArguments("));
    const offset = position + (key[0] === '"' ? 1 : 0);
    completeTextFault(input.index, text, offset, expected, false);
  }
  for (const [field, value, expected] of [["commentDirectives", "Unknown(loc=TextRange(pos=0, end=1))", ["Unknown", "ExpectError", "Ignore"]],
    ["pragmas", `SingleLineCommentTrivia(pos=0, end=1, hasTrailingNewLine=false, name="a", args=PragmaArguments())`, ["SingleLineCommentTrivia", "MultiLineCommentTrivia"]]]) {
    const text = original.replace(`${field}=[]`, `${field}=[Z${value.slice(1)}]`);
    completeTextFault(input.index, text, text.indexOf(`${field}=[`) + field.length + 2, expected, false);
  }
});

const syntaxExamples = new Map();
const syntaxPhaseExamples = new Map();
for (const path of casePaths.filter(path => path.includes("/function/"))) {
  const descriptor = JSON.parse(readFileSync(resolve(repository, path), "utf8"));
  const input = decodeFixtureJson(readFileSync(resolve(repository, descriptor.input), "utf8"));
  if (input.module === undefined) continue;
  for (const node of syntaxPhysicalNodes(input.module)) {
    if (!syntaxExamples.has(node.kind)) syntaxExamples.set(node.kind, { input, node });
    const key = `${node.kind}/${node.tsonic?.role ?? ""}`;
    if (!syntaxPhaseExamples.has(key)) syntaxPhaseExamples.set(key, { input, node });
  }
}

for (const [kind, example] of syntaxExamples) for (const { field } of nullableSyntaxCases(example.node, moduleFixture().definition, moduleFixture().bodyId))
  test(`ir-program ${kind}.${field} retains its complete declared nullable or collection value through all structural transports`, () => {
    const envelope = moduleFixture();
    const node = nullableSyntaxCases(example.node, envelope.definition, envelope.bodyId).find(value => value.field === field).node;
    const types = { terms: example.input.index.types.terms.length === 0 ? envelope.index.types.terms : example.input.index.types.terms,
      signatures: example.input.index.types.signatures.length === 0 ? envelope.index.types.signatures : example.input.index.types.signatures };
    const module = syntaxTransportModule({ module: envelope.module }, node, "SyntaxNode");
    completeSyntaxTransport(envelope, module, types);
  });

for (const { family, kinds } of syntaxTransportFamilies) for (const kind of kinds) test(`ir-program complete ${kind} retains its actual ${family} parent slot through publication and text`, () => {
  const example = syntaxExamples.get(kind);
  assert.notEqual(example, undefined, "every selected syntax kind has an existing complete independently authored example");
  const { input, node } = example;
  const envelope = moduleFixture();
  const types = { terms: input.index.types.terms.length === 0 ? envelope.index.types.terms : input.index.types.terms,
    signatures: input.index.types.signatures.length === 0 ? envelope.index.types.signatures : input.index.types.signatures };
  const module = syntaxTransportModule({ module: envelope.module }, node, family);
  const parsed = completeSyntaxTransport(envelope, module, types);
  assert.equal(Object.is(parsed.tree.root, parsed.bodies[0].tir.root), family !== "BodyRoot", "the parsed graph retains exactly the authored module/body root sharing");
});

const transportedKinds = new Set(syntaxTransportFamilies.flatMap(family => family.kinds));
for (const [kind, { input, node }] of syntaxExamples) if (!transportedKinds.has(kind))
  test(`ir-program complete auxiliary ${kind} retains every original field in all three structural transports`, () => {
    const fixture = moduleFixture();
    const types = { terms: input.index.types.terms.length === 0 ? fixture.index.types.terms : input.index.types.terms,
      signatures: input.index.types.signatures.length === 0 ? fixture.index.types.signatures : input.index.types.signatures };
    completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"), types);
  });

for (const kind of ["literal", "union", "intersection", "array", "fixed-array", "optional", "optional-absence", "tuple", "shape", "write-only-shape", "declared", "construction-reference", "projection-await", "projection-component", "projection-indexed", "projection-keyof", "projection-substitution", "projection-conditional", "callable", "owned-callable", "composed-callable"])
  test(`ir-program instantiated ${kind} appends exactly its independent concrete record while retaining every old ID and row`, () => {
    const fixture = moduleFixture();
    const { index, module, bindings, expected } = genericCarrierCase(fixture, kind);
    const limits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
      typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
    const invoke = value => product.instantiate(index, module, { kind: "tir", body: fixture.bodyId }, bindings, value);
    const result = invoke(limits);
    completeProgramValue(result, expected, "full independently authored concrete type/signature suffix and artifact image");
    if (kind === "composed-callable") {
      assert.deepEqual(result.types.terms.slice(0, index.types.terms.length), index.types.terms);
      assert.deepEqual(result.types.signatures.slice(0, index.types.signatures.length), index.types.signatures);
      const root = result.types.terms[index.types.terms.length];
      const composed = result.types.signatures[root.calls[0]];
      assert.deepEqual(composed.composition, { kind: "union", signatures: [4] });
      assert.equal(result.types.signatures[composed.composition.signatures[0]].composition, null);
    }
    if (["union", "intersection", "composed-callable"].includes(kind)) completeProgramValue(typeProduct.verifyTypes({ table: result.types,
      bindings: [], evidence: [], nominalOf: fixture.context.facts.nominalOf, nodeExists: fixture.context.facts.nodeExists,
      localExists: fixture.context.facts.localExists }), [], "stable original IDs and the complete appended table satisfy the actual lower ordering rule together");
    for (const [field, dimension, last] of [["maximumWork", "work", 520], ["maximumCreatedRecords", "created-records", 100]]) {
      let complete = false;
      for (let maximum = 0; maximum <= last; maximum += 1) {
        const actual = invoke({ ...limits, [field]: maximum });
        if (actual.kind === "instantiated") {
          complete = true;
          completeProgramValue(actual, expected, "every sufficient budget preserves the same entire appended publication");
        } else {
          assert.equal(complete, false, "budget monotonicity includes concrete-row transport");
          assert.equal(actual.kind, "resource-limit");
          assert.equal(actual.dimension, dimension);
          assert.equal(actual.maximum, maximum,
            "a refusal retains the original enclosing maximum and never a partial table");
          completeProgramValue(Object.keys(actual).sort(), ["dimension", "kind", "maximum"], "the complete closed refusal payload");
        }
      }
    }
  });

function completeSyntaxTransport(fixture, module, types = fixture.index.types) {
  const index = { ...fixture.index, types };
  const program = { index, modules: [module] };
  completeProgramValue(projectFixtureProgram(program, { table: types,
    types: types.terms.map((_value, position) => position), signatures: types.signatures.map((_value, position) => position) }),
  program, "the complete typed syntax and all unrelated records retain their independent identity image");
  const parsed = product.parseModuleBodies(index, product.printModuleBodies(index, module));
  completeProgramValue(parsed, { kind: "parsed", value: module },
    "the entire typed syntax document preserves its declared carrier values");
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  completeProgramValue(product.instantiate(index, module, { kind: "tir", body: fixture.bodyId }, bindings,
    { maximumWork: 10000000, maximumCreatedRecords: 10000000, maximumBindingVectorsPerArtifact: 8,
      typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } }),
  { kind: "instantiated", artifact: { kind: "tir", body: { ...module.bodies[0].tir, bindings: { kind: "instantiated", bindings } } }, types },
  "the complete artifact projection retains the independently supplied records and seed prefixes");
  return parsed.value;
}

function evidencedSyntax(node) {
  const value = structuredClone(node);
  const pending = [value.tsonic];
  let changed = false;
  for (const record of pending) {
    if (record === null || typeof record !== "object") continue;
    if (Object.hasOwn(record, "narrowing") && Object.hasOwn(record, "evidenceIndex")) {
      record.narrowing = { kind: "identity", type: record.type ?? record.read };
      record.evidenceIndex = 0;
      changed = true;
    }
    for (const child of Object.values(record)) pending.push(child);
  }
  return { node: value, changed };
}

for (const [kind, example] of syntaxPhaseExamples) if (evidencedSyntax(example.node).changed)
  test(`ir-program ${kind} preserves complete nonnull narrowing and evidence through every structural transport`, () => {
    const fixture = moduleFixture();
    const { node } = evidencedSyntax(example.node);
    const original = example.input.index.types;
    const types = { terms: original.terms.length === 0 ? fixture.index.types.terms : original.terms,
      signatures: original.signatures.length === 0 ? fixture.index.types.signatures : original.signatures };
    completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"), types);
  });

for (const kind of ["CallExpression", "BinaryExpression", "Decorator", "ObjectLiteralExpression", "ClassDeclaration", "MappedType", "JSDocTemplateTag", "SourceFile", "PropertyAccessExpression", "ExpressionWithTypeArguments", "protocol", "deferred-operator", "component"])
  test(`ir-program complete ${kind} projection refuses every insufficient budget before publishing any artifact`, () => {
    const fixture = moduleFixture();
    const special = kind === "protocol" || kind === "deferred-operator"
      ? decodeFixtureJson(readFileSync(resolve(repository, `test/host-cases/ir-program/function/${kind === "protocol" ? "six-protocol-step-await" : "six-deferred-operator-0"}.input.json`), "utf8")) : null;
    const example = special === null ? syntaxExamples.get(kind === "component" ? "StringLiteral" : kind) : { input: special, node: special.module.tree.root.statements.nodes[0].node.expression };
    const node = evidencedSyntax(example.node).node;
    if (kind === "deferred-operator") node.tsonic.conversion.deferred.invocation.input.permissionScope = null;
    if (kind === "component") {
      const component = { root: { kind: "body", value: { body: fixture.bodyId, node: node.id } }, path: [{ kind: "array-element" }] };
      node.tsonic.narrowing = { kind: "narrowed", source: 0, result: 0,
        proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 }, failure: "unwind" };
    }
    if (kind === "ExpressionWithTypeArguments") node.tsonic = { role: "value", type: 0, convertedType: 0, conversion: { kind: "identity" },
      narrowing: null, evidenceIndex: null, demand: { kind: "always" }, application: null, bindings: {
        classBindings: [{ kind: "bound", parameter: typeParameterDeclaration(fixture.definition, 0), type: 0 }], methodBindings: [], capturedBindings: [],
        selfBindings: [{ kind: "bound", owner: fixture.definition, type: 0 }] } };
    const original = example.input.index.types;
    const types = { terms: original.terms.length === 0 ? fixture.index.types.terms : original.terms,
      signatures: original.signatures.length === 0 ? fixture.index.types.signatures : original.signatures };
    const module = syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode");
    const index = { ...fixture.index, types };
    if (kind === "deferred-operator") completeSyntaxTransport(fixture, module, types);
    const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    const expected = { kind: "instantiated", artifact: { kind: "tir", body: { ...module.bodies[0].tir,
      bindings: { kind: "instantiated", bindings } } }, types };
    for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
      let completed = false;
      for (let maximum = 0; maximum <= 2000; maximum += 1) {
        const actual = product.instantiate(index, module, { kind: "tir", body: fixture.bodyId }, bindings,
          { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000, maximumCreatedRecords: 1000000, [field]: maximum });
        if (actual.kind === "instantiated") {
          completeProgramValue(actual, expected, "the first sufficient budget returns the entire independent projection");
          completed = true;
          break;
        }
        assert.equal(actual.kind, "resource-limit", "no fabricated semantic outcome or partial artifact");
        assert.equal(actual.dimension, dimension);
        assert.equal(actual.maximum, maximum,
          "the exact original invocation bound is preserved across lower-owner publication");
        completeProgramValue(Object.keys(actual).sort(), ["dimension", "kind", "maximum"], "the entire closed refusal record");
      }
      assert.equal(completed, true, "the finite actual fixture fits within the declared sweep");
    }
  });

for (const [kind, phase] of [
  ["Identifier", "shorthand-value"], ["Identifier", "write"], ["Identifier", "read-write"],
  ["NumericLiteral", "property-name"], ["NumericLiteral", "declaration-name"],
  ["BigIntLiteral", "property-name"], ["BigIntLiteral", "type-literal"],
  ["StringLiteral", "property-name"], ["StringLiteral", "declaration-name"],
  ["ExpressionWithTypeArguments", "no-application"],
]) test(`ir-program ${kind} complete ${phase} phase arm retains its exact declared payload`, () => {
  const fixture = moduleFixture();
  const node = structuredClone(syntaxExamples.get(kind).node);
  const resolution = { kind: "definition", definition: fixture.definition, aliases: [] };
  if (phase === "shorthand-value") node.tsonic = { type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" }, role: phase, key: { kind: "text", value: "value" }, resolution };
  else if (phase === "write" || phase === "read-write") node.tsonic = { role: "assignment-target", resolution,
    access: phase === "write" ? { kind: phase, storage: 0 } : { kind: phase, storage: 0, read: 0, narrowing: null, evidenceIndex: null } };
  else if (phase === "property-name") node.tsonic = { role: phase, key: { kind: "text", value: "value" } };
  else if (phase === "declaration-name") node.tsonic = { role: phase, declaration: { kind: "definition", definition: fixture.definition } };
  else if (phase === "type-literal") node.tsonic = { role: phase, type: 0 };
  else node.tsonic = { role: "value", type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" }, application: null,
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const original = syntaxExamples.get(kind).input.index.types;
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"),
    { terms: original.terms.length === 0 ? fixture.index.types.terms : original.terms,
      signatures: original.signatures.length === 0 ? fixture.index.types.signatures : original.signatures });
});

for (const kind of ["BindingElement", "VoidKeyword"]) test(`ir-program complete ${kind} nullable initializer or declared-type origin remains source data`, () => {
  const fixture = moduleFixture();
  const example = syntaxExamples.get(kind);
  const node = structuredClone(example.node);
  node.tsonic = kind === "BindingElement" ? { role: "binding", declaration: { kind: "definition", definition: fixture.definition },
    storage: 0, initializer: null } : { type: 0, declarations: [fixture.definition] };
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"),
    { terms: example.input.index.types.terms.length === 0 ? fixture.index.types.terms : example.input.index.types.terms,
      signatures: example.input.index.types.signatures.length === 0 ? fixture.index.types.signatures : example.input.index.types.signatures });
});

for (const capture of ["attribute", "application-attribute", "root", "placement", "apply", "select-member"]) test(`ir-program complete ${capture} capture retains nullable selection data and real source-reference operands`, () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const node = structuredClone(input.module.tree.root.statements.nodes[0].node.expression);
  const value = node.tsonic.conversion.deferred.invocation.input;
  const reference = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  value.permissionScope = { body: fixture.bodyId, node: 0 };
  if (capture === "attribute" || capture === "application-attribute") value.captured.attribute = { kind: "available", value: { kind: capture === "attribute" ? "builder-state" : "application", occurrence: reference,
    applicationTarget: reference, selectedMember: { selectedDeclaration: null, declarations: [reference] }, applicationMemberKind: null,
    applicationPlacement: null, applicationParameterName: null, applicationTargetSpecifier: null,
    ...(capture === "application-attribute" ? { invocation: reference } : {}) } };
  else {
    const common = { occurrence: reference, provider: fixture.definition, family: "safety", operation: capture };
    value.captured.safety = { kind: "available", value: capture === "root" ? { ...common, form: "value", target: null }
      : capture === "placement" ? { ...common, predecessor: reference, placement: "constructor" }
        : capture === "apply" ? { ...common, predecessor: null, contract: "safe" }
          : { ...common, predecessor: null, memberKind: "property", selection: { kind: "selected", expression: reference,
            declaration: null, declarations: [reference] } } };
  }
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "Expression"), input.index.types);
});

// Binding captures (SCHEMA-MIGRATION.md 5.2, PB1-PB5): each record through the canonical copy, the text and Instantiate.
const bindingUnavailable = reason => ({ kind: "unavailable", reason, causes: [] });
for (const [name, select] of [
  ["complete field binding", records => ({ fieldBinding: records.field })],
  ["field binding with every inner fact unavailable", records => ({ fieldBinding: { ...records.field, bindings: bindingUnavailable("parameter-dependent"),
    owner: bindingUnavailable("checker-error"), pointee: bindingUnavailable("not-provided"), field: bindingUnavailable("not-provided") } })],
  ["field binding whose inner facts carry the reasons of missing evidence", records => ({ fieldBinding: { ...records.field,
    bindings: bindingUnavailable("missing-original-component"), owner: bindingUnavailable("incomplete-association"),
    pointee: bindingUnavailable("unsupported-checked-structure"), field: bindingUnavailable("missing-original-component") } })],
  ["complete record binding", records => ({ recordBinding: records.record })],
  ["record binding without field entries", records => ({ recordBinding: { ...records.record, fields: [] } })],
  ["record binding with every inner fact unavailable", records => ({ recordBinding: { ...records.record, bindings: bindingUnavailable("parameter-dependent"),
    source: bindingUnavailable("checker-error"), layout: bindingUnavailable("not-provided") } })],
  ["field and record binding together", records => ({ fieldBinding: records.field, recordBinding: records.record })],
]) test(`ir-program ${name} capture survives the canonical copy, the text and Instantiate unchanged`, () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const node = structuredClone(input.module.tree.root.statements.nodes[0].node.expression);
  const value = node.tsonic.conversion.deferred.invocation.input;
  const reference = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const occurrence = { body: fixture.bodyId, node: 0 };
  const bindings = { kind: "available", value: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  value.permissionScope = occurrence;
  const records = {
    field: { occurrence, bindings, owner: { kind: "available", value: 0 }, pointee: { kind: "available", value: 0 },
      fieldExpression: occurrence, field: { kind: "available", value: reference }, pointerExpression: occurrence },
    record: { occurrence, bindings, source: { kind: "available", value: 0 }, layoutExpression: occurrence,
      layout: { kind: "available", value: reference }, fields: [{ expression: occurrence, binding: occurrence }] },
  };
  for (const [field, record] of Object.entries(select(records))) value.captured[field] = { kind: "available", value: record };
  const module = syntaxTransportModule({ module: fixture.module }, node, "Expression");
  completeSyntaxTransport(fixture, module, input.index.types);
  // PB6: the inventory of the binding records is charged to the work and created-record budgets like every other record:
  // every insufficient budget is a resource-limit refusal of its own dimension, every sufficient one the same artifact.
  const index = { ...fixture.index, types: input.index.types };
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const limits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const expected = product.instantiate(index, module, { kind: "tir", body: fixture.bodyId }, empty, limits);
  assert.equal(expected.kind, "instantiated");
  const seed = paidSeedOf(index.types, limits);
  for (const [field, dimension, last] of [["maximumWork", "work", 400], ["maximumCreatedRecords", "created-records", 60]]) {
    let complete = false;
    for (let maximum = 0; maximum <= last + seed[field]; maximum += 1) {
      const actual = product.instantiate(index, module, { kind: "tir", body: fixture.bodyId }, empty, { ...limits, [field]: maximum });
      if (actual.kind === "instantiated") {
        complete = true;
        completeProgramValue(actual, expected, "every sufficient budget gives the same complete artifact");
      } else {
        assert.equal(complete, false, "a budget that sufficed is never refused at a larger value");
        completeProgramValue({ kind: actual.kind, dimension: actual.dimension }, { kind: "resource-limit", dimension }, "the refusal names its own dimension");
      }
    }
    assert.equal(complete, true, `${field}: the sweep reaches a sufficient budget`);
  }
});

// PB5 (SCHEMA-MIGRATION.md 5.7): a parametric template whose binding captures mention a type parameter, instantiated under a
// binding of that parameter. The expected artifact is built from the capture values of the second table of 5.7, not from the product.
test("ir-program Instantiate substitutes the owner, pointee, source and both vectors of binding captures under a real binding; nodes are not changed", () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  completeProgramValue(input.index.types.terms, [{ kind: "intrinsic", intrinsic: "void" }, { kind: "string" }], "the fixture table has the two closed terms 0 and 1");
  const first = typeParameterDeclaration(fixture.definition, 0);
  const second = typeParameterDeclaration(fixture.definition, 1);
  const types = { terms: [...input.index.types.terms, { kind: "param", parameter: first }, { kind: "primitive", primitive: "int32" },
    { kind: "array", element: 2, readonly: false }], signatures: input.index.types.signatures };
  const available = value => ({ kind: "available", value });
  const vector = classBindings => ({ classBindings, methodBindings: [], capturedBindings: [], selfBindings: [] });
  const rigid = parameter => ({ kind: "rigid", parameter });
  const bound = (parameter, type) => ({ kind: "bound", parameter, type });
  const reference = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const occurrence = { body: fixture.bodyId, node: 0 };
  const moduleOf = (fieldVector, owner, pointee, recordVector, source) => {
    const node = structuredClone(input.module.tree.root.statements.nodes[0].node.expression);
    const value = node.tsonic.conversion.deferred.invocation.input;
    value.permissionScope = occurrence;
    value.captured.fieldBinding = available({ occurrence, bindings: available(fieldVector), owner: available(owner), pointee: available(pointee),
      fieldExpression: occurrence, field: available(reference), pointerExpression: occurrence });
    value.captured.recordBinding = available({ occurrence, bindings: available(recordVector), source: available(source), layoutExpression: occurrence,
      layout: available(reference), fields: [{ expression: occurrence, binding: occurrence }] });
    return syntaxTransportModule({ module: fixture.module }, node, "Expression");
  };
  const template = moduleOf(vector([rigid(first), bound(second, 2)]), 4, 2, vector([bound(first, 4), rigid(second)]), 4);
  completeSyntaxTransport(fixture, template, types);
  const index = { ...fixture.index, types };
  const limits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const requested = vector([bound(first, 3)]);
  const substituted = moduleOf(vector([bound(first, 3), bound(second, 3)]), 5, 3, vector([bound(first, 5), rigid(second)]), 5);
  completeProgramValue(product.instantiate(index, template, { kind: "tir", body: fixture.bodyId }, requested, limits),
    { kind: "instantiated", artifact: { kind: "tir", body: { ...substituted.bodies[0].tir, bindings: { kind: "instantiated", bindings: requested } } },
      types: { terms: [...types.terms, { kind: "array", element: 3, readonly: false }], signatures: types.signatures } },
    "T becomes int32 and T[] the one appended int32[]; a rigid entry of the bound parameter takes the requested binding, a bound entry keeps its parameter");
  const unrelated = vector([bound(typeParameterDeclaration(fixture.definition, 2), 3)]);
  completeProgramValue(product.instantiate(index, template, { kind: "tir", body: fixture.bodyId }, unrelated, limits),
    { kind: "instantiated", artifact: { kind: "tir", body: { ...template.bodies[0].tir, bindings: { kind: "instantiated", bindings: unrelated } } }, types },
    "a binding of a parameter that the captures do not mention changes no capture type or vector and appends no type");
});

test("ir-program binding capture records move the Instantiate work and created-record thresholds by exactly their inventory charges", () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const available = value => ({ kind: "available", value });
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const occurrence = { body: fixture.bodyId, node: 0 };
  const moduleOf = (fieldBinding, recordBinding) => {
    const node = structuredClone(input.module.tree.root.statements.nodes[0].node.expression);
    const value = node.tsonic.conversion.deferred.invocation.input;
    value.permissionScope = occurrence;
    value.captured.fieldBinding = available(fieldBinding);
    value.captured.recordBinding = available(recordBinding);
    return syntaxTransportModule({ module: fixture.module }, node, "Expression");
  };
  const fieldHolder = { occurrence, bindings: available(empty), owner: available(0), pointee: available(0),
    fieldExpression: occurrence, field: unavailable, pointerExpression: occurrence };
  const recordHolder = fields => ({ occurrence, bindings: available(empty), source: available(0), layoutExpression: occurrence, layout: unavailable, fields });
  const index = { ...fixture.index, types: input.index.types };
  const limits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const seed = paidSeedOf(index.types, limits);
  const artifact = { kind: "tir", body: fixture.bodyId };
  const expected = module => ({ kind: "instantiated", artifact: { kind: "tir", body: { ...module.bodies[0].tir,
    bindings: { kind: "instantiated", bindings: empty } } }, types: index.types });
  const measure = (module, field, dimension, last) => {
    let below = null;
    for (let maximum = 0; maximum <= last; maximum += 1) {
      const actual = product.instantiate(index, module, artifact, empty, { ...limits, [field]: maximum });
      if (actual.kind === "instantiated") {
        completeProgramValue(actual, expected(module), `${field}: the baseline completes with the independently supplied artifact`);
        assert.notEqual(below, null, `${field}: the baseline has a refusal one below its threshold`);
        return { threshold: maximum, below };
      }
      completeProgramValue({ kind: actual.kind, dimension: actual.dimension }, { kind: "resource-limit", dimension }, `${field}: a refusal names its own dimension`);
      below = actual;
    }
    return assert.fail(`${field}: the baseline sweep reaches a sufficient budget`);
  };
  for (const [name, baseline, variant, charge] of [
    ["field binding holder", moduleOf(null, null), moduleOf(fieldHolder, null), { maximumWork: 24, maximumCreatedRecords: 5 }],
    ["record binding holder", moduleOf(null, null), moduleOf(null, recordHolder([])), { maximumWork: 19, maximumCreatedRecords: 4 }],
    // The projection shares the unchanged fields vector and its pairs: it neither visits nor creates them (K-3185), so one entry moves no threshold.
    ["one shared record field entry", moduleOf(null, recordHolder([])), moduleOf(null, recordHolder([{ expression: occurrence, binding: occurrence }])),
      { maximumWork: 0, maximumCreatedRecords: 0 }],
  ]) for (const [field, dimension, last] of [["maximumWork", "work", 400], ["maximumCreatedRecords", "created-records", 60]]) {
    const base = measure(baseline, field, dimension, last + seed[field]);
    completeProgramValue(base.below, { kind: "resource-limit", dimension, maximum: base.threshold - 1 },
      `${name}: one below the baseline threshold retains the original enclosing limit`);
    const threshold = base.threshold + charge[field];
    const below = { kind: "resource-limit", dimension, maximum: threshold - 1 };
    for (const maximum of [threshold - 1, threshold, threshold + 1]) {
      completeProgramValue(product.instantiate(index, variant, artifact, empty, { ...limits, [field]: maximum }),
        maximum < threshold ? below : expected(variant), `${name}: ${field} ${maximum} against the derived threshold ${threshold}`);
    }
  }
});

test("ir-program binding capture types and bound types are renumbered by an independent publication; nodes are not", () => {
  const read = name => decodeFixtureJson(readFileSync(resolve(repository, `test/host-cases/ir-program/function/six-core-pointerOperation-null.${name}.json`), "utf8"));
  const input = read("input");
  const expected = read("expected").value.canonical;
  assert.deepStrictEqual(input.publication.types, [1, 0], "the fixture publication exchanges types 0 and 1");
  const captureOf = root => {
    const pending = [root];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && "pointerOperation" in value) return value;
      pending.push(...Object.values(value));
    }
    throw new Error("the fixture has one core capture");
  };
  const original = captureOf(input.module);
  // The occurrence and the binder owner are taken from records the fixture already holds: the rule context of the
  // core input that carries the capture, and the declaration of the one signature.
  const inputOf = root => {
    const pending = [root];
    for (let value = pending.pop(); value !== undefined; value = pending.pop()) {
      if (value === null || typeof value !== "object") continue;
      if (!Array.isArray(value) && "captured" in value && "context" in value) return value;
      pending.push(...Object.values(value));
    }
    throw new Error("the fixture has one core rule input");
  };
  const occurrence = structuredClone(inputOf(input.module).context.occurrence);
  const reference = { kind: "body", value: occurrence };
  const owner = input.index.types.signatures[0].declaration;
  const parameter = typeParameterDeclaration(owner, 0);
  const vector = type => ({ classBindings: [{ kind: "bound", parameter, type }], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const records = (first, second) => ({
    fieldBinding: { kind: "available", value: { occurrence, bindings: { kind: "available", value: vector(first) }, owner: { kind: "available", value: first },
      pointee: { kind: "available", value: second }, fieldExpression: occurrence, field: { kind: "available", value: reference }, pointerExpression: occurrence } },
    recordBinding: { kind: "available", value: { occurrence, bindings: { kind: "available", value: vector(second) }, source: { kind: "available", value: second },
      layoutExpression: occurrence, layout: { kind: "available", value: reference }, fields: [{ expression: occurrence, binding: occurrence }] } },
  });
  Object.assign(original, records(0, 1));
  Object.assign(captureOf(expected.modules), records(1, 0));
  completeProgramValue(projectFixtureProgram({ index: input.index, modules: [input.module] }, input.publication), expected,
    "owner, pointee, source and every bound type follow the publication; occurrence, expressions and descriptor references are copied");
});

async function readProgramLeaf(reader, text) {
  const { evaluateText } = await import("../../packages/host/dist/ir-program/parse-values.js");
  const cursor = { text, offset: 0,
    identities: { type: tyId, signature: sigId, node: nodeId, local: localId, expansion: expansionId, hostCode: hostDiagnosticCode } };
  const result = evaluateText(reader(cursor, value => ({ kind: "complete", result: { kind: "parsed", value } })));
  if (result.kind === "parsed") assert.equal(cursor.offset, text.length);
  return result;
}

test("Program carries the actual global environment and its intrinsic member origins", async () => {
  const front = await loadFrontFixture();
  const { analyzeHostProgram } = await import("../../packages/host/dist/pipeline/index.js");
  const { readMemberOriginText } = await import("../../packages/host/dist/ir-program/parse-types.js");
  const { textMemberOrigin } = await import("../../packages/host/dist/ir-program/text-types.js");
  const { emitText } = await import("../../packages/host/dist/ir-program/text-values.js");
  const input = analysisInput(front, "sdk-minimal", "export type Environment = typeof globalThis; "
    + "export function id(value: boolean): boolean { return value; }");
  const result = analyzeHostProgram(input);
  assert.equal(result.kind, "ok");
  const { index } = result.value;
  const environment = index.types.terms.find(term => term.kind === "source-environment");
  assert.equal(environment?.kind, "source-environment");
  for (const [name, symbol] of [["globalThis", "global-this"], ["undefined", "undefined"]]) {
    const member = environment.members.find(member => member.key.kind === "text" && member.key.value === name);
    assert.deepEqual(member.origins, [{ kind: "intrinsic", symbol }]);
    const origin = member.origins[0];
    const text = emitText(textMemberOrigin(origin), "member-origin");
    assert.equal(text, `intrinsic(symbol="${symbol}")`);
    assert.deepEqual(await readProgramLeaf(readMemberOriginText, text), { kind: "parsed", value: origin });
    assert.equal((await readProgramLeaf(readMemberOriginText, text.replace(`"${symbol}"`, '"plain"'))).kind, "invalid-text");
  }
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(index)), { kind: "parsed", value: index },
    "the complete public Program index preserves the actual recursive environment");
});

test("Program core codec retains each actual checked struct and field application", async () => {
  const { marked, call, fieldCall } = await captureCheckedMarkers();
  const { readHirCoreCaptureText } = await import("../../packages/host/dist/ir-program/parse-core.js");
  const { textHirCoreCapture } = await import("../../packages/host/dist/ir-program/text-core.js");
  const { emitText } = await import("../../packages/host/dist/ir-program/text-values.js");
  for (const [node, role] of [[call, "struct"], [fieldCall, "field"], [marked, null]]) {
    const actual = node.tsonic.core;
    const application = actual.markers.value.application;
    assert.equal(application.kind, "available");
    assert.equal(application.value?.role ?? null, role);
    const text = emitText(textHirCoreCapture(actual), "core-capture");
    assert.deepEqual(await readProgramLeaf(readHirCoreCaptureText, text), { kind: "parsed", value: actual });
    if (role !== null) {
      const altered = text.replace(`HirMarkerApplication(role="${role}"`, 'HirMarkerApplication(role="plain"');
      assert.notEqual(altered, text);
      assert.equal((await readProgramLeaf(readHirCoreCaptureText, altered)).kind, "invalid-text");
    }
  }
});

test("Program pre-copy allowance does not count a borrowed checked marker application", async () => {
  const { marked, call } = await captureCheckedMarkers();
  const { prepareDeferred, prepareCoreProjection } = await import("../../packages/host/dist/ir-program/instantiate-phase.js");
  const { createProjectionInventory, drainProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const deferred = input.module.tree.root.statements.nodes[0].node.expression.tsonic.conversion.deferred;
  const limits = { maximumWork: 10000, maximumCreatedRecords: 10000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 10000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const identity = value => value;
  const lookup = { parameterBinding: identity, selfBinding: identity };
  const run = (captured, bounds) => {
    const meter = createInstantiationMeter(bounds);
    const scan = createProjectionInventory(meter, lookup, path => assert.fail(path));
    const prepared = prepareDeferred(scan, { ...deferred,
      invocation: { ...deferred.invocation, input: { ...deferred.invocation.input, captured } } }, "core");
    const stop = prepared.kind === "refused" ? prepared.stop : drainProjectionInventory(scan);
    return { stop, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created };
  };
  const declared = marked.tsonic.core;
  const invoked = call.tsonic.core;
  const nullApplication = declared.markers.value.application;
  const actualApplication = invoked.markers.value.application;
  assert.equal(nullApplication.value, null);
  assert.equal(actualApplication.value.role, "struct");
  const withApplication = { ...declared, markers: { ...declared.markers, value: { ...declared.markers.value, application: actualApplication } } };
  const scan = createProjectionInventory(createInstantiationMeter(limits), lookup, path => assert.fail(path));
  const prepared = prepareCoreProjection(scan, withApplication, "core", path => assert.fail(path));
  assert.equal(prepared.kind, "copied");
  assert.equal(drainProjectionInventory(scan), null);
  assert.equal(prepared.value({ type: identity, signature: identity }).markers.value.application === actualApplication, true);
  const baseline = run(declared, limits);
  assert.deepEqual(baseline, { stop: null, work: 82, created: 14 });
  assert.deepEqual(run(withApplication, limits), baseline);
  for (const [field, dimension, required] of [["maximumWork", "work", baseline.work],
    ["maximumCreatedRecords", "created-records", baseline.created]]) {
    for (let maximum = 0; maximum < required; maximum += 1)
      assert.deepEqual(run(withApplication, { ...limits, [field]: maximum }).stop, { kind: "resource-limit", dimension, maximum });
    assert.equal(run(withApplication, { ...limits, [field]: required }).stop, null);
  }
});

test("Program binding lookup admits each original row before its indexed getter", async () => {
  const { createBindingLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  const { definition, context } = moduleFixture();
  const original = [
    { kind: "bound", parameter: typeParameterDeclaration(definition, 0), type: tyId(0) },
    { kind: "rigid", parameter: typeParameterDeclaration(definition, 1) },
    { kind: "rigid", owner: definition },
  ];
  for (const maximumWork of [0, 1, 2, 3]) {
    const meter = createInstantiationMeter({ ...ProgramWork.state(context.resources).limits, maximumWork });
    const pulls = [];
    const indexed = (value, label) => {
      const rows = [value];
      Object.defineProperty(rows, 0, { get() {
        pulls.push([label, maximumWork - remainingWork(meter.account)]);
        return value;
      } });
      return rows;
    };
    const bindings = {
      classBindings: indexed(original[0], "class"),
      methodBindings: indexed(original[1], "method"),
      capturedBindings: [],
      selfBindings: indexed(original[2], "self"),
    };
    const result = createBindingLookup(meter, bindings);
    assert.deepEqual(pulls, [["class", 1], ["method", 2], ["self", 3]].slice(0, maximumWork));
    if (maximumWork < 3) {
      assert.equal(result === accountFailure(meter.account), true);
      assert.equal("lookup" in result, false);
      const crossed = { get classBindings() { assert.fail("a stopped lookup cannot reopen the input"); } };
      assert.equal(createBindingLookup(meter, crossed) === result, true);
    } else {
      assert.equal(result.kind, "complete");
      assert.equal(result.lookup.parameterBinding({ kind: "rigid", parameter: original[0].parameter }) === original[0], true);
      assert.equal(result.lookup.parameterBinding({ ...original[1] }) === original[1], true);
      assert.equal(result.lookup.selfBinding({ ...original[2] }) === original[2], true);
    }
  }
});

test("Program index and type seed retain a source member's exact body occurrence", () => {
  const fixture = moduleFixture();
  const occurrence = { body: fixture.bodyId, node: 3 };
  const origin = { kind: "source-member", occurrence };
  fixture.index.types.terms.push({ kind: "shape", members: [{ key: { kind: "text", value: "enabled" },
    origins: [origin], readOrigins: [origin], writeOrigins: [], kind: "property", read: 0, write: null,
    optional: false, readonly: true }], indexes: [], calls: [], constructs: [] });
  const printed = product.printProgramIndex(fixture.index);
  const wire = `source-member(occurrence=NodeRef(body=body:"${fixture.bodyId}", node=n:3))`;
  assert.equal(printed.includes(wire), true);
  completeProgramValue(product.parseProgramIndex(printed), { kind: "parsed", value: fixture.index }, "body-qualified member origin");
  const invalid = printed.replace(wire, `source-member(occurrence=ItemNodeRef(owner=def:"${fixture.definition}", node=n:3))`);
  assert.equal(product.parseProgramIndex(invalid).kind, "invalid-text");
  completeSyntaxTransport(fixture, fixture.module);
});

test("ir-program complete write-only member origins retain null read identity in every transport", () => {
  const fixture = moduleFixture();
  const example = syntaxExamples.get("PropertyAccessExpression");
  const node = structuredClone(example.node);
  node.tsonic.selection = { kind: "decided", decision: { decision: { key: { kind: "text", value: "value" },
    origins: [{ kind: "declared", declaration: fixture.definition },
      { kind: "source-member", occurrence: { body: fixture.module.bodies[0].instance.body, node: node.id } }], selectedDeclarations: [], primary: null, read: null, write: 0,
    getter: null, setter: null, bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null } };
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "Expression"), example.input.index.types);
});

for (const kind of ["unary", "binary", "convert", "address-of", "array", "tuple", "fixed-array", "object", "record"])
  test(`ir-program genuine metadata constant in MIR ${kind} preserves the entire owning and child verdict vector`, () => {
    const { first } = metadataOperationFixture("size", "present", "layout");
    const mir = first.selected.mir;
    const operand = { kind: "constant", constant: 0 };
    const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "uint64" },
      operands: kind === "binary" ? [2, 2] : [2], result: 2, execution: { kind: "pure" } } };
    let value;
    if (kind === "unary" || kind === "convert") value = { kind, operation, operand, ...(kind === "convert" ? { to: 2 } : {}) };
    else if (kind === "binary") value = { kind, operation, left: operand, right: operand };
    else if (kind === "address-of") value = { kind, place: 0, type: 2 };
    else {
      const type = first.index.types.terms.length;
      if (kind === "array") first.index.types.terms.push({ kind, element: 2, readonly: false });
      else if (kind === "tuple") first.index.types.terms.push({ kind, elements: [{ kind: "required", type: 2, declaration: null }], readonly: false });
      else if (kind === "fixed-array") first.index.types.terms.push({ kind, element: 2, extent: { length: 1n, runtimeBase: "number" } });
      else first.index.types.terms.push({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] });
      mir.locals[0].storage = type;
      mir.places[0].storage = type;
      const member = { decision: { key: { kind: "text", value: "value" }, origins: [], selectedDeclarations: [], primary: null,
        read: 2, write: 2, getter: null, setter: null,
        bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
        location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
      value = { kind: "aggregate", type, aggregate: kind === "object" || kind === "record"
        ? { kind, fields: [{ member, value: operand }] } : { kind, elements: [operand] } };
    }
    mir.blocks[0].statements[1].value = value;
    const expected = kind !== "address-of" ? [{ rule: "mir-valid", site: { kind: "body", instance: first.instance },
      detail: [{ kind: "text", value: "operation-selected" }] }] : [];
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "all metadata witnesses are genuine; an operation absent from the actual source retains its complete child finding");
  });

for (const kind of ["literal", "definition", "observation", "place", "closure-parametric", "closure-instantiated", "body-callee-parametric",
  "body-callee-instantiated", "field-accessors", "missing-metadata"])
  test(`ir-program complete MIR ${kind} preserves all genuine reference and publication findings`, () => {
    const { first, second } = metadataOperationFixture("size", "present", "layout");
    const mir = first.selected.mir;
    const expected = [];
    const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    const site = { kind: "body", instance: first.instance };
    const missing = (path, key) => ({ rule: "binding-artifact-present", site, detail: [{ kind: "text", value: path }, { kind: "text", value: key }] });
    if (kind === "literal") mir.constants[0].value = { kind: "literal", value: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
    else if (kind === "definition") mir.constants[0].value = { kind, definition: first.definition, bindings: { kind: "instantiated", bindings } };
    else if (kind === "observation") mir.constants[0].value = { kind, at: { body: first.bodyId, node: 0 } };
    else if (kind === "place") mir.blocks[0].statements[1].value = { kind: "use", operand: { kind: "place", place: 0 } };
    else if (kind.startsWith("closure-")) {
      const instance = kind === "closure-parametric" ? second.template.instance : second.instance;
      mir.blocks[0].statements[1].value = { kind: "closure", instance, captures: [] };
      if (kind === "closure-instantiated") {
        first.index.bodies = first.index.bodies.filter(body => body.instance !== instance);
        expected.push(missing("mir.blocks[0].statements[1].value.instance",
          encodeKey([second.bodyId, ["instantiated", [[], [], [], []]]])));
      }
    } else if (kind.startsWith("body-callee-")) {
      const instance = kind === "body-callee-parametric" ? second.template.instance : second.instance;
      const block = mir.blocks[0];
      block.terminator = { origin: block.origin, tir: block.tir, kind: "call", callee: { kind: "body", instance, captures: [] }, receiver: null,
        arguments: [], destination: null, next: 0, unwind: { kind: "escape" }, step: null };
      if (kind === "body-callee-instantiated") {
        first.index.bodies = first.index.bodies.filter(body => body.instance !== instance);
        first.answers.set(encodeContextKey(["bodyOf", instance]), null);
        expected.push(missing("mir.blocks[0].terminator.callee.instance",
          encodeKey([second.bodyId, ["instantiated", [[], [], [], []]]])));
      }
    } else if (kind === "field-accessors") {
      const advertised = { declaration: first.definition, role: "advertised", signature: 0, body: null };
      const callee = { decision: { candidate: 0, advertised, api: { ...advertised, role: "api-signature" }, bindings, implementationBindings: bindings,
        parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null }, activation: first.instance };
      const member = { decision: { key: { kind: "text", value: "value" }, origins: [], selectedDeclarations: [], primary: null, read: 2, write: 2,
        getter: null, setter: null, bindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: callee, setter: callee };
      mir.places.push({ id: 1, base: { kind: "place", place: 0, projection: { kind: "field", member }, tir: mir.blocks[0].tir }, storage: 2, origin: mir.places[0].origin });
      first.index.bodies.find(body => body.kind === "selected").mirPlaceCount = 2;
    } else {
      const key = encodeKey([first.definition, ["instantiated", [[], [], [], []]]]);
      first.index.metadata.shift();
      expected.push(missing("mir.constants[0].value", key), missing("observations.rows[0].layout.metadata", key));
    }
    if (kind.startsWith("closure-") || kind.startsWith("body-callee-")) expected.push({ rule: "mir-valid", site, detail: [{ kind: "text", value: "operation-selected" }] });
    if (kind === "body-callee-instantiated") expected.push({ rule: "mir-valid", site, detail: [{ kind: "text", value: "capture-location-exact" }] });
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "the complete whole-body result includes every owning publication and child finding without filtering");
  });

function branching(published) {
  const block = published.mir.blocks[0];
  published.mir.constants = [{ id: 0, type: 0, value: { kind: "literal", value: { kind: "absence" } } }];
  published.mir.blocks = [
    { ...block, terminator: { origin: block.origin, tir: block.tir, kind: "switch", operand: { kind: "constant", constant: 0 }, targets: [], otherwise: 1, step: null } },
    { ...block, id: 1 },
  ];
}
const underMirLimit = (fixture, maximumWork) => product.verifyModuleBodies(fixture.index, fixture.module, { ...fixture.context,
  resources: product.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000000 })), mirVerification: { maximumWork } });
const MIR_EMPTY_WORK = 4 + 2 + 1 + 11;
const MIR_BRANCH_WORK = 14 + 5 + 1 + 1 + 16;

test("ir-program a body past its MIR verification limit refuses the module and names the body", () => {
  const fixture = publicationFixture();
  const emptyWork = MIR_EMPTY_WORK + 1;
  const branchWork = MIR_BRANCH_WORK + 1;
  completeProgramValue(underMirLimit(fixture, emptyWork), { kind: "complete", violations: [] }, "value, decision, storage and reachable-type work share one invocation");
  for (let maximum = 0; maximum < emptyWork; maximum += 1)
    completeProgramValue(underMirLimit(fixture, maximum), { kind: "resource-limit", body: fixture.instance, dimension: "work", maximum },
      "every count below the exact shared need refuses the body");
  branching(fixture.selected);
  const record = fixture.index.bodies.find(body => body.kind === "selected");
  record.mirBlockCount = 2;
  record.mirConstantCount = 1;
  for (let maximum = 0; maximum < branchWork; maximum += 1)
    completeProgramValue(underMirLimit(fixture, maximum), { kind: "resource-limit", body: fixture.instance, dimension: "work", maximum },
      "the two-block literal graph retains the same original refusal at every insufficient count");
  assert.equal(underMirLimit(fixture, branchWork).kind, "complete", "at the exact limit the body is verified to the end");
});

test("ir-program a structurally invalid body under its MIR limit is found invalid, not refused", () => {
  const fixture = publicationFixture();
  const block = fixture.selected.mir.blocks[0];
  block.terminator = { origin: block.origin, tir: block.tir, kind: "goto", target: 99 };
  const outcome = underMirLimit(fixture, MIR_EMPTY_WORK + 1);
  assert.equal(outcome.kind, "complete", "a defect is a finding of a verification that ran to its end");
  completeProgramValue(outcome.violations.filter(violation => violation.rule === "mir-valid"), [{ rule: "mir-valid", site: { kind: "body", instance: fixture.instance },
    detail: [{ kind: "text", value: "edge-target-resolves" }, { kind: "text", value: "normal" }, { kind: "number", value: 99 }] }],
  "the MIR finding is reported as a finding");
});

test("ir-program two bodies of one module are metered separately", () => {
  const both = dualInstanceFixture();
  for (const published of both.module.bodies) branching(published);
  assert.equal(underMirLimit(both, MIR_BRANCH_WORK + 1).kind, "complete", "each body is charged from zero; the instantiated body also pays its selected owner lookup");
  completeProgramValue(underMirLimit(both, MIR_BRANCH_WORK), { kind: "resource-limit", body: both.module.bodies[1].instance, dimension: "work", maximum: MIR_BRANCH_WORK },
    "the second body's actual selected binding lookup is not free");
  completeProgramValue(underMirLimit(both, MIR_BRANCH_WORK - 1), { kind: "resource-limit", body: both.module.bodies[0].instance, dimension: "work", maximum: MIR_BRANCH_WORK - 1 },
    "with both over the limit the first body verified is the one named");
  const second = dualInstanceFixture();
  branching(second.module.bodies[1]);
  completeProgramValue(underMirLimit(second, MIR_EMPTY_WORK), { kind: "resource-limit", body: second.module.bodies[1].instance, dimension: "work", maximum: MIR_EMPTY_WORK },
    "the refusal names the body that passed its limit, not the first body of the module");
});

test("ir-program checks exact type-table agreement for shared, decoded and mismatched evidence", () => {
  const fixture = publicationFixture();
  const published = fixture.index.types;
  const text = product.printProgramIndex(fixture.index);
  const factsCopy = product.parseProgramIndex(text);
  const checkedCopy = product.parseProgramIndex(text);
  assert.equal(factsCopy.kind, "parsed");
  assert.equal(checkedCopy.kind, "parsed");
  assert.notEqual(factsCopy.value.types, published);
  assert.notEqual(checkedCopy.value.types, factsCopy.value.types);
  const foreign = { ...published, terms: [...published.terms, { kind: "primitive", primitive: "bool" }] };
  const finding = site => [{ rule: "shared-type-table", site, detail: [] }];
  for (const [name, facts, checked, matchesIndex, matchesModule] of [
    ["one identity", published, published, true, true],
    ["distinct Facts table", factsCopy.value.types, published, true, true],
    ["distinct checked table", published, checkedCopy.value.types, true, true],
    ["shared decoded table", factsCopy.value.types, factsCopy.value.types, true, true],
    ["independent decoded tables", factsCopy.value.types, checkedCopy.value.types, true, true],
    ["conflicting Facts table", foreign, published, false, false],
    ["conflicting checked table", published, foreign, true, false],
  ]) {
    const resources = product.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits,
      createAccount({ maximumWork: 10000, maximumResultEntries: 1000000000 }));
    const context = { ...fixture.context, resources, facts: { ...fixture.context.facts, types: facts },
      tirOf: module => module === fixture.module.module ? { ...fixture.tirInput, types: checked } : null };
    completeProgramValue(product.verifyProgramIndex(fixture.index, context),
      { kind: "complete", violations: matchesIndex ? [] : finding({ kind: "index" }) }, name);
    completeProgramValue(moduleViolations(fixture.index, fixture.module, context),
      matchesModule ? [] : finding({ kind: "module", module: fixture.module.module }), name);
  }
});

test("ir-program a missing complete instantiated chunk retains the exact absent body identity", () => {
  const fixture = publicationFixture();
  const removed = fixture.module.bodies.pop();
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "body-levels-total", site: { kind: "body", instance: removed.instance }, detail: [{ kind: "text", value: fixture.module.module }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: [
      { kind: "text", value: "template-shared-once" },
      { kind: "text", value: "chapter does not retain the complete independently required body inventory" },
    ] },
  ], "indexed membership and independent Typed chapter membership both retain their own complete findings");
});

test("ir-program a copied module publication retains every genuine identity and sharing cofinding", () => {
  const fixture = publicationFixture();
  fixture.module.tree = { ...fixture.module.tree, root: { ...fixture.module.tree.root } };
  const templateSite = { kind: "body", instance: fixture.template.instance };
  const nested = [{ kind: "text", value: "nested-template-identity" },
    { kind: "text", value: "published template is not the authentic body's canonical shared module subtree" }];
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "template-body-shared", site: templateSite, detail: [{ kind: "number", value: 0 }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: [{ kind: "text", value: "module-node-identity" },
      { kind: "text", value: "module tree does not retain its actual source and publication identity" }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: [{ kind: "text", value: "module-node-identity" },
      { kind: "text", value: "ready module root must share the independently required module template" }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: nested },
  ], "a complete equal-value copy is not the supplied canonical publication object, and the actual node site is retained");
});

test("ir-program a canonical definition in the wrong publication retains its actual module owner", () => {
  const { first, second } = pairedPublications();
  first.index.modules[0].items.push({ definition: second.definition, node: 0 });
  completeProgramValue(product.verifyProgramIndex(first.index, first.context), { kind: "complete", violations: [{ rule: "definition-node-owner-exact",
    site: { kind: "definition", definition: second.definition }, detail: [{ kind: "text", value: first.module.module }, { kind: "number", value: 0 }] },
    ...[second.template.instance, second.instance].flatMap(instance => [
      { rule: "body-owner-resolves", site: { kind: "body", instance }, detail: [{ kind: "text", value: second.definition }] },
      { rule: "body-module-resolves", site: { kind: "body", instance }, detail: [{ kind: "text", value: second.module.module }] },
    ]),
    { rule: "item-definition-resolves", site: { kind: "definition", definition: second.definition }, detail: [{ kind: "number", value: 0 }] }] },
  "an exact canonical identity still cannot be published in a different module's definition inventory");
});

test("ir-program complete relational member references retain field, method and closed-array selections", async () => {
  const fixture = publicationFixture();
  const facts = fixture.selected.facts[0];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const advertised = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  const getter = { decision: { candidate: 0, advertised, api: { ...advertised, role: "api-signature" }, bindings,
    implementationBindings: bindings, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
  activation: fixture.instance };
  const member = { decision: { key: { kind: "text", value: "selected" }, origins: [], selectedDeclarations: [], primary: null,
    read: 0, write: null, getter: advertised, setter: null, bindings, location: { kind: "accessor" } }, getter, setter: null };
  facts.arena.projections = [{ id: 0, parent: null, projection: { kind: "field", member } },
    { id: 1, parent: null, projection: { kind: "method-value", member } }];
  facts.closedArrays = [{ node: 0, kind: "closed", declarations: [], references: [], literals: [], elements: [member] }];
  fixture.answers.set(encodeContextKey(["sourceBindingScopesOf", { kind: "body", execution: { instance: fixture.instance, provided: 0 } }]), new Array(3).fill(fixture.scope));
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [],
    "every complete selected record is checked without replaying semantic analysis or losing the exact activation identity");
  const { prepareSummary } = await import("../../packages/host/dist/ir-program/instantiate-facts.js");
  const { prepareSelection } = await import("../../packages/host/dist/ir-program/instantiate-phase.js");
  const { createProjectionInventory, drainProjectionInventory, summaryBindingsOf } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { createInstantiationMeter, ProgramWork } = await import("../../packages/host/dist/ir-program/work.js");
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000 };
  const identity = value => value;
  const lookup = { parameterBinding: identity, selfBinding: identity };
  const scan = (visit, bounds = limits) => {
    const meter = createInstantiationMeter(bounds);
    const inventory = createProjectionInventory(meter, lookup, path => assert.fail(path));
    const prepared = visit(inventory);
    const stop = prepared.kind === "refused" ? prepared.stop : drainProjectionInventory(inventory);
    return { stop, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created,
      project: stop === null ? prepared.value : null };
  };
  const original = fixture.index.summaries.find(summary => summary.key.kind === "body"
    && summary.key.execution.instance === fixture.instance);
  assert.ok(original);
  const paths = [...facts.arena.projections, { id: 2, parent: null, projection: { kind: "deref" } },
    { id: 3, parent: 2, projection: { kind: "element" } }, { id: 4, parent: 3, projection: { kind: "index", constant: 0n } }];
  const projected = { ...original, arena: { ...original.arena, projections: paths } };
  const base = scan(inventory => prepareSummary(inventory, original, summaryBindingsOf(original.key)));
  const selection = scan(inventory => prepareSelection(inventory, member));
  assert.equal(base.stop, null);
  assert.equal(selection.stop, null);
  const work = base.work + 2 * (selection.work + 7) + 3 * 2;
  const created = base.created + 2 * (selection.created + 2);
  const visited = inventory => prepareSummary(inventory, projected, summaryBindingsOf(projected.key));
  const exact = scan(visited, { ...limits, maximumWork: work, maximumCreatedRecords: created });
  assert.deepEqual({ stop: exact.stop, work: exact.work, created: exact.created }, { stop: null, work, created });
  assert.deepEqual(scan(visited, { ...limits, maximumWork: work - 1 }).stop,
    { kind: "resource-limit", dimension: "work", maximum: work - 1 });
  assert.deepEqual(scan(visited, { ...limits, maximumCreatedRecords: created - 1 }).stop,
    { kind: "resource-limit", dimension: "created-records", maximum: created - 1 });
  const rewrite = { type: type => type + 1, signature: identity };
  const rewritten = exact.project(rewrite).arena.projections;
  assert.equal(rewritten.slice(2).every((row, position) => row === paths[position + 2]), true);
  assert.deepEqual(rewritten.slice(0, 2).map(row => [row.id, row.parent, row.projection.kind, row.projection.member.decision.read]),
    [[0, null, "field", 1], [1, null, "method-value", 1]]);
});

test("Program pays mixed Summary and application rows before pulling the actual next operand", async () => {
  const { prepareApplication } = await import("../../packages/host/dist/ir-program/instantiate-phase.js");
  const { prepareSummary } = await import("../../packages/host/dist/ir-program/instantiate-facts.js");
  const { createProjectionInventory, drainProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { fixture, definition, alternative, summary } = declaredInvocationFixture();
  const application = alternative.resolution.decision;
  const binding = { kind: "bound", parameter: typeParameterDeclaration(definition, 0), type: tyId(0) };
  const bindings = { classBindings: [], methodBindings: [binding], capturedBindings: [], selfBindings: [] };
  const selected = { kind: "instantiated", bindings };
  const location = { kind: "node", node: { kind: "body", value: { body: fixture.bodyId, node: 0 } } };
  const member = { decision: {
    key: { kind: "text", value: "slot" }, origins: [], selectedDeclarations: [], primary: null,
    read: tyId(0), write: null, getter: null, setter: null, bindings,
    location: { kind: "data", check: { kind: "none" }, receiver: "in-place" },
  }, getter: null, setter: null };
  const bound = { id: 0, producer: 0, context: 0, bindings };
  const boundary = { id: 0, kind: "external-input", at: location, subject: 0, owner: null, context: 0, detail: "authored", bindings };
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000, maximumCreatedRecords: 10000 };
  const identity = value => value;
  const rewrite = { type: original => tyId(original + 2), signature: identity };
  const fields = {
    summary(scan, tagged) {
      const arena = { ...summary.arena, boundProducers: [bound], boundaries: [boundary],
        producers: [{ kind: "shared", id: 0, path: null, definition }],
        contexts: [{ id: 0, receiver: null, arguments: [], captures: [] }],
        projections: tagged([{ id: 0, parent: null, projection: { kind: "field", member } },
          { id: 1, parent: null, projection: { kind: "element" } }]) };
      return prepareSummary(scan, { ...summary, arena }, selected);
    },
    application(scan, tagged) {
      return prepareApplication(scan, { ...application, parameters: tagged([
        { kind: "omitted", parameter: 0, type: tyId(0) },
        { kind: "argument", parameter: 1, argument: 0, component: null, passing: "by-value" },
      ]) });
    },
  };
  for (const [kind, plan] of Object.entries(fields)) {
    const run = bounds => {
      const meter = createInstantiationMeter(bounds);
      const scan = createProjectionInventory(meter, { parameterBinding: identity, selfBinding: identity }, path => assert.fail(path));
      const pulls = [];
      let readable = true;
      const tagged = values => {
        const rows = [];
        for (const [index, value] of values.entries()) Object.defineProperty(rows, index, { get() {
          assert.equal(readable, true);
          pulls.push({ index, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created });
          return value;
        } });
        return rows;
      };
      const prepared = plan(scan, tagged);
      const stop = prepared.kind === "refused" ? prepared.stop : drainProjectionInventory(scan);
      const original = meter.failure ?? accountFailure(meter.account);
      if (stop !== null) return { stop, original, pulls };
      readable = false;
      const value = prepared.value(rewrite);
      return { stop: null, pulls, value, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created };
    };
    const success = run(limits);
    assert.equal(success.stop, null);
    assert.deepEqual(success.pulls.map(row => row.index), [0, 1]);
    const [first, second] = success.pulls;
    const tie = run({ ...limits, maximumWork: first.work - 1, maximumCreatedRecords: first.created });
    assert.equal(tie.stop === tie.original && tie.stop.dimension === "work", true, kind);
    assert.deepEqual(tie.pulls, []);
    const retained = run({ ...limits, maximumWork: first.work, maximumCreatedRecords: first.created });
    assert.equal(retained.stop === retained.original && retained.stop.dimension === "created-records", true, kind);
    assert.deepEqual(retained.pulls, [first]);
    const later = run({ ...limits, maximumWork: second.work - 1 });
    assert.equal(later.stop === later.original && later.stop.dimension === "work", true, kind);
    assert.deepEqual(later.pulls, [first]);
    assert.equal(run({ ...limits, maximumWork: success.work, maximumCreatedRecords: success.created }).stop, null);
    if (kind === "summary") {
      assert.equal(success.value.arena.boundaries[0].at === location, true);
      assert.equal(success.value.arena.boundaries[0].bindings.methodBindings[0].type, 2);
      assert.equal(success.value.arena.boundProducers[0].bindings.methodBindings[0].type, 2);
      assert.equal(success.value.arena.projections[0].projection.member.decision.read, 2);
    } else {
      assert.deepEqual(success.value.parameters.map(row => [row.kind, row.parameter, row.type]),
        [["omitted", 0, 2], ["argument", 1, undefined]]);
    }
  }
});

test("TIR application retains paid spread tuples and borrows its actual value and absence rows", async () => {
  const { prepareTirApplication } = await import("../../packages/host/dist/ir-program/instantiate-phase.js");
  const { createProjectionInventory, drainProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { fixture, alternative } = declaredInvocationFixture();
  const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 10000, maximumCreatedRecords: 10000 };
  const identity = value => value;
  const run = bounds => {
    const meter = createInstantiationMeter(bounds);
    const scan = createProjectionInventory(meter, { parameterBinding: identity, selfBinding: identity }, path => assert.fail(path));
    const pulls = [];
    let readable = true;
    const pull = (label, value) => {
      assert.equal(readable, true, label);
      pulls.push({ label, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created });
      return value;
    };
    const tagged = (label, values) => {
      const rows = [];
      for (const [index, value] of values.entries())
        Object.defineProperty(rows, index, { get: () => pull(label + index, value) });
      return rows;
    };
    const spread = { kind: "spread", expression: nodeId(1), get tuple() { return pull("tuple", tagged("element", [tyId(0)])); } };
    const nullSpread = { kind: "spread", expression: nodeId(3), get tuple() { return pull("null tuple", null); } };
    const provided = { kind: "provided", parameter: 0, expression: nodeId(0) };
    const rest = { kind: "rest", parameter: 1, parts: tagged("part", [spread, { kind: "value", expression: nodeId(2) }, nullSpread]) };
    const omitted = { kind: "omitted", parameter: 2, value: { kind: "absence" } };
    const result = prepareTirApplication(scan, { callee: alternative.resolution, receiver: null, arguments: tagged("arg", [provided, rest, omitted]) }, "transport");
    const stop = result.kind === "refused" ? result.stop : drainProjectionInventory(scan);
    if (stop !== null) return { stop, original: meter.failure ?? accountFailure(meter.account), pulls };
    readable = false;
    const value = result.value({ type: type => tyId(type + 2), signature: identity });
    return { stop, pulls, value, provided, omitted, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created };
  };
  const full = run(limits);
  assert.equal(full.stop, null);
  assert.deepEqual(full.pulls.map(row => row.label), ["arg0", "arg1", "part0", "tuple", "element0", "part1", "part2", "null tuple", "arg2"]);
  assert.equal(full.value.arguments[0] === full.provided, true);
  assert.equal(full.value.arguments[2] === full.omitted, true);
  assert.deepEqual(full.value.arguments[1].parts.map(part => [part.kind, part.expression, part.tuple]),
    [["spread", 1, [2]], ["value", 2, undefined], ["spread", 3, null]]);
  const spread = full.pulls[2];
  const tie = run({ ...limits, maximumWork: spread.work - 1, maximumCreatedRecords: spread.created });
  assert.equal(tie.stop === tie.original && tie.stop.dimension === "work", true);
  assert.deepEqual(tie.pulls, full.pulls.slice(0, 2));
  const retained = run({ ...limits, maximumWork: spread.work, maximumCreatedRecords: spread.created });
  assert.equal(retained.stop === retained.original && retained.stop.dimension === "created-records", true);
  assert.deepEqual(retained.pulls, full.pulls.slice(0, 3));
  const last = full.pulls.at(-1);
  const later = run({ ...limits, maximumWork: last.work - 1 });
  assert.equal(later.stop === later.original && later.stop.dimension === "work", true);
  assert.deepEqual(later.pulls, full.pulls.slice(0, -1));
  assert.equal(run({ ...limits, maximumWork: full.work, maximumCreatedRecords: full.created }).stop, null);
});

test("final Summary projection orders the actual qualified retention at two distinct finite exits", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { projectSummary } = await import("../../packages/host/dist/ir-program/canonical-facts.js");
  const { publicationRewrite } = await import("../../packages/host/dist/ir-program/canonical-types.js");
  const { createProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal",
    "export function choose(flag:boolean,left:string,right:string):string{if(flag){return left;}throw right;}");
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const account = createAccount(input.limits.dataflow);
  const typed = typeSourceBarrier(input, source.value, account);
  assert.equal(typed.kind, "ok");
  const analyzed = analyzeTypedSource(input, typed.value, account);
  assert.equal(analyzed.kind, "ok");
  const originals = [...analyzed.value.summaries.values()].map(answer => answer.value)
    .filter(summary => !("kind" in summary) && summary.retention.length === 2);
  assert.equal(originals.length, 1);
  const [original] = originals;
  assert.strictEqual(analyzed.value.verification.summaryOf(original.key), original);
  assert.deepEqual(original.retention.map(row => [row.source, row.into.kind, row.at.point]),
    [[0, "return", { block: 1, statement: null }], [1, "throw", { block: 2, statement: null }]]);
  const publication = typeProduct.exportTypes(source.value.types, input.limits.instantiation);
  assert.equal(publication.kind, "complete");
  const rewrite = publicationRewrite(publication.value);
  const project = (maximumWork, maximumCreatedRecords) => {
    const borrowed = createAccount({ ...input.limits.dataflow, maximumWork });
    const resources = product.createProgramVerificationWork({ ...input.limits.instantiation, maximumCreatedRecords }, borrowed);
    const meter = ProgramWork.state(resources);
    const scan = createProjectionInventory(meter, rewrite, path => assert.fail(path));
    const outcome = projectSummary(scan, rewrite, original);
    return { outcome, work: maximumWork - remainingWork(borrowed), records: meter.created,
      stop: meter.failure ?? accountFailure(borrowed) };
  };
  const exact = project(558, 28);
  assert.equal(exact.outcome.kind, "copied");
  assert.deepEqual([exact.work, exact.records], [558, 28]);
  assert.deepEqual(exact.outcome.value.retention, original.retention);
  assert.equal(exact.outcome.value.signature, publication.value.signatures[original.signature]);
  assert.notStrictEqual(exact.outcome.value.retention[0], original.retention[0]);
  for (const [work, records, dimension] of [[557, 28, "work"], [558, 27, "created-records"]]) {
    const stopped = project(work, records);
    assert.equal(stopped.outcome.kind === "refused" && stopped.outcome.stop === stopped.stop, true);
    assert.equal(stopped.outcome.stop.dimension, dimension);
    assert.equal("value" in stopped.outcome, false);
  }
});

test("canonical body ordering admits the second key only on an equal group", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const fixture = publicationFixture();
  const foreignGroup = publicationFixture(moduleFixture("src/é.ts"));
  const [template, selected] = fixture.index.bodies;
  const otherSelected = foreignGroup.index.bodies.find(row => row.kind === "selected");
  const limits = ProgramWork.state(fixture.context.resources).limits;
  const exported = typeProduct.exportTypes(admitFixtureTable(typeProduct, fixture.index.types),
    { maximumWork: 100000, maximumCreatedRecords: 100000 });
  assert.equal(exported.kind, "complete");
  assert.ok(template.instance.body < otherSelected.instance.body && otherSelected.instance.body.includes("é"),
    "the canonical qualified group retains its UTF-16 text order");
  const key = row => encodeKey(artifactBindingsData(row.instance.bindings));
  assert.notEqual(key(template), key(selected));
  const secondaryOrder = key(template) < key(selected) ? [template, selected] : [selected, template];
  const anchor = (rows, maximumWork) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 100000 });
    const resources = product.createProgramVerificationWork(limits, account);
    const reads = [];
    const usage = () => InvocationAccount.stateOf(account).work;
    const index = { ...fixture.index, signatures: [], bodies: rows, metadata: [], summaries: [], constants: [],
      get dependencyInventory() { reads.push(usage()); return { operations: [], dependencies: [], components: [] }; },
      initialization: { entry: fixture.index.initialization.entry, external: [], modules: [], entries: [] } };
    const result = product.canonicalizeProgram({ index, modules: [] }, exported.value, resources, { kind: "data-only" });
    return { result, work: usage(), reads, stop: accountFailure(account) };
  };
  const afterCompare = 1 + (1 + 2) + 1 + (1 + 4);
  const groups = [
    { rows: [otherSelected, template], expected: [template, otherSelected], same: false },
    { rows: [...secondaryOrder].reverse(), expected: secondaryOrder, same: true },
  ];
  for (const { rows, expected, same } of groups) {
    const groupUnits = rows.reduce((units, row) => units + row.instance.body.length, 0);
    const keyUnits = rows.reduce((units, row) => units + key(row).length, 0);
    const full = anchor(rows, 100000);
    assert.equal(full.result.kind, "complete");
    assert.deepEqual(full.result.value.index.bodies, expected);
    assert.equal(full.reads.length, 1);
    const prefix = full.reads[0] - afterCompare - groupUnits - (same ? keyUnits : 0);
    const refused = (maximumWork, spent) => {
      const cut = anchor(rows, maximumWork);
      assert.equal(cut.result === cut.stop, true);
      assert.deepEqual(cut.stop, { kind: "resource-limit", dimension: "work", maximum: maximumWork });
      assert.equal(cut.work, spent);
      assert.deepEqual(cut.reads, []);
      assert.equal("value" in cut.result || "image" in cut.result, false);
    };
    refused(prefix + groupUnits - 1, prefix);
    const groupPaid = prefix + groupUnits;
    if (same) {
      refused(groupPaid, groupPaid);
      refused(groupPaid + keyUnits - 1, groupPaid);
      refused(groupPaid + keyUnits, groupPaid + keyUnits);
    } else {
      refused(groupPaid, groupPaid);
      const firstMove = anchor(rows, groupPaid + 1);
      assert.equal(firstMove.result === firstMove.stop, true);
      assert.equal(firstMove.work, groupPaid + 1);
      assert.deepEqual(firstMove.reads, []);
    }
    const exact = anchor(rows, full.work);
    assert.equal(exact.result.kind, "complete");
    assert.deepEqual(exact.reads, full.reads);
    assert.equal(product.printProgramIndex(exact.result.value.index), product.printProgramIndex(full.result.value.index));
  }
});

test("stable text merge clears reused span starts and pays only metadata consumed by a later pass", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { compareText, copiedProjection, createProjectionInventory, orderProjection, orderTextProjection } =
    await import("../../packages/host/dist/ir-program/program-values.js");
  const limits = ProgramWork.state(publicationFixture().context.resources).limits;
  const run = (rows, maximumWork = 10000, maximumCreatedRecords = 10000, scalar = false) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 10000 });
    const meter = ProgramWork.state(product.createProgramVerificationWork({ ...limits, maximumCreatedRecords }, account));
    const scan = createProjectionInventory(meter, { parameterBinding: row => row, selfBinding: row => row }, assert.fail);
    const reads = [];
    const source = [];
    for (const [position, row] of rows.entries()) Object.defineProperty(source, position, { get() {
      reads.push(position);
      return row;
    } });
    const compare = (left, right) => copiedProjection(compareText(left.group, right.group) || compareText(left.key, right.key));
    const result = scalar ? orderProjection(scan, source.slice(), compare)
      : orderTextProjection(scan, source, row => copiedProjection({ value: row, group: row.group, key: row.key }));
    return { result, work: InvocationAccount.stateOf(account).work, records: meter.created, reads, stop: meter.failure ?? accountFailure(account) };
  };
  const [copied, twin] = [{ group: "b", key: "x", occurrence: "first" }, { group: "b", key: "x", occurrence: "second" }];
  const rows = [copied, twin, ...["d", "f", "a", "c", "e", "g", "aa"].map(group => ({ group, key: "x", occurrence: group }))];
  const expected = ["a", "aa", "first", "second", "c", "d", "e", "f", "g"];
  const tailSorted = run(rows);
  assert.equal(tailSorted.result.kind, "copied");
  assert.deepEqual(tailSorted.result.value.map(row => row.occurrence), expected);
  assert.strictEqual(tailSorted.result.value[2], copied);
  assert.strictEqual(tailSorted.result.value[3], twin);
  assert.deepEqual(tailSorted.reads, rows.map((_, index) => index));
  const baseRecords = 1 + rows.length + 1 + 1;
  assert.equal(tailSorted.records, baseRecords + 2 + 2 + 1);
  const opaque = run(rows, 10000, 10000, true);
  assert.equal(opaque.work, 1 + 4 * rows.length);
  assert.equal(opaque.records, 1);
  assert.deepEqual(opaque.result.value.map(row => row.occurrence), expected);

  const empty = rows.map(({ occurrence }, index) => ({ group: "", key: index === 0 ? "\u{10000}" : "\ue000", occurrence }));
  const emptySorted = run(empty);
  assert.equal(emptySorted.records, baseRecords);
  assert.deepEqual(emptySorted.result.value, empty);
  const paired = run([copied, twin]);
  assert.equal(paired.records, 1 + 2 + 1 + 1);
  assert.strictEqual(paired.result.value[0], copied);
  assert.strictEqual(paired.result.value[1], twin);

  const exact = run(rows, tailSorted.work, tailSorted.records);
  assert.equal(exact.result.kind, "copied");
  assert.deepEqual(exact.result.value.map(row => row.occurrence), expected);
  for (const [work, records, dimension] of [
    [0, 0, "work"], [1, 0, "created-records"], [tailSorted.work - 1, tailSorted.records, "work"],
    [tailSorted.work, tailSorted.records - 1, "created-records"],
  ]) {
    const under = run(rows, work, records);
    assert.equal(under.result.kind === "refused" && under.result.stop === under.stop, true);
    assert.equal(under.result.stop.dimension, dimension);
    assert.equal("value" in under.result, false);
    assert.deepEqual(under.reads, tailSorted.reads.slice(0, under.reads.length));
  }
});

test("final member evidence maps actual constructor correspondences into their sorted signature domain", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { checkedSourceViews } = await import("../../packages/host/dist/pipeline/checked-inputs.js");
  const { membersOf, placeSignature } = await import("../../packages/host/dist/decls/index.js");
  const fixture = await loadFrontFixture();
  const constructors = Array.from({ length: 12 }, (_, position) => `new(value: ${position % 2 === 0 ? "boolean" : "string"}): object;`);
  const input = analysisInput(fixture, "sdk-minimal", `export type Before = { new(): object; };
export type Inventory = {
  readonly flag: boolean;
  readonly [key: string]: boolean;
  [index: number]: boolean;
  (value: boolean): boolean;
  (value: string): string;
  ${constructors.join("\n  ")}
};
export type After = { new(): object; };
export function echo(value: Inventory): boolean { return value.flag; }
export const storage: boolean = true;`);
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok");
  const { modules, types, typeWork } = source.value;
  const { module } = modules.find(row => row.module.module === input.snapshot.entryPoint);
  const [, alias, , callable, variables] = module.tree.statements.nodes;
  const deps = { modules, types, typeWork, typeExpansion: input.limits.instantiation.typeExpansion };
  const member = membersOf(deps, alias.type.tsonic.type.value);
  assert.equal(member.value.kind, "ok");
  const inventory = member.value.value;
  const authoredBody = module.bodies.find(row => row.body === callable.tsonic.body);
  const expression = authoredBody.root.statements.nodes[0].expression;
  assert.equal(expression.kind, "PropertyAccessExpression");
  const instance = { body: authoredBody.body, bindings: { kind: "parametric" } };
  const occurrence = { kind: "selection", node: expression.id, ordinal: 0 };
  const signature = placeSignature(deps, { kind: "callable-body", parts: [], instance },
    { query: "placement", key: instance.body }, checkedSourceViews(modules).cuts);
  assert.equal(signature.value.kind, "ok");
  const placed = signature.value.value;
  const [variable] = variables.declarationList.declarations.nodes;
  const declaration = { owner: variable.tsonic.declaration.definition, node: variable.id };
  const storage = variable.tsonic.declaredType.value;
  const limits = input.limits.instantiation;
  const published = typeProduct.exportTypes(types, limits);
  assert.equal(published.kind, "complete");
  const publication = published.value;
  const image = raw => publication.signatures[raw];
  assert.notEqual(image(inventory.constructors[0].signature), inventory.constructors[0].signature);
  assert.ok(image(inventory.constructors[0].signature) > image(inventory.constructors[6].signature));
  const run = (maximumWork, maximumCreatedRecords) => {
    const account = createAccount({ maximumWork, maximumResultEntries: input.limits.dataflow.maximumResultEntries });
    const resources = product.createProgramVerificationWork({ ...limits, maximumCreatedRecords }, account);
    const meter = ProgramWork.state(resources);
    const reads = [];
    const authors = [];
    for (const [position, row] of inventory.constructors.entries()) Object.defineProperty(authors, position, { get() {
      reads.push({ position, work: maximumWork - remainingWork(account), records: meter.created });
      return row;
    } });
    let beforeConstructors = null;
    let afterConstructors = null;
    const usage = () => ({ work: maximumWork - remainingWork(account), records: meter.created });
    const traced = { ...inventory, get constructors() { beforeConstructors = usage(); return authors; } };
    const evidence = { checked: [module], members: [{ instance, occurrence, inventory: traced }],
      get signatures() { afterConstructors = usage(); return [placed]; }, storage: [{ declaration, storage }] };
    const result = product.canonicalizeProgram(programForEvidence(publicationFixture().index), publication, resources,
      { kind: "with-evidence", read: actual => {
        assert.equal(actual === account, true);
        return { kind: "complete", value: evidence };
      } });
    return { result, reads, beforeConstructors, afterConstructors, stop: meter.failure ?? accountFailure(account), ...usage() };
  };
  const full = run(limits.maximumWork, limits.maximumCreatedRecords);
  assert.equal(full.result.kind, "complete");
  const [row] = full.result.evidence.members;
  assert.strictEqual(row.occurrence, occurrence);
  const expected = inventory.constructors.map(prior => ({ ...prior, signature: image(prior.signature) }))
    .sort((left, right) => left.signature - right.signature);
  assert.deepEqual(row.inventory.constructors, expected);
  assert.deepEqual(row.inventory.constructs, expected.map(record => record.signature));
  assert.deepEqual(publication.table.terms[row.inventory.receiver].constructs, row.inventory.constructs);
  for (const mapped of row.inventory.constructors)
    assert.equal(publication.table.signatures[mapped.signature].declaration, mapped.declaration);
  assert.deepEqual(full.result.evidence.signatures, [{ request: placed.request, signature: image(placed.signature.id) }]);
  assert.deepEqual(full.result.evidence.storage, [{ declaration, storage: publication.types[storage] }]);
  assert.equal(full.reads.length, inventory.constructors.length);
  const added = inventory.constructors.length;
  assert.deepEqual(full.afterConstructors, { work: full.beforeConstructors.work + 2 + (4 + 4) * added,
    records: full.beforeConstructors.records + 2 + added });
  const exact = run(full.work, full.records);
  assert.deepEqual(exact.reads, full.reads);
  assert.equal(exact.result.kind, "complete");
  for (let position = 0; position < full.reads.length; position += 1) {
    const read = full.reads[position];
    assert.equal(read.position, position);
    if (position > 0) {
      assert.equal(read.work - full.reads[position - 1].work, 4);
      assert.equal(read.records - full.reads[position - 1].records, 1);
    }
    for (const [work, records, dimension] of [[read.work - 1, full.records, "work"], [full.work, read.records - 1, "created-records"]]) {
      const cut = run(work, records);
      assert.equal(cut.result === cut.stop && cut.result.dimension === dimension, true);
      assert.deepEqual(cut.reads, full.reads.slice(0, position));
      assert.equal(cut.afterConstructors, null);
      assert.equal("value" in cut.result, false);
    }
  }
  const last = full.reads.at(-1);
  for (const [work, records, dimension] of [[full.work, last.records, "created-records"], [last.work + 2, full.records, "work"]]) {
    const cut = run(work, records);
    assert.equal(cut.result === cut.stop && cut.result.dimension === dimension, true);
    assert.deepEqual(cut.reads, full.reads);
    assert.equal(cut.afterConstructors, null);
    assert.equal("value" in cut.result, false);
  }
});

test("final publication constructs its candidate before requesting independent checked evidence", async () => {
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", "export function negate(flag: boolean): boolean { return !flag; }");
  const run = maximumCreatedRecords => {
    const source = captureSourceBarrier(input);
    assert.equal(source.kind, "ok");
    const account = createAccount(input.limits.dataflow);
    const typed = typeSourceBarrier(input, source.value, account);
    assert.equal(typed.kind, "ok");
    const actual = source.value.modules.find(row => row.module.module === input.snapshot.entryPoint).module;
    const node = indexSyntaxTree(actual.tree).find(value => value.kind === "PrefixUnaryExpression");
    const original = node.operand;
    const originalRoot = actual.bodies.find(row => row.root.kind === "Block").root;
    const publication = typeProduct.exportTypes(source.value.types, input.limits.instantiation);
    assert.equal(publication.kind, "complete");
    const resources = product.createProgramVerificationWork({ ...input.limits.instantiation, maximumCreatedRecords }, account);
    const meter = ProgramWork.state(resources);
    let atEvidence = null;
    let acquisitions = 0;
    let lateDiscriminators = 0;
    Object.defineProperty(node, "operand", { get() {
      assert.equal(atEvidence, null, "no candidate operand is acquired after the independent producer opens");
      acquisitions += 1;
      return original;
    } });
    const candidate = { ...programForEvidence(publicationFixture().index), modules: [
      { module: actual.module, tree: { kind: "checked-root", root: actual.tree }, bodies: [] },
    ] };
    const result = product.canonicalizeProgram(candidate, publication.value, resources, { kind: "with-evidence", read: owner => {
      assert.equal(owner === account, true);
      assert.equal(atEvidence, null);
      atEvidence = meter.created;
      const evidence = typed.value.programEvidence(owner);
      const kind = originalRoot.kind;
      Object.defineProperty(originalRoot, "kind", { get() {
        lateDiscriminators += 1;
        return kind;
      } });
      return evidence;
    } });
    return { result, acquisitions, lateDiscriminators, atEvidence, stop: meter.failure, original: original.id };
  };
  const full = run(input.limits.instantiation.maximumCreatedRecords);
  assert.equal(full.result.kind, "complete");
  assert.equal(full.atEvidence !== null && full.acquisitions > 0, true);
  assert.equal(full.lateDiscriminators, 0, "ready body evidence must not dispatch on its already-admitted original node");
  const tree = full.result.value.modules[0].tree.root;
  assert.equal(full.result.evidence.checked.some(row => row.module.tree === tree), true);
  assert.equal(indexSyntaxTree(tree).find(value => value.kind === "PrefixUnaryExpression").operand.id, full.original);
  const stopped = run(full.atEvidence - 1);
  assert.equal(stopped.result === stopped.stop && stopped.stop?.dimension === "created-records", true);
  assert.equal(stopped.atEvidence, null);
});

test("ordinary required expression slots retain their sole paid Typed read across independent publication evidence", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { publishHostProgram } = await import("../../packages/host/dist/pipeline/publication.js");
  const fixture = await loadFrontFixture();
  const run = maximumWork => {
    const input = analysisInput(fixture, "sdk-minimal", "export function keep(flag:boolean):boolean { return (flag); }");
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const account = createAccount({ ...input.limits.dataflow, maximumWork: maximumWork ?? input.limits.dataflow.maximumWork });
    const typed = typeSourceBarrier(input, captured.value, account);
    assert.equal(typed.kind, "ok");
    const analyzed = analyzeTypedSource(input, typed.value, account);
    assert.equal(analyzed.kind, "ok");
    const original = [...typed.value.bodies.values()].find(body => body.root.kind === "Block" && body.bindings.kind === "instantiated");
    const returned = original.root.statements.nodes[0];
    const parenthesized = returned.expression;
    assert.equal(parenthesized.kind, "ParenthesizedExpression");
    const authored = parenthesized.expression;
    const reads = [];
    let opened = false;
    const observe = (field, value) => {
      assert.equal(opened, false, "a sealed constructor does not read its original child after the independent callback");
      reads.push({ field, work: InvocationAccount.stateOf(account).work });
      return value;
    };
    Object.defineProperty(returned, "expression", { get: () => observe("return", parenthesized) });
    Object.defineProperty(parenthesized, "expression", { get: () => observe("parenthesis", authored) });
    const result = publishHostProgram(input, { ...typed.value, programEvidence: actual => {
      assert.equal(actual === account, true);
      opened = true;
      return typed.value.programEvidence(actual);
    } }, analyzed.value, account);
    return { result, opened, reads, fail: accountFailure(account), body: original.body, module: input.snapshot.entryPoint, node: authored.id };
  };
  const full = run();
  assert.equal(full.result.kind, "ok", JSON.stringify(full.result.diagnostics));
  assert.equal(full.opened, true);
  assert.deepEqual(full.reads.map(row => row.field), ["return", "parenthesis"]);
  const chapter = full.result.value.modules.find(module => module.module === full.module);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === full.body);
  assert.equal(body.tir.root.statements.nodes[0].expression.expression.id, full.node);
  for (let position = 0; position < full.reads.length; position += 1) {
    const maximum = full.reads[position].work - 1;
    const cut = run(maximum);
    assert.deepEqual(cut.fail, { kind: "resource-limit", dimension: "work", maximum });
    assert.equal(cut.result.kind, "refused");
    assert.equal(cut.opened, false);
    assert.deepEqual(cut.reads, full.reads.slice(0, position));
  }
});

test("Program seals actual Typed call fields and paid argument rows before independent evidence", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { publishHostProgram } = await import("../../packages/host/dist/pipeline/publication.js");
  const fixture = await loadFrontFixture();
  const input = analysisInput(fixture, "sdk-minimal", [
    "function second<Value>(left:Value,right:Value):Value { return right; }",
    "export function keep(left:boolean,right:boolean):boolean { return second<boolean>(left,right); }",
  ].join("\n"));
  const run = maximumWork => {
    const captured = captureSourceBarrier(input);
    assert.equal(captured.kind, "ok");
    const account = createAccount({ ...input.limits.dataflow, maximumWork: maximumWork ?? input.limits.dataflow.maximumWork });
    const typed = typeSourceBarrier(input, captured.value, account);
    assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
    const analyzed = analyzeTypedSource(input, typed.value, account);
    assert.equal(analyzed.kind, "ok", JSON.stringify(analyzed.diagnostics));
    const original = [...typed.value.bodies.values()].find(body => body.root.kind === "Block" && body.bindings.kind === "instantiated" &&
      body.root.statements.nodes[0]?.expression?.kind === "CallExpression");
    const call = original.root.statements.nodes[0].expression;
    const args = call.arguments;
    const types = call.typeArguments;
    assert.equal(types.nodes.length, 1);
    assert.equal(args.nodes.length, 2);
    const originalNodes = args.nodes.map(node => node.id);
    const originalType = types.nodes[0].id;
    let opened = false;
    const reads = [];
    const watch = (owner, field, label, ordinary = owner[field]) => Object.defineProperty(owner, field, { get() {
      assert.equal(opened, false, label);
      reads.push({ label, work: InvocationAccount.stateOf(account).work });
      return ordinary;
    } });
    watch(call, "expression", "callee");
    watch(call, "questionDotToken", "chain presence");
    watch(call, "typeArguments", "type header");
    watch(call, "arguments", "value header");
    watch(types, "loc", "type range");
    watch(args, "loc", "value range");
    watch(types.nodes, 0, "type row");
    watch(args.nodes, 0, "value row 0");
    watch(args.nodes, 1, "value row 1");
    watch(types, "nodes", "type vector");
    watch(args, "nodes", "value vector");
    const result = publishHostProgram(input, { ...typed.value, programEvidence: owner => {
      assert.equal(owner === account, true);
      opened = true;
      return typed.value.programEvidence(owner);
    } }, analyzed.value, account);
    return { result, opened, reads, fail: accountFailure(account), body: original.body, originalNodes, originalType };
  };
  const full = run();
  assert.equal(full.result.kind, "ok", JSON.stringify(full.result.diagnostics));
  assert.equal(full.opened, true);
  assert.deepEqual(full.reads.map(row => row.label), [
    "type header", "value header", "callee", "chain presence", "type vector", "type range", "type row", "value vector", "value range", "value row 0", "value row 1",
  ]);
  const chapter = full.result.value.modules.find(module => module.module === input.snapshot.entryPoint);
  const body = chapter.bodies.find(row => row.kind === "selected" && row.tir.body === full.body);
  const call = body.tir.root.statements.nodes[0].expression;
  assert.deepEqual(call.arguments.nodes.map(node => node.id), full.originalNodes);
  assert.equal(call.typeArguments.nodes[0].id, full.originalType);
  for (const label of ["value header", "callee", "type row", "value row 0", "value row 1"]) {
    const expected = full.reads.find(read => read.label === label);
    const maximum = expected.work - 1;
    const cut = run(maximum);
    assert.deepEqual(cut.fail, { kind: "resource-limit", dimension: "work", maximum });
    assert.equal(cut.result.kind, "refused");
    assert.equal(cut.opened, false);
    assert.deepEqual(cut.reads, full.reads.filter(read => read.work <= maximum));
  }
});

test("Program transports the exact verified construction-part and its independent Decls inventory", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { indexSyntaxTree } = await import("../../packages/host/dist/ir-hir/index.js");
  const { membersOf } = await import("../../packages/host/dist/decls/index.js");
  const { verifyTir } = await import("../../packages/host/dist/ir-tir/index.js");
  const fixture = memberScenario("construction");
  const limits = { maximumWork: 10000, maximumCreatedRecords: 1000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 8, maximumVisits: 128, maximumUnionMembers: 8, maximumIntersectionMembers: 8 } };
  const types = admitFixtureTable(typeProduct, fixture.input.types);
  const table = typeProduct.viewTypes(types);
  const source = fixture.input.source;
  const [expected] = fixture.facts;
  const receiver = fixture.table.receiver;
  const authoredMember = fixture.input.types.terms[receiver].members[0];
  assert.strictEqual(fixture.table.members[0], authoredMember);
  assert.equal("read" in authoredMember && "write" in authoredMember, true);
  const answer = membersOf({ modules: [{ module: source, nodes: indexSyntaxTree(source.tree) }], types,
    typeWork: typeProduct.createTypePublicationWork(limits), typeExpansion: limits.typeExpansion }, receiver);
  assert.equal(answer.kind, "done");
  assert.equal(answer.value.kind, "ok");
  const inventory = answer.value.value;
  assert.equal(inventory.completeness.kind, "complete");
  assert.equal(inventory.members.length, 1);
  assert.notStrictEqual(inventory.members[0], authoredMember);
  assert.strictEqual(inventory.members[0].origins, table.terms[receiver].members[0].origins);
  assert.equal("read" in inventory.members[0] || "write" in inventory.members[0], false);
  const publication = typeProduct.exportTypes(types, limits);
  assert.equal(publication.kind, "complete");
  const [{ node: statement }] = fixture.body.root.statements.nodes;
  const [part] = statement.expression.tsonic.construction.decision.decision.operation.parts;
  const run = (maximumWork = limits.maximumWork, maximumCreatedRecords = limits.maximumCreatedRecords,
    providedOccurrence = expected.occurrence) => {
    const account = createAccount({ maximumWork, maximumResultEntries: 10000 });
    const retained = [];
    const queries = [];
    const original = { ...fixture.input, types: table, memberTableOf: (instance, occurrence) => {
      queries.push({ instance, occurrence });
      if (!isDeepStrictEqual(instance, expected.instance) || !isDeepStrictEqual(occurrence, providedOccurrence)) return null;
      retained.push({ instance, occurrence, inventory });
      return inventory;
    } };
    const verified = verifyTir(original, product.tirReadyReadAdmission(account))(fixture.body);
    if (verified.kind !== "complete" || verified.violations.length !== 0) return { verified, retained, queries };
    assert.equal(queries.length, 1);
    assert.equal(retained.length, 1);
    const [row] = retained;
    assert.strictEqual(row.instance, queries[0].instance);
    assert.strictEqual(row.occurrence, queries[0].occurrence);
    assert.strictEqual(row.occurrence.source, part.source);
    assert.strictEqual(row.occurrence.destination, part.destination);
    assert.strictEqual(row.inventory, inventory);
    const verifiedWork = InvocationAccount.stateOf(account).work;
    const resources = product.createProgramVerificationWork({ ...limits, maximumCreatedRecords }, account);
    const meter = ProgramWork.state(resources);
    const members = [];
    const reads = [];
    Object.defineProperty(members, 0, { get() {
      reads.push({ work: InvocationAccount.stateOf(account).work, created: meter.created });
      return row;
    } });
    const projected = product.canonicalizeProgram(programForEvidence(publicationFixture().index), publication.value, resources,
      { kind: "with-evidence", read: actual => {
        assert.equal(actual === account, true);
        return { kind: "complete", value: { checked: [], members, signatures: [], storage: [] } };
      } });
    return { verified, retained, projected, reads, verifiedWork, work: InvocationAccount.stateOf(account).work,
      created: meter.created, stop: meter.failure ?? accountFailure(account) };
  };
  const crossed = run(limits.maximumWork, limits.maximumCreatedRecords, { ...expected.occurrence, part: part.part + 1 });
  assert.deepEqual(crossed.retained, []);
  assert.deepEqual(crossed.queries, [{ instance: expected.instance, occurrence: expected.occurrence }]);
  assert.equal(crossed.verified.kind, "complete");
  assert.deepEqual(crossed.verified.violations.map(row => row.rule), ["member-origin"]);
  const full = run();
  assert.equal(full.projected.kind, "complete");
  assert.equal(full.reads.length, 1);
  const [original] = full.retained;
  const [projected] = full.projected.evidence.members;
  assert.deepEqual(projected, { ...original, inventory: { ...inventory, receiver: publication.value.types[receiver] } });
  assert.notStrictEqual(projected.occurrence.destination, original.occurrence.destination);
  assert.equal("read" in projected.inventory.members[0] || "write" in projected.inventory.members[0], false);
  const exact = run(full.work, full.created);
  assert.deepEqual(exact.projected.evidence, full.projected.evidence);
  assert.deepEqual(exact.reads, full.reads);
  const [first] = full.reads;
  for (const [dimension, lower, upper, firstRead] of [
    ["work", full.verifiedWork, full.work, first.work], ["created-records", 0, full.created, first.created],
  ]) {
    for (let maximum = lower; maximum < upper; maximum += 1) {
      const cut = dimension === "work" ? run(maximum, full.created) : run(full.work, maximum);
      assert.strictEqual(cut.projected, cut.stop);
      assert.equal(cut.projected.dimension, dimension);
      assert.equal("value" in cut.projected, false);
      assert.deepEqual(cut.reads, maximum < firstRead ? [] : full.reads);
    }
  }
});

test("final MIR moves a dense two-target switch through the actual nonidentity type publication", async () => {
  const { projectMirBody } = await import("../../packages/host/dist/ir-program/canonical-tir.js");
  const { publicationRewrite } = await import("../../packages/host/dist/ir-program/canonical-types.js");
  const { createProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { constantKeyOfMir, verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const fixture = moduleFixture();
  const table = fixture.index.types;
  table.terms.push({ kind: "primitive", primitive: "int32" }, { kind: "primitive", primitive: "bool" });
  const { tir, mir: unchanged } = fixture.module.bodies[0];
  const terminal = unchanged.blocks[0].terminator;
  const constants = [
    { id: 0, type: 1, value: { kind: "literal", value: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } } },
    { id: 1, type: 2, value: { kind: "literal", value: { kind: "boolean", value: true } } },
  ];
  const start = { ...unchanged.blocks[0], terminator: {
    origin: terminal.origin, tir: terminal.tir, kind: "switch", operand: { kind: "constant", constant: 0 },
    targets: [{ constant: 0, target: 1 }, { constant: 1, target: 2 }], otherwise: 3, step: null,
  } };
  const original = { ...unchanged, constants, blocks: [start, ...[1, 2, 3].map(id => ({ ...unchanged.blocks[0], id }))] };
  const check = (body, source, types) => verifyMir(body, {
    requiredEntries: [0],
    source, types, limits: fixture.context.mirVerification, selectedNativeFacts: fixture.context.selectedNativeFacts,
    bodyOf: fixture.tirInput.bodyOf, bodyOwner: fixture.context.facts.bodyOwner, declarationOf: fixture.tirInput.declarationOf,
  });
  assert.deepEqual(check(original, tir, table), { kind: "complete", violations: [] });
  const limits = { maximumWork: 10000, maximumCreatedRecords: 1000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 8, maximumVisits: 128, maximumUnionMembers: 8, maximumIntersectionMembers: 8 } };
  const publication = typeProduct.exportTypes(admitFixtureTable(typeProduct, table), limits);
  assert.equal(publication.kind, "complete");
  const rewrite = publicationRewrite(publication.value);
  assert.ok(constantKeyOfMir(rewrite.type(2), constants[1].value) < constantKeyOfMir(rewrite.type(1), constants[0].value));
  const run = bounds => {
    const meter = createInstantiationMeter(bounds);
    const scan = createProjectionInventory(meter, rewrite, path => assert.fail(path));
    const reads = [];
    const tracked = (values, name) => {
      const rows = [];
      for (const [position, value] of values.entries()) Object.defineProperty(rows, position, {
        get() { reads.push(name + position); return value; },
      });
      return rows;
    };
    const traced = { ...original, constants: tracked(constants, "constant"), blocks: tracked([
      { ...start, terminator: { ...start.terminator, targets: tracked(start.terminator.targets, "target") } },
      ...original.blocks.slice(1),
    ], "block") };
    const result = projectMirBody(scan, traced, rewrite, "MirBody");
    return { result, reads, work: bounds.maximumWork - remainingWork(meter.account), created: meter.created,
      originalStop: meter.failure ?? accountFailure(meter.account) };
  };
  const full = run(limits);
  const projected = full.result;
  assert.equal(projected.kind, "copied");
  assert.deepEqual(full.reads, ["constant0", "constant1", "block0", "target0", "target1", "block1", "block2", "block3"]);
  const exact = run({ ...limits, maximumWork: full.work, maximumCreatedRecords: full.created });
  assert.equal(exact.result.kind, "copied");
  assert.deepEqual(exact.reads, full.reads);
  for (const [field, required] of [["maximumWork", full.work], ["maximumCreatedRecords", full.created]]) {
    for (let maximum = 0; maximum < required; maximum += 1) {
      const cut = run({ ...limits, [field]: maximum });
      assert.equal(cut.result.kind === "refused" && cut.result.stop === cut.originalStop, true, field + ":" + maximum);
      assert.deepEqual(cut.reads, full.reads.slice(0, cut.reads.length));
    }
  }
  const expected = { ...start.terminator, operand: { kind: "constant", constant: 1 },
    targets: [{ constant: 0, target: 2 }, { constant: 1, target: 1 }] };
  assert.deepEqual(projected.value.blocks[0].terminator, expected);
  assert.deepEqual(projected.value.constants, [{ ...constants[1], id: 0, type: rewrite.type(2) }, { ...constants[0], id: 1, type: rewrite.type(1) }]);
  assert.deepEqual(projected.value.blocks.map(block => block.id), [0, 1, 2, 3]);
  assert.equal(projected.value.blocks[0].terminator.tir === terminal.tir, true);
  const source = { ...tir, completion: rewrite.type(tir.completion), signature: rewrite.signature(tir.signature) };
  assert.deepEqual(check(projected.value, source, publication.value.table), { kind: "complete", violations: [] });
  const crossed = { ...projected.value, blocks: [{ ...projected.value.blocks[0],
    terminator: { ...expected, targets: expected.targets.slice().reverse() } }, ...projected.value.blocks.slice(1)] };
  assert.deepEqual(check(crossed, source, publication.value.table).violations.map(finding => finding.rule), ["switch-targets-order"]);
});

test("verified MIR definition constants earn owned rigid bindings at the Program artifact boundary", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const { analyzeTypedSource } = await import("../../packages/host/dist/pipeline/analysis-barrier.js");
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  const { instanceKey, rigidBindings, viewTypes } = await import("../../packages/host/dist/ir-types/index.js");
  const { constantKeyOfMir, verifyMir } = await import("../../packages/host/dist/ir-mir/index.js");
  const { projectMirBody } = await import("../../packages/host/dist/ir-program/canonical-tir.js");
  const { publicationRewrite } = await import("../../packages/host/dist/ir-program/canonical-types.js");
  const { createProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const host = analysisInput(await loadFrontFixture(), "sdk-minimal", "export interface Holder<T> { value: T; }");
  const checked = captureSourceBarrier(host);
  assert.equal(checked.kind, "ok");
  const shared = createAccount(host.limits.dataflow);
  const typed = typeSourceBarrier(host, checked.value, shared);
  assert.equal(typed.kind, "ok");
  const analysis = analyzeTypedSource(host, typed.value, shared);
  assert.equal(analysis.kind, "ok");
  const captured = checked.value.modules.find(row => row.module.module === host.snapshot.entryPoint).module;
  const [holder] = captured.tree.statements.nodes;
  assert.equal(holder.kind, "InterfaceDeclaration");
  const { definition } = holder.tsonic;
  const declaration = typed.value.declarationOf(definition);
  assert.strictEqual(declaration.scope, checked.value.descriptions.get(definition).generics);
  const vector = rigidBindings(declaration.scope);
  assert.equal(vector.classBindings.length, 1);
  assert.deepEqual(vector.selfBindings, [{ kind: "rigid", owner: definition }]);
  const [{ parameter }] = vector.classBindings;
  assert.equal(captured.items.some(row => row.definition === parameter), true);
  const source = [...typed.value.bodies.values()].find(row =>
    row.root.origin.module === host.snapshot.entryPoint && row.bindings.kind === "instantiated");
  const originalMir = analysis.value.mir.get(instanceKey({ body: source.body, bindings: source.bindings }));
  assert.deepEqual(originalMir.constants, []);
  const table = viewTypes(checked.value.types);
  const type = table.terms.findIndex(row => row.kind === "declared" && row.definition === definition);
  assert.notEqual(type, -1);
  const value = { kind: "definition", definition, bindings: { kind: "instantiated", bindings: vector } };
  const constant = { id: 0, type, value };
  const original = { ...originalMir, constants: [constant] };
  const verify = (body, source, types) => verifyMir(body, { source, types, limits: host.limits.mirVerification,
    requiredEntries: [0],
    selectedNativeFacts: host.snapshot.nativeFacts, bodyOf: instance => typed.value.bodies.get(instanceKey(instance)) ?? null,
    bodyOwner: analysis.value.verification.bodyOwner, declarationOf: typed.value.declarationOf });
  assert.deepEqual(verify(original, source, table), { kind: "complete", violations: [] });
  const incomplete = { ...original, constants: [{ ...constant, value: { ...value,
    bindings: { kind: "instantiated", bindings: { ...vector, selfBindings: [] } } } }] };
  assert.deepEqual(verify(incomplete, source, table).violations.map(({ rule, site }) =>
    [rule, site.kind, site.constant]), [["bindings-complete", "constant", 0]]);

  const limits = host.limits.instantiation;
  const publication = typeProduct.exportTypes(checked.value.types, limits);
  assert.equal(publication.kind, "complete");
  const rewrite = publicationRewrite(publication.value);
  assert.notEqual(rewrite.type(type), type);
  const run = (bounds = limits) => {
    const account = createAccount({ ...host.limits.dataflow, maximumWork: bounds.maximumWork });
    const meter = ProgramWork.state(product.createProgramVerificationWork(bounds, account));
    const scan = createProjectionInventory(meter, rewrite, path => assert.fail(path));
    const reads = [];
    const once = (label, value) => {
      assert.equal(reads.includes(label), false, label + " raw reader was repeated");
      reads.push(label);
      return value;
    };
    const rawParameter = { get kind() { return once("parameter tag", "rigid"); }, get parameter() { return once("parameter", parameter); } };
    const rawSelf = { get kind() { return once("self tag", "rigid"); }, get owner() { return once("self owner", definition); } };
    const rows = [];
    Object.defineProperty(rows, 0, { get() { return once("constant", { ...constant, value: { ...value,
      bindings: { kind: "instantiated", bindings: { ...vector, classBindings: [rawParameter], selfBindings: [rawSelf] } } } }); } });
    const traced = { ...original, constants: rows, get blocks() { return once("blocks", original.blocks); } };
    const result = projectMirBody(scan, traced, rewrite, "MirBody");
    return { result, reads, work: InvocationAccount.stateOf(account).work, records: meter.created,
      stop: meter.failure ?? accountFailure(account), rawParameter, rawSelf };
  };
  const complete = run();
  assert.equal(complete.result.kind, "copied");
  assert.deepEqual(complete.reads, ["constant", "self tag", "self owner", "parameter tag", "parameter", "blocks"]);
  const final = complete.result.value;
  const mapped = { ...constant, type: rewrite.type(type) };
  assert.deepEqual(final, { ...originalMir, result: rewrite.type(originalMir.result), constants: [mapped] });
  assert.strictEqual(final.blocks[0].terminator.tir, originalMir.blocks[0].terminator.tir);
  assert.equal(constantKeyOfMir(final.constants[0].type, final.constants[0].value), constantKeyOfMir(mapped.type, mapped.value));
  assert.notStrictEqual(final.constants[0].value.bindings.bindings.classBindings[0], complete.rawParameter);
  assert.notStrictEqual(final.constants[0].value.bindings.bindings.selfBindings[0], complete.rawSelf);
  const finalSource = { ...source, signature: rewrite.signature(source.signature), completion: rewrite.type(source.completion) };
  assert.deepEqual(verify(final, finalSource, publication.value.table), { kind: "complete", violations: [] });

  const exact = run({ ...limits, maximumWork: complete.work, maximumCreatedRecords: complete.records });
  assert.deepEqual(exact.result, complete.result);
  assert.deepEqual(exact.reads, complete.reads);
  for (const [field, required] of [["maximumWork", complete.work], ["maximumCreatedRecords", complete.records]]) {
    for (let maximum = 0; maximum < required; maximum += 1) {
      const cut = run({ ...limits, [field]: maximum });
      assert.equal(cut.result.kind, "refused");
      assert.strictEqual(cut.result.stop, cut.stop);
      assert.equal("value" in cut.result, false);
      assert.deepEqual(cut.reads, complete.reads.slice(0, cut.reads.length));
    }
  }
});

test("actual TIR node prepare reads its lexical payload once before later sibling and materializes after substitution", async () => {
  const { inventoryBodySyntax } = await import("../../packages/host/dist/ir-program/instantiate-syntax.js");
  const { typedSyntaxPhaseCopy } = await import("../../packages/host/dist/ir-program/canonical-phase.js");
  const { createProjectionInventory } = await import("../../packages/host/dist/ir-program/program-values.js");
  const types = await import("../../packages/host/dist/ir-types/index.js");
  const { fixtureTypeWork } = await import("./fixtures/types-construction.mjs");
  const specimen = JSON.parse(readFileSync(new URL("../host-cases/ir-program/function/phase-binder-type-syntax-0.input.json", import.meta.url)));
  const beforeBounds = { maximumWork: 10000, maximumCreatedRecords: 10000, maximumBindingVectorsPerArtifact: 3,
    typeExpansion: { maximumDepth: 10, maximumVisits: 500, maximumUnionMembers: 5, maximumIntersectionMembers: 5 } };
  const identity = value => value;
  function prepare(bounds, instrument) {
    const meter = createInstantiationMeter(bounds);
    const scan = createProjectionInventory(meter, { parameterBinding: identity, selfBinding: identity }, path => assert.fail(path));
    const root = structuredClone(specimen.module.tree.root);
    const cast = root.statements.nodes[0].node.expression;
    const original = cast.type.types.nodes;
    const earlier = original[0].typeParameter;
    const later = original[1];
    const authored = earlier.tsonic;
    const name = earlier.name;
    const text = name.text;
    const scalar = { sealed: false, reads: 0 };
    for (const [role, operand] of [["expression", cast.expression], ["type", cast.type]]) {
      const kind = operand.kind;
      Object.defineProperty(operand, "kind", { get() {
        assert.equal(scalar.sealed, false, `an admitted ${role} must use its retained discriminator`);
        return kind;
      } });
    }
    Object.defineProperty(name, "text", { get() {
      assert.equal(scalar.sealed, false, "typed identifier text must be earned before materialization");
      scalar.reads += 1;
      return text;
    } });
    const reads = [];
    if (instrument) for (const [node, label] of [[earlier, "first payload"], [later, "next sibling"]]) {
      const payload = node.tsonic;
      Object.defineProperty(node, "tsonic", { get() {
        reads.push([label, bounds.maximumWork - remainingWork(meter.account)]);
        return payload;
      } });
    }
    const result = inventoryBodySyntax(scan, { root, params: [] }, typedSyntaxPhaseCopy(scan, "Instantiation.root", null));
    return { meter, scan, result, root, earlier, later, reads, authored, scalar, text };
  }
  const full = prepare(beforeBounds, true);
  assert.equal(full.result.kind, "complete");
  assert.equal(full.scalar.reads, 1);
  const work = beforeBounds.maximumWork - remainingWork(full.meter.account);
  const created = full.meter.created;
  const copyPlan = 1;
  const moduleReceipt = 1;
  const statementRecord = 1;
  const statementFields = 2;
  const preparedPlanIndex = 1;
  const ordinaryNodes = 21;
  const expressionStatementReceipt = 1;
  const castReceipt = 1;
  const retained = preparedPlanIndex + ordinaryNodes + expressionStatementReceipt + castReceipt;
  assert.equal(work, 428 + copyPlan + moduleReceipt + statementRecord + statementFields - 1 + retained);
  assert.equal(created, 61 + copyPlan + moduleReceipt + statementRecord + retained);
  const [[first, requiredFirst], [second, requiredSecond]] = full.reads;
  assert.deepEqual([first, second], ["first payload", "next sibling"]);
  assert.equal(requiredFirst < requiredSecond && requiredSecond < work, true);
  for (const [dimension, bound] of [["maximumWork", work], ["maximumCreatedRecords", created]]) {
    for (let maximum = 0; maximum <= bound; maximum += 1) {
      const actual = prepare({ ...beforeBounds, [dimension]: maximum }, true);
      if (dimension === "maximumWork") {
        assert.deepEqual(actual.reads.map(([label]) => label), maximum < requiredFirst ? []
          : maximum < requiredSecond ? ["first payload"] : ["first payload", "next sibling"]);
      }
      if (maximum === bound) assert.equal(actual.result.kind, "complete");
      else {
        assert.equal(actual.result.kind, "resource-limit");
        assert.equal(actual.result === (actual.meter.failure ?? accountFailure(actual.meter.account)), true);
      }
    }
  }
  const declaration = full.authored.parameter.declaration;
  const table = admitFixtureTable(types, { terms: [{ kind: "param", parameter: declaration }, { kind: "string" }], signatures: [] });
  const requested = [...full.scan.types];
  const bindings = { classBindings: [], methodBindings: [{ kind: "bound", parameter: declaration, type: 1 }],
    capturedBindings: [], selfBindings: [] };
  const solved = types.substitute(table, requested, bindings, beforeBounds.typeExpansion, fixtureTypeWork(types));
  assert.equal(solved.kind, "complete");
  const ids = new Map(requested.map((type, index) => [type, solved.value[index]]));
  assert.notEqual(ids.get(full.authored.parameter.constraint), full.authored.parameter.constraint);
  const rejectChecked = () => assert.fail("The authored Typed-only specimen has no Checked slot");
  full.scalar.sealed = true;
  const copiedSyntax = full.result.value.materialize({ type: value => ids.get(value), signature: identity },
    { moduleOf: rejectChecked, declarationOf: rejectChecked, expressionOf: rejectChecked });
  assert.equal(copiedSyntax.kind, "copied");
  const image = copiedSyntax.value;
  const newRoot = image.bodyRootOf(full.root);
  assert.equal(image.bodyRootOf(full.root) === newRoot, true);
  const actual = newRoot.statements.nodes[0].node.expression.type.types.nodes[0].typeParameter;
  assert.equal(Object.is(actual, full.earlier), false);
  assert.equal(actual.id, full.earlier.id);
  assert.equal(actual.name.text, full.text);
  assert.equal(full.scalar.reads, 1);
  assert.equal(actual.tsonic.parameter.constraint, ids.get(full.authored.parameter.constraint));
  assert.equal(actual.tsonic.parameter.default, ids.get(full.authored.parameter.default));
  assert.deepEqual(full.reads.map(([label]) => label), ["first payload", "next sibling"]);
  assert.throws(() => image.bodyRootOf(specimen.module.tree.root), /actual chapter operand/u);
});

for (const change of ["absent", "present", "duplicate", "argument"]) test(`ir-program invocation summary ${change} retains the complete artifact reference result`, () => {
  const { fixture, definition, key, alternative, summary } = declaredInvocationFixture();
  if (change !== "absent") {
    fixture.index.summaries.push(summary);
    if (change === "duplicate") fixture.index.summaries.push(summary);
  }
  if (change === "present") completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context),
    { kind: "complete", violations: [] }, "the exact declared endpoint, required call edge and both summaries verify together");
  if (change === "argument") {
    const owner = { kind: "summary", key };
    alternative.arguments.push({ kind: "provided", authoredIndex: 0, parameter: definition, parameterIndex: 0,
      repeated: false, passing: "by-value", actual: 0, formal: { owner, producer: 0 }, projection: null });
  }
  const site = { kind: "body", instance: fixture.instance };
  const expected = change === "present" ? [] : change === "argument" ? [
    { rule: "facts-valid", site, detail: [{ kind: "text", value: "producer-resolves" },
      { kind: "text", value: "The actual formal producer resolves in its declared foreign arena." }] },
    { rule: "facts-valid", site, detail: [{ kind: "text", value: "argument-transports-total" },
      { kind: "text", value: "Transports retain complete selected formals, passing modes and effective actual components exactly once." }] },
  ] : [{ rule: "binding-artifact-present", site, detail: [
    { kind: "text", value: "facts.origins.invocations[0].alternatives[0].summary" }, { kind: "text", value: summaryKey(key) }] }];
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), expected,
    "a borrowed invocation record retains its complete original context and publication result");
});

for (const kind of ["callback", "activation"]) for (const ownerKind of ["body", "missing-body", "summary", "duplicate-summary"])
  test(`ir-program ${kind} formal ${ownerKind} retains all qualified publication and lower producer findings`, () => {
    const { first, second } = pairedPublications();
    const facts = first.selected.facts[0];
    const summaryOwner = ownerKind === "summary" || ownerKind === "duplicate-summary";
    const key = { kind: "body", execution: { instance: first.instance, provided: 0 } };
    const owner = summaryOwner ? { kind: "summary", key }
      : { kind: "body", execution: { instance: ownerKind === "missing-body" ? second.instance : first.instance, provided: 0 } };
    facts.arena.origins = [{ id: 0, kind: "complete", producers: [], includesAbsence: false }];
    facts.arena.contexts = [{ id: 0, receiver: null, arguments: [], captures: [] }];
    const argument = { kind: "provided", authoredIndex: 0, parameter: first.definition, parameterIndex: 0, repeated: false,
      passing: "by-value", actual: 0, formal: { owner, producer: 0 }, projection: null };
    if (kind === "callback") facts.origins.callbacks = [{ node: 0, argument, timing: "synchronous", rejection: null, inputs: [] }];
    else facts.origins.activations = [{ node: 0, point: { block: 0, statement: null },
      activation: first.instance, context: 0, caller: null, entry: argument }];
    if (ownerKind === "missing-body") first.index.bodies = first.index.bodies.filter(body => body.instance !== second.instance);
    if (ownerKind === "summary") {
      first.index.summaries = first.index.summaries.filter(row => summaryKey(row.key) !== summaryKey(key));
      first.answers.set(encodeContextKey(["arenaOf", owner]), null);
    }
    if (ownerKind === "duplicate-summary") {
      const summary = first.index.summaries.find(row => summaryKey(row.key) === summaryKey(key));
      assert.ok(summary, "the formal names the supplied selected summary");
      first.index.summaries.push(summary);
    }
    const expected = [];
    const site = { kind: "body", instance: first.instance };
    if (ownerKind !== "body") expected.push({ rule: "cross-owner-reference-resolves", site, detail: [
      { kind: "text", value: `facts.origins.${kind === "callback" ? "callbacks[0].argument" : "activations[0].entry"}.formal.owner` },
      { kind: "text", value: summaryOwner ? summaryKey(key) : executionKey({ instance: second.instance, provided: 0 }) }] });
    expected.push({ rule: ownerKind === "summary" ? "cross-owner-qualified" : "facts-valid", site, detail: [
      { kind: "text", value: ownerKind === "summary" ? "cross-owner-qualified" : "producer-resolves" },
      { kind: "text", value: ownerKind === "summary" ? "A formal producer retains a resolving qualified relational owner."
        : "The actual formal producer resolves in its declared foreign arena." }] });
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "a genuine empty or unavailable canonical arena cannot invent formal producer zero; all cofindings remain in order");
  });

test("ir-program a construction retains its complete actual body instance", () => {
  const fixture = publicationFixture();
  const published = fixture.selected;
  const actual = fixture.instance;
  published.facts[0].origins.constructions = [{ node: 0, root: { body: fixture.bodyId, node: 0 },
    allocation: { body: fixture.bodyId, node: 0 }, implementation: fixture.definition, body: actual, regions: [] }];
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [], "a real instantiated construction resolves its exact complete record");
  fixture.index.bodies.push({ ...fixture.index.bodies[1] });
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "body-levels-total", site: { kind: "body", instance: actual }, detail: [{ kind: "text", value: fixture.module.module }] },
    { rule: "binding-artifact-present", site: { kind: "body", instance: fixture.instance }, detail: [
      { kind: "text", value: "facts.origins.constructions[0].body" }, { kind: "text", value: encodeKey([fixture.bodyId, ["instantiated", [[], [], [], []]]]) }] },
  ], "duplicate published identities are ambiguous both for the chunk and the exact construction reference");
});

test("ir-program a raw location retains its actual selected metadata reference", () => {
  const { first, metadata } = metadataOperationFixture("size", "present", "layout");
  first.selected.facts[0].rawLocations = [{ node: 0, operation: "to-raw", pointee: 1, layout: { metadata: metadata.key, layout: 0 }, context: 0,
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } }];
  completeProgramValue(moduleViolations(first.index, first.module, first.context), [], "the complete raw-location record preserves its real pointee, layout and environment");
});

test("ir-program a foreign MIR metadata site retains both materialization and qualified source findings", () => {
  const { first, second } = metadataOperationFixture("size", "present", "layout");
  first.selected.mir.blocks[0].statements[1].tir = { body: second.bodyId, node: 0 };
  const site = { kind: "body", instance: first.instance };
  completeProgramValue(moduleViolations(first.index, first.module, first.context), [
    { rule: "metadata-constant-not-materialised", site, detail: [{ kind: "text", value: "mir.blocks[0].statements[1].value.operand" },
      { kind: "number", value: 0 }, { kind: "text", value: encodeKey([first.definition, ["instantiated", [[], [], [], []]]]) }] },
    { rule: "cross-owner-qualified", site, detail: [{ kind: "text", value: "cross-owner-qualified" }] },
  ], "a real node in another body cannot borrow the local observation's materialization permission");
});

test("ir-program an unavailable parametric closure retains its complete publication and child findings", () => {
  const { first } = metadataOperationFixture("size", "present", "layout");
  const missing = moduleFixture("src/absent.ts").instance;
  first.answers.set(encodeContextKey(["bodyOwner", missing.body]), null);
  first.selected.mir.blocks[0].statements[1].value = { kind: "closure", instance: missing, captures: [] };
  const site = { kind: "body", instance: first.instance };
  completeProgramValue(moduleViolations(first.index, first.module, first.context), [
    { rule: "cross-owner-reference-resolves", site, detail: [{ kind: "text", value: "mir.blocks[0].statements[1].value.instance" },
      { kind: "text", value: encodeKey([missing.body, ["parametric"]]) }] },
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "operation-selected" }] },
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "definition-resolves" }] },
  ], "null is the actual missing declaration, never a fabricated canonical body return");
});

test("ir-program a deep authored child mismatch propagates to its containing body without losing the lower finding", () => {
  const fixture = publicationFixture();
  const root = fixture.module.tree.root;
  const common = { origin: root.origin, flags: [], loc: root.loc, tsonic: null };
  const child = { ...common, id: 2, parent: 1, kind: "EmptyStatement" };
  const block = { ...common, id: 1, parent: 0, kind: "Block", statements: { loc: root.loc, nodes: [child] }, multiLine: false };
  root.statements.nodes = [{ kind: "ready-statement", node: block }];
  root.endOfFileToken.id = 3;
  fixture.tirInput.source.tree.statements = { loc: root.statements.loc, nodes: [structuredClone(block)] };
  fixture.tirInput.source.tree.endOfFileToken = { ...root.endOfFileToken };
  const scope = { node: 1, parent: 0, attributes: [] };
  fixture.template.tir.scopes.push(scope);
  fixture.tirInput.source.bodies[0].scopes = [...fixture.template.tir.scopes];
  const checked = fixture.tirInput.source.tree;
  const checkedBlock = checked.statements.nodes[0];
  for (const node of [checkedBlock, checkedBlock.statements.nodes[0], checked.endOfFileToken]) {
    const reference = { kind: "body", value: { body: fixture.bodyId, node: node.id } };
    fixture.answers.set(encodeContextKey(["nodeOf", reference]), node);
    fixture.answers.set(encodeContextKey(["nodeExists", reference]), true);
  }
  child.kind = "DebuggerStatement";
  const sites = [fixture.template.instance, fixture.instance].map(instance => ({ kind: "body", instance }));
  const shape = site => ({ rule: "tir-valid", site, detail: [{ kind: "text", value: "kind-children-shape" },
    { kind: "text", value: "typed syntax does not retain the authored kind, fields and child presence" }] });
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    ...sites.map(site => ({ rule: "instance-node-ids-exact", site, detail: [{ kind: "number", value: 1 }, { kind: "text", value: "Block" }] })),
    ...sites.flatMap(site => [shape(site), shape(site)]),
  ], "every ancestor retains the actual first failing descendant while the full original checked source remains unchanged");
});

test("ir-program a missing checked body retains the complete source and nested-publication findings", () => {
  const fixture = publicationFixture();
  fixture.tirInput.source.bodies = [];
  const moduleSite = { kind: "node", module: fixture.module.module, node: 0 };
  const sites = [fixture.template.instance, fixture.instance].map(instance => ({ kind: "body", instance }));
  const child = (site, rule, message) => ({ rule: "tir-valid", site, detail: [{ kind: "text", value: rule }, { kind: "text", value: message }] });
  const order = site => child(site, "stable-order", "canonical template publication does not retain actual source body order");
  const nested = site => child(site, "nested-template-identity", "published template is not the authentic body's canonical shared module subtree");
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    ...sites.map(site => ({ rule: "body-levels-total", site, detail: [{ kind: "text", value: "source" }] })),
    order(moduleSite), nested(moduleSite),
    ...sites.flatMap(site => [
      child(site, "body-owner", "body identity and owner do not retain the actual original body"),
      order(site), nested(site),
      child(site, "nested-template-identity", "typed template does not retain its real authored body and shared syntax identity"),
      child(site, "permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
    ]),
    { rule: "facts-valid", site: sites[1], detail: [{ kind: "text", value: "missing-observation-source" }] },
  ], "the supplied checked source lacks this body; every genuine consequent finding remains");
});

test("ir-program a separately copied body root retains its actual original root identity", () => {
  const fixture = publicationFixture();
  const root = { ...fixture.module.tree.root, id: 2 };
  fixture.template.tir.root = root;
  fixture.answers.set(encodeContextKey(["nodeOf", { kind: "body", value: { body: fixture.bodyId, node: 2 } }]), null);
  const site = { kind: "body", instance: fixture.template.instance };
  const child = (rule, message) => ({ rule: "tir-valid", site, detail: [{ kind: "text", value: rule }, { kind: "text", value: message }] });
  const nested = child("nested-template-identity", "published template is not the authentic body's canonical shared module subtree");
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "instance-node-ids-exact", site, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 2 }] },
    { rule: "template-body-shared", site, detail: [{ kind: "number", value: 2 }] },
    { ...child("module-node-identity", "ready module root must share the independently required module template"),
      site: { kind: "node", module: fixture.module.module, node: 0 } },
    { ...nested, site: { kind: "node", module: fixture.module.module, node: 0 } },
    child("module-node-identity", "body does not retain its module identity and canonical parametric subtree"),
    child("authored-node-ids-preserved", "typed node identity differs from the actual authored node at this position"),
    child("no-inserted-nodes", "typed syntax includes a node not present in the actual source arena"),
    child("node-in-body-range", "typed body root does not retain the actual original body subtree"),
    child("node-in-body-range", "typed syntax contains a real or invented node outside its actual original body subtree"),
    nested,
    child("nested-template-identity", "typed template does not retain its real authored body and shared syntax identity"),
    child("node-reference", "node identity does not name an actual node in its module arena"),
    { ...nested, site: { kind: "body", instance: fixture.instance } },
  ], "an altered supplied root is not the actual canonical record and cannot substitute another node ID");
});

test("ir-program an already exceeded binding bound still retains the duplicate-instance finding", () => {
  const fixture = publicationFixture();
  const record = fixture.index.bodies[1];
  fixture.index.bodies.push(record);
  const context = { ...fixture.context, resources: product.createProgramVerificationWork({
    ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: 0 }, createAccount({ maximumWork: 1000000, maximumResultEntries: 1000000000 })) };
  const key = encodeKey([fixture.bodyId, ["instantiated", [[], [], [], []]]]);
  completeProgramValue(product.verifyProgramIndex(fixture.index, context), { kind: "complete", violations: [
    { rule: "body-index-order", site: { kind: "body", instance: record.instance }, detail: [{ kind: "text", value: key }, { kind: "text", value: key }] },
    { rule: "execution-body-resolves", site: { kind: "body", instance: record.instance }, detail: [{ kind: "text", value: executionKey({ instance: record.instance, provided: 0 }) }] },
    { rule: "binding-vectors-bounded", site: { kind: "body", instance: record.instance }, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] },
    { rule: "binding-vectors-bounded", site: { kind: "artifact", artifact: { kind: "summary", target: "body", body: fixture.bodyId, provided: 0 },
      bindings: fixture.instance.bindings }, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] },
  ] }, "the bound reports once without suppressing any independent inventory finding");
});

for (const kind of ["goto", "unreachable", "switch", "await", "yield", "yield-absent", "delegate", "throw", "return", "call", "indirect-call", "invoke"])
  test(`ir-program metadata operand in genuine ${kind} control retains every complete child and publication finding`, async () => {
    const { first, checked } = metadataOperationFixture("size", "present", "layout");
    const block = first.selected.mir.blocks[0];
    block.statements.pop();
    const site = { origin: block.origin, tir: { body: first.bodyId, node: checked.id } };
    const operand = { kind: "constant", constant: 0 };
    const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    const unwind = { kind: "escape" };
    let terminator;
    if (kind === "goto") terminator = { kind, target: 0 };
    else if (kind === "unreachable") terminator = { kind };
    else if (kind === "switch") terminator = { kind, operand, targets: [{ constant: 0, target: 0 }], otherwise: 0, step: null };
    else if (kind === "await") terminator = { kind, operand, destination: 0, resume: 0, unwind, step: null };
    else if (kind === "yield" || kind === "yield-absent") terminator = { kind: "yield", operand: kind === "yield" ? operand : null,
      destination: 0, resume: 0, return: { destination: 0, target: 0 }, unwind, step: null };
    else if (kind === "delegate") terminator = { kind, iterator: operand, destination: 0, resume: 0, return: { destination: 0, target: 0 }, unwind, step: null };
    else if (kind === "throw") terminator = { kind, operand, unwind };
    else if (kind === "return") terminator = { kind, value: operand };
    else if (kind === "invoke") terminator = { kind, operation: { permissionScope: null, decision: { kind: "selected",
      operation: { kind: "native-operator", operator: "+", carrier: "uint64" }, operands: [2], result: 2, execution: { kind: "invocation", writesStorage: false, failure: "unwind" } } },
    operands: [operand], destination: null, next: 0, unwind, step: null };
    else {
      const advertised = { declaration: first.definition, role: "advertised", signature: 0, body: null };
      const resolution = { decision: { candidate: 0, advertised, api: { ...advertised, role: "api-signature" }, bindings: empty,
        implementationBindings: empty, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
      activation: null };
      terminator = { kind: "call", callee: kind === "call" ? { kind: "direct", resolution } : { kind: "indirect", operand, resolution },
        receiver: kind === "call" ? null : operand, arguments: kind === "call" ? [] : [{ kind: "value", passing: "by-value", operand }],
        destination: null, next: 0, unwind, step: null };
    }
    block.terminator = { ...site, ...terminator };
    // The body is neither asynchronous nor a generator: a suspension in it is refused by the MIR law that a
    // suspension stands only in a body that can suspend (S2-18, law 5), after the findings of its values.
    const rules = kind === "return" ? ["assignment-type"] : kind === "indirect-call"
      ? ["call-receiver-exact", "call-arguments-total", "operation-selected"] : ["yield", "yield-absent", "delegate"].includes(kind)
        ? ["call-destination-type", "suspension-admitted"] : kind === "await" ? ["suspension-admitted"]
          : kind === "call" || kind === "invoke" ? ["operation-selected"] : [];
    const expected = rules.map(rule => ({ rule: "mir-valid", site: { kind: "body", instance: first.instance }, detail: [{ kind: "text", value: rule }] }));
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "the whole real source/metadata/context input retains all child findings, never a filtered success");
    if (kind === "indirect-call" || kind === "invoke") {
      const { verifyMetadataOperands } = await import("../../packages/host/dist/ir-program/verify-metadata-operands.js");
      const { verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
      const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
      const reads = [];
      const actual = label => ({ ...operand, get constant() { reads.push(label); return operand.constant; } });
      if (kind === "indirect-call") {
        block.terminator.callee.operand = actual("callee");
        block.terminator.receiver = actual("receiver");
        block.terminator.arguments[0].operand = actual("argument");
      } else block.terminator.operands[0] = actual("invoke operand");
      const limits = { ...ProgramWork.state(first.context.resources).limits, maximumWork: 10000 };
      const seed = paidSeedOf(first.index.types, limits);
      const lookup = programLookup(first.index);
      const assignment = 3;
      const exact = kind === "indirect-call" ? assignment + 2 + 2 + 2 + 2 : assignment + 2 + 2;
      for (let allowance = 0; allowance <= exact; allowance += 1) {
        reads.length = 0;
        const maximum = seed.maximumWork + allowance;
        const account = createAccount({ maximumWork: maximum, maximumResultEntries: 10000 });
        const context = { ...first.context, resources: product.createProgramVerificationWork(limits, account) };
        const ready = verificationTypes(first.index, context.resources);
        assert.equal(ready.kind, "complete");
        const applied = verifyMetadataOperands(first.selected, first.tirInput, lookup, context, ready.types);
        if (allowance < exact) {
          assert.equal(applied === accountFailure(account), true);
          assert.deepEqual(applied, { kind: "resource-limit", dimension: "work", maximum });
        } else {
          assert.deepEqual(applied, { kind: "complete", violations: [] }, "the metadata witness is independently valid");
          assert.equal(remainingWork(account), 0);
        }
        const ordered = kind === "indirect-call" ? [[assignment + 1, "callee"], [assignment + 3, "receiver"],
          [assignment + 5, "argument"]] : [[assignment + 1, "invoke operand"]];
        assert.deepEqual(reads, ordered.filter(([cut]) => allowance >= cut).map(([, label]) => label), `operand prefix at ${allowance}`);
      }
    }
    for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
      for (let maximum = 0; maximum <= 128; maximum += 1) {
        const context = { ...first.context, resources: product.createProgramVerificationWork({
          ...ProgramWork.state(first.context.resources).limits, ...(field === "maximumCreatedRecords" ? { maximumCreatedRecords: maximum } : {}) }, createAccount({ maximumWork: field === "maximumWork" ? maximum : 1000000, maximumResultEntries: 1000000000 })) };
        const result = product.verifyModuleBodies(first.index, first.module, context);
        if (result.kind === "resource-limit") {
          assert.equal(result.dimension, dimension, "the selected account refuses before further operand processing");
          assert.equal(result.maximum, maximum);
          assert.equal("violations" in result, false);
        } else completeProgramValue(result.violations, expected, "a sufficient invocation retains every original child finding");
      }
    }
  });

test("ir-program all component selectors retain full proof paths, signature identities and sum-role types", () => {
  const fixture = moduleFixture();
  const table = transportTypeTable(fixture);
  const shapePosition = table.terms.findIndex(value => value.kind === "shape");
  assert.equal(shapePosition, 15);
  const shape = table.terms[shapePosition];
  const [numeric, symbol, textual] = shape.members;
  const opposite = { ...table, terms: table.terms.with(shapePosition, {
    ...shape, members: [textual, { ...numeric, origins: [] }, symbol],
  }) };
  const rejected = typeProduct.admitTypeTable(opposite, fixtureTypeAdmission());
  assert.deepEqual(rejected, { kind: "invalid", violations: [
    { rule: "member-order", site: { kind: "type", type: 15 }, detail: [{ kind: "text", value: "members" }, { kind: "number", value: 1 }] },
    { rule: "member-origins", site: { kind: "type", type: 15 }, detail: [{ kind: "text", value: "members.origins" }, { kind: "number", value: 1 }] },
  ] });
  const component = table.terms.find(value => value.kind === "projection" && value.projection.kind === "component").projection.component;
  const node = structuredClone(syntaxExamples.get("StringLiteral").node);
  node.tsonic.narrowing = { kind: "narrowed", source: 0, result: 0,
    proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] },
      { from: component, to: component, rule: "identity", premises: [0] }], conclusion: 1 }, failure: "unwind" };
  const module = syntaxTransportModule({ module: fixture.module }, node, "Expression");
  completeSyntaxTransport(fixture, module, table);
});

test("ir-program complete local, parameter, yield and lexical-environment records survive the three structural transports", () => {
  const fixture = moduleFixture();
  const body = fixture.module.bodies[0].tir;
  body.yielded = 0;
  body.sent = 0;
  const parameter = structuredClone(syntaxExamples.get("Parameter").node);
  parameter.tsonic = { local: { body: fixture.bodyId, local: 0 }, declaration: fixture.definition,
    role: "default", passing: "by-value", initializer: fixture.bodyId, storage: 0 };
  body.params = [parameter];
  body.locals = [{ id: 0, declaration: { kind: "body", value: { body: fixture.bodyId, node: 0 } }, name: "value",
    role: "capture", capturedFrom: { body: fixture.bodyId, local: 0 }, mutable: false, storage: 0 }];
  body.captures = [{ local: { body: fixture.bodyId, local: 0 }, capture: "captured-location" }];
  body.nestedBodies = [fixture.bodyId];
  body.scopes[0].attributes = [{ declaration: fixture.definition, occurrence: body.locals[0].declaration,
    arguments: [body.locals[0].declaration, { kind: "item", value: { owner: fixture.definition, node: 0 } }] }];
  const bound = { kind: "bound", parameter: typeParameterDeclaration(fixture.definition, 0), type: 0 };
  body.lexicalBindings = { classBindings: [bound], methodBindings: [bound], capturedBindings: [bound],
    selfBindings: [{ kind: "bound", owner: fixture.definition, type: 0 }] };
  completeSyntaxTransport(fixture, fixture.module);
});

for (const kind of ["ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "ModuleDeclaration", "FunctionDeclaration", "PropertyDeclaration", "EnumDeclaration", "HeritageClause"]) test(`ir-program complete ${kind} phase parameter and template records retain their actual field types`, () => {
  const fixture = moduleFixture();
  const example = syntaxExamples.get(kind);
  const node = structuredClone(example.node);
  if (kind === "ModuleDeclaration") node.tsonic.template = { body: fixture.bodyId,
    lexicalBindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] }, dependence: "parametric" };
  else {
    if (Object.hasOwn(node.tsonic, "parameters")) node.tsonic.parameters = [{ declaration: typeParameterDeclaration(fixture.definition, 0), constraint: 0, default: 0 }];
    if (Object.hasOwn(node.tsonic, "heritage")) node.tsonic.heritage = [0];
    if (Object.hasOwn(node.tsonic, "members")) node.tsonic.members = [fixture.definition];
    if (Object.hasOwn(node.tsonic, "types")) node.tsonic.types = [0];
    if (Object.hasOwn(node.tsonic, "attributes")) node.tsonic.attributes = [{ declaration: fixture.definition,
      occurrence: { kind: "body", value: { body: fixture.bodyId, node: 0 } }, arguments: [{ kind: "item", value: { owner: fixture.definition, node: 0 } }] }];
  }
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"), example.input.index.types);
});

test("ir-program pragma dictionary keys preserve native UTF16 order, own prototype spellings and complete escaped values", () => {
  const fixture = moduleFixture();
  const keys = ["", "\0", "__proto__", "constructor", "a", "aa", "ab", "a\ud800", "\ud800", "𝄞", "\uffff", "hyphen-name", 'quote"'];
  const argumentValue = 'quote"\\\b\f\n\r\t\0\ud800';
  const args = keys.toSorted().map(name => ({ name, value: { pos: 0, end: 0, name, value: argumentValue } }));
  fixture.module.tree.root.pragmas = [{ kind: "SingleLineCommentTrivia", pos: 0, end: 0, hasTrailingNewLine: false, name: "transport", args }];
  const text = product.printModuleBodies(fixture.index, fixture.module);
  const fields = keys.toSorted().map(name => `${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)}=PragmaArgument(pos=0, end=0, name=${JSON.stringify(name)}, value=${JSON.stringify(argumentValue)})`).join(", ");
  assert.equal(text.includes(`args=PragmaArguments(${fields})`), true, "complete independently specified key order, spelling and payload");
  completeSyntaxTransport(fixture, fixture.module);
});

test("ir-program all modifier, syntax-flag and token-flag spellings remain complete source data", () => {
  const fixture = moduleFixture();
  const example = syntaxExamples.get("ClassDeclaration");
  const node = structuredClone(example.node);
  let identity = Math.max(...syntaxPhysicalNodes(node).map(value => value.id)) + 1;
  node.modifiers = { loc: node.loc, nodes: ["AbstractKeyword", "AccessorKeyword", "AsyncKeyword", "ConstKeyword", "DeclareKeyword", "DefaultKeyword"].map(kind => ({
    id: identity++, kind, origin: node.origin, parent: node.id, flags: [], loc: node.loc, tsonic: null,
  })) };
  const module = syntaxTransportModule({ module: fixture.module }, node, "Statement");
  module.tree.root.flags = ["Ambient"];
  completeSyntaxTransport(fixture, module, example.input.index.types);
  for (const kind of ["StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "TemplateHead", "TemplateMiddle", "TemplateTail", "JsxText"]) {
    const example = syntaxExamples.get(kind);
    const literal = structuredClone(example.node);
    literal.tokenFlags = ["PrecedingLineBreak", "HexSpecifier", "ContainsSeparator"];
    if (Object.hasOwn(literal, "templateFlags")) literal.templateFlags = ["ContainsInvalidEscape"];
    completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, literal, "SyntaxNode"),
      { terms: example.input.index.types.terms.length === 0 ? fixture.index.types.terms : example.input.index.types.terms,
        signatures: example.input.index.types.signatures.length === 0 ? fixture.index.types.signatures : example.input.index.types.signatures });
  }
});

for (const target of ["project", "library"]) test(`ir-program complete ${target} module resolution retains the actual imported identity`, () => {
  const fixture = moduleFixture();
  const node = structuredClone(syntaxExamples.get("Identifier").node);
  node.tsonic = { role: "value", type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" }, resolution: { kind: "module", target: target === "project"
      ? { target, module: fixture.module.module } : { target, module: { providerId: "fixture", providerVersion: "1",
        packageName: "@fixture/library", moduleSpecifier: "fixture", providerModuleId: "root" } } } };
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "Expression"));
});

for (const name of mirTransportCases(moduleFixture()).map(value => value.name)) test(`ir-program complete MIR ${name} preserves all fields through publication, text and exact selection`, () => {
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const fixture = moduleFixture(undefined, undefined, { kind: "instantiated", bindings });
  fixture.module.bodies[0].mir = mirTransportCases(fixture).find(value => value.name === name).body;
  const program = { index: fixture.index, modules: [fixture.module] };
  const publication = { table: fixture.index.types, types: [0], signatures: [0] };
  completeProgramValue(projectFixtureProgram(program, publication), program, "the complete typed MIR carrier is preserved without claiming semantic verification");
  completeProgramValue(product.parseModuleBodies(fixture.index, product.printModuleBodies(fixture.index, fixture.module)),
    { kind: "parsed", value: fixture.module }, "every actual shared decision, operand and qualified record is retained");
  completeProgramValue(product.instantiate(fixture.index, fixture.module, { kind: "mir", body: fixture.bodyId }, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 }),
    { kind: "instantiated", artifact: { kind: "mir", body: fixture.module.bodies[0].mir },
      types: fixture.index.types }, "the exact selected MIR preserves all independent fields and original table rows");
});

test("ir-program conversion carriers retain native versus backed identity and reject the retired refinement value", () => {
  const fixture = moduleFixture();
  const header = { id: 2, origin: fixture.module.tree.root.origin, parent: 1, flags: [], loc: fixture.module.tree.root.loc };
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const value = { type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const literal = { ...header, kind: "NumericLiteral", text: "0", tokenFlags: [], tsonic: { ...value, role: "value",
    value: { numerator: 0n, denominator: 1n, negativeZero: false } } };
  for (const kind of ["library", "core"]) {
    const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind, declaration: fixture.definition, bindings },
      operands: [0], result: 0, execution: { kind: "pure" } } };
    const node = { ...literal, tsonic: { ...literal.tsonic, conversion: { kind: "backed-convert", role: "argument", embedding: { kind: "identity" }, operation } } };
    completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "Expression"));
  }
  const prefix = { ...header, kind: "PrefixUnaryExpression", operator: "PlusToken", operand: { ...literal, id: 3, parent: 2 },
    tsonic: { ...value, role: "value", operation: { kind: "decided", decision: { permissionScope: null, decision: { kind: "selected",
      operation: { kind: "conversion", from: 0, to: 0, embedding: { kind: "identity" } }, operands: [0], result: 0, execution: { kind: "pure" } } } } } };
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, prefix, "Expression"));
  const mir = mirTransportCases(fixture).find(entry => entry.name === "rvalue-0-use").body;
  fixture.module.bodies[0].mir = mir;
  const text = product.printModuleBodies(fixture.index, fixture.module);
  const old = "value=use(operand=constant(constant=c:0))";
  assert.equal(text.includes(old), true);
  const replaced = text.replace(old, "value=refine(operand=constant(constant=c:0), to=t:0)");
  const refused = product.parseModuleBodies(fixture.index, replaced);
  assert.equal(refused.kind, "invalid-text");
  assert.equal(refused.offset, replaced.indexOf("refine("));
});

for (const kind of ["tir", "mir", "facts", "summary"]) test(`ir-program ${kind} retains every typed relational carrier through its public document and artifact transport`, () => {
  const { first } = metadataBindingFixture("record", "field");
  const relational = relationalTransportArtifacts(first);
  first.selected.facts = [relational.facts];
  first.selected.observations = relational.observations;
  if (kind === "summary") {
    const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
    first.index.summaries = [{ ...input.index.summaries[0], signature: 0, bindingDependent: false,
      arena: first.selected.facts[0].arena, key: { kind: "body", execution: relational.facts.execution } }];
  }
  first.index.metadata[0].layouts.push({ id: 2, occurrence: { kind: "item", value: { owner: first.definition, node: 0 } },
    source: 1, dataLayout: first.index.metadata[1].key.definition, byteSize: 2n, byteAlignment: 1n, stride: 1n,
    kind: "array", element: 0, length: 2n, runtimeBase: "bigint" });
  first.index.metadata[1].fingerprint = 'native"64\\le\n\ud800';
  const program = { index: first.index, modules: [first.module] };
  const publication = { table: first.index.types, types: first.index.types.terms.map((_value, position) => position),
    signatures: first.index.types.signatures.map((_value, position) => position) };
  completeProgramValue(projectFixtureProgram(program, publication), program, "all typed relational records retain their complete identity-publication value");
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(first.index)), { kind: "parsed", value: first.index },
    "the complete index includes actual memory-field/layout metadata, signatures and declaration rows");
  completeProgramValue(product.parseModuleBodies(first.index, product.printModuleBodies(first.index, first.module)),
    { kind: "parsed", value: first.module }, "the complete module retains every supplied relational carrier without asserting semantic analysis");
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const source = kind === "summary" ? first.index.summaries[0] : kind === "facts" ? first.selected.facts[0] : first.selected[kind];
  const execution = { instance: { body: first.bodyId, bindings: { kind: "instantiated", bindings } }, provided: relational.facts.execution.provided };
  const artifact = kind === "summary" ? { kind, target: "body", body: first.bodyId, provided: execution.provided }
    : kind === "facts" ? { kind, body: first.bodyId, provided: execution.provided } : { kind, body: first.bodyId };
  const expectedArtifact = kind === "summary" ? { kind, summary: { ...source, key: { kind: "body", execution } } }
    : kind === "facts" ? { kind, facts: { ...source, execution } } : { kind, body: { ...source, bindings: { kind: "instantiated", bindings } } };
  completeProgramValue(product.instantiate(first.index, first.module, artifact, bindings,
    { ...ProgramWork.state(first.context.resources).limits, maximumWork: 1000000, maximumCreatedRecords: 1000000 }),
  { kind: "instantiated", artifact: expectedArtifact, types: first.index.types }, "full structural projection preserves all independent embedded records");
});

test("ir-program a field binding authorizes only its actual available selected owner-layout descriptor", () => {
  for (const reason of [null, "checker-error", "parameter-dependent", "not-provided", "other-descriptor"]) {
    const { first, third, checked } = metadataBindingFixture("field", "layout");
    const field = first.tirInput.nodeOf({ kind: "body", value: { body: third.bodyId, node: 2 } });
    if (reason === "other-descriptor") field.tsonic.value.memory.value.fieldLayout = {
      kind: "available", value: { kind: "body", value: { body: first.bodyId, node: 4 } },
    };
    else if (reason !== null) field.tsonic.value.memory.value.fieldLayout = { kind: "unavailable", reason };
    const key = first.index.metadata[0].key;
    const expected = reason === null ? [] : [{ rule: "metadata-constant-not-materialised", site: { kind: "body", instance: first.instance },
      detail: [{ kind: "text", value: "mir.blocks[0].statements[1].value.operand" }, { kind: "number", value: 0 },
        { kind: "text", value: encodeKey([key.definition, artifactBindingsData(key.bindings)]) }] }];
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "a selected field's real descriptor edge is evidence; unavailable or another descriptor cannot authorize the owner layout");
  }
});

test("ir-program complete execution identity and shared verification resource cases", async suite => {
  const { executionCases } = await import("./fixtures/program-executions.mjs");
  await executionCases(suite);
});

test("ir-program source substitution refusal remains the first invocation stop before any later module reads", () => {
  const { first } = metadataOperationFixture("size", "present", "layout");
  ProgramWork.state(first.context.resources).limits.typeExpansion.maximumVisits = 0;
  const result = product.verifyModuleBodies(first.index, first.module, first.context);
  completeProgramValue(result, { kind: "resource-limit", site: { kind: "body", instance: first.instance }, dimension: "visits", maximum: 0 },
    "the real captured observation batch has no partial row or invalid-fact finding on exhaustion");
  const counters = [(1000000 - remainingWork(ProgramWork.state(first.context.resources).account)), ProgramWork.state(first.context.resources).created];
  const second = product.verifyModuleBodies(first.index, { ...first.module, bodies: [] }, { ...first.context,
    tirOf: () => { throw new Error("no checked-source lookup after this invocation refused"); } });
  assert.equal(result === second, true, "later calls retain the original refusal object");
  const stopped = ProgramWork.state(first.context.resources).seed;
  assert.equal(stopped.kind, "refused");
  assert.notEqual(stopped.adopted, null);
  assert.equal(product.verifyProgramIndex({ ...first.index, types: stopped.adopted }, first.context) === result, true,
    "the exact adopted view and original input return the same stop");
  assert.deepEqual([(1000000 - remainingWork(ProgramWork.state(first.context.resources).account)), ProgramWork.state(first.context.resources).created], counters);
  const other = { ...first.index, types: structuredClone(first.index.types) };
  assert.throws(() => product.verifyModuleBodies(other, first.module, first.context), /another published type table/u);
});

test("ir-program standalone publication exhaustion names its original enclosing bound, not a remaining sub-allowance", () => {
  const fixture = moduleFixture();
  const base = ProgramWork.state(fixture.context.resources).limits;
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const [original] = fixture.module.bodies;
  const module = { ...fixture.module, bodies: [{ kind: "template", instance: original.instance, tir: original.tir }] };
  for (const dimension of ["work", "created-records"]) {
    let completed = false;
    for (let maximum = 0; maximum <= 400; maximum += 1) {
      const result = product.instantiate(fixture.index, module, { kind: "tir", body: fixture.bodyId }, bindings, {
        ...base, maximumWork: dimension === "work" ? maximum : 10000,
        maximumCreatedRecords: dimension === "created-records" ? maximum : 10000 });
      if (result.kind === "instantiated") completed = true;
      else {
        assert.equal(completed, false);
        assert.deepEqual(result, { kind: "resource-limit", dimension, maximum });
      }
    }
    assert.equal(completed, true);
  }
});

test("ir-program seed selection shares the actual independent created-record stop without a competing failure state", async () => {
  const { emitInstantiationRecord } = await import("../../packages/host/dist/ir-program/work.js");
  const { verificationTypes, verificationFailure } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const fixture = moduleFixture();
  fixture.context.resources = product.createProgramVerificationWork({
    ...ProgramWork.state(fixture.context.resources).limits, maximumCreatedRecords: 0 },
    createAccount({ maximumWork: 1000, maximumResultEntries: 1000 }));
  assert.deepEqual(emitInstantiationRecord(ProgramWork.state(fixture.context.resources)),
    { kind: "resource-limit", dimension: "created-records", maximum: 0 });
  const original = verificationFailure(fixture.index, fixture.context.resources);
  assert.deepEqual(original, { kind: "resource-limit", dimension: "created-records", maximum: 0, site: { kind: "index" } });
  assert.equal(verificationTypes(fixture.index, fixture.context.resources), original);
  assert.equal(verificationFailure(fixture.index, fixture.context.resources), original);
  assert.throws(() => verificationTypes({ ...fixture.index, types: structuredClone(fixture.index.types) }, fixture.context.resources),
    /another published type table/u);
});

test("ir-program shared Metadata, Summary and Observation validators retain the same first enclosing work or entry stop", async () => {
  const { InvocationAccount } = await import("../../packages/host/dist/dataflow/account.js");
  for (const boundary of ["index", "module"]) {
    const make = () => publishedArtifactFixture("none").first;
    const invoke = fixture => boundary === "index" ? product.verifyProgramIndex(fixture.index, fixture.context)
      : product.verifyModuleBodies(fixture.index, fixture.module, fixture.context);
    const actual = make();
    assert.equal(invoke(actual).kind, "complete");
    const needed = InvocationAccount.stateOf(ProgramWork.state(actual.context.resources).account);
    for (const [dimension, maximum] of [["work", needed.work], ["result-entries", needed.entries]]) {
      for (let available = 0; available < maximum; available += 1) {
        const fixture = make();
        const account = createAccount({ maximumWork: dimension === "work" ? available : needed.work,
          maximumResultEntries: dimension === "result-entries" ? available : needed.entries });
        fixture.context.resources = product.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits, account);
        const stopped = invoke(fixture);
        assert.equal(stopped.kind, "resource-limit", boundary);
        assert.equal(stopped.dimension, dimension);
        assert.equal(stopped.maximum, available);
        assert.equal(stopped, accountFailure(account));
        assert.equal("violations" in stopped, false);
        assert.equal(product.verifyModuleBodies(fixture.index, null, fixture.context), stopped);
        assert.equal(product.verifyProgramIndex(fixture.index, { ...fixture.context,
          selectedNativeFacts: undefined, tirOf: () => { throw new Error("no publication traversal after refusal"); } }), stopped);
      }
    }
  }
});

test("ir-program every charged static witness stage refuses without partial findings under the same invocation account", () => {
  const factories = [
    () => metadataOperationFixture("size", "present", "layout"),
    () => metadataFieldFixture("field"),
    () => metadataBindingFixture("field", "field"),
    () => metadataBindingFixture("field", "layout"),
    () => metadataBindingFixture("record", "layout"),
    () => metadataBindingFixture("record", "field"),
    () => metadataOperationFixture("size", "absent", "layout"),
  ];
  for (const create of factories) for (const [limit, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
    let completed = false;
    const reference = create().first;
    const referenceAccount = ProgramWork.state(reference.context.resources).account;
    const before = remainingWork(referenceAccount);
    assert.equal(product.verifyModuleBodies(reference.index, reference.module, reference.context).kind, "complete");
    const last = limit === "maximumWork" ? before - remainingWork(referenceAccount) : ProgramWork.state(reference.context.resources).created;
    for (let maximum = 0; maximum <= last; maximum += 1) {
      const { first } = create();
      first.context.resources = product.createProgramVerificationWork({ ...ProgramWork.state(first.context.resources).limits, ...(limit === "maximumCreatedRecords" ? { maximumCreatedRecords: maximum } : {}) }, createAccount({ maximumWork: limit === "maximumWork" ? maximum : 1000000, maximumResultEntries: 1000000000 }));
      const result = product.verifyModuleBodies(first.index, first.module, first.context);
      if (result.kind === "complete") completed = true;
      else {
        assert.equal(completed, false, "increasing one actual account cannot turn success into a refusal");
        assert.equal(result.dimension, dimension, "only the varied invocation dimension refuses");
        assert.equal(result.maximum, maximum, "the original bound is retained");
        assert.equal("violations" in result, false, "refusal never publishes partial findings");
        assert.equal(ProgramWork.state(first.context.resources).seed.kind, "refused", "the same first stop is sticky");
      }
    }
    assert.equal(completed, true, "the bounded constructed witness has a complete result with sufficient resources");
  }
});

test("ir-program every signature record role and actual constant payload retains its complete identity-publication value", () => {
  const fixture = moduleFixture();
  const bindings = { kind: "parametric" };
  fixture.index.signatures = [
    { kind: "advertised", definition: fixture.definition, bindings, ordinal: 0, signature: 0 },
    { kind: "api-signature", definition: fixture.definition, bindings, ordinal: 0, signature: 0 },
    { kind: "api-body", definition: fixture.definition, bindings, ordinal: 0, signature: 0, body: fixture.bodyId },
  ];
  const constantValues = [{ type: 0, kind: "number", value: { numerator: 1n, denominator: 2n, negativeZero: false } },
    { type: 0, kind: "floating", bits: 0x8000000000000000n },
    { type: 0, kind: "bigint", value: 9007199254740993n }, { type: 0, kind: "string", value: "\ud800\n" },
    { type: 0, kind: "boolean", value: false }, { type: 0, kind: "absence" },
    { type: 0, kind: "unique-symbol", declaration: fixture.definition }, { type: 0, kind: "error" }];
  fixture.index.constants = constantValues.map(value => ({ reference: { initializer: fixture.instance, context: "compile-time" }, value }));
  const program = { index: fixture.index, modules: [fixture.module] };
  completeProgramValue(projectFixtureProgram(program, { table: fixture.index.types, types: [0], signatures: [0] }), program,
    "all complete signature/constant records retain their fields and original ordinal, kind and body identity");
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(fixture.index)), { kind: "parsed", value: fixture.index },
    "all complete structural records roundtrip independently of later semantic index validation");
});

test("ir-program metadata authorization retains exact selected field and record descriptor evidence", () => {
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  const mutations = [
    ["foreign field owner", (fixture, field) => { field.occurrence.body = fixture.second.bodyId; }],
    ["missing selected field", (_fixture, field) => { field.field = unavailable; }],
    ["missing field bindings", (_fixture, field) => { field.bindings = unavailable; }],
    ...["absent", "no-annotation", "non-value", "missing-memory", "null-memory", "wrong-kind", "wrong-occurrence", "missing-layout"].map(kind =>
      [`field descriptor ${kind}`, fixture => {
        const reference = { kind: "body", value: { body: fixture.third.bodyId, node: 2 } };
        const selected = fixture.third.answers.get(encodeContextKey(["nodeOf", reference]));
        if (kind === "absent") {
          const reader = fixture.first.tirInput.nodeOf;
          fixture.first.tirInput.nodeOf = source => encodeContextKey(["nodeOf", source]) === encodeContextKey(["nodeOf", reference]) ? null : reader(source);
        } else if (kind === "no-annotation") selected.tsonic = null;
        else if (kind === "non-value") selected.tsonic = fixture.third.tirInput.source.tree.tsonic;
        else if (kind === "missing-memory") selected.tsonic.value.memory = unavailable;
        else if (kind === "null-memory") selected.tsonic.value.memory = { kind: "available", value: null };
        else if (kind === "wrong-kind") selected.tsonic.value.memory.value.kind = "value";
        else if (kind === "wrong-occurrence") selected.tsonic.value.memory.value.occurrence = { kind: "body", value: { body: fixture.third.bodyId, node: 0 } };
        else selected.tsonic.value.memory.value.fieldLayout = unavailable;
      }]),
    ...["absent", "no-annotation", "non-value", "missing-memory", "null-memory", "wrong-kind", "wrong-occurrence", "missing-bindings"].map(kind =>
      [`owner layout ${kind}`, fixture => {
        const reference = { kind: "body", value: { body: fixture.first.bodyId, node: 6 } };
        const selected = fixture.first.answers.get(encodeContextKey(["nodeOf", reference]));
        if (kind === "absent") {
          const reader = fixture.first.tirInput.nodeOf;
          fixture.first.tirInput.nodeOf = source => encodeContextKey(["nodeOf", source]) === encodeContextKey(["nodeOf", reference]) ? null : reader(source);
        } else if (kind === "no-annotation") selected.tsonic = null;
        else if (kind === "non-value") selected.tsonic = fixture.first.tirInput.source.tree.tsonic;
        else if (kind === "missing-memory") selected.tsonic.value.memory = unavailable;
        else if (kind === "null-memory") selected.tsonic.value.memory = { kind: "available", value: null };
        else if (kind === "wrong-kind") selected.tsonic.value.memory.value.kind = "field";
        else if (kind === "wrong-occurrence") selected.tsonic.value.memory.value.occurrence = { kind: "body", value: { body: fixture.first.bodyId, node: 0 } };
        else selected.tsonic.value.memory.value.bindings = unavailable;
      }]),
  ];
  for (const [name, mutate] of mutations) {
    const fixture = metadataBindingFixture("field", "layout");
    mutate(fixture, fixture.checked.tsonic.core.fieldBinding.value);
    const result = product.verifyModuleBodies(fixture.first.index, fixture.first.module, fixture.first.context);
    assert.equal(result.kind, "complete", name);
    assert.equal(result.violations.some(row => row.rule === "metadata-constant-not-materialised"), true, name);
  }
});

test("ir-program raw-memory metadata witnesses use the actual selected descriptor and no spelling or type fallback", () => {
  for (const operation of ["to-raw", "reinterpret", "raw-to-address-integer", "address-integer-to-raw"]) {
    for (const missing of [false, true]) {
      const selected = operation === "to-raw" || operation === "reinterpret" ? "layout" : "data-layout";
      const fixture = metadataOperationFixture("size", "absent", selected);
      const reference = { kind: "body", value: { body: fixture.first.bodyId, node: 2 } };
      const descriptor = selected === "layout"
        ? { kind: "body", value: { body: fixture.first.bodyId, node: 4 } }
        : { kind: "body", value: { body: fixture.second.bodyId, node: 2 } };
      fixture.checked.tsonic.core.pointerOperation = { kind: "available", value: operation === "to-raw"
        ? { family: "raw-memory", operation, pointer: reference, layout: descriptor }
        : operation === "reinterpret" ? { family: "raw-memory", operation, raw: reference, layout: descriptor }
        : { family: "raw-memory", operation, ...(operation === "raw-to-address-integer" ? { raw: reference } : { address: reference }),
          integer: { width: 64, runtimeBase: "bigint", signedness: "unsigned" }, dataLayout: descriptor } };
      if (missing) {
        const reader = fixture.first.tirInput.nodeOf;
        fixture.first.tirInput.nodeOf = source => encodeContextKey(["nodeOf", source]) === encodeContextKey(["nodeOf", descriptor]) ? null : reader(source);
      }
      const result = product.verifyModuleBodies(fixture.first.index, fixture.first.module, fixture.first.context);
      assert.equal(result.kind, "complete", operation);
      assert.equal(result.violations.some(row => row.rule === "metadata-constant-not-materialised"), missing, operation);
    }
  }
});

test("ir-program metadata witness kernel preserves selected descriptor opposites and its charged operand-family boundaries", async () => {
  const { verifyMetadataOperands } = await import("../../packages/host/dist/ir-program/verify-metadata-operands.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const available = value => ({ kind: "available", value });
  const unavailable = { kind: "unavailable", reason: "not-provided", causes: [] };
  const check = fixture => {
    const { first } = fixture;
    const prepared = verificationTypes(first.index, first.context.resources);
    assert.equal(prepared.kind, "complete");
    return verifyMetadataOperands(first.selected, first.tirInput, programLookup(first.index), first.context, prepared.types);
  };
  for (const kind of ["field-item", "missing-field-root", "missing-layout-root", "missing-field-memory", "missing-layout-memory",
    "foreign-record", "missing-linked-node", "wrong-linked-node", "missing-parametric-scope", "instantiated", "substitution-refusal"]) {
    const fixture = metadataBindingFixture(kind.includes("record") || kind.includes("linked") ? "record" : "field",
      kind.includes("field-root") || kind.includes("linked") || kind === "field-item" ? "field" : "layout");
    const { first, third } = fixture;
    const published = first.selected;
    const fieldSource = { kind: "body", value: { body: third.bodyId, node: 2 } };
    const layoutSource = { kind: "body", value: { body: first.bodyId, node: 6 } };
    const fieldNode = first.tirInput.nodeOf(fieldSource);
    const layoutNode = first.tirInput.nodeOf(layoutSource);
    if (kind === "field-item") {
      const item = { kind: "item", value: { owner: third.definition, node: 2 } };
      fixture.checked.tsonic.core.fieldBinding.value.field = available(item);
      fieldNode.tsonic.value.memory.value.occurrence = item;
      first.index.metadata.find(value => value.kind === "memory-field").fields[0].occurrence = item;
    } else if (kind === "missing-field-root") first.index.metadata.find(value => value.kind === "memory-field").root = 9;
    else if (kind === "missing-layout-root") first.index.metadata[0].root = 9;
    else if (kind === "missing-field-memory") delete fieldNode.tsonic.value.memory;
    else if (kind === "missing-layout-memory") delete layoutNode.tsonic.value.memory;
    else if (kind === "foreign-record") fixture.checked.tsonic.core.recordBinding.value.occurrence.body = third.bodyId;
    else if (kind === "missing-linked-node") {
      const reader = first.tirInput.nodeOf;
      first.tirInput.nodeOf = source => source.kind === "body" && source.value.body === first.bodyId && source.value.node === 4 ? null : reader(source);
    } else if (kind === "wrong-linked-node") {
      first.tirInput.nodeOf({ kind: "body", value: { body: first.bodyId, node: 4 } }).tsonic.core.fieldBinding.value.occurrence.node = 0;
    } else if (kind === "missing-parametric-scope") {
      const key = first.selected.mir.constants[0].value;
      key.bindings = { kind: "parametric" };
      first.index.metadata[0].key.bindings = key.bindings;
      first.context.facts.bindingScopeOf = () => null;
    } else {
      first.instance.bindings = { kind: "instantiated", bindings: published.tir.lexicalBindings };
      if (kind === "substitution-refusal") ProgramWork.state(first.context.resources).limits.typeExpansion.maximumVisits = 0;
    }
    const result = check(fixture);
    if (kind === "substitution-refusal") {
      assert.equal(isDeepStrictEqual(result, { kind: "resource-limit", site: { kind: "body", instance: first.instance }, dimension: "visits", maximum: 0 }), true);
    } else {
      assert.equal(result.kind, "complete", kind);
      assert.equal(result.violations.length === 0, kind === "field-item" || kind === "instantiated", kind);
    }
  }
  for (const form of ["binary", "tuple", "record"]) {
    const fixture = form === "record" ? metadataFieldFixture("layout") : metadataOperationFixture("size", "present", "layout");
    const { first } = fixture;
    const published = first.selected;
    const statement = published.mir.blocks[0].statements[1];
    const operand = { kind: "constant", constant: 0 };
    const operation = { permissionScope: null, decision: { kind: "selected", operation: {
      kind: "native-operator", operator: "+", carrier: "uint64" }, operands: [2, 2], result: 2, execution: { kind: "pure" } } };
    statement.value = form === "binary" ? { kind: "binary", operation, left: operand, right: operand }
      : { kind: "aggregate", type: 2, aggregate: form === "tuple" ? { kind: "tuple", elements: [operand, operand] }
        : { kind: "record", fields: [0, 1].map(() => ({
          member: { decision: { ...first.index.metadata.find(value => value.kind === "memory-field").fields[0].member,
            read: 1, write: 1, getter: null, setter: null, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } },
            getter: null, setter: null }, value: operand })) } };
    const beforeSeed = remainingWork(ProgramWork.state(first.context.resources).account);
    const prepared = verificationTypes(first.index, first.context.resources);
    assert.equal(prepared.kind, "complete");
    const initial = { work: beforeSeed - remainingWork(ProgramWork.state(first.context.resources).account), created: ProgramWork.state(first.context.resources).created };
    for (const field of ["maximumWork", "maximumCreatedRecords"]) {
      for (let extra = 0; extra <= 32; extra += 1) {
        first.context.resources = product.createProgramVerificationWork({
          ...ProgramWork.state(first.context.resources).limits, maximumCreatedRecords: field === "maximumCreatedRecords" ? initial.created + extra : 10000 }, createAccount({ maximumWork: field === "maximumWork" ? initial.work + extra : 10000, maximumResultEntries: 1000000000 }));
        const result = check(fixture);
        assert.equal(result.kind === "complete" || result.kind === "resource-limit", true, form);
        if (result.kind === "resource-limit") assert.equal("violations" in result, false, "no partial metadata result after a charged operand refuses");
      }
    }
  }
  const fixture = metadataOperationFixture("size", "present", "layout");
  fixture.first.tirInput.source.bodies[0].nestedBodies = [fixture.first.bodyId];
  fixture.first.tirInput.source.bodies[0].nestedBodies.push(fixture.second.bodyId);
  const result = product.verifyModuleBodies(fixture.first.index, fixture.first.module, fixture.first.context);
  assert.equal(result.kind, "complete");
  assert.equal(result.violations.some(row => row.rule === "nested-body-boundary"), true,
    "a malformed supplied nested-source relation is a caller defect, never a second body or silently ignored edge");
});

test("Instantiate consumes the actual TIR root and formal slots exactly once after their existing charges", async () => {
  const { captureSourceBarrier } = await import("../../packages/host/dist/pipeline/source-barrier.js");
  const { typeSourceBarrier } = await import("../../packages/host/dist/pipeline/typed-barrier.js");
  const front = await loadFrontFixture();
  const input = analysisInput(front, "sdk-minimal");
  input.snapshot = front.projectSnapshot({ sourceFiles: { "main.ts":
    "export function take(left: boolean, right: boolean): void { return; }" },
  libraries: [{ name: "lib.es5.d.ts", text: front.sdk.barebonesLibContent }] });
  const source = captureSourceBarrier(input);
  assert.equal(source.kind, "ok", JSON.stringify(source.diagnostics));
  const typed = typeSourceBarrier(input, source.value, createAccount(input.limits.dataflow));
  assert.equal(typed.kind, "ok", JSON.stringify(typed.diagnostics));
  const selected = [...typed.value.modules.values()].find(module => module.bodies.some(body => body.params.length === 2));
  const template = selected.bodies.find(body => body.params.length === 2 && body.bindings.kind === "parametric");
  assert.equal(template.evidence.length, 0);
  assert.equal(template.yielded === null && template.sent === null, true);
  assert.equal(Object.values(template.lexicalBindings).every(family => family.length === 0), true);
  const reads = [];
  const syntaxReads = [];
  const expectedBody = structuredClone(template);
  const first = template.params[0];
  for (const field of ["modifiers", "dotDotDotToken", "name", "questionToken", "type", "initializer"]) {
    const original = first[field];
    Object.defineProperty(first, field, { get() {
      syntaxReads.push(field);
      return original;
    } });
  }
  const formals = new Array(template.params.length);
  for (const [index, formal] of template.params.entries())
    Object.defineProperty(formals, index, { get() { reads.push(`formal ${index}`); return formal; } });
  const origin = { ...template, get root() { reads.push("root"); return template.root; },
    get params() { reads.push("formal header"); return formals; } };
  const module = { module: selected.module, tree: selected.tree,
    bodies: [{ kind: "template", instance: { body: template.body, bindings: template.bindings }, tir: origin }] };
  const index = { ...moduleFixture().index, types: typeProduct.viewTypes(source.value.types) };
  const artifact = { kind: "tir", body: template.body };
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const limits = { ...input.limits.instantiation, maximumWork: 100000, maximumCreatedRecords: 100000 };
  const seed = paidSeedOf(index.types, limits);
  const header = seed.maximumWork + 2 + 3 + 19 + 5 + 1 + 1 + template.locals.length * 9;
  const invoke = maximumWork => product.instantiate(index, module, artifact, bindings, { ...limits, maximumWork });
  for (const [maximum, expected] of [
    [header - 1, []], [header, ["formal header"]], [header + 1, ["formal header", "formal 0"]],
    [header + 2, ["formal header", "formal 0", "formal 1", "root"]],
  ]) {
    reads.length = 0;
    assert.deepEqual(invoke(maximum), { kind: "resource-limit", dimension: "work", maximum });
    assert.deepEqual(reads, expected, `paid read prefix at ${maximum}`);
    assert.deepEqual(syntaxReads, [], "formal contents have not been admitted");
  }
  reads.length = 0;
  assert.deepEqual(invoke(limits.maximumWork), { kind: "instantiated", types: index.types,
    artifact: { kind: "tir", body: { ...expectedBody, bindings: { kind: "instantiated", bindings } } } });
  assert.deepEqual(reads, ["formal header", "formal 0", "formal 1", "root"], "the projected output never rereads raw roots");
  assert.deepEqual(syntaxReads, ["modifiers", "dotDotDotToken", "name", "questionToken", "type", "initializer"]);
});

test("Program metadata switch pays before reading the actual case constant", async () => {
  const { verifyMetadataOperands } = await import("../../packages/host/dist/ir-program/verify-metadata-operands.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
  const { first, checked } = metadataOperationFixture("size", "present", "layout");
  const block = first.selected.mir.blocks[0];
  block.statements.splice(1, 1);
  const validated = { ...block, id: 1, statements: [] };
  first.selected.mir.blocks.push(validated);
  const reads = [];
  const operand = { kind: "constant", get constant() { reads.push("operand"); return 0; } };
  first.selected.mir.constants.push({ id: 1, type: 2,
    value: { kind: "literal", value: { kind: "number", token: "2", value: { numerator: 2n, denominator: 1n, negativeZero: false } } } });
  const targets = [0, 1].map(constant => ({ target: 1, get constant() { reads.push(`case ${constant}`); return constant; } }));
  for (const [position, target] of targets.entries()) {
    Object.defineProperty(targets, position, { get() { reads.push(`case row ${position}`); return target; } });
  }
  block.terminator = { origin: block.origin, tir: { body: first.bodyId, node: checked.id }, kind: "switch",
    operand, targets, otherwise: 1, step: null };
  const limits = { ...ProgramWork.state(first.context.resources).limits, maximumWork: 10000 };
  const seed = paidSeedOf(first.index.types, limits);
  const lookup = programLookup(first.index);
  for (let allowance = 0; allowance <= 8; allowance += 1) {
    reads.length = 0;
    const account = createAccount({ maximumWork: seed.maximumWork + allowance, maximumResultEntries: 10000 });
    const context = { ...first.context, resources: product.createProgramVerificationWork(limits, account) };
    const verified = verificationTypes(first.index, context.resources);
    assert.equal(verified.kind, "complete");
    const result = verifyMetadataOperands(first.selected, first.tirInput, lookup, context, verified.types);
    if (allowance < 8) {
      assert.equal(result === accountFailure(account), true);
      assert.deepEqual(result, { kind: "resource-limit", dimension: "work", maximum: seed.maximumWork + allowance });
    } else {
      assert.deepEqual(result, { kind: "complete", violations: [] });
      assert.equal(remainingWork(account), 0);
    }
    const expected = [
      ...(allowance >= 1 ? ["operand"] : []),
      ...(allowance >= 4 ? ["case row 0", "case 0"] : []),
      ...(allowance >= 6 ? ["case row 1", "case 1"] : []),
    ];
    assert.deepEqual(reads, expected, `allowance ${allowance}`);
  }
});

test("Program metadata only authorizes a qualified generic witness with an admitted concrete image", async () => {
  const { verifyMetadataOperands } = await import("../../packages/host/dist/ir-program/verify-metadata-operands.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
  for (const [admitted, limit] of [[false, null], [true, null], [true, "depth"], [true, "union-members"], [true, "intersection-members"]]) {
    const { first, checked } = metadataBindingFixture("field", "field");
    const parameter = typeParameterDeclaration(first.definition, 0);
    const bindingParameter = typeParameterDeclaration(first.definition, 1);
    const bind = (parameter, type) => ({ classBindings: [{ kind: "bound", parameter, type }],
      methodBindings: [], capturedBindings: [], selfBindings: [] });
    const { terms } = first.index.types;
    const formal = terms.length;
    const compound = formal + 1;
    const compoundKind = limit === "union-members" ? "union" : limit === "intersection-members" ? "intersection" : "array";
    const selected = compoundKind === "array" ? compound + 1 : 1;
    terms.push({ kind: "param", parameter }, compoundKind === "array" ? { kind: "array", element: formal, readonly: false }
      : { kind: compoundKind, members: [1, formal] });
    if (compoundKind === "array" && admitted) terms.push({ kind: "array", element: 1, readonly: false });
    first.selected.instance.bindings = { kind: "instantiated", bindings: bind(parameter, 1) };
    checked.tsonic.core.fieldBinding.value.bindings.value = bind(bindingParameter, compound);
    const exact = { kind: "instantiated", bindings: bind(bindingParameter, selected) };
    first.index.metadata.find(row => row.kind === "memory-field").key.bindings = exact;
    first.selected.mir.constants[0].value.bindings = exact;
    const prepared = verificationTypes(first.index, first.context.resources);
    assert.equal(prepared.kind, "complete");
    const before = [...prepared.index.types.terms];
    if (limit !== null) {
      const fields = { depth: "maximumDepth", "union-members": "maximumUnionMembers", "intersection-members": "maximumIntersectionMembers" };
      ProgramWork.state(first.context.resources).limits.typeExpansion[fields[limit]] = limit === "depth" ? 0 : 1;
    }
    const result = verifyMetadataOperands(first.selected, first.tirInput, programLookup(prepared.index), first.context, prepared.types);
    if (limit === null) {
      assert.equal(result.kind, "complete");
      assert.deepEqual(result.violations.map(row => row.rule), admitted ? [] : ["metadata-constant-not-materialised"]);
    } else assert.deepEqual(result, { kind: "resource-limit", dimension: limit, maximum: limit === "depth" ? 0 : 1,
      site: { kind: "body", instance: first.instance } });
    assert.equal(prepared.index.types.terms.length, before.length);
    assert.equal(before.every((value, index) => value === prepared.index.types.terms[index]), true);
  }
});

test("ir-program raw descriptor kernel refuses each actual allocation boundary and absent selected memory evidence", async () => {
  const { verifyMetadataOperands } = await import("../../packages/host/dist/ir-program/verify-metadata-operands.js");
  const { programLookup } = await import("../../packages/host/dist/ir-program/program-values.js");
  const { verificationTypes } = await import("../../packages/host/dist/ir-program/verification-work.js");
  for (const missing of [null, "declaration", "type"]) {
    for (let extra = 0; extra <= 32; extra += 1) {
      const { first, checked } = metadataOperationFixture("size", "absent", "layout");
      const source = { kind: "body", value: { body: first.bodyId, node: 4 } };
      checked.tsonic.core.pointerOperation = { kind: "available", value: { family: "raw-memory", operation: "to-raw",
        pointer: { kind: "body", value: { body: first.bodyId, node: 2 } }, layout: source } };
      if (missing !== null) {
        const selected = first.tirInput.nodeOf(source);
        selected.tsonic = missing === "declaration" ? first.tirInput.source.tree.tsonic
          : { core: selected.tsonic.core, type: { kind: "available", value: 1 }, referencedDefinitions: [] };
      }
      const prepared = verificationTypes(first.index, first.context.resources);
      assert.equal(prepared.kind, "complete");
      ProgramWork.state(first.context.resources).limits.maximumCreatedRecords = ProgramWork.state(first.context.resources).created + extra;
      const result = verifyMetadataOperands(first.selected, first.tirInput, programLookup(first.index), first.context, prepared.types);
      if (result.kind === "resource-limit") {
        assert.equal(result.dimension, "created-records");
        assert.equal("violations" in result, false);
      } else assert.equal(result.violations.length === 0, missing === null);
    }
  }
});

test("ir-program summary and metadata selection distinguish unrelated owners and genuine binding dependence", () => {
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
  const unrelated = moduleFixture("src/other.ts").bodyId;
  const summary = { ...input.index.summaries[0], key: { kind: "body", execution: { instance: {
    body: input.artifact.body, bindings: { kind: "parametric" } }, provided: input.artifact.provided } }, bindingDependent: true };
  const index = { ...input.index, summaries: [{ ...summary, key: { kind: "body", execution: {
    ...summary.key.execution, instance: { ...summary.key.execution.instance, body: unrelated } } } }, summary] };
  completeProgramValue(product.instantiate(index, input.module, input.artifact, input.bindings, input.limits),
    { kind: "missing-binding-artifact", artifact: input.artifact, bindings: input.bindings }, "a dependent parametric summary is not an instantiated answer");
  const fixture = moduleFixture();
  const metadata = { key: { definition: fixture.definition, bindings: { kind: "parametric" } }, kind: "data-layout",
    occurrence: { kind: "item", value: { owner: fixture.definition, node: 0 } }, fingerprint: "native64-le", byteOrder: "little", addressWidth: 64 };
  fixture.index.metadata = [{ ...metadata, key: { ...metadata.key, definition: unrelated } }, metadata];
  const artifact = { kind: "metadata", definition: fixture.definition };
  completeProgramValue(product.instantiate(fixture.index, fixture.module, artifact, input.bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 }),
    { kind: "instantiated", artifact: { kind: "metadata", metadata }, types: fixture.index.types }, "the exact selected independent data record is borrowed whole");
});

test("a real parametric body Summary stops before copying an unpaid projection", () => {
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
  const published = input.index.summaries[0];
  const execution = published.key.execution;
  const template = { ...published, bindingDependent: false,
    key: { kind: "body", execution: { ...execution, instance: { ...execution.instance, bindings: { kind: "parametric" } } } } };
  input.index.summaries = [template];
  const limits = { ...input.limits, maximumWork: 10000, maximumCreatedRecords: 10000, typeExpansion: {
    maximumDepth: 128, maximumVisits: 10000, maximumUnionMembers: 128, maximumIntersectionMembers: 128,
  } };
  const seed = paidSeedOf(input.index.types, limits);
  const budget = seed.maximumWork + 2 + 3;
  const invoke = maximumWork => product.instantiate(input.index, input.module, input.artifact, input.bindings, { ...limits, maximumWork });
  assert.deepEqual(invoke(limits.maximumWork), { kind: "instantiated", artifact: { kind: "summary", summary: { ...template, key: published.key } },
    types: input.index.types });
  const signature = template.signature;
  let signatureReads = 0;
  Object.defineProperty(template, "signature", { enumerable: true, get: () => { signatureReads++; return signature; } });
  assert.deepEqual(invoke(budget), { kind: "resource-limit", dimension: "work", maximum: budget });
  assert.equal(signatureReads, 0);
});

test("Execution and DeclaredExecution text forms round trip and refuse a wrong field (COMMON-DATA section 1; K-3367 D)", async () => {
  const { textExecution, textDeclaredExecution } = await import("../../packages/host/dist/ir-program/text-types.js");
  const { readExecution, readDeclaredExecution } = await import("../../packages/host/dist/ir-program/parse-types.js");
  const { emitText } = await import("../../packages/host/dist/ir-program/text-values.js");
  const ids = await import("../../packages/host/dist/ids/index.js");
  const cursorOf = text => ({ text, offset: 0, identities: { type: ids.tyId, signature: ids.sigId, node: ids.nodeId, local: ids.localId,
    expansion: value => value, hostCode: value => value } });
  const module = ids.encodeModuleId({ package: ids.encodePackageId("ir-program-tests"), path: "main.ts" });
  const definition = ids.encodeDefId({ module, segments: [{ name: "f", ordinal: 0 }] });
  const body = ids.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const vector = { classBindings: [{ kind: "bound", parameter: typeParameterDeclaration(definition, 0), type: 3 }], methodBindings: [],
    capturedBindings: [], selfBindings: [] };
  const executions = [{ instance: { body, bindings: { kind: "parametric" } }, provided: 0 },
    { instance: { body, bindings: { kind: "instantiated", bindings: vector } }, provided: 2 }];
  for (const execution of executions) {
    const text = emitText(textExecution(execution), "execution");
    const parsed = readExecution(cursorOf(text));
    assert.equal(parsed.kind, "parsed", text);
    assert.deepEqual(parsed.value, execution);
  }
  const declared = { request: { definition, endpoint: "api-signature", ordinal: 1, bindings: { kind: "instantiated", bindings: vector } }, provided: 1 };
  const declaredText = emitText(textDeclaredExecution(declared), "declared");
  const parsedDeclared = readDeclaredExecution(cursorOf(declaredText));
  assert.equal(parsedDeclared.kind, "parsed", declaredText);
  assert.deepEqual(parsedDeclared.value, declared);
  const executionText = emitText(textExecution(executions[1]), "execution");
  for (const [label, broken, read] of [
    ["another record name", executionText.replace("Execution", "Executio"), readExecution],
    ["a malformed instance", executionText.replace("BodyInstance", "BodyInstanc"), readExecution],
    ["a provided count that is not a number", executionText.replace(/provided[^0-9]*2/, match => match.replace("2", "x")), readExecution],
    ["an unclosed execution", executionText.slice(0, executionText.lastIndexOf(")")), readExecution],
    ["another declared record name", declaredText.replace("DeclaredExecution", "DeclaredExecutio"), readDeclaredExecution],
    ["another request record name", declaredText.replace("SignatureRequest", "SignatureReques"), readDeclaredExecution],
    ["a malformed definition", declaredText.replace("def:", "dfe:"), readDeclaredExecution],
    ["an unknown endpoint", declaredText.replace("api-signature", "api-other"), readDeclaredExecution],
    ["an ordinal that is not a number", declaredText.replace(/ordinal[^0-9]*1/, match => match.replace("1", "x")), readDeclaredExecution],
    ["malformed request bindings", declaredText.replace("instantiated", "instantiate"), readDeclaredExecution],
    ["an unclosed request", declaredText.replace(/\)\s*,?\s*provided/, " provided"), readDeclaredExecution],
    ["a declared provided count that is not a number", declaredText.replace(/provided[^0-9]*1(?![^]*provided)/, match => match.replace("1", "x")), readDeclaredExecution],
    ["an unclosed declared execution", declaredText.slice(0, declaredText.lastIndexOf(")")), readDeclaredExecution],
  ]) {
    assert.equal(read(cursorOf(broken)).kind, "invalid-text", label);
  }
});

test("ir-program existing nonempty binding keys consume their actual selection work before borrowing", () => {
  for (const separate of [false, true]) {
    const fixture = dualInstanceFixture();
    const selected = fixture.module.bodies[1];
    const bindings = selected.instance.bindings.bindings;
    bindings.classBindings.push({ kind: "bound", parameter: typeParameterDeclaration(fixture.definition, 0), type: 0 });
    if (separate) selected.tir.bindings = structuredClone(selected.instance.bindings);
    const artifact = { kind: "tir", body: fixture.bodyId };
    const limits = { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: 1000000 };
    const seed = paidSeedOf(fixture.index.types, limits);
    const exact = seed.maximumWork + (separate ? 6 : 5);
    for (let maximum = 0; maximum <= exact + 1; maximum += 1) {
      const result = product.instantiate(fixture.index, fixture.module, artifact, bindings, { ...limits, maximumWork: maximum });
      const expected = maximum < exact ? { kind: "resource-limit", dimension: "work", maximum }
        : { kind: "instantiated", artifact: { kind: "tir", body: selected.tir }, types: fixture.index.types };
      completeProgramValue(result, expected, "each distinct canonical vector pays its own selection work and the exact artifact is borrowed");
    }
  }
});

test("artifact selection encodes only the binding rows it actually paid to read", async () => {
  const { selectArtifact } = await import("../../packages/host/dist/ir-program/instantiate.js");
  const { createInstantiationMeter } = await import("../../packages/host/dist/ir-program/work.js");
  for (const maximumWork of [0, 1, 2, 3, 4, 5]) {
    const fixture = dualInstanceFixture();
    const selected = fixture.module.bodies[1];
    const bindings = selected.instance.bindings.bindings;
    const binding = { kind: "bound", parameter: typeParameterDeclaration(fixture.definition, 0), type: tyId(0) };
    bindings.classBindings.push(binding);
    const meter = createInstantiationMeter({ ...ProgramWork.state(fixture.context.resources).limits, maximumWork });
    const pulls = [];
    const rows = [binding];
    Object.defineProperty(rows, 0, { get() {
      pulls.push(maximumWork - remainingWork(meter.account));
      return pulls.length === 1 ? binding : { ...binding, type: tyId(1) };
    } });
    const result = selectArtifact(meter, fixture.index, fixture.module, { kind: "tir", body: fixture.bodyId }, { ...bindings, classBindings: rows });
    assert.deepEqual(pulls, maximumWork < 2 ? [] : [2]);
    if (maximumWork < 5) assert.equal(result === accountFailure(meter.account), true);
    else {
      assert.equal(result.kind, "exact");
      assert.equal(result.artifact.body === selected.tir, true);
    }
  }
});

for (const kind of ["tir", "mir", "facts", "summary"]) test(`ir-program ${kind} transports a genuine complete published type seed and exact resource outcomes`, () => {
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const fixture = kind === "mir" || kind === "facts" ? moduleFixture(undefined, undefined, { kind: "instantiated", bindings }) : moduleFixture();
  const generous = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const publication = typeProduct.exportTypes(admitFixtureTable(typeProduct, transportTypeTable(fixture)), generous);
  assert.equal(publication.kind, "complete", "the lower owner publishes the actual complete type seed");
  fixture.index.types = publication.value.table;
  const voidType = publication.value.types[0];
  const signature = publication.value.signatures[0];
  const published = fixture.module.bodies[0];
  published.tir.signature = signature;
  published.tir.completion = voidType;
  published.mir.result = voidType;
  let expectedArtifact;
  let artifact;
  if (kind === "summary") {
    const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
    const summary = { ...input.index.summaries[0], signature, bindingDependent: false,
      key: { kind: "body", execution: published.facts[0].execution } };
    fixture.index.summaries = [summary];
    artifact = { kind, target: "body", body: fixture.bodyId, provided: summary.key.execution.provided };
    expectedArtifact = { kind, summary: { ...structuredClone(summary), key: { kind: "body", execution: {
      instance: { body: fixture.bodyId, bindings: { kind: "instantiated", bindings } }, provided: summary.key.execution.provided } } } };
  } else {
    artifact = { kind, body: fixture.bodyId };
    if (kind === "facts") artifact = { ...artifact, provided: published.facts[0].execution.provided };
    expectedArtifact = kind === "facts" ? { kind, facts: { ...structuredClone(published.facts[0]), execution: {
      instance: { body: fixture.bodyId, bindings: { kind: "instantiated", bindings } },
      provided: published.facts[0].execution.provided,
    } } } : { kind, body: { ...structuredClone(published[kind]), bindings: { kind: "instantiated", bindings } } };
  }
  const expected = { kind: "instantiated", artifact: expectedArtifact, types: publication.value.table };
  const invoke = limits => product.instantiate(fixture.index, fixture.module, artifact, bindings, limits);
  completeProgramValue(invoke(generous), expected, "the complete artifact and every original published type/signature ID remain unchanged");
  for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
    let completed = false;
    for (let maximum = 0; maximum <= 700; maximum += 1) {
      const actual = invoke({ ...generous, [field]: maximum });
      if (actual.kind === "instantiated") {
        completed = true;
        completeProgramValue(actual, expected, "a sufficient budget returns the entire unchanged expected artifact");
      } else {
        assert.equal(completed, false, "increasing only this budget cannot turn a completed projection into a limit");
        assert.equal(actual.kind, "resource-limit", "an insufficient budget publishes no artifact or partial table");
        assert.equal(actual.dimension, dimension, "only the independently varied budget can be exhausted");
        completeProgramValue(Object.keys(actual).sort(), ["dimension", "kind", "maximum"], "a refusal has no hidden partial payload");
        assert.equal(actual.maximum, maximum,
          "publication preserves the original invocation limit without partial output");
        if (maximum === 0) completeProgramValue(actual, { kind: "resource-limit", dimension, maximum: 0 }, "complete exact zero-budget refusal");
      }
    }
  }
});

after(async () => {
  try {
    const capture = await post("Profiler.takePreciseCoverage");
    const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
    const result = capture.result.filter(script => urls.has(script.url));
    const sources = [];
    for (const script of result) {
      const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
      sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
    }
    await post("Profiler.stopPreciseCoverage");
    const raw = [{ ...capture, result, sources }];
    const report = checkCoverage({
      canonical: realpathSync,
      readText: path => readFileSync(path, "utf8"),
      parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }),
    }, [...runtimeFiles, ...typeOnlyNames.map(name => resolve(repository, `packages/host/src/ir-program/${name}.ts`))], raw);
    const root = resolve(repository, ".temp/ir-program-coverage");
    mkdirSync(root, { recursive: true });
    const directory = mkdtempSync(resolve(root, "proof-"));
    writeFileSync(resolve(directory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({
      path, hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex"),
    })), null, 2)}\n`);
    writeFileSync(resolve(root, "latest.json"), `${JSON.stringify({ directory })}\n`);
    assert.equal(result.length, runtimeFiles.length, "every real owned runtime file has nonempty V8 evidence");
    assert.equal(report.status, "passed", `Actual retained proof: ${directory}; ${JSON.stringify(report.findings).slice(0, 6000)}`);
    assert.equal(report.files.filter(file => file.status === "covered").length, runtimeFiles.length);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, typeOnlyNames.length, "the declared data sources are all type-only");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally {
    session.disconnect();
  }
});
