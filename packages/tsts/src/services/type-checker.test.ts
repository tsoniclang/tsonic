import { test } from "node:test";
import assert from "node:assert/strict";
import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import { Background } from "../go/context.js";
import { Node_Text } from "../internal/ast/ast.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import { Node_ForEachChild, Node_Name } from "../internal/ast/spine.js";
import { Diagnostic_String } from "../internal/ast/diagnostic.js";
import { KindArrowFunction, KindCallExpression, KindExpressionStatement, KindIdentifier, KindPropertyAccessExpression } from "../internal/ast/generated/kinds.js";
import { LibPath, WrapFS } from "../internal/bundled/bundled.js";
import type { CompilerOptions } from "../internal/core/compileroptions.js";
import { NewCompilerHost } from "../internal/compiler/host.js";
import { NewProgram, Program_GetSemanticDiagnostics, Program_GetSourceFile } from "../internal/compiler/program.js";
import type { Program, ProgramOptions } from "../internal/compiler/program.js";
import { TypeFlagsNumber, TypeFlagsString } from "../internal/checker/types.js";
import type { ParseConfigHost } from "../internal/tsoptions/tsconfigparsing.js";
import { GetParsedCommandLineOfConfigFile } from "../internal/tsoptions/tsconfigparsing.js";
import { FromMap } from "../internal/vfs/vfstest/vfstest.js";
import { createTypeCheckerQueries } from "../index.js";

test("public type-checker queries expose TS-Go checker facts without emitter re-analysis", () => {
  const { program, index } = createProgram(`
    function id<T>(x: T): T { return x; }
    declare function takes(callback: (value: number) => void): void;
    declare let value: string | number;

    if (typeof value === "string") {
      value;
    }

    id(1);
    takes(parameter => parameter);
  `);
  assertCleanSemanticDiagnostics(program, index);

  const queries = createTypeCheckerQueries(program);
  const narrowedValue = findIdentifierByText(index, "value", (node) => node?.Parent?.Kind === KindExpressionStatement);
  const narrowedType = queries.getTypeAtLocation(narrowedValue);
  assert.equal((narrowedType?.flags ?? 0) & TypeFlagsString, TypeFlagsString);

  const valueSymbol = queries.getSymbolAtLocation(narrowedValue);
  assert.equal(valueSymbol?.Name, "value");
  const resolvedValueSymbol = queries.getResolvedSymbol(narrowedValue);
  assert.equal(resolvedValueSymbol?.Name, "value");
  assert.equal(queries.getResolvedSymbolOrNil(narrowedValue), resolvedValueSymbol);
  assert.ok(queries.getTypeOfSymbol(valueSymbol) !== undefined);
  assert.ok(queries.getDeclaredTypeOfSymbol(valueSymbol) !== undefined);

  const call = findFirstNodeByKind(index, KindCallExpression);
  const signature = queries.getResolvedSignature(call);
  assert.equal(signature?.parameters[0]?.Name, "x");

  const arrow = findFirstNodeByKind(index, KindArrowFunction);
  assert.ok(queries.getContextualType(arrow) !== undefined);
});

test("public type-checker queries expose instantiated generic member types", () => {
  const { program, index } = createProgram(`
    type int = number;
    class Box<T> { value!: T; }
    declare const nested: Box<Box<int>>;

    nested.value.value;
  `);
  assertCleanSemanticDiagnostics(program, index);

  const queries = createTypeCheckerQueries(program);
  const finalValueAccess = findPropertyAccessByName(index, "value", (node) => node?.Parent?.Kind === KindExpressionStatement);
  const finalValueType = queries.getTypeAtLocation(finalValueAccess);
  assert.equal((finalValueType?.flags ?? 0) & TypeFlagsNumber, TypeFlagsNumber);

  const finalValueSymbol = queries.getSymbolAtLocation(Node_Name(finalValueAccess));
  assert.equal(finalValueSymbol?.Name, "value");
});

test("public type-checker queries expose flow-narrowed receiver member access", () => {
  const { program, index } = createProgram(`
    class PageValue { value!: string; }
    declare let current: PageValue | number;

    if (current instanceof PageValue) {
      current;
      current.value;
    }
  `);
  assertCleanSemanticDiagnostics(program, index);

  const queries = createTypeCheckerQueries(program);
  const narrowedCurrent = findIdentifierByText(index, "current", (node) => node?.Parent?.Kind === KindExpressionStatement);
  const narrowedCurrentType = queries.getTypeAtLocation(narrowedCurrent);
  assert.equal(narrowedCurrentType?.symbol?.Name, "PageValue");

  const valueAccess = findPropertyAccessByName(index, "value", (node) => node?.Parent?.Kind === KindExpressionStatement);
  const valueType = queries.getTypeAtLocation(valueAccess);
  assert.equal((valueType?.flags ?? 0) & TypeFlagsString, TypeFlagsString);
  assert.equal(queries.getSymbolAtLocation(Node_Name(valueAccess))?.Name, "value");
});

function createProgram(sourceText: string): { readonly program: GoPtr<Program>; readonly index: GoPtr<SourceFile> } {
  let fs = FromMap(new Map<string, string>([
    ["/src/index.ts", sourceText],
    ["/src/tsconfig.json", JSON.stringify({
      compilerOptions: {
        noLib: true,
        module: "esnext",
        moduleResolution: "bundler",
        strict: true,
      },
      files: ["index.ts"],
    })],
  ]), false as bool);
  fs = WrapFS(fs);

  const host = NewCompilerHost("/src", fs, LibPath(), undefined, undefined);
  const [parsed, configErrors] = GetParsedCommandLineOfConfigFile("/src/tsconfig.json", {} as CompilerOptions, undefined, host as ParseConfigHost, undefined);
  assert.equal((configErrors ?? []).length, 0);

  const options = {
    Config: parsed,
    Host: host,
  } satisfies ProgramOptions;
  const program = NewProgram(options);
  const index = Program_GetSourceFile(program, "/src/index.ts");
  assert.ok(index !== undefined);
  return { program, index };
}

function assertCleanSemanticDiagnostics(program: GoPtr<Program>, sourceFile: GoPtr<SourceFile>): void {
  const diagnostics = Program_GetSemanticDiagnostics(program, Background(), sourceFile);
  assert.equal(diagnostics.length, 0, diagnostics.map(Diagnostic_String).join("\n"));
}

function findIdentifierByText(root: GoPtr<Node>, text: string, predicate: (node: GoPtr<Node>) => boolean): GoPtr<Node> {
  let found: GoPtr<Node>;
  visitNodes(root, (node) => {
    if (found === undefined && node?.Kind === KindIdentifier && Node_Text(node) === text && predicate(node)) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function findFirstNodeByKind(root: GoPtr<Node>, kind: number): GoPtr<Node> {
  let found: GoPtr<Node>;
  visitNodes(root, (node) => {
    if (found === undefined && node?.Kind === kind) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function findPropertyAccessByName(root: GoPtr<Node>, name: string, predicate: (node: GoPtr<Node>) => boolean): GoPtr<Node> {
  let found: GoPtr<Node>;
  visitNodes(root, (node) => {
    if (found === undefined && node?.Kind === KindPropertyAccessExpression && Node_Text(Node_Name(node)) === name && predicate(node)) {
      found = node;
    }
  });
  assert.ok(found !== undefined);
  return found;
}

function visitNodes(root: GoPtr<Node>, visit: (node: GoPtr<Node>) => void): void {
  if (root === undefined) {
    return;
  }
  visit(root);
  Node_ForEachChild(root, (child) => {
    visitNodes(child, visit);
    return false as bool;
  });
}
