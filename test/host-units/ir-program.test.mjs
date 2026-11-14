import assert from "node:assert/strict";
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
import { encodeBodyId, encodeDefId, encodeKey, encodeModuleId, tyId } from "../../packages/host/dist/ids/index.js";
import { summaryKey } from "../../packages/host/dist/ir-facts/index.js";
import { artifactBindingsData, executionKey } from "../../packages/host/dist/ir-types/index.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const runtimeNames = [
  "index", "canonical", "canonical-types", "canonical-inference", "canonical-tir",
  "canonical-facts", "canonical-syntax", "print", "parse", "verify-index", "verify-module", "instantiate",
  "canonical-phase", "syntax-arena", "syntax-statements", "syntax-expressions", "syntax-types", "syntax-auxiliary",
  "text-values", "text-types", "text-inference", "text-phase", "print-syntax-statements",
  "print-syntax-expressions", "print-syntax-types", "print-syntax-auxiliary",
  "text-core", "text-tir", "text-phase-declarations", "print-syntax",
  "parse-values", "parse-types", "parse-diagnostics",
  "syntax-edges", "program-values", "verify-structure", "parse-core", "parse-inference",
  "parse-tir", "parse-phase-declarations", "parse-phase",
  "parse-syntax-values", "parse-syntax-statements", "parse-syntax-expressions", "parse-syntax-types",
  "parse-syntax-auxiliary", "parse-syntax-jsdoc", "parse-syntax-references", "parse-syntax", "instantiate-types", "instantiate-phase",
  "verification-work", "work", "verify-metadata-operands",
  "instantiate-tir", "instantiate-facts", "instantiate-syntax",
];
const sourceFiles = ["contract", "work-data", ...runtimeNames].map(name => `packages/host/src/ir-program/${name}.ts`);
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
const { ProgramWork } = await import("../../packages/host/dist/ir-program/work.js");
const { encodeContextKey, authoredMethodGraph, callerComponentCycle, callerSyntaxCycle, dualInstanceFixture, metadataBindingFixture, metadataFieldFixture, metadataOperationFixture, moduleBoundaryFixture, moduleFixture, pairedModuleFixture, publishedArtifactFixture, repeatedMetadataFixture, verificationContext } = await import("./ir-program-fixtures.mjs");
const { expectedSyntaxKinds, genericCarrierCase, mirTransportCases, nullableSyntaxCases, relationalTransportArtifacts, syntaxPhysicalNodes, syntaxTransportFamilies, syntaxTransportModule, transportTypeTable } = await import("./ir-program-transport-fixtures.mjs");
let product;
function moduleViolations(index, module, context) {
  const outcome = product.verifyModuleBodies(index, module, { ...context, resources: product.createProgramVerificationWork(ProgramWork.state(context.resources).limits) });
  assert.equal(outcome.kind, "complete", "the bodies of the module were verified to the end, not refused for resources");
  return outcome.violations;
}
let typeProduct;

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

function evaluate(input) {
  switch (input.operation) {
    case "six-codec": {
      const text = product.printModuleBodies(input.index, input.module);
      return { parsed: product.parseModuleBodies(input.index, text),
        canonical: product.canonicalizeProgram({ index: input.index, modules: [input.module] }, input.publication) };
    }
    case "index-roundtrip": {
      const printed = product.printProgramIndex(input.index);
      const parsed = product.parseProgramIndex(printed);
      return { printed, parsed };
    }
    case "phase-codec":
    case "phase-inline-sharing": {
      if (input.operation === "phase-inline-sharing") {
        input.module.bodies[0].tir.root = input.module.tree;
        const alternatives = input.module.bodies[0].tir.evidence[0].category.alternatives;
        alternatives[1] = alternatives[0];
      }
      const printed = product.printModuleBodies(input.index, input.module);
      return { printed, parsed: product.parseModuleBodies(input.index, printed),
        canonical: product.canonicalizeProgram({ index: input.index, modules: [input.module] }, input.publication) };
    }
    case "canonicalize": return product.canonicalizeProgram(input.program, input.publication);
    case "canonicalize-pair-issue-order": {
      const { first, second } = pairedModuleFixture();
      const modules = [first.module, second.module];
      first.index.packages[0].exports = [{ specifier: "./main", module: first.module.module }];
      first.index.packages[1].exports = [{ specifier: "./other", module: second.module.module }];
      first.index.modules[0].exports = [{ name: "main", definition: first.definition }];
      first.index.modules[1].exports = [{ name: "other", definition: second.definition }];
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
      first.index.summaries = [{ key: { kind: "body", execution: { instance: first.instance, provided: 0 } }, signature: firstSignature, arena: { projections: [], producers: [], contexts: [],
        boundProducers: [], origins: [{ id: 0, producers: [], includesAbsence: false, kind: "complete" }], boundaries: [] },
      parameters: [], captures: [], result: 0, thrown: 0, writes: [], retention: [], callbacks: [],
      invocationOnlyParameters: [], suspends: false, bindingDependent: false }];
      first.index.constants = [{ reference: { initializer: first.instance, context: "compile-time" }, value: { kind: "absence", type: voidType } }];
      const publication = { table: { terms: [{ kind: "string" }, { kind: "intrinsic", intrinsic: "void" }],
        signatures: signatures.map(signature => ({ ...signature, result: 1 })) },
      types: input.reverse ? [0, 1] : [1, 0], signatures: input.reverse ? [1, 0] : [0, 1] };
      const program = product.canonicalizeProgram({ index: first.index, modules }, publication);
      const parsedModules = program.modules.map(module => product.parseModuleBodies(program.index, product.printModuleBodies(program.index, module)));
      return { program, printedIndex: product.printProgramIndex(program.index),
        printedModules: program.modules.map(module => product.printModuleBodies(program.index, module)),
        sharedRoots: program.modules.map(module => Object.is(module.tree, module.bodies[0].tir.root)),
        parsedIndex: product.parseProgramIndex(product.printProgramIndex(program.index)),
        parsedModules, parsedModuleRoots: parsedModules.map(parsed => parsed.kind === "parsed"
          && Object.is(parsed.value.tree, parsed.value.bodies[0].tir.root)) };
    }
    case "canonicalize-method-fixture":
      authoredMethodGraph(input.program.modules[0]);
      return product.canonicalizeProgram(input.program, input.publication);
    case "method-program-roundtrip": {
      const module = input.program.modules[0];
      authoredMethodGraph(module);
      const index = product.parseProgramIndex(product.printProgramIndex(input.program.index));
      const parsed = product.parseModuleBodies(input.program.index, product.printModuleBodies(input.program.index, module));
      if (parsed.kind !== "parsed") return { index, parsed };
      const method = parsed.value.tree.statements.nodes[0].members.nodes[0];
      const nested = method.body.statements.nodes[0];
      const shares = parsed.value.bodies.map(body => body.instance.body === method.tsonic.template.body
        ? Object.is(body.tir.root, method.body) : body.instance.body === nested.tsonic.template.body
          && Object.is(body.tir.root, nested.body));
      return { index, parsed, shares };
    }
    case "parse-index": return product.parseProgramIndex(input.text);
    case "deep-syntax-roundtrip": {
      const fixture = moduleFixture();
      const { tree } = fixture.module;
      const nodes = [];
      let statement = { id: input.depth + 1, origin: tree.origin, parent: input.depth, flags: [], loc: tree.loc,
        kind: "EmptyStatement", tsonic: null };
      nodes.push(statement);
      for (let position = input.depth; position > 0; position -= 1) {
        statement = { id: position, origin: tree.origin, parent: position - 1, flags: [], loc: tree.loc,
          kind: "Block", statements: { loc: tree.loc, nodes: [statement] }, multiLine: false, tsonic: null };
        nodes.push(statement);
      }
      tree.statements.nodes = [statement];
      tree.endOfFileToken.id = input.depth + 2;
      const checked = fixture.tirInput.source.tree;
      checked.statements = tree.statements;
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
      let actual = parsed.value.tree;
      let complete = isDeepStrictEqual(shape(parsed.value), shape(fixture.module));
      let count = 0;
      for (;;) {
        complete = isDeepStrictEqual(flat(actual), flat(original)) && complete;
        count += 1;
        if (original.kind === "EmptyStatement") break;
        complete = actual.statements.nodes.length === 1 && complete;
        actual = actual.statements.nodes[0];
        original = original.statements.nodes[0];
      }
      return { complete, chainNodes: count, sharedRoot: Object.is(parsed.value.tree, parsed.value.bodies[0].tir.root),
        violations: moduleViolations(fixture.index, fixture.module, fixture.context) };
    }
    case "parse-module": return product.parseModuleBodies(input.index, input.text);
    case "parse-module-sharing": {
      const parsed = product.parseModuleBodies(input.index, input.text);
      return { parsed, shared: parsed.kind === "parsed" && Object.is(parsed.value.tree.statements.nodes[0], parsed.value.tree.statements.nodes[1]) };
    }
    case "verify-index": return product.verifyProgramIndex(input.index, verificationContext(input));
    case "verify-path-fixture": {
      const { first, second } = pairedModuleFixture();
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
      const { first, second } = pairedModuleFixture();
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
          { name: "z", definition: first.definition }, { name: "a", definition: first.definition },
        ]; break;
        case "export-definition-missing": index.modules[0].exports = [
          { name: "missing", definition: encodeDefId({ module: first.module.module, segments: [{ name: "missing", ordinal: 0 }] }) },
        ]; break;
        case "body-order": index.bodies.reverse(); break;
        default: throw new Error("Unlisted authored package/module pair change");
      }
      return product.verifyProgramIndex(index, first.context);
    }
    case "verify-signature-fixture": {
      const fixture = moduleFixture();
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
    case "instantiate-method-fixture":
      authoredMethodGraph(input.module);
      return product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
    case "instantiate-module-fixture": {
      const published = input.module.bodies[0];
      assert.equal(published.instance.body, input.module.tree.tsonic.template.body, "authored module template body");
      published.tir.root = input.module.tree;
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
      const root = fixture.module.tree;
      const statement = {
        id: 1, origin: root.origin, parent: root.id, flags: [], loc: root.loc, kind: "EmptyStatement", tsonic: null,
      };
      const tree = {
        ...root, statements: { loc: root.loc, nodes: new Array(input.children).fill(statement) },
        endOfFileToken: { ...root.endOfFileToken, id: 2 },
      };
      const module = {
        ...fixture.module, tree,
        bodies: fixture.module.bodies.map(body => ({ ...body, tir: { ...body.tir, root: tree } })),
      };
      return product.instantiate(fixture.index, module, { kind: "tir", body: fixture.bodyId }, {
        classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
      }, input.limits);
    }
    case "verify-module-boundary-fixture": {
      const fixture = moduleBoundaryFixture(input.change);
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-module-fixture": {
      const fixture = moduleFixture();
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-constant-reference-fixture": {
      const fixture = moduleFixture();
      fixture.module.bodies[0].mir.constants.push({ id: 0, type: 0,
        value: { kind: "constant", reference: { initializer: fixture.instance, context: "compile-time" } } });
      fixture.index.bodies[0].mirConstantCount = 1;
      if (input.present) fixture.index.constants.push({ reference: { initializer: fixture.instance, context: "compile-time" }, value: { kind: "absence", type: 0 } });
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-module-change-fixture": {
      const fixture = moduleFixture();
      switch (input.change) {
        case "missing-input": fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null); break;
        case "foreign-chunk":
          fixture.module.module = encodeModuleId({ package: fixture.index.rootPackage, path: "foreign.ts" });
          fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null);
          break;
        case "mir-bindings": fixture.module.bodies[0].mir.bindings = { kind: "instantiated", bindings: {
          classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
        } }; break;
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
      const fixture = dualInstanceFixture();
      return { index: product.verifyProgramIndex(fixture.index, fixture.context),
        module: moduleViolations(fixture.index, fixture.module, fixture.context) };
    }
    case "verify-module-inventory-fixture": {
      const fixture = moduleFixture();
      switch (input.change.kind) {
        case "missing-module": fixture.index.modules = []; break;
        case "missing-instance": fixture.index.bodies = []; break;
        case "mir-count":
          assert.equal(["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"].includes(input.change.field), true, "authored MIR inventory field");
          fixture.index.bodies[0][input.change.field] = input.change.value;
          break;
        default: throw new Error("Unlisted authored module inventory change");
      }
      return moduleViolations(fixture.index, fixture.module, fixture.context);
    }
    case "verify-index-fixture": {
      const fixture = moduleFixture();
      if (input.change !== undefined) {
        const record = fixture.index.bodies[0];
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
          case "definition-node-owner": {
            fixture.index.modules[0].items[0].node = 1;
            fixture.tirInput.source.items[0].node = 1;
            const token = fixture.module.tree.endOfFileToken;
            token.origin = { ...token.origin, module: encodeModuleId({ package: fixture.index.rootPackage, path: "foreign.ts" }) };
            break;
          }
          case "item-node": fixture.index.modules[0].items[0].node = input.change.value; break;
          case "source-item-unlisted": fixture.tirInput.source.items = []; break;
          case "node-density": fixture.module.tree.endOfFileToken.id = 2; break;
          case "body-source-owner":
            fixture.module.bodies[0].tir.owner = encodeDefId({ module: fixture.module.module, segments: [{ name: "other", ordinal: 0 }] });
            break;
          case "body-count":
            assert.equal(["mirLocalCount", "mirConstantCount", "mirPlaceCount", "mirBlockCount"].includes(input.change.field), true, "authored body count field");
            assert.equal(typeof input.change.value, "number", "authored body count");
            record[input.change.field] = input.change.value;
            break;
          case "body-root": record.root = input.change.value; break;
          case "body-owner":
            record.owner = encodeDefId({ module: fixture.module.module, segments: [{ name: "missing", ordinal: 0 }] });
            break;
          case "body-module":
            record.module = encodeModuleId({ package: fixture.index.rootPackage, path: "other.ts" });
            break;
          case "bound-body": {
            const bindings = { kind: "instantiated", bindings: {
              classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
            } };
            const instance = { body: fixture.bodyId, bindings };
            record.instance = instance;
            const published = fixture.module.bodies[0];
            published.instance = instance;
            published.tir.bindings = bindings;
            published.mir.bindings = bindings;
            published.facts[0].execution.instance = instance;
            published.observations.instance = instance;
            fixture.index.executions[0].instance = instance;
            fixture.answers.set(encodeContextKey(["bodyOf", instance]), published.tir);
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
    const executeInput = input => ({ kind: "accepted", value: evaluate(decodeFixtureJson(input.text)), diagnostics: [] });
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

test("ir-program public values are exactly the eight locked ports", () => {
  assert.deepEqual(Object.keys(product).sort(), [
    "canonicalizeProgram", "createProgramVerificationWork", "instantiate", "parseModuleBodies", "parseProgramIndex",
    "printModuleBodies", "printProgramIndex", "verifyModuleBodies", "verifyProgramIndex",
  ].sort());
});

test("ir-program print rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax object cycle at ModuleBodies.tree.statements.nodes[0].expression.left";
  assert.throws(() => product.printModuleBodies(fixture.index, fixture.module),
    error => error instanceof TypeError && error.message === expected);
});

test("ir-program canonicalization rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax object cycle at HostProgram.modules[0].tree.statements.nodes[0].expression.left";
  assert.throws(() => product.canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  }), error => error instanceof TypeError && error.message === expected);
});

