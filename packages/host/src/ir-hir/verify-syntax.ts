import type { HirBody, HirNode, HirRule, HirSite, PlainTokenKind } from "./contract.js";
import type { BodyId, DefId, SourceNodeRef } from "../ids/contract.js";
import type { HirDataWork, HirFieldVisit } from "./walk.js";
import { walkHirFields } from "./walk.js";

export interface HirNodeEntry {
  readonly node: HirNode;
  readonly ordinal: number;
  readonly parent: HirNodeEntry | null;
  readonly body: HirBody | null;
  readonly item: DefId;
  readonly source: SourceNodeRef;
  readonly required: [number, number, number];
  end: number;
}

export interface HirInventory {
  readonly nodes: readonly HirNode[];
  readonly entries: readonly HirNodeEntry[];
  readonly nodesById: ReadonlyMap<number, HirNode>;
  readonly entriesById: ReadonlyMap<number, HirNodeEntry>;
  readonly receivers: readonly { readonly access: HirNodeEntry; readonly expression: HirNodeEntry }[];
  readonly starts: ReadonlyMap<HirNode, number>;
  readonly ends: ReadonlyMap<HirNode, number>;
  readonly parents: ReadonlyMap<HirNode, HirNode | null>;
  readonly owners: ReadonlyMap<HirNode, HirBody>;
  readonly itemOwners: ReadonlyMap<HirNode, DefId>;
  readonly bodies: ReadonlyMap<BodyId, HirBody>;
  readonly bodyParents: ReadonlyMap<HirBody, HirBody | null>;
  readonly repeated: readonly HirNodeEntry[];
}

export type HirReport = (rule: HirRule, site: HirSite, reason: string) => void;

export interface HirLiteralShape {
  readonly kind: "literal";
  readonly values: readonly (string | number | boolean | null)[];
}

export interface HirNumericIdentityShape {
  readonly kind: "identity";
  readonly prefix: "n" | "l" | "t" | "sig" | "cand";
  readonly value: "number";
}
export interface HirStringIdentityShape {
  readonly kind: "identity";
  readonly prefix: "mod" | "def" | "body" | "exp";
  readonly value: "string";
}
export type HirIdentityShape = HirNumericIdentityShape | HirStringIdentityShape;
export interface HirHostCodeShape { readonly kind: "host-code" }
export interface HirArrayShape { readonly kind: "array"; readonly element: HirShape }
export interface HirChoiceShape { readonly kind: "choice"; readonly alternatives: readonly HirShape[] }
export interface HirRecordShape {
  readonly kind: "record";
  readonly label: string;
  readonly fields: readonly HirField[];
  readonly syntax: boolean;
}
export interface HirDictionaryShape { readonly kind: "dictionary"; readonly label: string; readonly element: HirShape }

export type HirSyntaxName = PlainTokenKind
  | "Identifier" | "PrivateIdentifier" | "QualifiedName" | "ComputedPropertyName" | "Decorator" | "EmptyStatement"
  | "IfStatement" | "DoStatement" | "WhileStatement" | "ForStatement" | "ForInStatement" | "ForOfStatement"
  | "BreakStatement" | "ContinueStatement" | "ReturnStatement" | "WithStatement" | "SwitchStatement" | "CaseBlock"
  | "CaseClause" | "DefaultClause" | "ThrowStatement" | "TryStatement" | "CatchClause" | "DebuggerStatement"
  | "LabeledStatement" | "ExpressionStatement" | "Block" | "VariableStatement" | "VariableDeclaration"
  | "VariableDeclarationList" | "ObjectBindingPattern" | "ArrayBindingPattern" | "Parameter" | "BindingElement"
  | "MissingDeclaration" | "FunctionDeclaration" | "ClassDeclaration" | "ClassExpression" | "HeritageClause"
  | "InterfaceDeclaration" | "TypeAliasDeclaration" | "JSTypeAliasDeclaration" | "EnumMember" | "EnumDeclaration"
  | "ModuleBlock" | "NotEmittedStatement" | "NotEmittedTypeElement" | "ImportDeclaration" | "JSImportDeclaration"
  | "ExternalModuleReference" | "NamespaceImport" | "NamedImports" | "ExportAssignment"
  | "NamespaceExportDeclaration" | "NamespaceExport" | "NamedExports" | "ExportSpecifier" | "CallSignature"
  | "ConstructSignature" | "Constructor" | "GetAccessor" | "SetAccessor" | "IndexSignature" | "MethodSignature"
  | "MethodDeclaration" | "PropertySignature" | "PropertyDeclaration" | "SemicolonClassElement"
  | "ClassStaticBlockDeclaration" | "OmittedExpression" | "StringLiteral" | "NumericLiteral" | "BigIntLiteral"
  | "RegularExpressionLiteral" | "NoSubstitutionTemplateLiteral" | "BinaryExpression" | "PrefixUnaryExpression"
  | "PostfixUnaryExpression" | "YieldExpression" | "ArrowFunction" | "FunctionExpression" | "AsExpression"
  | "SatisfiesExpression" | "ConditionalExpression" | "PropertyAccessExpression" | "ElementAccessExpression"
  | "CallExpression" | "NewExpression" | "MetaProperty" | "NonNullExpression" | "SpreadElement"
  | "TemplateExpression" | "TemplateSpan" | "TaggedTemplateExpression" | "ParenthesizedExpression"
  | "ArrayLiteralExpression" | "ObjectLiteralExpression" | "SpreadAssignment" | "PropertyAssignment"
  | "ShorthandPropertyAssignment" | "DeleteExpression" | "TypeOfExpression" | "VoidExpression" | "AwaitExpression"
  | "TypeAssertionExpression" | "UnionType" | "IntersectionType" | "ConditionalType" | "TypeOperator"
  | "InferType" | "ArrayType" | "IndexedAccessType" | "TypeReference" | "ExpressionWithTypeArguments"
  | "LiteralType" | "ThisType" | "TypePredicate" | "ImportAttribute" | "ImportAttributes" | "TypeQuery"
  | "MappedType" | "TypeLiteral" | "TupleType" | "NamedTupleMember" | "OptionalType" | "RestType"
  | "ParenthesizedType" | "FunctionType" | "ConstructorType" | "TemplateHead" | "TemplateMiddle" | "TemplateTail"
  | "TemplateLiteralType" | "TemplateLiteralTypeSpan" | "PartiallyEmittedExpression" | "JsxElement"
  | "JsxAttributes" | "JsxNamespacedName" | "JsxOpeningElement" | "JsxSelfClosingElement" | "JsxFragment"
  | "JsxOpeningFragment" | "JsxClosingFragment" | "JsxAttribute" | "JsxSpreadAttribute" | "JsxClosingElement"
  | "JsxExpression" | "JsxText" | "SyntaxList" | "JSDoc" | "JSDocTypeExpression" | "JSDocNonNullableType"
  | "JSDocNullableType" | "JSDocAllType" | "JSDocVariadicType" | "JSDocOptionalType" | "JSDocTypeTag"
  | "JSDocUnknownTag" | "JSDocTemplateTag" | "JSDocReturnTag" | "JSDocPublicTag" | "JSDocPrivateTag"
  | "JSDocProtectedTag" | "JSDocReadonlyTag" | "JSDocOverrideTag" | "JSDocDeprecatedTag" | "JSDocSeeTag"
  | "JSDocImplementsTag" | "JSDocAugmentsTag" | "JSDocSatisfiesTag" | "JSDocThrowsTag" | "JSDocThisTag"
  | "JSDocImportTag" | "JSDocCallbackTag" | "JSDocOverloadTag" | "JSDocTypedefTag" | "JSDocSignature"
  | "JSDocNameReference" | "SourceFile" | "ModuleDeclaration" | "ImportEqualsDeclaration" | "ExportDeclaration"
  | "ImportType" | "ImportClause" | "ImportSpecifier" | "JSDocText" | "JSDocLink" | "JSDocLinkPlain"
  | "JSDocLinkCode" | "TypeParameter" | "SyntheticReferenceExpression" | "JSDocTypeLiteral" | "JSDocParameterTag"
  | "JSDocPropertyTag" | "Token" | "KeywordExpression" | "KeywordTypeNode" | "Expression" | "Statement"
  | "TypeNode" | "BlockOrExpression" | "BodyRoot" | "NodeBody" | "ForInitializer" | "CaseOrDefaultClause"
  | "BindingPattern" | "BindingName" | "PropertyName" | "EntityName" | "MemberName" | "ModuleName"
  | "ModuleExportName" | "JSDocFullName" | "ModuleReference" | "NamedImportBindings" | "NamedExportBindings"
  | "ModifierList" | "ClassElement" | "TypeElement" | "ObjectLiteralElementLike" | "LeftHandSideExpression"
  | "LiteralTypeChild" | "BinaryOperatorToken" | "TemplateMiddleOrTail" | "TemplateLiteral"
  | "TypePredicateParameterName" | "ImportAttributeName" | "JsxChild" | "JsxAttributeLike" | "JsxAttributeName"
  | "JsxAttributeValue" | "JsxTagNameExpression" | "JSDocComment" | "JSDocTag" | "SyntaxFlag" | "TokenFlag"
  | "NullKeyword" | "TrueKeyword" | "FalseKeyword" | "ThisKeyword" | "SuperKeyword" | "ImportKeyword"
  | "AnyKeyword" | "BigIntKeyword" | "BooleanKeyword" | "IntrinsicKeyword" | "NeverKeyword" | "NumberKeyword"
  | "ObjectKeyword" | "StringKeyword" | "SymbolKeyword" | "UndefinedKeyword" | "UnknownKeyword" | "VoidKeyword";
type HirSchemaName = HirSyntaxName | "ModuleId" | "BodyId" | "NodeId" | "TyId" | "CandidateListId" | "HostDiagnosticCode"
  | "DefId" | "ExpansionId" | "LocalId" | "SigId" | "TextRange" | "Origin" | "NodeRef"
  | "ItemNodeRef" | "SourceNodeRef" | "LocalRef" | "LibraryModuleIdentity" | "TypeParameterIdentity"
  | "TypeParameterData" | "TypeBinding" | "SelfBinding" | "BindingVector" | "ExactRational" | "LiteralValue"
  | "LiteralTypeValue" | "NonNumericLiteralValue" | "MemberKey" | "MemberOrigin" | "PassingMode"
  | "ConstructionDefinition" | "SumFamily" | "SumArmRole" | "ComponentSelector" | "TypeComponent"
  | "DiagnosticCode" | "DiagnosticSite" | "MessageArgument" | "RelatedDiagnostic" | "TextEdit" | "DiagnosticFix"
  | "Diagnostic" | "CommentDirective" | "CommentRange" | "PragmaArgument" | "PragmaArguments" | "Pragma"
  | "CheckJsDirective" | "HirCheckerViews" | "ImportTarget" | "HirResolution" | "HirAttribute" | "HirArgument"
  | "HirInferenceContribution" | "HirCallableEndpoint" | "HirCandidate" | "HirApplication" | "HirCandidateList"
  | "HirProtocolFact" | "HirStoragePlace" | "HirMemoryGeometryCapture" | "HirMemoryLayoutCapture"
  | "HirMemoryFieldCapture" | "HirObservationCapture" | "HirCapturedType" | "HirFieldMarkerCapture"
  | "HirMarkersCapture" | "HirPointerTypeCapture" | "HirIntegerOperandCapture" | "HirAddressIntegerCapture"
  | "HirPointerOperationCapture" | "HirFieldBindingCapture" | "HirRecordFieldBindingCapture" | "HirRecordBindingCapture" | "HirAttributeCapture" | "HirSafetySelectionCapture" | "HirSafetyCapture"
  | "HirArgumentPassingCapture" | "HirCoreCapture" | "CheckedValue" | "CheckedExpression" | "CheckedLiteral"
  | "CheckedName" | "CheckedBinary" | "CheckedUnary" | "CheckedKeyword" | "CheckedInstantiation"
  | "CheckedAggregate" | "CheckedApplication" | "CheckedMember" | "CheckedProtocol" | "CheckedClosure"
  | "CheckedType" | "DeclarationTarget" | "CheckedCallable" | "CheckedClass" | "CheckedClassExpression"
  | "HirHeritage" | "CheckedTypeAlias" | "CheckedVariable" | "CheckedEnum" | "CheckedNamespace"
  | "CheckedImport" | "CheckedExport" | "CheckedExportBinding" | "CheckedNamespaceExport" | "CheckedExportAssignment" | "CheckedStaticBlock"
  | "CheckedProperty" | "CheckedBinding" | "CheckedBindingList" | "CheckedIteration" | "CheckedModule"
  | "CheckedTypeParameter" | "HirLocal" | "HirParam" | "HirLexicalScope" | "HirBody" | "HirDeclarationEntry"
  | "HirUnaryOperator" | "HirBinaryOperator" | "ProofObligation" | "HirDiagnosticRoot" | "HirModule"
  | "HirExportTarget" | "HirBindingTarget" | "HirModuleExport" | "HirModuleBinding" | "CheckerDiagnosticRef";
