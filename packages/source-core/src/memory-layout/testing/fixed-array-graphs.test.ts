import assert from "node:assert/strict";
import { test } from "node:test";
import {
  countTsonicMemoryLayoutValues, readTsonicMemoryLayout, tsonicMemoryLayoutFactKey,
} from "../../public/facts.js";
import type { TsonicArrayMemoryLayoutFact, TsonicMemoryLayoutFact } from "../../public/facts.js";
import { maximumMemoryLayoutDepth } from "../facts.js";
import { memoryCall, valueMemoryLayout } from "./fixtures.js";
import { arrayLayoutAt, arrayMemoryLayout, cleanArraySession } from "./fixed-array-fixtures.js";

function graphFixture() {
  const checked = cleanArraySession(`
    const small = memoryArrayLayout(abi, 0, 4, 0, empty, 2);
    const huge = memoryArrayLayout(abi, 0, 4, 0, empty, 9007199254740993n);
    interface Pair { left: FixedArray<Empty, 2>; right: FixedArray<Empty, 2> }
    const pair = memoryLayout<Pair>(abi, 0, 4, 0,
      memoryField((value: Pair) => value.left, 0, 4, small),
      memoryField((value: Pair) => value.right, 0, 4, small));
    const pairs = memoryArrayLayout(abi, 0, 4, 0, pair, 2);
    sizeOf(pairs);
  `);
  return { checked, small: arrayLayoutAt(checked), huge: arrayLayoutAt(checked, 1), root: arrayLayoutAt(checked, 2) };
}

test("array fact snapshots freeze exact data and preserve compiler subjects and shared descendants", () => {
  const { root, huge } = graphFixture();
  const child = { ...huge.elementLayout };
  const fixedArray = { ...huge.fixedArray };
  const input = { ...huge, fixedArray, elementLayout: child };
  const subjects = [input.call, input.sourceType, input.fixedArray.elementSourceType, input.elementLayoutExpression];
  const priorFrozen = subjects.map(subject => Object.isFrozen(subject));
  const captured = arrayMemoryLayout(tsonicMemoryLayoutFactKey.snapshot(input));
  assert.notEqual(captured, input);
  assert.notEqual(captured.fixedArray, fixedArray);
  assert.notEqual(captured.elementLayout, child);
  for (const value of [captured, captured.fixedArray, captured.elementLayout, captured.dataLayout,
    captured.dataLayout.providerDeclaration]) assert.ok(Object.isFrozen(value));
  assert.equal(captured.call, input.call);
  assert.equal(captured.sourceType, input.sourceType);
  assert.equal(captured.elementLayoutExpression, input.elementLayoutExpression);
  assert.deepEqual(subjects.map(subject => Object.isFrozen(subject)), priorFrozen);
  fixedArray.length = 9007199254740992n;
  child.stride = 4;
  assert.equal(captured.fixedArray.length, 9007199254740993n);
  assert.equal(captured.elementLayout.stride, 0);
  const shared = arrayMemoryLayout(tsonicMemoryLayoutFactKey.snapshot(root));
  const pair = valueMemoryLayout(shared.elementLayout);
  assert.equal(pair.fields[0]?.fieldLayout, pair.fields[1]?.fieldLayout);
  assert.ok(Object.isFrozen(pair.fields));
  assert.ok(Object.isFrozen(pair.fields[0]));
});

