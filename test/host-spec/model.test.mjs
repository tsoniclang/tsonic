import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as implementation from "../../packages/host/src/model/register.ts";
import { orderedDomain, sameIdentity } from "./runner/assertions.mjs";
import { withSpecProject } from "./runner/project.mjs";
import { inspectHostStructure } from "../architecture/tooling/host-gates.mjs";

function recorder(onCharge = () => {}) {
  const charges = [];
  return { charges, charge(amount) { onCharge(amount, charges.length); charges.push(amount); } };
}

function value(result) {
  assert.equal(result.kind, "valid", "complete valid result before reading its value");
  assert.equal(Object.isFrozen(result), true, "immutable result");
  return result.value;
}

function invalid(result, code) {
  assert.equal(result.kind, "invalid", "complete invalid result");
  assert.equal(result.code, code);
  assert.equal(typeof result.message, "string");
  assert.equal(Object.isFrozen(result), true);
  return result;
}

test("the sole composition export is a frozen stateless algebra with no arbitrary-range API", () => {
  orderedDomain(Object.keys(implementation), ["modelAlgebra"], Object.is, "complete runtime export domain");
  orderedDomain(Object.keys(implementation.modelAlgebra), ["integerBounds", "integerInFormat", "keyEqual",
    "keyIncluded", "keyDomainContains"], Object.is, "complete operation domain");
  assert.equal(Object.isFrozen(implementation.modelAlgebra), true);
  assert.equal(implementation.modelAlgebra.integerInRange, undefined);
  assert.throws(() => { implementation.modelAlgebra.integerBounds = () => {}; }, TypeError);
});

test("the actual stateless Model port is composition-only, not a peer implementation dependency", async () => {
  const repository = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const sources = ["packages/host/src/model/contract.ts", "packages/host/src/model/register.ts"]
    .map(path => ({ path, text: readFileSync(resolve(repository, path), "utf8") }));
  for (const [path, expected] of [["packages/host/src/orchestration/model-composition.ts", []],
    ["packages/host/src/ingress/observations.ts", ["contract-imports"]]]) {
    await withSpecProject([...sources, { path, text: `
      import { modelAlgebra } from "../model/register.js";
      export function compose() {
        const selected = Object.freeze({ algebra: modelAlgebra });
        return selected;
      }
    ` }], project => {
      const findings = inspectHostStructure({ root: project.root, files: project.files, declarationFiles: [] });
      orderedDomain(findings.map(finding => finding.gate).sort(), expected, Object.is,
        `complete findings at ${path}: ${JSON.stringify(findings.map(finding => [finding.gate, finding.file, finding.start]))}`);
    });
  }
});

test("all ten formats retain exact frozen bounds and every adjacent boundary", () => {
  const formats = [
    ["signed", 8, -128n, 127n, 9n], ["unsigned", 8, 0n, 255n, 9n],
    ["signed", 16, -32768n, 32767n, 17n], ["unsigned", 16, 0n, 65535n, 17n],
    ["signed", 32, -2147483648n, 2147483647n, 33n], ["unsigned", 32, 0n, 4294967295n, 33n],
    ["signed", 64, -9223372036854775808n, 9223372036854775807n, 65n],
    ["unsigned", 64, 0n, 18446744073709551615n, 65n],
    ["signed", 128, -170141183460469231731687303715884105728n, 170141183460469231731687303715884105727n, 129n],
    ["unsigned", 128, 0n, 340282366920938463463374607431768211455n, 129n],
  ];
  orderedDomain(formats.map(([sign, bits]) => `${sign}:${bits}`), ["signed:8", "unsigned:8", "signed:16",
    "unsigned:16", "signed:32", "unsigned:32", "signed:64", "unsigned:64", "signed:128", "unsigned:128"],
  Object.is, "all formats before boundary checks");
  for (const [signedness, bits, minimum, maximum, charge] of formats) {
    const format = Object.freeze({ signedness, bits });
    const range = value(implementation.modelAlgebra.integerBounds(format));
    assert.equal(Object.isFrozen(range), true);
    orderedDomain(Object.keys(range), ["minimum", "maximum"], Object.is, "complete range");
    assert.equal(range.minimum, minimum);
    assert.equal(range.maximum, maximum);
    for (const [integer, fits] of [[minimum - 1n, false], [minimum, true], [minimum + 1n, true],
      [maximum - 1n, true], [maximum, true], [maximum + 1n, false]]) {
      const work = recorder();
      assert.equal(value(implementation.modelAlgebra.integerInFormat(integer, format, work)), fits, `${signedness}:${bits}`);
      orderedDomain(work.charges, [charge], Object.is, "exact bounded operation charge");
    }
  }
});

