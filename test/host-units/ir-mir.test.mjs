import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { serialize } from "node:v8";
import { after, before, test } from "node:test";
import { runCase } from "../host-cases/case.mjs";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";
import { readImportGraph } from "../architecture/host/import-graph.mjs";
import { hostCatalogue } from "../architecture/host/catalogue.mjs";
import { compileIsolated, isolationDeps } from "../architecture/host/isolation.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const tooling = process.env.TSONIC_HOST_TOOLING_ROOT ?? repository;
const quarantineRoots = JSON.parse(readFileSync(resolve(repository, "test/architecture/quarantine/areas.json"), "utf8")).areas.map(area => area.directory);
const names = ["index", "print", "parse", "verify", "verify-control", "verify-laws", "verify-storage", "text", "text-decisions"];
const runtimeFiles = names.map(name => resolve(repository, `packages/host/dist/ir-mir/${name}.js`));
const sourceFiles = [...names, "contract"].map(name => `packages/host/src/ir-mir/${name}.ts`);
const evidenceDirectory = resolve(repository, ".analysis/20261111-f-ir-mir/unit-proof");
const session = new Session();
const post = (method, parameters = {}) => new Promise((done, reject) => {
  session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
});
let product;
let identities;

before(async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true, "MIR cases require an actual aggregate guarded admission");
  mkdirSync(evidenceDirectory, { recursive: true });
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  product = await import("../../packages/host/dist/ir-mir/index.js");
  identities = await import("../../packages/host/dist/ids/index.js");
});

// The cases of the graph laws (S2-18) are part of this bank, so that the coverage this bank requires of every
// runtime file of the module is measured over them too. They are loaded here, after the hook above is registered:
// their own hook then runs second, when coverage is already being recorded and the module is loaded.
await import("./ir-mir-laws.cases.mjs");

const bodyIdentity = "B[D[M[P[p];m];run];function;0]";
const emptyValue = { body: bodyIdentity, bindings: { kind: "parametric" }, entries: [], locals: [], constants: [], places: [], blocks: [], result: 0 };
const emptyText = 'MirBody(body=body:"B[D[M[P[p];m];run];function;0]", bindings=parametric(), entries=[], locals=[], constants=[], places=[], blocks=[], result=t:0)\n';
const fieldPrefix = 'MirBody(body=body:"B[D[M[P[p];m];run];function;0]", ';
const finalPrefix = `${emptyText.slice(0, -2)}, `;
const nodeRef = { body: bodyIdentity, node: 0 };
const nodeText = `NodeRef(body=body:${JSON.stringify(bodyIdentity)}, node=n:0)`;
const origin = { module: "M[P[p];m]", start: 0, length: 0, derived: [] };
const originText = 'Origin(module=mod:"M[P[p];m]", start=0, length=0, derived=[])';
const bindingVector = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
const bindingText = "BindingVector(classBindings=[], methodBindings=[], capturedBindings=[], selfBindings=[])";
const instance = { body: bodyIdentity, bindings: { kind: "parametric" } };
const instanceText = `BodyInstance(body=body:${JSON.stringify(bodyIdentity)}, bindings=parametric())`;
const site = { origin, tir: nodeRef };
const siteText = `origin=${originText}, tir=${nodeText}`;
const endpoint = { declaration: "D[M[P[p];m];run]", role: "advertised", signature: 0, body: bodyIdentity };
const endpointText = `HirCallableEndpoint(declaration=def:"D[M[P[p];m];run]", role="advertised", signature=sig:0, body=body:${JSON.stringify(bodyIdentity)})`;
const apiEndpoint = { ...endpoint, role: "api-signature" };
const apiText = endpointText.replace('role="advertised"', 'role="api-signature"');
const application = { candidate: 0, advertised: endpoint, api: apiEndpoint, bindings: bindingVector,
  implementationBindings: bindingVector, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null };
const applicationText = `ApplicationDecision(candidate=0, advertised=${endpointText}, api=${apiText}, bindings=${bindingText}, implementationBindings=${bindingText}, parameters=[], completion=CompletionEndpoint(signature=sig:0, completion=t:0, yielded=null, sent=null), result=t:0, activation=null)`;
const callee = { decision: application, activation: instance, captures: [{ body: bodyIdentity, local: 0 }] };
const calleeText = `ResolvedCallee(decision=${applicationText}, activation=${instanceText}, captures=[LocalRef(body=body:${JSON.stringify(bodyIdentity)}, local=l:0)])`;
const member = { decision: { key: { kind: "text", value: "x" }, origins: [], selectedDeclarations: [], primary: null,
  read: 0, write: 0, getter: null, setter: null, bindings: bindingVector, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
const memberText = `MemberSelection(decision=MemberDecision(key=text(value="x"), origins=[], selectedDeclarations=[], primary=null, read=t:0, write=t:0, getter=null, setter=null, bindings=${bindingText}, location=data(check=none(), receiver="in-place")), getter=null, setter=null)`;
const operation = { decision: { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "int32" }, operands: [0], result: 0, execution: { kind: "pure" } }, permissionScope: null };
const operationText = 'TypedOperation(decision=selected(operation=native-operator(operator="+", carrier="int32"), operands=[t:0], result=t:0, execution=pure()), permissionScope=null)';
const placeOperand = { kind: "place", place: 0 };
const constantOperand = { kind: "constant", constant: 0 };
const operandText = "place(place=p:0)";
const constantOperandText = "constant(constant=c:0)";

// A body's text. `entries` is empty for the cases that only print and parse; a body that is verified has the one
// entry of a body without parameters (`entryText`).
const entryText = "MirEntry(provided=0, block=b:0)";
function document(locals, constants, places, blocks, bindings = "parametric()", result = "t:0", entries = "") {
  return `MirBody(body=body:${JSON.stringify(bodyIdentity)}, bindings=${bindings}, entries=[${entries}], locals=[${locals}], constants=[${constants}], places=[${places}], blocks=[${blocks}], result=${result})\n`;
}

function roundtrip(expected, text, label) {
  const parsed = product.parseMir(text);
  same(parsed, { kind: "parsed", value: expected }, `${label}: complete independent typed value`);
  const actualText = product.printMir(parsed.value);
  comparison(actualText, text, actualText === text, `${label}: complete independent declared-order text`);
}

function same(actual, expected, label) {
  comparison(actual, expected, isDeepStrictEqual(actual, expected), label);
}

function comparison(actual, expected, matches, label) {
  if (!matches) {
    const directory = mkdtempSync(resolve(evidenceDirectory, "comparison-"));
    const actualPath = resolve(directory, "actual.v8");
    const expectedPath = resolve(directory, "expected.v8");
    writeFileSync(actualPath, serialize(actual));
    writeFileSync(expectedPath, serialize(expected));
    label = `${label}; complete actual (node:v8): ${actualPath}; complete expected (node:v8): ${expectedPath}`;
  }
  assert.equal(matches, true, label);
}

function invalidText(text, offset, expected, found, line = 1, column = offset + 1) {
  same(product.parseMir(text), { kind: "invalid-text", offset, line, column, expected, found }, `complete invalid-text result for ${JSON.stringify(text)}`);
}

for (const level of ["function", "verifier"]) for (const name of readdirSync(resolve(repository, `test/host-cases/ir-mir/${level}`)).filter(name => name.endsWith(".case.json")).sort()) {
  test(`MIR independently authored ${level} fixture ${name}`, async () => {
    const descriptor = `test/host-cases/ir-mir/${level}/${name}`;
    const result = await runCase({
      modules: ["ir-mir"],
      evidenceDirectory: resolve(repository, ".temp/host-case-evidence"),
      canonical: path => relative(repository, realpathSync(resolve(repository, path))).split("\\").join("/"),
      readText: path => readFileSync(resolve(repository, path), "utf8"),
      list: path => readdirSync(resolve(repository, path)),
      decode: (text, format) => { assert.equal(format, "json"); return JSON.parse(text); },
      adapters: { function: input => {
        const value = JSON.parse(input.text);
        if (value.operation === "parse") return { kind: "accepted", value: product.parseMir(value.text), diagnostics: [] };
        assert.equal(value.operation, "print", "the authored fixture operation is closed");
        const parsed = product.parseMir(value.text);
        assert.equal(parsed.kind, "parsed", "the owning print fixture starts from genuinely parsed branded IDs");
        return { kind: "accepted", value: product.printMir(parsed.value), diagnostics: [] };
      }, verifier: input => {
        const value = JSON.parse(input.text);
        const declarations = new Map(value.declarations);
        const owners = new Map(value.bodyOwners);
        const context = { limits: value.limits, source: value.source, types: value.types, declarationOf: definition => {
          assert.equal(declarations.has(definition), true, `fixture declared lookup ${definition}`);
          return declarations.get(definition);
        }, bodyOwner: body => {
          assert.equal(owners.has(body), true, `fixture body-owner lookup ${body}`);
          return owners.get(body);
        } };
        const vectors = value.bodies.map(text => {
          const parsed = product.parseMir(text);
          assert.equal(parsed.kind, "parsed", "verifier fixture is genuinely schema-valid, not a stubbed MIR value");
          return verified(parsed.value, context);
        });
        return { kind: "accepted", value: vectors, diagnostics: [] };
      } },
    }, descriptor);
    assert.equal(result.status, "passed", JSON.stringify(result.status === "failed" ? result : { descriptor }));
  });
}

test("MIR public index has exactly the four locked ports", () => {
  same(Object.keys(product).sort(), ["constantKeyOfMir", "parseMir", "printMir", "verifyMir"], "exact public value inventory");
});

test("empty typed tables parse unchanged and print every required field in declaration order", () => {
  const parsed = product.parseMir(emptyText);
  same(parsed, { kind: "parsed", value: emptyValue }, "complete independently authored empty-table value");
  const actualText = product.printMir(parsed.value);
  comparison(actualText, emptyText, Object.is(actualText, emptyText), "complete empty-table text");
  same(product.parseMir(` \r\n\t${emptyText} \n`), parsed, "all insignificant whitespace retains the complete value");
});

test("root, required fields, typed scalar prefixes and trailing text report the actual first error", () => {
  invalidText("", 0, ["MirBody"], null);
  invalidText("Wrong()", 0, ["MirBody"], "W");
  invalidText("Mir", 3, ["MirBody"], null);
  invalidText('"MirBody"()', 0, ["MirBody"], '"');
  invalidText("MirBody[", 7, ["("], "[");
  invalidText("MirBody()", 8, ["body"], ")");
  invalidText("MirBody(result=t:0)", 8, ["body"], "r");
  invalidText('MirBody("bo"=null)', 11, ["body"], '"');
  invalidText('MirBody("x\\q"=null)', 9, ["body"], "x");
  invalidText('MirBody("b\\q"=null)', 10, ["JSON string escape"], "\\");
  invalidText(`${emptyText}!`, emptyText.length, ["end of text"], "!", 2, 1);
  for (const newline of ["\r", "\n", "\r\n"]) {
    invalidText(`${newline}${emptyText}!`, newline.length + emptyText.length, ["end of text"], "!", 3, 1);
    invalidText(`${newline}MirBody(result=t:0)`, newline.length + 8, ["body"], "r", 2, 9);
  }
});

test("MIR identity, variant, Boolean and bigint failures preserve the first exact typed token", () => {
  const identityPrefix = 'MirBody(body=body:"';
  invalidText(`${identityPrefix}X")`, identityPrefix.length, ["canonical body identity"], "X");
  invalidText(`${identityPrefix}\\u0058")`, identityPrefix.length, ["canonical body identity"], "\\");
  invalidText(`${identityPrefix}")`, identityPrefix.length, ["canonical body identity"], '"');
  const bindingPrefix = `${fieldPrefix}bindings=`;
  invalidText(`${bindingPrefix}wrong()`, bindingPrefix.length, ["parametric", "instantiated"], "w");
  invalidText(`${bindingPrefix}"parametric"`, bindingPrefix.length, ["parametric", "instantiated"], '"');
  const literalPrefix = `${fieldPrefix}bindings=parametric(), entries=[], locals=[], constants=[MirConstant(id=c:0, type=t:0, value=literal(value=`;
  const booleanPrefix = `${literalPrefix}boolean(value=`;
  for (const [token, delta, expected, found] of [
    ["x", 0, "boolean", "x"], ["truX", 3, "true", "X"], ["falsX", 4, "false", "X"], ["truex", 4, "true", "x"],
  ]) invalidText(`${booleanPrefix}${token})`, booleanPrefix.length + delta, [expected], found);
  const bigintPrefix = `${literalPrefix}number(token="0", value=ExactRational(numerator=`;
  const stringPrefix = `${literalPrefix}number(token=`;
  invalidText(`${stringPrefix}false)`, stringPrefix.length, ["string"], "f");
  invalidText(`${stringPrefix}"\\q`, stringPrefix.length + 1, ["JSON string escape"], "\\");
  for (const [token, delta, expected, found] of [
    ["01n", 1, "bigint", "1"], ["1.0n", 1, "n", "."], ["1nx", 2, "bigint", "x"], ["-n", 1, "bigint", "n"],
  ]) invalidText(`${bigintPrefix}${token})`, bigintPrefix.length + delta, [expected], found);
  const passPrefix = `${fieldPrefix}bindings=parametric(), entries=[], locals=[MirLocal(id=l:0, storage=t:0, role=user(), source=null, origin=Origin(module=mod:"M[P[p];m]", start=0, length=0, derived=[lowering(pass=`;
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness",
    "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"].map(value => JSON.stringify(value));
  invalidText(`${passPrefix}front)`, passPrefix.length, passes, "f");
  invalidText(`${passPrefix}"x\\q`, passPrefix.length + 1, passes, "x");
  invalidText(`${passPrefix}"\\q`, passPrefix.length + 1, ["JSON string escape"], "\\");
  invalidText(`${passPrefix}""`, passPrefix.length + 1, passes, '"');
});

test("C2939 complete duplicate, incomplete name and later lexical failure share the same earlier deviation", () => {
  invalidText(`${fieldPrefix}"body"=null)`, fieldPrefix.length + 2, ["unique record field"], "o");
  invalidText(`${fieldPrefix}"bo`, fieldPrefix.length + 2, ["bindings"], "o");
  invalidText(`${fieldPrefix}"bo\\q`, fieldPrefix.length + 2, ["bindings"], "o");
  invalidText(`${fieldPrefix}body=null)`, fieldPrefix.length + 1, ["unique record field"], "o");
  invalidText(`${fieldPrefix}"\\u0062ody"=null)`, fieldPrefix.length + 7, ["unique record field"], "o");
  invalidText(`${fieldPrefix}"\\q`, fieldPrefix.length + 1, ["JSON string escape"], "\\");
});

test("C2940 no-next-field reports decoded first character, escape start or empty-name closing quote", () => {
  invalidText(`${finalPrefix}"extra`, finalPrefix.length + 1, ["end of record"], "e");
  invalidText(`${finalPrefix}"extra"=0)`, finalPrefix.length + 1, ["end of record"], "e");
  invalidText(`${finalPrefix}"\\u0065xtra"=0)`, finalPrefix.length + 1, ["end of record"], "\\");
  invalidText(`${finalPrefix}"result"=t:0)`, finalPrefix.length + 1, ["unique record field"], "r");
  invalidText(`${finalPrefix}result=t:0)`, finalPrefix.length, ["unique record field"], "r");
  invalidText(`${finalPrefix}""=0)`, finalPrefix.length + 1, ["end of record"], '"');
});

for (const [value, text] of [
  [{ kind: "receiver" }, "receiver()"],
  [{ kind: "parameter", index: 0 }, "parameter(index=0)"],
  [{ kind: "capture", index: -0 }, "capture(index=-0)"],
  [{ kind: "user" }, "user()"], [{ kind: "temporary" }, "temporary()"], [{ kind: "return" }, "return()"],
  [{ kind: "exception" }, "exception()"], [{ kind: "completion" }, "completion()"],
]) {
  test(`MIR local role ${value.kind} retains all required data`, () => {
    const local = { id: 0, storage: 0, role: value, source: null, origin };
    const row = `MirLocal(id=l:0, storage=t:0, role=${text}, source=null, origin=${originText})`;
    roundtrip({ ...emptyValue, locals: [local] }, document(row, "", "", ""), `local ${value.kind}`);
  });
}

for (const [value, text] of [
  [{ kind: "number", token: "-0", value: { numerator: 0n, denominator: 1n, negativeZero: true } },
    'number(token="-0", value=ExactRational(numerator=0n, denominator=1n, negativeZero=true))'],
  [{ kind: "number", token: "9007199254740993.25", value: { numerator: 36028797018963973n, denominator: 4n, negativeZero: false } },
    'number(token="9007199254740993.25", value=ExactRational(numerator=36028797018963973n, denominator=4n, negativeZero=false))'],
  [{ kind: "bigint", token: "-900719925474099312345678901234567890n", value: -900719925474099312345678901234567890n },
    'bigint(token="-900719925474099312345678901234567890n", value=-900719925474099312345678901234567890n)'],
  [{ kind: "string", value: "\uD800\n\uDFFF" }, 'string(value="\\ud800\\n\\udfff")'],
  [{ kind: "boolean", value: true }, "boolean(value=true)"],
  [{ kind: "boolean", value: false }, "boolean(value=false)"],
  [{ kind: "absence" }, "absence()"],
  [{ kind: "unique-symbol", declaration: "D[M[P[p];m];run]" }, 'unique-symbol(declaration=def:"D[M[P[p];m];run]")'],
]) {
  test(`MIR exact literal ${text} is never rounded or normalized`, () => {
    const constant = { id: 0, type: 0, value: { kind: "literal", value } };
    const row = `MirConstant(id=c:0, type=t:0, value=literal(value=${text}))`;
    roundtrip({ ...emptyValue, constants: [constant] }, document("", row, "", ""), text);
  });
}

for (const [value, text] of [
  [{ kind: "definition", definition: "D[M[P[p];m];run]", bindings: { kind: "parametric" } },
    'definition(definition=def:"D[M[P[p];m];run]", bindings=parametric())'],
  [{ kind: "metadata", definition: "D[M[P[p];m];run]", bindings: { kind: "instantiated", bindings: bindingVector } },
    `metadata(definition=def:"D[M[P[p];m];run]", bindings=instantiated(bindings=${bindingText}))`],
  [{ kind: "observation", at: nodeRef }, `observation(at=${nodeText})`],
  [{ kind: "constant", reference: { initializer: instance } }, `constant(reference=ConstantReference(initializer=${instanceText}))`],
]) {
  test(`MIR constant arm ${value.kind} retains its actual qualified context`, () => {
    const constant = { id: 0, type: 0, value };
    roundtrip({ ...emptyValue, constants: [constant] }, document("", `MirConstant(id=c:0, type=t:0, value=${text})`, "", ""), value.kind);
  });
}

for (const [value, text] of [[-0, "-0"], [0, "0"], [0.25, "0.25"], [1e21, "1e+21"],
  [NaN, "NaN"], [Infinity, "+Infinity"], [-Infinity, "-Infinity"], [5e-324, "5e-324"]]) {
  test(`all admitted host numeric identity values preserve ${text}`, () => {
    roundtrip({ ...emptyValue, result: value }, document("", "", "", "", "parametric()", `t:${text}`), `exact type identity ${text}`);
  });
}

for (const [base, text] of [
  [{ kind: "local", local: 0 }, "local(local=l:0)"],
  [{ kind: "static", definition: "D[M[P[p];m];run]" }, 'static(definition=def:"D[M[P[p];m];run]")'],
  [{ kind: "place", place: 0, projection: { kind: "field", member }, tir: nodeRef }, `place(place=p:0, projection=field(member=${memberText}), tir=${nodeText})`],
  [{ kind: "place", place: 0, projection: { kind: "index", operand: constantOperand }, tir: nodeRef }, `place(place=p:0, projection=index(operand=${constantOperandText}), tir=${nodeText})`],
  [{ kind: "place", place: 0, projection: { kind: "element", index: 2 }, tir: nodeRef }, `place(place=p:0, projection=element(index=2), tir=${nodeText})`],
  [{ kind: "place", place: 0, projection: { kind: "deref" }, tir: nodeRef }, `place(place=p:0, projection=deref(), tir=${nodeText})`],
  [{ kind: "place", place: 0, projection: { kind: "capture", index: 1 }, tir: nodeRef }, `place(place=p:0, projection=capture(index=1), tir=${nodeText})`],
  // S2-18: the narrowed view of a place exists only under a checked base (it replaces the `refine` value).
  [{ kind: "checked", place: 0, projection: { kind: "refined" }, tir: nodeRef }, `checked(place=p:0, projection=refined(), tir=${nodeText})`],
  [{ kind: "checked", place: 0, projection: { kind: "index", operand: constantOperand }, tir: nodeRef }, `checked(place=p:0, projection=index(operand=${constantOperandText}), tir=${nodeText})`],
]) {
  test(`MIR place arm ${text} preserves its complete projection`, () => {
    const place = { id: 0, base, storage: 0, origin };
    roundtrip({ ...emptyValue, places: [place] }, document("", "", `MirPlace(id=p:0, base=${text}, storage=t:0, origin=${originText})`, ""), text);
  });
}

for (const [value, text] of [
  [{ kind: "use", operand: placeOperand }, `use(operand=${operandText})`],
  [{ kind: "unary", operation, operand: placeOperand }, `unary(operation=${operationText}, operand=${operandText})`],
  [{ kind: "binary", operation, left: placeOperand, right: constantOperand }, `binary(operation=${operationText}, left=${operandText}, right=${constantOperandText})`],
  [{ kind: "convert", operation, operand: placeOperand, to: 0 }, `convert(operation=${operationText}, operand=${operandText}, to=t:0)`],
  [{ kind: "aggregate", type: 0, aggregate: { kind: "array", elements: [] } }, "aggregate(type=t:0, aggregate=array(elements=[]))"],
  [{ kind: "aggregate", type: 0, aggregate: { kind: "tuple", elements: [placeOperand] } }, `aggregate(type=t:0, aggregate=tuple(elements=[${operandText}]))`],
  [{ kind: "aggregate", type: 0, aggregate: { kind: "fixed-array", elements: [placeOperand, constantOperand] } }, `aggregate(type=t:0, aggregate=fixed-array(elements=[${operandText}, ${constantOperandText}]))`],
  [{ kind: "aggregate", type: 0, aggregate: { kind: "object", fields: [] } }, "aggregate(type=t:0, aggregate=object(fields=[]))"],
  [{ kind: "aggregate", type: 0, aggregate: { kind: "record", fields: [{ member, value: placeOperand }] } },
    `aggregate(type=t:0, aggregate=record(fields=[MirAggregateField(member=${memberText}, value=${operandText})]))`],
  [{ kind: "address-of", place: 0, type: 0 }, "address-of(place=p:0, type=t:0)"],
  [{ kind: "closure", instance, captures: [{ local: { body: bodyIdentity, local: 0 }, place: 0 }] },
    `closure(instance=${instanceText}, captures=[MirClosureCapture(local=LocalRef(body=body:${JSON.stringify(bodyIdentity)}, local=l:0), place=p:0)])`],
]) {
  test(`MIR rvalue ${text} is a complete typed round trip`, () => {
    const statement = { ...site, kind: "assign", step: null, place: 0, value };
    const terminator = { ...site, kind: "unreachable" };
    const block = { ...site, id: 0, statements: [statement], terminator };
    const blockText = `MirBlock(${siteText}, id=b:0, statements=[assign(${siteText}, place=p:0, value=${text}, step=null)], terminator=unreachable(${siteText}))`;
    roundtrip({ ...emptyValue, blocks: [block] }, document("", "", "", blockText), text);
  });
}

test("MIR call of an internal body, an omitted argument and two entries are complete typed round trips", () => {
  // S2-18: the callee that is a body instance with its captures; an argument the call omits; a body with an entry
  // for each supplied count.
  const terminator = { ...site, kind: "call", step: null, callee: { kind: "body", instance, captures: [{ local: { body: bodyIdentity, local: 0 }, place: 0 }] },
    receiver: null, arguments: [{ kind: "value", passing: "by-value", operand: constantOperand }, { kind: "omitted" }], destination: null, next: 0, unwind: { kind: "escape" } };
  const text = `call(${siteText}, callee=body(instance=${instanceText}, captures=[MirClosureCapture(local=LocalRef(body=body:${JSON.stringify(bodyIdentity)}, local=l:0), place=p:0)]), receiver=null, arguments=[value(passing="by-value", operand=${constantOperandText}), omitted()], destination=null, next=b:0, unwind=escape(), step=null)`;
  roundtrip({ ...emptyValue, entries: [{ provided: 2, block: 0 }, { provided: 1, block: 0 }], blocks: [{ ...site, id: 0, statements: [], terminator }] },
    document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[], terminator=${text})`, undefined, undefined,
      "MirEntry(provided=2, block=b:0), MirEntry(provided=1, block=b:0)"), "body callee, omitted argument, two entries");
});

test("MIR verification refuses a limit that is not a count as its caller's defect", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  for (const maximumWork of [NaN, Infinity, -1, 0.5, -0.5]) assert.throws(() => product.verifyMir(body, { ...context, limits: { maximumWork } }),
    { name: "TypeError", message: "ir-mir: maximumWork must be a finite nonnegative integer" });
  same(product.verifyMir(body, { ...context, limits: { maximumWork: 0 } }), { kind: "complete", violations: [] }, "zero is a count");
});

test("MIR storage statements preserve both closed arms and source/origin correlation", () => {
  const statements = [{ ...site, kind: "storage-live", local: 0 }, { ...site, kind: "storage-dead", local: 0 }];
  const terminator = { ...site, kind: "return", value: null };
  const block = { ...site, id: 0, statements, terminator };
  const text = `MirBlock(${siteText}, id=b:0, statements=[storage-live(${siteText}, local=l:0), storage-dead(${siteText}, local=l:0)], terminator=return(${siteText}, value=null))`;
  roundtrip({ ...emptyValue, blocks: [block] }, document("", "", "", text), "both storage statements");
});

for (const [value, text] of [
  [{ kind: "goto", target: 1 }, "goto(target=b:1)"],
  [{ kind: "switch", step: null, operand: placeOperand, targets: [], otherwise: 2 }, `switch(operand=${operandText}, targets=[], otherwise=b:2, step=null)`],
  [{ kind: "switch", step: null, operand: constantOperand, targets: [{ constant: 0, target: 1 }, { constant: 2, target: 3 }], otherwise: 4 },
    `switch(operand=${constantOperandText}, targets=[MirSwitchTarget(constant=c:0, target=b:1), MirSwitchTarget(constant=c:2, target=b:3)], otherwise=b:4, step=null)`],
  [{ kind: "invoke", step: null, operation, operands: [placeOperand, constantOperand], destination: 0, next: 1, unwind: { kind: "escape" } },
    `invoke(operation=${operationText}, operands=[${operandText}, ${constantOperandText}], destination=p:0, next=b:1, unwind=escape(), step=null)`],
  [{ kind: "invoke", step: null, operation, operands: [], destination: null, next: 0, unwind: { kind: "handler", exception: 2, target: 3 } },
    `invoke(operation=${operationText}, operands=[], destination=null, next=b:0, unwind=handler(exception=p:2, target=b:3), step=null)`],
  [{ kind: "await", step: null, operand: placeOperand, destination: 0, resume: 1, unwind: { kind: "handler", exception: 2, target: 3 } },
    `await(operand=${operandText}, destination=p:0, resume=b:1, unwind=handler(exception=p:2, target=b:3), step=null)`],
  [{ kind: "yield", step: null, operand: null, destination: 0, resume: 1, return: { destination: 2, target: 3 }, unwind: { kind: "escape" } },
    "yield(operand=null, destination=p:0, resume=b:1, return=MirSuspensionReturn(destination=p:2, target=b:3), unwind=escape(), step=null)"],
  [{ kind: "yield", step: null, operand: constantOperand, destination: 1, resume: 2, return: { destination: 3, target: 4 }, unwind: { kind: "handler", exception: 5, target: 6 } },
    `yield(operand=${constantOperandText}, destination=p:1, resume=b:2, return=MirSuspensionReturn(destination=p:3, target=b:4), unwind=handler(exception=p:5, target=b:6), step=null)`],
  [{ kind: "delegate", step: null, iterator: placeOperand, destination: 1, resume: 2, return: { destination: 3, target: 4 }, unwind: { kind: "handler", exception: 5, target: 6 } },
    `delegate(iterator=${operandText}, destination=p:1, resume=b:2, return=MirSuspensionReturn(destination=p:3, target=b:4), unwind=handler(exception=p:5, target=b:6), step=null)`],
  // S2-18: the check, the two failure kinds without an edge, and a record that names its step.
  [{ kind: "check", place: 0, next: 1, unwind: { kind: "escape" } }, "check(place=p:0, next=b:1, unwind=escape())"],
  [{ kind: "check", place: 2, next: 1, unwind: { kind: "abort" } }, "check(place=p:2, next=b:1, unwind=abort())"],
  [{ kind: "invoke", step: { protocol: 1, step: 2 }, operation, operands: [], destination: null, next: 0, unwind: { kind: "none" } },
    `invoke(operation=${operationText}, operands=[], destination=null, next=b:0, unwind=none(), step=MirStepRef(protocol=1, step=2))`],
  [{ kind: "throw", operand: constantOperand, unwind: { kind: "escape" } }, `throw(operand=${constantOperandText}, unwind=escape())`],
  [{ kind: "return", value: placeOperand }, `return(value=${operandText})`],
  [{ kind: "return", value: null }, "return(value=null)"],
  [{ kind: "unreachable" }, "unreachable()"],
]) {
  test(`MIR terminator ${text} retains all normal, exceptional and suspension exits`, () => {
    const terminator = { ...site, ...value };
    const fullText = text.replace("(", `(${siteText}${text.endsWith("()") ? "" : ", "}`);
    const block = { ...site, id: 0, statements: [], terminator };
    roundtrip({ ...emptyValue, blocks: [block] }, document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[], terminator=${fullText})`), text);
  });
}