test("array equality distinguishes adjacent exact counts, every array edge and deep descendants", () => {
  const { huge, root } = graphFixture();
  const clone = tsonicMemoryLayoutFactKey.snapshot({ ...huge });
  assert.ok(tsonicMemoryLayoutFactKey.equals(huge, clone));
  const changes: readonly TsonicArrayMemoryLayoutFact[] = [
    { ...huge, fixedArray: { ...huge.fixedArray, length: 9007199254740992n } },
    { ...huge, fixedArray: { ...huge.fixedArray, elementSourceType: root.sourceType } },
    { ...huge, elementLayoutExpression: root.elementLayoutExpression },
    { ...huge, elementLayout: { ...huge.elementLayout, call: root.elementLayout.call } },
    { ...huge, elementLayout: { ...huge.elementLayout, byteAlignment: 2 } },
    { ...huge, byteAlignment: 8 },
    { ...huge, byteSize: 4, stride: 4 },
    { ...huge, stride: 4 },
  ];
  for (const changed of changes) {
    const snapshot = tsonicMemoryLayoutFactKey.snapshot(changed);
    assert.equal(tsonicMemoryLayoutFactKey.equals(huge, snapshot), false);
    assert.equal(tsonicMemoryLayoutFactKey.equals(snapshot, huge), false);
  }
  const { fixedArray, elementLayout, elementLayoutExpression, ...base } = huge;
  assert.ok(fixedArray && elementLayout && elementLayoutExpression);
  assert.equal(tsonicMemoryLayoutFactKey.equals(huge,
    tsonicMemoryLayoutFactKey.snapshot({ ...base, kind: "value", fields: [] })), false);
  const pair = valueMemoryLayout(root.elementLayout);
  const nested = arrayMemoryLayout(pair.fields[0]?.fieldLayout);
  const changed = { ...root, elementLayout: { ...pair, fields: [
    { ...pair.fields[0]!, fieldLayout: { ...nested, elementLayout: { ...nested.elementLayout, byteAlignment: 2 } } },
    pair.fields[1]!,
  ] } };
  assert.equal(tsonicMemoryLayoutFactKey.equals(root, tsonicMemoryLayoutFactKey.snapshot(changed)), false);
});

test("array snapshots reject missing or mixed variants and accessors without invoking user code", () => {
  const { huge } = graphFixture();
  for (const key of ["kind", "fixedArray", "elementLayoutExpression", "elementLayout"] as const) {
    const missing = { ...huge };
    Reflect.deleteProperty(missing, key);
    assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(missing), /missing|discriminator/u);
    let executed = false;
    const accessor = Object.defineProperty({ ...huge }, key, {
      get() { executed = true; return huge[key]; },
    });
    assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(accessor), /accessor|discriminator/u);
    assert.equal(executed, false);
  }
  for (const additions of [{ fields: [] }, { length: 9007199254740993n }, { elementStride: 0 }, { [Symbol("extra")]: true }]) {
    assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...huge, ...additions }), /unexpected/u);
  }
  const malformed = { ...huge, kind: "value" } as unknown as TsonicMemoryLayoutFact;
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(malformed), /unexpected|missing/u);
  let executed = false;
  const accessor = Object.defineProperty({ ...huge.fixedArray }, "length", {
    get() { executed = true; return 2n; },
  });
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...huge, fixedArray: accessor }), /accessor/u);
  assert.equal(executed, false);
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...huge,
    fixedArray: { ...huge.fixedArray, length: Number(huge.fixedArray.length) } as never }));
});

test("array child ABI comparisons retain every provider identity and descriptor component", () => {
  const { small } = graphFixture();
  const child = small.elementLayout;
  for (const key of ["providerId", "providerVersion", "providerModuleId", "moduleSpecifier", "exportId"] as const) {
    const dataLayout = { ...child.dataLayout, providerDeclaration: {
      ...child.dataLayout.providerDeclaration, [key]: `${child.dataLayout.providerDeclaration[key]}-other`,
    } };
    assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...small, elementLayout: { ...child, dataLayout } }), /different ABI/u);
  }
  for (const patch of [{ fingerprint: "stale" }, { addressWidth: 32 as const }, { byteOrder: "big" as const }]) {
    assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...small,
      elementLayout: { ...child, dataLayout: { ...child.dataLayout, ...patch } } }), /different ABI/u);
  }
});