test("ir-program module verification rejects a genuine child cycle at its actual field path", () => {
  const fixture = callerSyntaxCycle();
  const expected = "Syntax object cycle at ModuleBodies.tree.statements.nodes[0].expression.left";
  assert.throws(() => product.verifyModuleBodies(fixture.index, fixture.module, fixture.context),
    error => error instanceof TypeError && error.message === expected);
});

test("instantiation-preserves-existing-ids rejects a nonpublication that merges old IDs", () => {
  const fixture = moduleFixture();
  fixture.index.types.terms.push({ kind: "intrinsic", intrinsic: "void" });
  const limits = {
    maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 128, maximumVisits: 100000, maximumUnionMembers: 128, maximumIntersectionMembers: 128 },
  };
  assert.throws(() => product.instantiate(fixture.index, fixture.module, { kind: "tir", body: fixture.bodyId }, {
    classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [],
  }, limits), error => error instanceof TypeError && error.message === "Instantiation input merges two existing publication IDs");
});

for (const maximum of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`ir-program invalid binding-vector maximum fails at its index boundary: ${Object.is(maximum, -0) ? "-0" : String(maximum)}`, () => {
    const fixture = moduleFixture();
    assert.throws(() => product.createProgramVerificationWork({
      ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: maximum }), error => error instanceof TypeError
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
import type { InstantiationLimits, ProgramVerificationWork } from "${resolve(repository, "packages/host/dist/ir-program/contract.js")}";
`;
  const compile = () => spawnSync(process.execPath, [resolve(repository, "node_modules/@typescript/native-preview/bin/tsgo.js"),
    "--project", config, "--pretty", "false"], { cwd: repository, encoding: "utf8", maxBuffer: 1048576 });
  writeFileSync(input, prefix + "export function create(limits: InstantiationLimits): ProgramVerificationWork { return createProgramVerificationWork(limits); }");
  const valid = compile();
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  writeFileSync(input, prefix + `export function forbidden(limits: InstantiationLimits, work: ProgramVerificationWork): void {
const old: ProgramVerificationWork = { limits, work: 0, created: 0, seed: { kind: "unseeded" } };
const actual = createProgramVerificationWork(limits);
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
return result.kind === "complete" ? result.violations.length : result.maximum;
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
  const fixture = moduleFixture();
  const references = ["enum-member", "fixed-array-extent", "compile-time"].map(context => ({ initializer: fixture.instance, context }));
  fixture.index.constants = references.map(reference => ({ reference, value: { kind: "absence", type: 0 } }))
    .sort((left, right) => {
      const first = constantReferenceKey(left.reference), second = constantReferenceKey(right.reference);
      return first < second ? -1 : first > second ? 1 : 0;
    });
  assert.deepEqual(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [] });
  const printed = product.printProgramIndex(fixture.index);
  completeProgramValue(product.parseProgramIndex(printed), { kind: "parsed", value: fixture.index }, "all actual contexts round-trip");
  const removed = printed.replace(/reference=ConstantReference\(initializer=(BodyInstance\(.*?bindings=parametric\(\)\)), context="[^"]+"\)/u, "initializer=$1");
  assert.equal(product.parseProgramIndex(removed).kind, "invalid-text", "the old context-free publication record is removed");
  const published = fixture.module.bodies[0];
  published.mir.constants = [{ id: 0, type: 0, value: { kind: "constant", reference: references[0] } }];
  fixture.index.bodies[0].mirConstantCount = 1;
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [], "an exact selected context has its receipt");
  fixture.index.constants = fixture.index.constants.filter(row => row.reference.context !== "enum-member");
  assert.equal(moduleViolations(fixture.index, fixture.module, fixture.context).some(row => row.rule === "binding-artifact-present"), true,
    "a receipt for another context never answers this reference");
});

test("ir-program negative-zero binding maximum is the inherited zero budget", () => {
  const fixture = moduleFixture();
  const context = { ...fixture.context, resources: product.createProgramVerificationWork({
    ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: -0 }) };
  assert.deepEqual(product.verifyProgramIndex(fixture.index, context), { kind: "complete", violations: [] });
});

for (const ordinal of [-1, -0, NaN]) test(`ir-program signature ordinal ${Object.is(ordinal, -0) ? "-0" : String(ordinal)} retains its complete endpoint finding`, () => {
  const fixture = moduleFixture();
  fixture.index.signatures = [{ kind: "advertised", definition: fixture.definition, ordinal, signature: 0, bindings: { kind: "parametric" } }];
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [{ rule: "signature-endpoints-exact",
    site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: fixture.definition }, { kind: "text", value: "advertised" },
      { kind: "number", value: ordinal }] }] }, "invalid ordinals do not invoke or fabricate an endpoint-reader result");
});

