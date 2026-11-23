import type { SyntaxCopyResult, SyntaxNode, SyntaxPhaseCopy, SyntaxStructureReceipt } from "../ir-hir/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import { prepareSyntaxStructure } from "../ir-hir/index.js";
import type { TirChapterSyntax, TypedPhase } from "../ir-tir/contract.js";
import type { ProjectionInventory } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import { drainProjectionInventory, inventoryFields, inventoryRecord } from "./program-values.js";
import { chargeInstantiationWork } from "./work.js";
import type { ChapterNodeShape, ChapterRootSlot, PreparedChapterNodeCopy } from "./syntax-arena.js";
import { prepareChapterNodeCopy } from "./syntax-arena.js";
import { prepareCallableHeader, prepareModuleHeader } from "./chapter-projection.js";
import type { CheckedChapterImage, HeaderOperands } from "./syntax-arena.js";
import { chapterBodyRoot } from "./syntax-arena.js";
import type { AdmittedTirSyntax } from "./instantiate-tir.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { HirNode } from "../ir-hir/contract.js";
import type { TirBodyRoot, TirReadyCallable } from "../ir-tir/contract.js";

const missingImage: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "The actual chapter operand must occur in its admitted syntax image." };

export interface ProjectedChapter {
  readonly bodyRootOf: (source: TirBodyRoot) => TirBodyRoot;
  readonly formalOf: (source: AdmittedTirSyntax["params"][number]) => AdmittedTirSyntax["params"][number];
}

export interface PreparedTypedSyntax {
  readonly checkedRoots: readonly HirNode[];
  readonly materialize: (rewrite: TypeReferenceRewrite, checked: CheckedChapterImage) => SyntaxCopyResult<ProjectedChapter, InstantiationStop>;
}

export function prepareTypedChapter(scan: ProjectionInventory, roots: Iterable<ChapterRootSlot>,
  phase: SyntaxPhaseCopy<TypedPhase, InstantiationStop, TypeReferenceRewrite>):
  { readonly kind: "complete"; readonly value: PreparedTypedSyntax } | InstantiationStop {
  const prepared = prepareTypedNodeCopy(scan, roots, phase, {
    prepare: (subject, ordinal) => {
      if (subject.kind === "module-root") return prepareModuleHeader(scan, subject.node, ordinal, phase);
      if (subject.kind === "ready-callable") return prepareCallableHeader(scan, subject.node, ordinal, phase);
      const stop = inventoryRecord(scan, 1);
      return stop === null ? { kind: "copied", value: null } : { kind: "refused", stop };
    },
  });
  if (prepared.kind === "refused") return prepared.stop;
  const plan = prepared.value;
  return { kind: "complete", value: { checkedRoots: plan.checkedRoots, materialize: (rewrite, checked) => {
    const projected = plan.materialize(rewrite, checked.expressionOf);
    if (projected.kind === "refused") return projected;
    const typed = projected.value;
    const operands: HeaderOperands = { typed, checked, references: rewrite, callableOf: (source: TirReadyCallable) => {
      const header = plan.headerOf(source);
      return header?.kind === "callable" ? header.finish(operands) : throwInvariant(missingImage);
    } };
    return { kind: "copied", value: {
      bodyRootOf: source => {
        const header = plan.headerOf(source);
        if (header?.kind === "module") return header.finish(operands);
        const original = plan.ordinaryOf(source);
        if (original === null) return throwInvariant(missingImage);
        const root = typed.bodyRootOf(original);
        return root !== null && root.kind !== "SourceFile" ? root : throwInvariant(missingImage);
      },
      formalOf: source => requirePresent(typed.parameterOf(source) ?? undefined, missingImage),
    } };
  } } };
}

export function inventoryBodySyntax(scan: ProjectionInventory, body: AdmittedTirSyntax,
  phase: SyntaxPhaseCopy<TypedPhase, InstantiationStop, TypeReferenceRewrite>) {
  function* roots(): Generator<ChapterRootSlot> {
    yield { path: "TirBody.root", read: () => chapterBodyRoot(body.root) };
    for (let position = 0; position < body.params.length; position += 1) {
      const index = position;
      yield { path: "TirBody.params[" + index + "]", read: () => ({ kind: "formal", node: requirePresent(body.params[index], missingImage) }) };
    }
  }
  return prepareTypedChapter(scan, roots(), phase);
}

