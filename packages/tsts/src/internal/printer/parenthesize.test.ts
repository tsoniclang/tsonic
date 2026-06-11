// Mirror of internal/printer/printer_test.go — the TestParenthesize* family,
// TestNameGeneration, TestNoTrailingCommaAfterTransform,
// TestTrailingCommaAfterTransform, TestPartiallyEmittedExpression and
// TestParenthesizeBinaryExpressionMixingNullishCoalescing. The Go tests build
// synthetic trees from a zero-value ast.NodeFactory; testutil helpers
// (parsetestutil.ParseTypeScript / MarkSyntheticRecursive,
// emittestutil.CheckEmit) are inlined.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { GoPtr } from "../../go/compat.js";
import type { SourceFile } from "../ast/ast.js";
import { NodeFactory_NewSourceFile, SourceFile_Diagnostics } from "../ast/ast.js";
import { Diagnostic_MessageKey } from "../ast/diagnostic.js";
import type { Kind } from "../ast/generated/kinds.js";
import {
  KindAmpersandAmpersandToken,
  KindAmpersandToken,
  KindArrowFunction,
  KindAsteriskAsteriskToken,
  KindAsteriskToken,
  KindBarBarToken,
  KindBarToken,
  KindCaretToken,
  KindColonToken,
  KindCommaToken,
  KindEndOfFile,
  KindEqualsGreaterThanToken,
  KindEqualsToken,
  KindIdentifier,
  KindKeyOfKeyword,
  KindNonNullExpression,
  KindPlusToken,
  KindQuestionDotToken,
  KindQuestionQuestionToken,
  KindQuestionToken,
  KindReadonlyKeyword,
  KindSlashToken,
  KindUnknown,
} from "../ast/generated/kinds.js";
import type { NodeFactory } from "../ast/generated/factory.js";
import {
  NewArrayLiteralExpression,
  NewArrayTypeNode,
  NewArrowFunction,
  NewAsExpression,
  NewAwaitExpression,
  NewBinaryExpression,
  NewBlock,
  NewCallExpression,
  NewClassDeclaration,
  NewClassExpression,
  NewComputedPropertyName,
  NewConditionalExpression,
  NewConditionalTypeNode,
  NewDecorator,
  NewDeleteExpression,
  NewElementAccessExpression,
  NewExportAssignment,
  NewExpressionStatement,
  NewExpressionWithTypeArguments,
  NewFunctionDeclaration,
  NewFunctionExpression,
  NewFunctionTypeNode,
  NewIdentifier,
  NewIndexedAccessTypeNode,
  NewInferTypeNode,
  NewIntersectionTypeNode,
  NewNewExpression,
  NewNonNullExpression,
  NewNoSubstitutionTemplateLiteral,
  NewOptionalTypeNode,
  NewObjectLiteralExpression,
  NewPropertyAccessExpression,
  NewPropertyDeclaration,
  NewSatisfiesExpression,
  NewSpreadElement,
  NewTaggedTemplateExpression,
  NewToken,
  NewTupleTypeNode,
  NewTypeAliasDeclaration,
  NewTypeAssertion,
  NewTypeOfExpression,
  NewTypeOperatorNode,
  NewTypeParameterDeclaration,
  NewTypeQueryNode,
  NewTypeReferenceNode,
  NewUnionTypeNode,
  NewVariableDeclaration,
  NewVariableDeclarationList,
  NewVariableStatement,
  NewVoidExpression,
  NewYieldExpression,
} from "../ast/generated/factory.js";
import { AsBinaryExpression } from "../ast/generated/casts.js";
import type { SourceFileParseOptions } from "../ast/parseoptions.js";
import type { Node, NodeFactoryHooks } from "../ast/spine.js";
import { NewNodeFactory, NodeFactory_NewModifierList, NodeFactory_NewNodeList, Node_VisitEachChild } from "../ast/spine.js";
import { Node_Expression } from "../ast/ast.js";
import type { NodeVisitor, NodeVisitorHooks } from "../ast/visitor.js";
import { NewNodeVisitor, NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitSourceFile } from "../ast/visitor.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { NewLineKindLF } from "../core/compileroptions.js";
import { GetScriptKindFromFileName } from "../core/core.js";
import { LanguageVariantJSX } from "../core/languagevariant.js";
import { UndefinedTextRange } from "../core/text.js";
import { NodeFlagsNone, NodeFlagsOptionalChain } from "../ast/generated/flags.js";
import { TokenFlagsNone } from "../ast/tokenflags.js";
import { ParseSourceFile } from "../parser/parser/statements-declarations.js";
import type { TransformOptions } from "../transformers/chain.js";
import { Transformer_TransformSourceFile } from "../transformers/transformer.js";
import { NewTypeEraserTransformer } from "../transformers/tstransforms/typeeraser.js";
import type { EmitContext } from "./emitcontext.js";
import { EmitContext_NewNodeVisitor, NewEmitContext } from "./emitcontext.js";
import { NodeFactory_NewTempVariable } from "./factory.js";
import { NewPrinter } from "./printer/expressions.js";
import type { PrinterOptions, PrintHandlers } from "./printer/state.js";
import { Printer_EmitSourceFile } from "./printer/source-maps.js";