type HirShapeBody = HirIdentityShape | HirHostCodeShape | HirLiteralShape | HirArrayShape | HirChoiceShape | HirRecordShape | HirDictionaryShape;
export type HirShape = "string" | "number" | "bigint" | "boolean" | "null" | "SyntaxNode" | HirSchemaName | HirShapeBody;
export type HirField = readonly [string, HirShape] | readonly [string, HirLiteralShape, true];
interface HirSyntaxSchema {
  readonly Unknown: HirShapeBody;
  readonly EndOfFile: HirShapeBody;
  readonly SingleLineCommentTrivia: HirShapeBody;
  readonly MultiLineCommentTrivia: HirShapeBody;
  readonly NewLineTrivia: HirShapeBody;
  readonly WhitespaceTrivia: HirShapeBody;
  readonly ConflictMarkerTrivia: HirShapeBody;
  readonly NonTextFileMarkerTrivia: HirShapeBody;
  readonly JsxTextAllWhiteSpaces: HirShapeBody;
  readonly OpenBraceToken: HirShapeBody;
  readonly CloseBraceToken: HirShapeBody;
  readonly OpenParenToken: HirShapeBody;
  readonly CloseParenToken: HirShapeBody;
  readonly OpenBracketToken: HirShapeBody;
  readonly CloseBracketToken: HirShapeBody;
  readonly DotToken: HirShapeBody;
  readonly DotDotDotToken: HirShapeBody;
  readonly SemicolonToken: HirShapeBody;
  readonly CommaToken: HirShapeBody;
  readonly QuestionDotToken: HirShapeBody;
  readonly LessThanToken: HirShapeBody;
  readonly LessThanSlashToken: HirShapeBody;
  readonly GreaterThanToken: HirShapeBody;
  readonly LessThanEqualsToken: HirShapeBody;
  readonly GreaterThanEqualsToken: HirShapeBody;
  readonly EqualsEqualsToken: HirShapeBody;
  readonly ExclamationEqualsToken: HirShapeBody;
  readonly EqualsEqualsEqualsToken: HirShapeBody;
  readonly ExclamationEqualsEqualsToken: HirShapeBody;
  readonly EqualsGreaterThanToken: HirShapeBody;
  readonly PlusToken: HirShapeBody;
  readonly MinusToken: HirShapeBody;
  readonly AsteriskToken: HirShapeBody;
  readonly AsteriskAsteriskToken: HirShapeBody;
  readonly SlashToken: HirShapeBody;
  readonly PercentToken: HirShapeBody;
  readonly PlusPlusToken: HirShapeBody;
  readonly MinusMinusToken: HirShapeBody;
  readonly LessThanLessThanToken: HirShapeBody;
  readonly GreaterThanGreaterThanToken: HirShapeBody;
  readonly GreaterThanGreaterThanGreaterThanToken: HirShapeBody;
  readonly AmpersandToken: HirShapeBody;
  readonly BarToken: HirShapeBody;
  readonly CaretToken: HirShapeBody;
  readonly ExclamationToken: HirShapeBody;
  readonly TildeToken: HirShapeBody;
  readonly AmpersandAmpersandToken: HirShapeBody;
  readonly BarBarToken: HirShapeBody;
  readonly QuestionToken: HirShapeBody;
  readonly ColonToken: HirShapeBody;
  readonly AtToken: HirShapeBody;
  readonly QuestionQuestionToken: HirShapeBody;
  readonly BacktickToken: HirShapeBody;
  readonly HashToken: HirShapeBody;
  readonly EqualsToken: HirShapeBody;
  readonly PlusEqualsToken: HirShapeBody;
  readonly MinusEqualsToken: HirShapeBody;
  readonly AsteriskEqualsToken: HirShapeBody;
  readonly AsteriskAsteriskEqualsToken: HirShapeBody;
  readonly SlashEqualsToken: HirShapeBody;
  readonly PercentEqualsToken: HirShapeBody;
  readonly LessThanLessThanEqualsToken: HirShapeBody;
  readonly GreaterThanGreaterThanEqualsToken: HirShapeBody;
  readonly GreaterThanGreaterThanGreaterThanEqualsToken: HirShapeBody;
  readonly AmpersandEqualsToken: HirShapeBody;
  readonly BarEqualsToken: HirShapeBody;
  readonly BarBarEqualsToken: HirShapeBody;
  readonly AmpersandAmpersandEqualsToken: HirShapeBody;
  readonly QuestionQuestionEqualsToken: HirShapeBody;
  readonly CaretEqualsToken: HirShapeBody;
  readonly JSDocCommentTextToken: HirShapeBody;
  readonly BreakKeyword: HirShapeBody;
  readonly CaseKeyword: HirShapeBody;
  readonly CatchKeyword: HirShapeBody;
  readonly ClassKeyword: HirShapeBody;
  readonly ConstKeyword: HirShapeBody;
  readonly ContinueKeyword: HirShapeBody;
  readonly DebuggerKeyword: HirShapeBody;
  readonly DefaultKeyword: HirShapeBody;
  readonly DeleteKeyword: HirShapeBody;
  readonly DoKeyword: HirShapeBody;
  readonly ElseKeyword: HirShapeBody;
  readonly EnumKeyword: HirShapeBody;
  readonly ExportKeyword: HirShapeBody;
  readonly ExtendsKeyword: HirShapeBody;
  readonly FinallyKeyword: HirShapeBody;
  readonly ForKeyword: HirShapeBody;
  readonly FunctionKeyword: HirShapeBody;
  readonly IfKeyword: HirShapeBody;
  readonly InKeyword: HirShapeBody;
  readonly InstanceOfKeyword: HirShapeBody;
  readonly NewKeyword: HirShapeBody;
  readonly ReturnKeyword: HirShapeBody;
  readonly SwitchKeyword: HirShapeBody;
  readonly ThrowKeyword: HirShapeBody;
  readonly TryKeyword: HirShapeBody;
  readonly TypeOfKeyword: HirShapeBody;
  readonly VarKeyword: HirShapeBody;
  readonly WhileKeyword: HirShapeBody;
  readonly WithKeyword: HirShapeBody;
  readonly ImplementsKeyword: HirShapeBody;
  readonly InterfaceKeyword: HirShapeBody;
  readonly LetKeyword: HirShapeBody;
  readonly PackageKeyword: HirShapeBody;
  readonly PrivateKeyword: HirShapeBody;
  readonly ProtectedKeyword: HirShapeBody;
  readonly PublicKeyword: HirShapeBody;
  readonly StaticKeyword: HirShapeBody;
  readonly YieldKeyword: HirShapeBody;
  readonly AbstractKeyword: HirShapeBody;
  readonly AccessorKeyword: HirShapeBody;
  readonly AsKeyword: HirShapeBody;
  readonly AssertsKeyword: HirShapeBody;
  readonly AssertKeyword: HirShapeBody;
  readonly AsyncKeyword: HirShapeBody;
  readonly AwaitKeyword: HirShapeBody;
  readonly ConstructorKeyword: HirShapeBody;
  readonly DeclareKeyword: HirShapeBody;
  readonly GetKeyword: HirShapeBody;
  readonly ImmediateKeyword: HirShapeBody;
  readonly InferKeyword: HirShapeBody;
  readonly IsKeyword: HirShapeBody;
  readonly KeyOfKeyword: HirShapeBody;
  readonly ModuleKeyword: HirShapeBody;
  readonly NamespaceKeyword: HirShapeBody;
  readonly OutKeyword: HirShapeBody;
  readonly ReadonlyKeyword: HirShapeBody;
  readonly RequireKeyword: HirShapeBody;
  readonly SatisfiesKeyword: HirShapeBody;
  readonly SetKeyword: HirShapeBody;
  readonly TypeKeyword: HirShapeBody;
  readonly UniqueKeyword: HirShapeBody;
  readonly UsingKeyword: HirShapeBody;
  readonly FromKeyword: HirShapeBody;
  readonly GlobalKeyword: HirShapeBody;
  readonly OverrideKeyword: HirShapeBody;
  readonly OfKeyword: HirShapeBody;
  readonly DeferKeyword: HirShapeBody;
  readonly Identifier: HirShapeBody;
  readonly PrivateIdentifier: HirShapeBody;
  readonly QualifiedName: HirShapeBody;
  readonly ComputedPropertyName: HirShapeBody;
  readonly Decorator: HirShapeBody;
  readonly EmptyStatement: HirShapeBody;
  readonly IfStatement: HirShapeBody;
  readonly DoStatement: HirShapeBody;
  readonly WhileStatement: HirShapeBody;
  readonly ForStatement: HirShapeBody;
  readonly ForInStatement: HirShapeBody;
  readonly ForOfStatement: HirShapeBody;
  readonly BreakStatement: HirShapeBody;
  readonly ContinueStatement: HirShapeBody;
  readonly ReturnStatement: HirShapeBody;
  readonly WithStatement: HirShapeBody;
  readonly SwitchStatement: HirShapeBody;
  readonly CaseBlock: HirShapeBody;
  readonly CaseClause: HirShapeBody;
  readonly DefaultClause: HirShapeBody;
  readonly ThrowStatement: HirShapeBody;
  readonly TryStatement: HirShapeBody;
  readonly CatchClause: HirShapeBody;
  readonly DebuggerStatement: HirShapeBody;
  readonly LabeledStatement: HirShapeBody;
  readonly ExpressionStatement: HirShapeBody;
  readonly Block: HirShapeBody;
  readonly VariableStatement: HirShapeBody;
  readonly VariableDeclaration: HirShapeBody;
  readonly VariableDeclarationList: HirShapeBody;
  readonly ObjectBindingPattern: HirShapeBody;
  readonly ArrayBindingPattern: HirShapeBody;
  readonly Parameter: HirShapeBody;
  readonly BindingElement: HirShapeBody;
  readonly MissingDeclaration: HirShapeBody;
  readonly FunctionDeclaration: HirShapeBody;
  readonly ClassDeclaration: HirShapeBody;
  readonly ClassExpression: HirShapeBody;
  readonly HeritageClause: HirShapeBody;
  readonly InterfaceDeclaration: HirShapeBody;
  readonly TypeAliasDeclaration: HirShapeBody;
  readonly JSTypeAliasDeclaration: HirShapeBody;
  readonly EnumMember: HirShapeBody;
  readonly EnumDeclaration: HirShapeBody;
  readonly ModuleBlock: HirShapeBody;
  readonly NotEmittedStatement: HirShapeBody;
  readonly NotEmittedTypeElement: HirShapeBody;
  readonly ImportDeclaration: HirShapeBody;
  readonly JSImportDeclaration: HirShapeBody;
  readonly ExternalModuleReference: HirShapeBody;
  readonly NamespaceImport: HirShapeBody;
  readonly NamedImports: HirShapeBody;
  readonly ExportAssignment: HirShapeBody;
  readonly NamespaceExportDeclaration: HirShapeBody;
  readonly NamespaceExport: HirShapeBody;
  readonly NamedExports: HirShapeBody;
  readonly ExportSpecifier: HirShapeBody;
  readonly CallSignature: HirShapeBody;
  readonly ConstructSignature: HirShapeBody;
  readonly Constructor: HirShapeBody;
  readonly GetAccessor: HirShapeBody;
  readonly SetAccessor: HirShapeBody;
  readonly IndexSignature: HirShapeBody;
  readonly MethodSignature: HirShapeBody;
  readonly MethodDeclaration: HirShapeBody;
  readonly PropertySignature: HirShapeBody;
  readonly PropertyDeclaration: HirShapeBody;
  readonly SemicolonClassElement: HirShapeBody;
  readonly ClassStaticBlockDeclaration: HirShapeBody;
  readonly OmittedExpression: HirShapeBody;
  readonly StringLiteral: HirShapeBody;
  readonly NumericLiteral: HirShapeBody;
  readonly BigIntLiteral: HirShapeBody;
  readonly RegularExpressionLiteral: HirShapeBody;
  readonly NoSubstitutionTemplateLiteral: HirShapeBody;
  readonly BinaryExpression: HirShapeBody;
  readonly PrefixUnaryExpression: HirShapeBody;
  readonly PostfixUnaryExpression: HirShapeBody;
  readonly YieldExpression: HirShapeBody;
  readonly ArrowFunction: HirShapeBody;
  readonly FunctionExpression: HirShapeBody;
  readonly AsExpression: HirShapeBody;
  readonly SatisfiesExpression: HirShapeBody;
  readonly ConditionalExpression: HirShapeBody;
  readonly PropertyAccessExpression: HirShapeBody;
  readonly ElementAccessExpression: HirShapeBody;
  readonly CallExpression: HirShapeBody;
  readonly NewExpression: HirShapeBody;
  readonly MetaProperty: HirShapeBody;
  readonly NonNullExpression: HirShapeBody;
  readonly SpreadElement: HirShapeBody;
  readonly TemplateExpression: HirShapeBody;
  readonly TemplateSpan: HirShapeBody;
  readonly TaggedTemplateExpression: HirShapeBody;
  readonly ParenthesizedExpression: HirShapeBody;
  readonly ArrayLiteralExpression: HirShapeBody;
  readonly ObjectLiteralExpression: HirShapeBody;
  readonly SpreadAssignment: HirShapeBody;
  readonly PropertyAssignment: HirShapeBody;
  readonly ShorthandPropertyAssignment: HirShapeBody;
  readonly DeleteExpression: HirShapeBody;
  readonly TypeOfExpression: HirShapeBody;
  readonly VoidExpression: HirShapeBody;
  readonly AwaitExpression: HirShapeBody;
  readonly TypeAssertionExpression: HirShapeBody;
  readonly UnionType: HirShapeBody;
  readonly IntersectionType: HirShapeBody;
  readonly ConditionalType: HirShapeBody;
  readonly TypeOperator: HirShapeBody;
  readonly InferType: HirShapeBody;
  readonly ArrayType: HirShapeBody;
  readonly IndexedAccessType: HirShapeBody;
  readonly TypeReference: HirShapeBody;
  readonly ExpressionWithTypeArguments: HirShapeBody;
  readonly LiteralType: HirShapeBody;
  readonly ThisType: HirShapeBody;
  readonly TypePredicate: HirShapeBody;
  readonly ImportAttribute: HirShapeBody;
  readonly ImportAttributes: HirShapeBody;
  readonly TypeQuery: HirShapeBody;
  readonly MappedType: HirShapeBody;
  readonly TypeLiteral: HirShapeBody;
  readonly TupleType: HirShapeBody;
  readonly NamedTupleMember: HirShapeBody;
  readonly OptionalType: HirShapeBody;
  readonly RestType: HirShapeBody;
  readonly ParenthesizedType: HirShapeBody;
  readonly FunctionType: HirShapeBody;
  readonly ConstructorType: HirShapeBody;
  readonly TemplateHead: HirShapeBody;
  readonly TemplateMiddle: HirShapeBody;
  readonly TemplateTail: HirShapeBody;
  readonly TemplateLiteralType: HirShapeBody;
  readonly TemplateLiteralTypeSpan: HirShapeBody;
  readonly PartiallyEmittedExpression: HirShapeBody;
  readonly JsxElement: HirShapeBody;
  readonly JsxAttributes: HirShapeBody;
  readonly JsxNamespacedName: HirShapeBody;
  readonly JsxOpeningElement: HirShapeBody;
  readonly JsxSelfClosingElement: HirShapeBody;
  readonly JsxFragment: HirShapeBody;
  readonly JsxOpeningFragment: HirShapeBody;
  readonly JsxClosingFragment: HirShapeBody;
  readonly JsxAttribute: HirShapeBody;
  readonly JsxSpreadAttribute: HirShapeBody;
  readonly JsxClosingElement: HirShapeBody;
  readonly JsxExpression: HirShapeBody;
  readonly JsxText: HirShapeBody;
  readonly SyntaxList: HirShapeBody;
  readonly JSDoc: HirShapeBody;
  readonly JSDocTypeExpression: HirShapeBody;
  readonly JSDocNonNullableType: HirShapeBody;
  readonly JSDocNullableType: HirShapeBody;
  readonly JSDocAllType: HirShapeBody;
  readonly JSDocVariadicType: HirShapeBody;
  readonly JSDocOptionalType: HirShapeBody;
  readonly JSDocTypeTag: HirShapeBody;
  readonly JSDocUnknownTag: HirShapeBody;
  readonly JSDocTemplateTag: HirShapeBody;
  readonly JSDocReturnTag: HirShapeBody;
  readonly JSDocPublicTag: HirShapeBody;
  readonly JSDocPrivateTag: HirShapeBody;
  readonly JSDocProtectedTag: HirShapeBody;
  readonly JSDocReadonlyTag: HirShapeBody;
  readonly JSDocOverrideTag: HirShapeBody;
  readonly JSDocDeprecatedTag: HirShapeBody;
  readonly JSDocSeeTag: HirShapeBody;
  readonly JSDocImplementsTag: HirShapeBody;
  readonly JSDocAugmentsTag: HirShapeBody;
  readonly JSDocSatisfiesTag: HirShapeBody;
  readonly JSDocThrowsTag: HirShapeBody;
  readonly JSDocThisTag: HirShapeBody;
  readonly JSDocImportTag: HirShapeBody;
  readonly JSDocCallbackTag: HirShapeBody;
  readonly JSDocOverloadTag: HirShapeBody;
  readonly JSDocTypedefTag: HirShapeBody;
  readonly JSDocSignature: HirShapeBody;
  readonly JSDocNameReference: HirShapeBody;
  readonly SourceFile: HirShapeBody;
  readonly ModuleDeclaration: HirShapeBody;
  readonly ImportEqualsDeclaration: HirShapeBody;
  readonly ExportDeclaration: HirShapeBody;
  readonly ImportType: HirShapeBody;
  readonly ImportClause: HirShapeBody;
  readonly ImportSpecifier: HirShapeBody;
  readonly JSDocText: HirShapeBody;
  readonly JSDocLink: HirShapeBody;
  readonly JSDocLinkPlain: HirShapeBody;
  readonly JSDocLinkCode: HirShapeBody;
  readonly TypeParameter: HirShapeBody;
  readonly SyntheticReferenceExpression: HirShapeBody;
  readonly JSDocTypeLiteral: HirShapeBody;
  readonly JSDocParameterTag: HirShapeBody;
  readonly JSDocPropertyTag: HirShapeBody;
  readonly Token: HirShapeBody;
  readonly KeywordExpression: HirShapeBody;
  readonly KeywordTypeNode: HirShapeBody;
  readonly Expression: HirShapeBody;
  readonly Statement: HirShapeBody;
  readonly TypeNode: HirShapeBody;
  readonly BlockOrExpression: HirShapeBody;
  readonly BodyRoot: HirShapeBody;
  readonly NodeBody: HirShapeBody;
  readonly ForInitializer: HirShapeBody;
  readonly CaseOrDefaultClause: HirShapeBody;
  readonly BindingPattern: HirShapeBody;
  readonly BindingName: HirShapeBody;
  readonly PropertyName: HirShapeBody;
  readonly EntityName: HirShapeBody;
  readonly MemberName: HirShapeBody;
  readonly ModuleName: HirShapeBody;
  readonly ModuleExportName: HirShapeBody;
  readonly JSDocFullName: HirShapeBody;
  readonly ModuleReference: HirShapeBody;
  readonly NamedImportBindings: HirShapeBody;
  readonly NamedExportBindings: HirShapeBody;
  readonly ModifierList: HirShapeBody;
  readonly ClassElement: HirShapeBody;
  readonly TypeElement: HirShapeBody;
  readonly ObjectLiteralElementLike: HirShapeBody;
  readonly LeftHandSideExpression: HirShapeBody;
  readonly LiteralTypeChild: HirShapeBody;
  readonly BinaryOperatorToken: HirShapeBody;
  readonly TemplateMiddleOrTail: HirShapeBody;
  readonly TemplateLiteral: HirShapeBody;
  readonly TypePredicateParameterName: HirShapeBody;
  readonly ImportAttributeName: HirShapeBody;
  readonly JsxChild: HirShapeBody;
  readonly JsxAttributeLike: HirShapeBody;
  readonly JsxAttributeName: HirShapeBody;
  readonly JsxAttributeValue: HirShapeBody;
  readonly JsxTagNameExpression: HirShapeBody;
  readonly JSDocComment: HirShapeBody;
  readonly JSDocTag: HirShapeBody;
  readonly SyntaxFlag: HirShapeBody;
  readonly TokenFlag: HirShapeBody;
  readonly NullKeyword: HirShapeBody;
  readonly TrueKeyword: HirShapeBody;
  readonly FalseKeyword: HirShapeBody;
  readonly ThisKeyword: HirShapeBody;
  readonly SuperKeyword: HirShapeBody;
  readonly ImportKeyword: HirShapeBody;
  readonly AnyKeyword: HirShapeBody;
  readonly BigIntKeyword: HirShapeBody;
  readonly BooleanKeyword: HirShapeBody;
  readonly IntrinsicKeyword: HirShapeBody;
  readonly NeverKeyword: HirShapeBody;
  readonly NumberKeyword: HirShapeBody;
  readonly ObjectKeyword: HirShapeBody;
  readonly StringKeyword: HirShapeBody;
  readonly SymbolKeyword: HirShapeBody;
  readonly UndefinedKeyword: HirShapeBody;
  readonly UnknownKeyword: HirShapeBody;
  readonly VoidKeyword: HirShapeBody;
}
export interface HirSchema extends HirSyntaxSchema {
  readonly HirExportTarget: HirShapeBody;
  readonly HirBindingTarget: HirShapeBody;
  readonly HirModuleExport: HirShapeBody;
  readonly HirModuleBinding: HirShapeBody;
  readonly CheckerDiagnosticRef: HirShapeBody;
  readonly HostDiagnosticCode: HirHostCodeShape;
  readonly DefId: HirShapeBody;
  readonly ExpansionId: HirShapeBody;
  readonly LocalId: HirShapeBody;
  readonly SigId: HirShapeBody;
  readonly TextRange: HirShapeBody;
  readonly Origin: HirShapeBody;
  readonly NodeRef: HirShapeBody;
  readonly ItemNodeRef: HirShapeBody;
  readonly SourceNodeRef: HirShapeBody;
  readonly LocalRef: HirShapeBody;
  readonly LibraryModuleIdentity: HirShapeBody;
  readonly TypeParameterIdentity: HirShapeBody;
  readonly TypeParameterData: HirShapeBody;
  readonly TypeBinding: HirShapeBody;
  readonly SelfBinding: HirShapeBody;
  readonly BindingVector: HirShapeBody;
  readonly ExactRational: HirShapeBody;
  readonly LiteralValue: HirShapeBody;
  readonly LiteralTypeValue: HirShapeBody;
  readonly NonNumericLiteralValue: HirShapeBody;
  readonly MemberKey: HirShapeBody;
  readonly MemberOrigin: HirShapeBody;
  readonly PassingMode: HirShapeBody;
  readonly ConstructionDefinition: HirShapeBody;
  readonly SumFamily: HirShapeBody;
  readonly SumArmRole: HirShapeBody;
  readonly ComponentSelector: HirShapeBody;
  readonly TypeComponent: HirShapeBody;
  readonly DiagnosticCode: HirShapeBody;
  readonly DiagnosticSite: HirShapeBody;
  readonly MessageArgument: HirShapeBody;
  readonly RelatedDiagnostic: HirShapeBody;
  readonly TextEdit: HirShapeBody;
  readonly DiagnosticFix: HirShapeBody;
  readonly Diagnostic: HirShapeBody;
  readonly CommentDirective: HirShapeBody;
  readonly CommentRange: HirShapeBody;
  readonly PragmaArgument: HirShapeBody;
  readonly PragmaArguments: HirShapeBody;
  readonly Pragma: HirShapeBody;
  readonly CheckJsDirective: HirShapeBody;
  readonly HirCheckerViews: HirShapeBody;
  readonly ImportTarget: HirShapeBody;
  readonly HirResolution: HirShapeBody;
  readonly HirAttribute: HirShapeBody;
  readonly HirArgument: HirShapeBody;
  readonly HirInferenceContribution: HirShapeBody;
  readonly HirCallableEndpoint: HirShapeBody;
  readonly HirCandidate: HirShapeBody;
  readonly HirApplication: HirShapeBody;
  readonly HirCandidateList: HirShapeBody;
  readonly HirProtocolFact: HirShapeBody;
  readonly HirStoragePlace: HirShapeBody;
  readonly HirMemoryGeometryCapture: HirShapeBody;
  readonly HirMemoryLayoutCapture: HirShapeBody;
  readonly HirMemoryFieldCapture: HirShapeBody;
  readonly HirObservationCapture: HirShapeBody;
  readonly HirCapturedType: HirShapeBody;
  readonly HirFieldMarkerCapture: HirShapeBody;
  readonly HirMarkersCapture: HirShapeBody;
  readonly HirPointerTypeCapture: HirShapeBody;
  readonly HirIntegerOperandCapture: HirShapeBody;
  readonly HirAddressIntegerCapture: HirShapeBody;
  readonly HirPointerOperationCapture: HirShapeBody;
  readonly HirFieldBindingCapture: HirShapeBody;
  readonly HirRecordFieldBindingCapture: HirShapeBody;
  readonly HirRecordBindingCapture: HirShapeBody;
  readonly HirAttributeCapture: HirShapeBody;
  readonly HirSafetySelectionCapture: HirShapeBody;
  readonly HirSafetyCapture: HirShapeBody;
  readonly HirArgumentPassingCapture: HirShapeBody;
  readonly HirCoreCapture: HirShapeBody;
  readonly CheckedValue: HirShapeBody;
  readonly CheckedExpression: HirShapeBody;
  readonly CheckedLiteral: HirShapeBody;
  readonly CheckedName: HirShapeBody;
  readonly CheckedBinary: HirShapeBody;
  readonly CheckedUnary: HirShapeBody;
  readonly CheckedKeyword: HirShapeBody;
  readonly CheckedInstantiation: HirShapeBody;
  readonly CheckedAggregate: HirShapeBody;
  readonly CheckedApplication: HirShapeBody;
  readonly CheckedMember: HirShapeBody;
  readonly CheckedProtocol: HirShapeBody;
  readonly CheckedClosure: HirShapeBody;
  readonly CheckedType: HirShapeBody;
  readonly DeclarationTarget: HirShapeBody;
  readonly CheckedCallable: HirShapeBody;
  readonly CheckedClass: HirShapeBody;
  readonly CheckedClassExpression: HirShapeBody;
  readonly HirHeritage: HirShapeBody;
  readonly CheckedTypeAlias: HirShapeBody;
  readonly CheckedVariable: HirShapeBody;
  readonly CheckedEnum: HirShapeBody;
  readonly CheckedNamespace: HirShapeBody;
  readonly CheckedImport: HirShapeBody;
  readonly CheckedExport: HirShapeBody;
  readonly CheckedExportBinding: HirShapeBody;
  readonly CheckedNamespaceExport: HirShapeBody;
  readonly CheckedExportAssignment: HirShapeBody;
  readonly CheckedStaticBlock: HirShapeBody;
  readonly CheckedProperty: HirShapeBody;
  readonly CheckedBinding: HirShapeBody;
  readonly CheckedBindingList: HirShapeBody;
  readonly CheckedIteration: HirShapeBody;
  readonly CheckedModule: HirShapeBody;
  readonly CheckedTypeParameter: HirShapeBody;
  readonly HirLocal: HirShapeBody;
  readonly HirParam: HirShapeBody;
  readonly HirLexicalScope: HirShapeBody;
  readonly HirBody: HirShapeBody;
  readonly HirDeclarationEntry: HirShapeBody;
  readonly HirUnaryOperator: HirShapeBody;
  readonly HirBinaryOperator: HirShapeBody;
  readonly ProofObligation: HirShapeBody;
  readonly HirDiagnosticRoot: HirShapeBody;
  readonly HirModule: HirShapeBody;
  readonly ModuleId: HirShapeBody;
  readonly BodyId: HirShapeBody;
  readonly NodeId: HirShapeBody;
  readonly TyId: HirShapeBody;
  readonly CandidateListId: HirShapeBody;
}

