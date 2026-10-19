import assert from "node:assert/strict";
import test from "node:test";
import type {
  Node,
  Symbol,
  Type,
} from "@tsonic/tsts";
import {
  selectSourceObjectLiteralAccessors,
} from "./object-literal-accessors.js";

test("object-literal accessors group exact selected getter and setter evidence", () => {
  const literal = node("literal");
  const getter = node("getter");
  const setter = node("setter");
  const declaration = node("declaration");
  const selectedSymbol = symbol("value");
  const getterSymbol = symbol("value");
  const setterSymbol = symbol("value");
  const selectedType = type();
  const elements = [getter, setter];
  const infos = new Map<Node, object>([
    [getter, info(literal, getter, "get", getterSymbol, selectedSymbol, declaration, selectedType)],
    [setter, info(literal, setter, "set", setterSymbol, selectedSymbol, declaration, selectedType)],
  ]);

  const selected = selectSourceObjectLiteralAccessors(
    ast(literal, elements, getter, setter),
    semantics(infos),
    literal,
  );

  assert.equal(selected.kind, "resolved");
  if (selected.kind !== "resolved") {
    return;
  }
  assert.equal(selected.members.length, 1);
  assert.equal(selected.members[0]?.sourceName, "value");
  assert.equal(selected.members[0]?.getter?.element, getter);
  assert.equal(selected.members[0]?.setter?.element, setter);
});

test("object-literal accessors fail closed when selected evidence is absent", () => {
  const literal = node("literal");
  const getter = node("getter");
  const selected = selectSourceObjectLiteralAccessors(
    ast(literal, [getter], getter, undefined),
    semantics(new Map()),
    literal,
  );
  assert.deepEqual(selected, {
    kind: "rejected",
    element: getter,
    reason: "Object-literal accessor has no exact checker-selected element identity.",
  });
});

test("object-literal accessors reject contradictory getter and setter evidence", () => {
  const literal = node("literal");
  const getter = node("getter");
  const setter = node("setter");
  const getterDeclaration = node("getterDeclaration");
  const setterDeclaration = node("setterDeclaration");
  const selectedSymbol = symbol("value");
  const getterType = type();
  const setterType = type();
  const infos = new Map<Node, object>([
    [getter, info(
      literal,
      getter,
      "get",
      symbol("value"),
      selectedSymbol,
      getterDeclaration,
      getterType,
    )],
    [setter, info(
      literal,
      setter,
      "set",
      symbol("value"),
      selectedSymbol,
      setterDeclaration,
      setterType,
    )],
  ]);

  const selected = selectSourceObjectLiteralAccessors(
    ast(literal, [getter, setter], getter, setter),
    semantics(infos),
    literal,
  );

  assert.deepEqual(selected, {
    kind: "rejected",
    element: setter,
    reason: "Object-literal accessor pair has contradictory selected source evidence.",
  });
});

test("object-literal accessors preserve distinct role-specific getter and setter types", () => {
  const literal = node("literal");
  const getter = node("getter");
  const setter = node("setter");
  const declaration = node("declaration");
  const selectedSymbol = symbol("value");
  const getterType = type();
  const setterType = type();
  const infos = new Map<Node, object>([
    [getter, info(
      literal,
      getter,
      "get",
      symbol("value"),
      selectedSymbol,
      declaration,
      getterType,
    )],
    [setter, info(
      literal,
      setter,
      "set",
      symbol("value"),
      selectedSymbol,
      declaration,
      setterType,
    )],
  ]);

  const selected = selectSourceObjectLiteralAccessors(
    ast(literal, [getter, setter], getter, setter),
    semantics(infos),
    literal,
  );

  assert.equal(selected.kind, "resolved");
  assert.equal(selected.kind === "resolved" ? selected.members.length : 0, 1);
});

function ast(
  literal: Node,
  elements: readonly Node[],
  getter: Node,
  setter: Node | undefined,
) {
  return {
    is: {
      IsObjectLiteralExpression: (value: Node) => value === literal,
      IsGetAccessorDeclaration: (value: Node) => value === getter,
      IsSetAccessorDeclaration: (value: Node) => value === setter,
    },
    properties: (value: Node) => value === literal ? elements : [],
  } as never;
}

function semantics(infos: ReadonlyMap<Node, object>) {
  return {
    operations: {
      objectLiteralElement: (element: Node) => infos.get(element),
    },
    declarations: {
      symbolName: (value: Symbol | undefined) =>
        (value as { readonly name?: string } | undefined)?.name ?? "",
    },
  } as never;
}

function info(
  literal: Node,
  element: Node,
  elementKind: "get" | "set",
  sourceElementSymbol: Symbol,
  sourceSelectedSymbol: Symbol,
  declaration: Node,
  sourceSelectedType: Type,
) {
  return {
    objectLiteral: literal,
    element,
    elementKind,
    objectLiteralType: type(),
    sourceElementSymbol,
    sourceElementType: sourceSelectedType,
    sourceSelectedSymbol,
    sourceSelectedDeclaration: declaration,
    sourceSelectedDeclarations: [declaration],
    sourceSelectedType,
  };
}

function node(name: string): Node {
  return { name } as never;
}

function symbol(name: string): Symbol {
  return { name } as never;
}

function type(): Type {
  return {} as never;
}