// testutil/parsetestutil.ParseTypeScript
function parseTypeScript(text: string, jsx: boolean): GoPtr<SourceFile> {
  const fileName = jsx ? "/main.tsx" : "/main.ts";
  return ParseSourceFile({ FileName: fileName, Path: fileName } as SourceFileParseOptions, text, GetScriptKindFromFileName(fileName));
}

// testutil/parsetestutil.CheckDiagnostics
function checkDiagnostics(file: GoPtr<SourceFile>, message: string): void {
  const diagnostics = SourceFile_Diagnostics(file) ?? [];
  assert.equal(diagnostics.length, 0, `${message}${diagnostics.map((d) => Diagnostic_MessageKey(d)).join("\n")}`);
}

// testutil/emittestutil.CheckEmit
function checkEmit(emitContext: GoPtr<EmitContext>, file: GoPtr<SourceFile>, expected: string): void {
  const printer = NewPrinter({ NewLine: NewLineKindLF } as PrinterOptions, {} as PrintHandlers, emitContext);
  const text = Printer_EmitSourceFile(printer, file);
  const actual = text.endsWith("\n") ? text.slice(0, -1) : text;
  assert.equal(actual, expected);
  const file2 = parseTypeScript(text, file!.LanguageVariant === LanguageVariantJSX);
  checkDiagnostics(file2, "error on reparse: ");
}

// testutil/parsetestutil.MarkSyntheticRecursive
function markSyntheticRecursive(node: GoPtr<Node>): void {
  let v: GoPtr<NodeVisitor>;
  v = NewNodeVisitor(
    (n) => NodeVisitor_VisitEachChild(v, n),
    NewNodeFactory({} as NodeFactoryHooks),
    {
      VisitNode: (n, visitor) => {
        if (n !== undefined) {
          n.Loc = UndefinedTextRange();
        }
        return NodeVisitor_VisitNode(visitor, n);
      },
      VisitToken: (n, visitor) => {
        if (n !== undefined) {
          n.Loc = UndefinedTextRange();
        }
        return NodeVisitor_VisitNode(visitor, n);
      },
      VisitNodes: (nodes, visitor) => {
        if (nodes !== undefined) {
          nodes.Loc = UndefinedTextRange();
        }
        return NodeVisitor_VisitNodes(visitor, nodes);
      },
      VisitModifiers: (nodes, visitor) => {
        if (nodes !== undefined) {
          nodes.Loc = UndefinedTextRange();
        }
        return NodeVisitor_VisitModifiers(visitor, nodes);
      },
    } as NodeVisitorHooks,
  );
  NodeVisitor_VisitNode(v, node);
}

function zeroFactory(): GoPtr<NodeFactory> {
  return NewNodeFactory({} as NodeFactoryHooks);
}

function sourceFileOf(f: GoPtr<NodeFactory>, statements: Array<GoPtr<Node>>): GoPtr<SourceFile> {
  const file = NodeFactory_NewSourceFile(
    f,
    { FileName: "/file.ts", Path: "/file.ts" } as SourceFileParseOptions,
    "",
    NodeFactory_NewNodeList(f, statements),
    NewToken(f, KindEndOfFile),
  );
  markSyntheticRecursive(file);
  return file as unknown as GoPtr<SourceFile>;
}

const commaOf = (f: GoPtr<NodeFactory>, l: string, r: string): GoPtr<Node> =>
  NewBinaryExpression(f, undefined, NewIdentifier(f, l), undefined, NewToken(f, KindCommaToken), NewIdentifier(f, r));

test("ParenthesizeDecorator", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewClassDeclaration(
      f,
      NodeFactory_NewModifierList(f, [
        NewDecorator(f, NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, KindPlusToken), NewIdentifier(f, "b"))),
      ]),
      NewIdentifier(f, "C"),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
    ),
  ]);
  checkEmit(undefined, file, "@(a + b)\nclass C {\n}");
});

