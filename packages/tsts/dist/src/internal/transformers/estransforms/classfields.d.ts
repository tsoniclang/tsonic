import type { bool, int } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSeq, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import type { BinaryExpression, BindingElement, CallExpression, ClassDeclaration, ClassExpression, ComputedPropertyName, ConstructorDeclaration, ElementAccessExpression, ExportAssignment, ExpressionStatement, ExpressionWithTypeArguments, ForStatement, Identifier, ParameterDeclaration, ParenthesizedExpression, PropertyAccessExpression, PropertyAssignment, PropertyDeclaration, TaggedTemplateExpression, VariableDeclaration, VariableStatement } from "../../ast/generated/data.js";
import type { ClassElement, ClassLikeDeclaration, Expression, IdentifierNode, PropertyName, SourceFileNode, Statement } from "../../ast/generated/unions.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { Set } from "../../collections/set.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import type { NodeFactory, PrivateIdentifierKind } from "../../printer/factory.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
import type { anonymousFunctionDefinition } from "./namedevaluation.js";
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
export declare const classFactsNone: classFacts;
export declare const classFactsClassWasDecorated: classFacts;
export declare const classFactsNeedsClassConstructorReference: classFacts;
export declare const classFactsNeedsClassSuperReference: classFacts;
export declare const classFactsNeedsSubstitutionForThisInClassStaticField: classFacts;
export declare const classFactsWillHoistInitializersToConstructor: classFacts;
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
    enclosingClassDeclarations: Set<GoPtr<Node>>;
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
export declare function newClassFieldsTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.requiresBlockScopedVar","kind":"method","status":"implemented","sigHash":"5fc66be59f3b1d2a963ca72b48ec10465b2900af7b3a45c5856251a097c88809","bodyHash":"08b64d5f9e653d5c90ebaf8286feedeadddbe694fca73e5b14542f0faf279be7"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) requiresBlockScopedVar() bool {
 * 	return tx.inIterationStatement && tx.currentClassContainer != nil && ast.IsClassExpression(tx.currentClassContainer)
 * }
 */