test("MIR missing API signatures retain physical receiver and every argument reference", () => {
  for (const passing of ["by-value", "borrow-shared"]) {
    const { body, context } = callSetup(passing, 0, 1);
    same(verified(body, context), [], "the actual source call and API remain valid before the physical mutation");
    for (const signature of [identities.sigId(99), identities.sigId(-1)]) {
      const terminator = body.blocks[0].terminator;
      const resolution = { ...terminator.callee.resolution, decision: { ...terminator.callee.resolution.decision,
        api: { ...terminator.callee.resolution.decision.api, signature } } };
      const changed = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...terminator,
        callee: { ...terminator.callee, resolution }, receiver: { kind: "constant", constant: identities.constId(99) },
        arguments: passing === "by-value" ? [{ kind: "value", passing, operand: { kind: "constant", constant: identities.constId(99) } }]
          : [{ kind: "place", passing, place: identities.placeId(99) }],
      } }, body.blocks[1]] };
      const at = { kind: "instruction", block: 0, statement: null };
      same(verified(changed, context), [expectedViolation("operand-resolves", at),
        expectedViolation("operand-resolves", at), expectedViolation("operation-selected", at),
        expectedViolation("type-resolves", at, [{ kind: "number", value: signature }])],
      "an unavailable selected API cannot suppress either physical reference finding");
    }
  }
});

test("MIR no-value return is restricted to actual void and absence completion carriers", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const absence = identities.tyId(context.types.terms.length);
  for (const completion of [identities.tyId(0), absence, identities.tyId(1)]) {
    const input = { ...context, source: { ...context.source, completion }, types: {
      terms: [...context.types.terms, { kind: "intrinsic", intrinsic: "absence" }],
      signatures: [{ ...context.types.signatures[0], result: completion }],
    } };
    same(verified({ ...body, result: completion }, input), completion === 1
      ? [expectedViolation("assignment-type", { kind: "instruction", block: 0, statement: null })] : [],
    "only the real native absence and void carriers admit a physical return without a value");
  }
});

for (const passing of ["by-value", "move", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut"]) {
  for (const indirect of [false, true]) {
    test(`MIR ${indirect ? "indirect" : "direct"} call preserves exact ${passing} argument, receiver and destination`, () => {
      const argument = passing === "by-value" || passing === "move"
        ? { kind: "value", passing, operand: constantOperand } : { kind: "place", passing, place: 0 };
      const argumentText = argument.kind === "value" ? `value(passing=${JSON.stringify(passing)}, operand=${constantOperandText})`
        : `place(passing=${JSON.stringify(passing)}, place=p:0)`;
      const selected = indirect ? { kind: "indirect", operand: placeOperand, resolution: callee } : { kind: "direct", resolution: callee };
      const selectedText = indirect ? `indirect(operand=${operandText}, resolution=${calleeText})` : `direct(resolution=${calleeText})`;
      const terminator = { ...site, kind: "call", step: null, callee: selected, receiver: indirect ? placeOperand : null,
        arguments: [argument], destination: indirect ? 0 : null, next: 1,
        unwind: indirect ? { kind: "handler", exception: 2, target: 3 } : { kind: "escape" } };
      const text = `call(${siteText}, callee=${selectedText}, receiver=${indirect ? operandText : "null"}, arguments=[${argumentText}], destination=${indirect ? "p:0" : "null"}, next=b:1, unwind=${indirect ? "handler(exception=p:2, target=b:3)" : "escape()"}, step=null)`;
      roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [], terminator }] },
        document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[], terminator=${text})`), `${passing}/${indirect}`);
    });
  }
}

for (const [identity, text] of [
  [{ kind: "native-operator", operator: "/", carrier: "uint128" }, 'native-operator(operator="/", carrier="uint128")'],
  [{ kind: "bigint-operator", operator: "**" }, 'bigint-operator(operator="**")'],
  [{ kind: "string-operator", operator: "+" }, 'string-operator(operator="+")'],
  [{ kind: "boolean-operator", operator: "||" }, 'boolean-operator(operator="||")'],
  [{ kind: "absence-test", negated: false }, "absence-test(negated=false)"],
  [{ kind: "object-construction", parts: [] }, "object-construction(parts=[])"],
  [{ kind: "array-construction", parts: [] }, "array-construction(parts=[])"],
  [{ kind: "protocol", protocol: "dispose", asynchronous: true, steps: [], value: 1, completion: 2, yielded: null, sent: 3, thrown: 4 },
    'protocol(protocol="dispose", asynchronous=true, steps=[], value=t:1, completion=t:2, yielded=null, sent=t:3, thrown=t:4)'],
  [{ kind: "conversion", from: 1, to: 2, embedding: { kind: "identity" } }, "conversion(from=t:1, to=t:2, embedding=identity())"],
  [{ kind: "library", declaration: endpoint.declaration, bindings: bindingVector }, `library(declaration=def:"D[M[P[p];m];run]", bindings=${bindingText})`],
  [{ kind: "core", declaration: endpoint.declaration, bindings: bindingVector }, `core(declaration=def:"D[M[P[p];m];run]", bindings=${bindingText})`],
  [{ kind: "pointer-address" }, "pointer-address()"], [{ kind: "pointer-read" }, "pointer-read()"],
  [{ kind: "pointer-write" }, "pointer-write()"], [{ kind: "pointer-offset" }, "pointer-offset()"],
  [{ kind: "type-query" }, "type-query()"], [{ kind: "discard" }, "discard()"],
]) {
  test(`MIR nested selected operation ${identity.kind} is retained without target interpretation`, () => {
    const selected = { decision: { kind: "selected", operation: identity, operands: [0, 1], result: 2, execution: { kind: "pure" } }, permissionScope: 0 };
    const selectedText = `TypedOperation(decision=selected(operation=${text}, operands=[t:0, t:1], result=t:2, execution=pure()), permissionScope=n:0)`;
    const terminator = { ...site, kind: "invoke", step: null, operation: selected, operands: [placeOperand, constantOperand], destination: 0, next: 1, unwind: { kind: "escape" } };
    const fullText = `invoke(${siteText}, operation=${selectedText}, operands=[${operandText}, ${constantOperandText}], destination=p:0, next=b:1, unwind=escape(), step=null)`;
    roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [], terminator }] },
      document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[], terminator=${fullText})`), identity.kind);
  });
}

test("MIR origins retain every lowering pass, exact expansion string and source LocalRef", () => {
  const passes = ["front", "decls", "infer", "elaborate", "validate", "lower-mir", "evaluate", "metadata", "liveness",
    "initialization", "refinements", "origins", "suspension", "errorStorage", "pointerBacking", "summaries", "pipeline"];
  const derived = [...passes.map(pass => ({ kind: "lowering", pass })), { kind: "expansion", expansion: "\uD800.expansion\n" }];
  const exactOrigin = { ...origin, start: -0, length: 1.25, derived };
  const exactText = `Origin(module=mod:"M[P[p];m]", start=-0, length=1.25, derived=[${passes.map(pass => `lowering(pass=${JSON.stringify(pass)})`).join(", ")}, expansion(expansion=exp:"\\ud800.expansion\\n")])`;
  const local = { id: 0, storage: 0, role: { kind: "user" }, source: { body: bodyIdentity, local: 2 }, origin: exactOrigin };
  roundtrip({ ...emptyValue, locals: [local] }, document(`MirLocal(id=l:0, storage=t:0, role=user(), source=LocalRef(body=body:${JSON.stringify(bodyIdentity)}, local=l:2), origin=${exactText})`, "", "", ""), "all origin derivations and unnormalized range");
});

const returnNodeText = `NodeRef(body=body:${JSON.stringify(bodyIdentity)}, node=n:1)`;
const returnSiteText = `origin=${originText}, tir=${returnNodeText}`;
const simpleBlockText = `MirBlock(${siteText}, id=b:0, statements=[], terminator=return(${returnSiteText}, value=null))`;

function parsedBody(text = document("", "", "", simpleBlockText, undefined, undefined, entryText)) {
  const parsed = product.parseMir(text);
  assert.equal(parsed.kind, "parsed", "independently authored verifier input has its real public typed construction");
  return parsed.value;
}

function sourceContext(body = parsedBody()) {
  const decoded = identities.decodeBodyId(body.body);
  assert.equal(decoded.kind, "decoded");
  const owner = decoded.value.owner;
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: body.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const root = { ...header(0, null), kind: "Block", statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] }, multiLine: false, tsonic: null };
  const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  const source = { body: body.body, owner, bindings: { kind: "parametric" }, lexicalBindings: bindingVector,
    dependence: "parametric", signature: identities.sigId(0), completion: identities.tyId(0), yielded: null, sent: null,
    params: [], locals: [], root, nestedBodies: [], captures: [], scopes: [{ node: identities.nodeId(0), parent: null, attributes: [] }],
    evidence: [], asynchronous: false, generator: false };
  const types = { terms: [{ kind: "intrinsic", intrinsic: "void" }, { kind: "primitive", primitive: "bool" },
    { kind: "string" }, { kind: "primitive", primitive: "int32" }, { kind: "intrinsic", intrinsic: "unknown" }],
  signatures: [{ id: identities.sigId(0), declaration: owner, owner: { kind: "body", value: { body: body.body, node: identities.nodeId(0) } },
    composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: identities.tyId(0) }] };
  const declarations = new Map([[owner, { scope, parameterCount: 0, endpoints: [
    { declaration: owner, role: "api-body", signature: identities.sigId(0), body: body.body },
  ] }]]);
  const declarationOf = definition => {
    assert.equal(declarations.has(definition), true, `no undeclared MIR declaration lookup: ${definition}`);
    return declarations.get(definition);
  };
  const bodyOwners = new Map([[body.body, owner]]);
  const bodyOwner = identity => {
    assert.equal(bodyOwners.has(identity), true, `no undeclared MIR body-owner lookup: ${identity}`);
    return bodyOwners.get(identity);
  };
  return { limits: verificationLimits, source, types, declarationOf, declarations, bodyOwner, bodyOwners };
}

/** The findings of a verification that ran to its end. A refusal for resources is not a list of findings and fails the case. */
function verified(body, context) {
  const outcome = product.verifyMir(body, context);
  assert.equal(outcome.kind, "complete", "the body was verified to the end, not refused for resources");
  return outcome.violations;
}
const verificationLimits = { maximumWork: 1000000 };

function expectedViolation(rule, site, detail = []) {
  return { rule, site: { body: bodyIdentity, ...site }, detail };
}

test("real source TIR return body verifies straight-line, diamond, loop and unreachable blocks without lowering again", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  same(verified(body, context), [], "complete straight-line violation vector");
  const sharedReturn = context.source.root.statements.nodes[0];
  same(verified(body, { ...context, source: { ...context.source, root: { ...context.source.root,
    statements: { ...context.source.root.statements, nodes: [sharedReturn, sharedReturn] },
  } } }), [], "a shared physical syntax node is inventoried once without duplicating its selected evidence");
  const other = identities.encodeBodyId({ owner: context.source.owner, role: "function", ordinal: 1 });
  same(verified({ ...body, blocks: [{ ...body.blocks[0], terminator: {
    ...body.blocks[0].terminator, tir: { body: other, node: identities.nodeId(1) },
  } }] }, context), [expectedViolation("cross-owner-qualified", { kind: "instruction", block: 0, statement: null })],
    "a physical terminator cannot borrow a same-number source node from another body");
  const block = body.blocks[0];
  const next = id => ({ ...block, id: identities.blockId(id) });
  const diamond = { ...body, blocks: [
    { ...block, terminator: { ...block.terminator, kind: "switch", step: null, operand: { kind: "constant", constant: identities.constId(0) },
      targets: [{ constant: identities.constId(0), target: identities.blockId(1) }], otherwise: identities.blockId(2) } },
    { ...next(1), terminator: { ...block.terminator, kind: "goto", target: identities.blockId(3) } },
    { ...next(2), terminator: { ...block.terminator, kind: "goto", target: identities.blockId(3) } }, next(3),
  ], constants: [{ id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } }] };
  same(verified(diamond, context), [], "complete diamond violation vector");
  const loop = { ...body, blocks: [{ ...block, terminator: { ...block.terminator, kind: "goto", target: identities.blockId(0) } }, next(1)] };
  same(verified(loop, context), [], "complete loop and unreachable-block violation vector");
});

for (const [name, change, expected] of [
  ["entry-block-zero", body => ({ ...body, blocks: [] }),
    [expectedViolation("entry-block-zero", { kind: "body" }), expectedViolation("entries-exact", { kind: "body" })]],
  ["local-id-dense", body => ({ ...body, locals: [{ id: identities.localId(1), storage: identities.tyId(0), role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin }] }),
    [expectedViolation("local-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }])]],
  ["constant-id-dense", body => ({ ...body, constants: [{ id: identities.constId(1), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } }] }),
    [expectedViolation("constant-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }])]],
  ["place-id-dense", body => ({ ...body, places: [{ id: identities.placeId(1), storage: identities.tyId(0), origin: body.blocks[0].origin,
    base: { kind: "static", definition: identities.decodeBodyId(body.body).value.owner } }] }),
    [expectedViolation("place-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }])]],
  ["block-id-dense", body => ({ ...body, blocks: [{ ...body.blocks[0], id: identities.blockId(1) }] }),
    [expectedViolation("block-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }]), expectedViolation("entry-block-zero", { kind: "body" })]],
  ["place-root-resolves", body => ({ ...body, places: [{ id: identities.placeId(0), storage: identities.tyId(0), origin: body.blocks[0].origin,
    base: { kind: "local", local: identities.localId(9) } }] }), [expectedViolation("place-root-resolves", { kind: "place", place: 0 })]],
  ["place-parent-precedes", body => ({ ...body, places: [{ id: identities.placeId(0), storage: identities.tyId(0), origin: body.blocks[0].origin,
    base: { kind: "place", place: identities.placeId(0), projection: { kind: "deref" }, tir: nodeRef } }] }), [expectedViolation("place-parent-precedes", { kind: "place", place: 0 })]],
  ["origin-valid", body => ({ ...body, locals: [{ id: identities.localId(0), storage: identities.tyId(0), role: { kind: "temporary" }, source: null,
    origin: { ...body.blocks[0].origin, start: -1 } }] }), [expectedViolation("origin-valid", { kind: "local", local: 0 })]],
  ["tir-node-resolves", body => ({ ...body, blocks: [{ ...body.blocks[0], tir: { body: body.body, node: identities.nodeId(99) } }] }),
    [expectedViolation("tir-node-resolves", { kind: "block", block: 0 })]],
  ["operand-resolves", body => ({ ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator,
    value: { kind: "constant", constant: identities.constId(9) } } }] }), [expectedViolation("operand-resolves", { kind: "instruction", block: 0, statement: null })]],
  ["edge-target-resolves", body => ({ ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator,
    kind: "goto", target: identities.blockId(99) } }] }), [expectedViolation("edge-target-resolves", { kind: "instruction", block: 0, statement: null },
    [{ kind: "text", value: "normal" }, { kind: "number", value: 99 }])]],
  ["completion-selector-total", body => ({ ...body, locals: [{ id: identities.localId(0), storage: identities.tyId(1), role: { kind: "completion" }, source: null, origin: body.blocks[0].origin }] }),
    [expectedViolation("completion-selector-total", { kind: "local", local: 0 })]],
]) {
  test(`MIR rule ${name} has an independently authored complete valid/opposite vector`, () => {
    const body = parsedBody();
    const context = sourceContext(body);
    same(verified(body, context), [], `${name}: coherent valid vector`);
    same(verified(change(body), context), expected, `${name}: complete minimal invalid vector`);
  });
}

test("MIR sparse public row inventories retain each original position and complete later reference findings", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  same(verified(body, context), [], "all four complete empty row inventories are valid");
  for (const [field, rule] of [["locals", "local-id-dense"], ["constants", "constant-id-dense"], ["places", "place-id-dense"], ["blocks", "block-id-dense"]]) {
    const expected = [expectedViolation(rule, { kind: "body" }, [{ kind: "number", value: 0 }])];
    if (field === "blocks") expected.push(expectedViolation("entry-block-zero", { kind: "body" }));
    same(verified({ ...body, [field]: new Array(1) }, context), expected, `${field} keeps the actual missing slot`);
  }
  const child = { id: identities.placeId(1), storage: identities.tyId(0), origin: body.blocks[0].origin,
    base: { kind: "place", place: identities.placeId(0), projection: { kind: "deref" }, tir: nodeRef } };
  const places = new Array(2);
  places[1] = child;
  same(verified({ ...body, places }, context), [
    expectedViolation("place-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }]),
    expectedViolation("place-root-resolves", { kind: "place", place: 1 }),
  ], "a later actual projection reports its missing parent without repairing or compacting the row");
});

test("MIR origins validate exact finite spans at every physical site without repairing negative zero or overflow", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const origin = body.blocks[0].origin;
  const local = { id: identities.localId(0), storage: identities.tyId(0), role: { kind: "temporary" }, source: null, origin };
  for (const field of ["start", "length"]) for (const value of [-0, -1, 0.5, NaN, Infinity, -Infinity]) {
    same(verified({ ...body, locals: [{ ...local, origin: { ...origin, [field]: value } }] }, context),
      [expectedViolation("origin-valid", { kind: "local", local: 0 })], `complete invalid ${field}=${String(value)} local span`);
  }
  const overflow = { ...origin, start: Number.MAX_SAFE_INTEGER, length: 1 };
  same(verified({ ...body, locals: [{ ...local, origin: overflow }] }, context),
    [expectedViolation("origin-valid", { kind: "local", local: 0 })], "individually safe coordinates cannot overflow their complete span");
  const invalid = { ...origin, length: -1 };
  const place = { id: identities.placeId(0), storage: identities.tyId(0), base: { kind: "static", definition: context.source.owner }, origin: invalid };
  same(verified({ ...body, places: [place] }, context), [expectedViolation("origin-valid", { kind: "place", place: 0 })], "complete invalid place-origin vector");
  same(verified({ ...body, blocks: [{ ...body.blocks[0], origin: invalid }] }, context),
    [expectedViolation("origin-valid", { kind: "block", block: 0 })], "complete invalid block-origin vector");
  const statement = { ...site, origin: invalid, kind: "storage-live", local: local.id };
  same(verified({ ...body, locals: [local], blocks: [{ ...body.blocks[0], statements: [statement] }] }, context),
    [expectedViolation("origin-valid", { kind: "instruction", block: 0, statement: 0 })], "complete invalid statement-origin vector");
  same(verified({ ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, origin: invalid } }] }, context),
    [expectedViolation("origin-valid", { kind: "instruction", block: 0, statement: null })], "complete invalid terminator-origin vector");
  const foreign = identities.encodeModuleId({ package: identities.encodePackageId("p"), path: "foreign" });
  same(verified({ ...body, blocks: [{ ...body.blocks[0], origin: { ...origin, module: foreign } }] }, context),
    [expectedViolation("origin-valid", { kind: "block", block: 0 })], "existing source-node correlation cannot borrow a different module span");
});

test("MIR receiver checks cannot silently accept an unresolved source-frame signature", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  same(verified(body, context), [], "the actual supplied source signature exists");
  same(verified(body, { ...context, types: { ...context.types, signatures: [] } }),
    [expectedViolation("type-resolves", { kind: "body" }, [{ kind: "number", value: 0 }])],
    "missing signature data is an unresolved reference, not a receiver-check waiver");
  for (const value of [-0, -1, 0.5, NaN, Infinity, 99]) same(verified(body, { ...context,
    source: { ...context.source, signature: identities.sigId(value) } }),
  [expectedViolation("type-resolves", { kind: "body" }, [{ kind: "number", value }])],
  "the nominal signature constructor admits numbers; a frame lookup requires the exact canonical arena domain");
  same(verified(body, { ...context, types: { ...context.types, signatures: [{ ...context.types.signatures[0], id: identities.sigId(1) }] } }),
    [expectedViolation("type-resolves", { kind: "body" }, [{ kind: "number", value: 0 }])],
    "a differently identified row cannot impersonate the requested signature");
});

test("MIR type resolution and closure distinguish unknown IDs, open terms and transitive signature references", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const local = { id: identities.localId(0), storage: identities.tyId(99), role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin };
  same(verified({ ...body, locals: [local] }, context), [expectedViolation("type-resolves", { kind: "local", local: 0 }, [{ kind: "number", value: 99 }])], "missing type complete vector");
  const open = { ...context, types: { ...context.types, terms: [...context.types.terms, { kind: "open", group: identities.encodeGroupId([body.body]), variable: 0 }] } };
  same(verified({ ...body, locals: [{ ...local, storage: identities.tyId(5) }] }, open),
    [expectedViolation("type-closed", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }])], "open type complete vector");
  const signature = { ...context.types.signatures[0], result: identities.tyId(99) };
  const recursive = { ...context, types: { terms: [...context.types.terms, { kind: "callable", calls: [identities.sigId(0)], constructs: [] }], signatures: [signature] } };
  same(verified({ ...body, locals: [{ ...local, storage: identities.tyId(5) }] }, recursive),
    [expectedViolation("type-resolves", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }])], "transitive callable signature failure full vector");
});

test("borrowed signature parameter holes report the complete unresolved reference instead of throwing", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const owner = context.source.owner;
  const local = { id: identities.localId(0), storage: identities.tyId(5),
    role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin };
  const parameters = [0, 1].map(() => ({ declaration: owner, kind: "required",
    type: identities.tyId(1), passing: "by-value", initializer: null }));
  const typeParameters = [0, 1].map(index => ({ identity: { owner, index }, declaration: owner,
    constraint: null, default: null }));
  const signature = { ...context.types.signatures[0], id: identities.sigId(1), parameters, typeParameters };
  const verify = selected => verified({ ...body, locals: [local] }, {
    ...context, types: { terms: [...context.types.terms,
      { kind: "callable", calls: [identities.sigId(1)], constructs: [identities.sigId(1)] }],
    signatures: [context.types.signatures[0], selected] },
  });
  same(verify(signature), [], "complete dense opposite");
  for (const reference of [-1, -0, 99]) {
    const input = { ...body, locals: [local] };
    same(verified(input, { ...context, types: { terms: [...context.types.terms,
      { kind: "callable", calls: [identities.sigId(reference)], constructs: [] }], signatures: context.types.signatures } }),
      [expectedViolation("type-resolves", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }])],
      "a callable's actual missing or nonordinal signature cannot disappear from its transitive closure");
  }
  for (const field of ["parameters", "typeParameters"])
    for (const holes of [[0], [1], [0, 1]]) {
      const borrowed = signature[field].slice();
      for (const index of holes) delete borrowed[index];
      same(verify({ ...signature, [field]: borrowed }), [
        expectedViolation("type-resolves", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }]),
      ], field + "/" + holes.join(","));
    }
});

test("MIR type closure walks every declared term relation and all signature child families exactly once", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const owner = context.source.owner;
  const reference = { kind: "body", value: { body: body.body, node: identities.nodeId(0) } };
  const parameter = { owner, index: 0 };
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin };
  const memberRow = { key: { kind: "text", value: "x" }, origins: [], readOrigins: [], writeOrigins: [], kind: "property",
    read: identities.tyId(1), write: identities.tyId(1), optional: false, readonly: false };
  const shapes = [
    { kind: "primitive", primitive: "int32" }, { kind: "string" }, { kind: "intrinsic", intrinsic: "unknown" },
    { kind: "literal", value: { kind: "boolean", value: true }, base: identities.tyId(1) },
    { kind: "union", members: [identities.tyId(1), identities.tyId(2)] },
    { kind: "intersection", members: [identities.tyId(1), identities.tyId(2)] },
    { kind: "optional", value: identities.tyId(1) }, { kind: "array", element: identities.tyId(1), readonly: true },
    { kind: "fixed-array", element: identities.tyId(1), extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
    { kind: "tuple", elements: [{ kind: "required", type: identities.tyId(1), declaration: null }], readonly: false },
    { kind: "shape", members: [memberRow, { ...memberRow, key: { kind: "text", value: "readOnly" }, write: null },
      { ...memberRow, key: { kind: "text", value: "writeOnly" }, read: null }],
      indexes: [{ declaration: owner, key: identities.tyId(2), read: identities.tyId(1), write: identities.tyId(1), readonly: false },
        { declaration: owner, key: identities.tyId(2), read: identities.tyId(1), write: null, readonly: true }], calls: [identities.sigId(1)], constructs: [identities.sigId(2)] },
    { kind: "callable", calls: [identities.sigId(1)], constructs: [identities.sigId(2)] },
    { kind: "declared", definition: owner, arguments: [identities.tyId(1)], facet: "instance", extent: null },
    { kind: "construction-reference", definition: { occurrence: { body: body.body, node: identities.nodeId(0) }, captures: [] }, arguments: [identities.tyId(1)] },
    { kind: "enum", definition: owner }, { kind: "param", parameter }, { kind: "self", owner },
    { kind: "projection", source: identities.tyId(1), projection: { kind: "awaited" } },
    { kind: "projection", source: identities.tyId(1), projection: { kind: "component", component: { root: reference, path: [
      { kind: "sum-arm", family: { origin: "inferred", component: { root: reference, path: [] }, parameters: [],
        roles: [{ authoredIndex: 0, component: reference, member: identities.tyId(1) }] }, index: 0 },
      { kind: "parameter", signature: identities.sigId(1), index: 0 }, { kind: "receiver", signature: identities.sigId(1) },
      { kind: "signature-tail", signature: identities.sigId(1), start: 0, readonly: true }, { kind: "result", signature: identities.sigId(1) },
      { kind: "class-value" },
    ] } } },
  ];
  const signature = { ...context.types.signatures[0], id: identities.sigId(1), receiver: identities.tyId(1),
    parameters: [{ declaration: owner, kind: "required", type: identities.tyId(2), passing: "by-value", initializer: null }],
    typeParameters: [{ identity: parameter, declaration: owner, constraint: identities.tyId(1), default: identities.tyId(2) }],
    composition: { kind: "union", signatures: [identities.sigId(0)] } };
  const construct = { ...signature, id: identities.sigId(2), kind: "construct", receiver: null,
    typeParameters: [{ ...signature.typeParameters[0], constraint: null, default: null }], composition: null };
  for (const term of shapes) {
    const input = { ...context, types: { terms: [...context.types.terms, term], signatures: [...context.types.signatures, signature, construct] } };
    same(verified({ ...body, locals: [local] }, input), [], `complete type/signature closure for ${term.kind}`);
  }
  const broken = { ...context, types: { ...context.types, terms: [...context.types.terms,
    { kind: "union", members: [identities.tyId(6), identities.tyId(99)] }, { kind: "open", group: identities.encodeGroupId([body.body]), variable: 0 }] } };
  same(verified({ ...body, locals: [local] }, broken), [
    expectedViolation("type-resolves", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }]),
    expectedViolation("type-closed", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }]),
  ], "both independent flags propagate through the same root without suppressing one another");
  const error = { ...context, types: { ...context.types, terms: [...context.types.terms, { kind: "error" }] } };
  same(verified({ ...body, locals: [local] }, error), [expectedViolation("type-closed", { kind: "local", local: 0 }, [{ kind: "number", value: 5 }])], "error term is not a closed executable type");
});