test("ir-program an unpublished declaration retains its complete endpoint failure without inventing an owner", () => {
  const fixture = moduleFixture();
  const definition = moduleFixture("src/other.ts").definition;
  const bindings = { kind: "parametric" };
  fixture.index.signatures = [{ kind: "advertised", definition, ordinal: 0, signature: 0, bindings }];
  fixture.answers.set(encodeContextKey(["signatureIdOf", [definition, "advertised", 0, bindings]]), null);
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [{ rule: "signature-endpoints-exact",
    site: { kind: "signature", signature: 0 }, detail: [{ kind: "text", value: definition }, { kind: "text", value: "advertised" },
      { kind: "number", value: 0 }] }] }, "a genuine missing publication remains distinct from a made-up lower answer");
});

test("ir-program missing checked module data retains all index and module-boundary findings", () => {
  const fixture = moduleFixture();
  fixture.answers.set(encodeContextKey(["tirOf", fixture.module.module]), null);
  const missing = { rule: "tir-valid", site: { kind: "module", module: fixture.module.module },
    detail: [{ kind: "text", value: "missing-module-data" }] };
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: [missing, { rule: "body-root-resolves",
    site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "number", value: 0 }] }] }, "the complete source inventory does not drop a body finding");
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [missing,
    { rule: "facts-valid", site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "text", value: "missing-observation-source" }] }],
    "the complete chunk boundary reports the unavailable checked source once");
});

test("ir-program api-body endpoints retain the exact canonical body identity", () => {
  const fixture = moduleFixture();
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
  const fixture = moduleFixture();
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
  const fixture = dualInstanceFixture();
  const initializer = fixture.module.bodies[1].instance;
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
  const parameter = { owner: fixture.definition, index: 0 };
  const vector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const bindings = { kind: "instantiated", bindings: vector };
  const endpoint = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  fixture.index.signatures = [{ kind: endpoint.role, definition: fixture.definition, ordinal: 0, signature: 0, bindings }];
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
  completeProgramValue(product.verifyProgramIndex(fixture.index, fixture.context), { kind: "complete", violations: expected },
    "the entire lower vector is independently specified, including multiple findings at one signature site");
});

for (const identity of [-1, 0.5, NaN, Infinity]) test(`ir-program publication rejects the complete invalid issued type ${String(identity)} at its actual owner`, () => {
  const fixture = moduleFixture();
  fixture.module.bodies[0].tir.completion = identity;
  assert.throws(() => product.canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0], signatures: [0],
  }), error => error instanceof TypeError && error.message === `Type publication has no issued type mapping for ${String(identity)}`);
});

