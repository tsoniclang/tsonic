import type { BodyRoot, CopySyntaxForest, FunctionDeclaration, FunctionExpression, ModifierLike, Statement, TypeNode,
  RetainedSyntaxNode, SingleExpressionSyntax, SyntaxStructureReceipt,
  FinishSyntaxCopy, Phase, PrepareSyntaxCopy, SyntaxCopyResult, SyntaxForest, SyntaxImage,
  SyntaxInitializerImage, SyntaxMaterialization, SyntaxNode, SyntaxPhaseCopy } from "./contract.js";
import type {
  EntityName, Expression, LeftHandSideExpression, ForInitializer, CaseOrDefaultClause, BindingName,
  PropertyName, BlockOrExpression, ClassElement, TypeElement, ModuleExportName, MemberName,
  TemplateMiddleOrTail, TemplateLiteral, ObjectLiteralElementLike, LiteralTypeChild, TypePredicateParameterName,
  ImportAttributeName, JsxChild, JsxAttributeLike, JsxTagNameExpression, JsxAttributeName, JsxAttributeValue,
  JSDocComment, JSDocTag, JSDocFullName, NodeBody, ModuleName, ModuleReference, NamedExportBindings,
  NamedImportBindings,
} from "./contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { SyntaxCopyPorts, SyntaxPlan } from "./copy-node.js";
import { copied, planSyntaxNode } from "./copy-node.js";
import { createStatementsPlans } from "./copy-statements.js";
import { createExpressionsPlans } from "./copy-expressions.js";
import { createTypesPlans } from "./copy-types.js";
import { createAuxiliaryPlans } from "./copy-auxiliary.js";

const missingPreparation: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "Every admitted syntax node must have its own prepared projection." };
const consumedPreparation: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "An admitted syntax forest owns one consuming materialization." };

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

type SyntaxKind<P extends Phase> = SyntaxNode<P>["kind"];
type SyntaxRole<P extends Phase, Value extends SyntaxNode<P>> =
  (node: SyntaxNode<P>, kind: SyntaxKind<P>) => node is Value;

function rootRole<P extends Phase>(node: SyntaxNode<P>, kind: SyntaxKind<P>): node is BodyRoot<P> {
  return kind === "Block" || kind === "SourceFile" || expressionRole<P>(node, kind);
}

function entityNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is EntityName<P> {
  switch (kind) {
    case "Identifier": case "QualifiedName": return true;
    default: return false;
  }
}

function expressionRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is Expression<P> {
  switch (kind) {
    case "Identifier": case "PrivateIdentifier": case "ClassExpression": case "OmittedExpression":
    case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword":
    case "ImportKeyword": case "StringLiteral": case "NumericLiteral": case "BigIntLiteral":
    case "RegularExpressionLiteral": case "NoSubstitutionTemplateLiteral": case "BinaryExpression":
    case "PrefixUnaryExpression": case "PostfixUnaryExpression": case "YieldExpression": case "ArrowFunction":
    case "FunctionExpression": case "AsExpression": case "SatisfiesExpression": case "ConditionalExpression":
    case "PropertyAccessExpression": case "ElementAccessExpression": case "CallExpression":
    case "NewExpression": case "MetaProperty": case "NonNullExpression": case "SpreadElement":
    case "TemplateExpression": case "TaggedTemplateExpression": case "ParenthesizedExpression":
    case "ArrayLiteralExpression": case "ObjectLiteralExpression": case "DeleteExpression":
    case "TypeOfExpression": case "VoidExpression": case "AwaitExpression": case "TypeAssertionExpression":
    case "ExpressionWithTypeArguments": case "PartiallyEmittedExpression": case "JsxElement":
    case "JsxAttributes": case "JsxNamespacedName": case "JsxOpeningElement": case "JsxSelfClosingElement":
    case "JsxFragment": case "JsxOpeningFragment": case "JsxClosingFragment": case "JsxExpression":
    case "JsxText": case "SyntheticReferenceExpression": return true;
    default: return false;
  }
}

function leftHandSideExpressionRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is LeftHandSideExpression<P> {
  switch (kind) {
    case "Identifier": case "PrivateIdentifier": case "ClassExpression": case "StringLiteral":
    case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral": case "FunctionExpression":
    case "PropertyAccessExpression": case "ElementAccessExpression": case "CallExpression":
    case "NewExpression": case "MetaProperty": case "NonNullExpression": case "TemplateExpression":
    case "TaggedTemplateExpression": case "ParenthesizedExpression": case "ArrayLiteralExpression":
    case "ObjectLiteralExpression": case "ExpressionWithTypeArguments": case "PartiallyEmittedExpression":
    case "JsxElement": case "JsxAttributes": case "JsxSelfClosingElement": case "JsxFragment": return true;
    default: return false;
  }
}

