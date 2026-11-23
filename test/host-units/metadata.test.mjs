import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccount, accountFailure, chargeResultEntries, chargeWork, remainingWork } from "../../packages/host/dist/dataflow/index.js";
import { resourceLimitDiagnostic } from "../../packages/host/dist/diag/index.js";
import { encodeBodyId, encodeDefId, encodeModuleId, encodePackageId } from "../../packages/host/dist/ids/index.js";
import { artifactBindingsKey } from "../../packages/host/dist/ir-types/index.js";
import { layoutOf, materializeMetadata, resumeLayout } from "../../packages/host/dist/metadata/index.js";

const module = encodeModuleId({ package: encodePackageId({ kind: "project", realRoot: "/layout" }), path: "main.ts" });
const key = name => ({ definition: encodeDefId({ module, segments: [{ name, ordinal: 0 }] }), bindings: { kind: "parametric" } });
const site = (name, node) => {
  const selected = key(name);
  return { key: selected, occurrence: { kind: "item", value: { owner: selected.definition, node } },
    origin: { module, start: node, length: 1, derived: [] } };
};
const constant = name => ({ context: "compile-time",
  initializer: { body: encodeBodyId({ owner: key(name).definition, role: "initializer", ordinal: 0 }), bindings: { kind: "parametric" } } });
const measures = { byteSize: constant("size"), byteAlignment: constant("alignment"), stride: constant("stride") };
const abi = { ...site("abi", 1), kind: "data-layout", addressWidth: 32, byteOrder: "big", fingerprint: "layout ABI" };
const scalar = { ...site("item", 2), kind: "value", abi: abi.key, source: 0, measures, fields: [] };
const array = { ...site("array", 3), kind: "array", abi: abi.key, source: 1, measures,
  element: scalar.key, length: constant("length"), runtimeBase: "bigint" };
const reference = { query: "layoutOf", key: scalar.key.definition };

function fixture(maximumWork = 10000, maximumResultEntries = 1000, limits = { maximumWork: 10000, maximumGeometryBits: 64 }) {
  const account = createAccount({ maximumWork, maximumResultEntries });
  let retained = null;
  const failure = (origin, axis, maximum) => ({ kind: "refused", diagnostics: [resourceLimitDiagnostic({
    owner: "metadata", limit: axis, maximum, site: { kind: "source", origin }, unit: { request: reference, position: { kind: "result" } },
  })] });
  const admit = (work, entries) => {
    const stop = chargeWork(account, work) ?? chargeResultEntries(account, entries);
    if (stop === null) return null;
    retained ??= failure(scalar.origin, stop.dimension, stop.maximum);
    return retained;
  };
  const deps = { limits, admit, limit: failure,
    nativeFacts: { floatingFormats: [{ carrier: "float64", interchange: "ieee754-binary64" }] },
    matchesKey(requested, delivered) {
      const stop = admit(1 + requested.definition.length + delivered.definition.length, 0);
      return stop ?? { kind: "complete", matches: requested.definition === delivered.definition
        && artifactBindingsKey(requested.bindings) === artifactBindingsKey(delivered.bindings) };
    },
    typeOf: type => [{ kind: "primitive", primitive: "int32" },
      { kind: "fixed-array", element: 0, extent: { length: 2n, runtimeBase: "bigint" } },
      { kind: "primitive", primitive: "float64" }][type] ?? null,
  };
  return { deps, account, stopped: () => retained };
}