for (const kind of ["tir", "mir", "facts", "summary", "metadata"]) {
  test(`ir-program exact borrowed ${kind} creates no IR records and preserves actual identity`, () => {
    const input = decodeFixtureJson(readFileSync(resolve(repository,
      `test/host-cases/ir-program/function/instantiate-bound-${kind}-created-zero.input.json`), "utf8"));
    const source = kind === "summary" ? input.index.summaries[0]
      : kind === "metadata" ? input.index.metadata[0] : kind === "facts" ? input.module.bodies[0].facts[0] : input.module.bodies[0][kind];
    const expectedArtifact = kind === "facts" ? { kind, facts: source }
      : kind === "summary" ? { kind, summary: source } : kind === "metadata" ? { kind, metadata: source } : { kind, body: source };
    const actual = product.instantiate(input.index, input.module, input.artifact, input.bindings, input.limits);
    assert.equal(isDeepStrictEqual(actual, { kind: "instantiated", artifact: expectedArtifact, types: input.index.types }), true, `${kind} complete borrowed result`);
    const returned = actual.kind !== "instantiated" ? null : kind === "facts" ? actual.artifact.facts
      : kind === "summary" ? actual.artifact.summary : kind === "metadata" ? actual.artifact.metadata : actual.artifact.body;
    assert.equal(Object.is(returned, source), true, `${kind} actual artifact identity`);
    assert.equal(actual.kind === "instantiated" && Object.is(actual.types, input.index.types), true, `${kind} actual table identity`);
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
  ["seed-component-cycle", "Inline cycle in instantiation seed TypeComponent"],
  ["artifact-component-cycle", "Inline cycle in instantiation TypeComponent"],
]) {
  test(`ir-program genuine caller defect: ${name}`, () => {
    const fixture = name === "artifact-component-cycle" ? callerComponentCycle() : moduleFixture();
    const program = { index: fixture.index, modules: [fixture.module] };
    const publication = { table: fixture.index.types, types: [0], signatures: [0] };
    const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    let invoke = () => product.canonicalizeProgram(program, publication);
    switch (name) {
      case "missing-type-image": publication.types = []; break;
      case "missing-signature-image": publication.signatures = []; break;
      case "negative-zero-type": fixture.module.bodies[0].tir.completion = tyId(-0); break;
      case "duplicate-parameter": {
        const binding = { kind: "rigid", parameter: { owner: fixture.definition, index: 0 } };
        bindings.classBindings = [binding, binding]; break;
      }
      case "duplicate-self": {
        const binding = { kind: "rigid", owner: fixture.definition };
        bindings.selfBindings = [binding, binding]; break;
      }
      case "duplicate-template": fixture.module.bodies.push(fixture.module.bodies[0]); break;
      case "duplicate-exact":
        fixture.module.bodies[0].instance.bindings = { kind: "instantiated", bindings };
        fixture.module.bodies.push(fixture.module.bodies[0]); break;
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
      case "seed-component-cycle": {
        const component = { root: { kind: "body", value: { body: fixture.bodyId, node: 0 } }, path: [] };
        component.path.push({ kind: "sum-arm", family: { origin: "authored", component, parameters: [], roles: [] }, index: 0 });
        fixture.index.types.terms.push({ kind: "projection", source: 0, projection: { kind: "component", component } });
        invoke = () => product.instantiate(fixture.index, fixture.module,
          { kind: "tir", body: fixture.bodyId }, bindings, ProgramWork.state(fixture.context.resources).limits); break;
      }
    }
    if (name.startsWith("duplicate-") || name === "artifact-component-cycle") invoke = () => product.instantiate(fixture.index, fixture.module,
      { kind: "tir", body: fixture.bodyId }, bindings, ProgramWork.state(fixture.context.resources).limits);
    assert.throws(invoke, error => error instanceof TypeError && error.message === message);
  });
}

test("ir-program canonicalization rejects the genuine recursive expression component", () => {
  const fixture = callerComponentCycle();
  assert.throws(() => product.canonicalizeProgram({ index: fixture.index, modules: [fixture.module] }, {
    table: fixture.index.types, types: [0, 1], signatures: [0],
  }), error => error instanceof TypeError && error.message ===
    "Inline cycle at HostProgram.modules[0].StringLiteral.tsonic.narrowing.proof.steps[0].from.path[0].family.component");
});

test("ir-program finite shared expression components retain the complete canonical publication", () => {
  const fixture = callerComponentCycle();
  fixture.component.path = [];
  const expected = { index: fixture.index, modules: [fixture.module] };
  const actual = product.canonicalizeProgram(expected, {
    table: fixture.index.types, types: [0, 1], signatures: [0],
  });
  assert.equal(isDeepStrictEqual(actual, expected), true, "complete finite canonical publication");
  assert.equal(Object.is(actual.modules[0].tree, actual.modules[0].bodies[0].tir.root), true,
    "actual shared finite template root");
});

for (const field of ["maximumWork", "maximumCreatedRecords", "maximumBindingVectorsPerArtifact"]) {
  for (const maximum of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    test(`ir-program Instantiate rejects malformed ${field}: ${String(maximum)}`, () => {
      const fixture = moduleFixture();
      const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
      const limits = { ...ProgramWork.state(fixture.context.resources).limits, [field]: maximum };
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
    { kind: "tir", body: fixture.bodyId }, bindings, ProgramWork.state(fixture.context.resources).limits);
  assert.equal(isDeepStrictEqual(actual, expected), true, "complete finite expression component result");
});

const fieldFaults = new Map();
const valueFaults = new Map();
const closingFaults = new Map();
const punctuationFaults = new Map();
const recordFaults = new Map();
const extraFieldFaults = new Map();
const recordChoices = new Map([
  ...["ProgramIndex", "PackageRecord", "PackageExport", "ModuleRecord", "DefinitionNode", "ModuleExport", "BodyRecord", "ConstantRecord", "ConstantReference",
    "Diagnostic", "RelatedDiagnostic", "DiagnosticFix", "TextEdit", "LocalRef", "NodeRef", "ItemNodeRef", "LibraryModuleIdentity",
    "CommentDirective", "HirAttribute", "BindingVector", "TypeParameterIdentity"].map(name => [name, [name]]),
  ...["advertised", "api-signature", "api-body"].map(name => [name, ["advertised", "api-signature", "api-body"]]),
  ...["parametric", "instantiated"].map(name => [name, ["parametric", "instantiated"]]),
  ...["bound", "rigid"].map(name => [name, ["bound", "rigid"]]),
  ...["host", "checker", "extension"].map(name => [name, ["host", "checker", "extension"]]),
  ...["lowering", "expansion"].map(name => [name, ["lowering", "expansion"]]),
]);
const delegatedRecords = new Set(["TypeTable", "BodyFacts", "BodyObservations", "MirBody", "Summary", "data-layout", "memory-layout", "memory-field"]);
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
const emptyWireIndex = { schema: 1, nativeFactsKey: signatureFixture.index.nativeFactsKey, rootPackage: signatureFixture.index.rootPackage, packages: [], modules: [],
  types: { terms: [], signatures: [] }, signatures: [], bodies: [], executions: [], metadata: [], summaries: [], constants: [], diagnostics: [] };
for (const kind of ["advertised", "api-signature", "api-body"]) for (const body of kind === "api-body" ? [null, signatureFixture.bodyId] : [undefined]) {
  const record = { definition: signatureFixture.definition, bindings: { kind: "parametric" }, ordinal: 0, signature: 0, kind,
    ...(body === undefined ? {} : { body }) };
  const text = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[${kind}(definition=def:${JSON.stringify(record.definition)}, bindings=parametric(), ordinal=0, signature=sig:0${body === undefined ? "" : `, body=${body === null ? "null" : `body:${JSON.stringify(body)}`}`})], bodies=[], executions=[], metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)})`;
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
  const parameter = index => ({ owner: signatureFixture.definition, index });
  const vector = { classBindings: [{ kind: "rigid", parameter: parameter(0) }, { kind: "bound", parameter: parameter(1), type: 0 }],
    methodBindings: [], capturedBindings: [], selfBindings: [{ kind: "rigid", owner: signatureFixture.definition }, { kind: "bound", owner: other, type: 0 }] };
  const definition = JSON.stringify(signatureFixture.definition);
  const bindings = `instantiated(bindings=BindingVector(classBindings=[rigid(parameter=TypeParameterIdentity(owner=def:${definition}, index=0)), bound(parameter=TypeParameterIdentity(owner=def:${definition}, index=1), type=t:0)], methodBindings=[], capturedBindings=[], selfBindings=[rigid(owner=def:${definition}), bound(owner=def:${JSON.stringify(other)}, type=t:0)]))`;
  const text = `ProgramIndex(schema=1, rootPackage=pkg:${JSON.stringify(emptyWireIndex.rootPackage)}, packages=[], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[advertised(definition=def:${definition}, bindings=${bindings}, ordinal=0, signature=sig:0)], bodies=[], executions=[], metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)})`;
  const index = { ...emptyWireIndex, signatures: [{ kind: "advertised", definition: signatureFixture.definition,
    bindings: { kind: "instantiated", bindings: vector }, ordinal: 0, signature: 0 }] };
  authoredDocuments.push({ text, index });
  test("ir-program independent complete binding records preserve both rigid and bound owner-qualified forms", () => {
    completeProgramValue(product.parseProgramIndex(text), { kind: "parsed", value: index }, "the complete structural binding grammar does not pretend that this deliberately unverified index is semantically valid");
    assert.equal(product.printProgramIndex(index), text + "\n");
  });
}
{
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.input.json"), "utf8"));
  const prior = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/phase-number-declaration.expected.json"), "utf8")).value.printed;
  const node = input.module.tree.statements.nodes[0].expression;
  const body = signatureFixture.bodyId;
  const definition = signatureFixture.definition;
  const ref = { kind: "item", value: { owner: definition, node: 2 } };
  const bodyRef = { body, node: 2 };
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const unavailable = { kind: "unavailable", reason: "not-provided" };
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
  const core = `HirCoreCapture(provider=unavailable(reason="not-provided"), markers=unavailable(reason="not-provided"), pointerType=unavailable(reason="not-provided"), pointerOperation=${pointer}, fieldBinding=unavailable(reason="not-provided"), recordBinding=unavailable(reason="not-provided"), attribute=unavailable(reason="not-provided"), safety=unavailable(reason="not-provided"), argumentPassing=unavailable(reason="not-provided"), flowState=unavailable(reason="not-provided"))`;
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
            expectedItems = record.name === "CheckJsDirective" && token[1] === "range"
              ? ["SingleLineCommentTrivia", "MultiLineCommentTrivia"] : [/^[A-Z][A-Za-z0-9_]*/.exec(tail)[0]];
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
          const expectedItems = record.name === "PragmaArguments" ? [text.slice(record.open, token.index).trim().length === 0 ? "pragma key" : ","] : [")"];
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
  const text = `ProgramIndex("sch\\u0065ma"=1, rootPackage=pkg:${pkg}, packages=[PackageRecord(id=pkg:${pkg}, name="quote\\\"\\/slash\\\\\\b\\f\\n\\r\\t\\u00AF\\uD800", packageRoot="/program", sourceRoot="/program/src", dependencies=[], exports=[])], modules=[], types=TypeTable(terms=[], signatures=[]), signatures=[], bodies=[], executions=[], metadata=[], summaries=[], constants=[], diagnostics=[], nativeFactsKey=${JSON.stringify(emptyWireIndex.nativeFactsKey)})`;
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
  const equals = text.indexOf("n:0=SourceFile") + "n:0".length;
  completeTextFault(input.index, text.slice(0, equals) + " @" + text.slice(equals + 1), equals + 1, ["="], false);
  const kind = equals + 1;
  completeTextFault(input.index, text.slice(0, kind) + "Z" + text.slice(kind + 1), kind, expectedSyntaxKinds, false);
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
    const index = { ...example.input.index, types };
    const module = syntaxTransportModule({ ...example.input, module: envelope.module }, node, "SyntaxNode");
    completeSyntaxTransport({ ...envelope, index }, module, types);
  });

for (const { family, kinds } of syntaxTransportFamilies) for (const kind of kinds) test(`ir-program complete ${kind} retains its actual ${family} parent slot through publication and text`, () => {
  const example = syntaxExamples.get(kind);
  assert.notEqual(example, undefined, "every selected syntax kind has an existing complete independently authored example");
  const { input, node } = example;
  const envelope = moduleFixture();
  const types = { terms: input.index.types.terms.length === 0 ? envelope.index.types.terms : input.index.types.terms,
    signatures: input.index.types.signatures.length === 0 ? envelope.index.types.signatures : input.index.types.signatures };
  const index = { ...input.index, types };
  const module = syntaxTransportModule({ ...input, module: envelope.module }, node, family);
  const parsed = completeSyntaxTransport({ ...envelope, index }, module, types);
  assert.equal(Object.is(parsed.tree, parsed.bodies[0].tir.root), family !== "BodyRoot", "the parsed graph retains exactly the authored module/body root sharing");
});

const transportedKinds = new Set(syntaxTransportFamilies.flatMap(family => family.kinds));
for (const [kind, { input, node }] of syntaxExamples) if (!transportedKinds.has(kind))
  test(`ir-program complete auxiliary ${kind} retains every original field in all three structural transports`, () => {
    const fixture = moduleFixture();
    const types = { terms: input.index.types.terms.length === 0 ? fixture.index.types.terms : input.index.types.terms,
      signatures: input.index.types.signatures.length === 0 ? fixture.index.types.signatures : input.index.types.signatures };
    completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "SyntaxNode"), types);
  });

for (const kind of ["literal", "union", "intersection", "array", "fixed-array", "optional", "optional-absence", "tuple", "shape", "write-only-shape", "declared", "construction-reference", "projection-await", "projection-component", "callable", "owned-callable", "composed-callable"])
  test(`ir-program instantiated ${kind} appends exactly its independent concrete record while retaining every old ID and row`, () => {
    const fixture = moduleFixture();
    const { index, module, bindings, expected } = genericCarrierCase(fixture, kind);
    const limits = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
      typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
    const invoke = value => product.instantiate(index, module, { kind: "mir", body: fixture.bodyId }, bindings, value);
    const result = invoke(limits);
    completeProgramValue(result, expected, "full independently authored concrete type/signature suffix and artifact image");
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
          assert.equal(Number.isSafeInteger(actual.maximum) && actual.maximum >= 0 && actual.maximum <= maximum, true,
            "a refusal retains the genuine owning-layer remaining maximum and never a partial table");
          completeProgramValue(Object.keys(actual).sort(), ["dimension", "kind", "maximum"], "the complete closed refusal payload");
        }
      }
    }
  });

function completeSyntaxTransport(fixture, module, types = fixture.index.types) {
  const index = { ...fixture.index, types };
  const program = { index, modules: [module] };
  completeProgramValue(product.canonicalizeProgram(program, { table: types,
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
    const example = special === null ? syntaxExamples.get(kind === "component" ? "StringLiteral" : kind) : { input: special, node: special.module.tree.statements.nodes[0].expression };
    const node = evidencedSyntax(example.node).node;
    if (kind === "deferred-operator") node.tsonic.conversion.deferred.invocation.input.permissionScope = null;
    if (kind === "component") {
      const component = { root: { kind: "body", value: { body: fixture.bodyId, node: node.id } }, path: [{ kind: "array-element" }] };
      node.tsonic.narrowing = { kind: "narrowed", source: 0, result: 0,
        proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] }], conclusion: 0 }, failure: "unwind" };
    }
    if (kind === "ExpressionWithTypeArguments") node.tsonic = { role: "value", type: 0, convertedType: 0, conversion: { kind: "identity" },
      narrowing: null, evidenceIndex: null, demand: { kind: "always" }, application: null, bindings: {
        classBindings: [{ kind: "bound", parameter: { owner: fixture.definition, index: 0 }, type: 0 }], methodBindings: [], capturedBindings: [],
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
        assert.equal(Number.isSafeInteger(actual.maximum) && actual.maximum >= 0 && actual.maximum <= maximum, true,
          "the exact lower-owner remaining maximum is never replaced with an outer allowance");
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
  const node = structuredClone(input.module.tree.statements.nodes[0].expression);
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
const bindingUnavailable = reason => ({ kind: "unavailable", reason });
for (const [name, select] of [
  ["complete field binding", records => ({ fieldBinding: records.field })],
  ["field binding with every inner fact unavailable", records => ({ fieldBinding: { ...records.field, bindings: bindingUnavailable("parameter-dependent"),
    owner: bindingUnavailable("checker-error"), pointee: bindingUnavailable("not-provided"), field: bindingUnavailable("not-provided") } })],
  ["complete record binding", records => ({ recordBinding: records.record })],
  ["record binding without field entries", records => ({ recordBinding: { ...records.record, fields: [] } })],
  ["record binding with every inner fact unavailable", records => ({ recordBinding: { ...records.record, bindings: bindingUnavailable("parameter-dependent"),
    source: bindingUnavailable("checker-error"), layout: bindingUnavailable("not-provided") } })],
  ["field and record binding together", records => ({ fieldBinding: records.field, recordBinding: records.record })],
]) test(`ir-program ${name} capture survives the canonical copy, the text and Instantiate unchanged`, () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const node = structuredClone(input.module.tree.statements.nodes[0].expression);
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
  for (const [field, dimension, last] of [["maximumWork", "work", 400], ["maximumCreatedRecords", "created-records", 60]]) {
    let complete = false;
    for (let maximum = 0; maximum <= last; maximum += 1) {
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
  const first = { owner: fixture.definition, index: 0 };
  const second = { owner: fixture.definition, index: 1 };
  const types = { terms: [...input.index.types.terms, { kind: "param", parameter: first }, { kind: "primitive", primitive: "int32" },
    { kind: "array", element: 2, readonly: false }], signatures: input.index.types.signatures };
  const available = value => ({ kind: "available", value });
  const vector = classBindings => ({ classBindings, methodBindings: [], capturedBindings: [], selfBindings: [] });
  const rigid = parameter => ({ kind: "rigid", parameter });
  const bound = (parameter, type) => ({ kind: "bound", parameter, type });
  const reference = { kind: "item", value: { owner: fixture.definition, node: 0 } };
  const occurrence = { body: fixture.bodyId, node: 0 };
  const moduleOf = (fieldVector, owner, pointee, recordVector, source) => {
    const node = structuredClone(input.module.tree.statements.nodes[0].expression);
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
  const unrelated = vector([bound({ owner: fixture.definition, index: 2 }, 3)]);
  completeProgramValue(product.instantiate(index, template, { kind: "tir", body: fixture.bodyId }, unrelated, limits),
    { kind: "instantiated", artifact: { kind: "tir", body: { ...template.bodies[0].tir, bindings: { kind: "instantiated", bindings: unrelated } } }, types },
    "a binding of a parameter that the captures do not mention changes no capture type or vector and appends no type");
});

// SCHEMA-MIGRATION.md 5.8: the exact inventory charges of the binding captures. The baseline threshold of each dimension is found
// by a sweep; the variant's threshold is the baseline's plus the charge derived from instantiate-phase.ts and program-values.ts,
// and is asserted one below, at and one above. The refusal one below is the record the forwarding law gives: Program's own meter
// with the outer limit for work, the type export with its unchanged remaining allowance for created records.
test("ir-program binding capture records move the Instantiate work and created-record thresholds by exactly their inventory charges", () => {
  const fixture = moduleFixture();
  const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/six-core-safety-1.input.json"), "utf8"));
  const available = value => ({ kind: "available", value });
  const unavailable = { kind: "unavailable", reason: "not-provided" };
  const empty = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const occurrence = { body: fixture.bodyId, node: 0 };
  const moduleOf = (fieldBinding, recordBinding) => {
    const node = structuredClone(input.module.tree.statements.nodes[0].expression);
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
    const base = measure(baseline, field, dimension, last);
    if (dimension === "work") completeProgramValue(base.below, { kind: "resource-limit", dimension, maximum: base.threshold - 1 },
      `${name}: one below the baseline work threshold Program's own meter refuses with the outer limit`);
    else {
      completeProgramValue(Object.keys(base.below).sort(), ["dimension", "kind", "maximum"], `${name}: the closed refusal record`);
      assert.equal(Number.isSafeInteger(base.below.maximum) && base.below.maximum >= 0 && base.below.maximum < base.threshold - 1, true,
        `${name}: one below the baseline created-record threshold the type export refuses with its remaining allowance`);
    }
    const threshold = base.threshold + charge[field];
    const below = { kind: "resource-limit", dimension, maximum: dimension === "work" ? threshold - 1 : base.below.maximum };
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
  const vector = type => ({ classBindings: [{ kind: "bound", parameter: { owner, index: 0 }, type }], methodBindings: [], capturedBindings: [], selfBindings: [] });
  const records = (first, second) => ({
    fieldBinding: { kind: "available", value: { occurrence, bindings: { kind: "available", value: vector(first) }, owner: { kind: "available", value: first },
      pointee: { kind: "available", value: second }, fieldExpression: occurrence, field: { kind: "available", value: reference }, pointerExpression: occurrence } },
    recordBinding: { kind: "available", value: { occurrence, bindings: { kind: "available", value: vector(second) }, source: { kind: "available", value: second },
      layoutExpression: occurrence, layout: { kind: "available", value: reference }, fields: [{ expression: occurrence, binding: occurrence }] } },
  });
  Object.assign(original, records(0, 1));
  Object.assign(captureOf(expected.modules), records(1, 0));
  completeProgramValue(product.canonicalizeProgram({ index: input.index, modules: [input.module] }, input.publication), expected,
    "owner, pointee, source and every bound type follow the publication; occurrence, expressions and descriptor references are copied");
});