test("MIR literal constant types compare every exact declared value family without authored-token normalization", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const other = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "symbol", ordinal: 0 }] });
  context.declarations.set(other, { scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] },
    parameterCount: 0, endpoints: [] });
  const rational = { kind: "number", token: "0.5", value: { numerator: 1n, denominator: 2n, negativeZero: false } };
  const negativeZero = { kind: "number", token: "-0", value: { numerator: 0n, denominator: 1n, negativeZero: true } };
  const values = [
    [{ kind: "primitive", primitive: "float64" }, rational, [
      { kind: "number", token: "1.5", value: { numerator: 3n, denominator: 2n, negativeZero: false } },
      { kind: "number", token: "0.25", value: { numerator: 1n, denominator: 4n, negativeZero: false } },
    ]],
    [{ kind: "primitive", primitive: "float64" }, negativeZero, [
      { kind: "number", token: "0", value: { numerator: 0n, denominator: 1n, negativeZero: false } },
    ]],
    [{ kind: "intrinsic", intrinsic: "bigint" }, { kind: "bigint", token: "9007199254740993n", value: 9007199254740993n },
      [{ kind: "bigint", token: "9007199254740994n", value: 9007199254740994n }]],
    [{ kind: "string" }, { kind: "string", value: "\ud800x" }, [{ kind: "string", value: "\ud800y" }]],
    [{ kind: "primitive", primitive: "bool" }, { kind: "boolean", value: true }, [{ kind: "boolean", value: false }]],
    [{ kind: "intrinsic", intrinsic: "absence" }, { kind: "absence" }, []],
    [{ kind: "intrinsic", intrinsic: "symbol" }, { kind: "unique-symbol", declaration: context.source.owner },
      [{ kind: "unique-symbol", declaration: other }]],
  ];
  for (const [base, value, opposites] of values) {
    const literal = value.kind === "number" ? { kind: "number", value: value.value }
      : value.kind === "bigint" ? { kind: "bigint", value: value.value } : value;
    const input = { ...context, types: { ...context.types, terms: [...context.types.terms, base,
      { kind: "literal", base: identities.tyId(5), value: literal }] } };
    const constant = selected => ({ ...body, constants: [{ id: identities.constId(0), type: identities.tyId(6),
      value: { kind: "literal", value: selected } }] });
    same(verified(constant(value), input), [], `exact ${value.kind} literal type matches its complete value`);
    if (value === rational) same(verified(constant({ ...value, token: "0.50" }), input), [],
      "literal type has no authored token; equal exact rational with distinct spelling still agrees");
    if (value.kind === "bigint") same(verified(constant({ ...value, token: "0x20000000000001n" }), input), [],
      "literal type has no authored bigint token; constant uniqueness still uses the separate full record");
    const differentKind = value.kind === "string" ? { kind: "boolean", value: true } : { kind: "string", value: "wrong" };
    for (const opposite of [differentKind, ...opposites]) same(verified(constant(opposite), input),
      [expectedViolation("constant-type", { kind: "constant", constant: 0 })], `complete ${value.kind} literal mismatch vector`);
  }
});

test("MIR duplicate constants and canonical storage projections produce only their complete owned vectors", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const first = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
  same(verified({ ...body, constants: [first] }, context), [], "one constant valid");
  same(verified({ ...body, constants: [first, { ...first, id: identities.constId(1) }] }, context),
    [expectedViolation("constant-unique", { kind: "constant", constant: 1 })], "duplicate semantic record complete vector");
  const local = { id: identities.localId(0), storage: identities.tyId(0), role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: identities.tyId(1), base: { kind: "local", local: local.id }, origin: local.origin };
  same(verified({ ...body, locals: [local], places: [place] }, context),
    [expectedViolation("projection-type", { kind: "place", place: 0 })], "local place storage mismatch full vector");
  const root = { ...place, storage: identities.tyId(0) };
  const child = { ...root, id: identities.placeId(1), base: { kind: "place", place: root.id, projection: { kind: "element", index: 0 }, tir: nodeRef } };
  same(verified({ ...body, locals: [local], places: [root, child] }, context),
    [expectedViolation("projection-valid", { kind: "place", place: 1 })], "nonaggregate element full vector");
});

test("MIR projection types use only declared local, array and tuple storage without external carrier inference", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null,
    origin: body.blocks[0].origin };
  const root = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(3), value: { kind: "literal", value: {
    kind: "number", token: "0", value: { numerator: 0n, denominator: 1n, negativeZero: false } } } };
  const child = projection => ({ id: identities.placeId(1), storage: identities.tyId(1),
    base: { kind: "place", place: root.id, projection, tir: nodeRef }, origin: local.origin });
  for (const term of [
    { kind: "array", element: identities.tyId(1), readonly: false },
    { kind: "fixed-array", element: identities.tyId(1), extent: { length: 2n, runtimeBase: "bigint" } },
    { kind: "tuple", readonly: false, elements: [{ kind: "required", type: identities.tyId(1), declaration: null }] },
  ]) {
    const input = { ...context, types: { ...context.types, terms: [...context.types.terms, term] } };
    const place = child({ kind: "element", index: 0 });
    const value = { ...body, locals: [local], constants: [constant], places: [root, place] };
    same(verified(value, input), [], `actual ${term.kind} element storage matches`);
    same(verified({ ...value, places: [root, { ...place, storage: identities.tyId(3) }] }, input),
      [expectedViolation("projection-type", { kind: "place", place: 1 })], `actual ${term.kind} element storage opposite`);
    for (const index of [-0, -1, 0.5, NaN, Infinity, ...(term.kind === "array" ? [] : [99])]) {
      same(verified({ ...value, places: [root, child({ kind: "element", index })] }, input),
        [expectedViolation("projection-valid", { kind: "place", place: 1 })], `invalid ${term.kind} element position is not an alias`);
    }
    if (term.kind !== "tuple") {
      const indexed = { ...value, places: [root, child({ kind: "index", operand: { kind: "constant", constant: constant.id } })] };
      same(verified(indexed, input), [], `actual ${term.kind} index storage matches`);
      same(verified({ ...indexed, places: [root, { ...indexed.places[1], storage: identities.tyId(3) }] }, input),
        [expectedViolation("projection-type", { kind: "place", place: 1 })], `actual ${term.kind} index storage opposite`);
    }
  }
  const input = { ...context, source: { ...context.source, captures: [{ body: body.body, local: identities.localId(3) }] },
    types: { ...context.types, terms: [...context.types.terms, { kind: "array", element: identities.tyId(1), readonly: false }] } };
  const field = { ...member, decision: { ...member.decision, read: identities.tyId(1), write: identities.tyId(2) } };
  for (const projection of [{ kind: "field", member: field }, { kind: "deref" }, { kind: "capture", index: 0 }]) {
    const projected = { ...child(projection), storage: identities.tyId(3) };
    same(verified({ ...body, locals: [local], places: [root, projected] }, input), [],
      `${projection.kind} retains reference validation but does not infer a missing canonical storage view`);
  }
  const invalidCapture = child({ kind: "capture", index: 1 });
  same(verified({ ...body, locals: [local], places: [root, invalidCapture] }, input),
    [expectedViolation("capture-location-exact", { kind: "place", place: 1 })], "capture index remains an actual reference obligation");
  const missingIndex = child({ kind: "index", operand: { kind: "constant", constant: identities.constId(99) } });
  same(verified({ ...body, locals: [local], places: [root, missingIndex] }, input),
    [expectedViolation("operand-resolves", { kind: "place", place: 1 })],
    "an absent actual index operand remains distinct from the valid array storage relation");
  const scalarLocal = { ...local, storage: identities.tyId(3) };
  const scalarRoot = { ...root, storage: identities.tyId(3) };
  const scalarIndex = { ...child({ kind: "index", operand: { kind: "constant", constant: constant.id } }), storage: identities.tyId(3) };
  same(verified({ ...body, locals: [scalarLocal], constants: [constant], places: [scalarRoot, scalarIndex] }, context),
    [expectedViolation("projection-valid", { kind: "place", place: 1 })],
    "an ordinary native integer is not an array or a declared indexable record");
  const staticPlace = { ...root, storage: identities.tyId(3), base: { kind: "static", definition: context.source.owner } };
  same(verified({ ...body, places: [staticPlace] }, input), [], "static definition storage is not guessed from a signature");
});

test("MIR body and qualified source owners are checked without accepting a same-number foreign identity", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const other = identities.encodeBodyId({ owner: context.source.owner, role: "function", ordinal: 1 });
  same(verified({ ...body, body: other }, context), [{ rule: "body-owner", site: { kind: "body", body: other }, detail: [] }], "complete body owner vector");
  const local = { id: identities.localId(0), storage: identities.tyId(0), role: { kind: "user" }, source: { body: other, local: identities.localId(0) }, origin: body.blocks[0].origin };
  same(verified({ ...body, locals: [local] }, context), [expectedViolation("cross-owner-qualified", { kind: "local", local: 0 })], "complete foreign local vector");
  const block = { ...body.blocks[0], tir: { body: other, node: identities.nodeId(0) } };
  same(verified({ ...body, blocks: [block] }, context), [expectedViolation("cross-owner-qualified", { kind: "block", block: 0 })], "complete foreign node vector");
});

test("MIR body-owner readers distinguish unknown ownership, missing declarations and complete initializer bindings", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const definition = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "constant", ordinal: 0 }] });
  const initializer = identities.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "constant",
    reference: { initializer: { body: initializer, bindings: { kind: "parametric" } } } } };
  const input = { ...body, constants: [constant] };
  context.bodyOwners.set(initializer, null);
  same(verified(input, context), [expectedViolation("definition-resolves", { kind: "constant", constant: 0 })],
    "a genuine branded body can have no canonical owner without fabricating a decoder error");
  context.bodyOwners.set(initializer, definition);
  context.declarations.set(definition, null);
  same(verified(input, context), [expectedViolation("definition-resolves", { kind: "constant", constant: 0 })],
    "a known body owner still needs its actual declaration");
  const parameter = { owner: definition, index: 0 };
  context.declarations.set(definition, { scope: { classParameters: [parameter], methodParameters: [], capturedParameters: [], selfOwners: [] },
    parameterCount: 1, endpoints: [] });
  same(verified(input, context), [], "parametric initializer remains an actual parameterized body reference");
  const instantiated = bindings => ({ ...constant, value: { kind: "constant", reference: {
    initializer: { body: initializer, bindings: { kind: "instantiated", bindings } } } } });
  same(verified({ ...body, constants: [instantiated(bindingVector)] }, context),
    [expectedViolation("bindings-complete", { kind: "constant", constant: 0 })], "scope is read from the canonical owning declaration");
  const bound = { ...bindingVector, classBindings: [{ kind: "bound", parameter, type: identities.tyId(1) }] };
  same(verified({ ...body, constants: [instantiated(bound)] }, context), [], "complete genuine owner binding passes");
  let ownerReads = 0;
  let declarationReads = 0;
  const counted = { ...context, bodyOwner: selected => { ownerReads += 1; return context.bodyOwner(selected); },
    declarationOf: selected => { declarationReads += 1; return context.declarationOf(selected); } };
  const repeated = { ...body, constants: [constant, { ...constant, id: identities.constId(1), type: identities.tyId(3) }] };
  same(verified(repeated, counted), [], "same owner at distinct constant sites keeps both records");
  assert.equal(ownerReads, 1, "canonical owner read once per actual BodyId per invocation");
  assert.equal(declarationReads, 2, "only source and initializer declarations are read");
  context.bodyOwners.set(initializer, null);
  same(verified(repeated, context), [expectedViolation("definition-resolves", { kind: "constant", constant: 0 }),
    expectedViolation("definition-resolves", { kind: "constant", constant: 1 })], "memoization cannot leak across independent calls or suppress sites");
});

for (const bound of [false, true]) test(`MIR complete ${bound ? "bound" : "rigid"} artifact vectors preserve all parameter families and self ownership`, () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const parameters = [0, 1, 2, 3, 4, 5].map(index => ({ owner: context.source.owner, index }));
  const secondOwner = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "outer", ordinal: 0 }] });
  const binding = (index, type) => bound ? { kind: "bound", parameter: parameters[index], type: identities.tyId(type) }
    : { kind: "rigid", parameter: parameters[index] };
  const vector = { classBindings: [binding(0, 1), binding(1, 2)], methodBindings: [binding(2, 2), binding(3, 3)],
    capturedBindings: [binding(4, 3), binding(5, 1)], selfBindings: bound
      ? [{ kind: "bound", owner: context.source.owner, type: identities.tyId(4) }, { kind: "bound", owner: secondOwner, type: identities.tyId(1) }]
      : [{ kind: "rigid", owner: context.source.owner }, { kind: "rigid", owner: secondOwner }] };
  const bindings = { kind: "instantiated", bindings: vector };
  const scope = { classParameters: [parameters[0], parameters[1]], methodParameters: [parameters[2], parameters[3]],
    capturedParameters: [parameters[4], parameters[5]], selfOwners: [context.source.owner, secondOwner] };
  context.declarations.set(context.source.owner, { ...context.declarations.get(context.source.owner), scope, parameterCount: 6 });
  const input = { ...context, source: { ...context.source, bindings, lexicalBindings: vector, dependence: "binding-dependent" } };
  same(verified({ ...body, bindings }, input), [], "complete original scope and all declared binding families agree");
  for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const wrong = { ...body, bindings: { kind: "instantiated", bindings: { ...vector, [family]: [] } } };
    same(verified(wrong, input), [expectedViolation("bindings-complete", { kind: "body" }),
      expectedViolation("bindings-complete", { kind: "body" })], "source-instance equality and exact declaration scope remain independent complete obligations");
    const reversed = { ...body, bindings: { kind: "instantiated", bindings: { ...vector, [family]: [...vector[family]].reverse() } } };
    same(verified(reversed, input), [expectedViolation("bindings-complete", { kind: "body" }),
      expectedViolation("bindings-complete", { kind: "body" })], "complete vectors preserve the declared parameter/self order, not just membership");
    const sparse = { ...body, bindings: { kind: "instantiated", bindings: { ...vector, [family]: new Array(vector[family].length) } } };
    same(verified(sparse, input), [expectedViolation("bindings-complete", { kind: "body" }),
      expectedViolation("bindings-complete", { kind: "body" })], "a genuine sparse binding vector has neither an encoded instance nor a complete declaration scope");
  }
  const misplaced = { ...vector, classBindings: [{ ...vector.classBindings[0], parameter: parameters[1] }, vector.classBindings[1]] };
  same(verified({ ...body, bindings: { kind: "instantiated", bindings: misplaced } }, input),
    [expectedViolation("bindings-complete", { kind: "body" }), expectedViolation("bindings-complete", { kind: "body" })],
    "same owner with a different parameter position cannot alias the required slot");
});

test("MIR the supplied source owner and every literal or symbolic constant retain actual declaration absence", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  same(verified(body, context), [], "the actual source owner resolves before any constant is introduced");
  const missingOwner = sourceContext(body);
  missingOwner.declarations.set(missingOwner.source.owner, null);
  same(verified(body, missingOwner), [expectedViolation("definition-resolves", { kind: "body" })],
    "the actual missing source declaration is not reconstructed from the supplied body spelling");
  const missing = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "missing", ordinal: 0 }] });
  context.declarations.set(missing, null);
  for (const kind of ["definition", "metadata", "unique-symbol"]) {
    const value = definition => kind === "unique-symbol" ? { kind: "literal", value: { kind, declaration: definition } }
      : { kind, definition, bindings: { kind: "parametric" } };
    const input = { ...context, types: { ...context.types, terms: [...context.types.terms, { kind: "intrinsic", intrinsic: "symbol" }] } };
    const constant = { id: identities.constId(0), type: identities.tyId(kind === "unique-symbol" ? 5 : 0), value: value(context.source.owner) };
    same(verified({ ...body, constants: [constant] }, input), [], `${kind}: the actual declaration exists`);
    same(verified({ ...body, constants: [{ ...constant, value: value(missing) }] }, input),
      [expectedViolation("definition-resolves", { kind: "constant", constant: 0 })], `${kind}: complete missing declaration outcome`);
  }
});

test("MIR metadata, definition and constant-reference records retain all four actual sparse artifact vectors", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  for (const kind of ["definition", "metadata", "constant"]) for (const family of ["classBindings", "methodBindings", "capturedBindings", "selfBindings"]) {
    const value = bindings => kind === "constant" ? { kind, reference: { initializer: { body: body.body, bindings } } }
      : { kind, definition: context.source.owner, bindings };
    const constant = { id: identities.constId(0), type: identities.tyId(0),
      value: value({ kind: "instantiated", bindings: bindingVector }) };
    same(verified({ ...body, constants: [constant] }, context), [], `${kind}/${family}: complete empty actual declaration scope`);
    const malformed = { ...constant, value: value({ kind: "instantiated", bindings: { ...bindingVector, [family]: new Array(1) } }) };
    same(verified({ ...body, constants: [malformed] }, context), [
      expectedViolation("bindings-complete", { kind: "constant", constant: 0 }),
      expectedViolation("bindings-complete", { kind: "constant", constant: 0 }),
    ], `${kind}/${family}: both artifact identity and complete declaration scope retain the missing position`);
  }
});

test("MIR declaration absence, metadata materialization and instantiated binding scope are explicit independent rules", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const missing = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "missing", ordinal: 0 }] });
  context.declarations.set(missing, null);
  const place = { id: identities.placeId(0), storage: identities.tyId(0), origin: body.blocks[0].origin, base: { kind: "static", definition: missing } };
  same(verified({ ...body, places: [place] }, context), [expectedViolation("definition-resolves", { kind: "place", place: 0 })], "complete missing declaration vector");
  const constant = { id: identities.constId(0), type: identities.tyId(0), value: { kind: "metadata", definition: context.source.owner, bindings: { kind: "parametric" } } };
  const materialized = { ...body, constants: [constant], blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator,
    value: { kind: "constant", constant: constant.id } } }] };
  same(verified({ ...body, constants: [constant] }, context), [], "metadata retained as nonexecutable record");
  same(verified(materialized, context), [], "C2970 direct metadata return is checked against facts only by Program");
  const local = { id: identities.localId(0), storage: identities.tyId(0), role: { kind: "temporary" }, source: null, origin: place.origin };
  const root = { ...place, base: { kind: "local", local: local.id } };
  const direct = { ...body, locals: [local], places: [root], constants: [constant], blocks: [{ ...body.blocks[0], statements: [
    { ...site, kind: "storage-live", local: local.id },
    { ...site, kind: "assign", step: null, place: root.id, value: { kind: "use", operand: { kind: "constant", constant: constant.id } } },
  ] }] };
  same(verified(direct, context), [], "direct metadata assignment retains ordinary physical type checking");
  const indexed = { ...body, constants: [constant], places: [
    { ...root, storage: identities.tyId(5), base: { kind: "static", definition: context.source.owner } },
    { ...root, id: identities.placeId(1), base: { kind: "place", place: root.id,
      projection: { kind: "index", operand: { kind: "constant", constant: constant.id } }, tir: nodeRef } },
  ] };
  const indexContext = { ...context, types: { ...context.types, terms: [...context.types.terms,
    { kind: "array", element: identities.tyId(0), readonly: false }] } };
  same(verified(indexed, indexContext), [expectedViolation("metadata-constant-not-materialised", { kind: "place", place: 1 })],
    "the same metadata constant remains forbidden in an actual runtime index");
  const ordinaryIndex = { ...indexed, constants: [{ ...constant, type: identities.tyId(3), value: { kind: "literal", value: {
    kind: "number", token: "0", value: { numerator: 0n, denominator: 1n, negativeZero: false },
  } } }] };
  same(verified(ordinaryIndex, indexContext), [], "ordinary resolved index is the complete opposite");
  const missingIndex = { ...indexed, places: [indexed.places[0], { ...indexed.places[1], base: { ...indexed.places[1].base,
    projection: { kind: "index", operand: { kind: "constant", constant: identities.constId(99) } },
  } }] };
  same(verified(missingIndex, indexContext), [expectedViolation("operand-resolves", { kind: "place", place: 1 })],
    "an unresolved index is not relabelled as metadata materialization");
  const instantiated = { kind: "instantiated", bindings: bindingVector };
  same(verified({ ...body, bindings: instantiated }, context), [expectedViolation("bindings-complete", { kind: "body" })], "artifact binding kind mismatch complete vector");
  const scope = { classParameters: [{ owner: context.source.owner, index: 0 }], methodParameters: [], capturedParameters: [], selfOwners: [] };
  context.declarations.set(context.source.owner, { scope, parameterCount: 0, endpoints: [] });
  const scoped = { ...context, source: { ...context.source, bindings: instantiated } };
  same(verified({ ...body, bindings: instantiated }, scoped), [expectedViolation("bindings-complete", { kind: "body" })], "missing exact required class binding complete vector");
});

function lifetimeBody(body, statements) {
  const local = { id: identities.localId(0), storage: identities.tyId(1), role: { kind: "temporary" }, source: null, origin: body.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  return { ...body, locals: [local], places: [place], blocks: [{ ...body.blocks[0], statements: statements(body.blocks[0], local, place) }] };
}

test("MIR observation constants retain exact source references and their complete uniqueness key", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const value = { kind: "observation", at: { body: body.body, node: identities.nodeId(0) } };
  const constant = { id: identities.constId(0), type: identities.tyId(0), value };
  same(verified({ ...body, constants: [constant] }, context), [], "the genuine root observation is a complete valid opposite");
  same(verified({ ...body, constants: [constant, { ...constant, id: identities.constId(1) }] }, context),
    [expectedViolation("constant-unique", { kind: "constant", constant: 1 })],
    "two actual records at the same qualified observation retain their complete duplicate finding");
  same(verified({ ...body, constants: [{ ...constant,
    value: { ...value, at: { ...value.at, node: identities.nodeId(99) } } }] }, context),
    [expectedViolation("tir-node-resolves", { kind: "constant", constant: 0 })],
    "a source reference is not resolved merely because its body is correct");
});

test("MIR ordinary constants retain unresolved and sparse supplied type-table references", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const constant = type => ({ id: identities.constId(0), type,
    value: { kind: "literal", value: { kind: "boolean", value: true } } });
  for (const type of [identities.tyId(99), identities.tyId(5)]) {
    const terms = context.types.terms.slice();
    terms.length = 6;
    same(verified({ ...body, constants: [constant(type)] }, { ...context,
      types: { ...context.types, terms } }),
    [expectedViolation("type-resolves", { kind: "constant", constant: 0 }, [{ kind: "number", value: type }])],
    "a missing constant carrier remains a complete source-owned reference finding");
  }
});

test("MIR storage lifetime checks all predecessor paths, dead transitions and repeated exact queries", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const use = (block, place) => ({ origin: block.origin, tir: block.tir, kind: "assign", step: null, place: place.id, value: { kind: "use", operand: { kind: "place", place: place.id } } });
  const invalid = lifetimeBody(base, (block, _local, place) => [use(block, place)]);
  same(verified(invalid, context), [expectedViolation("storage-live-before-use", { kind: "instruction", block: 0, statement: 0 }, [{ kind: "number", value: 0 }])], "entry storage absent complete vector");
  const live = lifetimeBody(base, (block, local, place) => [{ origin: block.origin, tir: block.tir, kind: "storage-live", local: local.id }, use(block, place)]);
  same(verified(live, context), [], "live then use valid");
  const dead = { ...live, blocks: [{ ...live.blocks[0], statements: [...live.blocks[0].statements,
    { ...live.blocks[0].statements[0], kind: "storage-dead" }, use(live.blocks[0], live.places[0])] }] };
  same(verified(dead, context), [expectedViolation("storage-live-before-use", { kind: "instruction", block: 0, statement: 3 }, [{ kind: "number", value: 0 }])], "dead then use complete vector");
  const diamond = { ...invalid, constants: [{ id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: false } } }], blocks: [
    { ...base.blocks[0], terminator: { ...base.blocks[0].terminator, kind: "switch", step: null, operand: { kind: "constant", constant: identities.constId(0) },
      targets: [{ constant: identities.constId(0), target: identities.blockId(1) }], otherwise: identities.blockId(2) } },
    { ...base.blocks[0], id: identities.blockId(1), statements: [live.blocks[0].statements[0]], terminator: { ...base.blocks[0].terminator, kind: "goto", target: identities.blockId(3) } },
    { ...base.blocks[0], id: identities.blockId(2), terminator: { ...base.blocks[0].terminator, kind: "goto", target: identities.blockId(3) } },
    { ...invalid.blocks[0], id: identities.blockId(3), statements: [invalid.blocks[0].statements[0], invalid.blocks[0].statements[0]] },
  ] };
  same(verified(diamond, context), [
    expectedViolation("storage-live-before-use", { kind: "instruction", block: 3, statement: 0 }, [{ kind: "number", value: 0 }]),
    expectedViolation("storage-live-before-use", { kind: "instruction", block: 3, statement: 1 }, [{ kind: "number", value: 0 }]),
  ], "one predecessor lacks live; repeated exact incoming query full vector");
  const both = { ...diamond, blocks: diamond.blocks.map(block => block.id === 2 ? { ...block, statements: [live.blocks[0].statements[0]] } : block) };
  same(verified(both, context), [], "all incoming paths live complete vector");
  const killed = { ...both, blocks: both.blocks.map(block => block.id === 2 ? { ...block, statements: [
    live.blocks[0].statements[0], { ...live.blocks[0].statements[0], kind: "storage-dead" },
  ] } : block) };
  same(verified(killed, context), [
    expectedViolation("storage-live-before-use", { kind: "instruction", block: 3, statement: 0 }, [{ kind: "number", value: 0 }]),
    expectedViolation("storage-live-before-use", { kind: "instruction", block: 3, statement: 1 }, [{ kind: "number", value: 0 }]),
  ], "a predecessor dead transition is not repaired by another live path or a repeated memo lookup");
  const loop = { ...live, blocks: [
    { ...live.blocks[0], statements: [live.blocks[0].statements[0]], terminator: { ...base.blocks[0].terminator, kind: "goto", target: identities.blockId(1) } },
    { ...live.blocks[0], id: identities.blockId(1), statements: [live.blocks[0].statements[1]],
      terminator: { ...base.blocks[0].terminator, kind: "goto", target: identities.blockId(1) } },
  ] };
  same(verified(loop, context), [], "a real live-before-loop path survives an actual predecessor cycle without recursive traversal");
  const unreachable = { ...invalid, blocks: [base.blocks[0], { ...invalid.blocks[0], id: identities.blockId(1) }] };
  same(verified(unreachable, context), [], "a genuinely unreachable block does not invent a reachable storage-lifetime failure");
  const unreachablePredecessor = { ...loop, blocks: [loop.blocks[0],
    { ...loop.blocks[1], terminator: base.blocks[0].terminator },
    { ...base.blocks[0], id: identities.blockId(2), terminator: { ...base.blocks[0].terminator, kind: "goto", target: identities.blockId(1) } },
  ] };
  same(verified(unreachablePredecessor, context), [], "an unreachable predecessor cannot invalidate the actual live incoming path");
});

