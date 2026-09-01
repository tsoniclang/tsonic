import assert from "node:assert/strict";
import test from "node:test";
import type { AstReader, Node } from "@tsonic/tsts";
import { isTypeSyntaxNode, referenceQueryNode } from "./syntax.js";

test("type-query navigation selects the exact authored expression name", () => {
  const firstIdentifier = namedNode("identifier", "storage");
  const secondIdentifier = namedNode("identifier", "storage");
  const qualifiedName = namedNode("qualified", "namespace.storage");
  const firstQuery = typeQuery(firstIdentifier);
  const secondQuery = typeQuery(secondIdentifier);
  const qualifiedQuery = typeQuery(qualifiedName);
  const ast = typeQueryAst();

  assert.equal(isTypeSyntaxNode(ast, firstQuery), true);
  assert.equal(referenceQueryNode(ast, firstQuery), firstIdentifier);
  assert.equal(referenceQueryNode(ast, secondQuery), secondIdentifier);
  assert.equal(referenceQueryNode(ast, qualifiedQuery), qualifiedName);
  assert.notEqual(
    referenceQueryNode(ast, firstQuery),
    referenceQueryNode(ast, secondQuery),
    "same-spelled queries must retain distinct node identities",
  );
  assert.equal(
    referenceQueryNode(ast, firstIdentifier),
    firstIdentifier,
    "an ordinary same-spelled reference remains its own query node",
  );
});

interface NamedNode extends Node {
  readonly testKind: "identifier" | "qualified";
  readonly authoredText: string;
}

interface TypeQueryTestNode extends Node {
  readonly testKind: "type-query";
  readonly ExprName: Node;
}

function namedNode(
  testKind: NamedNode["testKind"],
  authoredText: string,
): Node {
  return { testKind, authoredText } as never;
}

function typeQuery(ExprName: Node): Node {
  return { testKind: "type-query", ExprName } as never;
}

function typeQueryAst(): AstReader {
  const isKind = (node: Node, kind: string): boolean =>
    (node as NamedNode | TypeQueryTestNode).testKind === kind;
  return {
    parent: () => undefined,
    as: {
      AsTypeQueryNode: (node: Node) =>
        isKind(node, "type-query") ? node as TypeQueryTestNode : undefined,
    },
    is: {
      IsTypeQueryNode: (node: Node) => isKind(node, "type-query"),
      IsIdentifier: (node: Node) => isKind(node, "identifier"),
      IsPrivateIdentifier: () => false,
      IsPropertyAccessExpression: () => false,
      IsElementAccessExpression: () => false,
      IsQualifiedName: (node: Node) => isKind(node, "qualified"),
      IsTypeReferenceNode: () => false,
      IsExpressionWithTypeArguments: () => false,
    },
  } as never;
}