export declare function classFieldsTransformer_requiresBlockScopedVar(receiver: GoPtr<classFieldsTransformer>): bool;
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
export declare function classFieldsTransformer_classExpressionNeedsBlockScopedTemp(receiver: GoPtr<classFieldsTransformer>): bool;
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
export declare function classFieldsTransformer_visitSourceFile(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<SourceFileNode>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitModifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_pushNode(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.popNode","kind":"method","status":"implemented","sigHash":"4b93101e438bcd0b71c79289109c7792efb1d65a728e801af9ecd480343620f1","bodyHash":"3c41bca9a5ab80ad540ed81aa48dd8055b05378d6d6fab349b530de5a31ddb39"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export declare function classFieldsTransformer_popNode(receiver: GoPtr<classFieldsTransformer>, grandparentNode: GoPtr<Node>): void;
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
export declare function classFieldsTransformer_visitForSubstitution(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visit(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitDiscardedValue(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitHeritageClause(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitDestructuringAssignmentTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitClassElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitPropertyName(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<PropertyName>): GoPtr<PropertyName>;
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
export declare function classFieldsTransformer_visitAccessorFieldResult(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitIdentifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Identifier>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformPrivateIdentifierInInExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitPropertyAssignment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAssignment>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitVariableStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitVariableDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<VariableDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitParameterDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ParameterDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitBindingElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BindingElement>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitExportAssignment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExportAssignment>): GoPtr<Node>;
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
export declare function classFieldsTransformer_injectPendingExpressions(receiver: GoPtr<classFieldsTransformer>, expression: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_visitComputedPropertyName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ComputedPropertyName>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitConstructorDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_shouldTransformClassElementToWeakMap(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.shouldAlwaysTransformPrivateStaticElements","kind":"method","status":"implemented","sigHash":"c885b7a3f4f92c49a3d7c7f1b8389309be20bbae1c8a394af2276317400f9f9d","bodyHash":"f2e5fd36c6fb7307f423ed65c4acec7e654a5e91d9789db941b8ac59667f1c14"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) shouldAlwaysTransformPrivateStaticElements(node *ast.Node) bool {
 * 	return ast.HasStaticModifier(node) && tx.EmitContext().EmitFlags(node)&printer.EFTransformPrivateStaticElements != 0
 * }
 */
export declare function classFieldsTransformer_shouldAlwaysTransformPrivateStaticElements(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.nodeHasTransformPrivateStaticElementsFlag","kind":"method","status":"implemented","sigHash":"f916ecc002667b745fb1c040508bac56f1b9ebec10ed8e302e068f5d78ce0863","bodyHash":"d8daf44f7a30eb5069949d93908b3a1dcbccf4850f536e878c418cc1a5f52234"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) nodeHasTransformPrivateStaticElementsFlag(node *ast.Node) bool {
 * 	return tx.EmitContext().EmitFlags(node)&printer.EFTransformPrivateStaticElements != 0
 * }
 */
export declare function classFieldsTransformer_nodeHasTransformPrivateStaticElementsFlag(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool;
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
export declare function classFieldsTransformer_visitMethodOrAccessorDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.extractNonStaticNonAccessorModifiers","kind":"method","status":"implemented","sigHash":"a263a20d94302bb4cb65c3cb51e85d612c77fc05e5ad1ba953ce80bcb5cd6109","bodyHash":"2a5103e4e69fb6dd4380303320cc54f0a46de87ff543d89cd560567b5aa53f1b"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) extractNonStaticNonAccessorModifiers(node *ast.Node) *ast.ModifierList {
 * 	return transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), ^(ast.ModifierFlagsStatic | ast.ModifierFlagsAccessor))
 * }
 */
export declare function classFieldsTransformer_extractNonStaticNonAccessorModifiers(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<ModifierList>;
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
export declare function classFieldsTransformer_setCurrentClassElementAnd(receiver: GoPtr<classFieldsTransformer>, classElement: GoPtr<ClassElement>, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitEachChildOfNode","kind":"method","status":"implemented","sigHash":"ddd06906b2d6f4fff4177885dff192cc5e9268e133f26c28e7f1c9a9f3b70bc1","bodyHash":"40d132e569eea723c0e35a29c2b0840e38369559b55d0cd0eefdbdae1c614b4e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitEachChildOfNode(node *ast.Node) *ast.Node {
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function classFieldsTransformer_visitEachChildOfNode(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_setInIterationStatementAnd(receiver: GoPtr<classFieldsTransformer>, inIteration: bool, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>) => GoPtr<Node>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.clearClassElementAndVisitEachChild","kind":"method","status":"implemented","sigHash":"9da13706e0bc5e005ee7fdab73c42638b19796b66661e2ea8ebdc49726073f68","bodyHash":"4299d998d37f5cc42e6612dceacf173b174b8b8090c7ece2a7a81c4cc9b1b5c3"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) clearClassElementAndVisitEachChild(node *ast.Node) *ast.Node {
 * 	return tx.setCurrentClassElementAnd(nil, (*classFieldsTransformer).visitEachChildOfNode, node)
 * }
 */
export declare function classFieldsTransformer_clearClassElementAndVisitEachChild(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitFunctionExpressionOrDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.setClassElementAndVisitEachChild","kind":"method","status":"implemented","sigHash":"d37be97835599f1ad197819c621a56255b095f006dd2c168a61225830bfdd936","bodyHash":"da50ffb6fd28adaa117400f1b3b76170e7712a7a55a1bb41a32fdc0c04a20745"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) setClassElementAndVisitEachChild(node *ast.Node) *ast.Node {
 * 	return tx.setCurrentClassElementAnd(node, (*classFieldsTransformer).visitEachChildOfNode, node)
 * }
 */
export declare function classFieldsTransformer_setClassElementAndVisitEachChild(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_getHoistedFunctionName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<IdentifierNode>;
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
export declare function classFieldsTransformer_tryGetClassThis(receiver: GoPtr<classFieldsTransformer>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_tryGetClassThisNoContainer(receiver: GoPtr<classFieldsTransformer>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_transformAutoAccessor(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformPrivateFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformPublicFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformFieldInitializer(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_shouldTransformAutoAccessorsInCurrentClass(receiver: GoPtr<classFieldsTransformer>): bool;
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
export declare function classFieldsTransformer_visitPropertyDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.createPrivateIdentifierAccess","kind":"method","status":"implemented","sigHash":"c0ed9d4236c4b262853ed316d4f13e526db753407ba9c5d6150f3770f8be2751","bodyHash":"6c8606e4c24c537abfcdc66aa9b91940c97ce37ab0bb44eed7b1b039a600dd8e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) createPrivateIdentifierAccess(info *privateIdentifierInfo, receiver *ast.Expression) *ast.Expression {
 * 	receiver = tx.Visitor().VisitNode(receiver)
 * 	return tx.createPrivateIdentifierAccessHelper(info, receiver)
 * }
 */
export declare function classFieldsTransformer_createPrivateIdentifierAccess(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_createPrivateIdentifierAccessHelper(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_visitPropertyAccessExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAccessExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitPropertyAccessExpressionForSubstitution(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyAccessExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitElementAccessExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ElementAccessExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitPreOrPostfixUnaryExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, discarded: bool): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitForStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ForStatement>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitExpressionStatement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExpressionStatement>): GoPtr<Node>;
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
export declare function classFieldsTransformer_createCopiableReceiverExpr(receiver: GoPtr<classFieldsTransformer>, receiver1: GoPtr<Expression>): [GoPtr<Expression>, GoPtr<Expression>];
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
export declare function classFieldsTransformer_visitCallExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<CallExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitTaggedTemplateExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<TaggedTemplateExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformClassStaticBlockDeclaration","kind":"method","status":"implemented","sigHash":"deb413c5f61b0065d00ee4812d843e992c576cd7fc5d30a603d42580ff5b5916","bodyHash":"408799f8fd32c4ab907422ac81da10ce3b7682a688fc8f428513f96215bf9d22"}
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
 * 		tx.EmitContext().AddEmitFlags(arrowFunction, printer.EFNoLexicalThis)
 * 		return iife
 * 	}
 * 	return nil
 * }
 */
export declare function classFieldsTransformer_transformClassStaticBlockDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_setCurrentClassElementAndVisitStatements(receiver: GoPtr<classFieldsTransformer>, classElement: GoPtr<Node>, statements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>>;
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
export declare function classFieldsTransformer_isAnonymousClassNeedingAssignedNameWorker(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<anonymousFunctionDefinition>): bool;
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
export declare function classFieldsTransformer_visitBinaryExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<BinaryExpression>, discarded: bool): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitParenthesizedExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ParenthesizedExpression>, discarded: bool): GoPtr<Node>;
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
export declare function classFieldsTransformer_createPrivateIdentifierAssignment(receiver: GoPtr<classFieldsTransformer>, info: GoPtr<privateIdentifierInfo>, receiver1: GoPtr<Expression>, right: GoPtr<Expression>, operator: Kind): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.getPrivateInstanceMethodsAndAccessors","kind":"method","status":"implemented","sigHash":"1379fbbfe28702b9abe481e4167a92a4c78191a6e0c4b876ab1cdd84eb4c7ab9","bodyHash":"ccada8cd22c15f342498d4784ed40bee19a8e51066feaea487f489dd1a6d7b55"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) getPrivateInstanceMethodsAndAccessors(node *ast.Node) []*ast.Node {
 * 	return core.Filter(node.Members(), isNonStaticMethodOrAccessorWithPrivateName)
 * }
 */
export declare function classFieldsTransformer_getPrivateInstanceMethodsAndAccessors(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoSlice<GoPtr<Node>>;
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
export declare function classFieldsTransformer_memberContainsConstructorReference(receiver: GoPtr<classFieldsTransformer>, member: GoPtr<Node>, classDecl: GoPtr<Node>): bool;
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
export declare function classFieldsTransformer_classContainsConstructorReference(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool;
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
export declare function classFieldsTransformer_getClassFacts(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): classFacts;
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
export declare function classFieldsTransformer_visitExpressionWithTypeArgumentsInHeritageClause(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ExpressionWithTypeArguments>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, visitor: (tx: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts) => GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"9aabe49d81957e5048536d912d9e0434aedc0b4b0b9400e421018173b879506f","bodyHash":"4cd39a4b60bfabf8851c46e659125b2c0ad9347c36cca994f13d5f339f14142e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	return tx.visitInNewClassLexicalEnvironment(node.AsNode(), (*classFieldsTransformer).visitClassDeclarationInNewClassLexicalEnvironment)
 * }
 */
export declare function classFieldsTransformer_visitClassDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitClassDeclarationInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"34bbf3c22a0d97057828c0da22c0930dd83c7389d7ceea1d76ba30121073909c","bodyHash":"a5850a5523792400eac7725a77f0946c40f3374a6ea5d7bda10fbab7cf2b1eb8"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	return tx.visitInNewClassLexicalEnvironment(node.AsNode(), (*classFieldsTransformer).visitClassExpressionInNewClassLexicalEnvironment)
 * }
 */
export declare function classFieldsTransformer_visitClassExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitClassExpressionInNewClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, facts: classFacts): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitClassStaticBlockDeclaration(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitThisExpression(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformClassMembers(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): [GoPtr<NodeList>, GoPtr<Expression>];
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
export declare function classFieldsTransformer_createBrandCheckWeakSetForPrivateMethods(receiver: GoPtr<classFieldsTransformer>): void;
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
export declare function classFieldsTransformer_transformConstructor(receiver: GoPtr<classFieldsTransformer>, constructor_: GoPtr<ConstructorDeclaration>, container: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_transformConstructorBodyWorker(receiver: GoPtr<classFieldsTransformer>, statementsOut: GoSlice<GoPtr<Statement>>, statementsIn: GoSlice<GoPtr<Statement>>, statementOffset: int, superPath: GoSlice<int>, superPathDepth: int, initializerStatements: GoSlice<GoPtr<Statement>>, constructor_: GoPtr<ConstructorDeclaration>): GoSlice<GoPtr<Statement>>;
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
export declare function classFieldsTransformer_transformConstructorBody(receiver: GoPtr<classFieldsTransformer>, container: GoPtr<Node>, constructor_: GoPtr<ConstructorDeclaration>, isDerivedClass: bool): GoPtr<Node>;
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
export declare function classFieldsTransformer_addPropertyOrClassStaticBlockStatements(receiver: GoPtr<classFieldsTransformer>, statements: GoSlice<GoPtr<Node>>, properties: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Node>>;
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
export declare function classFieldsTransformer_transformPropertyOrClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<Node>, receiver1: GoPtr<Expression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_generateInitializedPropertyExpressionsOrClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, propertiesOrClassStaticBlocks: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Expression>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.transformProperty","kind":"method","status":"implemented","sigHash":"f95c2f9d14ce6d9e28dab08220415f188b4e7bc7692a581a46760ce303ea7ee4","bodyHash":"68879cd56e0c201170bbeb3fbfd0e861ed0c09651253495228ae660561a0c7b6"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) transformProperty(property *ast.PropertyDeclaration, receiver *ast.Expression) *ast.Expression {
 * 	savedCurrentClassElement := tx.currentClassElement
 * 	transformed := tx.transformPropertyWorker(property, receiver)
 * 	if transformed != nil && ast.HasStaticModifier(property.AsNode()) {
 * 		tx.EmitContext().AddEmitFlags(transformed, printer.EFNoLexicalThis)
 * 	}
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
export declare function classFieldsTransformer_transformProperty(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<PropertyDeclaration>, receiver1: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_transformPropertyWorker(receiver: GoPtr<classFieldsTransformer>, property: GoPtr<PropertyDeclaration>, receiver1: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_addInstanceMethodStatements(receiver: GoPtr<classFieldsTransformer>, statements: GoSlice<GoPtr<Statement>>, methods: GoSlice<GoPtr<Node>>, receiver1: GoPtr<Expression>): GoSlice<GoPtr<Statement>>;
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
export declare function classFieldsTransformer_visitInvalidSuperProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_getPropertyNameExpressionIfNeeded(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<PropertyName>, shouldHoist: bool): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.startClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"b37f9fd33b2974d105218157774e7f75e72ae21b8ede073febe59fdcdd75bda4","bodyHash":"eb5123f2ee01fe9ff743f8556abdf8bf811d8c1e3969ce8cc0b8e68fbd9a835e"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) startClassLexicalEnvironment() {
 * 	tx.lexicalEnvironment = &classLexicalEnv{previous: tx.lexicalEnvironment}
 * }
 */
export declare function classFieldsTransformer_startClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.endClassLexicalEnvironment","kind":"method","status":"implemented","sigHash":"cee8366cf6522da93bbfc2f80a06d463d0ab40f00053faa243d82df101871243","bodyHash":"27bf9ca4b494d6d217d21b9a96bd490f8be79663e8f13762501359cc41600062"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) endClassLexicalEnvironment() {
 * 	tx.lexicalEnvironment = tx.lexicalEnvironment.previous
 * }
 */
export declare function classFieldsTransformer_endClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): void;
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
export declare function classFieldsTransformer_getClassLexicalEnvironment(receiver: GoPtr<classFieldsTransformer>): GoPtr<classLexicalEnvironment>;
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
export declare function classFieldsTransformer_getPrivateIdentifierEnvironment(receiver: GoPtr<classFieldsTransformer>): GoPtr<privateEnvironment>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.addPendingExpressions","kind":"method","status":"implemented","sigHash":"2ed367c4eedc17df21d1f72a03a7736adc80097d13552ed32e9c20b63c1ffe09","bodyHash":"22d13831bf5229304326acbb20a1379575ebe3d3d3e212a07252199c3ca56292"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) addPendingExpressions(exprs ...*ast.Expression) {
 * 	tx.pendingExpressions = append(tx.pendingExpressions, exprs...)
 * }
 */
export declare function classFieldsTransformer_addPendingExpressions(receiver: GoPtr<classFieldsTransformer>, ...exprs: Array<GoPtr<Expression>>): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierPropertyDeclarationToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, name: GoPtr<Node>): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierMethodToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierGetAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool, previousInfo: GoPtr<privateIdentifierInfo>): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierSetAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool, previousInfo: GoPtr<privateIdentifierInfo>): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierAutoAccessorToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, name: GoPtr<Node>, lex: GoPtr<classLexicalEnvironment>, env: GoPtr<privateEnvironment>, isStatic: bool, isValid: bool): void;
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
export declare function classFieldsTransformer_addPrivateIdentifierToEnvironment(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): void;
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
export declare function classFieldsTransformer_setPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, env: GoPtr<privateEnvironment>, name: GoPtr<Node>, info: GoPtr<privateIdentifierInfo>): void;
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
export declare function classFieldsTransformer_getPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, env: GoPtr<privateEnvironment>, name: GoPtr<Node>): [GoPtr<privateIdentifierInfo>, bool];
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
export declare function classFieldsTransformer_createHoistedVariableForClass(receiver: GoPtr<classFieldsTransformer>, nameText: string, node: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode>;
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
export declare function classFieldsTransformer_createHoistedVariableForClassFromNode(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode>;
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
export declare function classFieldsTransformer_createHoistedVariableForPrivateName(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>, suffix: string): GoPtr<IdentifierNode>;
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
export declare function classFieldsTransformer_accessPrivateIdentifier(receiver: GoPtr<classFieldsTransformer>, name: GoPtr<Node>): GoPtr<privateIdentifierInfo>;
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
export declare function classFieldsTransformer_wrapPrivateIdentifierForDestructuringTarget(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentRestElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitArrayAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitShorthandAssignmentProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentRestProperty(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitObjectAssignmentElement(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function classFieldsTransformer_visitAssignmentPattern(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function createPrivateStaticFieldInitializer(factory: GoPtr<NodeFactory>, variableName: GoPtr<IdentifierNode>, initializer: GoPtr<Expression>): GoPtr<Expression>;
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
export declare function createPrivateInstanceFieldInitializer(factory: GoPtr<NodeFactory>, receiver: GoPtr<Expression>, initializer: GoPtr<Expression>, weakMapName: GoPtr<IdentifierNode>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::createPrivateInstanceMethodInitializer","kind":"func","status":"implemented","sigHash":"3280f47431f8029334d4d32ecede83f56824c3df3ba0d49d71c526d49756906a","bodyHash":"be5dc753463c208ecc03d2c72e77f7974f2a8dfcb73721bab4b44558af0e6b32"}
 *
 * Go source:
 * func createPrivateInstanceMethodInitializer(factory *printer.NodeFactory, receiver *ast.Expression, weakSetName *ast.IdentifierNode) *ast.Expression {
 * 	return factory.NewMethodCall(weakSetName, factory.NewIdentifier("add"), []*ast.Node{receiver})
 * }
 */
export declare function createPrivateInstanceMethodInitializer(factory: GoPtr<NodeFactory>, receiver: GoPtr<Expression>, weakSetName: GoPtr<IdentifierNode>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::method::classFieldsTransformer.isReservedPrivateName","kind":"method","status":"implemented","sigHash":"3c2f5c7c569643aa4d7124384da0036a28d71fc1779cd1017708900b4d9548ca","bodyHash":"f7f750a30824bab1de585ac8ac272f0096f812a5d57a955b3ac984948de50b29"}
 *
 * Go source:
 * func (tx *classFieldsTransformer) isReservedPrivateName(node *ast.Node) bool {
 * 	return !(ast.IsPrivateIdentifier(node) && tx.EmitContext().HasAutoGenerateInfo(node)) && node.Text() == "#constructor"
 * }
 */
export declare function classFieldsTransformer_isReservedPrivateName(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classfields.go::func::isStaticPropertyDeclarationOrClassStaticBlock","kind":"func","status":"implemented","sigHash":"a58905c820ad01523c2302b8dd0187c01bef3aeaf415e04554c6474e3f90d385","bodyHash":"7985f81fa9aaa69f5614d3bef8c54d8e4ed5a9e9b096e1694decc7ccd0a5680e"}
 *
 * Go source:
 * func isStaticPropertyDeclarationOrClassStaticBlock(node *ast.Node) bool {
 * 	return ast.IsClassStaticBlockDeclaration(node) ||
 * 		(ast.IsPropertyDeclaration(node) && ast.HasStaticModifier(node))
 * }
 */
export declare function isStaticPropertyDeclarationOrClassStaticBlock(node: GoPtr<Node>): bool;
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
export declare function classFieldsTransformer_getProperties(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>, requireInitializer: bool, isStatic: bool): GoSlice<GoPtr<Node>>;
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
export declare function classFieldsTransformer_getStaticPropertiesAndClassStaticBlock(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): GoSlice<GoPtr<Node>>;
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
export declare function classHasClassThisAssignment(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool;
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
export declare function isNonStaticMethodOrAccessorWithPrivateName(member: GoPtr<Node>): bool;
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
export declare function createMemberAccessForPropertyName(factory: GoPtr<NodeFactory>, emitContext: GoPtr<EmitContext>, receiver: GoPtr<Expression>, name: GoPtr<PropertyName>, location: GoPtr<PropertyName>): GoPtr<Expression>;
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
export declare function classFieldsTransformer_createCallBinding(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<Node>): [GoPtr<Expression>, GoPtr<Expression>];
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
export declare function shouldBeCapturedInTempVariable(node: GoPtr<Node>): bool;
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
export declare function classFieldsTransformer_createAccessorPropertyGetRedirector(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, receiver1: GoPtr<Expression>): GoPtr<Node>;
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
export declare function classFieldsTransformer_createAccessorPropertySetRedirector(receiver: GoPtr<classFieldsTransformer>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, name: GoPtr<PropertyName>, receiver1: GoPtr<Expression>): GoPtr<Node>;
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
export declare function flattenCommaList(node: GoPtr<Expression>): GoSeq<GoPtr<Expression>>;
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
export declare function flattenCommaListWorker(node: GoPtr<Expression>, yield_: (arg0: GoPtr<Expression>) => bool): bool;
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
export declare function findComputedPropertyNameCacheAssignment(emitContext: GoPtr<EmitContext>, name: GoPtr<Node>): GoPtr<BinaryExpression>;
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
export declare function expandPreOrPostfixIncrementOrDecrementExpression(factory: GoPtr<NodeFactory>, emitContext: GoPtr<EmitContext>, node: GoPtr<Node>, expression: GoPtr<Expression>, resultVariable: GoPtr<IdentifierNode>): GoPtr<Expression>;
//# sourceMappingURL=classfields.d.ts.map