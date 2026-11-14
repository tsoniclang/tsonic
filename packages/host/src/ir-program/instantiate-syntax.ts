import type { BodyRoot, SyntaxNode } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { ProjectionInventory } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import { drainProjectionInventory, inventoryFields, inventoryRecord } from "./program-values.js";
import { chargeInstantiationWork } from "./work.js";
import type { SyntaxInventory } from "./syntax-arena.js";
import { walkSyntax } from "./syntax-arena.js";
import { inventoryExportAssignment } from "./instantiate-phase.js";
import {
  inventoryAlias, inventoryBinary, inventoryBinding, inventoryBindingElement, inventoryCallable, inventoryClass, inventoryClassValue, inventoryClosure, inventoryConditional, inventoryConstruction, inventoryDecorator, inventoryEnum, inventoryHeritage, inventoryIndexDeclaration, inventoryInstantiation, inventoryInterface, inventoryIteration, inventoryKeyword, inventoryName, inventoryNamespace, inventoryNumber, inventoryObjectSpread, inventoryOmission, inventoryPredicate, inventoryPrefix, inventoryProperty, inventoryPropertyKey, inventoryProtocolValue, inventorySourcePhase, inventoryStaticBlock, inventoryStorage, inventoryString, inventoryTypeParameter, inventoryTypedApplication, inventoryTypedMember, inventoryTypedParameter, inventoryTypedType, inventoryUnary, inventoryUpdate, inventoryValue, inventoryVariableList
} from "./instantiate-phase.js";