test("MIR storage markers retain complete missing-local findings for nonordinal and sparse tables", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const marker = local => ({ kind: "storage-live", local, origin: body.blocks[0].origin, tir: body.blocks[0].tir });
  same(verified({ ...body, blocks: [{ ...body.blocks[0], statements: [marker(identities.localId(-1))] }] }, context),
    [expectedViolation("operand-resolves", { kind: "instruction", block: 0, statement: 0 })],
    "an out-of-domain local is not silently used as storage state");
  same(verified({ ...body, locals: new Array(1),
    blocks: [{ ...body.blocks[0], statements: [marker(identities.localId(0))] }] }, context), [
    expectedViolation("local-id-dense", { kind: "body" }, [{ kind: "number", value: 0 }]),
    expectedViolation("operand-resolves", { kind: "instruction", block: 0, statement: 0 }),
  ], "an actual sparse table retains both its density and its marker-reference findings");
});

test("MIR indexed-place lifetime includes actual index locals and never repairs an unresolved root", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const input = { ...context, types: { ...context.types, terms: [...context.types.terms,
    { kind: "array", element: identities.tyId(1), readonly: false }] } };
  const locals = [5, 3, 1].map((storage, id) => ({ id: identities.localId(id), storage: identities.tyId(storage),
    role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin }));
  const root = { id: identities.placeId(0), storage: locals[0].storage, base: { kind: "local", local: locals[0].id }, origin: locals[0].origin };
  const index = { id: identities.placeId(1), storage: locals[1].storage, base: { kind: "local", local: locals[1].id }, origin: locals[1].origin };
  const element = { id: identities.placeId(2), storage: locals[2].storage, origin: locals[2].origin,
    base: { kind: "place", place: root.id, projection: { kind: "index", operand: { kind: "place", place: index.id } }, tir: nodeRef } };
  const destination = { id: identities.placeId(3), storage: locals[2].storage, base: { kind: "local", local: locals[2].id }, origin: locals[2].origin };
  const places = [root, index, element, destination];
  const live = local => ({ ...site, kind: "storage-live", local });
  const use = { ...site, kind: "assign", step: null, place: destination.id, value: { kind: "use", operand: { kind: "place", place: element.id } } };
  // Law 4: an index is held in a local written once. The constant is the one value written into the index local.
  const zero = { id: identities.constId(0), type: locals[1].storage, value: { kind: "literal", value: {
    kind: "number", token: "0", value: { numerator: 0n, denominator: 1n, negativeZero: false } } } };
  const written = { ...site, kind: "assign", step: null, place: index.id, value: { kind: "use", operand: { kind: "constant", constant: zero.id } } };
  const body = { ...base, locals, places, constants: [zero], blocks: [{ ...base.blocks[0], statements: [live(locals[0].id), live(locals[2].id), use] }] };
  // The index local is neither begun nor written: the liveness rule and law 4 each report it.
  same(verified(body, input), [expectedViolation("storage-live-before-use", { kind: "instruction", block: 0, statement: 2 },
    [{ kind: "number", value: 1 }]), expectedViolation("index-operand-stable", { kind: "place", place: 2 })],
  "using an indexed element reads its actual index storage as well as its array root");
  const valid = { ...body, blocks: [{ ...body.blocks[0], statements: [live(locals[0].id), live(locals[1].id), live(locals[2].id), written, use, use] }] };
  same(verified(valid, input), [], "all physical dependencies live; repeated place use shares only exact query facts");
  const unresolved = { ...element, base: { ...element.base, projection: { kind: "index", operand: { kind: "place", place: identities.placeId(99) } } } };
  same(verified({ ...valid, places: [root, index, unresolved, destination] }, input),
    [expectedViolation("operand-resolves", { kind: "place", place: 2 })], "unknown index remains a reference violation, not an invented lifetime root");
  const afterChild = { ...element, base: { ...element.base, place: identities.placeId(99) } };
  same(verified({ ...valid, places: [root, index, afterChild, destination] }, input),
    [expectedViolation("place-parent-precedes", { kind: "place", place: 2 })], "unknown parent cannot manufacture a root for a used child");
  const unknownRoot = { ...root, base: { kind: "local", local: identities.localId(99) } };
  same(verified({ ...valid, places: [unknownRoot, index, element, destination] }, input),
    [expectedViolation("place-root-resolves", { kind: "place", place: 0 })], "unknown local storage remains unresolved through the child query");
  const staticRoot = { ...root, base: { kind: "static", definition: context.source.owner } };
  const staticBody = { ...valid, places: [staticRoot, index, element, destination],
    blocks: [{ ...valid.blocks[0], statements: [live(locals[1].id), live(locals[2].id), written, use] }] };
  same(verified(staticBody, input), [], "static storage has no fabricated local lifetime, while its index still does");
  const repeatedIndex = { ...element, base: { ...element.base, projection: { kind: "index", operand: { kind: "place", place: element.id } } } };
  same(verified({ ...valid, places: [root, index, repeatedIndex, destination] }, input),
    [expectedViolation("index-operand-stable", { kind: "place", place: 2 })],
    "a projected place is not an index (law 4); the repeated physical dependency is still visited once without recursive traversal");
  same(verified({ ...valid, places: [{ ...root, base: { kind: "local", local: identities.localId(-1) } }, index, element, destination] }, input),
    [expectedViolation("place-root-resolves", { kind: "place", place: 0 })], "a nonordinal physical root cannot authenticate an array projection");
});

test("MIR assignment and selected-operation correlation are independent of storage liveness", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const body = lifetimeBody(base, (block, local, place) => [
    { origin: block.origin, tir: block.tir, kind: "storage-live", local: local.id },
    { origin: block.origin, tir: block.tir, kind: "assign", step: null, place: place.id, value: { kind: "use", operand: { kind: "constant", constant: identities.constId(0) } } },
  ]);
  const constants = [{ id: identities.constId(0), type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "not a boolean" } } }];
  same(verified({ ...body, constants }, context), [expectedViolation("assignment-type", { kind: "instruction", block: 0, statement: 1 })], "string into bool complete vector");
  const selected = { decision: { kind: "selected", operation: { kind: "boolean-operator", operator: "!" }, operands: [identities.tyId(1)], result: identities.tyId(1), execution: { kind: "pure" } }, permissionScope: null };
  const mismatched = { ...body, constants: [{ ...constants[0], type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } }],
    blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], { ...body.blocks[0].statements[1], value: { kind: "unary", operation: selected, operand: { kind: "constant", constant: identities.constId(0) } } }] }] };
  same(verified(mismatched, context), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 })], "operation absent at exact source node complete vector");
});

for (const write of [false, true]) test(`MIR preserves the exact selected ${write ? "setter" : "getter"} activation without treating a member name as a callee identity`, () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const definition = name => identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name, ordinal: 0 }] });
  const propertyDefinition = definition("property");
  const getterDefinition = definition("getter");
  const setterDefinition = definition("setter");
  const parameterDefinition = definition("receiverParameter");
  const endpointFor = (declaration, signature, role) => ({ declaration, signature: identities.sigId(signature), role, body: null });
  const getterEndpoint = endpointFor(getterDefinition, 1, "api-signature");
  const setterEndpoint = endpointFor(setterDefinition, 2, "api-signature");
  const selectedDefinition = write ? setterDefinition : getterDefinition;
  const selectedSignature = write ? 2 : 1;
  const result = write ? 0 : 1;
  const activation = { decision: { candidate: 0, advertised: endpointFor(selectedDefinition, selectedSignature, "advertised"),
    api: endpointFor(selectedDefinition, selectedSignature, "api-signature"), bindings: bindingVector, implementationBindings: bindingVector,
    parameters: write ? [{ kind: "argument", parameter: 0, argument: 0, component: null, passing: "by-value" }] : [],
    completion: { signature: identities.sigId(selectedSignature), completion: identities.tyId(result), yielded: null, sent: null },
    result: identities.tyId(result) }, activation: null, captures: [] };
  const selection = { decision: { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: propertyDefinition }],
    selectedDeclarations: [propertyDefinition], primary: propertyDefinition, read: identities.tyId(1), write: identities.tyId(1),
    getter: getterEndpoint, setter: setterEndpoint, bindings: bindingVector, location: { kind: "accessor" } }, getter: write ? null : activation, setter: write ? activation : null };
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const value = type => ({ type: identities.tyId(type), convertedType: identities.tyId(type), conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } });
  const memberNode = write ? 3 : 2;
  const access = { ...header(memberNode, write ? 2 : 1), kind: "PropertyAccessExpression", questionDotToken: null,
    expression: { ...header(memberNode + 1, memberNode), kind: "Identifier", text: "receiver", tsonic: { ...value(5), role: "value",
      resolution: { kind: "local", local: { body: base.body, local: identities.localId(0) } } } },
    name: { ...header(memberNode + 2, memberNode), kind: "Identifier", text: "value", tsonic: { role: "property-name", key: { kind: "text", value: "value" } } },
    tsonic: write ? { role: "assignment-target", selection: { kind: "decided", decision: selection }, access: { kind: "write", storage: identities.tyId(1) } }
      : { ...value(1), role: "value", selection: { kind: "decided", decision: selection } } };
  const expression = write ? { ...header(2, 1), kind: "BinaryExpression", modifiers: null, left: access, type: null,
    operatorToken: { ...header(6, 2), kind: "EqualsToken", tsonic: null },
    right: { ...header(7, 2), kind: "TrueKeyword", tsonic: { ...value(1), role: "value" } },
    tsonic: { ...value(1), role: "assignment", storage: identities.tyId(1), calculation: null, selection: null } } : access;
  const returnNode = write ? 8 : 5;
  const source = { ...context.source, params: [{ local: identities.localId(0), declaration: parameterDefinition, role: "required", passing: "by-value", initializer: null, storage: identities.tyId(5) }],
    locals: [{ id: identities.localId(0), declaration: { kind: "item", value: { owner: parameterDefinition, node: identities.nodeId(0) } }, name: "receiver", role: "parameter", capturedFrom: null, mutable: false, storage: identities.tyId(5) }],
    root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
      { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
      { ...header(returnNode, 0), kind: "ReturnStatement", expression: null, tsonic: null },
    ] } } };
  const parameter = declaration => ({ declaration, kind: "required", type: identities.tyId(1), passing: "by-value", initializer: null });
  const types = { terms: [...context.types.terms, { kind: "shape", members: [{ key: selection.decision.key, origins: selection.decision.origins,
    readOrigins: selection.decision.origins, writeOrigins: selection.decision.origins, kind: "accessor", read: identities.tyId(1), write: identities.tyId(1), optional: false, readonly: false }], indexes: [], calls: [], constructs: [] }],
  signatures: [{ ...context.types.signatures[0], parameters: [{ ...parameter(parameterDefinition), type: identities.tyId(5) }] },
    { ...context.types.signatures[0], id: identities.sigId(1), declaration: getterDefinition, owner: null, receiver: identities.tyId(5), result: identities.tyId(1) },
    { ...context.types.signatures[0], id: identities.sigId(2), declaration: setterDefinition, owner: null, receiver: identities.tyId(5), parameters: [parameter(propertyDefinition)] }] };
  const emptyScope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  context.declarations.set(context.source.owner, { scope: emptyScope, parameterCount: 1, endpoints: [] });
  // Each accessor's endpoint family holds the two rows its activation selects.
  for (const [definition, count, signature] of [[getterDefinition, 0, 1], [setterDefinition, 1, 2]]) context.declarations.set(definition, {
    scope: emptyScope, parameterCount: count,
    endpoints: [endpointFor(definition, signature, "advertised"), endpointFor(definition, signature, "api-signature")] });
  const locals = [{ id: identities.localId(0), storage: identities.tyId(5), role: { kind: "parameter", index: 0 }, source: { body: base.body, local: identities.localId(0) }, origin: base.blocks[0].origin },
    { id: identities.localId(1), storage: identities.tyId(1), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin }];
  const places = locals.map((local, position) => ({ id: identities.placeId(position), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin }));
  const body = { ...base, entries: [{ provided: 1, block: identities.blockId(0) }], locals, places,
    constants: write ? [{ id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } }] : [],
    blocks: [{ ...base.blocks[0], statements: [{ ...site, kind: "storage-live", local: identities.localId(1) }], terminator: { ...site,
      tir: { body: base.body, node: identities.nodeId(memberNode) }, kind: "call", step: null, callee: { kind: "direct", resolution: activation }, receiver: { kind: "place", place: identities.placeId(0) },
      arguments: write ? [{ kind: "value", passing: "by-value", operand: { kind: "constant", constant: identities.constId(0) } }] : [],
      destination: write ? null : identities.placeId(1), next: identities.blockId(1), unwind: { kind: "escape" } } },
    { ...base.blocks[0], id: identities.blockId(1), terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(returnNode) } } }] };
  same(verified(body, { ...context, source, types }), [], "selected activation is the explicit callee, not the member's primary definition");
  context.declarations.set(propertyDefinition, { scope: emptyScope, parameterCount: null, endpoints: [] });
  const field = { id: identities.placeId(2), storage: identities.tyId(1), origin: base.blocks[0].origin,
    base: { kind: "place", place: identities.placeId(0), projection: { kind: "field", member: selection }, tir: nodeRef } };
  same(verified({ ...body, places: [...places, field] }, { ...context, source, types }), [],
    "the same selected getter or setter retains all actual endpoint and callee references in a field place");
  const wrongLocal = { ...body, locals: [{ ...locals[0], storage: identities.tyId(2) }, locals[1]] };
  same(verified(wrongLocal, { ...context, source, types }), [
    expectedViolation("projection-type", { kind: "local", local: 0 }),
    expectedViolation("projection-type", { kind: "place", place: 0 }),
  ], "one changed local storage disagrees with both its real source slot and its unchanged MIR root place");
});

test("MIR selected unary operation matches real TIR data, physical operands and exact permission scope", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const selected = { decision: { kind: "selected", operation: { kind: "boolean-operator", operator: "!" },
    operands: [identities.tyId(1)], result: identities.tyId(1), execution: { kind: "pure" } }, permissionScope: null };
  const value = { type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" } };
  const prefix = { ...header(2, 1), kind: "PrefixUnaryExpression", operator: "ExclamationToken",
    operand: { ...header(3, 2), kind: "TrueKeyword", tsonic: { ...value, role: "value" } },
    tsonic: { ...value, role: "value", operation: { kind: "decided", decision: selected } } };
  const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ExpressionStatement", expression: prefix, tsonic: null },
    { ...header(4, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } } };
  const local = { id: identities.localId(0), storage: identities.tyId(1), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
  const body = { ...base, locals: [local], places: [place], constants: [constant], blocks: [{ ...base.blocks[0], statements: [
    { ...site, kind: "storage-live", local: local.id },
    { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: place.id,
      value: { kind: "unary", operation: selected, operand: { kind: "constant", constant: constant.id } } },
  ], terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(4) } } }] };
  const input = { ...context, source };
  same(verified(body, input), [], "actual selected unary operation complete vector");
  // S2-18 replaced the `refine` value by the narrowed view of a place, which exists only under a checked base. The
  // three cases of the removed value are kept as cases of the view: its type is the one its node selected.
  const view = (storage, node) => ({ id: identities.placeId(1), storage: identities.tyId(storage), origin: local.origin,
    base: { kind: "checked", place: place.id, projection: { kind: "refined" }, tir: node } });
  const ownNode = { body: base.body, node: identities.nodeId(2) };
  same(verified({ ...body, places: [place, view(1, ownNode)] }, input), [], "a narrowed view agrees with the carrier its node selected");
  same(verified({ ...body, places: [place, view(3, ownNode)] }, input), [expectedViolation("projection-type", { kind: "place", place: 1 })],
    "a known node cannot be viewed at a different carrier");
  const wrongOperand = { ...body, constants: [{ ...constant, type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "true" } } }] };
  same(verified(wrongOperand, input), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 })], "wrong physical operand preserves exact source-decision match and emits only the type mismatch");
  for (const identity of [99, -0, NaN, 0.5, -1, Infinity]) {
    const missing = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
      ...body.blocks[0].statements[1], tir: { body: base.body, node: identities.nodeId(identity) },
    }] }] };
    same(verified(missing, input), [expectedViolation("tir-node-resolves", { kind: "instruction", block: 0, statement: 1 })],
      "unknown or noncanonical source node cannot borrow an unrelated node's decision");
  }
  const foreign = identities.encodeBodyId({ owner: context.source.owner, role: "function", ordinal: 1 });
  same(verified({ ...body, places: [place, view(3, { body: foreign, node: identities.nodeId(2) })] }, input),
    [expectedViolation("cross-owner-qualified", { kind: "place", place: 1 })],
    "the same numeric node in a different body cannot supply the carrier of a narrowed view");
  const withScope = { ...selected, permissionScope: identities.nodeId(0) };
  const scopedSource = { ...source, root: { ...source.root, statements: { ...source.root.statements, nodes: [
    { ...source.root.statements.nodes[0], expression: { ...prefix, tsonic: { ...prefix.tsonic, operation: { kind: "decided", decision: withScope } } } }, source.root.statements.nodes[1],
  ] } } };
  const scopedBody = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...body.blocks[0].statements[1].value, operation: withScope },
  }] }] };
  same(verified(scopedBody, { ...input, source: scopedSource }), [], "actual declared permission node exists");
  for (const value of [99, -0, NaN, 0.5, -1, Infinity]) {
    const unknownScope = { ...withScope, permissionScope: identities.nodeId(value) };
    const missing = { ...scopedBody, blocks: [{ ...scopedBody.blocks[0], statements: [scopedBody.blocks[0].statements[0], {
      ...scopedBody.blocks[0].statements[1], value: { ...scopedBody.blocks[0].statements[1].value, operation: unknownScope },
    }] }] };
    same(verified(missing, { ...input, source: scopedSource }), [
      expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 }),
      expectedViolation("tir-node-resolves", { kind: "instruction", block: 0, statement: 1 }),
    ], "unknown or noncanonical scope is a complete two-rule vector, never a negative-zero alias to node zero");
  }
});

test("MIR binary verifier uses both actual selected operands and its physical result", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const selected = { decision: { kind: "selected", operation: { kind: "native-operator", operator: "+", carrier: "int32" },
    operands: [identities.tyId(3), identities.tyId(3)], result: identities.tyId(3), execution: { kind: "pure" } }, permissionScope: null };
  const rational = { numerator: 1n, denominator: 1n, negativeZero: false };
  const typed = { type: identities.tyId(3), convertedType: identities.tyId(3), conversion: { kind: "identity" }, narrowing: null,
    evidenceIndex: null, demand: { kind: "always" } };
  const literal = id => ({ ...header(id, 2), kind: "NumericLiteral", text: "1", tokenFlags: [],
    tsonic: { ...typed, role: "value", value: rational } });
  const expression = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, type: null,
    left: literal(3), operatorToken: { ...header(4, 2), kind: "PlusToken", tsonic: null }, right: literal(5),
    tsonic: { ...typed, role: "arithmetic", operation: { kind: "decided", decision: selected } } };
  const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
    { ...header(6, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } } };
  const local = { id: identities.localId(0), storage: identities.tyId(3), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(3), value: { kind: "literal", value: { kind: "number", token: "1", value: rational } } };
  const operand = { kind: "constant", constant: constant.id };
  const body = { ...base, locals: [local], places: [place], constants: [constant], blocks: [{ ...base.blocks[0], statements: [
    { ...site, kind: "storage-live", local: local.id },
    { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: place.id,
      value: { kind: "binary", operation: selected, left: operand, right: operand } },
  ], terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(6) } } }] };
  const input = { ...context, source };
  const at = { kind: "instruction", block: 0, statement: 1 };
  same(verified(body, input), [], "complete selected int32 binary body");
  for (const side of ["left", "right"]) {
    const missing = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
      ...body.blocks[0].statements[1], value: { ...body.blocks[0].statements[1].value, [side]: { kind: "constant", constant: identities.constId(99) } },
    }] }] };
    same(verified(missing, input), [expectedViolation("operand-resolves", at)], `complete missing ${side} binary operand`);
  }
  const wrong = { ...body, constants: [{ ...constant, type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "1" } } }] };
  same(verified(wrong, input), [expectedViolation("operation-selected", at), expectedViolation("operation-selected", at)],
    "both physical binary operand occurrences retain their own type mismatch");
});

for (const kind of ["array", "tuple", "fixed-array"]) {
  test(`MIR ${kind} aggregate uses its actual TIR construction and declared element type`, () => {
    const base = parsedBody();
    const context = sourceContext(base);
    const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
      parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
    const part = { part: 0, source: { body: base.body, node: identities.nodeId(3) },
      destination: { root: { kind: "body", value: { body: base.body, node: identities.nodeId(2) } },
        path: kind === "tuple" ? [{ kind: "tuple-element", index: 0 }] : [{ kind: "array-element" }] },
      member: null, embedding: { kind: "identity" } };
    const construction = { decision: { kind: "selected", operation: { kind: "array-construction", parts: [part] },
      operands: [identities.tyId(1)], result: identities.tyId(5), execution: { kind: "pure" } }, permissionScope: null };
    const operand = { ...header(3, 2), kind: "TrueKeyword", tsonic: { role: "value", type: identities.tyId(1),
      convertedType: identities.tyId(1), conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } } };
    const expression = { ...header(2, 1), kind: "ArrayLiteralExpression", multiLine: false,
      elements: { loc: { pos: 0, end: 0 }, nodes: [operand] }, tsonic: { role: "value", type: identities.tyId(5),
        convertedType: identities.tyId(5), conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null,
        demand: { kind: "always" }, construction: { kind: "decided", decision: construction } } };
    const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
      { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
      { ...header(4, 0), kind: "ReturnStatement", expression: null, tsonic: null },
    ] } } };
    const term = kind === "array" ? { kind, element: identities.tyId(1), readonly: false }
      : kind === "fixed-array" ? { kind, element: identities.tyId(1), extent: { length: 1n, runtimeBase: "bigint" } }
      : { kind, elements: [{ kind: "required", type: identities.tyId(1), declaration: null }], readonly: false };
    const input = { ...context, source, types: { ...context.types, terms: [...context.types.terms, term] } };
    const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
    const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
    const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
    const aggregate = { kind, elements: [{ kind: "constant", constant: constant.id }] };
    const value = { kind: "aggregate", type: identities.tyId(5), aggregate };
    const body = { ...base, locals: [local], places: [place], constants: [constant], blocks: [{ ...base.blocks[0], statements: [
      { ...site, kind: "storage-live", local: local.id },
      { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: place.id, value },
    ], terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(4) } } }] };
    const at = { kind: "instruction", block: 0, statement: 1 };
    same(verified(body, input), [], `complete ${kind} construction vector`);
    const wrongKind = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
      ...body.blocks[0].statements[1], value: { ...value, aggregate: { ...aggregate, kind: kind === "array" ? "fixed-array" : "array" } },
    }] }] };
    same(verified(wrongKind, input), [expectedViolation("assignment-type", at)], "a physical aggregate cannot claim a different declared collection family");
    const invoked = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0]], terminator: {
      origin: local.origin, tir: { body: base.body, node: identities.nodeId(2) }, kind: "invoke", step: null, operation: construction,
      operands: [{ kind: "constant", constant: constant.id }], destination: place.id, next: identities.blockId(1), unwind: { kind: "escape" },
    } }, { ...body.blocks[0], id: identities.blockId(1), statements: [] }] };
    same(verified(invoked, input), [], "the actual construction is also a selected explicit invoke, with all part/component metadata retained");
    const wrong = { ...body, constants: [{ ...constant, type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "wrong" } } }] };
    same(verified(wrong, input), [expectedViolation("assignment-type", at)], "physical element type cannot be silently relabelled");
    if (kind === "fixed-array" || kind === "tuple") {
      const empty = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
        ...body.blocks[0].statements[1], value: { ...value, aggregate: { kind, elements: [] } },
      }] }] };
      same(verified(empty, input), [expectedViolation("assignment-type", at)], "required physical slots cannot disappear");
      const extra = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
        ...body.blocks[0].statements[1], value: { ...value, aggregate: { kind, elements: [aggregate.elements[0], aggregate.elements[0]] } },
      }] }] };
      same(verified(extra, input), [expectedViolation("assignment-type", at)], "extra physical slots cannot be silently relabelled");
    }
    if (kind === "tuple") {
      const optionalType = { ...term, elements: [{ kind: "optional", type: identities.tyId(1), declaration: null }] };
      const optionalInput = { ...input, types: { ...input.types, terms: [...context.types.terms, optionalType] } };
      same(verified(body, optionalInput), [], "an admitted optional tuple slot can be physically present");
      const absentConstruction = { ...construction, decision: { ...construction.decision, operands: [],
        operation: { kind: "array-construction", parts: [] } } };
      const absentExpression = { ...expression, elements: { ...expression.elements, nodes: [] }, tsonic: { ...expression.tsonic,
        construction: { kind: "decided", decision: absentConstruction } } };
      const absentInput = { ...optionalInput, source: { ...source, root: { ...source.root, statements: { ...source.root.statements, nodes: [
        { ...source.root.statements.nodes[0], expression: absentExpression }, source.root.statements.nodes[1],
      ] } } } };
      const absentBody = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
        ...body.blocks[0].statements[1], value: { ...value, aggregate: { kind, elements: [] } },
      }] }] };
      same(verified(absentBody, absentInput), [], "absent optional slot uses the actual empty selected construction");
      const emptyTupleInput = { ...absentInput, types: { ...absentInput.types, terms: [...context.types.terms,
        { ...term, elements: [] }] } };
      same(verified(absentBody, emptyTupleInput), [], "an actual empty tuple has zero required and declared slots");
      const stringOperand = { ...constant, type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "optional" } } };
      const optionalWrong = { ...body, constants: [stringOperand] };
      same(verified(optionalWrong, optionalInput), [], "optional element carrier correspondence is a direct lower-mir law, not guessed here");
      for (const [label, elements, minimum, maximum, prefix] of [
        ["optional", [{ kind: "optional", type: identities.tyId(1), declaration: null }], 0, 1, false],
        ["rest", [{ kind: "rest", type: identities.tyId(6), declaration: null }], 0, null, false],
        ["required-optional", [{ kind: "required", type: identities.tyId(1), declaration: null },
          { kind: "optional", type: identities.tyId(1), declaration: null }], 1, 2, true],
        ["required-rest", [{ kind: "required", type: identities.tyId(1), declaration: null },
          { kind: "rest", type: identities.tyId(6), declaration: null }], 1, null, true],
        ["rest-required", [{ kind: "rest", type: identities.tyId(6), declaration: null },
          { kind: "required", type: identities.tyId(1), declaration: null }], 1, null, false],
      ]) {
        const tupleInput = { ...input, types: { ...input.types, terms: [...context.types.terms,
          { ...term, elements }, { kind: "array", element: identities.tyId(1), readonly: false }] } };
        for (const length of [0, 1, 2, 3]) {
          const physical = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
            ...body.blocks[0].statements[1], value: { ...value, aggregate: { kind,
              elements: Array.from({ length }, () => aggregate.elements[0]) } },
          }] }] };
          const expected = length < minimum || maximum !== null && length > maximum ? [expectedViolation("assignment-type", at)] : [];
          same(verified(physical, tupleInput), expected, `C2974 ${label} complete physical arity ${length}, not a lowerer correlation certificate`);
        }
        same(verified(optionalWrong, tupleInput), prefix ? [expectedViolation("assignment-type", at)] : [],
          `C2974 ${label} checks only the unambiguous required prefix and never a rest carrier as an element`);
      }
    }
  });
}