test("ir-program complete write-only member origins retain null read identity in every transport", () => {
  const fixture = moduleFixture();
  const example = syntaxExamples.get("PropertyAccessExpression");
  const node = structuredClone(example.node);
  node.tsonic.selection = { kind: "decided", decision: { decision: { key: { kind: "text", value: "value" },
    origins: [{ kind: "declared", declaration: fixture.definition }], selectedDeclarations: [], primary: null, read: null, write: 0,
    getter: null, setter: null, bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] },
    location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null } };
  completeSyntaxTransport(fixture, syntaxTransportModule({ module: fixture.module }, node, "Expression"), example.input.index.types);
});

for (const kind of ["unary", "binary", "convert", "address-of", "array", "tuple", "fixed-array", "object", "record"])
  test(`ir-program genuine metadata constant in MIR ${kind} preserves the entire owning and child verdict vector`, () => {
    const { first } = metadataOperationFixture("size", "present", "layout");
    const mir = first.module.bodies[0].mir;
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
    const { first } = metadataOperationFixture("size", "present", "layout");
    const mir = first.module.bodies[0].mir;
    const expected = [];
    const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
    const site = { kind: "body", instance: first.instance };
    const missing = (path, key) => ({ rule: "binding-artifact-present", site, detail: [{ kind: "text", value: path }, { kind: "text", value: key }] });
    if (kind === "literal") mir.constants[0].value = { kind: "literal", value: { kind: "number", token: "1", value: { numerator: 1n, denominator: 1n, negativeZero: false } } };
    else if (kind === "definition") mir.constants[0].value = { kind, definition: first.definition, bindings: { kind: "instantiated", bindings } };
    else if (kind === "observation") mir.constants[0].value = { kind, at: { body: first.bodyId, node: 0 } };
    else if (kind === "place") mir.blocks[0].statements[1].value = { kind: "use", operand: { kind: "place", place: 0 } };
    else if (kind.startsWith("closure-")) {
      const instance = kind === "closure-parametric" ? first.instance : { body: first.bodyId, bindings: { kind: "instantiated", bindings } };
      mir.blocks[0].statements[1].value = { kind: "closure", instance, captures: [] };
      if (kind === "closure-instantiated") expected.push(missing("mir.blocks[0].statements[1].value.instance",
        encodeKey([first.bodyId, ["instantiated", [[], [], [], []]]])));
    } else if (kind.startsWith("body-callee-")) {
      const instance = kind === "body-callee-parametric" ? first.instance : { body: first.bodyId, bindings: { kind: "instantiated", bindings } };
      const block = mir.blocks[0];
      block.terminator = { origin: block.origin, tir: block.tir, kind: "call", callee: { kind: "body", instance, captures: [] }, receiver: null,
        arguments: [], destination: null, next: 0, unwind: { kind: "escape" }, step: null };
      if (kind === "body-callee-instantiated") {
        first.answers.set(encodeContextKey(["bodyOf", instance]), null);
        expected.push(missing("mir.blocks[0].terminator.callee.instance",
          encodeKey([first.bodyId, ["instantiated", [[], [], [], []]]])));
      }
    } else if (kind === "field-accessors") {
      const advertised = { declaration: first.definition, role: "advertised", signature: 0, body: null };
      const callee = { decision: { candidate: 0, advertised, api: { ...advertised, role: "api-signature" }, bindings, implementationBindings: bindings,
        parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null }, activation: first.instance };
      const member = { decision: { key: { kind: "text", value: "value" }, origins: [], selectedDeclarations: [], primary: null, read: 2, write: 2,
        getter: null, setter: null, bindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: callee, setter: callee };
      mir.places.push({ id: 1, base: { kind: "place", place: 0, projection: { kind: "field", member }, tir: mir.blocks[0].tir }, storage: 2, origin: mir.places[0].origin });
      first.index.bodies[0].mirPlaceCount = 2;
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
  resources: product.createProgramVerificationWork(ProgramWork.state(fixture.context.resources).limits), mirVerification: { maximumWork } });

test("ir-program a body past its MIR verification limit refuses the module and names the body", () => {
  const fixture = moduleFixture();
  completeProgramValue(underMirLimit(fixture, 1), { kind: "complete", violations: [] }, "the smallest body is verified under its need of one");
  completeProgramValue(underMirLimit(fixture, 0), { kind: "resource-limit", body: fixture.instance, dimension: "work", maximum: 0 },
    "zero is a limit like any other: below the need the body is refused");
  branching(fixture.module.bodies[0]);
  completeProgramValue(underMirLimit(fixture, 1), { kind: "resource-limit", body: fixture.instance, dimension: "work", maximum: 1 },
    "over the limit: the refusal names the body instance and the limit, and carries no finding");
  assert.equal(underMirLimit(fixture, 2).kind, "complete", "at the exact limit the body is verified to the end");
});

test("ir-program a structurally invalid body under its MIR limit is found invalid, not refused", () => {
  const fixture = moduleFixture();
  const block = fixture.module.bodies[0].mir.blocks[0];
  block.terminator = { origin: block.origin, tir: block.tir, kind: "goto", target: 99 };
  const outcome = underMirLimit(fixture, 1);
  assert.equal(outcome.kind, "complete", "a defect is a finding of a verification that ran to its end");
  completeProgramValue(outcome.violations.filter(violation => violation.rule === "mir-valid"), [{ rule: "mir-valid", site: { kind: "body", instance: fixture.instance },
    detail: [{ kind: "text", value: "edge-target-resolves" }, { kind: "text", value: "normal" }, { kind: "number", value: 99 }] }],
  "the MIR finding is reported as a finding");
});

test("ir-program two bodies of one module are metered separately", () => {
  const both = dualInstanceFixture();
  for (const published of both.module.bodies) branching(published);
  assert.equal(underMirLimit(both, 2).kind, "complete", "each body is charged from zero");
  completeProgramValue(underMirLimit(both, 1), { kind: "resource-limit", body: both.module.bodies[0].instance, dimension: "work", maximum: 1 },
    "with both over the limit the first body verified is the one named");
  const second = dualInstanceFixture();
  branching(second.module.bodies[1]);
  completeProgramValue(underMirLimit(second, 1), { kind: "resource-limit", body: second.module.bodies[1].instance, dimension: "work", maximum: 1 },
    "the refusal names the body that passed its limit, not the first body of the module");
});

test("ir-program a mismatched supplied type table retains its complete module-level finding", () => {
  const fixture = moduleFixture();
  const context = { ...fixture.context, facts: { ...fixture.context.facts, types: { ...fixture.index.types,
    terms: [...fixture.index.types.terms, { kind: "primitive", primitive: "bool" }] } } };
  completeProgramValue(moduleViolations(fixture.index, fixture.module, context), [{ rule: "shared-type-table",
    site: { kind: "module", module: fixture.module.module }, detail: [] }], "the boundary does not silently replace a conflicting supplied table");
});

test("ir-program a missing complete instantiated chunk retains the exact absent body identity", () => {
  const fixture = dualInstanceFixture();
  const removed = fixture.module.bodies.pop();
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [{ rule: "body-levels-total",
    site: { kind: "body", instance: removed.instance }, detail: [{ kind: "text", value: fixture.module.module }] }], "all indexed instances must be present in the supplied chunk");
});

test("ir-program a copied module publication retains every genuine identity and sharing cofinding", () => {
  const fixture = moduleFixture();
  fixture.module.tree = { ...fixture.module.tree };
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "template-body-shared", site: { kind: "body", instance: fixture.instance }, detail: [{ kind: "number", value: 0 }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: [{ kind: "text", value: "module-node-identity" },
      { kind: "text", value: "module tree does not retain its actual source and publication identity" }] },
  ], "a complete equal-value copy is not the supplied canonical publication object, and the actual node site is retained");
});

