import type { BinaryExpression, BinarySyntaxReceipt, Block, BlockSyntaxReceipt, BodyRoot, CopySyntaxForest, ModifierLike, Statement, TypeNode,
  FinishSyntaxCopy, Phase, PrepareSyntaxCopy, SyntaxCopyResult, SyntaxForest, SyntaxImage,
  SyntaxInitializerImage, SyntaxMaterialization, SyntaxNode, SyntaxPhaseCopy } from "./contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { borrowedSyntaxPlan, copied, planSyntaxNode } from "./copy-node.js";
import { createStatementsPlans } from "./copy-statements.js";
import { createExpressionsPlans } from "./copy-expressions.js";
import { createTypesPlans } from "./copy-types.js";
import { createAuxiliaryPlans } from "./copy-auxiliary.js";

const missingPreparation: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "Every admitted syntax node must have its own prepared projection." };
const consumedPreparation: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "An admitted syntax forest owns one consuming materialization." };
const forgetKind = () => undefined;

interface AdmittedPlan<P extends Phase, Stop, Image> {
  readonly original: SyntaxNode<P>;
  readonly kind: SyntaxNode<P>["kind"];
  readonly plan: SyntaxPlan<SyntaxNode<P>, Stop, Image>;
}

function statementRole<P extends Phase>(_node: SyntaxNode<P>, kind: SyntaxNode<P>["kind"]): _node is Statement<P> {
  switch (kind) {
    case "EmptyStatement": case "IfStatement": case "DoStatement": case "WhileStatement":
    case "ForStatement": case "ForInStatement": case "ForOfStatement": case "BreakStatement":
    case "ContinueStatement": case "ReturnStatement": case "WithStatement": case "SwitchStatement":
    case "ThrowStatement": case "TryStatement": case "DebuggerStatement": case "LabeledStatement":
    case "ExpressionStatement": case "Block": case "VariableStatement": case "MissingDeclaration":
    case "FunctionDeclaration": case "ClassDeclaration": case "InterfaceDeclaration":
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": case "EnumDeclaration":
    case "ModuleBlock": case "NotEmittedStatement": case "ImportDeclaration": case "JSImportDeclaration":
    case "ExportAssignment": case "NamespaceExportDeclaration": case "ModuleDeclaration":
    case "ImportEqualsDeclaration": case "ExportDeclaration":
      return true;
    default: return false;
  }
}

function typeRole<P extends Phase>(_node: SyntaxNode<P>, kind: SyntaxNode<P>["kind"]): _node is TypeNode<P> {
  switch (kind) {
    case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword": case "IntrinsicKeyword":
    case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword": case "StringKeyword":
    case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword": case "VoidKeyword":
    case "UnionType": case "IntersectionType": case "ConditionalType": case "TypeOperator":
    case "InferType": case "ArrayType": case "IndexedAccessType": case "TypeReference":
    case "LiteralType": case "ThisType": case "TypePredicate": case "TypeQuery": case "MappedType":
    case "TypeLiteral": case "TupleType": case "NamedTupleMember": case "OptionalType": case "RestType":
    case "ParenthesizedType": case "FunctionType": case "ConstructorType": case "TemplateLiteralType":
    case "TemplateLiteralTypeSpan": case "JSDocTypeExpression": case "JSDocNonNullableType":
    case "JSDocNullableType": case "JSDocAllType": case "JSDocVariadicType": case "JSDocOptionalType":
    case "JSDocSignature": case "JSDocNameReference": case "ImportType": case "JSDocTypeLiteral":
      return true;
    default: return false;
  }
}

function modifierRole<P extends Phase>(_node: SyntaxNode<P>, kind: SyntaxNode<P>["kind"]): _node is ModifierLike<P> {
  switch (kind) {
    case "AbstractKeyword": case "AccessorKeyword": case "AsyncKeyword": case "ConstKeyword":
    case "DeclareKeyword": case "DefaultKeyword": case "ExportKeyword": case "InKeyword":
    case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "ReadonlyKeyword":
    case "OutKeyword": case "OverrideKeyword": case "StaticKeyword": case "Decorator":
      return true;
    default: return false;
  }
}

