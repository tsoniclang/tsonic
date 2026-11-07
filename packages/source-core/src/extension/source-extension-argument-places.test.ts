// N8 (b), C-2496: place validity of the outer target of a reference marker (`writeonlyref` = out, `readwriteref` = ref,
// `readonlyref` = inref). Legacy records the argument passing fact on every marker call and on its target, with no
// grammar guard; the Host decides the place from the target's exact syntax and the declarations it selects, and refuses
// every non-place with TSONIC_ARGUMENT_MARKER_NOT_PLACE (site: the target, related: the marker call).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Node } from "@tsonic/tsts";
import { createHostSourceProgramFixture } from "../host-program-fixtures.js";
import {
  argumentPassingFactKey, callExpression, checkSource, createSourceCoreSession, definedDiagnostics, firstCallArgument,
  getSourceFact, sourceAst,
} from "./source-extension.fixtures.js";

type Session = ReturnType<typeof createSourceCoreSession>["session"];

const modes = Object.freeze({
  writeonlyref: "byref-writeonly-must-init",
  readwriteref: "byref-readwrite",
  readonlyref: "byref-readonly",
  out: "byref-writeonly-must-init",
  "lang.readwriteref": "byref-readwrite",
  "lang.readonlyref": "byref-readonly",
} as const);
type MarkerText = keyof typeof modes;

function placeRefusals(session: Session) {
  const checked = checkSource(session);
  assert.deepEqual(definedDiagnostics(checked.diagnostics), []);
  assert.deepEqual(checked.extensionDiagnostics.map(diagnostic => diagnostic.extensionCode), []);
  return createHostSourceProgramFixture(checked).facts.refusals()
    .filter(refusal => refusal.code === "TSONIC_ARGUMENT_MARKER_NOT_PLACE");
}

/** The exact argument-role passing fact: on the call and on its target, naming the target, in the marker's mode. */
function assertPassing(session: Session, call: Node, marker: MarkerText): Node {
  const target = firstCallArgument(session, call);
  for (const subject of [call, target]) {
    assert.deepEqual(getSourceFact(session, subject, argumentPassingFactKey),
      { role: "argument", mode: modes[marker], storageExpression: target }, marker);
  }
  return target;
}

test("N8 refuses operator, call, new and literal targets of out, ref and inref", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeonlyref, readwriteref, readonlyref } from "@tsonic/core/lang.js";
    import type { int32 } from "@tsonic/core/types.js";

    class Item { value: int32 = 0; }
    function make(): int32 { return 1; }
    let value: int32 = 1;

    export function run(): void {
      writeonlyref(value + 1);
      writeonlyref(make());
      writeonlyref(new Item());
      writeonlyref(1);
      readwriteref(value + 1);
      readwriteref(make());
      readwriteref(new Item());
      readwriteref(1);
      readonlyref(value + 1);
      readonlyref(make());
      readonlyref(new Item());
      readonlyref(1);
    }
  `);

  const refusals = placeRefusals(session);
  assert.equal(refusals.length, 12);
  for (const marker of ["writeonlyref", "readwriteref", "readonlyref"] as const) {
    for (let occurrence = 0; occurrence < 4; occurrence += 1) {
      const call = callExpression(session, sourceFile, marker, occurrence);
      const target = assertPassing(session, call, marker);
      const matching = refusals.filter(refusal => refusal.related === call);
      assert.equal(matching.length, 1, `${marker} #${occurrence}`);
      assert.equal(matching[0]?.site, target);
      assert.equal(matching[0]?.message, `${marker}(...) requires a storage expression.`);
    }
  }
});

test("N8 admits an effectful receiver's field as one storage place, evaluated once, for out, ref and inref", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeonlyref, readwriteref, readonlyref } from "@tsonic/core/lang.js";
    import type { int32 } from "@tsonic/core/types.js";

    class Cell { value: int32 = 0; }
    const cell = new Cell();
    let reads: int32 = 0;
    function receiver(): Cell { reads += 1; return cell; }

    export function run(): void {
      writeonlyref(receiver().value);
      readwriteref(receiver().value);
      readonlyref(receiver().value);
    }
  `);

  assert.deepEqual(placeRefusals(session), []);
  const ast = sourceAst(session);
  for (const [index, marker] of (["writeonlyref", "readwriteref", "readonlyref"] as const).entries()) {
    const call = callExpression(session, sourceFile, marker);
    const target = assertPassing(session, call, marker);
    // The storage place is the property access itself; its receiver is the one `receiver()` call, an ordinary
    // by-value evaluation with no passing fact of its own (no temporary, no copy-back place).
    assert.ok(ast.is.IsPropertyAccessExpression(target), marker);
    const receiverCall = callExpression(session, sourceFile, "receiver", index);
    assert.equal(ast.as.AsPropertyAccessExpression(target)?.Expression, receiverCall);
    assert.equal(getSourceFact(session, receiverCall, argumentPassingFactKey), undefined);
  }
});

test("N8 admits local, parameter, element, parenthesized, non-null-asserted, alias and namespace places and readonly inref controls", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeonlyref, readwriteref, readonlyref, writeonlyref as out } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import * as state from "./state.js";
    import { counter as aliasCounter, pair } from "./state.js";
    import type { int32 } from "@tsonic/core/types.js";

    class Cell { value: int32 = 0; readonly fixed: int32 = 1; constructor(public owned: int32) {} }
    interface Shape { size: int32; }
    const values: int32[] = [1, 2];
    const frozen: int32 = 3;
    const record = { count: 0 as int32 };

    export function run(parameter: int32, cell: Cell, shape: Shape): void {
      let local: int32 = 0;
      const [first] = values;
      writeonlyref(local);
      readwriteref(parameter);
      readonlyref(first);
      writeonlyref(values[0]);
      readwriteref((local));
      writeonlyref(cell.value);
      readwriteref(cell.owned);
      readwriteref(shape.size);
      readwriteref(record.count);
      out(state.counter);
      lang.readwriteref(aliasCounter);
      lang.readonlyref(pair);
      readonlyref(cell.fixed);
      readonlyref(frozen);
      writeonlyref(local!);
    }
  `, {
    "/src/state.ts": `
      import type { int32 } from "@tsonic/core/types.js";
      export let counter: int32 = 0;
      export let [pair] = [7 as int32];
    `,
  });

  assert.deepEqual(placeRefusals(session), []);
  const calls: readonly (readonly [MarkerText, number])[] = [
    ["writeonlyref", 0], ["readwriteref", 0], ["readonlyref", 0], ["writeonlyref", 1], ["readwriteref", 1],
    ["writeonlyref", 2], ["readwriteref", 2], ["readwriteref", 3], ["readwriteref", 4], ["out", 0],
    ["lang.readwriteref", 0], ["lang.readonlyref", 0], ["readonlyref", 1], ["readonlyref", 2], ["writeonlyref", 3],
  ];
  for (const [marker, occurrence] of calls) assertPassing(session, callExpression(session, sourceFile, marker, occurrence), marker);
});

