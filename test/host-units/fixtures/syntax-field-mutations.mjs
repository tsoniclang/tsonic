const nodeKinds0 = ["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FalseKeyword","FunctionExpression","Identifier","ImportKeyword","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","MetaProperty","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NullKeyword","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SuperKeyword","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","ThisKeyword","TrueKeyword","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"];
const nodeKinds1 = ["AnyKeyword","ArrayType","BigIntKeyword","BooleanKeyword","ConditionalType","ConstructorType","FunctionType","ImportType","IndexedAccessType","InferType","IntersectionType","IntrinsicKeyword","JSDocAllType","JSDocNameReference","JSDocNonNullableType","JSDocNullableType","JSDocOptionalType","JSDocSignature","JSDocTypeExpression","JSDocTypeLiteral","JSDocVariadicType","LiteralType","MappedType","NamedTupleMember","NeverKeyword","NumberKeyword","ObjectKeyword","OptionalType","ParenthesizedType","RestType","StringKeyword","SymbolKeyword","TemplateLiteralType","TemplateLiteralTypeSpan","ThisType","TupleType","TypeLiteral","TypeOperator","TypePredicate","TypeQuery","TypeReference","UndefinedKeyword","UnionType","UnknownKeyword","VoidKeyword"];
const nodeKinds2 = ["AbstractKeyword","AccessorKeyword","AsyncKeyword","ConstKeyword","DeclareKeyword","Decorator","DefaultKeyword","ExportKeyword","InKeyword","OutKeyword","OverrideKeyword","PrivateKeyword","ProtectedKeyword","PublicKeyword","ReadonlyKeyword","StaticKeyword"];
const nodeKinds3 = ["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","Block","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FalseKeyword","FunctionExpression","Identifier","ImportKeyword","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","MetaProperty","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NullKeyword","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SuperKeyword","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","ThisKeyword","TrueKeyword","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"];
const nodeKinds4 = ["AmpersandAmpersandEqualsToken","AmpersandAmpersandToken","AmpersandEqualsToken","AmpersandToken","AsteriskAsteriskEqualsToken","AsteriskAsteriskToken","AsteriskEqualsToken","AsteriskToken","BarBarEqualsToken","BarBarToken","BarEqualsToken","BarToken","CaretEqualsToken","CaretToken","CommaToken","EqualsEqualsEqualsToken","EqualsEqualsToken","EqualsToken","ExclamationEqualsEqualsToken","ExclamationEqualsToken","GreaterThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanToken","GreaterThanGreaterThanToken","GreaterThanToken","InKeyword","InstanceOfKeyword","LessThanEqualsToken","LessThanLessThanEqualsToken","LessThanLessThanToken","LessThanToken","MinusEqualsToken","MinusToken","PercentEqualsToken","PercentToken","PlusEqualsToken","PlusToken","QuestionQuestionEqualsToken","QuestionQuestionToken","SlashEqualsToken","SlashToken"];
const nodeKinds5 = ["BigIntLiteral","ComputedPropertyName","Identifier","NoSubstitutionTemplateLiteral","NumericLiteral","PrivateIdentifier","StringLiteral"];
const nodeKinds6 = ["ArrayBindingPattern","Identifier","ObjectBindingPattern"];
const nodeKinds7 = ["Block","BreakStatement","ClassDeclaration","ContinueStatement","DebuggerStatement","DoStatement","EmptyStatement","EnumDeclaration","ExportAssignment","ExportDeclaration","ExpressionStatement","ForInStatement","ForOfStatement","ForStatement","FunctionDeclaration","IfStatement","ImportDeclaration","ImportEqualsDeclaration","InterfaceDeclaration","JSImportDeclaration","JSTypeAliasDeclaration","LabeledStatement","MissingDeclaration","ModuleBlock","ModuleDeclaration","NamespaceExportDeclaration","NotEmittedStatement","ReturnStatement","SwitchStatement","ThrowStatement","TryStatement","TypeAliasDeclaration","VariableStatement","WhileStatement","WithStatement"];
const nodeKinds8 = ["CaseClause","DefaultClause"];
const nodeKinds9 = ["ClassStaticBlockDeclaration","Constructor","GetAccessor","IndexSignature","MethodDeclaration","PropertyDeclaration","SemicolonClassElement","SetAccessor"];
const nodeKinds10 = ["ArrayLiteralExpression","BigIntLiteral","CallExpression","ClassExpression","ElementAccessExpression","ExpressionWithTypeArguments","FunctionExpression","Identifier","JsxAttributes","JsxElement","JsxFragment","JsxSelfClosingElement","MetaProperty","NewExpression","NonNullExpression","NumericLiteral","ObjectLiteralExpression","ParenthesizedExpression","PartiallyEmittedExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","StringLiteral","TaggedTemplateExpression","TemplateExpression"];
const nodeKinds11 = ["ExclamationToken","QuestionToken"];
const nodeKinds12 = ["NamedExports","NamespaceExport"];
const nodeKinds13 = ["Identifier","StringLiteral"];
const nodeKinds14 = ["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FalseKeyword","FunctionExpression","Identifier","ImportKeyword","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","MetaProperty","MissingDeclaration","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NullKeyword","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SuperKeyword","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","ThisKeyword","TrueKeyword","TypeAssertionExpression","TypeOfExpression","VariableDeclarationList","VoidExpression","YieldExpression"];
const nodeKinds15 = ["NamedImports","NamespaceImport"];
const nodeKinds16 = ["ExternalModuleReference","Identifier","QualifiedName"];
const nodeKinds17 = ["Identifier","QualifiedName"];
const nodeKinds18 = ["CallSignature","ConstructSignature","GetAccessor","IndexSignature","MethodSignature","NotEmittedTypeElement","PropertySignature","SetAccessor"];
const nodeKinds19 = ["JSDocLink","JSDocLinkCode","JSDocLinkPlain","JSDocText"];
const nodeKinds20 = ["JSDocAugmentsTag","JSDocCallbackTag","JSDocDeprecatedTag","JSDocImplementsTag","JSDocImportTag","JSDocOverloadTag","JSDocOverrideTag","JSDocParameterTag","JSDocPrivateTag","JSDocPropertyTag","JSDocProtectedTag","JSDocPublicTag","JSDocReadonlyTag","JSDocReturnTag","JSDocSatisfiesTag","JSDocSeeTag","JSDocTemplateTag","JSDocThisTag","JSDocThrowsTag","JSDocTypeTag","JSDocTypedefTag","JSDocUnknownTag"];
const nodeKinds21 = ["Identifier","ModuleDeclaration"];
const nodeKinds22 = ["AbstractKeyword","AccessorKeyword","AmpersandAmpersandEqualsToken","AmpersandAmpersandToken","AmpersandEqualsToken","AmpersandToken","AnyKeyword","ArrayBindingPattern","ArrayLiteralExpression","ArrayType","ArrowFunction","AsExpression","AsKeyword","AssertKeyword","AssertsKeyword","AsteriskAsteriskEqualsToken","AsteriskAsteriskToken","AsteriskEqualsToken","AsteriskToken","AsyncKeyword","AtToken","AwaitExpression","AwaitKeyword","BacktickToken","BarBarEqualsToken","BarBarToken","BarEqualsToken","BarToken","BigIntKeyword","BigIntLiteral","BinaryExpression","BindingElement","Block","BooleanKeyword","BreakKeyword","BreakStatement","CallExpression","CallSignature","CaretEqualsToken","CaretToken","CaseBlock","CaseClause","CaseKeyword","CatchClause","CatchKeyword","ClassDeclaration","ClassExpression","ClassKeyword","ClassStaticBlockDeclaration","CloseBraceToken","CloseBracketToken","CloseParenToken","ColonToken","CommaToken","ComputedPropertyName","ConditionalExpression","ConditionalType","ConflictMarkerTrivia","ConstKeyword","ConstructSignature","Constructor","ConstructorKeyword","ConstructorType","ContinueKeyword","ContinueStatement","DebuggerKeyword","DebuggerStatement","DeclareKeyword","Decorator","DefaultClause","DefaultKeyword","DeferKeyword","DeleteExpression","DeleteKeyword","DoKeyword","DoStatement","DotDotDotToken","DotToken","ElementAccessExpression","ElseKeyword","EmptyStatement","EndOfFile","EnumDeclaration","EnumKeyword","EnumMember","EqualsEqualsEqualsToken","EqualsEqualsToken","EqualsGreaterThanToken","EqualsToken","ExclamationEqualsEqualsToken","ExclamationEqualsToken","ExclamationToken","ExportAssignment","ExportDeclaration","ExportKeyword","ExportSpecifier","ExpressionStatement","ExpressionWithTypeArguments","ExtendsKeyword","ExternalModuleReference","FalseKeyword","FinallyKeyword","ForInStatement","ForKeyword","ForOfStatement","ForStatement","FromKeyword","FunctionDeclaration","FunctionExpression","FunctionKeyword","FunctionType","GetAccessor","GetKeyword","GlobalKeyword","GreaterThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanToken","GreaterThanGreaterThanToken","GreaterThanToken","HashToken","HeritageClause","Identifier","IfKeyword","IfStatement","ImmediateKeyword","ImplementsKeyword","ImportAttribute","ImportAttributes","ImportClause","ImportDeclaration","ImportEqualsDeclaration","ImportKeyword","ImportSpecifier","ImportType","InKeyword","IndexSignature","IndexedAccessType","InferKeyword","InferType","InstanceOfKeyword","InterfaceDeclaration","InterfaceKeyword","IntersectionType","IntrinsicKeyword","IsKeyword","JSDoc","JSDocAllType","JSDocAugmentsTag","JSDocCallbackTag","JSDocCommentTextToken","JSDocDeprecatedTag","JSDocImplementsTag","JSDocImportTag","JSDocLink","JSDocLinkCode","JSDocLinkPlain","JSDocNameReference","JSDocNonNullableType","JSDocNullableType","JSDocOptionalType","JSDocOverloadTag","JSDocOverrideTag","JSDocParameterTag","JSDocPrivateTag","JSDocPropertyTag","JSDocProtectedTag","JSDocPublicTag","JSDocReadonlyTag","JSDocReturnTag","JSDocSatisfiesTag","JSDocSeeTag","JSDocSignature","JSDocTemplateTag","JSDocText","JSDocThisTag","JSDocThrowsTag","JSDocTypeExpression","JSDocTypeLiteral","JSDocTypeTag","JSDocTypedefTag","JSDocUnknownTag","JSDocVariadicType","JSImportDeclaration","JSTypeAliasDeclaration","JsxAttribute","JsxAttributes","JsxClosingElement","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxSpreadAttribute","JsxText","JsxTextAllWhiteSpaces","KeyOfKeyword","LabeledStatement","LessThanEqualsToken","LessThanLessThanEqualsToken","LessThanLessThanToken","LessThanSlashToken","LessThanToken","LetKeyword","LiteralType","MappedType","MetaProperty","MethodDeclaration","MethodSignature","MinusEqualsToken","MinusMinusToken","MinusToken","MissingDeclaration","ModuleBlock","ModuleDeclaration","ModuleKeyword","MultiLineCommentTrivia","NamedExports","NamedImports","NamedTupleMember","NamespaceExport","NamespaceExportDeclaration","NamespaceImport","NamespaceKeyword","NeverKeyword","NewExpression","NewKeyword","NewLineTrivia","NoSubstitutionTemplateLiteral","NonNullExpression","NonTextFileMarkerTrivia","NotEmittedStatement","NotEmittedTypeElement","NullKeyword","NumberKeyword","NumericLiteral","ObjectBindingPattern","ObjectKeyword","ObjectLiteralExpression","OfKeyword","OmittedExpression","OpenBraceToken","OpenBracketToken","OpenParenToken","OptionalType","OutKeyword","OverrideKeyword","PackageKeyword","Parameter","ParenthesizedExpression","ParenthesizedType","PartiallyEmittedExpression","PercentEqualsToken","PercentToken","PlusEqualsToken","PlusPlusToken","PlusToken","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PrivateKeyword","PropertyAccessExpression","PropertyAssignment","PropertyDeclaration","PropertySignature","ProtectedKeyword","PublicKeyword","QualifiedName","QuestionDotToken","QuestionQuestionEqualsToken","QuestionQuestionToken","QuestionToken","ReadonlyKeyword","RegularExpressionLiteral","RequireKeyword","RestType","ReturnKeyword","ReturnStatement","SatisfiesExpression","SatisfiesKeyword","SemicolonClassElement","SemicolonToken","SetAccessor","SetKeyword","ShorthandPropertyAssignment","SingleLineCommentTrivia","SlashEqualsToken","SlashToken","SourceFile","SpreadAssignment","SpreadElement","StaticKeyword","StringKeyword","StringLiteral","SuperKeyword","SwitchKeyword","SwitchStatement","SymbolKeyword","SyntaxList","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","TemplateHead","TemplateLiteralType","TemplateLiteralTypeSpan","TemplateMiddle","TemplateSpan","TemplateTail","ThisKeyword","ThisType","ThrowKeyword","ThrowStatement","TildeToken","TrueKeyword","TryKeyword","TryStatement","TupleType","TypeAliasDeclaration","TypeAssertionExpression","TypeKeyword","TypeLiteral","TypeOfExpression","TypeOfKeyword","TypeOperator","TypeParameter","TypePredicate","TypeQuery","TypeReference","UndefinedKeyword","UnionType","UniqueKeyword","Unknown","UnknownKeyword","UsingKeyword","VarKeyword","VariableDeclaration","VariableDeclarationList","VariableStatement","VoidExpression","VoidKeyword","WhileKeyword","WhileStatement","WhitespaceTrivia","WithKeyword","WithStatement","YieldExpression","YieldKeyword"];
const nodeKinds23 = ["Identifier","JsxNamespacedName"];
const nodeKinds24 = ["JsxElement","JsxExpression","JsxFragment","JsxSelfClosingElement","StringLiteral"];
const nodeKinds25 = ["JsxAttribute","JsxSpreadAttribute"];
const nodeKinds26 = ["FalseKeyword","Identifier","ImportKeyword","JsxNamespacedName","NullKeyword","PropertyAccessExpression","SuperKeyword","ThisKeyword","TrueKeyword"];
const nodeKinds27 = ["JsxElement","JsxExpression","JsxFragment","JsxSelfClosingElement","JsxText"];
const nodeKinds28 = ["BigIntLiteral","FalseKeyword","NoSubstitutionTemplateLiteral","NullKeyword","NumericLiteral","PrefixUnaryExpression","StringLiteral","TrueKeyword"];
const nodeKinds29 = ["MinusToken","PlusToken","ReadonlyKeyword"];
const nodeKinds30 = ["MinusToken","PlusToken","QuestionToken"];
const nodeKinds31 = ["ArrayLiteralExpression","ArrowFunction","AsExpression","AwaitExpression","BigIntLiteral","BinaryExpression","Block","CallExpression","ClassExpression","ConditionalExpression","DeleteExpression","ElementAccessExpression","ExpressionWithTypeArguments","FalseKeyword","FunctionExpression","Identifier","ImportKeyword","JsxAttributes","JsxClosingFragment","JsxElement","JsxExpression","JsxFragment","JsxNamespacedName","JsxOpeningElement","JsxOpeningFragment","JsxSelfClosingElement","JsxText","MetaProperty","ModuleBlock","ModuleDeclaration","NewExpression","NoSubstitutionTemplateLiteral","NonNullExpression","NullKeyword","NumericLiteral","ObjectLiteralExpression","OmittedExpression","ParenthesizedExpression","PartiallyEmittedExpression","PostfixUnaryExpression","PrefixUnaryExpression","PrivateIdentifier","PropertyAccessExpression","RegularExpressionLiteral","SatisfiesExpression","SpreadElement","StringLiteral","SuperKeyword","SyntheticReferenceExpression","TaggedTemplateExpression","TemplateExpression","ThisKeyword","TrueKeyword","TypeAssertionExpression","TypeOfExpression","VoidExpression","YieldExpression"];
const nodeKinds32 = ["GetAccessor","MethodDeclaration","PropertyAssignment","SetAccessor","ShorthandPropertyAssignment","SpreadAssignment"];
const nodeKinds33 = ["Identifier","PrivateIdentifier"];
const nodeKinds34 = ["NoSubstitutionTemplateLiteral","TemplateExpression"];
const nodeKinds35 = ["TemplateMiddle","TemplateTail"];
const nodeKinds36 = ["Identifier","ThisType"];