function rootRole<P extends Phase>(_node: SyntaxNode<P>, kind: SyntaxNode<P>["kind"]): _node is BodyRoot<P> {
  switch (kind) {
    case "Block": case "SourceFile": case "Identifier": case "PrivateIdentifier": case "ClassExpression":
    case "OmittedExpression": case "NullKeyword": case "TrueKeyword": case "FalseKeyword":
    case "ThisKeyword": case "SuperKeyword": case "ImportKeyword": case "StringLiteral":
    case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral": case "BinaryExpression": case "PrefixUnaryExpression":
    case "PostfixUnaryExpression": case "YieldExpression": case "ArrowFunction":
    case "FunctionExpression": case "AsExpression": case "SatisfiesExpression":
    case "ConditionalExpression": case "PropertyAccessExpression": case "ElementAccessExpression":
    case "CallExpression": case "NewExpression": case "MetaProperty": case "NonNullExpression":
    case "SpreadElement": case "TemplateExpression": case "TaggedTemplateExpression":
    case "ParenthesizedExpression": case "ArrayLiteralExpression": case "ObjectLiteralExpression":
    case "DeleteExpression": case "TypeOfExpression": case "VoidExpression": case "AwaitExpression":
    case "TypeAssertionExpression": case "ExpressionWithTypeArguments": case "PartiallyEmittedExpression":
    case "JsxElement": case "JsxAttributes": case "JsxNamespacedName": case "JsxOpeningElement":
    case "JsxSelfClosingElement": case "JsxFragment": case "JsxOpeningFragment":
    case "JsxClosingFragment": case "JsxExpression": case "JsxText": case "SyntheticReferenceExpression":
      return true;
    default: return false;
  }
}

function createSyntaxPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>,
  initializer: SyntaxInitializerImage<P, Image>,
  blockOf: (node: Block<P>) => BlockSyntaxReceipt<P>,
  binaryOf: (node: BinaryExpression<P>) => BinarySyntaxReceipt<P>): SyntaxCopyPorts<P, Stop, Image> {
  const statements = createStatementsPlans(phase, () => ports, initializer, blockOf);
  const expressions = createExpressionsPlans(phase, () => ports, binaryOf);
  const types = createTypesPlans(phase, () => ports);
  const auxiliary = createAuxiliaryPlans(phase, () => ports);
  const ports: SyntaxCopyPorts<P, Stop, Image> = {
    ...statements, ...expressions, ...types, ...auxiliary,
    SyntaxNode: node => planSyntaxNode(ports, node, forgetKind),
    EntityName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "QualifiedName": return ports.QualifiedName(node);
      }
    },
    Expression: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "PrivateIdentifier": return ports.PrivateIdentifier(node);
        case "ClassExpression": return ports.ClassExpression(node);
        case "OmittedExpression": return ports.OmittedExpression(node);
        case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword": return ports.KeywordExpression(node);
        case "StringLiteral": return ports.StringLiteral(node);
        case "NumericLiteral": return ports.NumericLiteral(node);
        case "BigIntLiteral": return ports.BigIntLiteral(node);
        case "RegularExpressionLiteral": return ports.RegularExpressionLiteral(node);
        case "NoSubstitutionTemplateLiteral": return ports.NoSubstitutionTemplateLiteral(node);
        case "BinaryExpression": return ports.BinaryExpression(node);
        case "PrefixUnaryExpression": return ports.PrefixUnaryExpression(node);
        case "PostfixUnaryExpression": return ports.PostfixUnaryExpression(node);
        case "YieldExpression": return ports.YieldExpression(node);
        case "ArrowFunction": return ports.ArrowFunction(node);
        case "FunctionExpression": return ports.FunctionExpression(node);
        case "AsExpression": return ports.AsExpression(node);
        case "SatisfiesExpression": return ports.SatisfiesExpression(node);
        case "ConditionalExpression": return ports.ConditionalExpression(node);
        case "PropertyAccessExpression": return ports.PropertyAccessExpression(node);
        case "ElementAccessExpression": return ports.ElementAccessExpression(node);
        case "CallExpression": return ports.CallExpression(node);
        case "NewExpression": return ports.NewExpression(node);
        case "MetaProperty": return ports.MetaProperty(node);
        case "NonNullExpression": return ports.NonNullExpression(node);
        case "SpreadElement": return ports.SpreadElement(node);
        case "TemplateExpression": return ports.TemplateExpression(node);
        case "TaggedTemplateExpression": return ports.TaggedTemplateExpression(node);
        case "ParenthesizedExpression": return ports.ParenthesizedExpression(node);
        case "ArrayLiteralExpression": return ports.ArrayLiteralExpression(node);
        case "ObjectLiteralExpression": return ports.ObjectLiteralExpression(node);
        case "DeleteExpression": return ports.DeleteExpression(node);
        case "TypeOfExpression": return ports.TypeOfExpression(node);
        case "VoidExpression": return ports.VoidExpression(node);
        case "AwaitExpression": return ports.AwaitExpression(node);
        case "TypeAssertionExpression": return ports.TypeAssertion(node);
        case "ExpressionWithTypeArguments": return ports.ExpressionWithTypeArguments(node);
        case "PartiallyEmittedExpression": return ports.PartiallyEmittedExpression(node);
        case "JsxElement": return ports.JsxElement(node);
        case "JsxAttributes": return ports.JsxAttributes(node);
        case "JsxNamespacedName": return ports.JsxNamespacedName(node);
        case "JsxOpeningElement": return ports.JsxOpeningElement(node);
        case "JsxSelfClosingElement": return ports.JsxSelfClosingElement(node);
        case "JsxFragment": return ports.JsxFragment(node);
        case "JsxOpeningFragment": return ports.JsxOpeningFragment(node);
        case "JsxClosingFragment": return ports.JsxClosingFragment(node);
        case "JsxExpression": return ports.JsxExpression(node);
        case "JsxText": return ports.JsxText(node);
        case "SyntheticReferenceExpression": return ports.SyntheticReferenceExpression(node);
      }
    },
    LeftHandSideExpression: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "PrivateIdentifier": return ports.PrivateIdentifier(node);
        case "ClassExpression": return ports.ClassExpression(node);
        case "StringLiteral": return ports.StringLiteral(node);
        case "NumericLiteral": return ports.NumericLiteral(node);
        case "BigIntLiteral": return ports.BigIntLiteral(node);
        case "RegularExpressionLiteral": return ports.RegularExpressionLiteral(node);
        case "FunctionExpression": return ports.FunctionExpression(node);
        case "PropertyAccessExpression": return ports.PropertyAccessExpression(node);
        case "ElementAccessExpression": return ports.ElementAccessExpression(node);
        case "CallExpression": return ports.CallExpression(node);
        case "NewExpression": return ports.NewExpression(node);
        case "MetaProperty": return ports.MetaProperty(node);
        case "NonNullExpression": return ports.NonNullExpression(node);
        case "TemplateExpression": return ports.TemplateExpression(node);
        case "TaggedTemplateExpression": return ports.TaggedTemplateExpression(node);
        case "ParenthesizedExpression": return ports.ParenthesizedExpression(node);
        case "ArrayLiteralExpression": return ports.ArrayLiteralExpression(node);
        case "ObjectLiteralExpression": return ports.ObjectLiteralExpression(node);
        case "ExpressionWithTypeArguments": return ports.ExpressionWithTypeArguments(node);
        case "PartiallyEmittedExpression": return ports.PartiallyEmittedExpression(node);
        case "JsxElement": return ports.JsxElement(node);
        case "JsxAttributes": return ports.JsxAttributes(node);
        case "JsxSelfClosingElement": return ports.JsxSelfClosingElement(node);
        case "JsxFragment": return ports.JsxFragment(node);
      }
    },
    Statement: node => {
      switch (node.kind) {
        case "EmptyStatement": return ports.EmptyStatement(node);
        case "IfStatement": return ports.IfStatement(node);
        case "DoStatement": return ports.DoStatement(node);
        case "WhileStatement": return ports.WhileStatement(node);
        case "ForStatement": return ports.ForStatement(node);
        case "ForInStatement": return ports.ForInStatement(node);
        case "ForOfStatement": return ports.ForOfStatement(node);
        case "BreakStatement": return ports.BreakStatement(node);
        case "ContinueStatement": return ports.ContinueStatement(node);
        case "ReturnStatement": return ports.ReturnStatement(node);
        case "WithStatement": return ports.WithStatement(node);
        case "SwitchStatement": return ports.SwitchStatement(node);
        case "ThrowStatement": return ports.ThrowStatement(node);
        case "TryStatement": return ports.TryStatement(node);
        case "DebuggerStatement": return ports.DebuggerStatement(node);
        case "LabeledStatement": return ports.LabeledStatement(node);
        case "ExpressionStatement": return ports.ExpressionStatement(node);
        case "Block": return ports.Block(node);
        case "VariableStatement": return ports.VariableStatement(node);
        case "MissingDeclaration": return ports.MissingDeclaration(node);
        case "FunctionDeclaration": return ports.FunctionDeclaration(node);
        case "ClassDeclaration": return ports.ClassDeclaration(node);
        case "InterfaceDeclaration": return ports.InterfaceDeclaration(node);
        case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return ports.TypeAliasDeclaration(node);
        case "EnumDeclaration": return ports.EnumDeclaration(node);
        case "ModuleBlock": return ports.ModuleBlock(node);
        case "NotEmittedStatement": return ports.NotEmittedStatement(node);
        case "ImportDeclaration": case "JSImportDeclaration": return ports.ImportDeclaration(node);
        case "ExportAssignment": return ports.ExportAssignment(node);
        case "NamespaceExportDeclaration": return ports.NamespaceExportDeclaration(node);
        case "ModuleDeclaration": return ports.ModuleDeclaration(node);
        case "ImportEqualsDeclaration": return ports.ImportEqualsDeclaration(node);
        case "ExportDeclaration": return ports.ExportDeclaration(node);
      }
    },
    ForInitializer: node => {
      switch (node.kind) {
        case "MissingDeclaration": return ports.MissingDeclaration(node);
        case "VariableDeclarationList": return ports.VariableDeclarationList(node);
      }
      return ports.Expression(node);
    },
    CaseOrDefaultClause: node => {
      switch (node.kind) {
        case "CaseClause": return ports.CaseClause(node);
        case "DefaultClause": return ports.DefaultClause(node);
      }
    },
    BindingName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "ObjectBindingPattern": case "ArrayBindingPattern": return ports.BindingPattern(node);
      }
    },
    TypeNode: node => {
      switch (node.kind) {
        case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword": case "IntrinsicKeyword": case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword": case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword": case "VoidKeyword": return ports.KeywordTypeNode(node);
        case "UnionType": return ports.UnionTypeNode(node);
        case "IntersectionType": return ports.IntersectionTypeNode(node);
        case "ConditionalType": return ports.ConditionalTypeNode(node);
        case "TypeOperator": return ports.TypeOperatorNode(node);
        case "InferType": return ports.InferTypeNode(node);
        case "ArrayType": return ports.ArrayTypeNode(node);
        case "IndexedAccessType": return ports.IndexedAccessTypeNode(node);
        case "TypeReference": return ports.TypeReferenceNode(node);
        case "LiteralType": return ports.LiteralTypeNode(node);
        case "ThisType": return ports.ThisTypeNode(node);
        case "TypePredicate": return ports.TypePredicateNode(node);
        case "TypeQuery": return ports.TypeQueryNode(node);
        case "MappedType": return ports.MappedTypeNode(node);
        case "TypeLiteral": return ports.TypeLiteralNode(node);
        case "TupleType": return ports.TupleTypeNode(node);
        case "NamedTupleMember": return ports.NamedTupleMember(node);
        case "OptionalType": return ports.OptionalTypeNode(node);
        case "RestType": return ports.RestTypeNode(node);
        case "ParenthesizedType": return ports.ParenthesizedTypeNode(node);
        case "FunctionType": return ports.FunctionTypeNode(node);
        case "ConstructorType": return ports.ConstructorTypeNode(node);
        case "TemplateLiteralType": return ports.TemplateLiteralTypeNode(node);
        case "TemplateLiteralTypeSpan": return ports.TemplateLiteralTypeSpan(node);
        case "JSDocTypeExpression": return ports.JSDocTypeExpression(node);
        case "JSDocNonNullableType": return ports.JSDocNonNullableType(node);
        case "JSDocNullableType": return ports.JSDocNullableType(node);
        case "JSDocAllType": return ports.JSDocAllType(node);
        case "JSDocVariadicType": return ports.JSDocVariadicType(node);
        case "JSDocOptionalType": return ports.JSDocOptionalType(node);
        case "JSDocSignature": return ports.JSDocSignature(node);
        case "JSDocNameReference": return ports.JSDocNameReference(node);
        case "ImportType": return ports.ImportTypeNode(node);
        case "JSDocTypeLiteral": return ports.JSDocTypeLiteral(node);
      }
    },
    PropertyName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "StringLiteral": return ports.StringLiteral(node);
        case "NoSubstitutionTemplateLiteral": return ports.NoSubstitutionTemplateLiteral(node);
        case "NumericLiteral": return ports.NumericLiteral(node);
        case "ComputedPropertyName": return ports.ComputedPropertyName(node);
        case "PrivateIdentifier": return ports.PrivateIdentifier(node);
        case "BigIntLiteral": return ports.BigIntLiteral(node);
      }
    },
    BlockOrExpression: node => {
      switch (node.kind) {
        case "Block": return ports.Block(node);
      }
      return ports.Expression(node);
    },
    ClassElement: node => {
      switch (node.kind) {
        case "Constructor": return ports.ConstructorDeclaration(node);
        case "GetAccessor": return ports.GetAccessorDeclaration(node);
        case "SetAccessor": return ports.SetAccessorDeclaration(node);
        case "IndexSignature": return ports.IndexSignatureDeclaration(node);
        case "MethodDeclaration": return ports.MethodDeclaration(node);
        case "PropertyDeclaration": return ports.PropertyDeclaration(node);
        case "SemicolonClassElement": return ports.SemicolonClassElement(node);
        case "ClassStaticBlockDeclaration": return ports.ClassStaticBlockDeclaration(node);
      }
    },
    TypeElement: node => {
      switch (node.kind) {
        case "NotEmittedTypeElement": return ports.NotEmittedTypeElement(node);
        case "CallSignature": return ports.CallSignatureDeclaration(node);
        case "ConstructSignature": return ports.ConstructSignatureDeclaration(node);
        case "GetAccessor": return ports.GetAccessorDeclaration(node);
        case "SetAccessor": return ports.SetAccessorDeclaration(node);
        case "IndexSignature": return ports.IndexSignatureDeclaration(node);
        case "MethodSignature": return ports.MethodSignatureDeclaration(node);
        case "PropertySignature": return ports.PropertySignatureDeclaration(node);
      }
    },
    ModuleExportName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "StringLiteral": return ports.StringLiteral(node);
      }
    },
    MemberName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "PrivateIdentifier": return ports.PrivateIdentifier(node);
      }
    },
    TemplateMiddleOrTail: node => {
      switch (node.kind) {
        case "TemplateMiddle": return ports.TemplateMiddle(node);
        case "TemplateTail": return ports.TemplateTail(node);
      }
    },
    TemplateLiteral: node => {
      switch (node.kind) {
        case "TemplateExpression": return ports.TemplateExpression(node);
        case "NoSubstitutionTemplateLiteral": return ports.NoSubstitutionTemplateLiteral(node);
      }
    },
    ObjectLiteralElementLike: node => {
      switch (node.kind) {
        case "PropertyAssignment": return ports.PropertyAssignment(node);
        case "ShorthandPropertyAssignment": return ports.ShorthandPropertyAssignment(node);
        case "SpreadAssignment": return ports.SpreadAssignment(node);
        case "MethodDeclaration": return ports.MethodDeclaration(node);
        case "GetAccessor": return ports.GetAccessorDeclaration(node);
        case "SetAccessor": return ports.SetAccessorDeclaration(node);
      }
    },
    LiteralTypeChild: node => {
      switch (node.kind) {
        case "StringLiteral": return ports.StringLiteral(node);
        case "NumericLiteral": return ports.NumericLiteral(node);
        case "BigIntLiteral": return ports.BigIntLiteral(node);
        case "NoSubstitutionTemplateLiteral": return ports.NoSubstitutionTemplateLiteral(node);
        case "TrueKeyword": case "FalseKeyword": case "NullKeyword": return ports.LiteralKeywordExpression(node);
        case "PrefixUnaryExpression": return ports.PrefixUnaryExpression(node);
      }
    },
    TypePredicateParameterName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "ThisType": return ports.ThisTypeNode(node);
      }
    },
    ImportAttributeName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "StringLiteral": return ports.StringLiteral(node);
      }
    },
    JsxChild: node => {
      switch (node.kind) {
        case "JsxText": return ports.JsxText(node);
        case "JsxExpression": return ports.JsxExpression(node);
        case "JsxElement": return ports.JsxElement(node);
        case "JsxSelfClosingElement": return ports.JsxSelfClosingElement(node);
        case "JsxFragment": return ports.JsxFragment(node);
      }
    },
    JsxAttributeLike: node => {
      switch (node.kind) {
        case "JsxAttribute": return ports.JsxAttribute(node);
        case "JsxSpreadAttribute": return ports.JsxSpreadAttribute(node);
      }
    },
    JsxTagNameExpression: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword": return ports.KeywordExpression(node);
        case "PropertyAccessExpression": return ports.PropertyAccessExpression(node);
        case "JsxNamespacedName": return ports.JsxNamespacedName(node);
      }
    },
    JsxAttributeName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "JsxNamespacedName": return ports.JsxNamespacedName(node);
      }
    },
    JsxAttributeValue: node => {
      switch (node.kind) {
        case "StringLiteral": return ports.StringLiteral(node);
        case "JsxExpression": return ports.JsxExpression(node);
        case "JsxElement": return ports.JsxElement(node);
        case "JsxSelfClosingElement": return ports.JsxSelfClosingElement(node);
        case "JsxFragment": return ports.JsxFragment(node);
      }
    },
    JSDocComment: node => {
      switch (node.kind) {
        case "JSDocText": return ports.JSDocText(node);
        case "JSDocLink": return ports.JSDocLink(node);
        case "JSDocLinkCode": return ports.JSDocLinkCode(node);
        case "JSDocLinkPlain": return ports.JSDocLinkPlain(node);
      }
    },
    JSDocTag: node => {
      switch (node.kind) {
        case "JSDocTypeTag": return ports.JSDocTypeTag(node);
        case "JSDocUnknownTag": return ports.JSDocUnknownTag(node);
        case "JSDocTemplateTag": return ports.JSDocTemplateTag(node);
        case "JSDocReturnTag": return ports.JSDocReturnTag(node);
        case "JSDocPublicTag": return ports.JSDocPublicTag(node);
        case "JSDocPrivateTag": return ports.JSDocPrivateTag(node);
        case "JSDocProtectedTag": return ports.JSDocProtectedTag(node);
        case "JSDocReadonlyTag": return ports.JSDocReadonlyTag(node);
        case "JSDocOverrideTag": return ports.JSDocOverrideTag(node);
        case "JSDocDeprecatedTag": return ports.JSDocDeprecatedTag(node);
        case "JSDocSeeTag": return ports.JSDocSeeTag(node);
        case "JSDocImplementsTag": return ports.JSDocImplementsTag(node);
        case "JSDocAugmentsTag": return ports.JSDocAugmentsTag(node);
        case "JSDocSatisfiesTag": return ports.JSDocSatisfiesTag(node);
        case "JSDocThrowsTag": return ports.JSDocThrowsTag(node);
        case "JSDocThisTag": return ports.JSDocThisTag(node);
        case "JSDocImportTag": return ports.JSDocImportTag(node);
        case "JSDocCallbackTag": return ports.JSDocCallbackTag(node);
        case "JSDocOverloadTag": return ports.JSDocOverloadTag(node);
        case "JSDocTypedefTag": return ports.JSDocTypedefTag(node);
        case "JSDocParameterTag": case "JSDocPropertyTag": return ports.JSDocParameterOrPropertyTag(node);
      }
    },
    JSDocFullName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "ModuleDeclaration": return ports.ModuleDeclaration(node);
      }
    },
    NodeBody: node => {
      switch (node.kind) {
        case "ModuleBlock": return ports.ModuleBlock(node);
        case "ModuleDeclaration": return ports.ModuleDeclaration(node);
      }
      return ports.BlockOrExpression(node);
    },
    ModuleName: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "StringLiteral": return ports.StringLiteral(node);
      }
    },
    ModuleReference: node => {
      switch (node.kind) {
        case "Identifier": return ports.Identifier(node);
        case "QualifiedName": return ports.QualifiedName(node);
        case "ExternalModuleReference": return ports.ExternalModuleReference(node);
      }
    },
    NamedExportBindings: node => {
      switch (node.kind) {
        case "NamespaceExport": return ports.NamespaceExport(node);
        case "NamedExports": return ports.NamedExports(node);
      }
    },
    NamedImportBindings: node => {
      switch (node.kind) {
        case "NamespaceImport": return ports.NamespaceImport(node);
        case "NamedImports": return ports.NamedImports(node);
      }
    },
    ModifierLike: node => {
      switch (node.kind) {
        case "AbstractKeyword": case "AccessorKeyword": case "AsyncKeyword": case "ConstKeyword": case "DeclareKeyword": case "DefaultKeyword": case "ExportKeyword": case "InKeyword": case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "ReadonlyKeyword": case "OutKeyword": case "OverrideKeyword": case "StaticKeyword": return borrowedSyntaxPlan(node);
        case "Decorator": return ports.Decorator(node);
      }
    },
  };
  return ports;
}

