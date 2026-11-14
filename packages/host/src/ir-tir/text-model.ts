import type { TirLayouts, TirTypedRecordWork, TirWireNode } from "./text-layouts.js";
import { createTirTextKernel, finishTirLayouts, lazyRecord } from "./text-layouts.js";
import { createBodyText } from "./text-body.js";
import { createPhaseValuesText } from "./text-phase-values.js";
import { createPhaseDeclarationsText } from "./text-phase-declarations.js";
import { createTypeValuesText } from "./text-type-values.js";
import { createRuleDecisionsText } from "./text-rule-decisions.js";
import { createRuleInputsText } from "./text-rule-inputs.js";
import { createCapturesText } from "./text-captures.js";
import { createMemoryText } from "./text-memory.js";
import { createSyntaxValuesText } from "./text-syntax-values.js";
import { createSyntaxStatementsText } from "./text-syntax-statements.js";
import { createSyntaxTypesText } from "./text-syntax-types.js";
import { createSyntaxJsxText } from "./text-syntax-jsx.js";
import { createSyntaxDocsText } from "./text-syntax-docs.js";

export const createTirLayouts = (): TirLayouts => {
  const kernel = createTirTextKernel();
  const body = createBodyText(kernel, {
    work_ApplicationDecision: lazyRecord(() => rule_decisions.work_ApplicationDecision),
    work_BodyCaptureRow: lazyRecord(() => rule_decisions.work_BodyCaptureRow),
    work_ArtifactBindings: lazyRecord(() => type_values.work_ArtifactBindings),
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_BodyInstance: lazyRecord(() => type_values.work_BodyInstance),
    work_CheckJsDirective: lazyRecord(() => type_values.work_CheckJsDirective),
    work_CommentDirective: lazyRecord(() => type_values.work_CommentDirective),
    work_DeferredDecision: lazyRecord(() => rule_inputs.work_DeferredDecision),
    work_EmbeddingDecision: lazyRecord(() => rule_decisions.work_EmbeddingDecision),
    work_HirLexicalScope: lazyRecord(() => type_values.work_HirLexicalScope),
    work_ImportTarget: lazyRecord(() => type_values.work_ImportTarget),
    work_L_ParameterDeclaration_: lazyRecord(() => syntax_statements.work_L_ParameterDeclaration_),
    work_L_Statement_: lazyRecord(() => syntax_statements.work_L_Statement_),
    work_L_TypeParameterDeclaration_: lazyRecord(() => syntax_types.work_L_TypeParameterDeclaration_),
    work_LocalRef: lazyRecord(() => type_values.work_LocalRef),
    work_MemberDecision: lazyRecord(() => rule_decisions.work_MemberDecision),
    work_ModifierList: lazyRecord(() => type_values.work_ModifierList),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_Pragma: lazyRecord(() => type_values.work_Pragma),
    work_RefinementDecision: lazyRecord(() => rule_decisions.work_RefinementDecision),
    work_SourceNodeRef: lazyRecord(() => type_values.work_SourceNodeRef),
    work_TextRange: lazyRecord(() => type_values.work_TextRange),
    work_TypeEvidence: lazyRecord(() => type_values.work_TypeEvidence),
    work_TypedCallable: lazyRecord(() => phase_declarations.work_TypedCallable),
    work_TypedClosure: lazyRecord(() => phase_declarations.work_TypedClosure),
    work_TypedOperation: lazyRecord(() => phase_values.work_TypedOperation),
    work_TypedOperation_conversion: lazyRecord(() => phase_values.work_TypedOperation_conversion),
    work_TypedOperation_backed: lazyRecord(() => phase_values.work_TypedOperation_backed),
    work_TypedSourceFile: lazyRecord(() => phase_declarations.work_TypedSourceFile),
    work_TypedStaticBlock: lazyRecord(() => phase_declarations.work_TypedStaticBlock)
  });
  const phase_values = createPhaseValuesText(kernel, {
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_ConstructionPartDecision: lazyRecord(() => rule_decisions.work_ConstructionPartDecision),
    work_ConversionDecision: lazyRecord(() => body.work_ConversionDecision),
    work_DeclarationTarget: lazyRecord(() => type_values.work_DeclarationTarget),
    work_ExactRational: lazyRecord(() => type_values.work_ExactRational),
    work_ImportTarget: lazyRecord(() => type_values.work_ImportTarget),
    work_MemberKey: lazyRecord(() => type_values.work_MemberKey),
    work_NodeRef: lazyRecord(() => type_values.work_NodeRef),
    work_SourceNodeRef: lazyRecord(() => type_values.work_SourceNodeRef),
    work_O_ApplicationDecision_: lazyRecord(() => body.work_O_ApplicationDecision_),
    work_O_MemberSelection_: lazyRecord(() => body.work_O_MemberSelection_),
    work_O_TirApplication_: lazyRecord(() => body.work_O_TirApplication_),
    work_O_TirProtocol_: lazyRecord(() => body.work_O_TirProtocol_),
    work_O_TypedOperation_: lazyRecord(() => body.work_O_TypedOperation_),
    work_OperationDecision: lazyRecord(() => rule_decisions.work_OperationDecision),
    work_OperationDecision_conversion: lazyRecord(() => rule_decisions.work_OperationDecision_conversion),
    work_OperationDecision_backed: lazyRecord(() => rule_decisions.work_OperationDecision_backed),
    work_RefinementDecision: lazyRecord(() => rule_decisions.work_RefinementDecision),
    work_TargetAccess: lazyRecord(() => body.work_TargetAccess),
    work_TirDemand: lazyRecord(() => body.work_TirDemand),
    work_TirResolution: lazyRecord(() => body.work_TirResolution),
    work_TirSelection: lazyRecord(() => body.work_TirSelection)
  });
  const phase_declarations = createPhaseDeclarationsText(kernel, {
    work_ClosureDecision: lazyRecord(() => rule_decisions.work_ClosureDecision),
    work_DeferredDecision: lazyRecord(() => rule_inputs.work_DeferredDecision),
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_ConversionDecision: lazyRecord(() => body.work_ConversionDecision),
    work_DeclarationTarget: lazyRecord(() => type_values.work_DeclarationTarget),
    work_HirAttribute: lazyRecord(() => type_values.work_HirAttribute),
    work_HirCallableEndpoint: lazyRecord(() => type_values.work_HirCallableEndpoint),
    work_ImportTarget: lazyRecord(() => type_values.work_ImportTarget),
    work_L_ClassElement_: lazyRecord(() => syntax_statements.work_L_ClassElement_),
    work_L_EnumMember_: lazyRecord(() => syntax_values.work_L_EnumMember_),
    work_L_ExpressionWithTypeArguments_: lazyRecord(() => syntax_types.work_L_ExpressionWithTypeArguments_),
    work_L_HeritageClause_: lazyRecord(() => syntax_statements.work_L_HeritageClause_),
    work_L_TypeElement_: lazyRecord(() => syntax_types.work_L_TypeElement_),
    work_L_TypeParameterDeclaration_: lazyRecord(() => syntax_types.work_L_TypeParameterDeclaration_),
    work_LocalRef: lazyRecord(() => type_values.work_LocalRef),
    work_ModifierList: lazyRecord(() => type_values.work_ModifierList),
    work_SourceNodeRef: lazyRecord(() => type_values.work_SourceNodeRef),
    work_O_TirProtocol_: lazyRecord(() => body.work_O_TirProtocol_),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_RefinementDecision: lazyRecord(() => rule_decisions.work_RefinementDecision),
    work_TextRange: lazyRecord(() => type_values.work_TextRange),
    work_TirDemand: lazyRecord(() => body.work_TirDemand),
    work_TypeParameter: lazyRecord(() => type_values.work_TypeParameter)
  });
  const type_values = createTypeValuesText(kernel);
  const rule_decisions = createRuleDecisionsText(kernel, {
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_LocalRef: lazyRecord(() => type_values.work_LocalRef),
    work_CorrespondenceStep: lazyRecord(() => rule_inputs.work_CorrespondenceStep),
    work_HirCallableEndpoint: lazyRecord(() => type_values.work_HirCallableEndpoint),
    work_MemberKey: lazyRecord(() => type_values.work_MemberKey),
    work_MemberOrigin: lazyRecord(() => type_values.work_MemberOrigin),
    work_NodeRef: lazyRecord(() => type_values.work_NodeRef),
    work_OperationIdentity: lazyRecord(() => rule_inputs.work_OperationIdentity),
    work_OperationIdentity_conversion: lazyRecord(() => rule_inputs.work_OperationIdentity_conversion),
    work_OperationIdentity_library: lazyRecord(() => rule_inputs.work_OperationIdentity_library),
    work_OperationIdentity_core: lazyRecord(() => rule_inputs.work_OperationIdentity_core),
    work_TypeComponent: lazyRecord(() => type_values.work_TypeComponent),
    work_TypeEvidence: lazyRecord(() => type_values.work_TypeEvidence)
  });
  const rule_inputs = createRuleInputsText(kernel, {
    work_LocalRef: lazyRecord(() => type_values.work_LocalRef),
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_ConstructionPartDecision: lazyRecord(() => rule_decisions.work_ConstructionPartDecision),
    work_Diagnostic: lazyRecord(() => type_values.work_Diagnostic),
    work_EmbeddingDecision: lazyRecord(() => rule_decisions.work_EmbeddingDecision),
    work_HirCallableEndpoint: lazyRecord(() => type_values.work_HirCallableEndpoint),
    work_HirCoreCapture: lazyRecord(() => captures.work_HirCoreCapture),
    work_LiteralConstructionPart: lazyRecord(() => rule_decisions.work_LiteralConstructionPart),
    work_LiteralValue: lazyRecord(() => type_values.work_LiteralValue),
    work_MemberKey: lazyRecord(() => type_values.work_MemberKey),
    work_MemberOrigin: lazyRecord(() => type_values.work_MemberOrigin),
    work_NodeRef: lazyRecord(() => type_values.work_NodeRef),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_ProtocolStepDecision: lazyRecord(() => rule_decisions.work_ProtocolStepDecision),
    work_TypeComponent: lazyRecord(() => type_values.work_TypeComponent),
    work_TypeEvidence: lazyRecord(() => type_values.work_TypeEvidence)
  });
  const captures = createCapturesText(kernel, {
    work_BindingVector: lazyRecord(() => type_values.work_BindingVector),
    work_NodeRef: lazyRecord(() => type_values.work_NodeRef),
    work_C__HirPointerOperationCapture_: lazyRecord(() => memory.work_C__HirPointerOperationCapture_),
    work_C__HirPointerTypeCapture_: lazyRecord(() => memory.work_C__HirPointerTypeCapture_),
    work_SourceNodeRef: lazyRecord(() => type_values.work_SourceNodeRef),
    work_TypeComponent: lazyRecord(() => type_values.work_TypeComponent)
  });
  const memory = createMemoryText(kernel, {
    work_HirCapturedType: lazyRecord(() => captures.work_HirCapturedType),
    work_SourceNodeRef: lazyRecord(() => type_values.work_SourceNodeRef)
  });
  const syntax_values = createSyntaxValuesText(kernel, {
    work_L_TypeNode_: lazyRecord(() => syntax_types.work_L_TypeNode_),
    work_ModifierList: lazyRecord(() => type_values.work_ModifierList),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_TextRange: lazyRecord(() => type_values.work_TextRange),
    work_TypedApplication: lazyRecord(() => phase_values.work_TypedApplication),
    work_TypedBigInt: lazyRecord(() => phase_values.work_TypedBigInt),
    work_TypedBinary: lazyRecord(() => phase_values.work_TypedBinary),
    work_TypedConditional: lazyRecord(() => phase_values.work_TypedConditional),
    work_TypedConstruction: lazyRecord(() => phase_values.work_TypedConstruction),
    work_TypedDecorator: lazyRecord(() => phase_values.work_TypedDecorator),
    work_TypedInstantiation: lazyRecord(() => phase_values.work_TypedInstantiation),
    work_TypedKeyword: lazyRecord(() => phase_values.work_TypedKeyword),
    work_TypedMember: lazyRecord(() => phase_values.work_TypedMember),
    work_TypedModuleReference: lazyRecord(() => phase_declarations.work_TypedModuleReference),
    work_TypedName: lazyRecord(() => phase_values.work_TypedName),
    work_TypedNumber: lazyRecord(() => phase_values.work_TypedNumber),
    work_TypedObjectSpread: lazyRecord(() => phase_values.work_TypedObjectSpread),
    work_TypedOmission: lazyRecord(() => phase_values.work_TypedOmission),
    work_TypedPrefix: lazyRecord(() => phase_values.work_TypedPrefix),
    work_TypedProperty: lazyRecord(() => phase_values.work_TypedProperty),
    work_TypedPropertyKey: lazyRecord(() => phase_values.work_TypedPropertyKey),
    work_TypedProtocolValue: lazyRecord(() => phase_values.work_TypedProtocolValue),
    work_TypedShorthand: lazyRecord(() => phase_values.work_TypedShorthand),
    work_TypedSpread: lazyRecord(() => phase_values.work_TypedSpread),
    work_TypedString: lazyRecord(() => phase_values.work_TypedString),
    work_TypedTemplate: lazyRecord(() => phase_values.work_TypedTemplate),
    work_TypedType: lazyRecord(() => phase_declarations.work_TypedType),
    work_TypedUnary: lazyRecord(() => phase_values.work_TypedUnary),
    work_TypedUpdate: lazyRecord(() => phase_values.work_TypedUpdate),
    work_TypedValue: lazyRecord(() => phase_values.work_TypedValue)
  });
  const syntax_statements = createSyntaxStatementsText(kernel, {
    work_L_ExportSpecifier_: lazyRecord(() => syntax_values.work_L_ExportSpecifier_),
    work_L_ImportAttribute_: lazyRecord(() => syntax_values.work_L_ImportAttribute_),
    work_L_ImportSpecifier_: lazyRecord(() => syntax_values.work_L_ImportSpecifier_),
    work_ModifierList: lazyRecord(() => type_values.work_ModifierList),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_TextRange: lazyRecord(() => type_values.work_TextRange),
    work_TypedBinding: lazyRecord(() => phase_declarations.work_TypedBinding),
    work_TypedBindingElement: lazyRecord(() => phase_declarations.work_TypedBindingElement),
    work_TypedBindingPattern: lazyRecord(() => phase_declarations.work_TypedBindingPattern),
    work_TypedControlTransfer: lazyRecord(() => phase_values.work_TypedControlTransfer),
    work_TypedExport: lazyRecord(() => phase_declarations.work_TypedExport),
    work_TypedExportAssignment: lazyRecord(() => phase_declarations.work_TypedExportAssignment),
    work_TypedExportBinding: lazyRecord(() => phase_declarations.work_TypedExportBinding),
    work_TypedNamespaceExport: lazyRecord(() => phase_declarations.work_TypedNamespaceExport),
    work_TypedImport: lazyRecord(() => phase_declarations.work_TypedImport),
    work_TypedImportBinding: lazyRecord(() => phase_declarations.work_TypedImportBinding),
    work_TypedIteration: lazyRecord(() => phase_values.work_TypedIteration),
    work_TypedNamespace: lazyRecord(() => phase_declarations.work_TypedNamespace),
    work_TypedParameter: lazyRecord(() => phase_declarations.work_TypedParameter),
    work_TypedStorageDeclaration: lazyRecord(() => phase_declarations.work_TypedStorageDeclaration),
    work_TypedVariableList: lazyRecord(() => phase_declarations.work_TypedVariableList)
  });
  const syntax_types = createSyntaxTypesText(kernel, {
    work_L_ParameterDeclaration_: lazyRecord(() => syntax_statements.work_L_ParameterDeclaration_),
    work_ModifierList: lazyRecord(() => type_values.work_ModifierList),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_TextRange: lazyRecord(() => type_values.work_TextRange),
    work_TypedCallable: lazyRecord(() => phase_declarations.work_TypedCallable),
    work_TypedIndexDeclaration: lazyRecord(() => phase_declarations.work_TypedIndexDeclaration),
    work_TypedPredicate: lazyRecord(() => phase_declarations.work_TypedPredicate),
    work_TypedStorageDeclaration: lazyRecord(() => phase_declarations.work_TypedStorageDeclaration),
    work_TypedType: lazyRecord(() => phase_declarations.work_TypedType),
    work_TypedTypeParameter: lazyRecord(() => phase_declarations.work_TypedTypeParameter),
    work_TypedValue: lazyRecord(() => phase_values.work_TypedValue)
  });
  const syntax_jsx = createSyntaxJsxText(kernel, {
    work_L_TypeNode_: lazyRecord(() => syntax_types.work_L_TypeNode_),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_TextRange: lazyRecord(() => type_values.work_TextRange)
  });
  const syntax_docs = createSyntaxDocsText(kernel, {
    work_L_ParameterDeclaration_: lazyRecord(() => syntax_statements.work_L_ParameterDeclaration_),
    work_L_TypeParameterDeclaration_: lazyRecord(() => syntax_types.work_L_TypeParameterDeclaration_),
    work_Origin: lazyRecord(() => type_values.work_Origin),
    work_TextRange: lazyRecord(() => type_values.work_TextRange)
  });
  const nodeWork = (value: TirWireNode): TirTypedRecordWork => {
    switch (value.kind) {
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
      case "DeferKeyword": return syntax_values.work_Token(value);
      case "Identifier": return syntax_values.work_Identifier(value);
      case "SyntaxList": return syntax_values.work_SyntaxList(value);
      case "JSDoc": return syntax_docs.work_JSDoc(value);
      case "PrivateIdentifier": return syntax_values.work_PrivateIdentifier(value);
      case "QualifiedName": return syntax_values.work_QualifiedName(value);
      case "ComputedPropertyName": return syntax_values.work_ComputedPropertyName(value);
      case "Decorator": return syntax_values.work_Decorator(value);
      case "EmptyStatement": return syntax_statements.work_EmptyStatement(value);
      case "IfStatement": return syntax_statements.work_IfStatement(value);
      case "DoStatement": return syntax_statements.work_DoStatement(value);
      case "WhileStatement": return syntax_statements.work_WhileStatement(value);
      case "ForStatement": return syntax_statements.work_ForStatement(value);
      case "ForInStatement": return syntax_statements.work_ForInStatement(value);
      case "ForOfStatement": return syntax_statements.work_ForOfStatement(value);
      case "BreakStatement": return syntax_statements.work_BreakStatement(value);
      case "ContinueStatement": return syntax_statements.work_ContinueStatement(value);
      case "ReturnStatement": return syntax_statements.work_ReturnStatement(value);
      case "WithStatement": return syntax_statements.work_WithStatement(value);
      case "SwitchStatement": return syntax_statements.work_SwitchStatement(value);
      case "CaseBlock": return syntax_statements.work_CaseBlock(value);
      case "CaseClause": return syntax_statements.work_CaseClause(value);
      case "DefaultClause": return syntax_statements.work_DefaultClause(value);
      case "ThrowStatement": return syntax_statements.work_ThrowStatement(value);
      case "TryStatement": return syntax_statements.work_TryStatement(value);
      case "CatchClause": return syntax_statements.work_CatchClause(value);
      case "DebuggerStatement": return syntax_statements.work_DebuggerStatement(value);
      case "LabeledStatement": return syntax_statements.work_LabeledStatement(value);
      case "ExpressionStatement": return syntax_statements.work_ExpressionStatement(value);
      case "Block": return body.work_Block(value);
      case "VariableStatement": return syntax_statements.work_VariableStatement(value);
      case "VariableDeclaration": return syntax_statements.work_VariableDeclaration(value);
      case "VariableDeclarationList": return syntax_statements.work_VariableDeclarationList(value);
      case "ObjectBindingPattern":
      case "ArrayBindingPattern": return syntax_statements.work_BindingPattern(value);
      case "Parameter": return syntax_statements.work_ParameterDeclaration(value);
      case "BindingElement": return syntax_statements.work_BindingElement(value);
      case "MissingDeclaration": return syntax_statements.work_MissingDeclaration(value);
      case "FunctionDeclaration": return body.work_FunctionDeclaration(value);
      case "ClassDeclaration": return phase_declarations.work_ClassDeclaration(value);
      case "ClassExpression": return phase_declarations.work_ClassExpression(value);
      case "HeritageClause": return phase_declarations.work_HeritageClause(value);
      case "InterfaceDeclaration": return phase_declarations.work_InterfaceDeclaration(value);
      case "TypeAliasDeclaration":
      case "JSTypeAliasDeclaration": return phase_declarations.work_TypeAliasDeclaration(value);
      case "EnumMember": return phase_declarations.work_EnumMember(value);
      case "EnumDeclaration": return phase_declarations.work_EnumDeclaration(value);
      case "ModuleBlock": return syntax_statements.work_ModuleBlock(value);
      case "NotEmittedStatement": return syntax_statements.work_NotEmittedStatement(value);
      case "NotEmittedTypeElement": return syntax_values.work_NotEmittedTypeElement(value);
      case "ImportDeclaration":
      case "JSImportDeclaration": return syntax_statements.work_ImportDeclaration(value);
      case "ExternalModuleReference": return syntax_values.work_ExternalModuleReference(value);
      case "NamespaceImport": return syntax_statements.work_NamespaceImport(value);
      case "NamedImports": return syntax_statements.work_NamedImports(value);
      case "ExportAssignment": return syntax_statements.work_ExportAssignment(value);
      case "NamespaceExportDeclaration": return syntax_statements.work_NamespaceExportDeclaration(value);
      case "NamespaceExport": return syntax_statements.work_NamespaceExport(value);
      case "NamedExports": return syntax_statements.work_NamedExports(value);
      case "ExportSpecifier": return syntax_statements.work_ExportSpecifier(value);
      case "CallSignature": return syntax_types.work_CallSignatureDeclaration(value);
      case "ConstructSignature": return syntax_types.work_ConstructSignatureDeclaration(value);
      case "Constructor": return body.work_ConstructorDeclaration(value);
      case "GetAccessor": return body.work_GetAccessorDeclaration(value);
      case "SetAccessor": return body.work_SetAccessorDeclaration(value);
      case "IndexSignature": return syntax_types.work_IndexSignatureDeclaration(value);
      case "MethodSignature": return syntax_types.work_MethodSignatureDeclaration(value);
      case "MethodDeclaration": return body.work_MethodDeclaration(value);
      case "PropertySignature": return syntax_types.work_PropertySignatureDeclaration(value);
      case "PropertyDeclaration": return syntax_statements.work_PropertyDeclaration(value);
      case "SemicolonClassElement": return syntax_statements.work_SemicolonClassElement(value);
      case "ClassStaticBlockDeclaration": return body.work_ClassStaticBlockDeclaration(value);
      case "OmittedExpression": return syntax_values.work_OmittedExpression(value);
      case "NullKeyword":
      case "TrueKeyword":
      case "FalseKeyword":
      case "ThisKeyword":
      case "SuperKeyword":
      case "ImportKeyword": return syntax_values.work_KeywordExpression(value);
      case "StringLiteral": return syntax_values.work_StringLiteral(value);
      case "NumericLiteral": return syntax_values.work_NumericLiteral(value);
      case "BigIntLiteral": return syntax_values.work_BigIntLiteral(value);
      case "RegularExpressionLiteral": return syntax_values.work_RegularExpressionLiteral(value);
      case "NoSubstitutionTemplateLiteral": return syntax_values.work_NoSubstitutionTemplateLiteral(value);
      case "BinaryExpression": return syntax_values.work_BinaryExpression(value);
      case "PrefixUnaryExpression": return syntax_values.work_PrefixUnaryExpression(value);
      case "PostfixUnaryExpression": return syntax_values.work_PostfixUnaryExpression(value);
      case "YieldExpression": return syntax_values.work_YieldExpression(value);
      case "ArrowFunction": return body.work_ArrowFunction(value);
      case "FunctionExpression": return body.work_FunctionExpression(value);
      case "AsExpression": return syntax_values.work_AsExpression(value);
      case "SatisfiesExpression": return syntax_values.work_SatisfiesExpression(value);
      case "ConditionalExpression": return syntax_values.work_ConditionalExpression(value);
      case "PropertyAccessExpression": return syntax_values.work_PropertyAccessExpression(value);
      case "ElementAccessExpression": return syntax_values.work_ElementAccessExpression(value);
      case "CallExpression": return syntax_values.work_CallExpression(value);
      case "NewExpression": return syntax_values.work_NewExpression(value);
      case "MetaProperty": return syntax_values.work_MetaProperty(value);
      case "NonNullExpression": return syntax_values.work_NonNullExpression(value);
      case "SpreadElement": return syntax_values.work_SpreadElement(value);
      case "TemplateExpression": return syntax_values.work_TemplateExpression(value);
      case "TemplateSpan": return syntax_values.work_TemplateSpan(value);
      case "TaggedTemplateExpression": return syntax_values.work_TaggedTemplateExpression(value);
      case "ParenthesizedExpression": return syntax_values.work_ParenthesizedExpression(value);
      case "ArrayLiteralExpression": return syntax_values.work_ArrayLiteralExpression(value);
      case "ObjectLiteralExpression": return syntax_values.work_ObjectLiteralExpression(value);
      case "SpreadAssignment": return syntax_values.work_SpreadAssignment(value);
      case "PropertyAssignment": return syntax_values.work_PropertyAssignment(value);
      case "ShorthandPropertyAssignment": return syntax_values.work_ShorthandPropertyAssignment(value);
      case "DeleteExpression": return syntax_values.work_DeleteExpression(value);
      case "TypeOfExpression": return syntax_values.work_TypeOfExpression(value);
      case "VoidExpression": return syntax_values.work_VoidExpression(value);
      case "AwaitExpression": return syntax_values.work_AwaitExpression(value);
      case "TypeAssertionExpression": return syntax_types.work_TypeAssertion(value);
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
      case "VoidKeyword": return syntax_types.work_KeywordTypeNode(value);
      case "UnionType": return syntax_types.work_UnionTypeNode(value);
      case "IntersectionType": return syntax_types.work_IntersectionTypeNode(value);
      case "ConditionalType": return syntax_types.work_ConditionalTypeNode(value);
      case "TypeOperator": return syntax_types.work_TypeOperatorNode(value);
      case "InferType": return syntax_types.work_InferTypeNode(value);
      case "ArrayType": return syntax_types.work_ArrayTypeNode(value);
      case "IndexedAccessType": return syntax_types.work_IndexedAccessTypeNode(value);
      case "TypeReference": return syntax_types.work_TypeReferenceNode(value);
      case "ExpressionWithTypeArguments": return syntax_values.work_ExpressionWithTypeArguments(value);
      case "LiteralType": return syntax_types.work_LiteralTypeNode(value);
      case "ThisType": return syntax_types.work_ThisTypeNode(value);
      case "TypePredicate": return syntax_types.work_TypePredicateNode(value);
      case "ImportAttribute": return syntax_statements.work_ImportAttribute(value);
      case "ImportAttributes": return syntax_statements.work_ImportAttributes(value);
      case "TypeQuery": return syntax_types.work_TypeQueryNode(value);
      case "MappedType": return syntax_types.work_MappedTypeNode(value);
      case "TypeLiteral": return syntax_types.work_TypeLiteralNode(value);
      case "TupleType": return syntax_types.work_TupleTypeNode(value);
      case "NamedTupleMember": return syntax_types.work_NamedTupleMember(value);
      case "OptionalType": return syntax_types.work_OptionalTypeNode(value);
      case "RestType": return syntax_types.work_RestTypeNode(value);
      case "ParenthesizedType": return syntax_types.work_ParenthesizedTypeNode(value);
      case "FunctionType": return syntax_types.work_FunctionTypeNode(value);
      case "ConstructorType": return syntax_types.work_ConstructorTypeNode(value);
      case "TemplateHead": return syntax_values.work_TemplateHead(value);
      case "TemplateMiddle": return syntax_values.work_TemplateMiddle(value);
      case "TemplateTail": return syntax_values.work_TemplateTail(value);
      case "TemplateLiteralType": return syntax_types.work_TemplateLiteralTypeNode(value);
      case "TemplateLiteralTypeSpan": return syntax_values.work_TemplateLiteralTypeSpan(value);
      case "PartiallyEmittedExpression": return syntax_values.work_PartiallyEmittedExpression(value);
      case "JsxElement": return syntax_jsx.work_JsxElement(value);
      case "JsxAttributes": return syntax_jsx.work_JsxAttributes(value);
      case "JsxNamespacedName": return syntax_jsx.work_JsxNamespacedName(value);
      case "JsxOpeningElement": return syntax_jsx.work_JsxOpeningElement(value);
      case "JsxSelfClosingElement": return syntax_jsx.work_JsxSelfClosingElement(value);
      case "JsxFragment": return syntax_jsx.work_JsxFragment(value);
      case "JsxOpeningFragment": return syntax_jsx.work_JsxOpeningFragment(value);
      case "JsxClosingFragment": return syntax_jsx.work_JsxClosingFragment(value);
      case "JsxAttribute": return syntax_jsx.work_JsxAttribute(value);
      case "JsxSpreadAttribute": return syntax_jsx.work_JsxSpreadAttribute(value);
      case "JsxClosingElement": return syntax_jsx.work_JsxClosingElement(value);
      case "JsxExpression": return syntax_jsx.work_JsxExpression(value);
      case "JsxText": return syntax_jsx.work_JsxText(value);
      case "JSDocTypeExpression": return syntax_docs.work_JSDocTypeExpression(value);
      case "JSDocNonNullableType": return syntax_docs.work_JSDocNonNullableType(value);
      case "JSDocNullableType": return syntax_docs.work_JSDocNullableType(value);
      case "JSDocAllType": return syntax_docs.work_JSDocAllType(value);
      case "JSDocVariadicType": return syntax_docs.work_JSDocVariadicType(value);
      case "JSDocOptionalType": return syntax_docs.work_JSDocOptionalType(value);
      case "JSDocTypeTag": return syntax_docs.work_JSDocTypeTag(value);
      case "JSDocUnknownTag": return syntax_docs.work_JSDocUnknownTag(value);
      case "JSDocTemplateTag": return syntax_docs.work_JSDocTemplateTag(value);
      case "JSDocReturnTag": return syntax_docs.work_JSDocReturnTag(value);
      case "JSDocPublicTag": return syntax_docs.work_JSDocPublicTag(value);
      case "JSDocPrivateTag": return syntax_docs.work_JSDocPrivateTag(value);
      case "JSDocProtectedTag": return syntax_docs.work_JSDocProtectedTag(value);
      case "JSDocReadonlyTag": return syntax_docs.work_JSDocReadonlyTag(value);
      case "JSDocOverrideTag": return syntax_docs.work_JSDocOverrideTag(value);
      case "JSDocDeprecatedTag": return syntax_docs.work_JSDocDeprecatedTag(value);
      case "JSDocSeeTag": return syntax_docs.work_JSDocSeeTag(value);
      case "JSDocImplementsTag": return syntax_docs.work_JSDocImplementsTag(value);
      case "JSDocAugmentsTag": return syntax_docs.work_JSDocAugmentsTag(value);
      case "JSDocSatisfiesTag": return syntax_docs.work_JSDocSatisfiesTag(value);
      case "JSDocThrowsTag": return syntax_docs.work_JSDocThrowsTag(value);
      case "JSDocThisTag": return syntax_docs.work_JSDocThisTag(value);
      case "JSDocImportTag": return syntax_docs.work_JSDocImportTag(value);
      case "JSDocCallbackTag": return syntax_docs.work_JSDocCallbackTag(value);
      case "JSDocOverloadTag": return syntax_docs.work_JSDocOverloadTag(value);
      case "JSDocTypedefTag": return syntax_docs.work_JSDocTypedefTag(value);
      case "JSDocSignature": return syntax_docs.work_JSDocSignature(value);
      case "JSDocNameReference": return syntax_docs.work_JSDocNameReference(value);
      case "SourceFile": return body.work_SourceFile(value);
      case "ModuleDeclaration": return syntax_statements.work_ModuleDeclaration(value);
      case "ImportEqualsDeclaration": return syntax_statements.work_ImportEqualsDeclaration(value);
      case "ExportDeclaration": return syntax_statements.work_ExportDeclaration(value);
      case "ImportType": return syntax_types.work_ImportTypeNode(value);
      case "ImportClause": return syntax_statements.work_ImportClause(value);
      case "ImportSpecifier": return syntax_statements.work_ImportSpecifier(value);
      case "JSDocText": return syntax_docs.work_JSDocText(value);
      case "JSDocLink": return syntax_docs.work_JSDocLink(value);
      case "JSDocLinkPlain": return syntax_docs.work_JSDocLinkPlain(value);
      case "JSDocLinkCode": return syntax_docs.work_JSDocLinkCode(value);
      case "TypeParameter": return syntax_types.work_TypeParameterDeclaration(value);
      case "SyntheticReferenceExpression": return syntax_values.work_SyntheticReferenceExpression(value);
      case "JSDocTypeLiteral": return syntax_docs.work_JSDocTypeLiteral(value);
      case "JSDocParameterTag":
      case "JSDocPropertyTag": return syntax_docs.work_JSDocParameterOrPropertyTag(value);
    }
  };
  return finishTirLayouts(kernel, body.work_TirBody, nodeWork);
};