for (const kind of ["object", "record"]) test(`MIR ${kind} aggregate and object-construction invoke retain actual member correspondence`, () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const key = { kind: "text", value: "x" };
  const origin = { kind: "mapped", owner: { kind: "body", value: { body: base.body, node: identities.nodeId(2) } }, key };
  const decision = { key, origins: [origin], selectedDeclarations: [], primary: null, read: identities.tyId(1), write: identities.tyId(1),
    getter: null, setter: null, bindings: bindingVector, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } };
  const selected = { decision, getter: null, setter: null };
  const part = { part: 0, source: { body: base.body, node: identities.nodeId(5) },
    destination: { root: { kind: "body", value: { body: base.body, node: identities.nodeId(2) } }, path: [{ kind: "member", origin }] },
    member: decision, embedding: { kind: "identity" } };
  const construction = { decision: { kind: "selected", operation: { kind: "object-construction", parts: [part] },
    operands: [identities.tyId(1)], result: identities.tyId(5), execution: { kind: "pure" } }, permissionScope: null };
  const value = { role: "value", type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const property = { ...header(3, 2), kind: "PropertyAssignment", modifiers: null, postfixToken: null, type: null,
    name: { ...header(4, 3), kind: "Identifier", text: "x", tsonic: { role: "property-name", key } },
    initializer: { ...header(5, 3), kind: "TrueKeyword", tsonic: value }, tsonic: { key, member: { kind: "decided", decision: selected } } };
  const expression = { ...header(2, 1), kind: "ObjectLiteralExpression", multiLine: false,
    properties: { loc: { pos: 0, end: 0 }, nodes: [property] }, tsonic: { ...value, type: identities.tyId(5), convertedType: identities.tyId(5),
      construction: { kind: "decided", decision: construction } } };
  const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
    { ...header(6, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } } };
  const term = { kind: "shape", members: [{ key, origins: [origin], readOrigins: [origin], writeOrigins: [origin], kind: "property",
    read: identities.tyId(1), write: identities.tyId(1), optional: false, readonly: false }], indexes: [], calls: [], constructs: [] };
  const input = { ...context, source, types: { ...context.types, terms: [...context.types.terms, term] } };
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
  const body = { ...base, locals: [local], places: [place], constants: [constant], blocks: [{ ...base.blocks[0], statements: [
    { ...site, kind: "storage-live", local: local.id },
    { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: place.id,
      value: { kind: "aggregate", type: identities.tyId(5), aggregate: { kind, fields: [{ member: selected, value: { kind: "constant", constant: constant.id } }] } } },
  ], terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(6) } } }] };
  same(verified(body, input), [], "complete object/member physical aggregate vector");
  const missing = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "missingMember", ordinal: 0 }] });
  const missingPrimary = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "missingPrimary", ordinal: 0 }] });
  context.declarations.set(missing, null);
  context.declarations.set(missingPrimary, null);
  const withMember = (selectedDeclarations, primary = null) => {
    const member = { ...selected, decision: { ...decision, selectedDeclarations, primary } };
    return { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
      ...body.blocks[0].statements[1], value: { ...body.blocks[0].statements[1].value,
        aggregate: { kind, fields: [{ member, value: { kind: "constant", constant: constant.id } }] } },
    }] }] };
  };
  const at = { kind: "instruction", block: 0, statement: 1 };
  for (const [declarations, primary] of [[[], null], [[context.source.owner], null], [[], context.source.owner],
    [[context.source.owner, context.source.owner], context.source.owner]]) {
    same(verified(withMember(declarations, primary), input), [],
      "empty, existing selected-list and independently existing primary member definitions all resolve");
  }
  const counts = new Map();
  const tracked = { ...input, declarationOf: definition => {
    counts.set(definition, (counts.get(definition) ?? 0) + 1);
    return context.declarationOf(definition);
  } };
  for (const [declarations, primary, count] of [
    [[missing], null, 1], [[], missingPrimary, 1], [[missing, missing], null, 2],
    [[missing], missing, 2], [[missing, missing], missing, 3], [[missing], missingPrimary, 2],
  ]) {
    counts.clear();
    same(verified(withMember(declarations, primary), tracked),
      Array.from({ length: count }, () => expectedViolation("definition-resolves", at)),
      "each explicit selected declaration and nonnull primary retains its complete physical occurrence");
    if (declarations.length !== 0) assert.equal(counts.get(missing), 1, "repeated missing selected definitions query the genuine reader once per invocation");
    if (primary !== null) assert.equal(counts.get(primary), 1, "primary resolution uses the same canonical definition cache");
  }
  const unresolved = withMember([missing]);
  const repeated = { ...unresolved, blocks: [{ ...unresolved.blocks[0], statements: [
    ...unresolved.blocks[0].statements, unresolved.blocks[0].statements[1],
  ] }] };
  counts.clear();
  same(verified(repeated, tracked), [expectedViolation("definition-resolves", at),
    expectedViolation("definition-resolves", { kind: "instruction", block: 0, statement: 2 })],
  "repeated aggregate occurrences retain distinct instruction sites in authored order");
  assert.equal(counts.get(missing), 1, "repeated instruction references share lookup but never diagnostic deduplication");
  const physicalMember = unresolved.blocks[0].statements[1].value.aggregate.fields[0].member;
  const mixed = { ...unresolved, places: [...unresolved.places, { id: identities.placeId(1), storage: identities.tyId(1), origin: local.origin,
    base: { kind: "place", place: place.id, projection: { kind: "field", member: physicalMember }, tir: nodeRef } }] };
  counts.clear();
  same(verified(mixed, tracked), [expectedViolation("definition-resolves", { kind: "place", place: 1 }),
    expectedViolation("definition-resolves", at)], "the same member value at place and aggregate holders keeps both actual sites");
  assert.equal(counts.get(missing), 1, "place and aggregate member definitions share one real declaration lookup");
  context.declarations.set(missing, { scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] },
    parameterCount: 0, endpoints: [] });
  counts.clear();
  same(verified(mixed, tracked), [], "a fresh public invocation observes the now-existing declaration rather than a retained null");
  assert.equal(counts.get(missing), 1, "fresh invocation queries the actual updated reader once");
  const invoked = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0]], terminator: {
    origin: local.origin, tir: { body: base.body, node: identities.nodeId(2) }, kind: "invoke", step: null, operation: construction,
    operands: [{ kind: "constant", constant: constant.id }], destination: place.id, next: identities.blockId(1), unwind: { kind: "escape" },
  } }, { ...body.blocks[0], id: identities.blockId(1), statements: [] }] };
  same(verified(invoked, input), [], "complete member/part/component direct construction invoke");
  const wrong = { ...body, constants: [{ ...constant, type: identities.tyId(2), value: { kind: "literal", value: { kind: "string", value: "wrong" } } }] };
  same(verified(wrong, input), [expectedViolation("assignment-type", { kind: "instruction", block: 0, statement: 1 })],
    "the aggregate physical operand must have the actual selected construction operand type");
  const wrongInvoke = { ...invoked, constants: wrong.constants };
  same(verified(wrongInvoke, input), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: null })],
    "the explicit invoke checks the same retained operand type under its existing operation rule");
  for (const [read, write] of [[identities.tyId(1), identities.tyId(2)], [null, identities.tyId(1)],
    [identities.tyId(1), null], [null, null]]) {
    const ambiguous = { ...wrong, blocks: [{ ...wrong.blocks[0], statements: [wrong.blocks[0].statements[0], {
      ...wrong.blocks[0].statements[1], value: { ...wrong.blocks[0].statements[1].value, aggregate: { kind, fields: [
        { member: { ...selected, decision: { ...decision, read, write } }, value: { kind: "constant", constant: constant.id } },
      ] } },
    }] }] };
    same(verified(ambiguous, input), [], "C2974 does not infer a storage type from unequal or unavailable member carriers");
  }
});

test("MIR explicit int32-to-int64 conversion keeps original and converted TIR carriers separate", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const from = { root: { kind: "body", value: { body: base.body, node: identities.nodeId(2) } }, path: [] };
  const to = { root: { kind: "body", value: { body: base.body, node: identities.nodeId(0) } }, path: [{ kind: "result", signature: identities.sigId(0) }] };
  const embedding = { kind: "conversion", conversion: "numeric", proof: { steps: [{ from, to, rule: "numeric", premises: [] }], conclusion: 0 }, check: { kind: "none" } };
  const selected = { decision: { kind: "selected", operation: { kind: "conversion", from: identities.tyId(3), to: identities.tyId(5), embedding },
    operands: [identities.tyId(3)], result: identities.tyId(5), execution: { kind: "pure" } }, permissionScope: null };
  const rational = { numerator: 1n, denominator: 1n, negativeZero: false };
  const numeric = { ...header(2, 1), kind: "NumericLiteral", text: "1", tokenFlags: [], tsonic: { role: "value", value: rational,
    type: identities.tyId(3), convertedType: identities.tyId(5), conversion: { kind: "convert", role: "return", embedding, operation: selected },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } } };
  const source = { ...context.source, completion: identities.tyId(5), root: { ...context.source.root,
    statements: { loc: { pos: 0, end: 0 }, nodes: [{ ...header(1, 0), kind: "ReturnStatement", expression: numeric, tsonic: null }] } } };
  const types = { terms: [...context.types.terms, { kind: "primitive", primitive: "int64" }],
    signatures: [{ ...context.types.signatures[0], result: identities.tyId(5) }] };
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(3), value: { kind: "literal", value: { kind: "number", token: "1", value: rational } } };
  const body = { ...base, result: identities.tyId(5), locals: [local], places: [place], constants: [constant], blocks: [{ ...base.blocks[0],
    statements: [{ ...site, kind: "storage-live", local: local.id }, { ...site, tir: { body: base.body, node: identities.nodeId(2) },
      kind: "assign", step: null, place: place.id, value: { kind: "convert", operation: selected, operand: { kind: "constant", constant: constant.id }, to: identities.tyId(5) } }],
    terminator: { ...base.blocks[0].terminator, value: { kind: "place", place: place.id } } }] };
  const input = { ...context, source, types };
  same(verified(body, input), [], "complete selected numeric conversion and native int64 return vector");
  const wrong = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...body.blocks[0].statements[1].value, to: identities.tyId(3) },
  }] }] };
  same(verified(wrong, input), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 })], "conversion result cannot be silently relabelled as its original carrier");
  const missingSelection = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...body.blocks[0].statements[1].value,
      operation: { ...selected, decision: { ...selected.decision, operands: [] } } },
  }] }] };
  same(verified(missingSelection, input), [
    expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 }),
    expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 }),
  ], "a changed selected operation and its missing physical operand type retain both independent findings");
  const foreignStatement = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], tir: { ...body.blocks[0].statements[1].tir,
      body: identities.encodeBodyId({ owner: context.source.owner, role: "function", ordinal: 1 }) },
  }] }] };
  same(verified(foreignStatement, input), [expectedViolation("cross-owner-qualified", { kind: "instruction", block: 0, statement: 1 })],
    "a foreign source holder is not silently read as the containing body's typed expression");
  from.path.push({ kind: "sum-arm", family: { origin: "inferred", component: { root: from.root, path: [] },
    parameters: [], roles: [{ authoredIndex: 0, component: from.root, member: identities.tyId(3) }] }, index: 0 });
  same(verified(body, input), [], "an actual sum-family member carrier is retained through the selected correspondence proof");
});

test("MIR compound Boolean assignment retains its actual selected calculation", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const value = { type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const selected = { decision: { kind: "selected", operation: { kind: "boolean-operator", operator: "&&" },
    operands: [identities.tyId(1), identities.tyId(1)], result: identities.tyId(1), execution: { kind: "pure" } }, permissionScope: null };
  const expression = { ...header(2, 1), kind: "BinaryExpression", modifiers: null, type: null,
    left: { ...header(3, 2), kind: "Identifier", text: "value", tsonic: { role: "assignment-target",
      resolution: { kind: "local", local: { body: base.body, local: identities.localId(0) } },
      access: { kind: "read-write", storage: identities.tyId(1), read: identities.tyId(1), narrowing: null, evidenceIndex: null } } },
    operatorToken: { ...header(4, 2), kind: "AmpersandAmpersandEqualsToken", tsonic: null },
    right: { ...header(5, 2), kind: "FalseKeyword", tsonic: { ...value, role: "value" } },
    tsonic: { ...value, role: "assignment", storage: identities.tyId(1), calculation: { kind: "decided", decision: selected }, selection: null } };
  const parameter = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "value", ordinal: 0 }] });
  const source = { ...context.source, params: [{ local: identities.localId(0), declaration: parameter, role: "required",
    passing: "by-value", initializer: null, storage: identities.tyId(1) }], locals: [{ id: identities.localId(0),
    declaration: { kind: "item", value: { owner: parameter, node: identities.nodeId(0) } }, name: "value", role: "parameter",
    capturedFrom: null, mutable: true, storage: identities.tyId(1) }], root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
    { ...header(6, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } } };
  const body = lifetimeBody(base, (block, local, place) => [
    { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: place.id,
      value: { kind: "binary", operation: selected, left: { kind: "place", place: place.id }, right: { kind: "constant", constant: identities.constId(0) } } },
  ]);
  body.entries = [{ provided: 1, block: identities.blockId(0) }];
  body.constants = [{ id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: false } } }];
  body.locals[0] = { ...body.locals[0], role: { kind: "parameter", index: 0 }, source: { body: base.body, local: identities.localId(0) } };
  body.blocks[0].terminator.tir = { body: base.body, node: identities.nodeId(6) };
  const types = { ...context.types, signatures: [{ ...context.types.signatures[0], parameters: [
    { declaration: parameter, kind: "required", type: identities.tyId(1), passing: "by-value", initializer: null },
  ] }] };
  const input = { ...context, source, types };
  same(verified(body, input), [], "the physical Boolean calculation matches its actual compound-assignment selection");
  const evidence = node => ({ type: identities.tyId(1), component: { kind: "body", value: { body: base.body, node: identities.nodeId(node) } },
    category: { kind: "known", category: "boolean" }, numeric: null, sum: null, nominal: null, pointer: null });
  const deferred = { invocation: { rule: "operator", input: {
    context: { occurrence: { body: base.body, node: identities.nodeId(2) }, origin: base.blocks[0].origin, bindings: bindingVector },
    operator: "&&", operands: [evidence(3), evidence(5)], permissionScope: null,
  } }, result: identities.tyId(1) };
  const rejected = { ...source, root: { ...source.root, statements: { ...source.root.statements, nodes: [
    { ...source.root.statements.nodes[0], expression: { ...expression, tsonic: { ...expression.tsonic,
      calculation: { kind: "deferred", deferred } } } }, source.root.statements.nodes[1],
  ] } } };
  same(verified(body, { ...input, source: rejected }), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 0 })],
    "a deferred outcome cannot authenticate an arbitrary physical calculation");
});

test("MIR using protocols retain every actual step operation and optional selected callee", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: body.blocks[0].origin,
    parent: identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const operation = { decision: { kind: "selected", operation: { kind: "core", declaration: selected.decision.api.declaration,
    bindings: bindingVector }, operands: [identities.tyId(1)], result: identities.tyId(0), execution: { kind: "pure" } }, permissionScope: null };
  const protocol = { kind: "dispose", asynchronous: false, value: identities.tyId(1), completion: identities.tyId(0),
    sent: null, thrown: identities.tyId(4), steps: [
      { role: "acquire", operation, callee: null }, { role: "dispose", operation, callee: selected },
    ] };
  const declaration = { kind: "local", local: { body: body.body, local: identities.localId(0) } };
  const resource = { ...header(8, 7), kind: "VariableDeclaration", name: { ...header(9, 8), kind: "Identifier", text: "resource",
    tsonic: { role: "declaration-name", declaration, storage: identities.tyId(1) } }, type: null,
    initializer: { ...header(10, 8), kind: "TrueKeyword", tsonic: { role: "value", type: identities.tyId(1), convertedType: identities.tyId(1),
      conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } } },
    exclamationToken: null, tsonic: { declaration, storage: identities.tyId(1), initializer: null } };
  const evidence = { type: identities.tyId(1), component: { kind: "body", value: { body: body.body, node: identities.nodeId(8) } },
    category: { kind: "known", category: "boolean" }, numeric: null, sum: null, nominal: null, pointer: null };
  const deferred = { invocation: { rule: "protocol", input: {
    context: { occurrence: { body: body.body, node: identities.nodeId(7) }, origin: body.blocks[0].origin, bindings: bindingVector },
    kind: "dispose", asynchronous: false, subject: evidence, operands: [], completion: null, yielded: null, sent: null,
    thrown: { ...evidence, type: identities.tyId(4), category: { kind: "dynamic" } },
  } }, result: identities.tyId(0) };
  const list = { ...header(7, 6), flags: ["Using"], kind: "VariableDeclarationList", declarations: { loc: { pos: 0, end: 0 }, nodes: [resource] },
    tsonic: { role: "using", asynchronous: false, protocols: [{ kind: "decided", decision: protocol }, { kind: "deferred", deferred }] } };
  const source = { ...context.source, locals: [{ id: identities.localId(0), declaration: evidence.component, name: "resource", role: "binding",
    capturedFrom: null, mutable: false, storage: identities.tyId(1) }], root: { ...context.source.root, statements: { ...context.source.root.statements,
    nodes: [...context.source.root.statements.nodes, { ...header(6, 0), kind: "VariableStatement", modifiers: null, declarationList: list, tsonic: null }],
  } } };
  const physical = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator,
    tir: { body: body.body, node: identities.nodeId(7) }, step: { protocol: 0, step: 1 },
  } }, body.blocks[1]] };
  same(verified(physical, { ...context, source }), [], "the same real declared callee is retained by its owning disposal protocol step");
  const withoutSteps = { ...source, root: { ...source.root, statements: { ...source.root.statements,
    nodes: [...context.source.root.statements.nodes, { ...source.root.statements.nodes[2], declarationList: { ...list,
      tsonic: { ...list.tsonic, protocols: [{ kind: "decided", decision: { ...protocol, steps: [] } }] } } }],
  } } };
  same(verified(physical, { ...context, source: withoutSteps }), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: null }),
    expectedViolation("protocol-step-exact", { kind: "instruction", block: 0, statement: null })],
  "a protocol with no such step cannot authenticate its physical call, and the step the call names does not exist (law 6)");
});

test("MIR body receiver presence and exact storage are decided by its genuine source signature", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const receiverContext = { ...context, types: { ...context.types, signatures: [{ ...context.types.signatures[0], receiver: identities.tyId(1) }] } };
  same(verified(body, receiverContext), [expectedViolation("body-receiver-exact", { kind: "body" })], "missing receiver complete vector");
  const receiver = { id: identities.localId(0), storage: identities.tyId(1), role: { kind: "receiver" }, source: null, origin: body.blocks[0].origin };
  same(verified({ ...body, locals: [receiver] }, receiverContext), [], "one exact receiver valid");
  same(verified({ ...body, locals: [{ ...receiver, storage: identities.tyId(2) }] }, receiverContext),
    [expectedViolation("body-receiver-exact", { kind: "body" })], "wrong receiver storage complete vector");
});

function callSetup(passing = "by-value", result = 0, receiver = null) {
  const base = parsedBody();
  const context = sourceContext(base);
  const definition = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "callee", ordinal: 0 }] });
  const advertised = { declaration: definition, role: "advertised", signature: identities.sigId(1), body: null };
  const api = { ...advertised, role: "api-signature" };
  const selected = { decision: { candidate: 0, advertised, api, bindings: bindingVector, implementationBindings: bindingVector,
    parameters: [{ kind: "argument", parameter: 0, argument: 0, component: null, passing }],
    completion: { signature: identities.sigId(1), completion: identities.tyId(result), yielded: null, sent: null }, result: identities.tyId(result), activation: null }, activation: null, captures: [] };
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const value = type => ({ type: identities.tyId(type), convertedType: identities.tyId(type), conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } });
  const argument = { ...header(4, 2), kind: "TrueKeyword", tsonic: { ...value(1), role: "value" } };
  const call = { ...header(2, 1), kind: "CallExpression", expression: { ...header(3, 2), kind: "Identifier", text: "callee",
    tsonic: { ...value(5), role: "value", resolution: { kind: "definition", definition, aliases: [] } } },
  questionDotToken: null, typeArguments: null, arguments: { loc: { pos: 0, end: 0 }, nodes: [argument] },
  tsonic: { ...value(result), application: { kind: "decided", decision: { callee: selected, receiver: receiver === null ? null : argument.id,
    arguments: [{ kind: "provided", parameter: 0, expression: argument.id }] } }, operation: null } };
  const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ExpressionStatement", expression: call, tsonic: null },
    { ...header(5, 0), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } } };
  const scope = { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] };
  context.declarations.set(definition, { scope, parameterCount: 1, endpoints: [advertised, api] });
  const types = { terms: [...context.types.terms, { kind: "callable", calls: [identities.sigId(1)], constructs: [] }],
    signatures: [...context.types.signatures, { id: identities.sigId(1), declaration: definition, owner: null, composition: null,
      kind: "call", typeParameters: [], receiver: receiver === null ? null : identities.tyId(receiver),
      parameters: [{ declaration: definition, kind: "required", type: identities.tyId(1), passing, initializer: null }], result: identities.tyId(result) }] };
  const local = { id: identities.localId(0), storage: identities.tyId(1), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin };
  const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
  const mirArgument = passing === "by-value" || passing === "move"
    ? { kind: "value", passing, operand: { kind: "constant", constant: constant.id } } : { kind: "place", passing, place: place.id };
  const body = { ...base, locals: [local], places: [place], constants: [constant], blocks: [
    { ...base.blocks[0], statements: [{ origin: local.origin, tir: base.blocks[0].tir, kind: "storage-live", local: local.id }],
      terminator: { origin: local.origin, tir: { body: base.body, node: identities.nodeId(2) }, kind: "call", step: null, callee: { kind: "direct", resolution: selected },
        receiver: receiver === null ? null : { kind: "constant", constant: constant.id }, arguments: [mirArgument], destination: null,
        next: identities.blockId(1), unwind: { kind: "escape" } } },
    { ...base.blocks[0], id: identities.blockId(1), terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(5) } } },
  ] };
  return { body, context: { ...context, source, types } };
}

for (const passing of ["by-value", "move", "byref-readonly", "byref-readwrite", "byref-writeonly-must-init", "borrow-shared", "borrow-mut"]) {
  test(`MIR actual source call and physical API signature preserve ${passing}`, () => {
    const { body, context } = callSetup(passing);
    same(verified(body, context), [], `complete ${passing} call vector`);
  });
}

const callInstruction = { kind: "instruction", block: 0, statement: null };
test("MIR an overloaded family's API endpoint cannot stand in for its advertised endpoint", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  selected.decision.advertised = selected.decision.api;
  same(verified(body, context), [expectedViolation("operation-selected", callInstruction)], "implementation as advertised");
});
test("MIR a family without an advertised row selects one endpoint as both the advertised and the API endpoint", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const { advertised, api } = selected.decision;
  const declared = context.declarations.get(api.declaration);
  context.declarations.set(api.declaration, { ...declared, endpoints: [api] });
  selected.decision.advertised = api;
  same(verified(body, context), [], "the one endpoint of an ordinary declaration");
  selected.decision.advertised = advertised;
  same(verified(body, context), [expectedViolation("operation-selected", callInstruction)], "an advertised row the family does not have");
  selected.decision.advertised = { ...api, signature: identities.sigId(0) };
  same(verified(body, context), [expectedViolation("operation-selected", callInstruction)], "the same role and body with another signature");
});
test("MIR an API endpoint declared by another definition is selected only through the selected declaration's family", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const other = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "native", ordinal: 0 }] });
  const foreign = { ...selected.decision.api, declaration: other };
  const declared = context.declarations.get(selected.decision.advertised.declaration);
  context.declarations.set(other, { ...declared, endpoints: [foreign] });
  selected.decision.api = foreign;
  same(verified(body, context), [expectedViolation("operation-selected", callInstruction)], "an unrelated declaration's API endpoint");
  context.declarations.set(selected.decision.advertised.declaration, { ...declared, endpoints: [...declared.endpoints, foreign] });
  same(verified(body, context), [], "the associated API endpoint of another definition");
});
test("MIR an advertised row is a family member by its signature as well as its owner, role and body", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const declared = context.declarations.get(selected.decision.advertised.declaration);
  const second = { ...selected.decision.advertised, signature: identities.sigId(0) };
  context.declarations.set(selected.decision.advertised.declaration, { ...declared, endpoints: [...declared.endpoints, second] });
  same(verified(body, context), [], "the selected row of a two-signature advertised family");
  context.declarations.set(selected.decision.advertised.declaration, declared);
  selected.decision.advertised = second;
  same(verified(body, context), [expectedViolation("operation-selected", callInstruction)], "an existing signature the family does not have");
});
test("MIR an unresolved selected declaration is reported once as unresolved and has no family to judge", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const missing = identities.encodeDefId({ module: body.blocks[0].origin.module, segments: [{ name: "missing", ordinal: 0 }] });
  context.declarations.set(missing, null);
  selected.decision.advertised = { ...selected.decision.advertised, declaration: missing };
  same(verified(body, context), [expectedViolation("definition-resolves", callInstruction)], "the unresolved declaration only");
});

test("MIR a source-owned body activation retains its actual full instance and complete physical call", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const callee = identities.encodeBodyId({ owner: selected.decision.api.declaration, role: "function", ordinal: 0 });
  selected.decision.api = { ...selected.decision.api, role: "api-body", body: callee };
  selected.activation = { body: callee, bindings: { kind: "parametric" } };
  context.bodyOwners.set(callee, selected.decision.api.declaration);
  const declared = context.declarations.get(selected.decision.api.declaration);
  context.declarations.set(selected.decision.api.declaration, { ...declared,
    endpoints: [selected.decision.advertised, selected.decision.api] });
  same(verified(body, context), [], "activation is the actual API body, not a same-number or advertised inference");
});