test("ir-program a canonical definition in the wrong publication retains its actual module owner", () => {
  const { first, second } = pairedModuleFixture();
  first.index.modules[0].items.push({ definition: second.definition, node: 0 });
  completeProgramValue(product.verifyProgramIndex(first.index, first.context), { kind: "complete", violations: [{ rule: "definition-node-owner-exact",
    site: { kind: "definition", definition: second.definition }, detail: [{ kind: "text", value: first.module.module }, { kind: "number", value: 0 }] },
    { rule: "body-owner-resolves", site: { kind: "body", instance: second.instance }, detail: [{ kind: "text", value: second.definition }] },
    { rule: "body-module-resolves", site: { kind: "body", instance: second.instance }, detail: [{ kind: "text", value: second.module.module }] },
    { rule: "item-definition-resolves", site: { kind: "definition", definition: second.definition }, detail: [{ kind: "number", value: 0 }] }] },
  "an exact canonical identity still cannot be published in a different module's definition inventory");
});

test("ir-program complete relational member references retain field, method and closed-array selections", () => {
  const fixture = moduleFixture();
  const facts = fixture.module.bodies[0].facts[0];
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
  fixture.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: fixture.instance }]), new Array(9).fill(fixture.scope));
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [],
    "every complete selected record is checked without replaying semantic analysis or losing the exact activation identity");
});

for (const change of ["absent", "present", "duplicate", "argument"]) test(`ir-program invocation summary ${change} retains the complete artifact reference result`, () => {
  const fixture = moduleFixture();
  const facts = fixture.module.bodies[0].facts[0];
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const advertised = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  const key = { kind: "declared", execution: { request: { definition: fixture.definition, endpoint: "api-signature", ordinal: 0,
    bindings: { kind: "parametric" } }, provided: 0 } };
  fixture.answers.set(encodeContextKey(["signatureIdOf", [fixture.definition, "api-signature", 0, key.execution.request.bindings]]), 0);
  facts.arena.contexts = [{ id: 0, receiver: null, arguments: [], captures: [] }];
  facts.arena.origins = [{ id: 0, kind: "complete", producers: [], includesAbsence: false }];
  facts.origins.invocations = [{ node: 0, kind: "call", boundaries: [], alternatives: [{ resolution: { decision: { candidate: 0, advertised,
    api: { ...advertised, role: "api-signature" }, bindings, implementationBindings: bindings, parameters: [],
    completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null }, activation: null },
  context: 0, arguments: [], result: 0, thrown: 0, summary: key }] }];
  fixture.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: fixture.instance }]), [fixture.scope, fixture.scope]);
  if (change !== "absent") {
    const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
    fixture.index.summaries = [{ ...input.index.summaries[0], key }];
  }
  if (change === "duplicate") fixture.index.summaries.push(fixture.index.summaries[0]);
  if (change === "argument") {
    const owner = { kind: "summary", key };
    facts.origins.invocations[0].alternatives[0].arguments = [{ authoredIndex: null, parameter: fixture.definition, parameterIndex: 0,
      repeated: false, passing: "by-value", actual: 0, formal: { owner, producer: 0 }, projection: null }];
    fixture.answers.set(encodeContextKey(["arenaOf", owner]), fixture.index.summaries[0].arena);
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
    const { first, second } = pairedModuleFixture();
    const facts = first.module.bodies[0].facts[0];
    const summaryOwner = ownerKind === "summary" || ownerKind === "duplicate-summary";
    const key = { kind: "body", execution: { instance: first.instance, provided: 0 } };
    const owner = summaryOwner ? { kind: "summary", key }
      : { kind: "body", execution: { instance: ownerKind === "missing-body" ? second.instance : first.instance, provided: 0 } };
    facts.arena.origins = [{ id: 0, kind: "complete", producers: [], includesAbsence: false }];
    facts.arena.contexts = [{ id: 0, receiver: null, arguments: [], captures: [] }];
    const argument = { authoredIndex: null, parameter: first.definition, parameterIndex: 0, repeated: false,
      passing: "by-value", actual: 0, formal: { owner, producer: 0 }, projection: null };
    if (kind === "callback") facts.origins.callbacks = [{ node: 0, argument, timing: "synchronous", rejection: null, inputs: [] }];
    else facts.origins.activations = [{ node: 0, activation: first.instance, context: 0, caller: null, entry: argument }];
    if (ownerKind === "missing-body") first.index.bodies = [first.index.bodies[0]];
    if (ownerKind === "summary") first.answers.set(encodeContextKey(["arenaOf", owner]), null);
    if (ownerKind === "duplicate-summary") {
      const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
      const summary = { ...input.index.summaries[0], key };
      first.index.summaries = [summary, summary];
      first.answers.set(encodeContextKey(["arenaOf", owner]), summary.arena);
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
  const fixture = dualInstanceFixture();
  const published = fixture.module.bodies[0];
  const actual = fixture.module.bodies[1].instance;
  published.facts[0].origins.constructions = [{ node: 0, root: { body: fixture.bodyId, node: 0 },
    allocation: { body: fixture.bodyId, node: 0 }, implementation: fixture.definition, body: actual, regions: [] }];
  fixture.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: fixture.instance }]), [fixture.scope]);
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
  first.module.bodies[0].facts[0].rawLocations = [{ node: 0, operation: "to-raw", pointee: 1, layout: { metadata: metadata.key, layout: 0 }, context: 0,
    bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } }];
  first.answers.set(encodeContextKey(["bindingScopesOf", { kind: "body", instance: first.instance }]), new Array(2).fill(first.scope));
  completeProgramValue(moduleViolations(first.index, first.module, first.context), [], "the complete raw-location record preserves its real pointee, layout and environment");
});

test("ir-program a foreign MIR metadata site retains both materialization and qualified source findings", () => {
  const { first, second } = metadataOperationFixture("size", "present", "layout");
  first.module.bodies[0].mir.blocks[0].statements[1].tir = { body: second.bodyId, node: 0 };
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
  first.module.bodies[0].mir.blocks[0].statements[1].value = { kind: "closure", instance: missing, captures: [] };
  const site = { kind: "body", instance: first.instance };
  completeProgramValue(moduleViolations(first.index, first.module, first.context), [
    { rule: "cross-owner-reference-resolves", site, detail: [{ kind: "text", value: "mir.blocks[0].statements[1].value.instance" },
      { kind: "text", value: encodeKey([missing.body, ["parametric"]]) }] },
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "operation-selected" }] },
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "definition-resolves" }] },
  ], "null is the actual missing declaration, never a fabricated canonical body return");
});