function admitSyntaxHeader(scan: ProjectionInventory, node: SyntaxNode<TypedPhase>): InstantiationStop | null {
  switch (node.kind) {
    case "Unknown":     case "EndOfFile":     case "SingleLineCommentTrivia":     case "MultiLineCommentTrivia":     case "NewLineTrivia":     case "WhitespaceTrivia":     case "ConflictMarkerTrivia":     case "NonTextFileMarkerTrivia":     case "JsxTextAllWhiteSpaces":     case "OpenBraceToken":     case "CloseBraceToken":     case "OpenParenToken":     case "CloseParenToken":     case "OpenBracketToken":     case "CloseBracketToken":     case "DotToken":     case "DotDotDotToken":     case "SemicolonToken":     case "CommaToken":     case "QuestionDotToken":     case "LessThanToken":     case "LessThanSlashToken":     case "GreaterThanToken":     case "LessThanEqualsToken":     case "GreaterThanEqualsToken":     case "EqualsEqualsToken":     case "ExclamationEqualsToken":     case "EqualsEqualsEqualsToken":     case "ExclamationEqualsEqualsToken":     case "EqualsGreaterThanToken":     case "PlusToken":     case "MinusToken":     case "AsteriskToken":     case "AsteriskAsteriskToken":     case "SlashToken":     case "PercentToken":     case "PlusPlusToken":     case "MinusMinusToken":     case "LessThanLessThanToken":     case "GreaterThanGreaterThanToken":     case "GreaterThanGreaterThanGreaterThanToken":     case "AmpersandToken":     case "BarToken":     case "CaretToken":     case "ExclamationToken":     case "TildeToken":     case "AmpersandAmpersandToken":     case "BarBarToken":     case "QuestionToken":     case "ColonToken":     case "AtToken":     case "QuestionQuestionToken":     case "BacktickToken":     case "HashToken":     case "EqualsToken":     case "PlusEqualsToken":     case "MinusEqualsToken":     case "AsteriskEqualsToken":     case "AsteriskAsteriskEqualsToken":     case "SlashEqualsToken":     case "PercentEqualsToken":     case "LessThanLessThanEqualsToken":     case "GreaterThanGreaterThanEqualsToken":     case "GreaterThanGreaterThanGreaterThanEqualsToken":     case "AmpersandEqualsToken":     case "BarEqualsToken":     case "BarBarEqualsToken":     case "AmpersandAmpersandEqualsToken":     case "QuestionQuestionEqualsToken":     case "CaretEqualsToken":     case "JSDocCommentTextToken":     case "BreakKeyword":     case "CaseKeyword":     case "CatchKeyword":     case "ClassKeyword":     case "ConstKeyword":     case "ContinueKeyword":     case "DebuggerKeyword":     case "DefaultKeyword":     case "DeleteKeyword":     case "DoKeyword":     case "ElseKeyword":     case "EnumKeyword":     case "ExportKeyword":     case "ExtendsKeyword":     case "FinallyKeyword":     case "ForKeyword":     case "FunctionKeyword":     case "IfKeyword":     case "InKeyword":     case "InstanceOfKeyword":     case "NewKeyword":     case "ReturnKeyword":     case "SwitchKeyword":     case "ThrowKeyword":     case "TryKeyword":     case "TypeOfKeyword":     case "VarKeyword":     case "WhileKeyword":     case "WithKeyword":     case "ImplementsKeyword":     case "InterfaceKeyword":     case "LetKeyword":     case "PackageKeyword":     case "PrivateKeyword":     case "ProtectedKeyword":     case "PublicKeyword":     case "StaticKeyword":     case "YieldKeyword":     case "AbstractKeyword":     case "AccessorKeyword":     case "AsKeyword":     case "AssertsKeyword":     case "AssertKeyword":     case "AsyncKeyword":     case "AwaitKeyword":     case "ConstructorKeyword":     case "DeclareKeyword":     case "GetKeyword":     case "ImmediateKeyword":     case "InferKeyword":     case "IsKeyword":     case "KeyOfKeyword":     case "ModuleKeyword":     case "NamespaceKeyword":     case "OutKeyword":     case "ReadonlyKeyword":     case "RequireKeyword":     case "SatisfiesKeyword":     case "SetKeyword":     case "TypeKeyword":     case "UniqueKeyword":     case "UsingKeyword":     case "FromKeyword":     case "GlobalKeyword":     case "OverrideKeyword":     case "OfKeyword":     case "DeferKeyword":
      return inventoryFields(scan, 1);
    case "Identifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "PrivateIdentifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "QualifiedName":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ComputedPropertyName":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "Decorator":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "EmptyStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "IfStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "DoStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "WhileStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ForStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "ForInStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "ForOfStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "BreakStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ContinueStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ReturnStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "WithStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "SwitchStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "CaseBlock":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "CaseClause":
    case "DefaultClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ThrowStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "TryStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "CatchClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "DebuggerStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "LabeledStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ExpressionStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "Block":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2);
    case "VariableStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "VariableDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "VariableDeclarationList":
    case "ObjectBindingPattern":     case "ArrayBindingPattern":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "Parameter":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13);
    case "BindingElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "MissingDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "FunctionDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15);
    case "ClassDeclaration":
    case "ClassExpression":
    case "InterfaceDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12);
    case "HeritageClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TypeAliasDeclaration":     case "JSTypeAliasDeclaration":
    case "EnumMember":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "EnumDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "ModuleBlock":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "NotEmittedStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "NotEmittedTypeElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "ImportDeclaration":     case "JSImportDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ExternalModuleReference":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "NamespaceImport":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "NamedImports":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2);
    case "ExportAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "NamespaceExportDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "NamespaceExport":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "NamedExports":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2);
    case "ExportSpecifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "CallSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "ConstructSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "Constructor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "GetAccessor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "SetAccessor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "IndexSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "MethodSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "MethodDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "PropertySignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "PropertyDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "SemicolonClassElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "ClassStaticBlockDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "OmittedExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "NullKeyword":     case "TrueKeyword":     case "FalseKeyword":     case "ThisKeyword":     case "SuperKeyword":     case "ImportKeyword":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "StringLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "NumericLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "BigIntLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "RegularExpressionLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "NoSubstitutionTemplateLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "BinaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12);
    case "PrefixUnaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "PostfixUnaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "YieldExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ArrowFunction":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "FunctionExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15);
    case "AsExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "SatisfiesExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ConditionalExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12);
    case "PropertyAccessExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "ElementAccessExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "CallExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "NewExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "MetaProperty":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "SpreadElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "TemplateExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2);
    case "TemplateSpan":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TaggedTemplateExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2));
    case "ParenthesizedExpression": case "NonNullExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ArrayLiteralExpression":
    case "ObjectLiteralExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "SpreadAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "PropertyAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ShorthandPropertyAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "DeleteExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "TypeOfExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "VoidExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "AwaitExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "TypeAssertionExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "AnyKeyword":     case "BigIntKeyword":     case "BooleanKeyword":     case "IntrinsicKeyword":     case "NeverKeyword":     case "NumberKeyword":     case "ObjectKeyword":     case "StringKeyword":     case "SymbolKeyword":     case "UndefinedKeyword":     case "UnknownKeyword":     case "VoidKeyword":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "UnionType":
    case "IntersectionType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ConditionalType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TypeOperator":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "InferType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ArrayType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "IndexedAccessType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TypeReference":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ExpressionWithTypeArguments":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2));
    case "LiteralType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ThisType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "TypePredicate":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "ImportAttribute":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ImportAttributes":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "TypeQuery":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "MappedType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13);
    case "TypeLiteral":
    case "TupleType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "NamedTupleMember":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "OptionalType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "RestType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "ParenthesizedType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "FunctionType":
    case "ConstructorType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12);
    case "TemplateHead":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateMiddle":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateTail":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateLiteralType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TemplateLiteralTypeSpan":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "PartiallyEmittedExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JsxElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryRecord(scan, 2);
    case "JsxAttributes":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2);
    case "JsxNamespacedName":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JsxOpeningElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2));
    case "JsxSelfClosingElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2));
    case "JsxFragment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryRecord(scan, 2);
    case "JsxOpeningFragment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "JsxClosingFragment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "JsxAttribute":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JsxSpreadAttribute":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JsxClosingElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JsxExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JsxText":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "SyntaxList":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDoc":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? (node.tags === null ? null : inventoryRecord(scan, 2));
    case "JSDocTypeExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocNonNullableType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocNullableType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocAllType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "JSDocVariadicType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocOptionalType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocTypeTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocUnknownTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocTemplateTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "JSDocReturnTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocPublicTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocPrivateTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocProtectedTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocReadonlyTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocOverrideTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocDeprecatedTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocSeeTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocImplementsTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocAugmentsTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocSatisfiesTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocThrowsTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocThisTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocImportTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocCallbackTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocOverloadTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocTypedefTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
    case "JSDocSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2);
    case "JSDocNameReference":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "SourceFile":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14);
    case "ModuleDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ImportEqualsDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ExportDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ImportType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2));
    case "ImportClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "ImportSpecifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10);
    case "JSDocText":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8);
    case "JSDocLink":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocLinkPlain":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocLinkCode":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TypeParameter":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12);
    case "SyntheticReferenceExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocTypeLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocParameterTag":     case "JSDocPropertyTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
  }
}