test("ParenthesizeComputedPropertyName", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewClassDeclaration(
      f,
      undefined,
      NewIdentifier(f, "C"),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, [
        NewPropertyDeclaration(f, undefined, NewComputedPropertyName(f, commaOf(f, "a", "b")), undefined, undefined, undefined),
      ]),
    ),
  ]);
  checkEmit(undefined, file, "class C {\n    [(a, b)];\n}");
});

test("ParenthesizeArrayLiteral", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, [commaOf(f, "a", "b")]), false)),
  ]);
  checkEmit(undefined, file, "[(a, b)];");
});

test("ParenthesizePropertyAccess1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewPropertyAccessExpression(f, commaOf(f, "a", "b"), undefined, NewIdentifier(f, "c"), NodeFlagsNone)),
  ]);
  checkEmit(undefined, file, "(a, b).c;");
});

test("ParenthesizePropertyAccess2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewPropertyAccessExpression(
      f,
      NewPropertyAccessExpression(f, NewIdentifier(f, "a"), NewToken(f, KindQuestionDotToken), NewIdentifier(f, "b"), NodeFlagsOptionalChain),
      undefined,
      NewIdentifier(f, "c"),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(a?.b).c;");
});

test("ParenthesizePropertyAccess3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewPropertyAccessExpression(
      f,
      NewNewExpression(f, NewIdentifier(f, "a"), undefined, undefined),
      undefined,
      NewIdentifier(f, "b"),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(new a).b;");
});

test("ParenthesizeElementAccess1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewElementAccessExpression(f, commaOf(f, "a", "b"), undefined, NewIdentifier(f, "c"), NodeFlagsNone)),
  ]);
  checkEmit(undefined, file, "(a, b)[c];");
});

test("ParenthesizeElementAccess2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewElementAccessExpression(
      f,
      NewPropertyAccessExpression(f, NewIdentifier(f, "a"), NewToken(f, KindQuestionDotToken), NewIdentifier(f, "b"), NodeFlagsOptionalChain),
      undefined,
      NewIdentifier(f, "c"),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(a?.b)[c];");
});

test("ParenthesizeElementAccess3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewElementAccessExpression(
      f,
      NewNewExpression(f, NewIdentifier(f, "a"), undefined, undefined),
      undefined,
      NewIdentifier(f, "b"),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(new a)[b];");
});

test("ParenthesizeCall1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewCallExpression(f, commaOf(f, "a", "b"), undefined, undefined, NodeFactory_NewNodeList(f, []), NodeFlagsNone)),
  ]);
  checkEmit(undefined, file, "(a, b)();");
});

test("ParenthesizeCall2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewCallExpression(
      f,
      NewPropertyAccessExpression(f, NewIdentifier(f, "a"), NewToken(f, KindQuestionDotToken), NewIdentifier(f, "b"), NodeFlagsOptionalChain),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(a?.b)();");
});

test("ParenthesizeCall3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewCallExpression(
      f,
      NewNewExpression(f, NewIdentifier(f, "C"), undefined, undefined),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(new C)();");
});

test("ParenthesizeCall4", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewCallExpression(
      f,
      NewIdentifier(f, "a"),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, [commaOf(f, "b", "c")]),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "a((b, c));");
});

test("ParenthesizeNew1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewNewExpression(f, commaOf(f, "a", "b"), undefined, NodeFactory_NewNodeList(f, []))),
  ]);
  checkEmit(undefined, file, "new (a, b)();");
});

test("ParenthesizeNew2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewNewExpression(
      f,
      NewCallExpression(f, NewIdentifier(f, "C"), undefined, undefined, NodeFactory_NewNodeList(f, []), NodeFlagsNone),
      undefined,
      undefined,
    )),
  ]);
  checkEmit(undefined, file, "new (C());");
});

test("ParenthesizeNew3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewNewExpression(f, NewIdentifier(f, "C"), undefined, NodeFactory_NewNodeList(f, [commaOf(f, "a", "b")]))),
  ]);
  checkEmit(undefined, file, "new C((a, b));");
});

test("ParenthesizeTaggedTemplate1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewTaggedTemplateExpression(
      f,
      commaOf(f, "a", "b"),
      undefined,
      undefined,
      NewNoSubstitutionTemplateLiteral(f, "", TokenFlagsNone),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(a, b) ``;");
});

test("ParenthesizeTaggedTemplate2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewTaggedTemplateExpression(
      f,
      NewPropertyAccessExpression(f, NewIdentifier(f, "a"), NewToken(f, KindQuestionDotToken), NewIdentifier(f, "b"), NodeFlagsOptionalChain),
      undefined,
      undefined,
      NewNoSubstitutionTemplateLiteral(f, "", TokenFlagsNone),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "(a?.b) ``;");
});