export function createSyntaxCopyState<P extends Phase, Stop, Image>(
  phase: SyntaxPhaseCopy<P, Stop, Image>, beforeNode: (node: SyntaxNode<P>) => Stop | null,
  source: Omit<SyntaxMaterialization<P, Image>, "postorder">,
) {
  let ports: SyntaxCopyPorts<P, Stop, Image> | undefined;
  let failure: Stop | null = null;
  const plans = new Map<number, AdmittedPlan<P, Stop, Image>>();
  function prepare(node: SyntaxNode<P>, ordinal: number): Stop | null {
    if (failure !== null) return failure;
    const stop = beforeNode(node);
    if (stop !== null) {
      failure = stop;
      return stop;
    }
    if (!Number.isSafeInteger(ordinal) || ordinal < 0 || plans.has(ordinal)) return throwInvariant(missingPreparation);
    ports ??= createSyntaxPlans(phase, source.copyInitializer, source.blockOf, source.binaryOf);
    let kind: SyntaxNode<P>["kind"] | undefined;
    const plan = planSyntaxNode(ports, node, selected => { kind = selected; });
    failure = plan.prepare();
    if (failure === null) plans.set(ordinal, { original: node, kind: requirePresent(kind, missingPreparation), plan });
    return failure;
  }
  function admitted(node: SyntaxNode<P>, end: number): AdmittedPlan<P, Stop, Image> | null {
    const ordinal = source.wireOf(node);
    if (ordinal === undefined || ordinal >= end) return null;
    const row = plans.get(ordinal);
    return row?.original === node ? row : throwInvariant(missingPreparation);
  }
  function materialize(order: Iterable<SyntaxNode<P>>, image: Image): void {
    for (const node of order) requirePresent(admitted(node, Infinity) ?? undefined, missingPreparation).plan.materialize(image);
  }
  function imageThrough(end: number): SyntaxImage<P> {
    const byRole = <Value extends SyntaxNode<P>>(node: SyntaxNode<P>,
      matches: (candidate: SyntaxNode<P>, kind: SyntaxNode<P>["kind"]) => candidate is Value): Value | null => {
      const row = admitted(node, end);
      if (row === null) return null;
      const candidate = row.plan.read();
      return matches(candidate, row.kind) ? candidate : throwInvariant(missingPreparation);
    };
    return {
      nodeOf: node => admitted(node, end)?.plan.read() ?? null,
      statementOf: node => byRole(node, statementRole<P>),
      typeNodeOf: node => byRole(node, typeRole<P>),
      modifierOf: node => byRole(node, modifierRole<P>),
      sourceFileOf: node => byRole(node, (_candidate, kind): _candidate is Extract<SyntaxNode<P>, { readonly kind: "SourceFile" }> => kind === "SourceFile"),
      bodyRootOf: node => byRole(node, rootRole<P>),
      parameterOf: node => byRole(node, (_candidate, kind): _candidate is Extract<SyntaxNode<P>, { readonly kind: "Parameter" }> => kind === "Parameter"),
    };
  }
  return { prepare, materialize, imageThrough, stop: () => failure };
}

