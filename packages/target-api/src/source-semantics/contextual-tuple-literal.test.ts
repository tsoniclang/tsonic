import assert from "node:assert/strict";
import test from "node:test";
import type {
  Node,
  Type,
  TypeTupleElementInfo,
} from "@tsonic/tsts";
import {
  selectSourceContextualTupleLiteral,
} from "./contextual-tuple-literal.js";
import type {
  SourceContextualValueTypeSelection,
  SourceFileSemantics,
} from "./types.js";

test("contextual tuple literals retain exact trailing optional omissions", () => {
  const contextualType = type();
  const elements: readonly TypeTupleElementInfo[] = [
    { type: type(), elementKind: "required" },
    { type: type(), elementKind: "optional" },
    { type: type(), elementKind: "optional" },
  ];
  const semantics = sourceSemantics(
    { kind: "selected", type: contextualType },
    contextualType,
    elements,
  );

  assert.deepEqual(
    selectSourceContextualTupleLiteral(semantics, node(), 1),
    {
      kind: "selected",
      type: contextualType,
      elements,
      omittedOptionalElementIndexes: [1, 2],
    },
  );
  assert.deepEqual(
    selectSourceContextualTupleLiteral(semantics, node(), 3),
    {
      kind: "selected",
      type: contextualType,
      elements,
      omittedOptionalElementIndexes: [],
    },
  );
});

test("contextual tuple literals fail closed for non-trailing or variable omissions", () => {
  for (const elementKinds of [
    ["required", "required"],
    ["required", "rest"],
    ["required", "variadic"],
  ] as const) {
    const contextualType = type();
    const elements = elementKinds.map((elementKind) => ({
      type: type(),
      elementKind,
    }));
    assert.deepEqual(
      selectSourceContextualTupleLiteral(
        sourceSemantics(
          { kind: "selected", type: contextualType },
          contextualType,
          elements,
        ),
        node(),
        1,
      ),
      { kind: "unavailable" },
    );
  }
});

test("contextual tuple literals reject absent, ambiguous, and contradictory context", () => {
  const contextualType = type();
  const alternatives = [
    { kind: "unavailable" },
    { kind: "ambiguous", types: [type(), type()] },
  ] satisfies readonly SourceContextualValueTypeSelection[];
  for (const selection of alternatives) {
    assert.deepEqual(
      selectSourceContextualTupleLiteral(
        sourceSemantics(selection, contextualType, []),
        node(),
        0,
      ),
      { kind: "unavailable" },
    );
  }
  assert.deepEqual(
    selectSourceContextualTupleLiteral(
      sourceSemantics(
        { kind: "selected", type: contextualType },
        contextualType,
        [{ type: type(), elementKind: "optional" }],
      ),
      node(),
      2,
    ),
    { kind: "unavailable" },
  );
  assert.throws(
    () => selectSourceContextualTupleLiteral(
      sourceSemantics(
        { kind: "selected", type: contextualType },
        contextualType,
        [],
      ),
      node(),
      -1,
    ),
    /non-negative safe present-element count/u,
  );
});

function sourceSemantics(
  selection: SourceContextualValueTypeSelection,
  tupleType: Type,
  elements: readonly TypeTupleElementInfo[],
): SourceFileSemantics {
  return {
    selectContextualValueType: () => selection,
    isTuple: (candidate: Type) => candidate === tupleType,
    getTupleElementInfos: (candidate: Type) =>
      candidate === tupleType ? elements : [],
  } as unknown as SourceFileSemantics;
}

function node(): Node {
  return {} as Node;
}

function type(): Type {
  return {} as Type;
}