test("selected widths and huge pre-existing integers are never rounded, capped or replaced", () => {
  const wide = 9007199254740993n;
  const huge = 1n << 100000n;
  for (const [integer, signedness, bits, fits] of [
    [wide, "signed", 64, true], [wide, "unsigned", 64, true], [wide, "signed", 32, false],
    [4294967295n, "unsigned", 32, true], [4294967295n, "signed", 32, false],
    [huge, "signed", 128, false], [-huge, "signed", 128, false], [huge, "unsigned", 128, false],
    [-huge, "unsigned", 128, false],
  ]) {
    const original = integer;
    assert.equal(value(implementation.modelAlgebra.integerInFormat(integer, { signedness, bits }, recorder())), fits);
    assert.equal(integer === original, true, "no truncated substitute is returned or stored");
  }
});

test("integer validation rejects malformed formats and non-bigints without entering truncation", () => {
  for (const format of [undefined, null, 3, {}, { signedness: "other", bits: 32 },
    ...[0, 7, 256, 32n, NaN, Infinity, "32"].map(bits => ({ signedness: "signed", bits }))]) {
    invalid(implementation.modelAlgebra.integerBounds(format), "INVALID_INTEGER_FORMAT");
    const work = recorder();
    invalid(implementation.modelAlgebra.integerInFormat(1n, format, work), "INVALID_INTEGER_FORMAT");
    orderedDomain(work.charges, [], Object.is, "invalid format performs no native truncation");
  }
  for (const integer of [undefined, null, 1, 1.5, "1", {}]) {
    const work = recorder();
    invalid(implementation.modelAlgebra.integerInFormat(integer, { signedness: "signed", bits: 32 }, work),
      "INVALID_INTEGER_VALUE");
    orderedDomain(work.charges, [], Object.is, "invalid value performs no native truncation");
  }
});

test("the exact selected native truncation is charged before invocation and preserves work failures", context => {
  for (const [signedness, method] of [["signed", "asIntN"], ["unsigned", "asUintN"]]) {
    const work = recorder();
    const original = BigInt[method];
    const observed = context.mock.method(BigInt, method, (bits, integer) => {
      orderedDomain(work.charges, [129n], Object.is, "charge precedes native operation");
      assert.equal(bits, 128);
      assert.equal(integer, 9007199254740993n);
      return original(bits, integer);
    });
    assert.equal(value(implementation.modelAlgebra.integerInFormat(9007199254740993n,
      { signedness, bits: 128 }, work)), true);
    const failure = new Error("existing work failure");
    assert.throws(() => implementation.modelAlgebra.integerInFormat(1n, { signedness, bits: 128 },
      recorder(() => { throw failure; })), error => error === failure);
    assert.equal(observed.mock.callCount(), 1, "a failed reservation never enters the native operation");
    observed.mock.restore();
  }
});

test("key equality preserves complete tags, exact names and supplied symbol identities", () => {
  const symbol = Symbol("same spelling");
  const keys = [{ kind: "name", name: "a" }, { kind: "name", name: "b" },
    { kind: "symbol", identity: symbol }, { kind: "symbol", identity: symbol },
    { kind: "symbol", identity: Symbol("same spelling") }, { kind: "name", name: "a" }];
  const expected = ["100001", "010000", "001100", "001100", "000010", "100001"];
  assert.equal(keys.length, 6, "complete key identity domain");
  assert.equal(expected.length, 6, "complete equality result domain");
  for (const [leftIndex, left] of keys.entries()) {
    assert.equal(expected[leftIndex].length, 6);
    for (const [rightIndex, right] of keys.entries()) {
      assert.equal(value(implementation.modelAlgebra.keyEqual(left, right, recorder())),
        expected[leftIndex][rightIndex] === "1", `key pair ${leftIndex}:${rightIndex}`);
    }
  }
  assert.equal(value(implementation.modelAlgebra.keyEqual({ kind: "name", name: "0" },
    { kind: "name", name: "00" }, recorder())), false, "no unearned numeric-name normalization");
  assert.equal(value(implementation.modelAlgebra.keyEqual({ kind: "symbol", identity: undefined },
    { kind: "symbol", identity: undefined }, recorder())), true, "generic identity is not a forged Source handle");
});

