import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { ChildrenOfSyntax, IterateChildrenOfSyntax, IterateSyntaxChildEdges, Phase, SyntaxNode, NodeList, SyntaxChild } from "./contract.js";

const emptyChildren: readonly never[] = ([]);
const missingChild: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A syntax list must retain its actual dense child vector." };

export interface SyntaxChildSlot<PhaseType extends Phase> {
  readonly fields: readonly (string | number)[];
  readonly read: () => SyntaxNode<PhaseType>;
}

type ChildPart<PhaseType extends Phase> =
  | readonly [field: string, kind: "required", read: () => SyntaxNode<PhaseType>]
  | readonly [field: string, kind: "nullable", read: () => SyntaxNode<PhaseType> | null]
  | readonly [field: string, kind: "list", read: () => NodeList<SyntaxNode<PhaseType>> | null]
  | readonly [field: string, kind: "array", read: () => readonly SyntaxNode<PhaseType>[] | null];

type SlotKind = ChildPart<Phase>[1];

type FieldKind<Value> = [Value] extends [never] ? "not-child"
  : undefined extends Value ? "not-child"
  : [Value] extends [null] ? "nullable"
  : NonNullable<Value> extends NodeList<unknown> ? "list"
  : NonNullable<Value> extends readonly unknown[] ? "array"
  : NonNullable<Value> extends { readonly kind: string } ? null extends Value ? "nullable" : "required"
  : "not-child";

type FieldKinds<Node, Field extends keyof Node> = Node extends object ? FieldKind<Node[Field]> : never;

type ExactPart<Node> = {
  [Field in keyof Node & string]: {
    [Kind in SlotKind]: [FieldKinds<Node, Field>] extends [Kind] ? readonly [Field, Kind, () => Node[Field]] : never
  }[SlotKind]
}[keyof Node & string];

function* children<PhaseType extends Phase, Node>(
  ...parts: readonly (ChildPart<PhaseType> & ExactPart<Node>)[]
): Generator<SyntaxChildSlot<PhaseType>, void, undefined> {
  for (const [field, kind, read] of parts) {
    switch (kind) {
      case "required": yield { fields: [field], read }; break;
      case "nullable": {
        const child = read();
        if (child !== null) yield { fields: [field], read: () => child };
        break;
      }
      case "list":
      case "array": {
        const list = kind === "list" ? read()?.nodes : read();
        if (list === null || list === undefined) break;
        const length = list.length;
        for (let index = 0; index < length; index += 1) {
          const position = index;
          yield { fields: kind === "list" ? [field, "nodes", position] : [field, position],
            read: () => requirePresent(list[position], missingChild) };
        }
        break;
      }
    }
  }
}

export const iterateChildrenOfSyntax: IterateChildrenOfSyntax = function* <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxNode<PhaseType>, void, undefined> {
  for (const slot of iterateSyntaxChildSlots(node)) yield slot.read();
};

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => [...iterateChildrenOfSyntax(node)];

export function syntaxChildEdges<PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxChild<PhaseType>[] {
  return [...iterateSyntaxChildEdges(node)];
}

export const iterateSyntaxChildEdges: IterateSyntaxChildEdges = function* <PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxChild<PhaseType>, void, undefined> {
  for (const slot of iterateSyntaxChildSlots(node)) yield { node: slot.read(), fields: slot.fields };
};