test("ParenthesizeTypeAssertion1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewTypeAssertion(
      f,
      NewTypeReferenceNode(f, NewIdentifier(f, "T"), undefined),
      NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, KindPlusToken), NewIdentifier(f, "b")),
    )),
  ]);
  checkEmit(undefined, file, "<T>(a + b);");
});

test("ParenthesizeArrowFunction1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewArrowFunction(
      f,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      undefined,
      undefined,
      NewToken(f, KindEqualsGreaterThanToken),
      NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, []), false),
    )),
  ]);
  checkEmit(undefined, file, "() => ({});");
});

test("ParenthesizeArrowFunction2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewArrowFunction(
      f,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      undefined,
      undefined,
      NewToken(f, KindEqualsGreaterThanToken),
      NewPropertyAccessExpression(
        f,
        NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, []), false),
        undefined,
        NewIdentifier(f, "a"),
        NodeFlagsNone,
      ),
    )),
  ]);
  checkEmit(undefined, file, "() => ({}.a);");
});

const plusOf = (f: GoPtr<NodeFactory>): GoPtr<Node> =>
  NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, KindPlusToken), NewIdentifier(f, "b"));

test("ParenthesizeDelete", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [NewExpressionStatement(f, NewDeleteExpression(f, plusOf(f)))]);
  checkEmit(undefined, file, "delete (a + b);");
});

test("ParenthesizeVoid", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [NewExpressionStatement(f, NewVoidExpression(f, plusOf(f)))]);
  checkEmit(undefined, file, "void (a + b);");
});

test("ParenthesizeTypeOf", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [NewExpressionStatement(f, NewTypeOfExpression(f, plusOf(f)))]);
  checkEmit(undefined, file, "typeof (a + b);");
});

test("ParenthesizeAwait", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [NewExpressionStatement(f, NewAwaitExpression(f, plusOf(f)))]);
  checkEmit(undefined, file, "await (a + b);");
});

function makeSide(label: string, kind: Kind, f: GoPtr<NodeFactory>): GoPtr<Node> {
  if (kind === KindIdentifier || kind === KindUnknown) {
    return NewIdentifier(f, label);
  }
  if (kind === KindArrowFunction) {
    return NewArrowFunction(
      f,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      undefined,
      undefined,
      NewToken(f, KindEqualsGreaterThanToken),
      NewBlock(f, NodeFactory_NewNodeList(f, []), false),
    );
  }
  // every other kind used by the table is a binary operator
  return NewBinaryExpression(f, undefined, NewIdentifier(f, label + "l"), undefined, NewToken(f, kind), NewIdentifier(f, label + "r"));
}

test("ParenthesizeBinary", () => {
  const data: Array<{ left?: Kind; operator: Kind; right?: Kind; output: string }> = [
    { operator: KindCommaToken, output: "l, r" },
    { operator: KindCommaToken, left: KindPlusToken, output: "ll + lr, r" },
    { operator: KindAsteriskToken, left: KindPlusToken, output: "(ll + lr) * r" },
    { operator: KindAsteriskToken, right: KindPlusToken, output: "l * (rl + rr)" },
    { operator: KindPlusToken, left: KindAsteriskToken, output: "ll * lr + r" },
    { operator: KindPlusToken, right: KindAsteriskToken, output: "l + rl * rr" },
    { operator: KindSlashToken, left: KindAsteriskToken, output: "ll * lr / r" },
    { operator: KindSlashToken, left: KindAsteriskAsteriskToken, output: "ll ** lr / r" },
    { operator: KindAsteriskAsteriskToken, left: KindAsteriskToken, output: "(ll * lr) ** r" },
    { operator: KindAsteriskAsteriskToken, left: KindAsteriskAsteriskToken, output: "(ll ** lr) ** r" },
    { operator: KindAsteriskToken, right: KindAsteriskToken, output: "l * rl * rr" },
    { operator: KindBarToken, right: KindBarToken, output: "l | rl | rr" },
    { operator: KindAmpersandToken, right: KindAmpersandToken, output: "l & rl & rr" },
    { operator: KindCaretToken, right: KindCaretToken, output: "l ^ rl ^ rr" },
    { operator: KindAmpersandAmpersandToken, right: KindArrowFunction, output: "l && (() => { })" },
  ];
  for (const rec of data) {
    const f = zeroFactory();
    const file = sourceFileOf(f, [
      NewExpressionStatement(f, NewBinaryExpression(
        f,
        undefined,
        makeSide("l", rec.left ?? KindUnknown, f),
        undefined,
        NewToken(f, rec.operator),
        makeSide("r", rec.right ?? KindUnknown, f),
      )),
    ]);
    checkEmit(undefined, file, rec.output + ";");
  }
});