function forInitializerRole<P extends Phase>(candidate: SyntaxNode<P>, kind: SyntaxKind<P>): candidate is ForInitializer<P> {
  switch (kind) {
    case "MissingDeclaration": case "VariableDeclarationList": return true;
    default: return expressionRole<P>(candidate, kind);
  }
}

function caseOrDefaultClauseRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is CaseOrDefaultClause<P> {
  switch (kind) {
    case "CaseClause": case "DefaultClause": return true;
    default: return false;
  }
}

function bindingNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is BindingName<P> {
  switch (kind) {
    case "Identifier": case "ObjectBindingPattern": case "ArrayBindingPattern": return true;
    default: return false;
  }
}

function propertyNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is PropertyName<P> {
  switch (kind) {
    case "Identifier": case "StringLiteral": case "NoSubstitutionTemplateLiteral": case "NumericLiteral":
    case "ComputedPropertyName": case "PrivateIdentifier": case "BigIntLiteral": return true;
    default: return false;
  }
}

function blockOrExpressionRole<P extends Phase>(candidate: SyntaxNode<P>, kind: SyntaxKind<P>): candidate is BlockOrExpression<P> {
  switch (kind) {
    case "Block": return true;
    default: return expressionRole<P>(candidate, kind);
  }
}

function classElementRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ClassElement<P> {
  switch (kind) {
    case "Constructor": case "GetAccessor": case "SetAccessor": case "IndexSignature":
    case "MethodDeclaration": case "PropertyDeclaration": case "SemicolonClassElement":
    case "ClassStaticBlockDeclaration": return true;
    default: return false;
  }
}

function typeElementRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is TypeElement<P> {
  switch (kind) {
    case "NotEmittedTypeElement": case "CallSignature": case "ConstructSignature": case "GetAccessor":
    case "SetAccessor": case "IndexSignature": case "MethodSignature": case "PropertySignature": return true;
    default: return false;
  }
}

function moduleExportNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ModuleExportName<P> {
  switch (kind) {
    case "Identifier": case "StringLiteral": return true;
    default: return false;
  }
}

function memberNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is MemberName<P> {
  switch (kind) {
    case "Identifier": case "PrivateIdentifier": return true;
    default: return false;
  }
}

function templateMiddleOrTailRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is TemplateMiddleOrTail<P> {
  switch (kind) {
    case "TemplateMiddle": case "TemplateTail": return true;
    default: return false;
  }
}

function templateLiteralRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is TemplateLiteral<P> {
  switch (kind) {
    case "TemplateExpression": case "NoSubstitutionTemplateLiteral": return true;
    default: return false;
  }
}

function objectLiteralElementLikeRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ObjectLiteralElementLike<P> {
  switch (kind) {
    case "PropertyAssignment": case "ShorthandPropertyAssignment": case "SpreadAssignment":
    case "MethodDeclaration": case "GetAccessor": case "SetAccessor": return true;
    default: return false;
  }
}

function literalTypeChildRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is LiteralTypeChild<P> {
  switch (kind) {
    case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "NoSubstitutionTemplateLiteral":
    case "TrueKeyword": case "FalseKeyword": case "NullKeyword": case "PrefixUnaryExpression": return true;
    default: return false;
  }
}

function typePredicateParameterNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is TypePredicateParameterName<P> {
  switch (kind) {
    case "Identifier": case "ThisType": return true;
    default: return false;
  }
}

function importAttributeNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ImportAttributeName<P> {
  switch (kind) {
    case "Identifier": case "StringLiteral": return true;
    default: return false;
  }
}

function jsxChildRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JsxChild<P> {
  switch (kind) {
    case "JsxText": case "JsxExpression": case "JsxElement": case "JsxSelfClosingElement": case "JsxFragment": return true;
    default: return false;
  }
}

function jsxAttributeLikeRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JsxAttributeLike<P> {
  switch (kind) {
    case "JsxAttribute": case "JsxSpreadAttribute": return true;
    default: return false;
  }
}

function jsxTagNameExpressionRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JsxTagNameExpression<P> {
  switch (kind) {
    case "Identifier": case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword":
    case "SuperKeyword": case "ImportKeyword": case "PropertyAccessExpression": case "JsxNamespacedName": return true;
    default: return false;
  }
}

function jsxAttributeNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JsxAttributeName<P> {
  switch (kind) {
    case "Identifier": case "JsxNamespacedName": return true;
    default: return false;
  }
}

function jsxAttributeValueRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JsxAttributeValue<P> {
  switch (kind) {
    case "StringLiteral": case "JsxExpression": case "JsxElement": case "JsxSelfClosingElement":
    case "JsxFragment": return true;
    default: return false;
  }
}

function jsDocCommentRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JSDocComment<P> {
  switch (kind) {
    case "JSDocText": case "JSDocLink": case "JSDocLinkCode": case "JSDocLinkPlain": return true;
    default: return false;
  }
}

function jsDocTagRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JSDocTag<P> {
  switch (kind) {
    case "JSDocTypeTag": case "JSDocUnknownTag": case "JSDocTemplateTag": case "JSDocReturnTag":
    case "JSDocPublicTag": case "JSDocPrivateTag": case "JSDocProtectedTag": case "JSDocReadonlyTag":
    case "JSDocOverrideTag": case "JSDocDeprecatedTag": case "JSDocSeeTag": case "JSDocImplementsTag":
    case "JSDocAugmentsTag": case "JSDocSatisfiesTag": case "JSDocThrowsTag": case "JSDocThisTag":
    case "JSDocImportTag": case "JSDocCallbackTag": case "JSDocOverloadTag": case "JSDocTypedefTag":
    case "JSDocParameterTag": case "JSDocPropertyTag": return true;
    default: return false;
  }
}

function jsDocFullNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is JSDocFullName<P> {
  switch (kind) {
    case "Identifier": case "ModuleDeclaration": return true;
    default: return false;
  }
}

function nodeBodyRole<P extends Phase>(candidate: SyntaxNode<P>, kind: SyntaxKind<P>): candidate is NodeBody<P> {
  switch (kind) {
    case "ModuleBlock": case "ModuleDeclaration": return true;
    default: return blockOrExpressionRole<P>(candidate, kind);
  }
}

function moduleNameRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ModuleName<P> {
  switch (kind) {
    case "Identifier": case "StringLiteral": return true;
    default: return false;
  }
}

function moduleReferenceRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is ModuleReference<P> {
  switch (kind) {
    case "Identifier": case "QualifiedName": case "ExternalModuleReference": return true;
    default: return false;
  }
}

function namedExportBindingsRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is NamedExportBindings<P> {
  switch (kind) {
    case "NamespaceExport": case "NamedExports": return true;
    default: return false;
  }
}

function namedImportBindingsRole<P extends Phase>(_candidate: SyntaxNode<P>, kind: SyntaxKind<P>): _candidate is NamedImportBindings<P> {
  switch (kind) {
    case "NamespaceImport": case "NamedImports": return true;
    default: return false;
  }
}