export function iterateSyntaxChildSlots<PhaseType extends Phase>(
  node: SyntaxNode<PhaseType>,
): Iterable<SyntaxChildSlot<PhaseType>> {
  switch (node.kind) {
    case "QualifiedName":
      return children<PhaseType, typeof node>(["left", "required", () => node.left], ["right", "required", () => node.right]);
    case "ComputedPropertyName":
    case "Decorator":
    case "ThrowStatement":
    case "ExpressionStatement":
    case "ExternalModuleReference":
    case "NonNullExpression":
    case "SpreadElement":
    case "ParenthesizedExpression":
    case "SpreadAssignment":
    case "DeleteExpression":
    case "TypeOfExpression":
    case "VoidExpression":
    case "AwaitExpression":
    case "PartiallyEmittedExpression":
    case "JsxSpreadAttribute":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression]);
    case "ReturnStatement":
      return children<PhaseType, typeof node>(["expression", "nullable", () => node.expression]);
    case "IfStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["thenStatement", "required", () => node.thenStatement], ["elseStatement", "nullable", () => node.elseStatement]);
    case "DoStatement":
      return children<PhaseType, typeof node>(["statement", "required", () => node.statement], ["expression", "required", () => node.expression]);
    case "WhileStatement":
    case "WithStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["statement", "required", () => node.statement]);
    case "ForStatement":
      return children<PhaseType, typeof node>(["initializer", "nullable", () => node.initializer], ["condition", "nullable", () => node.condition], ["incrementor", "nullable", () => node.incrementor], ["statement", "required", () => node.statement]);
    case "ForInStatement":
    case "ForOfStatement":
      return children<PhaseType, typeof node>(["awaitModifier", "nullable", () => node.awaitModifier], ["initializer", "required", () => node.initializer], ["expression", "required", () => node.expression], ["statement", "required", () => node.statement]);
    case "BreakStatement":
    case "ContinueStatement":
      return children<PhaseType, typeof node>(["label", "nullable", () => node.label]);
    case "SwitchStatement":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["caseBlock", "required", () => node.caseBlock]);
    case "CaseBlock":
      return children<PhaseType, typeof node>(["clauses", "list", () => node.clauses]);
    case "CaseClause":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["statements", "list", () => node.statements]);
    case "DefaultClause":
      return children<PhaseType, typeof node>(["expression", "nullable", () => node.expression], ["statements", "list", () => node.statements]);
    case "TryStatement":
      return children<PhaseType, typeof node>(["tryBlock", "required", () => node.tryBlock], ["catchClause", "nullable", () => node.catchClause], ["finallyBlock", "nullable", () => node.finallyBlock]);
    case "CatchClause":
      return children<PhaseType, typeof node>(["variableDeclaration", "nullable", () => node.variableDeclaration], ["block", "required", () => node.block]);
    case "LabeledStatement":
      return children<PhaseType, typeof node>(["label", "required", () => node.label], ["statement", "required", () => node.statement]);
    case "Block":
    case "ModuleBlock":
      return children<PhaseType, typeof node>(["statements", "list", () => node.statements]);
    case "VariableStatement":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["declarationList", "required", () => node.declarationList]);
    case "VariableDeclaration":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["exclamationToken", "nullable", () => node.exclamationToken], ["type", "nullable", () => node.type], ["initializer", "nullable", () => node.initializer]);
    case "VariableDeclarationList":
      return children<PhaseType, typeof node>(["declarations", "list", () => node.declarations]);
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "Parameter":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["name", "required", () => node.name],
        ["questionToken", "nullable", () => node.questionToken], ["type", "nullable", () => node.type], ["initializer", "nullable", () => node.initializer]);
    case "BindingElement":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["propertyName", "nullable", () => node.propertyName], ["name", "nullable", () => node.name], ["initializer", "nullable", () => node.initializer]);
    case "MissingDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "nullable", () => node.name],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["body", "nullable", () => node.body]);
    case "ClassDeclaration":
    case "ClassExpression":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "nullable", () => node.name], ["typeParameters", "list", () => node.typeParameters],
        ["heritageClauses", "list", () => node.heritageClauses], ["members", "list", () => node.members]);
    case "InterfaceDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["typeParameters", "list", () => node.typeParameters],
        ["heritageClauses", "list", () => node.heritageClauses], ["members", "list", () => node.members]);
    case "HeritageClause":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["typeParameters", "list", () => node.typeParameters], ["type", "required", () => node.type]);
    case "EnumMember":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["initializer", "nullable", () => node.initializer]);
    case "EnumDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["members", "list", () => node.members]);
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["importClause", "nullable", () => node.importClause], ["moduleSpecifier", "required", () => node.moduleSpecifier], ["attributes", "nullable", () => node.attributes]);
    case "NamespaceImport":
    case "NamespaceExport":
    case "JSDocNameReference":
      return children<PhaseType, typeof node>(["name", "required", () => node.name]);
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return children<PhaseType, typeof node>(["name", "nullable", () => node.name]);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "ExportAssignment":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["type", "nullable", () => node.type], ["expression", "required", () => node.expression]);
    case "NamespaceExportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name]);
    case "ExportSpecifier":
    case "ImportSpecifier":
      return children<PhaseType, typeof node>(["propertyName", "nullable", () => node.propertyName], ["name", "required", () => node.name]);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "FunctionType":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "Constructor":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters],
        ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["asteriskToken", "nullable", () => node.asteriskToken], ["body", "nullable", () => node.body]);
    case "GetAccessor":
    case "SetAccessor":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["body", "nullable", () => node.body]);
    case "IndexSignature":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "MethodSignature":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "MethodDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken],
        ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["body", "nullable", () => node.body]);
    case "PropertySignature":
    case "PropertyDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type], ["initializer", "nullable", () => node.initializer]);
    case "PropertyAssignment":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type], ["initializer", "required", () => node.initializer]);
    case "ClassStaticBlockDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["body", "required", () => node.body]);
    case "BinaryExpression":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["left", "required", () => node.left], ["type", "nullable", () => node.type], ["operatorToken", "required", () => node.operatorToken], ["right", "required", () => node.right]);
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return children<PhaseType, typeof node>(["operand", "required", () => node.operand]);
    case "YieldExpression":
      return children<PhaseType, typeof node>(["asteriskToken", "nullable", () => node.asteriskToken], ["expression", "nullable", () => node.expression]);
    case "ArrowFunction":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters],
        ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature], ["asteriskToken", "nullable", () => node.asteriskToken], ["equalsGreaterThanToken", "required", () => node.equalsGreaterThanToken], ["body", "nullable", () => node.body]);
    case "AsExpression":
    case "SatisfiesExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["type", "required", () => node.type]);
    case "ConditionalExpression":
      return children<PhaseType, typeof node>(["condition", "required", () => node.condition], ["questionToken", "required", () => node.questionToken], ["whenTrue", "required", () => node.whenTrue], ["colonToken", "required", () => node.colonToken], ["whenFalse", "required", () => node.whenFalse]);
    case "PropertyAccessExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["questionDotToken", "nullable", () => node.questionDotToken], ["name", "required", () => node.name]);
    case "ElementAccessExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["questionDotToken", "nullable", () => node.questionDotToken], ["argumentExpression", "required", () => node.argumentExpression]);
    case "CallExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["questionDotToken", "nullable", () => node.questionDotToken], ["typeArguments", "list", () => node.typeArguments], ["arguments", "list", () => node.arguments]);
    case "NewExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["typeArguments", "list", () => node.typeArguments], ["arguments", "list", () => node.arguments]);
    case "MetaProperty":
      return children<PhaseType, typeof node>(["name", "required", () => node.name]);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return children<PhaseType, typeof node>(["head", "required", () => node.head], ["templateSpans", "list", () => node.templateSpans]);
    case "TemplateSpan":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["literal", "required", () => node.literal]);
    case "TaggedTemplateExpression":
      return children<PhaseType, typeof node>(["tag", "required", () => node.tag], ["questionDotToken", "nullable", () => node.questionDotToken], ["typeArguments", "list", () => node.typeArguments], ["template", "required", () => node.template]);
    case "ArrayLiteralExpression":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "ObjectLiteralExpression":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "ShorthandPropertyAssignment":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["postfixToken", "nullable", () => node.postfixToken], ["type", "nullable", () => node.type],
        ["equalsToken", "nullable", () => node.equalsToken], ["objectAssignmentInitializer", "nullable", () => node.objectAssignmentInitializer]);
    case "TypeAssertionExpression":
      return children<PhaseType, typeof node>(["type", "required", () => node.type], ["expression", "required", () => node.expression]);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "ConditionalType":
      return children<PhaseType, typeof node>(["checkType", "required", () => node.checkType], ["extendsType", "required", () => node.extendsType], ["trueType", "required", () => node.trueType], ["falseType", "required", () => node.falseType]);
    case "TypeOperator":
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return children<PhaseType, typeof node>(["type", "required", () => node.type]);
    case "InferType":
      return children<PhaseType, typeof node>(["typeParameter", "required", () => node.typeParameter]);
    case "ArrayType":
      return children<PhaseType, typeof node>(["elementType", "required", () => node.elementType]);
    case "IndexedAccessType":
      return children<PhaseType, typeof node>(["objectType", "required", () => node.objectType], ["indexType", "required", () => node.indexType]);
    case "TypeReference":
      return children<PhaseType, typeof node>(["typeName", "required", () => node.typeName], ["typeArguments", "list", () => node.typeArguments]);
    case "ExpressionWithTypeArguments":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["typeArguments", "list", () => node.typeArguments]);
    case "LiteralType":
      return children<PhaseType, typeof node>(["literal", "required", () => node.literal]);
    case "TypePredicate":
      return children<PhaseType, typeof node>(["assertsModifier", "nullable", () => node.assertsModifier], ["parameterName", "required", () => node.parameterName], ["type", "nullable", () => node.type]);
    case "ImportAttribute":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["value", "required", () => node.value]);
    case "ImportAttributes":
      return children<PhaseType, typeof node>(["attributes", "list", () => node.attributes]);
    case "TypeQuery":
      return children<PhaseType, typeof node>(["exprName", "required", () => node.exprName], ["typeArguments", "list", () => node.typeArguments]);
    case "MappedType":
      return children<PhaseType, typeof node>(["readonlyToken", "nullable", () => node.readonlyToken], ["typeParameter", "required", () => node.typeParameter], ["nameType", "nullable", () => node.nameType],
        ["questionToken", "nullable", () => node.questionToken], ["type", "nullable", () => node.type], ["members", "list", () => node.members]);
    case "TypeLiteral":
      return children<PhaseType, typeof node>(["members", "list", () => node.members]);
    case "TupleType":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "NamedTupleMember":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["name", "required", () => node.name], ["questionToken", "nullable", () => node.questionToken], ["type", "required", () => node.type]);
    case "ConstructorType":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["typeParameters", "list", () => node.typeParameters], ["parameters", "list", () => node.parameters], ["type", "nullable", () => node.type], ["fullSignature", "nullable", () => node.fullSignature]);
    case "TemplateLiteralTypeSpan":
      return children<PhaseType, typeof node>(["type", "required", () => node.type], ["literal", "required", () => node.literal]);
    case "JsxElement":
      return children<PhaseType, typeof node>(["openingElement", "required", () => node.openingElement], ["children", "list", () => node.children], ["closingElement", "required", () => node.closingElement]);
    case "JsxAttributes":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "JsxNamespacedName":
      return children<PhaseType, typeof node>(["namespace", "required", () => node.namespace], ["name", "required", () => node.name]);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeArguments", "list", () => node.typeArguments], ["attributes", "required", () => node.attributes]);
    case "JsxFragment":
      return children<PhaseType, typeof node>(["openingFragment", "required", () => node.openingFragment], ["children", "list", () => node.children], ["closingFragment", "required", () => node.closingFragment]);
    case "JsxAttribute":
      return children<PhaseType, typeof node>(["name", "required", () => node.name], ["initializer", "nullable", () => node.initializer]);
    case "JsxClosingElement":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName]);
    case "JsxExpression":
      return children<PhaseType, typeof node>(["dotDotDotToken", "nullable", () => node.dotDotDotToken], ["expression", "nullable", () => node.expression]);
    case "SyntaxList":
      return children<PhaseType, typeof node>(["children", "array", () => node.children]);
    case "JSDoc":
      return children<PhaseType, typeof node>(["comment", "list", () => node.comment], ["tags", "list", () => node.tags]);
    case "JSDocTypeTag":
    case "JSDocSatisfiesTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "required", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "JSDocReturnTag":
    case "JSDocThrowsTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "nullable", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["comment", "list", () => node.comment]);
    case "JSDocSeeTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["nameExpression", "required", () => node.nameExpression], ["comment", "list", () => node.comment]);
    case "JSDocTemplateTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["constraint", "required", () => node.constraint], ["typeParameters", "list", () => node.typeParameters], ["comment", "list", () => node.comment]);
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["className", "required", () => node.className], ["comment", "list", () => node.comment]);
    case "JSDocImportTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["importClause", "nullable", () => node.importClause], ["moduleSpecifier", "required", () => node.moduleSpecifier],
        ["attributes", "nullable", () => node.attributes], ["comment", "list", () => node.comment]);
    case "JSDocCallbackTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "required", () => node.typeExpression], ["name", "nullable", () => node.name], ["comment", "list", () => node.comment]);
    case "JSDocTypedefTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["typeExpression", "nullable", () => node.typeExpression], ["name", "nullable", () => node.name], ["comment", "list", () => node.comment]);
    case "SourceFile":
      return children<PhaseType, typeof node>(["statements", "list", () => node.statements], ["endOfFileToken", "required", () => node.endOfFileToken]);
    case "ModuleDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["asteriskToken", "nullable", () => node.asteriskToken], ["name", "required", () => node.name], ["body", "nullable", () => node.body]);
    case "ImportEqualsDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["moduleReference", "required", () => node.moduleReference]);
    case "ExportDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["exportClause", "nullable", () => node.exportClause], ["moduleSpecifier", "nullable", () => node.moduleSpecifier], ["attributes", "nullable", () => node.attributes]);
    case "ImportType":
      return children<PhaseType, typeof node>(["argument", "required", () => node.argument], ["attributes", "nullable", () => node.attributes], ["qualifier", "nullable", () => node.qualifier], ["typeArguments", "list", () => node.typeArguments]);
    case "ImportClause":
      return children<PhaseType, typeof node>(["name", "nullable", () => node.name], ["namedBindings", "nullable", () => node.namedBindings]);
    case "TypeParameter":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers], ["name", "required", () => node.name], ["constraint", "nullable", () => node.constraint], ["expression", "nullable", () => node.expression], ["defaultType", "nullable", () => node.defaultType]);
    case "SyntheticReferenceExpression":
      return children<PhaseType, typeof node>(["expression", "required", () => node.expression], ["thisArg", "required", () => node.thisArg]);
    case "JSDocTypeLiteral":
      return children<PhaseType, typeof node>(["jsDocPropertyTags", "array", () => node.jsDocPropertyTags]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return children<PhaseType, typeof node>(["tagName", "required", () => node.tagName], ["name", "required", () => node.name], ["typeExpression", "nullable", () => node.typeExpression], ["comment", "list", () => node.comment]);
    case "AnyKeyword":
    case "BigIntKeyword":
    case "BooleanKeyword":
    case "IntrinsicKeyword":
    case "NeverKeyword":
    case "NumberKeyword":
    case "ObjectKeyword":
    case "StringKeyword":
    case "SymbolKeyword":
    case "UndefinedKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
    case "NullKeyword":
    case "TrueKeyword":
    case "FalseKeyword":
    case "ThisKeyword":
    case "SuperKeyword":
    case "ImportKeyword":
    case "Unknown":
    case "EndOfFile":
    case "SingleLineCommentTrivia":
    case "MultiLineCommentTrivia":
    case "NewLineTrivia":
    case "WhitespaceTrivia":
    case "ConflictMarkerTrivia":
    case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces":
    case "OpenBraceToken":
    case "CloseBraceToken":
    case "OpenParenToken":
    case "CloseParenToken":
    case "OpenBracketToken":
    case "CloseBracketToken":
    case "DotToken":
    case "DotDotDotToken":
    case "SemicolonToken":
    case "CommaToken":
    case "QuestionDotToken":
    case "LessThanToken":
    case "LessThanSlashToken":
    case "GreaterThanToken":
    case "LessThanEqualsToken":
    case "GreaterThanEqualsToken":
    case "EqualsEqualsToken":
    case "ExclamationEqualsToken":
    case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken":
    case "EqualsGreaterThanToken":
    case "PlusToken":
    case "MinusToken":
    case "AsteriskToken":
    case "AsteriskAsteriskToken":
    case "SlashToken":
    case "PercentToken":
    case "PlusPlusToken":
    case "MinusMinusToken":
    case "LessThanLessThanToken":
    case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken":
    case "AmpersandToken":
    case "BarToken":
    case "CaretToken":
    case "ExclamationToken":
    case "TildeToken":
    case "AmpersandAmpersandToken":
    case "BarBarToken":
    case "QuestionToken":
    case "ColonToken":
    case "AtToken":
    case "QuestionQuestionToken":
    case "BacktickToken":
    case "HashToken":
    case "EqualsToken":
    case "PlusEqualsToken":
    case "MinusEqualsToken":
    case "AsteriskEqualsToken":
    case "AsteriskAsteriskEqualsToken":
    case "SlashEqualsToken":
    case "PercentEqualsToken":
    case "LessThanLessThanEqualsToken":
    case "GreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken":
    case "BarEqualsToken":
    case "BarBarEqualsToken":
    case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken":
    case "CaretEqualsToken":
    case "JSDocCommentTextToken":
    case "BreakKeyword":
    case "CaseKeyword":
    case "CatchKeyword":
    case "ClassKeyword":
    case "ConstKeyword":
    case "ContinueKeyword":
    case "DebuggerKeyword":
    case "DefaultKeyword":
    case "DeleteKeyword":
    case "DoKeyword":
    case "ElseKeyword":
    case "EnumKeyword":
    case "ExportKeyword":
    case "ExtendsKeyword":
    case "FinallyKeyword":
    case "ForKeyword":
    case "FunctionKeyword":
    case "IfKeyword":
    case "InKeyword":
    case "InstanceOfKeyword":
    case "NewKeyword":
    case "ReturnKeyword":
    case "SwitchKeyword":
    case "ThrowKeyword":
    case "TryKeyword":
    case "TypeOfKeyword":
    case "VarKeyword":
    case "WhileKeyword":
    case "WithKeyword":
    case "ImplementsKeyword":
    case "InterfaceKeyword":
    case "LetKeyword":
    case "PackageKeyword":
    case "PrivateKeyword":
    case "ProtectedKeyword":
    case "PublicKeyword":
    case "StaticKeyword":
    case "YieldKeyword":
    case "AbstractKeyword":
    case "AccessorKeyword":
    case "AsKeyword":
    case "AssertsKeyword":
    case "AssertKeyword":
    case "AsyncKeyword":
    case "AwaitKeyword":
    case "ConstructorKeyword":
    case "DeclareKeyword":
    case "GetKeyword":
    case "ImmediateKeyword":
    case "InferKeyword":
    case "IsKeyword":
    case "KeyOfKeyword":
    case "ModuleKeyword":
    case "NamespaceKeyword":
    case "OutKeyword":
    case "ReadonlyKeyword":
    case "RequireKeyword":
    case "SatisfiesKeyword":
    case "SetKeyword":
    case "TypeKeyword":
    case "UniqueKeyword":
    case "UsingKeyword":
    case "FromKeyword":
    case "GlobalKeyword":
    case "OverrideKeyword":
    case "OfKeyword":
    case "DeferKeyword":
    case "Identifier":
    case "PrivateIdentifier":
    case "EmptyStatement":
    case "DebuggerStatement":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "SemicolonClassElement":
    case "OmittedExpression":
    case "StringLiteral":
    case "NumericLiteral":
    case "BigIntLiteral":
    case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral":
    case "ThisType":
    case "TemplateHead":
    case "TemplateMiddle":
    case "TemplateTail":
    case "JsxText":
    case "JsxOpeningFragment":
    case "JsxClosingFragment":
    case "JSDocAllType":
    case "JSDocText":
      return emptyChildren;
  }
}