test("MIR bodyless generator completion channels retain independent actual type references", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const result = identities.tyId(6);
  context.types.terms.push({ kind: "shape", members: [], indexes: [], calls: [], constructs: [] });
  context.types.signatures[1].result = result;
  const call = context.source.root.statements.nodes[0].expression;
  call.tsonic.type = result;
  call.tsonic.convertedType = result;
  selected.decision.result = result;
  selected.decision.completion = { ...selected.decision.completion,
    completion: identities.tyId(0), yielded: identities.tyId(1), sent: identities.tyId(1) };
  same(verified(body, context), [], "the produced iterator carrier and its final, yielded and sent channels are separate real fields");
  for (const channel of ["yielded", "sent"]) {
    const malformed = structuredClone(selected);
    malformed.decision.completion[channel] = identities.tyId(99);
    const first = body.blocks[0];
    const changed = { ...body, blocks: [{ ...first, terminator: { ...first.terminator,
      callee: { kind: "direct", resolution: malformed } } }, body.blocks[1]] };
    same(verified(changed, context), [
      expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: null }),
      expectedViolation("type-resolves", { kind: "instruction", block: 0, statement: null }, [{ kind: "number", value: 99 }]),
    ], "a changed physical channel retains both the selected-source mismatch and the missing-carrier finding");
  }
});

test("MIR an omitted optional API formal retains one explicit physical absence argument", () => {
  const { body, context } = callSetup();
  const selected = body.blocks[0].terminator.callee.resolution;
  const call = context.source.root.statements.nodes[0].expression;
  call.arguments.nodes = [];
  call.tsonic.application.decision.arguments = [{ kind: "omitted", parameter: 0, value: { kind: "absence" } }];
  const optionalType = identities.tyId(6);
  context.types.terms.push({ kind: "optional", value: identities.tyId(1) });
  selected.decision.parameters = [{ kind: "omitted", parameter: 0, type: optionalType }];
  context.types.signatures[1].parameters[0].kind = "optional";
  context.types.signatures[1].parameters[0].type = optionalType;
  body.constants[0] = { id: identities.constId(0), type: optionalType, value: { kind: "literal", value: { kind: "absence" } } };
  context.source.root.statements.nodes[1].id = identities.nodeId(4);
  body.blocks[1].terminator.tir.node = identities.nodeId(4);
  same(verified(body, context), [], "the one actual optional Boolean formal receives the explicit lowered absence value");
  same(verified({ ...body, blocks: [{ ...body.blocks[0],
    terminator: { ...body.blocks[0].terminator, arguments: [] } }, body.blocks[1]] }, context),
    [expectedViolation("call-arguments-total", { kind: "instruction", block: 0, statement: null })],
    "source omission never deletes the actual API's physical parameter slot");
});

test("MIR physical arguments follow the one API formal rather than two advertised overload formals", () => {
  const { body, context } = callSetup();
  const decision = body.blocks[0].terminator.callee.resolution.decision;
  const advertisedId = identities.sigId(context.types.signatures.length);
  const implementation = context.types.signatures[1];
  context.types.signatures.push({ ...implementation, id: advertisedId, parameters: [...implementation.parameters,
    { ...implementation.parameters[0], declaration: identities.encodeDefId({ module: body.blocks[0].origin.module,
      segments: [{ name: "callee", ordinal: 0 }, { name: "optional", ordinal: 0 }] }), kind: "optional", type: identities.tyId(2) }] });
  decision.advertised.signature = advertisedId;
  context.types.terms[5].calls = [advertisedId];
  same(verified(body, context), [], "a supplied Boolean fits the advertised overload and the one actual API formal");
  const missing = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, arguments: [] } }, body.blocks[1]] };
  same(verified(missing, context), [expectedViolation("call-arguments-total", { kind: "instruction", block: 0, statement: null })],
    "the actual physical API slot cannot disappear because the advertised arity differs");
});

test("MIR direct call and selected invoke admit metadata without duplicating Program facts", () => {
  const { body, context } = callSetup();
  const direct = { ...body, constants: [{ ...body.constants[0], value: { kind: "metadata", definition: context.source.owner,
    bindings: { kind: "parametric" } } }] };
  same(verified(direct, context), [], "direct metadata argument has the exact selected API parameter type");
  const selected = { decision: { kind: "selected", operation: { kind: "core", declaration: context.source.owner, bindings: bindingVector },
    operands: [identities.tyId(1)], result: identities.tyId(0), execution: { kind: "pure" } }, permissionScope: null };
  const statement = context.source.root.statements.nodes[0];
  const source = { ...context.source, root: { ...context.source.root, statements: { ...context.source.root.statements, nodes: [
    { ...statement, expression: { ...statement.expression, tsonic: { ...statement.expression.tsonic,
      operation: { kind: "decided", decision: selected } } } }, context.source.root.statements.nodes[1],
  ] } } };
  const invoked = { ...direct, blocks: [{ ...direct.blocks[0], terminator: { ...site,
    tir: direct.blocks[0].terminator.tir, kind: "invoke", step: null, operation: selected,
    operands: [{ kind: "constant", constant: direct.constants[0].id }], destination: null,
    next: identities.blockId(1), unwind: { kind: "escape" } } }, direct.blocks[1]] };
  same(verified(invoked, { ...context, source }), [], "direct selected metadata operand remains a Program-only fact check");
});

test("MIR address-of verifier retains the actual selected carrier and real place reference", () => {
  const { body: callBody, context } = callSetup("by-value", 6);
  const pointerDefinition = identities.encodeDefId({ module: callBody.blocks[0].origin.module, segments: [{ name: "Pointer", ordinal: 0 }] });
  context.declarations.set(pointerDefinition, { scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] },
    parameterCount: 0, endpoints: [] });
  const pointer = { kind: "declared", definition: pointerDefinition, arguments: [], facet: "instance", extent: null };
  const types = { ...context.types, terms: [...context.types.terms, pointer] };
  const address = { decision: { kind: "selected", operation: { kind: "pointer-address" },
    operands: [identities.tyId(1)], result: identities.tyId(6), execution: { kind: "pure" } }, permissionScope: null };
  const statement = context.source.root.statements.nodes[0];
  const source = { ...context.source, root: { ...context.source.root, statements: { ...context.source.root.statements, nodes: [
    { ...statement, expression: { ...statement.expression, tsonic: { ...statement.expression.tsonic,
      operation: { kind: "decided", decision: address } } } }, context.source.root.statements.nodes[1],
  ] } } };
  const destination = { id: identities.localId(1), storage: identities.tyId(6), role: { kind: "temporary" }, source: null,
    origin: callBody.locals[0].origin };
  const place = { id: identities.placeId(1), storage: destination.storage, base: { kind: "local", local: destination.id }, origin: destination.origin };
  const body = { ...callBody, locals: [...callBody.locals, destination], places: [...callBody.places, place], blocks: [{ ...callBody.blocks[0], statements: [
    ...callBody.blocks[0].statements, { ...site, kind: "storage-live", local: destination.id },
    { ...site, tir: callBody.blocks[0].terminator.tir, kind: "assign", step: null, place: place.id,
      value: { kind: "address-of", place: identities.placeId(0), type: identities.tyId(6) } },
  ], terminator: callBody.blocks[1].terminator }] };
  const input = { ...context, source, types };
  const at = { kind: "instruction", block: 0, statement: 2 };
  same(verified(body, input), [], "complete address-of with selected declared carrier and live source place");
  const missing = { ...body, blocks: [{ ...body.blocks[0], statements: [...body.blocks[0].statements.slice(0, 2), {
    ...body.blocks[0].statements[2], value: { ...body.blocks[0].statements[2].value, place: identities.placeId(99) },
  }] }] };
  same(verified(missing, input), [expectedViolation("operand-resolves", at)], "address-of actually resolves its source place");
  const wrong = { ...body, locals: [body.locals[0], { ...destination, storage: identities.tyId(2) }],
    places: [body.places[0], { ...place, storage: identities.tyId(2) }], blocks: [{ ...body.blocks[0], statements: [...body.blocks[0].statements.slice(0, 2), {
      ...body.blocks[0].statements[2], value: { ...body.blocks[0].statements[2].value, type: identities.tyId(2) },
    }] }] };
  same(verified(wrong, input), [expectedViolation("operation-selected", at)], "a matching destination cannot conceal the wrong address carrier");
});

test("MIR actual throw escape, handler and unreachable terminators have complete semantic vectors", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const typed = { role: "value", type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" },
    narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const source = { ...context.source, root: { ...context.source.root, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(1, 0), kind: "ThrowStatement", expression: { ...header(2, 1), kind: "TrueKeyword", tsonic: typed }, tsonic: null },
  ] } } };
  const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
  const body = { ...base, constants: [constant], blocks: [{ ...base.blocks[0], terminator: { ...base.blocks[0].terminator,
    kind: "throw", operand: { kind: "constant", constant: constant.id }, unwind: { kind: "escape" } } }] };
  const input = { ...context, source };
  const at = { kind: "instruction", block: 0, statement: null };
  same(verified(body, input), [], "actual source throw with resolved escape operand");
  const missing = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator,
    operand: { kind: "constant", constant: identities.constId(99) } } }] };
  same(verified(missing, input), [expectedViolation("operand-resolves", at)], "complete missing throw operand vector");
  const exception = { id: identities.localId(0), storage: identities.tyId(4), role: { kind: "exception" }, source: null, origin: base.blocks[0].origin };
  const place = { id: identities.placeId(0), storage: exception.storage, base: { kind: "local", local: exception.id }, origin: exception.origin };
  const handled = { ...body, locals: [exception], places: [place], blocks: [{ ...body.blocks[0], statements: [
    { ...site, kind: "storage-live", local: exception.id },
  ], terminator: { ...body.blocks[0].terminator, unwind: { kind: "handler", exception: place.id, target: identities.blockId(1) } } },
  { ...base.blocks[0], id: identities.blockId(1), terminator: { ...site, kind: "unreachable" } }] };
  same(verified(handled, input), [], "real handler edge and explicit unreachable completion are structurally valid");
  const wrongException = { ...handled, locals: [{ ...exception, storage: identities.tyId(1) }], places: [{ ...place, storage: identities.tyId(1) }] };
  same(verified(wrongException, input), [expectedViolation("exception-destination-type", at)], "handler carrier is canonical intrinsic unknown");
  const unknownHandler = { ...handled, blocks: [{ ...handled.blocks[0], terminator: { ...handled.blocks[0].terminator,
    unwind: { ...handled.blocks[0].terminator.unwind, exception: identities.placeId(99) } } }, handled.blocks[1]] };
  same(verified(unknownHandler, input), [expectedViolation("operand-resolves", at)], "unknown handler place remains a genuine reference error");
  const unresolvedEdge = { ...handled, blocks: [{ ...handled.blocks[0], terminator: { ...handled.blocks[0].terminator,
    unwind: { ...handled.blocks[0].terminator.unwind, target: identities.blockId(99) } } }, handled.blocks[1]] };
  same(verified(unresolvedEdge, input), [expectedViolation("edge-target-resolves", at,
    [{ kind: "text", value: "unwind" }, { kind: "number", value: 99 }])], "actual throw handler target resolves independently");
  same(verified({ ...base, blocks: [{ ...base.blocks[0], terminator: { ...site, kind: "unreachable" } }] }, context), [],
    "a reachable explicit unreachable terminator has no invented operand or successor");
});

for (const kind of ["library", "core", "protocol"]) test(`MIR selected ${kind} invoke retains exact source decisions, physical operands and definition references`, () => {
  const setup = callSetup("by-value", 1);
  const definition = setup.body.blocks[0].terminator.callee.resolution.decision.api.declaration;
  const application = setup.body.blocks[0].terminator.callee.resolution.decision;
  const identity = kind === "protocol" ? { kind, protocol: "await", asynchronous: true,
    steps: [
      { role: "acquire", operation: { kind: "core", declaration: definition, bindings: bindingVector }, operands: [identities.tyId(1)], result: identities.tyId(1) },
      { role: "await", operation: { kind: "call", application }, operands: [identities.tyId(1)], result: identities.tyId(1) },
      { role: "completion", operation: { kind: "completion" }, operands: [], result: identities.tyId(0) },
    ], value: identities.tyId(1), completion: identities.tyId(0), yielded: identities.tyId(1), sent: identities.tyId(1), thrown: identities.tyId(4) }
    : { kind, declaration: definition, bindings: bindingVector };
  const selected = { decision: { kind: "selected", operation: identity, operands: [identities.tyId(1)], result: identities.tyId(1), execution: { kind: "pure" } }, permissionScope: null };
  const expression = setup.context.source.root.statements.nodes[0].expression;
  const source = { ...setup.context.source, root: { ...setup.context.source.root, statements: {
    ...setup.context.source.root.statements, nodes: [{ ...setup.context.source.root.statements.nodes[0], expression: {
      ...expression, tsonic: { ...expression.tsonic, operation: { kind: "decided", decision: selected } },
    } }, setup.context.source.root.statements.nodes[1]],
  } } };
  const terminator = { origin: setup.body.blocks[0].origin, tir: setup.body.blocks[0].terminator.tir,
    kind: "invoke", step: null, operation: selected, operands: [{ kind: "constant", constant: identities.constId(0) }],
    destination: identities.placeId(0), next: identities.blockId(1), unwind: { kind: "escape" } };
  const body = { ...setup.body, blocks: [{ ...setup.body.blocks[0], terminator }, setup.body.blocks[1]] };
  const input = { ...setup.context, source };
  const at = { kind: "instruction", block: 0, statement: null };
  same(verified(body, input), [], "complete genuine selected invoke vector");
  const missing = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...terminator, operands: [] } }, body.blocks[1]] };
  same(verified(missing, input), [expectedViolation("operation-selected", at)], "all selected physical operands are required");
  const wrong = { ...body, locals: [{ ...body.locals[0], storage: identities.tyId(2) }],
    places: [{ ...body.places[0], storage: identities.tyId(2) }] };
  same(verified(wrong, input), [expectedViolation("call-destination-type", at)], "invoke result uses its exact destination carrier");
  const discarded = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...terminator, destination: null } }, body.blocks[1]] };
  same(verified(discarded, input), [], "an explicitly discarded invoke result has no invented destination");
  if (kind === "protocol") {
    const declared = setup.context.declarations.get(definition);
    setup.context.declarations.set(definition, { ...declared, endpoints: [] });
    same(verified(body, input), [expectedViolation("operation-selected", at)],
      "a call step whose endpoints are not in its selected family is one finding for the operation");
    setup.context.declarations.set(definition, declared);
  }
  setup.context.declarations.set(definition, null);
  same(verified(body, input), Array.from({ length: kind === "protocol" ? 3 : 1 }, () => expectedViolation("definition-resolves", at)),
    "each actual core/API/advertised reference retains its complete missing-definition vector");
});

test("MIR indirect call operands use the actual source callable type rather than a same-number value", () => {
  const { body, context } = callSetup();
  const resolution = body.blocks[0].terminator.callee.resolution;
  const definition = resolution.decision.api.declaration;
  const callable = { id: identities.constId(1), type: identities.tyId(5),
    value: { kind: "definition", definition, bindings: { kind: "parametric" } } };
  const indirect = { ...body, constants: [...body.constants, callable], blocks: [{ ...body.blocks[0], terminator: {
    ...body.blocks[0].terminator, callee: { kind: "indirect", resolution, operand: { kind: "constant", constant: callable.id } },
  } }, body.blocks[1]] };
  const at = { kind: "instruction", block: 0, statement: null };
  same(verified(indirect, context), [], "complete actual source callable and physical callee vector");
  const wrong = { ...indirect, constants: [body.constants[0], { id: callable.id, type: identities.tyId(2),
    value: { kind: "literal", value: { kind: "string", value: "not callable" } } }] };
  same(verified(wrong, context), [expectedViolation("operation-selected", at)], "a resolved string constant cannot borrow the selected callable carrier");
  const missing = { ...indirect, blocks: [{ ...indirect.blocks[0], terminator: { ...indirect.blocks[0].terminator,
    callee: { kind: "indirect", resolution, operand: { kind: "constant", constant: identities.constId(99) } },
  } }, indirect.blocks[1]] };
  same(verified(missing, context), [expectedViolation("operand-resolves", at)], "missing indirect callee remains an exact reference violation");
});

for (const kind of ["NewExpression", "TaggedTemplateExpression"]) test(`MIR indirect callee type comes from the supplied ${kind} expression, not another source field`, () => {
  const setup = callSetup();
  const old = setup.context.source.root.statements.nodes[0].expression;
  const resolution = setup.body.blocks[0].terminator.callee.resolution;
  const constructor = kind === "NewExpression";
  const resultType = identities.tyId(constructor ? 6 : 1);
  const parameterType = identities.tyId(constructor ? 1 : 2);
  const selected = { ...resolution, decision: { ...resolution.decision, result: resultType,
    completion: { ...resolution.decision.completion, completion: resultType } } };
  const application = { ...old.tsonic.application.decision, callee: selected };
  const payload = { ...old.tsonic, type: resultType, convertedType: resultType,
    application: { kind: "decided", decision: application } };
  const template = { id: identities.nodeId(4), origin: old.origin, parent: old.id, flags: [], loc: { pos: 0, end: 0 },
    kind: "NoSubstitutionTemplateLiteral", text: "x", tokenFlags: [], rawText: "x", templateFlags: [], tsonic: {
      role: "value", value: "x", type: parameterType, convertedType: parameterType, conversion: { kind: "identity" },
      narrowing: null, evidenceIndex: null, demand: { kind: "always" },
    } };
  const common = { id: old.id, origin: old.origin, parent: old.parent, flags: old.flags, loc: old.loc, typeArguments: null, tsonic: payload };
  const expression = constructor ? { ...common, kind, expression: old.expression, arguments: old.arguments }
    : { ...common, kind, tag: old.expression, questionDotToken: null, template };
  const source = { ...setup.context.source, root: { ...setup.context.source.root, statements: {
    ...setup.context.source.root.statements, nodes: [{ ...setup.context.source.root.statements.nodes[0], expression },
      setup.context.source.root.statements.nodes[1]],
  } } };
  const signature = { ...setup.context.types.signatures[1], kind: constructor ? "construct" : "call", result: resultType,
    parameters: [{ ...setup.context.types.signatures[1].parameters[0], type: parameterType }] };
  const callableType = constructor ? { kind: "callable", calls: [], constructs: [identities.sigId(1)] }
    : setup.context.types.terms[5];
  const terms = [...setup.context.types.terms.slice(0, 5), callableType,
    ...(constructor ? [{ kind: "declared", definition: signature.declaration, arguments: [], facet: "instance", extent: null }] : [])];
  const input = { ...setup.context, source, types: { terms, signatures: [setup.context.types.signatures[0], signature] } };
  const argument = constructor ? setup.body.constants[0] : { id: identities.constId(0), type: parameterType,
    value: { kind: "literal", value: { kind: "string", value: "x" } } };
  const callee = { id: identities.constId(1), type: identities.tyId(5), value: { kind: "definition", definition: signature.declaration,
    bindings: { kind: "parametric" } } };
  const body = { ...setup.body, constants: [argument, callee], blocks: [{ ...setup.body.blocks[0], terminator: {
    ...setup.body.blocks[0].terminator, callee: { kind: "indirect", resolution: selected, operand: { kind: "constant", constant: callee.id } },
  } }, setup.body.blocks[1]] };
  const at = { kind: "instruction", block: 0, statement: null };
  same(verified(body, input), [], "the verifier transports the complete supplied selection; it does not rerun source overload rules");
  const wrong = { ...body, constants: [argument, { ...callee, type: identities.tyId(4) }] };
  same(verified(wrong, input), [expectedViolation("operation-selected", at)], "the actual expression/tag callable type cannot be replaced with unknown");
});

test("MIR call receiver, complete physical arguments, exact passing and destination have separate full opposites", () => {
  const { body, context } = callSetup();
  const replace = delta => ({ ...body, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, ...delta } }, body.blocks[1]] });
  const at = { kind: "instruction", block: 0, statement: null };
  same(verified(replace({ receiver: { kind: "constant", constant: identities.constId(0) } }), context),
    [expectedViolation("call-receiver-exact", at)], "unexpected receiver complete vector");
  same(verified(replace({ arguments: [] }), context), [expectedViolation("call-arguments-total", at)], "missing physical argument complete vector");
  same(verified(replace({ arguments: [{ ...body.blocks[0].terminator.arguments[0], passing: "move" }] }), context),
    [expectedViolation("argument-passing-exact", at, [{ kind: "number", value: 0 }])], "wrong passing complete vector");
  const withReceiver = callSetup("by-value", 0, 1);
  same(verified(withReceiver.body, withReceiver.context), [], "exact separate receiver valid");
  const absent = { ...withReceiver.body, blocks: [{ ...withReceiver.body.blocks[0], terminator: { ...withReceiver.body.blocks[0].terminator, receiver: null } }, withReceiver.body.blocks[1]] };
  same(verified(absent, withReceiver.context), [expectedViolation("call-receiver-exact", at)], "missing required receiver complete vector");
  const valued = callSetup("by-value", 1);
  const validDestination = { ...valued.body, blocks: [{ ...valued.body.blocks[0], terminator: { ...valued.body.blocks[0].terminator, destination: identities.placeId(0) } }, valued.body.blocks[1]] };
  same(verified(validDestination, valued.context), [], "explicit exact call destination valid");
  const wrongDestination = { ...validDestination, locals: [{ ...validDestination.locals[0], storage: identities.tyId(2) }],
    places: [{ ...validDestination.places[0], storage: identities.tyId(2) }] };
  same(verified(wrongDestination, valued.context), [expectedViolation("call-destination-type", at)], "wrong destination type full vector");
});

test("MIR exception storage uses canonical intrinsic unknown, not a target error type", () => {
  const { body, context } = callSetup();
  const handler = { ...body, locals: [{ ...body.locals[0], storage: identities.tyId(4) }], places: [{ ...body.places[0], storage: identities.tyId(4) }],
    blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, unwind: { kind: "handler", exception: identities.placeId(0), target: identities.blockId(1) } } }, body.blocks[1]] };
  same(verified(handler, context), [], "canonical unknown exception destination valid");
  const wrong = { ...handler, locals: [{ ...handler.locals[0], storage: identities.tyId(2) }], places: [{ ...handler.places[0], storage: identities.tyId(2) }] };
  same(verified(wrong, context), [expectedViolation("exception-destination-type", { kind: "instruction", block: 0, statement: null })], "target-independent wrong exception storage full vector");
});

for (const kind of ["await", "yield", "delegate"]) for (const handler of [false, true]) {
  test(`MIR ${kind} checks its actual TIR result, recorded completion, ${handler ? "handler" : "escape"} and resume edge`, () => {
    const base = parsedBody();
    const context = sourceContext(base);
    const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
      parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
    const operand = { ...header(3, 2), kind: "TrueKeyword", tsonic: { role: "value", type: identities.tyId(1),
      convertedType: identities.tyId(1), conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } } };
    const payload = { type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" },
      narrowing: null, evidenceIndex: null, demand: { kind: "always" }, protocol: { kind: "decided", decision: {
        kind, asynchronous: kind === "await", steps: [], value: identities.tyId(1), completion: identities.tyId(0),
        sent: null, thrown: identities.tyId(4) } } };
    const expression = kind === "await" ? { ...header(2, 1), kind: "AwaitExpression", expression: operand, tsonic: payload }
      : { ...header(2, 1), kind: "YieldExpression", expression: operand, tsonic: payload,
        asteriskToken: kind === "delegate" ? { ...header(4, 2), kind: "AsteriskToken", tsonic: null } : null };
    const source = { ...context.source, asynchronous: kind === "await", generator: kind !== "await",
      yielded: kind === "await" ? null : identities.tyId(1), root: { ...context.source.root,
        statements: { loc: { pos: 0, end: 0 }, nodes: [
          { ...header(1, 0), kind: "ExpressionStatement", expression, tsonic: null },
          { ...header(5, 0), kind: "ReturnStatement", expression: null, tsonic: null },
        ] } } };
    const locals = [1, 0, 4].map((storage, id) => ({ id: identities.localId(id), storage: identities.tyId(storage),
      role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin }));
    const places = locals.map(local => ({ id: identities.placeId(local.id), storage: local.storage,
      base: { kind: "local", local: local.id }, origin: local.origin }));
    const constant = { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } };
    const unwind = handler ? { kind: "handler", exception: places[2].id, target: identities.blockId(3) } : { kind: "escape" };
    const common = { origin: locals[0].origin, tir: { body: base.body, node: identities.nodeId(2) }, step: { protocol: 0, step: 0 },
      destination: places[0].id, resume: identities.blockId(1), unwind };
    const completion = { destination: places[1].id, target: identities.blockId(2) };
    const terminator = kind === "delegate" ? { ...common, kind, iterator: { kind: "constant", constant: constant.id }, return: completion }
      : kind === "yield" ? { ...common, kind, operand: { kind: "constant", constant: constant.id }, return: completion }
      : { ...common, kind, operand: { kind: "constant", constant: constant.id } };
    const tail = id => ({ ...base.blocks[0], id: identities.blockId(id),
      terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(5) } } });
    const body = { ...base, locals, places, constants: [constant], blocks: [{ ...base.blocks[0], terminator,
      statements: locals.map(local => ({ ...site, kind: "storage-live", local: local.id })) }, tail(1), tail(2), tail(3)] };
    const input = { ...context, source };
    const at = { kind: "instruction", block: 0, statement: null };
    same(verified(body, input), [], "complete suspension with explicit existing continuations");
    const wrongStorage = index => ({ ...body,
      locals: locals.map((local, position) => position === index ? { ...local, storage: identities.tyId(2) } : local),
      places: places.map((place, position) => position === index ? { ...place, storage: identities.tyId(2) } : place) });
    same(verified(wrongStorage(0), input), [expectedViolation("call-destination-type", at)], "exact raw TIR suspension result is required");
    if (kind !== "await") same(verified(wrongStorage(1), input),
      [expectedViolation("call-destination-type", at)], "recorded suspension return stores the actual body completion");
    if (handler) same(verified(wrongStorage(2), input),
      [expectedViolation("exception-destination-type", at)], "handler storage is canonical unknown, not a target error");
    const missing = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...terminator, resume: identities.blockId(99) } }, ...body.blocks.slice(1)] };
    same(verified(missing, input), [expectedViolation("edge-target-resolves", at,
      [{ kind: "text", value: "resume" }, { kind: "number", value: 99 }])], "a suspension cannot resume to a foreign block");
    if (kind === "yield") {
      const bare = { ...body, blocks: [{ ...body.blocks[0], terminator: { ...terminator, operand: null } }, ...body.blocks.slice(1)] };
      const bareSource = { ...source, root: { ...source.root, statements: { ...source.root.statements, nodes: [
        { ...source.root.statements.nodes[0], expression: { ...expression, expression: null } }, source.root.statements.nodes[1],
      ] } } };
      same(verified(bare, { ...input, source: bareSource }), [], "bare yield has no fabricated value operand");
    }
  });
}