test("all open and finite domain branches preserve inclusion and containment orientation", () => {
  const symbol = Symbol("key");
  const keys = [{ kind: "name", name: "a" }, { kind: "name", name: "b" },
    { kind: "symbol", identity: symbol }, { kind: "symbol", identity: Symbol("key") }];
  const domains = [{ kind: "empty" }, { kind: "names" }, { kind: "symbols" }, { kind: "all" },
    { kind: "finite", keys: [] }, { kind: "finite", keys: [keys[0]] },
    { kind: "finite", keys: [keys[2]] }, { kind: "finite", keys: [keys[0], keys[2]] },
    { kind: "finite", keys: [keys[1]] }];
  const included = ["0000", "1100", "0011", "1111", "0000", "1000", "0010", "1010", "0100"];
  const contained = ["100010000", "110011001", "101010100", "111111111", "100010000",
    "100011000", "100010100", "100011110", "100010001"];
  orderedDomain(domains.map(domain => domain.kind), ["empty", "names", "symbols", "all", "finite",
    "finite", "finite", "finite", "finite"], Object.is, "complete domain branches before querying");
  assert.equal(keys.length, 4);
  assert.equal(included.length, 9);
  assert.equal(contained.length, 9);
  for (const [index, domain] of domains.entries()) {
    assert.equal(included[index].length, 4);
    assert.equal(contained[index].length, 9);
    for (const [keyIndex, key] of keys.entries()) {
      assert.equal(value(implementation.modelAlgebra.keyIncluded(domain, key, recorder())),
        included[index][keyIndex] === "1", `inclusion ${index}:${keyIndex}`);
    }
    for (const [innerIndex, inner] of domains.entries()) {
      assert.equal(value(implementation.modelAlgebra.keyDomainContains(domain, inner, recorder())),
        contained[index][innerIndex] === "1", `container:contained ${index}:${innerIndex}`);
    }
  }
  const reordered = { kind: "finite", keys: [keys[2], keys[0]] };
  assert.equal(value(implementation.modelAlgebra.keyDomainContains(reordered, domains[7], recorder())), true);
  assert.equal(value(implementation.modelAlgebra.keyDomainContains(domains[7], reordered, recorder())), true);
  const distinctSymbols = { kind: "finite", keys: [keys[2], keys[3]] };
  for (const key of distinctSymbols.keys) {
    assert.equal(value(implementation.modelAlgebra.keyIncluded(distinctSymbols, key, recorder())), true,
      "same-description symbols remain distinct valid set members");
  }
});

test("both malformed key inputs and every malformed finite domain reject before shortcuts", () => {
  const key = { kind: "name", name: "a" };
  for (const malformed of [undefined, null, 3, {}, { kind: "other" }, { kind: "name" },
    { kind: "name", name: 1 }, { kind: "symbol" }]) {
    for (const [left, right] of [[malformed, key], [key, malformed], [malformed, malformed]]) {
      const work = recorder();
      invalid(implementation.modelAlgebra.keyEqual(left, right, work), "INVALID_KEY_DOMAIN");
      orderedDomain(work.charges, [1n, 1n], Object.is, "both entire key inputs validate even if the first fails");
    }
    invalid(implementation.modelAlgebra.keyIncluded({ kind: "all" }, malformed, recorder()), "INVALID_KEY_DOMAIN");
  }
  const symbol = Symbol("key");
  for (const domain of [undefined, null, 3, {}, { kind: "numeric-index" }, { kind: "finite" },
    { kind: "finite", keys: null }, { kind: "finite", keys: [undefined] },
    { kind: "finite", keys: [key, undefined] }, { kind: "finite", keys: [key, { kind: "other" }] },
    { kind: "finite", keys: Array(1) }, { kind: "finite", keys: [key, ,] },
    { kind: "finite", keys: [key, { ...key }] },
    { kind: "finite", keys: [{ kind: "symbol", identity: symbol }, { kind: "symbol", identity: symbol }] }]) {
    invalid(implementation.modelAlgebra.keyIncluded(domain, key, recorder()), "INVALID_KEY_DOMAIN");
    invalid(implementation.modelAlgebra.keyDomainContains({ kind: "all" }, domain, recorder()), "INVALID_KEY_DOMAIN");
    invalid(implementation.modelAlgebra.keyDomainContains(domain, { kind: "empty" }, recorder()), "INVALID_KEY_DOMAIN");
  }
});