function inventoryNode(scan: ProjectionInventory, node: SyntaxNode<TypedPhase>): InstantiationStop | null {
  switch (node.kind) {
    case "Unknown":     case "EndOfFile":     case "SingleLineCommentTrivia":     case "MultiLineCommentTrivia":     case "NewLineTrivia":     case "WhitespaceTrivia":     case "ConflictMarkerTrivia":     case "NonTextFileMarkerTrivia":     case "JsxTextAllWhiteSpaces":     case "OpenBraceToken":     case "CloseBraceToken":     case "OpenParenToken":     case "CloseParenToken":     case "OpenBracketToken":     case "CloseBracketToken":     case "DotToken":     case "DotDotDotToken":     case "SemicolonToken":     case "CommaToken":     case "QuestionDotToken":     case "LessThanToken":     case "LessThanSlashToken":     case "GreaterThanToken":     case "LessThanEqualsToken":     case "GreaterThanEqualsToken":     case "EqualsEqualsToken":     case "ExclamationEqualsToken":     case "EqualsEqualsEqualsToken":     case "ExclamationEqualsEqualsToken":     case "EqualsGreaterThanToken":     case "PlusToken":     case "MinusToken":     case "AsteriskToken":     case "AsteriskAsteriskToken":     case "SlashToken":     case "PercentToken":     case "PlusPlusToken":     case "MinusMinusToken":     case "LessThanLessThanToken":     case "GreaterThanGreaterThanToken":     case "GreaterThanGreaterThanGreaterThanToken":     case "AmpersandToken":     case "BarToken":     case "CaretToken":     case "ExclamationToken":     case "TildeToken":     case "AmpersandAmpersandToken":     case "BarBarToken":     case "QuestionToken":     case "ColonToken":     case "AtToken":     case "QuestionQuestionToken":     case "BacktickToken":     case "HashToken":     case "EqualsToken":     case "PlusEqualsToken":     case "MinusEqualsToken":     case "AsteriskEqualsToken":     case "AsteriskAsteriskEqualsToken":     case "SlashEqualsToken":     case "PercentEqualsToken":     case "LessThanLessThanEqualsToken":     case "GreaterThanGreaterThanEqualsToken":     case "GreaterThanGreaterThanGreaterThanEqualsToken":     case "AmpersandEqualsToken":     case "BarEqualsToken":     case "BarBarEqualsToken":     case "AmpersandAmpersandEqualsToken":     case "QuestionQuestionEqualsToken":     case "CaretEqualsToken":     case "JSDocCommentTextToken":     case "BreakKeyword":     case "CaseKeyword":     case "CatchKeyword":     case "ClassKeyword":     case "ConstKeyword":     case "ContinueKeyword":     case "DebuggerKeyword":     case "DefaultKeyword":     case "DeleteKeyword":     case "DoKeyword":     case "ElseKeyword":     case "EnumKeyword":     case "ExportKeyword":     case "ExtendsKeyword":     case "FinallyKeyword":     case "ForKeyword":     case "FunctionKeyword":     case "IfKeyword":     case "InKeyword":     case "InstanceOfKeyword":     case "NewKeyword":     case "ReturnKeyword":     case "SwitchKeyword":     case "ThrowKeyword":     case "TryKeyword":     case "TypeOfKeyword":     case "VarKeyword":     case "WhileKeyword":     case "WithKeyword":     case "ImplementsKeyword":     case "InterfaceKeyword":     case "LetKeyword":     case "PackageKeyword":     case "PrivateKeyword":     case "ProtectedKeyword":     case "PublicKeyword":     case "StaticKeyword":     case "YieldKeyword":     case "AbstractKeyword":     case "AccessorKeyword":     case "AsKeyword":     case "AssertsKeyword":     case "AssertKeyword":     case "AsyncKeyword":     case "AwaitKeyword":     case "ConstructorKeyword":     case "DeclareKeyword":     case "GetKeyword":     case "ImmediateKeyword":     case "InferKeyword":     case "IsKeyword":     case "KeyOfKeyword":     case "ModuleKeyword":     case "NamespaceKeyword":     case "OutKeyword":     case "ReadonlyKeyword":     case "RequireKeyword":     case "SatisfiesKeyword":     case "SetKeyword":     case "TypeKeyword":     case "UniqueKeyword":     case "UsingKeyword":     case "FromKeyword":     case "GlobalKeyword":     case "OverrideKeyword":     case "OfKeyword":     case "DeferKeyword":
      return inventoryFields(scan, 1);
    case "Identifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryName(scan, node.tsonic);
    case "PrivateIdentifier":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryName(scan, node.tsonic);
    case "QualifiedName":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryName(scan, node.tsonic);
    case "ComputedPropertyName":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryPropertyKey(scan, node.tsonic);
    case "Decorator":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryDecorator(scan, node.tsonic);
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
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryIteration(scan, node.tsonic);
    case "ForOfStatement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryIteration(scan, node.tsonic);
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
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2);
    case "CaseClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2);
    case "DefaultClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2);
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
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "VariableDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryBinding(scan, node.tsonic);
    case "VariableDeclarationList":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryVariableList(scan, node.tsonic);
    case "ObjectBindingPattern":     case "ArrayBindingPattern":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryOmission(scan, node.tsonic);
    case "Parameter":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedParameter(scan, node.tsonic);
    case "BindingElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryBindingElement(scan, node.tsonic);
    case "MissingDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "FunctionDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "ClassDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? (node.heritageClauses === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryClass(scan, node.tsonic);
    case "ClassExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? (node.heritageClauses === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryClassValue(scan, node.tsonic);
    case "HeritageClause":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? inventoryHeritage(scan, node.tsonic);
    case "InterfaceDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? (node.heritageClauses === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryInterface(scan, node.tsonic);
    case "TypeAliasDeclaration":     case "JSTypeAliasDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryAlias(scan, node.tsonic);
    case "EnumMember":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryStorage(scan, node.tsonic);
    case "EnumDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryEnum(scan, node.tsonic);
    case "ModuleBlock":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2);
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
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryExportAssignment(scan, node.tsonic);
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
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "ConstructSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "Constructor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "GetAccessor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "SetAccessor":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "IndexSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryIndexDeclaration(scan, node.tsonic);
    case "MethodSignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "MethodDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 16)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryCallable(scan, node.tsonic);
    case "PropertySignature":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryStorage(scan, node.tsonic);
    case "PropertyDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryStorage(scan, node.tsonic);
    case "SemicolonClassElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7);
    case "ClassStaticBlockDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryStaticBlock(scan, node.tsonic);
    case "OmittedExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7)
        ?? inventoryOmission(scan, node.tsonic);
    case "NullKeyword":     case "TrueKeyword":     case "FalseKeyword":     case "ThisKeyword":     case "SuperKeyword":     case "ImportKeyword":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7)
        ?? inventoryKeyword(scan, node.tsonic);
    case "StringLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryString(scan, node.tsonic);
    case "NumericLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryNumber(scan, node.tsonic);
    case "BigIntLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryNumber(scan, node.tsonic);
    case "RegularExpressionLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryValue(scan, node.tsonic);
    case "NoSubstitutionTemplateLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryString(scan, node.tsonic);
    case "BinaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryBinary(scan, node.tsonic);
    case "PrefixUnaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryPrefix(scan, node.tsonic);
    case "PostfixUnaryExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryUpdate(scan, node.tsonic);
    case "YieldExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryProtocolValue(scan, node.tsonic);
    case "ArrowFunction":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryClosure(scan, node.tsonic);
    case "FunctionExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryClosure(scan, node.tsonic);
    case "AsExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryValue(scan, node.tsonic);
    case "SatisfiesExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryValue(scan, node.tsonic);
    case "ConditionalExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? inventoryConditional(scan, node.tsonic);
    case "PropertyAccessExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryTypedMember(scan, node.tsonic);
    case "ElementAccessExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryTypedMember(scan, node.tsonic);
    case "CallExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedApplication(scan, node.tsonic);
    case "NewExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? (node.arguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedApplication(scan, node.tsonic);
    case "MetaProperty":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryValue(scan, node.tsonic);
    case "NonNullExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryValue(scan, node.tsonic);
    case "SpreadElement":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryProtocolValue(scan, node.tsonic);
    case "TemplateExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? inventoryUnary(scan, node.tsonic);
    case "TemplateSpan":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "TaggedTemplateExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedApplication(scan, node.tsonic);
    case "ParenthesizedExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryValue(scan, node.tsonic);
    case "ArrayLiteralExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? inventoryConstruction(scan, node.tsonic);
    case "ObjectLiteralExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? inventoryConstruction(scan, node.tsonic);
    case "SpreadAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryObjectSpread(scan, node.tsonic);
    case "PropertyAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryProperty(scan, node.tsonic);
    case "ShorthandPropertyAssignment":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryProperty(scan, node.tsonic);
    case "DeleteExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryUnary(scan, node.tsonic);
    case "TypeOfExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryUnary(scan, node.tsonic);
    case "VoidExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryUnary(scan, node.tsonic);
    case "AwaitExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryProtocolValue(scan, node.tsonic);
    case "TypeAssertionExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryValue(scan, node.tsonic);
    case "AnyKeyword":     case "BigIntKeyword":     case "BooleanKeyword":     case "IntrinsicKeyword":     case "NeverKeyword":     case "NumberKeyword":     case "ObjectKeyword":     case "StringKeyword":     case "SymbolKeyword":     case "UndefinedKeyword":     case "UnknownKeyword":     case "VoidKeyword":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7)
        ?? inventoryTypedType(scan, node.tsonic);
    case "UnionType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "IntersectionType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "ConditionalType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TypeOperator":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryTypedType(scan, node.tsonic);
    case "InferType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "ArrayType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "IndexedAccessType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TypeReference":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedType(scan, node.tsonic);
    case "ExpressionWithTypeArguments":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryInstantiation(scan, node.tsonic);
    case "LiteralType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "ThisType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 7)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TypePredicate":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryPredicate(scan, node.tsonic);
    case "ImportAttribute":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "ImportAttributes":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 10)
        ?? inventoryRecord(scan, 2);
    case "TypeQuery":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedType(scan, node.tsonic);
    case "MappedType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.members === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedType(scan, node.tsonic);
    case "TypeLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TupleType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "NamedTupleMember":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? inventoryTypedType(scan, node.tsonic);
    case "OptionalType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "RestType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "ParenthesizedType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 8)
        ?? inventoryTypedType(scan, node.tsonic);
    case "FunctionType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "ConstructorType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? (node.typeParameters === null ? null : inventoryRecord(scan, 2))
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TemplateHead":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateMiddle":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateTail":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11);
    case "TemplateLiteralType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryRecord(scan, 2)
        ?? inventoryTypedType(scan, node.tsonic);
    case "TemplateLiteralTypeSpan":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9)
        ?? inventoryTypedType(scan, node.tsonic);
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
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14)
        ?? inventoryRecord(scan, 2)
        ?? inventorySourcePhase(scan, node.tsonic);
    case "ModuleDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryNamespace(scan, node.tsonic);
    case "ImportEqualsDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 11)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ExportDeclaration":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2));
    case "ImportType":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.typeArguments === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypedType(scan, node.tsonic);
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
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 12)
        ?? (node.modifiers === null ? null : inventoryRecord(scan, 2))
        ?? inventoryTypeParameter(scan, node.tsonic);
    case "SyntheticReferenceExpression":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocTypeLiteral":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 9);
    case "JSDocParameterTag":     case "JSDocPropertyTag":
      return inventoryRecord(scan, 5) ?? inventoryRecord(scan, 13)
        ?? (node.comment === null ? null : inventoryRecord(scan, 2));
  }
}

export function inventoryBodySyntax(
  scan: ProjectionInventory, root: BodyRoot<TypedPhase>,
): { readonly kind: "complete"; readonly syntax: SyntaxInventory } | InstantiationStop {
  const traversal = walkSyntax([{ node: root, path: "Instantiation.root" }]);
  let step = traversal.next();
  while (!step.done) {
    const stop = step.value.kind === "edge" ? chargeInstantiationWork(scan.meter) : inventoryNode(scan, step.value.node);
    if (stop !== null) return stop;
    const payload = drainProjectionInventory(scan);
    if (payload !== null) return payload;
    step = traversal.next();
  }
  return { kind: "complete", syntax: step.value };
}