for (const closureKind of ["ArrowFunction", "FunctionExpression"]) test(`MIR ${closureKind} capture location uses exact qualified identity and excludes nested executable nodes`, () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const definition = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "arrow", ordinal: 0 }] });
  const nested = identities.encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
  const outer = identities.encodeBodyId({ owner: context.source.owner, role: "function", ordinal: 1 });
  const captured = { body: outer, local: identities.localId(3) };
  const header = (id, parent) => ({ id: identities.nodeId(id), origin: base.blocks[0].origin,
    parent: parent === null ? null : identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
  const nestedRoot = { ...header(3, 2), kind: "Block", multiLine: false, tsonic: null, statements: { loc: { pos: 0, end: 0 }, nodes: [
    { ...header(4, 3), kind: "ReturnStatement", expression: null, tsonic: null },
  ] } };
  const callable = { ...header(2, 1), modifiers: null, typeParameters: null,
    parameters: { loc: { pos: 0, end: 0 }, nodes: [] }, type: null, fullSignature: null, asteriskToken: null,
    body: nestedRoot,
    tsonic: { type: identities.tyId(5), convertedType: identities.tyId(5), conversion: { kind: "identity" }, narrowing: null,
      evidenceIndex: null, demand: { kind: "always" }, callable: { definition, parameters: [], signatures: [],
        template: { body: nested, lexicalBindings: bindingVector, dependence: "parametric" }, attributes: [] }, captures: [captured],
      closure: { kind: "decided", decision: { carrier: identities.tyId(5), captures: ["captured-location"], execution: { kind: "pure" } } } } };
  const arrow = closureKind === "ArrowFunction"
    ? { ...callable, kind: closureKind, equalsGreaterThanToken: { ...header(7, 2), kind: "EqualsGreaterThanToken", tsonic: null } }
    : { ...callable, kind: closureKind, name: null };
  const source = { ...context.source, captures: [captured], nestedBodies: [nested], locals: [{ id: identities.localId(0),
    declaration: { kind: "body", value: { body: base.body, node: identities.nodeId(2) } }, name: "captured", role: "capture",
    capturedFrom: captured, mutable: true, storage: identities.tyId(1) }], root: { ...context.source.root,
    statements: { loc: { pos: 0, end: 0 }, nodes: [{ ...header(1, 0), kind: "ExpressionStatement", expression: arrow, tsonic: null },
      { ...header(6, 0), kind: "ReturnStatement", expression: null, tsonic: null }] } } };
  const types = { terms: [...context.types.terms, { kind: "callable", calls: [identities.sigId(1)], constructs: [] }], signatures: [context.types.signatures[0],
    { ...context.types.signatures[0], id: identities.sigId(1), declaration: definition, owner: null }] };
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const capture = { id: identities.localId(1), storage: identities.tyId(1), role: { kind: "capture", index: 0 }, source: captured, origin: local.origin };
  const places = [{ id: identities.placeId(0), storage: local.storage, base: { kind: "local", local: local.id }, origin: local.origin },
    { id: identities.placeId(1), storage: capture.storage, base: { kind: "local", local: capture.id }, origin: local.origin }];
  const value = { kind: "closure", instance: { body: nested, bindings: { kind: "parametric" } }, captures: [{ local: captured, place: places[1].id }] };
  const body = { ...base, locals: [local, capture], places, blocks: [{ ...base.blocks[0], statements: [
    { ...site, kind: "storage-live", local: local.id },
    { ...site, tir: { body: base.body, node: identities.nodeId(2) }, kind: "assign", step: null, place: places[0].id, value },
  ], terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: identities.nodeId(6) } } }] };
  const input = { ...context, source, types };
  context.declarations.set(definition, { scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] },
    parameterCount: 0, endpoints: [{ declaration: definition, role: "api-body", signature: identities.sigId(1), body: nested }] });
  context.bodyOwners.set(nested, definition);
  same(verified(body, input), [], "complete exact qualified closure capture vector");
  const noCaptures = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...value, captures: [] },
  }] }] };
  same(verified(noCaptures, input), [expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 })],
    "a physical closure cannot omit its actual selected capture slot");
  const differentCaptured = { ...captured, local: identities.localId(4) };
  const wrongSelectedSlot = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...value, captures: [{ local: differentCaptured, place: places[1].id }] },
  }] }] };
  same(verified(wrongSelectedSlot, input), [
    expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 }),
    expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 }),
  ], "selected capture identity and physical root identity are independently exact");
  const nonordinalCapture = { ...body, locals: [local, { ...capture, role: { kind: "capture", index: -1 } }] };
  same(verified(nonordinalCapture, input), [expectedViolation("capture-location-exact", { kind: "local", local: 1 })],
    "a nonordinal capture index is not a valid borrowed source slot");
  const wrongPlace = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...value, captures: [{ local: captured, place: places[0].id }] },
  }] }] };
  same(verified(wrongPlace, input), [expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 })],
    "the correct capture label cannot authenticate an unrelated live temporary place");
  const projected = { ...body, locals: [local, { ...capture, storage: identities.tyId(6) }], places: [places[0],
    { ...places[1], storage: identities.tyId(6) }, { ...places[1], id: identities.placeId(2),
      base: { kind: "place", place: places[1].id, projection: { kind: "element", index: 0 }, tir: nodeRef } }],
    blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], { ...body.blocks[0].statements[1],
      value: { ...value, captures: [{ local: captured, place: identities.placeId(2) }] },
    }] }] };
  const projectedInput = { ...input, source: { ...source, locals: [{ ...source.locals[0], storage: identities.tyId(6) }] },
    types: { ...types, terms: [...types.terms, { kind: "tuple", readonly: false,
      elements: [{ kind: "required", type: identities.tyId(1), declaration: null }] }] } };
  same(verified(projected, projectedInput), [], "a real tuple projection preserves its actual paired capture root identity");
  const staticCapture = { ...body, places: [...places, { ...places[1], id: identities.placeId(2),
    base: { kind: "static", definition: context.source.owner } }], blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
      ...body.blocks[0].statements[1], value: { ...value, captures: [{ local: captured, place: identities.placeId(2) }] },
    }] }] };
  same(verified(staticCapture, input), [expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 })],
    "static storage cannot impersonate the declared captured local");
  const missingCapture = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], value: { ...value, captures: [{ local: captured, place: identities.placeId(99) }] },
  }] }] };
  same(verified(missingCapture, input), [expectedViolation("operand-resolves", { kind: "instruction", block: 0, statement: 1 })],
    "a missing capture place remains an unresolved reference rather than an invented paired location");
  const invalidRoot = { ...body, places: [...places, { ...places[1], id: identities.placeId(2),
    base: { kind: "place", place: identities.placeId(2), projection: { kind: "deref" }, tir: nodeRef } }], blocks: [{ ...body.blocks[0], statements: [
    body.blocks[0].statements[0], { ...body.blocks[0].statements[1], value: { ...value, captures: [{ local: captured, place: identities.placeId(2) }] } },
  ] }] };
  same(verified(invalidRoot, input), [expectedViolation("place-parent-precedes", { kind: "place", place: 2 })],
    "an invalid parent chain retains its exact reference violation without fabricating a root identity");
  const wrongPosition = { ...body, locals: [local, { ...capture, source: { ...captured, local: identities.localId(4) } }] };
  same(verified(wrongPosition, input), [expectedViolation("capture-location-exact", { kind: "local", local: 1 }),
    expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 })],
  "qualified capture slots also compare their actual local number, not just the outer body");
  context.bodyOwners.set(nested, null);
  same(verified(body, input), [expectedViolation("definition-resolves", { kind: "instruction", block: 0, statement: 1 })],
    "a selected closure with unknown canonical owner remains an unresolved definition");
  context.bodyOwners.set(nested, definition);
  const wrongCapture = { ...body, locals: [local, { ...capture, source: { body: base.body, local: identities.localId(3) } }] };
  same(verified(wrongCapture, input), [expectedViolation("capture-location-exact", { kind: "local", local: 1 }),
    expectedViolation("capture-location-exact", { kind: "instruction", block: 0, statement: 1 })],
  "same numeric local in a foreign body invalidates both its declared capture and the paired use");
  const nestedReference = { ...body, blocks: [{ ...body.blocks[0], tir: { body: base.body, node: identities.nodeId(3) } }] };
  same(verified(nestedReference, input), [expectedViolation("tir-node-resolves", { kind: "block", block: 0 })], "nested body root excluded from containing source inventory");
  const wrongSource = { ...body, blocks: [{ ...body.blocks[0], statements: [body.blocks[0].statements[0], {
    ...body.blocks[0].statements[1], tir: { body: base.body, node: identities.nodeId(0) },
  }] }] };
  same(verified(wrongSource, input), [expectedViolation("operation-selected", { kind: "instruction", block: 0, statement: 1 })],
    "an existing unrelated source node cannot stand in for the actual closure selection");
});

for (const kind of ["FunctionDeclaration", "Constructor", "MethodDeclaration", "GetAccessor", "SetAccessor",
  "PropertyDeclaration", "PropertySignature", "EnumMember", "ClassStaticBlockDeclaration", "ModuleDeclaration"]) {
  for (const present of kind === "ClassStaticBlockDeclaration" ? [true] : [false, true]) test(`MIR source inventory preserves outer ${kind} metadata and excludes ${present ? "present" : "absent"} executable children`, () => {
    const base = parsedBody();
    const context = sourceContext(base);
    const containerDefinition = identities.encodeDefId({ module: base.blocks[0].origin.module, segments: [{ name: "Container", ordinal: 0 }] });
    const segments = kind === "FunctionDeclaration" || kind === "ModuleDeclaration" ? [{ name: "nested", ordinal: 0 }]
      : [{ name: "Container", ordinal: 0 }, { name: "nested", ordinal: 0 }];
    const definition = identities.encodeDefId({ module: base.blocks[0].origin.module, segments });
    const role = kind === "ModuleDeclaration" ? "module" : kind === "ClassStaticBlockDeclaration" ? "class-static-initializer"
      : kind === "EnumMember" ? "enum-member-initializer" : kind === "PropertyDeclaration" || kind === "PropertySignature" ? "field-initializer" : "function";
    const nested = identities.encodeBodyId({ owner: definition, role, ordinal: 0 });
    let next = 1;
    const header = parent => ({ id: identities.nodeId(next++), origin: base.blocks[0].origin,
      parent: identities.nodeId(parent), flags: [], loc: { pos: 0, end: 0 } });
    const list = nodes => ({ loc: { pos: 0, end: 0 }, nodes });
    const excluded = [];
    const template = { body: nested, lexicalBindings: bindingVector, dependence: "parametric" };
    const typedValue = { type: identities.tyId(1), convertedType: identities.tyId(1), conversion: { kind: "identity" },
      narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value" };
    const callable = () => ({ definition, parameters: [], signatures: [], template: present ? template : null, attributes: [] });
    const block = parent => {
      const own = header(parent);
      const returned = { ...header(own.id), kind: "ReturnStatement", expression: null, tsonic: null };
      excluded.push(own.id, returned.id);
      return { ...own, kind: "Block", statements: list([returned]), multiLine: false, tsonic: null };
    };
    const propertyName = parent => ({ ...header(parent), kind: "Identifier", text: "x",
      tsonic: { role: "property-name", key: { kind: "text", value: "x" } } });
    let statement;
    let boundary;
    if (kind === "FunctionDeclaration" || kind === "Constructor" || kind === "MethodDeclaration" || kind === "GetAccessor" || kind === "SetAccessor") {
      const classHeader = kind === "FunctionDeclaration" ? null : header(0);
      const own = header(classHeader === null ? 0 : classHeader.id);
      const name = kind === "FunctionDeclaration" || kind === "Constructor" ? null : propertyName(own.id);
      const parameter = header(own.id);
      const reference = { body: nested, local: identities.localId(0) };
      const parameterDefinition = identities.encodeDefId({ module: base.blocks[0].origin.module,
        segments: [...segments, { name: "value", ordinal: 0 }] });
      const parameterName = { ...header(parameter.id), kind: "Identifier", text: "value",
        tsonic: { role: "declaration-name", declaration: { kind: "local", local: reference }, storage: identities.tyId(1) } };
      excluded.push(parameter.id, parameterName.id);
      const parameters = list([{ ...parameter, kind: "Parameter", modifiers: null, dotDotDotToken: null,
        name: parameterName, questionToken: null, type: null, initializer: null,
        tsonic: { declaration: parameterDefinition, local: reference, storage: identities.tyId(1), passing: "by-value", initializer: null } }]);
      const fields = { ...own, kind, modifiers: null, typeParameters: null, parameters, type: null, fullSignature: null,
        asteriskToken: null, body: present ? block(own.id) : null, tsonic: callable() };
      boundary = kind === "Constructor" ? fields : kind === "FunctionDeclaration" ? { ...fields, name: null }
        : { ...fields, name, postfixToken: null };
      statement = classHeader === null ? boundary : { ...classHeader, kind: "ClassDeclaration", modifiers: null, name: null,
        typeParameters: null, heritageClauses: null, members: list([boundary]), tsonic: { definition: containerDefinition, parameters: [],
          type: identities.tyId(5), heritage: [], members: [definition], attributes: [] } };
    } else if (kind === "ModuleDeclaration") {
      const own = header(0);
      const name = { ...header(own.id), kind: "Identifier", text: "Nested", tsonic: { role: "declaration-name",
        declaration: { kind: "definition", definition }, storage: null } };
      const body = present ? { ...header(own.id), kind: "ModuleBlock", statements: list([]), tsonic: null } : null;
      if (body !== null) excluded.push(body.id);
      boundary = { ...own, kind, modifiers: null, asteriskToken: null, body, keyword: "NamespaceKeyword", name,
        tsonic: { definition, type: identities.tyId(5), template: present ? template : null } };
      statement = boundary;
    } else {
      const owner = header(0);
      const ownerName = { ...header(owner.id), kind: "Identifier", text: "Container", tsonic: { role: "declaration-name",
        declaration: { kind: "definition", definition: containerDefinition }, storage: null } };
      const own = header(owner.id);
      if (kind === "ClassStaticBlockDeclaration") {
        const body = block(own.id);
        boundary = { ...own, kind, modifiers: null, body, tsonic: { template } };
      } else {
        const name = propertyName(own.id);
        const initializer = present ? { ...header(own.id), kind: "TrueKeyword", tsonic: typedValue } : null;
        if (initializer !== null) excluded.push(initializer.id);
        const fields = { ...own, kind, modifiers: null, name, postfixToken: null, initializer,
          tsonic: { definition, storage: identities.tyId(1), initializer: present ? nested : null, attributes: [] } };
        boundary = kind === "EnumMember" ? fields : { ...fields, type: null };
      }
      statement = kind === "EnumMember" ? { ...owner, kind: "EnumDeclaration", modifiers: null, name: ownerName,
        members: list([boundary]), tsonic: { definition: containerDefinition, type: identities.tyId(5), members: [definition] } }
        : kind === "PropertySignature" ? { ...owner, kind: "InterfaceDeclaration", modifiers: null, name: ownerName,
          typeParameters: null, heritageClauses: null, members: list([boundary]),
          tsonic: { definition: containerDefinition, parameters: [], type: identities.tyId(5), members: [definition] } }
        : { ...owner, kind: "ClassDeclaration", modifiers: null, name: ownerName, typeParameters: null, heritageClauses: null,
          members: list([boundary]), tsonic: { definition: containerDefinition, parameters: [], type: identities.tyId(5), heritage: [], members: [definition], attributes: [] } };
    }
    const returned = { ...header(0), kind: "ReturnStatement", expression: null, tsonic: null };
    const source = { ...context.source, root: { ...context.source.root, statements: list([statement, returned]) },
      nestedBodies: present ? [nested] : [] };
    const body = { ...base, blocks: [{ ...base.blocks[0], tir: { body: base.body, node: boundary.id },
      terminator: { ...base.blocks[0].terminator, tir: { body: base.body, node: returned.id } } }] };
    const containerType = kind === "EnumMember" ? { kind: "enum", definition: containerDefinition }
      : kind === "ModuleDeclaration" ? { kind: "shape", members: [], indexes: [], calls: [], constructs: [] }
      : { kind: "declared", definition: containerDefinition, arguments: [], facet: "instance", extent: null };
    const input = { ...context, source, types: { ...context.types, terms: [...context.types.terms, containerType] } };
    same(verified(body, input), [], "outer declaration remains a genuine node of this body");
    for (const node of excluded) same(verified({ ...body, blocks: [{ ...body.blocks[0], tir: { body: base.body, node } }] }, input),
      [expectedViolation("tir-node-resolves", { kind: "block", block: 0 })], "nested executable/parameter node cannot be borrowed by the containing body");
  });
}

test("MIR constant uniqueness and UTF-16 order use the complete declared record including authored tokens", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const rational = { numerator: 0n, denominator: 1n, negativeZero: false };
  const first = { id: identities.constId(0), type: identities.tyId(3), value: { kind: "literal", value: { kind: "number", token: "0", value: rational } } };
  const second = { id: identities.constId(1), type: identities.tyId(3), value: { kind: "literal", value: { kind: "number", token: "0.0", value: rational } } };
  same(verified({ ...body, constants: [first, second] }, context), [], "different tokens are different full-record keys, even for the same rational");
  const reversed = [{ ...second, id: identities.constId(0) }, { ...first, id: identities.constId(1) }];
  same(verified({ ...body, constants: reversed }, context), [expectedViolation("constants-order", { kind: "constant", constant: 1 })], "full literal token participates in the complete minimal order vector");
  const duplicated = [first, { ...first, id: identities.constId(1) }];
  same(verified({ ...body, constants: duplicated }, context), [expectedViolation("constant-unique", { kind: "constant", constant: 1 })], "identical full-record key duplicates");
});

test("MIR switch keys are unique and increasing while all target and constant identities retain their own domains", () => {
  const body = parsedBody();
  const context = sourceContext(body);
  const constants = [
    { id: identities.constId(0), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: false } } },
    { id: identities.constId(1), type: identities.tyId(1), value: { kind: "literal", value: { kind: "boolean", value: true } } },
  ];
  const selector = { ...body, constants, blocks: [{ ...body.blocks[0], terminator: { ...body.blocks[0].terminator, kind: "switch", step: null,
    operand: { kind: "constant", constant: identities.constId(0) }, targets: [{ constant: identities.constId(0), target: identities.blockId(0) },
      { constant: identities.constId(1), target: identities.blockId(0) }], otherwise: identities.blockId(0) } }] };
  same(verified(selector, context), [], "complete increasing switch vector");
  const at = { kind: "instruction", block: 0, statement: null };
  const reversed = { ...selector, blocks: [{ ...selector.blocks[0], terminator: { ...selector.blocks[0].terminator,
    targets: [...selector.blocks[0].terminator.targets].reverse() } }] };
  same(verified(reversed, context), [expectedViolation("switch-targets-order", at, [{ kind: "number", value: 1 }, { kind: "number", value: 0 }])], "complete reversed target order vector");
  const duplicate = { ...selector, blocks: [{ ...selector.blocks[0], terminator: { ...selector.blocks[0].terminator,
    targets: [selector.blocks[0].terminator.targets[0], selector.blocks[0].terminator.targets[0]] } }] };
  same(verified(duplicate, context), [expectedViolation("switch-target-unique", at, [{ kind: "number", value: 0 }]),
    expectedViolation("switch-targets-order", at, [{ kind: "number", value: 0 }, { kind: "number", value: 0 }])], "duplicate target owns the complete two-rule vector");
});