test("ParenthesizeConditional1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      commaOf(f, "a", "b"),
      NewToken(f, KindQuestionToken),
      NewIdentifier(f, "c"),
      NewToken(f, KindColonToken),
      NewIdentifier(f, "d"),
    )),
  ]);
  checkEmit(undefined, file, "(a, b) ? c : d;");
});

test("ParenthesizeConditional2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, KindEqualsToken), NewIdentifier(f, "b")),
      NewToken(f, KindQuestionToken),
      NewIdentifier(f, "c"),
      NewToken(f, KindColonToken),
      NewIdentifier(f, "d"),
    )),
  ]);
  checkEmit(undefined, file, "(a = b) ? c : d;");
});

test("ParenthesizeConditional3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      NewArrowFunction(
        f,
        undefined,
        undefined,
        NodeFactory_NewNodeList(f, []),
        undefined,
        undefined,
        NewToken(f, KindEqualsGreaterThanToken),
        NewBlock(f, NodeFactory_NewNodeList(f, []), false),
      ),
      NewToken(f, KindQuestionToken),
      NewIdentifier(f, "a"),
      NewToken(f, KindColonToken),
      NewIdentifier(f, "b"),
    )),
  ]);
  checkEmit(undefined, file, "(() => { }) ? a : b;");
});

test("ParenthesizeConditional4", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      NewYieldExpression(f, undefined, undefined),
      NewToken(f, KindQuestionToken),
      NewIdentifier(f, "a"),
      NewToken(f, KindColonToken),
      NewIdentifier(f, "b"),
    )),
  ]);
  checkEmit(undefined, file, "(yield) ? a : b;");
});

test("ParenthesizeConditional5", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      NewIdentifier(f, "a"),
      NewToken(f, KindQuestionToken),
      commaOf(f, "b", "c"),
      NewToken(f, KindColonToken),
      NewIdentifier(f, "d"),
    )),
  ]);
  checkEmit(undefined, file, "a ? (b, c) : d;");
});

test("ParenthesizeConditional6", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewConditionalExpression(
      f,
      NewIdentifier(f, "a"),
      NewToken(f, KindQuestionToken),
      NewIdentifier(f, "b"),
      NewToken(f, KindColonToken),
      commaOf(f, "c", "d"),
    )),
  ]);
  checkEmit(undefined, file, "a ? b : (c, d);");
});

test("ParenthesizeYield1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewYieldExpression(f, undefined, commaOf(f, "a", "b"))),
  ]);
  checkEmit(undefined, file, "yield (a, b);");
});

// !!! test ASI avoidance from emitExpressionNoASI
// (TestParenthesizeYield2 is commented out upstream)

test("ParenthesizeSpreadElement1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, [NewSpreadElement(f, commaOf(f, "a", "b"))]), false)),
  ]);
  checkEmit(undefined, file, "[...(a, b)];");
});

test("ParenthesizeSpreadElement2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewCallExpression(
      f,
      NewIdentifier(f, "a"),
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, [NewSpreadElement(f, commaOf(f, "b", "c"))]),
      NodeFlagsNone,
    )),
  ]);
  checkEmit(undefined, file, "a(...(b, c));");
});

test("ParenthesizeSpreadElement3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewNewExpression(
      f,
      NewIdentifier(f, "a"),
      undefined,
      NodeFactory_NewNodeList(f, [NewSpreadElement(f, commaOf(f, "b", "c"))]),
    )),
  ]);
  checkEmit(undefined, file, "new a(...(b, c));");
});

test("ParenthesizeExpressionWithTypeArguments", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewExpressionWithTypeArguments(
      f,
      commaOf(f, "a", "b"),
      NodeFactory_NewNodeList(f, [NewTypeReferenceNode(f, NewIdentifier(f, "c"), undefined)]),
    )),
  ]);
  checkEmit(undefined, file, "(a, b)<c>;");
});

test("ParenthesizeAsExpression", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewAsExpression(f, commaOf(f, "a", "b"), NewTypeReferenceNode(f, NewIdentifier(f, "c"), undefined))),
  ]);
  checkEmit(undefined, file, "(a, b) as c;");
});

test("ParenthesizeSatisfiesExpression", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewSatisfiesExpression(f, commaOf(f, "a", "b"), NewTypeReferenceNode(f, NewIdentifier(f, "c"), undefined))),
  ]);
  checkEmit(undefined, file, "(a, b) satisfies c;");
});