test("N8 refuses non-storage alias, namespace, member and chain targets", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeonlyref, readwriteref, readonlyref, writeonlyref as out } from "@tsonic/core/lang.js";
    import * as lang from "@tsonic/core/lang.js";
    import * as state from "./state.js";
    import { compute as aliasCompute } from "./state.js";
    import type { int32 } from "@tsonic/core/types.js";

    enum Color { Red }
    class Box {
      get computed(): int32 { return 1; }
      set computed(value: int32) {}
      method(): int32 { return 1; }
    }

    export function run(box: Box, maybe: { value: int32 } | undefined, local: int32): void {
      out(state.compute());
      out(state.compute);
      lang.readwriteref(aliasCompute);
      readonlyref(Color.Red);
      readwriteref(box.computed);
      readonlyref(box.method);
      writeonlyref(maybe?.value);
      readwriteref(local as int32);
    }
  `, {
    "/src/state.ts": `
      import type { int32 } from "@tsonic/core/types.js";
      export function compute(): int32 { return 1; }
    `,
  });

  const refusals = placeRefusals(session);
  const calls: readonly (readonly [MarkerText, number])[] = [
    ["out", 0], ["out", 1], ["lang.readwriteref", 0], ["readonlyref", 0], ["readwriteref", 0], ["readonlyref", 1],
    ["writeonlyref", 0], ["readwriteref", 1],
  ];
  assert.equal(refusals.length, calls.length);
  for (const [marker, occurrence] of calls) {
    const call = callExpression(session, sourceFile, marker, occurrence);
    const target = assertPassing(session, call, marker);
    const matching = refusals.filter(refusal => refusal.related === call);
    assert.equal(matching.length, 1, `${marker} #${occurrence}`);
    assert.equal(matching[0]?.site, target);
    assert.equal(matching[0]?.message, `${marker.slice(marker.lastIndexOf(".") + 1)}(...) requires a storage expression.`);
  }
});

test("N8 place authority is only the argument role naming the marker's own target (WP0 A4)", () => {
  const { session, sourceFile } = createSourceCoreSession(`
    import { writeonlyref, readwriteref, readonlyref } from "@tsonic/core/lang.js";
    import type { int32 } from "@tsonic/core/types.js";

    let value: int32 = 1;
    let other: int32 = 2;
    function observe(input: int32): void {}

    export function run(): void {
      writeonlyref(value);
      readwriteref(value);
      readonlyref(value);
      observe(other);
    }
  `);
  assert.deepEqual(placeRefusals(session), []);
  const checked = checkSource(session);
  const facts = checked.sourceFacts;
  const otherReference = firstCallArgument(session, callExpression(session, sourceFile, "observe"));
  for (const marker of ["writeonlyref", "readwriteref", "readonlyref"] as const) {
    const call = callExpression(session, sourceFile, marker);
    const target = assertPassing(session, call, marker);
    // A declaration role (mode only) and an argument role naming another expression are not place authority for
    // this call: both are producer invariants, never an admission or a substituted storage.
    for (const replacement of [
      { role: "declaration", mode: modes[marker] },
      { role: "argument", mode: modes[marker], storageExpression: otherReference },
    ] as const) {
      const view = { ...checked, sourceFacts: {
        getFact: (subject: Parameters<typeof facts.getFact>[0], key: Parameters<typeof facts.getFact>[1]) =>
          subject === call && key === argumentPassingFactKey ? replacement : facts.getFact(subject, key),
        getFacts: (subject: Parameters<typeof facts.getFacts>[0]) => facts.getFacts(subject),
        getVirtualDeclarationDocument: (uri: string) => facts.getVirtualDeclarationDocument(uri),
      } as typeof facts };
      assert.throws(() => createHostSourceProgramFixture(view).facts.refusals(),
        /a reference marker call has no argument-role passing fact naming its target/, `${marker} ${replacement.role}`);
    }
    assert.notEqual(target, otherReference);
  }
});