test("actual key work follows predeclared validation, slot and comparison costs", () => {
  const name = { kind: "name", name: "a" };
  const other = { kind: "name", name: "b" };
  const symbol = { kind: "symbol", identity: Symbol("key") };
  const single = { kind: "finite", keys: [name] };
  const pair = { kind: "finite", keys: [name, other] };
  const cases = [
    [work => implementation.modelAlgebra.keyEqual(name, name, work), true, 6n],
    [work => implementation.modelAlgebra.keyEqual(symbol, symbol, work), true, 4n],
    [work => implementation.modelAlgebra.keyEqual(name, symbol, work), false, 3n],
    [work => implementation.modelAlgebra.keyEqual({ kind: "name", name: "" }, { kind: "name", name: "" }, work), true, 4n],
    [work => implementation.modelAlgebra.keyIncluded({ kind: "names" }, name, work), true, 3n],
    [work => implementation.modelAlgebra.keyIncluded(single, name, work), true, 12n],
    [work => implementation.modelAlgebra.keyIncluded(pair, name, work), true, 21n],
    [work => implementation.modelAlgebra.keyIncluded(pair, other, work), true, 28n],
    [work => implementation.modelAlgebra.keyDomainContains(pair, single, work), true, 26n],
    [work => implementation.modelAlgebra.keyDomainContains(single, pair, work), false, 36n],
  ];
  assert.equal(cases.length, 10, "all derived work cases");
  for (const [operation, expected, charged] of cases) {
    const work = recorder();
    assert.equal(value(operation(work)), expected, "complete semantic answer before counters");
    assert.equal(work.charges.reduce((total, amount) => total + amount, 0n), charged);
  }
  for (const [operation, expected] of [[work => implementation.modelAlgebra.keyEqual(name, other, work), false],
    [work => implementation.modelAlgebra.keyIncluded(pair, other, work), true],
    [work => implementation.modelAlgebra.keyDomainContains(pair, single, work), true]]) {
    const failure = new Error("same existing charge failure");
    assert.throws(() => operation(recorder(() => { throw failure; })), error => error === failure);
    assert.equal(value(operation(recorder())), expected,
      "independent work has no cached partial state");
  }
});

test("malformed data introduced during work is propagated unchanged instead of partial success", () => {
  const key = { kind: "name", name: "a" };
  const expected = invalid(implementation.modelAlgebra.keyEqual(undefined, key, recorder()), "INVALID_KEY_DOMAIN");
  for (const mode of ["duplicate-check", "membership", "contained-key"]) {
    const domain = { kind: "finite", keys: [key, { kind: "name", name: "b" }] };
    if (mode !== "duplicate-check") domain.keys.pop();
    const work = recorder((_amount, previousCalls) => {
      if (previousCalls === 5) domain.keys[mode === "duplicate-check" ? 1 : 0] = undefined;
    });
    const result = mode === "duplicate-check" ? implementation.modelAlgebra.keyIncluded(domain, key, work)
      : mode === "membership" ? implementation.modelAlgebra.keyIncluded(domain, key, work)
        : implementation.modelAlgebra.keyDomainContains({ kind: "names" }, domain, work);
    sameIdentity(result, expected, `${mode}: same nested invalid result`);
  }
});