function operationRoundtrip(identity, identityText, label) {
  const selected = { decision: { kind: "selected", operation: identity, operands: [0], result: 0, execution: { kind: "pure" } }, permissionScope: null };
  const selectedText = `TypedOperation(decision=selected(operation=${identityText}, operands=[t:0], result=t:0, execution=pure()), permissionScope=null)`;
  const statement = { ...site, kind: "assign", step: null, place: 0, value: { kind: "unary", operation: selected, operand: placeOperand } };
  const terminator = { ...site, kind: "unreachable" };
  roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [statement], terminator }] },
    document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[assign(${siteText}, place=p:0, value=unary(operation=${selectedText}, operand=${operandText}), step=null)], terminator=unreachable(${siteText}))`), label);
}

const sourceReference = { kind: "body", value: nodeRef };
const sourceReferenceText = `body(value=${nodeText})`;
const itemReference = { kind: "item", value: { owner: endpoint.declaration, node: 2 } };
const itemReferenceText = 'item(value=ItemNodeRef(owner=def:"D[M[P[p];m];run]", node=n:2))';
const emptyComponent = { root: sourceReference, path: [] };
const emptyComponentText = `TypeComponent(root=${sourceReferenceText}, path=[])`;
const selectorVectors = [
  [{ kind: "class-value" }, "class-value()"],
  [{ kind: "construction-argument", definition: { occurrence: nodeRef, captures: [{ body: bodyIdentity, local: 0 }] }, index: 1 },
    `construction-argument(definition=ConstructionDefinition(occurrence=${nodeText}, captures=[LocalRef(body=body:${JSON.stringify(bodyIdentity)}, local=l:0)]), index=1)`],
  [{ kind: "optional-value" }, "optional-value()"], [{ kind: "array-element" }, "array-element()"],
  [{ kind: "tuple-element", index: 1 }, "tuple-element(index=1)"],
  [{ kind: "union-member", index: 2 }, "union-member(index=2)"],
  [{ kind: "argument-place", index: 3 }, "argument-place(index=3)"],
  [{ kind: "parameter-place", index: 4 }, "parameter-place(index=4)"],
  [{ kind: "intersection-member", index: 5 }, "intersection-member(index=5)"],
  [{ kind: "intersection-result" }, "intersection-result()"],
  [{ kind: "argument-tail", start: 1 }, "argument-tail(start=1)"],
  [{ kind: "parameter-tail", start: 2 }, "parameter-tail(start=2)"],
  [{ kind: "member", origin: { kind: "declared", declaration: endpoint.declaration } }, 'member(origin=declared(declaration=def:"D[M[P[p];m];run]"))'],
  [{ kind: "index-key", declaration: endpoint.declaration }, 'index-key(declaration=def:"D[M[P[p];m];run]")'],
  [{ kind: "index-value", declaration: endpoint.declaration }, 'index-value(declaration=def:"D[M[P[p];m];run]")'],
  [{ kind: "projection-source" }, "projection-source()"],
  [{ kind: "parameter", signature: 1, index: 2 }, "parameter(signature=sig:1, index=2)"],
  [{ kind: "receiver", signature: 3 }, "receiver(signature=sig:3)"],
  [{ kind: "signature-tail", signature: 4, start: 5, readonly: false }, "signature-tail(signature=sig:4, start=5, readonly=false)"],
  [{ kind: "tuple-slice", start: 1, endCount: 2, readonly: true }, "tuple-slice(start=1, endCount=2, readonly=true)"],
  [{ kind: "result", signature: 6 }, "result(signature=sig:6)"],
  [{ kind: "type-argument", declaration: endpoint.declaration, index: 7 }, 'type-argument(declaration=def:"D[M[P[p];m];run]", index=7)'],
  [{ kind: "sum-arm", family: { origin: "authored", component: emptyComponent, parameters: [{ owner: endpoint.declaration, index: 0 }],
    roles: [{ authoredIndex: 0, component: itemReference, member: 8 }] }, index: 0 },
    `sum-arm(family=SumFamily(origin="authored", component=${emptyComponentText}, parameters=[TypeParameterIdentity(owner=def:"D[M[P[p];m];run]", index=0)], roles=[SumArmRole(authoredIndex=0, component=${itemReferenceText}, member=t:8)]), index=0)`],
  [{ kind: "awaited" }, "awaited()"],
];

for (const [selector, selectorText] of selectorVectors) {
  test(`MIR nested type component ${selector.kind} retains all constructor fields`, () => {
    const destination = { root: sourceReference, path: [selector] };
    const destinationText = `TypeComponent(root=${sourceReferenceText}, path=[${selectorText}])`;
    const part = { part: 0, source: nodeRef, destination, member: null, embedding: { kind: "identity" } };
    operationRoundtrip({ kind: "object-construction", parts: [part] },
      `object-construction(parts=[ConstructionPartDecision(part=0, source=${nodeText}, destination=${destinationText}, member=null, embedding=identity())])`, selector.kind);
    if (selector.kind === "sum-arm") {
      const inferred = { ...selector, family: { ...selector.family, origin: "inferred" } };
      const selected = { ...part, destination: { ...destination, path: [inferred] } };
      const inferredText = destinationText.replace('origin="authored"', 'origin="inferred"');
      operationRoundtrip({ kind: "object-construction", parts: [selected] },
        `object-construction(parts=[ConstructionPartDecision(part=0, source=${nodeText}, destination=${inferredText}, member=null, embedding=identity())])`, "inferred sum family");
    }
  });
}

for (const conversion of ["numeric", "literal-fit", "absence", "union-injection", "shape", "callable", "readonly"]) {
  test(`MIR embedding ${conversion} retains exact proof graph, source refs and premise order`, () => {
    const target = { root: itemReference, path: [] };
    const targetText = `TypeComponent(root=${itemReferenceText}, path=[])`;
    const steps = [{ from: emptyComponent, to: target, rule: "identity", premises: [] },
      { from: target, to: emptyComponent, rule: conversion, premises: [0] }];
    const embedding = { kind: "conversion", conversion, proof: { steps, conclusion: 1 }, check: { kind: "none" } };
    const embeddingText = `conversion(conversion=${JSON.stringify(conversion)}, proof=EmbeddingProof(steps=[CorrespondenceStep(from=${emptyComponentText}, to=${targetText}, rule="identity", premises=[]), CorrespondenceStep(from=${targetText}, to=${emptyComponentText}, rule=${JSON.stringify(conversion)}, premises=[0])], conclusion=1), check=none())`;
    operationRoundtrip({ kind: "conversion", from: 0, to: 1, embedding }, `conversion(from=t:0, to=t:1, embedding=${embeddingText})`, conversion);
  });
}

for (const reason of ["incompatible-domain", "lossy-numeric", "missing-correspondence", "passing-mode", "rigid-parameter"]) {
  test(`MIR embedding refusal ${reason} is actual typed data, never an exception or silent replacement`, () => {
    operationRoundtrip({ kind: "conversion", from: 0, to: 1, embedding: { kind: "refused", reason } },
      `conversion(from=t:0, to=t:1, embedding=refused(reason=${JSON.stringify(reason)}))`, reason);
  });
}

test("MIR binding families retain complete bound/rigid parameter identities and both self-binding arms", () => {
  const parameter = { owner: endpoint.declaration, index: 0 };
  const parameterText = 'TypeParameterIdentity(owner=def:"D[M[P[p];m];run]", index=0)';
  const bindings = { classBindings: [{ kind: "bound", parameter, type: 1 }], methodBindings: [{ kind: "rigid", parameter }],
    capturedBindings: [{ kind: "bound", parameter: { ...parameter, index: 1 }, type: 2 }],
    selfBindings: [{ kind: "bound", owner: endpoint.declaration, type: 3 }, { kind: "rigid", owner: endpoint.declaration }] };
  const text = `BindingVector(classBindings=[bound(parameter=${parameterText}, type=t:1)], methodBindings=[rigid(parameter=${parameterText})], capturedBindings=[bound(parameter=TypeParameterIdentity(owner=def:"D[M[P[p];m];run]", index=1), type=t:2)], selfBindings=[bound(owner=def:"D[M[P[p];m];run]", type=t:3), rigid(owner=def:"D[M[P[p];m];run]")])`;
  roundtrip({ ...emptyValue, bindings: { kind: "instantiated", bindings } }, document("", "", "", "", `instantiated(bindings=${text})`), "complete binding families");
});

test("MIR protocol steps retain every role and all call/core/completion alternatives", () => {
  const roles = ["acquire", "next", "done", "value", "finish", "fail", "await", "dispose", "completion"];
  const kinds = ["iterate", "await", "yield", "delegate", "dispose", "spread", "argument-passing", "pointer"];
  const operations = [{ kind: "call", application }, { kind: "core", declaration: endpoint.declaration, bindings: bindingVector }, { kind: "completion" }];
  const texts = [`call(application=${applicationText})`, `core(declaration=def:"D[M[P[p];m];run]", bindings=${bindingText})`, "completion()"];
  for (const protocol of kinds) {
    const steps = roles.map((role, position) => ({ role, operation: operations[position % 3], operands: [0, 1], result: 2 }));
    const stepsText = roles.map((role, position) => `ProtocolStepDecision(role=${JSON.stringify(role)}, operation=${texts[position % 3]}, operands=[t:0, t:1], result=t:2)`).join(", ");
    const selected = { kind: "protocol", protocol, asynchronous: false, steps, value: 0, completion: 1, yielded: 2, sent: null, thrown: 3 };
    operationRoundtrip(selected, `protocol(protocol=${JSON.stringify(protocol)}, asynchronous=false, steps=[${stepsText}], value=t:0, completion=t:1, yielded=t:2, sent=null, thrown=t:3)`, protocol);
  }
});

for (const carrier of ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "int128", "uint128", "native-int", "native-uint", "float16", "float32", "float64", "decimal"]) {
  test(`MIR native carrier ${carrier} remains exact owner data`, () => operationRoundtrip(
    { kind: "native-operator", operator: "+", carrier }, `native-operator(operator="+", carrier=${JSON.stringify(carrier)})`, carrier));
}

for (const operator of ["+", "-", "!", "~", "typeof", "void", "delete", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>", "<", "<=", ">", ">=", "==", "!=", "===", "!==", "in", "instanceof"]) {
  test(`MIR unary/binary operator spelling ${operator} is not interpreted by the text codec`, () => operationRoundtrip(
    { kind: "native-operator", operator, carrier: "int32" }, `native-operator(operator=${JSON.stringify(operator)}, carrier="int32")`, operator));
  test(`MIR bigint operator spelling ${operator} is retained without an implicit native carrier`, () => operationRoundtrip(
    { kind: "bigint-operator", operator }, `bigint-operator(operator=${JSON.stringify(operator)})`, `bigint ${operator}`));
}

for (const operator of ["+", "==", "!=", "===", "!==", "<", "<=", ">", ">="]) test(`MIR string operation ${operator} retains its closed operator`, () => operationRoundtrip(
  { kind: "string-operator", operator }, `string-operator(operator=${JSON.stringify(operator)})`, `string ${operator}`));

for (const operator of ["!", "&&", "||", "==", "!=", "===", "!=="]) test(`MIR Boolean operation ${operator} retains its closed operator`, () => operationRoundtrip(
  { kind: "boolean-operator", operator }, `boolean-operator(operator=${JSON.stringify(operator)})`, `Boolean ${operator}`));

test("MIR negated absence test retains its explicit Boolean without interpreting source null versus undefined", () => operationRoundtrip(
  { kind: "absence-test", negated: true }, "absence-test(negated=true)", "negated absence"));

test("MIR member keys, origins and accessor endpoints retain exact nested selections", () => {
  const keys = [
    [{ kind: "text", value: "x" }, 'text(value="x")'],
    [{ kind: "number", value: { numerator: -1n, denominator: 2n, negativeZero: false } }, 'number(value=ExactRational(numerator=-1n, denominator=2n, negativeZero=false))'],
    [{ kind: "symbol", declaration: endpoint.declaration }, 'symbol(declaration=def:"D[M[P[p];m];run]")'],
  ];
  for (const [key, keyText] of keys) {
    const origins = [{ kind: "declared", declaration: endpoint.declaration }, { kind: "class-prototype", owner: endpoint.declaration },
      { kind: "mapped", owner: itemReference, key }, { kind: "mapped", owner: sourceReference, key }];
    const originsText = `declared(declaration=def:"D[M[P[p];m];run]"), class-prototype(owner=def:"D[M[P[p];m];run]"), mapped(owner=${itemReferenceText}, key=${keyText}), mapped(owner=${sourceReferenceText}, key=${keyText})`;
    const getter = { ...endpoint, role: "api-body", body: null };
    const getterText = 'HirCallableEndpoint(declaration=def:"D[M[P[p];m];run]", role="api-body", signature=sig:0, body=null)';
    const decision = { key, origins, selectedDeclarations: [endpoint.declaration], primary: endpoint.declaration,
      read: null, write: 1, getter, setter: getter, bindings: bindingVector, location: { kind: "accessor" } };
    const decisionText = `MemberDecision(key=${keyText}, origins=[${originsText}], selectedDeclarations=[def:"D[M[P[p];m];run]"], primary=def:"D[M[P[p];m];run]", read=null, write=t:1, getter=${getterText}, setter=${getterText}, bindings=${bindingText}, location=accessor())`;
    const selected = { decision, getter: callee, setter: callee };
    const selectedText = `MemberSelection(decision=${decisionText}, getter=${calleeText}, setter=${calleeText})`;
    const place = { id: 0, storage: 1, base: { kind: "place", place: 1, projection: { kind: "field", member: selected }, tir: nodeRef }, origin };
    roundtrip({ ...emptyValue, places: [place] }, document("", "", `MirPlace(id=p:0, base=place(place=p:1, projection=field(member=${selectedText}), tir=${nodeText}), storage=t:1, origin=${originText})`, ""), `complete ${key.kind} member metadata`);
    const part = { part: 0, source: nodeRef, destination: emptyComponent, member: decision, embedding: { kind: "identity" } };
    operationRoundtrip({ kind: "array-construction", parts: [part] }, `array-construction(parts=[ConstructionPartDecision(part=0, source=${nodeText}, destination=${emptyComponentText}, member=${decisionText}, embedding=identity())])`, `selected ${key.kind} construction member`);
  }
});

test("MIR application parameter mappings preserve expanded, default, omitted and rest data without normalization", () => {
  const parameters = [
    { kind: "argument", parameter: 0, argument: 1, component: null, passing: "by-value" },
    { kind: "argument", parameter: 1, argument: 0, component: 2, passing: "borrow-mut" },
    { kind: "default", parameter: 2, initializer: bodyIdentity },
    { kind: "omitted", parameter: 3, type: 4 },
    { kind: "rest", parameter: 4, arguments: [], passing: "move" },
    { kind: "rest", parameter: 5, arguments: [1, 0], passing: "byref-readonly" },
  ];
  const text = `argument(parameter=0, argument=1, component=null, passing="by-value"), argument(parameter=1, argument=0, component=2, passing="borrow-mut"), default(parameter=2, initializer=body:${JSON.stringify(bodyIdentity)}), omitted(parameter=3, type=t:4), rest(parameter=4, arguments=[], passing="move"), rest(parameter=5, arguments=[1, 0], passing="byref-readonly")`;
  const decision = { ...application, parameters, completion: { signature: 0, completion: 1, yielded: 2, sent: 3 } };
  const decisionText = `ApplicationDecision(candidate=0, advertised=${endpointText}, api=${apiText}, bindings=${bindingText}, implementationBindings=${bindingText}, parameters=[${text}], completion=CompletionEndpoint(signature=sig:0, completion=t:1, yielded=t:2, sent=t:3), result=t:0, activation=null)`;
  const selected = { decision, activation: null, captures: [] };
  const selectedText = `ResolvedCallee(decision=${decisionText}, activation=null, captures=[])`;
  const terminator = { ...site, kind: "call", step: null, callee: { kind: "direct", resolution: selected }, receiver: null,
    arguments: [], destination: null, next: 0, unwind: { kind: "escape" } };
  roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [], terminator }] }, document("", "", "",
    `MirBlock(${siteText}, id=b:0, statements=[], terminator=call(${siteText}, callee=direct(resolution=${selectedText}), receiver=null, arguments=[], destination=null, next=b:0, unwind=escape(), step=null))`), "all physical mapping alternatives");
});

test("MIR decision check, location, execution and activation fields retain every value", () => {
  const checks = [[{ kind: "none" }, "none()"], [{ kind: "required", failure: "unwind" }, 'required(failure="unwind")'],
    [{ kind: "required", failure: "abort" }, 'required(failure="abort")']];
  const step = { from: emptyComponent, to: emptyComponent, rule: "numeric", premises: [] };
  const stepText = `CorrespondenceStep(from=${emptyComponentText}, to=${emptyComponentText}, rule="numeric", premises=[])`;
  for (const [check, checkText] of checks) {
    operationRoundtrip({ kind: "conversion", from: 0, to: 1, embedding: { kind: "conversion", conversion: "numeric", proof: { steps: [step], conclusion: 0 }, check } },
      `conversion(from=t:0, to=t:1, embedding=conversion(conversion="numeric", proof=EmbeddingProof(steps=[${stepText}], conclusion=0), check=${checkText}))`,
      `conversion check ${checkText}`);
    for (const receiver of ["in-place", "by-reference"]) {
      const decision = { key: { kind: "text", value: "x" }, origins: [], selectedDeclarations: [], primary: null, read: 1, write: 1,
        getter: null, setter: null, bindings: bindingVector, location: { kind: "data", check, receiver } };
      const decisionText = `MemberDecision(key=text(value="x"), origins=[], selectedDeclarations=[], primary=null, read=t:1, write=t:1, getter=null, setter=null, bindings=${bindingText}, location=data(check=${checkText}, receiver="${receiver}"))`;
      const part = { part: 0, source: nodeRef, destination: emptyComponent, member: decision, embedding: { kind: "identity" } };
      operationRoundtrip({ kind: "array-construction", parts: [part] },
        `array-construction(parts=[ConstructionPartDecision(part=0, source=${nodeText}, destination=${emptyComponentText}, member=${decisionText}, embedding=identity())])`,
        `data location ${checkText} ${receiver}`);
    }
  }
  const terminator = { ...site, kind: "unreachable" };
  for (const writesStorage of [false, true]) for (const failure of ["none", "unwind", "abort"]) {
    const selected = { decision: { kind: "selected", operation: { kind: "discard" }, operands: [0], result: 0,
      execution: { kind: "invocation", writesStorage, failure } }, permissionScope: null };
    const selectedText = `TypedOperation(decision=selected(operation=discard(), operands=[t:0], result=t:0, execution=invocation(writesStorage=${writesStorage}, failure="${failure}")), permissionScope=null)`;
    const statement = { ...site, kind: "assign", step: null, place: 0, value: { kind: "unary", operation: selected, operand: placeOperand } };
    roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [statement], terminator }] },
      document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[assign(${siteText}, place=p:0, value=unary(operation=${selectedText}, operand=${operandText}), step=null)], terminator=unreachable(${siteText}))`),
      `invocation execution ${writesStorage} ${failure}`);
  }
  for (const activation of ["at-creation", "when-first-driven"]) {
    const selected = { decision: { ...application, activation }, activation: null, captures: [] };
    const selectedText = `ResolvedCallee(decision=${applicationText.replace("result=t:0, activation=null", `result=t:0, activation="${activation}"`)}, activation=null, captures=[])`;
    const call = { ...site, kind: "call", step: null, callee: { kind: "direct", resolution: selected }, receiver: null,
      arguments: [], destination: null, next: 0, unwind: { kind: "escape" } };
    roundtrip({ ...emptyValue, blocks: [{ ...site, id: 0, statements: [], terminator: call }] }, document("", "", "",
      `MirBlock(${siteText}, id=b:0, statements=[], terminator=call(${siteText}, callee=direct(resolution=${selectedText}), receiver=null, arguments=[], destination=null, next=b:0, unwind=escape(), step=null))`),
      `handle activation ${activation}`);
  }
});

test("MIR 100000-place parent chain prints, parses, type-checks and reaches its real terminal operand without recursion", () => {
  const base = parsedBody();
  const context = sourceContext(base);
  const count = 100000;
  const local = { id: identities.localId(0), storage: identities.tyId(5), role: { kind: "temporary" }, source: null, origin: base.blocks[0].origin };
  const places = [{ id: identities.placeId(0), storage: identities.tyId(5), base: { kind: "local", local: local.id }, origin: local.origin }];
  const texts = [`MirPlace(id=p:0, base=local(local=l:0), storage=t:5, origin=${originText})`];
  for (let position = 1; position <= count; position += 1) {
    places.push({ id: identities.placeId(position), storage: identities.tyId(5), origin: local.origin,
      base: { kind: "place", place: identities.placeId(position - 1), projection: { kind: "element", index: 0 }, tir: nodeRef } });
    texts.push(`MirPlace(id=p:${position}, base=place(place=p:${position - 1}, projection=element(index=0), tir=${nodeText}), storage=t:5, origin=${originText})`);
  }
  const statements = [{ ...site, kind: "storage-live", local: local.id }, { ...site, kind: "assign", step: null, place: places[0].id,
    value: { kind: "use", operand: { kind: "place", place: identities.placeId(count) } } }];
  const body = { ...base, locals: [local], places, blocks: [{ ...base.blocks[0], statements }] };
  const text = document(`MirLocal(id=l:0, storage=t:5, role=temporary(), source=null, origin=${originText})`, "", texts.join(", "),
    `MirBlock(${siteText}, id=b:0, statements=[storage-live(${siteText}, local=l:0), assign(${siteText}, place=p:0, value=use(operand=place(place=p:100000)), step=null)], terminator=return(${returnSiteText}, value=null))`, undefined, undefined, entryText);
  roundtrip(body, text, "complete 100000-level arena-reference chain");
  const recursiveType = { ...context, types: { ...context.types, terms: [...context.types.terms, { kind: "array", element: identities.tyId(5), readonly: false }] } };
  same(verified(body, recursiveType), [], "complete deep verified vector including actual live tail operand");
});

test("MIR genuine sparse caller values and declared inline component cycles fail with their exact paths", () => {
  const base = parsedBody();
  const sparse = { ...base, locals: new Array(1) };
  assert.throws(() => product.printMir(sparse), { name: "TypeError", message: "Sparse MIR value at $.locals[0]" });
  assert.throws(() => product.printMir({ ...base, locals: [null] }),
    { name: "TypeError", message: "Sparse MIR value at $.locals[0]" });
  const component = { root: { kind: "body", value: { body: base.body, node: identities.nodeId(0) } }, path: [] };
  component.path.push({ kind: "sum-arm", family: { origin: "authored", component, parameters: [], roles: [] }, index: 0 });
  const conversion = { decision: { kind: "selected", operation: { kind: "conversion", from: identities.tyId(0), to: identities.tyId(0),
    embedding: { kind: "conversion", conversion: "literal-fit", proof: { steps: [{ from: component, to: component, rule: "literal-fit", premises: [] }], conclusion: 0 }, check: { kind: "none" } } },
  operands: [identities.tyId(0)], result: identities.tyId(0), execution: { kind: "pure" } }, permissionScope: null };
  const cyclic = { ...base, blocks: [{ ...base.blocks[0], statements: [{ ...site, kind: "assign", step: null, place: identities.placeId(0),
    value: { kind: "convert", operation: conversion, operand: { kind: "constant", constant: identities.constId(0) }, to: identities.tyId(0) } }] }] };
  assert.throws(() => product.printMir(cyclic), { name: "TypeError",
    message: "Cyclic MIR value at $.blocks[0].statements[0].value.operation.decision.operation.embedding.proof.steps[0].from.path[0].family.component" });
  assert.throws(() => verified(cyclic, sourceContext(base)), { name: "TypeError",
    message: "Cyclic MIR value at $.blocks[0].statements[0].value.operation.decision.operation.embedding.proof.steps[0].from.path[0].family.component" });
  component.path.length = 0;
  component.path.length = 1;
  assert.throws(() => product.printMir(cyclic), { name: "TypeError",
    message: "Sparse MIR value at $.blocks[0].statements[0].value.operation.decision.operation.embedding.proof.steps[0].from.path[0]" });
  assert.throws(() => verified(cyclic, sourceContext(base)), { name: "TypeError",
    message: "Sparse MIR value at $.blocks[0].statements[0].value.operation.decision.operation.embedding.proof.steps[0].from.path[0]" });
  const actualText = product.printMir(base);
  const expectedText = document("", "", "", simpleBlockText, undefined, undefined, entryText);
  comparison(actualText, expectedText, actualText === expectedText, "caller defects leave no hidden printer state");
  same(verified(base, sourceContext(base)), [], "caller defects leave no hidden verification state");
});

test("MIR missing total terminator remains a parser shape case, never a fabricated typed verifier input", () => {
  const text = document("", "", "", `MirBlock(${siteText}, id=b:0, statements=[])`);
  const at = text.indexOf("statements=[]") + "statements=[]".length;
  invalidText(text, at, [","], ")");
});

for (const [token, relativeOffset, expected, found] of [
  ["-", 1, ["number"], ")"], ["01", 1, ["number"], "1"], ["1.", 2, ["fraction digit"], ")"],
  ["1e", 2, ["exponent digit"], ")"], ["1E+", 3, ["exponent digit"], ")"], ["1e-", 3, ["exponent digit"], ")"],
  ["1x", 1, ["number"], "x"], ["Nan", 2, ["NaN"], "n"], ["+Inf", 4, ["+Infinity"], ")"],
  ["-Infinityx", 9, ["-Infinity"], "x"], ['"1"', 0, ["number"], '"'], ['"\\q"', 0, ["number"], '"'],
  ["true", 0, ["number"], "t"], ["false", 0, ["number"], "f"],
]) {
  test(`MIR numeric token ${token} reports its complete first lexical or type error`, () => {
    const prefix = emptyText.slice(0, emptyText.lastIndexOf("t:0") + 2);
    invalidText(`${prefix}${token})\n`, prefix.length + relativeOffset, expected, found);
  });
}

test("MIR JSON strings preserve every escape and reject complete lexical/type failures", () => {
  const value = { kind: "string", value: '"\\/\b\f\n\r\t\u0000\uD800' };
  const literal = 'string(value="\\\"\\\\\\/\\b\\f\\n\\r\\t\\u0000\\uD800")';
  const text = document("", `MirConstant(id=c:0, type=t:0, value=literal(value=${literal}))`, "", "");
  const parsed = product.parseMir(text);
  same(parsed, { kind: "parsed", value: { ...emptyValue, constants: [{ id: 0, type: 0, value: { kind: "literal", value } }] } }, "complete escaped string value");
  const prefix = 'MirBody(body=body:"';
  invalidText(`${prefix}\\u12x4")`, prefix.length, ["four hexadecimal escape digits"], "\\");
  invalidText(`${prefix}\n")`, prefix.length, ["escaped string character"], "\n");
  invalidText(`${prefix}unterminated`, prefix.length + "unterminated".length, ['"'], null);
  invalidText("MirBody(body=body:true)", "MirBody(body=body:".length, ["string"], "t");
});

const dependencyNames = ["ids", "diag", "ir-types", "ir-hir", "ir-infer", "ir-tir"];
const interfaceSources = ["ids/contract", "ids/index", "diag/contract", "ir-types/contract", "ir-hir/contract", "ir-hir/index", "ir-infer/contract", "ir-tir/contract"]
  .map(name => `packages/host/src/${name}.ts`);

test("MIR complete module isolates against real original public dependency values and actual strict declaration closure", async () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const available = dependencyNames.flatMap(name => deps.enumerate(resolve(repository, `packages/host/src/${name}`)))
    .filter(path => path.endsWith(".ts")).map(path => relative(repository, path).split("\\").join("/")).sort();
  const sources = new Map(available.map(path => [path, readFileSync(resolve(repository, path), "utf8")]));
  const graph = readImportGraph(parseSources(sources), sources);
  const adjacency = new Map(available.map(path => [path, []]));
  for (const edge of graph) if (edge.target !== null) adjacency.get(edge.source).push(edge.target);
  const closure = new Set(interfaceSources);
  for (const path of closure) {
    assert.equal(adjacency.has(path), true, `actual accepted dependency source is required: ${path}`);
    for (const target of adjacency.get(path)) closure.add(target);
  }
  const report = await compileIsolated(deps, hostCatalogue.find(module => module.name === "ir-mir"), {
    root: repository, sourceFiles, interfaceSources, declarationSources: [...closure].sort(), outputDirectory: ".temp/ir-mir-isolation",
  });
  writeFileSync(resolve(evidenceDirectory, "isolation.json"), `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
  same(report.sourceInventory.map(item => relative(repository, item.path)).sort(), [...sourceFiles, ...closure].sort(), "complete real source provenance");
  assert.equal(report.loadedInventory.length > sourceFiles.length, true, "nonempty actual language and public dependency declarations");
  assert.equal(report.loadedInventory.every(path => report.expectedInventory.includes(path)), true, "no implicit peer source or private declaration fallback");
  for (const path of interfaceSources) assert.equal(report.provenance.some(item => item.source === resolve(repository, path)), true, `real interface producer ${path}`);
});

test("MIR actual fresh public declarations accept all three ports and reject the removed four-argument port and five deleted rules", () => {
  const deps = isolationDeps(tooling, quarantineRoots);
  const parent = resolve(repository, ".temp/ir-mir-consumer");
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(resolve(parent, "case-"));
  const declarations = [];
  for (const name of ["ir-mir", ...dependencyNames]) {
    const original = resolve(repository, `packages/host/dist/${name}`);
    for (const path of deps.enumerate(original).filter(path => path.endsWith(".d.ts"))) {
      const destination = resolve(stage, name, relative(original, path));
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(path, destination);
      declarations.push(destination);
    }
  }
  writeFileSync(resolve(stage, "package.json"), '{"type":"module","private":true}\n');
  const positive = resolve(stage, "positive.mts");
  writeFileSync(positive, `import * as Mir from "./ir-mir/index.js";
import { encodePackageId, encodeModuleId, encodeDefId, encodeBodyId, nodeId, blockId, tyId, sigId } from "./ids/index.js";
import type { MirBody, MirVerificationContext, PrintMir, ParseMir, VerifyMir } from "./ir-mir/contract.js";
import type { TirBody } from "./ir-tir/contract.js";
import type { TypeTable } from "./ir-types/contract.js";
const module = encodeModuleId({ package: encodePackageId("p"), path: "m" });
const definition = encodeDefId({ module, segments: [{ name: "run", ordinal: 0 }] });
const identity = encodeBodyId({ owner: definition, role: "function", ordinal: 0 });
const origin = { module, start: 0, length: 0, derived: [] };
const root = { id: nodeId(0), origin, parent: null, flags: [], loc: { pos: 0, end: 0 } };
const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
const source: TirBody = { body: identity, owner: definition, bindings: { kind: "parametric" }, lexicalBindings: bindings,
  dependence: "parametric", signature: sigId(0), completion: tyId(0), yielded: null, sent: null, params: [], locals: [],
  root: { ...root, kind: "Block", multiLine: false, tsonic: null, statements: { loc: root.loc, nodes: [
    { ...root, id: nodeId(1), parent: nodeId(0), kind: "ReturnStatement", expression: null, tsonic: null }] } },
  nestedBodies: [], captures: [], scopes: [{ node: nodeId(0), parent: null, attributes: [] }], evidence: [], asynchronous: false, generator: false };
const types: TypeTable = { terms: [{ kind: "intrinsic", intrinsic: "void" }], signatures: [{ id: sigId(0), declaration: definition,
  owner: null, composition: null, kind: "call", typeParameters: [], receiver: null, parameters: [], result: tyId(0) }] };
export const body: MirBody = { body: identity, bindings: { kind: "parametric" }, entries: [{ provided: 0, block: blockId(0) }],
  locals: [], constants: [], places: [], result: tyId(0),
  blocks: [{ origin, tir: { body: identity, node: nodeId(0) }, id: blockId(0), statements: [],
    terminator: { origin, tir: { body: identity, node: nodeId(1) }, kind: "return", value: null } }] };
export const context: MirVerificationContext = { limits: { maximumWork: 0 }, source, types, bodyOwner: selected => selected === identity ? definition : null,
  declarationOf: selected => selected === definition ? {
  scope: { classParameters: [], methodParameters: [], capturedParameters: [], selfOwners: [] }, parameterCount: 0, endpoints: [] } : null };
const ports: readonly [PrintMir, ParseMir, VerifyMir] = [Mir.printMir, Mir.parseMir, Mir.verifyMir];
void ports; void Mir.parseMir(Mir.printMir(body)); void Mir.verifyMir(body, context);
`);
  const expected = [];
  const files = [positive];
  const oldCall = 'verifyMir(body, context.source, () => context.types.terms[0], () => context.types.signatures[0]);';
  const legacy = resolve(stage, "removed-call.mts");
  writeFileSync(legacy, `import { verifyMir } from "./ir-mir/index.js";\nimport { body, context } from "./positive.mjs";\n${oldCall}\n`);
  files.push(legacy);
  expected.push({ file: "removed-call.mts", line: 3, column: oldCall.indexOf("() =>") + 1, code: 2554 });
  for (const rule of ["block-terminator-total", "unwind-cleanup-complete", "suspension-return-cleanup", "effect-path-exact", "rvalue-effect-free"]) {
    const file = `removed-${rule}.mts`;
    writeFileSync(resolve(stage, file), `import type { MirRule } from "./ir-mir/contract.js";\nconst wrong: MirRule = ${JSON.stringify(rule)};\nvoid wrong;\n`);
    files.push(resolve(stage, file));
    expected.push({ file, line: 2, column: 7, code: 2322 });
  }
  const config = resolve(stage, "tsconfig.json");
  writeFileSync(config, JSON.stringify({ compilerOptions: { strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
    noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true, noFallthroughCasesInSwitch: true, noEmit: true,
    skipLibCheck: false, target: "es2022", lib: ["es2022"], module: "nodenext", moduleResolution: "nodenext", types: [] }, files }));
  const result = spawnSync(process.execPath, [deps.compiler, "--project", config, "--listFiles", "--pretty", "false"], {
    cwd: stage, encoding: "utf8", timeout: 90_000, maxBuffer: 4_194_304,
  });
  assert.equal(result.error === undefined && result.signal === null, true, "actual strict consumer terminated normally");
  const output = `${result.stdout}${result.stderr}`;
  writeFileSync(resolve(stage, "diagnostics.log"), output);
  const actual = [...output.matchAll(/^(.+)\((\d+),(\d+)\): error TS(\d+):/gmu)].map(match => ({ file: relative(stage, resolve(stage, match[1])),
    line: Number(match[2]), column: Number(match[3]), code: Number(match[4]) }));
  const ordering = (left, right) => left.file < right.file ? -1 : left.file > right.file ? 1 : left.line - right.line || left.column - right.column || left.code - right.code;
  same(actual.sort(ordering), expected.sort(ordering), "complete independently pinned consumer diagnostic vector; positive source clean");
  assert.equal(result.status, 1, "only the exact six authored negative declarations fail");
  const loaded = result.stdout.split(/\r?\n/u).filter(isAbsolute).map(path => realpathSync(path));
  const permitted = new Set([...files, ...declarations, ...deps.platform.language].map(path => realpathSync(path)));
  assert.equal(loaded.length > files.length, true, "actual fresh declaration and compiler inventory");
  assert.equal(loaded.every(path => permitted.has(path)), true, "strict consumer cannot reach peer source, workspace node_modules or fake public indices");
  writeFileSync(resolve(evidenceDirectory, "consumer.json"), `${JSON.stringify({ stage, expected, actual, loaded, sourceFiles: files,
    declarations: declarations.map(path => ({ path, hash: createHash("sha256").update(readFileSync(path)).digest("hex") })) }, null, 2)}\n`);
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
    const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
      project: (url, text) => ({ path: fileURLToPath(url), text }) },
    [...runtimeFiles, resolve(repository, "packages/host/src/ir-mir/contract.ts")], raw);
    writeFileSync(resolve(evidenceDirectory, "raw-v8.json"), `${JSON.stringify(raw)}\n`);
    writeFileSync(resolve(evidenceDirectory, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(evidenceDirectory, "source-inputs.json"), `${JSON.stringify(sourceFiles.map(path => ({ path,
      hash: createHash("sha256").update(readFileSync(resolve(repository, path))).digest("hex") })), null, 2)}\n`);
    assert.equal(result.length, 9, "all nine genuine runtime owners need nonempty source-identified raw evidence");
    assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
    assert.equal(report.files.filter(file => file.status === "covered").length, 9);
    assert.equal(report.files.filter(file => file.status === "not-applicable").length, 1, "only the actual type-only contract is N/A");
    for (const file of report.files.filter(file => file.status === "covered")) {
      assert.equal(file.lines, 100, basename(file.path));
      assert.equal(file.branches, 100, basename(file.path));
      assert.equal(file.functions, 100, basename(file.path));
    }
  } finally { session.disconnect(); }
});
