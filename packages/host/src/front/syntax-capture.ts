// The checker's syntax tree as HIR's syntax phase: one case per HIR syntax kind, with the fields HIR declares, in
// HIR's own child order (ir-hir/children.ts), so that node identities are the module's preorder positions.
// Written with the help of a one-off script from the HIR contract; edited and reviewed as ordinary source.
import type * as Hir from "../ir-hir/contract.js";
import type { NodeId } from "../ids/contract.js";
import type { SdkNodeList, SyntaxCaptureContext, SyntaxNodeOf } from "./syntax-support.js";
import { attributesToken, checkJsDirective, commentDirectives, defect, headerOf, heritageToken, jsDocText, languageVariant, metaKeyword, moduleKeyword, phaseModifier, postfixOperator, pragmas, prefixOperator, rangeOf, scriptKind, tokenFlags, typeOperator } from "./syntax-support.js";

type Guard<T extends Hir.SyntaxNode<Hir.SyntaxPhase>> = (node: Hir.SyntaxNode<Hir.SyntaxPhase>) => node is T;

function one<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T {
  if (child === undefined) return defect("the checker's tree lacks a child that HIR's schema requires");
  const node = captureNode(context, child, parent);
  return guard(node) ? node : defect(`a ${node.kind} node stands where HIR's schema does not admit it`);
}

function oneOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, child: SyntaxNodeOf | undefined, parent: NodeId, guard: Guard<T>): T | null {
  return child === undefined ? null : one(context, child, parent, guard);
}

function list<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> {
  if (nodes === undefined) return defect("the checker's tree lacks a list that HIR's schema requires");
  return { loc: rangeOf(context, nodes.Loc), nodes: nodes.Nodes.map(child => one(context, child, parent, guard)) };
}

function listOrNull<T extends Hir.SyntaxNode<Hir.SyntaxPhase>>(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<T>): Hir.NodeList<T> | null {
  return nodes === undefined ? null : list(context, nodes, parent, guard);
}

function modifierList(context: SyntaxCaptureContext, nodes: SdkNodeList | undefined, parent: NodeId, guard: Guard<Hir.ModifierLike<Hir.SyntaxPhase>>): Hir.ModifierList<Hir.SyntaxPhase> | null {
  return nodes === undefined ? null : list(context, nodes, parent, guard);
}