type NamedSyntax = Extract<TirChapterSyntax, { readonly kind: "module-root" | "ready-callable" | "checked" }>;

interface TypedChapterRoles {
  readonly prepare: (subject: NamedSyntax, ordinal: number) => SyntaxCopyResult<ChapterNodeShape | null, InstantiationStop>;
}

export function prepareTypedNodeCopy(scan: ProjectionInventory, roots: Iterable<ChapterRootSlot>,
  phase: SyntaxPhaseCopy<TypedPhase, InstantiationStop, TypeReferenceRewrite>, roles: TypedChapterRoles,
): SyntaxCopyResult<PreparedChapterNodeCopy<TypeReferenceRewrite, InstantiationStop>, InstantiationStop> {
  const setup = inventoryRecord(scan, 0) ?? inventoryRecord(scan, 0);
  if (setup !== null) return { kind: "refused", stop: setup };
  let position = 0;
  let shape: SyntaxStructureReceipt<TypedPhase> | null = null;
  return prepareChapterNodeCopy<TypeReferenceRewrite, InstantiationStop>(roots, phase, node => {
    const indexed = inventoryRecord(scan, 0) ?? admitSyntaxHeader(scan, node);
    if (indexed !== null) return indexed;
    const result = prepareSyntaxStructure<TypedPhase, InstantiationStop>(node, position,
      () => inventoryRecord(scan, 0), () => inventoryRecord(scan, 2));
    if (result.kind === "refused") return result.stop;
    shape = result.value;
    return null;
  }, {
    root: () => null,
    edge: (_path, slot) => slot.kind === "statement" ? inventoryRecord(scan, 2) : chargeInstantiationWork(scan.meter),
    formal: () => inventoryRecord(scan, 0),
    prepare: (subject, ordinal, copy) => {
      position = ordinal;
      shape = null;
      if (subject.kind === "ordinary" || subject.kind === "formal") {
        const stop = copy(subject.node) ?? drainProjectionInventory(scan);
        return stop === null ? { kind: "copied", value: shape } : { kind: "refused", stop };
      }
      const prepared = roles.prepare(subject, ordinal);
      if (prepared.kind === "refused") return prepared;
      const stop = drainProjectionInventory(scan);
      return stop === null ? prepared : { kind: "refused", stop };
    },
  });
}
