import { encodeDefId, encodeGroupId } from "../../packages/host/dist/ids/index.js";

export const expectedSyntaxKinds = [
  "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia", "ConflictMarkerTrivia", "NonTextFileMarkerTrivia",
  "JsxTextAllWhiteSpaces", "OpenBraceToken", "CloseBraceToken", "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken", "DotToken",
  "DotDotDotToken", "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken", "GreaterThanToken", "LessThanEqualsToken",
  "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken",
  "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken",
  "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken", "ExclamationToken", "TildeToken", "AmpersandAmpersandToken", "BarBarToken",
  "QuestionToken", "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken", "HashToken", "EqualsToken", "PlusEqualsToken",
  "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken",
  "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken", "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken", "JSDocCommentTextToken", "BreakKeyword",
  "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword", "DefaultKeyword", "DeleteKeyword",
  "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword", "FinallyKeyword", "ForKeyword", "FunctionKeyword",
  "IfKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword", "ReturnKeyword", "SwitchKeyword", "ThrowKeyword", "TryKeyword",
  "TypeOfKeyword", "VarKeyword", "WhileKeyword", "WithKeyword", "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword",
  "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword",
  "AssertsKeyword", "AssertKeyword", "AsyncKeyword", "AwaitKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword",
  "InferKeyword", "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword",
  "SatisfiesKeyword", "SetKeyword", "TypeKeyword", "UniqueKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword", "OverrideKeyword",
  "OfKeyword", "DeferKeyword", "Identifier", "PrivateIdentifier", "QualifiedName", "ComputedPropertyName", "Decorator", "EmptyStatement",
  "IfStatement", "DoStatement", "WhileStatement", "ForStatement", "ForInStatement", "ForOfStatement", "BreakStatement", "ContinueStatement",
  "ReturnStatement", "WithStatement", "SwitchStatement", "CaseBlock", "CaseClause", "DefaultClause", "ThrowStatement", "TryStatement",
  "CatchClause", "DebuggerStatement", "LabeledStatement", "ExpressionStatement", "Block", "VariableStatement", "VariableDeclaration", "VariableDeclarationList",
  "ObjectBindingPattern", "ArrayBindingPattern", "Parameter", "BindingElement", "MissingDeclaration", "FunctionDeclaration", "ClassDeclaration", "ClassExpression",
  "HeritageClause", "InterfaceDeclaration", "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumMember", "EnumDeclaration", "ModuleBlock", "NotEmittedStatement",
  "NotEmittedTypeElement", "ImportDeclaration", "JSImportDeclaration", "ExternalModuleReference", "NamespaceImport", "NamedImports", "ExportAssignment", "NamespaceExportDeclaration",
  "NamespaceExport", "NamedExports", "ExportSpecifier", "CallSignature", "ConstructSignature", "Constructor", "GetAccessor", "SetAccessor",
  "IndexSignature", "MethodSignature", "MethodDeclaration", "PropertySignature", "PropertyDeclaration", "SemicolonClassElement", "ClassStaticBlockDeclaration", "OmittedExpression",
  "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", "StringLiteral", "NumericLiteral",
  "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression", "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "ArrowFunction",
  "FunctionExpression", "AsExpression", "SatisfiesExpression", "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression",
  "MetaProperty", "NonNullExpression", "SpreadElement", "TemplateExpression", "TemplateSpan", "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression",
  "ObjectLiteralExpression", "SpreadAssignment", "PropertyAssignment", "ShorthandPropertyAssignment", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression",
  "TypeAssertionExpression", "AnyKeyword", "BigIntKeyword", "BooleanKeyword", "IntrinsicKeyword", "NeverKeyword", "NumberKeyword", "ObjectKeyword",
  "StringKeyword", "SymbolKeyword", "UndefinedKeyword", "UnknownKeyword", "VoidKeyword", "UnionType", "IntersectionType", "ConditionalType",
  "TypeOperator", "InferType", "ArrayType", "IndexedAccessType", "TypeReference", "ExpressionWithTypeArguments", "LiteralType", "ThisType",
  "TypePredicate", "ImportAttribute", "ImportAttributes", "TypeQuery", "MappedType", "TypeLiteral", "TupleType", "NamedTupleMember",
  "OptionalType", "RestType", "ParenthesizedType", "FunctionType", "ConstructorType", "TemplateHead", "TemplateMiddle", "TemplateTail",
  "TemplateLiteralType", "TemplateLiteralTypeSpan", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement",
  "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", "JsxAttribute", "JsxSpreadAttribute", "JsxClosingElement", "JsxExpression", "JsxText",
  "SyntaxList", "JSDoc", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocAllType", "JSDocVariadicType", "JSDocOptionalType",
  "JSDocTypeTag", "JSDocUnknownTag", "JSDocTemplateTag", "JSDocReturnTag", "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag",
  "JSDocOverrideTag", "JSDocDeprecatedTag", "JSDocSeeTag", "JSDocImplementsTag", "JSDocAugmentsTag", "JSDocSatisfiesTag", "JSDocThrowsTag", "JSDocThisTag",
  "JSDocImportTag", "JSDocCallbackTag", "JSDocOverloadTag", "JSDocTypedefTag", "JSDocSignature", "JSDocNameReference", "SourceFile", "ModuleDeclaration",
  "ImportEqualsDeclaration", "ExportDeclaration", "ImportType", "ImportClause", "ImportSpecifier", "JSDocText", "JSDocLink", "JSDocLinkPlain",
  "JSDocLinkCode", "TypeParameter", "SyntheticReferenceExpression", "JSDocTypeLiteral", "JSDocParameterTag", "JSDocPropertyTag",
];