const isGroup0Kinds: readonly string[] = ["JSDocAugmentsTag", "JSDocCallbackTag", "JSDocDeprecatedTag", "JSDocImplementsTag", "JSDocImportTag", "JSDocOverloadTag", "JSDocOverrideTag", "JSDocParameterTag", "JSDocPrivateTag", "JSDocPropertyTag", "JSDocProtectedTag", "JSDocPublicTag", "JSDocReadonlyTag", "JSDocReturnTag", "JSDocSatisfiesTag", "JSDocSeeTag", "JSDocTemplateTag", "JSDocThisTag", "JSDocThrowsTag", "JSDocTypeTag", "JSDocTypedefTag", "JSDocUnknownTag"];
function isGroup0(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is | Hir.JSDocTypeTag<Hir.SyntaxPhase>
  | Hir.JSDocUnknownTag<Hir.SyntaxPhase>
  | Hir.JSDocTemplateTag<Hir.SyntaxPhase>
  | Hir.JSDocReturnTag<Hir.SyntaxPhase>
  | Hir.JSDocPublicTag<Hir.SyntaxPhase>
  | Hir.JSDocPrivateTag<Hir.SyntaxPhase>
  | Hir.JSDocProtectedTag<Hir.SyntaxPhase>
  | Hir.JSDocReadonlyTag<Hir.SyntaxPhase>
  | Hir.JSDocOverrideTag<Hir.SyntaxPhase>
  | Hir.JSDocDeprecatedTag<Hir.SyntaxPhase>
  | Hir.JSDocSeeTag<Hir.SyntaxPhase>
  | Hir.JSDocImplementsTag<Hir.SyntaxPhase>
  | Hir.JSDocAugmentsTag<Hir.SyntaxPhase>
  | Hir.JSDocSatisfiesTag<Hir.SyntaxPhase>
  | Hir.JSDocThrowsTag<Hir.SyntaxPhase>
  | Hir.JSDocThisTag<Hir.SyntaxPhase>
  | Hir.JSDocImportTag<Hir.SyntaxPhase>
  | Hir.JSDocCallbackTag<Hir.SyntaxPhase>
  | Hir.JSDocOverloadTag<Hir.SyntaxPhase>
  | Hir.JSDocTypedefTag<Hir.SyntaxPhase>
  | Hir.JSDocParameterOrPropertyTag<Hir.SyntaxPhase> { return isGroup0Kinds.includes(node.kind); }
const isGroup1Kinds: readonly string[] = ["Identifier", "QualifiedName"];
function isGroup1(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.EntityName<Hir.SyntaxPhase> { return isGroup1Kinds.includes(node.kind); }
const isGroup2Kinds: readonly string[] = ["Identifier"];
function isGroup2(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.Identifier<Hir.SyntaxPhase> { return isGroup2Kinds.includes(node.kind); }
const isGroup3Kinds: readonly string[] = ["ArrayLiteralExpression", "ArrowFunction", "AsExpression", "AwaitExpression", "BigIntLiteral", "BinaryExpression", "CallExpression", "ClassExpression", "ConditionalExpression", "DeleteExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FalseKeyword", "FunctionExpression", "Identifier", "ImportKeyword", "JsxAttributes", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxText", "MetaProperty", "NewExpression", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NullKeyword", "NumericLiteral", "ObjectLiteralExpression", "OmittedExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "SatisfiesExpression", "SpreadElement", "StringLiteral", "SuperKeyword", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "ThisKeyword", "TrueKeyword", "TypeAssertionExpression", "TypeOfExpression", "VoidExpression", "YieldExpression"];
function isGroup3(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.Expression<Hir.SyntaxPhase> { return isGroup3Kinds.includes(node.kind); }
const isGroup4Kinds: readonly string[] = ["ArrayLiteralExpression", "BigIntLiteral", "CallExpression", "ClassExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FunctionExpression", "Identifier", "JsxAttributes", "JsxElement", "JsxFragment", "JsxSelfClosingElement", "MetaProperty", "NewExpression", "NonNullExpression", "NumericLiteral", "ObjectLiteralExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "StringLiteral", "TaggedTemplateExpression", "TemplateExpression"];
function isGroup4(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.LeftHandSideExpression<Hir.SyntaxPhase> { return isGroup4Kinds.includes(node.kind); }
const isGroup5Kinds: readonly string[] = ["Block", "BreakStatement", "ClassDeclaration", "ContinueStatement", "DebuggerStatement", "DoStatement", "EmptyStatement", "EnumDeclaration", "ExportAssignment", "ExportDeclaration", "ExpressionStatement", "ForInStatement", "ForOfStatement", "ForStatement", "FunctionDeclaration", "IfStatement", "ImportDeclaration", "ImportEqualsDeclaration", "InterfaceDeclaration", "JSImportDeclaration", "JSTypeAliasDeclaration", "LabeledStatement", "MissingDeclaration", "ModuleBlock", "ModuleDeclaration", "NamespaceExportDeclaration", "NotEmittedStatement", "ReturnStatement", "SwitchStatement", "ThrowStatement", "TryStatement", "TypeAliasDeclaration", "VariableStatement", "WhileStatement", "WithStatement"];
function isGroup5(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.Statement<Hir.SyntaxPhase> { return isGroup5Kinds.includes(node.kind); }
const isGroup6Kinds: readonly string[] = ["ArrayLiteralExpression", "ArrowFunction", "AsExpression", "AwaitExpression", "BigIntLiteral", "BinaryExpression", "CallExpression", "ClassExpression", "ConditionalExpression", "DeleteExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FalseKeyword", "FunctionExpression", "Identifier", "ImportKeyword", "JsxAttributes", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxText", "MetaProperty", "MissingDeclaration", "NewExpression", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NullKeyword", "NumericLiteral", "ObjectLiteralExpression", "OmittedExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "SatisfiesExpression", "SpreadElement", "StringLiteral", "SuperKeyword", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "ThisKeyword", "TrueKeyword", "TypeAssertionExpression", "TypeOfExpression", "VariableDeclarationList", "VoidExpression", "YieldExpression"];
function isGroup6(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ForInitializer<Hir.SyntaxPhase> { return isGroup6Kinds.includes(node.kind); }
const isGroup7Kinds: readonly string[] = ["AwaitKeyword"];
function isGroup7(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.AwaitKeyword<Hir.SyntaxPhase> { return isGroup7Kinds.includes(node.kind); }
const isGroup8Kinds: readonly string[] = ["CaseBlock"];
function isGroup8(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.CaseBlock<Hir.SyntaxPhase> { return isGroup8Kinds.includes(node.kind); }
const isGroup9Kinds: readonly string[] = ["CaseClause", "DefaultClause"];
function isGroup9(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.CaseOrDefaultClause<Hir.SyntaxPhase> { return isGroup9Kinds.includes(node.kind); }
const isGroup10Kinds: readonly string[] = ["Block"];
function isGroup10(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.Block<Hir.SyntaxPhase> { return isGroup10Kinds.includes(node.kind); }
const isGroup11Kinds: readonly string[] = ["CatchClause"];
function isGroup11(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.CatchClause<Hir.SyntaxPhase> { return isGroup11Kinds.includes(node.kind); }
const isGroup12Kinds: readonly string[] = ["VariableDeclaration"];
function isGroup12(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.VariableDeclaration<Hir.SyntaxPhase> { return isGroup12Kinds.includes(node.kind); }
const isGroup13Kinds: readonly string[] = ["AbstractKeyword", "AccessorKeyword", "AsyncKeyword", "ConstKeyword", "DeclareKeyword", "Decorator", "DefaultKeyword", "ExportKeyword", "InKeyword", "OutKeyword", "OverrideKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "ReadonlyKeyword", "StaticKeyword"];
function isGroup13(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is | Hir.Token<Hir.SyntaxPhase, "AbstractKeyword">
  | Hir.Token<Hir.SyntaxPhase, "AccessorKeyword">
  | Hir.Token<Hir.SyntaxPhase, "AsyncKeyword">
  | Hir.Token<Hir.SyntaxPhase, "ConstKeyword">
  | Hir.Token<Hir.SyntaxPhase, "DeclareKeyword">
  | Hir.Token<Hir.SyntaxPhase, "DefaultKeyword">
  | Hir.Token<Hir.SyntaxPhase, "ExportKeyword">
  | Hir.Token<Hir.SyntaxPhase, "InKeyword">
  | Hir.Token<Hir.SyntaxPhase, "PrivateKeyword">
  | Hir.Token<Hir.SyntaxPhase, "ProtectedKeyword">
  | Hir.Token<Hir.SyntaxPhase, "PublicKeyword">
  | Hir.Token<Hir.SyntaxPhase, "ReadonlyKeyword">
  | Hir.Token<Hir.SyntaxPhase, "OutKeyword">
  | Hir.Token<Hir.SyntaxPhase, "OverrideKeyword">
  | Hir.Token<Hir.SyntaxPhase, "StaticKeyword">
  | Hir.Decorator<Hir.SyntaxPhase> { return isGroup13Kinds.includes(node.kind); }
const isGroup14Kinds: readonly string[] = ["VariableDeclarationList"];
function isGroup14(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.VariableDeclarationList<Hir.SyntaxPhase> { return isGroup14Kinds.includes(node.kind); }
const isGroup15Kinds: readonly string[] = ["ArrayBindingPattern", "Identifier", "ObjectBindingPattern"];
function isGroup15(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.BindingName<Hir.SyntaxPhase> { return isGroup15Kinds.includes(node.kind); }
const isGroup16Kinds: readonly string[] = ["ExclamationToken"];
function isGroup16(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ExclamationToken<Hir.SyntaxPhase> { return isGroup16Kinds.includes(node.kind); }
const isGroup17Kinds: readonly string[] = ["AnyKeyword", "ArrayType", "BigIntKeyword", "BooleanKeyword", "ConditionalType", "ConstructorType", "FunctionType", "ImportType", "IndexedAccessType", "InferType", "IntersectionType", "IntrinsicKeyword", "JSDocAllType", "JSDocNameReference", "JSDocNonNullableType", "JSDocNullableType", "JSDocOptionalType", "JSDocSignature", "JSDocTypeExpression", "JSDocTypeLiteral", "JSDocVariadicType", "LiteralType", "MappedType", "NamedTupleMember", "NeverKeyword", "NumberKeyword", "ObjectKeyword", "OptionalType", "ParenthesizedType", "RestType", "StringKeyword", "SymbolKeyword", "TemplateLiteralType", "TemplateLiteralTypeSpan", "ThisType", "TupleType", "TypeLiteral", "TypeOperator", "TypePredicate", "TypeQuery", "TypeReference", "UndefinedKeyword", "UnionType", "UnknownKeyword", "VoidKeyword"];
function isGroup17(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TypeNode<Hir.SyntaxPhase> { return isGroup17Kinds.includes(node.kind); }
const isGroup18Kinds: readonly string[] = ["BindingElement"];
function isGroup18(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.BindingElement<Hir.SyntaxPhase> { return isGroup18Kinds.includes(node.kind); }
const isGroup19Kinds: readonly string[] = ["DotDotDotToken"];
function isGroup19(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.DotDotDotToken<Hir.SyntaxPhase> { return isGroup19Kinds.includes(node.kind); }
const isGroup20Kinds: readonly string[] = ["QuestionToken"];
function isGroup20(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.QuestionToken<Hir.SyntaxPhase> { return isGroup20Kinds.includes(node.kind); }
const isGroup21Kinds: readonly string[] = ["BigIntLiteral", "ComputedPropertyName", "Identifier", "NoSubstitutionTemplateLiteral", "NumericLiteral", "PrivateIdentifier", "StringLiteral"];
function isGroup21(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.PropertyName<Hir.SyntaxPhase> { return isGroup21Kinds.includes(node.kind); }
const isGroup22Kinds: readonly string[] = ["AsteriskToken"];
function isGroup22(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.AsteriskToken<Hir.SyntaxPhase> { return isGroup22Kinds.includes(node.kind); }
const isGroup23Kinds: readonly string[] = ["TypeParameter"];
function isGroup23(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TypeParameterDeclaration<Hir.SyntaxPhase> { return isGroup23Kinds.includes(node.kind); }
const isGroup24Kinds: readonly string[] = ["Parameter"];
function isGroup24(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ParameterDeclaration<Hir.SyntaxPhase> { return isGroup24Kinds.includes(node.kind); }
const isGroup25Kinds: readonly string[] = ["ArrayLiteralExpression", "ArrowFunction", "AsExpression", "AwaitExpression", "BigIntLiteral", "BinaryExpression", "Block", "CallExpression", "ClassExpression", "ConditionalExpression", "DeleteExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FalseKeyword", "FunctionExpression", "Identifier", "ImportKeyword", "JsxAttributes", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxText", "MetaProperty", "NewExpression", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NullKeyword", "NumericLiteral", "ObjectLiteralExpression", "OmittedExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "SatisfiesExpression", "SpreadElement", "StringLiteral", "SuperKeyword", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "ThisKeyword", "TrueKeyword", "TypeAssertionExpression", "TypeOfExpression", "VoidExpression", "YieldExpression"];
function isGroup25(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.BlockOrExpression<Hir.SyntaxPhase> { return isGroup25Kinds.includes(node.kind); }
const isGroup26Kinds: readonly string[] = ["HeritageClause"];
function isGroup26(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.HeritageClause<Hir.SyntaxPhase> { return isGroup26Kinds.includes(node.kind); }
const isGroup27Kinds: readonly string[] = ["ClassStaticBlockDeclaration", "Constructor", "GetAccessor", "IndexSignature", "MethodDeclaration", "PropertyDeclaration", "SemicolonClassElement", "SetAccessor"];
function isGroup27(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ClassElement<Hir.SyntaxPhase> { return isGroup27Kinds.includes(node.kind); }
const isGroup28Kinds: readonly string[] = ["ExpressionWithTypeArguments"];
function isGroup28(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ExpressionWithTypeArguments<Hir.SyntaxPhase> { return isGroup28Kinds.includes(node.kind); }
const isGroup29Kinds: readonly string[] = ["CallSignature", "ConstructSignature", "GetAccessor", "IndexSignature", "MethodSignature", "NotEmittedTypeElement", "PropertySignature", "SetAccessor"];
function isGroup29(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TypeElement<Hir.SyntaxPhase> { return isGroup29Kinds.includes(node.kind); }
const isGroup30Kinds: readonly string[] = ["ExclamationToken", "QuestionToken"];
function isGroup30(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.QuestionToken<Hir.SyntaxPhase> | Hir.ExclamationToken<Hir.SyntaxPhase> { return isGroup30Kinds.includes(node.kind); }
const isGroup31Kinds: readonly string[] = ["EnumMember"];
function isGroup31(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.EnumMember<Hir.SyntaxPhase> { return isGroup31Kinds.includes(node.kind); }
const isGroup32Kinds: readonly string[] = ["ImportClause"];
function isGroup32(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ImportClause<Hir.SyntaxPhase> { return isGroup32Kinds.includes(node.kind); }
const isGroup33Kinds: readonly string[] = ["ImportAttributes"];
function isGroup33(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ImportAttributes<Hir.SyntaxPhase> { return isGroup33Kinds.includes(node.kind); }
const isGroup34Kinds: readonly string[] = ["ImportSpecifier"];
function isGroup34(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ImportSpecifier<Hir.SyntaxPhase> { return isGroup34Kinds.includes(node.kind); }
const isGroup35Kinds: readonly string[] = ["Identifier", "StringLiteral"];
function isGroup35(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ModuleExportName<Hir.SyntaxPhase> { return isGroup35Kinds.includes(node.kind); }
const isGroup36Kinds: readonly string[] = ["ExportSpecifier"];
function isGroup36(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ExportSpecifier<Hir.SyntaxPhase> { return isGroup36Kinds.includes(node.kind); }
const isGroup37Kinds: readonly string[] = ["AmpersandAmpersandEqualsToken", "AmpersandAmpersandToken", "AmpersandEqualsToken", "AmpersandToken", "AsteriskAsteriskEqualsToken", "AsteriskAsteriskToken", "AsteriskEqualsToken", "AsteriskToken", "BarBarEqualsToken", "BarBarToken", "BarEqualsToken", "BarToken", "CaretEqualsToken", "CaretToken", "CommaToken", "EqualsEqualsEqualsToken", "EqualsEqualsToken", "EqualsToken", "ExclamationEqualsEqualsToken", "ExclamationEqualsToken", "GreaterThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanToken", "GreaterThanGreaterThanToken", "GreaterThanToken", "InKeyword", "InstanceOfKeyword", "LessThanEqualsToken", "LessThanLessThanEqualsToken", "LessThanLessThanToken", "LessThanToken", "MinusEqualsToken", "MinusToken", "PercentEqualsToken", "PercentToken", "PlusEqualsToken", "PlusToken", "QuestionQuestionEqualsToken", "QuestionQuestionToken", "SlashEqualsToken", "SlashToken"];
function isGroup37(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.BinaryOperatorToken<Hir.SyntaxPhase> { return isGroup37Kinds.includes(node.kind); }
const isGroup38Kinds: readonly string[] = ["EqualsGreaterThanToken"];
function isGroup38(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.EqualsGreaterThanToken<Hir.SyntaxPhase> { return isGroup38Kinds.includes(node.kind); }
const isGroup39Kinds: readonly string[] = ["ColonToken"];
function isGroup39(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ColonToken<Hir.SyntaxPhase> { return isGroup39Kinds.includes(node.kind); }
const isGroup40Kinds: readonly string[] = ["QuestionDotToken"];
function isGroup40(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.QuestionDotToken<Hir.SyntaxPhase> { return isGroup40Kinds.includes(node.kind); }
const isGroup41Kinds: readonly string[] = ["Identifier", "PrivateIdentifier"];
function isGroup41(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.MemberName<Hir.SyntaxPhase> { return isGroup41Kinds.includes(node.kind); }
const isGroup42Kinds: readonly string[] = ["TemplateHead"];
function isGroup42(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TemplateHead<Hir.SyntaxPhase> { return isGroup42Kinds.includes(node.kind); }
const isGroup43Kinds: readonly string[] = ["TemplateSpan"];
function isGroup43(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TemplateSpan<Hir.SyntaxPhase> { return isGroup43Kinds.includes(node.kind); }
const isGroup44Kinds: readonly string[] = ["TemplateMiddle", "TemplateTail"];
function isGroup44(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TemplateMiddleOrTail<Hir.SyntaxPhase> { return isGroup44Kinds.includes(node.kind); }
const isGroup45Kinds: readonly string[] = ["NoSubstitutionTemplateLiteral", "TemplateExpression"];
function isGroup45(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TemplateLiteral<Hir.SyntaxPhase> { return isGroup45Kinds.includes(node.kind); }
const isGroup46Kinds: readonly string[] = ["GetAccessor", "MethodDeclaration", "PropertyAssignment", "SetAccessor", "ShorthandPropertyAssignment", "SpreadAssignment"];
function isGroup46(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ObjectLiteralElementLike<Hir.SyntaxPhase> { return isGroup46Kinds.includes(node.kind); }
const isGroup47Kinds: readonly string[] = ["EqualsToken"];
function isGroup47(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.EqualsToken<Hir.SyntaxPhase> { return isGroup47Kinds.includes(node.kind); }
const isGroup48Kinds: readonly string[] = ["BigIntLiteral", "FalseKeyword", "NoSubstitutionTemplateLiteral", "NullKeyword", "NumericLiteral", "PrefixUnaryExpression", "StringLiteral", "TrueKeyword"];
function isGroup48(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.LiteralTypeChild<Hir.SyntaxPhase> { return isGroup48Kinds.includes(node.kind); }
const isGroup49Kinds: readonly string[] = ["AssertsKeyword"];
function isGroup49(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.AssertsKeyword<Hir.SyntaxPhase> { return isGroup49Kinds.includes(node.kind); }
const isGroup50Kinds: readonly string[] = ["Identifier", "ThisType"];
function isGroup50(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TypePredicateParameterName<Hir.SyntaxPhase> { return isGroup50Kinds.includes(node.kind); }
const isGroup51Kinds: readonly string[] = ["ImportAttribute"];
function isGroup51(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ImportAttribute<Hir.SyntaxPhase> { return isGroup51Kinds.includes(node.kind); }
const isGroup52Kinds: readonly string[] = ["MinusToken", "PlusToken", "ReadonlyKeyword"];
function isGroup52(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ReadonlyKeyword<Hir.SyntaxPhase> | Hir.PlusToken<Hir.SyntaxPhase> | Hir.MinusToken<Hir.SyntaxPhase> { return isGroup52Kinds.includes(node.kind); }
const isGroup53Kinds: readonly string[] = ["MinusToken", "PlusToken", "QuestionToken"];
function isGroup53(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.QuestionToken<Hir.SyntaxPhase> | Hir.PlusToken<Hir.SyntaxPhase> | Hir.MinusToken<Hir.SyntaxPhase> { return isGroup53Kinds.includes(node.kind); }
const isGroup54Kinds: readonly string[] = ["TemplateLiteralTypeSpan"];
function isGroup54(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.TemplateLiteralTypeSpan<Hir.SyntaxPhase> { return isGroup54Kinds.includes(node.kind); }
const isGroup55Kinds: readonly string[] = ["JsxOpeningElement"];
function isGroup55(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxOpeningElement<Hir.SyntaxPhase> { return isGroup55Kinds.includes(node.kind); }
const isGroup56Kinds: readonly string[] = ["JsxElement", "JsxExpression", "JsxFragment", "JsxSelfClosingElement", "JsxText"];
function isGroup56(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxChild<Hir.SyntaxPhase> { return isGroup56Kinds.includes(node.kind); }
const isGroup57Kinds: readonly string[] = ["JsxClosingElement"];
function isGroup57(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxClosingElement<Hir.SyntaxPhase> { return isGroup57Kinds.includes(node.kind); }
const isGroup58Kinds: readonly string[] = ["JsxAttribute", "JsxSpreadAttribute"];
function isGroup58(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxAttributeLike<Hir.SyntaxPhase> { return isGroup58Kinds.includes(node.kind); }
const isGroup59Kinds: readonly string[] = ["FalseKeyword", "Identifier", "ImportKeyword", "JsxNamespacedName", "NullKeyword", "PropertyAccessExpression", "SuperKeyword", "ThisKeyword", "TrueKeyword"];
function isGroup59(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxTagNameExpression<Hir.SyntaxPhase> { return isGroup59Kinds.includes(node.kind); }
const isGroup60Kinds: readonly string[] = ["JsxAttributes"];
function isGroup60(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxAttributes<Hir.SyntaxPhase> { return isGroup60Kinds.includes(node.kind); }
const isGroup61Kinds: readonly string[] = ["JsxOpeningFragment"];
function isGroup61(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxOpeningFragment<Hir.SyntaxPhase> { return isGroup61Kinds.includes(node.kind); }
const isGroup62Kinds: readonly string[] = ["JsxClosingFragment"];
function isGroup62(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxClosingFragment<Hir.SyntaxPhase> { return isGroup62Kinds.includes(node.kind); }
const isGroup63Kinds: readonly string[] = ["Identifier", "JsxNamespacedName"];
function isGroup63(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxAttributeName<Hir.SyntaxPhase> { return isGroup63Kinds.includes(node.kind); }
const isGroup64Kinds: readonly string[] = ["JsxElement", "JsxExpression", "JsxFragment", "JsxSelfClosingElement", "StringLiteral"];
function isGroup64(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JsxAttributeValue<Hir.SyntaxPhase> { return isGroup64Kinds.includes(node.kind); }
const isGroup65Kinds: readonly string[] = ["JSDocLink", "JSDocLinkCode", "JSDocLinkPlain", "JSDocText"];
function isGroup65(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JSDocComment<Hir.SyntaxPhase> { return isGroup65Kinds.includes(node.kind); }
const isGroup66Kinds: readonly string[] = ["AbstractKeyword", "AccessorKeyword", "AmpersandAmpersandEqualsToken", "AmpersandAmpersandToken", "AmpersandEqualsToken", "AmpersandToken", "AnyKeyword", "ArrayBindingPattern", "ArrayLiteralExpression", "ArrayType", "ArrowFunction", "AsExpression", "AsKeyword", "AssertKeyword", "AssertsKeyword", "AsteriskAsteriskEqualsToken", "AsteriskAsteriskToken", "AsteriskEqualsToken", "AsteriskToken", "AsyncKeyword", "AtToken", "AwaitExpression", "AwaitKeyword", "BacktickToken", "BarBarEqualsToken", "BarBarToken", "BarEqualsToken", "BarToken", "BigIntKeyword", "BigIntLiteral", "BinaryExpression", "BindingElement", "Block", "BooleanKeyword", "BreakKeyword", "BreakStatement", "CallExpression", "CallSignature", "CaretEqualsToken", "CaretToken", "CaseBlock", "CaseClause", "CaseKeyword", "CatchClause", "CatchKeyword", "ClassDeclaration", "ClassExpression", "ClassKeyword", "ClassStaticBlockDeclaration", "CloseBraceToken", "CloseBracketToken", "CloseParenToken", "ColonToken", "CommaToken", "ComputedPropertyName", "ConditionalExpression", "ConditionalType", "ConflictMarkerTrivia", "ConstKeyword", "ConstructSignature", "Constructor", "ConstructorKeyword", "ConstructorType", "ContinueKeyword", "ContinueStatement", "DebuggerKeyword", "DebuggerStatement", "DeclareKeyword", "Decorator", "DefaultClause", "DefaultKeyword", "DeferKeyword", "DeleteExpression", "DeleteKeyword", "DoKeyword", "DoStatement", "DotDotDotToken", "DotToken", "ElementAccessExpression", "ElseKeyword", "EmptyStatement", "EndOfFile", "EnumDeclaration", "EnumKeyword", "EnumMember", "EqualsEqualsEqualsToken", "EqualsEqualsToken", "EqualsGreaterThanToken", "EqualsToken", "ExclamationEqualsEqualsToken", "ExclamationEqualsToken", "ExclamationToken", "ExportAssignment", "ExportDeclaration", "ExportKeyword", "ExportSpecifier", "ExpressionStatement", "ExpressionWithTypeArguments", "ExtendsKeyword", "ExternalModuleReference", "FalseKeyword", "FinallyKeyword", "ForInStatement", "ForKeyword", "ForOfStatement", "ForStatement", "FromKeyword", "FunctionDeclaration", "FunctionExpression", "FunctionKeyword", "FunctionType", "GetAccessor", "GetKeyword", "GlobalKeyword", "GreaterThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanToken", "GreaterThanGreaterThanToken", "GreaterThanToken", "HashToken", "HeritageClause", "Identifier", "IfKeyword", "IfStatement", "ImmediateKeyword", "ImplementsKeyword", "ImportAttribute", "ImportAttributes", "ImportClause", "ImportDeclaration", "ImportEqualsDeclaration", "ImportKeyword", "ImportSpecifier", "ImportType", "InKeyword", "IndexSignature", "IndexedAccessType", "InferKeyword", "InferType", "InstanceOfKeyword", "InterfaceDeclaration", "InterfaceKeyword", "IntersectionType", "IntrinsicKeyword", "IsKeyword", "JSDoc", "JSDocAllType", "JSDocAugmentsTag", "JSDocCallbackTag", "JSDocCommentTextToken", "JSDocDeprecatedTag", "JSDocImplementsTag", "JSDocImportTag", "JSDocLink", "JSDocLinkCode", "JSDocLinkPlain", "JSDocNameReference", "JSDocNonNullableType", "JSDocNullableType", "JSDocOptionalType", "JSDocOverloadTag", "JSDocOverrideTag", "JSDocParameterTag", "JSDocPrivateTag", "JSDocPropertyTag", "JSDocProtectedTag", "JSDocPublicTag", "JSDocReadonlyTag", "JSDocReturnTag", "JSDocSatisfiesTag", "JSDocSeeTag", "JSDocSignature", "JSDocTemplateTag", "JSDocText", "JSDocThisTag", "JSDocThrowsTag", "JSDocTypeExpression", "JSDocTypeLiteral", "JSDocTypeTag", "JSDocTypedefTag", "JSDocUnknownTag", "JSDocVariadicType", "JSImportDeclaration", "JSTypeAliasDeclaration", "JsxAttribute", "JsxAttributes", "JsxClosingElement", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxSpreadAttribute", "JsxText", "JsxTextAllWhiteSpaces", "KeyOfKeyword", "LabeledStatement", "LessThanEqualsToken", "LessThanLessThanEqualsToken", "LessThanLessThanToken", "LessThanSlashToken", "LessThanToken", "LetKeyword", "LiteralType", "MappedType", "MetaProperty", "MethodDeclaration", "MethodSignature", "MinusEqualsToken", "MinusMinusToken", "MinusToken", "MissingDeclaration", "ModuleBlock", "ModuleDeclaration", "ModuleKeyword", "MultiLineCommentTrivia", "NamedExports", "NamedImports", "NamedTupleMember", "NamespaceExport", "NamespaceExportDeclaration", "NamespaceImport", "NamespaceKeyword", "NeverKeyword", "NewExpression", "NewKeyword", "NewLineTrivia", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NonTextFileMarkerTrivia", "NotEmittedStatement", "NotEmittedTypeElement", "NullKeyword", "NumberKeyword", "NumericLiteral", "ObjectBindingPattern", "ObjectKeyword", "ObjectLiteralExpression", "OfKeyword", "OmittedExpression", "OpenBraceToken", "OpenBracketToken", "OpenParenToken", "OptionalType", "OutKeyword", "OverrideKeyword", "PackageKeyword", "Parameter", "ParenthesizedExpression", "ParenthesizedType", "PartiallyEmittedExpression", "PercentEqualsToken", "PercentToken", "PlusEqualsToken", "PlusPlusToken", "PlusToken", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PrivateKeyword", "PropertyAccessExpression", "PropertyAssignment", "PropertyDeclaration", "PropertySignature", "ProtectedKeyword", "PublicKeyword", "QualifiedName", "QuestionDotToken", "QuestionQuestionEqualsToken", "QuestionQuestionToken", "QuestionToken", "ReadonlyKeyword", "RegularExpressionLiteral", "RequireKeyword", "RestType", "ReturnKeyword", "ReturnStatement", "SatisfiesExpression", "SatisfiesKeyword", "SemicolonClassElement", "SemicolonToken", "SetAccessor", "SetKeyword", "ShorthandPropertyAssignment", "SingleLineCommentTrivia", "SlashEqualsToken", "SlashToken", "SourceFile", "SpreadAssignment", "SpreadElement", "StaticKeyword", "StringKeyword", "StringLiteral", "SuperKeyword", "SwitchKeyword", "SwitchStatement", "SymbolKeyword", "SyntaxList", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "TemplateHead", "TemplateLiteralType", "TemplateLiteralTypeSpan", "TemplateMiddle", "TemplateSpan", "TemplateTail", "ThisKeyword", "ThisType", "ThrowKeyword", "ThrowStatement", "TildeToken", "TrueKeyword", "TryKeyword", "TryStatement", "TupleType", "TypeAliasDeclaration", "TypeAssertionExpression", "TypeKeyword", "TypeLiteral", "TypeOfExpression", "TypeOfKeyword", "TypeOperator", "TypeParameter", "TypePredicate", "TypeQuery", "TypeReference", "UndefinedKeyword", "UnionType", "UniqueKeyword", "Unknown", "UnknownKeyword", "UsingKeyword", "VarKeyword", "VariableDeclaration", "VariableDeclarationList", "VariableStatement", "VoidExpression", "VoidKeyword", "WhileKeyword", "WhileStatement", "WhitespaceTrivia", "WithKeyword", "WithStatement", "YieldExpression", "YieldKeyword"];
function isGroup66(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.SyntaxNode<Hir.SyntaxPhase> { return isGroup66Kinds.includes(node.kind); }
const isGroup67Kinds: readonly string[] = ["Identifier", "ModuleDeclaration"];
function isGroup67(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.JSDocFullName<Hir.SyntaxPhase> { return isGroup67Kinds.includes(node.kind); }
const isGroup68Kinds: readonly string[] = ["EndOfFile"];
function isGroup68(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.EndOfFile<Hir.SyntaxPhase> { return isGroup68Kinds.includes(node.kind); }
const isGroup69Kinds: readonly string[] = ["ArrayLiteralExpression", "ArrowFunction", "AsExpression", "AwaitExpression", "BigIntLiteral", "BinaryExpression", "Block", "CallExpression", "ClassExpression", "ConditionalExpression", "DeleteExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FalseKeyword", "FunctionExpression", "Identifier", "ImportKeyword", "JsxAttributes", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxText", "MetaProperty", "ModuleBlock", "ModuleDeclaration", "NewExpression", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NullKeyword", "NumericLiteral", "ObjectLiteralExpression", "OmittedExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "SatisfiesExpression", "SpreadElement", "StringLiteral", "SuperKeyword", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "ThisKeyword", "TrueKeyword", "TypeAssertionExpression", "TypeOfExpression", "VoidExpression", "YieldExpression"];
function isGroup69(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.NodeBody<Hir.SyntaxPhase> { return isGroup69Kinds.includes(node.kind); }
const isGroup70Kinds: readonly string[] = ["ExternalModuleReference", "Identifier", "QualifiedName"];
function isGroup70(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.ModuleReference<Hir.SyntaxPhase> { return isGroup70Kinds.includes(node.kind); }
const isGroup71Kinds: readonly string[] = ["NamedExports", "NamespaceExport"];
function isGroup71(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.NamedExportBindings<Hir.SyntaxPhase> { return isGroup71Kinds.includes(node.kind); }
const isGroup72Kinds: readonly string[] = ["NamedImports", "NamespaceImport"];
function isGroup72(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.NamedImportBindings<Hir.SyntaxPhase> { return isGroup72Kinds.includes(node.kind); }
/** The kinds of HIR's expression syntax. */
export const expressionKinds: readonly string[] = ["ArrayLiteralExpression", "ArrowFunction", "AsExpression", "AwaitExpression", "BigIntLiteral", "BinaryExpression", "CallExpression", "ClassExpression", "ConditionalExpression", "DeleteExpression", "ElementAccessExpression", "ExpressionWithTypeArguments", "FalseKeyword", "FunctionExpression", "Identifier", "ImportKeyword", "JsxAttributes", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxText", "MetaProperty", "NewExpression", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NullKeyword", "NumericLiteral", "ObjectLiteralExpression", "OmittedExpression", "ParenthesizedExpression", "PartiallyEmittedExpression", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PropertyAccessExpression", "RegularExpressionLiteral", "SatisfiesExpression", "SpreadElement", "StringLiteral", "SuperKeyword", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "ThisKeyword", "TrueKeyword", "TypeAssertionExpression", "TypeOfExpression", "VoidExpression", "YieldExpression"];
function isSyntax(node: Hir.SyntaxNode<Hir.SyntaxPhase>): node is Hir.SyntaxNode<Hir.SyntaxPhase> { return isSyntaxKinds.includes(node.kind); }
const isSyntaxKinds: readonly string[] = ["AbstractKeyword", "AccessorKeyword", "AmpersandAmpersandEqualsToken", "AmpersandAmpersandToken", "AmpersandEqualsToken", "AmpersandToken", "AnyKeyword", "ArrayBindingPattern", "ArrayLiteralExpression", "ArrayType", "ArrowFunction", "AsExpression", "AsKeyword", "AssertKeyword", "AssertsKeyword", "AsteriskAsteriskEqualsToken", "AsteriskAsteriskToken", "AsteriskEqualsToken", "AsteriskToken", "AsyncKeyword", "AtToken", "AwaitExpression", "AwaitKeyword", "BacktickToken", "BarBarEqualsToken", "BarBarToken", "BarEqualsToken", "BarToken", "BigIntKeyword", "BigIntLiteral", "BinaryExpression", "BindingElement", "Block", "BooleanKeyword", "BreakKeyword", "BreakStatement", "CallExpression", "CallSignature", "CaretEqualsToken", "CaretToken", "CaseBlock", "CaseClause", "CaseKeyword", "CatchClause", "CatchKeyword", "ClassDeclaration", "ClassExpression", "ClassKeyword", "ClassStaticBlockDeclaration", "CloseBraceToken", "CloseBracketToken", "CloseParenToken", "ColonToken", "CommaToken", "ComputedPropertyName", "ConditionalExpression", "ConditionalType", "ConflictMarkerTrivia", "ConstKeyword", "ConstructSignature", "Constructor", "ConstructorKeyword", "ConstructorType", "ContinueKeyword", "ContinueStatement", "DebuggerKeyword", "DebuggerStatement", "DeclareKeyword", "Decorator", "DefaultClause", "DefaultKeyword", "DeferKeyword", "DeleteExpression", "DeleteKeyword", "DoKeyword", "DoStatement", "DotDotDotToken", "DotToken", "ElementAccessExpression", "ElseKeyword", "EmptyStatement", "EndOfFile", "EnumDeclaration", "EnumKeyword", "EnumMember", "EqualsEqualsEqualsToken", "EqualsEqualsToken", "EqualsGreaterThanToken", "EqualsToken", "ExclamationEqualsEqualsToken", "ExclamationEqualsToken", "ExclamationToken", "ExportAssignment", "ExportDeclaration", "ExportKeyword", "ExportSpecifier", "ExpressionStatement", "ExpressionWithTypeArguments", "ExtendsKeyword", "ExternalModuleReference", "FalseKeyword", "FinallyKeyword", "ForInStatement", "ForKeyword", "ForOfStatement", "ForStatement", "FromKeyword", "FunctionDeclaration", "FunctionExpression", "FunctionKeyword", "FunctionType", "GetAccessor", "GetKeyword", "GlobalKeyword", "GreaterThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanToken", "GreaterThanGreaterThanToken", "GreaterThanToken", "HashToken", "HeritageClause", "Identifier", "IfKeyword", "IfStatement", "ImmediateKeyword", "ImplementsKeyword", "ImportAttribute", "ImportAttributes", "ImportClause", "ImportDeclaration", "ImportEqualsDeclaration", "ImportKeyword", "ImportSpecifier", "ImportType", "InKeyword", "IndexSignature", "IndexedAccessType", "InferKeyword", "InferType", "InstanceOfKeyword", "InterfaceDeclaration", "InterfaceKeyword", "IntersectionType", "IntrinsicKeyword", "IsKeyword", "JSDoc", "JSDocAllType", "JSDocAugmentsTag", "JSDocCallbackTag", "JSDocCommentTextToken", "JSDocDeprecatedTag", "JSDocImplementsTag", "JSDocImportTag", "JSDocLink", "JSDocLinkCode", "JSDocLinkPlain", "JSDocNameReference", "JSDocNonNullableType", "JSDocNullableType", "JSDocOptionalType", "JSDocOverloadTag", "JSDocOverrideTag", "JSDocParameterTag", "JSDocPrivateTag", "JSDocPropertyTag", "JSDocProtectedTag", "JSDocPublicTag", "JSDocReadonlyTag", "JSDocReturnTag", "JSDocSatisfiesTag", "JSDocSeeTag", "JSDocSignature", "JSDocTemplateTag", "JSDocText", "JSDocThisTag", "JSDocThrowsTag", "JSDocTypeExpression", "JSDocTypeLiteral", "JSDocTypeTag", "JSDocTypedefTag", "JSDocUnknownTag", "JSDocVariadicType", "JSImportDeclaration", "JSTypeAliasDeclaration", "JsxAttribute", "JsxAttributes", "JsxClosingElement", "JsxClosingFragment", "JsxElement", "JsxExpression", "JsxFragment", "JsxNamespacedName", "JsxOpeningElement", "JsxOpeningFragment", "JsxSelfClosingElement", "JsxSpreadAttribute", "JsxText", "JsxTextAllWhiteSpaces", "KeyOfKeyword", "LabeledStatement", "LessThanEqualsToken", "LessThanLessThanEqualsToken", "LessThanLessThanToken", "LessThanSlashToken", "LessThanToken", "LetKeyword", "LiteralType", "MappedType", "MetaProperty", "MethodDeclaration", "MethodSignature", "MinusEqualsToken", "MinusMinusToken", "MinusToken", "MissingDeclaration", "ModuleBlock", "ModuleDeclaration", "ModuleKeyword", "MultiLineCommentTrivia", "NamedExports", "NamedImports", "NamedTupleMember", "NamespaceExport", "NamespaceExportDeclaration", "NamespaceImport", "NamespaceKeyword", "NeverKeyword", "NewExpression", "NewKeyword", "NewLineTrivia", "NoSubstitutionTemplateLiteral", "NonNullExpression", "NonTextFileMarkerTrivia", "NotEmittedStatement", "NotEmittedTypeElement", "NullKeyword", "NumberKeyword", "NumericLiteral", "ObjectBindingPattern", "ObjectKeyword", "ObjectLiteralExpression", "OfKeyword", "OmittedExpression", "OpenBraceToken", "OpenBracketToken", "OpenParenToken", "OptionalType", "OutKeyword", "OverrideKeyword", "PackageKeyword", "Parameter", "ParenthesizedExpression", "ParenthesizedType", "PartiallyEmittedExpression", "PercentEqualsToken", "PercentToken", "PlusEqualsToken", "PlusPlusToken", "PlusToken", "PostfixUnaryExpression", "PrefixUnaryExpression", "PrivateIdentifier", "PrivateKeyword", "PropertyAccessExpression", "PropertyAssignment", "PropertyDeclaration", "PropertySignature", "ProtectedKeyword", "PublicKeyword", "QualifiedName", "QuestionDotToken", "QuestionQuestionEqualsToken", "QuestionQuestionToken", "QuestionToken", "ReadonlyKeyword", "RegularExpressionLiteral", "RequireKeyword", "RestType", "ReturnKeyword", "ReturnStatement", "SatisfiesExpression", "SatisfiesKeyword", "SemicolonClassElement", "SemicolonToken", "SetAccessor", "SetKeyword", "ShorthandPropertyAssignment", "SingleLineCommentTrivia", "SlashEqualsToken", "SlashToken", "SourceFile", "SpreadAssignment", "SpreadElement", "StaticKeyword", "StringKeyword", "StringLiteral", "SuperKeyword", "SwitchKeyword", "SwitchStatement", "SymbolKeyword", "SyntaxList", "SyntheticReferenceExpression", "TaggedTemplateExpression", "TemplateExpression", "TemplateHead", "TemplateLiteralType", "TemplateLiteralTypeSpan", "TemplateMiddle", "TemplateSpan", "TemplateTail", "ThisKeyword", "ThisType", "ThrowKeyword", "ThrowStatement", "TildeToken", "TrueKeyword", "TryKeyword", "TryStatement", "TupleType", "TypeAliasDeclaration", "TypeAssertionExpression", "TypeKeyword", "TypeLiteral", "TypeOfExpression", "TypeOfKeyword", "TypeOperator", "TypeParameter", "TypePredicate", "TypeQuery", "TypeReference", "UndefinedKeyword", "UnionType", "UniqueKeyword", "Unknown", "UnknownKeyword", "UsingKeyword", "VarKeyword", "VariableDeclaration", "VariableDeclarationList", "VariableStatement", "VoidExpression", "VoidKeyword", "WhileKeyword", "WhileStatement", "WhitespaceTrivia", "WithKeyword", "WithStatement", "YieldExpression", "YieldKeyword"];

/** One node of the checker's tree, converted with everything below it; its identity is the next preorder position. */
export function captureNode(context: SyntaxCaptureContext, node: SyntaxNodeOf, parent: NodeId | null): Hir.SyntaxNode<Hir.SyntaxPhase> {
  switch (context.ast.kindName(node)) {
    case "KindAbstractKeyword":
      return { kind: "AbstractKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAccessorKeyword":
      return { kind: "AccessorKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAmpersandAmpersandEqualsToken":
      return { kind: "AmpersandAmpersandEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAmpersandAmpersandToken":
      return { kind: "AmpersandAmpersandToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAmpersandEqualsToken":
      return { kind: "AmpersandEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAmpersandToken":
      return { kind: "AmpersandToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsKeyword":
      return { kind: "AsKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAssertKeyword":
      return { kind: "AssertKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAssertsKeyword":
      return { kind: "AssertsKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsteriskAsteriskEqualsToken":
      return { kind: "AsteriskAsteriskEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsteriskAsteriskToken":
      return { kind: "AsteriskAsteriskToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsteriskEqualsToken":
      return { kind: "AsteriskEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsteriskToken":
      return { kind: "AsteriskToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAsyncKeyword":
      return { kind: "AsyncKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAtToken":
      return { kind: "AtToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindAwaitKeyword":
      return { kind: "AwaitKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBacktickToken":
      return { kind: "BacktickToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBarBarEqualsToken":
      return { kind: "BarBarEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBarBarToken":
      return { kind: "BarBarToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBarEqualsToken":
      return { kind: "BarEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBarToken":
      return { kind: "BarToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBreakKeyword":
      return { kind: "BreakKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCaretEqualsToken":
      return { kind: "CaretEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCaretToken":
      return { kind: "CaretToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCaseKeyword":
      return { kind: "CaseKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCatchKeyword":
      return { kind: "CatchKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindClassKeyword":
      return { kind: "ClassKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCloseBraceToken":
      return { kind: "CloseBraceToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCloseBracketToken":
      return { kind: "CloseBracketToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCloseParenToken":
      return { kind: "CloseParenToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindColonToken":
      return { kind: "ColonToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindCommaToken":
      return { kind: "CommaToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindConflictMarkerTrivia":
      return { kind: "ConflictMarkerTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindConstKeyword":
      return { kind: "ConstKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindConstructorKeyword":
      return { kind: "ConstructorKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindContinueKeyword":
      return { kind: "ContinueKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDebuggerKeyword":
      return { kind: "DebuggerKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDeclareKeyword":
      return { kind: "DeclareKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDefaultKeyword":
      return { kind: "DefaultKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDeferKeyword":
      return { kind: "DeferKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDeleteKeyword":
      return { kind: "DeleteKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDoKeyword":
      return { kind: "DoKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDotDotDotToken":
      return { kind: "DotDotDotToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindDotToken":
      return { kind: "DotToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindElseKeyword":
      return { kind: "ElseKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEndOfFile":
      return { kind: "EndOfFile", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEnumKeyword":
      return { kind: "EnumKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEqualsEqualsEqualsToken":
      return { kind: "EqualsEqualsEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEqualsEqualsToken":
      return { kind: "EqualsEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEqualsGreaterThanToken":
      return { kind: "EqualsGreaterThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindEqualsToken":
      return { kind: "EqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindExclamationEqualsEqualsToken":
      return { kind: "ExclamationEqualsEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindExclamationEqualsToken":
      return { kind: "ExclamationEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindExclamationToken":
      return { kind: "ExclamationToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindExportKeyword":
      return { kind: "ExportKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindExtendsKeyword":
      return { kind: "ExtendsKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindFinallyKeyword":
      return { kind: "FinallyKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindForKeyword":
      return { kind: "ForKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindFromKeyword":
      return { kind: "FromKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindFunctionKeyword":
      return { kind: "FunctionKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGetKeyword":
      return { kind: "GetKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGlobalKeyword":
      return { kind: "GlobalKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanEqualsToken":
      return { kind: "GreaterThanEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanGreaterThanEqualsToken":
      return { kind: "GreaterThanGreaterThanEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanGreaterThanGreaterThanEqualsToken":
      return { kind: "GreaterThanGreaterThanGreaterThanEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanGreaterThanGreaterThanToken":
      return { kind: "GreaterThanGreaterThanGreaterThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanGreaterThanToken":
      return { kind: "GreaterThanGreaterThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindGreaterThanToken":
      return { kind: "GreaterThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindHashToken":
      return { kind: "HashToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindIfKeyword":
      return { kind: "IfKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindImmediateKeyword":
      return { kind: "ImmediateKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindImplementsKeyword":
      return { kind: "ImplementsKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindInKeyword":
      return { kind: "InKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindInferKeyword":
      return { kind: "InferKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindInstanceOfKeyword":
      return { kind: "InstanceOfKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindInterfaceKeyword":
      return { kind: "InterfaceKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindIsKeyword":
      return { kind: "IsKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindJSDocCommentTextToken":
      return { kind: "JSDocCommentTextToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindJsxTextAllWhiteSpaces":
      return { kind: "JsxTextAllWhiteSpaces", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindKeyOfKeyword":
      return { kind: "KeyOfKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLessThanEqualsToken":
      return { kind: "LessThanEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLessThanLessThanEqualsToken":
      return { kind: "LessThanLessThanEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLessThanLessThanToken":
      return { kind: "LessThanLessThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLessThanSlashToken":
      return { kind: "LessThanSlashToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLessThanToken":
      return { kind: "LessThanToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindLetKeyword":
      return { kind: "LetKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindMinusEqualsToken":
      return { kind: "MinusEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindMinusMinusToken":
      return { kind: "MinusMinusToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindMinusToken":
      return { kind: "MinusToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindModuleKeyword":
      return { kind: "ModuleKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindMultiLineCommentTrivia":
      return { kind: "MultiLineCommentTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNamespaceKeyword":
      return { kind: "NamespaceKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNewKeyword":
      return { kind: "NewKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNewLineTrivia":
      return { kind: "NewLineTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNonTextFileMarkerTrivia":
      return { kind: "NonTextFileMarkerTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOfKeyword":
      return { kind: "OfKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOpenBraceToken":
      return { kind: "OpenBraceToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOpenBracketToken":
      return { kind: "OpenBracketToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOpenParenToken":
      return { kind: "OpenParenToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOutKeyword":
      return { kind: "OutKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindOverrideKeyword":
      return { kind: "OverrideKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPackageKeyword":
      return { kind: "PackageKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPercentEqualsToken":
      return { kind: "PercentEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPercentToken":
      return { kind: "PercentToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPlusEqualsToken":
      return { kind: "PlusEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPlusPlusToken":
      return { kind: "PlusPlusToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPlusToken":
      return { kind: "PlusToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPrivateKeyword":
      return { kind: "PrivateKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindProtectedKeyword":
      return { kind: "ProtectedKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindPublicKeyword":
      return { kind: "PublicKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindQuestionDotToken":
      return { kind: "QuestionDotToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindQuestionQuestionEqualsToken":
      return { kind: "QuestionQuestionEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindQuestionQuestionToken":
      return { kind: "QuestionQuestionToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindQuestionToken":
      return { kind: "QuestionToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindReadonlyKeyword":
      return { kind: "ReadonlyKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindRequireKeyword":
      return { kind: "RequireKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindReturnKeyword":
      return { kind: "ReturnKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSatisfiesKeyword":
      return { kind: "SatisfiesKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSemicolonToken":
      return { kind: "SemicolonToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSetKeyword":
      return { kind: "SetKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSingleLineCommentTrivia":
      return { kind: "SingleLineCommentTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSlashEqualsToken":
      return { kind: "SlashEqualsToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSlashToken":
      return { kind: "SlashToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindStaticKeyword":
      return { kind: "StaticKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSwitchKeyword":
      return { kind: "SwitchKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindThrowKeyword":
      return { kind: "ThrowKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindTildeToken":
      return { kind: "TildeToken", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindTryKeyword":
      return { kind: "TryKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindTypeKeyword":
      return { kind: "TypeKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindTypeOfKeyword":
      return { kind: "TypeOfKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUniqueKeyword":
      return { kind: "UniqueKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUnknown":
      return { kind: "Unknown", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUsingKeyword":
      return { kind: "UsingKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindVarKeyword":
      return { kind: "VarKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindWhileKeyword":
      return { kind: "WhileKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindWhitespaceTrivia":
      return { kind: "WhitespaceTrivia", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindWithKeyword":
      return { kind: "WithKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindYieldKeyword":
      return { kind: "YieldKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindIdentifier":
    {
      const view = context.ast.as.AsIdentifier(node);
      if (view === undefined) return defect("the checker gave no Identifier view of a Identifier node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      return { kind: "Identifier", ...header, text: text_, tsonic: null };
    }
    case "KindPrivateIdentifier":
    {
      const view = context.ast.as.AsPrivateIdentifier(node);
      if (view === undefined) return defect("the checker gave no PrivateIdentifier view of a PrivateIdentifier node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      return { kind: "PrivateIdentifier", ...header, text: text_, tsonic: null };
    }
    case "KindQualifiedName":
    {
      const view = context.ast.as.AsQualifiedName(node);
      if (view === undefined) return defect("the checker gave no QualifiedName view of a QualifiedName node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const left_ = one(context, view.Left, id, isGroup1);
      const right_ = one(context, view.Right, id, isGroup2);
      return { kind: "QualifiedName", ...header, left: left_, right: right_, tsonic: null };
    }
    case "KindComputedPropertyName":
    {
      const view = context.ast.as.AsComputedPropertyName(node);
      if (view === undefined) return defect("the checker gave no ComputedPropertyName view of a ComputedPropertyName node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "ComputedPropertyName", ...header, expression: expression_, tsonic: null };
    }
    case "KindDecorator":
    {
      const view = context.ast.as.AsDecorator(node);
      if (view === undefined) return defect("the checker gave no Decorator view of a Decorator node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup4);
      return { kind: "Decorator", ...header, expression: expression_, tsonic: null };
    }
    case "KindEmptyStatement":
    {
      return { kind: "EmptyStatement", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindIfStatement":
    {
      const view = context.ast.as.AsIfStatement(node);
      if (view === undefined) return defect("the checker gave no IfStatement view of a IfStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const thenStatement_ = one(context, view.ThenStatement, id, isGroup5);
      const elseStatement_ = oneOrNull(context, view.ElseStatement, id, isGroup5);
      return { kind: "IfStatement", ...header, expression: expression_, thenStatement: thenStatement_, elseStatement: elseStatement_, tsonic: null };
    }
    case "KindDoStatement":
    {
      const view = context.ast.as.AsDoStatement(node);
      if (view === undefined) return defect("the checker gave no DoStatement view of a DoStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const statement_ = one(context, view.Statement, id, isGroup5);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "DoStatement", ...header, statement: statement_, expression: expression_, tsonic: null };
    }
    case "KindWhileStatement":
    {
      const view = context.ast.as.AsWhileStatement(node);
      if (view === undefined) return defect("the checker gave no WhileStatement view of a WhileStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "WhileStatement", ...header, expression: expression_, statement: statement_, tsonic: null };
    }
    case "KindForStatement":
    {
      const view = context.ast.as.AsForStatement(node);
      if (view === undefined) return defect("the checker gave no ForStatement view of a ForStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup6);
      const condition_ = oneOrNull(context, view.Condition, id, isGroup3);
      const incrementor_ = oneOrNull(context, view.Incrementor, id, isGroup3);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "ForStatement", ...header, initializer: initializer_, condition: condition_, incrementor: incrementor_, statement: statement_, tsonic: null };
    }
    case "KindForInStatement":
    {
      const view = context.ast.as.AsForInOrOfStatement(node);
      if (view === undefined) return defect("the checker gave no ForInStatement view of a ForInStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const awaitModifier_ = null;
      const initializer_ = one(context, view.Initializer, id, isGroup6);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "ForInStatement", ...header, awaitModifier: awaitModifier_, initializer: initializer_, expression: expression_, statement: statement_, tsonic: null };
    }
    case "KindForOfStatement":
    {
      const view = context.ast.as.AsForInOrOfStatement(node);
      if (view === undefined) return defect("the checker gave no ForOfStatement view of a ForOfStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const awaitModifier_ = oneOrNull(context, view.AwaitModifier, id, isGroup7);
      const initializer_ = one(context, view.Initializer, id, isGroup6);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "ForOfStatement", ...header, awaitModifier: awaitModifier_, initializer: initializer_, expression: expression_, statement: statement_, tsonic: null };
    }
    case "KindBreakStatement":
    {
      const view = context.ast.as.AsBreakStatement(node);
      if (view === undefined) return defect("the checker gave no BreakStatement view of a BreakStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const label_ = oneOrNull(context, view.Label, id, isGroup2);
      return { kind: "BreakStatement", ...header, label: label_, tsonic: null };
    }
    case "KindContinueStatement":
    {
      const view = context.ast.as.AsContinueStatement(node);
      if (view === undefined) return defect("the checker gave no ContinueStatement view of a ContinueStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const label_ = oneOrNull(context, view.Label, id, isGroup2);
      return { kind: "ContinueStatement", ...header, label: label_, tsonic: null };
    }
    case "KindReturnStatement":
    {
      const view = context.ast.as.AsReturnStatement(node);
      if (view === undefined) return defect("the checker gave no ReturnStatement view of a ReturnStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = oneOrNull(context, view.Expression, id, isGroup3);
      return { kind: "ReturnStatement", ...header, expression: expression_, tsonic: null };
    }
    case "KindWithStatement":
    {
      const view = context.ast.as.AsWithStatement(node);
      if (view === undefined) return defect("the checker gave no WithStatement view of a WithStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "WithStatement", ...header, expression: expression_, statement: statement_, tsonic: null };
    }
    case "KindSwitchStatement":
    {
      const view = context.ast.as.AsSwitchStatement(node);
      if (view === undefined) return defect("the checker gave no SwitchStatement view of a SwitchStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const caseBlock_ = one(context, view.CaseBlock, id, isGroup8);
      return { kind: "SwitchStatement", ...header, expression: expression_, caseBlock: caseBlock_, tsonic: null };
    }
    case "KindCaseBlock":
    {
      const view = context.ast.as.AsCaseBlock(node);
      if (view === undefined) return defect("the checker gave no CaseBlock view of a CaseBlock node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const clauses_ = list(context, view.Clauses, id, isGroup9);
      return { kind: "CaseBlock", ...header, clauses: clauses_, tsonic: null };
    }
    case "KindCaseClause":
    {
      const view = context.ast.as.AsCaseOrDefaultClause(node);
      if (view === undefined) return defect("the checker gave no CaseClause view of a CaseClause node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const statements_ = list(context, view.Statements, id, isGroup5);
      return { kind: "CaseClause", ...header, expression: expression_, statements: statements_, tsonic: null };
    }
    case "KindDefaultClause":
    {
      const view = context.ast.as.AsCaseOrDefaultClause(node);
      if (view === undefined) return defect("the checker gave no DefaultClause view of a DefaultClause node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = null;
      const statements_ = list(context, view.Statements, id, isGroup5);
      return { kind: "DefaultClause", ...header, expression: expression_, statements: statements_, tsonic: null };
    }
    case "KindThrowStatement":
    {
      const view = context.ast.as.AsThrowStatement(node);
      if (view === undefined) return defect("the checker gave no ThrowStatement view of a ThrowStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "ThrowStatement", ...header, expression: expression_, tsonic: null };
    }
    case "KindTryStatement":
    {
      const view = context.ast.as.AsTryStatement(node);
      if (view === undefined) return defect("the checker gave no TryStatement view of a TryStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tryBlock_ = one(context, view.TryBlock, id, isGroup10);
      const catchClause_ = oneOrNull(context, view.CatchClause, id, isGroup11);
      const finallyBlock_ = oneOrNull(context, view.FinallyBlock, id, isGroup10);
      return { kind: "TryStatement", ...header, tryBlock: tryBlock_, catchClause: catchClause_, finallyBlock: finallyBlock_, tsonic: null };
    }
    case "KindCatchClause":
    {
      const view = context.ast.as.AsCatchClause(node);
      if (view === undefined) return defect("the checker gave no CatchClause view of a CatchClause node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const variableDeclaration_ = oneOrNull(context, view.VariableDeclaration, id, isGroup12);
      const block_ = one(context, view.Block, id, isGroup10);
      return { kind: "CatchClause", ...header, variableDeclaration: variableDeclaration_, block: block_, tsonic: null };
    }
    case "KindDebuggerStatement":
    {
      return { kind: "DebuggerStatement", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindLabeledStatement":
    {
      const view = context.ast.as.AsLabeledStatement(node);
      if (view === undefined) return defect("the checker gave no LabeledStatement view of a LabeledStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const label_ = one(context, view.Label, id, isGroup2);
      const statement_ = one(context, view.Statement, id, isGroup5);
      return { kind: "LabeledStatement", ...header, label: label_, statement: statement_, tsonic: null };
    }
    case "KindExpressionStatement":
    {
      const view = context.ast.as.AsExpressionStatement(node);
      if (view === undefined) return defect("the checker gave no ExpressionStatement view of a ExpressionStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "ExpressionStatement", ...header, expression: expression_, tsonic: null };
    }
    case "KindBlock":
    {
      const view = context.ast.as.AsBlock(node);
      if (view === undefined) return defect("the checker gave no Block view of a Block node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const statements_ = list(context, view.Statements, id, isGroup5);
      const multiLine_ = view.MultiLine;
      return { kind: "Block", ...header, statements: statements_, multiLine: multiLine_, tsonic: null };
    }
    case "KindVariableStatement":
    {
      const view = context.ast.as.AsVariableStatement(node);
      if (view === undefined) return defect("the checker gave no VariableStatement view of a VariableStatement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const declarationList_ = one(context, view.DeclarationList, id, isGroup14);
      return { kind: "VariableStatement", ...header, modifiers: modifiers_, declarationList: declarationList_, tsonic: null };
    }
    case "KindVariableDeclaration":
    {
      const view = context.ast.as.AsVariableDeclaration(node);
      if (view === undefined) return defect("the checker gave no VariableDeclaration view of a VariableDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup15);
      const exclamationToken_ = oneOrNull(context, view.ExclamationToken, id, isGroup16);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "VariableDeclaration", ...header, name: name_, exclamationToken: exclamationToken_, type: type_, initializer: initializer_, tsonic: null };
    }
    case "KindVariableDeclarationList":
    {
      const view = context.ast.as.AsVariableDeclarationList(node);
      if (view === undefined) return defect("the checker gave no VariableDeclarationList view of a VariableDeclarationList node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const declarations_ = list(context, view.Declarations, id, isGroup12);
      return { kind: "VariableDeclarationList", ...header, declarations: declarations_, tsonic: null };
    }
    case "KindArrayBindingPattern":
    {
      const view = context.ast.as.AsBindingPattern(node);
      if (view === undefined) return defect("the checker gave no BindingPattern view of a ArrayBindingPattern node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup18);
      return { kind: "ArrayBindingPattern", ...header, elements: elements_, tsonic: null };
    }
    case "KindObjectBindingPattern":
    {
      const view = context.ast.as.AsBindingPattern(node);
      if (view === undefined) return defect("the checker gave no BindingPattern view of a ArrayBindingPattern node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup18);
      return { kind: "ObjectBindingPattern", ...header, elements: elements_, tsonic: null };
    }
    case "KindParameter":
    {
      const view = context.ast.as.AsParameterDeclaration(node);
      if (view === undefined) return defect("the checker gave no ParameterDeclaration view of a Parameter node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const dotDotDotToken_ = oneOrNull(context, view.DotDotDotToken, id, isGroup19);
      const name_ = one(context, view.name, id, isGroup15);
      const questionToken_ = oneOrNull(context, view.QuestionToken, id, isGroup20);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "Parameter", ...header, modifiers: modifiers_, dotDotDotToken: dotDotDotToken_, name: name_, questionToken: questionToken_, type: type_, initializer: initializer_, tsonic: null };
    }
    case "KindBindingElement":
    {
      const view = context.ast.as.AsBindingElement(node);
      if (view === undefined) return defect("the checker gave no BindingElement view of a BindingElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const dotDotDotToken_ = oneOrNull(context, view.DotDotDotToken, id, isGroup19);
      const propertyName_ = oneOrNull(context, view.PropertyName, id, isGroup21);
      const name_ = oneOrNull(context, view.name, id, isGroup15);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "BindingElement", ...header, dotDotDotToken: dotDotDotToken_, propertyName: propertyName_, name: name_, initializer: initializer_, tsonic: null };
    }
    case "KindMissingDeclaration":
    {
      const view = context.ast.as.AsMissingDeclaration(node);
      if (view === undefined) return defect("the checker gave no MissingDeclaration view of a MissingDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      return { kind: "MissingDeclaration", ...header, modifiers: modifiers_, tsonic: null };
    }
    case "KindFunctionDeclaration":
    {
      const view = context.ast.as.AsFunctionDeclaration(node);
      if (view === undefined) return defect("the checker gave no FunctionDeclaration view of a FunctionDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = oneOrNull(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "FunctionDeclaration", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, body: body_, tsonic: null };
    }
    case "KindClassDeclaration":
    {
      const view = context.ast.as.AsClassDeclaration(node);
      if (view === undefined) return defect("the checker gave no ClassDeclaration view of a ClassDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = oneOrNull(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const heritageClauses_ = listOrNull(context, view.HeritageClauses, id, isGroup26);
      const members_ = list(context, view.Members, id, isGroup27);
      return { kind: "ClassDeclaration", ...header, modifiers: modifiers_, name: name_, typeParameters: typeParameters_, heritageClauses: heritageClauses_, members: members_, tsonic: null };
    }
    case "KindClassExpression":
    {
      const view = context.ast.as.AsClassExpression(node);
      if (view === undefined) return defect("the checker gave no ClassExpression view of a ClassExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = oneOrNull(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const heritageClauses_ = listOrNull(context, view.HeritageClauses, id, isGroup26);
      const members_ = list(context, view.Members, id, isGroup27);
      return { kind: "ClassExpression", ...header, modifiers: modifiers_, name: name_, typeParameters: typeParameters_, heritageClauses: heritageClauses_, members: members_, tsonic: null };
    }
    case "KindHeritageClause":
    {
      const view = context.ast.as.AsHeritageClause(node);
      if (view === undefined) return defect("the checker gave no HeritageClause view of a HeritageClause node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const types_ = list(context, view.Types, id, isGroup28);
      const token_ = heritageToken(context, node);
      return { kind: "HeritageClause", ...header, types: types_, token: token_, tsonic: null };
    }
    case "KindInterfaceDeclaration":
    {
      const view = context.ast.as.AsInterfaceDeclaration(node);
      if (view === undefined) return defect("the checker gave no InterfaceDeclaration view of a InterfaceDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const heritageClauses_ = listOrNull(context, view.HeritageClauses, id, isGroup26);
      const members_ = list(context, view.Members, id, isGroup29);
      return { kind: "InterfaceDeclaration", ...header, modifiers: modifiers_, name: name_, typeParameters: typeParameters_, heritageClauses: heritageClauses_, members: members_, tsonic: null };
    }
    case "KindJSTypeAliasDeclaration":
    {
      const view = context.ast.as.AsTypeAliasDeclaration(node);
      if (view === undefined) return defect("the checker gave no TypeAliasDeclaration view of a JSTypeAliasDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSTypeAliasDeclaration", ...header, modifiers: modifiers_, name: name_, typeParameters: typeParameters_, type: type_, tsonic: null };
    }
    case "KindTypeAliasDeclaration":
    {
      const view = context.ast.as.AsTypeAliasDeclaration(node);
      if (view === undefined) return defect("the checker gave no TypeAliasDeclaration view of a JSTypeAliasDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "TypeAliasDeclaration", ...header, modifiers: modifiers_, name: name_, typeParameters: typeParameters_, type: type_, tsonic: null };
    }
    case "KindEnumMember":
    {
      const view = context.ast.as.AsEnumMember(node);
      if (view === undefined) return defect("the checker gave no EnumMember view of a EnumMember node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "EnumMember", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, initializer: initializer_, tsonic: null };
    }
    case "KindEnumDeclaration":
    {
      const view = context.ast.as.AsEnumDeclaration(node);
      if (view === undefined) return defect("the checker gave no EnumDeclaration view of a EnumDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const members_ = list(context, view.Members, id, isGroup31);
      return { kind: "EnumDeclaration", ...header, modifiers: modifiers_, name: name_, members: members_, tsonic: null };
    }
    case "KindModuleBlock":
    {
      const view = context.ast.as.AsModuleBlock(node);
      if (view === undefined) return defect("the checker gave no ModuleBlock view of a ModuleBlock node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const statements_ = list(context, view.Statements, id, isGroup5);
      return { kind: "ModuleBlock", ...header, statements: statements_, tsonic: null };
    }
    case "KindNotEmittedStatement":
    {
      return { kind: "NotEmittedStatement", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindNotEmittedTypeElement":
    {
      return { kind: "NotEmittedTypeElement", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindImportDeclaration":
    {
      const view = context.ast.as.AsImportDeclaration(node);
      if (view === undefined) return defect("the checker gave no ImportDeclaration view of a ImportDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const importClause_ = oneOrNull(context, view.ImportClause, id, isGroup32);
      const moduleSpecifier_ = one(context, view.ModuleSpecifier, id, isGroup3);
      const attributes_ = oneOrNull(context, view.Attributes, id, isGroup33);
      return { kind: "ImportDeclaration", ...header, modifiers: modifiers_, importClause: importClause_, moduleSpecifier: moduleSpecifier_, attributes: attributes_, tsonic: null };
    }
    case "KindJSImportDeclaration":
    {
      const view = context.ast.as.AsImportDeclaration(node);
      if (view === undefined) return defect("the checker gave no ImportDeclaration view of a ImportDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const importClause_ = oneOrNull(context, view.ImportClause, id, isGroup32);
      const moduleSpecifier_ = one(context, view.ModuleSpecifier, id, isGroup3);
      const attributes_ = oneOrNull(context, view.Attributes, id, isGroup33);
      return { kind: "JSImportDeclaration", ...header, modifiers: modifiers_, importClause: importClause_, moduleSpecifier: moduleSpecifier_, attributes: attributes_, tsonic: null };
    }
    case "KindExternalModuleReference":
    {
      const view = context.ast.as.AsExternalModuleReference(node);
      if (view === undefined) return defect("the checker gave no ExternalModuleReference view of a ExternalModuleReference node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "ExternalModuleReference", ...header, expression: expression_, tsonic: null };
    }
    case "KindNamespaceImport":
    {
      const view = context.ast.as.AsNamespaceImport(node);
      if (view === undefined) return defect("the checker gave no NamespaceImport view of a NamespaceImport node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup2);
      return { kind: "NamespaceImport", ...header, name: name_, tsonic: null };
    }
    case "KindNamedImports":
    {
      const view = context.ast.as.AsNamedImports(node);
      if (view === undefined) return defect("the checker gave no NamedImports view of a NamedImports node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup34);
      return { kind: "NamedImports", ...header, elements: elements_, tsonic: null };
    }
    case "KindExportAssignment":
    {
      const view = context.ast.as.AsExportAssignment(node);
      if (view === undefined) return defect("the checker gave no ExportAssignment view of a ExportAssignment node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const isExportEquals_ = view.IsExportEquals;
      return { kind: "ExportAssignment", ...header, modifiers: modifiers_, type: type_, expression: expression_, isExportEquals: isExportEquals_, tsonic: null };
    }
    case "KindNamespaceExportDeclaration":
    {
      const view = context.ast.as.AsNamespaceExportDeclaration(node);
      if (view === undefined) return defect("the checker gave no NamespaceExportDeclaration view of a NamespaceExportDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      return { kind: "NamespaceExportDeclaration", ...header, modifiers: modifiers_, name: name_, tsonic: null };
    }
    case "KindNamespaceExport":
    {
      const view = context.ast.as.AsNamespaceExport(node);
      if (view === undefined) return defect("the checker gave no NamespaceExport view of a NamespaceExport node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup35);
      return { kind: "NamespaceExport", ...header, name: name_, tsonic: null };
    }
    case "KindNamedExports":
    {
      const view = context.ast.as.AsNamedExports(node);
      if (view === undefined) return defect("the checker gave no NamedExports view of a NamedExports node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup36);
      return { kind: "NamedExports", ...header, elements: elements_, tsonic: null };
    }
    case "KindExportSpecifier":
    {
      const view = context.ast.as.AsExportSpecifier(node);
      if (view === undefined) return defect("the checker gave no ExportSpecifier view of a ExportSpecifier node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const propertyName_ = oneOrNull(context, view.PropertyName, id, isGroup35);
      const name_ = one(context, view.name, id, isGroup35);
      const isTypeOnly_ = view.IsTypeOnly;
      return { kind: "ExportSpecifier", ...header, propertyName: propertyName_, name: name_, isTypeOnly: isTypeOnly_, tsonic: null };
    }
    case "KindCallSignature":
    {
      const view = context.ast.as.AsCallSignatureDeclaration(node);
      if (view === undefined) return defect("the checker gave no CallSignatureDeclaration view of a CallSignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "CallSignature", ...header, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindConstructSignature":
    {
      const view = context.ast.as.AsConstructSignatureDeclaration(node);
      if (view === undefined) return defect("the checker gave no ConstructSignatureDeclaration view of a ConstructSignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "ConstructSignature", ...header, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindConstructor":
    {
      const view = context.ast.as.AsConstructorDeclaration(node);
      if (view === undefined) return defect("the checker gave no ConstructorDeclaration view of a Constructor node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "Constructor", ...header, modifiers: modifiers_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, asteriskToken: asteriskToken_, body: body_, tsonic: null };
    }
    case "KindGetAccessor":
    {
      const view = context.ast.as.AsGetAccessorDeclaration(node);
      if (view === undefined) return defect("the checker gave no GetAccessorDeclaration view of a GetAccessor node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "GetAccessor", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, postfixToken: postfixToken_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, body: body_, tsonic: null };
    }
    case "KindSetAccessor":
    {
      const view = context.ast.as.AsSetAccessorDeclaration(node);
      if (view === undefined) return defect("the checker gave no SetAccessorDeclaration view of a SetAccessor node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "SetAccessor", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, postfixToken: postfixToken_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, body: body_, tsonic: null };
    }
    case "KindIndexSignature":
    {
      const view = context.ast.as.AsIndexSignatureDeclaration(node);
      if (view === undefined) return defect("the checker gave no IndexSignatureDeclaration view of a IndexSignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "IndexSignature", ...header, modifiers: modifiers_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindMethodSignature":
    {
      const view = context.ast.as.AsMethodSignatureDeclaration(node);
      if (view === undefined) return defect("the checker gave no MethodSignatureDeclaration view of a MethodSignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "MethodSignature", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindMethodDeclaration":
    {
      const view = context.ast.as.AsMethodDeclaration(node);
      if (view === undefined) return defect("the checker gave no MethodDeclaration view of a MethodDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "MethodDeclaration", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, postfixToken: postfixToken_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, body: body_, tsonic: null };
    }
    case "KindPropertySignature":
    {
      const view = context.ast.as.AsPropertySignatureDeclaration(node);
      if (view === undefined) return defect("the checker gave no PropertySignatureDeclaration view of a PropertySignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "PropertySignature", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, type: type_, initializer: initializer_, tsonic: null };
    }
    case "KindPropertyDeclaration":
    {
      const view = context.ast.as.AsPropertyDeclaration(node);
      if (view === undefined) return defect("the checker gave no PropertyDeclaration view of a PropertyDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup3);
      return { kind: "PropertyDeclaration", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, type: type_, initializer: initializer_, tsonic: null };
    }
    case "KindSemicolonClassElement":
    {
      return { kind: "SemicolonClassElement", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindClassStaticBlockDeclaration":
    {
      const view = context.ast.as.AsClassStaticBlockDeclaration(node);
      if (view === undefined) return defect("the checker gave no ClassStaticBlockDeclaration view of a ClassStaticBlockDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const body_ = one(context, view.Body, id, isGroup10);
      return { kind: "ClassStaticBlockDeclaration", ...header, modifiers: modifiers_, body: body_, tsonic: null };
    }
    case "KindOmittedExpression":
    {
      return { kind: "OmittedExpression", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindFalseKeyword":
      return { kind: "FalseKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindImportKeyword":
      return { kind: "ImportKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNullKeyword":
      return { kind: "NullKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSuperKeyword":
      return { kind: "SuperKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindThisKeyword":
      return { kind: "ThisKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindTrueKeyword":
      return { kind: "TrueKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindStringLiteral":
    {
      const view = context.ast.as.AsStringLiteral(node);
      if (view === undefined) return defect("the checker gave no StringLiteral view of a StringLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      return { kind: "StringLiteral", ...header, text: text_, tokenFlags: tokenFlags_, tsonic: null };
    }
    case "KindNumericLiteral":
    {
      const view = context.ast.as.AsNumericLiteral(node);
      if (view === undefined) return defect("the checker gave no NumericLiteral view of a NumericLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      return { kind: "NumericLiteral", ...header, text: text_, tokenFlags: tokenFlags_, tsonic: null };
    }
    case "KindBigIntLiteral":
    {
      const view = context.ast.as.AsBigIntLiteral(node);
      if (view === undefined) return defect("the checker gave no BigIntLiteral view of a BigIntLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      return { kind: "BigIntLiteral", ...header, text: text_, tokenFlags: tokenFlags_, tsonic: null };
    }
    case "KindRegularExpressionLiteral":
    {
      const view = context.ast.as.AsRegularExpressionLiteral(node);
      if (view === undefined) return defect("the checker gave no RegularExpressionLiteral view of a RegularExpressionLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      return { kind: "RegularExpressionLiteral", ...header, text: text_, tokenFlags: tokenFlags_, tsonic: null };
    }
    case "KindNoSubstitutionTemplateLiteral":
    {
      const view = context.ast.as.AsNoSubstitutionTemplateLiteral(node);
      if (view === undefined) return defect("the checker gave no NoSubstitutionTemplateLiteral view of a NoSubstitutionTemplateLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      const rawText_ = view.RawText;
      const templateFlags_ = tokenFlags(view.TemplateFlags);
      return { kind: "NoSubstitutionTemplateLiteral", ...header, text: text_, tokenFlags: tokenFlags_, rawText: rawText_, templateFlags: templateFlags_, tsonic: null };
    }
    case "KindBinaryExpression":
    {
      const view = context.ast.as.AsBinaryExpression(node);
      if (view === undefined) return defect("the checker gave no BinaryExpression view of a BinaryExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const left_ = one(context, view.Left, id, isGroup3);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const operatorToken_ = one(context, view.OperatorToken, id, isGroup37);
      const right_ = one(context, view.Right, id, isGroup3);
      return { kind: "BinaryExpression", ...header, modifiers: modifiers_, left: left_, type: type_, operatorToken: operatorToken_, right: right_, tsonic: null };
    }
    case "KindPrefixUnaryExpression":
    {
      const view = context.ast.as.AsPrefixUnaryExpression(node);
      if (view === undefined) return defect("the checker gave no PrefixUnaryExpression view of a PrefixUnaryExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const operand_ = one(context, view.Operand, id, isGroup3);
      const operator_ = prefixOperator(context, node);
      return { kind: "PrefixUnaryExpression", ...header, operand: operand_, operator: operator_, tsonic: null };
    }
    case "KindPostfixUnaryExpression":
    {
      const view = context.ast.as.AsPostfixUnaryExpression(node);
      if (view === undefined) return defect("the checker gave no PostfixUnaryExpression view of a PostfixUnaryExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const operand_ = one(context, view.Operand, id, isGroup3);
      const operator_ = postfixOperator(context, node);
      return { kind: "PostfixUnaryExpression", ...header, operand: operand_, operator: operator_, tsonic: null };
    }
    case "KindYieldExpression":
    {
      const view = context.ast.as.AsYieldExpression(node);
      if (view === undefined) return defect("the checker gave no YieldExpression view of a YieldExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const expression_ = oneOrNull(context, view.Expression, id, isGroup3);
      return { kind: "YieldExpression", ...header, asteriskToken: asteriskToken_, expression: expression_, tsonic: null };
    }
    case "KindArrowFunction":
    {
      const view = context.ast.as.AsArrowFunction(node);
      if (view === undefined) return defect("the checker gave no ArrowFunction view of a ArrowFunction node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const equalsGreaterThanToken_ = one(context, view.EqualsGreaterThanToken, id, isGroup38);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "ArrowFunction", ...header, modifiers: modifiers_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, asteriskToken: asteriskToken_, equalsGreaterThanToken: equalsGreaterThanToken_, body: body_, tsonic: null };
    }
    case "KindFunctionExpression":
    {
      const view = context.ast.as.AsFunctionExpression(node);
      if (view === undefined) return defect("the checker gave no FunctionExpression view of a FunctionExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = oneOrNull(context, view.name, id, isGroup2);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      const body_ = oneOrNull(context, view.Body, id, isGroup25);
      return { kind: "FunctionExpression", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, body: body_, tsonic: null };
    }
    case "KindAsExpression":
    {
      const view = context.ast.as.AsAsExpression(node);
      if (view === undefined) return defect("the checker gave no AsExpression view of a AsExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "AsExpression", ...header, expression: expression_, type: type_, tsonic: null };
    }
    case "KindSatisfiesExpression":
    {
      const view = context.ast.as.AsSatisfiesExpression(node);
      if (view === undefined) return defect("the checker gave no SatisfiesExpression view of a SatisfiesExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "SatisfiesExpression", ...header, expression: expression_, type: type_, tsonic: null };
    }
    case "KindConditionalExpression":
    {
      const view = context.ast.as.AsConditionalExpression(node);
      if (view === undefined) return defect("the checker gave no ConditionalExpression view of a ConditionalExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const condition_ = one(context, view.Condition, id, isGroup3);
      const questionToken_ = one(context, view.QuestionToken, id, isGroup20);
      const whenTrue_ = one(context, view.WhenTrue, id, isGroup3);
      const colonToken_ = one(context, view.ColonToken, id, isGroup39);
      const whenFalse_ = one(context, view.WhenFalse, id, isGroup3);
      return { kind: "ConditionalExpression", ...header, condition: condition_, questionToken: questionToken_, whenTrue: whenTrue_, colonToken: colonToken_, whenFalse: whenFalse_, tsonic: null };
    }
    case "KindPropertyAccessExpression":
    {
      const view = context.ast.as.AsPropertyAccessExpression(node);
      if (view === undefined) return defect("the checker gave no PropertyAccessExpression view of a PropertyAccessExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const questionDotToken_ = oneOrNull(context, view.QuestionDotToken, id, isGroup40);
      const name_ = one(context, view.name, id, isGroup41);
      return { kind: "PropertyAccessExpression", ...header, expression: expression_, questionDotToken: questionDotToken_, name: name_, tsonic: null };
    }
    case "KindElementAccessExpression":
    {
      const view = context.ast.as.AsElementAccessExpression(node);
      if (view === undefined) return defect("the checker gave no ElementAccessExpression view of a ElementAccessExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const questionDotToken_ = oneOrNull(context, view.QuestionDotToken, id, isGroup40);
      const argumentExpression_ = one(context, view.ArgumentExpression, id, isGroup3);
      return { kind: "ElementAccessExpression", ...header, expression: expression_, questionDotToken: questionDotToken_, argumentExpression: argumentExpression_, tsonic: null };
    }
    case "KindCallExpression":
    {
      const view = context.ast.as.AsCallExpression(node);
      if (view === undefined) return defect("the checker gave no CallExpression view of a CallExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const questionDotToken_ = oneOrNull(context, view.QuestionDotToken, id, isGroup40);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const arguments_ = list(context, view.Arguments, id, isGroup3);
      return { kind: "CallExpression", ...header, expression: expression_, questionDotToken: questionDotToken_, typeArguments: typeArguments_, arguments: arguments_, tsonic: null };
    }
    case "KindNewExpression":
    {
      const view = context.ast.as.AsNewExpression(node);
      if (view === undefined) return defect("the checker gave no NewExpression view of a NewExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const arguments_ = listOrNull(context, view.Arguments, id, isGroup3);
      return { kind: "NewExpression", ...header, expression: expression_, typeArguments: typeArguments_, arguments: arguments_, tsonic: null };
    }
    case "KindMetaProperty":
    {
      const view = context.ast.as.AsMetaProperty(node);
      if (view === undefined) return defect("the checker gave no MetaProperty view of a MetaProperty node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup2);
      const keywordToken_ = metaKeyword(context, node);
      return { kind: "MetaProperty", ...header, name: name_, keywordToken: keywordToken_, tsonic: null };
    }
    case "KindNonNullExpression":
    {
      const view = context.ast.as.AsNonNullExpression(node);
      if (view === undefined) return defect("the checker gave no NonNullExpression view of a NonNullExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "NonNullExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindSpreadElement":
    {
      const view = context.ast.as.AsSpreadElement(node);
      if (view === undefined) return defect("the checker gave no SpreadElement view of a SpreadElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "SpreadElement", ...header, expression: expression_, tsonic: null };
    }
    case "KindTemplateExpression":
    {
      const view = context.ast.as.AsTemplateExpression(node);
      if (view === undefined) return defect("the checker gave no TemplateExpression view of a TemplateExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const head_ = one(context, view.Head, id, isGroup42);
      const templateSpans_ = list(context, view.TemplateSpans, id, isGroup43);
      return { kind: "TemplateExpression", ...header, head: head_, templateSpans: templateSpans_, tsonic: null };
    }
    case "KindTemplateSpan":
    {
      const view = context.ast.as.AsTemplateSpan(node);
      if (view === undefined) return defect("the checker gave no TemplateSpan view of a TemplateSpan node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const literal_ = one(context, view.Literal, id, isGroup44);
      return { kind: "TemplateSpan", ...header, expression: expression_, literal: literal_, tsonic: null };
    }
    case "KindTaggedTemplateExpression":
    {
      const view = context.ast.as.AsTaggedTemplateExpression(node);
      if (view === undefined) return defect("the checker gave no TaggedTemplateExpression view of a TaggedTemplateExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tag_ = one(context, view.Tag, id, isGroup3);
      const questionDotToken_ = oneOrNull(context, view.QuestionDotToken, id, isGroup40);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const template_ = one(context, view.Template, id, isGroup45);
      return { kind: "TaggedTemplateExpression", ...header, tag: tag_, questionDotToken: questionDotToken_, typeArguments: typeArguments_, template: template_, tsonic: null };
    }
    case "KindParenthesizedExpression":
    {
      const view = context.ast.as.AsParenthesizedExpression(node);
      if (view === undefined) return defect("the checker gave no ParenthesizedExpression view of a ParenthesizedExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "ParenthesizedExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindArrayLiteralExpression":
    {
      const view = context.ast.as.AsArrayLiteralExpression(node);
      if (view === undefined) return defect("the checker gave no ArrayLiteralExpression view of a ArrayLiteralExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup3);
      const multiLine_ = view.MultiLine;
      return { kind: "ArrayLiteralExpression", ...header, elements: elements_, multiLine: multiLine_, tsonic: null };
    }
    case "KindObjectLiteralExpression":
    {
      const view = context.ast.as.AsObjectLiteralExpression(node);
      if (view === undefined) return defect("the checker gave no ObjectLiteralExpression view of a ObjectLiteralExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const properties_ = list(context, view.Properties, id, isGroup46);
      const multiLine_ = view.MultiLine;
      return { kind: "ObjectLiteralExpression", ...header, properties: properties_, multiLine: multiLine_, tsonic: null };
    }
    case "KindSpreadAssignment":
    {
      const view = context.ast.as.AsSpreadAssignment(node);
      if (view === undefined) return defect("the checker gave no SpreadAssignment view of a SpreadAssignment node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "SpreadAssignment", ...header, expression: expression_, tsonic: null };
    }
    case "KindPropertyAssignment":
    {
      const view = context.ast.as.AsPropertyAssignment(node);
      if (view === undefined) return defect("the checker gave no PropertyAssignment view of a PropertyAssignment node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const initializer_ = one(context, view.Initializer, id, isGroup3);
      return { kind: "PropertyAssignment", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, type: type_, initializer: initializer_, tsonic: null };
    }
    case "KindShorthandPropertyAssignment":
    {
      const view = context.ast.as.AsShorthandPropertyAssignment(node);
      if (view === undefined) return defect("the checker gave no ShorthandPropertyAssignment view of a ShorthandPropertyAssignment node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup21);
      const postfixToken_ = oneOrNull(context, view.PostfixToken, id, isGroup30);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const equalsToken_ = oneOrNull(context, view.EqualsToken, id, isGroup47);
      const objectAssignmentInitializer_ = oneOrNull(context, view.ObjectAssignmentInitializer, id, isGroup3);
      return { kind: "ShorthandPropertyAssignment", ...header, modifiers: modifiers_, name: name_, postfixToken: postfixToken_, type: type_, equalsToken: equalsToken_, objectAssignmentInitializer: objectAssignmentInitializer_, tsonic: null };
    }
    case "KindDeleteExpression":
    {
      const view = context.ast.as.AsDeleteExpression(node);
      if (view === undefined) return defect("the checker gave no DeleteExpression view of a DeleteExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "DeleteExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindTypeOfExpression":
    {
      const view = context.ast.as.AsTypeOfExpression(node);
      if (view === undefined) return defect("the checker gave no TypeOfExpression view of a TypeOfExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "TypeOfExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindVoidExpression":
    {
      const view = context.ast.as.AsVoidExpression(node);
      if (view === undefined) return defect("the checker gave no VoidExpression view of a VoidExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "VoidExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindAwaitExpression":
    {
      const view = context.ast.as.AsAwaitExpression(node);
      if (view === undefined) return defect("the checker gave no AwaitExpression view of a AwaitExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "AwaitExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindTypeAssertionExpression":
    {
      const view = context.ast.as.AsTypeAssertion(node);
      if (view === undefined) return defect("the checker gave no TypeAssertion view of a TypeAssertionExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "TypeAssertionExpression", ...header, type: type_, expression: expression_, tsonic: null };
    }
    case "KindAnyKeyword":
      return { kind: "AnyKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBigIntKeyword":
      return { kind: "BigIntKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindBooleanKeyword":
      return { kind: "BooleanKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindIntrinsicKeyword":
      return { kind: "IntrinsicKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNeverKeyword":
      return { kind: "NeverKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindNumberKeyword":
      return { kind: "NumberKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindObjectKeyword":
      return { kind: "ObjectKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindStringKeyword":
      return { kind: "StringKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindSymbolKeyword":
      return { kind: "SymbolKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUndefinedKeyword":
      return { kind: "UndefinedKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUnknownKeyword":
      return { kind: "UnknownKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindVoidKeyword":
      return { kind: "VoidKeyword", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    case "KindUnionType":
    {
      const view = context.ast.as.AsUnionTypeNode(node);
      if (view === undefined) return defect("the checker gave no UnionTypeNode view of a UnionType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const types_ = list(context, view.Types, id, isGroup17);
      return { kind: "UnionType", ...header, types: types_, tsonic: null };
    }
    case "KindIntersectionType":
    {
      const view = context.ast.as.AsIntersectionTypeNode(node);
      if (view === undefined) return defect("the checker gave no IntersectionTypeNode view of a IntersectionType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const types_ = list(context, view.Types, id, isGroup17);
      return { kind: "IntersectionType", ...header, types: types_, tsonic: null };
    }
    case "KindConditionalType":
    {
      const view = context.ast.as.AsConditionalTypeNode(node);
      if (view === undefined) return defect("the checker gave no ConditionalTypeNode view of a ConditionalType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const checkType_ = one(context, view.CheckType, id, isGroup17);
      const extendsType_ = one(context, view.ExtendsType, id, isGroup17);
      const trueType_ = one(context, view.TrueType, id, isGroup17);
      const falseType_ = one(context, view.FalseType, id, isGroup17);
      return { kind: "ConditionalType", ...header, checkType: checkType_, extendsType: extendsType_, trueType: trueType_, falseType: falseType_, tsonic: null };
    }
    case "KindTypeOperator":
    {
      const view = context.ast.as.AsTypeOperatorNode(node);
      if (view === undefined) return defect("the checker gave no TypeOperatorNode view of a TypeOperator node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      const operator_ = typeOperator(context, node);
      return { kind: "TypeOperator", ...header, type: type_, operator: operator_, tsonic: null };
    }
    case "KindInferType":
    {
      const view = context.ast.as.AsInferTypeNode(node);
      if (view === undefined) return defect("the checker gave no InferTypeNode view of a InferType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const typeParameter_ = one(context, view.TypeParameter, id, isGroup23);
      return { kind: "InferType", ...header, typeParameter: typeParameter_, tsonic: null };
    }
    case "KindArrayType":
    {
      const view = context.ast.as.AsArrayTypeNode(node);
      if (view === undefined) return defect("the checker gave no ArrayTypeNode view of a ArrayType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elementType_ = one(context, view.ElementType, id, isGroup17);
      return { kind: "ArrayType", ...header, elementType: elementType_, tsonic: null };
    }
    case "KindIndexedAccessType":
    {
      const view = context.ast.as.AsIndexedAccessTypeNode(node);
      if (view === undefined) return defect("the checker gave no IndexedAccessTypeNode view of a IndexedAccessType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const objectType_ = one(context, view.ObjectType, id, isGroup17);
      const indexType_ = one(context, view.IndexType, id, isGroup17);
      return { kind: "IndexedAccessType", ...header, objectType: objectType_, indexType: indexType_, tsonic: null };
    }
    case "KindTypeReference":
    {
      const view = context.ast.as.AsTypeReferenceNode(node);
      if (view === undefined) return defect("the checker gave no TypeReferenceNode view of a TypeReference node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const typeName_ = one(context, view.TypeName, id, isGroup1);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      return { kind: "TypeReference", ...header, typeName: typeName_, typeArguments: typeArguments_, tsonic: null };
    }
    case "KindExpressionWithTypeArguments":
    {
      const view = context.ast.as.AsExpressionWithTypeArguments(node);
      if (view === undefined) return defect("the checker gave no ExpressionWithTypeArguments view of a ExpressionWithTypeArguments node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      return { kind: "ExpressionWithTypeArguments", ...header, expression: expression_, typeArguments: typeArguments_, tsonic: null };
    }
    case "KindLiteralType":
    {
      const view = context.ast.as.AsLiteralTypeNode(node);
      if (view === undefined) return defect("the checker gave no LiteralTypeNode view of a LiteralType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const literal_ = one(context, view.Literal, id, isGroup48);
      return { kind: "LiteralType", ...header, literal: literal_, tsonic: null };
    }
    case "KindThisType":
    {
      return { kind: "ThisType", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindTypePredicate":
    {
      const view = context.ast.as.AsTypePredicateNode(node);
      if (view === undefined) return defect("the checker gave no TypePredicateNode view of a TypePredicate node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const assertsModifier_ = oneOrNull(context, view.AssertsModifier, id, isGroup49);
      const parameterName_ = one(context, view.ParameterName, id, isGroup50);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      return { kind: "TypePredicate", ...header, assertsModifier: assertsModifier_, parameterName: parameterName_, type: type_, tsonic: null };
    }
    case "KindImportAttribute":
    {
      const view = context.ast.as.AsImportAttribute(node);
      if (view === undefined) return defect("the checker gave no ImportAttribute view of a ImportAttribute node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup35);
      const value_ = one(context, view.Value, id, isGroup3);
      return { kind: "ImportAttribute", ...header, name: name_, value: value_, tsonic: null };
    }
    case "KindImportAttributes":
    {
      const view = context.ast.as.AsImportAttributes(node);
      if (view === undefined) return defect("the checker gave no ImportAttributes view of a ImportAttributes node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const attributes_ = list(context, view.Attributes, id, isGroup51);
      const token_ = attributesToken(context, node);
      const multiLine_ = view.MultiLine;
      return { kind: "ImportAttributes", ...header, attributes: attributes_, token: token_, multiLine: multiLine_, tsonic: null };
    }
    case "KindTypeQuery":
    {
      const view = context.ast.as.AsTypeQueryNode(node);
      if (view === undefined) return defect("the checker gave no TypeQueryNode view of a TypeQuery node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const exprName_ = one(context, view.ExprName, id, isGroup1);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      return { kind: "TypeQuery", ...header, exprName: exprName_, typeArguments: typeArguments_, tsonic: null };
    }
    case "KindMappedType":
    {
      const view = context.ast.as.AsMappedTypeNode(node);
      if (view === undefined) return defect("the checker gave no MappedTypeNode view of a MappedType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const readonlyToken_ = oneOrNull(context, view.ReadonlyToken, id, isGroup52);
      const typeParameter_ = one(context, view.TypeParameter, id, isGroup23);
      const nameType_ = oneOrNull(context, view.NameType, id, isGroup17);
      const questionToken_ = oneOrNull(context, view.QuestionToken, id, isGroup53);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const members_ = listOrNull(context, view.Members, id, isGroup29);
      return { kind: "MappedType", ...header, readonlyToken: readonlyToken_, typeParameter: typeParameter_, nameType: nameType_, questionToken: questionToken_, type: type_, members: members_, tsonic: null };
    }
    case "KindTypeLiteral":
    {
      const view = context.ast.as.AsTypeLiteralNode(node);
      if (view === undefined) return defect("the checker gave no TypeLiteralNode view of a TypeLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const members_ = list(context, view.Members, id, isGroup29);
      return { kind: "TypeLiteral", ...header, members: members_, tsonic: null };
    }
    case "KindTupleType":
    {
      const view = context.ast.as.AsTupleTypeNode(node);
      if (view === undefined) return defect("the checker gave no TupleTypeNode view of a TupleType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const elements_ = list(context, view.Elements, id, isGroup17);
      return { kind: "TupleType", ...header, elements: elements_, tsonic: null };
    }
    case "KindNamedTupleMember":
    {
      const view = context.ast.as.AsNamedTupleMember(node);
      if (view === undefined) return defect("the checker gave no NamedTupleMember view of a NamedTupleMember node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const dotDotDotToken_ = oneOrNull(context, view.DotDotDotToken, id, isGroup19);
      const name_ = one(context, view.name, id, isGroup2);
      const questionToken_ = oneOrNull(context, view.QuestionToken, id, isGroup20);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "NamedTupleMember", ...header, dotDotDotToken: dotDotDotToken_, name: name_, questionToken: questionToken_, type: type_, tsonic: null };
    }
    case "KindOptionalType":
    {
      const view = context.ast.as.AsOptionalTypeNode(node);
      if (view === undefined) return defect("the checker gave no OptionalTypeNode view of a OptionalType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "OptionalType", ...header, type: type_, tsonic: null };
    }
    case "KindRestType":
    {
      const view = context.ast.as.AsRestTypeNode(node);
      if (view === undefined) return defect("the checker gave no RestTypeNode view of a RestType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "RestType", ...header, type: type_, tsonic: null };
    }
    case "KindParenthesizedType":
    {
      const view = context.ast.as.AsParenthesizedTypeNode(node);
      if (view === undefined) return defect("the checker gave no ParenthesizedTypeNode view of a ParenthesizedType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "ParenthesizedType", ...header, type: type_, tsonic: null };
    }
    case "KindFunctionType":
    {
      const view = context.ast.as.AsFunctionTypeNode(node);
      if (view === undefined) return defect("the checker gave no FunctionTypeNode view of a FunctionType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "FunctionType", ...header, modifiers: modifiers_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindConstructorType":
    {
      const view = context.ast.as.AsConstructorTypeNode(node);
      if (view === undefined) return defect("the checker gave no ConstructorTypeNode view of a ConstructorType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "ConstructorType", ...header, modifiers: modifiers_, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindTemplateHead":
    {
      const view = context.ast.as.AsTemplateHead(node);
      if (view === undefined) return defect("the checker gave no TemplateHead view of a TemplateHead node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      const rawText_ = view.RawText;
      const templateFlags_ = tokenFlags(view.TemplateFlags);
      return { kind: "TemplateHead", ...header, text: text_, tokenFlags: tokenFlags_, rawText: rawText_, templateFlags: templateFlags_, tsonic: null };
    }
    case "KindTemplateMiddle":
    {
      const view = context.ast.as.AsTemplateMiddle(node);
      if (view === undefined) return defect("the checker gave no TemplateMiddle view of a TemplateMiddle node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      const rawText_ = view.RawText;
      const templateFlags_ = tokenFlags(view.TemplateFlags);
      return { kind: "TemplateMiddle", ...header, text: text_, tokenFlags: tokenFlags_, rawText: rawText_, templateFlags: templateFlags_, tsonic: null };
    }
    case "KindTemplateTail":
    {
      const view = context.ast.as.AsTemplateTail(node);
      if (view === undefined) return defect("the checker gave no TemplateTail view of a TemplateTail node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      const rawText_ = view.RawText;
      const templateFlags_ = tokenFlags(view.TemplateFlags);
      return { kind: "TemplateTail", ...header, text: text_, tokenFlags: tokenFlags_, rawText: rawText_, templateFlags: templateFlags_, tsonic: null };
    }
    case "KindTemplateLiteralType":
    {
      const view = context.ast.as.AsTemplateLiteralTypeNode(node);
      if (view === undefined) return defect("the checker gave no TemplateLiteralTypeNode view of a TemplateLiteralType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const head_ = one(context, view.Head, id, isGroup42);
      const templateSpans_ = list(context, view.TemplateSpans, id, isGroup54);
      return { kind: "TemplateLiteralType", ...header, head: head_, templateSpans: templateSpans_, tsonic: null };
    }
    case "KindTemplateLiteralTypeSpan":
    {
      const view = context.ast.as.AsTemplateLiteralTypeSpan(node);
      if (view === undefined) return defect("the checker gave no TemplateLiteralTypeSpan view of a TemplateLiteralTypeSpan node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      const literal_ = one(context, view.Literal, id, isGroup44);
      return { kind: "TemplateLiteralTypeSpan", ...header, type: type_, literal: literal_, tsonic: null };
    }
    case "KindPartiallyEmittedExpression":
    {
      const view = context.ast.as.AsPartiallyEmittedExpression(node);
      if (view === undefined) return defect("the checker gave no PartiallyEmittedExpression view of a PartiallyEmittedExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "PartiallyEmittedExpression", ...header, expression: expression_, tsonic: null };
    }
    case "KindJsxElement":
    {
      const view = context.ast.as.AsJsxElement(node);
      if (view === undefined) return defect("the checker gave no JsxElement view of a JsxElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const openingElement_ = one(context, view.OpeningElement, id, isGroup55);
      const children_ = list(context, view.Children, id, isGroup56);
      const closingElement_ = one(context, view.ClosingElement, id, isGroup57);
      return { kind: "JsxElement", ...header, openingElement: openingElement_, children: children_, closingElement: closingElement_, tsonic: null };
    }
    case "KindJsxAttributes":
    {
      const view = context.ast.as.AsJsxAttributes(node);
      if (view === undefined) return defect("the checker gave no JsxAttributes view of a JsxAttributes node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const properties_ = list(context, view.Properties, id, isGroup58);
      return { kind: "JsxAttributes", ...header, properties: properties_, tsonic: null };
    }
    case "KindJsxNamespacedName":
    {
      const view = context.ast.as.AsJsxNamespacedName(node);
      if (view === undefined) return defect("the checker gave no JsxNamespacedName view of a JsxNamespacedName node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const namespace_ = one(context, view.Namespace, id, isGroup2);
      const name_ = one(context, view.name, id, isGroup2);
      return { kind: "JsxNamespacedName", ...header, namespace: namespace_, name: name_, tsonic: null };
    }
    case "KindJsxOpeningElement":
    {
      const view = context.ast.as.AsJsxOpeningElement(node);
      if (view === undefined) return defect("the checker gave no JsxOpeningElement view of a JsxOpeningElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup59);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const attributes_ = one(context, view.Attributes, id, isGroup60);
      return { kind: "JsxOpeningElement", ...header, tagName: tagName_, typeArguments: typeArguments_, attributes: attributes_, tsonic: null };
    }
    case "KindJsxSelfClosingElement":
    {
      const view = context.ast.as.AsJsxSelfClosingElement(node);
      if (view === undefined) return defect("the checker gave no JsxSelfClosingElement view of a JsxSelfClosingElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup59);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const attributes_ = one(context, view.Attributes, id, isGroup60);
      return { kind: "JsxSelfClosingElement", ...header, tagName: tagName_, typeArguments: typeArguments_, attributes: attributes_, tsonic: null };
    }
    case "KindJsxFragment":
    {
      const view = context.ast.as.AsJsxFragment(node);
      if (view === undefined) return defect("the checker gave no JsxFragment view of a JsxFragment node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const openingFragment_ = one(context, view.OpeningFragment, id, isGroup61);
      const children_ = list(context, view.Children, id, isGroup56);
      const closingFragment_ = one(context, view.ClosingFragment, id, isGroup62);
      return { kind: "JsxFragment", ...header, openingFragment: openingFragment_, children: children_, closingFragment: closingFragment_, tsonic: null };
    }
    case "KindJsxOpeningFragment":
    {
      return { kind: "JsxOpeningFragment", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindJsxClosingFragment":
    {
      return { kind: "JsxClosingFragment", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindJsxAttribute":
    {
      const view = context.ast.as.AsJsxAttribute(node);
      if (view === undefined) return defect("the checker gave no JsxAttribute view of a JsxAttribute node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup63);
      const initializer_ = oneOrNull(context, view.Initializer, id, isGroup64);
      return { kind: "JsxAttribute", ...header, name: name_, initializer: initializer_, tsonic: null };
    }
    case "KindJsxSpreadAttribute":
    {
      const view = context.ast.as.AsJsxSpreadAttribute(node);
      if (view === undefined) return defect("the checker gave no JsxSpreadAttribute view of a JsxSpreadAttribute node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      return { kind: "JsxSpreadAttribute", ...header, expression: expression_, tsonic: null };
    }
    case "KindJsxClosingElement":
    {
      const view = context.ast.as.AsJsxClosingElement(node);
      if (view === undefined) return defect("the checker gave no JsxClosingElement view of a JsxClosingElement node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup59);
      return { kind: "JsxClosingElement", ...header, tagName: tagName_, tsonic: null };
    }
    case "KindJsxExpression":
    {
      const view = context.ast.as.AsJsxExpression(node);
      if (view === undefined) return defect("the checker gave no JsxExpression view of a JsxExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const dotDotDotToken_ = oneOrNull(context, view.DotDotDotToken, id, isGroup19);
      const expression_ = oneOrNull(context, view.Expression, id, isGroup3);
      return { kind: "JsxExpression", ...header, dotDotDotToken: dotDotDotToken_, expression: expression_, tsonic: null };
    }
    case "KindJsxText":
    {
      const view = context.ast.as.AsJsxText(node);
      if (view === undefined) return defect("the checker gave no JsxText view of a JsxText node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = view.Text;
      const tokenFlags_ = tokenFlags(view.TokenFlags);
      const containsOnlyTriviaWhiteSpaces_ = view.ContainsOnlyTriviaWhiteSpaces;
      return { kind: "JsxText", ...header, text: text_, tokenFlags: tokenFlags_, containsOnlyTriviaWhiteSpaces: containsOnlyTriviaWhiteSpaces_, tsonic: null };
    }
    case "KindSyntaxList":
    {
      const view = context.ast.as.AsSyntaxList(node);
      if (view === undefined) return defect("the checker gave no SyntaxList view of a SyntaxList node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const children_ = view.Children.map(child => one(context, child, id, isSyntax));
      return { kind: "SyntaxList", ...header, children: children_, tsonic: null };
    }
    case "KindJSDoc":
    {
      const view = context.ast.as.AsJSDoc(node);
      if (view === undefined) return defect("the checker gave no JSDoc view of a JSDoc node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const comment_ = list(context, view.Comment, id, isGroup65);
      const tags_ = listOrNull(context, view.Tags, id, isGroup0);
      return { kind: "JSDoc", ...header, comment: comment_, tags: tags_, tsonic: null };
    }
    case "KindJSDocTypeExpression":
    {
      const view = context.ast.as.AsJSDocTypeExpression(node);
      if (view === undefined) return defect("the checker gave no JSDocTypeExpression view of a JSDocTypeExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSDocTypeExpression", ...header, type: type_, tsonic: null };
    }
    case "KindJSDocNonNullableType":
    {
      const view = context.ast.as.AsJSDocNonNullableType(node);
      if (view === undefined) return defect("the checker gave no JSDocNonNullableType view of a JSDocNonNullableType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSDocNonNullableType", ...header, type: type_, tsonic: null };
    }
    case "KindJSDocNullableType":
    {
      const view = context.ast.as.AsJSDocNullableType(node);
      if (view === undefined) return defect("the checker gave no JSDocNullableType view of a JSDocNullableType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSDocNullableType", ...header, type: type_, tsonic: null };
    }
    case "KindJSDocAllType":
    {
      return { kind: "JSDocAllType", ...headerOf(context, node, context.next(node), parent), tsonic: null };
    }
    case "KindJSDocVariadicType":
    {
      const view = context.ast.as.AsJSDocVariadicType(node);
      if (view === undefined) return defect("the checker gave no JSDocVariadicType view of a JSDocVariadicType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSDocVariadicType", ...header, type: type_, tsonic: null };
    }
    case "KindJSDocOptionalType":
    {
      const view = context.ast.as.AsJSDocOptionalType(node);
      if (view === undefined) return defect("the checker gave no JSDocOptionalType view of a JSDocOptionalType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const type_ = one(context, view.Type, id, isGroup17);
      return { kind: "JSDocOptionalType", ...header, type: type_, tsonic: null };
    }
    case "KindJSDocTypeTag":
    {
      const view = context.ast.as.AsJSDocTypeTag(node);
      if (view === undefined) return defect("the checker gave no JSDocTypeTag view of a JSDocTypeTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = one(context, view.TypeExpression, id, isGroup66);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocTypeTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocUnknownTag":
    {
      const view = context.ast.as.AsJSDocUnknownTag(node);
      if (view === undefined) return defect("the checker gave no JSDocUnknownTag view of a JSDocUnknownTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocUnknownTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocTemplateTag":
    {
      const view = context.ast.as.AsJSDocTemplateTag(node);
      if (view === undefined) return defect("the checker gave no JSDocTemplateTag view of a JSDocTemplateTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const constraint_ = one(context, view.Constraint, id, isGroup66);
      const typeParameters_ = list(context, view.TypeParameters, id, isGroup23);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocTemplateTag", ...header, tagName: tagName_, constraint: constraint_, typeParameters: typeParameters_, comment: comment_, tsonic: null };
    }
    case "KindJSDocReturnTag":
    {
      const view = context.ast.as.AsJSDocReturnTag(node);
      if (view === undefined) return defect("the checker gave no JSDocReturnTag view of a JSDocReturnTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = oneOrNull(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocReturnTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocPublicTag":
    {
      const view = context.ast.as.AsJSDocPublicTag(node);
      if (view === undefined) return defect("the checker gave no JSDocPublicTag view of a JSDocPublicTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocPublicTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocPrivateTag":
    {
      const view = context.ast.as.AsJSDocPrivateTag(node);
      if (view === undefined) return defect("the checker gave no JSDocPrivateTag view of a JSDocPrivateTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocPrivateTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocProtectedTag":
    {
      const view = context.ast.as.AsJSDocProtectedTag(node);
      if (view === undefined) return defect("the checker gave no JSDocProtectedTag view of a JSDocProtectedTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocProtectedTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocReadonlyTag":
    {
      const view = context.ast.as.AsJSDocReadonlyTag(node);
      if (view === undefined) return defect("the checker gave no JSDocReadonlyTag view of a JSDocReadonlyTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocReadonlyTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocOverrideTag":
    {
      const view = context.ast.as.AsJSDocOverrideTag(node);
      if (view === undefined) return defect("the checker gave no JSDocOverrideTag view of a JSDocOverrideTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocOverrideTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocDeprecatedTag":
    {
      const view = context.ast.as.AsJSDocDeprecatedTag(node);
      if (view === undefined) return defect("the checker gave no JSDocDeprecatedTag view of a JSDocDeprecatedTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocDeprecatedTag", ...header, tagName: tagName_, comment: comment_, tsonic: null };
    }
    case "KindJSDocSeeTag":
    {
      const view = context.ast.as.AsJSDocSeeTag(node);
      if (view === undefined) return defect("the checker gave no JSDocSeeTag view of a JSDocSeeTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const nameExpression_ = one(context, view.NameExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocSeeTag", ...header, tagName: tagName_, nameExpression: nameExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocImplementsTag":
    {
      const view = context.ast.as.AsJSDocImplementsTag(node);
      if (view === undefined) return defect("the checker gave no JSDocImplementsTag view of a JSDocImplementsTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const className_ = one(context, view.ClassName, id, isGroup28);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocImplementsTag", ...header, tagName: tagName_, className: className_, comment: comment_, tsonic: null };
    }
    case "KindJSDocAugmentsTag":
    {
      const view = context.ast.as.AsJSDocAugmentsTag(node);
      if (view === undefined) return defect("the checker gave no JSDocAugmentsTag view of a JSDocAugmentsTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const className_ = one(context, view.ClassName, id, isGroup28);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocAugmentsTag", ...header, tagName: tagName_, className: className_, comment: comment_, tsonic: null };
    }
    case "KindJSDocSatisfiesTag":
    {
      const view = context.ast.as.AsJSDocSatisfiesTag(node);
      if (view === undefined) return defect("the checker gave no JSDocSatisfiesTag view of a JSDocSatisfiesTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = one(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocSatisfiesTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocThrowsTag":
    {
      const view = context.ast.as.AsJSDocThrowsTag(node);
      if (view === undefined) return defect("the checker gave no JSDocThrowsTag view of a JSDocThrowsTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = oneOrNull(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocThrowsTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocThisTag":
    {
      const view = context.ast.as.AsJSDocThisTag(node);
      if (view === undefined) return defect("the checker gave no JSDocThisTag view of a JSDocThisTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = one(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocThisTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocImportTag":
    {
      const view = context.ast.as.AsJSDocImportTag(node);
      if (view === undefined) return defect("the checker gave no JSDocImportTag view of a JSDocImportTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const importClause_ = oneOrNull(context, view.ImportClause, id, isGroup32);
      const moduleSpecifier_ = one(context, view.ModuleSpecifier, id, isGroup3);
      const attributes_ = oneOrNull(context, view.Attributes, id, isGroup33);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocImportTag", ...header, tagName: tagName_, importClause: importClause_, moduleSpecifier: moduleSpecifier_, attributes: attributes_, comment: comment_, tsonic: null };
    }
    case "KindJSDocCallbackTag":
    {
      const view = context.ast.as.AsJSDocCallbackTag(node);
      if (view === undefined) return defect("the checker gave no JSDocCallbackTag view of a JSDocCallbackTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = one(context, view.TypeExpression, id, isGroup17);
      const name_ = oneOrNull(context, view.name, id, isGroup67);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocCallbackTag", ...header, tagName: tagName_, typeExpression: typeExpression_, name: name_, comment: comment_, tsonic: null };
    }
    case "KindJSDocOverloadTag":
    {
      const view = context.ast.as.AsJSDocOverloadTag(node);
      if (view === undefined) return defect("the checker gave no JSDocOverloadTag view of a JSDocOverloadTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = one(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocOverloadTag", ...header, tagName: tagName_, typeExpression: typeExpression_, comment: comment_, tsonic: null };
    }
    case "KindJSDocTypedefTag":
    {
      const view = context.ast.as.AsJSDocTypedefTag(node);
      if (view === undefined) return defect("the checker gave no JSDocTypedefTag view of a JSDocTypedefTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const typeExpression_ = oneOrNull(context, view.TypeExpression, id, isGroup66);
      const name_ = oneOrNull(context, view.name, id, isGroup67);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      return { kind: "JSDocTypedefTag", ...header, tagName: tagName_, typeExpression: typeExpression_, name: name_, comment: comment_, tsonic: null };
    }
    case "KindJSDocSignature":
    {
      const view = context.ast.as.AsJSDocSignature(node);
      if (view === undefined) return defect("the checker gave no JSDocSignature view of a JSDocSignature node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const typeParameters_ = listOrNull(context, view.TypeParameters, id, isGroup23);
      const parameters_ = list(context, view.Parameters, id, isGroup24);
      const type_ = oneOrNull(context, view.Type, id, isGroup17);
      const fullSignature_ = oneOrNull(context, view.FullSignature, id, isGroup17);
      return { kind: "JSDocSignature", ...header, typeParameters: typeParameters_, parameters: parameters_, type: type_, fullSignature: fullSignature_, tsonic: null };
    }
    case "KindJSDocNameReference":
    {
      const view = context.ast.as.AsJSDocNameReference(node);
      if (view === undefined) return defect("the checker gave no JSDocNameReference view of a JSDocNameReference node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = one(context, view.name, id, isGroup1);
      return { kind: "JSDocNameReference", ...header, name: name_, tsonic: null };
    }
    case "KindSourceFile":
    {
      const view = context.file;
      if (view === undefined) return defect("the checker gave no SourceFile view of a SourceFile node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const statements_ = list(context, view.Statements, id, isGroup5);
      const endOfFileToken_ = one(context, view.EndOfFileToken, id, isGroup68);
      const languageVariant_ = languageVariant(view.LanguageVariant);
      const scriptKind_ = scriptKind(view.ScriptKind);
      const commentDirectives_ = commentDirectives(context, view.CommentDirectives);
      const pragmas_ = pragmas(view.Pragmas);
      const checkJsDirective_ = checkJsDirective(view.CheckJsDirective);
      return { kind: "SourceFile", ...header, statements: statements_, endOfFileToken: endOfFileToken_, languageVariant: languageVariant_, scriptKind: scriptKind_, commentDirectives: commentDirectives_, pragmas: pragmas_, checkJsDirective: checkJsDirective_, tsonic: null };
    }
    case "KindModuleDeclaration":
    {
      const view = context.ast.as.AsModuleDeclaration(node);
      if (view === undefined) return defect("the checker gave no ModuleDeclaration view of a ModuleDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const asteriskToken_ = oneOrNull(context, view.AsteriskToken, id, isGroup22);
      const name_ = one(context, view.name, id, isGroup35);
      const body_ = oneOrNull(context, view.Body, id, isGroup69);
      const keyword_ = moduleKeyword(context, node);
      return { kind: "ModuleDeclaration", ...header, modifiers: modifiers_, asteriskToken: asteriskToken_, name: name_, body: body_, keyword: keyword_, tsonic: null };
    }
    case "KindImportEqualsDeclaration":
    {
      const view = context.ast.as.AsImportEqualsDeclaration(node);
      if (view === undefined) return defect("the checker gave no ImportEqualsDeclaration view of a ImportEqualsDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const moduleReference_ = one(context, view.ModuleReference, id, isGroup70);
      const isTypeOnly_ = view.IsTypeOnly;
      return { kind: "ImportEqualsDeclaration", ...header, modifiers: modifiers_, name: name_, moduleReference: moduleReference_, isTypeOnly: isTypeOnly_, tsonic: null };
    }
    case "KindExportDeclaration":
    {
      const view = context.ast.as.AsExportDeclaration(node);
      if (view === undefined) return defect("the checker gave no ExportDeclaration view of a ExportDeclaration node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const exportClause_ = oneOrNull(context, view.ExportClause, id, isGroup71);
      const moduleSpecifier_ = oneOrNull(context, view.ModuleSpecifier, id, isGroup3);
      const attributes_ = oneOrNull(context, view.Attributes, id, isGroup33);
      const isTypeOnly_ = view.IsTypeOnly;
      return { kind: "ExportDeclaration", ...header, modifiers: modifiers_, exportClause: exportClause_, moduleSpecifier: moduleSpecifier_, attributes: attributes_, isTypeOnly: isTypeOnly_, tsonic: null };
    }
    case "KindImportType":
    {
      const view = context.ast.as.AsImportTypeNode(node);
      if (view === undefined) return defect("the checker gave no ImportTypeNode view of a ImportType node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const argument_ = one(context, view.Argument, id, isGroup17);
      const attributes_ = oneOrNull(context, view.Attributes, id, isGroup33);
      const qualifier_ = oneOrNull(context, view.Qualifier, id, isGroup1);
      const typeArguments_ = listOrNull(context, view.TypeArguments, id, isGroup17);
      const isTypeOf_ = view.IsTypeOf;
      return { kind: "ImportType", ...header, argument: argument_, attributes: attributes_, qualifier: qualifier_, typeArguments: typeArguments_, isTypeOf: isTypeOf_, tsonic: null };
    }
    case "KindImportClause":
    {
      const view = context.ast.as.AsImportClause(node);
      if (view === undefined) return defect("the checker gave no ImportClause view of a ImportClause node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = oneOrNull(context, view.name, id, isGroup2);
      const namedBindings_ = oneOrNull(context, view.NamedBindings, id, isGroup72);
      const phaseModifier_ = phaseModifier(context, node, view.PhaseModifier);
      return { kind: "ImportClause", ...header, name: name_, namedBindings: namedBindings_, phaseModifier: phaseModifier_, tsonic: null };
    }
    case "KindImportSpecifier":
    {
      const view = context.ast.as.AsImportSpecifier(node);
      if (view === undefined) return defect("the checker gave no ImportSpecifier view of a ImportSpecifier node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const propertyName_ = oneOrNull(context, view.PropertyName, id, isGroup35);
      const name_ = one(context, view.name, id, isGroup2);
      const isTypeOnly_ = view.IsTypeOnly;
      return { kind: "ImportSpecifier", ...header, propertyName: propertyName_, name: name_, isTypeOnly: isTypeOnly_, tsonic: null };
    }
    case "KindJSDocText":
    {
      const view = context.ast.as.AsJSDocText(node);
      if (view === undefined) return defect("the checker gave no JSDocText view of a JSDocText node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const text_ = jsDocText(view.text);
      return { kind: "JSDocText", ...header, text: text_, tsonic: null };
    }
    case "KindJSDocLink":
    {
      const view = context.ast.as.AsJSDocLink(node);
      if (view === undefined) return defect("the checker gave no JSDocLink view of a JSDocLink node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = oneOrNull(context, view.name, id, isGroup1);
      const text_ = jsDocText(view.text);
      return { kind: "JSDocLink", ...header, name: name_, text: text_, tsonic: null };
    }
    case "KindJSDocLinkPlain":
    {
      const view = context.ast.as.AsJSDocLinkPlain(node);
      if (view === undefined) return defect("the checker gave no JSDocLinkPlain view of a JSDocLinkPlain node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = oneOrNull(context, view.name, id, isGroup1);
      const text_ = jsDocText(view.text);
      return { kind: "JSDocLinkPlain", ...header, name: name_, text: text_, tsonic: null };
    }
    case "KindJSDocLinkCode":
    {
      const view = context.ast.as.AsJSDocLinkCode(node);
      if (view === undefined) return defect("the checker gave no JSDocLinkCode view of a JSDocLinkCode node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const name_ = oneOrNull(context, view.name, id, isGroup1);
      const text_ = jsDocText(view.text);
      return { kind: "JSDocLinkCode", ...header, name: name_, text: text_, tsonic: null };
    }
    case "KindTypeParameter":
    {
      const view = context.ast.as.AsTypeParameterDeclaration(node);
      if (view === undefined) return defect("the checker gave no TypeParameterDeclaration view of a TypeParameter node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const modifiers_ = modifierList(context, view.modifiers, id, isGroup13);
      const name_ = one(context, view.name, id, isGroup2);
      const constraint_ = oneOrNull(context, view.Constraint, id, isGroup17);
      const expression_ = oneOrNull(context, view.Expression, id, isGroup3);
      const defaultType_ = oneOrNull(context, view.DefaultType, id, isGroup17);
      return { kind: "TypeParameter", ...header, modifiers: modifiers_, name: name_, constraint: constraint_, expression: expression_, defaultType: defaultType_, tsonic: null };
    }
    case "KindSyntheticReferenceExpression":
    {
      const view = context.ast.as.AsSyntheticReferenceExpression(node);
      if (view === undefined) return defect("the checker gave no SyntheticReferenceExpression view of a SyntheticReferenceExpression node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const expression_ = one(context, view.Expression, id, isGroup3);
      const thisArg_ = one(context, view.ThisArg, id, isGroup3);
      return { kind: "SyntheticReferenceExpression", ...header, expression: expression_, thisArg: thisArg_, tsonic: null };
    }
    case "KindJSDocTypeLiteral":
    {
      const view = context.ast.as.AsJSDocTypeLiteral(node);
      if (view === undefined) return defect("the checker gave no JSDocTypeLiteral view of a JSDocTypeLiteral node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const jsDocPropertyTags_ = view.JSDocPropertyTags === undefined ? null : view.JSDocPropertyTags.map(child => one(context, child, id, isGroup0));
      const isArrayType_ = view.IsArrayType;
      return { kind: "JSDocTypeLiteral", ...header, jsDocPropertyTags: jsDocPropertyTags_, isArrayType: isArrayType_, tsonic: null };
    }
    case "KindJSDocParameterTag":
    {
      const view = context.ast.as.AsJSDocParameterOrPropertyTag(node);
      if (view === undefined) return defect("the checker gave no JSDocParameterOrPropertyTag view of a JSDocParameterTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const name_ = one(context, view.name, id, isGroup1);
      const typeExpression_ = oneOrNull(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      const isBracketed_ = view.IsBracketed;
      const isNameFirst_ = view.IsNameFirst;
      return { kind: "JSDocParameterTag", ...header, tagName: tagName_, name: name_, typeExpression: typeExpression_, comment: comment_, isBracketed: isBracketed_, isNameFirst: isNameFirst_, tsonic: null };
    }
    case "KindJSDocPropertyTag":
    {
      const view = context.ast.as.AsJSDocParameterOrPropertyTag(node);
      if (view === undefined) return defect("the checker gave no JSDocParameterOrPropertyTag view of a JSDocParameterTag node");
      const id = context.next(node);
      const header = headerOf(context, node, id, parent);
      const tagName_ = one(context, view.TagName, id, isGroup2);
      const name_ = one(context, view.name, id, isGroup1);
      const typeExpression_ = oneOrNull(context, view.TypeExpression, id, isGroup17);
      const comment_ = listOrNull(context, view.Comment, id, isGroup65);
      const isBracketed_ = view.IsBracketed;
      const isNameFirst_ = view.IsNameFirst;
      return { kind: "JSDocPropertyTag", ...header, tagName: tagName_, name: name_, typeExpression: typeExpression_, comment: comment_, isBracketed: isBracketed_, isNameFirst: isNameFirst_, tsonic: null };
    }
    default:
      return defect(`the checker's syntax kind ${context.ast.kindName(node)} has no HIR syntax kind`);
  }
}
