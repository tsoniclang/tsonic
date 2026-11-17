import assert from "node:assert/strict";

export function syntaxConstructorInputs(syntax, nodeList, count, nullOptionals, reversed) {
  let nextId = 1;
  const rows = [];
  const list = factory => {
    const values = Array.from({ length: count }, () => factory());
    return nodeList(reversed ? values.reverse() : values);
  };
  const optional = factory => nullOptionals ? null : factory();
  const child = (kind = "Identifier") => {
    const id = nextId;
    nextId += 1;
    let properties;
    switch (kind) {
      case "Identifier": case "PrivateIdentifier": properties = { text: `name${id}` }; break;
      case "StringLiteral": case "NumericLiteral": case "BigIntLiteral": case "RegularExpressionLiteral":
        properties = { text: kind === "StringLiteral" ? "value" : kind === "RegularExpressionLiteral" ? "/x/" : "1", tokenFlags: [] }; break;
      case "NoSubstitutionTemplateLiteral": case "TemplateHead": case "TemplateMiddle": case "TemplateTail":
        properties = { text: "piece", tokenFlags: [], rawText: "piece", templateFlags: [] }; break;
      case "Block": properties = { statements: nodeList([]), multiLine: false }; break;
      case "BindingElement": properties = { dotDotDotToken: null, propertyName: null, name: child(), initializer: null }; break;
      case "Parameter": properties = { modifiers: null, dotDotDotToken: null, name: child(), questionToken: null, type: null, initializer: null }; break;
      case "TypeParameter": properties = { modifiers: null, name: child(), constraint: null, expression: null, defaultType: null }; break;
      case "HeritageClause": properties = { token: "ExtendsKeyword", types: nodeList([]) }; break;
      case "VariableDeclaration": properties = { name: child(), exclamationToken: null, type: null, initializer: null }; break;
      case "VariableDeclarationList": properties = { declarations: nodeList([]) }; break;
      case "CaseClause": properties = { expression: child(), statements: nodeList([]) }; break;
      case "CaseBlock": properties = { clauses: nodeList([]) }; break;
      case "CatchClause": properties = { variableDeclaration: null, block: child("Block") }; break;
      case "ImportClause": properties = { phaseModifier: null, name: child(), namedBindings: null }; break;
      case "ImportAttributes": properties = { token: "WithKeyword", attributes: nodeList([]), multiLine: false }; break;
      case "ImportSpecifier": case "ExportSpecifier": properties = { isTypeOnly: false, propertyName: null, name: child() }; break;
      case "NamespaceImport": case "NamespaceExport": properties = { name: child() }; break;
      case "NamedImports": case "NamedExports": properties = { elements: nodeList([]) }; break;
      case "ExternalModuleReference": properties = { expression: child("StringLiteral") }; break;
      case "SpreadAssignment": properties = { expression: child() }; break;
      case "TemplateSpan": properties = { expression: child(), literal: child("TemplateTail") }; break;
      case "TemplateLiteralTypeSpan": properties = { type: child("AnyKeyword"), literal: child("TemplateTail") }; break;
      case "JsxAttributes": properties = { properties: nodeList([]) }; break;
      case "JsxOpeningElement": case "JsxSelfClosingElement":
        properties = { tagName: child(), typeArguments: null, attributes: child("JsxAttributes") }; break;
      case "JsxClosingElement": properties = { tagName: child() }; break;
      case "JsxAttribute": properties = { name: child(), initializer: null }; break;
      case "JsxText": properties = { text: "text", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false }; break;
      case "JSDocText": properties = { text: ["documentation"] }; break;
      case "JSDocUnknownTag": properties = { tagName: child(), comment: null }; break;
      case "ModuleDeclaration": properties = { modifiers: null, asteriskToken: null, body: null, keyword: "NamespaceKeyword", name: child() }; break;
      default:
        assert.equal(/(?:Keyword|Token)$|^(?:EmptyStatement|EndOfFile|SemicolonClassElement|NotEmittedTypeElement|JsxOpeningFragment|JsxClosingFragment)$/u.test(kind), true,
          `the independent child factory requires a complete constructor for ${kind}`);
        properties = {};
    }
    return syntax(kind, id, properties);
  };
  const add = (kind, properties = {}, order = []) => {
    const expected = order.flatMap(field => {
      const value = properties[field];
      return value === null ? [] : Array.isArray(value) ? value : "nodes" in value ? value.nodes : [value];
    });
    rows.push({ node: syntax(kind, 0, properties), expected });
  };
  const expression = () => child();
  const type = () => child("AnyKeyword");
  const statement = () => child("EmptyStatement");
  const modifiers = () => optional(() => list(() => child("ExportKeyword")));
  const annotation = () => optional(type);
  const initializer = () => optional(expression);
  const parameters = () => list(() => child("Parameter"));
  const typeParameters = () => optional(() => list(() => child("TypeParameter")));
  const callable = () => ({ typeParameters: typeParameters(), parameters: parameters(), type: annotation(), fullSignature: annotation() });
  const property = () => ({ modifiers: modifiers(), name: child(), postfixToken: optional(() => child("QuestionToken")), type: annotation() });
  add("Identifier", { text: "name" });
  add("PrivateIdentifier", { text: "#private" });
  add("QualifiedName", { left: child(), right: child() }, ["left", "right"]);
  add("ComputedPropertyName", { expression: expression() }, ["expression"]);
  add("Decorator", { expression: expression() }, ["expression"]);
  add("EmptyStatement");
  add("IfStatement", { expression: expression(), thenStatement: statement(), elseStatement: optional(statement) }, ["expression", "thenStatement", "elseStatement"]);
  add("DoStatement", { statement: statement(), expression: expression() }, ["statement", "expression"]);
  add("WhileStatement", { statement: statement(), expression: expression() }, ["expression", "statement"]);
  add("ForStatement", { statement: statement(), initializer: initializer(), condition: initializer(), incrementor: initializer() }, ["initializer", "condition", "incrementor", "statement"]);
  for (const kind of ["ForInStatement", "ForOfStatement"])
    add(kind, { awaitModifier: kind === "ForInStatement" ? null : optional(() => child("AwaitKeyword")), initializer: expression(), expression: expression(), statement: statement() }, ["awaitModifier", "initializer", "expression", "statement"]);
  for (const kind of ["BreakStatement", "ContinueStatement"]) add(kind, { label: optional(expression) }, ["label"]);
  add("ReturnStatement", { expression: initializer() }, ["expression"]);
  add("WithStatement", { expression: expression(), statement: statement() }, ["expression", "statement"]);
  add("SwitchStatement", { expression: expression(), caseBlock: child("CaseBlock") }, ["expression", "caseBlock"]);
  add("CaseBlock", { clauses: list(() => child("CaseClause")) }, ["clauses"]);
  for (const kind of ["CaseClause", "DefaultClause"]) add(kind, { expression: kind === "CaseClause" ? expression() : null, statements: list(statement) }, ["expression", "statements"]);
  add("ThrowStatement", { expression: expression() }, ["expression"]);
  add("TryStatement", { tryBlock: child("Block"), catchClause: optional(() => child("CatchClause")), finallyBlock: optional(() => child("Block")) }, ["tryBlock", "catchClause", "finallyBlock"]);
  add("CatchClause", { variableDeclaration: optional(() => child("VariableDeclaration")), block: child("Block") }, ["variableDeclaration", "block"]);
  add("DebuggerStatement");
  add("LabeledStatement", { label: child(), statement: statement() }, ["label", "statement"]);
  add("ExpressionStatement", { expression: expression() }, ["expression"]);
  add("Block", { statements: list(statement), multiLine: false }, ["statements"]);
  add("VariableStatement", { modifiers: modifiers(), declarationList: child("VariableDeclarationList") }, ["modifiers", "declarationList"]);
  add("VariableDeclaration", { name: child(), exclamationToken: optional(() => child("ExclamationToken")), type: annotation(), initializer: initializer() }, ["name", "exclamationToken", "type", "initializer"]);
  add("VariableDeclarationList", { declarations: list(() => child("VariableDeclaration")) }, ["declarations"]);
  for (const kind of ["ObjectBindingPattern", "ArrayBindingPattern"]) add(kind, { elements: list(() => child("BindingElement")) }, ["elements"]);
  add("Parameter", { modifiers: modifiers(), dotDotDotToken: optional(() => child("DotDotDotToken")), name: child(), questionToken: optional(() => child("QuestionToken")), type: annotation(), initializer: initializer() },
    ["modifiers", "dotDotDotToken", "name", "questionToken", "type", "initializer"]);
  add("BindingElement", { dotDotDotToken: optional(() => child("DotDotDotToken")), propertyName: optional(expression), name: optional(expression), initializer: initializer() }, ["dotDotDotToken", "propertyName", "name", "initializer"]);
  add("MissingDeclaration", { modifiers: modifiers() }, ["modifiers"]);
  for (const kind of ["FunctionDeclaration", "FunctionExpression"])
    add(kind, { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), name: optional(expression) },
      ["modifiers", "asteriskToken", "name", "typeParameters", "parameters", "type", "fullSignature", "body"]);
  for (const kind of ["ClassDeclaration", "ClassExpression", "InterfaceDeclaration"])
    add(kind, { modifiers: modifiers(), name: kind === "InterfaceDeclaration" ? child() : optional(expression), typeParameters: typeParameters(),
      heritageClauses: optional(() => list(() => child("HeritageClause"))), members: list(() => child(kind === "InterfaceDeclaration" ? "NotEmittedTypeElement" : "SemicolonClassElement")) },
      ["modifiers", "name", "typeParameters", "heritageClauses", "members"]);
  add("HeritageClause", { token: "ExtendsKeyword", types: list(() => syntax("ExpressionWithTypeArguments", nextId++, { expression: expression(), typeArguments: null })) }, ["types"]);
  for (const kind of ["TypeAliasDeclaration", "JSTypeAliasDeclaration"]) add(kind, { modifiers: modifiers(), name: child(), typeParameters: typeParameters(), type: type() }, ["modifiers", "name", "typeParameters", "type"]);
  add("EnumMember", { modifiers: modifiers(), name: child(), postfixToken: optional(() => child("QuestionToken")), initializer: initializer() }, ["modifiers", "name", "postfixToken", "initializer"]);
  add("EnumDeclaration", { modifiers: modifiers(), name: child(), members: list(() => syntax("EnumMember", nextId++, { modifiers: null, name: child(), postfixToken: null, initializer: null })) }, ["modifiers", "name", "members"]);
  add("ModuleBlock", { statements: list(statement) }, ["statements"]);
  add("NotEmittedStatement");
  add("NotEmittedTypeElement");
  for (const kind of ["ImportDeclaration", "JSImportDeclaration"]) add(kind, { modifiers: modifiers(), importClause: optional(() => child("ImportClause")), moduleSpecifier: child("StringLiteral"), attributes: optional(() => child("ImportAttributes")) }, ["modifiers", "importClause", "moduleSpecifier", "attributes"]);
  add("ExternalModuleReference", { expression: child("StringLiteral") }, ["expression"]);
  for (const kind of ["NamespaceImport", "NamespaceExport"]) add(kind, { name: child() }, ["name"]);
  add("NamedImports", { elements: list(() => child("ImportSpecifier")) }, ["elements"]);
  add("ExportAssignment", { modifiers: modifiers(), isExportEquals: false, type: annotation(), expression: expression() }, ["modifiers", "type", "expression"]);
  add("NamespaceExportDeclaration", { modifiers: modifiers(), name: child() }, ["modifiers", "name"]);
  add("NamedExports", { elements: list(() => child("ExportSpecifier")) }, ["elements"]);
  for (const kind of ["ExportSpecifier", "ImportSpecifier"]) add(kind, { isTypeOnly: false, propertyName: optional(expression), name: child() }, ["propertyName", "name"]);
  for (const kind of ["CallSignature", "ConstructSignature", "JSDocSignature"]) add(kind, callable(), ["typeParameters", "parameters", "type", "fullSignature"]);
  add("Constructor", { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")) }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature", "asteriskToken", "body"]);
  for (const kind of ["GetAccessor", "SetAccessor", "MethodDeclaration"]) add(kind, { ...property(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")) }, ["modifiers", "asteriskToken", "name", "postfixToken", "typeParameters", "parameters", "type", "fullSignature", "body"]);
  add("IndexSignature", { modifiers: modifiers(), ...callable() }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature"]);
  add("MethodSignature", { ...property(), ...callable() }, ["modifiers", "name", "postfixToken", "typeParameters", "parameters", "type", "fullSignature"]);
  for (const kind of ["PropertySignature", "PropertyDeclaration", "PropertyAssignment"]) add(kind, { ...property(), initializer: kind === "PropertyAssignment" ? expression() : initializer() }, ["modifiers", "name", "postfixToken", "type", "initializer"]);
  add("SemicolonClassElement");
  add("ClassStaticBlockDeclaration", { modifiers: modifiers(), body: child("Block") }, ["modifiers", "body"]);
  add("OmittedExpression");
  for (const kind of ["StringLiteral", "NumericLiteral", "BigIntLiteral", "RegularExpressionLiteral"])
    add(kind, { text: kind === "StringLiteral" ? "text" : kind === "BigIntLiteral" ? "1n" : kind === "RegularExpressionLiteral" ? "/x/" : "1", tokenFlags: [] });
  for (const kind of ["NoSubstitutionTemplateLiteral", "TemplateHead", "TemplateMiddle", "TemplateTail"])
    add(kind, { text: "text", tokenFlags: [], rawText: "text", templateFlags: [] });
  add("BinaryExpression", { modifiers: modifiers(), left: expression(), type: annotation(), operatorToken: child("PlusToken"), right: expression() }, ["modifiers", "left", "type", "operatorToken", "right"]);
  add("PrefixUnaryExpression", { operator: "MinusToken", operand: expression() }, ["operand"]);
  add("PostfixUnaryExpression", { operand: expression(), operator: "PlusPlusToken" }, ["operand"]);
  add("YieldExpression", { asteriskToken: optional(() => child("AsteriskToken")), expression: initializer() }, ["asteriskToken", "expression"]);
  add("ArrowFunction", { modifiers: modifiers(), ...callable(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), equalsGreaterThanToken: child("EqualsGreaterThanToken") },
    ["modifiers", "typeParameters", "parameters", "type", "fullSignature", "asteriskToken", "equalsGreaterThanToken", "body"]);
  for (const kind of ["AsExpression", "SatisfiesExpression"]) add(kind, { expression: expression(), type: type() }, ["expression", "type"]);
  add("ConditionalExpression", { condition: expression(), questionToken: child("QuestionToken"), whenTrue: expression(), colonToken: child("ColonToken"), whenFalse: expression() }, ["condition", "questionToken", "whenTrue", "colonToken", "whenFalse"]);
  add("PropertyAccessExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), name: child() }, ["expression", "questionDotToken", "name"]);
  add("ElementAccessExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), argumentExpression: expression() }, ["expression", "questionDotToken", "argumentExpression"]);
  add("CallExpression", { expression: expression(), questionDotToken: optional(() => child("QuestionDotToken")), typeArguments: optional(() => list(type)), arguments: list(expression) }, ["expression", "questionDotToken", "typeArguments", "arguments"]);
  add("NewExpression", { expression: expression(), typeArguments: optional(() => list(type)), arguments: optional(() => list(expression)) }, ["expression", "typeArguments", "arguments"]);
  add("MetaProperty", { keywordToken: "NewKeyword", name: child() }, ["name"]);
  for (const kind of ["NonNullExpression", "SpreadElement", "ParenthesizedExpression", "SpreadAssignment", "DeleteExpression", "TypeOfExpression", "VoidExpression", "AwaitExpression", "PartiallyEmittedExpression", "JsxSpreadAttribute"])
    add(kind, { expression: expression() }, ["expression"]);
  add("TemplateExpression", { head: child("TemplateHead"), templateSpans: list(() => child("TemplateSpan")) }, ["head", "templateSpans"]);
  add("TemplateSpan", { expression: expression(), literal: child("TemplateTail") }, ["expression", "literal"]);
  add("TaggedTemplateExpression", { tag: expression(), questionDotToken: optional(() => child("QuestionDotToken")), typeArguments: optional(() => list(type)), template: child("NoSubstitutionTemplateLiteral") }, ["tag", "questionDotToken", "typeArguments", "template"]);
  add("ArrayLiteralExpression", { elements: list(expression), multiLine: true }, ["elements"]);
  add("ObjectLiteralExpression", { properties: list(() => child("SpreadAssignment")), multiLine: true }, ["properties"]);
  add("ShorthandPropertyAssignment", { ...property(), equalsToken: optional(() => child("EqualsToken")), objectAssignmentInitializer: initializer() }, ["modifiers", "name", "postfixToken", "type", "equalsToken", "objectAssignmentInitializer"]);
  add("TypeAssertionExpression", { type: type(), expression: expression() }, ["type", "expression"]);
  for (const kind of ["UnionType", "IntersectionType"]) add(kind, { types: list(type) }, ["types"]);
  add("ConditionalType", { checkType: type(), extendsType: type(), trueType: type(), falseType: type() }, ["checkType", "extendsType", "trueType", "falseType"]);
  add("TypeOperator", { operator: "ReadonlyKeyword", type: type() }, ["type"]);
  add("InferType", { typeParameter: child("TypeParameter") }, ["typeParameter"]);
  add("ArrayType", { elementType: type() }, ["elementType"]);
  add("IndexedAccessType", { objectType: type(), indexType: type() }, ["objectType", "indexType"]);
  add("TypeReference", { typeArguments: optional(() => list(type)), typeName: child() }, ["typeName", "typeArguments"]);
  add("ExpressionWithTypeArguments", { expression: expression(), typeArguments: optional(() => list(type)) }, ["expression", "typeArguments"]);
  add("LiteralType", { literal: child("NumericLiteral") }, ["literal"]);
  add("ThisType");
  add("TypePredicate", { assertsModifier: optional(() => child("AssertsKeyword")), parameterName: child(), type: annotation() }, ["assertsModifier", "parameterName", "type"]);
  add("ImportAttribute", { name: child(), value: expression() }, ["name", "value"]);
  add("ImportAttributes", { token: "WithKeyword", attributes: list(() => syntax("ImportAttribute", nextId++, { name: child(), value: expression() })), multiLine: false }, ["attributes"]);
  add("TypeQuery", { typeArguments: optional(() => list(type)), exprName: child() }, ["exprName", "typeArguments"]);
  add("MappedType", { readonlyToken: optional(() => child("ReadonlyKeyword")), typeParameter: child("TypeParameter"), nameType: annotation(), questionToken: optional(() => child("QuestionToken")), type: annotation(), members: optional(() => list(() => child("NotEmittedTypeElement"))) }, ["readonlyToken", "typeParameter", "nameType", "questionToken", "type", "members"]);
  add("TypeLiteral", { members: list(() => child("NotEmittedTypeElement")) }, ["members"]);
  add("TupleType", { elements: list(type) }, ["elements"]);
  add("NamedTupleMember", { dotDotDotToken: optional(() => child("DotDotDotToken")), name: child(), questionToken: optional(() => child("QuestionToken")), type: type() }, ["dotDotDotToken", "name", "questionToken", "type"]);
  for (const kind of ["OptionalType", "RestType", "ParenthesizedType", "JSDocTypeExpression", "JSDocNonNullableType", "JSDocNullableType", "JSDocVariadicType", "JSDocOptionalType"])
    add(kind, { type: type() }, ["type"]);
  for (const kind of ["FunctionType", "ConstructorType"]) add(kind, { modifiers: modifiers(), ...callable() }, ["modifiers", "typeParameters", "parameters", "type", "fullSignature"]);
  add("TemplateLiteralType", { head: child("TemplateHead"), templateSpans: list(() => child("TemplateLiteralTypeSpan")) }, ["head", "templateSpans"]);
  add("TemplateLiteralTypeSpan", { type: type(), literal: child("TemplateTail") }, ["type", "literal"]);
  add("JsxElement", { openingElement: child("JsxOpeningElement"), children: list(() => child("JsxText")), closingElement: child("JsxClosingElement") }, ["openingElement", "children", "closingElement"]);
  add("JsxAttributes", { properties: list(() => child("JsxAttribute")) }, ["properties"]);
  add("JsxNamespacedName", { namespace: child(), name: child() }, ["namespace", "name"]);
  for (const kind of ["JsxOpeningElement", "JsxSelfClosingElement"]) add(kind, { tagName: child(), typeArguments: optional(() => list(type)), attributes: child("JsxAttributes") }, ["tagName", "typeArguments", "attributes"]);
  add("JsxFragment", { openingFragment: child("JsxOpeningFragment"), children: list(() => child("JsxText")), closingFragment: child("JsxClosingFragment") }, ["openingFragment", "children", "closingFragment"]);
  add("JsxOpeningFragment"); add("JsxClosingFragment");
  add("JsxAttribute", { name: child(), initializer: optional(() => child("StringLiteral")) }, ["name", "initializer"]);
  add("JsxClosingElement", { tagName: child() }, ["tagName"]);
  add("JsxExpression", { dotDotDotToken: optional(() => child("DotDotDotToken")), expression: initializer() }, ["dotDotDotToken", "expression"]);
  add("JsxText", { text: "jsx", tokenFlags: [], containsOnlyTriviaWhiteSpaces: false });
  add("SyntaxList", { children: list(expression).nodes }, ["children"]);
  add("JSDoc", { comment: list(() => child("JSDocText")), tags: optional(() => list(() => child("JSDocUnknownTag"))) }, ["comment", "tags"]);
  add("JSDocAllType");
  const tag = () => ({ tagName: child(), comment: optional(() => list(() => child("JSDocText"))) });
  add("JSDocTypeTag", { ...tag(), typeExpression: type() }, ["tagName", "typeExpression", "comment"]);
  for (const kind of ["JSDocUnknownTag", "JSDocPublicTag", "JSDocPrivateTag", "JSDocProtectedTag", "JSDocReadonlyTag", "JSDocOverrideTag", "JSDocDeprecatedTag"])
    add(kind, tag(), ["tagName", "comment"]);
  add("JSDocTemplateTag", { ...tag(), constraint: type(), typeParameters: list(() => child("TypeParameter")) }, ["tagName", "constraint", "typeParameters", "comment"]);
  for (const kind of ["JSDocReturnTag", "JSDocThrowsTag"]) add(kind, { ...tag(), typeExpression: annotation() }, ["tagName", "typeExpression", "comment"]);
  add("JSDocSeeTag", { ...tag(), nameExpression: type() }, ["tagName", "nameExpression", "comment"]);
  for (const kind of ["JSDocImplementsTag", "JSDocAugmentsTag"])
    add(kind, { ...tag(), className: syntax("ExpressionWithTypeArguments", nextId++, { expression: expression(), typeArguments: null }) }, ["tagName", "className", "comment"]);
  for (const kind of ["JSDocSatisfiesTag", "JSDocThisTag", "JSDocOverloadTag"]) add(kind, { ...tag(), typeExpression: type() }, ["tagName", "typeExpression", "comment"]);
  add("JSDocImportTag", { ...tag(), importClause: optional(() => child("ImportClause")), moduleSpecifier: child("StringLiteral"), attributes: optional(() => child("ImportAttributes")) }, ["tagName", "importClause", "moduleSpecifier", "attributes", "comment"]);
  add("JSDocCallbackTag", { ...tag(), typeExpression: type(), name: optional(expression) }, ["tagName", "typeExpression", "name", "comment"]);
  add("JSDocTypedefTag", { ...tag(), typeExpression: annotation(), name: optional(expression) }, ["tagName", "typeExpression", "name", "comment"]);
  add("JSDocNameReference", { name: child() }, ["name"]);
  add("SourceFile", { statements: list(statement), endOfFileToken: child("EndOfFile"), languageVariant: "Standard", scriptKind: "TS", commentDirectives: [], pragmas: [], checkJsDirective: null }, ["statements", "endOfFileToken"]);
  add("ModuleDeclaration", { modifiers: modifiers(), asteriskToken: optional(() => child("AsteriskToken")), body: optional(() => child("Block")), keyword: "NamespaceKeyword", name: child() }, ["modifiers", "asteriskToken", "name", "body"]);
  add("ImportEqualsDeclaration", { modifiers: modifiers(), isTypeOnly: false, name: child(), moduleReference: child("ExternalModuleReference") }, ["modifiers", "name", "moduleReference"]);
  add("ExportDeclaration", { modifiers: modifiers(), isTypeOnly: false, exportClause: optional(() => child("NamedExports")), moduleSpecifier: initializer(), attributes: optional(() => child("ImportAttributes")) }, ["modifiers", "exportClause", "moduleSpecifier", "attributes"]);
  add("ImportType", { typeArguments: optional(() => list(type)), isTypeOf: false, argument: type(), attributes: optional(() => child("ImportAttributes")), qualifier: optional(expression) }, ["argument", "attributes", "qualifier", "typeArguments"]);
  add("ImportClause", { phaseModifier: null, name: optional(expression), namedBindings: optional(() => child("NamedImports")) }, ["name", "namedBindings"]);
  add("JSDocText", { text: ["one", "two"] });
  for (const kind of ["JSDocLink", "JSDocLinkPlain", "JSDocLinkCode"]) add(kind, { text: ["link"], name: optional(expression) }, ["name"]);
  add("TypeParameter", { modifiers: modifiers(), name: child(), constraint: annotation(), expression: initializer(), defaultType: annotation() }, ["modifiers", "name", "constraint", "expression", "defaultType"]);
  add("SyntheticReferenceExpression", { expression: expression(), thisArg: expression() }, ["expression", "thisArg"]);
  add("JSDocTypeLiteral", { jsDocPropertyTags: optional(() => list(() => child("JSDocUnknownTag")).nodes), isArrayType: false }, ["jsDocPropertyTags"]);
  for (const kind of ["JSDocParameterTag", "JSDocPropertyTag"]) add(kind, { ...tag(), name: child(), isBracketed: true, typeExpression: annotation(), isNameFirst: false }, ["tagName", "name", "typeExpression", "comment"]);
  for (const kind of [
    "Unknown", "EndOfFile", "SingleLineCommentTrivia", "MultiLineCommentTrivia", "NewLineTrivia", "WhitespaceTrivia", "ConflictMarkerTrivia", "NonTextFileMarkerTrivia", "JsxTextAllWhiteSpaces", "JSDocCommentTextToken",
    "OpenBraceToken", "CloseBraceToken", "OpenParenToken", "CloseParenToken", "OpenBracketToken", "CloseBracketToken", "DotToken", "DotDotDotToken", "SemicolonToken", "CommaToken", "QuestionDotToken", "LessThanToken", "LessThanSlashToken", "GreaterThanToken", "LessThanEqualsToken", "GreaterThanEqualsToken", "EqualsEqualsToken", "ExclamationEqualsToken", "EqualsEqualsEqualsToken", "ExclamationEqualsEqualsToken", "EqualsGreaterThanToken", "PlusToken", "MinusToken", "AsteriskToken", "AsteriskAsteriskToken", "SlashToken", "PercentToken", "PlusPlusToken", "MinusMinusToken", "LessThanLessThanToken", "GreaterThanGreaterThanToken", "GreaterThanGreaterThanGreaterThanToken", "AmpersandToken", "BarToken", "CaretToken", "ExclamationToken", "TildeToken", "AmpersandAmpersandToken", "BarBarToken", "QuestionToken", "ColonToken", "AtToken", "QuestionQuestionToken", "BacktickToken", "HashToken", "EqualsToken", "PlusEqualsToken", "MinusEqualsToken", "AsteriskEqualsToken", "AsteriskAsteriskEqualsToken", "SlashEqualsToken", "PercentEqualsToken", "LessThanLessThanEqualsToken", "GreaterThanGreaterThanEqualsToken", "GreaterThanGreaterThanGreaterThanEqualsToken", "AmpersandEqualsToken", "BarEqualsToken", "BarBarEqualsToken", "AmpersandAmpersandEqualsToken", "QuestionQuestionEqualsToken", "CaretEqualsToken",
    "BreakKeyword", "CaseKeyword", "CatchKeyword", "ClassKeyword", "ConstKeyword", "ContinueKeyword", "DebuggerKeyword", "DefaultKeyword", "DeleteKeyword", "DoKeyword", "ElseKeyword", "EnumKeyword", "ExportKeyword", "ExtendsKeyword", "FalseKeyword", "FinallyKeyword", "ForKeyword", "FunctionKeyword", "IfKeyword", "ImportKeyword", "InKeyword", "InstanceOfKeyword", "NewKeyword", "NullKeyword", "ReturnKeyword", "SuperKeyword", "SwitchKeyword", "ThisKeyword", "ThrowKeyword", "TrueKeyword", "TryKeyword", "TypeOfKeyword", "VarKeyword", "VoidKeyword", "WhileKeyword", "WithKeyword", "ImplementsKeyword", "InterfaceKeyword", "LetKeyword", "PackageKeyword", "PrivateKeyword", "ProtectedKeyword", "PublicKeyword", "StaticKeyword", "YieldKeyword", "AbstractKeyword", "AccessorKeyword", "AsKeyword", "AssertsKeyword", "AssertKeyword", "AnyKeyword", "AsyncKeyword", "AwaitKeyword", "BooleanKeyword", "ConstructorKeyword", "DeclareKeyword", "GetKeyword", "ImmediateKeyword", "InferKeyword", "IntrinsicKeyword", "IsKeyword", "KeyOfKeyword", "ModuleKeyword", "NamespaceKeyword", "NeverKeyword", "OutKeyword", "ReadonlyKeyword", "RequireKeyword", "NumberKeyword", "ObjectKeyword", "SatisfiesKeyword", "SetKeyword", "StringKeyword", "SymbolKeyword", "TypeKeyword", "UndefinedKeyword", "UniqueKeyword", "UnknownKeyword", "UsingKeyword", "FromKeyword", "GlobalKeyword", "BigIntKeyword", "OverrideKeyword", "OfKeyword", "DeferKeyword",
  ]) add(kind);
  return rows;
}