function createSyntaxPlans<P extends Phase, Stop, Image>(phase: SyntaxPhaseCopy<P, Stop, Image>,
  initializer: SyntaxInitializerImage<P, Image>,
  structure: (node: RetainedSyntaxNode<P>) => SyntaxStructureReceipt<P>,
  readSyntax: (node: SyntaxNode<P>) => SyntaxNode<P>,
  readRole: <Value extends SyntaxNode<P>>(node: Value, role: SyntaxRole<P, Value>) => Value): SyntaxCopyPorts<P, Stop, Image> {
  const expressionOf = (node: SingleExpressionSyntax<P>) => {
    const receipt = structure(node);
    return receipt.kind === "single-expression" ? receipt.expression() : throwInvariant(missingPreparation);
  };
  const functionOf = (node: FunctionDeclaration<P> | FunctionExpression<P>) => {
    const receipt = structure(node);
    return receipt.kind === "function-header" ? receipt : throwInvariant(missingPreparation);
  };
  const statements = createStatementsPlans(phase, () => ports, initializer, node => {
    const receipt = structure(node);
    return receipt.kind === "block" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "return" ? receipt.expression() : throwInvariant(missingPreparation);
  }, expressionOf, node => {
    const receipt = structure(node);
    return receipt.kind === "formal-header" ? receipt : throwInvariant(missingPreparation);
  }, functionOf, node => {
    const receipt = structure(node);
    return receipt.kind === "if" ? receipt : throwInvariant(missingPreparation);
  });
  const expressions = createExpressionsPlans(phase, () => ports, node => {
    const receipt = structure(node);
    return receipt.kind === "binary" ? receipt : throwInvariant(missingPreparation);
  }, expressionOf, node => {
    const receipt = structure(node);
    return receipt.kind === "application" ? receipt : throwInvariant(missingPreparation);
  }, functionOf, node => {
    const receipt = structure(node);
    return receipt.kind === "unary" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "annotated-expression" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "conditional" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "property-access" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "element-access" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "array-literal" ? receipt : throwInvariant(missingPreparation);
  }, node => {
    const receipt = structure(node);
    return receipt.kind === "object-literal" ? receipt : throwInvariant(missingPreparation);
  });
  const types = createTypesPlans(phase, () => ports);
  const auxiliary = createAuxiliaryPlans(phase, () => ports, expressionOf, node => {
    const receipt = structure(node);
    return receipt.kind === "source-header" ? receipt : throwInvariant(missingPreparation);
  });
  const ports: SyntaxCopyPorts<P, Stop, Image> = {
    ...statements, ...expressions, ...types, ...auxiliary,
    EntityName: node => readRole(node, entityNameRole<P>),
    Expression: node => readRole(node, expressionRole<P>),
    LeftHandSideExpression: node => readRole(node, leftHandSideExpressionRole<P>),
    Statement: node => readRole(node, statementRole<P>),
    ForInitializer: node => readRole(node, forInitializerRole<P>),
    CaseOrDefaultClause: node => readRole(node, caseOrDefaultClauseRole<P>),
    BindingName: node => readRole(node, bindingNameRole<P>),
    TypeNode: node => readRole(node, typeRole<P>),
    PropertyName: node => readRole(node, propertyNameRole<P>),
    BlockOrExpression: node => readRole(node, blockOrExpressionRole<P>),
    ClassElement: node => readRole(node, classElementRole<P>),
    TypeElement: node => readRole(node, typeElementRole<P>),
    ModuleExportName: node => readRole(node, moduleExportNameRole<P>),
    MemberName: node => readRole(node, memberNameRole<P>),
    TemplateMiddleOrTail: node => readRole(node, templateMiddleOrTailRole<P>),
    TemplateLiteral: node => readRole(node, templateLiteralRole<P>),
    ObjectLiteralElementLike: node => readRole(node, objectLiteralElementLikeRole<P>),
    LiteralTypeChild: node => readRole(node, literalTypeChildRole<P>),
    TypePredicateParameterName: node => readRole(node, typePredicateParameterNameRole<P>),
    ImportAttributeName: node => readRole(node, importAttributeNameRole<P>),
    JsxChild: node => readRole(node, jsxChildRole<P>),
    JsxAttributeLike: node => readRole(node, jsxAttributeLikeRole<P>),
    JsxTagNameExpression: node => readRole(node, jsxTagNameExpressionRole<P>),
    JsxAttributeName: node => readRole(node, jsxAttributeNameRole<P>),
    JsxAttributeValue: node => readRole(node, jsxAttributeValueRole<P>),
    JSDocComment: node => readRole(node, jsDocCommentRole<P>),
    JSDocTag: node => readRole(node, jsDocTagRole<P>),
    JSDocFullName: node => readRole(node, jsDocFullNameRole<P>),
    NodeBody: node => readRole(node, nodeBodyRole<P>),
    ModuleName: node => readRole(node, moduleNameRole<P>),
    ModuleReference: node => readRole(node, moduleReferenceRole<P>),
    NamedExportBindings: node => readRole(node, namedExportBindingsRole<P>),
    NamedImportBindings: node => readRole(node, namedImportBindingsRole<P>),
    ModifierLike: node => readRole(node, modifierRole<P>),
    SyntaxNode: node => readSyntax(node),
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
    ports ??= createSyntaxPlans(phase, source.copyInitializer, source.structure, readSyntax, readRole);
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
  function readSyntax(node: SyntaxNode<P>): SyntaxNode<P> {
    return requirePresent(admitted(node, Infinity) ?? undefined, missingPreparation).plan.read();
  }
  function readRole<Value extends SyntaxNode<P>>(node: Value, role: SyntaxRole<P, Value>): Value {
    const row = requirePresent(admitted(node, Infinity) ?? undefined, missingPreparation);
    const completed = row.plan.read();
    return role(completed, row.kind) ? completed : throwInvariant(missingPreparation);
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
    structure: node => requirePresent(supplied, missingPreparation).structure(node),
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
  structure: (node: RetainedSyntaxNode<P>) => SyntaxStructureReceipt<P>,
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
      return copied({ postorder, wireOf, structure, copyInitializer });
    });
    return prepared.kind === "refused" ? prepared : prepared.value(image);
  };
}

export const copySyntaxForest: CopySyntaxForest = (syntax, phase, beforeNode, image) =>
  syntax.copy(() => copied(phase), beforeNode, image);