const fields0 = [
  { name: "elements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, pos: input.elements.loc.pos + 1 }) }) }) },
  { name: "elements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, end: input.elements.loc.end + 1 }) }) }) },
  { name: "elements.nodes.length", when: input => input.elements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, nodes: input.elements.nodes.slice(1) }) }) },
  { name: "elements.nodes.element.child-kind", when: input => input.elements.nodes.length > 0 && input.elements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, nodes: input.elements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds0) : entry) }) }) },
  { name: "multiLine.value", when: input => true, change: (input, alternateNode) => ({ ...input, multiLine: input.multiLine === false ? true : false }) },
];
const fields1 = [
  { name: "elementType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, elementType: alternateNode(input.elementType, nodeKinds1) }) },
];
const fields2 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
  { name: "asteriskToken.presence", when: input => input.asteriskToken !== null, change: (input, alternateNode) => ({ ...input, asteriskToken: null }) },
  { name: "body.presence", when: input => input.body !== null, change: (input, alternateNode) => ({ ...input, body: null }) },
  { name: "body.child-kind", when: input => input.body !== null && (true), change: (input, alternateNode) => ({ ...input, body: alternateNode(input.body, nodeKinds3) }) },
];
const fields3 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields4 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields5 = [
  { name: "text.value", when: input => true, change: (input, alternateNode) => ({ ...input, text: input.text + "!" }) },
  { name: "tokenFlags.length", when: input => input.tokenFlags.length > 0, change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.slice(1) }) },
  { name: "tokenFlags.element.value", when: input => input.tokenFlags.length > 0 && input.tokenFlags.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.map((entry, index) => index === 0 ? entry === "BinarySpecifier" ? "ContainsInvalidEscape" : "BinarySpecifier" : entry) }) },
];
const fields6 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "left.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, left: alternateNode(input.left, nodeKinds0) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "operatorToken.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, operatorToken: alternateNode(input.operatorToken, nodeKinds4) }) },
  { name: "right.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, right: alternateNode(input.right, nodeKinds0) }) },
];
const fields7 = [
  { name: "dotDotDotToken.presence", when: input => input.dotDotDotToken !== null, change: (input, alternateNode) => ({ ...input, dotDotDotToken: null }) },
  { name: "propertyName.presence", when: input => input.propertyName !== null, change: (input, alternateNode) => ({ ...input, propertyName: null }) },
  { name: "propertyName.child-kind", when: input => input.propertyName !== null && (true), change: (input, alternateNode) => ({ ...input, propertyName: alternateNode(input.propertyName, nodeKinds5) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "name.child-kind", when: input => input.name !== null && (true), change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds6) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields8 = [
  { name: "elements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, pos: input.elements.loc.pos + 1 }) }) }) },
  { name: "elements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, end: input.elements.loc.end + 1 }) }) }) },
  { name: "elements.nodes.length", when: input => input.elements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, nodes: input.elements.nodes.slice(1) }) }) },
];
const fields9 = [
  { name: "statements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, pos: input.statements.loc.pos + 1 }) }) }) },
  { name: "statements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, end: input.statements.loc.end + 1 }) }) }) },
  { name: "statements.nodes.length", when: input => input.statements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.slice(1) }) }) },
  { name: "statements.nodes.element.child-kind", when: input => input.statements.nodes.length > 0 && input.statements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds7) : entry) }) }) },
  { name: "multiLine.value", when: input => true, change: (input, alternateNode) => ({ ...input, multiLine: input.multiLine === false ? true : false }) },
];
const fields10 = [
  { name: "label.presence", when: input => input.label !== null, change: (input, alternateNode) => ({ ...input, label: null }) },
];
const fields11 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "questionDotToken.presence", when: input => input.questionDotToken !== null, change: (input, alternateNode) => ({ ...input, questionDotToken: null }) },
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "arguments.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, loc: ({ ...input.arguments.loc, pos: input.arguments.loc.pos + 1 }) }) }) },
  { name: "arguments.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, loc: ({ ...input.arguments.loc, end: input.arguments.loc.end + 1 }) }) }) },
  { name: "arguments.nodes.length", when: input => input.arguments.nodes.length > 0, change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, nodes: input.arguments.nodes.slice(1) }) }) },
  { name: "arguments.nodes.element.child-kind", when: input => input.arguments.nodes.length > 0 && input.arguments.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, nodes: input.arguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds0) : entry) }) }) },
];
const fields12 = [
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
];
const fields13 = [
  { name: "clauses.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, clauses: ({ ...input.clauses, loc: ({ ...input.clauses.loc, pos: input.clauses.loc.pos + 1 }) }) }) },
  { name: "clauses.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, clauses: ({ ...input.clauses, loc: ({ ...input.clauses.loc, end: input.clauses.loc.end + 1 }) }) }) },
  { name: "clauses.nodes.length", when: input => input.clauses.nodes.length > 0, change: (input, alternateNode) => ({ ...input, clauses: ({ ...input.clauses, nodes: input.clauses.nodes.slice(1) }) }) },
  { name: "clauses.nodes.element.child-kind", when: input => input.clauses.nodes.length > 0 && input.clauses.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, clauses: ({ ...input.clauses, nodes: input.clauses.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds8) : entry) }) }) },
];
const fields14 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "statements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, pos: input.statements.loc.pos + 1 }) }) }) },
  { name: "statements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, end: input.statements.loc.end + 1 }) }) }) },
  { name: "statements.nodes.length", when: input => input.statements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.slice(1) }) }) },
  { name: "statements.nodes.element.child-kind", when: input => input.statements.nodes.length > 0 && input.statements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds7) : entry) }) }) },
];
const fields15 = [
  { name: "variableDeclaration.presence", when: input => input.variableDeclaration !== null, change: (input, alternateNode) => ({ ...input, variableDeclaration: null }) },
];
const fields16 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "heritageClauses.presence", when: input => input.heritageClauses !== null, change: (input, alternateNode) => ({ ...input, heritageClauses: null }) },
  { name: "heritageClauses.loc.pos.value", when: input => input.heritageClauses !== null && (true), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, loc: ({ ...input.heritageClauses.loc, pos: input.heritageClauses.loc.pos + 1 }) }) }) },
  { name: "heritageClauses.loc.end.value", when: input => input.heritageClauses !== null && (true), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, loc: ({ ...input.heritageClauses.loc, end: input.heritageClauses.loc.end + 1 }) }) }) },
  { name: "heritageClauses.nodes.length", when: input => input.heritageClauses !== null && (input.heritageClauses.nodes.length > 0), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, nodes: input.heritageClauses.nodes.slice(1) }) }) },
  { name: "members.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, pos: input.members.loc.pos + 1 }) }) }) },
  { name: "members.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, end: input.members.loc.end + 1 }) }) }) },
  { name: "members.nodes.length", when: input => input.members.nodes.length > 0, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.slice(1) }) }) },
  { name: "members.nodes.element.child-kind", when: input => input.members.nodes.length > 0 && input.members.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds9) : entry) }) }) },
];
const fields17 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
];
const fields18 = [
  { name: "condition.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, condition: alternateNode(input.condition, nodeKinds0) }) },
  { name: "whenTrue.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, whenTrue: alternateNode(input.whenTrue, nodeKinds0) }) },
  { name: "whenFalse.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, whenFalse: alternateNode(input.whenFalse, nodeKinds0) }) },
];
const fields19 = [
  { name: "checkType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, checkType: alternateNode(input.checkType, nodeKinds1) }) },
  { name: "extendsType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, extendsType: alternateNode(input.extendsType, nodeKinds1) }) },
  { name: "trueType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, trueType: alternateNode(input.trueType, nodeKinds1) }) },
  { name: "falseType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, falseType: alternateNode(input.falseType, nodeKinds1) }) },
];
const fields20 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
];
const fields21 = [

];
const fields22 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds10) }) },
];
const fields23 = [
  { name: "statements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, pos: input.statements.loc.pos + 1 }) }) }) },
  { name: "statements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, end: input.statements.loc.end + 1 }) }) }) },
  { name: "statements.nodes.length", when: input => input.statements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.slice(1) }) }) },
  { name: "statements.nodes.element.child-kind", when: input => input.statements.nodes.length > 0 && input.statements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds7) : entry) }) }) },
];
const fields24 = [
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields25 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "questionDotToken.presence", when: input => input.questionDotToken !== null, change: (input, alternateNode) => ({ ...input, questionDotToken: null }) },
  { name: "argumentExpression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, argumentExpression: alternateNode(input.argumentExpression, nodeKinds0) }) },
];
const fields26 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "members.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, pos: input.members.loc.pos + 1 }) }) }) },
  { name: "members.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, end: input.members.loc.end + 1 }) }) }) },
  { name: "members.nodes.length", when: input => input.members.nodes.length > 0, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.slice(1) }) }) },
];
const fields27 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields28 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "isExportEquals.value", when: input => true, change: (input, alternateNode) => ({ ...input, isExportEquals: input.isExportEquals === false ? true : false }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields29 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "isTypeOnly.value", when: input => true, change: (input, alternateNode) => ({ ...input, isTypeOnly: input.isTypeOnly === false ? true : false }) },
  { name: "exportClause.presence", when: input => input.exportClause !== null, change: (input, alternateNode) => ({ ...input, exportClause: null }) },
  { name: "exportClause.child-kind", when: input => input.exportClause !== null && (true), change: (input, alternateNode) => ({ ...input, exportClause: alternateNode(input.exportClause, nodeKinds12) }) },
  { name: "moduleSpecifier.presence", when: input => input.moduleSpecifier !== null, change: (input, alternateNode) => ({ ...input, moduleSpecifier: null }) },
  { name: "moduleSpecifier.child-kind", when: input => input.moduleSpecifier !== null && (true), change: (input, alternateNode) => ({ ...input, moduleSpecifier: alternateNode(input.moduleSpecifier, nodeKinds0) }) },
  { name: "attributes.presence", when: input => input.attributes !== null, change: (input, alternateNode) => ({ ...input, attributes: null }) },
];
const fields30 = [
  { name: "isTypeOnly.value", when: input => true, change: (input, alternateNode) => ({ ...input, isTypeOnly: input.isTypeOnly === false ? true : false }) },
  { name: "propertyName.presence", when: input => input.propertyName !== null, change: (input, alternateNode) => ({ ...input, propertyName: null }) },
  { name: "propertyName.child-kind", when: input => input.propertyName !== null && (true), change: (input, alternateNode) => ({ ...input, propertyName: alternateNode(input.propertyName, nodeKinds13) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds13) }) },
];
const fields31 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
];
const fields32 = [
  { name: "initializer.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds14) }) },
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
];
const fields33 = [
  { name: "awaitModifier.presence", when: input => input.awaitModifier !== null, change: (input, alternateNode) => ({ ...input, awaitModifier: null }) },
  { name: "initializer.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds14) }) },
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
];
const fields34 = [
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds14) }) },
  { name: "condition.presence", when: input => input.condition !== null, change: (input, alternateNode) => ({ ...input, condition: null }) },
  { name: "condition.child-kind", when: input => input.condition !== null && (true), change: (input, alternateNode) => ({ ...input, condition: alternateNode(input.condition, nodeKinds0) }) },
  { name: "incrementor.presence", when: input => input.incrementor !== null, change: (input, alternateNode) => ({ ...input, incrementor: null }) },
  { name: "incrementor.child-kind", when: input => input.incrementor !== null && (true), change: (input, alternateNode) => ({ ...input, incrementor: alternateNode(input.incrementor, nodeKinds0) }) },
];
const fields35 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
  { name: "asteriskToken.presence", when: input => input.asteriskToken !== null, change: (input, alternateNode) => ({ ...input, asteriskToken: null }) },
  { name: "body.presence", when: input => input.body !== null, change: (input, alternateNode) => ({ ...input, body: null }) },
  { name: "body.child-kind", when: input => input.body !== null && (true), change: (input, alternateNode) => ({ ...input, body: alternateNode(input.body, nodeKinds3) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
];
const fields36 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
  { name: "asteriskToken.presence", when: input => input.asteriskToken !== null, change: (input, alternateNode) => ({ ...input, asteriskToken: null }) },
  { name: "body.presence", when: input => input.body !== null, change: (input, alternateNode) => ({ ...input, body: null }) },
  { name: "body.child-kind", when: input => input.body !== null && (true), change: (input, alternateNode) => ({ ...input, body: alternateNode(input.body, nodeKinds3) }) },
];
const fields37 = [
  { name: "token.value", when: input => true, change: (input, alternateNode) => ({ ...input, token: input.token === "ExtendsKeyword" ? "ImplementsKeyword" : "ExtendsKeyword" }) },
  { name: "types.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, loc: ({ ...input.types.loc, pos: input.types.loc.pos + 1 }) }) }) },
  { name: "types.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, loc: ({ ...input.types.loc, end: input.types.loc.end + 1 }) }) }) },
  { name: "types.nodes.length", when: input => input.types.nodes.length > 0, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, nodes: input.types.nodes.slice(1) }) }) },
];
const fields38 = [
  { name: "text.value", when: input => true, change: (input, alternateNode) => ({ ...input, text: input.text + "!" }) },
];
const fields39 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "thenStatement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, thenStatement: alternateNode(input.thenStatement, nodeKinds7) }) },
  { name: "elseStatement.presence", when: input => input.elseStatement !== null, change: (input, alternateNode) => ({ ...input, elseStatement: null }) },
  { name: "elseStatement.child-kind", when: input => input.elseStatement !== null && (true), change: (input, alternateNode) => ({ ...input, elseStatement: alternateNode(input.elseStatement, nodeKinds7) }) },
];
const fields40 = [
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds13) }) },
  { name: "value.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, value: alternateNode(input.value, nodeKinds0) }) },
];
const fields41 = [
  { name: "token.value", when: input => true, change: (input, alternateNode) => ({ ...input, token: input.token === "AssertKeyword" ? "WithKeyword" : "AssertKeyword" }) },
  { name: "attributes.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, attributes: ({ ...input.attributes, loc: ({ ...input.attributes.loc, pos: input.attributes.loc.pos + 1 }) }) }) },
  { name: "attributes.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, attributes: ({ ...input.attributes, loc: ({ ...input.attributes.loc, end: input.attributes.loc.end + 1 }) }) }) },
  { name: "attributes.nodes.length", when: input => input.attributes.nodes.length > 0, change: (input, alternateNode) => ({ ...input, attributes: ({ ...input.attributes, nodes: input.attributes.nodes.slice(1) }) }) },
  { name: "multiLine.value", when: input => true, change: (input, alternateNode) => ({ ...input, multiLine: input.multiLine === false ? true : false }) },
];
const fields42 = [
  { name: "phaseModifier.presence", when: input => input.phaseModifier !== null, change: (input, alternateNode) => ({ ...input, phaseModifier: null }) },
  { name: "phaseModifier.value", when: input => input.phaseModifier !== null && (true), change: (input, alternateNode) => ({ ...input, phaseModifier: input.phaseModifier === "DeferKeyword" ? "TypeKeyword" : "DeferKeyword" }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "namedBindings.presence", when: input => input.namedBindings !== null, change: (input, alternateNode) => ({ ...input, namedBindings: null }) },
  { name: "namedBindings.child-kind", when: input => input.namedBindings !== null && (true), change: (input, alternateNode) => ({ ...input, namedBindings: alternateNode(input.namedBindings, nodeKinds15) }) },
];
const fields43 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "importClause.presence", when: input => input.importClause !== null, change: (input, alternateNode) => ({ ...input, importClause: null }) },
  { name: "moduleSpecifier.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, moduleSpecifier: alternateNode(input.moduleSpecifier, nodeKinds0) }) },
  { name: "attributes.presence", when: input => input.attributes !== null, change: (input, alternateNode) => ({ ...input, attributes: null }) },
];
const fields44 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "isTypeOnly.value", when: input => true, change: (input, alternateNode) => ({ ...input, isTypeOnly: input.isTypeOnly === false ? true : false }) },
  { name: "moduleReference.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, moduleReference: alternateNode(input.moduleReference, nodeKinds16) }) },
];
const fields45 = [
  { name: "isTypeOnly.value", when: input => true, change: (input, alternateNode) => ({ ...input, isTypeOnly: input.isTypeOnly === false ? true : false }) },
  { name: "propertyName.presence", when: input => input.propertyName !== null, change: (input, alternateNode) => ({ ...input, propertyName: null }) },
  { name: "propertyName.child-kind", when: input => input.propertyName !== null && (true), change: (input, alternateNode) => ({ ...input, propertyName: alternateNode(input.propertyName, nodeKinds13) }) },
];
const fields46 = [
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "isTypeOf.value", when: input => true, change: (input, alternateNode) => ({ ...input, isTypeOf: input.isTypeOf === false ? true : false }) },
  { name: "argument.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, argument: alternateNode(input.argument, nodeKinds1) }) },
  { name: "attributes.presence", when: input => input.attributes !== null, change: (input, alternateNode) => ({ ...input, attributes: null }) },
  { name: "qualifier.presence", when: input => input.qualifier !== null, change: (input, alternateNode) => ({ ...input, qualifier: null }) },
  { name: "qualifier.child-kind", when: input => input.qualifier !== null && (true), change: (input, alternateNode) => ({ ...input, qualifier: alternateNode(input.qualifier, nodeKinds17) }) },
];
const fields47 = [
  { name: "objectType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, objectType: alternateNode(input.objectType, nodeKinds1) }) },
  { name: "indexType.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, indexType: alternateNode(input.indexType, nodeKinds1) }) },
];
const fields48 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "heritageClauses.presence", when: input => input.heritageClauses !== null, change: (input, alternateNode) => ({ ...input, heritageClauses: null }) },
  { name: "heritageClauses.loc.pos.value", when: input => input.heritageClauses !== null && (true), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, loc: ({ ...input.heritageClauses.loc, pos: input.heritageClauses.loc.pos + 1 }) }) }) },
  { name: "heritageClauses.loc.end.value", when: input => input.heritageClauses !== null && (true), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, loc: ({ ...input.heritageClauses.loc, end: input.heritageClauses.loc.end + 1 }) }) }) },
  { name: "heritageClauses.nodes.length", when: input => input.heritageClauses !== null && (input.heritageClauses.nodes.length > 0), change: (input, alternateNode) => ({ ...input, heritageClauses: ({ ...input.heritageClauses, nodes: input.heritageClauses.nodes.slice(1) }) }) },
  { name: "members.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, pos: input.members.loc.pos + 1 }) }) }) },
  { name: "members.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, end: input.members.loc.end + 1 }) }) }) },
  { name: "members.nodes.length", when: input => input.members.nodes.length > 0, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.slice(1) }) }) },
  { name: "members.nodes.element.child-kind", when: input => input.members.nodes.length > 0 && input.members.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds18) : entry) }) }) },
];
const fields49 = [
  { name: "types.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, loc: ({ ...input.types.loc, pos: input.types.loc.pos + 1 }) }) }) },
  { name: "types.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, loc: ({ ...input.types.loc, end: input.types.loc.end + 1 }) }) }) },
  { name: "types.nodes.length", when: input => input.types.nodes.length > 0, change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, nodes: input.types.nodes.slice(1) }) }) },
  { name: "types.nodes.element.child-kind", when: input => input.types.nodes.length > 0 && input.types.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, types: ({ ...input.types, nodes: input.types.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
];
const fields50 = [
  { name: "comment.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment.nodes.length > 0, change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "tags.presence", when: input => input.tags !== null, change: (input, alternateNode) => ({ ...input, tags: null }) },
  { name: "tags.loc.pos.value", when: input => input.tags !== null && (true), change: (input, alternateNode) => ({ ...input, tags: ({ ...input.tags, loc: ({ ...input.tags.loc, pos: input.tags.loc.pos + 1 }) }) }) },
  { name: "tags.loc.end.value", when: input => input.tags !== null && (true), change: (input, alternateNode) => ({ ...input, tags: ({ ...input.tags, loc: ({ ...input.tags.loc, end: input.tags.loc.end + 1 }) }) }) },
  { name: "tags.nodes.length", when: input => input.tags !== null && (input.tags.nodes.length > 0), change: (input, alternateNode) => ({ ...input, tags: ({ ...input.tags, nodes: input.tags.nodes.slice(1) }) }) },
  { name: "tags.nodes.element.child-kind", when: input => input.tags !== null && (input.tags.nodes.length > 0 && input.tags.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, tags: ({ ...input.tags, nodes: input.tags.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds20) : entry) }) }) },
];
const fields51 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
];
const fields52 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "typeExpression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds1) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "name.child-kind", when: input => input.name !== null && (true), change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds21) }) },
];
const fields53 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "importClause.presence", when: input => input.importClause !== null, change: (input, alternateNode) => ({ ...input, importClause: null }) },
  { name: "moduleSpecifier.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, moduleSpecifier: alternateNode(input.moduleSpecifier, nodeKinds0) }) },
  { name: "attributes.presence", when: input => input.attributes !== null, change: (input, alternateNode) => ({ ...input, attributes: null }) },
];
const fields54 = [
  { name: "text.length", when: input => input.text.length > 0, change: (input, alternateNode) => ({ ...input, text: input.text.slice(1) }) },
  { name: "text.element.value", when: input => input.text.length > 0 && input.text.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, text: input.text.map((entry, index) => index === 0 ? entry + "!" : entry) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "name.child-kind", when: input => input.name !== null && (true), change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds17) }) },
];
const fields55 = [
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds17) }) },
];
const fields56 = [
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields57 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "typeExpression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds1) }) },
];
const fields58 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds17) }) },
  { name: "isBracketed.value", when: input => true, change: (input, alternateNode) => ({ ...input, isBracketed: input.isBracketed === false ? true : false }) },
  { name: "typeExpression.presence", when: input => input.typeExpression !== null, change: (input, alternateNode) => ({ ...input, typeExpression: null }) },
  { name: "typeExpression.child-kind", when: input => input.typeExpression !== null && (true), change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds1) }) },
  { name: "isNameFirst.value", when: input => true, change: (input, alternateNode) => ({ ...input, isNameFirst: input.isNameFirst === false ? true : false }) },
];
const fields59 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "typeExpression.presence", when: input => input.typeExpression !== null, change: (input, alternateNode) => ({ ...input, typeExpression: null }) },
  { name: "typeExpression.child-kind", when: input => input.typeExpression !== null && (true), change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds1) }) },
];
const fields60 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "nameExpression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, nameExpression: alternateNode(input.nameExpression, nodeKinds1) }) },
];
const fields61 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "constraint.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, constraint: alternateNode(input.constraint, nodeKinds22) }) },
  { name: "typeParameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
];
const fields62 = [
  { name: "text.length", when: input => input.text.length > 0, change: (input, alternateNode) => ({ ...input, text: input.text.slice(1) }) },
  { name: "text.element.value", when: input => input.text.length > 0 && input.text.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, text: input.text.map((entry, index) => index === 0 ? entry + "!" : entry) }) },
];
const fields63 = [
  { name: "jsDocPropertyTags.presence", when: input => input.jsDocPropertyTags !== null, change: (input, alternateNode) => ({ ...input, jsDocPropertyTags: null }) },
  { name: "jsDocPropertyTags.length", when: input => input.jsDocPropertyTags !== null && (input.jsDocPropertyTags.length > 0), change: (input, alternateNode) => ({ ...input, jsDocPropertyTags: input.jsDocPropertyTags.slice(1) }) },
  { name: "jsDocPropertyTags.element.child-kind", when: input => input.jsDocPropertyTags !== null && (input.jsDocPropertyTags.length > 0 && input.jsDocPropertyTags.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, jsDocPropertyTags: input.jsDocPropertyTags.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds20) : entry) }) },
  { name: "isArrayType.value", when: input => true, change: (input, alternateNode) => ({ ...input, isArrayType: input.isArrayType === false ? true : false }) },
];
const fields64 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "typeExpression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds22) }) },
];
const fields65 = [
  { name: "comment.presence", when: input => input.comment !== null, change: (input, alternateNode) => ({ ...input, comment: null }) },
  { name: "comment.loc.pos.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, pos: input.comment.loc.pos + 1 }) }) }) },
  { name: "comment.loc.end.value", when: input => input.comment !== null && (true), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, loc: ({ ...input.comment.loc, end: input.comment.loc.end + 1 }) }) }) },
  { name: "comment.nodes.length", when: input => input.comment !== null && (input.comment.nodes.length > 0), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.slice(1) }) }) },
  { name: "comment.nodes.element.child-kind", when: input => input.comment !== null && (input.comment.nodes.length > 0 && input.comment.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, comment: ({ ...input.comment, nodes: input.comment.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds19) : entry) }) }) },
  { name: "typeExpression.presence", when: input => input.typeExpression !== null, change: (input, alternateNode) => ({ ...input, typeExpression: null }) },
  { name: "typeExpression.child-kind", when: input => input.typeExpression !== null && (true), change: (input, alternateNode) => ({ ...input, typeExpression: alternateNode(input.typeExpression, nodeKinds22) }) },
  { name: "name.presence", when: input => input.name !== null, change: (input, alternateNode) => ({ ...input, name: null }) },
  { name: "name.child-kind", when: input => input.name !== null && (true), change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds21) }) },
];
const fields66 = [
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds23) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds24) }) },
];
const fields67 = [
  { name: "properties.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, loc: ({ ...input.properties.loc, pos: input.properties.loc.pos + 1 }) }) }) },
  { name: "properties.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, loc: ({ ...input.properties.loc, end: input.properties.loc.end + 1 }) }) }) },
  { name: "properties.nodes.length", when: input => input.properties.nodes.length > 0, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, nodes: input.properties.nodes.slice(1) }) }) },
  { name: "properties.nodes.element.child-kind", when: input => input.properties.nodes.length > 0 && input.properties.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, nodes: input.properties.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds25) : entry) }) }) },
];
const fields68 = [
  { name: "tagName.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, tagName: alternateNode(input.tagName, nodeKinds26) }) },
];
const fields69 = [
  { name: "children.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, children: ({ ...input.children, loc: ({ ...input.children.loc, pos: input.children.loc.pos + 1 }) }) }) },
  { name: "children.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, children: ({ ...input.children, loc: ({ ...input.children.loc, end: input.children.loc.end + 1 }) }) }) },
  { name: "children.nodes.length", when: input => input.children.nodes.length > 0, change: (input, alternateNode) => ({ ...input, children: ({ ...input.children, nodes: input.children.nodes.slice(1) }) }) },
  { name: "children.nodes.element.child-kind", when: input => input.children.nodes.length > 0 && input.children.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, children: ({ ...input.children, nodes: input.children.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds27) : entry) }) }) },
];
const fields70 = [
  { name: "dotDotDotToken.presence", when: input => input.dotDotDotToken !== null, change: (input, alternateNode) => ({ ...input, dotDotDotToken: null }) },
  { name: "expression.presence", when: input => input.expression !== null, change: (input, alternateNode) => ({ ...input, expression: null }) },
  { name: "expression.child-kind", when: input => input.expression !== null && (true), change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields71 = [
  { name: "tagName.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, tagName: alternateNode(input.tagName, nodeKinds26) }) },
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
];
const fields72 = [
  { name: "text.value", when: input => true, change: (input, alternateNode) => ({ ...input, text: input.text + "!" }) },
  { name: "tokenFlags.length", when: input => input.tokenFlags.length > 0, change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.slice(1) }) },
  { name: "tokenFlags.element.value", when: input => input.tokenFlags.length > 0 && input.tokenFlags.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.map((entry, index) => index === 0 ? entry === "BinarySpecifier" ? "ContainsInvalidEscape" : "BinarySpecifier" : entry) }) },
  { name: "containsOnlyTriviaWhiteSpaces.value", when: input => true, change: (input, alternateNode) => ({ ...input, containsOnlyTriviaWhiteSpaces: input.containsOnlyTriviaWhiteSpaces === false ? true : false }) },
];
const fields73 = [
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
];
const fields74 = [
  { name: "literal.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, literal: alternateNode(input.literal, nodeKinds28) }) },
];
const fields75 = [
  { name: "readonlyToken.presence", when: input => input.readonlyToken !== null, change: (input, alternateNode) => ({ ...input, readonlyToken: null }) },
  { name: "readonlyToken.child-kind", when: input => input.readonlyToken !== null && (true), change: (input, alternateNode) => ({ ...input, readonlyToken: alternateNode(input.readonlyToken, nodeKinds29) }) },
  { name: "nameType.presence", when: input => input.nameType !== null, change: (input, alternateNode) => ({ ...input, nameType: null }) },
  { name: "nameType.child-kind", when: input => input.nameType !== null && (true), change: (input, alternateNode) => ({ ...input, nameType: alternateNode(input.nameType, nodeKinds1) }) },
  { name: "questionToken.presence", when: input => input.questionToken !== null, change: (input, alternateNode) => ({ ...input, questionToken: null }) },
  { name: "questionToken.child-kind", when: input => input.questionToken !== null && (true), change: (input, alternateNode) => ({ ...input, questionToken: alternateNode(input.questionToken, nodeKinds30) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "members.presence", when: input => input.members !== null, change: (input, alternateNode) => ({ ...input, members: null }) },
  { name: "members.loc.pos.value", when: input => input.members !== null && (true), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, pos: input.members.loc.pos + 1 }) }) }) },
  { name: "members.loc.end.value", when: input => input.members !== null && (true), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, end: input.members.loc.end + 1 }) }) }) },
  { name: "members.nodes.length", when: input => input.members !== null && (input.members.nodes.length > 0), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.slice(1) }) }) },
  { name: "members.nodes.element.child-kind", when: input => input.members !== null && (input.members.nodes.length > 0 && input.members.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds18) : entry) }) }) },
];
const fields76 = [
  { name: "keywordToken.value", when: input => true, change: (input, alternateNode) => ({ ...input, keywordToken: input.keywordToken === "ImportKeyword" ? "NewKeyword" : "ImportKeyword" }) },
];
const fields77 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "parameters.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, pos: input.parameters.loc.pos + 1 }) }) }) },
  { name: "parameters.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, loc: ({ ...input.parameters.loc, end: input.parameters.loc.end + 1 }) }) }) },
  { name: "parameters.nodes.length", when: input => input.parameters.nodes.length > 0, change: (input, alternateNode) => ({ ...input, parameters: ({ ...input.parameters, nodes: input.parameters.nodes.slice(1) }) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "fullSignature.presence", when: input => input.fullSignature !== null, change: (input, alternateNode) => ({ ...input, fullSignature: null }) },
  { name: "fullSignature.child-kind", when: input => input.fullSignature !== null && (true), change: (input, alternateNode) => ({ ...input, fullSignature: alternateNode(input.fullSignature, nodeKinds1) }) },
];
const fields78 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "asteriskToken.presence", when: input => input.asteriskToken !== null, change: (input, alternateNode) => ({ ...input, asteriskToken: null }) },
  { name: "body.presence", when: input => input.body !== null, change: (input, alternateNode) => ({ ...input, body: null }) },
  { name: "body.child-kind", when: input => input.body !== null && (true), change: (input, alternateNode) => ({ ...input, body: alternateNode(input.body, nodeKinds31) }) },
  { name: "keyword.value", when: input => true, change: (input, alternateNode) => ({ ...input, keyword: input.keyword === "ModuleKeyword" ? "NamespaceKeyword" : "ModuleKeyword" }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds13) }) },
];
const fields79 = [
  { name: "dotDotDotToken.presence", when: input => input.dotDotDotToken !== null, change: (input, alternateNode) => ({ ...input, dotDotDotToken: null }) },
  { name: "questionToken.presence", when: input => input.questionToken !== null, change: (input, alternateNode) => ({ ...input, questionToken: null }) },
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields80 = [
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds13) }) },
];
const fields81 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "arguments.presence", when: input => input.arguments !== null, change: (input, alternateNode) => ({ ...input, arguments: null }) },
  { name: "arguments.loc.pos.value", when: input => input.arguments !== null && (true), change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, loc: ({ ...input.arguments.loc, pos: input.arguments.loc.pos + 1 }) }) }) },
  { name: "arguments.loc.end.value", when: input => input.arguments !== null && (true), change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, loc: ({ ...input.arguments.loc, end: input.arguments.loc.end + 1 }) }) }) },
  { name: "arguments.nodes.length", when: input => input.arguments !== null && (input.arguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, nodes: input.arguments.nodes.slice(1) }) }) },
  { name: "arguments.nodes.element.child-kind", when: input => input.arguments !== null && (input.arguments.nodes.length > 0 && input.arguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, arguments: ({ ...input.arguments, nodes: input.arguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds0) : entry) }) }) },
];
const fields82 = [
  { name: "text.value", when: input => true, change: (input, alternateNode) => ({ ...input, text: input.text + "!" }) },
  { name: "tokenFlags.length", when: input => input.tokenFlags.length > 0, change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.slice(1) }) },
  { name: "tokenFlags.element.value", when: input => input.tokenFlags.length > 0 && input.tokenFlags.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, tokenFlags: input.tokenFlags.map((entry, index) => index === 0 ? entry === "BinarySpecifier" ? "ContainsInvalidEscape" : "BinarySpecifier" : entry) }) },
  { name: "rawText.value", when: input => true, change: (input, alternateNode) => ({ ...input, rawText: input.rawText + "!" }) },
  { name: "templateFlags.length", when: input => input.templateFlags.length > 0, change: (input, alternateNode) => ({ ...input, templateFlags: input.templateFlags.slice(1) }) },
  { name: "templateFlags.element.value", when: input => input.templateFlags.length > 0 && input.templateFlags.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, templateFlags: input.templateFlags.map((entry, index) => index === 0 ? entry === "BinarySpecifier" ? "ContainsInvalidEscape" : "BinarySpecifier" : entry) }) },
];
const fields83 = [
  { name: "properties.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, loc: ({ ...input.properties.loc, pos: input.properties.loc.pos + 1 }) }) }) },
  { name: "properties.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, loc: ({ ...input.properties.loc, end: input.properties.loc.end + 1 }) }) }) },
  { name: "properties.nodes.length", when: input => input.properties.nodes.length > 0, change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, nodes: input.properties.nodes.slice(1) }) }) },
  { name: "properties.nodes.element.child-kind", when: input => input.properties.nodes.length > 0 && input.properties.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, properties: ({ ...input.properties, nodes: input.properties.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds32) : entry) }) }) },
  { name: "multiLine.value", when: input => true, change: (input, alternateNode) => ({ ...input, multiLine: input.multiLine === false ? true : false }) },
];
const fields84 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "dotDotDotToken.presence", when: input => input.dotDotDotToken !== null, change: (input, alternateNode) => ({ ...input, dotDotDotToken: null }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds6) }) },
  { name: "questionToken.presence", when: input => input.questionToken !== null, change: (input, alternateNode) => ({ ...input, questionToken: null }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields85 = [
  { name: "operand.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, operand: alternateNode(input.operand, nodeKinds0) }) },
  { name: "operator.value", when: input => true, change: (input, alternateNode) => ({ ...input, operator: input.operator === "MinusMinusToken" ? "PlusPlusToken" : "MinusMinusToken" }) },
];
const fields86 = [
  { name: "operator.value", when: input => true, change: (input, alternateNode) => ({ ...input, operator: input.operator === "ExclamationToken" ? "MinusMinusToken" : "ExclamationToken" }) },
  { name: "operand.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, operand: alternateNode(input.operand, nodeKinds0) }) },
];
const fields87 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "questionDotToken.presence", when: input => input.questionDotToken !== null, change: (input, alternateNode) => ({ ...input, questionDotToken: null }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds33) }) },
];
const fields88 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "initializer.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields89 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields90 = [
  { name: "left.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, left: alternateNode(input.left, nodeKinds17) }) },
];
const fields91 = [
  { name: "expression.presence", when: input => input.expression !== null, change: (input, alternateNode) => ({ ...input, expression: null }) },
  { name: "expression.child-kind", when: input => input.expression !== null && (true), change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields92 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds5) }) },
  { name: "postfixToken.presence", when: input => input.postfixToken !== null, change: (input, alternateNode) => ({ ...input, postfixToken: null }) },
  { name: "postfixToken.child-kind", when: input => input.postfixToken !== null && (true), change: (input, alternateNode) => ({ ...input, postfixToken: alternateNode(input.postfixToken, nodeKinds11) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "equalsToken.presence", when: input => input.equalsToken !== null, change: (input, alternateNode) => ({ ...input, equalsToken: null }) },
  { name: "objectAssignmentInitializer.presence", when: input => input.objectAssignmentInitializer !== null, change: (input, alternateNode) => ({ ...input, objectAssignmentInitializer: null }) },
  { name: "objectAssignmentInitializer.child-kind", when: input => input.objectAssignmentInitializer !== null && (true), change: (input, alternateNode) => ({ ...input, objectAssignmentInitializer: alternateNode(input.objectAssignmentInitializer, nodeKinds0) }) },
];
const fields93 = [
  { name: "statements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, pos: input.statements.loc.pos + 1 }) }) }) },
  { name: "statements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, loc: ({ ...input.statements.loc, end: input.statements.loc.end + 1 }) }) }) },
  { name: "statements.nodes.length", when: input => input.statements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.slice(1) }) }) },
  { name: "statements.nodes.element.child-kind", when: input => input.statements.nodes.length > 0 && input.statements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, statements: ({ ...input.statements, nodes: input.statements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds7) : entry) }) }) },
  { name: "languageVariant.value", when: input => true, change: (input, alternateNode) => ({ ...input, languageVariant: input.languageVariant === "JSX" ? "Standard" : "JSX" }) },
  { name: "scriptKind.value", when: input => true, change: (input, alternateNode) => ({ ...input, scriptKind: input.scriptKind === "Deferred" ? "External" : "Deferred" }) },
  { name: "commentDirectives.length", when: input => input.commentDirectives.length > 0, change: (input, alternateNode) => ({ ...input, commentDirectives: input.commentDirectives.slice(1) }) },
  { name: "commentDirectives.element.loc.pos.value", when: input => input.commentDirectives.length > 0 && input.commentDirectives.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, commentDirectives: input.commentDirectives.map((entry, index) => index === 0 ? ({ ...entry, loc: ({ ...entry.loc, pos: entry.loc.pos + 1 }) }) : entry) }) },
  { name: "commentDirectives.element.loc.end.value", when: input => input.commentDirectives.length > 0 && input.commentDirectives.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, commentDirectives: input.commentDirectives.map((entry, index) => index === 0 ? ({ ...entry, loc: ({ ...entry.loc, end: entry.loc.end + 1 }) }) : entry) }) },
  { name: "commentDirectives.element.kind.value", when: input => input.commentDirectives.length > 0 && input.commentDirectives.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, commentDirectives: input.commentDirectives.map((entry, index) => index === 0 ? ({ ...entry, kind: entry.kind === "ExpectError" ? "Ignore" : "ExpectError" }) : entry) }) },
  { name: "pragmas.length", when: input => input.pragmas.length > 0, change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.slice(1) }) },
  { name: "pragmas.element.name.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, name: entry.name + "!" }) : entry) }) },
  { name: "pragmas.element.args.length", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.slice(1) }) : entry) }) },
  { name: "pragmas.element.args.element.name.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0 && entry.args.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.map((entry, index) => index === 0 ? ({ ...entry, name: entry.name + "!" }) : entry) }) : entry) }) },
  { name: "pragmas.element.args.element.value.name.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0 && entry.args.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.map((entry, index) => index === 0 ? ({ ...entry, value: ({ ...entry.value, name: entry.value.name + "!" }) }) : entry) }) : entry) }) },
  { name: "pragmas.element.args.element.value.value.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0 && entry.args.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.map((entry, index) => index === 0 ? ({ ...entry, value: ({ ...entry.value, value: entry.value.value + "!" }) }) : entry) }) : entry) }) },
  { name: "pragmas.element.args.element.value.pos.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0 && entry.args.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.map((entry, index) => index === 0 ? ({ ...entry, value: ({ ...entry.value, pos: entry.value.pos + 1 }) }) : entry) }) : entry) }) },
  { name: "pragmas.element.args.element.value.end.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => entry.args.length > 0 && entry.args.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, args: entry.args.map((entry, index) => index === 0 ? ({ ...entry, value: ({ ...entry.value, end: entry.value.end + 1 }) }) : entry) }) : entry) }) },
  { name: "pragmas.element.pos.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, pos: entry.pos + 1 }) : entry) }) },
  { name: "pragmas.element.end.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, end: entry.end + 1 }) : entry) }) },
  { name: "pragmas.element.kind.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, kind: entry.kind === "MultiLineCommentTrivia" ? "SingleLineCommentTrivia" : "MultiLineCommentTrivia" }) : entry) }) },
  { name: "pragmas.element.hasTrailingNewLine.value", when: input => input.pragmas.length > 0 && input.pragmas.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, pragmas: input.pragmas.map((entry, index) => index === 0 ? ({ ...entry, hasTrailingNewLine: entry.hasTrailingNewLine === false ? true : false }) : entry) }) },
  { name: "checkJsDirective.presence", when: input => input.checkJsDirective !== null, change: (input, alternateNode) => ({ ...input, checkJsDirective: null }) },
  { name: "checkJsDirective.enabled.value", when: input => input.checkJsDirective !== null && (true), change: (input, alternateNode) => ({ ...input, checkJsDirective: ({ ...input.checkJsDirective, enabled: input.checkJsDirective.enabled === false ? true : false }) }) },
  { name: "checkJsDirective.range.kind.value", when: input => input.checkJsDirective !== null && (true), change: (input, alternateNode) => ({ ...input, checkJsDirective: ({ ...input.checkJsDirective, range: ({ ...input.checkJsDirective.range, kind: input.checkJsDirective.range.kind === "MultiLineCommentTrivia" ? "SingleLineCommentTrivia" : "MultiLineCommentTrivia" }) }) }) },
  { name: "checkJsDirective.range.hasTrailingNewLine.value", when: input => input.checkJsDirective !== null && (true), change: (input, alternateNode) => ({ ...input, checkJsDirective: ({ ...input.checkJsDirective, range: ({ ...input.checkJsDirective.range, hasTrailingNewLine: input.checkJsDirective.range.hasTrailingNewLine === false ? true : false }) }) }) },
  { name: "checkJsDirective.range.pos.value", when: input => input.checkJsDirective !== null && (true), change: (input, alternateNode) => ({ ...input, checkJsDirective: ({ ...input.checkJsDirective, range: ({ ...input.checkJsDirective.range, pos: input.checkJsDirective.range.pos + 1 }) }) }) },
  { name: "checkJsDirective.range.end.value", when: input => input.checkJsDirective !== null && (true), change: (input, alternateNode) => ({ ...input, checkJsDirective: ({ ...input.checkJsDirective, range: ({ ...input.checkJsDirective.range, end: input.checkJsDirective.range.end + 1 }) }) }) },
];
const fields94 = [
  { name: "children.length", when: input => input.children.length > 0, change: (input, alternateNode) => ({ ...input, children: input.children.slice(1) }) },
  { name: "children.element.child-kind", when: input => input.children.length > 0 && input.children.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, children: input.children.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds22) : entry) }) },
];
const fields95 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "thisArg.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, thisArg: alternateNode(input.thisArg, nodeKinds0) }) },
];
const fields96 = [
  { name: "tag.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, tag: alternateNode(input.tag, nodeKinds0) }) },
  { name: "questionDotToken.presence", when: input => input.questionDotToken !== null, change: (input, alternateNode) => ({ ...input, questionDotToken: null }) },
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "template.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, template: alternateNode(input.template, nodeKinds34) }) },
];
const fields97 = [
  { name: "templateSpans.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, templateSpans: ({ ...input.templateSpans, loc: ({ ...input.templateSpans.loc, pos: input.templateSpans.loc.pos + 1 }) }) }) },
  { name: "templateSpans.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, templateSpans: ({ ...input.templateSpans, loc: ({ ...input.templateSpans.loc, end: input.templateSpans.loc.end + 1 }) }) }) },
  { name: "templateSpans.nodes.length", when: input => input.templateSpans.nodes.length > 0, change: (input, alternateNode) => ({ ...input, templateSpans: ({ ...input.templateSpans, nodes: input.templateSpans.nodes.slice(1) }) }) },
];
const fields98 = [
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "literal.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, literal: alternateNode(input.literal, nodeKinds35) }) },
];
const fields99 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "literal.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, literal: alternateNode(input.literal, nodeKinds35) }) },
];
const fields100 = [
  { name: "catchClause.presence", when: input => input.catchClause !== null, change: (input, alternateNode) => ({ ...input, catchClause: null }) },
  { name: "finallyBlock.presence", when: input => input.finallyBlock !== null, change: (input, alternateNode) => ({ ...input, finallyBlock: null }) },
];
const fields101 = [
  { name: "elements.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, pos: input.elements.loc.pos + 1 }) }) }) },
  { name: "elements.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, loc: ({ ...input.elements.loc, end: input.elements.loc.end + 1 }) }) }) },
  { name: "elements.nodes.length", when: input => input.elements.nodes.length > 0, change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, nodes: input.elements.nodes.slice(1) }) }) },
  { name: "elements.nodes.element.child-kind", when: input => input.elements.nodes.length > 0 && input.elements.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, elements: ({ ...input.elements, nodes: input.elements.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
];
const fields102 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "typeParameters.presence", when: input => input.typeParameters !== null, change: (input, alternateNode) => ({ ...input, typeParameters: null }) },
  { name: "typeParameters.loc.pos.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, pos: input.typeParameters.loc.pos + 1 }) }) }) },
  { name: "typeParameters.loc.end.value", when: input => input.typeParameters !== null && (true), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, loc: ({ ...input.typeParameters.loc, end: input.typeParameters.loc.end + 1 }) }) }) },
  { name: "typeParameters.nodes.length", when: input => input.typeParameters !== null && (input.typeParameters.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeParameters: ({ ...input.typeParameters, nodes: input.typeParameters.nodes.slice(1) }) }) },
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields103 = [
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];
const fields104 = [
  { name: "members.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, pos: input.members.loc.pos + 1 }) }) }) },
  { name: "members.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, loc: ({ ...input.members.loc, end: input.members.loc.end + 1 }) }) }) },
  { name: "members.nodes.length", when: input => input.members.nodes.length > 0, change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.slice(1) }) }) },
  { name: "members.nodes.element.child-kind", when: input => input.members.nodes.length > 0 && input.members.nodes.slice(0, 1).every(entry => true), change: (input, alternateNode) => ({ ...input, members: ({ ...input.members, nodes: input.members.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds18) : entry) }) }) },
];
const fields105 = [
  { name: "operator.value", when: input => true, change: (input, alternateNode) => ({ ...input, operator: input.operator === "KeyOfKeyword" ? "ReadonlyKeyword" : "KeyOfKeyword" }) },
  { name: "type.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields106 = [
  { name: "modifiers.presence", when: input => input.modifiers !== null, change: (input, alternateNode) => ({ ...input, modifiers: null }) },
  { name: "modifiers.loc.pos.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, pos: input.modifiers.loc.pos + 1 }) }) }) },
  { name: "modifiers.loc.end.value", when: input => input.modifiers !== null && (true), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, loc: ({ ...input.modifiers.loc, end: input.modifiers.loc.end + 1 }) }) }) },
  { name: "modifiers.nodes.length", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.slice(1) }) }) },
  { name: "modifiers.nodes.element.child-kind", when: input => input.modifiers !== null && (input.modifiers.nodes.length > 0 && input.modifiers.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, modifiers: ({ ...input.modifiers, nodes: input.modifiers.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds2) : entry) }) }) },
  { name: "constraint.presence", when: input => input.constraint !== null, change: (input, alternateNode) => ({ ...input, constraint: null }) },
  { name: "constraint.child-kind", when: input => input.constraint !== null && (true), change: (input, alternateNode) => ({ ...input, constraint: alternateNode(input.constraint, nodeKinds1) }) },
  { name: "expression.presence", when: input => input.expression !== null, change: (input, alternateNode) => ({ ...input, expression: null }) },
  { name: "expression.child-kind", when: input => input.expression !== null && (true), change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "defaultType.presence", when: input => input.defaultType !== null, change: (input, alternateNode) => ({ ...input, defaultType: null }) },
  { name: "defaultType.child-kind", when: input => input.defaultType !== null && (true), change: (input, alternateNode) => ({ ...input, defaultType: alternateNode(input.defaultType, nodeKinds1) }) },
];
const fields107 = [
  { name: "assertsModifier.presence", when: input => input.assertsModifier !== null, change: (input, alternateNode) => ({ ...input, assertsModifier: null }) },
  { name: "parameterName.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, parameterName: alternateNode(input.parameterName, nodeKinds36) }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
];
const fields108 = [
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "exprName.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, exprName: alternateNode(input.exprName, nodeKinds17) }) },
];
const fields109 = [
  { name: "typeArguments.presence", when: input => input.typeArguments !== null, change: (input, alternateNode) => ({ ...input, typeArguments: null }) },
  { name: "typeArguments.loc.pos.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, pos: input.typeArguments.loc.pos + 1 }) }) }) },
  { name: "typeArguments.loc.end.value", when: input => input.typeArguments !== null && (true), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, loc: ({ ...input.typeArguments.loc, end: input.typeArguments.loc.end + 1 }) }) }) },
  { name: "typeArguments.nodes.length", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.slice(1) }) }) },
  { name: "typeArguments.nodes.element.child-kind", when: input => input.typeArguments !== null && (input.typeArguments.nodes.length > 0 && input.typeArguments.nodes.slice(0, 1).every(entry => true)), change: (input, alternateNode) => ({ ...input, typeArguments: ({ ...input.typeArguments, nodes: input.typeArguments.nodes.map((entry, index) => index === 0 ? alternateNode(entry, nodeKinds1) : entry) }) }) },
  { name: "typeName.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, typeName: alternateNode(input.typeName, nodeKinds17) }) },
];
const fields110 = [
  { name: "name.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, name: alternateNode(input.name, nodeKinds6) }) },
  { name: "exclamationToken.presence", when: input => input.exclamationToken !== null, change: (input, alternateNode) => ({ ...input, exclamationToken: null }) },
  { name: "type.presence", when: input => input.type !== null, change: (input, alternateNode) => ({ ...input, type: null }) },
  { name: "type.child-kind", when: input => input.type !== null && (true), change: (input, alternateNode) => ({ ...input, type: alternateNode(input.type, nodeKinds1) }) },
  { name: "initializer.presence", when: input => input.initializer !== null, change: (input, alternateNode) => ({ ...input, initializer: null }) },
  { name: "initializer.child-kind", when: input => input.initializer !== null && (true), change: (input, alternateNode) => ({ ...input, initializer: alternateNode(input.initializer, nodeKinds0) }) },
];
const fields111 = [
  { name: "declarations.loc.pos.value", when: input => true, change: (input, alternateNode) => ({ ...input, declarations: ({ ...input.declarations, loc: ({ ...input.declarations.loc, pos: input.declarations.loc.pos + 1 }) }) }) },
  { name: "declarations.loc.end.value", when: input => true, change: (input, alternateNode) => ({ ...input, declarations: ({ ...input.declarations, loc: ({ ...input.declarations.loc, end: input.declarations.loc.end + 1 }) }) }) },
  { name: "declarations.nodes.length", when: input => input.declarations.nodes.length > 0, change: (input, alternateNode) => ({ ...input, declarations: ({ ...input.declarations, nodes: input.declarations.nodes.slice(1) }) }) },
];
const fields112 = [
  { name: "expression.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
  { name: "statement.child-kind", when: input => true, change: (input, alternateNode) => ({ ...input, statement: alternateNode(input.statement, nodeKinds7) }) },
];
const fields113 = [
  { name: "asteriskToken.presence", when: input => input.asteriskToken !== null, change: (input, alternateNode) => ({ ...input, asteriskToken: null }) },
  { name: "expression.presence", when: input => input.expression !== null, change: (input, alternateNode) => ({ ...input, expression: null }) },
  { name: "expression.child-kind", when: input => input.expression !== null && (true), change: (input, alternateNode) => ({ ...input, expression: alternateNode(input.expression, nodeKinds0) }) },
];

export const syntaxFieldMutations = new Map([
  ["ArrayLiteralExpression", fields0],
  ["ArrayType", fields1],
  ["ArrowFunction", fields2],
  ["AsExpression", fields3],
  ["AwaitExpression", fields4],
  ["BigIntLiteral", fields5],
  ["BinaryExpression", fields6],
  ["BindingElement", fields7],
  ["ArrayBindingPattern", fields8],
  ["ObjectBindingPattern", fields8],
  ["Block", fields9],
  ["BreakStatement", fields10],
  ["CallExpression", fields11],
  ["CallSignature", fields12],
  ["CaseBlock", fields13],
  ["CaseClause", fields14],
  ["CatchClause", fields15],
  ["ClassDeclaration", fields16],
  ["ClassExpression", fields16],
  ["ClassStaticBlockDeclaration", fields17],
  ["ComputedPropertyName", fields4],
  ["ConditionalExpression", fields18],
  ["ConditionalType", fields19],
  ["ConstructSignature", fields12],
  ["Constructor", fields2],
  ["ConstructorType", fields20],
  ["ContinueStatement", fields10],
  ["DebuggerStatement", fields21],
  ["Decorator", fields22],
  ["DefaultClause", fields23],
  ["DeleteExpression", fields4],
  ["DoStatement", fields24],
  ["ElementAccessExpression", fields25],
  ["EmptyStatement", fields21],
  ["EnumDeclaration", fields26],
  ["EnumMember", fields27],
  ["ExportAssignment", fields28],
  ["ExportDeclaration", fields29],
  ["ExportSpecifier", fields30],
  ["ExpressionStatement", fields4],
  ["ExpressionWithTypeArguments", fields31],
  ["ExternalModuleReference", fields4],
  ["ForInStatement", fields32],
  ["ForOfStatement", fields33],
  ["ForStatement", fields34],
  ["FunctionDeclaration", fields35],
  ["FunctionExpression", fields35],
  ["FunctionType", fields20],
  ["GetAccessor", fields36],
  ["HeritageClause", fields37],
  ["Identifier", fields38],
  ["IfStatement", fields39],
  ["ImportAttribute", fields40],
  ["ImportAttributes", fields41],
  ["ImportClause", fields42],
  ["ImportDeclaration", fields43],
  ["JSImportDeclaration", fields43],
  ["ImportEqualsDeclaration", fields44],
  ["ImportSpecifier", fields45],
  ["ImportType", fields46],
  ["IndexSignature", fields20],
  ["IndexedAccessType", fields47],
  ["InferType", fields21],
  ["InterfaceDeclaration", fields48],
  ["IntersectionType", fields49],
  ["JSDoc", fields50],
  ["JSDocAllType", fields21],
  ["JSDocAugmentsTag", fields51],
  ["JSDocCallbackTag", fields52],
  ["JSDocDeprecatedTag", fields51],
  ["JSDocImplementsTag", fields51],
  ["JSDocImportTag", fields53],
  ["JSDocLink", fields54],
  ["JSDocLinkCode", fields54],
  ["JSDocLinkPlain", fields54],
  ["JSDocNameReference", fields55],
  ["JSDocNonNullableType", fields56],
  ["JSDocNullableType", fields56],
  ["JSDocOptionalType", fields56],
  ["JSDocOverloadTag", fields57],
  ["JSDocOverrideTag", fields51],
  ["JSDocParameterTag", fields58],
  ["JSDocPropertyTag", fields58],
  ["JSDocPrivateTag", fields51],
  ["JSDocProtectedTag", fields51],
  ["JSDocPublicTag", fields51],
  ["JSDocReadonlyTag", fields51],
  ["JSDocReturnTag", fields59],
  ["JSDocSatisfiesTag", fields57],
  ["JSDocSeeTag", fields60],
  ["JSDocSignature", fields12],
  ["JSDocTemplateTag", fields61],
  ["JSDocText", fields62],
  ["JSDocThisTag", fields57],
  ["JSDocThrowsTag", fields59],
  ["JSDocTypeExpression", fields56],
  ["JSDocTypeLiteral", fields63],
  ["JSDocTypeTag", fields64],
  ["JSDocTypedefTag", fields65],
  ["JSDocUnknownTag", fields51],
  ["JSDocVariadicType", fields56],
  ["JsxAttribute", fields66],
  ["JsxAttributes", fields67],
  ["JsxClosingElement", fields68],
  ["JsxClosingFragment", fields21],
  ["JsxElement", fields69],
  ["JsxExpression", fields70],
  ["JsxFragment", fields69],
  ["JsxNamespacedName", fields21],
  ["JsxOpeningElement", fields71],
  ["JsxOpeningFragment", fields21],
  ["JsxSelfClosingElement", fields71],
  ["JsxSpreadAttribute", fields4],
  ["JsxText", fields72],
  ["FalseKeyword", fields21],
  ["ImportKeyword", fields21],
  ["NullKeyword", fields21],
  ["SuperKeyword", fields21],
  ["ThisKeyword", fields21],
  ["TrueKeyword", fields21],
  ["AnyKeyword", fields21],
  ["BigIntKeyword", fields21],
  ["BooleanKeyword", fields21],
  ["IntrinsicKeyword", fields21],
  ["NeverKeyword", fields21],
  ["NumberKeyword", fields21],
  ["ObjectKeyword", fields21],
  ["StringKeyword", fields21],
  ["SymbolKeyword", fields21],
  ["UndefinedKeyword", fields21],
  ["UnknownKeyword", fields21],
  ["VoidKeyword", fields21],
  ["LabeledStatement", fields73],
  ["LiteralType", fields74],
  ["MappedType", fields75],
  ["MetaProperty", fields76],
  ["MethodDeclaration", fields36],
  ["MethodSignature", fields77],
  ["MissingDeclaration", fields17],
  ["ModuleBlock", fields23],
  ["ModuleDeclaration", fields78],
  ["NamedExports", fields8],
  ["NamedImports", fields8],
  ["NamedTupleMember", fields79],
  ["NamespaceExport", fields80],
  ["NamespaceExportDeclaration", fields17],
  ["NamespaceImport", fields21],
  ["NewExpression", fields81],
  ["NoSubstitutionTemplateLiteral", fields82],
  ["NonNullExpression", fields4],
  ["NotEmittedStatement", fields21],
  ["NotEmittedTypeElement", fields21],
  ["NumericLiteral", fields5],
  ["ObjectLiteralExpression", fields83],
  ["OmittedExpression", fields21],
  ["OptionalType", fields56],
  ["Parameter", fields84],
  ["ParenthesizedExpression", fields4],
  ["ParenthesizedType", fields56],
  ["PartiallyEmittedExpression", fields4],
  ["PostfixUnaryExpression", fields85],
  ["PrefixUnaryExpression", fields86],
  ["PrivateIdentifier", fields38],
  ["PropertyAccessExpression", fields87],
  ["PropertyAssignment", fields88],
  ["PropertyDeclaration", fields89],
  ["PropertySignature", fields89],
  ["QualifiedName", fields90],
  ["RegularExpressionLiteral", fields5],
  ["RestType", fields56],
  ["ReturnStatement", fields91],
  ["SatisfiesExpression", fields3],
  ["SemicolonClassElement", fields21],
  ["SetAccessor", fields36],
  ["ShorthandPropertyAssignment", fields92],
  ["SourceFile", fields93],
  ["SpreadAssignment", fields4],
  ["SpreadElement", fields4],
  ["StringLiteral", fields5],
  ["SwitchStatement", fields4],
  ["SyntaxList", fields94],
  ["SyntheticReferenceExpression", fields95],
  ["TaggedTemplateExpression", fields96],
  ["TemplateExpression", fields97],
  ["TemplateHead", fields82],
  ["TemplateLiteralType", fields97],
  ["TemplateLiteralTypeSpan", fields98],
  ["TemplateMiddle", fields82],
  ["TemplateSpan", fields99],
  ["TemplateTail", fields82],
  ["ThisType", fields21],
  ["ThrowStatement", fields4],
  ["AbstractKeyword", fields21],
  ["AccessorKeyword", fields21],
  ["AmpersandAmpersandEqualsToken", fields21],
  ["AmpersandAmpersandToken", fields21],
  ["AmpersandEqualsToken", fields21],
  ["AmpersandToken", fields21],
  ["AsKeyword", fields21],
  ["AssertKeyword", fields21],
  ["AssertsKeyword", fields21],
  ["AsteriskAsteriskEqualsToken", fields21],
  ["AsteriskAsteriskToken", fields21],
  ["AsteriskEqualsToken", fields21],
  ["AsteriskToken", fields21],
  ["AsyncKeyword", fields21],
  ["AtToken", fields21],
  ["AwaitKeyword", fields21],
  ["BacktickToken", fields21],
  ["BarBarEqualsToken", fields21],
  ["BarBarToken", fields21],
  ["BarEqualsToken", fields21],
  ["BarToken", fields21],
  ["BreakKeyword", fields21],
  ["CaretEqualsToken", fields21],
  ["CaretToken", fields21],
  ["CaseKeyword", fields21],
  ["CatchKeyword", fields21],
  ["ClassKeyword", fields21],
  ["CloseBraceToken", fields21],
  ["CloseBracketToken", fields21],
  ["CloseParenToken", fields21],
  ["ColonToken", fields21],
  ["CommaToken", fields21],
  ["ConflictMarkerTrivia", fields21],
  ["ConstKeyword", fields21],
  ["ConstructorKeyword", fields21],
  ["ContinueKeyword", fields21],
  ["DebuggerKeyword", fields21],
  ["DeclareKeyword", fields21],
  ["DefaultKeyword", fields21],
  ["DeferKeyword", fields21],
  ["DeleteKeyword", fields21],
  ["DoKeyword", fields21],
  ["DotDotDotToken", fields21],
  ["DotToken", fields21],
  ["ElseKeyword", fields21],
  ["EndOfFile", fields21],
  ["EnumKeyword", fields21],
  ["EqualsEqualsEqualsToken", fields21],
  ["EqualsEqualsToken", fields21],
  ["EqualsGreaterThanToken", fields21],
  ["EqualsToken", fields21],
  ["ExclamationEqualsEqualsToken", fields21],
  ["ExclamationEqualsToken", fields21],
  ["ExclamationToken", fields21],
  ["ExportKeyword", fields21],
  ["ExtendsKeyword", fields21],
  ["FinallyKeyword", fields21],
  ["ForKeyword", fields21],
  ["FromKeyword", fields21],
  ["FunctionKeyword", fields21],
  ["GetKeyword", fields21],
  ["GlobalKeyword", fields21],
  ["GreaterThanEqualsToken", fields21],
  ["GreaterThanGreaterThanEqualsToken", fields21],
  ["GreaterThanGreaterThanGreaterThanEqualsToken", fields21],
  ["GreaterThanGreaterThanGreaterThanToken", fields21],
  ["GreaterThanGreaterThanToken", fields21],
  ["GreaterThanToken", fields21],
  ["HashToken", fields21],
  ["IfKeyword", fields21],
  ["ImmediateKeyword", fields21],
  ["ImplementsKeyword", fields21],
  ["InKeyword", fields21],
  ["InferKeyword", fields21],
  ["InstanceOfKeyword", fields21],
  ["InterfaceKeyword", fields21],
  ["IsKeyword", fields21],
  ["JSDocCommentTextToken", fields21],
  ["JsxTextAllWhiteSpaces", fields21],
  ["KeyOfKeyword", fields21],
  ["LessThanEqualsToken", fields21],
  ["LessThanLessThanEqualsToken", fields21],
  ["LessThanLessThanToken", fields21],
  ["LessThanSlashToken", fields21],
  ["LessThanToken", fields21],
  ["LetKeyword", fields21],
  ["MinusEqualsToken", fields21],
  ["MinusMinusToken", fields21],
  ["MinusToken", fields21],
  ["ModuleKeyword", fields21],
  ["MultiLineCommentTrivia", fields21],
  ["NamespaceKeyword", fields21],
  ["NewKeyword", fields21],
  ["NewLineTrivia", fields21],
  ["NonTextFileMarkerTrivia", fields21],
  ["OfKeyword", fields21],
  ["OpenBraceToken", fields21],
  ["OpenBracketToken", fields21],
  ["OpenParenToken", fields21],
  ["OutKeyword", fields21],
  ["OverrideKeyword", fields21],
  ["PackageKeyword", fields21],
  ["PercentEqualsToken", fields21],
  ["PercentToken", fields21],
  ["PlusEqualsToken", fields21],
  ["PlusPlusToken", fields21],
  ["PlusToken", fields21],
  ["PrivateKeyword", fields21],
  ["ProtectedKeyword", fields21],
  ["PublicKeyword", fields21],
  ["QuestionDotToken", fields21],
  ["QuestionQuestionEqualsToken", fields21],
  ["QuestionQuestionToken", fields21],
  ["QuestionToken", fields21],
  ["ReadonlyKeyword", fields21],
  ["RequireKeyword", fields21],
  ["ReturnKeyword", fields21],
  ["SatisfiesKeyword", fields21],
  ["SemicolonToken", fields21],
  ["SetKeyword", fields21],
  ["SingleLineCommentTrivia", fields21],
  ["SlashEqualsToken", fields21],
  ["SlashToken", fields21],
  ["StaticKeyword", fields21],
  ["SwitchKeyword", fields21],
  ["ThrowKeyword", fields21],
  ["TildeToken", fields21],
  ["TryKeyword", fields21],
  ["TypeKeyword", fields21],
  ["TypeOfKeyword", fields21],
  ["UniqueKeyword", fields21],
  ["Unknown", fields21],
  ["UsingKeyword", fields21],
  ["VarKeyword", fields21],
  ["WhileKeyword", fields21],
  ["WhitespaceTrivia", fields21],
  ["WithKeyword", fields21],
  ["YieldKeyword", fields21],
  ["TryStatement", fields100],
  ["TupleType", fields101],
  ["JSTypeAliasDeclaration", fields102],
  ["TypeAliasDeclaration", fields102],
  ["TypeAssertionExpression", fields103],
  ["TypeLiteral", fields104],
  ["TypeOfExpression", fields4],
  ["TypeOperator", fields105],
  ["TypeParameter", fields106],
  ["TypePredicate", fields107],
  ["TypeQuery", fields108],
  ["TypeReference", fields109],
  ["UnionType", fields49],
  ["VariableDeclaration", fields110],
  ["VariableDeclarationList", fields111],
  ["VariableStatement", fields17],
  ["VoidExpression", fields4],
  ["WhileStatement", fields24],
  ["WithStatement", fields112],
  ["YieldExpression", fields113],
]);