test("ir-program a deep authored child mismatch propagates to its containing body without losing the lower finding", () => {
  const fixture = moduleFixture();
  const root = fixture.module.tree;
  const common = { origin: root.origin, flags: [], loc: root.loc, tsonic: null };
  const child = { ...common, id: 2, parent: 1, kind: "EmptyStatement" };
  const block = { ...common, id: 1, parent: 0, kind: "Block", statements: { loc: root.loc, nodes: [child] }, multiLine: false };
  root.statements.nodes = [block];
  root.endOfFileToken.id = 3;
  fixture.tirInput.source.tree.statements = structuredClone(root.statements);
  fixture.tirInput.source.tree.endOfFileToken = { ...root.endOfFileToken };
  const scope = { node: 1, parent: 0, attributes: [] };
  fixture.module.bodies[0].tir.scopes.push(scope);
  fixture.tirInput.source.bodies[0].scopes = [...fixture.module.bodies[0].tir.scopes];
  child.kind = "DebuggerStatement";
  const site = { kind: "body", instance: fixture.instance };
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "instance-node-ids-exact", site, detail: [{ kind: "number", value: 1 }, { kind: "text", value: "Block" }] },
    { rule: "tir-valid", site, detail: [{ kind: "text", value: "kind-children-shape" },
      { kind: "text", value: "typed syntax does not retain the authored kind, fields and child presence" }] },
    { rule: "tir-valid", site, detail: [{ kind: "text", value: "kind-children-shape" },
      { kind: "text", value: "typed syntax does not retain the authored kind, fields and child presence" }] },
  ], "every ancestor retains the actual first failing descendant while the full original checked source remains unchanged");
});

test("ir-program a missing checked body retains the complete source and nested-publication findings", () => {
  const fixture = moduleFixture();
  fixture.tirInput.source.bodies = [];
  const site = { kind: "body", instance: fixture.instance };
  const child = (rule, message) => ({ rule: "tir-valid", site, detail: [{ kind: "text", value: rule }, { kind: "text", value: message }] });
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "body-levels-total", site, detail: [{ kind: "text", value: "source" }] },
    { rule: "facts-valid", site, detail: [{ kind: "text", value: "missing-observation-source" }] },
    child("body-owner", "body identity and owner do not retain the actual original body"),
    child("stable-order", "canonical template publication does not retain actual source body order"),
    child("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    child("nested-template-identity", "typed template does not retain its real authored body and shared syntax identity"),
    child("permission-scope", "lexical scope inventory does not retain actual authored scope order and ownership"),
  ], "the supplied checked source lacks this body; every genuine consequent finding remains");
});

test("ir-program a separately copied body root retains its actual original root identity", () => {
  const fixture = moduleFixture();
  const root = { ...fixture.module.tree, id: 2 };
  fixture.module.bodies[0].tir.root = root;
  fixture.answers.set(encodeContextKey(["nodeOf", { kind: "body", value: { body: fixture.bodyId, node: 2 } }]), null);
  const site = { kind: "body", instance: fixture.instance };
  const child = (rule, message) => ({ rule: "tir-valid", site, detail: [{ kind: "text", value: rule }, { kind: "text", value: message }] });
  completeProgramValue(moduleViolations(fixture.index, fixture.module, fixture.context), [
    { rule: "instance-node-ids-exact", site, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 2 }] },
    { rule: "template-body-shared", site, detail: [{ kind: "number", value: 2 }] },
    { rule: "tir-valid", site: { kind: "node", module: fixture.module.module, node: 0 }, detail: [{ kind: "text", value: "binding-vector-complete" },
      { kind: "text", value: "actual binding vector has no corresponding supplied scope" }] },
    child("module-node-identity", "body does not retain its module identity and canonical parametric subtree"),
    child("authored-node-ids-preserved", "typed node identity differs from the actual authored node at this position"),
    child("no-inserted-nodes", "typed syntax includes a node not present in the actual source arena"),
    child("node-in-body-range", "typed body root does not retain the actual original body subtree"),
    child("node-in-body-range", "typed syntax contains a real or invented node outside its actual original body subtree"),
    child("nested-template-identity", "published template is not the authentic body's canonical shared module subtree"),
    child("nested-template-identity", "typed template does not retain its real authored body and shared syntax identity"),
    child("node-reference", "node identity does not name an actual node in its module arena"),
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "tir-node-resolves" }] },
    { rule: "mir-valid", site, detail: [{ kind: "text", value: "tir-node-resolves" }] },
  ], "an altered supplied root is not the actual canonical record and cannot substitute another node ID");
});

test("ir-program an already exceeded binding bound still retains the duplicate-instance finding", () => {
  const fixture = dualInstanceFixture();
  const record = fixture.index.bodies[1];
  fixture.index.bodies.push(record);
  const context = { ...fixture.context, resources: product.createProgramVerificationWork({
    ...ProgramWork.state(fixture.context.resources).limits, maximumBindingVectorsPerArtifact: 0 }) };
  const key = encodeKey([fixture.bodyId, ["instantiated", [[], [], [], []]]]);
  completeProgramValue(product.verifyProgramIndex(fixture.index, context), { kind: "complete", violations: [
    { rule: "body-index-order", site: { kind: "body", instance: record.instance }, detail: [{ kind: "text", value: key }, { kind: "text", value: key }] },
    { rule: "execution-body-resolves", site: { kind: "body", instance: record.instance }, detail: [{ kind: "text", value: executionKey({ instance: record.instance, provided: 0 }) }] },
    { rule: "binding-vectors-bounded", site: { kind: "body", instance: record.instance }, detail: [{ kind: "number", value: 0 }, { kind: "number", value: 1 }] },
  ] }, "the bound reports once without suppressing any independent inventory finding");
});