test("actual exported implementation and Model contract bind strictly without a private data model", async () => {
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const port = resolve(repository, "packages/host/src/model/contract.js");
  const owner = resolve(repository, "packages/host/src/model/register.js");
  const source = `import type * as Port from ${JSON.stringify(port)};
import {modelAlgebra} from ${JSON.stringify(owner)};
const declared: Port.ModelAlgebra = modelAlgebra;
const actual: typeof modelAlgebra = declared;
declare const work: Port.AlgebraWork;
const format: Port.IntegerFormat = {signedness:'signed',bits:64};
const range: Port.DataResult<Port.IntegerRange> = actual.integerBounds(format);
const fit: Port.DataResult<boolean> = actual.integerInFormat(9007199254740993n, format, work);
const key: Port.AlgebraKey<symbol> = {kind:'symbol',identity:Symbol('mechanical')};
const domain: Port.KeyDomain<symbol> = {kind:'finite',keys:[key]};
const result: Port.DataResult<boolean> = actual.keyEqual(key,key,work);
actual.keyIncluded(domain,key,work); actual.keyDomainContains(domain,domain,work);
actual.keyEqual<number>({kind:'symbol',identity:1},{kind:'symbol',identity:2},work);
void range; void fit; void result;\n`;
  const negatives = [
    ["format", "const bad: Port.IntegerFormat = {signedness:'signed',bits:7};", 2322],
    ["value", "actual.integerInFormat(1,format,work);", 2345],
    ["result", "const bad: Port.DataResult<boolean> = actual.integerBounds(format);", 2322],
    ["work", "actual.integerInFormat(1n,format,{charge(amount:number){}});", 2322],
    ["readonly-format", "format.bits = 32;", 2540],
    ["readonly-api", "actual.keyEqual = actual.keyEqual;", 2540],
    ["readonly-range", "declare const bounds: Port.IntegerRange; bounds.maximum = 0n;", 2540],
    ["readonly-domain", "declare const finite: Extract<Port.KeyDomain<symbol>,{kind:'finite'}>; finite.keys.push(key);", 2339],
    ["numeric-index", "const bad: Port.KeyDomain<symbol> = {kind:'numeric-index'};", 2322],
    ["arbitrary-range", "actual.integerInRange(1n,0n,2n,work);", 2339],
    ["wrong-invalid-code", "const bad: Port.DataResult<boolean> = {kind:'invalid',code:'OTHER',message:'invalid'};", 2322],
    ["contract-value", `import {modelAlgebra} from ${JSON.stringify(port)};`, 2724],
    ["old-factory", `import {createModel} from ${JSON.stringify(owner)};`, 2305],
  ];
  for (const [name, type, field] of [
    ["signedness", "Port.IntegerFormat", "signedness"],
    ["minimum", "Port.IntegerRange", "minimum"],
    ["result-kind", "Port.DataResult<string>", "kind"],
    ["result-value", "Extract<Port.DataResult<string>,{kind:'valid'}>", "value"],
    ["invalid-code", "Extract<Port.DataResult<string>,{kind:'invalid'}>", "code"],
    ["invalid-message", "Extract<Port.DataResult<string>,{kind:'invalid'}>", "message"],
    ["key-kind", "Port.AlgebraKey<symbol>", "kind"],
    ["key-name", "Extract<Port.AlgebraKey<symbol>,{kind:'name'}>", "name"],
    ["key-identity", "Extract<Port.AlgebraKey<symbol>,{kind:'symbol'}>", "identity"],
    ["domain-kind", "Port.KeyDomain<symbol>", "kind"],
    ["domain-keys", "Extract<Port.KeyDomain<symbol>,{kind:'finite'}>", "keys"],
    ["api-bounds", "Port.ModelAlgebra", "integerBounds"],
    ["api-fit", "Port.ModelAlgebra", "integerInFormat"],
    ["api-included", "Port.ModelAlgebra", "keyIncluded"],
    ["api-contained", "Port.ModelAlgebra", "keyDomainContains"],
  ]) {
    negatives.push([`readonly-${name}`, `declare const record: ${type}; record.${field} = record.${field};`, 2540]);
  }
  assert.equal(negatives.length, 28, "complete expected type-boundary domain before compilation");
  const compile = files => {
    const result = spawnSync(resolve(repository, "node_modules/.bin/tsgo"), ["--ignoreConfig", "--strict",
      "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes", "--skipLibCheck", "false", "--noEmitOnError",
      "--module", "nodenext", "--target", "es2020", "--types", "node", "--noEmit", ...files],
    { cwd: repository, encoding: "utf8", timeout: 30_000, maxBuffer: 65_536 });
    assert.equal(result.error === undefined, true, "actual strict compiler completes");
    assert.equal(result.signal, null);
    assert.equal(result.stderr, "");
    return result;
  };
  await withSpecProject([{ path: "positive.mts", text: source },
    ...negatives.map(([name, text]) => ({ path: `${name}.mts`, text: name === "contract-value" ? text : source + text }))], project => {
    const positive = compile([resolve(project.root, "positive.mts")]);
    assert.equal(positive.status, 0, positive.stdout.slice(0, 8192));
    const negative = compile(negatives.map(([name]) => resolve(project.root, `${name}.mts`)));
    assert.equal(negative.status, 1, "actual wrong inputs/results/readonly/private ports rejected");
    const diagnostics = [...negative.stdout.matchAll(/^(.*)\(\d+,\d+\): error TS(\d+):/gmu)]
      .map(match => [basename(match[1]), Number(match[2])]);
    assert.equal((negative.stdout.match(/\berror TS\d+:/gu) ?? []).length, negatives.length);
    orderedDomain(diagnostics.map(([name]) => name).sort(), negatives.map(([name]) => `${name}.mts`).sort(),
      Object.is, "every expected compiler boundary and no other file");
    for (const [name, , code] of negatives) {
      const selected = diagnostics.filter(([file]) => file === `${name}.mts`);
      assert.equal(selected.length, 1, name);
      assert.equal(selected[0][1], code, name);
    }
  });
});
