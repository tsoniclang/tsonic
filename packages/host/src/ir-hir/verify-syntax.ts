import type { HirNode, HirModule } from "./contract.js";

export type HirShape = string
  | { readonly kind: "literal"; readonly values: readonly (string | number | boolean | null)[] }
  | { readonly kind: "array"; readonly element: HirShape; readonly nonempty: boolean }
  | { readonly kind: "choice"; readonly alternatives: readonly HirShape[] }
  | { readonly kind: "record"; readonly label: string; readonly fields: readonly HirField[] }
  | { readonly kind: "dictionary"; readonly label: string; readonly element: HirShape };

export type HirField = readonly [string, HirShape];
export interface HirObject { readonly [field: string]: unknown }
export interface HirSchema { readonly [name: string]: HirShape }

export function hirLiteral(...values: readonly (string | number | boolean | null)[]): HirShape {
  return Object.freeze({ kind: "literal", values: Object.freeze(values) });
}

export function hirArray(element: HirShape, nonempty = false): HirShape {
  return Object.freeze({ kind: "array", element, nonempty });
}

export function hirChoice(...alternatives: readonly HirShape[]): HirShape {
  return Object.freeze({ kind: "choice", alternatives: Object.freeze(alternatives) });
}

export function hirNullable(value: HirShape): HirShape {
  return hirChoice("null", value);
}

export function hirRecord(label: string, fields: readonly HirField[]): HirShape {
  return Object.freeze({ kind: "record", label, fields: Object.freeze(fields) });
}

export function hirVariant(kind: string, fields: readonly HirField[]): HirShape {
  return hirRecord(kind, [["kind", hirLiteral(kind)], ...fields]);
}

function list(element: HirShape): HirShape {
  return hirRecord("NodeList", [["loc", "TextRange"], ["nodes", hirArray(element)]]);
}

const header: readonly HirField[] = Object.freeze([
  ["id", "NodeId"], ["origin", "Origin"], ["parent", hirNullable("NodeId")],
  ["flags", hirArray("SyntaxFlag")], ["loc", "TextRange"],
]);

function node(kind: string, metadata: HirShape, fields: readonly HirField[] = []): HirShape {
  return hirVariant(kind, [...header, ...fields, ["tsonic", metadata]]);
}

const modifiers = hirNullable("ModifierList");
const typeParameters = hirNullable(list("TypeParameter"));
const parameters = list("Parameter");
const annotation = hirNullable("TypeNode");
const initializer = hirNullable("Expression");
const postfix = hirNullable(hirChoice("QuestionToken", "ExclamationToken"));
const callable: readonly HirField[] = Object.freeze([
  ["typeParameters", typeParameters], ["parameters", parameters],
  ["type", annotation], ["fullSignature", annotation],
]);
const property: readonly HirField[] = Object.freeze([
  ["modifiers", modifiers], ["name", "PropertyName"], ["postfixToken", postfix],
  ["type", annotation],
]);
const tag: readonly HirField[] = Object.freeze([
  ["tagName", "Identifier"], ["comment", hirNullable(list("JSDocComment"))],
]);
const literal: readonly HirField[] = Object.freeze([
  ["text", "string"], ["tokenFlags", hirArray("TokenFlag")],
]);
const template: readonly HirField[] = Object.freeze([
  ...literal, ["rawText", "string"], ["templateFlags", hirArray("TokenFlag")],
]);
const classFields: readonly HirField[] = Object.freeze([
  ["modifiers", modifiers], ["name", hirNullable("Identifier")],
  ["typeParameters", typeParameters], ["heritageClauses", hirNullable(list("HeritageClause"))],
  ["members", list("ClassElement")],
]);
const functionFields: readonly HirField[] = Object.freeze([
  ["modifiers", modifiers], ...callable, ["asteriskToken", hirNullable("AsteriskToken")],
  ["body", hirNullable("BlockOrExpression")], ["name", hirNullable("Identifier")],
]);

export const syntaxShapes: HirSchema = Object.freeze({
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
  ForInStatement: node("ForInStatement", "CheckedIteration", [["awaitModifier", hirNullable("AwaitKeyword")], ["initializer", "ForInitializer"], ["expression", "Expression"], ["statement", "Statement"]]),
  ForOfStatement: node("ForOfStatement", "CheckedIteration", [["awaitModifier", hirNullable("AwaitKeyword")], ["initializer", "ForInitializer"], ["expression", "Expression"], ["statement", "Statement"]]),
  BreakStatement: node("BreakStatement", "null", [["label", hirNullable("Identifier")]]),
  ContinueStatement: node("ContinueStatement", "null", [["label", hirNullable("Identifier")]]),
  ReturnStatement: node("ReturnStatement", "null", [["expression", initializer]]),
  WithStatement: node("WithStatement", "null", [["expression", "Expression"], ["statement", "Statement"]]),
  SwitchStatement: node("SwitchStatement", "null", [["expression", "Expression"], ["caseBlock", "CaseBlock"]]),
  CaseBlock: node("CaseBlock", "null", [["clauses", list("CaseOrDefaultClause")]]),
  CaseClause: node("CaseClause", "null", [["expression", initializer], ["statements", list("Statement")]]),
  DefaultClause: node("DefaultClause", "null", [["expression", initializer], ["statements", list("Statement")]]),
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
  ExportAssignment: node("ExportAssignment", "CheckedExport", [["modifiers", modifiers], ["isExportEquals", "boolean"], ["type", annotation], ["expression", "Expression"]]),
  NamespaceExportDeclaration: node("NamespaceExportDeclaration", "CheckedExport", [["modifiers", modifiers], ["name", "Identifier"]]),
  NamespaceExport: node("NamespaceExport", "CheckedExport", [["name", "ModuleExportName"]]),
  NamedExports: node("NamedExports", "null", [["elements", list("ExportSpecifier")]]),
  ExportSpecifier: node("ExportSpecifier", "CheckedExport", [["isTypeOnly", "boolean"], ["propertyName", hirNullable("ModuleExportName")], ["name", "ModuleExportName"]]),
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