export function hirNumericIdentity(prefix: HirNumericIdentityShape["prefix"]): HirNumericIdentityShape {
  return ({ kind: "identity", prefix, value: "number" });
}

export function hirStringIdentity(prefix: HirStringIdentityShape["prefix"]): HirStringIdentityShape {
  return ({ kind: "identity", prefix, value: "string" });
}

export function hirLiteral(...values: readonly (string | number | boolean | null)[]): HirLiteralShape {
  return ({ kind: "literal", values: (values) });
}

export function hirDiscriminant(name: string, ...values: readonly (string | number | boolean | null)[]): HirField {
  return ([name, hirLiteral(...values), true]);
}

export function hirArray(element: HirShape): HirArrayShape {
  return ({ kind: "array", element });
}

export function hirChoice(...alternatives: readonly HirShape[]): HirChoiceShape {
  return ({ kind: "choice", alternatives: (alternatives) });
}

export function hirNullable(value: HirShape): HirChoiceShape {
  return hirChoice("null", value);
}

export function hirRecord(label: string, fields: readonly HirField[]): HirRecordShape {
  return ({ kind: "record", label, fields: (fields), syntax: false });
}

export function hirVariant(kind: string, fields: readonly HirField[]): HirRecordShape {
  return hirRecord(kind, [hirDiscriminant("kind", kind), ...fields]);
}

