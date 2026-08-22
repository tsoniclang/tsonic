import assert from "node:assert/strict";
import test from "node:test";
import type {
  AstReader,
  Node,
} from "@tsonic/tsts";
import {
  ObjectLiteralProperty_SourceName,
} from "./ast.js";

test("object-literal property names preserve exact authored key semantics", () => {
  const identifier = node("identifier", "value");
  const stringLiteral = node("string", "quoted");
  const numericLiteral = node("numeric", "0x10");
  const separatedNumericLiteral = node("numeric", "1_000");
  const nonFiniteNumericLiteral = node("numeric", "1e999");
  const computed = node("computed", "ignored");
  const properties = [
    property(identifier),
    property(stringLiteral),
    property(numericLiteral),
    property(separatedNumericLiteral),
    property(nonFiniteNumericLiteral),
    property(computed),
    property(undefined),
  ];
  const reader = ast();

  assert.deepEqual(
    properties.map((value) =>
      ObjectLiteralProperty_SourceName(reader, value)),
    [
      { kind: "resolved", name: "value" },
      { kind: "resolved", name: "quoted" },
      { kind: "resolved", name: "16" },
      { kind: "resolved", name: "1000" },
      { kind: "rejected", reason: "non-finite-numeric-literal" },
      { kind: "rejected", reason: "unsupported-name-kind" },
      { kind: "rejected", reason: "missing-name" },
    ],
  );
});

function ast(): AstReader {
  return {
    name: (value: Node) => (value as PropertyNode).propertyName,
    text: (value: Node) => (value as NamedNode).text,
    is: {
      IsIdentifier: (value: Node) => (value as NamedNode).kind === "identifier",
      IsStringLiteral: (value: Node) => (value as NamedNode).kind === "string",
      IsNumericLiteral: (value: Node) => (value as NamedNode).kind === "numeric",
    },
  } as never;
}

interface NamedNode extends Node {
  readonly kind: "identifier" | "string" | "numeric" | "computed";
  readonly text: string;
}

interface PropertyNode extends Node {
  readonly propertyName: Node | undefined;
}

function node(kind: NamedNode["kind"], text: string): Node {
  return { kind, text } as never;
}

function property(propertyName: Node | undefined): Node {
  return { propertyName } as never;
}
