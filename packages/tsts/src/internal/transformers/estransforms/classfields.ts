import type { bool, int } from "@tsonic/core/types.js";
import type { GoMap, GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeFactoryCoercible, NodeList, NodeVisitor } from "../../ast/spine.js";
import { ModifierList_Clone, Node_Clone, NodeFactory_NewNodeList, NodeFactory_NewModifierList } from "../../ast/spine.js";
import { AsSourceFile, Node_Body, Node_MemberList, Node_Members, Node_Expression, Node_Initializer, Node_ParameterList, Node_Text } from "../../ast/ast.js";
import { Node_End, Node_ForEachChild, Node_KindString, Node_Modifiers, Node_Name, Node_SubtreeFacts } from "../../ast/spine.js";
import { NodeFactory_UpdateComputedPropertyName, NodeFactory_UpdateBlock, NodeFactory_UpdateForStatement, NodeFactory_UpdateExpressionStatement, NodeFactory_UpdateClassDeclaration, NodeFactory_UpdateClassExpression, NodeFactory_UpdateConstructorDeclaration, NodeFactory_UpdatePropertyDeclaration, NodeFactory_UpdateBinaryExpression, NodeFactory_UpdatePrefixUnaryExpression, NodeFactory_UpdatePostfixUnaryExpression, NodeFactory_UpdatePropertyAccessExpression, NodeFactory_UpdateCallExpression, NodeFactory_UpdateTaggedTemplateExpression, NodeFactory_UpdateParenthesizedExpression, NodeFactory_UpdateExpressionWithTypeArguments, NodeFactory_UpdateSpreadElement, NodeFactory_UpdateSpreadAssignment, NodeFactory_UpdateArrayLiteralExpression, NodeFactory_UpdateObjectLiteralExpression, NodeFactory_UpdatePropertyAssignment, NodeFactory_UpdateElementAccessExpression, NodeFactory_UpdateTryStatement } from "../../ast/ast.js";
import type { BinaryExpression, BindingElement, CallExpression, ClassDeclaration, ClassExpression, ComputedPropertyName, ConstructorDeclaration, ElementAccessExpression, ExportAssignment, ExpressionStatement, ExpressionWithTypeArguments, ForStatement, Identifier, ParameterDeclaration, ParenthesizedExpression, PropertyAccessExpression, PropertyAssignment, PropertyDeclaration, TaggedTemplateExpression, VariableDeclaration, VariableStatement } from "../../ast/generated/data.js";
import { BinaryExpression_as_nodeData, BindingElement_as_nodeData, ExportAssignment_as_nodeData, ParameterDeclaration_as_nodeData, PropertyAssignment_as_nodeData, VariableDeclaration_as_nodeData, VariableStatement_as_nodeData } from "../../ast/generated/data.js";
import type { ClassElement, ClassLikeDeclaration, Expression, IdentifierNode, PropertyName, SourceFileNode, Statement } from "../../ast/generated/unions.js";
import type { Kind } from "../../ast/generated/kinds.js";
import { KindAccessorKeyword, KindArrayLiteralExpression, KindBigIntLiteral, KindBindingElement, KindBinaryExpression, KindCallExpression, KindClassDeclaration, KindClassExpression, KindClassStaticBlockDeclaration, KindCommaToken, KindComputedPropertyName, KindConstructor, KindDoStatement, KindElementAccessExpression, KindEqualsGreaterThanToken, KindExportAssignment, KindExpressionStatement, KindExpressionWithTypeArguments, KindForInStatement, KindForOfStatement, KindForStatement, KindFunctionDeclaration, KindFunctionExpression, KindGetAccessor, KindHeritageClause, KindIdentifier, KindInKeyword, KindMethodDeclaration, KindNullKeyword, KindNumericLiteral, KindObjectLiteralExpression, KindOmittedExpression, KindParameter, KindParenthesizedExpression, KindPostfixUnaryExpression, KindPrefixUnaryExpression, KindPrivateIdentifier, KindPropertyAccessExpression, KindPropertyAssignment, KindPropertyDeclaration, KindSemicolonClassElement, KindSetAccessor, KindSourceFile, KindStringLiteral, KindSuperKeyword, KindTaggedTemplateExpression, KindThisKeyword, KindVariableDeclaration, KindVariableStatement, KindWhileStatement, KindPlusPlusToken, KindMinusMinusToken, KindEqualsToken } from "../../ast/generated/kinds.js";
import { IsClassExpression, IsClassStaticBlockDeclaration, IsComputedPropertyName, IsConstructorDeclaration, IsGetAccessorDeclaration, IsIdentifier, IsMethodDeclaration, IsNumericLiteral, IsParameterDeclaration, IsParenthesizedExpression, IsPostfixUnaryExpression, IsPrefixUnaryExpression, IsPrivateIdentifier, IsPropertyDeclaration, IsSetAccessorDeclaration, IsShorthandPropertyAssignment, IsSpreadAssignment, IsSpreadElement, IsStringLiteral, IsTryStatement, IsVoidExpression } from "../../ast/generated/predicates.js";
import { IsBinaryExpression, IsObjectLiteralExpression, IsArrayLiteralExpression, IsElementAccessExpression, IsPropertyAccessExpression, IsPropertyAssignment } from "../../ast/generated/predicates.js";
import { IsAssignmentExpression, IsAutoAccessorPropertyDeclaration, IsArrayBindingOrAssignmentElement, IsClassLike, IsCommaExpression, IsCompoundAssignment, IsDestructuringAssignment, IsInitializedProperty, IsLeftHandSideExpression, IsMethodOrAccessor, IsModifier, IsModifierLike, IsObjectBindingOrAssignmentElement, IsParameterPropertyDeclaration, IsPrivateIdentifierClassElementDeclaration, IsPrologueDirective, IsStatement, IsStatic, IsSuperProperty, NodeIsSynthesized, SkipOuterExpressions, SkipParentheses, SkipPartiallyEmittedExpressions, CreateModifiersFromModifierFlags, GetClassExtendsHeritageElement, GetNameOfDeclaration, HasDecorators, HasSyntacticModifier, HasAccessorModifier, HasAbstractModifier, ClassOrConstructorParameterIsDecorated, OEKAll, OEKPartiallyEmittedExpressions, OEKParentheses } from "../../ast/utilities.js";
import { HasStaticModifier } from "../../ast/utilities.js";
import { AsBinaryExpression, AsArrowFunction, AsArrayLiteralExpression, AsBindingElement, AsBlock, AsCallExpression, AsClassDeclaration, AsClassExpression, AsClassStaticBlockDeclaration, AsComputedPropertyName, AsConstructorDeclaration, AsElementAccessExpression, AsExportAssignment, AsExpressionStatement, AsExpressionWithTypeArguments, AsForStatement, AsFunctionExpression, AsIdentifier, AsMethodDeclaration, AsObjectLiteralExpression, AsParameterDeclaration, AsParenthesizedExpression, AsPostfixUnaryExpression, AsPrefixUnaryExpression, AsPropertyAccessExpression, AsPropertyAssignment, AsPropertyDeclaration, AsSpreadAssignment, AsSpreadElement, AsTaggedTemplateExpression, AsTryStatement, AsVariableDeclaration, AsVariableStatement } from "../../ast/generated/casts.js";
import { ModifierFlagsAccessor, ModifierFlagsDefault, ModifierFlagsExport, ModifierFlagsExportDefault, ModifierFlagsStatic } from "../../ast/modifierflags.js";
import { SubtreeContainsClassFields, SubtreeContainsLexicalThisOrSuper, SubtreeContainsLexicalThis, SubtreeContainsLexicalSuper } from "../../ast/subtreefacts.js";
import { NewArrowFunction, NewArrayLiteralExpression, NewBinaryExpression, NewBlock, NewCallExpression, NewClassStaticBlockDeclaration, NewConstructorDeclaration, NewElementAccessExpression, NewExportAssignment, NewExpressionStatement, NewFunctionExpression, NewGetAccessorDeclaration, NewIdentifier, NewKeywordExpression, NewMethodDeclaration, NewNewExpression, NewObjectLiteralExpression, NewParameterDeclaration, NewParenthesizedExpression, NewPostfixUnaryExpression, NewPrefixUnaryExpression, NewPropertyAccessExpression, NewPropertyAssignment, NewPropertyDeclaration, NewReturnStatement, NewSetAccessorDeclaration, NewSpreadElement, NewStringLiteral, NewSyntaxList, NewToken } from "../../ast/generated/factory.js";
import * as debug from "../../debug/debug.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { Set } from "../../collections/set.js";
import { Set_Add, Set_Delete, Set_Has } from "../../collections/set.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import { CompilerOptions_GetEmitScriptTarget, CompilerOptions_GetUseDefineForClassFields, ScriptTargetES2022, ScriptTargetESNext } from "../../core/compileroptions.js";
import type { Declaration } from "../../ast/generated/unions.js";
import { Tristate_IsTrue } from "../../core/tristate.js";
import { LanguageVariantStandard } from "../../core/languagevariant.js";
import type { TextRange } from "../../core/text.js";
import { NewTextRange } from "../../core/text.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import { EmitContext_AddEmitFlags, EmitContext_AddLexicalDeclaration, EmitContext_AddVariableDeclaration, EmitContext_AssignCommentAndSourceMapRanges, EmitContext_AssignSourceMapRange, EmitContext_AssignedName, EmitContext_ClassThis, EmitContext_EmitFlags, EmitContext_EndAndMergeVariableEnvironment, EmitContext_GetNodeForGeneratedName, EmitContext_HasAutoGenerateInfo, EmitContext_IsCallToHelper, EmitContext_MostOriginal, EmitContext_NewNodeVisitor, EmitContext_ReadEmitHelpers, EmitContext_SetCommentRange, EmitContext_SetOriginal, EmitContext_SetOriginalEx, EmitContext_SetSourceMapRange, EmitContext_SetSyntheticLeadingComments, EmitContext_SetSyntheticTrailingComments, EmitContext_SourceMapRange, EmitContext_StartVariableEnvironment, EmitContext_TextSource, EmitContext_VisitFunctionBody, EmitContext_VisitIterationBody, EmitContext_AddEmitHelper, EmitContext_CommentRange } from "../../printer/emitcontext.js";
import type { NodeFactory, PrivateIdentifierKind } from "../../printer/factory.js";
import type { AutoGenerateOptions } from "../../printer/emitcontext.js";
import { NodeFactory_GetLocalName, NodeFactory_InlineExpressions, NodeFactory_NewAssignmentExpression, NodeFactory_NewAssignmentTargetWrapper, NodeFactory_NewClassPrivateFieldGetHelper, NodeFactory_NewClassPrivateFieldInHelper, NodeFactory_NewClassPrivateFieldSetHelper, NodeFactory_NewCommaExpression, NodeFactory_NewFunctionBindCall, NodeFactory_NewFunctionCallCall, NodeFactory_NewGeneratedNameForNode, NodeFactory_NewGeneratedNameForNodeEx, NodeFactory_NewGeneratedPrivateNameForNodeEx, NodeFactory_NewImmediatelyInvokedArrowFunction, NodeFactory_NewMethodCall, NodeFactory_NewObjectDefinePropertyCall, NodeFactory_NewReflectGetCall, NodeFactory_NewReflectSetCall, NodeFactory_NewStringLiteralFromNode, NodeFactory_NewTempVariable, NodeFactory_NewTempVariableEx, NodeFactory_NewThisExpression, NodeFactory_NewTrueExpression, NodeFactory_NewUniqueNameEx, NodeFactory_NewVoidZeroExpression, PrivateIdentifierKindAccessor, PrivateIdentifierKindField, PrivateIdentifierKindMethod, PrivateIdentifierKindUntransformed } from "../../printer/factory.js";
import { EFIndented, EFNoComments, EFNoLexicalArguments, EFNoLeadingComments, EFNoNestedSourceMaps, EFNoSourceMap, EFStartOnNewLine, EFTransformPrivateStaticElements } from "../../printer/emitflags.js";
import { GeneratedIdentifierFlagsOptimistic, GeneratedIdentifierFlagsReservedInNestedScopes } from "../../printer/generatedidentifierflags.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode, NodeVisitor_VisitNodes, NodeVisitor_VisitSlice } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { ExtractModifiers } from "../modifiervisitor.js";
import { FindSuperStatementIndexPath, GetNonAssignmentOperatorForCompoundAssignment, IsGeneratedIdentifier, IsSimpleCopiableExpression, IsSimpleInlineableExpression, MoveRangePastModifiers } from "../utilities.js";
import { createAccessorPropertyBackingField } from "./utilities.js";
import { NodeFlagsNone, NodeFlagsOptionalChain } from "../../ast/generated/flags.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { classHasExplicitlyAssignedName, isClassNamedEvaluationHelperBlock, isNamedEvaluationAnd, transformNamedEvaluation } from "./namedevaluation.js";
import { isClassThisAssignmentBlock } from "./classthis.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import type { anonymousFunctionDefinition } from "./namedevaluation.js";
import { IsIdentifierText } from "../../scanner/utilities.js";
import { Filter, Some } from "../../core/core.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::classFacts","kind":"type","status":"implemented","sigHash":"13a741db1e6964ac18f53134eb775f7a34d4093e7915d3598bb8218637998b35","bodyHash":"7439e6e0f2d4dad0d20d4ac1ba1ad9d972c9d139d3cbda2ec3da10b24c550f8b"}
 *
 * Go source:
 * classFacts int
 */
export type classFacts = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::constGroup::classFactsNone+classFactsClassWasDecorated+classFactsNeedsClassConstructorReference+classFactsNeedsClassSuperReference+classFactsNeedsSubstitutionForThisInClassStaticField+classFactsWillHoistInitializersToConstructor","kind":"constGroup","status":"implemented","sigHash":"135a344148ef0ebd4af9954b2ff4d2f150c5169346d2f87a2faf4e50aafdad0f","bodyHash":"769b4ed3257b9e2956b6cda709bd7062659a95d4fc29ae5cde794fd0c701dc7c"}
 *
 * Go source:
 * const (
 * 	classFactsNone                                       classFacts = 0
 * 	classFactsClassWasDecorated                          classFacts = 1 << 0
 * 	classFactsNeedsClassConstructorReference             classFacts = 1 << 1
 * 	classFactsNeedsClassSuperReference                   classFacts = 1 << 2
 * 	classFactsNeedsSubstitutionForThisInClassStaticField classFacts = 1 << 3
 * 	classFactsWillHoistInitializersToConstructor         classFacts = 1 << 4
 * )
 */
export const classFactsNone: classFacts = 0;
export const classFactsClassWasDecorated: classFacts = 1 << 0;
export const classFactsNeedsClassConstructorReference: classFacts = 1 << 1;
export const classFactsNeedsClassSuperReference: classFacts = 1 << 2;
export const classFactsNeedsSubstitutionForThisInClassStaticField: classFacts = 1 << 3;
export const classFactsWillHoistInitializersToConstructor: classFacts = 1 << 4;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::privateIdentifierInfo","kind":"type","status":"implemented","sigHash":"d58149ef296b60280dfcf96777d28282653986c025b30fa085e06f5209df15ef","bodyHash":"0573db47d049964b00f6511ec7ba23ff267ef054373dcc8ed19bcba6ced9e335"}
 *
 * Go source:
 * privateIdentifierInfo struct {
 * 	kind printer.PrivateIdentifierKind
 * 	// brandCheckIdentifier can contain:
 * 	//  - For instance field: The WeakMap that will be the storage for the field.
 * 	//  - For instance methods or accessors: The WeakSet that will be used for brand checking.
 * 	//  - For static members: The constructor that will be used for brand checking.
 * 	brandCheckIdentifier *ast.IdentifierNode
 * 	// isStatic stores if the identifier is static or not.
 * 	isStatic bool
 * 	// isValid stores if the identifier declaration is valid or not. Reserved names (e.g. #constructor)
 * 	// or duplicate identifiers are considered invalid.
 * 	isValid bool
 * 	// variableName contains the variable that will serve as the storage for a static field.
 * 	variableName *ast.IdentifierNode
 * 	// methodName is the identifier for a variable that will contain the private method implementation.
 * 	methodName *ast.IdentifierNode
 * 	// getterName is the identifier for a variable that will contain the private get accessor implementation, if any.
 * 	getterName *ast.IdentifierNode
 * 	// setterName is the identifier for a variable that will contain the private set accessor implementation, if any.
 * 	setterName *ast.IdentifierNode
 * }
 */
export interface privateIdentifierInfo {
  kind: PrivateIdentifierKind;
  brandCheckIdentifier: GoPtr<IdentifierNode>;
  isStatic: bool;
  isValid: bool;
  variableName: GoPtr<IdentifierNode>;
  methodName: GoPtr<IdentifierNode>;
  getterName: GoPtr<IdentifierNode>;
  setterName: GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::privateEnvironmentData","kind":"type","status":"implemented","sigHash":"c030fe278812fcff31f9b78932f68beb033c9567928b51b8184703502dc74748","bodyHash":"c5e5625184e8fecfc98803d685b7d05c2448f7ec0dd6effc316b6aae3a11b006"}
 *
 * Go source:
 * privateEnvironmentData struct {
 * 	// className is used for prefixing generated variable names.
 * 	className *ast.IdentifierNode
 * 	// weakSetName is used for brand check on private methods.
 * 	weakSetName *ast.IdentifierNode
 * }
 */
export interface privateEnvironmentData {
  className: GoPtr<IdentifierNode>;
  weakSetName: GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::privateEnvironment","kind":"type","status":"implemented","sigHash":"ac08a55ca837181211c0e3291b40044bff49898794901de1bfb5f2180984a23e","bodyHash":"e9098a1f393fa2bba4abd7746de87f6ca42962bfde2ddc2a89fdfbe062001051"}
 *
 * Go source:
 * privateEnvironment struct {
 * 	data                 privateEnvironmentData
 * 	members              map[string]*privateIdentifierInfo
 * 	generatedIdentifiers map[*ast.Node]*privateIdentifierInfo
 * }
 */
export interface privateEnvironment {
  data: privateEnvironmentData;
  members: GoMap<string, GoPtr<privateIdentifierInfo>>;
  generatedIdentifiers: GoMap<GoPtr<Node>, GoPtr<privateIdentifierInfo>>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::classLexicalEnvironment","kind":"type","status":"implemented","sigHash":"51af5bdfb1ddfa63c6e75b2bf60844fccd4fdcdce644c28d96185b064579615b","bodyHash":"12d79bd7a22cc4862de7ad750cef74c115379c5c9804f1191dfccf297d56406f"}
 *
 * Go source:
 * classLexicalEnvironment struct {
 * 	facts classFacts
 * 	// classConstructor is used for brand checks on static members, and `this` references in static initializers.
 * 	classConstructor *ast.IdentifierNode
 * 	classThis        *ast.IdentifierNode
 * 	// superClassReference is used for `super` references in static initializers.
 * 	superClassReference *ast.IdentifierNode
 * }
 */
export interface classLexicalEnvironment {
  facts: classFacts;
  classConstructor: GoPtr<IdentifierNode>;
  classThis: GoPtr<IdentifierNode>;
  superClassReference: GoPtr<IdentifierNode>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::classLexicalEnv","kind":"type","status":"implemented","sigHash":"c28831f39dd05622e1200ee85a9ff3c62f288093fb6fab33058e94fd4a87d6ba","bodyHash":"8d1570294dd3bc7b333606aa1d396a32db23ede9345dc43a612fc673ed5ccaff"}
 *
 * Go source:
 * classLexicalEnv struct {
 * 	previous   *classLexicalEnv
 * 	data       *classLexicalEnvironment
 * 	privateEnv *privateEnvironment
 * }
 */
export interface classLexicalEnv {
  previous: GoPtr<classLexicalEnv>;
  data: GoPtr<classLexicalEnvironment>;
  privateEnv: GoPtr<privateEnvironment>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::type::classFieldsTransformer","kind":"type","status":"implemented","sigHash":"112a3f8c2cfbce0110fdf9c9eb371e7ad8b214b91870630398f947346df2bd8c","bodyHash":"529f481332038f9abf50df6ba790b8a6e3411e0f80c51b77e298091edd6e92f2"}
 *
 * Go source:
 * classFieldsTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions *core.CompilerOptions
 * 	resolver        binder.ReferenceResolver
 * 
 * 	// Computed configuration flags
 * 	shouldTransformInitializersUsingSet               bool
 * 	shouldTransformInitializersUsingDefine            bool
 * 	shouldTransformInitializers                       bool
 * 	shouldTransformPrivateElementsOrClassStaticBlocks bool
 * 	shouldTransformAutoAccessors                      bool
 * 	shouldTransformThisInStaticInitializers           bool
 * 	shouldTransformSuperInStaticInitializers          bool
 * 	shouldTransformPrivateStaticElementsInFile        bool
 * 	legacyDecorators                                  bool
 * 
 * 	// pendingExpressions tracks what computed name expressions originating from elided names
 * 	// must be inlined at the next execution site, in document order.
 * 	pendingExpressions []*ast.Expression
 * 	// pendingStatements tracks what computed name expression statements and static property
 * 	// initializers must be emitted at the next execution site, in document order (for decorated classes).
 * 	pendingStatements     []*ast.Statement
 * 	lexicalEnvironment    *classLexicalEnv
 * 	currentClassContainer *ast.ClassLikeDeclaration
 * 	currentClassElement   *ast.ClassElement
 * 	// classAliases maps class declarations to alias identifiers for substituting class name
 * 	// references in static initializers. Replaces Strada's onSubstituteNode/trySubstituteClassAlias.
 * 	classAliases               map[*ast.Node]*ast.IdentifierNode
 * 	enclosingClassDeclarations collections.Set[*ast.Node]
 * 	inIterationStatement       bool
 * 	// insideComputedPropertyName replaces Strada's onEmitNode for ComputedPropertyName, which
 * 	// switches to the outer lexical environment. Used by visitThisExpression() to apply
 * 	// the outer environment's substitution without requiring currentClassElement to be static.
 * 	insideComputedPropertyName bool
 * 	parentNode                 *ast.Node
 * 	currentNode                *ast.Node
 * 
 * 	// Visitors
 * 	modifierVisitor                *ast.NodeVisitor
 * 	discardedValueVisitor          *ast.NodeVisitor
 * 	heritageClauseVisitor          *ast.NodeVisitor
 * 	assignmentTargetVisitor        *ast.NodeVisitor
 * 	classElementVisitor            *ast.NodeVisitor
 * 	accessorFieldResultVisitor     *ast.NodeVisitor
 * 	arrayAssignmentElementVisitor  *ast.NodeVisitor
 * 	objectAssignmentElementVisitor *ast.NodeVisitor
 * 	substitutionVisitor            *ast.NodeVisitor
 * 
 * 	// Pre-bound callbacks to avoid repeated closure allocation.
 * 	isAnonymousClassNeedingAssignedName func(*anonymousFunctionDefinition) bool
 * }
 */
export interface classFieldsTransformer {
  readonly __tsgoEmbedded0?: Transformer;
  compilerOptions: GoPtr<CompilerOptions>;
  resolver: ReferenceResolver;
  shouldTransformInitializersUsingSet: bool;
  shouldTransformInitializersUsingDefine: bool;
  shouldTransformInitializers: bool;
  shouldTransformPrivateElementsOrClassStaticBlocks: bool;
  shouldTransformAutoAccessors: bool;
  shouldTransformThisInStaticInitializers: bool;
  shouldTransformSuperInStaticInitializers: bool;
  shouldTransformPrivateStaticElementsInFile: bool;
  legacyDecorators: bool;
  pendingExpressions: GoSlice<GoPtr<Expression>>;
  pendingStatements: GoSlice<GoPtr<Statement>>;
  lexicalEnvironment: GoPtr<classLexicalEnv>;
  currentClassContainer: GoPtr<ClassLikeDeclaration>;
  currentClassElement: GoPtr<ClassElement>;
  classAliases: GoMap<GoPtr<Node>, GoPtr<IdentifierNode>>;
  enclosingClassDeclarations: Set;
  inIterationStatement: bool;
  insideComputedPropertyName: bool;
  parentNode: GoPtr<Node>;
  currentNode: GoPtr<Node>;
  modifierVisitor: GoPtr<NodeVisitor>;
  discardedValueVisitor: GoPtr<NodeVisitor>;
  heritageClauseVisitor: GoPtr<NodeVisitor>;
  assignmentTargetVisitor: GoPtr<NodeVisitor>;
  classElementVisitor: GoPtr<NodeVisitor>;
  accessorFieldResultVisitor: GoPtr<NodeVisitor>;
  arrayAssignmentElementVisitor: GoPtr<NodeVisitor>;
  objectAssignmentElementVisitor: GoPtr<NodeVisitor>;
  substitutionVisitor: GoPtr<NodeVisitor>;
  isAnonymousClassNeedingAssignedName: (arg0: GoPtr<anonymousFunctionDefinition>) => bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::newClassFieldsTransformer","kind":"func","status":"implemented","sigHash":"893ceb2196ca839b53560510a9141d104fa57a573219a37c0df30301469d9093","bodyHash":"dfff463a89cde179616945dad5889fc3b9374cc5d5071b63144d67af652b606e"}
 *
 * Go source:
 * func newClassFieldsTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	languageVersion := opts.CompilerOptions.GetEmitScriptTarget()
 * 	useDefineForClassFields := opts.CompilerOptions.GetUseDefineForClassFields()
 * 
 * 	// When targeting ESNext+ with useDefineForClassFields (the default), there are no class
 * 	// field transformations to perform and no prior transform sets EFTransformPrivateStaticElements,
 * 	// so every node would be returned unchanged. Skip entirely.
 * 	if languageVersion >= core.ScriptTargetESNext && useDefineForClassFields {
 * 		return nil
 * 	}
 * 
 * 	tx := &classFieldsTransformer{
 * 		compilerOptions:  opts.CompilerOptions,
 * 		resolver:         opts.Resolver,
 * 		legacyDecorators: opts.CompilerOptions.ExperimentalDecorators.IsTrue(),
 * 	}
 * 
 * 	// Always transform field initializers using Set semantics when `useDefineForClassFields: false`.
 * 	tx.shouldTransformInitializersUsingSet = !useDefineForClassFields
 * 
 * 	// Transform field initializers using Define semantics when `useDefineForClassFields: true` and target < ES2022.
 * 	tx.shouldTransformInitializersUsingDefine = useDefineForClassFields && languageVersion < core.ScriptTargetES2022
 * 
 * 	tx.shouldTransformInitializers = tx.shouldTransformInitializersUsingSet || tx.shouldTransformInitializersUsingDefine
 * 
 * 	// We need to transform private members and class static blocks when target < ES2022.
 * 	tx.shouldTransformPrivateElementsOrClassStaticBlocks = languageVersion < core.ScriptTargetES2022
 * 
 * 	// We need to transform `accessor` fields when target < ESNext.
 * 	// We may need to transform `accessor` fields when `useDefineForClassFields: false`
 * 	tx.shouldTransformAutoAccessors = languageVersion < core.ScriptTargetESNext
 * 
 * 	// We need to transform `this` in a static initializer into a reference to the class
 * 	// when target < ES2022 since the assignment will be moved outside of the class body.
 * 	tx.shouldTransformThisInStaticInitializers = languageVersion < core.ScriptTargetES2022
 * 
 * 	// Since target is always >= ES2015, this is always the same as
 * 	// shouldTransformThisInStaticInitializers.
 * 	tx.shouldTransformSuperInStaticInitializers = tx.shouldTransformThisInStaticInitializers
 * 
 * 	result := tx.NewTransformer(tx.visit, opts.Context)
 * 	tx.modifierVisitor = tx.EmitContext().NewNodeVisitor(tx.visitModifier)
 * 	tx.discardedValueVisitor = tx.EmitContext().NewNodeVisitor(tx.visitDiscardedValue)
 * 	tx.heritageClauseVisitor = tx.EmitContext().NewNodeVisitor(tx.visitHeritageClause)
 * 	tx.assignmentTargetVisitor = tx.EmitContext().NewNodeVisitor(tx.visitAssignmentTarget)
 * 	tx.classElementVisitor = tx.EmitContext().NewNodeVisitor(tx.visitClassElement)
 * 	tx.accessorFieldResultVisitor = tx.EmitContext().NewNodeVisitor(tx.visitAccessorFieldResult)
 * 	tx.arrayAssignmentElementVisitor = tx.EmitContext().NewNodeVisitor(tx.visitArrayAssignmentElement)
 * 	tx.objectAssignmentElementVisitor = tx.EmitContext().NewNodeVisitor(tx.visitObjectAssignmentElement)
 * 	tx.substitutionVisitor = tx.EmitContext().NewNodeVisitor(tx.visitForSubstitution)
 * 	tx.isAnonymousClassNeedingAssignedName = tx.isAnonymousClassNeedingAssignedNameWorker
 * 
 * 	return result
 * }
 */
export function newClassFieldsTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer> {
  const languageVersion = CompilerOptions_GetEmitScriptTarget(opts!.CompilerOptions);
  const useDefineForClassFields = CompilerOptions_GetUseDefineForClassFields(opts!.CompilerOptions);

  if (languageVersion >= ScriptTargetESNext && useDefineForClassFields) {
    return undefined;
  }

  const tx: classFieldsTransformer = {
    __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    compilerOptions: opts!.CompilerOptions,
    resolver: opts!.Resolver,
    legacyDecorators: Tristate_IsTrue(opts!.CompilerOptions!.ExperimentalDecorators),
    shouldTransformInitializersUsingSet: false,
    shouldTransformInitializersUsingDefine: false,
    shouldTransformInitializers: false,
    shouldTransformPrivateElementsOrClassStaticBlocks: false,
    shouldTransformAutoAccessors: false,
    shouldTransformThisInStaticInitializers: false,
    shouldTransformSuperInStaticInitializers: false,
    shouldTransformPrivateStaticElementsInFile: false,
    pendingExpressions: [],
    pendingStatements: [],
    lexicalEnvironment: undefined,
    currentClassContainer: undefined,
    currentClassElement: undefined,
    classAliases: new globalThis.Map(),
    enclosingClassDeclarations: { M: new globalThis.Map() },
    inIterationStatement: false,
    insideComputedPropertyName: false,
    parentNode: undefined,
    currentNode: undefined,
    modifierVisitor: undefined,
    discardedValueVisitor: undefined,
    heritageClauseVisitor: undefined,
    assignmentTargetVisitor: undefined,
    classElementVisitor: undefined,
    accessorFieldResultVisitor: undefined,
    arrayAssignmentElementVisitor: undefined,
    objectAssignmentElementVisitor: undefined,
    substitutionVisitor: undefined,
    isAnonymousClassNeedingAssignedName: undefined!,
  };

  tx.shouldTransformInitializersUsingSet = !useDefineForClassFields;
  tx.shouldTransformInitializersUsingDefine = useDefineForClassFields && languageVersion < ScriptTargetES2022;
  tx.shouldTransformInitializers = tx.shouldTransformInitializersUsingSet || tx.shouldTransformInitializersUsingDefine;
  tx.shouldTransformPrivateElementsOrClassStaticBlocks = languageVersion < ScriptTargetES2022;
  tx.shouldTransformAutoAccessors = languageVersion < ScriptTargetESNext;
  tx.shouldTransformThisInStaticInitializers = languageVersion < ScriptTargetES2022;
  tx.shouldTransformSuperInStaticInitializers = tx.shouldTransformThisInStaticInitializers;

  const result = Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => classFieldsTransformer_visit(tx, node), opts!.Context);
  tx.modifierVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitModifier(tx, node));
  tx.discardedValueVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitDiscardedValue(tx, node));
  tx.heritageClauseVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitHeritageClause(tx, node));
  tx.assignmentTargetVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitAssignmentTarget(tx, node));
  tx.classElementVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitClassElement(tx, node));
  tx.accessorFieldResultVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitAccessorFieldResult(tx, node));
  tx.arrayAssignmentElementVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitArrayAssignmentElement(tx, node));
  tx.objectAssignmentElementVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitObjectAssignmentElement(tx, node));
  tx.substitutionVisitor = EmitContext_NewNodeVisitor(Transformer_EmitContext(tx.__tsgoEmbedded0!), (node) => classFieldsTransformer_visitForSubstitution(tx, node));
  tx.isAnonymousClassNeedingAssignedName = (node) => classFieldsTransformer_isAnonymousClassNeedingAssignedNameWorker(tx, node);

  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.requiresBlockScopedVar","kind":"method","status":"implemented","sigHash":"5fc66be59f3b1d2a963ca72b48ec10465b2900af7b3a45c5856251a097c88809","bodyHash":"08b64d5f9e653d5c90ebaf8286feedeadddbe694fca73e5b14542f0faf279be7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) requiresBlockScopedVar() bool {
 * 	return tx.inIterationStatement && tx.currentClassContainer != nil && ast.IsClassExpression(tx.currentClassContainer)
 * }
 */
export function classFieldsTransformer_requiresBlockScopedVar(receiver: GoPtr<classFieldsTransformer>): bool {
  return (receiver!.inIterationStatement && receiver!.currentClassContainer !== undefined && IsClassExpression(receiver!.currentClassContainer)) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.classExpressionNeedsBlockScopedTemp","kind":"method","status":"implemented","sigHash":"30140d940ff900e131adbe3f72696fc1e1fe4cab9817179c1208cfe2c8d9ea68","bodyHash":"ea127b1775a5a08242bd42ea4b5ca96c432a67c567b1325038062a3080559979"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) classExpressionNeedsBlockScopedTemp() bool {
 * 	if !tx.requiresBlockScopedVar() {
 * 		return false
 * 	}
 * 	for _, member := range tx.currentClassContainer.Members() {
 * 		if ast.IsPropertyDeclaration(member) && !ast.HasStaticModifier(member) &&
 * 			member.Name() != nil && ast.IsComputedPropertyName(member.Name()) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function classFieldsTransformer_classExpressionNeedsBlockScopedTemp(receiver: GoPtr<classFieldsTransformer>): bool {
  if (!classFieldsTransformer_requiresBlockScopedVar(receiver)) {
    return false;
  }
  for (const member of Node_Members(receiver!.currentClassContainer) ?? []) {
    if (IsPropertyDeclaration(member) && !HasStaticModifier(member) &&
      Node_Name(member) !== undefined && IsComputedPropertyName(Node_Name(member))) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitSourceFile","kind":"method","status":"implemented","sigHash":"6bf25d7be435ff711574cddb055d1d6e6ca25cf7199357f7b65fd39fc7b9c0b9","bodyHash":"9d2c8f2d18fbb1f6f09bdd17d11d5ac76da423bb0ea68d468bef9b80e55bca83"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitSourceFile(node *ast.SourceFile) *ast.Node {
 * 	if node.IsDeclarationFile {
 * 		return node.AsNode()
 * 	}
 * 	tx.lexicalEnvironment = nil
 * 	tx.shouldTransformPrivateStaticElementsInFile = tx.EmitContext().EmitFlags(node.AsNode())&printer.EFTransformPrivateStaticElements != 0
 * 	tx.classAliases = make(map[*ast.Node]*ast.IdentifierNode)
 * 	tx.enclosingClassDeclarations.Clear()
 * 	visited := tx.Visitor().VisitEachChild(node.AsNode())
 * 	tx.EmitContext().AddEmitHelper(visited, tx.EmitContext().ReadEmitHelpers()...)
 * 	tx.classAliases = nil
 * 	tx.enclosingClassDeclarations.Clear()
 * 	return visited
 * }
 */
export function classFieldsTransformer_visitSourceFile(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<SourceFileNode>): GoPtr<Node> {
  if (AsSourceFile(node)!.IsDeclarationFile) {
    return node;
  }
  receiver!.lexicalEnvironment = undefined;
  receiver!.shouldTransformPrivateStaticElementsInFile = (EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFTransformPrivateStaticElements) !== 0;
  receiver!.classAliases = new globalThis.Map();
  receiver!.enclosingClassDeclarations.M.clear();
  const visited = NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
  EmitContext_AddEmitHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), visited, ...EmitContext_ReadEmitHelpers(Transformer_EmitContext(receiver!.__tsgoEmbedded0!)));
  receiver!.classAliases = new globalThis.Map();
  receiver!.enclosingClassDeclarations.M.clear();
  return visited;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitModifier","kind":"method","status":"implemented","sigHash":"c202f08e6ab2726d541ae5a25e08002685a854105ff6b0a32a7ccd03c3f9aac6","bodyHash":"90dfebdbd836c6a4a224cdb49ed4be843c0af75e6bdf75602a8bfacb348242e5"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitModifier(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindAccessorKeyword {
 * 		if tx.shouldTransformAutoAccessorsInCurrentClass() {
 * 			return nil
 * 		}
 * 		return node
 * 	}
 * 	if ast.IsModifier(node) {
 * 		return node
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_visitModifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node!.Kind === KindAccessorKeyword) {
    if (classFieldsTransformer_shouldTransformAutoAccessorsInCurrentClass(receiver)) {
      return undefined;
    }
    return node;
  }
  if (IsModifier(node)) {
    return node;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.pushNode","kind":"method","status":"implemented","sigHash":"0b4166e362aa4989672852af3087900d641c80b7b60eb09034f5a79bc7f71322","bodyHash":"22aa163fdcd8aabcb58969239ade44608b0a7f0e1773bd1ebe5a0437d880fe38"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export function classFieldsTransformer_pushNode(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const grandparentNode = receiver!.parentNode;
  receiver!.parentNode = receiver!.currentNode;
  receiver!.currentNode = node;
  return grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.popNode","kind":"method","status":"implemented","sigHash":"4b93101e438bcd0b71c79289109c7792efb1d65a728e801af9ecd480343620f1","bodyHash":"3c41bca9a5ab80ad540ed81aa48dd8055b05378d6d6fab349b530de5a31ddb39"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export function classFieldsTransformer_popNode(receiver: GoPtr<classFieldsTransformer>, grandparentNode: GoPtr<Node>): void {
  receiver!.currentNode = receiver!.parentNode;
  receiver!.parentNode = grandparentNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitForSubstitution","kind":"method","status":"implemented","sigHash":"a868348a3c6115f72c09b21bd93fd98fe50d855c67181e04d343b00e832a030a","bodyHash":"e756b0854aad2d1e4b2120d3e92a2d805d0f4ad26617e538cf55c2f052c29246"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitForSubstitution(node *ast.Node) *ast.Node {
 * 	if node.Kind == ast.KindIdentifier {
 * 		return tx.visitIdentifier(node.AsIdentifier())
 * 	}
 * 	if node.Kind == ast.KindPropertyAccessExpression && ast.IsIdentifier(node.AsPropertyAccessExpression().Name()) {
 * 		return tx.visitPropertyAccessExpressionForSubstitution(node.AsPropertyAccessExpression())
 * 	}
 * 	return tx.substitutionVisitor.VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitForSubstitution(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (node!.Kind === KindIdentifier) {
    return classFieldsTransformer_visitIdentifier(receiver, AsIdentifier(node));
  }
  if (node!.Kind === KindPropertyAccessExpression && IsIdentifier(AsPropertyAccessExpression(node)!.name)) {
    return classFieldsTransformer_visitPropertyAccessExpressionForSubstitution(receiver, AsPropertyAccessExpression(node));
  }
  return NodeVisitor_VisitEachChild(receiver!.substitutionVisitor as ConcreteNodeVisitor, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visit","kind":"method","status":"implemented","sigHash":"7194dfc9eea4d8dba8b78799f70d906a935fe3c7cd6d84a29a0c7e976fe17bfe","bodyHash":"3c3b9836589468451265c436de1f57e5092ae19d3cf7409484b2d250a32079ef"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visit(node *ast.Node) *ast.Node {
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 * 
 * 	if node.SubtreeFacts()&(ast.SubtreeContainsClassFields|ast.SubtreeContainsLexicalThisOrSuper) == 0 {
 * 		if tx.currentClassContainer != nil && len(tx.classAliases) > 0 {
 * 			// Continue visiting for alias substitution even in non-class-field subtrees.
 * 			return tx.visitForSubstitution(node)
 * 		}
 * 		return node
 * 	}
 * 
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		return tx.visitSourceFile(node.AsSourceFile())
 * 	case ast.KindClassDeclaration:
 * 		return tx.visitClassDeclaration(node.AsClassDeclaration())
 * 	case ast.KindClassExpression:
 * 		return tx.visitClassExpression(node.AsClassExpression())
 * 	case ast.KindClassStaticBlockDeclaration, ast.KindPropertyDeclaration:
 * 		panic("Use `classElementVisitor` instead.")
 * 	case ast.KindPropertyAssignment:
 * 		return tx.visitPropertyAssignment(node.AsPropertyAssignment())
 * 	case ast.KindVariableStatement:
 * 		return tx.visitVariableStatement(node.AsVariableStatement())
 * 	case ast.KindVariableDeclaration:
 * 		return tx.visitVariableDeclaration(node.AsVariableDeclaration())
 * 	case ast.KindParameter:
 * 		return tx.visitParameterDeclaration(node.AsParameterDeclaration())
 * 	case ast.KindBindingElement:
 * 		return tx.visitBindingElement(node.AsBindingElement())
 * 	case ast.KindExportAssignment:
 * 		return tx.visitExportAssignment(node.AsExportAssignment())
 * 	case ast.KindPrivateIdentifier:
 * 		return tx.visitPrivateIdentifier(node)
 * 	case ast.KindPropertyAccessExpression:
 * 		return tx.visitPropertyAccessExpression(node.AsPropertyAccessExpression())
 * 	case ast.KindElementAccessExpression:
 * 		return tx.visitElementAccessExpression(node.AsElementAccessExpression())
 * 	case ast.KindPrefixUnaryExpression, ast.KindPostfixUnaryExpression:
 * 		return tx.visitPreOrPostfixUnaryExpression(node, false /*discarded* /)
 * 	case ast.KindBinaryExpression:
 * 		return tx.visitBinaryExpression(node.AsBinaryExpression(), false /*discarded* /)
 * 	case ast.KindParenthesizedExpression:
 * 		return tx.visitParenthesizedExpression(node.AsParenthesizedExpression(), false /*discarded* /)
 * 	case ast.KindCallExpression:
 * 		return tx.visitCallExpression(node.AsCallExpression())
 * 	case ast.KindExpressionStatement:
 * 		return tx.visitExpressionStatement(node.AsExpressionStatement())
 * 	case ast.KindTaggedTemplateExpression:
 * 		return tx.visitTaggedTemplateExpression(node.AsTaggedTemplateExpression())
 * 	case ast.KindForStatement:
 * 		return tx.visitForStatement(node.AsForStatement())
 * 	case ast.KindForInStatement, ast.KindForOfStatement, ast.KindDoStatement, ast.KindWhileStatement:
 * 		return tx.setInIterationStatementAnd(true, (*classFieldsTransformer).visitEachChildOfNode, node)
 * 	case ast.KindThisKeyword:
 * 		return tx.visitThisExpression(node)
 * 	case ast.KindFunctionDeclaration, ast.KindFunctionExpression:
 * 		return tx.setInIterationStatementAnd(false, (*classFieldsTransformer).visitFunctionExpressionOrDeclaration, node)
 * 	case ast.KindConstructor, ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return tx.setInIterationStatementAnd(false, (*classFieldsTransformer).setClassElementAndVisitEachChild, node)
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function classFieldsTransformer_visit(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const grandparentNode = classFieldsTransformer_pushNode(receiver, node);
  try {
    if ((Node_SubtreeFacts(node) & (SubtreeContainsClassFields | SubtreeContainsLexicalThisOrSuper)) === 0) {
      if (receiver!.currentClassContainer !== undefined && receiver!.classAliases.size > 0) {
        // Continue visiting for alias substitution even in non-class-field subtrees.
        return classFieldsTransformer_visitForSubstitution(receiver, node);
      }
      return node;
    }

    switch (node!.Kind) {
      case KindSourceFile:
        return classFieldsTransformer_visitSourceFile(receiver, node);
      case KindClassDeclaration:
        return classFieldsTransformer_visitClassDeclaration(receiver, AsClassDeclaration(node));
      case KindClassExpression:
        return classFieldsTransformer_visitClassExpression(receiver, AsClassExpression(node));
      case KindClassStaticBlockDeclaration:
      case KindPropertyDeclaration:
        throw new globalThis.Error("Use `classElementVisitor` instead.");
      case KindPropertyAssignment:
        return classFieldsTransformer_visitPropertyAssignment(receiver, AsPropertyAssignment(node));
      case KindVariableStatement:
        return classFieldsTransformer_visitVariableStatement(receiver, AsVariableStatement(node));
      case KindVariableDeclaration:
        return classFieldsTransformer_visitVariableDeclaration(receiver, AsVariableDeclaration(node));
      case KindParameter:
        return classFieldsTransformer_visitParameterDeclaration(receiver, AsParameterDeclaration(node));
      case KindBindingElement:
        return classFieldsTransformer_visitBindingElement(receiver, AsBindingElement(node));
      case KindExportAssignment:
        return classFieldsTransformer_visitExportAssignment(receiver, AsExportAssignment(node));
      case KindPrivateIdentifier:
        return classFieldsTransformer_visitPrivateIdentifier(receiver, node);
      case KindPropertyAccessExpression:
        return classFieldsTransformer_visitPropertyAccessExpression(receiver, AsPropertyAccessExpression(node));
      case KindElementAccessExpression:
        return classFieldsTransformer_visitElementAccessExpression(receiver, AsElementAccessExpression(node));
      case KindPrefixUnaryExpression:
      case KindPostfixUnaryExpression:
        return classFieldsTransformer_visitPreOrPostfixUnaryExpression(receiver, node, false /*discarded*/);
      case KindBinaryExpression:
        return classFieldsTransformer_visitBinaryExpression(receiver, AsBinaryExpression(node), false /*discarded*/);
      case KindParenthesizedExpression:
        return classFieldsTransformer_visitParenthesizedExpression(receiver, AsParenthesizedExpression(node), false /*discarded*/);
      case KindCallExpression:
        return classFieldsTransformer_visitCallExpression(receiver, AsCallExpression(node));
      case KindExpressionStatement:
        return classFieldsTransformer_visitExpressionStatement(receiver, AsExpressionStatement(node));
      case KindTaggedTemplateExpression:
        return classFieldsTransformer_visitTaggedTemplateExpression(receiver, AsTaggedTemplateExpression(node));
      case KindForStatement:
        return classFieldsTransformer_visitForStatement(receiver, AsForStatement(node));
      case KindForInStatement:
      case KindForOfStatement:
      case KindDoStatement:
      case KindWhileStatement:
        return classFieldsTransformer_setInIterationStatementAnd(receiver, true, classFieldsTransformer_visitEachChildOfNode, node);
      case KindThisKeyword:
        return classFieldsTransformer_visitThisExpression(receiver, node);
      case KindFunctionDeclaration:
      case KindFunctionExpression:
        return classFieldsTransformer_setInIterationStatementAnd(receiver, false, classFieldsTransformer_visitFunctionExpressionOrDeclaration, node);
      case KindConstructor:
      case KindMethodDeclaration:
      case KindGetAccessor:
      case KindSetAccessor:
        return classFieldsTransformer_setInIterationStatementAnd(receiver, false, classFieldsTransformer_setClassElementAndVisitEachChild, node);
      default:
        return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
    }
  } finally {
    classFieldsTransformer_popNode(receiver, grandparentNode);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitDiscardedValue","kind":"method","status":"implemented","sigHash":"5c59b4320a57e99a73d43406fbb33c72488448940e04884716a96a32fefe1a0c","bodyHash":"9efc8a218be8916970872ba6562fdd52dcf47d09c523531f1f2ee144c5717ffe"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitDiscardedValue(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindPrefixUnaryExpression, ast.KindPostfixUnaryExpression:
 * 		return tx.visitPreOrPostfixUnaryExpression(node, true /*discarded* /)
 * 	case ast.KindBinaryExpression:
 * 		return tx.visitBinaryExpression(node.AsBinaryExpression(), true /*discarded* /)
 * 	case ast.KindParenthesizedExpression:
 * 		return tx.visitParenthesizedExpression(node.AsParenthesizedExpression(), true /*discarded* /)
 * 	default:
 * 		return tx.visit(node)
 * 	}
 * }
 */
export function classFieldsTransformer_visitDiscardedValue(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindPrefixUnaryExpression:
    case KindPostfixUnaryExpression:
      return classFieldsTransformer_visitPreOrPostfixUnaryExpression(receiver, node, true /*discarded*/);
    case KindBinaryExpression:
      return classFieldsTransformer_visitBinaryExpression(receiver, AsBinaryExpression(node), true /*discarded*/);
    case KindParenthesizedExpression:
      return classFieldsTransformer_visitParenthesizedExpression(receiver, AsParenthesizedExpression(node), true /*discarded*/);
    default:
      return classFieldsTransformer_visit(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitHeritageClause","kind":"method","status":"implemented","sigHash":"802c16361a020d43fda9e103515690df0add2e02d1c14560729db984d8d87559","bodyHash":"29505836db696d48ed104b6f9033ce81f1dce6bff72afee4b67b2e2e4dcaf3a1"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitHeritageClause(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindHeritageClause:
 * 		return tx.heritageClauseVisitor.VisitEachChild(node)
 * 	case ast.KindExpressionWithTypeArguments:
 * 		return tx.visitExpressionWithTypeArgumentsInHeritageClause(node.AsExpressionWithTypeArguments())
 * 	default:
 * 		return tx.visit(node)
 * 	}
 * }
 */
export function classFieldsTransformer_visitHeritageClause(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindHeritageClause:
      return NodeVisitor_VisitEachChild(receiver!.heritageClauseVisitor as ConcreteNodeVisitor, node);
    case KindExpressionWithTypeArguments:
      return classFieldsTransformer_visitExpressionWithTypeArgumentsInHeritageClause(receiver, AsExpressionWithTypeArguments(node));
    default:
      return classFieldsTransformer_visit(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentTarget","kind":"method","status":"implemented","sigHash":"41cbde1a143c8751645b27ec44a17673f6a22660f17c5295cda34d8f5e2dfe74","bodyHash":"cf805c5222e1ec074031b01f7493632e10f1507bd55a9ae6305dbaaf63c8f47c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentTarget(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindObjectLiteralExpression, ast.KindArrayLiteralExpression:
 * 		return tx.visitAssignmentPattern(node)
 * 	default:
 * 		return tx.visit(node)
 * 	}
 * }
 */
export function classFieldsTransformer_visitAssignmentTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindObjectLiteralExpression:
    case KindArrayLiteralExpression:
      return classFieldsTransformer_visitAssignmentPattern(receiver, node);
    default:
      return classFieldsTransformer_visit(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitDestructuringAssignmentTarget","kind":"method","status":"implemented","sigHash":"23ac0aeb0e175b5d9a026610bce8da97961621b745296ddd5c9defe98868d083","bodyHash":"56008bdce30aed0f19c2ba8b457e3836528ae565f853aed377ad2d99d18de913"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitDestructuringAssignmentTarget(node *ast.Node) *ast.Node {
 * 	if ast.IsObjectLiteralExpression(node) || ast.IsArrayLiteralExpression(node) {
 * 		return tx.visitAssignmentPattern(node)
 * 	}
 * 	if ast.IsPropertyAccessExpression(node) && ast.IsPrivateIdentifier(node.AsPropertyAccessExpression().Name()) {
 * 		return tx.wrapPrivateIdentifierForDestructuringTarget(node)
 * 	}
 * 	if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 		ast.IsSuperProperty(node) &&
 * 		isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		data := tx.lexicalEnvironment.data
 * 		if data.facts&classFactsClassWasDecorated != 0 {
 * 			return tx.visitInvalidSuperProperty(node)
 * 		}
 * 		if data.classConstructor != nil && data.superClassReference != nil {
 * 			var name *ast.Expression
 * 			if ast.IsElementAccessExpression(node) {
 * 				name = tx.Visitor().VisitNode(node.AsElementAccessExpression().ArgumentExpression)
 * 			} else if ast.IsPropertyAccessExpression(node) && ast.IsIdentifier(node.AsPropertyAccessExpression().Name()) {
 * 				name = tx.Factory().NewStringLiteralFromNode(node.AsPropertyAccessExpression().Name())
 * 			}
 * 			if name != nil {
 * 				temp := tx.Factory().NewTempVariable()
 * 				setExpr := tx.Factory().NewReflectSetCall(
 * 					data.superClassReference,
 * 					name,
 * 					temp,
 * 					data.classConstructor,
 * 				)
 * 				return tx.Factory().NewAssignmentTargetWrapper(temp, setExpr)
 * 			}
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitDestructuringAssignmentTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsObjectLiteralExpression(node) || IsArrayLiteralExpression(node)) {
    return classFieldsTransformer_visitAssignmentPattern(receiver, node);
  }
  if (IsPropertyAccessExpression(node) && IsPrivateIdentifier(AsPropertyAccessExpression(node)!.name)) {
    return classFieldsTransformer_wrapPrivateIdentifierForDestructuringTarget(receiver, node);
  }
  if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
    IsSuperProperty(node) &&
    isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    const data = receiver!.lexicalEnvironment.data;
    if ((data!.facts & classFactsClassWasDecorated) !== 0) {
      return classFieldsTransformer_visitInvalidSuperProperty(receiver, node);
    }
    if (data!.classConstructor !== undefined && data!.superClassReference !== undefined) {
      let name: GoPtr<Expression> = undefined;
      if (IsElementAccessExpression(node)) {
        name = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsElementAccessExpression(node)!.ArgumentExpression);
      } else if (IsPropertyAccessExpression(node) && IsIdentifier(AsPropertyAccessExpression(node)!.name)) {
        name = NodeFactory_NewStringLiteralFromNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), AsPropertyAccessExpression(node)!.name);
      }
      if (name !== undefined) {
        // Go does NOT AddVariableDeclaration here: the temp becomes the
        // synthesized setter's parameter (function-scoped), so it is never
        // hoisted and its name resolves inside the setter's own scope (_a).
        const temp = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
        const setExpr = NodeFactory_NewReflectSetCall(
          Transformer_Factory(receiver!.__tsgoEmbedded0!),
          data!.superClassReference,
          name,
          temp,
          data!.classConstructor,
        );
        return NodeFactory_NewAssignmentTargetWrapper(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, setExpr);
      }
    }
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassElement","kind":"method","status":"implemented","sigHash":"4059c1684dbe7e5a618cf2c0cda6e21c1e80b0234b44985049489497bad82e7b","bodyHash":"d1eed747ff244c0c8ba317a2f8bdde41c73773b0572dbdd9bf9e3d7a2ef9e598"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassElement(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindConstructor:
 * 		return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitConstructorDeclaration, node)
 * 	case ast.KindGetAccessor, ast.KindSetAccessor, ast.KindMethodDeclaration:
 * 		return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitMethodOrAccessorDeclaration, node)
 * 	case ast.KindPropertyDeclaration:
 * 		return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitPropertyDeclaration, node)
 * 	case ast.KindClassStaticBlockDeclaration:
 * 		return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitClassStaticBlockDeclaration, node)
 * 	case ast.KindComputedPropertyName:
 * 		return tx.visitComputedPropertyName(node.AsComputedPropertyName())
 * 	case ast.KindSemicolonClassElement:
 * 		return node
 * 	default:
 * 		if ast.IsModifierLike(node) {
 * 			return tx.visitModifier(node)
 * 		}
 * 		return tx.visit(node)
 * 	}
 * }
 */
export function classFieldsTransformer_visitClassElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindConstructor:
      return classFieldsTransformer_setCurrentClassElementAnd(receiver, node, classFieldsTransformer_visitConstructorDeclaration, node);
    case KindGetAccessor:
    case KindSetAccessor:
    case KindMethodDeclaration:
      return classFieldsTransformer_setCurrentClassElementAnd(receiver, node, classFieldsTransformer_visitMethodOrAccessorDeclaration, node);
    case KindPropertyDeclaration:
      return classFieldsTransformer_setCurrentClassElementAnd(receiver, node, classFieldsTransformer_visitPropertyDeclaration, node);
    case KindClassStaticBlockDeclaration:
      return classFieldsTransformer_setCurrentClassElementAnd(receiver, node, classFieldsTransformer_visitClassStaticBlockDeclaration, node);
    case KindComputedPropertyName:
      return classFieldsTransformer_visitComputedPropertyName(receiver, AsComputedPropertyName(node));
    case KindSemicolonClassElement:
      return node;
    default:
      if (IsModifierLike(node)) {
        return classFieldsTransformer_visitModifier(receiver, node);
      }
      return classFieldsTransformer_visit(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPropertyName","kind":"method","status":"implemented","sigHash":"617e6d64bbb6cacfe48ab6d173670fb0a8b7e5a9905ab5e334cb357ee4d5b563","bodyHash":"baf45f7d9ed42871c1a5a6d70f93f625c5232684079650f6204b0b569649515c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPropertyName(name *ast.PropertyName) *ast.PropertyName {
 * 	if ast.IsComputedPropertyName(name) {
 * 		return tx.visitComputedPropertyName(name.AsComputedPropertyName())
 * 	}
 * 	return tx.Visitor().VisitNode(name)
 * }
 */
export function classFieldsTransformer_visitPropertyName(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<PropertyName>): GoPtr<PropertyName> {
  if (IsComputedPropertyName(name)) {
    return classFieldsTransformer_visitComputedPropertyName(receiver, AsComputedPropertyName(name));
  }
  return NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), name);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAccessorFieldResult","kind":"method","status":"implemented","sigHash":"63c7c132b5dd13f9eaee54672bb1985b4c358ffd0633b827335a7e2c3dfef1a5","bodyHash":"ec05288113d2d85e50e23989542194d74d3d77122b1f2bd103932991338e7ae0"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAccessorFieldResult(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindPropertyDeclaration:
 * 		return tx.transformFieldInitializer(node.AsPropertyDeclaration())
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return tx.visitClassElement(node)
 * 	default:
 * 		debug.FailBadSyntaxKind(node, "Expected node to either be a PropertyDeclaration, GetAccessorDeclaration, or SetAccessorDeclaration")
 * 		return nil
 * 	}
 * }
 */
export function classFieldsTransformer_visitAccessorFieldResult(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  switch (node!.Kind) {
    case KindPropertyDeclaration:
      return classFieldsTransformer_transformFieldInitializer(receiver, AsPropertyDeclaration(node));
    case KindGetAccessor:
    case KindSetAccessor:
      return classFieldsTransformer_visitClassElement(receiver, node);
    default:
      debug.FailBadSyntaxKind({ KindString: (): string => Node_KindString(node) }, "Expected node to either be a PropertyDeclaration, GetAccessorDeclaration, or SetAccessorDeclaration");
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitIdentifier","kind":"method","status":"implemented","sigHash":"252818a2b1b8459c44f90ed7f7d27d4e8f7d0278a2269c2f1c652c0cd8426310","bodyHash":"712158875c45f1f8a205908c86486c5bb52c9beea30768b54b4687f83a8e8a72"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitIdentifier(node *ast.Identifier) *ast.Node {
 * 	declaration := tx.resolver.GetReferencedValueDeclaration(tx.EmitContext().MostOriginal(node.AsNode()))
 * 	if declaration != nil {
 * 		if alias, ok := tx.classAliases[declaration]; ok && tx.enclosingClassDeclarations.Has(declaration) {
 * 			clone := alias.Clone(tx.Factory())
 * 			tx.EmitContext().SetSourceMapRange(clone, node.Loc)
 * 			tx.EmitContext().SetCommentRange(clone, node.Loc)
 * 			return clone
 * 		}
 * 	}
 * 	return node.AsNode()
 * }
 */
export function classFieldsTransformer_visitIdentifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Identifier>): GoPtr<Node> {
  const declaration = receiver!.resolver.GetReferencedValueDeclaration(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node));
  if (declaration !== undefined) {
    const alias = receiver!.classAliases.get(declaration);
    if (alias !== undefined && Set_Has(receiver!.enclosingClassDeclarations, declaration)) {
      const clone = Node_Clone(alias, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
      EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), clone, node!.Loc);
      EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), clone, node!.Loc);
      return clone;
    }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPrivateIdentifier","kind":"method","status":"implemented","sigHash":"784227a170395dfa87dba748f0f815796a8377e32f453e568cb5e7ed4fd31b4b","bodyHash":"c084a317c6f19175c66c6675bbbf5b0b51850bb2a79ffd5e5bf668fa268e1456"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPrivateIdentifier(node *ast.Node) *ast.Node {
 * 	if !tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		return node
 * 	}
 * 	if tx.parentNode != nil && ast.IsStatement(tx.parentNode) {
 * 		return node
 * 	}
 * 	result := tx.Factory().NewIdentifier("")
 * 	tx.EmitContext().SetOriginal(result, node)
 * 	return result
 * }
 */
export function classFieldsTransformer_visitPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (!receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    return node;
  }
  if (receiver!.parentNode !== undefined && IsStatement(receiver!.parentNode)) {
    return node;
  }
  const result = NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "");
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), result, node);
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformPrivateIdentifierInInExpression","kind":"method","status":"implemented","sigHash":"4d1ba822e05851ae336f55c4b8c70f8c417f903774a20c6eb5608f4ccf6a623f","bodyHash":"b0c372b16d48d641fdef8047e5c19028267ed47e02a34c5a942952e3c9873ec1"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformPrivateIdentifierInInExpression(node *ast.BinaryExpression) *ast.Node {
 * 	info := tx.accessPrivateIdentifier(node.Left)
 * 	if info != nil {
 * 		receiver := tx.Visitor().VisitNode(node.Right)
 * 		result := tx.Factory().NewClassPrivateFieldInHelper(info.brandCheckIdentifier, receiver)
 * 		tx.EmitContext().SetOriginal(result, node.AsNode())
 * 		return result
 * 	}
 * 	// Private name has not been declared. Subsequent transformers will handle this error
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_transformPrivateIdentifierInInExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node> {
  const info = classFieldsTransformer_accessPrivateIdentifier(receiver, node!.Left);
  if (info !== undefined) {
    const receiver2 = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Right);
    const result = NodeFactory_NewClassPrivateFieldInHelper(Transformer_Factory(receiver!.__tsgoEmbedded0!), info!.brandCheckIdentifier, receiver2);
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), result, BinaryExpression_as_nodeData(node).AsNode());
    return result;
  }
  // Private name has not been declared. Subsequent transformers will handle this error
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), BinaryExpression_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPropertyAssignment","kind":"method","status":"implemented","sigHash":"e69a1d7dc91deeec54cb74e79f2e0c3fe966bfe0814c819f29542f9a921d49bf","bodyHash":"0c2919d535599ec219c2a769ef28f9570d547b990212a2b7515081b04d47ac7c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPropertyAssignment(node *ast.PropertyAssignment) *ast.Node {
 * 	// 13.2.5.5 RS: PropertyDefinitionEvaluation
 * 	//   PropertyAssignment : PropertyName `:` AssignmentExpression
 * 	//     ...
 * 	//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and _isProtoSetter_ is *false*, then
 * 	//        a. Let _popValue_ be ? NamedEvaluation of |AssignmentExpression| with argument _propKey_.
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false /*ignoreEmptyStringLiteral* /, "" /*assignedName* /).AsPropertyAssignment()
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitPropertyAssignment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAssignment>): GoPtr<Node> {
  // 13.2.5.5 RS: PropertyDefinitionEvaluation
  //   PropertyAssignment : PropertyName `:` AssignmentExpression
  //     ...
  //     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and _isProtoSetter_ is *false*, then
  //        a. Let _popValue_ be ? NamedEvaluation of |AssignmentExpression| with argument _propKey_.
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), PropertyAssignment_as_nodeData(node).AsNode(), receiver!.isAnonymousClassNeedingAssignedName)) {
    node = AsPropertyAssignment(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), PropertyAssignment_as_nodeData(node).AsNode(), false /*ignoreEmptyStringLiteral*/, "" /*assignedName*/));
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), PropertyAssignment_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitVariableStatement","kind":"method","status":"implemented","sigHash":"b48e42229133e39f47c926ebdd53518cfbcc9dd49c6c3f2e8fcde70e24d7c6e4","bodyHash":"04cd2fdd872bca8ce888b1e17928d3597ee1859f30fdf8143f773a7deb468d52"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	savedPendingStatements := tx.pendingStatements
 * 	tx.pendingStatements = nil
 * 
 * 	visitedNode := tx.Visitor().VisitEachChild(node.AsNode())
 * 
 * 	if len(tx.pendingStatements) > 0 {
 * 		result := make([]*ast.Node, 0, 1+len(tx.pendingStatements))
 * 		result = append(result, visitedNode)
 * 		result = append(result, tx.pendingStatements...)
 * 		tx.pendingStatements = savedPendingStatements
 * 		return tx.Factory().NewSyntaxList(result)
 * 	}
 * 
 * 	tx.pendingStatements = savedPendingStatements
 * 	return visitedNode
 * }
 */
export function classFieldsTransformer_visitVariableStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node> {
  const savedPendingStatements = receiver!.pendingStatements;
  receiver!.pendingStatements = [];

  const visitedNode = NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), VariableStatement_as_nodeData(node).AsNode());

  if (receiver!.pendingStatements.length > 0) {
    const result: Array<GoPtr<Node>> = [];
    result.push(visitedNode);
    for (const s of receiver!.pendingStatements) {
      result.push(s);
    }
    receiver!.pendingStatements = savedPendingStatements;
    return NewSyntaxList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, result);
  }

  receiver!.pendingStatements = savedPendingStatements;
  return visitedNode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitVariableDeclaration","kind":"method","status":"implemented","sigHash":"5bf70ac1ab77cd417fd2a6d20feb008eb2470a2996d79a0f93605c9d828486e1","bodyHash":"b8481a20f92c4aed3a3ffd0bbf55c9921c2270371c72b7f89384e96e348cb477"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitVariableDeclaration(node *ast.VariableDeclaration) *ast.Node {
 * 	// 14.3.1.2 RS: Evaluation
 * 	//   LexicalBinding : BindingIdentifier Initializer
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.2.1 RS: Evaluation
 * 	//   VariableDeclaration : BindingIdentifier Initializer
 * 	//     ...
 * 	//     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false, "").AsVariableDeclaration()
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitVariableDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Node> {
  // 14.3.1.2 RS: Evaluation
  //   LexicalBinding : BindingIdentifier Initializer
  //     ...
  //     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...
  //
  // 14.3.2.1 RS: Evaluation
  //   VariableDeclaration : BindingIdentifier Initializer
  //     ...
  //     3. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //        a. Let _value_ be ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), VariableDeclaration_as_nodeData(node).AsNode(), receiver!.isAnonymousClassNeedingAssignedName)) {
    node = AsVariableDeclaration(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), VariableDeclaration_as_nodeData(node).AsNode(), false, ""));
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), VariableDeclaration_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitParameterDeclaration","kind":"method","status":"implemented","sigHash":"245a6cf02f7c04c27602ddd9787ce5e26142ee9e3d1767de699b589cd0d8d762","bodyHash":"66c9b865c38ac11fcc412234f4ee7123f45565f47e9edb497410a2223ff242a2"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitParameterDeclaration(node *ast.ParameterDeclaration) *ast.Node {
 * 	// 8.6.3 RS: IteratorBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     5. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.3.3 RS: KeyedBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false, "").AsParameterDeclaration()
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitParameterDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ParameterDeclaration>): GoPtr<Node> {
  // 8.6.3 RS: IteratorBindingInitialization
  //   SingleNameBinding : BindingIdentifier Initializer?
  //     ...
  //     5. If |Initializer| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...
  //
  // 14.3.3.3 RS: KeyedBindingInitialization
  //   SingleNameBinding : BindingIdentifier Initializer?
  //     ...
  //     4. If |Initializer| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), ParameterDeclaration_as_nodeData(node).AsNode(), receiver!.isAnonymousClassNeedingAssignedName)) {
    node = AsParameterDeclaration(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), ParameterDeclaration_as_nodeData(node).AsNode(), false, ""));
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), ParameterDeclaration_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitBindingElement","kind":"method","status":"implemented","sigHash":"2de519d84a6865070dc93d96647d72a32a5accd4fed58be07de93cef4b5a8efb","bodyHash":"de895ccc971000c4d561d67583e4f5d19e747c2344c28fb29c26d80bc5703514"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitBindingElement(node *ast.BindingElement) *ast.Node {
 * 	// 8.6.3 RS: IteratorBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     5. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 	//
 * 	// 14.3.3.3 RS: KeyedBindingInitialization
 * 	//   SingleNameBinding : BindingIdentifier Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false, "").AsBindingElement()
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitBindingElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BindingElement>): GoPtr<Node> {
  // 8.6.3 RS: IteratorBindingInitialization
  //   SingleNameBinding : BindingIdentifier Initializer?
  //     ...
  //     5. If |Initializer| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...
  //
  // 14.3.3.3 RS: KeyedBindingInitialization
  //   SingleNameBinding : BindingIdentifier Initializer?
  //     ...
  //     4. If |Initializer| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _bindingId_.
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), BindingElement_as_nodeData(node).AsNode(), receiver!.isAnonymousClassNeedingAssignedName)) {
    node = AsBindingElement(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), BindingElement_as_nodeData(node).AsNode(), false, ""));
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), BindingElement_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitExportAssignment","kind":"method","status":"implemented","sigHash":"0a878acd92f6a8d87877a1f359ccd002822e48ef44b31d017ec207b3483837f1","bodyHash":"5b2132fd4482f5a7b5f8454f0b406605826a377dbc9a5d7e30529c704768e35b"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitExportAssignment(node *ast.ExportAssignment) *ast.Node {
 * 	// 16.2.3.7 RS: Evaluation
 * 	//   ExportDeclaration : `export` `default` AssignmentExpression `;`
 * 	//     1. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
 * 	//        a. Let _value_ be ? NamedEvaluation of |AssignmentExpression| with argument `"default"`.
 * 	//     ...
 * 
 * 	// NOTE: Since emit for `export =` translates to `module.exports = ...`, the assigned nameof the class
 * 	// is `""`.
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		assignedName := ""
 * 		if !node.IsExportEquals {
 * 			assignedName = "default"
 * 		}
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), true /*ignoreEmptyStringLiteral* /, assignedName).AsExportAssignment()
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitExportAssignment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Node> {
  // 16.2.3.7 RS: Evaluation
  //   ExportDeclaration : `export` `default` AssignmentExpression `;`
  //     1. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true*, then
  //        a. Let _value_ be ? NamedEvaluation of |AssignmentExpression| with argument `"default"`.
  //     ...

  // NOTE: Since emit for `export =` translates to `module.exports = ...`, the assigned nameof the class
  // is `""`.

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), ExportAssignment_as_nodeData(node).AsNode(), receiver!.isAnonymousClassNeedingAssignedName)) {
    const assignedName = !node!.IsExportEquals ? "default" : "";
    node = AsExportAssignment(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), ExportAssignment_as_nodeData(node).AsNode(), true /*ignoreEmptyStringLiteral*/, assignedName));
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), ExportAssignment_as_nodeData(node).AsNode());
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.injectPendingExpressions","kind":"method","status":"implemented","sigHash":"fd61df9e1edf07c940387a0d90953363157623f061013a92e1d69d9f49f994e6","bodyHash":"737f56d09355a779843a549cd32ac3a1aea1312f68552c38b382298cecbb9aba"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) injectPendingExpressions(expression *ast.Expression) *ast.Expression {
 * 	if len(tx.pendingExpressions) > 0 {
 * 		if ast.IsParenthesizedExpression(expression) {
 * 			tx.pendingExpressions = append(tx.pendingExpressions, expression.Expression())
 * 			expression = tx.Factory().UpdateParenthesizedExpression(
 * 				expression.AsParenthesizedExpression(),
 * 				tx.Factory().InlineExpressions(tx.pendingExpressions),
 * 			)
 * 		} else {
 * 			exprs := append(tx.pendingExpressions, expression)
 * 			expression = tx.Factory().InlineExpressions(exprs)
 * 		}
 * 		tx.pendingExpressions = nil
 * 	}
 * 	return expression
 * }
 */
export function classFieldsTransformer_injectPendingExpressions(receiver: GoPtr<classFieldsTransformer>, expression: GoPtr<Expression>): GoPtr<Expression> {
  if (receiver!.pendingExpressions.length > 0) {
    if (IsParenthesizedExpression(expression)) {
      receiver!.pendingExpressions = [...receiver!.pendingExpressions, Node_Expression(expression)];
      expression = NodeFactory_UpdateParenthesizedExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        AsParenthesizedExpression(expression),
        NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), receiver!.pendingExpressions),
      );
    } else {
      const exprs = [...receiver!.pendingExpressions, expression];
      expression = NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), exprs);
    }
    receiver!.pendingExpressions = [];
  }
  return expression;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitComputedPropertyName","kind":"method","status":"implemented","sigHash":"c3ccba6ec93c85a0e84ba810dff98dd0bbd841528de3aaeb901fd9d4fff3df26","bodyHash":"a2a8f2967606ec851d725caf449390b3e7073ab9a759ee9a2955882acb6ae85e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitComputedPropertyName(node *ast.ComputedPropertyName) *ast.Node {
 * 	// Computed property names are evaluated in the enclosing scope, not the current class.
 * 	// Replaces Strada's onEmitNode for ComputedPropertyName which switches to
 * 	// lexicalEnvironment?.previous. We do this explicitly during transformation.
 * 	savedLexicalEnvironment := tx.lexicalEnvironment
 * 	savedInsideComputedPropertyName := tx.insideComputedPropertyName
 * 	tx.insideComputedPropertyName = true
 * 	if tx.lexicalEnvironment != nil && tx.lexicalEnvironment.previous != nil {
 * 		tx.lexicalEnvironment = tx.lexicalEnvironment.previous
 * 	}
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	tx.lexicalEnvironment = savedLexicalEnvironment
 * 	tx.insideComputedPropertyName = savedInsideComputedPropertyName
 * 	return tx.Factory().UpdateComputedPropertyName(node, tx.injectPendingExpressions(expression))
 * }
 */
export function classFieldsTransformer_visitComputedPropertyName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ComputedPropertyName>): GoPtr<Node> {
  const savedLexicalEnvironment = receiver!.lexicalEnvironment;
  const savedInsideComputedPropertyName = receiver!.insideComputedPropertyName;
  receiver!.insideComputedPropertyName = true;
  if (receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.previous !== undefined) {
    receiver!.lexicalEnvironment = receiver!.lexicalEnvironment.previous;
  }
  const expression = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression);
  receiver!.lexicalEnvironment = savedLexicalEnvironment;
  receiver!.insideComputedPropertyName = savedInsideComputedPropertyName;
  return NodeFactory_UpdateComputedPropertyName(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node,
    classFieldsTransformer_injectPendingExpressions(receiver, expression),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"55180be94eb99942cc81ba2a80be1a4111e63a5185da9f19c0be0ce360b2b22c","bodyHash":"6d6197c3bb689ea3b6164b300511ff0a29112ef861372839271f4021d954ac43"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitConstructorDeclaration(node *ast.Node) *ast.Node {
 * 	if tx.currentClassContainer != nil {
 * 		return tx.transformConstructor(node.AsConstructorDeclaration(), tx.currentClassContainer)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitConstructorDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.currentClassContainer !== undefined) {
    return classFieldsTransformer_transformConstructor(receiver, AsConstructorDeclaration(node), receiver!.currentClassContainer);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.shouldTransformClassElementToWeakMap","kind":"method","status":"implemented","sigHash":"8355e977047f3b3730467f9500f07b500171cb3dd8ec70378719c77593bc2638","bodyHash":"963893127d96e20516976327924112750394e7b6266f95a0049eb5ff9bc45fa1"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) shouldTransformClassElementToWeakMap(node *ast.Node) bool {
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		return true
 * 	}
 * 	return tx.shouldAlwaysTransformPrivateStaticElements(node)
 * }
 */
export function classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool {
  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    return true;
  }
  return classFieldsTransformer_shouldAlwaysTransformPrivateStaticElements(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.shouldAlwaysTransformPrivateStaticElements","kind":"method","status":"implemented","sigHash":"c885b7a3f4f92c49a3d7c7f1b8389309be20bbae1c8a394af2276317400f9f9d","bodyHash":"f2e5fd36c6fb7307f423ed65c4acec7e654a5e91d9789db941b8ac59667f1c14"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) shouldAlwaysTransformPrivateStaticElements(node *ast.Node) bool {
 * 	return ast.HasStaticModifier(node) && tx.EmitContext().EmitFlags(node)&printer.EFTransformPrivateStaticElements != 0
 * }
 */
export function classFieldsTransformer_shouldAlwaysTransformPrivateStaticElements(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool {
  return (HasStaticModifier(node) && (EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFTransformPrivateStaticElements) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.nodeHasTransformPrivateStaticElementsFlag","kind":"method","status":"implemented","sigHash":"f916ecc002667b745fb1c040508bac56f1b9ebec10ed8e302e068f5d78ce0863","bodyHash":"d8daf44f7a30eb5069949d93908b3a1dcbccf4850f536e878c418cc1a5f52234"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) nodeHasTransformPrivateStaticElementsFlag(node *ast.Node) bool {
 * 	return tx.EmitContext().EmitFlags(node)&printer.EFTransformPrivateStaticElements != 0
 * }
 */
export function classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool {
  return ((EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFTransformPrivateStaticElements) !== 0) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitMethodOrAccessorDeclaration","kind":"method","status":"implemented","sigHash":"fc7ceead72a8650a04036ca2000705039b1f77a32542be678424494416a50f12","bodyHash":"97e9f77b04e92f8ea32baf641a6b1503cef82ec90e3c9246e0d4333df4b67594"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitMethodOrAccessorDeclaration(node *ast.Node) *ast.Node {
 * 	debug.Assert(!ast.HasDecorators(node))
 * 
 * 	if !ast.IsPrivateIdentifierClassElementDeclaration(node) || !tx.shouldTransformClassElementToWeakMap(node) {
 * 		return tx.classElementVisitor.VisitEachChild(node)
 * 	}
 * 
 * 	// leave invalid code untransformed
 * 	info := tx.accessPrivateIdentifier(node.Name())
 * 	debug.Assert(info != nil, "Undeclared private name for property declaration.")
 * 	if !info.isValid {
 * 		return node
 * 	}
 * 
 * 	functionName := tx.getHoistedFunctionName(node)
 * 	if functionName != nil {
 * 		modifiers := tx.extractNonStaticNonAccessorModifiers(node)
 * 		tx.EmitContext().StartVariableEnvironment()
 * 		saved := tx.inIterationStatement
 * 		tx.inIterationStatement = false
 * 		body := tx.EmitContext().VisitFunctionBody(node.Body(), tx.Visitor())
 * 		params := tx.Visitor().VisitNodes(node.ParameterList())
 * 		tx.inIterationStatement = saved
 * 
 * 		funcExpr := tx.Factory().NewFunctionExpression(modifiers, node.BodyData().AsteriskToken, functionName, nil, params, nil, nil, body)
 * 		assignment := tx.Factory().NewAssignmentExpression(functionName, funcExpr)
 * 		tx.addPendingExpressions(assignment)
 * 	}
 * 
 * 	// remove method declaration from class
 * 	return nil
 * }
 */
export function classFieldsTransformer_visitMethodOrAccessorDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  debug.Assert((!HasDecorators(node)) as bool);

  if (!IsPrivateIdentifierClassElementDeclaration(node) || !classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver, node)) {
    return NodeVisitor_VisitEachChild(receiver!.classElementVisitor as ConcreteNodeVisitor, node);
  }

  // leave invalid code untransformed
  const info = classFieldsTransformer_accessPrivateIdentifier(receiver, Node_Name(node));
  debug.Assert((info !== undefined) as bool, "Undeclared private name for property declaration.");
  if (!info!.isValid) {
    return node;
  }

  const functionName = classFieldsTransformer_getHoistedFunctionName(receiver, node);
  if (functionName !== undefined) {
    const modifiers = classFieldsTransformer_extractNonStaticNonAccessorModifiers(receiver, node);
    EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));
    const saved = receiver!.inIterationStatement;
    receiver!.inIterationStatement = false;
    const body = EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Body(node), Transformer_Visitor(receiver!.__tsgoEmbedded0!));
    const params = NodeVisitor_VisitNodes((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_ParameterList(node));
    receiver!.inIterationStatement = saved;

    const funcExpr = NewFunctionExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      modifiers,
      AsMethodDeclaration(node)!.AsteriskToken,
      functionName,
      undefined,
      params,
      undefined,
      undefined,
      body,
    );
    const assignment = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), functionName, funcExpr);
    classFieldsTransformer_addPendingExpressions(receiver, assignment);
  }

  // remove method declaration from class
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.extractNonStaticNonAccessorModifiers","kind":"method","status":"implemented","sigHash":"a263a20d94302bb4cb65c3cb51e85d612c77fc05e5ad1ba953ce80bcb5cd6109","bodyHash":"2a5103e4e69fb6dd4380303320cc54f0a46de87ff543d89cd560567b5aa53f1b"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) extractNonStaticNonAccessorModifiers(node *ast.Node) *ast.ModifierList {
 * 	return transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), ^(ast.ModifierFlagsStatic | ast.ModifierFlagsAccessor))
 * }
 */
export function classFieldsTransformer_extractNonStaticNonAccessorModifiers(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<ModifierList> {
  return ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Modifiers(node), ~(ModifierFlagsStatic | ModifierFlagsAccessor));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setCurrentClassElementAnd","kind":"method","status":"implemented","sigHash":"5e0cbd6eedc79b94f5a54a9010f4448493b5d4cae948a9442905f17219f648dd","bodyHash":"6190d0076de2e8b9be30ab3b342bf15b7069c3c9a0aa04e529a32c7380cecd70"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setCurrentClassElementAnd(classElement *ast.ClassElement, visitor func(tx *classFieldsTransformer, node *ast.Node) *ast.Node, node *ast.Node) *ast.Node {
 * 	if classElement != tx.currentClassElement {
 * 		saved := tx.currentClassElement
 * 		tx.currentClassElement = classElement
 * 		result := visitor(tx, node)
 * 		tx.currentClassElement = saved
 * 		return result
 * 	}
 * 	return visitor(tx, node)
 * }
 */
export function classFieldsTransformer_setCurrentClassElementAnd(receiver: GoPtr<classFieldsTransformer>, classElement: GoPtr<ClassElement>, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node> {
  if (classElement !== receiver!.currentClassElement) {
    const saved = receiver!.currentClassElement;
    receiver!.currentClassElement = classElement;
    const result = visitor(receiver, node);
    receiver!.currentClassElement = saved;
    return result;
  }
  return visitor(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitEachChildOfNode","kind":"method","status":"implemented","sigHash":"ddd06906b2d6f4fff4177885dff192cc5e9268e133f26c28e7f1c9a9f3b70bc1","bodyHash":"40d132e569eea723c0e35a29c2b0840e38369559b55d0cd0eefdbdae1c614b4e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitEachChildOfNode(node *ast.Node) *ast.Node {
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitEachChildOfNode(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setInIterationStatementAnd","kind":"method","status":"implemented","sigHash":"752b0e4afbcbe03fbf6449d2aa856302d98fc8a9832f69281eae0c40952604bc","bodyHash":"43ea734115ad57bb225fd1223dbb17c49a7a0838bd4d538fd2e55624223669b1"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setInIterationStatementAnd(inIteration bool, visitor func(tx *classFieldsTransformer, node *ast.Node) *ast.Node, node *ast.Node) *ast.Node {
 * 	if tx.inIterationStatement != inIteration {
 * 		saved := tx.inIterationStatement
 * 		tx.inIterationStatement = inIteration
 * 		result := visitor(tx, node)
 * 		tx.inIterationStatement = saved
 * 		return result
 * 	}
 * 	return visitor(tx, node)
 * }
 */
export function classFieldsTransformer_setInIterationStatementAnd(receiver: GoPtr<classFieldsTransformer>, inIteration: bool, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.inIterationStatement !== inIteration) {
    const saved = receiver!.inIterationStatement;
    receiver!.inIterationStatement = inIteration;
    const result = visitor(receiver, node);
    receiver!.inIterationStatement = saved;
    return result;
  }
  return visitor(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.clearClassElementAndVisitEachChild","kind":"method","status":"implemented","sigHash":"9da13706e0bc5e005ee7fdab73c42638b19796b66661e2ea8ebdc49726073f68","bodyHash":"4299d998d37f5cc42e6612dceacf173b174b8b8090c7ece2a7a81c4cc9b1b5c3"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) clearClassElementAndVisitEachChild(node *ast.Node) *ast.Node {
 * 	return tx.setCurrentClassElementAnd(nil, (*classFieldsTransformer).visitEachChildOfNode, node)
 * }
 */
export function classFieldsTransformer_clearClassElementAndVisitEachChild(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  return classFieldsTransformer_setCurrentClassElementAnd(receiver, undefined, classFieldsTransformer_visitEachChildOfNode, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitFunctionExpressionOrDeclaration","kind":"method","status":"implemented","sigHash":"7789a614bf504c779a6a004cfc390e6cda94e796e102482c24cf9db02e028a59","bodyHash":"9cd2f019c9cac2c559e822f3c6b7dd3fb1876ebd75f188bbab26f2e5a57cea6a"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitFunctionExpressionOrDeclaration(node *ast.Node) *ast.Node {
 * 	if tx.currentClassElement != nil {
 * 		original := tx.EmitContext().MostOriginal(node)
 * 		if original != node && tx.currentClassContainer != nil {
 * 			for _, member := range tx.currentClassContainer.Members() {
 * 				if tx.EmitContext().MostOriginal(member) == original && ast.IsStatic(member) {
 * 					// The function expression originates from a static class member (e.g., a
 * 					// descriptor method synthesized by the ES decorator transformer for a
 * 					// static private auto-accessor). Preserve the current class element so
 * 					// that visitThisExpression can substitute `this` with `_classThis`.
 * 					// Non-static members must NOT preserve the class element because `this`
 * 					// inside their descriptor functions should remain dynamic.
 * 					return tx.visitEachChildOfNode(node)
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return tx.setCurrentClassElementAnd(nil, (*classFieldsTransformer).visitEachChildOfNode, node)
 * }
 */
export function classFieldsTransformer_visitFunctionExpressionOrDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.currentClassElement !== undefined) {
    const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
    if (original !== node && receiver!.currentClassContainer !== undefined) {
      for (const member of Node_Members(receiver!.currentClassContainer) ?? []) {
        if (EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), member) === original && IsStatic(member)) {
          return classFieldsTransformer_visitEachChildOfNode(receiver, node);
        }
      }
    }
  }
  return classFieldsTransformer_setCurrentClassElementAnd(receiver, undefined, classFieldsTransformer_visitEachChildOfNode, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setClassElementAndVisitEachChild","kind":"method","status":"implemented","sigHash":"d37be97835599f1ad197819c621a56255b095f006dd2c168a61225830bfdd936","bodyHash":"da50ffb6fd28adaa117400f1b3b76170e7712a7a55a1bb41a32fdc0c04a20745"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setClassElementAndVisitEachChild(node *ast.Node) *ast.Node {
 * 	return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitEachChildOfNode, node)
 * }
 */
export function classFieldsTransformer_setClassElementAndVisitEachChild(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  return classFieldsTransformer_setCurrentClassElementAnd(receiver, node, classFieldsTransformer_visitEachChildOfNode, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getHoistedFunctionName","kind":"method","status":"implemented","sigHash":"7b4931b55795d95e21551614217c06fd91dbeb4b193d3f2ef0b1c10db0b428aa","bodyHash":"8ba758e168eae06a32fd3ae812e948c8f37c70450eb0a870d601205f374c72ad"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getHoistedFunctionName(node *ast.Node) *ast.IdentifierNode {
 * 	debug.Assert(node.Name() != nil && ast.IsPrivateIdentifier(node.Name()))
 * 	info := tx.accessPrivateIdentifier(node.Name())
 * 	debug.Assert(info != nil, "Undeclared private name for property declaration.")
 * 	if info.kind == printer.PrivateIdentifierKindMethod {
 * 		return info.methodName
 * 	}
 * 	if info.kind == printer.PrivateIdentifierKindAccessor {
 * 		if ast.IsGetAccessorDeclaration(node) {
 * 			return info.getterName
 * 		}
 * 		if ast.IsSetAccessorDeclaration(node) {
 * 			return info.setterName
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_getHoistedFunctionName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<IdentifierNode> {
  debug.Assert((Node_Name(node) !== undefined && IsPrivateIdentifier(Node_Name(node))) as bool);
  const info = classFieldsTransformer_accessPrivateIdentifier(receiver, Node_Name(node));
  debug.Assert((info !== undefined) as bool, "Undeclared private name for property declaration.");
  if (info!.kind === PrivateIdentifierKindMethod) {
    return info!.methodName;
  }
  if (info!.kind === PrivateIdentifierKindAccessor) {
    if (IsGetAccessorDeclaration(node)) {
      return info!.getterName;
    }
    if (IsSetAccessorDeclaration(node)) {
      return info!.setterName;
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.tryGetClassThis","kind":"method","status":"implemented","sigHash":"3a2c569617d78e605a632054ca720df1941d1eb0f8c41694cd806760c195cbb8","bodyHash":"3edb074cfad63c277cf89c43438f3de3a2bcd8e560dde4a0c03ad09bf166dab8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) tryGetClassThis() *ast.Expression {
 * 	if classThis := tx.tryGetClassThisNoContainer(); classThis != nil {
 * 		return classThis
 * 	}
 * 	if tx.currentClassContainer != nil {
 * 		return tx.currentClassContainer.Name()
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_tryGetClassThis(receiver: GoPtr<classFieldsTransformer>): GoPtr<Expression> {
  const classThis = classFieldsTransformer_tryGetClassThisNoContainer(receiver);
  if (classThis !== undefined) {
    return classThis;
  }
  if (receiver!.currentClassContainer !== undefined) {
    return Node_Name(receiver!.currentClassContainer);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.tryGetClassThisNoContainer","kind":"method","status":"implemented","sigHash":"8be71780686249cb3be2b1b631c81a924cf672c2e7e9510c9670b5d1acdbd370","bodyHash":"964302c15994c02cc7aa3ae8a9ba0c2ba8ca8dd039eb5a64fd513d093f429d04"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) tryGetClassThisNoContainer() *ast.Expression {
 * 	lex := tx.getClassLexicalEnvironment()
 * 	if lex.classThis != nil {
 * 		return lex.classThis
 * 	}
 * 	if lex.classConstructor != nil {
 * 		return lex.classConstructor
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_tryGetClassThisNoContainer(receiver: GoPtr<classFieldsTransformer>): GoPtr<Expression> {
  const lex = classFieldsTransformer_getClassLexicalEnvironment(receiver);
  if (lex!.classThis !== undefined) {
    return lex!.classThis;
  }
  if (lex!.classConstructor !== undefined) {
    return lex!.classConstructor;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformAutoAccessor","kind":"method","status":"implemented","sigHash":"e80d5175d2daac5579be25e70b5cc7491abcc83b65f508fe3db0b28ec66e0de0","bodyHash":"9875d4a4caa238515a4b9a5f6f6970111053ce8ed67a2ab627ac8b2b9544b94f"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformAutoAccessor(node *ast.PropertyDeclaration) *ast.Node {
 * 	commentRange := tx.EmitContext().CommentRange(node.AsNode())
 * 	sourceMapRange := tx.EmitContext().SourceMapRange(node.AsNode())
 * 
 * 	// Since we're creating two declarations where there was previously one, cache
 * 	// the expression for any computed property names.
 * 	name := node.Name()
 * 	getterName := name
 * 	setterName := name
 * 	if ast.IsComputedPropertyName(name) && !transformers.IsSimpleInlineableExpression(name.Expression()) {
 * 		cacheAssignment := findComputedPropertyNameCacheAssignment(tx.EmitContext(), name)
 * 		if cacheAssignment != nil {
 * 			getterName = tx.Factory().UpdateComputedPropertyName(name.AsComputedPropertyName(), tx.Visitor().VisitNode(name.Expression()))
 * 			setterName = tx.Factory().UpdateComputedPropertyName(name.AsComputedPropertyName(), cacheAssignment.Left)
 * 		} else {
 * 			temp := tx.Factory().NewTempVariable()
 * 			tx.EmitContext().SetSourceMapRange(temp, name.Expression().Loc)
 * 			tx.EmitContext().AddVariableDeclaration(temp)
 * 			expression := tx.Visitor().VisitNode(name.Expression())
 * 			assignment := tx.Factory().NewAssignmentExpression(temp, expression)
 * 			tx.EmitContext().SetSourceMapRange(assignment, name.Expression().Loc)
 * 			getterName = tx.Factory().UpdateComputedPropertyName(name.AsComputedPropertyName(), assignment)
 * 			setterName = tx.Factory().UpdateComputedPropertyName(name.AsComputedPropertyName(), temp)
 * 		}
 * 	}
 * 
 * 	modifiers := tx.modifierVisitor.VisitModifiers(node.Modifiers())
 * 	backingField := createAccessorPropertyBackingField(tx.Factory(), node, modifiers, node.Initializer)
 * 	tx.EmitContext().SetOriginal(backingField, node.AsNode())
 * 	tx.EmitContext().AddEmitFlags(backingField, printer.EFNoComments)
 * 	tx.EmitContext().SetSourceMapRange(backingField, sourceMapRange)
 * 
 * 	var receiver *ast.Expression
 * 	if ast.IsStatic(node.AsNode()) {
 * 		receiver = tx.tryGetClassThis()
 * 		if receiver == nil {
 * 			receiver = tx.Factory().NewThisExpression()
 * 		}
 * 	} else {
 * 		receiver = tx.Factory().NewThisExpression()
 * 	}
 * 
 * 	getter := tx.createAccessorPropertyGetRedirector(node, modifiers, getterName, receiver)
 * 	tx.EmitContext().SetOriginal(getter, node.AsNode())
 * 	tx.EmitContext().SetCommentRange(getter, commentRange)
 * 	tx.EmitContext().SetSourceMapRange(getter, sourceMapRange)
 * 
 * 	// create a fresh copy of the modifiers so that we don't duplicate comments
 * 	var setterModifiers *ast.ModifierList
 * 	if modifiers != nil {
 * 		setterModifiers = tx.Factory().NewModifierList(ast.CreateModifiersFromModifierFlags(modifiers.ModifierFlags, tx.Factory().NewModifier))
 * 	}
 * 	setter := tx.createAccessorPropertySetRedirector(node, setterModifiers, setterName, receiver)
 * 	tx.EmitContext().SetOriginal(setter, node.AsNode())
 * 	tx.EmitContext().AddEmitFlags(setter, printer.EFNoComments)
 * 	tx.EmitContext().SetSourceMapRange(setter, sourceMapRange)
 * 
 * 	// Visit the results in a second pass
 * 	visited, _ := tx.accessorFieldResultVisitor.VisitSlice([]*ast.Node{backingField, getter, setter})
 * 	return tx.Factory().NewSyntaxList(visited)
 * }
 */
export function classFieldsTransformer_transformAutoAccessor(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  const commentRange = EmitContext_CommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>);
  const sourceMapRange = EmitContext_SourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>);

  // Since we're creating two declarations where there was previously one, cache
  // the expression for any computed property names.
  let name: GoPtr<PropertyName> = Node_Name(node as unknown as GoPtr<Node>) as GoPtr<PropertyName>;
  let getterName: GoPtr<PropertyName> = name;
  let setterName: GoPtr<PropertyName> = name;
  if (IsComputedPropertyName(name) && !IsSimpleInlineableExpression(AsComputedPropertyName(name)!.Expression)) {
    const cacheAssignment = findComputedPropertyNameCacheAssignment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name);
    if (cacheAssignment !== undefined) {
      getterName = NodeFactory_UpdateComputedPropertyName(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsComputedPropertyName(name)!, NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsComputedPropertyName(name)!.Expression)) as GoPtr<PropertyName>;
      setterName = NodeFactory_UpdateComputedPropertyName(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsComputedPropertyName(name)!, cacheAssignment!.Left) as GoPtr<PropertyName>;
    } else {
      const temp = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
      EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp, AsComputedPropertyName(name)!.Expression!.Loc);
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
      const expression = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsComputedPropertyName(name)!.Expression);
      const assignment = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, expression);
      EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), assignment, AsComputedPropertyName(name)!.Expression!.Loc);
      getterName = NodeFactory_UpdateComputedPropertyName(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsComputedPropertyName(name)!, assignment) as GoPtr<PropertyName>;
      setterName = NodeFactory_UpdateComputedPropertyName(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsComputedPropertyName(name)!, temp) as GoPtr<PropertyName>;
    }
  }

  const modifiers = NodeVisitor_VisitModifiers(receiver!.modifierVisitor as ConcreteNodeVisitor, Node_Modifiers(node as unknown as GoPtr<Node>));
  const backingField = createAccessorPropertyBackingField(Transformer_Factory(receiver!.__tsgoEmbedded0!), node, modifiers, Node_Initializer(node as unknown as GoPtr<Node>) as GoPtr<Expression>);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), backingField, node as unknown as GoPtr<Node>);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), backingField, EFNoComments);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), backingField, sourceMapRange);

  let recv: GoPtr<Expression>;
  if (IsStatic(node as unknown as GoPtr<Node>)) {
    recv = classFieldsTransformer_tryGetClassThis(receiver);
    if (recv === undefined) {
      recv = NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!));
    }
  } else {
    recv = NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!));
  }

  const getter = classFieldsTransformer_createAccessorPropertyGetRedirector(receiver, node, modifiers, getterName, recv);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), getter, node as unknown as GoPtr<Node>);
  EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), getter, commentRange);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), getter, sourceMapRange);

  // create a fresh copy of the modifiers so that we don't duplicate comments
  let setterModifiers: GoPtr<ModifierList> = undefined;
  if (modifiers !== undefined) {
    setterModifiers = NodeFactory_NewModifierList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, CreateModifiersFromModifierFlags(modifiers!.ModifierFlags, (k) => NewToken(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, k)));
  }
  const setter = classFieldsTransformer_createAccessorPropertySetRedirector(receiver, node, setterModifiers, setterName, recv);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), setter, node as unknown as GoPtr<Node>);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), setter, EFNoComments);
  EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), setter, sourceMapRange);

  // Visit the results in a second pass
  const [visited] = NodeVisitor_VisitSlice(receiver!.accessorFieldResultVisitor as ConcreteNodeVisitor, [backingField, getter, setter]);
  return NewSyntaxList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, visited);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformPrivateFieldInitializer","kind":"method","status":"implemented","sigHash":"82ecd01870c64d98f31d543dd542bd2a3a65433c44c5df5e7dfed47ffc4bc9aa","bodyHash":"aa6150bfed23a960df0f911419fe6d1708ccf5916a94e1ea49340f7cee561456"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformPrivateFieldInitializer(node *ast.PropertyDeclaration) *ast.Node {
 * 	if tx.shouldTransformClassElementToWeakMap(node.AsNode()) {
 * 		// If we are transforming private elements into WeakMap/WeakSet, we should elide the node.
 * 		info := tx.accessPrivateIdentifier(node.Name())
 * 		debug.Assert(info != nil, "Undeclared private name for property declaration.")
 * 
 * 		// Leave invalid code untransformed
 * 		if !info.isValid {
 * 			return node.AsNode()
 * 		}
 * 
 * 		// If we encounter a valid private static field and we're not transforming
 * 		// class static blocks, convert to a static block initializer.
 * 		if info.isStatic && !tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 			// TODO: fix
 * 			statement := tx.transformPropertyOrClassStaticBlock(node.AsNode(), tx.Factory().NewThisExpression())
 * 			if statement != nil {
 * 				return tx.Factory().NewClassStaticBlockDeclaration(
 * 					nil, /*modifiers* /
 * 					tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{statement}), true /*multiLine* /),
 * 				)
 * 			}
 * 		}
 * 
 * 		return nil
 * 	}
 * 
 * 	if tx.shouldTransformInitializersUsingSet && !ast.HasStaticModifier(node.AsNode()) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil &&
 * 		tx.lexicalEnvironment.data.facts&classFactsWillHoistInitializersToConstructor != 0 {
 * 		return tx.Factory().UpdatePropertyDeclaration(
 * 			node,
 * 			tx.Visitor().VisitModifiers(node.Modifiers()),
 * 			node.Name(),
 * 			nil, /*postfixToken* /
 * 			nil, /*typeNode* /
 * 			nil, /*initializer* /
 * 		)
 * 	}
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false, "").AsPropertyDeclaration()
 * 	}
 * 
 * 	return tx.Factory().UpdatePropertyDeclaration(
 * 		node,
 * 		tx.modifierVisitor.VisitModifiers(node.Modifiers()),
 * 		tx.visitPropertyName(node.Name()),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		tx.Visitor().VisitNode(node.Initializer),
 * 	)
 * }
 */
export function classFieldsTransformer_transformPrivateFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  if (classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver, node as unknown as GoPtr<Node>)) {
    // If we are transforming private elements into WeakMap/WeakSet, we should elide the node.
    const info = classFieldsTransformer_accessPrivateIdentifier(receiver, Node_Name(node as unknown as GoPtr<Node>));
    debug.Assert(info !== undefined, "Undeclared private name for property declaration.");

    // Leave invalid code untransformed
    if (!info!.isValid) {
      return node as unknown as GoPtr<Node>;
    }

    // If we encounter a valid private static field and we're not transforming
    // class static blocks, convert to a static block initializer.
    if (info!.isStatic && !receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
      // TODO: fix
      const statement = classFieldsTransformer_transformPropertyOrClassStaticBlock(receiver, node as unknown as GoPtr<Node>, NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)));
      if (statement !== undefined) {
        return NewClassStaticBlockDeclaration(
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          undefined, /*modifiers*/
          NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [statement]), true /*multiLine*/),
        );
      }
    }

    return undefined;
  }

  if (receiver!.shouldTransformInitializersUsingSet && !HasStaticModifier(node as unknown as GoPtr<Node>) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined &&
    (receiver!.lexicalEnvironment.data.facts & classFactsWillHoistInitializersToConstructor) !== 0) {
    return NodeFactory_UpdatePropertyDeclaration(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      NodeVisitor_VisitModifiers((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Modifiers(node as unknown as GoPtr<Node>)),
      Node_Name(node as unknown as GoPtr<Node>),
      undefined, /*postfixToken*/
      undefined, /*typeNode*/
      undefined, /*initializer*/
    );
  }

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>, receiver!.isAnonymousClassNeedingAssignedName)) {
    node = AsPropertyDeclaration(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>, false, ""))!;
  }

  return NodeFactory_UpdatePropertyDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node,
    NodeVisitor_VisitModifiers(receiver!.modifierVisitor as ConcreteNodeVisitor, Node_Modifiers(node as unknown as GoPtr<Node>)),
    classFieldsTransformer_visitPropertyName(receiver, Node_Name(node as unknown as GoPtr<Node>) as GoPtr<PropertyName>),
    undefined, /*postfixToken*/
    undefined, /*typeNode*/
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Initializer(node as unknown as GoPtr<Node>)),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformPublicFieldInitializer","kind":"method","status":"implemented","sigHash":"2bc8394db88b072d35800221b7ae9fd6bfe0796c853f712aa46832ef728411e0","bodyHash":"988cb22f3a12824196b2f2281261b49291f03e6aab1ac94be276fda6201a8557"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformPublicFieldInitializer(node *ast.PropertyDeclaration) *ast.Node {
 * 	if tx.shouldTransformInitializers && !ast.IsAutoAccessorPropertyDeclaration(node.AsNode()) {
 * 		// Elide the property declaration; the initializer will be moved to the constructor.
 * 		// For computed property names, we still need to emit the expression.
 * 		expr := tx.getPropertyNameExpressionIfNeeded(node.Name(), node.Initializer != nil || tx.compilerOptions.GetUseDefineForClassFields())
 * 		if expr != nil {
 * 			for e := range flattenCommaList(expr) {
 * 				tx.addPendingExpressions(e)
 * 			}
 * 		}
 * 
 * 		// When target >= ES2022 (i.e., !shouldTransformPrivateElementsOrClassStaticBlocks) and we
 * 		// still need to transform initializers (useDefineForClassFields: false), static property
 * 		// initializers must be converted into `static { this.x = ...; }` blocks so that `this`
 * 		// refers to the class constructor inside the static block.
 * 		if ast.IsStatic(node.AsNode()) && !tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 			initializerStatement := tx.transformPropertyOrClassStaticBlock(node.AsNode(), tx.Factory().NewThisExpression())
 * 			if initializerStatement != nil {
 * 				staticBlock := tx.Factory().NewClassStaticBlockDeclaration(
 * 					nil, /*modifiers* /
 * 					tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{initializerStatement}), false),
 * 				)
 * 
 * 				tx.EmitContext().SetOriginal(staticBlock, node.AsNode())
 * 				tx.EmitContext().SetCommentRange(staticBlock, node.Loc)
 * 
 * 				tx.EmitContext().AddEmitFlags(initializerStatement, printer.EFNoComments)
 * 				return staticBlock
 * 			}
 * 		}
 * 
 * 		return nil
 * 	}
 * 
 * 	return tx.Factory().UpdatePropertyDeclaration(
 * 		node,
 * 		tx.modifierVisitor.VisitModifiers(node.Modifiers()),
 * 		tx.visitPropertyName(node.Name()),
 * 		nil, /*postfixToken* /
 * 		nil, /*typeNode* /
 * 		tx.Visitor().VisitNode(node.Initializer),
 * 	)
 * }
 */
export function classFieldsTransformer_transformPublicFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  if (receiver!.shouldTransformInitializers && !IsAutoAccessorPropertyDeclaration(node as unknown as GoPtr<Node>)) {
    // Elide the property declaration; the initializer will be moved to the constructor.
    // For computed property names, we still need to emit the expression.
    const expr = classFieldsTransformer_getPropertyNameExpressionIfNeeded(
      receiver,
      Node_Name(node as unknown as GoPtr<Node>) as GoPtr<PropertyName>,
      Node_Initializer(node as unknown as GoPtr<Node>) !== undefined || CompilerOptions_GetUseDefineForClassFields(receiver!.compilerOptions),
    );
    if (expr !== undefined) {
      flattenCommaList(expr)((e) => { classFieldsTransformer_addPendingExpressions(receiver, e); return true; });
    }

    // When target >= ES2022 (i.e., !shouldTransformPrivateElementsOrClassStaticBlocks) and we
    // still need to transform initializers (useDefineForClassFields: false), static property
    // initializers must be converted into `static { this.x = ...; }` blocks so that `this`
    // refers to the class constructor inside the static block.
    if (IsStatic(node as unknown as GoPtr<Node>) && !receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
      const initializerStatement = classFieldsTransformer_transformPropertyOrClassStaticBlock(receiver, node as unknown as GoPtr<Node>, NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)));
      if (initializerStatement !== undefined) {
        const staticBlock = NewClassStaticBlockDeclaration(
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          undefined, /*modifiers*/
          NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [initializerStatement]), false),
        );

        EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), staticBlock, node as unknown as GoPtr<Node>);
        EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), staticBlock, node!.Loc);

        EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), initializerStatement, EFNoComments);
        return staticBlock;
      }
    }

    return undefined;
  }

  return NodeFactory_UpdatePropertyDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node,
    NodeVisitor_VisitModifiers(receiver!.modifierVisitor as ConcreteNodeVisitor, Node_Modifiers(node as unknown as GoPtr<Node>)),
    classFieldsTransformer_visitPropertyName(receiver, Node_Name(node as unknown as GoPtr<Node>) as GoPtr<PropertyName>),
    undefined, /*postfixToken*/
    undefined, /*typeNode*/
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Initializer(node as unknown as GoPtr<Node>)),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformFieldInitializer","kind":"method","status":"implemented","sigHash":"0d511be92ec0d3ee215617e1fe12a33b4a84c74ddd0b322571c72c7702e0853e","bodyHash":"2b1c2ac6b91ee4d78bda6d89325da1e6548d9ba2e4203ee95b95fa848c2e97f2"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformFieldInitializer(node *ast.PropertyDeclaration) *ast.Node {
 * 	debug.Assert(!ast.HasDecorators(node.AsNode()), "Decorators should already have been transformed and elided.")
 * 	if ast.IsPrivateIdentifierClassElementDeclaration(node.AsNode()) {
 * 		return tx.transformPrivateFieldInitializer(node)
 * 	}
 * 	return tx.transformPublicFieldInitializer(node)
 * }
 */
export function classFieldsTransformer_transformFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node> {
  debug.Assert(!HasDecorators(node as unknown as GoPtr<Node>), "Decorators should already have been transformed and elided.");
  if (IsPrivateIdentifierClassElementDeclaration(node as unknown as GoPtr<Node>)) {
    return classFieldsTransformer_transformPrivateFieldInitializer(receiver, node);
  }
  return classFieldsTransformer_transformPublicFieldInitializer(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.shouldTransformAutoAccessorsInCurrentClass","kind":"method","status":"implemented","sigHash":"8d5ebdfd61c121e4e2180bc7dfe97bce1d4bb4c547229bc87cf4f45e4073ccd2","bodyHash":"a6234fa49eed066f8064586003653810a6ac286ed002dea4e39cd4eff2bb6fcf"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) shouldTransformAutoAccessorsInCurrentClass() bool {
 * 	if tx.shouldTransformAutoAccessors {
 * 		return true
 * 	}
 * 	// When targeting ESNext with useDefineForClassFields: false, auto-accessors are only
 * 	// transformed if the current class will hoist initializers to the constructor.
 * 	return tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil &&
 * 		tx.lexicalEnvironment.data.facts&classFactsWillHoistInitializersToConstructor != 0
 * }
 */
export function classFieldsTransformer_shouldTransformAutoAccessorsInCurrentClass(receiver: GoPtr<classFieldsTransformer>): bool {
  if (receiver!.shouldTransformAutoAccessors) {
    return true;
  }
  // When targeting ESNext with useDefineForClassFields: false, auto-accessors are only
  // transformed if the current class will hoist initializers to the constructor.
  return receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined &&
    (receiver!.lexicalEnvironment.data.facts & classFactsWillHoistInitializersToConstructor) !== 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPropertyDeclaration","kind":"method","status":"implemented","sigHash":"fa545bb4c95ea2928a452a11dbcc3e3c7574eb1d83cbd8e6c80241ec07441e14","bodyHash":"f8053c19cc76de992acfc4ac2cbebae12d22b71e0db9e244fc81e62128e2c55c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPropertyDeclaration(node *ast.Node) *ast.Node {
 * 	// If this is an auto-accessor, we defer to `transformAutoAccessor`. That function
 * 	// will in turn call `transformFieldInitializer` as needed.
 * 	propDecl := node.AsPropertyDeclaration()
 * 	if ast.IsAutoAccessorPropertyDeclaration(node) && (tx.shouldTransformAutoAccessorsInCurrentClass() ||
 * 		ast.HasStaticModifier(node) && tx.shouldAlwaysTransformPrivateStaticElements(node)) {
 * 		return tx.transformAutoAccessor(propDecl)
 * 	}
 * 	return tx.transformFieldInitializer(propDecl)
 * }
 */
export function classFieldsTransformer_visitPropertyDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  // If this is an auto-accessor, we defer to `transformAutoAccessor`. That function
  // will in turn call `transformFieldInitializer` as needed.
  const propDecl = AsPropertyDeclaration(node)!;
  if (IsAutoAccessorPropertyDeclaration(node) && (classFieldsTransformer_shouldTransformAutoAccessorsInCurrentClass(receiver) ||
    HasStaticModifier(node) && classFieldsTransformer_shouldAlwaysTransformPrivateStaticElements(receiver, node))) {
    return classFieldsTransformer_transformAutoAccessor(receiver, propDecl);
  }
  return classFieldsTransformer_transformFieldInitializer(receiver, propDecl);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createPrivateIdentifierAccess","kind":"method","status":"implemented","sigHash":"c0ed9d4236c4b262853ed316d4f13e526db753407ba9c5d6150f3770f8be2751","bodyHash":"6c8606e4c24c537abfcdc66aa9b91940c97ce37ab0bb44eed7b1b039a600dd8e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createPrivateIdentifierAccess(info *privateIdentifierInfo, receiver *ast.Expression) *ast.Expression {
 * 	receiver = tx.Visitor().VisitNode(receiver)
 * 	return tx.createPrivateIdentifierAccessHelper(info, receiver)
 * }
 */
export function classFieldsTransformer_createPrivateIdentifierAccess(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  receiver1 = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), receiver1);
  return classFieldsTransformer_createPrivateIdentifierAccessHelper(receiver, info, receiver1);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createPrivateIdentifierAccessHelper","kind":"method","status":"implemented","sigHash":"15deb597b76a6c9cb2bf5af47e8e9391a11231f639c7f4703ce40ba46347b7ec","bodyHash":"39e8d01f207296f664dca36f4ff75d59c236f7670a82f66948dfa70b823bb486"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createPrivateIdentifierAccessHelper(info *privateIdentifierInfo, receiver *ast.Expression) *ast.Expression {
 * 	tx.EmitContext().SetCommentRange(receiver, core.NewTextRange(-1, receiver.End()))
 * 
 * 	switch info.kind {
 * 	case printer.PrivateIdentifierKindAccessor:
 * 		return tx.Factory().NewClassPrivateFieldGetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			info.kind,
 * 			info.getterName,
 * 		)
 * 	case printer.PrivateIdentifierKindMethod:
 * 		return tx.Factory().NewClassPrivateFieldGetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			info.kind,
 * 			info.methodName,
 * 		)
 * 	case printer.PrivateIdentifierKindField:
 * 		var f *ast.IdentifierNode
 * 		if info.isStatic {
 * 			f = info.variableName
 * 		}
 * 		return tx.Factory().NewClassPrivateFieldGetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			info.kind,
 * 			f,
 * 		)
 * 	case printer.PrivateIdentifierKindUntransformed:
 * 		debug.Fail("Access helpers should not be created for untransformed private elements")
 * 		return nil
 * 	}
 * 	debug.AssertNever(info, "Unknown private element type")
 * 	return nil
 * }
 */
export function classFieldsTransformer_createPrivateIdentifierAccessHelper(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), receiver1, NewTextRange(-1, Node_End(receiver1)));

  switch (info!.kind) {
    case PrivateIdentifierKindAccessor:
      return NodeFactory_NewClassPrivateFieldGetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        receiver1,
        info!.brandCheckIdentifier,
        info!.kind,
        info!.getterName,
      );
    case PrivateIdentifierKindMethod:
      return NodeFactory_NewClassPrivateFieldGetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        receiver1,
        info!.brandCheckIdentifier,
        info!.kind,
        info!.methodName,
      );
    case PrivateIdentifierKindField: {
      const f: GoPtr<IdentifierNode> = info!.isStatic ? info!.variableName : undefined;
      return NodeFactory_NewClassPrivateFieldGetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        receiver1,
        info!.brandCheckIdentifier,
        info!.kind,
        f,
      );
    }
    case PrivateIdentifierKindUntransformed:
      debug.Fail("Access helpers should not be created for untransformed private elements");
      return undefined;
  }
  debug.AssertNever(info, "Unknown private element type");
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPropertyAccessExpression","kind":"method","status":"implemented","sigHash":"c6b765168522ba8bcc55e4704cd7afc0522f245c47ea507aa664982acfd48de9","bodyHash":"a4dce1f351bd2a2d7c89cfcbf4ad097a80ab1e792b61b72cbbe6d508c602e4b8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPropertyAccessExpression(node *ast.PropertyAccessExpression) *ast.Node {
 * 	if ast.IsPrivateIdentifier(node.Name()) {
 * 		info := tx.accessPrivateIdentifier(node.Name())
 * 		if info != nil {
 * 			result := tx.createPrivateIdentifierAccess(info, node.Expression)
 * 			tx.EmitContext().SetOriginal(result, node.AsNode())
 * 			result.Loc = node.Loc
 * 			return result
 * 		}
 * 	}
 * 	if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 		ast.IsSuperProperty(node.AsNode()) && ast.IsIdentifier(node.Name()) &&
 * 		isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		data := tx.lexicalEnvironment.data
 * 		if data.facts&classFactsClassWasDecorated != 0 {
 * 			return tx.visitInvalidSuperProperty(node.AsNode())
 * 		}
 * 		if data.classConstructor != nil && data.superClassReference != nil {
 * 			// converts `super.x` into `Reflect.get(_baseTemp, "x", _classTemp)`
 * 			superProperty := tx.Factory().NewReflectGetCall(
 * 				data.superClassReference,
 * 				tx.Factory().NewStringLiteralFromNode(node.Name()),
 * 				data.classConstructor,
 * 			)
 * 			tx.EmitContext().SetOriginal(superProperty, node.Expression)
 * 			superProperty.Loc = node.Expression.Loc
 * 			return superProperty
 * 		}
 * 	}
 * 	// Visit only the expression, not the name (when it's a regular identifier), to prevent
 * 	// substitution of property names. Strada's onSubstituteNode only fires for
 * 	// EmitHint.Expression, which excludes the .name of PropertyAccessExpression.
 * 	// Private identifier names are still visited through VisitEachChild so they can be
 * 	// transformed by visitPrivateIdentifier.
 * 	if ast.IsIdentifier(node.Name()) {
 * 		return tx.visitPropertyAccessExpressionForSubstitution(node)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitPropertyAccessExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAccessExpression>): GoPtr<Node> {
  if (IsPrivateIdentifier(node!.name)) {
    const info = classFieldsTransformer_accessPrivateIdentifier(receiver, node!.name);
    if (info !== undefined) {
      const result = classFieldsTransformer_createPrivateIdentifierAccess(receiver, info, node!.Expression);
      EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), result, node as unknown as GoPtr<Node>);
      result!.Loc = node!.Loc;
      return result;
    }
  }
  if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
    IsSuperProperty(node as unknown as GoPtr<Node>) && IsIdentifier(node!.name) &&
    isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    const data = receiver!.lexicalEnvironment.data;
    if ((data!.facts & classFactsClassWasDecorated) !== 0) {
      return classFieldsTransformer_visitInvalidSuperProperty(receiver, node as unknown as GoPtr<Node>);
    }
    if (data!.classConstructor !== undefined && data!.superClassReference !== undefined) {
      // converts `super.x` into `Reflect.get(_baseTemp, "x", _classTemp)`
      const superProperty = NodeFactory_NewReflectGetCall(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        data!.superClassReference,
        NodeFactory_NewStringLiteralFromNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), node!.name),
        data!.classConstructor,
      );
      EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), superProperty, node!.Expression);
      superProperty!.Loc = node!.Expression!.Loc;
      return superProperty;
    }
  }
  // Visit only the expression, not the name (when it's a regular identifier), to prevent
  // substitution of property names.
  // Private identifier names are still visited through VisitEachChild so they can be
  // transformed by visitPrivateIdentifier.
  if (IsIdentifier(node!.name)) {
    return classFieldsTransformer_visitPropertyAccessExpressionForSubstitution(receiver, node);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPropertyAccessExpressionForSubstitution","kind":"method","status":"implemented","sigHash":"7f8e6cf7ce24d29a43af6d3f11832d62eb8725c46d51f2b03f0780778cdf8582","bodyHash":"292561c5e85b0e8b7c1cd86433a364c566aa4bd60ef1ad6b2bb9a2467be7e084"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPropertyAccessExpressionForSubstitution(node *ast.PropertyAccessExpression) *ast.Node {
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	if expression != node.Expression {
 * 		return tx.Factory().UpdatePropertyAccessExpression(node, expression, node.QuestionDotToken, node.Name(), node.Flags)
 * 	}
 * 	return node.AsNode()
 * }
 */
export function classFieldsTransformer_visitPropertyAccessExpressionForSubstitution(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAccessExpression>): GoPtr<Node> {
  const expression = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression);
  if (expression !== node!.Expression) {
    return NodeFactory_UpdatePropertyAccessExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, node, expression, node!.QuestionDotToken, node!.name, node!.Flags);
  }
  return node as unknown as GoPtr<Node>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitElementAccessExpression","kind":"method","status":"implemented","sigHash":"74bf27e87d7fe92a6cab433758f036f24491ebee22a93dcd5984f0b4cc617284","bodyHash":"1b6867a7993e55af7755c08360307e01538902c1e544b0ec206d15573ee642a8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitElementAccessExpression(node *ast.ElementAccessExpression) *ast.Node {
 * 	if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 		ast.IsSuperProperty(node.AsNode()) &&
 * 		isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		data := tx.lexicalEnvironment.data
 * 		if data.facts&classFactsClassWasDecorated != 0 {
 * 			return tx.visitInvalidSuperProperty(node.AsNode())
 * 		}
 * 		if data.classConstructor != nil && data.superClassReference != nil {
 * 			// converts `super[x]` into `Reflect.get(_baseTemp, x, _classTemp)`
 * 			superProperty := tx.Factory().NewReflectGetCall(
 * 				data.superClassReference,
 * 				tx.Visitor().VisitNode(node.ArgumentExpression),
 * 				data.classConstructor,
 * 			)
 * 			tx.EmitContext().SetOriginal(superProperty, node.Expression)
 * 			superProperty.Loc = node.Expression.Loc
 * 			return superProperty
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitElementAccessExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ElementAccessExpression>): GoPtr<Node> {
  if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
    IsSuperProperty(node as unknown as GoPtr<Node>) &&
    isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    const data = receiver!.lexicalEnvironment.data;
    if ((data!.facts & classFactsClassWasDecorated) !== 0) {
      return classFieldsTransformer_visitInvalidSuperProperty(receiver, node as unknown as GoPtr<Node>);
    }
    if (data!.classConstructor !== undefined && data!.superClassReference !== undefined) {
      // converts `super[x]` into `Reflect.get(_baseTemp, x, _classTemp)`
      const superProperty = NodeFactory_NewReflectGetCall(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        data!.superClassReference,
        NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.ArgumentExpression),
        data!.classConstructor,
      );
      EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), superProperty, node!.Expression);
      superProperty!.Loc = node!.Expression!.Loc;
      return superProperty;
    }
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitPreOrPostfixUnaryExpression","kind":"method","status":"implemented","sigHash":"506c57e39e41fcdcd89655848aa72720c0054604f20f6f91b1a016db36c90e83","bodyHash":"2d2abc02e4a3f709e1248436b32569878e27294c4d2c4b3d278e1af1edc2f68f"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitPreOrPostfixUnaryExpression(node *ast.Node, discarded bool) *ast.Node {
 * 	var operator ast.Kind
 * 	var operand *ast.Node
 * 	if ast.IsPrefixUnaryExpression(node) {
 * 		operator = node.AsPrefixUnaryExpression().Operator
 * 		operand = node.AsPrefixUnaryExpression().Operand
 * 	} else {
 * 		operator = node.AsPostfixUnaryExpression().Operator
 * 		operand = node.AsPostfixUnaryExpression().Operand
 * 	}
 * 
 * 	if operator == ast.KindPlusPlusToken || operator == ast.KindMinusMinusToken {
 * 		operandSkipped := ast.SkipParentheses(operand)
 * 
 * 		// Private identifier property access
 * 		if ast.IsPropertyAccessExpression(operandSkipped) && ast.IsPrivateIdentifier(operandSkipped.Name()) {
 * 			info := tx.accessPrivateIdentifier(operandSkipped.Name())
 * 			if info != nil {
 * 				receiver := tx.Visitor().VisitNode(operandSkipped.Expression())
 * 				readExpression, initializeExpression := tx.createCopiableReceiverExpr(receiver)
 * 
 * 				expression := tx.createPrivateIdentifierAccessHelper(info, readExpression)
 * 				var temp *ast.IdentifierNode
 * 				if !ast.IsPrefixUnaryExpression(node) && !discarded {
 * 					temp = tx.Factory().NewTempVariable()
 * 					tx.EmitContext().AddVariableDeclaration(temp)
 * 				}
 * 				expression = expandPreOrPostfixIncrementOrDecrementExpression(tx.Factory(), tx.EmitContext(), node, expression, temp)
 * 				assignReceiver := readExpression
 * 				if initializeExpression != nil {
 * 					assignReceiver = initializeExpression
 * 				}
 * 				expression = tx.createPrivateIdentifierAssignment(info, assignReceiver, expression, ast.KindEqualsToken)
 * 				tx.EmitContext().SetOriginal(expression, node)
 * 				expression.Loc = node.Loc
 * 				if temp != nil {
 * 					expression = tx.Factory().NewCommaExpression(expression, temp)
 * 					expression.Loc = node.Loc
 * 				}
 * 				return expression
 * 			}
 * 		} else if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 			ast.IsSuperProperty(operandSkipped) &&
 * 			isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 			tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 			// converts `++super.a` into `(Reflect.set(_baseTemp, "a", (_a = Reflect.get(_baseTemp, "a", _classTemp), _b = ++_a), _classTemp), _b)`
 * 			// converts `++super[f()]` into `(Reflect.set(_baseTemp, _a = f(), (_b = Reflect.get(_baseTemp, _a, _classTemp), _c = ++_b), _classTemp), _c)`
 * 			// converts `--super.a` into `(Reflect.set(_baseTemp, "a", (_a = Reflect.get(_baseTemp, "a", _classTemp), _b = --_a), _classTemp), _b)`
 * 			// converts `--super[f()]` into `(Reflect.set(_baseTemp, _a = f(), (_b = Reflect.get(_baseTemp, _a, _classTemp), _c = --_b), _classTemp), _c)`
 * 			// converts `super.a++` into `(Reflect.set(_baseTemp, "a", (_a = Reflect.get(_baseTemp, "a", _classTemp), _b = _a++), _classTemp), _b)`
 * 			// converts `super[f()]++` into `(Reflect.set(_baseTemp, _a = f(), (_b = Reflect.get(_baseTemp, _a, _classTemp), _c = _b++), _classTemp), _c)`
 * 			// converts `super.a--` into `(Reflect.set(_baseTemp, "a", (_a = Reflect.get(_baseTemp, "a", _classTemp), _b = _a--), _classTemp), _b)`
 * 			// converts `super[f()]--` into `(Reflect.set(_baseTemp, _a = f(), (_b = Reflect.get(_baseTemp, _a, _classTemp), _c = _b--), _classTemp), _c)`
 * 			data := tx.lexicalEnvironment.data
 * 			if data.facts&classFactsClassWasDecorated != 0 {
 * 				visitedExpr := tx.visitInvalidSuperProperty(operandSkipped)
 * 				if ast.IsPrefixUnaryExpression(node) {
 * 					return tx.Factory().UpdatePrefixUnaryExpression(node.AsPrefixUnaryExpression(), node.AsPrefixUnaryExpression().Operator, visitedExpr)
 * 				}
 * 				return tx.Factory().UpdatePostfixUnaryExpression(node.AsPostfixUnaryExpression(), visitedExpr, node.AsPostfixUnaryExpression().Operator)
 * 			}
 * 			if data.classConstructor != nil && data.superClassReference != nil {
 * 				var setterName *ast.Expression
 * 				var getterName *ast.Expression
 * 				if ast.IsPropertyAccessExpression(operandSkipped) {
 * 					if ast.IsIdentifier(operandSkipped.Name()) {
 * 						getterName = tx.Factory().NewStringLiteralFromNode(operandSkipped.Name())
 * 						setterName = getterName
 * 					}
 * 				} else if ast.IsElementAccessExpression(operandSkipped) {
 * 					if transformers.IsSimpleInlineableExpression(operandSkipped.AsElementAccessExpression().ArgumentExpression) {
 * 						getterName = operandSkipped.AsElementAccessExpression().ArgumentExpression
 * 						setterName = getterName
 * 					} else {
 * 						getterName = tx.Factory().NewTempVariable()
 * 						tx.EmitContext().AddVariableDeclaration(getterName)
 * 						setterName = tx.Factory().NewAssignmentExpression(getterName, tx.Visitor().VisitNode(operandSkipped.AsElementAccessExpression().ArgumentExpression))
 * 					}
 * 				}
 * 				if setterName != nil && getterName != nil {
 * 					expression := tx.Factory().NewReflectGetCall(data.superClassReference, getterName, data.classConstructor)
 * 					expression.Loc = operandSkipped.Loc
 * 
 * 					var temp *ast.IdentifierNode
 * 					if !discarded {
 * 						temp = tx.Factory().NewTempVariable()
 * 						tx.EmitContext().AddVariableDeclaration(temp)
 * 					}
 * 					expression = expandPreOrPostfixIncrementOrDecrementExpression(tx.Factory(), tx.EmitContext(), node, expression, temp)
 * 					expression = tx.Factory().NewReflectSetCall(data.superClassReference, setterName, expression, data.classConstructor)
 * 					tx.EmitContext().SetOriginal(expression, node)
 * 					expression.Loc = node.Loc
 * 					if temp != nil {
 * 						expression = tx.Factory().NewCommaExpression(expression, temp)
 * 						expression.Loc = node.Loc
 * 					}
 * 					return expression
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitPreOrPostfixUnaryExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node> {
  let operator: Kind;
  let operand: GoPtr<Node>;
  if (IsPrefixUnaryExpression(node)) {
    operator = AsPrefixUnaryExpression(node)!.Operator;
    operand = AsPrefixUnaryExpression(node)!.Operand;
  } else {
    operator = AsPostfixUnaryExpression(node)!.Operator;
    operand = AsPostfixUnaryExpression(node)!.Operand;
  }

  if (operator === KindPlusPlusToken || operator === KindMinusMinusToken) {
    const operandSkipped = SkipParentheses(operand);

    // Private identifier property access
    if (IsPropertyAccessExpression(operandSkipped) && IsPrivateIdentifier(AsPropertyAccessExpression(operandSkipped)!.name)) {
      const info = classFieldsTransformer_accessPrivateIdentifier(receiver, AsPropertyAccessExpression(operandSkipped)!.name);
      if (info !== undefined) {
        const receiverExpr = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Expression(operandSkipped));
        const [readExpression, initializeExpression] = classFieldsTransformer_createCopiableReceiverExpr(receiver, receiverExpr);

        let expression: GoPtr<Expression> = classFieldsTransformer_createPrivateIdentifierAccessHelper(receiver, info, readExpression);
        let temp: GoPtr<IdentifierNode> = undefined;
        if (!IsPrefixUnaryExpression(node) && !discarded) {
          temp = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
          EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
        }
        expression = expandPreOrPostfixIncrementOrDecrementExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, expression, temp);
        const assignReceiver = initializeExpression !== undefined ? initializeExpression : readExpression;
        expression = classFieldsTransformer_createPrivateIdentifierAssignment(receiver, info, assignReceiver, expression, KindEqualsToken);
        EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, node);
        expression!.Loc = node!.Loc;
        if (temp !== undefined) {
          expression = NodeFactory_NewCommaExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), expression, temp);
          expression!.Loc = node!.Loc;
        }
        return expression;
      }
    } else if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
      IsSuperProperty(operandSkipped) &&
      isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
      receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
      const data = receiver!.lexicalEnvironment.data;
      if ((data!.facts & classFactsClassWasDecorated) !== 0) {
        const visitedExpr = classFieldsTransformer_visitInvalidSuperProperty(receiver, operandSkipped);
        if (IsPrefixUnaryExpression(node)) {
          return NodeFactory_UpdatePrefixUnaryExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsPrefixUnaryExpression(node)!, AsPrefixUnaryExpression(node)!.Operator, visitedExpr);
        }
        return NodeFactory_UpdatePostfixUnaryExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, AsPostfixUnaryExpression(node)!, visitedExpr, AsPostfixUnaryExpression(node)!.Operator);
      }
      if (data!.classConstructor !== undefined && data!.superClassReference !== undefined) {
        let setterName: GoPtr<Expression> = undefined;
        let getterName: GoPtr<Expression> = undefined;
        if (IsPropertyAccessExpression(operandSkipped)) {
          if (IsIdentifier(AsPropertyAccessExpression(operandSkipped)!.name)) {
            getterName = NodeFactory_NewStringLiteralFromNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), AsPropertyAccessExpression(operandSkipped)!.name);
            setterName = getterName;
          }
        } else if (IsElementAccessExpression(operandSkipped)) {
          if (IsSimpleInlineableExpression(AsElementAccessExpression(operandSkipped)!.ArgumentExpression)) {
            getterName = AsElementAccessExpression(operandSkipped)!.ArgumentExpression;
            setterName = getterName;
          } else {
            getterName = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
            EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), getterName);
            setterName = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), getterName, NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsElementAccessExpression(operandSkipped)!.ArgumentExpression));
          }
        }
        if (setterName !== undefined && getterName !== undefined) {
          let expression: GoPtr<Expression> = NodeFactory_NewReflectGetCall(Transformer_Factory(receiver!.__tsgoEmbedded0!), data!.superClassReference, getterName, data!.classConstructor);
          expression!.Loc = operandSkipped!.Loc;

          let temp: GoPtr<IdentifierNode> = undefined;
          if (!discarded) {
            temp = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
            EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
          }
          expression = expandPreOrPostfixIncrementOrDecrementExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, expression, temp);
          expression = NodeFactory_NewReflectSetCall(Transformer_Factory(receiver!.__tsgoEmbedded0!), data!.superClassReference, setterName, expression, data!.classConstructor);
          EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, node);
          expression!.Loc = node!.Loc;
          if (temp !== undefined) {
            expression = NodeFactory_NewCommaExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), expression, temp);
            expression!.Loc = node!.Loc;
          }
          return expression;
        }
      }
    }
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitForStatement","kind":"method","status":"implemented","sigHash":"8db4c4876b90308fb266931948ab73c80f9f0764dab925e181fa498905ae3ce1","bodyHash":"f448372b789aee100e00cd250228ee3411ee116e3dc57563a18d0621071f33c4"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitForStatement(node *ast.ForStatement) *ast.Node {
 * 	initializer := tx.discardedValueVisitor.VisitNode(node.Initializer)
 * 	condition := tx.Visitor().VisitNode(node.Condition)
 * 	incrementor := tx.discardedValueVisitor.VisitNode(node.Incrementor)
 * 	saved := tx.inIterationStatement
 * 	tx.inIterationStatement = true
 * 	body := tx.EmitContext().VisitIterationBody(node.Statement, tx.Visitor())
 * 	tx.inIterationStatement = saved
 * 	return tx.Factory().UpdateForStatement(node, initializer, condition, incrementor, body)
 * }
 */
export function classFieldsTransformer_visitForStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ForStatement>): GoPtr<Node> {
  const initializer = NodeVisitor_VisitNode(receiver!.discardedValueVisitor as ConcreteNodeVisitor, node!.Initializer);
  const condition = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Condition);
  const incrementor = NodeVisitor_VisitNode(receiver!.discardedValueVisitor as ConcreteNodeVisitor, node!.Incrementor);
  const saved = receiver!.inIterationStatement;
  receiver!.inIterationStatement = true;
  const body = EmitContext_VisitIterationBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node!.Statement, Transformer_Visitor(receiver!.__tsgoEmbedded0!));
  receiver!.inIterationStatement = saved;
  return NodeFactory_UpdateForStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, node, initializer, condition, incrementor, body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitExpressionStatement","kind":"method","status":"implemented","sigHash":"f6063ed668fe7801d5f2608fd20da4a979055acb6f0b7de3c17b439b43368238","bodyHash":"1bf2ade0695a3bd8ba66ded95b2940281690e1a76ae25a21a9b3d927559e6921"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitExpressionStatement(node *ast.ExpressionStatement) *ast.Node {
 * 	// Preserve private identifiers that appear directly as the expression of an
 * 	// ExpressionStatement (e.g., `#;`). This is error-recovery output from the parser
 * 	// for invalid syntax. Keeping it ensures the runtime throws a SyntaxError rather
 * 	// than silently succeeding with an empty statement.
 * 	if ast.IsPrivateIdentifier(node.Expression) && tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		return node.AsNode()
 * 	}
 * 	return tx.Factory().UpdateExpressionStatement(
 * 		node,
 * 		tx.discardedValueVisitor.VisitNode(node.Expression),
 * 	)
 * }
 */
export function classFieldsTransformer_visitExpressionStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExpressionStatement>): GoPtr<Node> {
  // Preserve private identifiers that appear directly as the expression of an
  // ExpressionStatement (e.g., `#;`). This is error-recovery output from the parser
  // for invalid syntax.
  if (IsPrivateIdentifier(node!.Expression) && receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    return node as unknown as GoPtr<Node>;
  }
  return NodeFactory_UpdateExpressionStatement(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    node,
    NodeVisitor_VisitNode(receiver!.discardedValueVisitor as ConcreteNodeVisitor, node!.Expression),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createCopiableReceiverExpr","kind":"method","status":"implemented","sigHash":"5676e24fad7f6a1d69b1bab250aebd642568d2b3f309044b3af04c65068743b5","bodyHash":"86fbe7dbb81ac87d548644b75fde4965d9ddf030ad264d0738905179f6f23e07"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createCopiableReceiverExpr(receiver *ast.Expression) (readExpression *ast.Expression, initializeExpression *ast.Expression) {
 * 	clone := receiver
 * 	if !ast.NodeIsSynthesized(receiver) {
 * 		clone = receiver.Clone(tx.Factory())
 * 	}
 * 	if transformers.IsSimpleInlineableExpression(receiver) {
 * 		return clone, nil
 * 	}
 * 	readExpression = tx.Factory().NewTempVariable()
 * 	tx.EmitContext().AddVariableDeclaration(readExpression)
 * 	initializeExpression = tx.Factory().NewAssignmentExpression(readExpression, clone)
 * 	return readExpression, initializeExpression
 * }
 */
export function classFieldsTransformer_createCopiableReceiverExpr(receiver: GoPtr<classFieldsTransformer>, receiver1: GoPtr<Expression>): [GoPtr<Expression>, GoPtr<Expression>] {
  let clone: GoPtr<Expression> = receiver1;
  if (!NodeIsSynthesized(receiver1)) {
    clone = Node_Clone(receiver1, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<Expression>;
  }
  if (IsSimpleInlineableExpression(receiver1)) {
    return [clone, undefined];
  }
  const readExpression = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
  EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), readExpression);
  const initializeExpression = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), readExpression, clone);
  return [readExpression, initializeExpression];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitCallExpression","kind":"method","status":"implemented","sigHash":"5d45dc635efc5fa90d2d9bac2645b28a27fc9075da0474213490a6e2046b4014","bodyHash":"899b5e1b40759fa14705f5f2998d50f3be546a253ea8ad38bad2d49485ac4d41"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitCallExpression(node *ast.CallExpression) *ast.Node {
 * 	if ast.IsPropertyAccessExpression(node.Expression) && ast.IsPrivateIdentifier(node.Expression.AsPropertyAccessExpression().Name()) &&
 * 		tx.accessPrivateIdentifier(node.Expression.AsPropertyAccessExpression().Name()) != nil {
 * 		// obj.#x()
 * 
 * 		// Transform call expressions of private names to properly bind the `this` parameter.
 * 		thisArg, target := tx.createCallBinding(node.Expression)
 * 		visitedTarget := tx.Visitor().VisitNode(target)
 * 		visitedThisArg := tx.Visitor().VisitNode(thisArg)
 * 		visitedArgs := tx.Visitor().VisitNodes(node.Arguments)
 * 		allArgs := make([]*ast.Node, 0, 1+len(visitedArgs.Nodes))
 * 		allArgs = append(allArgs, visitedThisArg)
 * 		allArgs = append(allArgs, visitedArgs.Nodes...)
 * 		if node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 			return tx.Factory().UpdateCallExpression(
 * 				node,
 * 				tx.Factory().NewPropertyAccessExpression(visitedTarget, node.QuestionDotToken, tx.Factory().NewIdentifier("call"), ast.NodeFlagsOptionalChain),
 * 				nil, /*questionDotToken* /
 * 				nil, /*typeArguments* /
 * 				tx.Factory().NewNodeList(allArgs),
 * 				node.Flags,
 * 			)
 * 		}
 * 		return tx.Factory().UpdateCallExpression(
 * 			node,
 * 			tx.Factory().NewPropertyAccessExpression(visitedTarget, nil, tx.Factory().NewIdentifier("call"), ast.NodeFlagsNone),
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Factory().NewNodeList(allArgs),
 * 			node.Flags,
 * 		)
 * 	}
 * 
 * 	if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 		ast.IsSuperProperty(node.Expression) &&
 * 		isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil &&
 * 		tx.lexicalEnvironment.data.classConstructor != nil {
 * 		// super.x()
 * 		// super[x]()
 * 
 * 		// converts `super.f(...)` into `Reflect.get(_baseTemp, "f", _classTemp).call(_classTemp, ...)`
 * 		invocation := tx.Factory().NewFunctionCallCall(
 * 			tx.Visitor().VisitNode(node.Expression),
 * 			tx.lexicalEnvironment.data.classConstructor,
 * 			tx.Visitor().VisitNodes(node.Arguments).Nodes,
 * 		)
 * 		tx.EmitContext().SetOriginal(invocation, node.AsNode())
 * 		invocation.Loc = node.Loc
 * 		return invocation
 * 	}
 * 
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitCallExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<CallExpression>): GoPtr<Node> {
  if (IsPropertyAccessExpression(node!.Expression) && IsPrivateIdentifier(AsPropertyAccessExpression(node!.Expression)!.name) &&
    classFieldsTransformer_accessPrivateIdentifier(receiver, AsPropertyAccessExpression(node!.Expression)!.name) !== undefined) {
    const [thisArg, target] = classFieldsTransformer_createCallBinding(receiver, node!.Expression);
    const visitedTarget = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), target);
    const visitedThisArg = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), thisArg);
    const visitedArgs = NodeVisitor_VisitNodes((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Arguments);
    const allArgs: GoPtr<Node>[] = [visitedThisArg as GoPtr<Node>, ...(visitedArgs ? visitedArgs.Nodes : [])];
    if ((node!.Flags & NodeFlagsOptionalChain) !== 0) {
      return NodeFactory_UpdateCallExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        node,
        NewPropertyAccessExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, visitedTarget, node!.QuestionDotToken, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "call"), NodeFlagsOptionalChain),
        undefined,
        undefined,
        NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, allArgs),
        node!.Flags,
      );
    }
    return NodeFactory_UpdateCallExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      NewPropertyAccessExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, visitedTarget, undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "call"), NodeFlagsNone),
      undefined,
      undefined,
      NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, allArgs),
      node!.Flags,
    );
  }

  if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
    IsSuperProperty(node!.Expression) &&
    isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined &&
    receiver!.lexicalEnvironment.data.classConstructor !== undefined) {
    const invocation = NodeFactory_NewFunctionCallCall(
      Transformer_Factory(receiver!.__tsgoEmbedded0!),
      NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression),
      receiver!.lexicalEnvironment.data.classConstructor,
      NodeVisitor_VisitNodes((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Arguments)?.Nodes ?? [],
    );
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), invocation, node as unknown as GoPtr<Node>);
    invocation!.Loc = node!.Loc;
    return invocation;
  }

  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitTaggedTemplateExpression","kind":"method","status":"implemented","sigHash":"7dd4923e2ff78033a22980c8e409b2e17e64d00e34ac5ba5d954c17d89e0dd8f","bodyHash":"49465b68f33ab911496078f1fdacc09c150d3db162aae48ce177369e18cf26df"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitTaggedTemplateExpression(node *ast.TaggedTemplateExpression) *ast.Node {
 * 	if ast.IsPropertyAccessExpression(node.Tag) && ast.IsPrivateIdentifier(node.Tag.AsPropertyAccessExpression().Name()) &&
 * 		tx.accessPrivateIdentifier(node.Tag.AsPropertyAccessExpression().Name()) != nil {
 * 		// Bind the `this` correctly for tagged template literals when the tag is a private identifier property access.
 * 		thisArg, target := tx.createCallBinding(node.Tag)
 * 		bindExpr := tx.Factory().NewCallExpression(
 * 			tx.Factory().NewPropertyAccessExpression(tx.Visitor().VisitNode(target), nil, tx.Factory().NewIdentifier("bind"), ast.NodeFlagsNone),
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Factory().NewNodeList([]*ast.Node{tx.Visitor().VisitNode(thisArg)}),
 * 			ast.NodeFlagsNone,
 * 		)
 * 		return tx.Factory().UpdateTaggedTemplateExpression(
 * 			node,
 * 			bindExpr,
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Visitor().VisitNode(node.Template),
 * 			node.Flags,
 * 		)
 * 	}
 * 
 * 	if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 		ast.IsSuperProperty(node.Tag) &&
 * 		isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil &&
 * 		tx.lexicalEnvironment.data.classConstructor != nil {
 * 		// converts `` super.f`x` `` into `` Reflect.get(_baseTemp, "f", _classTemp).bind(_classTemp)`x` ``
 * 		invocation := tx.Factory().NewFunctionBindCall(
 * 			tx.Visitor().VisitNode(node.Tag),
 * 			tx.lexicalEnvironment.data.classConstructor,
 * 			nil,
 * 		)
 * 		tx.EmitContext().SetOriginal(invocation, node.AsNode())
 * 		invocation.Loc = node.Loc
 * 		return tx.Factory().UpdateTaggedTemplateExpression(
 * 			node,
 * 			invocation,
 * 			nil, /*questionDotToken* /
 * 			nil, /*typeArguments* /
 * 			tx.Visitor().VisitNode(node.Template),
 * 			node.Flags,
 * 		)
 * 	}
 * 
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitTaggedTemplateExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<TaggedTemplateExpression>): GoPtr<Node> {
  if (IsPropertyAccessExpression(node!.Tag) && IsPrivateIdentifier(AsPropertyAccessExpression(node!.Tag)!.name) &&
    classFieldsTransformer_accessPrivateIdentifier(receiver, AsPropertyAccessExpression(node!.Tag)!.name) !== undefined) {
    const [thisArg, target] = classFieldsTransformer_createCallBinding(receiver, node!.Tag);
    const bindExpr = NewCallExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      NewPropertyAccessExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), target), undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "bind"), NodeFlagsNone),
      undefined,
      undefined,
      NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), thisArg) as GoPtr<Node>]),
      NodeFlagsNone,
    );
    return NodeFactory_UpdateTaggedTemplateExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      bindExpr,
      undefined,
      undefined,
      NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Template),
      node!.Flags,
    );
  }

  if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
    IsSuperProperty(node!.Tag) &&
    isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined &&
    receiver!.lexicalEnvironment.data.classConstructor !== undefined) {
    const invocation = NodeFactory_NewFunctionBindCall(
      Transformer_Factory(receiver!.__tsgoEmbedded0!),
      NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Tag),
      receiver!.lexicalEnvironment.data.classConstructor,
      [],
    );
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), invocation, node as unknown as GoPtr<Node>);
    invocation!.Loc = node!.Loc;
    return NodeFactory_UpdateTaggedTemplateExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      invocation,
      undefined,
      undefined,
      NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Template),
      node!.Flags,
    );
  }

  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"deb413c5f61b0065d00ee4812d843e992c576cd7fc5d30a603d42580ff5b5916","bodyHash":"33007fabc57406b83f20c472e49962ee706efc134ccee0ba454a7456634e95bd"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformClassStaticBlockDeclaration(node *ast.Node) *ast.Expression {
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		if isClassThisAssignmentBlock(tx.EmitContext(), node) {
 * 			result := tx.Visitor().VisitNode(node.AsClassStaticBlockDeclaration().Body.AsBlock().Statements.Nodes[0].Expression())
 * 			// If the generated `_classThis` assignment is a noop (i.e., `_classThis = _classThis`), we can
 * 			// eliminate the expression
 * 			if ast.IsAssignmentExpression(result, true /*excludeCompoundAssignment* /) {
 * 				binary := result.AsBinaryExpression()
 * 				if binary.Left == binary.Right {
 * 					return nil
 * 				}
 * 			}
 * 			return result
 * 		}
 * 
 * 		if isClassNamedEvaluationHelperBlock(tx.EmitContext(), node) {
 * 			return tx.Visitor().VisitNode(node.AsClassStaticBlockDeclaration().Body.AsBlock().Statements.Nodes[0].Expression())
 * 		}
 * 
 * 		tx.EmitContext().StartVariableEnvironment()
 * 		statements := tx.setCurrentClassElementAndVisitStatements(node, node.AsClassStaticBlockDeclaration().Body.AsBlock().Statements.Nodes)
 * 		statements = tx.EmitContext().EndAndMergeVariableEnvironment(statements)
 * 
 * 		iife := tx.Factory().NewImmediatelyInvokedArrowFunction(statements)
 * 		arrowFunction := ast.SkipParentheses(iife.Expression())
 * 		tx.EmitContext().SetOriginal(arrowFunction, node)
 * 		tx.EmitContext().AddEmitFlags(arrowFunction, printer.EFNoLexicalArguments)
 * 		// Preserve the statement list source range so the printer can emit detached comments
 * 		// (e.g., `// do` inside an otherwise empty static block)
 * 		arrowFunction.AsArrowFunction().Body.AsBlock().Statements.Loc = node.AsClassStaticBlockDeclaration().Body.AsBlock().Statements.Loc
 * 		tx.EmitContext().SetOriginal(iife, node)
 * 		tx.EmitContext().AssignSourceMapRange(iife, node)
 * 		return iife
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_transformClassStaticBlockDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Expression> {
  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    if (isClassThisAssignmentBlock(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)) {
      const firstStatement = AsBlock(AsClassStaticBlockDeclaration(node)!.Body as unknown as GoPtr<Node>)!.Statements!.Nodes[0];
      const result = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Expression(firstStatement));
      if (IsAssignmentExpression(result, true)) {
        const binary = AsBinaryExpression(result);
        if (binary!.Left === binary!.Right) {
          return undefined;
        }
      }
      return result as GoPtr<Expression>;
    }

    if (isClassNamedEvaluationHelperBlock(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)) {
      const firstStatement = AsBlock(AsClassStaticBlockDeclaration(node)!.Body as unknown as GoPtr<Node>)!.Statements!.Nodes[0];
      return NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Expression(firstStatement)) as GoPtr<Expression>;
    }

    EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));
    let statements = classFieldsTransformer_setCurrentClassElementAndVisitStatements(
      receiver,
      node,
      AsBlock(AsClassStaticBlockDeclaration(node)!.Body as unknown as GoPtr<Node>)!.Statements!.Nodes,
    );
    statements = EmitContext_EndAndMergeVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statements);

    const iife = NodeFactory_NewImmediatelyInvokedArrowFunction(Transformer_Factory(receiver!.__tsgoEmbedded0!), statements);
    const arrowFunction = SkipParentheses(AsCallExpression(iife as unknown as GoPtr<Node>)!.Expression as GoPtr<Expression>);
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), arrowFunction, node);
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), arrowFunction, EFNoLexicalArguments);
    // Preserve statement list source range for detached comment emission
    AsBlock(AsArrowFunction(arrowFunction as unknown as GoPtr<Node>)!.Body as unknown as GoPtr<Node>)!.Statements!.Loc =
      AsBlock(AsClassStaticBlockDeclaration(node)!.Body as unknown as GoPtr<Node>)!.Statements!.Loc;
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), iife as unknown as GoPtr<Node>, node);
    EmitContext_AssignSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), iife as unknown as GoPtr<Node>, node);
    // Note: Go also calls AddEmitFlags(arrowFunction, EFNoLexicalThis) here, but EFNoLexicalThis is not yet ported
    return iife;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setCurrentClassElementAndVisitStatements","kind":"method","status":"implemented","sigHash":"785b1778adced7434fcb56eae76141dbbaa217cd5635241014f213b5b9af4a6f","bodyHash":"5ea742d99d50dcf301875fcbdaec0272cb571aa84b32db03514a50692cf4d8e1"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setCurrentClassElementAndVisitStatements(classElement *ast.Node, statements []*ast.Statement) []*ast.Statement {
 * 	savedCurrentClassElement := tx.currentClassElement
 * 	tx.currentClassElement = classElement
 * 	result, _ := tx.Visitor().VisitSlice(statements)
 * 	tx.currentClassElement = savedCurrentClassElement
 * 	return result
 * }
 */
export function classFieldsTransformer_setCurrentClassElementAndVisitStatements(receiver: GoPtr<classFieldsTransformer>, classElement: GoPtr<Node>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>> {
  const savedCurrentClassElement = receiver!.currentClassElement;
  receiver!.currentClassElement = classElement;
  const [result] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), statements);
  receiver!.currentClassElement = savedCurrentClassElement;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.isAnonymousClassNeedingAssignedNameWorker","kind":"method","status":"implemented","sigHash":"bd9f55d70104d6d855dc84f13fdfa754437746cef34986f50998d7911fe5add0","bodyHash":"09d42176913ac7765786ceb49e4ccfe4b2de54a2b668d6fe000db3f228f4a7ab"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) isAnonymousClassNeedingAssignedNameWorker(node *anonymousFunctionDefinition) bool {
 * 	if ast.IsClassExpression(node) && node.Name() == nil {
 * 		staticPropertiesOrClassStaticBlocks := tx.getStaticPropertiesAndClassStaticBlock(node)
 * 		if core.Some(staticPropertiesOrClassStaticBlocks, func(n *ast.Node) bool {
 * 			return isClassNamedEvaluationHelperBlock(tx.EmitContext(), n)
 * 		}) {
 * 			return false
 * 		}
 * 		hasTransformableStatics := (tx.shouldTransformPrivateElementsOrClassStaticBlocks ||
 * 			tx.nodeHasTransformPrivateStaticElementsFlag(node)) &&
 * 			core.Some(staticPropertiesOrClassStaticBlocks, func(n *ast.Node) bool {
 * 				return ast.IsClassStaticBlockDeclaration(n) ||
 * 					ast.IsPrivateIdentifierClassElementDeclaration(n) ||
 * 					tx.shouldTransformInitializers && ast.IsInitializedProperty(n)
 * 			})
 * 		return hasTransformableStatics
 * 	}
 * 	return false
 * }
 */
export function classFieldsTransformer_isAnonymousClassNeedingAssignedNameWorker(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<anonymousFunctionDefinition>): bool {
  if (IsClassExpression(node as unknown as GoPtr<Node>) && Node_Name(node as unknown as GoPtr<Node>) === undefined) {
    const staticPropertiesOrClassStaticBlocks = classFieldsTransformer_getStaticPropertiesAndClassStaticBlock(receiver, node as unknown as GoPtr<Node>);
    if (Some(staticPropertiesOrClassStaticBlocks, (n: GoPtr<Node>) => isClassNamedEvaluationHelperBlock(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), n))) {
      return false;
    }
    const hasTransformableStatics = (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks ||
      classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver, node as unknown as GoPtr<Node>)) &&
      Some(staticPropertiesOrClassStaticBlocks, (n: GoPtr<Node>) =>
        IsClassStaticBlockDeclaration(n) ||
        IsPrivateIdentifierClassElementDeclaration(n) ||
        (receiver!.shouldTransformInitializers && IsInitializedProperty(n))
      );
    return hasTransformableStatics;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"aeb3e83a6ea7d0f096545bbdb0620b23b56e358e26afe188e58999e1cfc31f3e","bodyHash":"7c3f92c14c32dac15a7d3aa70b1994730eab7e9cf24413b4e68071b4695e9df2"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitBinaryExpression(node *ast.BinaryExpression, discarded bool) *ast.Node {
 * 	if ast.IsDestructuringAssignment(node.AsNode()) {
 * 		// ({ x: obj.#x } = ...)
 * 		// ({ x: super.x } = ...)
 * 		// ({ x: super[x] } = ...)
 * 		savedPendingExpressions := tx.pendingExpressions
 * 		tx.pendingExpressions = nil
 * 		updated := tx.Factory().UpdateBinaryExpression(
 * 			node,
 * 			nil,
 * 			tx.assignmentTargetVisitor.VisitNode(node.Left),
 * 			nil,
 * 			node.OperatorToken,
 * 			tx.Visitor().VisitNode(node.Right),
 * 		)
 * 		var result *ast.Expression
 * 		if len(tx.pendingExpressions) > 0 {
 * 			exprs := append(tx.pendingExpressions, updated)
 * 			result = tx.Factory().InlineExpressions(exprs)
 * 		} else {
 * 			result = updated
 * 		}
 * 		tx.pendingExpressions = savedPendingExpressions
 * 		return result
 * 	}
 * 
 * 	if ast.IsAssignmentExpression(node.AsNode(), false /*excludeCompound* /) {
 * 		// 13.15.2 RS: Evaluation
 * 		//   AssignmentExpression : LeftHandSideExpression `=` AssignmentExpression
 * 		//     1. If |LeftHandSideExpression| is neither an |ObjectLiteral| nor an |ArrayLiteral|, then
 * 		//        a. Let _lref_ be ? Evaluation of |LeftHandSideExpression|.
 * 		//        b. If IsAnonymousFunctionDefinition(|AssignmentExpression|) and IsIdentifierRef of |LeftHandSideExpression| are both *true*, then
 * 		//           i. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `&&=` AssignmentExpression
 * 		//     ...
 * 		//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `||=` AssignmentExpression
 * 		//     ...
 * 		//     5. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 		//
 * 		//   AssignmentExpression : LeftHandSideExpression `??=` AssignmentExpression
 * 		//     ...
 * 		//     4. If IsAnonymousFunctionDefinition(|AssignmentExpression|) is *true* and IsIdentifierRef of |LeftHandSideExpression| is *true*, then
 * 		//        a. Let _rval_ be ? NamedEvaluation of |AssignmentExpression| with argument _lref_.[[ReferencedName]].
 * 		//     ...
 * 
 * 		if isNamedEvaluationAnd(tx.EmitContext(), node.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 			node = transformNamedEvaluation(tx.EmitContext(), node.AsNode(), false, "").AsBinaryExpression()
 * 			debug.Assert(node.AsNode() != nil && ast.IsAssignmentExpression(node.AsNode(), false))
 * 		}
 * 
 * 		left := ast.SkipOuterExpressions(node.Left, ast.OEKPartiallyEmittedExpressions|ast.OEKParentheses)
 * 		if ast.IsPropertyAccessExpression(left) && ast.IsPrivateIdentifier(left.Name()) {
 * 			// obj.#x = ...
 * 			info := tx.accessPrivateIdentifier(left.Name())
 * 			if info != nil {
 * 				result := tx.createPrivateIdentifierAssignment(info, left.Expression(), node.Right, node.OperatorToken.Kind)
 * 				tx.EmitContext().SetOriginal(result, node.AsNode())
 * 				result.Loc = node.Loc
 * 				return result
 * 			}
 * 		} else if tx.shouldTransformSuperInStaticInitializers && tx.currentClassElement != nil &&
 * 			ast.IsSuperProperty(node.Left) &&
 * 			isStaticPropertyDeclarationOrClassStaticBlock(tx.currentClassElement) &&
 * 			tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 			// super.x = ...
 * 			// super[x] = ...
 * 			// super.x += ...
 * 			// super.x -= ...
 * 			data := tx.lexicalEnvironment.data
 * 			if data.facts&classFactsClassWasDecorated != 0 {
 * 				return tx.Factory().UpdateBinaryExpression(
 * 					node,
 * 					nil,
 * 					tx.visitInvalidSuperProperty(node.Left),
 * 					nil,
 * 					node.OperatorToken,
 * 					tx.Visitor().VisitNode(node.Right),
 * 				)
 * 			}
 * 			if data.classConstructor != nil && data.superClassReference != nil {
 * 				var setterName *ast.Expression
 * 				if ast.IsElementAccessExpression(node.Left) {
 * 					setterName = tx.Visitor().VisitNode(node.Left.AsElementAccessExpression().ArgumentExpression)
 * 				} else if ast.IsPropertyAccessExpression(node.Left) && ast.IsIdentifier(node.Left.AsPropertyAccessExpression().Name()) {
 * 					setterName = tx.Factory().NewStringLiteralFromNode(node.Left.AsPropertyAccessExpression().Name())
 * 				}
 * 				if setterName != nil {
 * 					// converts `super.x = 1` into `(Reflect.set(_baseTemp, "x", _a = 1, _classTemp), _a)`
 * 					// converts `super[f()] = 1` into `(Reflect.set(_baseTemp, f(), _a = 1, _classTemp), _a)`
 * 					// converts `super.x += 1` into `(Reflect.set(_baseTemp, "x", _a = Reflect.get(_baseTemp, "x", _classtemp) + 1, _classTemp), _a)`
 * 					// converts `super[f()] += 1` into `(Reflect.set(_baseTemp, _a = f(), _b = Reflect.get(_baseTemp, _a, _classtemp) + 1, _classTemp), _b)`
 * 
 * 					expression := tx.Visitor().VisitNode(node.Right)
 * 					if ast.IsCompoundAssignment(node.OperatorToken.Kind) {
 * 						getterName := setterName
 * 						if !transformers.IsSimpleInlineableExpression(setterName) {
 * 							getterName = tx.Factory().NewTempVariable()
 * 							tx.EmitContext().AddVariableDeclaration(getterName)
 * 							setterName = tx.Factory().NewAssignmentExpression(getterName, setterName)
 * 						}
 * 						superPropertyGet := tx.Factory().NewReflectGetCall(
 * 							data.superClassReference,
 * 							getterName,
 * 							data.classConstructor,
 * 						)
 * 						tx.EmitContext().SetOriginal(superPropertyGet, node.Left)
 * 						superPropertyGet.Loc = node.Left.Loc
 * 						expression = tx.Factory().NewBinaryExpression(
 * 							nil,
 * 							superPropertyGet,
 * 							nil,
 * 							tx.Factory().NewToken(transformers.GetNonAssignmentOperatorForCompoundAssignment(node.OperatorToken.Kind)),
 * 							expression,
 * 						)
 * 						expression.Loc = node.Loc
 * 					}
 * 
 * 					var temp *ast.IdentifierNode
 * 					if !discarded {
 * 						temp = tx.Factory().NewTempVariable()
 * 						tx.EmitContext().AddVariableDeclaration(temp)
 * 					}
 * 					if temp != nil {
 * 						expression = tx.Factory().NewAssignmentExpression(temp, expression)
 * 						expression.Loc = node.Loc
 * 					}
 * 
 * 					expression = tx.Factory().NewReflectSetCall(
 * 						data.superClassReference,
 * 						setterName,
 * 						expression,
 * 						data.classConstructor,
 * 					)
 * 					tx.EmitContext().SetOriginal(expression, node.AsNode())
 * 					expression.Loc = node.Loc
 * 
 * 					if temp != nil {
 * 						expression = tx.Factory().NewCommaExpression(expression, temp)
 * 						expression.Loc = node.Loc
 * 					}
 * 					return expression
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	if node.OperatorToken.Kind == ast.KindInKeyword && ast.IsPrivateIdentifier(node.Left) {
 * 		// #x in obj
 * 		return tx.transformPrivateIdentifierInInExpression(node)
 * 	}
 * 
 * 	return tx.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitBinaryExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BinaryExpression>, discarded: bool): GoPtr<Node> {
  if (IsDestructuringAssignment(node as unknown as GoPtr<Node>)) {
    const savedPendingExpressions = receiver!.pendingExpressions;
    receiver!.pendingExpressions = [];
    const updated = NodeFactory_UpdateBinaryExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      undefined,
      NodeVisitor_VisitNode(receiver!.assignmentTargetVisitor as ConcreteNodeVisitor, node!.Left as unknown as GoPtr<Node>),
      undefined,
      node!.OperatorToken,
      NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Right as unknown as GoPtr<Node>),
    );
    let result: GoPtr<Expression>;
    if (receiver!.pendingExpressions.length > 0) {
      const exprs: GoPtr<Expression>[] = [...receiver!.pendingExpressions, updated as unknown as GoPtr<Expression>];
      result = NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), exprs);
    } else {
      result = updated as unknown as GoPtr<Expression>;
    }
    receiver!.pendingExpressions = savedPendingExpressions;
    return result as unknown as GoPtr<Node>;
  }

  if (IsAssignmentExpression(node as unknown as GoPtr<Node>, false)) {
    if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>, receiver!.isAnonymousClassNeedingAssignedName)) {
      node = AsBinaryExpression(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Node>, false, ""));
      debug.Assert(node !== undefined && IsAssignmentExpression(node as unknown as GoPtr<Node>, false));
    }

    const left = SkipOuterExpressions(node!.Left as unknown as GoPtr<Expression>, (OEKPartiallyEmittedExpressions | OEKParentheses) as number);
    if (IsPropertyAccessExpression(left as unknown as GoPtr<Node>) && IsPrivateIdentifier(AsPropertyAccessExpression(left as unknown as GoPtr<Node>)!.name)) {
      const info = classFieldsTransformer_accessPrivateIdentifier(receiver, AsPropertyAccessExpression(left as unknown as GoPtr<Node>)!.name);
      if (info !== undefined) {
        const result = classFieldsTransformer_createPrivateIdentifierAssignment(receiver, info, AsPropertyAccessExpression(left as unknown as GoPtr<Node>)!.Expression, node!.Right as unknown as GoPtr<Expression>, node!.OperatorToken!.Kind);
        EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), result, node as unknown as GoPtr<Node>);
        result!.Loc = node!.Loc;
        return result as unknown as GoPtr<Node>;
      }
    } else if (receiver!.shouldTransformSuperInStaticInitializers && receiver!.currentClassElement !== undefined &&
      IsSuperProperty(node!.Left as unknown as GoPtr<Node>) &&
      isStaticPropertyDeclarationOrClassStaticBlock(receiver!.currentClassElement) &&
      receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
      const data = receiver!.lexicalEnvironment.data;
      if ((data.facts & classFactsClassWasDecorated) !== 0) {
        return NodeFactory_UpdateBinaryExpression(
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          node,
          undefined,
          classFieldsTransformer_visitInvalidSuperProperty(receiver, node!.Left as unknown as GoPtr<Node>),
          undefined,
          node!.OperatorToken,
          NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Right as unknown as GoPtr<Node>),
        );
      }
      if (data.classConstructor !== undefined && data.superClassReference !== undefined) {
        let setterName: GoPtr<Expression> = undefined;
        if (IsElementAccessExpression(node!.Left as unknown as GoPtr<Node>)) {
          setterName = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsElementAccessExpression(node!.Left as unknown as GoPtr<Node>)!.ArgumentExpression as unknown as GoPtr<Node>) as GoPtr<Expression>;
        } else if (IsPropertyAccessExpression(node!.Left as unknown as GoPtr<Node>) && IsIdentifier(AsPropertyAccessExpression(node!.Left as unknown as GoPtr<Node>)!.name as unknown as GoPtr<Node>)) {
          setterName = NodeFactory_NewStringLiteralFromNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), AsPropertyAccessExpression(node!.Left as unknown as GoPtr<Node>)!.name);
        }
        if (setterName !== undefined) {
          let expression: GoPtr<Expression> = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Right as unknown as GoPtr<Node>) as GoPtr<Expression>;
          if (IsCompoundAssignment(node!.OperatorToken!.Kind)) {
            let getterName: GoPtr<Expression> = setterName;
            if (!IsSimpleInlineableExpression(setterName)) {
              getterName = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
              EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), getterName as unknown as GoPtr<IdentifierNode>);
              setterName = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), getterName, setterName);
            }
            const superPropertyGet = NodeFactory_NewReflectGetCall(
              Transformer_Factory(receiver!.__tsgoEmbedded0!),
              data.superClassReference,
              getterName,
              data.classConstructor,
            );
            EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), superPropertyGet, node!.Left as unknown as GoPtr<Node>);
            superPropertyGet!.Loc = (node!.Left as unknown as GoPtr<Node>)!.Loc;
            expression = NewBinaryExpression(
              Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
              undefined,
              superPropertyGet as unknown as GoPtr<Expression>,
              undefined,
              NewToken(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, GetNonAssignmentOperatorForCompoundAssignment(node!.OperatorToken!.Kind)),
              expression,
            ) as unknown as GoPtr<Expression>;
            expression!.Loc = node!.Loc;
          }

          let temp: GoPtr<IdentifierNode> = undefined;
          if (!discarded) {
            temp = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
            EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
          }
          if (temp !== undefined) {
            expression = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, expression);
            expression!.Loc = node!.Loc;
          }

          expression = NodeFactory_NewReflectSetCall(
            Transformer_Factory(receiver!.__tsgoEmbedded0!),
            data.superClassReference,
            setterName,
            expression,
            data.classConstructor,
          );
          EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, node as unknown as GoPtr<Node>);
          expression!.Loc = node!.Loc;

          if (temp !== undefined) {
            expression = NodeFactory_NewCommaExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), expression, temp);
            expression!.Loc = node!.Loc;
          }
          return expression as unknown as GoPtr<Node>;
        }
      }
    }
  }

  if (node!.OperatorToken!.Kind === KindInKeyword && IsPrivateIdentifier(node!.Left as unknown as GoPtr<Node>)) {
    return classFieldsTransformer_transformPrivateIdentifierInInExpression(receiver, node);
  }

  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitParenthesizedExpression","kind":"method","status":"implemented","sigHash":"5ab3fba8261d07bdcae5549828115a88ebb078ef3f20d13b12a813bb5e69f11f","bodyHash":"bc33d491c936a1b1f04182aacb5ee848505af9ddd83bb6b8a939909a3c9bd4b9"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitParenthesizedExpression(node *ast.ParenthesizedExpression, discarded bool) *ast.Node {
 * 	// 8.4.5 RS: NamedEvaluation
 * 	//   ParenthesizedExpression : `(` Expression `)`
 * 	//     ...
 * 	//     2. Return ? NamedEvaluation of |Expression| with argument _name_.
 * 	if discarded {
 * 		expression := tx.discardedValueVisitor.VisitNode(node.Expression)
 * 		return tx.Factory().UpdateParenthesizedExpression(node, expression)
 * 	}
 * 	expression := tx.Visitor().VisitNode(node.Expression)
 * 	return tx.Factory().UpdateParenthesizedExpression(node, expression)
 * }
 */
export function classFieldsTransformer_visitParenthesizedExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ParenthesizedExpression>, discarded: bool): GoPtr<Node> {
  if (discarded) {
    const expression = NodeVisitor_VisitNode(receiver!.discardedValueVisitor as ConcreteNodeVisitor, node!.Expression as unknown as GoPtr<Node>);
    return NodeFactory_UpdateParenthesizedExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, node, expression);
  }
  const expression = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression as unknown as GoPtr<Node>);
  return NodeFactory_UpdateParenthesizedExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, node, expression);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createPrivateIdentifierAssignment","kind":"method","status":"implemented","sigHash":"bacb2e17bd14bc535641229e4b66370aa7830eb7d1fa54e5dec4fb835b97dfcb","bodyHash":"23a30e34c3104d86f8fc88dd95b44161d353179ec37e9ffb2d61b1e256922030"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createPrivateIdentifierAssignment(info *privateIdentifierInfo, receiver *ast.Expression, right *ast.Expression, operator ast.Kind) *ast.Expression {
 * 	receiver = tx.Visitor().VisitNode(receiver)
 * 	right = tx.Visitor().VisitNode(right)
 * 
 * 	if ast.IsCompoundAssignment(operator) {
 * 		readExpression, initializeExpression := tx.createCopiableReceiverExpr(receiver)
 * 		if initializeExpression != nil {
 * 			receiver = initializeExpression
 * 		} else {
 * 			receiver = readExpression
 * 		}
 * 		right = tx.Factory().NewBinaryExpression(
 * 			nil,
 * 			tx.createPrivateIdentifierAccessHelper(info, readExpression),
 * 			nil,
 * 			tx.Factory().NewToken(transformers.GetNonAssignmentOperatorForCompoundAssignment(operator)),
 * 			right,
 * 		)
 * 	}
 * 
 * 	tx.EmitContext().SetCommentRange(receiver, core.NewTextRange(-1, receiver.End()))
 * 
 * 	switch info.kind {
 * 	case printer.PrivateIdentifierKindAccessor:
 * 		return tx.Factory().NewClassPrivateFieldSetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			right,
 * 			info.kind,
 * 			info.setterName,
 * 		)
 * 	case printer.PrivateIdentifierKindMethod:
 * 		return tx.Factory().NewClassPrivateFieldSetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			right,
 * 			info.kind,
 * 			nil,
 * 		)
 * 	case printer.PrivateIdentifierKindField:
 * 		var f *ast.IdentifierNode
 * 		if info.isStatic {
 * 			f = info.variableName
 * 		}
 * 		return tx.Factory().NewClassPrivateFieldSetHelper(
 * 			receiver,
 * 			info.brandCheckIdentifier,
 * 			right,
 * 			info.kind,
 * 			f,
 * 		)
 * 	case printer.PrivateIdentifierKindUntransformed:
 * 		debug.Fail("Access helpers should not be created for untransformed private elements")
 * 		return nil
 * 	}
 * 	debug.AssertNever(info, "Unknown private element type")
 * 	return nil
 * }
 */
export function classFieldsTransformer_createPrivateIdentifierAssignment(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>, right: GoPtr<Expression>, operator: Kind): GoPtr<Expression> {
  let recv = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), receiver1 as unknown as GoPtr<Node>) as GoPtr<Expression>;
  let rightExpr = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), right as unknown as GoPtr<Node>) as GoPtr<Expression>;

  if (IsCompoundAssignment(operator)) {
    const [readExpression, initializeExpression] = classFieldsTransformer_createCopiableReceiverExpr(receiver, recv);
    if (initializeExpression !== undefined) {
      recv = initializeExpression;
    } else {
      recv = readExpression;
    }
    rightExpr = NewBinaryExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      undefined,
      classFieldsTransformer_createPrivateIdentifierAccessHelper(receiver, info, readExpression) as unknown as GoPtr<Expression>,
      undefined,
      NewToken(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, GetNonAssignmentOperatorForCompoundAssignment(operator)),
      rightExpr,
    ) as unknown as GoPtr<Expression>;
  }

  EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), recv as unknown as GoPtr<Node>, { pos: -1, end: Node_End(recv) });

  switch (info!.kind) {
    case PrivateIdentifierKindAccessor:
      return NodeFactory_NewClassPrivateFieldSetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        recv,
        info!.brandCheckIdentifier,
        rightExpr,
        info!.kind,
        info!.setterName,
      );
    case PrivateIdentifierKindMethod:
      return NodeFactory_NewClassPrivateFieldSetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        recv,
        info!.brandCheckIdentifier,
        rightExpr,
        info!.kind,
        undefined,
      );
    case PrivateIdentifierKindField: {
      const f: GoPtr<IdentifierNode> = info!.isStatic ? info!.variableName : undefined;
      return NodeFactory_NewClassPrivateFieldSetHelper(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        recv,
        info!.brandCheckIdentifier,
        rightExpr,
        info!.kind,
        f,
      );
    }
    case PrivateIdentifierKindUntransformed:
      debug.Fail("Access helpers should not be created for untransformed private elements");
      return undefined;
  }
  debug.Fail("Unknown private element type");
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getPrivateInstanceMethodsAndAccessors","kind":"method","status":"implemented","sigHash":"1379fbbfe28702b9abe481e4167a92a4c78191a6e0c4b876ab1cdd84eb4c7ab9","bodyHash":"ccada8cd22c15f342498d4784ed40bee19a8e51066feaea487f489dd1a6d7b55"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getPrivateInstanceMethodsAndAccessors(node *ast.Node) []*ast.Node {
 * 	return core.Filter(node.Members(), isNonStaticMethodOrAccessorWithPrivateName)
 * }
 */
export function classFieldsTransformer_getPrivateInstanceMethodsAndAccessors(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  return Filter(Node_Members(node) ?? [], isNonStaticMethodOrAccessorWithPrivateName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.memberContainsConstructorReference","kind":"method","status":"implemented","sigHash":"62bdf5def6eb976c4aad8b0dcae26acefdfccbf81b0451567f834c181328b32e","bodyHash":"5a4b172d4de73527ca48d0c4b897fd65c6dfd4e4f7c4af34b5ed905360370faa"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) memberContainsConstructorReference(member *ast.Node, classDecl *ast.Node) bool {
 * 	classOriginal := tx.EmitContext().MostOriginal(classDecl)
 * 	className := ast.GetNameOfDeclaration(classDecl)
 * 	var check func(n *ast.Node) bool
 * 	check = func(n *ast.Node) bool {
 * 		if ast.IsIdentifier(n) && n != className {
 * 			decl := tx.resolver.GetReferencedValueDeclaration(n)
 * 			if decl == classOriginal {
 * 				return true
 * 			}
 * 		}
 * 		// For PropertyAccessExpression, only check the expression, not the name.
 * 		// The .Name() is a property access name, not a value reference to the class.
 * 		if ast.IsPropertyAccessExpression(n) {
 * 			return check(n.Expression())
 * 		}
 * 		return n.ForEachChild(check)
 * 	}
 * 	// Check only the body/initializer of the member, not the name (which may be
 * 	// a computed property name that shouldn't trigger alias substitution).
 * 	if ast.IsClassStaticBlockDeclaration(member) {
 * 		body := member.AsClassStaticBlockDeclaration().Body
 * 		if body != nil && check(body.AsNode()) {
 * 			return true
 * 		}
 * 	} else {
 * 		body := member.Body()
 * 		if body != nil && check(body) {
 * 			return true
 * 		}
 * 	}
 * 	if ast.IsPropertyDeclaration(member) {
 * 		init := member.Initializer()
 * 		if init != nil && check(init) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function classFieldsTransformer_memberContainsConstructorReference(receiver: GoPtr<classFieldsTransformer>, member: GoPtr<Node>, classDecl: GoPtr<Node>): bool {
  const classOriginal = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), classDecl);
  const className = GetNameOfDeclaration(classDecl as unknown as GoPtr<Declaration>);
  const check = (n: GoPtr<Node>): bool => {
    if (IsIdentifier(n) && n !== className) {
      const decl = receiver!.resolver.GetReferencedValueDeclaration(n as GoPtr<IdentifierNode>);
      if (decl === classOriginal) {
        return true;
      }
    }
    if (IsPropertyAccessExpression(n)) {
      return check(AsPropertyAccessExpression(n)!.Expression as unknown as GoPtr<Node>);
    }
    return Node_ForEachChild(n, check);
  };
  if (IsClassStaticBlockDeclaration(member)) {
    const body = AsClassStaticBlockDeclaration(member)!.Body;
    if (body !== undefined && check(body as unknown as GoPtr<Node>)) {
      return true;
    }
  } else {
    const body = Node_Body(member);
    if (body !== undefined && check(body)) {
      return true;
    }
  }
  if (IsPropertyDeclaration(member)) {
    const init = Node_Initializer(member);
    if (init !== undefined && check(init)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.classContainsConstructorReference","kind":"method","status":"implemented","sigHash":"001829555e36392b2683f01af4d52cbfb3a4c5a9f31a9552a9637064bfe9b284","bodyHash":"e0a870193ff2334feab7045fe90c97903b1ba41495f5d6d46a5ac3e664abbabc"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) classContainsConstructorReference(node *ast.Node) bool {
 * 	for _, member := range node.Members() {
 * 		if tx.memberContainsConstructorReference(member, node) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function classFieldsTransformer_classContainsConstructorReference(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool {
  for (const member of Node_Members(node) ?? []) {
    if (classFieldsTransformer_memberContainsConstructorReference(receiver, member, node)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getClassFacts","kind":"method","status":"implemented","sigHash":"aa6e1babfee98d6f19edd1dedb584ced79c62e2858e06408df3e76f1d1ffcce8","bodyHash":"8067f0bfa94c05879552b948da2463e97319909eef5ff549fe2a767e84588ee6"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getClassFacts(node *ast.Node) classFacts {
 * 	facts := classFactsNone
 * 
 * 	original := tx.EmitContext().MostOriginal(node)
 * 	if ast.IsClassLike(original) && ast.ClassOrConstructorParameterIsDecorated(tx.legacyDecorators /*useLegacyDecorators* /, original) {
 * 		facts |= classFactsClassWasDecorated
 * 	}
 * 
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks &&
 * 		(classHasClassThisAssignment(tx.EmitContext(), node) || classHasExplicitlyAssignedName(tx.EmitContext(), node)) {
 * 		facts |= classFactsNeedsClassConstructorReference
 * 	}
 * 
 * 	var containsPublicInstanceFields bool
 * 	var containsInitializedPublicInstanceFields bool
 * 	var containsInstancePrivateElements bool
 * 	var containsInstanceAutoAccessors bool
 * 
 * 	for _, member := range node.Members() {
 * 		if ast.IsStatic(member) {
 * 			if member.Name() != nil && (ast.IsPrivateIdentifier(member.Name()) || ast.IsAutoAccessorPropertyDeclaration(member)) &&
 * 				tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 				facts |= classFactsNeedsClassConstructorReference
 * 			} else if ast.IsAutoAccessorPropertyDeclaration(member) && tx.shouldTransformAutoAccessors &&
 * 				node.Name() == nil && tx.EmitContext().ClassThis(node) == nil {
 * 				facts |= classFactsNeedsClassConstructorReference
 * 			}
 * 			if ast.IsPropertyDeclaration(member) || ast.IsClassStaticBlockDeclaration(member) {
 * 				if tx.shouldTransformThisInStaticInitializers && member.SubtreeFacts()&ast.SubtreeContainsLexicalThis != 0 {
 * 					facts |= classFactsNeedsSubstitutionForThisInClassStaticField
 * 					if facts&classFactsClassWasDecorated == 0 {
 * 						facts |= classFactsNeedsClassConstructorReference
 * 					}
 * 				}
 * 				if tx.shouldTransformSuperInStaticInitializers && member.SubtreeFacts()&ast.SubtreeContainsLexicalSuper != 0 {
 * 					if facts&classFactsClassWasDecorated == 0 {
 * 						facts |= classFactsNeedsClassConstructorReference | classFactsNeedsClassSuperReference
 * 					}
 * 				}
 * 			}
 * 		} else if !ast.HasAbstractModifier(tx.EmitContext().MostOriginal(member)) {
 * 			if ast.IsAutoAccessorPropertyDeclaration(member) {
 * 				containsInstanceAutoAccessors = true
 * 				containsInstancePrivateElements = containsInstancePrivateElements || ast.IsPrivateIdentifierClassElementDeclaration(member)
 * 			} else if ast.IsPrivateIdentifierClassElementDeclaration(member) {
 * 				containsInstancePrivateElements = true
 * 				if tx.memberContainsConstructorReference(member, node) {
 * 					facts |= classFactsNeedsClassConstructorReference
 * 				}
 * 			} else if ast.IsPropertyDeclaration(member) {
 * 				containsPublicInstanceFields = true
 * 				containsInitializedPublicInstanceFields = containsInitializedPublicInstanceFields || member.Initializer() != nil
 * 			}
 * 		}
 * 	}
 * 
 * 	willHoistInitializersToConstructor := (tx.shouldTransformInitializersUsingDefine && containsPublicInstanceFields) ||
 * 		(tx.shouldTransformInitializersUsingSet && containsInitializedPublicInstanceFields) ||
 * 		(tx.shouldTransformPrivateElementsOrClassStaticBlocks && containsInstancePrivateElements) ||
 * 		(tx.shouldTransformPrivateElementsOrClassStaticBlocks && containsInstanceAutoAccessors && tx.shouldTransformAutoAccessors)
 * 
 * 	if willHoistInitializersToConstructor {
 * 		facts |= classFactsWillHoistInitializersToConstructor
 * 	}
 * 
 * 	return facts
 * }
 */
export function classFieldsTransformer_getClassFacts(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): classFacts {
  let facts: classFacts = classFactsNone;

  const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  if (IsClassLike(original) && ClassOrConstructorParameterIsDecorated(receiver!.legacyDecorators, original)) {
    facts |= classFactsClassWasDecorated;
  }

  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks &&
    (classHasClassThisAssignment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) || classHasExplicitlyAssignedName(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node))) {
    facts |= classFactsNeedsClassConstructorReference;
  }

  let containsPublicInstanceFields: bool = false;
  let containsInitializedPublicInstanceFields: bool = false;
  let containsInstancePrivateElements: bool = false;
  let containsInstanceAutoAccessors: bool = false;

  for (const member of Node_Members(node) ?? []) {
    if (IsStatic(member)) {
      if (Node_Name(member) !== undefined && (IsPrivateIdentifier(Node_Name(member)) || IsAutoAccessorPropertyDeclaration(member)) &&
        receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
        facts |= classFactsNeedsClassConstructorReference;
      } else if (IsAutoAccessorPropertyDeclaration(member) && receiver!.shouldTransformAutoAccessors &&
        Node_Name(node) === undefined && EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) === undefined) {
        facts |= classFactsNeedsClassConstructorReference;
      }
      if (IsPropertyDeclaration(member) || IsClassStaticBlockDeclaration(member)) {
        if (receiver!.shouldTransformThisInStaticInitializers && (Node_SubtreeFacts(member) & SubtreeContainsLexicalThis) !== 0) {
          facts |= classFactsNeedsSubstitutionForThisInClassStaticField;
          if ((facts & classFactsClassWasDecorated) === 0) {
            facts |= classFactsNeedsClassConstructorReference;
          }
        }
        if (receiver!.shouldTransformSuperInStaticInitializers && (Node_SubtreeFacts(member) & SubtreeContainsLexicalSuper) !== 0) {
          if ((facts & classFactsClassWasDecorated) === 0) {
            facts |= classFactsNeedsClassConstructorReference | classFactsNeedsClassSuperReference;
          }
        }
      }
    } else if (!HasAbstractModifier(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), member))) {
      if (IsAutoAccessorPropertyDeclaration(member)) {
        containsInstanceAutoAccessors = true;
        containsInstancePrivateElements = containsInstancePrivateElements || IsPrivateIdentifierClassElementDeclaration(member);
      } else if (IsPrivateIdentifierClassElementDeclaration(member)) {
        containsInstancePrivateElements = true;
        if (classFieldsTransformer_memberContainsConstructorReference(receiver, member, node)) {
          facts |= classFactsNeedsClassConstructorReference;
        }
      } else if (IsPropertyDeclaration(member)) {
        containsPublicInstanceFields = true;
        containsInitializedPublicInstanceFields = containsInitializedPublicInstanceFields || Node_Initializer(member) !== undefined;
      }
    }
  }

  const willHoistInitializersToConstructor = (receiver!.shouldTransformInitializersUsingDefine && containsPublicInstanceFields) ||
    (receiver!.shouldTransformInitializersUsingSet && containsInitializedPublicInstanceFields) ||
    (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks && containsInstancePrivateElements) ||
    (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks && containsInstanceAutoAccessors && receiver!.shouldTransformAutoAccessors);

  if (willHoistInitializersToConstructor) {
    facts |= classFactsWillHoistInitializersToConstructor;
  }

  return facts;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitExpressionWithTypeArgumentsInHeritageClause","kind":"method","status":"implemented","sigHash":"56081a641eedd8505435922f5cfc97104f9cba756fd3e08da09f9275b49bddf5","bodyHash":"6bf522ddde3f643676025932a47ef36a5697b03c31181580f82c5a1b955a2cd6"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitExpressionWithTypeArgumentsInHeritageClause(node *ast.ExpressionWithTypeArguments) *ast.Node {
 * 	facts := classFactsNone
 * 	if tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		facts = tx.lexicalEnvironment.data.facts
 * 	}
 * 	if facts&classFactsNeedsClassSuperReference != 0 {
 * 		temp := tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 		})
 * 		tx.EmitContext().AddVariableDeclaration(temp)
 * 		tx.getClassLexicalEnvironment().superClassReference = temp
 * 		return tx.Factory().UpdateExpressionWithTypeArguments(
 * 			node,
 * 			tx.Factory().NewAssignmentExpression(temp, tx.Visitor().VisitNode(node.Expression)),
 * 			nil, /*typeArguments* /
 * 		)
 * 	}
 * 	return tx.heritageClauseVisitor.VisitEachChild(node.AsNode())
 * }
 */
export function classFieldsTransformer_visitExpressionWithTypeArgumentsInHeritageClause(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExpressionWithTypeArguments>): GoPtr<Node> {
  let facts: classFacts = classFactsNone;
  if (receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    facts = receiver!.lexicalEnvironment.data.facts;
  }
  if ((facts & classFactsNeedsClassSuperReference) !== 0) {
    const temp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
      Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
      Prefix: "",
      Suffix: "",
    });
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
    classFieldsTransformer_getClassLexicalEnvironment(receiver)!.superClassReference = temp;
    return NodeFactory_UpdateExpressionWithTypeArguments(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      node,
      NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node!.Expression)),
      undefined, /*typeArguments*/
    );
  }
  return NodeVisitor_VisitEachChild(receiver!.heritageClauseVisitor as ConcreteNodeVisitor, node as unknown as GoPtr<Node>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitInNewClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"84db644818227fb25de4e6c07a0cb045ad71e2079df9de727b9a9aaead7e7417","bodyHash":"3412e0e2b321bbf54ff99c595e47a76b8f9a8114af4c044ad34581097eeb7e83"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitInNewClassLexicalEnvironment(node *ast.Node, visitor func(tx *classFieldsTransformer, node *ast.Node, facts classFacts) *ast.Node) *ast.Node {
 * 	savedCurrentClassContainer := tx.currentClassContainer
 * 	savedPendingExpressions := tx.pendingExpressions
 * 	savedLexicalEnvironment := tx.lexicalEnvironment
 * 	tx.currentClassContainer = node
 * 	tx.pendingExpressions = nil
 * 	tx.startClassLexicalEnvironment()
 * 	original := tx.EmitContext().MostOriginal(node)
 * 	tx.enclosingClassDeclarations.Add(original)
 * 
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks || tx.nodeHasTransformPrivateStaticElementsFlag(node) {
 * 		name := ast.GetNameOfDeclaration(node)
 * 		if name != nil && ast.IsIdentifier(name) {
 * 			tx.getPrivateIdentifierEnvironment().data.className = name
 * 		} else if assignedName := tx.EmitContext().AssignedName(node); assignedName != nil {
 * 			if ast.IsStringLiteral(assignedName) {
 * 				// If the assigned name has a textSourceNode that is an identifier, use it directly.
 * 				if textSourceNode := tx.EmitContext().TextSource(assignedName); textSourceNode != nil && ast.IsIdentifier(textSourceNode) {
 * 					tx.getPrivateIdentifierEnvironment().data.className = textSourceNode
 * 				} else if scanner.IsIdentifierText(assignedName.Text(), core.LanguageVariantStandard) {
 * 					// If the text is a valid identifier, create an identifier from it.
 * 					prefixName := tx.Factory().NewIdentifier(assignedName.Text())
 * 					tx.getPrivateIdentifierEnvironment().data.className = prefixName
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		privateInstanceMethodsAndAccessors := tx.getPrivateInstanceMethodsAndAccessors(node)
 * 		if len(privateInstanceMethodsAndAccessors) > 0 {
 * 			tx.getPrivateIdentifierEnvironment().data.weakSetName = tx.createHoistedVariableForClass(
 * 				"instances",
 * 				privateInstanceMethodsAndAccessors[0].Name(),
 * 				"",
 * 			)
 * 		}
 * 	}
 * 
 * 	facts := tx.getClassFacts(node)
 * 	if facts != classFactsNone {
 * 		tx.getClassLexicalEnvironment().facts = facts
 * 	}
 * 
 * 	result := visitor(tx, node, facts)
 * 	tx.enclosingClassDeclarations.Delete(original)
 * 	tx.endClassLexicalEnvironment()
 * 	debug.Assert(tx.lexicalEnvironment == savedLexicalEnvironment)
 * 	tx.currentClassContainer = savedCurrentClassContainer
 * 	tx.pendingExpressions = savedPendingExpressions
 * 	tx.lexicalEnvironment = savedLexicalEnvironment
 * 	return result
 * }
 */
export function classFieldsTransformer_visitInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts) => GoPtr<Node>): GoPtr<Node> {
  const savedCurrentClassContainer = receiver!.currentClassContainer;
  const savedPendingExpressions = receiver!.pendingExpressions;
  const savedLexicalEnvironment = receiver!.lexicalEnvironment;
  receiver!.currentClassContainer = node as unknown as GoPtr<ClassLikeDeclaration>;
  receiver!.pendingExpressions = [];
  classFieldsTransformer_startClassLexicalEnvironment(receiver);
  const original = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
  Set_Add(receiver!.enclosingClassDeclarations, original);

  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks || classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver, node)) {
    const name = GetNameOfDeclaration(node);
    if (name !== undefined && IsIdentifier(name)) {
      classFieldsTransformer_getPrivateIdentifierEnvironment(receiver)!.data.className = name as unknown as GoPtr<IdentifierNode>;
    } else {
      const assignedName = EmitContext_AssignedName(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
      if (assignedName !== undefined) {
        if (IsStringLiteral(assignedName)) {
          const textSourceNode = EmitContext_TextSource(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), assignedName);
          if (textSourceNode !== undefined && IsIdentifier(textSourceNode)) {
            classFieldsTransformer_getPrivateIdentifierEnvironment(receiver)!.data.className = textSourceNode as unknown as GoPtr<IdentifierNode>;
          } else if (IsIdentifierText(Node_Text(assignedName), LanguageVariantStandard)) {
            const prefixName = NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, Node_Text(assignedName));
            classFieldsTransformer_getPrivateIdentifierEnvironment(receiver)!.data.className = prefixName as unknown as GoPtr<IdentifierNode>;
          }
        }
      }
    }
  }

  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    const privateInstanceMethodsAndAccessors = classFieldsTransformer_getPrivateInstanceMethodsAndAccessors(receiver, node);
    if (privateInstanceMethodsAndAccessors.length > 0) {
      classFieldsTransformer_getPrivateIdentifierEnvironment(receiver)!.data.weakSetName = classFieldsTransformer_createHoistedVariableForClass(receiver, "instances", Node_Name(privateInstanceMethodsAndAccessors[0]), "");
    }
  }

  const facts = classFieldsTransformer_getClassFacts(receiver, node);
  if (facts !== classFactsNone) {
    classFieldsTransformer_getClassLexicalEnvironment(receiver)!.facts = facts;
  }

  const result = visitor(receiver, node, facts);
  Set_Delete(receiver!.enclosingClassDeclarations, original);
  classFieldsTransformer_endClassLexicalEnvironment(receiver);
  receiver!.currentClassContainer = savedCurrentClassContainer;
  receiver!.pendingExpressions = savedPendingExpressions;
  receiver!.lexicalEnvironment = savedLexicalEnvironment;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"9aabe49d81957e5048536d912d9e0434aedc0b4b0b9400e421018173b879506f","bodyHash":"4cd39a4b60bfabf8851c46e659125b2c0ad9347c36cca994f13d5f339f14142e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	return tx.visitInNewClassLexicalEnvironment(node.AsNode(), (*classFieldsTransformer).visitClassDeclarationInNewClassLexicalEnvironment)
 * }
 */
export function classFieldsTransformer_visitClassDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node> {
  return classFieldsTransformer_visitInNewClassLexicalEnvironment(receiver, node as unknown as GoPtr<Node>, classFieldsTransformer_visitClassDeclarationInNewClassLexicalEnvironment);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassDeclarationInNewClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"8b154390174f520d62c98e7c615fc5c5c81c6d5f6981148d624529e64195799c","bodyHash":"e2a6749aa34878029b1c8812a99f58ffbdfa2af719a9cac101920a3c5959f300"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassDeclarationInNewClassLexicalEnvironment(node *ast.Node, facts classFacts) *ast.Node {
 * 	classDecl := node.AsClassDeclaration()
 * 	// If a class has private static fields, or a static field has a `this` or `super` reference,
 * 	// then we need to allocate a temp variable to hold on to that reference.
 * 	var pendingClassReferenceAssignment *ast.Expression
 * 	if facts&classFactsNeedsClassConstructorReference != 0 {
 * 		// If we aren't transforming class static blocks, then we can't reuse `_classThis` since in
 * 		// `class C { ... static { _classThis = ... } }; _classThis = C` the outer assignment would occur *after*
 * 		// class static blocks evaluate and would overwrite the replacement constructor produced by class
 * 		// decorators.
 * 
 * 		// If we are transforming class static blocks, then we can reuse `_classThis` since the assignment
 * 		// will be evaluated *before* the transformed static blocks are evaluated and thus won't overwrite
 * 		// the replacement constructor.
 * 
 * 		if tx.shouldTransformPrivateElementsOrClassStaticBlocks && tx.EmitContext().ClassThis(node) != nil {
 * 			classThis := tx.EmitContext().ClassThis(node)
 * 			tx.getClassLexicalEnvironment().classConstructor = classThis
 * 			pendingClassReferenceAssignment = tx.Factory().NewAssignmentExpression(
 * 				classThis,
 * 				tx.Factory().GetLocalName(node),
 * 			)
 * 		} else {
 * 			temp := tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 				Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 			})
 * 			tx.EmitContext().AddVariableDeclaration(temp)
 * 			tx.getClassLexicalEnvironment().classConstructor = temp.Clone(tx.Factory())
 * 			pendingClassReferenceAssignment = tx.Factory().NewAssignmentExpression(
 * 				temp,
 * 				tx.Factory().GetLocalName(node),
 * 			)
 * 		}
 * 	}
 * 
 * 	if tx.EmitContext().ClassThis(node) != nil {
 * 		tx.getClassLexicalEnvironment().classThis = tx.EmitContext().ClassThis(node)
 * 	}
 * 
 * 	isClassWithConstructorReference := tx.classContainsConstructorReference(node)
 * 
 * 	// Register class alias BEFORE visiting members (Strada registers after, since its
 * 	// onSubstituteNode runs at emit time; we substitute eagerly during transformation).
 * 	alias := tx.getClassLexicalEnvironment().classConstructor
 * 	if isClassWithConstructorReference && alias != nil {
 * 		tx.classAliases[tx.EmitContext().MostOriginal(node)] = alias
 * 	}
 * 
 * 	modifiers := tx.modifierVisitor.VisitModifiers(classDecl.Modifiers())
 * 	heritageClauses := tx.heritageClauseVisitor.VisitNodes(classDecl.HeritageClauses)
 * 	members, membersPrologue := tx.transformClassMembers(node)
 * 
 * 	var statements []*ast.Node
 * 
 * 	if pendingClassReferenceAssignment != nil {
 * 		tx.pendingExpressions = append([]*ast.Expression{pendingClassReferenceAssignment}, tx.pendingExpressions...)
 * 	}
 * 
 * 	// Write any pending expressions from elided or moved computed property names
 * 	if len(tx.pendingExpressions) > 0 {
 * 		statements = append(statements, tx.Factory().NewExpressionStatement(tx.Factory().InlineExpressions(tx.pendingExpressions)))
 * 	}
 * 
 * 	// A class declaration without a name needs a generated name if it has static
 * 	// initialized properties, since those will be moved outside the class body and
 * 	// need to reference the class by name.
 * 	name := classDecl.Name()
 * 
 * 	if tx.shouldTransformInitializersUsingSet || tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		// Emit static property assignment. Because classDeclaration is lexically evaluated,
 * 		// it is safe to emit static property assignment after classDeclaration
 * 		// From ES6 specification:
 * 		//   HasLexicalDeclaration (N) : Determines if the argument identifier has a binding in this environment record that was created using
 * 		//                               a lexical declaration such as a LexicalDeclaration or a ClassDeclaration.
 * 		staticProperties := tx.getStaticPropertiesAndClassStaticBlock(node)
 * 		if len(staticProperties) > 0 {
 * 			if name == nil {
 * 				name = tx.Factory().NewGeneratedNameForNode(node)
 * 			}
 * 			statements = tx.addPropertyOrClassStaticBlockStatements(statements, staticProperties, tx.Factory().GetLocalName(node))
 * 		}
 * 	}
 * 
 * 	isExport := ast.HasSyntacticModifier(node, ast.ModifierFlagsExport)
 * 	isDefault := ast.HasSyntacticModifier(node, ast.ModifierFlagsDefault)
 * 
 * 	if len(statements) > 0 && isExport && isDefault {
 * 		modifiers = transformers.ExtractModifiers(tx.EmitContext(), modifiers, ^ast.ModifierFlagsExportDefault)
 * 		exportAssignment := tx.Factory().NewExportAssignment(nil, false /*isExportEquals* /, nil /*typeNode* /, tx.Factory().GetLocalName(node))
 * 		statements = append(statements, exportAssignment)
 * 	}
 * 
 * 	updatedClass := tx.Factory().UpdateClassDeclaration(
 * 		classDecl,
 * 		modifiers,
 * 		name,
 * 		nil, /*typeParameters* /
 * 		heritageClauses,
 * 		members,
 * 	)
 * 
 * 	result := make([]*ast.Node, 0, 1+len(statements)+1)
 * 	if membersPrologue != nil {
 * 		result = append(result, tx.Factory().NewExpressionStatement(membersPrologue))
 * 	}
 * 	result = append(result, updatedClass)
 * 	result = append(result, statements...)
 * 	return tx.Factory().NewSyntaxList(result)
 * }
 */
export function classFieldsTransformer_visitClassDeclarationInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts): GoPtr<Node> {
  const classDecl = AsClassDeclaration(node);
  let pendingClassReferenceAssignment: GoPtr<Expression> = undefined;
  if ((facts & classFactsNeedsClassConstructorReference) !== 0) {
    if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks && EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) !== undefined) {
      const classThis = EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)!;
      classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = classThis;
      pendingClassReferenceAssignment = NodeFactory_NewAssignmentExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        classThis,
        NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Declaration>),
      );
    } else {
      const temp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
        Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
        Prefix: "",
        Suffix: "",
      });
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp);
      classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = Node_Clone(temp, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
      pendingClassReferenceAssignment = NodeFactory_NewAssignmentExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        temp,
        NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Declaration>),
      );
    }
  }

  if (EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) !== undefined) {
    classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classThis = EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)!;
  }

  const isClassWithConstructorReference = classFieldsTransformer_classContainsConstructorReference(receiver, node);
  const alias = classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor;
  if (isClassWithConstructorReference && alias !== undefined) {
    receiver!.classAliases.set(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node), alias);
  }

  const modifiers = NodeVisitor_VisitModifiers(receiver!.modifierVisitor as ConcreteNodeVisitor, Node_Modifiers(node));
  const heritageClauses = NodeVisitor_VisitNodes(receiver!.heritageClauseVisitor as ConcreteNodeVisitor, classDecl!.HeritageClauses);
  const [members, membersPrologue] = classFieldsTransformer_transformClassMembers(receiver, node);

  let statements: GoSlice<GoPtr<Node>> = [];

  if (pendingClassReferenceAssignment !== undefined) {
    receiver!.pendingExpressions = [pendingClassReferenceAssignment, ...receiver!.pendingExpressions];
  }

  if (receiver!.pendingExpressions.length > 0) {
    statements = [...statements, NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), receiver!.pendingExpressions) as GoPtr<Expression>)];
  }

  let name: GoPtr<IdentifierNode> = classDecl!.name as GoPtr<IdentifierNode>;

  if (receiver!.shouldTransformInitializersUsingSet || receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    const staticProperties = classFieldsTransformer_getStaticPropertiesAndClassStaticBlock(receiver, node);
    if (staticProperties.length > 0) {
      if (name === undefined) {
        name = NodeFactory_NewGeneratedNameForNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), node) as GoPtr<IdentifierNode>;
      }
      statements = classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver, statements, staticProperties, NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Declaration>));
    }
  }

  const isExport = HasSyntacticModifier(node, ModifierFlagsExport);
  const isDefault = HasSyntacticModifier(node, ModifierFlagsDefault);

  if (statements.length > 0 && isExport && isDefault) {
    receiver!.modifierVisitor;  // reference to avoid lint
    const extractedModifiers = ExtractModifiers(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), modifiers, ~ModifierFlagsExportDefault);
    const exportAssignment = NewExportAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, false, undefined, NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Declaration>));
    statements = [...statements, exportAssignment];
    const updatedClass = NodeFactory_UpdateClassDeclaration(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      classDecl,
      extractedModifiers,
      name,
      undefined, /*typeParameters*/
      heritageClauses,
      members,
    );
    const result: GoSlice<GoPtr<Node>> = [];
    if (membersPrologue !== undefined) {
      result.push(NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, membersPrologue as GoPtr<Expression>));
    }
    result.push(updatedClass);
    for (const s of statements) result.push(s);
    return NewSyntaxList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, result);
  }

  const updatedClass = NodeFactory_UpdateClassDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    classDecl,
    modifiers,
    name,
    undefined, /*typeParameters*/
    heritageClauses,
    members,
  );

  const result: GoSlice<GoPtr<Node>> = [];
  if (membersPrologue !== undefined) {
    result.push(NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, membersPrologue as GoPtr<Expression>));
  }
  result.push(updatedClass);
  for (const s of statements) result.push(s);
  return NewSyntaxList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, result);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"34bbf3c22a0d97057828c0da22c0930dd83c7389d7ceea1d76ba30121073909c","bodyHash":"a5850a5523792400eac7725a77f0946c40f3374a6ea5d7bda10fbab7cf2b1eb8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	return tx.visitInNewClassLexicalEnvironment(node.AsNode(), (*classFieldsTransformer).visitClassExpressionInNewClassLexicalEnvironment)
 * }
 */
export function classFieldsTransformer_visitClassExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node> {
  return classFieldsTransformer_visitInNewClassLexicalEnvironment(receiver, node as unknown as GoPtr<Node>, classFieldsTransformer_visitClassExpressionInNewClassLexicalEnvironment);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassExpressionInNewClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"d0363f9ada1b6dd6df28de205d7a70eb5b92a8d2fddb2a869d2dd759a372ef7e","bodyHash":"96f636617d779e8a4de137cd3848d1f9dcf02a95c1d3abd76d23a509af3c84a3"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassExpressionInNewClassLexicalEnvironment(node *ast.Node, facts classFacts) *ast.Node {
 * 	classExpr := node.AsClassExpression()
 * 
 * 	// If this class expression is a transformation of a decorated class declaration,
 * 	// then we want to output the pendingExpressions as statements, not as inlined
 * 	// expressions with the class statement.
 * 	//
 * 	// In this case, we use pendingStatements to produce the same output as the
 * 	// class declaration transformation. The VariableStatement visitor will insert
 * 	// these statements after the class expression variable statement.
 * 	isDecoratedClassDeclaration := facts&classFactsClassWasDecorated != 0
 * 
 * 	if tx.EmitContext().ClassThis(node) != nil {
 * 		tx.getClassLexicalEnvironment().classThis = tx.EmitContext().ClassThis(node)
 * 	}
 * 
 * 	var temp *ast.IdentifierNode
 * 	if facts&classFactsNeedsClassConstructorReference != 0 {
 * 		if (tx.shouldTransformPrivateElementsOrClassStaticBlocks || tx.nodeHasTransformPrivateStaticElementsFlag(node)) && tx.EmitContext().ClassThis(node) != nil {
 * 			classThis := tx.EmitContext().ClassThis(node)
 * 			tx.getClassLexicalEnvironment().classConstructor = classThis
 * 			temp = classThis
 * 		} else {
 * 			temp = tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 				Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 			})
 * 			if tx.classExpressionNeedsBlockScopedTemp() {
 * 				tx.EmitContext().AddLexicalDeclaration(temp)
 * 			} else {
 * 				tx.EmitContext().AddVariableDeclaration(temp)
 * 			}
 * 			tx.getClassLexicalEnvironment().classConstructor = temp.Clone(tx.Factory())
 * 		}
 * 	}
 * 
 * 	staticPropertiesOrClassStaticBlocks := tx.getStaticPropertiesAndClassStaticBlock(node)
 * 
 * 	// Pre-compute whether the class expression will need a temp variable wrapper.
 * 	// Strada registers class aliases AFTER transformClassMembers (since onSubstituteNode runs
 * 	// at emit time), but we must predict this before visiting members since we substitute
 * 	// eagerly. This requires pre-detecting willHavePrivatePendingExpressions.
 * 	isClassWithConstructorReference := false
 * 	hasTransformableStatics := false
 * 	deferTempDeclaration := false
 * 	if !isDecoratedClassDeclaration {
 * 		isClassWithConstructorReference = tx.classContainsConstructorReference(node)
 * 		hasTransformableStatics = (tx.shouldTransformPrivateElementsOrClassStaticBlocks ||
 * 			tx.nodeHasTransformPrivateStaticElementsFlag(node)) &&
 * 			core.Some(staticPropertiesOrClassStaticBlocks, func(n *ast.Node) bool {
 * 				return ast.IsClassStaticBlockDeclaration(n) ||
 * 					ast.IsPrivateIdentifierClassElementDeclaration(n) ||
 * 					(tx.shouldTransformInitializers && ast.IsInitializedProperty(n))
 * 			})
 * 
 * 		// Private instance elements (fields, methods, accessors) transformed to
 * 		// WeakMap/WeakSet will add initialization expressions to pendingExpressions
 * 		// during transformClassMembers. Pre-detect this so we know whether the class
 * 		// will be wrapped with a temp variable.
 * 		willHavePrivatePendingExpressions := tx.shouldTransformPrivateElementsOrClassStaticBlocks &&
 * 			core.Some(node.Members(), func(n *ast.Node) bool {
 * 				return ast.IsPrivateIdentifierClassElementDeclaration(n) && !ast.HasStaticModifier(n) && tx.shouldTransformClassElementToWeakMap(n)
 * 			})
 * 		willNeedTempWrapper := hasTransformableStatics || willHavePrivatePendingExpressions
 * 
 * 		// Register class alias BEFORE visiting members (Strada registers after, since its
 * 		// onSubstituteNode runs at emit time). Only register when the class will be wrapped
 * 		// with a temp, matching Strada's conditional registration.
 * 		if isClassWithConstructorReference && willNeedTempWrapper && tx.getClassLexicalEnvironment().classConstructor == nil {
 * 			// Create temp early so the alias is available during member visiting, even though in the Strada
 * 			// reference the temp would be created later in the pendingExpressions branch.
 * 			temp = tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 				Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 			})
 * 			// Defer AddVariableDeclaration to preserve Strada's variable declaration ordering.
 * 			deferTempDeclaration = true
 * 			tx.getClassLexicalEnvironment().classConstructor = temp.Clone(tx.Factory())
 * 		}
 * 		if alias := tx.getClassLexicalEnvironment().classConstructor; isClassWithConstructorReference && willNeedTempWrapper && alias != nil {
 * 			tx.classAliases[tx.EmitContext().MostOriginal(node)] = alias
 * 		}
 * 	}
 * 
 * 	modifiers := tx.modifierVisitor.VisitModifiers(classExpr.Modifiers())
 * 	heritageClauses := tx.heritageClauseVisitor.VisitNodes(classExpr.HeritageClauses)
 * 	members, membersPrologue := tx.transformClassMembers(node)
 * 
 * 	if deferTempDeclaration {
 * 		if tx.classExpressionNeedsBlockScopedTemp() {
 * 			tx.EmitContext().AddLexicalDeclaration(temp)
 * 		} else {
 * 			tx.EmitContext().AddVariableDeclaration(temp)
 * 		}
 * 	}
 * 
 * 	classExpression := tx.Factory().UpdateClassExpression(
 * 		classExpr,
 * 		modifiers,
 * 		classExpr.Name(),
 * 		nil, /*typeParameters* /
 * 		heritageClauses,
 * 		members,
 * 	)
 * 
 * 	var expressions []*ast.Expression
 * 	if membersPrologue != nil {
 * 		expressions = append(expressions, membersPrologue)
 * 	}
 * 
 * 	if !isDecoratedClassDeclaration {
 * 		if hasTransformableStatics || len(tx.pendingExpressions) > 0 {
 * 			if temp == nil {
 * 				temp = tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 					Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 				})
 * 				if tx.classExpressionNeedsBlockScopedTemp() {
 * 					tx.EmitContext().AddLexicalDeclaration(temp)
 * 				} else {
 * 					tx.EmitContext().AddVariableDeclaration(temp)
 * 				}
 * 				tx.getClassLexicalEnvironment().classConstructor = temp.Clone(tx.Factory())
 * 				if isClassWithConstructorReference {
 * 					tx.classAliases[tx.EmitContext().MostOriginal(node)] = tx.getClassLexicalEnvironment().classConstructor
 * 				}
 * 			}
 * 
 * 			expressions = append(expressions, tx.Factory().NewAssignmentExpression(temp, classExpression))
 * 
 * 			// Add any pending expressions leftover from elided or relocated computed property names
 * 			expressions = append(expressions, tx.pendingExpressions...)
 * 
 * 			expressions = append(expressions, tx.generateInitializedPropertyExpressionsOrClassStaticBlock(staticPropertiesOrClassStaticBlocks, temp)...)
 * 			expressions = append(expressions, temp.Clone(tx.Factory()))
 * 		} else {
 * 			expressions = append(expressions, classExpression)
 * 		}
 * 	} else {
 * 		// Decorated class declaration path: emit static properties as separate statements
 * 		// via pendingStatements, matching the class declaration output structure.
 * 
 * 		// Write any pending expressions from elided or moved computed property names
 * 		if len(tx.pendingExpressions) > 0 {
 * 			for _, expr := range tx.pendingExpressions {
 * 				tx.pendingStatements = append(tx.pendingStatements, tx.Factory().NewExpressionStatement(expr))
 * 			}
 * 		}
 * 
 * 		// Emit static properties as statements (via pendingStatements) using the class's
 * 		// internal name as the receiver, matching the class declaration output structure.
 * 		if len(staticPropertiesOrClassStaticBlocks) > 0 {
 * 			classThisOrName := tx.EmitContext().ClassThis(node)
 * 			if classThisOrName == nil {
 * 				classThisOrName = tx.Factory().GetLocalName(node)
 * 			}
 * 			tx.pendingStatements = tx.addPropertyOrClassStaticBlockStatements(tx.pendingStatements, staticPropertiesOrClassStaticBlocks, classThisOrName)
 * 		}
 * 
 * 		if temp != nil {
 * 			expressions = append(expressions, tx.Factory().NewAssignmentExpression(temp, classExpression))
 * 		} else if tx.shouldTransformPrivateElementsOrClassStaticBlocks && tx.EmitContext().ClassThis(node) != nil {
 * 			expressions = append(expressions, tx.Factory().NewAssignmentExpression(tx.EmitContext().ClassThis(node), classExpression))
 * 		} else {
 * 			expressions = append(expressions, classExpression)
 * 		}
 * 	}
 * 
 * 	if len(expressions) > 1 {
 * 		tx.EmitContext().AddEmitFlags(classExpression, printer.EFIndented)
 * 		for _, expr := range expressions {
 * 			tx.EmitContext().AddEmitFlags(expr, printer.EFStartOnNewLine)
 * 		}
 * 	}
 * 	return tx.Factory().InlineExpressions(expressions)
 * }
 */
export function classFieldsTransformer_visitClassExpressionInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts): GoPtr<Node> {
  const classExpr = AsClassExpression(node);
  const isDecoratedClassDeclaration = (facts & classFactsClassWasDecorated) !== 0;

  if (EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) !== undefined) {
    classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classThis = EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)!;
  }

  let temp: GoPtr<IdentifierNode> = undefined;
  if ((facts & classFactsNeedsClassConstructorReference) !== 0) {
    if ((receiver!.shouldTransformPrivateElementsOrClassStaticBlocks || classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver, node)) &&
      EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) !== undefined) {
      const classThis = EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)!;
      classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = classThis;
      temp = classThis;
    } else {
      temp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
        Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
        Prefix: "",
        Suffix: "",
      });
      if (classFieldsTransformer_classExpressionNeedsBlockScopedTemp(receiver)) {
        EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
      } else {
        EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
      }
      classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = Node_Clone(temp, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
    }
  }

  const staticPropertiesOrClassStaticBlocks = classFieldsTransformer_getStaticPropertiesAndClassStaticBlock(receiver, node);

  let isClassWithConstructorReference = false;
  let hasTransformableStatics = false;
  let deferTempDeclaration = false;
  if (!isDecoratedClassDeclaration) {
    isClassWithConstructorReference = classFieldsTransformer_classContainsConstructorReference(receiver, node);
    hasTransformableStatics = (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks || classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver, node)) &&
      Some(staticPropertiesOrClassStaticBlocks, (n: GoPtr<Node>) =>
        IsClassStaticBlockDeclaration(n) ||
        IsPrivateIdentifierClassElementDeclaration(n) ||
        (receiver!.shouldTransformInitializers && IsInitializedProperty(n)));

    const willHavePrivatePendingExpressions = receiver!.shouldTransformPrivateElementsOrClassStaticBlocks &&
      Some(Node_Members(node) ?? [], (n: GoPtr<Node>) =>
        IsPrivateIdentifierClassElementDeclaration(n) && !HasStaticModifier(n) && classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver, n));
    const willNeedTempWrapper = hasTransformableStatics || willHavePrivatePendingExpressions;

    if (isClassWithConstructorReference && willNeedTempWrapper && classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor === undefined) {
      temp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
        Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
        Prefix: "",
        Suffix: "",
      });
      deferTempDeclaration = true;
      classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = Node_Clone(temp, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
    }
    const aliasForReg = classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor;
    if (isClassWithConstructorReference && willNeedTempWrapper && aliasForReg !== undefined) {
      receiver!.classAliases.set(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node), aliasForReg);
    }
  }

  const modifiers = NodeVisitor_VisitModifiers(receiver!.modifierVisitor as ConcreteNodeVisitor, Node_Modifiers(node));
  const heritageClauses = NodeVisitor_VisitNodes(receiver!.heritageClauseVisitor as ConcreteNodeVisitor, classExpr!.HeritageClauses);
  const [members, membersPrologue] = classFieldsTransformer_transformClassMembers(receiver, node);

  if (deferTempDeclaration) {
    if (classFieldsTransformer_classExpressionNeedsBlockScopedTemp(receiver)) {
      EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
    } else {
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
    }
  }

  const classExpression = NodeFactory_UpdateClassExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    classExpr,
    modifiers,
    classExpr!.name as GoPtr<IdentifierNode>,
    undefined, /*typeParameters*/
    heritageClauses,
    members,
  );

  let expressions: GoSlice<GoPtr<Expression>> = [];
  if (membersPrologue !== undefined) {
    expressions = [...expressions, membersPrologue];
  }

  if (!isDecoratedClassDeclaration) {
    if (hasTransformableStatics || receiver!.pendingExpressions.length > 0) {
      if (temp === undefined) {
        temp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
          Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
          Prefix: "",
          Suffix: "",
        });
        if (classFieldsTransformer_classExpressionNeedsBlockScopedTemp(receiver)) {
          EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
        } else {
          EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), temp!);
        }
        classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor = Node_Clone(temp, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<IdentifierNode>;
        if (isClassWithConstructorReference) {
          receiver!.classAliases.set(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node), classFieldsTransformer_getClassLexicalEnvironment(receiver)!.classConstructor);
        }
      }

      expressions = [...expressions, NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, classExpression as GoPtr<Expression>)];
      expressions = [...expressions, ...receiver!.pendingExpressions];
      expressions = [...expressions, ...classFieldsTransformer_generateInitializedPropertyExpressionsOrClassStaticBlock(receiver, staticPropertiesOrClassStaticBlocks, temp)];
      expressions = [...expressions, Node_Clone(temp, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible) as GoPtr<Expression>];
    } else {
      expressions = [...expressions, classExpression as GoPtr<Expression>];
    }
  } else {
    if (receiver!.pendingExpressions.length > 0) {
      for (const expr of receiver!.pendingExpressions) {
        receiver!.pendingStatements = [...receiver!.pendingStatements, NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, expr as GoPtr<Expression>)];
      }
    }

    if (staticPropertiesOrClassStaticBlocks.length > 0) {
      let classThisOrName: GoPtr<Expression> = EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node);
      if (classThisOrName === undefined) {
        classThisOrName = NodeFactory_GetLocalName(Transformer_Factory(receiver!.__tsgoEmbedded0!), node as unknown as GoPtr<Declaration>);
      }
      receiver!.pendingStatements = classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver, receiver!.pendingStatements, staticPropertiesOrClassStaticBlocks, classThisOrName);
    }

    if (temp !== undefined) {
      expressions = [...expressions, NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), temp, classExpression as GoPtr<Expression>)];
    } else if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks && EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) !== undefined) {
      expressions = [...expressions, NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), EmitContext_ClassThis(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)!, classExpression as GoPtr<Expression>)];
    } else {
      expressions = [...expressions, classExpression as GoPtr<Expression>];
    }
  }

  if (expressions.length > 1) {
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), classExpression as GoPtr<Node>, EFIndented);
    for (const expr of expressions) {
      EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expr as GoPtr<Node>, EFStartOnNewLine);
    }
  }
  return NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), expressions);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"1eaf5ac914ee2b183f83c0cbf1647a88625b7a964bda25fd3629e646e2f02c01","bodyHash":"b28c468ab3cd692cb2a3c50f461df95637b373611b617e098b73363d38c95f28"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassStaticBlockDeclaration(node *ast.Node) *ast.Node {
 * 	if !tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * 	// ClassStaticBlockDeclaration for classes are transformed in visitClassDeclaration/visitClassExpression.
 * 	return nil
 * }
 */
export function classFieldsTransformer_visitClassStaticBlockDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (!receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
    return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
  }
  // ClassStaticBlockDeclaration for classes are transformed in visitClassDeclaration/visitClassExpression.
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitThisExpression","kind":"method","status":"implemented","sigHash":"c7c05ab1847d2455bd85c4d554a26e01d12b9e4ed27a890f68e4312f8e6a3e0b","bodyHash":"37d564069ad135339f0541f5fc4f770254611a3458165fee10b372c2bf1ceafa"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitThisExpression(node *ast.Node) *ast.Node {
 * 	if tx.insideComputedPropertyName && tx.shouldTransformThisInStaticInitializers &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		// Don't replace `this` in computed property names for ES-decorated classes.
 * 		// The esDecorator transformer wraps them in an arrow IIFE where `this` already
 * 		// refers to the correct outer scope.
 * 		if tx.lexicalEnvironment.data.facts&classFactsClassWasDecorated == 0 || tx.legacyDecorators {
 * 			if classThis := tx.tryGetClassThisNoContainer(); classThis != nil {
 * 				return classThis
 * 			}
 * 		}
 * 	}
 * 	if tx.shouldTransformThisInStaticInitializers && tx.currentClassElement != nil &&
 * 		(ast.IsClassStaticBlockDeclaration(tx.currentClassElement) ||
 * 			(ast.IsPropertyDeclaration(tx.currentClassElement) && ast.HasStaticModifier(tx.currentClassElement))) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil {
 * 		if classThis := tx.tryGetClassThisNoContainer(); classThis != nil {
 * 			return classThis
 * 		}
 * 		// When the class was decorated with legacy decorators and no class constructor
 * 		// reference is available, the decorator may replace the constructor, so `this`
 * 		// cannot reliably point to the class. Use `(void 0)` instead.
 * 		if tx.lexicalEnvironment.data.facts&classFactsClassWasDecorated != 0 && tx.legacyDecorators {
 * 			return tx.Factory().NewParenthesizedExpression(tx.Factory().NewVoidZeroExpression())
 * 		}
 * 	}
 * 	return node
 * }
 */
export function classFieldsTransformer_visitThisExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.insideComputedPropertyName && receiver!.shouldTransformThisInStaticInitializers &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    if ((receiver!.lexicalEnvironment.data.facts & classFactsClassWasDecorated) === 0 || receiver!.legacyDecorators) {
      const classThis = classFieldsTransformer_tryGetClassThisNoContainer(receiver);
      if (classThis !== undefined) {
        return classThis;
      }
    }
  }
  if (receiver!.shouldTransformThisInStaticInitializers && receiver!.currentClassElement !== undefined &&
    (IsClassStaticBlockDeclaration(receiver!.currentClassElement) ||
      (IsPropertyDeclaration(receiver!.currentClassElement) && HasStaticModifier(receiver!.currentClassElement))) &&
    receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined) {
    const classThis = classFieldsTransformer_tryGetClassThisNoContainer(receiver);
    if (classThis !== undefined) {
      return classThis;
    }
    if ((receiver!.lexicalEnvironment.data.facts & classFactsClassWasDecorated) !== 0 && receiver!.legacyDecorators) {
      return NewParenthesizedExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewVoidZeroExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)) as GoPtr<Expression>);
    }
  }
  return node;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformClassMembers","kind":"method","status":"implemented","sigHash":"8b3993581e8830e44d0bbe87a464043b1b592039d41c338ea5b2e5bdb347f69f","bodyHash":"83e4870702779f5d7b9dbde5c869c9108e87e9edc9f6e7f0b53a1db5b6b30194"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformClassMembers(node *ast.Node) (members *ast.NodeList, prologue *ast.Expression) {
 * 	shouldTransformPrivateStaticElementsInClass := tx.EmitContext().EmitFlags(node)&printer.EFTransformPrivateStaticElements != 0
 * 
 * 	// Declare private names
 * 	if tx.shouldTransformPrivateElementsOrClassStaticBlocks || tx.shouldTransformPrivateStaticElementsInFile {
 * 		for _, member := range node.Members() {
 * 			if ast.IsPrivateIdentifierClassElementDeclaration(member) {
 * 				if tx.shouldTransformClassElementToWeakMap(member) {
 * 					tx.addPrivateIdentifierToEnvironment(member)
 * 				} else {
 * 					env := tx.getPrivateIdentifierEnvironment()
 * 					tx.setPrivateIdentifier(env, member.Name(), &privateIdentifierInfo{
 * 						kind: printer.PrivateIdentifierKindUntransformed,
 * 					})
 * 				}
 * 			}
 * 		}
 * 
 * 		if tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 			if len(tx.getPrivateInstanceMethodsAndAccessors(node)) > 0 {
 * 				tx.createBrandCheckWeakSetForPrivateMethods()
 * 			}
 * 		}
 * 
 * 		if tx.shouldTransformAutoAccessorsInCurrentClass() {
 * 			for _, member := range node.Members() {
 * 				if ast.IsAutoAccessorPropertyDeclaration(member) {
 * 					storageName := tx.Factory().NewGeneratedPrivateNameForNodeEx(member.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"})
 * 					if tx.shouldTransformPrivateElementsOrClassStaticBlocks ||
 * 						shouldTransformPrivateStaticElementsInClass && ast.HasStaticModifier(member) {
 * 						tx.addPrivateIdentifierPropertyDeclarationToEnvironment(member, storageName)
 * 					} else {
 * 						env := tx.getPrivateIdentifierEnvironment()
 * 						// Only register as untransformed if it hasn't already been registered
 * 						// by the first loop (e.g., if esDecorators expanded a private auto-accessor
 * 						// into a backing field with the same generated name).
 * 						if _, ok := tx.getPrivateIdentifier(env, storageName); !ok {
 * 							tx.setPrivateIdentifier(env, storageName, &privateIdentifierInfo{
 * 								kind: printer.PrivateIdentifierKindUntransformed,
 * 							})
 * 						}
 * 					}
 * 				}
 * 			}
 * 		}
 * 	}
 * 
 * 	members = tx.classElementVisitor.VisitNodes(node.MemberList())
 * 
 * 	// Create a synthetic constructor if necessary
 * 	var syntheticConstructor *ast.Node
 * 	if !core.Some(members.Nodes, ast.IsConstructorDeclaration) {
 * 		syntheticConstructor = tx.transformConstructor(nil, node)
 * 	}
 * 
 * 	// If there are pending expressions create a class static block in which to evaluate them, but only if
 * 	// class static blocks are not also being transformed. This block will be injected at the top of the class
 * 	// to ensure that expressions from computed property names are evaluated before any other static
 * 	// initializers.
 * 	var syntheticStaticBlock *ast.Node
 * 	if !tx.shouldTransformPrivateElementsOrClassStaticBlocks && len(tx.pendingExpressions) > 0 {
 * 		statement := tx.Factory().NewExpressionStatement(tx.Factory().InlineExpressions(tx.pendingExpressions))
 * 		if statement.SubtreeFacts()&ast.SubtreeContainsLexicalThisOrSuper != 0 {
 * 			// If there are `this` or `super` references from computed property names, shift the expression
 * 			// into an arrow function to be evaluated in the outer scope so that `this` and `super` are
 * 			// properly captured.
 * 			temp := tx.Factory().NewTempVariable()
 * 			tx.EmitContext().AddVariableDeclaration(temp)
 * 			arrow := tx.Factory().NewArrowFunction(
 * 				nil,                           /*modifiers* /
 * 				nil,                           /*typeParameters* /
 * 				tx.Factory().NewNodeList(nil), /*parameters* /
 * 				nil,                           /*returnType* /
 * 				nil,                           /*fullSignature* /
 * 				tx.Factory().NewToken(ast.KindEqualsGreaterThanToken), /*equalsGreaterThanToken* /
 * 				tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{statement}), false /*multiline* /),
 * 			)
 * 			prologue = tx.Factory().NewAssignmentExpression(temp, arrow)
 * 			statement = tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewCallExpression(temp, nil /*questionDotToken* /, nil /*typeArguments* /, tx.Factory().NewNodeList(nil), ast.NodeFlagsNone),
 * 			)
 * 		}
 * 
 * 		block := tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{statement}), false /*multiline* /)
 * 		syntheticStaticBlock = tx.Factory().NewClassStaticBlockDeclaration(nil /*modifiers* /, block)
 * 		tx.pendingExpressions = nil
 * 	}
 * 
 * 	// If we created a synthetic constructor or class static block, add them to the visited members
 * 	if syntheticConstructor != nil || syntheticStaticBlock != nil {
 * 		membersArray := make([]*ast.Node, 0, len(members.Nodes)+2)
 * 
 * 		// Find and preserve classThis assignment block and named evaluation helper block at the top
 * 		classThisIdx := slices.IndexFunc(members.Nodes, func(n *ast.Node) bool {
 * 			return isClassThisAssignmentBlock(tx.EmitContext(), n)
 * 		})
 * 		namedEvalIdx := slices.IndexFunc(members.Nodes, func(n *ast.Node) bool {
 * 			return isClassNamedEvaluationHelperBlock(tx.EmitContext(), n)
 * 		})
 * 
 * 		if classThisIdx >= 0 {
 * 			membersArray = append(membersArray, members.Nodes[classThisIdx])
 * 		}
 * 		if namedEvalIdx >= 0 {
 * 			membersArray = append(membersArray, members.Nodes[namedEvalIdx])
 * 		}
 * 		if syntheticConstructor != nil {
 * 			membersArray = append(membersArray, syntheticConstructor)
 * 		}
 * 		if syntheticStaticBlock != nil {
 * 			membersArray = append(membersArray, syntheticStaticBlock)
 * 		}
 * 
 * 		for i, member := range members.Nodes {
 * 			if i != classThisIdx && i != namedEvalIdx {
 * 				membersArray = append(membersArray, member)
 * 			}
 * 		}
 * 		members = tx.Factory().NewNodeList(membersArray)
 * 		members.Loc = node.MemberList().Loc
 * 	}
 * 
 * 	return members, prologue
 * }
 */
export function classFieldsTransformer_transformClassMembers(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): [GoPtr<NodeList>, GoPtr<Expression>] {
  const shouldTransformPrivateStaticElementsInClass = (EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node) & EFTransformPrivateStaticElements) !== 0;

  // Declare private names
  if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks || receiver!.shouldTransformPrivateStaticElementsInFile) {
    for (const member of Node_Members(node) ?? []) {
      if (IsPrivateIdentifierClassElementDeclaration(member)) {
        if (classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver, member)) {
          classFieldsTransformer_addPrivateIdentifierToEnvironment(receiver, member);
        } else {
          const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
          classFieldsTransformer_setPrivateIdentifier(receiver, env!, Node_Name(member)!, { kind: PrivateIdentifierKindUntransformed, brandCheckIdentifier: undefined, isStatic: false, isValid: false, variableName: undefined, methodName: undefined, getterName: undefined, setterName: undefined });
        }
      }
    }

    if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
      if (classFieldsTransformer_getPrivateInstanceMethodsAndAccessors(receiver, node).length > 0) {
        classFieldsTransformer_createBrandCheckWeakSetForPrivateMethods(receiver);
      }
    }

    if (classFieldsTransformer_shouldTransformAutoAccessorsInCurrentClass(receiver)) {
      for (const member of Node_Members(node) ?? []) {
        if (IsAutoAccessorPropertyDeclaration(member)) {
          const storageName = NodeFactory_NewGeneratedPrivateNameForNodeEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), Node_Name(member)!, { Flags: 0, Prefix: "", Suffix: "_accessor_storage" });
          if (receiver!.shouldTransformPrivateElementsOrClassStaticBlocks ||
            (shouldTransformPrivateStaticElementsInClass && HasStaticModifier(member))) {
            classFieldsTransformer_addPrivateIdentifierPropertyDeclarationToEnvironment(receiver, member, storageName);
          } else {
            const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
            const [, ok] = classFieldsTransformer_getPrivateIdentifier(receiver, env!, storageName);
            if (!ok) {
              classFieldsTransformer_setPrivateIdentifier(receiver, env!, storageName, { kind: PrivateIdentifierKindUntransformed, brandCheckIdentifier: undefined, isStatic: false, isValid: false, variableName: undefined, methodName: undefined, getterName: undefined, setterName: undefined });
            }
          }
        }
      }
    }
  }

  let members = NodeVisitor_VisitNodes(receiver!.classElementVisitor as ConcreteNodeVisitor, Node_MemberList(node));

  // Create a synthetic constructor if necessary
  let syntheticConstructor: GoPtr<Node> = undefined;
  if (!Some(members?.Nodes ?? [], IsConstructorDeclaration)) {
    syntheticConstructor = classFieldsTransformer_transformConstructor(receiver, undefined, node);
  }

  // If there are pending expressions create a class static block
  let syntheticStaticBlock: GoPtr<Node> = undefined;
  let prologue: GoPtr<Expression> = undefined;
  if (!receiver!.shouldTransformPrivateElementsOrClassStaticBlocks && receiver!.pendingExpressions.length > 0) {
    let statement: GoPtr<Node> = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), receiver!.pendingExpressions) as GoPtr<Expression>);
    if ((Node_SubtreeFacts(statement) & SubtreeContainsLexicalThisOrSuper) !== 0) {
      const tempArrow = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), tempArrow);
      const arrow = NewArrowFunction(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        undefined, /*modifiers*/
        undefined, /*typeParameters*/
        NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []), /*parameters*/
        undefined, /*returnType*/
        undefined, /*fullSignature*/
        NewToken(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, KindEqualsGreaterThanToken), /*equalsGreaterThanToken*/
        NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [statement]), false),
      );
      prologue = NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), tempArrow, arrow as GoPtr<Expression>);
      statement = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        NewCallExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, tempArrow as GoPtr<Expression>, undefined, undefined, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []), NodeFlagsNone),
      );
    }
    const block = NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [statement]), false);
    syntheticStaticBlock = NewClassStaticBlockDeclaration(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, block);
    receiver!.pendingExpressions = [];
  }

  // If we created a synthetic constructor or class static block, add them to the visited members
  if (syntheticConstructor !== undefined || syntheticStaticBlock !== undefined) {
    const memberNodes = members?.Nodes ?? [];
    const membersArray: GoSlice<GoPtr<Node>> = [];

    const classThisIdx = memberNodes.findIndex((n: GoPtr<Node>) => isClassThisAssignmentBlock(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), n));
    const namedEvalIdx = memberNodes.findIndex((n: GoPtr<Node>) => isClassNamedEvaluationHelperBlock(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), n));

    if (classThisIdx >= 0) membersArray.push(memberNodes[classThisIdx]);
    if (namedEvalIdx >= 0) membersArray.push(memberNodes[namedEvalIdx]);
    if (syntheticConstructor !== undefined) membersArray.push(syntheticConstructor);
    if (syntheticStaticBlock !== undefined) membersArray.push(syntheticStaticBlock);

    for (let i = 0; i < memberNodes.length; i++) {
      if (i !== classThisIdx && i !== namedEvalIdx) {
        membersArray.push(memberNodes[i]);
      }
    }
    const newMembers = NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, membersArray);
    if (members?.Loc !== undefined) newMembers!.Loc = members.Loc;
    members = newMembers;
  }

  return [members, prologue];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createBrandCheckWeakSetForPrivateMethods","kind":"method","status":"implemented","sigHash":"eccafbd2f7bdce2d5eba49cee8bfe12b487e75093deb1f9755871b2a0c8f5e14","bodyHash":"64a14e604300187427b2e76010c84c44bf49e32c10b20955fe515cf9e32cd2bc"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createBrandCheckWeakSetForPrivateMethods() {
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	weakSetName := env.data.weakSetName
 * 	debug.Assert(weakSetName != nil, "weakSetName should be set in private identifier environment")
 * 
 * 	tx.addPendingExpressions(
 * 		tx.Factory().NewAssignmentExpression(
 * 			weakSetName,
 * 			tx.Factory().NewNewExpression(
 * 				tx.Factory().NewIdentifier("WeakSet"),
 * 				nil, /*typeArguments* /
 * 				tx.Factory().NewNodeList(nil),
 * 			),
 * 		),
 * 	)
 * }
 */
export function classFieldsTransformer_createBrandCheckWeakSetForPrivateMethods(receiver: GoPtr<classFieldsTransformer>): void {
  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  const weakSetName = env!.data.weakSetName;
  debug.Assert(weakSetName !== undefined, "weakSetName should be set in private identifier environment");

  classFieldsTransformer_addPendingExpressions(receiver,
    NodeFactory_NewAssignmentExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!),
      weakSetName,
      NewNewExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "WeakSet") as GoPtr<Expression>,
        undefined, /*typeArguments*/
        NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []),
      ) as GoPtr<Expression>,
    ),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformConstructor","kind":"method","status":"implemented","sigHash":"5f9b2d570f1868635086302b73001e9f5162af41eeabf11d5e337f0bf7e74667","bodyHash":"cee8c0853ccdd3b156cb4d3077f286f59ba046f15b3e92af1500c6ff1d6206ac"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformConstructor(constructor *ast.ConstructorDeclaration, container *ast.Node) *ast.Node {
 * 	// NOTE: The Strada reference pre-visits the constructor via `visitNode(constructor, visitor)` before
 * 	// checking WillHoistInitializersToConstructor. This is not done here because Go's variable environment
 * 	// (StartVariableEnvironment/EndAndMergeVariableEnvironment) is scoped inside transformConstructorBody.
 * 	// Pre-visiting would hoist variables outside that scope, causing them to appear after field initializers
 * 	// instead of before. Instead, we visit parameters and body separately within the correct scopes.
 * 	if tx.lexicalEnvironment == nil || tx.lexicalEnvironment.data == nil ||
 * 		tx.lexicalEnvironment.data.facts&classFactsWillHoistInitializersToConstructor == 0 {
 * 		if constructor != nil {
 * 			return tx.Visitor().VisitEachChild(constructor.AsNode())
 * 		}
 * 		return nil
 * 	}
 * 
 * 	extendsClauseElement := ast.GetClassExtendsHeritageElement(container)
 * 	isDerivedClass := extendsClauseElement != nil && ast.SkipOuterExpressions(extendsClauseElement.Expression(), ast.OEKAll).Kind != ast.KindNullKeyword
 * 
 * 	var parameters *ast.NodeList
 * 	if constructor != nil {
 * 		parameters = tx.Visitor().VisitNodes(constructor.Parameters)
 * 	}
 * 
 * 	body := tx.transformConstructorBody(container, constructor, isDerivedClass)
 * 	if body == nil {
 * 		if constructor != nil {
 * 			return tx.Visitor().VisitEachChild(constructor.AsNode())
 * 		}
 * 		return nil
 * 	}
 * 
 * 	if constructor != nil {
 * 		debug.Assert(parameters != nil)
 * 		return tx.Factory().UpdateConstructorDeclaration(
 * 			constructor,
 * 			nil, /*modifiers* /
 * 			nil, /*typeParameters* /
 * 			parameters,
 * 			nil, /*returnType* /
 * 			nil, /*fullSignature* /
 * 			body,
 * 		)
 * 	}
 * 
 * 	if parameters == nil {
 * 		parameters = tx.Factory().NewNodeList(nil)
 * 	}
 * 
 * 	result := tx.Factory().NewConstructorDeclaration(
 * 		nil, /*modifiers* /
 * 		nil, /*typeParameters* /
 * 		parameters,
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * 	result.Loc = container.Loc
 * 	return result
 * }
 */
export function classFieldsTransformer_transformConstructor(receiver: GoPtr<classFieldsTransformer>, constructor_: GoPtr<ConstructorDeclaration>, container: GoPtr<Node>): GoPtr<Node> {
  if (receiver!.lexicalEnvironment === undefined || receiver!.lexicalEnvironment.data === undefined ||
    (receiver!.lexicalEnvironment.data.facts & classFactsWillHoistInitializersToConstructor) === 0) {
    if (constructor_ !== undefined) {
      return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), constructor_ as unknown as GoPtr<Node>);
    }
    return undefined;
  }

  const extendsClauseElement = GetClassExtendsHeritageElement(container);
  const isDerivedClass = extendsClauseElement !== undefined &&
    SkipOuterExpressions(AsExpressionWithTypeArguments(extendsClauseElement)!.Expression as unknown as GoPtr<Node>, OEKAll)!.Kind !== KindNullKeyword;

  let parameters: GoPtr<NodeList> = undefined;
  if (constructor_ !== undefined) {
    parameters = NodeVisitor_VisitNodes((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), constructor_!.Parameters as GoPtr<NodeList>);
  }

  const body = classFieldsTransformer_transformConstructorBody(receiver, container, constructor_, isDerivedClass);
  if (body === undefined) {
    if (constructor_ !== undefined) {
      return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), constructor_ as unknown as GoPtr<Node>);
    }
    return undefined;
  }

  if (constructor_ !== undefined) {
    return NodeFactory_UpdateConstructorDeclaration(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      constructor_,
      undefined, /*modifiers*/
      undefined, /*typeParameters*/
      parameters,
      undefined, /*returnType*/
      undefined, /*fullSignature*/
      body,
    );
  }

  if (parameters === undefined) {
    parameters = NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []);
  }

  const result = NewConstructorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    undefined, /*modifiers*/
    undefined, /*typeParameters*/
    parameters,
    undefined, /*returnType*/
    undefined, /*fullSignature*/
    body,
  );
  result!.Loc = container!.Loc;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformConstructorBodyWorker","kind":"method","status":"implemented","sigHash":"1eb32ecb93f64e3fd709f23bebfdf1ec11d370679470da9b1433ad8363ed7646","bodyHash":"1e24b1ad42d080bd9e2e21b8714f9f5649c4fff3195f96ac0aa265ed0fa95066"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformConstructorBodyWorker(
 * 	statementsOut []*ast.Statement,
 * 	statementsIn []*ast.Statement,
 * 	statementOffset int,
 * 	superPath []int,
 * 	superPathDepth int,
 * 	initializerStatements []*ast.Statement,
 * 	constructor *ast.ConstructorDeclaration,
 * ) []*ast.Statement {
 * 	superStatementIndex := superPath[superPathDepth]
 * 	superStatement := statementsIn[superStatementIndex]
 * 
 * 	// Visit statements before super
 * 	visited, _ := tx.Visitor().VisitSlice(statementsIn[statementOffset:superStatementIndex])
 * 	statementsOut = append(statementsOut, visited...)
 * 	statementOffset = superStatementIndex + 1
 * 
 * 	if ast.IsTryStatement(superStatement) {
 * 		tryBlock := superStatement.AsTryStatement().TryBlock.AsBlock()
 * 		tryBlockStatements := tx.transformConstructorBodyWorker(
 * 			nil,
 * 			tryBlock.Statements.Nodes,
 * 			0, /*statementOffset* /
 * 			superPath,
 * 			superPathDepth+1,
 * 			initializerStatements,
 * 			constructor,
 * 		)
 * 		tryStatementList := tx.Factory().NewNodeList(tryBlockStatements)
 * 		tryStatementList.Loc = tryBlock.Statements.Loc
 * 
 * 		catchClause := tx.Visitor().VisitNode(superStatement.AsTryStatement().CatchClause)
 * 		finallyBlock := tx.Visitor().VisitNode(superStatement.AsTryStatement().FinallyBlock)
 * 
 * 		updated := tx.Factory().UpdateTryStatement(
 * 			superStatement.AsTryStatement(),
 * 			tx.Factory().UpdateBlock(tryBlock, tryStatementList, tryBlock.MultiLine),
 * 			catchClause,
 * 			finallyBlock,
 * 		)
 * 		statementsOut = append(statementsOut, updated)
 * 	} else {
 * 		visited, _ := tx.Visitor().VisitSlice(statementsIn[superStatementIndex : superStatementIndex+1])
 * 		statementsOut = append(statementsOut, visited...)
 * 
 * 		// Add the property initializers. Transforms this:
 * 		//
 * 		//  public x = 1;
 * 		//
 * 		// Into this:
 * 		//
 * 		//  constructor() {
 * 		//      this.x = 1;
 * 		//  }
 * 		//
 * 		// If we do useDefineForClassFields, they'll be converted elsewhere.
 * 		// We instead *remove* them from the transformed output at this stage.
 * 
 * 		// parameter-property assignments should occur immediately after the prologue and `super()`,
 * 		// so only count the statements that immediately follow.
 * 		for statementOffset < len(statementsIn) {
 * 			stmt := statementsIn[statementOffset]
 * 			orig := tx.EmitContext().MostOriginal(stmt)
 * 			if ast.IsParameterPropertyDeclaration(orig, constructor.AsNode()) {
 * 				statementOffset++
 * 			} else {
 * 				break
 * 			}
 * 		}
 * 
 * 		statementsOut = append(statementsOut, initializerStatements...)
 * 	}
 * 
 * 	// Visit remaining statements
 * 	visited2, _ := tx.Visitor().VisitSlice(statementsIn[statementOffset:])
 * 	statementsOut = append(statementsOut, visited2...)
 * 	return statementsOut
 * }
 */
export function classFieldsTransformer_transformConstructorBodyWorker(receiver: GoPtr<classFieldsTransformer>, statementsOut: GoSlice<GoPtr<Statement>>, statementsIn: GoSlice<GoPtr<Statement>>, statementOffset: int, superPath: GoSlice<int>, superPathDepth: int, initializerStatements: GoSlice<GoPtr<Statement>>, constructor_: GoPtr<ConstructorDeclaration>): GoSlice<GoPtr<Statement>> {
  const superStatementIndex = superPath[superPathDepth]!;
  const superStatement = statementsIn[superStatementIndex];

  // Visit statements before super
  const [visitedBefore] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), statementsIn.slice(statementOffset, superStatementIndex) as unknown as GoSlice<GoPtr<Node>>);
  let out: GoSlice<GoPtr<Statement>> = [...statementsOut, ...visitedBefore as unknown as GoSlice<GoPtr<Statement>>];
  let newOffset = superStatementIndex + 1;

  if (IsTryStatement(superStatement as unknown as GoPtr<Node>)) {
    const tryStmt = AsTryStatement(superStatement as unknown as GoPtr<Node>);
    const tryBlock = AsBlock(tryStmt!.TryBlock as unknown as GoPtr<Node>);
    const tryBlockStatements = classFieldsTransformer_transformConstructorBodyWorker(
      receiver,
      [],
      tryBlock!.Statements!.Nodes as unknown as GoSlice<GoPtr<Statement>>,
      0, /*statementOffset*/
      superPath,
      superPathDepth + 1,
      initializerStatements,
      constructor_,
    );
    const tryStatementList = NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, tryBlockStatements as unknown as GoSlice<GoPtr<Node>>);
    tryStatementList!.Loc = tryBlock!.Statements!.Loc;

    const catchClause = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), tryStmt!.CatchClause as unknown as GoPtr<Node>);
    const finallyBlock = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), tryStmt!.FinallyBlock as unknown as GoPtr<Node>);

    const updatedBlock = NodeFactory_UpdateBlock(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      tryBlock,
      tryStatementList,
      tryBlock!.MultiLine,
    );
    const updated = NodeFactory_UpdateTryStatement(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      tryStmt,
      updatedBlock,
      catchClause,
      finallyBlock,
    );
    out = [...out, updated as unknown as GoPtr<Statement>];
  } else {
    const [visitedSuper] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), statementsIn.slice(superStatementIndex, superStatementIndex + 1) as unknown as GoSlice<GoPtr<Node>>);
    out = [...out, ...visitedSuper as unknown as GoSlice<GoPtr<Statement>>];

    // parameter-property assignments should occur immediately after the prologue and `super()`,
    // so only count the statements that immediately follow.
    while (newOffset < statementsIn.length) {
      const stmt = statementsIn[newOffset];
      const orig = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), stmt as unknown as GoPtr<Node>);
      if (IsParameterPropertyDeclaration(orig, constructor_ as unknown as GoPtr<Node>)) {
        newOffset++;
      } else {
        break;
      }
    }

    out = [...out, ...initializerStatements];
  }

  // Visit remaining statements
  const [visited2] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), statementsIn.slice(newOffset) as unknown as GoSlice<GoPtr<Node>>);
  out = [...out, ...visited2 as unknown as GoSlice<GoPtr<Statement>>];
  return out;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformConstructorBody","kind":"method","status":"implemented","sigHash":"13bfec2b9b0be6a0874ea47291a45c2af829546d588eac0dfc7ec9a85dfd6e79","bodyHash":"8658ee7a30b4e04e8c32de85848e519b2d457cf5f323c6b0b57d79f19a015d12"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformConstructorBody(container *ast.Node, constructor *ast.ConstructorDeclaration, isDerivedClass bool) *ast.Node {
 * 	instanceProperties := tx.getProperties(container, false /*requireInitializer* /, false /*isStatic* /)
 * 	properties := instanceProperties
 * 	if !tx.compilerOptions.GetUseDefineForClassFields() {
 * 		properties = core.Filter(properties, func(prop *ast.Node) bool {
 * 			return prop.Initializer() != nil || ast.IsPrivateIdentifier(prop.Name()) || ast.HasAccessorModifier(prop)
 * 		})
 * 	}
 * 
 * 	privateMethodsAndAccessors := tx.getPrivateInstanceMethodsAndAccessors(container)
 * 	needsConstructorBody := len(properties) > 0 || len(privateMethodsAndAccessors) > 0
 * 
 * 	// Only generate synthetic constructor when there are property initializers to move.
 * 	if constructor == nil && !needsConstructorBody {
 * 		return tx.EmitContext().VisitFunctionBody(nil, tx.Visitor())
 * 	}
 * 
 * 	tx.EmitContext().StartVariableEnvironment()
 * 
 * 	needsSyntheticConstructor := constructor == nil && isDerivedClass
 * 	var statements []*ast.Statement
 * 
 * 	// Add the property initializers. Transforms this:
 * 	//
 * 	//  public x = 1;
 * 	//
 * 	// Into this:
 * 	//
 * 	//  constructor() {
 * 	//      this.x = 1;
 * 	//  }
 * 	//
 * 	var initializerStatements []*ast.Statement
 * 	receiver := tx.Factory().NewThisExpression()
 * 
 * 	// private methods can be called in property initializers, they should execute first
 * 	initializerStatements = tx.addInstanceMethodStatements(initializerStatements, privateMethodsAndAccessors, receiver)
 * 
 * 	if constructor != nil {
 * 		parameterProperties := core.Filter(instanceProperties, func(prop *ast.Node) bool {
 * 			return ast.IsParameterPropertyDeclaration(tx.EmitContext().MostOriginal(prop), constructor.AsNode())
 * 		})
 * 		nonParameterProperties := core.Filter(properties, func(prop *ast.Node) bool {
 * 			return !ast.IsParameterPropertyDeclaration(tx.EmitContext().MostOriginal(prop), constructor.AsNode())
 * 		})
 * 		initializerStatements = tx.addPropertyOrClassStaticBlockStatements(initializerStatements, parameterProperties, receiver)
 * 		initializerStatements = tx.addPropertyOrClassStaticBlockStatements(initializerStatements, nonParameterProperties, receiver)
 * 	} else {
 * 		initializerStatements = tx.addPropertyOrClassStaticBlockStatements(initializerStatements, properties, receiver)
 * 	}
 * 
 * 	if constructor != nil && constructor.Body != nil {
 * 		body := constructor.Body.AsBlock()
 * 
 * 		// Copy prologue
 * 		for _, stmt := range body.Statements.Nodes {
 * 			if ast.IsPrologueDirective(stmt) {
 * 				statements = append(statements, stmt)
 * 			} else {
 * 				break
 * 			}
 * 		}
 * 		statementOffset := len(statements)
 * 
 * 		superPath := transformers.FindSuperStatementIndexPath(body.Statements.Nodes, statementOffset)
 * 		if len(superPath) > 0 {
 * 			statements = tx.transformConstructorBodyWorker(statements, body.Statements.Nodes, statementOffset, superPath, 0, initializerStatements, constructor)
 * 		} else {
 * 			// parameter-property assignments should occur immediately after the prologue and `super()`,
 * 			// so only count the statements that immediately follow.
 * 			for statementOffset < len(body.Statements.Nodes) {
 * 				stmt := body.Statements.Nodes[statementOffset]
 * 				orig := tx.EmitContext().MostOriginal(stmt)
 * 				if ast.IsParameterPropertyDeclaration(orig, constructor.AsNode()) {
 * 					statementOffset++
 * 				} else {
 * 					break
 * 				}
 * 			}
 * 			statements = append(statements, initializerStatements...)
 * 			visited, _ := tx.Visitor().VisitSlice(body.Statements.Nodes[statementOffset:])
 * 			statements = append(statements, visited...)
 * 		}
 * 	} else {
 * 		if needsSyntheticConstructor {
 * 			// Add a synthetic `super` call:
 * 			//
 * 			//  super(...arguments);
 * 			//
 * 			superCall := tx.Factory().NewExpressionStatement(
 * 				tx.Factory().NewCallExpression(
 * 					tx.Factory().NewKeywordExpression(ast.KindSuperKeyword),
 * 					nil, /*typeArguments* /
 * 					nil, /*questionDotToken* /
 * 					tx.Factory().NewNodeList([]*ast.Node{
 * 						tx.Factory().NewSpreadElement(tx.Factory().NewIdentifier("arguments")),
 * 					}),
 * 					ast.NodeFlagsNone,
 * 				),
 * 			)
 * 			statements = append(statements, superCall)
 * 		}
 * 		statements = append(statements, initializerStatements...)
 * 	}
 * 
 * 	statements = tx.EmitContext().EndAndMergeVariableEnvironment(statements)
 * 
 * 	if len(statements) == 0 && constructor == nil {
 * 		return nil
 * 	}
 * 
 * 	var multiLine bool
 * 	if constructor != nil && constructor.Body != nil &&
 * 		len(constructor.Body.AsBlock().Statements.Nodes) >= len(statements) {
 * 		multiLine = constructor.Body.AsBlock().MultiLine
 * 	} else {
 * 		multiLine = len(statements) > 0
 * 	}
 * 
 * 	statementList := tx.Factory().NewNodeList(statements)
 * 	if constructor != nil && constructor.Body != nil {
 * 		statementList.Loc = constructor.Body.AsBlock().Statements.Loc
 * 	} else {
 * 		statementList.Loc = core.NewTextRange(container.MemberList().Loc.Pos(), container.MemberList().Loc.End())
 * 	}
 * 
 * 	block := tx.Factory().NewBlock(statementList, multiLine)
 * 	if constructor != nil && constructor.Body != nil {
 * 		block.Loc = constructor.Body.Loc
 * 	}
 * 	return block
 * }
 */
export function classFieldsTransformer_transformConstructorBody(receiver: GoPtr<classFieldsTransformer>, container: GoPtr<Node>, constructor_: GoPtr<ConstructorDeclaration>, isDerivedClass: bool): GoPtr<Node> {
  const instanceProperties = classFieldsTransformer_getProperties(receiver, container, false /*requireInitializer*/, false /*isStatic*/);
  let properties = instanceProperties;
  if (!CompilerOptions_GetUseDefineForClassFields(receiver!.compilerOptions)) {
    properties = properties.filter((prop) =>
      Node_Initializer(prop) !== undefined || IsPrivateIdentifier(Node_Name(prop)) || HasAccessorModifier(prop)
    );
  }

  const privateMethodsAndAccessors = classFieldsTransformer_getPrivateInstanceMethodsAndAccessors(receiver, container);
  const needsConstructorBody = properties.length > 0 || privateMethodsAndAccessors.length > 0;

  // Only generate synthetic constructor when there are property initializers to move.
  if (constructor_ === undefined && !needsConstructorBody) {
    return EmitContext_VisitFunctionBody(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), undefined, Transformer_Visitor(receiver!.__tsgoEmbedded0!)) as unknown as GoPtr<Node>;
  }

  EmitContext_StartVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!));

  const needsSyntheticConstructor = constructor_ === undefined && isDerivedClass;
  let statements: GoSlice<GoPtr<Statement>> = [];

  // Add the property initializers.
  let initializerStatements: GoSlice<GoPtr<Statement>> = [];
  const receiverExpr = NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!));

  // private methods can be called in property initializers, they should execute first
  initializerStatements = classFieldsTransformer_addInstanceMethodStatements(receiver, initializerStatements, privateMethodsAndAccessors, receiverExpr);

  if (constructor_ !== undefined) {
    const constructorNode = constructor_ as unknown as GoPtr<Node>;
    const parameterProperties = instanceProperties.filter((prop) =>
      IsParameterPropertyDeclaration(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), prop), constructorNode)
    );
    const nonParameterProperties = properties.filter((prop) =>
      !IsParameterPropertyDeclaration(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), prop), constructorNode)
    );
    initializerStatements = classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver, initializerStatements as unknown as GoSlice<GoPtr<Node>>, parameterProperties, receiverExpr) as unknown as GoSlice<GoPtr<Statement>>;
    initializerStatements = classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver, initializerStatements as unknown as GoSlice<GoPtr<Node>>, nonParameterProperties, receiverExpr) as unknown as GoSlice<GoPtr<Statement>>;
  } else {
    initializerStatements = classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver, initializerStatements as unknown as GoSlice<GoPtr<Node>>, properties, receiverExpr) as unknown as GoSlice<GoPtr<Statement>>;
  }

  if (constructor_ !== undefined && constructor_!.Body !== undefined) {
    const body = AsBlock(constructor_!.Body);

    // Copy prologue
    for (const stmt of body!.Statements!.Nodes) {
      if (IsPrologueDirective(stmt)) {
        statements = [...statements, stmt as unknown as GoPtr<Statement>];
      } else {
        break;
      }
    }
    let statementOffset = statements.length;

    const superPath = FindSuperStatementIndexPath(body!.Statements!.Nodes as unknown as GoSlice<GoPtr<Statement>>, statementOffset);
    if (superPath.length > 0) {
      statements = classFieldsTransformer_transformConstructorBodyWorker(receiver, statements, body!.Statements!.Nodes as unknown as GoSlice<GoPtr<Statement>>, statementOffset, superPath, 0, initializerStatements, constructor_);
    } else {
      // parameter-property assignments should occur immediately after the prologue and `super()`,
      // so only count the statements that immediately follow.
      const bodyNodes = body!.Statements!.Nodes as unknown as GoSlice<GoPtr<Statement>>;
      while (statementOffset < bodyNodes.length) {
        const stmt = bodyNodes[statementOffset];
        const orig = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), stmt as unknown as GoPtr<Node>);
        if (IsParameterPropertyDeclaration(orig, constructor_ as unknown as GoPtr<Node>)) {
          statementOffset++;
        } else {
          break;
        }
      }
      statements = [...statements, ...initializerStatements];
      const [visited] = NodeVisitor_VisitSlice((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), bodyNodes.slice(statementOffset) as unknown as GoSlice<GoPtr<Node>>);
      statements = [...statements, ...visited as unknown as GoSlice<GoPtr<Statement>>];
    }
  } else {
    if (needsSyntheticConstructor) {
      // Add a synthetic `super` call:
      //
      //  super(...arguments);
      //
      const superCall = NewExpressionStatement(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        NewCallExpression(
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          NewKeywordExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, KindSuperKeyword),
          undefined, /*typeArguments*/
          undefined, /*questionDotToken*/
          NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [
            NewSpreadElement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "arguments")),
          ]),
          NodeFlagsNone,
        ),
      );
      statements = [...statements, superCall as unknown as GoPtr<Statement>];
    }
    statements = [...statements, ...initializerStatements];
  }

  statements = EmitContext_EndAndMergeVariableEnvironment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statements);

  if (statements.length === 0 && constructor_ === undefined) {
    return undefined;
  }

  let multiLine: bool;
  if (constructor_ !== undefined && constructor_!.Body !== undefined &&
      AsBlock(constructor_!.Body)!.Statements!.Nodes.length >= statements.length) {
    multiLine = AsBlock(constructor_!.Body)!.MultiLine;
  } else {
    multiLine = statements.length > 0;
  }

  const statementList = NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, statements as unknown as GoSlice<GoPtr<Node>>);
  if (constructor_ !== undefined && constructor_!.Body !== undefined) {
    statementList!.Loc = AsBlock(constructor_!.Body)!.Statements!.Loc;
  } else {
    statementList!.Loc = NewTextRange(Node_MemberList(container)!.Loc.pos, Node_MemberList(container)!.Loc.end);
  }

  const block = NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, statementList, multiLine);
  if (constructor_ !== undefined && constructor_!.Body !== undefined) {
    block!.Loc = constructor_!.Body!.Loc;
  }
  return block;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPropertyOrClassStaticBlockStatements","kind":"method","status":"implemented","sigHash":"718f1f330e968303f1fde4708e4ae0bef3f5ac29d4d15439c79213862173efc4","bodyHash":"4ae2440cd93458ec4b89388d45d6bda91c0123358eeec645536a8d954c68e6d7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPropertyOrClassStaticBlockStatements(statements []*ast.Node, properties []*ast.Node, receiver *ast.Expression) []*ast.Node {
 * 	for _, property := range properties {
 * 		if ast.IsStatic(property) && !tx.shouldTransformPrivateElementsOrClassStaticBlocks {
 * 			continue
 * 		}
 * 		statement := tx.transformPropertyOrClassStaticBlock(property, receiver)
 * 		if statement != nil {
 * 			statements = append(statements, statement)
 * 		}
 * 	}
 * 	return statements
 * }
 */
export function classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver: GoPtr<classFieldsTransformer>, statements: GoSlice<GoPtr<Node>>, properties: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Node>> {
  let out = statements;
  for (const property of properties) {
    if (IsStatic(property) && !receiver!.shouldTransformPrivateElementsOrClassStaticBlocks) {
      continue;
    }
    const statement = classFieldsTransformer_transformPropertyOrClassStaticBlock(receiver, property, receiver1);
    if (statement !== undefined) {
      out = [...out, statement];
    }
  }
  return out;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformPropertyOrClassStaticBlock","kind":"method","status":"implemented","sigHash":"72dd137624ff6d089c7cb7da2021cab2aede121dfea21c32dc125fd3e598fe8f","bodyHash":"6ce560e8cdc16e1272826811364d4d85c955fa47a9ffe23c9d8e548b808cdfd7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformPropertyOrClassStaticBlock(property *ast.Node, receiver *ast.Expression) *ast.Node {
 * 	var expression *ast.Expression
 * 	if ast.IsClassStaticBlockDeclaration(property) {
 * 		expression = tx.setCurrentClassElementAnd(property, (*classFieldsTransformer).transformClassStaticBlockDeclaration, property)
 * 	} else {
 * 		expression = tx.transformProperty(property.AsPropertyDeclaration(), receiver)
 * 	}
 * 	if expression == nil {
 * 		return nil
 * 	}
 * 
 * 	statement := tx.Factory().NewExpressionStatement(expression)
 * 	tx.EmitContext().SetOriginal(statement, property)
 * 	tx.EmitContext().AddEmitFlags(statement, tx.EmitContext().EmitFlags(property)&printer.EFNoComments)
 * 	tx.EmitContext().SetCommentRange(statement, property.Loc)
 * 
 * 	propertyOriginalNode := tx.EmitContext().MostOriginal(property)
 * 	if ast.IsParameterDeclaration(propertyOriginalNode) {
 * 		tx.EmitContext().SetSourceMapRange(statement, propertyOriginalNode.Loc)
 * 		tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 	} else {
 * 		tx.EmitContext().SetSourceMapRange(statement, transformers.MoveRangePastModifiers(property))
 * 	}
 * 
 * 	// `setOriginalNode` *copies* the `emitNode` from `property`, so now both
 * 	// `statement` and `expression` have a copy of the synthesized comments.
 * 	// Drop the comments from expression to avoid printing them twice.
 * 	tx.EmitContext().SetSyntheticLeadingComments(expression, nil)
 * 	tx.EmitContext().SetSyntheticTrailingComments(expression, nil)
 * 
 * 	// If the property was originally an auto-accessor, don't emit comments here since they will be attached to
 * 	// the synthesized getter.
 * 	if ast.HasAccessorModifier(propertyOriginalNode) {
 * 		tx.EmitContext().AddEmitFlags(statement, printer.EFNoComments)
 * 	}
 * 
 * 	return statement
 * }
 */
export function classFieldsTransformer_transformPropertyOrClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<Node>, receiver1: GoPtr<Expression>): GoPtr<Node> {
  let expression: GoPtr<Expression>;
  if (IsClassStaticBlockDeclaration(property)) {
    expression = classFieldsTransformer_setCurrentClassElementAnd(receiver, property as unknown as GoPtr<ClassElement>, classFieldsTransformer_transformClassStaticBlockDeclaration, property) as unknown as GoPtr<Expression>;
  } else {
    expression = classFieldsTransformer_transformProperty(receiver, AsPropertyDeclaration(property), receiver1);
  }
  if (expression === undefined) {
    return undefined;
  }

  const statement = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, expression);
  EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, property);
  EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, EmitContext_EmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), property) & EFNoComments);
  EmitContext_SetCommentRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, property!.Loc);

  const propertyOriginalNode = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), property);
  if (IsParameterDeclaration(propertyOriginalNode)) {
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, propertyOriginalNode!.Loc);
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, EFNoComments);
  } else {
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, MoveRangePastModifiers(property));
  }

  // `setOriginalNode` *copies* the `emitNode` from `property`, so now both
  // `statement` and `expression` have a copy of the synthesized comments.
  // Drop the comments from expression to avoid printing them twice.
  EmitContext_SetSyntheticLeadingComments(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, []);
  EmitContext_SetSyntheticTrailingComments(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, []);

  // If the property was originally an auto-accessor, don't emit comments here since they will be attached to
  // the synthesized getter.
  if (HasAccessorModifier(propertyOriginalNode)) {
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), statement, EFNoComments);
  }

  return statement;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.generateInitializedPropertyExpressionsOrClassStaticBlock","kind":"method","status":"implemented","sigHash":"3406ac44c793fd2824e31df2f8146e3b6ce67706285f0cd8a92ef4f847c5f40c","bodyHash":"6a048f134bc3400778ce844c00804f6518960c04cc9ffa798e857b9abdf15b4c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) generateInitializedPropertyExpressionsOrClassStaticBlock(
 * 	propertiesOrClassStaticBlocks []*ast.Node,
 * 	receiver *ast.Expression,
 * ) []*ast.Expression {
 * 	var expressions []*ast.Expression
 * 	for _, property := range propertiesOrClassStaticBlocks {
 * 		var expression *ast.Expression
 * 		if ast.IsClassStaticBlockDeclaration(property) {
 * 			expression = tx.setCurrentClassElementAnd(property, (*classFieldsTransformer).transformClassStaticBlockDeclaration, property)
 * 		} else {
 * 			expression = tx.transformProperty(property.AsPropertyDeclaration(), receiver)
 * 		}
 * 		if expression == nil {
 * 			continue
 * 		}
 * 		tx.EmitContext().SetOriginalEx(expression, property, true /*allowOverwrite* /)
 * 		tx.EmitContext().AssignCommentAndSourceMapRanges(expression, property)
 * 		expressions = append(expressions, expression)
 * 	}
 * 	return expressions
 * }
 */
export function classFieldsTransformer_generateInitializedPropertyExpressionsOrClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, propertiesOrClassStaticBlocks: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Expression>> {
  let expressions: GoSlice<GoPtr<Expression>> = [];
  for (const property of propertiesOrClassStaticBlocks) {
    let expression: GoPtr<Expression>;
    if (IsClassStaticBlockDeclaration(property)) {
      expression = classFieldsTransformer_setCurrentClassElementAnd(receiver, property as unknown as GoPtr<ClassElement>, classFieldsTransformer_transformClassStaticBlockDeclaration, property) as unknown as GoPtr<Expression>;
    } else {
      expression = classFieldsTransformer_transformProperty(receiver, AsPropertyDeclaration(property), receiver1);
    }
    if (expression === undefined) {
      continue;
    }
    EmitContext_SetOriginalEx(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, property, true /*allowOverwrite*/);
    EmitContext_AssignCommentAndSourceMapRanges(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), expression, property);
    expressions = [...expressions, expression];
  }
  return expressions;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformProperty","kind":"method","status":"implemented","sigHash":"f95c2f9d14ce6d9e28dab08220415f188b4e7bc7692a581a46760ce303ea7ee4","bodyHash":"6ac1cee77a9ea132fa9a0b4d41a426a14ee404e626b8463edd52a01ff6252f3c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformProperty(property *ast.PropertyDeclaration, receiver *ast.Expression) *ast.Expression {
 * 	savedCurrentClassElement := tx.currentClassElement
 * 	transformed := tx.transformPropertyWorker(property, receiver)
 * 	if transformed != nil && ast.HasStaticModifier(property.AsNode()) &&
 * 		tx.lexicalEnvironment != nil && tx.lexicalEnvironment.data != nil && tx.lexicalEnvironment.data.facts != 0 {
 * 		// capture the lexical environment for the member
 * 		tx.EmitContext().SetOriginal(transformed, property.AsNode())
 * 		tx.EmitContext().SetSourceMapRange(transformed, tx.EmitContext().SourceMapRange(property.Name()))
 * 	}
 * 	tx.currentClassElement = savedCurrentClassElement
 * 	return transformed
 * }
 */
export function classFieldsTransformer_transformProperty(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<PropertyDeclaration>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  const savedCurrentClassElement = receiver!.currentClassElement;
  const transformed = classFieldsTransformer_transformPropertyWorker(receiver, property, receiver1);
  // EFNoLexicalThis is not yet ported; skipping AddEmitFlags(transformed, EFNoLexicalThis) for static properties
  if (transformed !== undefined && HasStaticModifier(property as unknown as GoPtr<Node>) &&
      receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.data !== undefined && receiver!.lexicalEnvironment.data.facts !== classFactsNone) {
    // capture the lexical environment for the member
    EmitContext_SetOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), transformed, property as unknown as GoPtr<Node>);
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), transformed, EmitContext_SourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), Node_Name(property as unknown as GoPtr<Node>)));
  }
  receiver!.currentClassElement = savedCurrentClassElement;
  return transformed;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformPropertyWorker","kind":"method","status":"implemented","sigHash":"7a0ab99bf4d2a8d759f4021e689cfc1884bc9752dc854dee2f148de8da8395b9","bodyHash":"9ae13d91408130601aadffa8f756e4e71d95572a546156a0ea8355337834f74a"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformPropertyWorker(property *ast.PropertyDeclaration, receiver *ast.Expression) *ast.Expression {
 * 	// We generate a name here in order to reuse the value cached by the relocated computed name expression (which uses the same generated name)
 * 	emitAssignment := !tx.compilerOptions.GetUseDefineForClassFields()
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), property.AsNode(), tx.isAnonymousClassNeedingAssignedName) {
 * 		property = transformNamedEvaluation(tx.EmitContext(), property.AsNode(), false, "").AsPropertyDeclaration()
 * 	}
 * 
 * 	propertyName := property.Name()
 * 	if ast.HasAccessorModifier(property.AsNode()) {
 * 		propertyName = tx.Factory().NewGeneratedPrivateNameForNodeEx(property.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"})
 * 	} else if ast.IsComputedPropertyName(propertyName) && !transformers.IsSimpleInlineableExpression(propertyName.Expression()) {
 * 		propertyName = tx.Factory().UpdateComputedPropertyName(
 * 			propertyName.AsComputedPropertyName(),
 * 			tx.Factory().NewGeneratedNameForNode(propertyName),
 * 		)
 * 	}
 * 
 * 	if ast.HasStaticModifier(property.AsNode()) {
 * 		tx.currentClassElement = property.AsNode()
 * 	}
 * 
 * 	if ast.IsPrivateIdentifier(propertyName) && tx.shouldTransformClassElementToWeakMap(property.AsNode()) {
 * 		info := tx.accessPrivateIdentifier(propertyName)
 * 		if info != nil {
 * 			if info.kind == printer.PrivateIdentifierKindField {
 * 				if !info.isStatic {
 * 					return createPrivateInstanceFieldInitializer(
 * 						tx.Factory(),
 * 						receiver,
 * 						tx.Visitor().VisitNode(property.Initializer),
 * 						info.brandCheckIdentifier,
 * 					)
 * 				}
 * 				return createPrivateStaticFieldInitializer(
 * 					tx.Factory(),
 * 					info.variableName,
 * 					tx.Visitor().VisitNode(property.Initializer),
 * 				)
 * 			}
 * 			return nil
 * 		} else {
 * 			debug.Fail("Undeclared private name for property declaration.")
 * 		}
 * 	}
 * 
 * 	if (ast.IsPrivateIdentifier(propertyName) || ast.HasStaticModifier(property.AsNode())) && property.Initializer == nil {
 * 		return nil
 * 	}
 * 
 * 	// TODO: can we get rid of this original checking and better coordinate with runtimesyntax?
 * 	if ast.HasAbstractModifier(tx.EmitContext().MostOriginal(property.AsNode())) {
 * 		return nil
 * 	}
 * 
 * 	initializer := tx.Visitor().VisitNode(property.Initializer)
 * 	propertyOriginalNode := tx.EmitContext().MostOriginal(property.AsNode())
 * 	if ast.IsParameterPropertyDeclaration(propertyOriginalNode, propertyOriginalNode.Parent) && ast.IsIdentifier(propertyName) { //nolint:customlint // MostOriginal returns parse-tree nodes, and this parent relationship is intentional.
 * 		// A parameter-property declaration always overrides the initializer. The only time a parameter-property
 * 		// declaration *should* have an initializer is when decorators have added initializers that need to run before
 * 		// any other initializer
 * 		localName := propertyName.Clone(tx.Factory())
 * 		if initializer != nil {
 * 			// unwrap `(__runInitializers(this, _instanceExtraInitializers), void 0)`
 * 			if ast.IsParenthesizedExpression(initializer) &&
 * 				ast.IsCommaExpression(initializer.Expression()) &&
 * 				tx.EmitContext().IsCallToHelper(initializer.Expression().AsBinaryExpression().Left, "__runInitializers") &&
 * 				ast.IsVoidExpression(initializer.Expression().AsBinaryExpression().Right) &&
 * 				ast.IsNumericLiteral(initializer.Expression().AsBinaryExpression().Right.Expression()) {
 * 				initializer = initializer.Expression().AsBinaryExpression().Left
 * 			}
 * 			initializer = tx.Factory().InlineExpressions([]*ast.Expression{initializer, localName})
 * 		} else {
 * 			initializer = localName
 * 		}
 * 		tx.EmitContext().AddEmitFlags(propertyName, printer.EFNoComments|printer.EFNoSourceMap)
 * 		tx.EmitContext().SetSourceMapRange(localName, propertyOriginalNode.Name().Loc)
 * 		tx.EmitContext().AddEmitFlags(localName, printer.EFNoComments)
 * 	} else if initializer == nil {
 * 		initializer = tx.Factory().NewVoidZeroExpression()
 * 	}
 * 
 * 	if emitAssignment || ast.IsPrivateIdentifier(propertyName) {
 * 		memberAccess := createMemberAccessForPropertyName(tx.Factory(), tx.EmitContext(), receiver, propertyName, propertyName)
 * 		tx.EmitContext().AddEmitFlags(memberAccess, printer.EFNoLeadingComments)
 * 		return tx.Factory().NewAssignmentExpression(memberAccess, initializer)
 * 	}
 * 
 * 	// useDefineForClassFields: Object.defineProperty
 * 	var name *ast.Expression
 * 	if ast.IsComputedPropertyName(propertyName) {
 * 		name = propertyName.Expression()
 * 	} else if ast.IsIdentifier(propertyName) {
 * 		name = tx.Factory().NewStringLiteral(propertyName.Text(), ast.TokenFlagsNone)
 * 	} else {
 * 		name = propertyName
 * 	}
 * 	descriptor := tx.Factory().NewObjectLiteralExpression(tx.Factory().NewNodeList([]*ast.Node{
 * 		tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("enumerable"), nil, nil, tx.Factory().NewTrueExpression()),
 * 		tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("configurable"), nil, nil, tx.Factory().NewTrueExpression()),
 * 		tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("writable"), nil, nil, tx.Factory().NewTrueExpression()),
 * 		tx.Factory().NewPropertyAssignment(nil, tx.Factory().NewIdentifier("value"), nil, nil, initializer),
 * 	}), true)
 * 	return tx.Factory().NewObjectDefinePropertyCall(receiver, name, descriptor)
 * }
 */
export function classFieldsTransformer_transformPropertyWorker(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<PropertyDeclaration>, receiver1: GoPtr<Expression>): GoPtr<Expression> {
  // We generate a name here in order to reuse the value cached by the relocated computed name expression
  const emitAssignment = !CompilerOptions_GetUseDefineForClassFields(receiver!.compilerOptions);

  let prop = property;
  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), property as unknown as GoPtr<Node>, receiver!.isAnonymousClassNeedingAssignedName)) {
    prop = AsPropertyDeclaration(transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), property as unknown as GoPtr<Node>, false, ""));
  }

  let propertyName = Node_Name(prop as unknown as GoPtr<Node>);
  if (HasAccessorModifier(prop as unknown as GoPtr<Node>)) {
    propertyName = NodeFactory_NewGeneratedPrivateNameForNodeEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), propertyName, { Suffix: "_accessor_storage" } as AutoGenerateOptions);
  } else if (IsComputedPropertyName(propertyName) && !IsSimpleInlineableExpression(Node_Expression(propertyName))) {
    propertyName = NodeFactory_UpdateComputedPropertyName(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      AsComputedPropertyName(propertyName),
      NodeFactory_NewGeneratedNameForNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), propertyName),
    );
  }

  if (HasStaticModifier(prop as unknown as GoPtr<Node>)) {
    receiver!.currentClassElement = prop as unknown as GoPtr<Node>;
  }

  if (IsPrivateIdentifier(propertyName) && classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver, prop as unknown as GoPtr<Node>)) {
    const info = classFieldsTransformer_accessPrivateIdentifier(receiver, propertyName);
    if (info !== undefined) {
      if (info.kind === PrivateIdentifierKindField) {
        if (!info.isStatic) {
          return createPrivateInstanceFieldInitializer(
            Transformer_Factory(receiver!.__tsgoEmbedded0!),
            receiver1,
            NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Initializer(prop as unknown as GoPtr<Node>)),
            info.brandCheckIdentifier,
          );
        }
        return createPrivateStaticFieldInitializer(
          Transformer_Factory(receiver!.__tsgoEmbedded0!),
          info.variableName,
          NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Initializer(prop as unknown as GoPtr<Node>)),
        );
      }
      return undefined;
    } else {
      debug.Fail("Undeclared private name for property declaration.");
    }
  }

  if ((IsPrivateIdentifier(propertyName) || HasStaticModifier(prop as unknown as GoPtr<Node>)) && Node_Initializer(prop as unknown as GoPtr<Node>) === undefined) {
    return undefined;
  }

  // TODO: can we get rid of this original checking and better coordinate with runtimesyntax?
  if (HasAbstractModifier(EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), prop as unknown as GoPtr<Node>))) {
    return undefined;
  }

  let initializer = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Initializer(prop as unknown as GoPtr<Node>));
  const propertyOriginalNode = EmitContext_MostOriginal(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), prop as unknown as GoPtr<Node>);
  if (IsParameterPropertyDeclaration(propertyOriginalNode, propertyOriginalNode!.Parent) && IsIdentifier(propertyName)) {
    // A parameter-property declaration always overrides the initializer. The only time a parameter-property
    // declaration *should* have an initializer is when decorators have added initializers that need to run before
    // any other initializer
    const localName = Node_Clone(propertyName, Transformer_Factory(receiver!.__tsgoEmbedded0!) as unknown as NodeFactoryCoercible);
    if (initializer !== undefined) {
      // unwrap `(__runInitializers(this, _instanceExtraInitializers), void 0)`
      if (IsParenthesizedExpression(initializer) &&
          IsCommaExpression(Node_Expression(initializer)) &&
          EmitContext_IsCallToHelper(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), AsBinaryExpression(Node_Expression(initializer))!.Left, "__runInitializers") &&
          IsVoidExpression(AsBinaryExpression(Node_Expression(initializer))!.Right) &&
          IsNumericLiteral(Node_Expression(AsBinaryExpression(Node_Expression(initializer))!.Right))) {
        initializer = AsBinaryExpression(Node_Expression(initializer))!.Left;
      }
      initializer = NodeFactory_InlineExpressions(Transformer_Factory(receiver!.__tsgoEmbedded0!), [initializer, localName]);
    } else {
      initializer = localName;
    }
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), propertyName, EFNoComments | EFNoSourceMap);
    EmitContext_SetSourceMapRange(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), localName, Node_Name(propertyOriginalNode)!.Loc);
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), localName, EFNoComments);
  } else if (initializer === undefined) {
    initializer = NodeFactory_NewVoidZeroExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!));
  }

  if (emitAssignment || IsPrivateIdentifier(propertyName)) {
    const memberAccess = createMemberAccessForPropertyName(Transformer_Factory(receiver!.__tsgoEmbedded0!), Transformer_EmitContext(receiver!.__tsgoEmbedded0!), receiver1, propertyName as unknown as GoPtr<PropertyName>, propertyName as unknown as GoPtr<PropertyName>);
    EmitContext_AddEmitFlags(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), memberAccess, EFNoLeadingComments);
    return NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), memberAccess, initializer);
  }

  // useDefineForClassFields: Object.defineProperty
  let name: GoPtr<Expression>;
  if (IsComputedPropertyName(propertyName)) {
    name = Node_Expression(propertyName) as unknown as GoPtr<Expression>;
  } else if (IsIdentifier(propertyName)) {
    name = NewStringLiteral(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, Node_Text(propertyName), TokenFlagsNone);
  } else {
    name = propertyName as unknown as GoPtr<Expression>;
  }
  const descriptor = NewObjectLiteralExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [
      NewPropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "enumerable"), undefined, undefined, NodeFactory_NewTrueExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!))),
      NewPropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "configurable"), undefined, undefined, NodeFactory_NewTrueExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!))),
      NewPropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "writable"), undefined, undefined, NodeFactory_NewTrueExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!))),
      NewPropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, undefined, NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "value"), undefined, undefined, initializer),
    ]),
    true,
  );
  return NodeFactory_NewObjectDefinePropertyCall(Transformer_Factory(receiver!.__tsgoEmbedded0!), receiver1, name, descriptor as unknown as GoPtr<Expression>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addInstanceMethodStatements","kind":"method","status":"implemented","sigHash":"eaf8d9325d7e8c67f4bfe69bf55a88e7e55376e010b420dbe9f093f2a92e34f0","bodyHash":"81bedcb1925c0a1fc402b741a656b1edaddd0d76b6a1c25514913979668cf7cd"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addInstanceMethodStatements(statements []*ast.Statement, methods []*ast.Node, receiver *ast.Expression) []*ast.Statement {
 * 	if !tx.shouldTransformPrivateElementsOrClassStaticBlocks || len(methods) == 0 {
 * 		return statements
 * 	}
 * 
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	weakSetName := env.data.weakSetName
 * 	debug.Assert(weakSetName != nil, "weakSetName should be set in private identifier environment")
 * 
 * 	return append(statements,
 * 		tx.Factory().NewExpressionStatement(
 * 			createPrivateInstanceMethodInitializer(tx.Factory(), receiver, weakSetName),
 * 		),
 * 	)
 * }
 */
export function classFieldsTransformer_addInstanceMethodStatements(receiver: GoPtr<classFieldsTransformer>, statements: GoSlice<GoPtr<Statement>>, methods: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Statement>> {
  if (!receiver!.shouldTransformPrivateElementsOrClassStaticBlocks || methods.length === 0) {
    return statements;
  }

  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  const weakSetName = env!.data!.weakSetName;
  debug.Assert(weakSetName !== undefined, "weakSetName should be set in private identifier environment");

  const stmt = NewExpressionStatement(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    createPrivateInstanceMethodInitializer(Transformer_Factory(receiver!.__tsgoEmbedded0!), receiver1, weakSetName),
  );
  return [...statements, stmt as unknown as GoPtr<Statement>];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitInvalidSuperProperty","kind":"method","status":"implemented","sigHash":"c0c221a6fa736ec20a6d4de8c5b731ecc2216bc62b230e509577963ba0465337","bodyHash":"d9ef04999b2bf771bd94f9221bd9e0d38224a59bd3cf8c4d4122c55eada68518"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitInvalidSuperProperty(node *ast.Node) *ast.Node {
 * 	if ast.IsPropertyAccessExpression(node) {
 * 		return tx.Factory().UpdatePropertyAccessExpression(
 * 			node.AsPropertyAccessExpression(),
 * 			tx.Factory().NewVoidZeroExpression(),
 * 			nil,
 * 			node.Name(),
 * 			node.Flags,
 * 		)
 * 	}
 * 	return tx.Factory().UpdateElementAccessExpression(
 * 		node.AsElementAccessExpression(),
 * 		tx.Factory().NewVoidZeroExpression(),
 * 		nil,
 * 		tx.Visitor().VisitNode(node.AsElementAccessExpression().ArgumentExpression),
 * 		node.Flags,
 * 	)
 * }
 */
export function classFieldsTransformer_visitInvalidSuperProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsPropertyAccessExpression(node)) {
    return NodeFactory_UpdatePropertyAccessExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      AsPropertyAccessExpression(node),
      NodeFactory_NewVoidZeroExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)),
      undefined,
      Node_Name(node),
      node!.Flags,
    );
  }
  return NodeFactory_UpdateElementAccessExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    AsElementAccessExpression(node),
    NodeFactory_NewVoidZeroExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)),
    undefined,
    NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsElementAccessExpression(node)!.ArgumentExpression as unknown as GoPtr<Node>),
    node!.Flags,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getPropertyNameExpressionIfNeeded","kind":"method","status":"implemented","sigHash":"ec1507efb6f05ab0fd8a1e510cae0daa97d74b2f6e0f1feb7ece4a59a899b613","bodyHash":"58fca504c0b7210d1215d7319f6282c092b354ae785db0223c9463be17e79ebd"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getPropertyNameExpressionIfNeeded(name *ast.PropertyName, shouldHoist bool) *ast.Expression {
 * 	if !ast.IsComputedPropertyName(name) {
 * 		return nil
 * 	}
 * 	cacheAssignment := findComputedPropertyNameCacheAssignment(tx.EmitContext(), name)
 * 	// Switch to outer lex env for computed property name expressions, matching
 * 	// Strada reference's onEmitNode behavior for ComputedPropertyName.
 * 	savedLexicalEnvironment := tx.lexicalEnvironment
 * 	savedInsideComputedPropertyName := tx.insideComputedPropertyName
 * 	tx.insideComputedPropertyName = true
 * 	if tx.lexicalEnvironment != nil && tx.lexicalEnvironment.previous != nil {
 * 		tx.lexicalEnvironment = tx.lexicalEnvironment.previous
 * 	}
 * 	expression := tx.Visitor().VisitNode(name.Expression())
 * 	tx.lexicalEnvironment = savedLexicalEnvironment
 * 	tx.insideComputedPropertyName = savedInsideComputedPropertyName
 * 	innerExpression := ast.SkipPartiallyEmittedExpressions(expression)
 * 	inlinable := transformers.IsSimpleInlineableExpression(innerExpression)
 * 	alreadyTransformed := cacheAssignment != nil || (ast.IsAssignmentExpression(innerExpression, true /*excludeCompoundAssignment* /) && ast.IsIdentifier(innerExpression.AsBinaryExpression().Left) && transformers.IsGeneratedIdentifier(tx.EmitContext(), innerExpression.AsBinaryExpression().Left))
 * 	if !alreadyTransformed && !inlinable && shouldHoist {
 * 		generatedName := tx.Factory().NewGeneratedNameForNode(name)
 * 		if tx.requiresBlockScopedVar() {
 * 			tx.EmitContext().AddLexicalDeclaration(generatedName)
 * 		} else {
 * 			tx.EmitContext().AddVariableDeclaration(generatedName)
 * 		}
 * 		return tx.Factory().NewAssignmentExpression(generatedName, expression)
 * 	}
 * 	if inlinable || ast.IsIdentifier(innerExpression) {
 * 		return nil
 * 	}
 * 	return expression
 * }
 */
export function classFieldsTransformer_getPropertyNameExpressionIfNeeded(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<PropertyName>, shouldHoist: bool): GoPtr<Expression> {
  if (!IsComputedPropertyName(name as unknown as GoPtr<Node>)) {
    return undefined;
  }
  const cacheAssignment = findComputedPropertyNameCacheAssignment(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name as unknown as GoPtr<Node>);
  // Switch to outer lex env for computed property name expressions, matching
  // Strada reference's onEmitNode behavior for ComputedPropertyName.
  const savedLexicalEnvironment = receiver!.lexicalEnvironment;
  const savedInsideComputedPropertyName = receiver!.insideComputedPropertyName;
  receiver!.insideComputedPropertyName = true;
  if (receiver!.lexicalEnvironment !== undefined && receiver!.lexicalEnvironment.previous !== undefined) {
    receiver!.lexicalEnvironment = receiver!.lexicalEnvironment.previous;
  }
  const expression = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), Node_Expression(name as unknown as GoPtr<Node>));
  receiver!.lexicalEnvironment = savedLexicalEnvironment;
  receiver!.insideComputedPropertyName = savedInsideComputedPropertyName;
  const innerExpression = SkipPartiallyEmittedExpressions(expression);
  const inlinable = IsSimpleInlineableExpression(innerExpression);
  const alreadyTransformed = cacheAssignment !== undefined || (IsAssignmentExpression(innerExpression, true /*excludeCompoundAssignment*/) && IsIdentifier(AsBinaryExpression(innerExpression)!.Left as unknown as GoPtr<Node>) && IsGeneratedIdentifier(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), AsBinaryExpression(innerExpression)!.Left as unknown as GoPtr<Node>));
  if (!alreadyTransformed && !inlinable && shouldHoist) {
    const generatedName = NodeFactory_NewGeneratedNameForNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), name as unknown as GoPtr<Node>);
    if (classFieldsTransformer_requiresBlockScopedVar(receiver)) {
      EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), generatedName);
    } else {
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), generatedName);
    }
    return NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), generatedName, expression);
  }
  if (inlinable || IsIdentifier(innerExpression)) {
    return undefined;
  }
  return expression as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.startClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"b37f9fd33b2974d105218157774e7f75e72ae21b8ede073febe59fdcdd75bda4","bodyHash":"eb5123f2ee01fe9ff743f8556abdf8bf811d8c1e3969ce8cc0b8e68fbd9a835e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) startClassLexicalEnvironment() {
 * 	tx.lexicalEnvironment = &classLexicalEnv{previous: tx.lexicalEnvironment}
 * }
 */
export function classFieldsTransformer_startClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): void {
  receiver!.lexicalEnvironment = { previous: receiver!.lexicalEnvironment, data: undefined, privateEnv: undefined };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.endClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"cee8366cf6522da93bbfc2f80a06d463d0ab40f00053faa243d82df101871243","bodyHash":"27bf9ca4b494d6d217d21b9a96bd490f8be79663e8f13762501359cc41600062"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) endClassLexicalEnvironment() {
 * 	tx.lexicalEnvironment = tx.lexicalEnvironment.previous
 * }
 */
export function classFieldsTransformer_endClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): void {
  receiver!.lexicalEnvironment = receiver!.lexicalEnvironment!.previous;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"8bca5bfe34d5f42a1318173ed796d59a7d5ef27c3a49846780a02889da77ac0a","bodyHash":"54231e7129dfae08d5744df41ccb31a94fa850d3bb52129b501448ae093a5768"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getClassLexicalEnvironment() *classLexicalEnvironment {
 * 	debug.Assert(tx.lexicalEnvironment != nil)
 * 	if tx.lexicalEnvironment.data == nil {
 * 		tx.lexicalEnvironment.data = &classLexicalEnvironment{}
 * 	}
 * 	return tx.lexicalEnvironment.data
 * }
 */
export function classFieldsTransformer_getClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): GoPtr<classLexicalEnvironment> {
  debug.Assert(receiver!.lexicalEnvironment !== undefined);
  if (receiver!.lexicalEnvironment!.data === undefined) {
    receiver!.lexicalEnvironment!.data = { facts: classFactsNone, classConstructor: undefined, classThis: undefined, superClassReference: undefined };
  }
  return receiver!.lexicalEnvironment!.data;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getPrivateIdentifierEnvironment","kind":"method","status":"implemented","sigHash":"6801eb0c74abf900b03ee3ab6011b9d10d180c59c128fb13370a7bc0789ab5bf","bodyHash":"de48d80100dd1cd5f926b2e6fc6172ed2a21c4b07c25c4a3906bc1f6bc0880cf"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getPrivateIdentifierEnvironment() *privateEnvironment {
 * 	debug.Assert(tx.lexicalEnvironment != nil)
 * 	if tx.lexicalEnvironment.privateEnv == nil {
 * 		tx.lexicalEnvironment.privateEnv = &privateEnvironment{
 * 			members: make(map[string]*privateIdentifierInfo),
 * 		}
 * 	}
 * 	return tx.lexicalEnvironment.privateEnv
 * }
 */
export function classFieldsTransformer_getPrivateIdentifierEnvironment(receiver: GoPtr<classFieldsTransformer>): GoPtr<privateEnvironment> {
  debug.Assert((receiver!.lexicalEnvironment !== undefined) as bool);
  if (receiver!.lexicalEnvironment!.privateEnv === undefined) {
    receiver!.lexicalEnvironment!.privateEnv = {
      data: { className: undefined, weakSetName: undefined },
      members: new Map<string, GoPtr<privateIdentifierInfo>>(),
      generatedIdentifiers: new Map<GoPtr<Node>, GoPtr<privateIdentifierInfo>>(),
    };
  }
  return receiver!.lexicalEnvironment!.privateEnv;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPendingExpressions","kind":"method","status":"implemented","sigHash":"2ed367c4eedc17df21d1f72a03a7736adc80097d13552ed32e9c20b63c1ffe09","bodyHash":"22d13831bf5229304326acbb20a1379575ebe3d3d3e212a07252199c3ca56292"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPendingExpressions(exprs ...*ast.Expression) {
 * 	tx.pendingExpressions = append(tx.pendingExpressions, exprs...)
 * }
 */
export function classFieldsTransformer_addPendingExpressions(receiver: GoPtr<classFieldsTransformer>, ...exprs: Array<GoPtr<Expression>>): void {
  receiver!.pendingExpressions = [...receiver!.pendingExpressions, ...exprs];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierPropertyDeclarationToEnvironment","kind":"method","status":"implemented","sigHash":"7b921cf97f1020a55f530b533b000af3bd1e77869746bd6efc38a2643afd1b58","bodyHash":"f2ad16a371a4d99b937e5032dd00fb047bf2609f6f0d7a6a93b4c2e995a2859c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierPropertyDeclarationToEnvironment(node *ast.Node, name *ast.Node) {
 * 	lex := tx.getClassLexicalEnvironment()
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	isStatic := ast.HasStaticModifier(node)
 * 	previousInfo, _ := tx.getPrivateIdentifier(env, name)
 * 	isValid := !tx.isReservedPrivateName(name) && previousInfo == nil
 * 
 * 	if isStatic {
 * 		brandCheckIdentifier := lex.classThis
 * 		if brandCheckIdentifier == nil {
 * 			brandCheckIdentifier = lex.classConstructor
 * 		}
 * 		variableName := tx.createHoistedVariableForPrivateName(name, "")
 * 		tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 			kind:                 printer.PrivateIdentifierKindField,
 * 			isStatic:             true,
 * 			brandCheckIdentifier: brandCheckIdentifier,
 * 			variableName:         variableName,
 * 			isValid:              isValid,
 * 		})
 * 	} else {
 * 		weakMapName := tx.createHoistedVariableForPrivateName(name, "")
 * 		tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 			kind:                 printer.PrivateIdentifierKindField,
 * 			isStatic:             false,
 * 			brandCheckIdentifier: weakMapName,
 * 			isValid:              isValid,
 * 		})
 * 		tx.addPendingExpressions(
 * 			tx.Factory().NewAssignmentExpression(
 * 				weakMapName,
 * 				tx.Factory().NewNewExpression(
 * 					tx.Factory().NewIdentifier("WeakMap"),
 * 					nil, /*typeArguments* /
 * 					tx.Factory().NewNodeList(nil),
 * 				),
 * 			),
 * 		)
 * 	}
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierPropertyDeclarationToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, name: GoPtr<Node>): void {
  const lex = classFieldsTransformer_getClassLexicalEnvironment(receiver);
  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  const isStatic = HasStaticModifier(node);
  const [previousInfo] = classFieldsTransformer_getPrivateIdentifier(receiver, env, name);
  const isValid = !classFieldsTransformer_isReservedPrivateName(receiver, name) && previousInfo === undefined;

  if (isStatic) {
    let brandCheckIdentifier = lex!.classThis;
    if (brandCheckIdentifier === undefined) {
      brandCheckIdentifier = lex!.classConstructor;
    }
    const variableName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "");
    classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
      kind: PrivateIdentifierKindField,
      isStatic: true,
      brandCheckIdentifier,
      variableName,
      isValid,
      methodName: undefined,
      getterName: undefined,
      setterName: undefined,
    });
  } else {
    const weakMapName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "");
    classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
      kind: PrivateIdentifierKindField,
      isStatic: false,
      brandCheckIdentifier: weakMapName,
      isValid,
      variableName: undefined,
      methodName: undefined,
      getterName: undefined,
      setterName: undefined,
    });
    classFieldsTransformer_addPendingExpressions(
      receiver,
      NodeFactory_NewAssignmentExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!),
        weakMapName,
        NewNewExpression(
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "WeakMap"),
          undefined, /*typeArguments*/
          NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []),
        ),
      ),
    );
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierMethodToEnvironment","kind":"method","status":"implemented","sigHash":"d8c4090855776663d570f1a9666b202b9100fbb8f3e7fb69c71b86fb42334b03","bodyHash":"e700b70b181e09c4ff2d4d37a2d0d386fad7035415f7ad5e410e8e3e8fe56e6c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierMethodToEnvironment(name *ast.Node, lex *classLexicalEnvironment, env *privateEnvironment, isStatic bool, isValid bool) {
 * 	methodName := tx.createHoistedVariableForPrivateName(name, "")
 * 	var brandCheckIdentifier *ast.IdentifierNode
 * 	if isStatic {
 * 		brandCheckIdentifier = lex.classThis
 * 		if brandCheckIdentifier == nil {
 * 			brandCheckIdentifier = lex.classConstructor
 * 		}
 * 		debug.Assert(brandCheckIdentifier != nil, "classConstructor should be set in private identifier environment")
 * 	} else {
 * 		brandCheckIdentifier = env.data.weakSetName
 * 	}
 * 	tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 		kind:                 printer.PrivateIdentifierKindMethod,
 * 		methodName:           methodName,
 * 		brandCheckIdentifier: brandCheckIdentifier,
 * 		isStatic:             isStatic,
 * 		isValid:              isValid,
 * 	})
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierMethodToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool): void {
  const methodName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "");
  let brandCheckIdentifier: GoPtr<IdentifierNode>;
  if (isStatic) {
    brandCheckIdentifier = lex!.classThis;
    if (brandCheckIdentifier === undefined) {
      brandCheckIdentifier = lex!.classConstructor;
    }
    debug.Assert(brandCheckIdentifier !== undefined, "classConstructor should be set in private identifier environment");
  } else {
    brandCheckIdentifier = env!.data!.weakSetName;
  }
  classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
    kind: PrivateIdentifierKindMethod,
    methodName,
    brandCheckIdentifier,
    isStatic,
    isValid,
    variableName: undefined,
    getterName: undefined,
    setterName: undefined,
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierGetAccessorToEnvironment","kind":"method","status":"implemented","sigHash":"5a4b4ab0411a741fc5a88bbe3f064f88813d35b4f6a73d0bc1db80e879e162c3","bodyHash":"fdfac6d7596faa99641425946eb20d61e4f590b71576e150fec031f3b81072c0"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierGetAccessorToEnvironment(name *ast.Node, lex *classLexicalEnvironment, env *privateEnvironment, isStatic bool, isValid bool, previousInfo *privateIdentifierInfo) {
 * 	getterName := tx.createHoistedVariableForPrivateName(name, "_get")
 * 	var brandCheckIdentifier *ast.IdentifierNode
 * 	if isStatic {
 * 		brandCheckIdentifier = lex.classThis
 * 		if brandCheckIdentifier == nil {
 * 			brandCheckIdentifier = lex.classConstructor
 * 		}
 * 		debug.Assert(brandCheckIdentifier != nil, "classConstructor should be set in private identifier environment")
 * 	} else {
 * 		brandCheckIdentifier = env.data.weakSetName
 * 		debug.Assert(brandCheckIdentifier != nil, "weakSetName should be set in private identifier environment")
 * 	}
 * 
 * 	if previousInfo != nil && previousInfo.kind == printer.PrivateIdentifierKindAccessor && previousInfo.isStatic == isStatic && previousInfo.getterName == nil {
 * 		previousInfo.getterName = getterName
 * 	} else {
 * 		tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 			kind:                 printer.PrivateIdentifierKindAccessor,
 * 			getterName:           getterName,
 * 			brandCheckIdentifier: brandCheckIdentifier,
 * 			isStatic:             isStatic,
 * 			isValid:              isValid,
 * 		})
 * 	}
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierGetAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool, previousInfo: GoPtr<privateIdentifierInfo>): void {
  const getterName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "_get");
  let brandCheckIdentifier: GoPtr<IdentifierNode>;
  if (isStatic) {
    brandCheckIdentifier = lex!.classThis;
    if (brandCheckIdentifier === undefined) {
      brandCheckIdentifier = lex!.classConstructor;
    }
    debug.Assert(brandCheckIdentifier !== undefined, "classConstructor should be set in private identifier environment");
  } else {
    brandCheckIdentifier = env!.data!.weakSetName;
    debug.Assert(brandCheckIdentifier !== undefined, "weakSetName should be set in private identifier environment");
  }

  if (previousInfo !== undefined && previousInfo.kind === PrivateIdentifierKindAccessor && previousInfo.isStatic === isStatic && previousInfo.getterName === undefined) {
    previousInfo.getterName = getterName;
  } else {
    classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
      kind: PrivateIdentifierKindAccessor,
      getterName,
      brandCheckIdentifier,
      isStatic,
      isValid,
      variableName: undefined,
      methodName: undefined,
      setterName: undefined,
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierSetAccessorToEnvironment","kind":"method","status":"implemented","sigHash":"b6a28f7a5a06307991db30303270dd3db2ef549e2e5a23e5b712f4835b710f40","bodyHash":"d83ef41c858223a2c3fa2dce2b7a57d03e755fd8b37c1c1c5b06936f88a4e887"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierSetAccessorToEnvironment(name *ast.Node, lex *classLexicalEnvironment, env *privateEnvironment, isStatic bool, isValid bool, previousInfo *privateIdentifierInfo) {
 * 	setterName := tx.createHoistedVariableForPrivateName(name, "_set")
 * 	var brandCheckIdentifier *ast.IdentifierNode
 * 	if isStatic {
 * 		brandCheckIdentifier = lex.classThis
 * 		if brandCheckIdentifier == nil {
 * 			brandCheckIdentifier = lex.classConstructor
 * 		}
 * 		debug.Assert(brandCheckIdentifier != nil, "classConstructor should be set in private identifier environment")
 * 	} else {
 * 		brandCheckIdentifier = env.data.weakSetName
 * 		debug.Assert(brandCheckIdentifier != nil, "weakSetName should be set in private identifier environment")
 * 	}
 * 
 * 	if previousInfo != nil && previousInfo.kind == printer.PrivateIdentifierKindAccessor && previousInfo.isStatic == isStatic && previousInfo.setterName == nil {
 * 		previousInfo.setterName = setterName
 * 	} else {
 * 		tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 			kind:                 printer.PrivateIdentifierKindAccessor,
 * 			setterName:           setterName,
 * 			brandCheckIdentifier: brandCheckIdentifier,
 * 			isStatic:             isStatic,
 * 			isValid:              isValid,
 * 		})
 * 	}
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierSetAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool, previousInfo: GoPtr<privateIdentifierInfo>): void {
  const setterName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "_set");
  let brandCheckIdentifier: GoPtr<IdentifierNode>;
  if (isStatic) {
    brandCheckIdentifier = lex!.classThis;
    if (brandCheckIdentifier === undefined) {
      brandCheckIdentifier = lex!.classConstructor;
    }
    debug.Assert(brandCheckIdentifier !== undefined, "classConstructor should be set in private identifier environment");
  } else {
    brandCheckIdentifier = env!.data!.weakSetName;
    debug.Assert(brandCheckIdentifier !== undefined, "weakSetName should be set in private identifier environment");
  }

  if (previousInfo !== undefined && previousInfo.kind === PrivateIdentifierKindAccessor && previousInfo.isStatic === isStatic && previousInfo.setterName === undefined) {
    previousInfo.setterName = setterName;
  } else {
    classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
      kind: PrivateIdentifierKindAccessor,
      setterName,
      brandCheckIdentifier,
      isStatic,
      isValid,
      variableName: undefined,
      methodName: undefined,
      getterName: undefined,
    });
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierAutoAccessorToEnvironment","kind":"method","status":"implemented","sigHash":"04ada9a356c06d54c3f63dcb27f28d74d45d57492499be2aa0b619d1e769b85b","bodyHash":"5000fbc82464e4271fbcb070e734425f7ba59522c7379a88366093b2ec2cc561"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierAutoAccessorToEnvironment(node *ast.Node, name *ast.Node, lex *classLexicalEnvironment, env *privateEnvironment, isStatic bool, isValid bool) {
 * 	getterName := tx.createHoistedVariableForPrivateName(name, "_get")
 * 	setterName := tx.createHoistedVariableForPrivateName(name, "_set")
 * 	var brandCheckIdentifier *ast.IdentifierNode
 * 	if isStatic {
 * 		brandCheckIdentifier = lex.classThis
 * 		if brandCheckIdentifier == nil {
 * 			brandCheckIdentifier = lex.classConstructor
 * 		}
 * 		debug.Assert(brandCheckIdentifier != nil, "classConstructor should be set in private identifier environment")
 * 	} else {
 * 		brandCheckIdentifier = env.data.weakSetName
 * 		debug.Assert(brandCheckIdentifier != nil, "weakSetName should be set in private identifier environment")
 * 	}
 * 
 * 	tx.setPrivateIdentifier(env, name, &privateIdentifierInfo{
 * 		kind:                 printer.PrivateIdentifierKindAccessor,
 * 		getterName:           getterName,
 * 		setterName:           setterName,
 * 		brandCheckIdentifier: brandCheckIdentifier,
 * 		isStatic:             isStatic,
 * 		isValid:              isValid,
 * 	})
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierAutoAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool): void {
  const getterName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "_get");
  const setterName = classFieldsTransformer_createHoistedVariableForPrivateName(receiver, name, "_set");
  let brandCheckIdentifier: GoPtr<IdentifierNode>;
  if (isStatic) {
    brandCheckIdentifier = lex!.classThis;
    if (brandCheckIdentifier === undefined) {
      brandCheckIdentifier = lex!.classConstructor;
    }
    debug.Assert(brandCheckIdentifier !== undefined, "classConstructor should be set in private identifier environment");
  } else {
    brandCheckIdentifier = env!.data!.weakSetName;
    debug.Assert(brandCheckIdentifier !== undefined, "weakSetName should be set in private identifier environment");
  }

  classFieldsTransformer_setPrivateIdentifier(receiver, env, name, {
    kind: PrivateIdentifierKindAccessor,
    getterName,
    setterName,
    brandCheckIdentifier,
    isStatic,
    isValid,
    variableName: undefined,
    methodName: undefined,
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPrivateIdentifierToEnvironment","kind":"method","status":"implemented","sigHash":"9acf0ed53dcb6d7c89210b440e479226006baa321e142d4dc227b17931f0a64e","bodyHash":"110400401746ca0377eb0cb9a1d93a43c41588c1a7f36cdcb509dce59ce22d58"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPrivateIdentifierToEnvironment(node *ast.Node) {
 * 	lex := tx.getClassLexicalEnvironment()
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	name := node.Name()
 * 	isStatic := ast.HasStaticModifier(node)
 * 	previousInfo, _ := tx.getPrivateIdentifier(env, name)
 * 	isValid := !tx.isReservedPrivateName(name) && previousInfo == nil
 * 
 * 	if ast.IsAutoAccessorPropertyDeclaration(node) {
 * 		tx.addPrivateIdentifierAutoAccessorToEnvironment(node, name, lex, env, isStatic, isValid)
 * 	} else if ast.IsPropertyDeclaration(node) {
 * 		tx.addPrivateIdentifierPropertyDeclarationToEnvironment(node, name)
 * 	} else if ast.IsMethodDeclaration(node) {
 * 		tx.addPrivateIdentifierMethodToEnvironment(name, lex, env, isStatic, isValid)
 * 	} else if ast.IsGetAccessorDeclaration(node) {
 * 		tx.addPrivateIdentifierGetAccessorToEnvironment(name, lex, env, isStatic, isValid, previousInfo)
 * 	} else if ast.IsSetAccessorDeclaration(node) {
 * 		tx.addPrivateIdentifierSetAccessorToEnvironment(name, lex, env, isStatic, isValid, previousInfo)
 * 	}
 * }
 */
export function classFieldsTransformer_addPrivateIdentifierToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): void {
  const lex = classFieldsTransformer_getClassLexicalEnvironment(receiver);
  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  const name = Node_Name(node);
  const isStatic = HasStaticModifier(node);
  const [previousInfo] = classFieldsTransformer_getPrivateIdentifier(receiver, env, name);
  const isValid = !classFieldsTransformer_isReservedPrivateName(receiver, name) && previousInfo === undefined;

  if (IsAutoAccessorPropertyDeclaration(node)) {
    classFieldsTransformer_addPrivateIdentifierAutoAccessorToEnvironment(receiver, node, name, lex, env, isStatic, isValid);
  } else if (IsPropertyDeclaration(node)) {
    classFieldsTransformer_addPrivateIdentifierPropertyDeclarationToEnvironment(receiver, node, name);
  } else if (IsMethodDeclaration(node)) {
    classFieldsTransformer_addPrivateIdentifierMethodToEnvironment(receiver, name, lex, env, isStatic, isValid);
  } else if (IsGetAccessorDeclaration(node)) {
    classFieldsTransformer_addPrivateIdentifierGetAccessorToEnvironment(receiver, name, lex, env, isStatic, isValid, previousInfo);
  } else if (IsSetAccessorDeclaration(node)) {
    classFieldsTransformer_addPrivateIdentifierSetAccessorToEnvironment(receiver, name, lex, env, isStatic, isValid, previousInfo);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setPrivateIdentifier","kind":"method","status":"implemented","sigHash":"8727b31b918d85618e996c900fddbdbde4ec3a4df2012620f7a7272d57d5a446","bodyHash":"05c3b95852486a56db15af5f3b7742fe6c11b58d3ded573e46e30381c0a38542"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setPrivateIdentifier(env *privateEnvironment, name *ast.Node, info *privateIdentifierInfo) {
 * 	if tx.EmitContext().HasAutoGenerateInfo(name) {
 * 		if env.generatedIdentifiers == nil {
 * 			env.generatedIdentifiers = make(map[*ast.Node]*privateIdentifierInfo)
 * 		}
 * 		env.generatedIdentifiers[tx.EmitContext().GetNodeForGeneratedName(name)] = info
 * 	} else {
 * 		env.members[name.Text()] = info
 * 	}
 * }
 */
export function classFieldsTransformer_setPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, env: GoPtr<privateEnvironment>, name: GoPtr<Node>, info: GoPtr<privateIdentifierInfo>): void {
  if (EmitContext_HasAutoGenerateInfo(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name)) {
    if (env!.generatedIdentifiers === undefined) {
      env!.generatedIdentifiers = new Map<GoPtr<Node>, GoPtr<privateIdentifierInfo>>();
    }
    env!.generatedIdentifiers.set(EmitContext_GetNodeForGeneratedName(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name), info);
  } else {
    env!.members.set(Node_Text(name), info);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getPrivateIdentifier","kind":"method","status":"implemented","sigHash":"e7006043c46c709e8d5b6c37b1a87d4b33c3cd467cf72f0f228e43522201ee9e","bodyHash":"f56605b4a7aa4c36b30aad0a4a6dfd784f6bc42c0c7aaae40aa8298f4feb9b3e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getPrivateIdentifier(env *privateEnvironment, name *ast.Node) (*privateIdentifierInfo, bool) {
 * 	if tx.EmitContext().HasAutoGenerateInfo(name) {
 * 		info, ok := env.generatedIdentifiers[tx.EmitContext().GetNodeForGeneratedName(name)]
 * 		return info, ok
 * 	}
 * 	info, ok := env.members[name.Text()]
 * 	return info, ok
 * }
 */
export function classFieldsTransformer_getPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, env: GoPtr<privateEnvironment>, name: GoPtr<Node>): [GoPtr<privateIdentifierInfo>, bool] {
  if (EmitContext_HasAutoGenerateInfo(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name)) {
    const key = EmitContext_GetNodeForGeneratedName(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name);
    const info = env!.generatedIdentifiers.get(key);
    const ok = env!.generatedIdentifiers.has(key);
    return [info, ok as bool];
  }
  const text = Node_Text(name);
  const info = env!.members.get(text);
  const ok = env!.members.has(text);
  return [info, ok as bool];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createHoistedVariableForClass","kind":"method","status":"implemented","sigHash":"af51e20e9fa218fc446eba0de0ee3f3065b9ca98a7ab7973501569304e7732af","bodyHash":"d569d53a466910bae35b32e9588c5b2698b89d77a61d74af6ac8c5540e5c9ea0"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createHoistedVariableForClass(nameText string, node *ast.Node, suffix string) *ast.IdentifierNode {
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	var identifier *ast.IdentifierNode
 * 	if env.data.className != nil {
 * 		prefix := "_" + env.data.className.Text() + "_"
 * 		identifier = tx.Factory().NewUniqueNameEx(prefix+nameText, printer.AutoGenerateOptions{
 * 			Flags:  printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 			Suffix: suffix,
 * 		})
 * 	} else {
 * 		identifier = tx.Factory().NewUniqueNameEx("_"+nameText, printer.AutoGenerateOptions{
 * 			Flags:  printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 			Suffix: suffix,
 * 		})
 * 	}
 * 	if tx.requiresBlockScopedVar() {
 * 		tx.EmitContext().AddLexicalDeclaration(identifier)
 * 	} else {
 * 		tx.EmitContext().AddVariableDeclaration(identifier)
 * 	}
 * 	return identifier
 * }
 */
export function classFieldsTransformer_createHoistedVariableForClass(receiver: GoPtr<classFieldsTransformer>, nameText: string, node: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode> {
  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  let identifier: GoPtr<IdentifierNode>;
  if (env!.data!.className !== undefined) {
    const prefix = "_" + Node_Text(env!.data!.className as unknown as GoPtr<Node>) + "_";
    identifier = NodeFactory_NewUniqueNameEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), prefix + nameText, {
      Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsReservedInNestedScopes,
      Suffix: suffix,
    } as AutoGenerateOptions);
  } else {
    identifier = NodeFactory_NewUniqueNameEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), "_" + nameText, {
      Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsReservedInNestedScopes,
      Suffix: suffix,
    } as AutoGenerateOptions);
  }
  if (classFieldsTransformer_requiresBlockScopedVar(receiver)) {
    EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), identifier);
  } else {
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), identifier);
  }
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createHoistedVariableForClassFromNode","kind":"method","status":"implemented","sigHash":"6d81e2f8698ea44c58abd6f294b66af93296559478c06d9eb9dcefffd530e346","bodyHash":"1e57789e2f1dec34bdffa4889bde737a9261b23c3cac91ca06da1b1e1293adcd"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createHoistedVariableForClassFromNode(name *ast.Node, suffix string) *ast.IdentifierNode {
 * 	env := tx.getPrivateIdentifierEnvironment()
 * 	var prefix string
 * 	if env.data.className != nil {
 * 		prefix = "_" + env.data.className.Text() + "_"
 * 	} else {
 * 		prefix = "_"
 * 	}
 * 	identifier := tx.Factory().NewGeneratedNameForNodeEx(name, printer.AutoGenerateOptions{
 * 		Flags:  printer.GeneratedIdentifierFlagsOptimistic | printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 		Prefix: prefix,
 * 		Suffix: suffix,
 * 	})
 * 	if tx.requiresBlockScopedVar() {
 * 		tx.EmitContext().AddLexicalDeclaration(identifier)
 * 	} else {
 * 		tx.EmitContext().AddVariableDeclaration(identifier)
 * 	}
 * 	return identifier
 * }
 */
export function classFieldsTransformer_createHoistedVariableForClassFromNode(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode> {
  const env = classFieldsTransformer_getPrivateIdentifierEnvironment(receiver);
  let prefix: string;
  if (env!.data!.className !== undefined) {
    prefix = "_" + Node_Text(env!.data!.className as unknown as GoPtr<Node>) + "_";
  } else {
    prefix = "_";
  }
  const identifier = NodeFactory_NewGeneratedNameForNodeEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), name, {
    Flags: GeneratedIdentifierFlagsOptimistic | GeneratedIdentifierFlagsReservedInNestedScopes,
    Prefix: prefix,
    Suffix: suffix,
  });
  if (classFieldsTransformer_requiresBlockScopedVar(receiver)) {
    EmitContext_AddLexicalDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), identifier);
  } else {
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), identifier);
  }
  return identifier;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createHoistedVariableForPrivateName","kind":"method","status":"implemented","sigHash":"27dc764d7fadbc743ed98836c351eeda7e2accbf93e85b4d75c1f7e613883a4a","bodyHash":"93db841f0ec2ac89272830dcc7e076e129d22901677ce5425a62d030586d55e7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createHoistedVariableForPrivateName(name *ast.Node, suffix string) *ast.IdentifierNode {
 * 	// If the name is a generated identifier (e.g., auto-accessor backing field),
 * 	// use node-based name generation so the emitter can resolve the name properly.
 * 	if tx.EmitContext().HasAutoGenerateInfo(name) {
 * 		return tx.createHoistedVariableForClassFromNode(name, suffix)
 * 	}
 * 	text := name.Text()
 * 	if len(text) >= 1 && text[0] == '#' {
 * 		text = text[1:] // strip leading '#'
 * 	}
 * 	return tx.createHoistedVariableForClass(text, name, suffix)
 * }
 */
export function classFieldsTransformer_createHoistedVariableForPrivateName(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode> {
  // If the name is a generated identifier (e.g., auto-accessor backing field),
  // use node-based name generation so the emitter can resolve the name properly.
  if (EmitContext_HasAutoGenerateInfo(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), name)) {
    return classFieldsTransformer_createHoistedVariableForClassFromNode(receiver, name, suffix);
  }
  let text = Node_Text(name);
  if (text.length >= 1 && text[0] === "#") {
    text = text.slice(1); // strip leading '#'
  }
  return classFieldsTransformer_createHoistedVariableForClass(receiver, text, name, suffix);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.accessPrivateIdentifier","kind":"method","status":"implemented","sigHash":"9615322212f734eefa227a06021a067d2c03cb86d4a672b0ca601b25b1be3b4d","bodyHash":"b4fb1475b1c7e70bda25b41f921b510fe21011db9b25cc6e8dbc9eef9c1a0291"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) accessPrivateIdentifier(name *ast.Node) *privateIdentifierInfo {
 * 	for env := tx.lexicalEnvironment; env != nil; env = env.previous {
 * 		if env.privateEnv != nil {
 * 			if info, ok := tx.getPrivateIdentifier(env.privateEnv, name); ok {
 * 				if info.kind == printer.PrivateIdentifierKindUntransformed {
 * 					return nil
 * 				}
 * 				return info
 * 			}
 * 		}
 * 	}
 * 	return nil
 * }
 */
export function classFieldsTransformer_accessPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>): GoPtr<privateIdentifierInfo> {
  for (let env = receiver!.lexicalEnvironment; env !== undefined; env = env!.previous) {
    if (env!.privateEnv !== undefined) {
      const [info, ok] = classFieldsTransformer_getPrivateIdentifier(receiver, env!.privateEnv, name);
      if (ok) {
        if (info!.kind === PrivateIdentifierKindUntransformed) {
          return undefined;
        }
        return info;
      }
    }
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.wrapPrivateIdentifierForDestructuringTarget","kind":"method","status":"implemented","sigHash":"948eb156db68efe09e51d91f955c9409ab3bb191f47748be89f7df2a26ac9195","bodyHash":"129365b339b3deb8471b985ffc9414ea52cd09659cebd952481ce00b92db7c3c"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) wrapPrivateIdentifierForDestructuringTarget(node *ast.Node) *ast.Node {
 * 	prop := node.AsPropertyAccessExpression()
 * 	parameter := tx.Factory().NewGeneratedNameForNode(node)
 * 	info := tx.accessPrivateIdentifier(prop.Name())
 * 	if info == nil {
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * 	receiver := prop.Expression
 * 	// We cannot copy `this` or `super` into the function because they will be bound
 * 	// differently inside the function.
 * 	isThisOrSuperProperty := prop.Expression.Kind == ast.KindThisKeyword || prop.Expression.Kind == ast.KindSuperKeyword
 * 	if isThisOrSuperProperty || !transformers.IsSimpleCopiableExpression(prop.Expression) {
 * 		receiver = tx.Factory().NewTempVariableEx(printer.AutoGenerateOptions{
 * 			Flags: printer.GeneratedIdentifierFlagsReservedInNestedScopes,
 * 		})
 * 		tx.EmitContext().AddVariableDeclaration(receiver)
 * 		tx.pendingExpressions = append(tx.pendingExpressions,
 * 			tx.Factory().NewAssignmentExpression(receiver, tx.Visitor().VisitNode(prop.Expression)),
 * 		)
 * 	}
 * 	assignExpr := tx.createPrivateIdentifierAssignment(info, receiver, parameter, ast.KindEqualsToken)
 * 	return tx.Factory().NewAssignmentTargetWrapper(parameter, assignExpr)
 * }
 */
export function classFieldsTransformer_wrapPrivateIdentifierForDestructuringTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const prop = AsPropertyAccessExpression(node);
  const parameter = NodeFactory_NewGeneratedNameForNode(Transformer_Factory(receiver!.__tsgoEmbedded0!), node);
  const info = classFieldsTransformer_accessPrivateIdentifier(receiver, prop!.name as unknown as GoPtr<Node>);
  if (info === undefined) {
    return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
  }
  let recv: GoPtr<Node> = prop!.Expression as unknown as GoPtr<Node>;
  // We cannot copy `this` or `super` into the function because they will be bound
  // differently inside the function.
  const isThisOrSuperProperty = prop!.Expression!.Kind === KindThisKeyword || prop!.Expression!.Kind === KindSuperKeyword;
  if (isThisOrSuperProperty || !IsSimpleCopiableExpression(prop!.Expression as unknown as GoPtr<Node>)) {
    const recvTemp = NodeFactory_NewTempVariableEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), {
      Flags: GeneratedIdentifierFlagsReservedInNestedScopes,
    } as AutoGenerateOptions);
    EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), recvTemp);
    receiver!.pendingExpressions = [...receiver!.pendingExpressions,
      NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), recvTemp as unknown as GoPtr<Expression>,
        NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), prop!.Expression as unknown as GoPtr<Node>) as unknown as GoPtr<Expression>),
    ];
    recv = recvTemp as unknown as GoPtr<Node>;
  }
  const assignExpr = classFieldsTransformer_createPrivateIdentifierAssignment(receiver, info, recv as unknown as GoPtr<Expression>, parameter as unknown as GoPtr<Expression>, KindEqualsToken);
  return NodeFactory_NewAssignmentTargetWrapper(Transformer_Factory(receiver!.__tsgoEmbedded0!), parameter, assignExpr);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentElement","kind":"method","status":"implemented","sigHash":"fba4848adfb300173a70325ca60aa6690c8c2399d67c5c1ca2b5d3666a65dec9","bodyHash":"0b200ff7840975b6e022640894b2944024c100c6f8a9c7e83334eaf9e9b3b1a4"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentElement(node *ast.Node) *ast.Node {
 * 	// 13.15.5.5 RS: IteratorDestructuringAssignmentEvaluation
 * 	//   AssignmentElement : DestructuringAssignmentTarget Initializer?
 * 	//     ...
 * 	//     4. If |Initializer| is present and _value_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
 * 	//           i. Let _v_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node, tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node, false /*ignoreEmptyStringLiteral* /, "" /*assignedName* /)
 * 	}
 * 	if ast.IsAssignmentExpression(node, true /*excludeCompoundAssignment* /) {
 * 		left := tx.visitDestructuringAssignmentTarget(node.AsBinaryExpression().Left)
 * 		right := tx.Visitor().VisitNode(node.AsBinaryExpression().Right)
 * 		return tx.Factory().UpdateBinaryExpression(
 * 			node.AsBinaryExpression(),
 * 			nil,
 * 			left,
 * 			nil,
 * 			node.AsBinaryExpression().OperatorToken,
 * 			right,
 * 		)
 * 	}
 * 	return tx.visitDestructuringAssignmentTarget(node)
 * }
 */
export function classFieldsTransformer_visitAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  // 13.15.5.5 RS: IteratorDestructuringAssignmentEvaluation
  //   AssignmentElement : DestructuringAssignmentTarget Initializer?
  //     ...
  //     4. If |Initializer| is present and _value_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
  //           i. Let _v_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, receiver!.isAnonymousClassNeedingAssignedName)) {
    node = transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, false /*ignoreEmptyStringLiteral*/, "" /*assignedName*/);
  }
  if (IsAssignmentExpression(node, true /*excludeCompoundAssignment*/)) {
    const left = classFieldsTransformer_visitDestructuringAssignmentTarget(receiver, AsBinaryExpression(node)!.Left as unknown as GoPtr<Node>);
    const right = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), AsBinaryExpression(node)!.Right as unknown as GoPtr<Node>);
    return NodeFactory_UpdateBinaryExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      AsBinaryExpression(node)!,
      undefined,
      left as unknown as GoPtr<Expression>,
      undefined,
      AsBinaryExpression(node)!.OperatorToken,
      right as unknown as GoPtr<Expression>,
    );
  }
  return classFieldsTransformer_visitDestructuringAssignmentTarget(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentRestElement","kind":"method","status":"implemented","sigHash":"06c37c44fd05197dcb219a2b56e1940b88dac2da5a4ea8c833bb7c9a4e5d2240","bodyHash":"eee58b309a62257be6f97bba1309fe39fcccd55ebc89ed04690c9b808108e1e8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentRestElement(node *ast.Node) *ast.Node {
 * 	spread := node.AsSpreadElement()
 * 	if ast.IsLeftHandSideExpression(spread.Expression) {
 * 		expr := tx.visitDestructuringAssignmentTarget(spread.Expression)
 * 		return tx.Factory().UpdateSpreadElement(spread, expr)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitAssignmentRestElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const spread = AsSpreadElement(node);
  if (IsLeftHandSideExpression(spread!.Expression as unknown as GoPtr<Node>)) {
    const expr = classFieldsTransformer_visitDestructuringAssignmentTarget(receiver, spread!.Expression as unknown as GoPtr<Node>);
    return NodeFactory_UpdateSpreadElement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, spread!, expr as unknown as GoPtr<Expression>);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitArrayAssignmentElement","kind":"method","status":"implemented","sigHash":"991e2a0bbe936fd6665c3ed68932297a28762af9cd094cf5d63ae78629142212","bodyHash":"81d6cd1ed4880336465617269ac3e6916a7524f45734dc73da48ee3d612e6c57"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitArrayAssignmentElement(node *ast.Node) *ast.Node {
 * 	if ast.IsArrayBindingOrAssignmentElement(node) {
 * 		if ast.IsSpreadElement(node) {
 * 			return tx.visitAssignmentRestElement(node)
 * 		}
 * 		if node.Kind != ast.KindOmittedExpression {
 * 			return tx.visitAssignmentElement(node)
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitArrayAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsArrayBindingOrAssignmentElement(node)) {
    if (IsSpreadElement(node)) {
      return classFieldsTransformer_visitAssignmentRestElement(receiver, node);
    }
    if (node!.Kind !== KindOmittedExpression) {
      return classFieldsTransformer_visitAssignmentElement(receiver, node);
    }
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentProperty","kind":"method","status":"implemented","sigHash":"c1d729344fe11afe2ee3bc1250cdc6b74d1d0f49accd6f8b10b145c0c90bc27f","bodyHash":"223f4baee3a3d8d4b0c7c5f12f3c1d0f48c4cd67edcb465329de188cbd8653ac"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentProperty(node *ast.Node) *ast.Node {
 * 	// AssignmentProperty : PropertyName `:` AssignmentElement
 * 	// AssignmentElement : DestructuringAssignmentTarget Initializer?
 * 
 * 	// 13.15.5.6 RS: KeyedDestructuringAssignmentEvaluation
 * 	//   AssignmentElement : DestructuringAssignmentTarget Initializer?
 * 	//     ...
 * 	//     3. If |Initializer| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousfunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
 * 	//           i. Let _rhsValue_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
 * 	//     ...
 * 
 * 	prop := node.AsPropertyAssignment()
 * 	name := tx.Visitor().VisitNode(prop.Name())
 * 	init := prop.Initializer
 * 	if ast.IsAssignmentExpression(init, true /*excludeCompoundAssignment* /) {
 * 		assignElem := tx.visitAssignmentElement(init)
 * 		return tx.Factory().UpdatePropertyAssignment(prop, nil, name, nil, nil, assignElem)
 * 	}
 * 	if ast.IsLeftHandSideExpression(init) {
 * 		target := tx.visitDestructuringAssignmentTarget(init)
 * 		return tx.Factory().UpdatePropertyAssignment(prop, nil, name, nil, nil, target)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitAssignmentProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  // AssignmentProperty : PropertyName `:` AssignmentElement
  // AssignmentElement : DestructuringAssignmentTarget Initializer?

  // 13.15.5.6 RS: KeyedDestructuringAssignmentEvaluation
  //   AssignmentElement : DestructuringAssignmentTarget Initializer?
  //     ...
  //     3. If |Initializer| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousfunctionDefinition(|Initializer|) and IsIdentifierRef of |DestructuringAssignmentTarget| are both *true*, then
  //           i. Let _rhsValue_ be ? NamedEvaluation of |Initializer| with argument _lref_.[[ReferencedName]].
  //     ...

  const prop = AsPropertyAssignment(node);
  const name = NodeVisitor_VisitNode((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), prop!.name as unknown as GoPtr<Node>);
  const init = prop!.Initializer;
  if (IsAssignmentExpression(init as unknown as GoPtr<Node>, true /*excludeCompoundAssignment*/)) {
    const assignElem = classFieldsTransformer_visitAssignmentElement(receiver, init as unknown as GoPtr<Node>);
    return NodeFactory_UpdatePropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, prop!, undefined, name as unknown as GoPtr<PropertyName>, undefined, undefined, assignElem as unknown as GoPtr<Expression>);
  }
  if (IsLeftHandSideExpression(init as unknown as GoPtr<Node>)) {
    const target = classFieldsTransformer_visitDestructuringAssignmentTarget(receiver, init as unknown as GoPtr<Node>);
    return NodeFactory_UpdatePropertyAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, prop!, undefined, name as unknown as GoPtr<PropertyName>, undefined, undefined, target as unknown as GoPtr<Expression>);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitShorthandAssignmentProperty","kind":"method","status":"implemented","sigHash":"a152111fe535e32ff45f14f77ce84f9bdb8fc0f4b44cdc09bd636d5ded53de7e","bodyHash":"3806adc714cc6f7783cf1b351dcebee1980b3c0597f7f575308fab16495493c2"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitShorthandAssignmentProperty(node *ast.Node) *ast.Node {
 * 	// AssignmentProperty : IdentifierReference Initializer?
 * 
 * 	// 13.15.5.3 RS: PropertyDestructuringAssignmentEvaluation
 * 	//   AssignmentProperty : IdentifierReference Initializer?
 * 	//     ...
 * 	//     4. If |Initializer?| is present and _v_ is *undefined*, then
 * 	//        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
 * 	//           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _P_.
 * 	//     ...
 * 
 * 	if isNamedEvaluationAnd(tx.EmitContext(), node, tx.isAnonymousClassNeedingAssignedName) {
 * 		node = transformNamedEvaluation(tx.EmitContext(), node, false /*ignoreEmptyStringLiteral* /, "" /*assignedName* /)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitShorthandAssignmentProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  // AssignmentProperty : IdentifierReference Initializer?

  // 13.15.5.3 RS: PropertyDestructuringAssignmentEvaluation
  //   AssignmentProperty : IdentifierReference Initializer?
  //     ...
  //     4. If |Initializer?| is present and _v_ is *undefined*, then
  //        a. If IsAnonymousFunctionDefinition(|Initializer|) is *true*, then
  //           i. Set _v_ to ? NamedEvaluation of |Initializer| with argument _P_.
  //     ...

  if (isNamedEvaluationAnd(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, receiver!.isAnonymousClassNeedingAssignedName)) {
    node = transformNamedEvaluation(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node, false /*ignoreEmptyStringLiteral*/, "" /*assignedName*/);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentRestProperty","kind":"method","status":"implemented","sigHash":"307120399baa1bbef9a1b2237191059772404f7958df7941356b37b18b3d0388","bodyHash":"6f8f86a4d4aded47562156c654fdfb0a092a4c61322ba26705877ea6eb6e25f7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentRestProperty(node *ast.Node) *ast.Node {
 * 	spread := node.AsSpreadAssignment()
 * 	if ast.IsLeftHandSideExpression(spread.Expression) {
 * 		expr := tx.visitDestructuringAssignmentTarget(spread.Expression)
 * 		return tx.Factory().UpdateSpreadAssignment(spread, expr)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitAssignmentRestProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  const spread = AsSpreadAssignment(node);
  if (IsLeftHandSideExpression(spread!.Expression as unknown as GoPtr<Node>)) {
    const expr = classFieldsTransformer_visitDestructuringAssignmentTarget(receiver, spread!.Expression as unknown as GoPtr<Node>);
    return NodeFactory_UpdateSpreadAssignment(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, spread!, expr as unknown as GoPtr<Expression>);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitObjectAssignmentElement","kind":"method","status":"implemented","sigHash":"bafcfba3043cbc51547d76de1f2e95558539b0d3a55cfeb986668c36ca3e0244","bodyHash":"c7ee768063f95eb103733f4f0be4fe39f1693d5bb735f4520099b16ab3e315be"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitObjectAssignmentElement(node *ast.Node) *ast.Node {
 * 	debug.Assert(node != nil && ast.IsObjectBindingOrAssignmentElement(node))
 * 	if ast.IsSpreadAssignment(node) {
 * 		return tx.visitAssignmentRestProperty(node)
 * 	}
 * 	if ast.IsShorthandPropertyAssignment(node) {
 * 		return tx.visitShorthandAssignmentProperty(node)
 * 	}
 * 	if ast.IsPropertyAssignment(node) {
 * 		return tx.visitAssignmentProperty(node)
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export function classFieldsTransformer_visitObjectAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  debug.Assert(node !== undefined && IsObjectBindingOrAssignmentElement(node));
  if (IsSpreadAssignment(node)) {
    return classFieldsTransformer_visitAssignmentRestProperty(receiver, node);
  }
  if (IsShorthandPropertyAssignment(node)) {
    return classFieldsTransformer_visitShorthandAssignmentProperty(receiver, node);
  }
  if (IsPropertyAssignment(node) as unknown as boolean) {
    return classFieldsTransformer_visitAssignmentProperty(receiver, node);
  }
  return NodeVisitor_VisitEachChild((Transformer_Visitor(receiver!.__tsgoEmbedded0!) as ConcreteNodeVisitor), node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitAssignmentPattern","kind":"method","status":"implemented","sigHash":"149b72c0b1efdaf3e898ab3100beeec2f7153c0542487b34e10343c27c781ca1","bodyHash":"4820fc3324b2970e5a89f864394891fb20221e6091c3a0d846204a894629797d"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitAssignmentPattern(node *ast.Node) *ast.Node {
 * 	if ast.IsArrayLiteralExpression(node) {
 * 		// Transforms private names in destructuring assignment array bindings.
 * 		// Transforms SuperProperty assignments in destructuring assignment array bindings in static initializers.
 * 		//
 * 		// Source:
 * 		// ([ this.#myProp ] = [ "hello" ]);
 * 		//
 * 		// Transformation:
 * 		// [ { set value(x) { this.#myProp = x; } }.value ] = [ "hello" ];
 * 		return tx.Factory().UpdateArrayLiteralExpression(
 * 			node.AsArrayLiteralExpression(),
 * 			tx.arrayAssignmentElementVisitor.VisitNodes(node.AsArrayLiteralExpression().Elements),
 * 			node.AsArrayLiteralExpression().MultiLine,
 * 		)
 * 	}
 * 	// Transforms private names in destructuring assignment object bindings.
 * 	// Transforms SuperProperty assignments in destructuring assignment object bindings in static initializers.
 * 	//
 * 	// Source:
 * 	// ({ stringProperty: this.#myProp } = { stringProperty: "hello" });
 * 	//
 * 	// Transformation:
 * 	// ({ stringProperty: { set value(x) { this.#myProp = x; } }.value }) = { stringProperty: "hello" };
 * 	return tx.Factory().UpdateObjectLiteralExpression(
 * 		node.AsObjectLiteralExpression(),
 * 		tx.objectAssignmentElementVisitor.VisitNodes(node.AsObjectLiteralExpression().Properties),
 * 		node.AsObjectLiteralExpression().MultiLine,
 * 	)
 * }
 */
export function classFieldsTransformer_visitAssignmentPattern(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node> {
  if (IsArrayLiteralExpression(node)) {
    // Transforms private names in destructuring assignment array bindings.
    // Transforms SuperProperty assignments in destructuring assignment array bindings in static initializers.
    //
    // Source:
    // ([ this.#myProp ] = [ "hello" ]);
    //
    // Transformation:
    // [ { set value(x) { this.#myProp = x; } }.value ] = [ "hello" ];
    return NodeFactory_UpdateArrayLiteralExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      AsArrayLiteralExpression(node)!,
      NodeVisitor_VisitNodes(receiver!.arrayAssignmentElementVisitor as ConcreteNodeVisitor, AsArrayLiteralExpression(node)!.Elements),
      AsArrayLiteralExpression(node)!.MultiLine,
    );
  }
  // Transforms private names in destructuring assignment object bindings.
  // Transforms SuperProperty assignments in destructuring assignment object bindings in static initializers.
  //
  // Source:
  // ({ stringProperty: this.#myProp } = { stringProperty: "hello" });
  //
  // Transformation:
  // ({ stringProperty: { set value(x) { this.#myProp = x; } }.value }) = { stringProperty: "hello" };
  return NodeFactory_UpdateObjectLiteralExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    AsObjectLiteralExpression(node)!,
    NodeVisitor_VisitNodes(receiver!.objectAssignmentElementVisitor as ConcreteNodeVisitor, AsObjectLiteralExpression(node)!.Properties),
    AsObjectLiteralExpression(node)!.MultiLine,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::createPrivateStaticFieldInitializer","kind":"func","status":"implemented","sigHash":"adb2e7776b774a69585bdfb6c5590f868a05a928132cb18e733696438b8b1af9","bodyHash":"5ee009617ef5f154e65979b0eb5c5685111d4b8be8464941a0825a1311f7e2e1"}
 *
 * Go source:
 * func createPrivateStaticFieldInitializer(factory *printer.NodeFactory, variableName *ast.IdentifierNode, initializer *ast.Expression) *ast.Expression {
 * 	if initializer == nil {
 * 		initializer = factory.NewVoidZeroExpression()
 * 	}
 * 	return factory.NewAssignmentExpression(
 * 		variableName,
 * 		factory.NewObjectLiteralExpression(
 * 			factory.NewNodeList([]*ast.Node{
 * 				factory.NewPropertyAssignment(nil, factory.NewIdentifier("value"), nil, nil, initializer),
 * 			}),
 * 			false,
 * 		),
 * 	)
 * }
 */
export function createPrivateStaticFieldInitializer(factory: GoPtr<NodeFactory>, variableName: GoPtr<IdentifierNode>, initializer: GoPtr<Expression>): GoPtr<Expression> {
  let init = initializer;
  if (init === undefined) {
    init = NodeFactory_NewVoidZeroExpression(factory);
  }
  return NodeFactory_NewAssignmentExpression(
    factory,
    variableName as unknown as GoPtr<Expression>,
    NewObjectLiteralExpression(
      factory!.__tsgoEmbedded0!,
      NodeFactory_NewNodeList(factory!.__tsgoEmbedded0!, [
        NewPropertyAssignment(factory!.__tsgoEmbedded0!, undefined, NewIdentifier(factory!.__tsgoEmbedded0!, "value") as unknown as GoPtr<PropertyName>, undefined, undefined, init),
      ]),
      false,
    ) as unknown as GoPtr<Expression>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::createPrivateInstanceFieldInitializer","kind":"func","status":"implemented","sigHash":"c10bea194dc9e23a77ed834301b8925acf1f66d7e938e296b5fe7e7df506a677","bodyHash":"32188bfc9d5c3f9ca185643ba4bc766c2bde2550814340d24bc09a83b4fce926"}
 *
 * Go source:
 * func createPrivateInstanceFieldInitializer(factory *printer.NodeFactory, receiver *ast.Expression, initializer *ast.Expression, weakMapName *ast.IdentifierNode) *ast.Expression {
 * 	if initializer == nil {
 * 		initializer = factory.NewVoidZeroExpression()
 * 	}
 * 	return factory.NewMethodCall(weakMapName, factory.NewIdentifier("set"), []*ast.Node{receiver, initializer})
 * }
 */
export function createPrivateInstanceFieldInitializer(factory: GoPtr<NodeFactory>, receiver: GoPtr<Expression>, initializer: GoPtr<Expression>, weakMapName: GoPtr<IdentifierNode>): GoPtr<Expression> {
  let init = initializer;
  if (init === undefined) {
    init = NodeFactory_NewVoidZeroExpression(factory);
  }
  return NodeFactory_NewMethodCall(factory, weakMapName as unknown as GoPtr<Node>, NewIdentifier(factory!.__tsgoEmbedded0!, "set") as unknown as GoPtr<Node>, [receiver as unknown as GoPtr<Node>, init as unknown as GoPtr<Node>]) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::createPrivateInstanceMethodInitializer","kind":"func","status":"implemented","sigHash":"3280f47431f8029334d4d32ecede83f56824c3df3ba0d49d71c526d49756906a","bodyHash":"be5dc753463c208ecc03d2c72e77f7974f2a8dfcb73721bab4b44558af0e6b32"}
 *
 * Go source:
 * func createPrivateInstanceMethodInitializer(factory *printer.NodeFactory, receiver *ast.Expression, weakSetName *ast.IdentifierNode) *ast.Expression {
 * 	return factory.NewMethodCall(weakSetName, factory.NewIdentifier("add"), []*ast.Node{receiver})
 * }
 */
export function createPrivateInstanceMethodInitializer(factory: GoPtr<NodeFactory>, receiver: GoPtr<Expression>, weakSetName: GoPtr<IdentifierNode>): GoPtr<Expression> {
  return NodeFactory_NewMethodCall(factory, weakSetName as unknown as GoPtr<Node>, NewIdentifier(factory!.__tsgoEmbedded0!, "add") as unknown as GoPtr<Node>, [receiver as unknown as GoPtr<Node>]) as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.isReservedPrivateName","kind":"method","status":"implemented","sigHash":"3c2f5c7c569643aa4d7124384da0036a28d71fc1779cd1017708900b4d9548ca","bodyHash":"f7f750a30824bab1de585ac8ac272f0096f812a5d57a955b3ac984948de50b29"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) isReservedPrivateName(node *ast.Node) bool {
 * 	return !(ast.IsPrivateIdentifier(node) && tx.EmitContext().HasAutoGenerateInfo(node)) && node.Text() == "#constructor"
 * }
 */
export function classFieldsTransformer_isReservedPrivateName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool {
  return (!(IsPrivateIdentifier(node) && EmitContext_HasAutoGenerateInfo(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), node)) && Node_Text(node) === "#constructor") as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::isStaticPropertyDeclarationOrClassStaticBlock","kind":"func","status":"implemented","sigHash":"a58905c820ad01523c2302b8dd0187c01bef3aeaf415e04554c6474e3f90d385","bodyHash":"7985f81fa9aaa69f5614d3bef8c54d8e4ed5a9e9b096e1694decc7ccd0a5680e"}
 *
 * Go source:
 * func isStaticPropertyDeclarationOrClassStaticBlock(node *ast.Node) bool {
 * 	return ast.IsClassStaticBlockDeclaration(node) ||
 * 		(ast.IsPropertyDeclaration(node) && ast.HasStaticModifier(node))
 * }
 */
export function isStaticPropertyDeclarationOrClassStaticBlock(node: GoPtr<Node>): bool {
  return (IsClassStaticBlockDeclaration(node) ||
    (IsPropertyDeclaration(node) && HasStaticModifier(node))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getProperties","kind":"method","status":"implemented","sigHash":"28eda8fc204e6fbe117f6b773fbb6bd3588d6bfc3d96fd611af0c505317f50d2","bodyHash":"cb3297987e3c0f6e8de2f43ff6ea16384a4d454225b6415186075f1b604c8e49"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getProperties(node *ast.Node, requireInitializer bool, isStatic bool) []*ast.Node {
 * 	var result []*ast.Node
 * 	for _, member := range node.Members() {
 * 		if ast.IsPropertyDeclaration(member) &&
 * 			(!requireInitializer || member.Initializer() != nil) &&
 * 			ast.HasStaticModifier(member) == isStatic {
 * 			result = append(result, member)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function classFieldsTransformer_getProperties(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, requireInitializer: bool, isStatic: bool): GoSlice<GoPtr<Node>> {
  const result: Array<GoPtr<Node>> = [];
  for (const member of Node_Members(node) ?? []) {
    if (IsPropertyDeclaration(member) &&
      (!requireInitializer || Node_Initializer(member) !== undefined) &&
      (HasStaticModifier(member) === isStatic)) {
      result.push(member);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getStaticPropertiesAndClassStaticBlock","kind":"method","status":"implemented","sigHash":"4e68192b78d329f5684e1e880630a5d50d9d7bc50a2b981fbdb9739645d2d9bc","bodyHash":"28b48ef60bf25015ad0127bf9dffcba18b00c7ed413a19f9c6a386a375ebfdac"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getStaticPropertiesAndClassStaticBlock(node *ast.Node) []*ast.Node {
 * 	var result []*ast.Node
 * 	for _, member := range node.Members() {
 * 		if ast.IsClassStaticBlockDeclaration(member) || (ast.IsPropertyDeclaration(member) && ast.HasStaticModifier(member)) {
 * 			result = append(result, member)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function classFieldsTransformer_getStaticPropertiesAndClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoSlice<GoPtr<Node>> {
  const result: Array<GoPtr<Node>> = [];
  for (const member of Node_Members(node) ?? []) {
    if (IsClassStaticBlockDeclaration(member) || (IsPropertyDeclaration(member) && HasStaticModifier(member))) {
      result.push(member);
    }
  }
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::classHasClassThisAssignment","kind":"func","status":"implemented","sigHash":"c47dae524d9c1bd3dd625c06c07940ac890587f83867be84dd9ef75d7c17f281","bodyHash":"5ba52987335c5c15d7ef595862d16c6c560d58caca3ee695100d7c6d4e9c1c2d"}
 *
 * Go source:
 * func classHasClassThisAssignment(emitContext *printer.EmitContext, node *ast.Node) bool {
 * 	for _, member := range node.Members() {
 * 		if isClassThisAssignmentBlock(emitContext, member) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export function classHasClassThisAssignment(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool {
  for (const member of Node_Members(node) ?? []) {
    if (isClassThisAssignmentBlock(emitContext, member)) {
      return true;
    }
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::isNonStaticMethodOrAccessorWithPrivateName","kind":"func","status":"implemented","sigHash":"32f8d288bb28d37f33f55e583ace239b487cd34f08529e26af3b882728cc091d","bodyHash":"0870aaace74433180b02ba97bbc49e0c13f4e2d70f6265912da1f2b290281f1b"}
 *
 * Go source:
 * func isNonStaticMethodOrAccessorWithPrivateName(member *ast.Node) bool {
 * 	return !ast.IsStatic(member) &&
 * 		(ast.IsMethodOrAccessor(member) || ast.IsAutoAccessorPropertyDeclaration(member)) &&
 * 		ast.IsPrivateIdentifier(member.Name())
 * }
 */
export function isNonStaticMethodOrAccessorWithPrivateName(member: GoPtr<Node>): bool {
  return (!IsStatic(member) &&
    (IsMethodOrAccessor(member) || IsAutoAccessorPropertyDeclaration(member)) &&
    IsPrivateIdentifier(Node_Name(member))) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::createMemberAccessForPropertyName","kind":"func","status":"implemented","sigHash":"b8dc820912de338e5059e9e37213518c694e06fcec41f8f8ec59b08de5a6e86e","bodyHash":"0b7ba67b04ec7d6454c3236f111805c8a253b4670586ce82ca1f4ec14a19f195"}
 *
 * Go source:
 * func createMemberAccessForPropertyName(factory *printer.NodeFactory, emitContext *printer.EmitContext, receiver *ast.Expression, name *ast.PropertyName, location *ast.PropertyName) *ast.Expression {
 * 	if ast.IsComputedPropertyName(name) {
 * 		expression := factory.NewElementAccessExpression(receiver, nil, name.Expression(), ast.NodeFlagsNone)
 * 		expression.Loc = location.Loc
 * 		return expression
 * 	}
 * 	var expression *ast.Expression
 * 	if ast.IsIdentifier(name) || ast.IsPrivateIdentifier(name) {
 * 		expression = factory.NewPropertyAccessExpression(receiver, nil, name, ast.NodeFlagsNone)
 * 	} else {
 * 		// string or numeric literal
 * 		expression = factory.NewElementAccessExpression(receiver, nil, name, ast.NodeFlagsNone)
 * 	}
 * 	emitContext.SetCommentRange(expression, name.Loc)
 * 	emitContext.SetSourceMapRange(expression, name.Loc)
 * 	emitContext.AddEmitFlags(expression, printer.EFNoNestedSourceMaps)
 * 	return expression
 * }
 */
export function createMemberAccessForPropertyName(factory: GoPtr<NodeFactory>, emitContext: GoPtr<EmitContext>, receiver: GoPtr<Expression>, name: GoPtr<PropertyName>, location: GoPtr<PropertyName>): GoPtr<Expression> {
  if (IsComputedPropertyName(name)) {
    const expression = NewElementAccessExpression(factory!.__tsgoEmbedded0!, receiver, undefined, AsComputedPropertyName(name)!.Expression, NodeFlagsNone);
    expression!.Loc = location!.Loc;
    return expression as unknown as GoPtr<Expression>;
  }
  let expression: GoPtr<Node>;
  if (IsIdentifier(name) || IsPrivateIdentifier(name)) {
    expression = NewPropertyAccessExpression(factory!.__tsgoEmbedded0!, receiver, undefined, name as unknown as GoPtr<Node>, NodeFlagsNone);
  } else {
    // string or numeric literal
    expression = NewElementAccessExpression(factory!.__tsgoEmbedded0!, receiver, undefined, name as unknown as GoPtr<Expression>, NodeFlagsNone);
  }
  EmitContext_SetCommentRange(emitContext, expression, name!.Loc);
  EmitContext_SetSourceMapRange(emitContext, expression, name!.Loc);
  EmitContext_AddEmitFlags(emitContext, expression, EFNoNestedSourceMaps);
  return expression as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createCallBinding","kind":"method","status":"implemented","sigHash":"496aabcd13ba8f62c77b857e827937041232969d5f0038a6bce05f97f51b31a6","bodyHash":"3efb1f2be6f4f2d1912cc2123cbd7982bead734c2db4dd41536307b0960bbf44"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createCallBinding(node *ast.Node) (thisArg *ast.Expression, target *ast.Expression) {
 * 	if ast.IsSuperProperty(node) {
 * 		return tx.Factory().NewThisExpression(), node
 * 	}
 * 	if ast.IsPropertyAccessExpression(node) {
 * 		expr := node.AsPropertyAccessExpression()
 * 		if shouldBeCapturedInTempVariable(expr.Expression) {
 * 			thisArg = tx.Factory().NewTempVariable()
 * 			tx.EmitContext().AddVariableDeclaration(thisArg)
 * 			target = tx.Factory().NewPropertyAccessExpression(
 * 				tx.Factory().NewParenthesizedExpression( // TODO: do we even need these?
 * 					tx.Factory().NewAssignmentExpression(thisArg, expr.Expression),
 * 				),
 * 				nil,
 * 				expr.Name(),
 * 				ast.NodeFlagsNone,
 * 			)
 * 			return thisArg, target
 * 		}
 * 		return expr.Expression, node
 * 	}
 * 	thisArg = tx.Factory().NewVoidZeroExpression()
 * 	target = node
 * 	return thisArg, target
 * }
 */
export function classFieldsTransformer_createCallBinding(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): [GoPtr<Expression>, GoPtr<Expression>] {
  if (IsSuperProperty(node)) {
    return [NodeFactory_NewThisExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)), node as unknown as GoPtr<Expression>];
  }
  if (IsPropertyAccessExpression(node)) {
    const expr = AsPropertyAccessExpression(node);
    if (shouldBeCapturedInTempVariable(expr!.Expression as unknown as GoPtr<Node>)) {
      const thisArg = NodeFactory_NewTempVariable(Transformer_Factory(receiver!.__tsgoEmbedded0!));
      EmitContext_AddVariableDeclaration(Transformer_EmitContext(receiver!.__tsgoEmbedded0!), thisArg);
      const target = NewPropertyAccessExpression(
        Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
        NewParenthesizedExpression( // TODO: do we even need these?
          Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
          NodeFactory_NewAssignmentExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!), thisArg as unknown as GoPtr<Expression>, expr!.Expression),
        ) as unknown as GoPtr<Expression>,
        undefined,
        expr!.name as unknown as GoPtr<Node>,
        NodeFlagsNone,
      );
      return [thisArg as unknown as GoPtr<Expression>, target as unknown as GoPtr<Expression>];
    }
    return [expr!.Expression, node as unknown as GoPtr<Expression>];
  }
  return [NodeFactory_NewVoidZeroExpression(Transformer_Factory(receiver!.__tsgoEmbedded0!)), node as unknown as GoPtr<Expression>];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::shouldBeCapturedInTempVariable","kind":"func","status":"implemented","sigHash":"4c22386fb05e554f59b94373e3e3a6a8a413cc7146bfc47343989c9b9d346f83","bodyHash":"bf1bd52c0eb76cc3606fb63e932feaebf3a4df26cb715af9e7138affdb977af1"}
 *
 * Go source:
 * func shouldBeCapturedInTempVariable(node *ast.Node) bool {
 * 	target := ast.SkipParentheses(node)
 * 	switch target.Kind {
 * 	case ast.KindIdentifier, ast.KindThisKeyword, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindStringLiteral:
 * 		return false
 * 	default:
 * 		return true
 * 	}
 * }
 */
export function shouldBeCapturedInTempVariable(node: GoPtr<Node>): bool {
  const target = SkipParentheses(node);
  switch (target!.Kind) {
    case KindIdentifier:
    case KindThisKeyword:
    case KindNumericLiteral:
    case KindBigIntLiteral:
    case KindStringLiteral:
      return false;
    default:
      return true;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createAccessorPropertyGetRedirector","kind":"method","status":"implemented","sigHash":"e62f9ed8f593fdc764a4421342c8ca8be420247e429aec9923730e5d16f4231d","bodyHash":"7ec29fff38cbf250bf84e7e43909ba39c292e1383ec9422f57e6b9cc2f079538"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createAccessorPropertyGetRedirector(node *ast.PropertyDeclaration, modifiers *ast.ModifierList, name *ast.PropertyName, receiver *ast.Expression) *ast.Node {
 * 	backingFieldName := tx.Factory().NewGeneratedPrivateNameForNodeEx(node.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"})
 * 	returnExpr := tx.Factory().NewPropertyAccessExpression(
 * 		receiver,
 * 		nil,
 * 		backingFieldName,
 * 		ast.NodeFlagsNone,
 * 	)
 * 	returnStmt := tx.Factory().NewReturnStatement(returnExpr)
 * 	body := tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{returnStmt}), false)
 * 	return tx.Factory().NewGetAccessorDeclaration(
 * 		modifiers,
 * 		name,
 * 		nil, /*typeParameters* /
 * 		tx.Factory().NewNodeList([]*ast.Node{}),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * }
 */
export function classFieldsTransformer_createAccessorPropertyGetRedirector(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, receiver1: GoPtr<Expression>): GoPtr<Node> {
  const backingFieldName = NodeFactory_NewGeneratedPrivateNameForNodeEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), Node_Name(node as unknown as GoPtr<Node>)!, { Suffix: "_accessor_storage" } as AutoGenerateOptions);
  const returnExpr = NewPropertyAccessExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    receiver1,
    undefined,
    backingFieldName as unknown as GoPtr<Node>,
    NodeFlagsNone,
  );
  const returnStmt = NewReturnStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, returnExpr as unknown as GoPtr<Expression>);
  const body = NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [returnStmt]), false);
  return NewGetAccessorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    modifiers,
    name,
    undefined, /*typeParameters*/
    NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, []),
    undefined, /*returnType*/
    undefined, /*fullSignature*/
    body as unknown as GoPtr<Node>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createAccessorPropertySetRedirector","kind":"method","status":"implemented","sigHash":"bea3631fb5644e0c1c792511038f39de54e02467cd9203226915640ffc2e0a07","bodyHash":"da07d86189cb8fc0c3045d26be590a40c209eeb62dcc7b9c49dadd6d57956043"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createAccessorPropertySetRedirector(node *ast.PropertyDeclaration, modifiers *ast.ModifierList, name *ast.PropertyName, receiver *ast.Expression) *ast.Node {
 * 	backingFieldName := tx.Factory().NewGeneratedPrivateNameForNodeEx(node.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"})
 * 	valueParam := tx.Factory().NewParameterDeclaration(
 * 		nil, /*modifiers* /
 * 		nil, /*dotDotDotToken* /
 * 		tx.Factory().NewIdentifier("value"),
 * 		nil, /*questionToken* /
 * 		nil, /*typeNode* /
 * 		nil, /*initializer* /
 * 	)
 * 	assignExpr := tx.Factory().NewAssignmentExpression(
 * 		tx.Factory().NewPropertyAccessExpression(
 * 			receiver,
 * 			nil,
 * 			backingFieldName,
 * 			ast.NodeFlagsNone,
 * 		),
 * 		tx.Factory().NewIdentifier("value"),
 * 	)
 * 	exprStmt := tx.Factory().NewExpressionStatement(assignExpr)
 * 	body := tx.Factory().NewBlock(tx.Factory().NewNodeList([]*ast.Node{exprStmt}), false)
 * 	return tx.Factory().NewSetAccessorDeclaration(
 * 		modifiers,
 * 		name,
 * 		nil, /*typeParameters* /
 * 		tx.Factory().NewNodeList([]*ast.Node{valueParam}),
 * 		nil, /*returnType* /
 * 		nil, /*fullSignature* /
 * 		body,
 * 	)
 * }
 */
export function classFieldsTransformer_createAccessorPropertySetRedirector(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, receiver1: GoPtr<Expression>): GoPtr<Node> {
  const backingFieldName = NodeFactory_NewGeneratedPrivateNameForNodeEx(Transformer_Factory(receiver!.__tsgoEmbedded0!), Node_Name(node as unknown as GoPtr<Node>)!, { Suffix: "_accessor_storage" } as AutoGenerateOptions);
  const valueParam = NewParameterDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    undefined, /*modifiers*/
    undefined, /*dotDotDotToken*/
    NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "value") as unknown as GoPtr<Node>,
    undefined, /*questionToken*/
    undefined, /*typeNode*/
    undefined, /*initializer*/
  );
  const assignExpr = NodeFactory_NewAssignmentExpression(
    Transformer_Factory(receiver!.__tsgoEmbedded0!),
    NewPropertyAccessExpression(
      Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
      receiver1,
      undefined,
      backingFieldName as unknown as GoPtr<Node>,
      NodeFlagsNone,
    ) as unknown as GoPtr<Expression>,
    NewIdentifier(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, "value") as unknown as GoPtr<Expression>,
  );
  const exprStmt = NewExpressionStatement(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, assignExpr);
  const body = NewBlock(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [exprStmt]), false);
  return NewSetAccessorDeclaration(
    Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!,
    modifiers,
    name,
    undefined, /*typeParameters*/
    NodeFactory_NewNodeList(Transformer_Factory(receiver!.__tsgoEmbedded0!)!.__tsgoEmbedded0!, [valueParam]),
    undefined, /*returnType*/
    undefined, /*fullSignature*/
    body as unknown as GoPtr<Node>,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::flattenCommaList","kind":"func","status":"implemented","sigHash":"95f8c6cce9f3c4acf3496c6a6c9a8ad0bef0e6bb85161c87bdcd5178e7f77b4d","bodyHash":"71fc207a7c8a2ae78b443396e51e25d123911d6626061364a9bf880b26711f58"}
 *
 * Go source:
 * func flattenCommaList(node *ast.Expression) iter.Seq[*ast.Expression] {
 * 	return func(yield func(*ast.Expression) bool) {
 * 		flattenCommaListWorker(node, yield)
 * 	}
 * }
 */
export function flattenCommaList(node: GoPtr<Expression>): GoSeq<GoPtr<Expression>> {
  return (yield_: (value: GoPtr<Expression>) => bool): void => {
    flattenCommaListWorker(node, yield_);
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::flattenCommaListWorker","kind":"func","status":"implemented","sigHash":"b3406ba247bc04bf28ab2a38ee8c6f3d6ae78b91103696974a8bfc2615e9ecb7","bodyHash":"389eb6ef2aa9f4547c7b5e4c7ff2b8eb0001888cbd975af2aaa01345475e1f8d"}
 *
 * Go source:
 * func flattenCommaListWorker(node *ast.Expression, yield func(*ast.Expression) bool) bool {
 * 	if ast.IsParenthesizedExpression(node) && ast.NodeIsSynthesized(node) {
 * 		return flattenCommaListWorker(node.Expression(), yield)
 * 	} else if ast.IsCommaExpression(node.AsNode()) {
 * 		return flattenCommaListWorker(node.AsBinaryExpression().Left, yield) &&
 * 			flattenCommaListWorker(node.AsBinaryExpression().Right, yield)
 * 	} else {
 * 		return yield(node)
 * 	}
 * }
 */
export function flattenCommaListWorker(node: GoPtr<Expression>, yield_: (arg0: GoPtr<Expression>) => bool): bool {
  if (IsParenthesizedExpression(node) && NodeIsSynthesized(node)) {
    return flattenCommaListWorker(Node_Expression(node), yield_);
  } else if (IsCommaExpression(node)) {
    return flattenCommaListWorker(AsBinaryExpression(node)!.Left, yield_) &&
      flattenCommaListWorker(AsBinaryExpression(node)!.Right, yield_);
  } else {
    return yield_(node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::findComputedPropertyNameCacheAssignment","kind":"func","status":"implemented","sigHash":"04ee45a5ffe8b036d38755930d142ef677c3b93231acc82b30a09781bcb05d85","bodyHash":"a111274609334d15240c810b9d49cb28a7f131327f667a90c70effb68b6468fd"}
 *
 * Go source:
 * func findComputedPropertyNameCacheAssignment(emitContext *printer.EmitContext, name *ast.Node) *ast.BinaryExpression {
 * 	node := name.Expression()
 * 	for {
 * 		node = ast.SkipOuterExpressions(node, 0)
 * 		if ast.IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
 * 			node = node.AsBinaryExpression().Right
 * 			continue
 * 		}
 * 		if ast.IsAssignmentExpression(node, true /*excludeCompoundAssignment* /) && ast.IsIdentifier(node.AsBinaryExpression().Left) {
 * 			return node.AsBinaryExpression()
 * 		}
 * 		break
 * 	}
 * 	return nil
 * }
 */
export function findComputedPropertyNameCacheAssignment(emitContext: GoPtr<EmitContext>, name: GoPtr<Node>): GoPtr<BinaryExpression> {
  let node = Node_Expression(name);
  for (;;) {
    node = SkipOuterExpressions(node, 0);
    if (IsBinaryExpression(node) && AsBinaryExpression(node)!.OperatorToken!.Kind === KindCommaToken) {
      node = AsBinaryExpression(node)!.Right;
      continue;
    }
    if (IsAssignmentExpression(node, true /*excludeCompoundAssignment*/) && IsIdentifier(AsBinaryExpression(node)!.Left)) {
      return AsBinaryExpression(node);
    }
    break;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::expandPreOrPostfixIncrementOrDecrementExpression","kind":"func","status":"implemented","sigHash":"7e82674473f6492e57d5e43d216dd825bc7e8300c812ed41a34219c234d75e2f","bodyHash":"8ebed1ca61c0113059ec82a28a85018958a5c20fcddad99c79ed4ab73dfa61c1"}
 *
 * Go source:
 * func expandPreOrPostfixIncrementOrDecrementExpression(factory *printer.NodeFactory, emitContext *printer.EmitContext, node *ast.Node, expression *ast.Expression, resultVariable *ast.IdentifierNode) *ast.Expression {
 * 	var operator ast.Kind
 * 	var operand *ast.Node
 * 	if ast.IsPrefixUnaryExpression(node) {
 * 		operator = node.AsPrefixUnaryExpression().Operator
 * 		operand = node.AsPrefixUnaryExpression().Operand
 * 	} else {
 * 		operator = node.AsPostfixUnaryExpression().Operator
 * 		operand = node.AsPostfixUnaryExpression().Operand
 * 	}
 * 
 * 	temp := factory.NewTempVariable()
 * 	emitContext.AddVariableDeclaration(temp)
 * 	expression = factory.NewAssignmentExpression(temp, expression)
 * 	expression.Loc = operand.Loc
 * 
 * 	var operation *ast.Expression
 * 	if ast.IsPrefixUnaryExpression(node) {
 * 		operation = factory.NewPrefixUnaryExpression(operator, temp)
 * 	} else {
 * 		operation = factory.NewPostfixUnaryExpression(temp, operator)
 * 	}
 * 	operation.Loc = node.Loc
 * 
 * 	if resultVariable != nil {
 * 		operation = factory.NewAssignmentExpression(resultVariable, operation)
 * 		operation.Loc = node.Loc
 * 	}
 * 
 * 	expression = factory.NewCommaExpression(expression, operation)
 * 	expression.Loc = node.Loc
 * 
 * 	if ast.IsPostfixUnaryExpression(node) {
 * 		expression = factory.NewCommaExpression(expression, temp)
 * 		expression.Loc = node.Loc
 * 	}
 * 
 * 	return expression
 * }
 */
export function expandPreOrPostfixIncrementOrDecrementExpression(factory: GoPtr<NodeFactory>, emitContext: GoPtr<EmitContext>, node: GoPtr<Node>, expression: GoPtr<Expression>, resultVariable: GoPtr<IdentifierNode>): GoPtr<Expression> {
  let operator: Kind;
  let operand: GoPtr<Node>;
  if (IsPrefixUnaryExpression(node)) {
    operator = AsPrefixUnaryExpression(node)!.Operator;
    operand = AsPrefixUnaryExpression(node)!.Operand as unknown as GoPtr<Node>;
  } else {
    operator = AsPostfixUnaryExpression(node)!.Operator;
    operand = AsPostfixUnaryExpression(node)!.Operand as unknown as GoPtr<Node>;
  }

  const temp = NodeFactory_NewTempVariable(factory);
  EmitContext_AddVariableDeclaration(emitContext, temp);
  let expr = NodeFactory_NewAssignmentExpression(factory, temp as unknown as GoPtr<Expression>, expression);
  expr!.Loc = operand!.Loc;

  let operation: GoPtr<Expression>;
  if (IsPrefixUnaryExpression(node)) {
    operation = NewPrefixUnaryExpression(factory!.__tsgoEmbedded0!, operator, temp as unknown as GoPtr<Expression>) as unknown as GoPtr<Expression>;
  } else {
    operation = NewPostfixUnaryExpression(factory!.__tsgoEmbedded0!, temp as unknown as GoPtr<Expression>, operator) as unknown as GoPtr<Expression>;
  }
  operation!.Loc = node!.Loc;

  if (resultVariable !== undefined) {
    operation = NodeFactory_NewAssignmentExpression(factory, resultVariable as unknown as GoPtr<Expression>, operation);
    operation!.Loc = node!.Loc;
  }

  expr = NodeFactory_NewCommaExpression(factory, expr, operation);
  expr!.Loc = node!.Loc;

  if (IsPostfixUnaryExpression(node)) {
    expr = NodeFactory_NewCommaExpression(factory, expr, temp as unknown as GoPtr<Expression>);
    expr!.Loc = node!.Loc;
  }

  return expr;
}