test("geometry accepts only the exact represented whole integer in the selected address width", () => {
  const execute = (deps, bits) => {
    const pending = layoutOf(deps, scalar);
    assert.equal(pending.kind, "paused");
    return resumeLayout(deps, pending.paused, pending.requests.map((request, position) => request.kind === "descriptor"
      ? { kind: "descriptor", request, value: abi } : { kind: "constant", request,
        value: position === 1 ? { kind: "floating", type: 2, bits } : { kind: "bigint", type: 0, value: 8n } }));
  };
  const proof = fixture();
  const actual = execute(proof.deps, 0x4020000000000000n);
  assert.equal(actual.value.kind, "ok");
  assert.equal(actual.value.value.byteSize, 8n);
  for (const bits of [0x4021000000000000n, 0xc020000000000000n, 0x7ff8000000000000n, 0x7ff0000000000000n,
    0x41f0000000000000n, 0x0000000000000001n]) {
    const result = execute(fixture().deps, bits);
    assert.equal(result.value.kind, "refused");
    assert.match(result.value.diagnostics[0].message, /exact nonnegative integer/u);
  }
  for (const zero of [0x0000000000000000n, 0x8000000000000000n])
    assert.equal(execute(fixture().deps, zero).value.value.byteSize, 0n);
  const limited = fixture(10000 - remainingWork(proof.account) - 1);
  assert.equal(execute(limited.deps, 0x4020000000000000n).value === limited.stopped(), true);
});

function finish(deps, declaration, values) {
  const pending = layoutOf(deps, declaration);
  assert.equal(pending.kind, "paused");
  assert.equal(pending.requests.length, values.length);
  return resumeLayout(deps, pending.paused, pending.requests.map((request, position) => request.kind === "constant"
    ? { kind: "constant", request, value: { kind: "bigint", type: 0, value: values[position] } }
    : { kind: "descriptor", request, value: values[position] }));
}

test("the Layout producer correlates constant and descriptor answers and emits a shared dense child image", () => {
  const { deps } = fixture();
  const platform = layoutOf(deps, abi);
  assert.equal(platform.value.value === abi, true);
  const element = finish(deps, scalar, [abi, 4n, 4n, 4n]).value.value;
  const ordered = finish(deps, array, [abi, 8n, 4n, 12n, 2n, element]).value.value;
  assert.equal(ordered.element === element && ordered.abi === element.abi, true);
  const record = materializeMetadata(deps, ordered);
  assert.equal(record.kind, "complete");
  assert.equal(record.value.kind, "memory-layout");
  assert.equal(record.value.root, 1);
  assert.deepEqual(record.value.layouts.map(row => [row.id, row.kind, row.byteSize, row.byteAlignment, row.stride]), [
    [0, "value", 4n, 4n, 4n], [1, "array", 8n, 4n, 12n],
  ]);
  assert.equal(record.value.layouts[1].element, 0);
  assert.equal(record.value.layouts[0].occurrence === scalar.occurrence, true);
  const incompatible = finish(deps, array, [abi, 8n, 4n, 8n, 1n, element]);
  assert.equal(incompatible.value.kind, "refused");
  assert.match(incompatible.value.diagnostics[0].message, /actual element layout/u);
});

test("Layout stops before the next original operand and retains an actual grounded dependency", () => {
  const limited = fixture(3);
  const sealed = { ...scalar, measures: { byteSize: measures.byteSize,
    get byteAlignment() { assert.fail("the later request is unpaid"); }, get stride() { assert.fail("unpaid stride"); } } };
  const stopped = layoutOf(limited.deps, sealed);
  assert.equal(stopped.value === limited.stopped(), true);
  assert.equal(accountFailure(limited.account).dimension, "work");
  const { deps } = fixture();
  const pending = layoutOf(deps, scalar);
  const detector = { request: { query: "evaluateConstant", key: scalar.key.definition }, position: { kind: "result" } };
  const answers = [
    { request: pending.requests[0], kind: "descriptor", value: abi },
    { request: pending.requests[1], kind: "grounded-error", unit: detector },
    null, null,
  ];
  Object.defineProperty(answers, 2, { get() { assert.fail("the next settled result is not read past the error"); } });
  const outcome = resumeLayout(deps, pending.paused, answers);
  assert.equal(outcome.value.diagnostics.length, 0);
  assert.equal(outcome.value.positions[0].error.causes[0].unit === detector, true);
});