for (const kind of ["goto", "unreachable", "switch", "await", "yield", "yield-absent", "delegate", "throw", "return", "call", "indirect-call", "invoke"])
  test(`ir-program metadata operand in genuine ${kind} control retains every complete child and publication finding`, () => {
    const { first, checked } = metadataOperationFixture("size", "present", "layout");
    const block = first.module.bodies[0].mir.blocks[0];
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
    const rules = kind === "return" ? ["assignment-type"] : kind === "indirect-call"
      ? ["call-receiver-exact", "call-arguments-total", "operation-selected"] : ["yield", "yield-absent", "delegate"].includes(kind)
        ? ["call-destination-type", "suspension-admitted"] : kind === "await" ? ["suspension-admitted"]
          : kind === "call" || kind === "invoke" ? ["operation-selected"] : [];
    const expected = rules.map(rule => ({ rule: "mir-valid", site: { kind: "body", instance: first.instance }, detail: [{ kind: "text", value: rule }] }));
    completeProgramValue(moduleViolations(first.index, first.module, first.context), expected,
      "the whole real source/metadata/context input retains all child findings, never a filtered success");
    for (const [field, dimension] of [["maximumWork", "work"], ["maximumCreatedRecords", "created-records"]]) {
      for (let maximum = 0; maximum <= 128; maximum += 1) {
        const context = { ...first.context, resources: product.createProgramVerificationWork({
          ...ProgramWork.state(first.context.resources).limits, [field]: maximum }) };
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
  fixture.index.types.terms.push({ kind: "primitive", primitive: "bool" });
  const table = transportTypeTable(fixture);
  const component = table.terms.find(value => value.kind === "projection" && value.projection.kind === "component").projection.component;
  const node = structuredClone(syntaxExamples.get("StringLiteral").node);
  node.tsonic.narrowing = { kind: "narrowed", source: 0, result: 0,
    proof: { steps: [{ from: component, to: component, rule: "identity", premises: [] },
      { from: component, to: component, rule: "identity", premises: [0] }], conclusion: 1 }, failure: "unwind" };
  const module = syntaxTransportModule({ module: fixture.module }, node, "Expression");
  completeSyntaxTransport(fixture, module);
});

test("ir-program complete local, parameter, yield and lexical-environment records survive the three structural transports", () => {
  const fixture = moduleFixture();
  const body = fixture.module.bodies[0].tir;
  body.yielded = 0;
  body.sent = 0;
  body.params = [{ local: 0, declaration: fixture.definition, role: "default", passing: "by-value", initializer: fixture.bodyId, storage: 0 }];
  body.locals = [{ id: 0, declaration: { kind: "body", value: { body: fixture.bodyId, node: 0 } }, name: "value",
    role: "capture", capturedFrom: { body: fixture.bodyId, local: 0 }, mutable: false, storage: 0 }];
  body.captures = [{ local: { body: fixture.bodyId, local: 0 }, capture: "captured-location" }];
  body.nestedBodies = [fixture.bodyId];
  body.scopes[0].attributes = [{ declaration: fixture.definition, occurrence: body.locals[0].declaration,
    arguments: [body.locals[0].declaration, { kind: "item", value: { owner: fixture.definition, node: 0 } }] }];
  const bound = { kind: "bound", parameter: { owner: fixture.definition, index: 0 }, type: 0 };
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
    if (Object.hasOwn(node.tsonic, "parameters")) node.tsonic.parameters = [{ identity: { owner: fixture.definition, index: 0 }, declaration: fixture.definition, constraint: 0, default: 0 }];
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
  fixture.module.tree.pragmas = [{ kind: "SingleLineCommentTrivia", pos: 0, end: 0, hasTrailingNewLine: false, name: "transport", args }];
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
  module.tree.flags = ["Ambient"];
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

for (const name of mirTransportCases(moduleFixture()).map(value => value.name)) test(`ir-program complete MIR ${name} preserves all fields through publication, text and template projection`, () => {
  const fixture = moduleFixture();
  fixture.module.bodies[0].mir = mirTransportCases(fixture).find(value => value.name === name).body;
  const program = { index: fixture.index, modules: [fixture.module] };
  const publication = { table: fixture.index.types, types: [0], signatures: [0] };
  completeProgramValue(product.canonicalizeProgram(program, publication), program, "the complete typed MIR carrier is preserved without claiming semantic verification");
  completeProgramValue(product.parseModuleBodies(fixture.index, product.printModuleBodies(fixture.index, fixture.module)),
    { kind: "parsed", value: fixture.module }, "every actual shared decision, operand and qualified record is retained");
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  completeProgramValue(product.instantiate(fixture.index, fixture.module, { kind: "mir", body: fixture.bodyId }, bindings, ProgramWork.state(fixture.context.resources).limits),
    { kind: "instantiated", artifact: { kind: "mir", body: { ...fixture.module.bodies[0].mir, bindings: { kind: "instantiated", bindings } } },
      types: fixture.index.types }, "the entire MIR template projection preserves all independent fields and original table rows");
});

for (const kind of ["tir", "mir", "facts", "summary"]) test(`ir-program ${kind} retains every typed relational carrier through its public document and artifact transport`, () => {
  const { first } = metadataBindingFixture("record", "field");
  const relational = relationalTransportArtifacts(first);
  first.module.bodies[0].facts = [relational.facts];
  first.module.bodies[0].observations = relational.observations;
  if (kind === "summary") {
    const input = decodeFixtureJson(readFileSync(resolve(repository, "test/host-cases/ir-program/function/instantiate-bound-summary-created-zero.input.json"), "utf8"));
    first.index.summaries = [{ ...input.index.summaries[0], signature: 0, bindingDependent: false,
      arena: first.module.bodies[0].facts[0].arena, key: { kind: "body", execution: relational.facts.execution } }];
  }
  first.index.metadata[0].layouts.push({ id: 2, occurrence: { kind: "item", value: { owner: first.definition, node: 0 } },
    source: 1, dataLayout: first.index.metadata[1].key.definition, byteSize: 2n, byteAlignment: 1n, stride: 1n,
    kind: "array", element: 0, length: 2n, runtimeBase: "bigint" });
  first.index.metadata[1].fingerprint = 'native"64\\le\n\ud800';
  const program = { index: first.index, modules: [first.module] };
  const publication = { table: first.index.types, types: first.index.types.terms.map((_value, position) => position),
    signatures: first.index.types.signatures.map((_value, position) => position) };
  completeProgramValue(product.canonicalizeProgram(program, publication), program, "all typed relational records retain their complete identity-publication value");
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(first.index)), { kind: "parsed", value: first.index },
    "the complete index includes actual memory-field/layout metadata, signatures and declaration rows");
  completeProgramValue(product.parseModuleBodies(first.index, product.printModuleBodies(first.index, first.module)),
    { kind: "parsed", value: first.module }, "the complete module retains every supplied relational carrier without asserting semantic analysis");
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const source = kind === "summary" ? first.index.summaries[0] : kind === "facts" ? first.module.bodies[0].facts[0] : first.module.bodies[0][kind];
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
  first.instance.bindings = { kind: "instantiated", bindings: first.module.bodies[0].tir.lexicalBindings };
  first.module.bodies[0].tir.bindings = first.instance.bindings;
  first.module.bodies[0].mir.bindings = first.instance.bindings;
  ProgramWork.state(first.context.resources).limits.typeExpansion.maximumVisits = 0;
  const result = product.verifyModuleBodies(first.index, first.module, first.context);
  completeProgramValue(result, { kind: "resource-limit", site: { kind: "body", instance: first.instance }, dimension: "visits", maximum: 0 },
    "the real captured observation batch has no partial row or invalid-fact finding on exhaustion");
  const counters = [ProgramWork.state(first.context.resources).work, ProgramWork.state(first.context.resources).created];
  const second = product.verifyModuleBodies(first.index, { ...first.module, bodies: [] }, { ...first.context,
    tirOf: () => { throw new Error("no checked-source lookup after this invocation refused"); } });
  assert.equal(result === second, true, "later calls retain the original refusal object");
  assert.deepEqual([ProgramWork.state(first.context.resources).work, ProgramWork.state(first.context.resources).created], counters);
  const other = { ...first.index, types: structuredClone(first.index.types) };
  assert.throws(() => product.verifyModuleBodies(other, first.module, first.context), /another published type table/u);
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
    for (let maximum = 0; maximum <= 192; maximum += 1) {
      const { first } = create();
      Object.assign(ProgramWork.state(first.context.resources).limits, { ...ProgramWork.state(first.context.resources).limits, [limit]: maximum });
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
  completeProgramValue(product.canonicalizeProgram(program, { table: fixture.index.types, types: [0], signatures: [0] }), program,
    "all complete signature/constant records retain their fields and original ordinal, kind and body identity");
  completeProgramValue(product.parseProgramIndex(product.printProgramIndex(fixture.index)), { kind: "parsed", value: fixture.index },
    "all complete structural records roundtrip independently of later semantic index validation");
});

test("ir-program metadata authorization retains exact selected field and record descriptor evidence", () => {
  const unavailable = { kind: "unavailable", reason: "not-provided" };
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
  const unavailable = { kind: "unavailable", reason: "not-provided" };
  const check = fixture => {
    const { first } = fixture;
    const prepared = verificationTypes(first.index, first.context.resources);
    assert.equal(prepared.kind, "complete");
    return verifyMetadataOperands(first.module.bodies[0], first.tirInput, programLookup(first.index), first.context, prepared.types);
  };
  for (const kind of ["field-item", "missing-field-root", "missing-layout-root", "missing-field-memory", "missing-layout-memory",
    "foreign-record", "missing-linked-node", "wrong-linked-node", "missing-parametric-scope", "instantiated", "substitution-refusal"]) {
    const fixture = metadataBindingFixture(kind.includes("record") || kind.includes("linked") ? "record" : "field",
      kind.includes("field-root") || kind.includes("linked") || kind === "field-item" ? "field" : "layout");
    const { first, third } = fixture;
    const published = first.module.bodies[0];
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
      const key = first.module.bodies[0].mir.constants[0].value;
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
    const published = first.module.bodies[0];
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
    const prepared = verificationTypes(first.index, first.context.resources);
    assert.equal(prepared.kind, "complete");
    const initial = { work: ProgramWork.state(first.context.resources).work, created: ProgramWork.state(first.context.resources).created };
    for (const field of ["maximumWork", "maximumCreatedRecords"]) {
      for (let extra = 0; extra <= 32; extra += 1) {
        const seed = ProgramWork.state(first.context.resources).seed;
        first.context.resources = product.createProgramVerificationWork({
          ...ProgramWork.state(first.context.resources).limits, maximumWork: 10000, maximumCreatedRecords: 10000,
          [field]: (field === "maximumWork" ? initial.work : initial.created) + extra });
        ProgramWork.state(first.context.resources).work += initial.work;
        ProgramWork.state(first.context.resources).created += initial.created;
        ProgramWork.state(first.context.resources).seed = seed;
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
      const result = verifyMetadataOperands(first.module.bodies[0], first.tirInput, programLookup(first.index), first.context, prepared.types);
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
  completeProgramValue(product.instantiate(fixture.index, fixture.module, artifact, input.bindings, ProgramWork.state(fixture.context.resources).limits),
    { kind: "instantiated", artifact: { kind: "metadata", metadata }, types: fixture.index.types }, "the exact selected independent data record is borrowed whole");
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
  const vector = { classBindings: [{ kind: "bound", parameter: { owner: definition, index: 0 }, type: 3 }], methodBindings: [],
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
  const fixture = dualInstanceFixture();
  const bindings = fixture.module.bodies[1].instance.bindings.bindings;
  bindings.classBindings.push({ kind: "bound", parameter: { owner: fixture.definition, index: 0 }, type: 0 });
  const artifact = { kind: "tir", body: fixture.bodyId };
  for (let maximum = 0; maximum < 10; maximum += 1) {
    const result = product.instantiate(fixture.index, fixture.module, artifact, bindings, { ...ProgramWork.state(fixture.context.resources).limits, maximumWork: maximum });
    const expected = maximum < 5 ? { kind: "resource-limit", dimension: "work", maximum }
      : { kind: "instantiated", artifact: { kind: "tir", body: fixture.module.bodies[1].tir }, types: fixture.index.types };
    completeProgramValue(result, expected, "the entire actual selection budget and borrowed exact artifact are retained");
  }
});

for (const kind of ["tir", "mir", "facts", "summary"]) test(`ir-program ${kind} transports a genuine complete published type seed and exact resource outcomes`, () => {
  const fixture = moduleFixture();
  const generous = { maximumWork: 1000000, maximumCreatedRecords: 1000000, maximumBindingVectorsPerArtifact: 8,
    typeExpansion: { maximumDepth: 256, maximumVisits: 100000, maximumUnionMembers: 256, maximumIntersectionMembers: 256 } };
  const publication = typeProduct.exportTypes(typeProduct.seedTypeInterner(transportTypeTable(fixture)), generous);
  assert.equal(publication.kind, "complete", "the lower owner publishes the actual complete type seed");
  fixture.index.types = publication.value.table;
  const voidType = publication.value.types[0];
  const signature = publication.value.signatures[0];
  const published = fixture.module.bodies[0];
  published.tir.signature = signature;
  published.tir.completion = voidType;
  published.mir.result = voidType;
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
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
        assert.equal(Number.isSafeInteger(actual.maximum) && actual.maximum >= 0 && actual.maximum <= maximum, true,
          "C2972 forwards the genuine remaining lower-owner limit, not the caller's whole-work limit");
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
    }, [...runtimeFiles, ...["contract", "work-data"].map(name => resolve(repository, `packages/host/src/ir-program/${name}.ts`))], raw);
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
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 2, "the actual contract and leaf work-data are type-only");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally {
    session.disconnect();
  }
});