test("ParenthesizeNonNullExpression", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewNonNullExpression(f, commaOf(f, "a", "b"), NodeFlagsNone)),
  ]);
  checkEmit(undefined, file, "(a, b)!;");
});

test("ParenthesizeExpressionStatement1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, []), false)),
  ]);
  checkEmit(undefined, file, "({});");
});

test("ParenthesizeExpressionStatement2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewFunctionExpression(
      f,
      undefined,
      undefined,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      undefined,
      undefined,
      NewBlock(f, NodeFactory_NewNodeList(f, []), false),
    )),
  ]);
  checkEmit(undefined, file, "(function () { });");
});

test("ParenthesizeExpressionStatement3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExpressionStatement(f, NewClassExpression(f, undefined, undefined, undefined, undefined, NodeFactory_NewNodeList(f, []))),
  ]);
  checkEmit(undefined, file, "class {\n};");
});

test("ParenthesizeExpressionDefault1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExportAssignment(f, undefined, false, undefined, NewClassExpression(f, undefined, undefined, undefined, undefined, NodeFactory_NewNodeList(f, []))),
  ]);
  checkEmit(undefined, file, "export default (class {\n});");
});

test("ParenthesizeExpressionDefault2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExportAssignment(f, undefined, false, undefined, NewFunctionExpression(
      f,
      undefined,
      undefined,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []),
      undefined,
      undefined,
      NewBlock(f, NodeFactory_NewNodeList(f, []), false),
    )),
  ]);
  checkEmit(undefined, file, "export default (function () { });");
});

test("ParenthesizeExpressionDefault3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewExportAssignment(f, undefined, false, undefined, commaOf(f, "a", "b")),
  ]);
  checkEmit(undefined, file, "export default (a, b);");
});

const typeRef = (f: GoPtr<NodeFactory>, name: string): GoPtr<Node> => NewTypeReferenceNode(f, NewIdentifier(f, name), undefined);

test("ParenthesizeArrayType", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewArrayTypeNode(
      f,
      NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "a"), typeRef(f, "b")])),
    )),
  ]);
  checkEmit(undefined, file, "type _ = (a | b)[];");
});

test("ParenthesizeOptionalType", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewTupleTypeNode(
      f,
      NodeFactory_NewNodeList(f, [
        NewOptionalTypeNode(f, NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "a"), typeRef(f, "b")]))),
      ]),
    )),
  ]);
  checkEmit(undefined, file, "type _ = [\n    (a | b)?\n];");
});

test("ParenthesizeUnionType1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewUnionTypeNode(
      f,
      NodeFactory_NewNodeList(f, [
        typeRef(f, "a"),
        NewFunctionTypeNode(f, undefined, NodeFactory_NewNodeList(f, []), typeRef(f, "b")),
      ]),
    )),
  ]);
  checkEmit(undefined, file, "type _ = a | (() => b);");
});

test("ParenthesizeUnionType2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewUnionTypeNode(
      f,
      NodeFactory_NewNodeList(f, [
        NewInferTypeNode(f, NewTypeParameterDeclaration(f, undefined, NewIdentifier(f, "a"), typeRef(f, "b"), undefined, undefined)),
        typeRef(f, "c"),
      ]),
    )),
  ]);
  checkEmit(undefined, file, "type _ = (infer a extends b) | c;");
});

test("ParenthesizeIntersectionType", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewIntersectionTypeNode(
      f,
      NodeFactory_NewNodeList(f, [
        typeRef(f, "a"),
        NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "b"), typeRef(f, "c")])),
      ]),
    )),
  ]);
  checkEmit(undefined, file, "type _ = a & (b | c);");
});

test("ParenthesizeReadonlyTypeOperator1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewTypeOperatorNode(
      f,
      KindReadonlyKeyword,
      NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "a"), typeRef(f, "b")])),
    )),
  ]);
  checkEmit(undefined, file, "type _ = readonly (a | b);");
});

test("ParenthesizeReadonlyTypeOperator2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewTypeOperatorNode(
      f,
      KindReadonlyKeyword,
      NewTypeOperatorNode(f, KindKeyOfKeyword, typeRef(f, "a")),
    )),
  ]);
  checkEmit(undefined, file, "type _ = readonly (keyof a);");
});

test("ParenthesizeKeyofTypeOperator", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewTypeOperatorNode(
      f,
      KindKeyOfKeyword,
      NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "a"), typeRef(f, "b")])),
    )),
  ]);
  checkEmit(undefined, file, "type _ = keyof (a | b);");
});