test("array and alternating array-record cycles fail closed before recursive expansion", () => {
  const { small, root } = graphFixture();
  const cycle = { ...small };
  cycle.elementLayout = cycle;
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(cycle), /recursive physical value/u);
  assert.equal(countTsonicMemoryLayoutValues(cycle, 32), undefined);
  const record = valueMemoryLayout(root.elementLayout);
  const fields = [...record.fields];
  const alternating = { ...root, elementLayout: { ...record, fields } };
  fields[0] = { ...fields[0]!, fieldLayout: alternating };
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(alternating), /recursive physical value/u);
  assert.equal(countTsonicMemoryLayoutValues(alternating, 32), undefined);
});

test("array depth bounds include captured children and shared children reached by deeper routes", () => {
  const { small, root } = graphFixture();
  let child: TsonicMemoryLayoutFact = { ...small.elementLayout };
  for (let depth = 1; depth < maximumMemoryLayoutDepth; depth += 1) {
    child = tsonicMemoryLayoutFactKey.snapshot({ ...small, elementLayout: child });
  }
  assert.equal(countTsonicMemoryLayoutValues(child, maximumMemoryLayoutDepth), maximumMemoryLayoutDepth);
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...small, elementLayout: child }), /supported nesting depth/u);
  const record = valueMemoryLayout(root.elementLayout);
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...record, fields: [
    record.fields[0]!, { ...record.fields[1]!, fieldLayout: child },
  ] }), /supported nesting depth/u);
  let uncaptured: TsonicMemoryLayoutFact = { ...small.elementLayout };
  for (let depth = 0; depth < maximumMemoryLayoutDepth; depth += 1) uncaptured = { ...small, elementLayout: uncaptured };
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot(uncaptured), /supported nesting depth/u);
});

test("array edges cannot conceal an oversized uncaptured child snapshot", () => {
  const { root } = graphFixture();
  const record = valueMemoryLayout(root.elementLayout);
  const fields = Array.from({ length: 65536 }, () => ({ ...record.fields[0]! }));
  assert.throws(() => tsonicMemoryLayoutFactKey.snapshot({ ...root,
    elementLayout: { ...record, fields } }), /metadata value budget/u);
});

test("public source-produced array-record DAGs share children without multiplying metadata by count", () => {
  const declarations = ["type Layer0 = Empty; const layer0 = empty;"];
  for (let depth = 1; depth <= 16; depth += 1) {
    declarations.push(`
      const array${depth} = memoryArrayLayout(abi, 0, 4, 0, layer${depth - 1}, 9007199254740993n);
      interface Layer${depth} { left: FixedArray<Layer${depth - 1}, 9007199254740993n>; right: FixedArray<Layer${depth - 1}, 9007199254740993n> }
      const layer${depth} = memoryLayout<Layer${depth}>(abi, 0, 4, 0,
        memoryField((value: Layer${depth}) => value.left, 0, 4, array${depth}),
        memoryField((value: Layer${depth}) => value.right, 0, 4, array${depth}));
    `);
  }
  const checked = cleanArraySession(declarations.join("\n"));
  let current = valueMemoryLayout(readTsonicMemoryLayout(checked.sourceFacts, memoryCall(checked, "memoryLayout", 17)));
  assert.equal(countTsonicMemoryLayoutValues(current, 131072), undefined);
  const visited = new Set<TsonicMemoryLayoutFact>();
  for (let depth = 16; depth > 0; depth -= 1) {
    visited.add(current);
    assert.equal(current.fields[0]?.fieldLayout, current.fields[1]?.fieldLayout);
    const array = arrayMemoryLayout(current.fields[0]?.fieldLayout);
    visited.add(array);
    assert.equal(array.fixedArray.length, 9007199254740993n);
    current = valueMemoryLayout(array.elementLayout);
  }
  visited.add(current);
  assert.equal(visited.size, 33);
  assert.equal(current.fields.length, 0);
});