export const prepareSyntaxCopy: PrepareSyntaxCopy = <P extends Phase, Stop, Image>(
  phase: SyntaxPhaseCopy<P, Stop, Image>, beforeNode: (node: SyntaxNode<P>) => Stop | null,
  discover: (prepare: (node: SyntaxNode<P>, ordinal: number) => Stop | null) =>
    SyntaxCopyResult<SyntaxMaterialization<P, Image>, Stop>,
): SyntaxCopyResult<FinishSyntaxCopy<P, Stop, Image>, Stop> => {
  let supplied: SyntaxMaterialization<P, Image> | undefined;
  let discovering = true;
  let materialized = false;
  const state = createSyntaxCopyState<P, Stop, Image>(phase, beforeNode, {
    wireOf: node => requirePresent(supplied, missingPreparation).wireOf(node),
    copyInitializer: (node, expression, image) => requirePresent(supplied, missingPreparation).copyInitializer(node, expression, image),
    blockOf: node => requirePresent(supplied, missingPreparation).blockOf(node),
    binaryOf: node => requirePresent(supplied, missingPreparation).binaryOf(node),
  });
  const prepare = (node: SyntaxNode<P>, ordinal: number): Stop | null => discovering ? state.prepare(node, ordinal) : throwInvariant(consumedPreparation);
  const discovery = discover(prepare);
  discovering = false;
  const failure = state.stop();
  if (failure !== null) return { kind: "refused", stop: failure };
  if (discovery.kind === "refused") return discovery;
  const completed = discovery.value;
  supplied = completed;
  return copied((image: Image): SyntaxCopyResult<SyntaxImage<P>, Stop> => {
    if (materialized) return throwInvariant(consumedPreparation);
    materialized = true;
    state.materialize(completed.postorder, image);
    return copied(state.imageThrough(Infinity));
  });
};