test("ParenthesizeIndexedAccessType", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewIndexedAccessTypeNode(
      f,
      NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [typeRef(f, "a"), typeRef(f, "b")])),
      typeRef(f, "c"),
    )),
  ]);
  checkEmit(undefined, file, "type _ = (a | b)[c];");
});

test("ParenthesizeConditionalType1", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewConditionalTypeNode(
      f,
      NewFunctionTypeNode(f, undefined, NodeFactory_NewNodeList(f, []), typeRef(f, "a")),
      typeRef(f, "b"),
      typeRef(f, "c"),
      typeRef(f, "d"),
    )),
  ]);
  checkEmit(undefined, file, "type _ = (() => a) extends b ? c : d;");
});

test("ParenthesizeConditionalType2", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewConditionalTypeNode(
      f,
      typeRef(f, "a"),
      NewConditionalTypeNode(f, typeRef(f, "b"), typeRef(f, "c"), typeRef(f, "d"), typeRef(f, "e")),
      typeRef(f, "f"),
      typeRef(f, "g"),
    )),
  ]);
  checkEmit(undefined, file, "type _ = a extends (b extends c ? d : e) ? f : g;");
});

test("ParenthesizeConditionalType3", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewConditionalTypeNode(
      f,
      typeRef(f, "a"),
      NewFunctionTypeNode(
        f,
        undefined,
        NodeFactory_NewNodeList(f, []),
        NewInferTypeNode(f, NewTypeParameterDeclaration(f, undefined, NewIdentifier(f, "b"), typeRef(f, "c"), undefined, undefined)),
      ),
      typeRef(f, "d"),
      typeRef(f, "e"),
    )),
  ]);
  checkEmit(undefined, file, "type _ = a extends () => (infer b extends c) ? d : e;");
});

test("ParenthesizeConditionalType4", () => {
  const f = zeroFactory();
  const file = sourceFileOf(f, [
    NewTypeAliasDeclaration(f, undefined, NewIdentifier(f, "_"), undefined, NewConditionalTypeNode(
      f,
      typeRef(f, "a"),
      NewFunctionTypeNode(
        f,
        undefined,
        NodeFactory_NewNodeList(f, []),
        NewUnionTypeNode(f, NodeFactory_NewNodeList(f, [
          NewInferTypeNode(f, NewTypeParameterDeclaration(f, undefined, NewIdentifier(f, "b"), typeRef(f, "c"), undefined, undefined)),
          typeRef(f, "d"),
        ])),
      ),
      typeRef(f, "e"),
      typeRef(f, "f"),
    )),
  ]);
  checkEmit(undefined, file, "type _ = a extends () => (infer b extends c) | d ? e : f;");
});

test("NameGeneration", () => {
  const ec = NewEmitContext();
  const f = ec!.Factory!.__tsgoEmbedded0;
  const file = NodeFactory_NewSourceFile(
    f,
    { FileName: "/file.ts", Path: "/file.ts" } as SourceFileParseOptions,
    "",
    NodeFactory_NewNodeList(f, [
      NewVariableStatement(f, undefined, NewVariableDeclarationList(
        f,
        NodeFactory_NewNodeList(f, [NewVariableDeclaration(f, NodeFactory_NewTempVariable(ec!.Factory), undefined, undefined, undefined)]),
        NodeFlagsNone,
      )),
      NewFunctionDeclaration(
        f,
        undefined,
        undefined,
        NewIdentifier(f, "f"),
        undefined,
        NodeFactory_NewNodeList(f, []),
        undefined,
        undefined,
        NewBlock(f, NodeFactory_NewNodeList(f, [
          NewVariableStatement(f, undefined, NewVariableDeclarationList(
            f,
            NodeFactory_NewNodeList(f, [NewVariableDeclaration(f, NodeFactory_NewTempVariable(ec!.Factory), undefined, undefined, undefined)]),
            NodeFlagsNone,
          )),
        ]), true),
      ),
    ]),
    NewToken(f, KindEndOfFile),
  );
  markSyntheticRecursive(file);
  checkEmit(ec, file as unknown as GoPtr<SourceFile>, "var _a;\nfunction f() {\n    var _a;\n}");
});