export const syntaxTransportFamilies = [
  { family: "Expression", kinds: ["Identifier", "PrivateIdentifier", "ClassExpression", "OmittedExpression", "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword",
    "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "NoSubstitutionTemplateLiteral", "BinaryExpression", "PrefixUnaryExpression", "PostfixUnaryExpression", "YieldExpression", "ArrowFunction", "FunctionExpression", "AsExpression", "SatisfiesExpression", "ConditionalExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "SpreadElement", "TemplateExpression", "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", "TypeAssertionExpression", "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxNamespacedName", "JsxOpeningElement", "JsxSelfClosingElement", "JsxFragment", "JsxOpeningFragment", "JsxClosingFragment", "JsxExpression", "JsxText", "SyntheticReferenceExpression"] },
  { family: "Statement", kinds: ["EmptyStatement", "IfStatement", "DoStatement", "WhileStatement", "ForStatement", "ForInStatement", "ForOfStatement", "BreakStatement", "ContinueStatement", "ReturnStatement", "WithStatement", "SwitchStatement", "ThrowStatement", "TryStatement", "DebuggerStatement", "LabeledStatement", "ExpressionStatement", "Block", "VariableStatement", "MissingDeclaration", "FunctionDeclaration", "ClassDeclaration", "InterfaceDeclaration", "TypeAliasDeclaration", "JSTypeAliasDeclaration", "EnumDeclaration", "ModuleBlock", "NotEmittedStatement", "ImportDeclaration", "JSImportDeclaration", "ExportAssignment", "NamespaceExportDeclaration", "ModuleDeclaration", "ImportEqualsDeclaration", "ExportDeclaration"] },
  { family: "TypeNode", kinds: ["AnyKeyword", "BigIntKeyword", "BooleanKeyword", "IntrinsicKeyword", "NeverKeyword", "NumberKeyword", "ObjectKeyword", "StringKeyword", "SymbolKeyword", "UndefinedKeyword", "UnknownKeyword", "VoidKeyword", "UnionType", "IntersectionType", "ConditionalType", "TypeOperator", "InferType", "ArrayType", "IndexedAccessType", "TypeReference", "LiteralType", "ThisType", "TypePredicate", "TypeQuery", "MappedType", "TypeLiteral", "TupleType", "NamedTupleMember", "OptionalType", "RestType", "ParenthesizedType", "FunctionType", "ConstructorType", "TemplateLiteralType", "TemplateLiteralTypeSpan", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocAllType", "JSDocVariadicType", "JSDocOptionalType", "JSDocSignature", "JSDocNameReference", "ImportType", "JSDocTypeLiteral"] },
  { family: "ClassElement", kinds: ["Constructor", "GetAccessor", "SetAccessor", "IndexSignature", "MethodDeclaration", "PropertyDeclaration", "SemicolonClassElement", "ClassStaticBlockDeclaration"] },
  { family: "TypeElement", kinds: ["NotEmittedTypeElement", "CallSignature", "ConstructSignature", "GetAccessor", "SetAccessor", "IndexSignature", "MethodSignature", "PropertySignature"] },
  { family: "ObjectLiteralElementLike", kinds: ["PropertyAssignment", "ShorthandPropertyAssignment", "SpreadAssignment", "MethodDeclaration", "GetAccessor", "SetAccessor"] },
];

syntaxTransportFamilies.push(
  { family: "BodyRoot", kinds: ["Block", ...syntaxTransportFamilies[0].kinds] },
  { family: "BlockOrExpression", kinds: ["Block", ...syntaxTransportFamilies[0].kinds] },
  { family: "LeftHandSideExpression", kinds: ["Identifier", "PrivateIdentifier", "ClassExpression", "StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral", "FunctionExpression", "PropertyAccessExpression", "ElementAccessExpression", "CallExpression", "NewExpression", "MetaProperty", "NonNullExpression", "TemplateExpression", "TaggedTemplateExpression", "ParenthesizedExpression", "ArrayLiteralExpression", "ObjectLiteralExpression", "ExpressionWithTypeArguments", "PartiallyEmittedExpression", "JsxElement", "JsxAttributes", "JsxSelfClosingElement", "JsxFragment"] },
  { family: "EntityName", kinds: ["Identifier", "QualifiedName"] },
  { family: "MemberName", kinds: ["Identifier", "PrivateIdentifier"] },
  { family: "NodeBody", kinds: ["Block", "ModuleBlock", "ModuleDeclaration", ...syntaxTransportFamilies[0].kinds] },
  { family: "ForInitializer", kinds: ["MissingDeclaration", "VariableDeclarationList", ...syntaxTransportFamilies[0].kinds] },
  { family: "BindingName", kinds: ["Identifier", "ObjectBindingPattern", "ArrayBindingPattern"] },
  { family: "PropertyName", kinds: ["Identifier", "StringLiteral", "NoSubstitutionTemplateLiteral", "NumericLiteral", "ComputedPropertyName", "PrivateIdentifier", "BigIntLiteral"] },
  { family: "LiteralTypeChild", kinds: ["StringLiteral", "NumericLiteral", "BigIntLiteral", "NoSubstitutionTemplateLiteral", "TrueKeyword", "FalseKeyword", "NullKeyword", "PrefixUnaryExpression"] },
  { family: "TypePredicateParameterName", kinds: ["Identifier", "ThisType"] },
  { family: "ImportAttributeName", kinds: ["Identifier", "StringLiteral"] },
  { family: "ModuleName", kinds: ["Identifier", "StringLiteral"] },
  { family: "ModuleReference", kinds: ["Identifier", "QualifiedName", "ExternalModuleReference"] },
  { family: "ModuleExportName", kinds: ["Identifier", "StringLiteral"] },
  { family: "NamedImportBindings", kinds: ["NamedImports", "NamespaceImport"] },
  { family: "NamedExportBindings", kinds: ["NamedExports", "NamespaceExport"] },
  { family: "TemplateLiteral", kinds: ["NoSubstitutionTemplateLiteral", "TemplateExpression"] },
  { family: "JsxChild", kinds: ["JsxText", "JsxExpression", "JsxElement", "JsxSelfClosingElement", "JsxFragment"] },
  { family: "JsxTagNameExpression", kinds: ["Identifier", "NullKeyword", "TrueKeyword", "FalseKeyword", "ThisKeyword", "SuperKeyword", "ImportKeyword", "PropertyAccessExpression", "JsxNamespacedName"] },
  { family: "JsxAttributeValue", kinds: ["StringLiteral", "JsxExpression", "JsxElement", "JsxSelfClosingElement", "JsxFragment"] },
  { family: "JSDocFullName", kinds: ["Identifier", "ModuleDeclaration"] },
);

export function syntaxTransportModule(input, value, family) {
  const module = structuredClone(input.module);
  const root = module.tree;
  const node = structuredClone(value);
  let maximum = root.id;
  for (const value of syntaxPhysicalNodes(node)) maximum = Math.max(maximum, value.id);
  const header = id => ({ id, origin: root.origin, parent: root.id, flags: [], loc: root.loc });
  const list = nodes => ({ loc: root.loc, nodes });
  const wrapper = header(maximum + 1);
  const typedValue = { type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const emptyBindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const property = id => ({ ...header(id), kind: "Identifier", text: "value", tsonic: { role: "property-name", key: { kind: "text", value: "value" } } });
  const selected = { decision: { key: { kind: "text", value: "value" }, origins: [], selectedDeclarations: [], primary: null,
    read: 0, write: null, getter: null, setter: null, bindings: emptyBindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
  if (["LeftHandSideExpression", "NodeBody", "ForInitializer", "BindingName", "PropertyName", "LiteralTypeChild", "TypePredicateParameterName",
    "ImportAttributeName", "ModuleName", "ModuleReference", "ModuleExportName", "NamedImportBindings", "NamedExportBindings", "TemplateLiteral",
    "JsxChild", "JsxTagNameExpression", "JsxAttributeValue", "JSDocFullName"].includes(family)) {
    const parent = syntaxParentCarrier(node, family, module.bodies[0].tir.owner, maximum + 1);
    return syntaxTransportModule({ ...input, module }, parent, "SyntaxNode");
  }
  if (family === "BodyRoot") {
    node.parent = null;
    module.bodies[0].tir.root = node;
    return module;
  }
  node.parent = family === "Statement" ? root.id : wrapper.id;
  let statement;
  switch (family) {
    case "Statement": statement = node; break;
    case "SyntaxNode": {
      const tag = { ...header(maximum + 2), parent: maximum + 3, kind: "JSDocTypeTag", comment: null,
        tagName: { ...property(maximum + 4), parent: maximum + 2 }, typeExpression: node, tsonic: null };
      node.parent = tag.id;
      const type = { ...header(maximum + 3), parent: wrapper.id, kind: "JSDocTypeLiteral", jsDocPropertyTags: [tag], isArrayType: false, tsonic: null };
      const expression = { ...wrapper, kind: "AsExpression", type, expression: { ...header(maximum + 5), parent: wrapper.id,
        kind: "NullKeyword", tsonic: { ...typedValue, role: "value" } }, tsonic: typedValue };
      statement = { ...header(maximum + 6), kind: "ExpressionStatement", expression, tsonic: null };
      expression.parent = statement.id;
      break;
    }
    case "Expression": statement = { ...wrapper, kind: "ExpressionStatement", expression: node, tsonic: null }; break;
    case "BlockOrExpression": {
      const expression = { ...wrapper, kind: "ArrowFunction", modifiers: null, typeParameters: null, parameters: list([]),
        type: null, fullSignature: null, asteriskToken: null, body: node,
        equalsGreaterThanToken: { ...header(maximum + 2), parent: wrapper.id, kind: "EqualsGreaterThanToken", tsonic: null },
        tsonic: { ...typedValue, callable: { definition: module.bodies[0].tir.owner, parameters: [], signatures: [], template: null, attributes: [] },
          closure: { kind: "decided", decision: { carrier: 0, captures: [], execution: { kind: "pure" } } } } };
      statement = { ...header(maximum + 3), kind: "ExpressionStatement", expression, tsonic: null };
      expression.parent = statement.id;
      break;
    }
    case "LeftHandSideExpression": case "MemberName": {
      const expression = { ...wrapper, kind: "PropertyAccessExpression", questionDotToken: null,
        expression: family === "LeftHandSideExpression" ? node : { ...property(maximum + 2), parent: wrapper.id,
          tsonic: { ...typedValue, role: "value", resolution: { kind: "definition", definition: module.bodies[0].tir.owner, aliases: [] } } },
        name: family === "MemberName" ? node : { ...property(maximum + 2), parent: wrapper.id },
        tsonic: { ...typedValue, role: "value", selection: { kind: "decided", decision: selected } } };
      statement = { ...header(maximum + 3), kind: "ExpressionStatement", expression, tsonic: null };
      expression.parent = statement.id;
      break;
    }
    case "EntityName": {
      const type = { ...wrapper, kind: "TypeReference", typeName: node, typeArguments: null, tsonic: { type: 0, declarations: [] } };
      const declaration = header(maximum + 2);
      type.parent = declaration.id;
      statement = { ...declaration, kind: "TypeAliasDeclaration", modifiers: null, name: { ...property(maximum + 3), parent: declaration.id,
        tsonic: { role: "declaration-name", declaration: { kind: "definition", definition: module.bodies[0].tir.owner }, storage: null } },
        typeParameters: null, type, tsonic: { definition: module.bodies[0].tir.owner, parameters: [], type: 0 } };
      break;
    }
    case "TypeNode": statement = { ...wrapper, kind: "TypeAliasDeclaration", modifiers: null, name: {
      ...header(maximum + 2), parent: wrapper.id, kind: "Identifier", text: "Transport", tsonic: {
        role: "declaration-name", declaration: { kind: "definition", definition: module.bodies[0].tir.owner }, storage: null,
      } }, typeParameters: null, type: node, tsonic: { definition: module.bodies[0].tir.owner, parameters: [], type: 0 } }; break;
    case "ClassElement": case "TypeElement": statement = { ...wrapper, kind: family === "ClassElement" ? "ClassDeclaration" : "InterfaceDeclaration",
      modifiers: null, name: { ...header(maximum + 2), parent: wrapper.id, kind: "Identifier", text: "Transport", tsonic: {
        role: "declaration-name", declaration: { kind: "definition", definition: module.bodies[0].tir.owner }, storage: null,
      } }, typeParameters: null, heritageClauses: null, members: list([node]),
      tsonic: family === "ClassElement" ? { definition: module.bodies[0].tir.owner, parameters: [], type: 0, heritage: [], members: [], attributes: [] }
        : { definition: module.bodies[0].tir.owner, parameters: [], type: 0, members: [] } }; break;
    case "ObjectLiteralElementLike": {
      const expression = { ...wrapper, kind: "ObjectLiteralExpression", multiLine: false, properties: list([node]), tsonic: {
        type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" },
        role: "value", construction: { kind: "decided", decision: { permissionScope: null,
          decision: { kind: "selected", operation: { kind: "object-construction", parts: [] }, operands: [], result: 0, execution: { kind: "pure" } } } },
      } };
      statement = { ...header(maximum + 2), kind: "ExpressionStatement", expression, tsonic: null };
      expression.parent = statement.id;
      break;
    }
    default: throw new Error(`Unknown declared syntax transport family: ${family}`);
  }
  root.statements = list([statement]);
  module.bodies[0].tir.root = root;
  return module;
}

export function syntaxPhysicalNodes(root) {
  const nodes = [];
  const pending = [root];
  for (const value of pending) {
    if (value === null || typeof value !== "object") continue;
    if (!Array.isArray(value) && typeof value.kind === "string" && Object.hasOwn(value, "id")
      && Object.hasOwn(value, "origin") && Object.hasOwn(value, "loc")) nodes.push(value);
    for (const child of Object.values(value)) pending.push(child);
  }
  return nodes;
}

function syntaxParentCarrier(node, family, definition, first) {
  let next = first;
  const header = parent => ({ id: next++, origin: node.origin, parent, flags: [], loc: node.loc });
  const own = header(null);
  node.parent = own.id;
  const list = nodes => ({ loc: node.loc, nodes });
  const property = parent => ({ ...header(parent), kind: "Identifier", text: "Transport", tsonic: { role: "property-name", key: { kind: "text", value: "Transport" } } });
  const name = parent => ({ ...property(parent), tsonic: { role: "declaration-name", declaration: { kind: "definition", definition }, storage: null } });
  const value = { type: 0, convertedType: 0, conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" } };
  const literal = parent => ({ ...header(parent), kind: "StringLiteral", text: "value", tokenFlags: [], tsonic: { ...value, role: "value", value: "value" } });
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const advertised = { declaration: definition, role: "advertised", signature: 0, body: null };
  const application = { callee: { decision: { candidate: 0, advertised, api: { ...advertised, role: "api-signature" },
    bindings, implementationBindings: bindings, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
    activation: null }, receiver: null, arguments: [] };
  switch (family) {
    case "LeftHandSideExpression": return { ...own, kind: "Decorator", expression: node, tsonic: { application: { kind: "decided", decision: application } } };
    case "NodeBody": case "ModuleName": return { ...own, kind: "ModuleDeclaration", modifiers: null, asteriskToken: null,
      name: family === "ModuleName" ? node : name(own.id), body: family === "NodeBody" ? node : null, keyword: "NamespaceKeyword",
      tsonic: { definition, type: 0, template: null } };
    case "ForInitializer": return { ...own, kind: "ForStatement", initializer: node, condition: null, incrementor: null,
      statement: { ...header(own.id), kind: "EmptyStatement", tsonic: null }, tsonic: null };
    case "BindingName": return { ...own, kind: "VariableDeclaration", name: node, type: null, exclamationToken: null, initializer: null,
      tsonic: { declaration: { kind: "definition", definition }, storage: 0, initializer: null } };
    case "PropertyName": return { ...own, kind: "PropertyDeclaration", modifiers: null, name: node, postfixToken: null, type: null, initializer: null,
      tsonic: { definition, storage: 0, initializer: null, attributes: [] } };
    case "LiteralTypeChild": return { ...own, kind: "LiteralType", literal: node, tsonic: { type: 0, declarations: [] } };
    case "TypePredicateParameterName": return { ...own, kind: "TypePredicate", assertsModifier: null, parameterName: node, type: null,
      tsonic: { parameter: definition, narrowed: null, asserts: false } };
    case "ImportAttributeName": return { ...own, kind: "ImportAttribute", name: node, value: literal(own.id), tsonic: null };
    case "ModuleReference": return { ...own, kind: "ImportEqualsDeclaration", modifiers: null, isTypeOnly: false, name: name(own.id),
      moduleReference: node, tsonic: { binding: { kind: "item", value: { owner: definition, node: own.id } } } };
    case "ModuleExportName": return { ...own, kind: "ExportSpecifier", isTypeOnly: false, propertyName: null, name: node,
      tsonic: { binding: { kind: "item", value: { owner: definition, node: own.id } } } };
    case "NamedImportBindings": return { ...own, kind: "ImportClause", phaseModifier: null, name: null, namedBindings: node,
      tsonic: { binding: { kind: "item", value: { owner: definition, node: own.id } } } };
    case "NamedExportBindings": return { ...own, kind: "ExportDeclaration", modifiers: null, isTypeOnly: false, exportClause: node,
      moduleSpecifier: null, attributes: null, tsonic: { target: null } };
    case "TemplateLiteral": return { ...own, kind: "TaggedTemplateExpression", tag: { ...name(own.id), tsonic: {
      ...value, role: "value", resolution: { kind: "definition", definition, aliases: [] } } }, questionDotToken: null, typeArguments: null,
      template: node, tsonic: { ...value, application: { kind: "decided", decision: application }, operation: null } };
    case "JsxChild": return { ...own, kind: "JsxFragment", openingFragment: { ...header(own.id), kind: "JsxOpeningFragment", tsonic: null },
      children: list([node]), closingFragment: { ...header(own.id), kind: "JsxClosingFragment", tsonic: null }, tsonic: null };
    case "JsxTagNameExpression": return { ...own, kind: "JsxClosingElement", tagName: node, tsonic: null };
    case "JsxAttributeValue": return { ...own, kind: "JsxAttribute", name: property(own.id), initializer: node, tsonic: null };
    case "JSDocFullName": return { ...own, kind: "JSDocTypedefTag", tagName: property(own.id), comment: null, typeExpression: null, name: node, tsonic: null };
    default: throw new Error(`Unlisted actual parent carrier: ${family}`);
  }
}

export function nullableSyntaxCases(node, definition, body) {
  let next = 1;
  for (const value of syntaxPhysicalNodes(node)) next = Math.max(next, value.id + 1);
  const header = parent => ({ id: next++, origin: node.origin, parent, flags: [], loc: node.loc });
  const list = nodes => ({ loc: node.loc, nodes });
  const name = parent => ({ ...header(parent), kind: "Identifier", text: "Transport", tsonic: {
    role: "declaration-name", declaration: { kind: "definition", definition }, storage: 0,
  } });
  const type = parent => ({ ...header(parent), kind: "VoidKeyword", tsonic: { type: 0, declarations: [] } });
  const value = parent => ({ ...header(parent), kind: "NullKeyword", tsonic: { type: 0, convertedType: 0,
    conversion: { kind: "identity" }, narrowing: null, evidenceIndex: null, demand: { kind: "always" }, role: "value" } });
  const parameter = parent => {
    const own = header(parent);
    return { ...own, kind: "Parameter", modifiers: null, dotDotDotToken: null, name: name(own.id), questionToken: null,
      type: null, initializer: null, tsonic: { declaration: definition, local: { body, local: 0 }, storage: 0, passing: "by-value", initializer: null } };
  };
  const typeParameter = parent => {
    const own = header(parent);
    return { ...own, kind: "TypeParameter", modifiers: null, name: name(own.id), constraint: null, expression: null, defaultType: null,
      tsonic: { parameter: { identity: { owner: definition, index: 0 }, declaration: definition, constraint: null, default: null } } };
  };
  const heritage = parent => {
    const own = header(parent);
    const expression = header(own.id);
    return { ...own, kind: "HeritageClause", token: "ExtendsKeyword", types: list([{ ...expression, kind: "ExpressionWithTypeArguments",
      expression: { ...name(expression.id), tsonic: { role: "type-name", type: 0, declarations: [definition] } }, typeArguments: null,
      tsonic: { role: "heritage", type: 0, bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] }, declarations: [definition] } }]),
      tsonic: { types: [0] } };
  };
  const declaration = parent => {
    const own = header(parent);
    return { ...own, kind: "VariableDeclaration", name: name(own.id), exclamationToken: null, type: null, initializer: null,
      tsonic: { declaration: { kind: "definition", definition }, storage: 0, initializer: null } };
  };
  const providers = new Map([
    ["modifiers", () => list([{ ...header(node.id), kind: "ExportKeyword", tsonic: null }])],
    ["typeParameters", () => list([typeParameter(node.id)])], ["heritageClauses", () => list([heritage(node.id)])],
    ["parameters", () => list([parameter(node.id)])], ["typeArguments", () => list([type(node.id)])],
    ["type", () => type(node.id)], ["fullSignature", () => type(node.id)], ["constraint", () => type(node.id)], ["defaultType", () => type(node.id)],
    ["initializer", () => value(node.id)], ["expression", () => value(node.id)], ["objectAssignmentInitializer", () => value(node.id)],
    ["name", () => name(node.id)], ["propertyName", () => name(node.id)], ["variableDeclaration", () => declaration(node.id)],
    ["phaseModifier", () => "TypeKeyword"],
    ["typeExpression", () => type(node.id)], ["qualifier", () => name(node.id)],
    ["nameType", () => type(node.id)],
    ["body", () => ({ ...header(node.id), kind: "Block", statements: list([]), multiLine: false, tsonic: null })],
    ["members", () => {
      const own = header(node.id);
      return list([{ ...own, kind: "PropertySignature", modifiers: null, name: { ...name(own.id), tsonic: { role: "property-name", key: { kind: "text", value: "Transport" } } },
        postfixToken: null, type: type(own.id), initializer: null, tsonic: { definition, storage: 0, initializer: null, attributes: [] } }]);
    }],
    ["tags", () => list([])],
    ["importClause", () => ({ ...header(node.id), kind: "ImportClause", phaseModifier: null, name: null, namedBindings: null,
      tsonic: null })],
    ["jsDocPropertyTags", () => []],
    ["attributes", () => ({ ...header(node.id), kind: "ImportAttributes", token: "WithKeyword", attributes: list([]), multiLine: false, tsonic: null })],
    ["exportClause", () => ({ ...header(node.id), kind: "NamedExports", elements: list([]), tsonic: null })],
    ["label", () => ({ ...header(node.id), kind: "Identifier", text: "Transport", tsonic: { role: "label", target: { body, node: node.id } } })],
    ["comment", () => list([{ ...header(node.id), kind: "JSDocText", text: ["complete comment"], tsonic: null }])],
  ]);
  for (const [field, kind] of [["asteriskToken", "AsteriskToken"], ["dotDotDotToken", "DotDotDotToken"],
    ["questionToken", "QuestionToken"], ["questionDotToken", "QuestionDotToken"], ["postfixToken", "QuestionToken"], ["exclamationToken", "ExclamationToken"], ["assertsModifier", "AssertsKeyword"]])
    providers.set(field, () => ({ ...header(node.id), kind, tsonic: null }));
  const nullableAnnotations = new Set(["Parameter", "VariableDeclaration", "PropertyDeclaration", "PropertySignature", "FunctionDeclaration", "FunctionExpression",
    "ArrowFunction", "MethodDeclaration", "MethodSignature", "CallSignature", "ConstructSignature", "Constructor", "GetAccessor", "SetAccessor", "IndexSignature", "TypePredicate", "FunctionType", "ConstructorType", "MappedType", "JSDocSignature"]);
  const optionalLists = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunction", "ClassDeclaration", "ClassExpression", "InterfaceDeclaration",
    "TypeAliasDeclaration", "JSTypeAliasDeclaration", "MethodDeclaration", "MethodSignature", "CallSignature", "ConstructSignature", "FunctionType", "ConstructorType", "JSDocSignature"]);
  const result = [];
  for (const [field, provide] of providers) {
    if (!Object.hasOwn(node, field)) continue;
    if (field === "body" && node.kind !== "FunctionDeclaration"
      || field === "members" && node.kind !== "MappedType" && node.kind !== "TypeLiteral") continue;
    if (field === "expression" && node.kind === "DefaultClause"
      || field === "questionToken" && node.kind === "ConditionalExpression"
      || field === "label" && node.kind === "LabeledStatement"
      || field === "initializer" && node.kind === "PropertyAssignment"
      || field === "comment" && node.kind === "JSDoc"
      || field === "attributes" && ["ImportAttributes", "JsxOpeningElement", "JsxSelfClosingElement"].includes(node.kind)) continue;
    if (node[field] === null) result.push({ field, node: { ...structuredClone(node), [field]: provide() } });
    else if (field === "parameters" && node[field].nodes.length === 0) result.push({ field, node: { ...structuredClone(node), [field]: provide() } });
    else if (field === "typeParameters" && node[field].nodes.length === 0
      || field === "members" && node[field].nodes.length === 0) {
      result.push({ field, node: { ...structuredClone(node), [field]: provide() } });
      if (field === "typeParameters" && optionalLists.has(node.kind) || node.kind === "MappedType")
        result.push({ field: `${field}:null`, node: { ...structuredClone(node), [field]: null } });
    }
    else if (["modifiers", "heritageClauses", "fullSignature", "typeArguments", "asteriskToken", "dotDotDotToken", "questionToken", "questionDotToken", "postfixToken", "exclamationToken", "variableDeclaration", "label", "objectAssignmentInitializer", "defaultType", "phaseModifier", "jsDocPropertyTags", "qualifier", "exportClause", "attributes", "assertsModifier", "comment"].includes(field)
      || field === "typeExpression" && ["JSDocTypedefTag", "JSDocParameterTag", "JSDocPropertyTag"].includes(node.kind)
      || field === "initializer" && node.kind !== "ForInStatement" && node.kind !== "ForOfStatement"
      || field === "constraint" && node.kind === "TypeParameter"
      || ["nameType", "body", "importClause", "tags"].includes(field)
      || field === "members" && node.kind === "MappedType"
      || field === "propertyName"
      || field === "name" && ["FunctionDeclaration", "FunctionExpression", "ClassDeclaration", "ImportClause", "JSDocCallbackTag", "JSDocLink", "JSDocLinkPlain", "JSDocLinkCode"].includes(node.kind)
      || field === "type" && nullableAnnotations.has(node.kind) || field === "typeParameters" && optionalLists.has(node.kind))
      result.push({ field, node: { ...structuredClone(node), [field]: null } });
  }
  return result;
}

export function relationalTransportFacts(fixture) {
  const facts = structuredClone(fixture.module.bodies[0].facts);
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const member = fixture.index.metadata[0].fields[0].member;
  const at = { body: fixture.bodyId, node: 0 };
  const bodyOwner = { kind: "body", instance: fixture.instance };
  const summaryOwner = { kind: "summary", definition: fixture.definition, bindings: { kind: "parametric" } };
  const summary = { definition: fixture.definition, bindings: { kind: "parametric" } };
  const advertised = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  const application = { candidate: 0, advertised, api: { ...advertised, role: "api-signature" }, bindings,
    implementationBindings: bindings, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null };
  const resolution = { decision: application, activation: fixture.instance };
  const argument = owner => ({ authoredIndex: 0, parameter: fixture.definition, parameterIndex: 0, repeated: false,
    passing: "by-value", actual: 0, formal: { owner, producer: 0 }, projection: null });
  facts.arena = {
    projections: [{ id: 0, parent: null, projection: { kind: "field", member } },
      { id: 1, parent: null, projection: { kind: "method-value", member } },
      { id: 2, parent: null, projection: { kind: "element" } },
      { id: 3, parent: null, projection: { kind: "index", constant: 0n } },
      { id: 4, parent: null, projection: { kind: "deref" } }],
    producers: [{ id: 0, path: null, kind: "shared", definition: fixture.definition }],
    contexts: [{ id: 0, receiver: null, arguments: [0], captures: [] }],
    boundProducers: [{ id: 0, producer: 0, bindings, context: 0 }],
    origins: [{ id: 0, producers: [0], includesAbsence: false, kind: "complete" }],
    boundaries: [{ id: 0, kind: "external-input", at: { kind: "node", node: at }, subject: 0, owner: null,
      bindings, context: 0, detail: "external structural carrier" }],
  };
  facts.origins.invocations = [{ node: 0, kind: "call", alternatives: [{ resolution, context: 0,
    arguments: [argument(bodyOwner), argument(summaryOwner)], result: 0, thrown: 0, summary }], boundaries: [] }];
  facts.origins.callbacks = [{ node: 0, argument: argument(bodyOwner), timing: "synchronous", rejection: null, inputs: [] }];
  facts.origins.activations = [{ node: 0, activation: fixture.instance, context: 0, caller: null, entry: null },
    { node: 0, activation: fixture.instance, context: 0, caller: 0, entry: argument(summaryOwner) }];
  facts.origins.constructions = [{ node: 0, root: at, allocation: at, implementation: fixture.definition, body: null, regions: [] },
    { node: 0, root: at, allocation: at, implementation: fixture.definition, body: fixture.instance, regions: [] }];
  facts.rawLocations = [{ node: 0, operation: "to-raw", pointee: 1,
    layout: { metadata: fixture.index.metadata[0].key, layout: 1 }, context: 0, bindings }];
  facts.observations = [null, { metadata: fixture.index.metadata[0].key, field: 0 }].map(field => ({
    node: 0, operation: field === null ? "size" : "field-offset", operand: at,
    layout: { metadata: fixture.index.metadata[0].key, layout: 0 }, field, result: 0, value: 0n, context: 0, bindings,
  }));
  facts.closedArrays = [{ node: 0, kind: "unproven", reason: { kind: "no-local-allocation", at } },
    { node: 0, kind: "closed", declarations: [{ kind: "local", local: { body: fixture.instance.body, local: 0 } },
      { kind: "definition", definition: fixture.definition }], references: [at], literals: [at], elements: [member] }];
  return facts;
}

export function mirTransportCases(fixture) {
  const source = fixture.module.bodies[0].mir;
  const bindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const instance = fixture.instance;
  const endpoint = { declaration: fixture.definition, role: "advertised", signature: 0, body: null };
  const selected = { decision: { candidate: 0, advertised: endpoint, api: { ...endpoint, role: "api-signature" },
    bindings, implementationBindings: bindings, parameters: [], completion: { signature: 0, completion: 0, yielded: null, sent: null }, result: 0, activation: null },
    activation: instance };
  const operation = { permissionScope: null, decision: { kind: "selected", operation: { kind: "boolean-operator", operator: "!" }, operands: [0], result: 0, execution: { kind: "pure" } } };
  const member = { decision: { key: { kind: "text", value: "value" }, origins: [], selectedDeclarations: [], primary: null,
    read: 0, write: 0, getter: null, setter: null, bindings, location: { kind: "data", check: { kind: "none" }, receiver: "in-place" } }, getter: null, setter: null };
  const operand = { kind: "constant", constant: 0 };
  const local = { id: 0, storage: 0, role: { kind: "temporary" }, source: null, origin: fixture.module.tree.origin };
  const root = { id: 0, storage: 0, base: { kind: "local", local: 0 }, origin: local.origin };
  const constant = { id: 0, type: 0, value: { kind: "literal", value: { kind: "absence" } } };
  const site = { origin: local.origin, tir: { body: fixture.bodyId, node: 0 } };
  const cases = [];
  const body = changes => ({ ...structuredClone(source), locals: [local], constants: [constant], places: [root], ...changes });
  const values = [{ kind: "use", operand }, { kind: "unary", operation, operand }, { kind: "binary", operation, left: operand, right: operand },
    { kind: "convert", operation, operand, to: 0 }, { kind: "address-of", place: 0, type: 0 },
    { kind: "closure", instance, captures: [{ local: { body: fixture.bodyId, local: 0 }, place: 0 }] },
    ...["array", "tuple", "fixed-array"].map(kind => ({ kind: "aggregate", type: 0, aggregate: { kind, elements: [operand] } })),
    ...["object", "record"].map(kind => ({ kind: "aggregate", type: 0, aggregate: { kind, fields: [{ member, value: operand }] } }))];
  for (const [position, value] of values.entries()) cases.push({ name: `rvalue-${position}-${value.kind}`, body: body({ blocks: [
    { ...source.blocks[0], statements: [{ ...site, kind: "assign", place: 0, value, step: null }] },
  ] }) });
  for (const kind of ["place", "checked"]) for (const projection of [{ kind: "field", member }, { kind: "element", index: 0 }, { kind: "index", operand },
    { kind: "deref" }, { kind: "refined" }, { kind: "capture", index: 0 }]) cases.push({ name: `projection-${kind}-${projection.kind}`, body: body({
    places: [root, { ...root, id: 1, base: { kind, place: 0, projection, tir: site.tir } }],
  }) });
  cases.push({ name: "static-root", body: body({ places: [{ ...root, base: { kind: "static", definition: fixture.definition } }] }) });
  for (const value of [{ kind: "definition", definition: fixture.definition, bindings: { kind: "parametric" } },
    { kind: "metadata", definition: fixture.definition, bindings: { kind: "instantiated", bindings } },
    { kind: "observation", at: site.tir }, { kind: "constant", reference: { initializer: fixture.instance } }])
    cases.push({ name: `constant-${value.kind}`, body: body({ constants: [{ ...constant, value }] }) });
  for (const callee of [{ kind: "direct", resolution: selected }, { kind: "indirect", operand, resolution: selected }, { kind: "body", instance, captures: [] }])
    cases.push({ name: `call-${callee.kind}`, body: body({ blocks: [{ ...source.blocks[0], terminator: { ...site,
      kind: "call", callee, receiver: null, arguments: [], destination: null, next: 0, unwind: { kind: "escape" }, step: null,
    } }] }) });
  cases.push({ name: "invoke", body: body({ blocks: [{ ...source.blocks[0], terminator: { ...site, kind: "invoke", operation,
    operands: [operand], destination: null, next: 0, unwind: { kind: "escape" }, step: null,
  } }] }) });
  for (const terminator of [{ kind: "goto", target: 0 },
    { kind: "switch", operand, targets: [{ constant: 0, target: 0 }], otherwise: 0, step: null },
    { kind: "await", operand, destination: 0, resume: 0, unwind: { kind: "escape" }, step: null },
    { kind: "yield", operand, destination: 0, resume: 0, return: { destination: 0, target: 0 }, unwind: { kind: "escape" }, step: null },
    { kind: "delegate", iterator: operand, destination: 0, resume: 0, return: { destination: 0, target: 0 }, unwind: { kind: "escape" }, step: null },
    { kind: "throw", operand, unwind: { kind: "handler", exception: 0, target: 0 } }])
    cases.push({ name: `terminator-${terminator.kind}`, body: body({ blocks: [{ ...source.blocks[0], terminator: { ...site, ...terminator } }] }) });
  return cases;
}

export function genericCarrierCase(fixture, kind) {
  const parameter = { owner: fixture.definition, index: 0 };
  const reference = { kind: "body", value: { body: fixture.bodyId, node: 0 } };
  const construction = { occurrence: reference.value, captures: [] };
  const member = { key: { kind: "text", value: "value" }, origins: [{ kind: "declared", declaration: fixture.definition }],
    readOrigins: [{ kind: "declared", declaration: fixture.definition }], writeOrigins: [],
    kind: "property", read: 2, write: null, optional: false, readonly: true };
  let generic;
  let concrete;
  switch (kind) {
    case "literal": generic = { kind, value: { kind: "string", value: "value" }, base: 2 }; concrete = { ...generic, base: 1 }; break;
    case "union": case "intersection": generic = { kind, members: [2, 5] }; concrete = { kind, members: [1, 5] }; break;
    case "array": generic = { kind, element: 2, readonly: false }; concrete = { ...generic, element: 1 }; break;
    case "fixed-array": generic = { kind, element: 2, extent: { length: 4n, runtimeBase: "bigint" } }; concrete = { ...generic, element: 1 }; break;
    case "optional": generic = { kind, value: 2 }; concrete = { kind, value: 1 }; break;
    case "optional-absence": generic = { kind: "optional", value: 2 }; concrete = { kind: "intrinsic", intrinsic: "absence" }; break;
    case "tuple": generic = { kind, readonly: false, elements: [{ kind: "required", type: 2, declaration: fixture.definition },
      { kind: "optional", type: 3, declaration: null }] }; concrete = { ...generic, elements: generic.elements.map(value => ({ ...value, type: 1 })) }; break;
    case "shape": generic = { kind, members: [member], indexes: [{ declaration: fixture.definition, key: 1, read: 2, write: 3, readonly: false }], calls: [0], constructs: [] };
      concrete = { ...generic, members: [{ ...member, read: 1 }], indexes: [{ ...generic.indexes[0], read: 1, write: 1 }] }; break;
    case "write-only-shape": generic = { kind: "shape", members: [{ ...member, read: null, write: 2, readonly: false }],
      indexes: [{ declaration: fixture.definition, key: 1, read: 3, write: null, readonly: true }], calls: [], constructs: [] };
      concrete = { ...generic, members: [{ ...generic.members[0], write: 1 }], indexes: [{ ...generic.indexes[0], read: 1 }] }; break;
    case "declared": generic = { kind, definition: fixture.definition, arguments: [2, 3], facet: "instance", extent: null };
      concrete = { ...generic, arguments: [1, 1] }; break;
    case "construction-reference": generic = { kind, definition: construction, arguments: [2, 3] }; concrete = { ...generic, arguments: [1, 1] }; break;
    case "projection-await": generic = { kind: "projection", source: 2, projection: { kind: "awaited" } }; concrete = { ...generic, source: 1 }; break;
    case "projection-component": generic = { kind: "projection", source: 2, projection: { kind: "component", component: {
      root: reference, path: transportTypeTable(fixture).terms.find(value => value.kind === "projection" && value.projection.kind === "component").projection.component.path,
    } } }; concrete = { ...generic, source: 1 }; break;
    case "callable": case "owned-callable": generic = { kind: "callable", calls: [1], constructs: [] }; concrete = { kind: "callable", calls: [2], constructs: [] }; break;
    case "composed-callable": generic = { kind: "callable", calls: [2], constructs: [] }; concrete = { kind: "callable", calls: [4], constructs: [] }; break;
    default: throw new Error(`Unlisted generic type carrier: ${kind}`);
  }
  const signature = fixture.index.types.signatures[0];
  const callable = ["callable", "owned-callable", "composed-callable"].includes(kind);
  const declaration = encodeDefId({ module: fixture.module.module, segments: [{ name: "inner", ordinal: 0 }] });
  const signatures = callable ? [signature, { ...signature, id: 1, receiver: kind === "owned-callable" ? null : 3, result: 2,
    typeParameters: kind === "owned-callable" ? [{ identity: { owner: declaration, index: 0 }, declaration, constraint: 0, default: 0 }] : [],
    declaration: kind === "owned-callable" ? declaration : signature.declaration, parameters: [
    { declaration: fixture.definition, kind: "required", type: 2, passing: "by-value", initializer: null },
  ] }] : [signature];
  if (kind === "composed-callable") signatures.push({ ...signatures[1], id: 2, composition: { kind: "union", signatures: [1] } });
  const types = { terms: [fixture.index.types.terms[0], { kind: "string" }, { kind: "param", parameter },
    { kind: "self", owner: fixture.definition }, generic,
    ...(["union", "intersection"].includes(kind) ? [{ kind: "primitive", primitive: "bool" }] : [])], signatures };
  const bindings = { classBindings: [{ kind: "bound", parameter, type: 1 }], methodBindings: [], capturedBindings: [],
    selfBindings: [{ kind: "bound", owner: fixture.definition, type: 1 }] };
  if (kind === "optional-absence") bindings.classBindings[0].type = 0;
  const mir = { ...fixture.module.bodies[0].mir, locals: [{ id: 0, storage: 4, role: { kind: "temporary" },
    source: null, origin: fixture.module.tree.origin }] };
  const index = { ...fixture.index, types };
  const module = { ...fixture.module, bodies: [{ ...fixture.module.bodies[0], mir }] };
  const expectedTypes = { terms: [...types.terms, concrete], signatures: callable ? [...signatures,
    ...signatures.slice(1).map((value, position) => ({ ...value, id: signatures.length + position, receiver: value.receiver === null ? null : 1,
      result: 1, parameters: value.parameters.map(parameter => ({ ...parameter, type: 1 })), composition: value.composition === null ? null
        : { ...value.composition, signatures: value.composition.signatures.map(identity => identity + signatures.length - 1) } })),
  ] : signatures };
  return { index, module, bindings, expected: { kind: "instantiated", artifact: { kind: "mir", body: {
    ...mir, bindings: { kind: "instantiated", bindings }, locals: [{ ...mir.locals[0], storage: types.terms.length }],
  } }, types: expectedTypes } };
}

export function transportTypeTable(fixture) {
  const definition = fixture.definition;
  const source = { kind: "body", value: { body: fixture.bodyId, node: 0 } };
  const item = { kind: "item", value: { owner: definition, node: 0 } };
  const construction = { occurrence: source.value, captures: [{ body: fixture.bodyId, local: 0 }] };
  const rational = { numerator: 1n, denominator: 2n, negativeZero: false };
  const origins = [{ kind: "declared", declaration: definition }, { kind: "class-prototype", owner: definition },
    { kind: "mapped", owner: item, key: { kind: "symbol", declaration: definition } }];
  const family = { origin: "authored", component: { root: source, path: [] }, parameters: [{ owner: definition, index: 0 }],
    roles: [{ authoredIndex: 0, component: source, member: 1 }] };
  const selectors = [
    { kind: "class-value" }, { kind: "construction-argument", definition: construction, index: 0 },
    { kind: "optional-value" }, { kind: "array-element" }, { kind: "tuple-element", index: 0 },
    { kind: "union-member", index: 0 }, { kind: "argument-place", index: 0 }, { kind: "parameter-place", index: 0 },
    { kind: "intersection-member", index: 0 }, { kind: "intersection-result" }, { kind: "argument-tail", start: 0 },
    { kind: "parameter-tail", start: 0 }, { kind: "member", origin: origins[2] }, { kind: "index-key", declaration: definition },
    { kind: "index-value", declaration: definition }, { kind: "projection-source" },
    { kind: "parameter", signature: 0, index: 0 }, { kind: "receiver", signature: 0 },
    { kind: "signature-tail", signature: 0, start: 0, readonly: true }, { kind: "tuple-slice", start: 0, endCount: 1, readonly: false },
    { kind: "result", signature: 0 }, { kind: "type-argument", declaration: definition, index: 0 },
    { kind: "sum-arm", family, index: 0 }, { kind: "awaited" },
  ];
  const literals = [{ kind: "number", value: rational }, { kind: "bigint", value: 9007199254740993n },
    { kind: "string", value: 'quote" slash\\ line\n lone\ud800' }, { kind: "boolean", value: true },
    { kind: "absence" }, { kind: "unique-symbol", declaration: definition }];
  const terms = [{ kind: "intrinsic", intrinsic: "void" }, { kind: "primitive", primitive: "bool" }, { kind: "string" },
    ...literals.map(value => ({ kind: "literal", value, base: value.kind === "string" ? 2 : 1 })),
    { kind: "union", members: [1, 2] }, { kind: "intersection", members: [1, 2] }, { kind: "optional", value: 1 },
    { kind: "array", element: 1, readonly: false },
    { kind: "tuple", elements: [{ kind: "required", type: 1, declaration: definition },
      { kind: "optional", type: 2, declaration: null }, { kind: "rest", type: 1, declaration: definition }], readonly: true },
    { kind: "fixed-array", element: 1, extent: { length: 9007199254740993n, runtimeBase: "bigint" } },
    { kind: "shape", members: [
      { key: { kind: "text", value: "value" }, origins, readOrigins: [origins[0]], writeOrigins: [origins[1]],
        kind: "property", read: 1, write: 2, optional: false, readonly: false },
      { key: { kind: "number", value: rational }, origins: [], readOrigins: [], writeOrigins: [],
        kind: "method", read: null, write: null, optional: true, readonly: true },
      { key: { kind: "symbol", declaration: definition }, origins: [origins[2]], readOrigins: [origins[2]], writeOrigins: [],
        kind: "accessor", read: 1, write: null, optional: false, readonly: true },
    ], indexes: [{ declaration: definition, key: 2, read: 1, write: 2, readonly: false },
      { declaration: definition, key: 1, read: 2, write: null, readonly: true }], calls: [0], constructs: [1] },
    { kind: "callable", calls: [0], constructs: [1] },
    { kind: "declared", definition, arguments: [1, 2], facet: "instance", extent: null },
    { kind: "declared", definition, arguments: [], facet: "value", extent: { length: 0n, runtimeBase: "number" } },
    { kind: "construction-reference", definition: construction, arguments: [1, 2] }, { kind: "enum", definition },
    { kind: "param", parameter: { owner: definition, index: 0 } }, { kind: "self", owner: definition },
    { kind: "projection", source: 1, projection: { kind: "awaited" } },
    { kind: "projection", source: 2, projection: { kind: "component", component: { root: item, path: selectors } } },
    { kind: "open", group: encodeGroupId([fixture.bodyId]), variable: 0 }, { kind: "error" }];
  const signature = fixture.index.types.signatures[0];
  return { terms, signatures: [signature, { ...signature, id: 1, kind: "construct", owner: item,
    composition: { kind: "intersection", signatures: [0] }, typeParameters: [
      { identity: { owner: definition, index: 0 }, declaration: definition, constraint: 1, default: 2 },
      { identity: { owner: definition, index: 1 }, declaration: definition, constraint: null, default: null },
    ], receiver: 1, parameters: [
      { declaration: definition, kind: "required", type: 1, passing: "by-value", initializer: null },
      { declaration: definition, kind: "optional", type: 2, passing: "borrow-shared", initializer: null },
      { declaration: definition, kind: "default", type: 1, passing: "move", initializer: fixture.bodyId },
    ], result: 0 }] };
}