export function bindSyntaxForest<P extends Phase>(nodes: readonly SyntaxNode<P>[],
  postorder: readonly SyntaxNode<P>[], wireOf: (node: SyntaxNode<P>) => number | undefined,
  blockOf: (node: Block<P>) => BlockSyntaxReceipt<P>, binaryOf: (node: BinaryExpression<P>) => BinarySyntaxReceipt<P>,
  copyInitializer: SyntaxInitializerImage<P, unknown>): SyntaxForest<P>["copy"] {
  let claimed = false;
  return <Stop, Image>(start: () => SyntaxCopyResult<SyntaxPhaseCopy<P, Stop, Image>, Stop>,
    beforeNode: (node: SyntaxNode<P>) => Stop | null, image: Image) => {
    if (claimed) return throwInvariant(consumedPreparation);
    claimed = true;
    const setup = start();
    if (setup.kind === "refused") return setup;
    const prepared = prepareSyntaxCopy<P, Stop, Image>(setup.value, beforeNode, prepare => {
      for (const node of nodes) {
        const stop = prepare(node, requirePresent(wireOf(node), missingPreparation));
        if (stop !== null) return { kind: "refused", stop };
      }
      return copied({ postorder, wireOf, blockOf, binaryOf, copyInitializer });
    });
    return prepared.kind === "refused" ? prepared : prepared.value(image);
  };
}

export const copySyntaxForest: CopySyntaxForest = (syntax, phase, beforeNode, image) =>
  syntax.copy(() => copied(phase), beforeNode, image);