test("NoTrailingCommaAfterTransform", () => {
  let file = parseTypeScript("[a!]", false);
  const emitContext = NewEmitContext();

  let visitor: GoPtr<NodeVisitor>;
  visitor = EmitContext_NewNodeVisitor(emitContext, (node) => {
    switch (node!.Kind) {
      case KindNonNullExpression:
        node = Node_Expression(node);
        break;
      default:
        node = NodeVisitor_VisitEachChild(visitor, node);
        break;
    }
    return node;
  }) as GoPtr<NodeVisitor>;
  file = NodeVisitor_VisitSourceFile(visitor, file);

  checkEmit(emitContext, file, "[a];");
});

test("TrailingCommaAfterTransform", () => {
  let file = parseTypeScript("[a!,]", false);
  const emitContext = NewEmitContext();

  let visitor: GoPtr<NodeVisitor>;
  visitor = EmitContext_NewNodeVisitor(emitContext, (node) => {
    switch (node!.Kind) {
      case KindNonNullExpression:
        node = Node_Expression(node);
        break;
      default:
        node = NodeVisitor_VisitEachChild(visitor, node);
        break;
    }
    return node;
  }) as GoPtr<NodeVisitor>;
  file = NodeVisitor_VisitSourceFile(visitor, file);

  checkEmit(emitContext, file, "[a,];");
});

test("PartiallyEmittedExpression", () => {
  const compilerOptions = {} as CompilerOptions;

  let file = parseTypeScript(`return ((container.parent
    .left as PropertyAccessExpression)
    .expression as PropertyAccessExpression)
    .expression;`, false);

  const emitContext = NewEmitContext();
  file = Transformer_TransformSourceFile(
    NewTypeEraserTransformer({ CompilerOptions: compilerOptions, Context: emitContext } as TransformOptions),
    file,
  );
  checkEmit(emitContext, file, `return container.parent
    .left
    .expression
    .expression;`);
});

test("ParenthesizeBinaryExpressionMixingNullishCoalescing", () => {
  const tests: Array<{ title: string; innerOp: Kind; outerOp: Kind; side: string; output: string }> = [
    // inner ?? on left side of || or &&
    { title: "BarBarWithLeftQuestionQuestion", innerOp: KindQuestionQuestionToken, outerOp: KindBarBarToken, side: "left", output: "(a ?? b) || c;" },
    { title: "AmpersandAmpersandWithLeftQuestionQuestion", innerOp: KindQuestionQuestionToken, outerOp: KindAmpersandAmpersandToken, side: "left", output: "(a ?? b) && c;" },
    // inner ?? on right side of || or &&
    { title: "BarBarWithRightQuestionQuestion", innerOp: KindQuestionQuestionToken, outerOp: KindBarBarToken, side: "right", output: "a || (b ?? c);" },
    { title: "AmpersandAmpersandWithRightQuestionQuestion", innerOp: KindQuestionQuestionToken, outerOp: KindAmpersandAmpersandToken, side: "right", output: "a && (b ?? c);" },
    // inner || or && on left side of ??
    { title: "QuestionQuestionWithLeftBarBar", innerOp: KindBarBarToken, outerOp: KindQuestionQuestionToken, side: "left", output: "(a || b) ?? c;" },
    { title: "QuestionQuestionWithLeftAmpersandAmpersand", innerOp: KindAmpersandAmpersandToken, outerOp: KindQuestionQuestionToken, side: "left", output: "(a && b) ?? c;" },
    // inner || or && on right side of ??
    { title: "QuestionQuestionWithRightBarBar", innerOp: KindBarBarToken, outerOp: KindQuestionQuestionToken, side: "right", output: "a ?? (b || c);" },
    { title: "QuestionQuestionWithRightAmpersandAmpersand", innerOp: KindAmpersandAmpersandToken, outerOp: KindQuestionQuestionToken, side: "right", output: "a ?? (b && c);" },
  ];

  for (const tt of tests) {
    const f = zeroFactory();
    const innerExpr = NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, tt.innerOp), NewIdentifier(f, "b"));
    let outerExpr: GoPtr<Node>;
    if (tt.side === "left") {
      outerExpr = NewBinaryExpression(f, undefined, innerExpr /*left: (a innerOp b)*/, undefined, NewToken(f, tt.outerOp), NewIdentifier(f, "c"));
    } else {
      outerExpr = NewBinaryExpression(f, undefined, NewIdentifier(f, "a"), undefined, NewToken(f, tt.outerOp), innerExpr /*right: (b innerOp c)*/);
      // adjust identifiers for right side
      AsBinaryExpression(innerExpr)!.Left = NewIdentifier(f, "b");
      AsBinaryExpression(innerExpr)!.Right = NewIdentifier(f, "c");
    }
    const file = sourceFileOf(f, [NewExpressionStatement(f, outerExpr)]);
    checkEmit(undefined, file, tt.output);
  }
});