export function createSyntaxSchema(): HirSyntaxSchema {

  function list(element: HirShape): HirRecordShape {
    return hirRecord("NodeList", [["loc", "TextRange"], ["nodes", hirArray(element)]]);
  }

  const header: readonly HirField[] = ([
    ["id", "NodeId"], ["origin", "Origin"], ["parent", hirNullable("NodeId")],
    ["flags", hirArray("SyntaxFlag")], ["loc", "TextRange"],
  ]);

  function node(kind: string, metadata: HirShape, fields: readonly HirField[] = []): HirRecordShape {
    return ({ kind: "record", label: kind, syntax: true,
      fields: ([hirDiscriminant("kind", kind), ...header, ...fields, ["tsonic", metadata]]) });
  }

  const modifiers = hirNullable("ModifierList");
  const typeParameters = hirNullable(list("TypeParameter"));
  const parameters = list("Parameter");
  const annotation = hirNullable("TypeNode");
  const initializer = hirNullable("Expression");
  const postfix = hirNullable(hirChoice("QuestionToken", "ExclamationToken"));
  const callable: readonly HirField[] = ([
    ["typeParameters", typeParameters], ["parameters", parameters],
    ["type", annotation], ["fullSignature", annotation],
  ]);
  const property: readonly HirField[] = ([
    ["modifiers", modifiers], ["name", "PropertyName"], ["postfixToken", postfix],
    ["type", annotation],
  ]);
  const tag: readonly HirField[] = ([
    ["tagName", "Identifier"], ["comment", hirNullable(list("JSDocComment"))],
  ]);
  const literal: readonly HirField[] = ([
    ["text", "string"], ["tokenFlags", hirArray("TokenFlag")],
  ]);
  const template: readonly HirField[] = ([
    ...literal, ["rawText", "string"], ["templateFlags", hirArray("TokenFlag")],
  ]);
  const classFields: readonly HirField[] = ([
    ["modifiers", modifiers], ["name", hirNullable("Identifier")],
    ["typeParameters", typeParameters], ["heritageClauses", hirNullable(list("HeritageClause"))],
    ["members", list("ClassElement")],
  ]);
  const functionFields: readonly HirField[] = ([
    ["modifiers", modifiers], ...callable, ["asteriskToken", hirNullable("AsteriskToken")],
    ["body", hirNullable("BlockOrExpression")], ["name", hirNullable("Identifier")],
  ]);

  const syntaxShapes = ({
    Identifier: node("Identifier", "CheckedName", [["text", "string"]]),
    PrivateIdentifier: node("PrivateIdentifier", "CheckedName", [["text", "string"]]),
    QualifiedName: node("QualifiedName", "CheckedName", [["left", "EntityName"], ["right", "Identifier"]]),
    ComputedPropertyName: node("ComputedPropertyName", "CheckedProperty", [["expression", "Expression"]]),
    Decorator: node("Decorator", "null", [["expression", "LeftHandSideExpression"]]),
    EmptyStatement: node("EmptyStatement", "null"),
    IfStatement: node("IfStatement", "null", [["expression", "Expression"], ["thenStatement", "Statement"], ["elseStatement", hirNullable("Statement")]]),
    DoStatement: node("DoStatement", "null", [["statement", "Statement"], ["expression", "Expression"]]),
    WhileStatement: node("WhileStatement", "null", [["statement", "Statement"], ["expression", "Expression"]]),
    ForStatement: node("ForStatement", "null", [["statement", "Statement"], ["initializer", hirNullable("ForInitializer")], ["condition", initializer], ["incrementor", initializer]]),
    ForInStatement: node("ForInStatement", "CheckedIteration", [["awaitModifier", "null"], ["initializer", "ForInitializer"], ["expression", "Expression"], ["statement", "Statement"]]),
    ForOfStatement: node("ForOfStatement", "CheckedIteration", [["awaitModifier", hirNullable("AwaitKeyword")], ["initializer", "ForInitializer"], ["expression", "Expression"], ["statement", "Statement"]]),
    BreakStatement: node("BreakStatement", "null", [["label", hirNullable("Identifier")]]),
    ContinueStatement: node("ContinueStatement", "null", [["label", hirNullable("Identifier")]]),
    ReturnStatement: node("ReturnStatement", "null", [["expression", initializer]]),
    WithStatement: node("WithStatement", "null", [["expression", "Expression"], ["statement", "Statement"]]),
    SwitchStatement: node("SwitchStatement", "null", [["expression", "Expression"], ["caseBlock", "CaseBlock"]]),
    CaseBlock: node("CaseBlock", "null", [["clauses", list("CaseOrDefaultClause")]]),
    CaseClause: node("CaseClause", "null", [["expression", "Expression"], ["statements", list("Statement")]]),
    DefaultClause: node("DefaultClause", "null", [["expression", "null"], ["statements", list("Statement")]]),
    ThrowStatement: node("ThrowStatement", "null", [["expression", "Expression"]]),
    TryStatement: node("TryStatement", "null", [["tryBlock", "Block"], ["catchClause", hirNullable("CatchClause")], ["finallyBlock", hirNullable("Block")]]),
    CatchClause: node("CatchClause", "null", [["variableDeclaration", hirNullable("VariableDeclaration")], ["block", "Block"]]),
    DebuggerStatement: node("DebuggerStatement", "null"),
    LabeledStatement: node("LabeledStatement", "null", [["label", "Identifier"], ["statement", "Statement"]]),
    ExpressionStatement: node("ExpressionStatement", "null", [["expression", "Expression"]]),
    Block: node("Block", "null", [["statements", list("Statement")], ["multiLine", "boolean"]]),
    VariableStatement: node("VariableStatement", "null", [["modifiers", modifiers], ["declarationList", "VariableDeclarationList"]]),
    VariableDeclaration: node("VariableDeclaration", "CheckedVariable", [["name", "BindingName"], ["exclamationToken", hirNullable("ExclamationToken")], ["type", annotation], ["initializer", initializer]]),
    VariableDeclarationList: node("VariableDeclarationList", "CheckedBindingList", [["declarations", list("VariableDeclaration")]]),
    ObjectBindingPattern: node("ObjectBindingPattern", "CheckedBinding", [["elements", list("BindingElement")]]),
    ArrayBindingPattern: node("ArrayBindingPattern", "CheckedBinding", [["elements", list("BindingElement")]]),
    Parameter: node("Parameter", "CheckedVariable", [["modifiers", modifiers], ["dotDotDotToken", hirNullable("DotDotDotToken")], ["name", "BindingName"], ["questionToken", hirNullable("QuestionToken")], ["type", annotation], ["initializer", initializer]]),
    BindingElement: node("BindingElement", "CheckedBinding", [["dotDotDotToken", hirNullable("DotDotDotToken")], ["propertyName", hirNullable("PropertyName")], ["name", hirNullable("BindingName")], ["initializer", initializer]]),
    MissingDeclaration: node("MissingDeclaration", "null", [["modifiers", modifiers]]),
    FunctionDeclaration: node("FunctionDeclaration", "CheckedCallable", functionFields),
    ClassDeclaration: node("ClassDeclaration", "CheckedClass", classFields),
    ClassExpression: node("ClassExpression", "CheckedClassExpression", classFields),
    HeritageClause: node("HeritageClause", "null", [["token", hirLiteral("ExtendsKeyword", "ImplementsKeyword")], ["types", list("ExpressionWithTypeArguments")]]),
    InterfaceDeclaration: node("InterfaceDeclaration", "CheckedClass", [["modifiers", modifiers], ["name", "Identifier"], ["typeParameters", typeParameters], ["heritageClauses", hirNullable(list("HeritageClause"))], ["members", list("TypeElement")]]),
    TypeAliasDeclaration: node("TypeAliasDeclaration", "CheckedTypeAlias", [["modifiers", modifiers], ["name", "Identifier"], ["typeParameters", typeParameters], ["type", "TypeNode"]]),
    JSTypeAliasDeclaration: node("JSTypeAliasDeclaration", "CheckedTypeAlias", [["modifiers", modifiers], ["name", "Identifier"], ["typeParameters", typeParameters], ["type", "TypeNode"]]),
    EnumMember: node("EnumMember", "CheckedVariable", [["modifiers", modifiers], ["name", "PropertyName"], ["postfixToken", postfix], ["initializer", initializer]]),
    EnumDeclaration: node("EnumDeclaration", "CheckedEnum", [["modifiers", modifiers], ["name", "Identifier"], ["members", list("EnumMember")]]),
    ModuleBlock: node("ModuleBlock", "null", [["statements", list("Statement")]]),
    NotEmittedStatement: node("NotEmittedStatement", "null"),
    NotEmittedTypeElement: node("NotEmittedTypeElement", "null"),
    ImportDeclaration: node("ImportDeclaration", "CheckedImport", [["modifiers", modifiers], ["importClause", hirNullable("ImportClause")], ["moduleSpecifier", "Expression"], ["attributes", hirNullable("ImportAttributes")]]),
    "JSImportDeclaration": node("JSImportDeclaration", "CheckedImport", [["modifiers", modifiers], ["importClause", hirNullable("ImportClause")], ["moduleSpecifier", "Expression"], ["attributes", hirNullable("ImportAttributes")]]),
    ExternalModuleReference: node("ExternalModuleReference", "null", [["expression", "Expression"]]),
    NamespaceImport: node("NamespaceImport", "CheckedImport", [["name", "Identifier"]]),
    NamedImports: node("NamedImports", "null", [["elements", list("ImportSpecifier")]]),
    ExportAssignment: node("ExportAssignment", "CheckedExportAssignment", [["modifiers", modifiers], ["isExportEquals", "boolean"], ["type", annotation], ["expression", "Expression"]]),
    NamespaceExportDeclaration: node("NamespaceExportDeclaration", "CheckedExportBinding", [["modifiers", modifiers], ["name", "Identifier"]]),
    NamespaceExport: node("NamespaceExport", "CheckedNamespaceExport", [["name", "ModuleExportName"]]),
    NamedExports: node("NamedExports", "null", [["elements", list("ExportSpecifier")]]),
    ExportSpecifier: node("ExportSpecifier", "CheckedExportBinding", [["isTypeOnly", "boolean"], ["propertyName", hirNullable("ModuleExportName")], ["name", "ModuleExportName"]]),
    CallSignature: node("CallSignature", "CheckedCallable", callable),
    ConstructSignature: node("ConstructSignature", "CheckedCallable", callable),
    Constructor: node("Constructor", "CheckedCallable", [["modifiers", modifiers], ...callable, ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("BlockOrExpression")]]),
    GetAccessor: node("GetAccessor", "CheckedCallable", [...property.slice(0, 3), ...callable, ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("BlockOrExpression")]]),
    SetAccessor: node("SetAccessor", "CheckedCallable", [...property.slice(0, 3), ...callable, ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("BlockOrExpression")]]),
    IndexSignature: node("IndexSignature", "CheckedCallable", [["modifiers", modifiers], ...callable]),
    MethodSignature: node("MethodSignature", "CheckedCallable", [...property.slice(0, 3), ...callable]),
    MethodDeclaration: node("MethodDeclaration", "CheckedCallable", [...property.slice(0, 3), ...callable, ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("BlockOrExpression")]]),
    PropertySignature: node("PropertySignature", "CheckedVariable", [...property, ["initializer", initializer]]),
    PropertyDeclaration: node("PropertyDeclaration", "CheckedVariable", [...property, ["initializer", initializer]]),
    SemicolonClassElement: node("SemicolonClassElement", "null"),
    ClassStaticBlockDeclaration: node("ClassStaticBlockDeclaration", "CheckedStaticBlock", [["modifiers", modifiers], ["body", "Block"]]),
    OmittedExpression: node("OmittedExpression", "CheckedExpression"),
    StringLiteral: node("StringLiteral", "CheckedLiteral", literal),
    NumericLiteral: node("NumericLiteral", "CheckedLiteral", literal),
    BigIntLiteral: node("BigIntLiteral", "CheckedLiteral", literal),
    RegularExpressionLiteral: node("RegularExpressionLiteral", "CheckedExpression", literal),
    NoSubstitutionTemplateLiteral: node("NoSubstitutionTemplateLiteral", "CheckedLiteral", template),
    BinaryExpression: node("BinaryExpression", "CheckedBinary", [["modifiers", modifiers], ["left", "Expression"], ["type", annotation], ["operatorToken", "BinaryOperatorToken"], ["right", "Expression"]]),
    PrefixUnaryExpression: node("PrefixUnaryExpression", "CheckedUnary", [["operator", hirLiteral("PlusToken", "MinusToken", "TildeToken", "ExclamationToken", "PlusPlusToken", "MinusMinusToken")], ["operand", "Expression"]]),
    PostfixUnaryExpression: node("PostfixUnaryExpression", "CheckedUnary", [["operand", "Expression"], ["operator", hirLiteral("PlusPlusToken", "MinusMinusToken")]]),
    YieldExpression: node("YieldExpression", "CheckedProtocol", [["asteriskToken", hirNullable("AsteriskToken")], ["expression", initializer]]),
    ArrowFunction: node("ArrowFunction", "CheckedClosure", [["modifiers", modifiers], ...callable, ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("BlockOrExpression")], ["equalsGreaterThanToken", "EqualsGreaterThanToken"]]),
    FunctionExpression: node("FunctionExpression", "CheckedClosure", functionFields),
    AsExpression: node("AsExpression", "CheckedExpression", [["expression", "Expression"], ["type", "TypeNode"]]),
    SatisfiesExpression: node("SatisfiesExpression", "CheckedExpression", [["expression", "Expression"], ["type", "TypeNode"]]),
    ConditionalExpression: node("ConditionalExpression", "CheckedExpression", [["condition", "Expression"], ["questionToken", "QuestionToken"], ["whenTrue", "Expression"], ["colonToken", "ColonToken"], ["whenFalse", "Expression"]]),
    PropertyAccessExpression: node("PropertyAccessExpression", "CheckedMember", [["expression", "Expression"], ["questionDotToken", hirNullable("QuestionDotToken")], ["name", "MemberName"]]),
    ElementAccessExpression: node("ElementAccessExpression", "CheckedMember", [["expression", "Expression"], ["questionDotToken", hirNullable("QuestionDotToken")], ["argumentExpression", "Expression"]]),
    CallExpression: node("CallExpression", "CheckedApplication", [["expression", "Expression"], ["questionDotToken", hirNullable("QuestionDotToken")], ["typeArguments", hirNullable(list("TypeNode"))], ["arguments", list("Expression")]]),
    NewExpression: node("NewExpression", "CheckedApplication", [["expression", "Expression"], ["typeArguments", hirNullable(list("TypeNode"))], ["arguments", hirNullable(list("Expression"))]]),
    MetaProperty: node("MetaProperty", "CheckedExpression", [["keywordToken", hirLiteral("ImportKeyword", "NewKeyword")], ["name", "Identifier"]]),
    NonNullExpression: node("NonNullExpression", "CheckedExpression", [["expression", "Expression"]]),
    SpreadElement: node("SpreadElement", "CheckedProtocol", [["expression", "Expression"]]),
    TemplateExpression: node("TemplateExpression", "CheckedExpression", [["head", "TemplateHead"], ["templateSpans", list("TemplateSpan")]]),
    TemplateSpan: node("TemplateSpan", "null", [["expression", "Expression"], ["literal", "TemplateMiddleOrTail"]]),
    TaggedTemplateExpression: node("TaggedTemplateExpression", "CheckedApplication", [["tag", "Expression"], ["questionDotToken", hirNullable("QuestionDotToken")], ["typeArguments", hirNullable(list("TypeNode"))], ["template", "TemplateLiteral"]]),
    ParenthesizedExpression: node("ParenthesizedExpression", "CheckedExpression", [["expression", "Expression"]]),
    ArrayLiteralExpression: node("ArrayLiteralExpression", "CheckedAggregate", [["elements", list("Expression")], ["multiLine", "boolean"]]),
    ObjectLiteralExpression: node("ObjectLiteralExpression", "CheckedAggregate", [["properties", list("ObjectLiteralElementLike")], ["multiLine", "boolean"]]),
    SpreadAssignment: node("SpreadAssignment", "null", [["expression", "Expression"]]),
    PropertyAssignment: node("PropertyAssignment", "CheckedProperty", [...property, ["initializer", "Expression"]]),
    ShorthandPropertyAssignment: node("ShorthandPropertyAssignment", "CheckedProperty", [...property, ["equalsToken", hirNullable("EqualsToken")], ["objectAssignmentInitializer", initializer]]),
    DeleteExpression: node("DeleteExpression", "CheckedExpression", [["expression", "Expression"]]),
    TypeOfExpression: node("TypeOfExpression", "CheckedExpression", [["expression", "Expression"]]),
    VoidExpression: node("VoidExpression", "CheckedExpression", [["expression", "Expression"]]),
    AwaitExpression: node("AwaitExpression", "CheckedProtocol", [["expression", "Expression"]]),
    TypeAssertionExpression: node("TypeAssertionExpression", "CheckedExpression", [["type", "TypeNode"], ["expression", "Expression"]]),
    UnionType: node("UnionType", "CheckedType", [["types", list("TypeNode")]]),
    IntersectionType: node("IntersectionType", "CheckedType", [["types", list("TypeNode")]]),
    ConditionalType: node("ConditionalType", "CheckedType", [["checkType", "TypeNode"], ["extendsType", "TypeNode"], ["trueType", "TypeNode"], ["falseType", "TypeNode"]]),
    TypeOperator: node("TypeOperator", "CheckedType", [["operator", hirLiteral("KeyOfKeyword", "ReadonlyKeyword", "UniqueKeyword")], ["type", "TypeNode"]]),
    InferType: node("InferType", "CheckedType", [["typeParameter", "TypeParameter"]]),
    ArrayType: node("ArrayType", "CheckedType", [["elementType", "TypeNode"]]),
    IndexedAccessType: node("IndexedAccessType", "CheckedType", [["objectType", "TypeNode"], ["indexType", "TypeNode"]]),
    TypeReference: node("TypeReference", "CheckedType", [["typeArguments", hirNullable(list("TypeNode"))], ["typeName", "EntityName"]]),
    ExpressionWithTypeArguments: node("ExpressionWithTypeArguments", "CheckedInstantiation", [["expression", "Expression"], ["typeArguments", hirNullable(list("TypeNode"))]]),
    LiteralType: node("LiteralType", "CheckedType", [["literal", "LiteralTypeChild"]]),
    ThisType: node("ThisType", "CheckedType"),
    TypePredicate: node("TypePredicate", "CheckedType", [["assertsModifier", hirNullable("AssertsKeyword")], ["parameterName", "TypePredicateParameterName"], ["type", annotation]]),
    ImportAttribute: node("ImportAttribute", "CheckedProperty", [["name", "ImportAttributeName"], ["value", "Expression"]]),
    ImportAttributes: node("ImportAttributes", "null", [["token", hirLiteral("WithKeyword", "AssertKeyword")], ["attributes", list("ImportAttribute")], ["multiLine", "boolean"]]),
    TypeQuery: node("TypeQuery", "CheckedType", [["typeArguments", hirNullable(list("TypeNode"))], ["exprName", "EntityName"]]),
    MappedType: node("MappedType", "CheckedType", [["readonlyToken", hirNullable(hirChoice("ReadonlyKeyword", "PlusToken", "MinusToken"))], ["typeParameter", "TypeParameter"], ["nameType", annotation], ["questionToken", hirNullable(hirChoice("QuestionToken", "PlusToken", "MinusToken"))], ["type", annotation], ["members", hirNullable(list("TypeElement"))]]),
    TypeLiteral: node("TypeLiteral", "CheckedType", [["members", list("TypeElement")]]),
    TupleType: node("TupleType", "CheckedType", [["elements", list("TypeNode")]]),
    NamedTupleMember: node("NamedTupleMember", "CheckedType", [["dotDotDotToken", hirNullable("DotDotDotToken")], ["name", "Identifier"], ["questionToken", hirNullable("QuestionToken")], ["type", "TypeNode"]]),
    OptionalType: node("OptionalType", "CheckedType", [["type", "TypeNode"]]),
    RestType: node("RestType", "CheckedType", [["type", "TypeNode"]]),
    ParenthesizedType: node("ParenthesizedType", "CheckedType", [["type", "TypeNode"]]),
    FunctionType: node("FunctionType", "CheckedType", [["modifiers", modifiers], ...callable]),
    ConstructorType: node("ConstructorType", "CheckedType", [["modifiers", modifiers], ...callable]),
    TemplateHead: node("TemplateHead", "null", template),
    TemplateMiddle: node("TemplateMiddle", "null", template),
    TemplateTail: node("TemplateTail", "null", template),
    TemplateLiteralType: node("TemplateLiteralType", "CheckedType", [["head", "TemplateHead"], ["templateSpans", list("TemplateLiteralTypeSpan")]]),
    TemplateLiteralTypeSpan: node("TemplateLiteralTypeSpan", "CheckedType", [["type", "TypeNode"], ["literal", "TemplateMiddleOrTail"]]),
    PartiallyEmittedExpression: node("PartiallyEmittedExpression", "CheckedExpression", [["expression", "Expression"]]),
    JsxElement: node("JsxElement", "CheckedExpression", [["openingElement", "JsxOpeningElement"], ["children", list("JsxChild")], ["closingElement", "JsxClosingElement"]]),
    JsxAttributes: node("JsxAttributes", "CheckedExpression", [["properties", list("JsxAttributeLike")]]),
    JsxNamespacedName: node("JsxNamespacedName", "CheckedExpression", [["namespace", "Identifier"], ["name", "Identifier"]]),
    JsxOpeningElement: node("JsxOpeningElement", "CheckedExpression", [["tagName", "JsxTagNameExpression"], ["typeArguments", hirNullable(list("TypeNode"))], ["attributes", "JsxAttributes"]]),
    JsxSelfClosingElement: node("JsxSelfClosingElement", "CheckedExpression", [["tagName", "JsxTagNameExpression"], ["typeArguments", hirNullable(list("TypeNode"))], ["attributes", "JsxAttributes"]]),
    JsxFragment: node("JsxFragment", "CheckedExpression", [["openingFragment", "JsxOpeningFragment"], ["children", list("JsxChild")], ["closingFragment", "JsxClosingFragment"]]),
    JsxOpeningFragment: node("JsxOpeningFragment", "CheckedExpression"),
    JsxClosingFragment: node("JsxClosingFragment", "CheckedExpression"),
    JsxAttribute: node("JsxAttribute", "null", [["name", "JsxAttributeName"], ["initializer", hirNullable("JsxAttributeValue")]]),
    JsxSpreadAttribute: node("JsxSpreadAttribute", "null", [["expression", "Expression"]]),
    JsxClosingElement: node("JsxClosingElement", "null", [["tagName", "JsxTagNameExpression"]]),
    JsxExpression: node("JsxExpression", "CheckedExpression", [["dotDotDotToken", hirNullable("DotDotDotToken")], ["expression", initializer]]),
    JsxText: node("JsxText", "CheckedExpression", [...literal, ["containsOnlyTriviaWhiteSpaces", "boolean"]]),
    SyntaxList: node("SyntaxList", "null", [["children", hirArray("SyntaxNode")]]),
    JSDoc: node("JSDoc", "null", [["comment", list("JSDocComment")], ["tags", hirNullable(list("JSDocTag"))]]),
    JSDocTypeExpression: node("JSDocTypeExpression", "CheckedType", [["type", "TypeNode"]]),
    JSDocNonNullableType: node("JSDocNonNullableType", "CheckedType", [["type", "TypeNode"]]),
    JSDocNullableType: node("JSDocNullableType", "CheckedType", [["type", "TypeNode"]]),
    JSDocAllType: node("JSDocAllType", "CheckedType"),
    JSDocVariadicType: node("JSDocVariadicType", "CheckedType", [["type", "TypeNode"]]),
    JSDocOptionalType: node("JSDocOptionalType", "CheckedType", [["type", "TypeNode"]]),
    JSDocTypeTag: node("JSDocTypeTag", "null", [...tag, ["typeExpression", "SyntaxNode"]]),
    JSDocUnknownTag: node("JSDocUnknownTag", "null", tag),
    JSDocTemplateTag: node("JSDocTemplateTag", "null", [...tag, ["constraint", "SyntaxNode"], ["typeParameters", list("TypeParameter")]]),
    JSDocReturnTag: node("JSDocReturnTag", "null", [...tag, ["typeExpression", annotation]]),
    JSDocPublicTag: node("JSDocPublicTag", "null", tag),
    JSDocPrivateTag: node("JSDocPrivateTag", "null", tag),
    JSDocProtectedTag: node("JSDocProtectedTag", "null", tag),
    JSDocReadonlyTag: node("JSDocReadonlyTag", "null", tag),
    JSDocOverrideTag: node("JSDocOverrideTag", "null", tag),
    JSDocDeprecatedTag: node("JSDocDeprecatedTag", "null", tag),
    JSDocSeeTag: node("JSDocSeeTag", "null", [...tag, ["nameExpression", "TypeNode"]]),
    JSDocImplementsTag: node("JSDocImplementsTag", "null", [...tag, ["className", "ExpressionWithTypeArguments"]]),
    JSDocAugmentsTag: node("JSDocAugmentsTag", "null", [...tag, ["className", "ExpressionWithTypeArguments"]]),
    JSDocSatisfiesTag: node("JSDocSatisfiesTag", "null", [...tag, ["typeExpression", "TypeNode"]]),
    JSDocThrowsTag: node("JSDocThrowsTag", "null", [...tag, ["typeExpression", annotation]]),
    JSDocThisTag: node("JSDocThisTag", "null", [...tag, ["typeExpression", "TypeNode"]]),
    JSDocImportTag: node("JSDocImportTag", "null", [...tag, ["importClause", hirNullable("ImportClause")], ["moduleSpecifier", "Expression"], ["attributes", hirNullable("ImportAttributes")]]),
    JSDocCallbackTag: node("JSDocCallbackTag", "null", [...tag, ["typeExpression", "TypeNode"], ["name", hirNullable("JSDocFullName")]]),
    JSDocOverloadTag: node("JSDocOverloadTag", "null", [...tag, ["typeExpression", "TypeNode"]]),
    JSDocTypedefTag: node("JSDocTypedefTag", "null", [...tag, ["typeExpression", hirNullable("SyntaxNode")], ["name", hirNullable("JSDocFullName")]]),
    JSDocSignature: node("JSDocSignature", "CheckedType", callable),
    JSDocNameReference: node("JSDocNameReference", "CheckedType", [["name", "EntityName"]]),
    SourceFile: node("SourceFile", "CheckedModule", [["statements", list("Statement")], ["endOfFileToken", "EndOfFile"], ["languageVariant", hirLiteral("Standard", "JSX")], ["scriptKind", hirLiteral("Unknown", "JS", "JSX", "TS", "TSX", "External", "JSON", "Deferred")], ["commentDirectives", hirArray("CommentDirective")], ["pragmas", hirArray("Pragma")], ["checkJsDirective", hirNullable("CheckJsDirective")]]),
    ModuleDeclaration: node("ModuleDeclaration", "CheckedNamespace", [["modifiers", modifiers], ["asteriskToken", hirNullable("AsteriskToken")], ["body", hirNullable("NodeBody")], ["keyword", hirLiteral("ModuleKeyword", "NamespaceKeyword")], ["name", "ModuleName"]]),
    ImportEqualsDeclaration: node("ImportEqualsDeclaration", "CheckedImport", [["modifiers", modifiers], ["isTypeOnly", "boolean"], ["name", "Identifier"], ["moduleReference", "ModuleReference"]]),
    ExportDeclaration: node("ExportDeclaration", "CheckedExport", [["modifiers", modifiers], ["isTypeOnly", "boolean"], ["exportClause", hirNullable("NamedExportBindings")], ["moduleSpecifier", initializer], ["attributes", hirNullable("ImportAttributes")]]),
    ImportType: node("ImportType", "CheckedType", [["typeArguments", hirNullable(list("TypeNode"))], ["isTypeOf", "boolean"], ["argument", "TypeNode"], ["attributes", hirNullable("ImportAttributes")], ["qualifier", hirNullable("EntityName")]]),
    ImportClause: node("ImportClause", "CheckedImport", [["phaseModifier", hirNullable(hirLiteral("TypeKeyword", "DeferKeyword"))], ["name", hirNullable("Identifier")], ["namedBindings", hirNullable("NamedImportBindings")]]),
    ImportSpecifier: node("ImportSpecifier", "CheckedImport", [["isTypeOnly", "boolean"], ["propertyName", hirNullable("ModuleExportName")], ["name", "Identifier"]]),
    JSDocText: node("JSDocText", "null", [["text", hirArray("string")]]),
    JSDocLink: node("JSDocLink", "null", [["text", hirArray("string")], ["name", hirNullable("EntityName")]]),
    JSDocLinkPlain: node("JSDocLinkPlain", "null", [["text", hirArray("string")], ["name", hirNullable("EntityName")]]),
    JSDocLinkCode: node("JSDocLinkCode", "null", [["text", hirArray("string")], ["name", hirNullable("EntityName")]]),
    TypeParameter: node("TypeParameter", "CheckedTypeParameter", [["modifiers", modifiers], ["name", "Identifier"], ["constraint", annotation], ["expression", initializer], ["defaultType", annotation]]),
    SyntheticReferenceExpression: node("SyntheticReferenceExpression", "CheckedExpression", [["expression", "Expression"], ["thisArg", "Expression"]]),
    JSDocTypeLiteral: node("JSDocTypeLiteral", "CheckedType", [["jsDocPropertyTags", hirNullable(hirArray("JSDocTag"))], ["isArrayType", "boolean"]]),
    JSDocParameterTag: node("JSDocParameterTag", "null", [...tag, ["name", "EntityName"], ["isBracketed", "boolean"], ["typeExpression", annotation], ["isNameFirst", "boolean"]]),
    JSDocPropertyTag: node("JSDocPropertyTag", "null", [...tag, ["name", "EntityName"], ["isBracketed", "boolean"], ["typeExpression", annotation], ["isNameFirst", "boolean"]]),
  });

  const keywordExpressions: readonly HirSyntaxName[] = ([
    "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword",
  ]);
  const keywordTypes: readonly HirSyntaxName[] = ([
    "AnyKeyword", "BigIntKeyword", "BooleanKeyword", "IntrinsicKeyword", "NeverKeyword", "NumberKeyword",
    "ObjectKeyword", "StringKeyword", "SymbolKeyword", "UndefinedKeyword", "UnknownKeyword", "VoidKeyword",
  ]);
  const punctuation: readonly HirSyntaxName[] = ([
    "OpenBraceToken", "CloseBraceToken", "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken",
    "DotToken", "DotDotDotToken", "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken",
    "GreaterThanToken", "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken",
    "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken",
    "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken",
    "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken",
    "BarToken", "CaretToken", "ExclamationToken", "TildeToken", "AmpersandAmpersandToken", "BarBarToken", "QuestionToken",
    "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken", "HashToken", "EqualsToken", "PlusEqualsToken",
    "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken",
    "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken",
    "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken", "AmpersandAmpersandEqualsToken",
    "QuestionQuestionEqualsToken", "CaretEqualsToken",
  ]);
  const tokenKeywords: readonly HirSyntaxName[] = ([
    "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword",
    "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword",
    "FinallyKeyword", "ForKeyword", "FunctionKeyword", "IfKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword",
    "ReturnKeyword", "SwitchKeyword", "ThrowKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "WhileKeyword",
    "WithKeyword", "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword",
    "ProtectedKeyword", "PublicKeyword", "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword",
    "AssertsKeyword", "AssertKeyword", "AsyncKeyword", "AwaitKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword",
    "ImmediateKeyword", "InferKeyword", "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "OutKeyword",
    "ReadonlyKeyword", "RequireKeyword", "SatisfiesKeyword", "SetKeyword", "TypeKeyword", "UniqueKeyword", "UsingKeyword",
    "FromKeyword", "GlobalKeyword", "OverrideKeyword", "OfKeyword", "DeferKeyword",
  ]);
  const plainTokens: readonly HirSyntaxName[] = ([
    "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia",
    "ConflictMarkerTrivia", "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "JSDocCommentTextToken",
    ...punctuation, ...tokenKeywords,
  ]);
  const expressions: readonly HirShape[] = ([
    "Identifier", "PrivateIdentifier", "ClassExpression", "OmittedExpression", "KeywordExpression", "StringLiteral",
    "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression",
    "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression",
    "AsExpression", "SatisfiesExpression", "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression",
    "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "SpreadElement", "TemplateExpression",
    "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression",
    "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", "TypeAssertionExpression",
    "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxNamespacedName",
    "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment",
    "JsxExpression", "JsxText", "SyntheticReferenceExpression",
  ]);

  const syntaxAliases = ({
    Unknown: node("Unknown", "null"),
    EndOfFile: node("EndOfFile", "null"),
    SingleLineCommentTrivia: node("SingleLineCommentTrivia", "null"),
    MultiLineCommentTrivia: node("MultiLineCommentTrivia", "null"),
    NewLineTrivia: node("NewLineTrivia", "null"),
    WhitespaceTrivia: node("WhitespaceTrivia", "null"),
    ConflictMarkerTrivia: node("ConflictMarkerTrivia", "null"),
    NonTextFileMarkerTrivia: node("NonTextFileMarkerTrivia", "null"),
    JsxTextAllWhiteSpaces: node("JsxTextAllWhiteSpaces", "null"),
    OpenBraceToken: node("OpenBraceToken", "null"),
    CloseBraceToken: node("CloseBraceToken", "null"),
    OpenParenToken: node("OpenParenToken", "null"),
    CloseParenToken: node("CloseParenToken", "null"),
    OpenBracketToken: node("OpenBracketToken", "null"),
    CloseBracketToken: node("CloseBracketToken", "null"),
    DotToken: node("DotToken", "null"),
    DotDotDotToken: node("DotDotDotToken", "null"),
    SemicolonToken: node("SemicolonToken", "null"),
    CommaToken: node("CommaToken", "null"),
    QuestionDotToken: node("QuestionDotToken", "null"),
    LessThanToken: node("LessThanToken", "null"),
    LessThanSlashToken: node("LessThanSlashToken", "null"),
    GreaterThanToken: node("GreaterThanToken", "null"),
    LessThanEqualsToken: node("LessThanEqualsToken", "null"),
    GreaterThanEqualsToken: node("GreaterThanEqualsToken", "null"),
    EqualsEqualsToken: node("EqualsEqualsToken", "null"),
    ExclamationEqualsToken: node("ExclamationEqualsToken", "null"),
    EqualsEqualsEqualsToken: node("EqualsEqualsEqualsToken", "null"),
    ExclamationEqualsEqualsToken: node("ExclamationEqualsEqualsToken", "null"),
    EqualsGreaterThanToken: node("EqualsGreaterThanToken", "null"),
    PlusToken: node("PlusToken", "null"),
    MinusToken: node("MinusToken", "null"),
    AsteriskToken: node("AsteriskToken", "null"),
    AsteriskAsteriskToken: node("AsteriskAsteriskToken", "null"),
    SlashToken: node("SlashToken", "null"),
    PercentToken: node("PercentToken", "null"),
    PlusPlusToken: node("PlusPlusToken", "null"),
    MinusMinusToken: node("MinusMinusToken", "null"),
    LessThanLessThanToken: node("LessThanLessThanToken", "null"),
    GreaterThanGreaterThanToken: node("GreaterThanGreaterThanToken", "null"),
    GreaterThanGreaterThanGreaterThanToken: node("GreaterThanGreaterThanGreaterThanToken", "null"),
    AmpersandToken: node("AmpersandToken", "null"),
    BarToken: node("BarToken", "null"),
    CaretToken: node("CaretToken", "null"),
    ExclamationToken: node("ExclamationToken", "null"),
    TildeToken: node("TildeToken", "null"),
    AmpersandAmpersandToken: node("AmpersandAmpersandToken", "null"),
    BarBarToken: node("BarBarToken", "null"),
    QuestionToken: node("QuestionToken", "null"),
    ColonToken: node("ColonToken", "null"),
    AtToken: node("AtToken", "null"),
    QuestionQuestionToken: node("QuestionQuestionToken", "null"),
    BacktickToken: node("BacktickToken", "null"),
    HashToken: node("HashToken", "null"),
    EqualsToken: node("EqualsToken", "null"),
    PlusEqualsToken: node("PlusEqualsToken", "null"),
    MinusEqualsToken: node("MinusEqualsToken", "null"),
    AsteriskEqualsToken: node("AsteriskEqualsToken", "null"),
    AsteriskAsteriskEqualsToken: node("AsteriskAsteriskEqualsToken", "null"),
    SlashEqualsToken: node("SlashEqualsToken", "null"),
    PercentEqualsToken: node("PercentEqualsToken", "null"),
    LessThanLessThanEqualsToken: node("LessThanLessThanEqualsToken", "null"),
    GreaterThanGreaterThanEqualsToken: node("GreaterThanGreaterThanEqualsToken", "null"),
    GreaterThanGreaterThanGreaterThanEqualsToken: node("GreaterThanGreaterThanGreaterThanEqualsToken", "null"),
    AmpersandEqualsToken: node("AmpersandEqualsToken", "null"),
    BarEqualsToken: node("BarEqualsToken", "null"),
    BarBarEqualsToken: node("BarBarEqualsToken", "null"),
    AmpersandAmpersandEqualsToken: node("AmpersandAmpersandEqualsToken", "null"),
    QuestionQuestionEqualsToken: node("QuestionQuestionEqualsToken", "null"),
    CaretEqualsToken: node("CaretEqualsToken", "null"),
    JSDocCommentTextToken: node("JSDocCommentTextToken", "null"),
    BreakKeyword: node("BreakKeyword", "null"),
    CaseKeyword: node("CaseKeyword", "null"),
    CatchKeyword: node("CatchKeyword", "null"),
    ClassKeyword: node("ClassKeyword", "null"),
    ConstKeyword: node("ConstKeyword", "null"),
    ContinueKeyword: node("ContinueKeyword", "null"),
    DebuggerKeyword: node("DebuggerKeyword", "null"),
    DefaultKeyword: node("DefaultKeyword", "null"),
    DeleteKeyword: node("DeleteKeyword", "null"),
    DoKeyword: node("DoKeyword", "null"),
    ElseKeyword: node("ElseKeyword", "null"),
    EnumKeyword: node("EnumKeyword", "null"),
    ExportKeyword: node("ExportKeyword", "null"),
    ExtendsKeyword: node("ExtendsKeyword", "null"),
    FinallyKeyword: node("FinallyKeyword", "null"),
    ForKeyword: node("ForKeyword", "null"),
    FunctionKeyword: node("FunctionKeyword", "null"),
    IfKeyword: node("IfKeyword", "null"),
    InKeyword: node("InKeyword", "null"),
    InstanceOfKeyword: node("InstanceOfKeyword", "null"),
    NewKeyword: node("NewKeyword", "null"),
    ReturnKeyword: node("ReturnKeyword", "null"),
    SwitchKeyword: node("SwitchKeyword", "null"),
    ThrowKeyword: node("ThrowKeyword", "null"),
    TryKeyword: node("TryKeyword", "null"),
    TypeOfKeyword: node("TypeOfKeyword", "null"),
    VarKeyword: node("VarKeyword", "null"),
    WhileKeyword: node("WhileKeyword", "null"),
    WithKeyword: node("WithKeyword", "null"),
    ImplementsKeyword: node("ImplementsKeyword", "null"),
    InterfaceKeyword: node("InterfaceKeyword", "null"),
    LetKeyword: node("LetKeyword", "null"),
    PackageKeyword: node("PackageKeyword", "null"),
    PrivateKeyword: node("PrivateKeyword", "null"),
    ProtectedKeyword: node("ProtectedKeyword", "null"),
    PublicKeyword: node("PublicKeyword", "null"),
    StaticKeyword: node("StaticKeyword", "null"),
    YieldKeyword: node("YieldKeyword", "null"),
    AbstractKeyword: node("AbstractKeyword", "null"),
    AccessorKeyword: node("AccessorKeyword", "null"),
    AsKeyword: node("AsKeyword", "null"),
    AssertsKeyword: node("AssertsKeyword", "null"),
    AssertKeyword: node("AssertKeyword", "null"),
    AsyncKeyword: node("AsyncKeyword", "null"),
    AwaitKeyword: node("AwaitKeyword", "null"),
    ConstructorKeyword: node("ConstructorKeyword", "null"),
    DeclareKeyword: node("DeclareKeyword", "null"),
    GetKeyword: node("GetKeyword", "null"),
    ImmediateKeyword: node("ImmediateKeyword", "null"),
    InferKeyword: node("InferKeyword", "null"),
    IsKeyword: node("IsKeyword", "null"),
    KeyOfKeyword: node("KeyOfKeyword", "null"),
    ModuleKeyword: node("ModuleKeyword", "null"),
    NamespaceKeyword: node("NamespaceKeyword", "null"),
    OutKeyword: node("OutKeyword", "null"),
    ReadonlyKeyword: node("ReadonlyKeyword", "null"),
    RequireKeyword: node("RequireKeyword", "null"),
    SatisfiesKeyword: node("SatisfiesKeyword", "null"),
    SetKeyword: node("SetKeyword", "null"),
    TypeKeyword: node("TypeKeyword", "null"),
    UniqueKeyword: node("UniqueKeyword", "null"),
    UsingKeyword: node("UsingKeyword", "null"),
    FromKeyword: node("FromKeyword", "null"),
    GlobalKeyword: node("GlobalKeyword", "null"),
    OverrideKeyword: node("OverrideKeyword", "null"),
    OfKeyword: node("OfKeyword", "null"),
    DeferKeyword: node("DeferKeyword", "null"),
    NullKeyword: node("NullKeyword", "CheckedKeyword"),
    TrueKeyword: node("TrueKeyword", "CheckedKeyword"),
    FalseKeyword: node("FalseKeyword", "CheckedKeyword"),
    ThisKeyword: node("ThisKeyword", "CheckedKeyword"),
    SuperKeyword: node("SuperKeyword", "CheckedKeyword"),
    ImportKeyword: node("ImportKeyword", "CheckedKeyword"),
    AnyKeyword: node("AnyKeyword", "CheckedType"),
    BigIntKeyword: node("BigIntKeyword", "CheckedType"),
    BooleanKeyword: node("BooleanKeyword", "CheckedType"),
    IntrinsicKeyword: node("IntrinsicKeyword", "CheckedType"),
    NeverKeyword: node("NeverKeyword", "CheckedType"),
    NumberKeyword: node("NumberKeyword", "CheckedType"),
    ObjectKeyword: node("ObjectKeyword", "CheckedType"),
    StringKeyword: node("StringKeyword", "CheckedType"),
    SymbolKeyword: node("SymbolKeyword", "CheckedType"),
    UndefinedKeyword: node("UndefinedKeyword", "CheckedType"),
    UnknownKeyword: node("UnknownKeyword", "CheckedType"),
    VoidKeyword: node("VoidKeyword", "CheckedType"),
    Token: hirChoice(...plainTokens),
    KeywordExpression: hirChoice(...keywordExpressions),
    KeywordTypeNode: hirChoice(...keywordTypes),
    Expression: hirChoice(...expressions),
    Statement: hirChoice("EmptyStatement", "IfStatement", "DoStatement", "WhileStatement", "ForStatement",
      "ForInStatement", "ForOfStatement", "BreakStatement", "ContinueStatement", "ReturnStatement", "WithStatement",
      "SwitchStatement", "ThrowStatement", "TryStatement", "DebuggerStatement", "LabeledStatement", "ExpressionStatement",
      "Block", "VariableStatement", "MissingDeclaration", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration",
      "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumDeclaration", "ModuleBlock", "NotEmittedStatement",
      "ImportDeclaration", "JSImportDeclaration", "ExportAssignment", "NamespaceExportDeclaration", "ModuleDeclaration",
      "ImportEqualsDeclaration", "ExportDeclaration"),
    TypeNode: hirChoice("KeywordTypeNode", "UnionType", "IntersectionType", "ConditionalType", "TypeOperator", "InferType",
      "ArrayType", "IndexedAccessType", "TypeReference", "LiteralType", "ThisType", "TypePredicate", "TypeQuery", "MappedType",
      "TypeLiteral", "TupleType", "NamedTupleMember", "OptionalType", "RestType", "ParenthesizedType", "FunctionType",
      "ConstructorType", "TemplateLiteralType", "TemplateLiteralTypeSpan", "JSDocTypeExpression", "JSDocNonNullableType",
      "JSDocNullableType", "JSDocAllType", "JSDocVariadicType", "JSDocOptionalType", "JSDocSignature", "JSDocNameReference",
      "ImportType", "JSDocTypeLiteral"),
    BlockOrExpression: hirChoice("Block", "Expression"),
    BodyRoot: hirChoice("SourceFile", "Block", "Expression"),
    NodeBody: hirChoice("Block", "Expression", "ModuleBlock", "ModuleDeclaration"),
    ForInitializer: hirChoice("Expression", "MissingDeclaration", "VariableDeclarationList"),
    CaseOrDefaultClause: hirChoice("CaseClause", "DefaultClause"),
    BindingPattern: hirChoice("ObjectBindingPattern", "ArrayBindingPattern"),
    BindingName: hirChoice("Identifier", "BindingPattern"),
    PropertyName: hirChoice("Identifier", "StringLiteral", "NoSubstitutionTemplateLiteral", "NumericLiteral",
      "ComputedPropertyName", "PrivateIdentifier", "BigIntLiteral"),
    EntityName: hirChoice("Identifier", "QualifiedName"),
    MemberName: hirChoice("Identifier", "PrivateIdentifier"),
    ModuleName: hirChoice("Identifier", "StringLiteral"),
    ModuleExportName: hirChoice("Identifier", "StringLiteral"),
    JSDocFullName: hirChoice("Identifier", "ModuleDeclaration"),
    ModuleReference: hirChoice("Identifier", "QualifiedName", "ExternalModuleReference"),
    NamedImportBindings: hirChoice("NamespaceImport", "NamedImports"),
    NamedExportBindings: hirChoice("NamespaceExport", "NamedExports"),
    ModifierList: hirRecord("ModifierList", [["loc", "TextRange"], ["nodes", hirArray(hirChoice("AbstractKeyword",
      "AccessorKeyword", "AsyncKeyword", "ConstKeyword", "DeclareKeyword", "DefaultKeyword", "ExportKeyword", "InKeyword",
      "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "ReadonlyKeyword", "OutKeyword", "OverrideKeyword", "StaticKeyword", "Decorator"))]]),
    ClassElement: hirChoice("Constructor", "GetAccessor", "SetAccessor", "IndexSignature", "MethodDeclaration",
      "PropertyDeclaration", "SemicolonClassElement", "ClassStaticBlockDeclaration"),
    TypeElement: hirChoice("NotEmittedTypeElement", "CallSignature", "ConstructSignature", "GetAccessor", "SetAccessor",
      "IndexSignature", "MethodSignature", "PropertySignature"),
    ObjectLiteralElementLike: hirChoice("GetAccessor", "SetAccessor", "MethodDeclaration", "SpreadAssignment",
      "PropertyAssignment", "ShorthandPropertyAssignment"),
    LeftHandSideExpression: hirChoice("Identifier", "PrivateIdentifier", "ClassExpression", "StringLiteral", "NumericLiteral",
      "BigIntLiteral", "RegularExpressionLiteral", "FunctionExpression", "PropertyAccessExpression", "ElementAccessExpression",
      "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "TemplateExpression", "TaggedTemplateExpression",
      "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", "ExpressionWithTypeArguments",
      "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxSelfClosingElement", "JsxFragment"),
    LiteralTypeChild: hirChoice("StringLiteral", "NumericLiteral", "BigIntLiteral", "NoSubstitutionTemplateLiteral",
      "TrueKeyword", "FalseKeyword", "NullKeyword", "PrefixUnaryExpression"),
    BinaryOperatorToken: hirChoice("QuestionQuestionToken", "AsteriskAsteriskToken", "AsteriskToken", "SlashToken",
      "PercentToken", "PlusToken", "MinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken",
      "GreaterThanGreaterThanGreaterThanToken", "LessThanToken", "LessThanEqualsToken", "GreaterThanToken",
      "GreaterThanEqualsToken", "InstanceOfKeyword", "InKeyword", "EqualsEqualsToken", "EqualsEqualsEqualsToken",
      "ExclamationEqualsEqualsToken", "ExclamationEqualsToken", "AmpersandToken", "BarToken", "CaretToken",
      "AmpersandAmpersandToken", "BarBarToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskAsteriskEqualsToken",
      "AsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "CaretEqualsToken",
      "LessThanLessThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanEqualsToken",
      "BarBarEqualsToken", "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CommaToken"),
    TemplateMiddleOrTail: hirChoice("TemplateMiddle", "TemplateTail"),
    TemplateLiteral: hirChoice("TemplateExpression", "NoSubstitutionTemplateLiteral"),
    TypePredicateParameterName: hirChoice("Identifier", "ThisType"),
    ImportAttributeName: hirChoice("Identifier", "StringLiteral"),
    JsxChild: hirChoice("JsxText", "JsxExpression", "JsxElement", "JsxSelfClosingElement", "JsxFragment"),
    JsxAttributeLike: hirChoice("JsxAttribute", "JsxSpreadAttribute"),
    JsxAttributeName: hirChoice("Identifier", "JsxNamespacedName"),
    JsxAttributeValue: hirChoice("StringLiteral", "JsxExpression", "JsxElement", "JsxSelfClosingElement", "JsxFragment"),
    JsxTagNameExpression: hirChoice("Identifier", "KeywordExpression", "PropertyAccessExpression", "JsxNamespacedName"),
    JSDocComment: hirChoice("JSDocText", "JSDocLink", "JSDocLinkCode", "JSDocLinkPlain"),
    JSDocTag: hirChoice("JSDocTypeTag", "JSDocUnknownTag", "JSDocTemplateTag", "JSDocReturnTag", "JSDocPublicTag",
      "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag", "JSDocSeeTag",
      "JSDocImplementsTag", "JSDocAugmentsTag", "JSDocSatisfiesTag", "JSDocThrowsTag", "JSDocThisTag", "JSDocImportTag",
      "JSDocCallbackTag", "JSDocOverloadTag", "JSDocTypedefTag", "JSDocParameterTag", "JSDocPropertyTag"),
    SyntaxFlag: hirLiteral("Let", "Const", "Using", "OptionalChain", "DisallowInContext", "YieldContext", "DecoratorContext",
      "AwaitContext", "DisallowConditionalTypesContext", "ThisNodeHasError", "JavaScriptFile", "ThisNodeOrAnySubNodesHasError",
      "HasJSDoc", "JSDoc", "Ambient", "InWithStatement", "JsonFile", "IdentifierHasExtendedUnicodeEscape",
      "IdentifierIsInJSDocNamespace", "NestedNamespace", "AwaitUsing"),
    TokenFlag: hirLiteral("PrecedingLineBreak", "PrecedingJSDocComment", "Unterminated", "ExtendedUnicodeEscape", "Scientific",
      "Octal", "HexSpecifier", "BinarySpecifier", "OctalSpecifier", "ContainsSeparator", "UnicodeEscape", "ContainsInvalidEscape",
      "HexEscape", "ContainsLeadingZero", "ContainsInvalidSeparator", "PrecedingJSDocLeadingAsterisks", "SingleQuote",
      "PrecedingJSDocWithDeprecated", "PrecedingJSDocWithSeeOrLink"),
  });
  return ({ ...syntaxAliases, ...syntaxShapes });
}

export type HirShapeLeaf = "string" | "number" | "bigint" | "boolean" | "null" | "SyntaxNode"
  | HirIdentityShape | HirHostCodeShape | HirLiteralShape | HirArrayShape | HirRecordShape | HirDictionaryShape;

interface PendingShape { readonly shape: HirShape; readonly next: PendingShape | null }

export function hirShapeLeaves(input: HirShape, schema: HirSchema): readonly HirShapeLeaf[] {
  const leaves: HirShapeLeaf[] = [];
  let pending: PendingShape | null = { shape: input, next: null };
  while (pending !== null) {
    const shape: HirShape = pending.shape;
    pending = pending.next;
    if (typeof shape === "string") {
      if (shape === "string" || shape === "number" || shape === "bigint" || shape === "boolean" ||
        shape === "null" || shape === "SyntaxNode") leaves.push(shape);
      else pending = { shape: schema[shape], next: pending };
    } else if (shape.kind === "choice") {
      pending = shape.alternatives.reduceRight<PendingShape | null>((next, alternative) => ({
        shape: alternative, next,
      }), pending);
    } else leaves.push(shape);
  }
  return (leaves);
}

function isHirSyntaxKind(name: string): name is HirSyntaxName {
  switch (name) {
    case "AbstractKeyword":
    case "AccessorKeyword":
    case "AmpersandAmpersandEqualsToken":
    case "AmpersandAmpersandToken":
    case "AmpersandEqualsToken":
    case "AmpersandToken":
    case "AnyKeyword":
    case "ArrayBindingPattern":
    case "ArrayLiteralExpression":
    case "ArrayType":
    case "ArrowFunction":
    case "AsExpression":
    case "AsKeyword":
    case "AssertKeyword":
    case "AssertsKeyword":
    case "AsteriskAsteriskEqualsToken":
    case "AsteriskAsteriskToken":
    case "AsteriskEqualsToken":
    case "AsteriskToken":
    case "AsyncKeyword":
    case "AtToken":
    case "AwaitExpression":
    case "AwaitKeyword":
    case "BacktickToken":
    case "BarBarEqualsToken":
    case "BarBarToken":
    case "BarEqualsToken":
    case "BarToken":
    case "BigIntKeyword":
    case "BigIntLiteral":
    case "BinaryExpression":
    case "BindingElement":
    case "Block":
    case "BooleanKeyword":
    case "BreakKeyword":
    case "BreakStatement":
    case "CallExpression":
    case "CallSignature":
    case "CaretEqualsToken":
    case "CaretToken":
    case "CaseBlock":
    case "CaseClause":
    case "CaseKeyword":
    case "CatchClause":
    case "CatchKeyword":
    case "ClassDeclaration":
    case "ClassExpression":
    case "ClassKeyword":
    case "ClassStaticBlockDeclaration":
    case "CloseBraceToken":
    case "CloseBracketToken":
    case "CloseParenToken":
    case "ColonToken":
    case "CommaToken":
    case "ComputedPropertyName":
    case "ConditionalExpression":
    case "ConditionalType":
    case "ConflictMarkerTrivia":
    case "ConstKeyword":
    case "ConstructSignature":
    case "Constructor":
    case "ConstructorKeyword":
    case "ConstructorType":
    case "ContinueKeyword":
    case "ContinueStatement":
    case "DebuggerKeyword":
    case "DebuggerStatement":
    case "DeclareKeyword":
    case "Decorator":
    case "DefaultClause":
    case "DefaultKeyword":
    case "DeferKeyword":
    case "DeleteExpression":
    case "DeleteKeyword":
    case "DoKeyword":
    case "DoStatement":
    case "DotDotDotToken":
    case "DotToken":
    case "ElementAccessExpression":
    case "ElseKeyword":
    case "EmptyStatement":
    case "EndOfFile":
    case "EnumDeclaration":
    case "EnumKeyword":
    case "EnumMember":
    case "EqualsEqualsEqualsToken":
    case "EqualsEqualsToken":
    case "EqualsGreaterThanToken":
    case "EqualsToken":
    case "ExclamationEqualsEqualsToken":
    case "ExclamationEqualsToken":
    case "ExclamationToken":
    case "ExportAssignment":
    case "ExportDeclaration":
    case "ExportKeyword":
    case "ExportSpecifier":
    case "ExpressionStatement":
    case "ExpressionWithTypeArguments":
    case "ExtendsKeyword":
    case "ExternalModuleReference":
    case "FalseKeyword":
    case "FinallyKeyword":
    case "ForInStatement":
    case "ForKeyword":
    case "ForOfStatement":
    case "ForStatement":
    case "FromKeyword":
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "FunctionKeyword":
    case "FunctionType":
    case "GetAccessor":
    case "GetKeyword":
    case "GlobalKeyword":
    case "GreaterThanEqualsToken":
    case "GreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanToken":
    case "GreaterThanToken":
    case "HashToken":
    case "HeritageClause":
    case "Identifier":
    case "IfKeyword":
    case "IfStatement":
    case "ImmediateKeyword":
    case "ImplementsKeyword":
    case "ImportAttribute":
    case "ImportAttributes":
    case "ImportClause":
    case "ImportDeclaration":
    case "ImportEqualsDeclaration":
    case "ImportKeyword":
    case "ImportSpecifier":
    case "ImportType":
    case "InKeyword":
    case "IndexSignature":
    case "IndexedAccessType":
    case "InferKeyword":
    case "InferType":
    case "InstanceOfKeyword":
    case "InterfaceDeclaration":
    case "InterfaceKeyword":
    case "IntersectionType":
    case "IntrinsicKeyword":
    case "IsKeyword":
    case "JSDoc":
    case "JSDocAllType":
    case "JSDocAugmentsTag":
    case "JSDocCallbackTag":
    case "JSDocCommentTextToken":
    case "JSDocDeprecatedTag":
    case "JSDocImplementsTag":
    case "JSDocImportTag":
    case "JSDocLink":
    case "JSDocLinkCode":
    case "JSDocLinkPlain":
    case "JSDocNameReference":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocOptionalType":
    case "JSDocOverloadTag":
    case "JSDocOverrideTag":
    case "JSDocParameterTag":
    case "JSDocPrivateTag":
    case "JSDocPropertyTag":
    case "JSDocProtectedTag":
    case "JSDocPublicTag":
    case "JSDocReadonlyTag":
    case "JSDocReturnTag":
    case "JSDocSatisfiesTag":
    case "JSDocSeeTag":
    case "JSDocSignature":
    case "JSDocTemplateTag":
    case "JSDocText":
    case "JSDocThisTag":
    case "JSDocThrowsTag":
    case "JSDocTypeExpression":
    case "JSDocTypeLiteral":
    case "JSDocTypeTag":
    case "JSDocTypedefTag":
    case "JSDocUnknownTag":
    case "JSDocVariadicType":
    case "JSImportDeclaration":
    case "JSTypeAliasDeclaration":
    case "JsxAttribute":
    case "JsxAttributes":
    case "JsxClosingElement":
    case "JsxClosingFragment":
    case "JsxElement":
    case "JsxExpression":
    case "JsxFragment":
    case "JsxNamespacedName":
    case "JsxOpeningElement":
    case "JsxOpeningFragment":
    case "JsxSelfClosingElement":
    case "JsxSpreadAttribute":
    case "JsxText":
    case "JsxTextAllWhiteSpaces":
    case "KeyOfKeyword":
    case "LabeledStatement":
    case "LessThanEqualsToken":
    case "LessThanLessThanEqualsToken":
    case "LessThanLessThanToken":
    case "LessThanSlashToken":
    case "LessThanToken":
    case "LetKeyword":
    case "LiteralType":
    case "MappedType":
    case "MetaProperty":
    case "MethodDeclaration":
    case "MethodSignature":
    case "MinusEqualsToken":
    case "MinusMinusToken":
    case "MinusToken":
    case "MissingDeclaration":
    case "ModuleBlock":
    case "ModuleDeclaration":
    case "ModuleKeyword":
    case "MultiLineCommentTrivia":
    case "NamedExports":
    case "NamedImports":
    case "NamedTupleMember":
    case "NamespaceExport":
    case "NamespaceExportDeclaration":
    case "NamespaceImport":
    case "NamespaceKeyword":
    case "NeverKeyword":
    case "NewExpression":
    case "NewKeyword":
    case "NewLineTrivia":
    case "NoSubstitutionTemplateLiteral":
    case "NonNullExpression":
    case "NonTextFileMarkerTrivia":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "NullKeyword":
    case "NumberKeyword":
    case "NumericLiteral":
    case "ObjectBindingPattern":
    case "ObjectKeyword":
    case "ObjectLiteralExpression":
    case "OfKeyword":
    case "OmittedExpression":
    case "OpenBraceToken":
    case "OpenBracketToken":
    case "OpenParenToken":
    case "OptionalType":
    case "OutKeyword":
    case "OverrideKeyword":
    case "PackageKeyword":
    case "Parameter":
    case "ParenthesizedExpression":
    case "ParenthesizedType":
    case "PartiallyEmittedExpression":
    case "PercentEqualsToken":
    case "PercentToken":
    case "PlusEqualsToken":
    case "PlusPlusToken":
    case "PlusToken":
    case "PostfixUnaryExpression":
    case "PrefixUnaryExpression":
    case "PrivateIdentifier":
    case "PrivateKeyword":
    case "PropertyAccessExpression":
    case "PropertyAssignment":
    case "PropertyDeclaration":
    case "PropertySignature":
    case "ProtectedKeyword":
    case "PublicKeyword":
    case "QualifiedName":
    case "QuestionDotToken":
    case "QuestionQuestionEqualsToken":
    case "QuestionQuestionToken":
    case "QuestionToken":
    case "ReadonlyKeyword":
    case "RegularExpressionLiteral":
    case "RequireKeyword":
    case "RestType":
    case "ReturnKeyword":
    case "ReturnStatement":
    case "SatisfiesExpression":
    case "SatisfiesKeyword":
    case "SemicolonClassElement":
    case "SemicolonToken":
    case "SetAccessor":
    case "SetKeyword":
    case "ShorthandPropertyAssignment":
    case "SingleLineCommentTrivia":
    case "SlashEqualsToken":
    case "SlashToken":
    case "SourceFile":
    case "SpreadAssignment":
    case "SpreadElement":
    case "StaticKeyword":
    case "StringKeyword":
    case "StringLiteral":
    case "SuperKeyword":
    case "SwitchKeyword":
    case "SwitchStatement":
    case "SymbolKeyword":
    case "SyntaxList":
    case "SyntheticReferenceExpression":
    case "TaggedTemplateExpression":
    case "TemplateExpression":
    case "TemplateHead":
    case "TemplateLiteralType":
    case "TemplateLiteralTypeSpan":
    case "TemplateMiddle":
    case "TemplateSpan":
    case "TemplateTail":
    case "ThisKeyword":
    case "ThisType":
    case "ThrowKeyword":
    case "ThrowStatement":
    case "TildeToken":
    case "TrueKeyword":
    case "TryKeyword":
    case "TryStatement":
    case "TupleType":
    case "TypeAliasDeclaration":
    case "TypeAssertionExpression":
    case "TypeKeyword":
    case "TypeLiteral":
    case "TypeOfExpression":
    case "TypeOfKeyword":
    case "TypeOperator":
    case "TypeParameter":
    case "TypePredicate":
    case "TypeQuery":
    case "TypeReference":
    case "UndefinedKeyword":
    case "UnionType":
    case "UniqueKeyword":
    case "Unknown":
    case "UnknownKeyword":
    case "UsingKeyword":
    case "VarKeyword":
    case "VariableDeclaration":
    case "VariableDeclarationList":
    case "VariableStatement":
    case "VoidExpression":
    case "VoidKeyword":
    case "WhileKeyword":
    case "WhileStatement":
    case "WhitespaceTrivia":
    case "WithKeyword":
    case "WithStatement":
    case "YieldExpression":
    case "YieldKeyword":
      return true;
    default: return false;
  }
}

export function hirRecordChoices(input: HirShape, label: string, schema: HirSchema): readonly (HirRecordShape | HirDictionaryShape)[] {
  const choices: (HirRecordShape | HirDictionaryShape)[] = [];
  for (const shape of hirShapeLeaves(input, schema)) {
    if (shape === "SyntaxNode") {
      if (isHirSyntaxKind(label)) {
        const selected = schema[label];
        if (selected.kind === "record" && selected.syntax) choices.push(selected);
      }
    } else if (typeof shape !== "string" && (shape.kind === "record" || shape.kind === "dictionary") && shape.label === label) {
      choices.push(shape);
    }
  }
  return (choices);
}

export interface HirDataRoot {
  readonly work: HirDataWork;
  readonly site: HirSite;
  readonly node: HirNode | null;
  readonly body: HirBody | null;
}

export interface HirDataVisit extends HirDataRoot, HirFieldVisit {}

export function walkHirData(root: HirDataRoot, visit: (data: HirDataVisit) => void): void {
  walkHirFields(root.work, data => { visit({ ...root, ...data }); });
}
