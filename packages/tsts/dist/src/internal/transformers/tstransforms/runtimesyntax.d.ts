import type { bool, int } from "../../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Block, ClassDeclaration, ClassExpression, ConstructorDeclaration, EnumDeclaration, EnumMember, FunctionDeclaration, ImportEqualsDeclaration, ModuleDeclaration, ParameterDeclaration, ShorthandPropertyAssignment, VariableStatement } from "../../ast/generated/data.js";
import type { BlockNode, Declaration, EnumDeclarationNode, Expression, IdentifierNode, ModuleDeclarationNode, Statement } from "../../ast/generated/unions.js";
import type { ReferenceResolver } from "../../binder/referenceresolver.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { TextRange } from "../../core/text.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::type::RuntimeSyntaxTransformer","kind":"type","status":"implemented","sigHash":"60ac09ddc0df66acaac125944f07657585e16fe81b3e057942787c81d8c958b6","bodyHash":"f6da722d67500e59af9792d655cb93c0162bf9294c6412407cbdc162733836ae"}
 *
 * Go source:
 * RuntimeSyntaxTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions                     *core.CompilerOptions
 * 	parentNode                          *ast.Node
 * 	currentNode                         *ast.Node
 * 	currentSourceFile                   *ast.Node
 * 	currentScope                        *ast.Node // SourceFile | Block | ModuleBlock | CaseBlock
 * 	currentScopeFirstDeclarationsOfName map[string]*ast.Node
 * 	currentEnum                         *ast.EnumDeclarationNode
 * 	currentNamespace                    *ast.ModuleDeclarationNode
 * 	resolver                            binder.ReferenceResolver
 * 	emitResolver                        printer.EmitResolver
 * }
 */
export interface RuntimeSyntaxTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    parentNode: GoPtr<Node>;
    currentNode: GoPtr<Node>;
    currentSourceFile: GoPtr<Node>;
    currentScope: GoPtr<Node>;
    currentScopeFirstDeclarationsOfName: GoMap<string, GoPtr<Node>> | undefined;
    currentEnum: GoPtr<EnumDeclarationNode>;
    currentNamespace: GoPtr<ModuleDeclarationNode>;
    resolver: ReferenceResolver;
    emitResolver: EmitResolver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::func::NewRuntimeSyntaxTransformer","kind":"func","status":"implemented","sigHash":"1cc789368e0941c7bdb634093c1b3fc90fde2f0bd9c033dc499ccac198be84e7","bodyHash":"98afc92f31284dee500e8df3fe7ae728710dc112b4adc6a09ac77fce38a16b23"}
 *
 * Go source:
 * func NewRuntimeSyntaxTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	tx := &RuntimeSyntaxTransformer{compilerOptions: compilerOptions, resolver: opt.Resolver, emitResolver: opt.EmitResolver}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export declare function NewRuntimeSyntaxTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.pushNode","kind":"method","status":"implemented","sigHash":"5e974924196196b4d1fc463e6f4eb7c540064d60e8cf4ed6279f50f71d76b4a8","bodyHash":"85fe77f0fb7f109d0f187d37f8bb46451c70b40a5fa8c84d879b2577c8b0b42b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export declare function RuntimeSyntaxTransformer_pushNode(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.popNode","kind":"method","status":"implemented","sigHash":"27b68af9e3e7df47b4ef3dd00a54a9fc4507c7ab1009d142064fb16b859e4c08","bodyHash":"9921ee0bb107e42ed8cc409435071f1d916c3e9efeff38a7ead02bd88076e658"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export declare function RuntimeSyntaxTransformer_popNode(receiver: GoPtr<RuntimeSyntaxTransformer>, grandparentNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.pushScope","kind":"method","status":"implemented","sigHash":"4c51990f9cfb83bebbe5076ab7d8fe377d26e87e33cd5ffa4da54a445e01c751","bodyHash":"c0f40dd82bd3674af81ee56f3ab5d11e4a37db9d4570b99840cf97ca89dba1c2"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) pushScope(node *ast.Node) (savedCurrentScope *ast.Node, savedCurrentScopeFirstDeclarationsOfName map[string]*ast.Node) {
 * 	savedCurrentScope = tx.currentScope
 * 	savedCurrentScopeFirstDeclarationsOfName = tx.currentScopeFirstDeclarationsOfName
 * 	switch node.Kind {
 * 	case ast.KindSourceFile:
 * 		tx.currentScope = node
 * 		tx.currentSourceFile = node
 * 		tx.currentScopeFirstDeclarationsOfName = nil
 * 	case ast.KindCaseBlock, ast.KindModuleBlock, ast.KindBlock:
 * 		tx.currentScope = node
 * 		tx.currentScopeFirstDeclarationsOfName = nil
 * 	case ast.KindFunctionDeclaration, ast.KindClassDeclaration, ast.KindVariableStatement:
 * 		tx.recordDeclarationInScope(node)
 * 	}
 * 	return savedCurrentScope, savedCurrentScopeFirstDeclarationsOfName
 * }
 */
export declare function RuntimeSyntaxTransformer_pushScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): [GoPtr<Node>, GoMap<string, GoPtr<Node>> | undefined];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.popScope","kind":"method","status":"implemented","sigHash":"8acef65760ec0e34a1935f4de96b09744e0fbebe4fb50b6e64b84fd495adc3f4","bodyHash":"1f0e2c72cb9ae839f5a0f5ce973e5ac95c4383358114e38587f7486744c768c9"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) popScope(savedCurrentScope *ast.Node, savedCurrentScopeFirstDeclarationsOfName map[string]*ast.Node) {
 * 	if tx.currentScope != savedCurrentScope {
 * 		// only reset the first declaration for a name if we are exiting the scope in which it was declared
 * 		tx.currentScopeFirstDeclarationsOfName = savedCurrentScopeFirstDeclarationsOfName
 * 	}
 *
 * 	tx.currentScope = savedCurrentScope
 * }
 */
export declare function RuntimeSyntaxTransformer_popScope(receiver: GoPtr<RuntimeSyntaxTransformer>, savedCurrentScope: GoPtr<Node>, savedCurrentScopeFirstDeclarationsOfName: GoMap<string, GoPtr<Node>> | undefined): void;
export declare function RuntimeSyntaxTransformer_visit(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.recordDeclarationInScope","kind":"method","status":"implemented","sigHash":"da951f097dc3ba450eab29d7acf761a1bdc115cdfaa8f679a735c878a3b42a12","bodyHash":"6761276a7300ef8df6a478933d1262475d7a2ba50c11044dad7b9ab0fc019325"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) recordDeclarationInScope(node *ast.Node) {
 * 	switch node.Kind {
 * 	case ast.KindVariableStatement:
 * 		tx.recordDeclarationInScope(node.AsVariableStatement().DeclarationList)
 * 		return
 * 	case ast.KindVariableDeclarationList:
 * 		for _, decl := range node.AsVariableDeclarationList().Declarations.Nodes {
 * 			tx.recordDeclarationInScope(decl)
 * 		}
 * 		return
 * 	case ast.KindArrayBindingPattern, ast.KindObjectBindingPattern:
 * 		for _, element := range node.Elements() {
 * 			tx.recordDeclarationInScope(element)
 * 		}
 * 		return
 * 	}
 * 	name := node.Name()
 * 	if name != nil {
 * 		if ast.IsIdentifier(name) {
 * 			if tx.currentScopeFirstDeclarationsOfName == nil {
 * 				tx.currentScopeFirstDeclarationsOfName = make(map[string]*ast.Node)
 * 			}
 * 			text := name.Text()
 * 			if _, found := tx.currentScopeFirstDeclarationsOfName[text]; !found {
 * 				tx.currentScopeFirstDeclarationsOfName[text] = node
 * 			}
 * 		} else if ast.IsBindingPattern(name) {
 * 			tx.recordDeclarationInScope(name)
 * 		}
 * 	}
 * }
 */
export declare function RuntimeSyntaxTransformer_recordDeclarationInScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.isFirstDeclarationInScope","kind":"method","status":"implemented","sigHash":"c71c04faa2206e1c77dba1fc7c7f42b0fbc1df8e416a7cac15c12fe99385c916","bodyHash":"7e1b1b24827296d59523e4d5096bba5f48d611094baa7f12434c9c3557291fef"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) isFirstDeclarationInScope(node *ast.Node) bool {
 * 	name := node.Name()
 * 	if name != nil && ast.IsIdentifier(name) {
 * 		text := name.Text()
 * 		if firstDeclaration, found := tx.currentScopeFirstDeclarationsOfName[text]; found {
 * 			return firstDeclaration == node
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function RuntimeSyntaxTransformer_isFirstDeclarationInScope(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.isExportOfNamespace","kind":"method","status":"implemented","sigHash":"6ce2b508848c6caa1a4cef3dd00fabc5b637854714d28997d44820bb4920447e","bodyHash":"d37395fc14f33734d00374d18191df80e5f271b227b81bc7bf428c9d19f401fa"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) isExportOfNamespace(node *ast.Node) bool {
 * 	return tx.currentNamespace != nil && (tx.currentScope == nil || tx.currentScope.Kind != ast.KindBlock) && node.ModifierFlags()&ast.ModifierFlagsExport != 0
 * }
 */
export declare function RuntimeSyntaxTransformer_isExportOfNamespace(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getExpressionForPropertyName","kind":"method","status":"implemented","sigHash":"41451935600ecf5749958b1064e1db8ded522d35455a9fa3beb39c499a86b27f","bodyHash":"45333105a192f181509aa8db5e26c4b81782a6eac22a075d95c139f15451b815"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getExpressionForPropertyName(member *ast.EnumMember) *ast.Expression {
 * 	name := member.Name()
 * 	switch name.Kind {
 * 	case ast.KindPrivateIdentifier:
 * 		return tx.Factory().NewIdentifier("")
 * 	case ast.KindComputedPropertyName:
 * 		n := name.AsComputedPropertyName()
 * 		// enums don't support computed properties so we always generate the 'expression' part of the name as-is.
 * 		return tx.Visitor().VisitNode(n.Expression)
 * 	case ast.KindIdentifier:
 * 		return tx.Factory().NewStringLiteral(name.Text(), ast.TokenFlagsNone)
 * 	case ast.KindStringLiteral: // !!! propagate token flags (will produce new diffs)
 * 		return tx.Factory().NewStringLiteral(name.Text(), ast.TokenFlagsNone)
 * 	case ast.KindNumericLiteral:
 * 		return tx.Factory().NewNumericLiteral(name.Text(), ast.TokenFlagsNone)
 * 	default:
 * 		return name
 * 	}
 * }
 */
export declare function RuntimeSyntaxTransformer_getExpressionForPropertyName(receiver: GoPtr<RuntimeSyntaxTransformer>, member: GoPtr<EnumMember>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getEnumQualifiedElement","kind":"method","status":"implemented","sigHash":"3d68a47b415e537ce4dccf0309e306798c22280432c56090ecad5aafd7565ebb","bodyHash":"bb955f25a88d1af02b27d71dde2e640c34fa30f7fb45f70bab65a15808f36784"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getEnumQualifiedElement(enum *ast.EnumDeclaration, member *ast.EnumMember) *ast.Expression {
 * 	prop := tx.getNamespaceQualifiedElement(tx.getNamespaceContainerName(enum.AsNode()), tx.getExpressionForPropertyName(member))
 * 	tx.EmitContext().AddEmitFlags(prop, printer.EFNoComments|printer.EFNoNestedComments|printer.EFNoSourceMap|printer.EFNoNestedSourceMaps)
 * 	return prop
 * }
 */
export declare function RuntimeSyntaxTransformer_getEnumQualifiedElement(receiver: GoPtr<RuntimeSyntaxTransformer>, enum_: GoPtr<EnumDeclaration>, member: GoPtr<EnumMember>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceContainerName","kind":"method","status":"implemented","sigHash":"478418459bc97c77125611b406fe3f281b88b70f1e001776e5b059bc0064dc93","bodyHash":"29c6100d8e3392aced576c3ec85ae2563a0d712582a4fc60530081b3358ee303"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceContainerName(node *ast.Node) *ast.IdentifierNode {
 * 	return tx.Factory().NewGeneratedNameForNode(node)
 * }
 */
export declare function RuntimeSyntaxTransformer_getNamespaceContainerName(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Node>): GoPtr<IdentifierNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceQualifiedProperty","kind":"method","status":"implemented","sigHash":"8be9f2b71224478f8c4faa5a145cdca6b268e1e5929c214f679c17e179622047","bodyHash":"058fc6e26bfd3ed9154e29f9f83e7194b7eea7a5092151085cce2aa89c111985"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceQualifiedProperty(ns *ast.IdentifierNode, name *ast.IdentifierNode) *ast.Expression {
 * 	return tx.Factory().GetNamespaceMemberName(ns, name, printer.NameOptions{AllowSourceMaps: true})
 * }
 */
export declare function RuntimeSyntaxTransformer_getNamespaceQualifiedProperty(receiver: GoPtr<RuntimeSyntaxTransformer>, ns: GoPtr<IdentifierNode>, name: GoPtr<IdentifierNode>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getNamespaceQualifiedElement","kind":"method","status":"implemented","sigHash":"9fe8b96265d350072ba317a7024aae00e1ed9bbbfa0709e638f1fe90c3543e29","bodyHash":"4a8576e5e90c6757e27720f73759ee1ea2bc0e4b1aa5f9ea830590812c3336a8"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getNamespaceQualifiedElement(ns *ast.IdentifierNode, expression *ast.Expression) *ast.Expression {
 * 	qualifiedName := tx.EmitContext().Factory.NewElementAccessExpression(ns, nil /*questionDotToken* /, expression, ast.NodeFlagsNone)
 * 	tx.EmitContext().AssignCommentAndSourceMapRanges(qualifiedName, expression)
 * 	return qualifiedName
 * }
 */
export declare function RuntimeSyntaxTransformer_getNamespaceQualifiedElement(receiver: GoPtr<RuntimeSyntaxTransformer>, ns: GoPtr<IdentifierNode>, expression: GoPtr<Expression>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getExportQualifiedReferenceToDeclaration","kind":"method","status":"implemented","sigHash":"0dbbde6258f4a8411c79d8d4f8b252a33ac5541f499507cca6e8efe65bf2ed4f","bodyHash":"9ac2d31ccba0d8cebe3d0313265d7bf8fd25979b17d404ededeb0eb8b5d15192"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getExportQualifiedReferenceToDeclaration(node *ast.Declaration) *ast.Expression {
 * 	if tx.isExportOfNamespace(node.AsNode()) {
 * 		return tx.Factory().GetExternalModuleOrNamespaceExportName(tx.getNamespaceContainerName(tx.currentNamespace), node, false /*allowComments* /, true /*allowSourceMaps* /)
 * 	}
 * 	return tx.Factory().GetDeclarationNameEx(node.AsNode(), printer.NameOptions{AllowSourceMaps: true})
 * }
 */
export declare function RuntimeSyntaxTransformer_getExportQualifiedReferenceToDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Declaration>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.addVarForDeclaration","kind":"method","status":"implemented","sigHash":"3a3eee91d036cfaab2d3202f1450f3d5e5be1db6e07b2c4e5edd54ef6ddd3315","bodyHash":"ecf23a0b7ad1730318cc41ada6d190c7acbb0220724a6ce620e9c49c092e2a18"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) addVarForDeclaration(statements []*ast.Statement, node *ast.Declaration) ([]*ast.Statement, bool) {
 * 	tx.recordDeclarationInScope(node)
 * 	if !tx.isFirstDeclarationInScope(node) {
 * 		return statements, false
 * 	}
 *
 * 	// var name;
 * 	name := tx.Factory().GetLocalNameEx(node, printer.AssignedNameOptions{AllowSourceMaps: true})
 * 	varDecl := tx.Factory().NewVariableDeclaration(name, nil, nil, nil)
 * 	varFlags := core.IfElse(tx.currentScope == tx.currentSourceFile, ast.NodeFlagsNone, ast.NodeFlagsLet)
 * 	varDecls := tx.Factory().NewVariableDeclarationList(tx.Factory().NewNodeList([]*ast.Node{varDecl}), varFlags)
 * 	// Replicate modifierVisitor: strip decorators, TypeScript modifiers, and export when in namespace.
 * 	modifierMask := ^(ast.ModifierFlagsTypeScriptModifier | ast.ModifierFlagsDecorator)
 * 	if tx.currentNamespace != nil {
 * 		modifierMask &^= ast.ModifierFlagsExport
 * 	}
 * 	modifiers := transformers.ExtractModifiers(tx.EmitContext(), node.Modifiers(), modifierMask)
 * 	varStatement := tx.Factory().NewVariableStatement(modifiers, varDecls)
 *
 * 	tx.EmitContext().SetOriginal(varDecl, node)
 * 	// !!! synthetic comments
 * 	tx.EmitContext().SetOriginal(varStatement, node)
 *
 * 	// Adjust the source map emit to match the old emitter.
 * 	if ast.IsEnumDeclaration(node) {
 * 		tx.EmitContext().SetSourceMapRange(varDecls, node.Loc)
 * 	} else {
 * 		tx.EmitContext().SetSourceMapRange(varStatement, node.Loc)
 * 	}
 *
 * 	tx.EmitContext().SetCommentRange(varStatement, node.Loc)
 * 	tx.EmitContext().AddEmitFlags(varStatement, printer.EFNoTrailingComments)
 * 	statements = append(statements, varStatement)
 *
 * 	return statements, true
 * }
 */
export declare function RuntimeSyntaxTransformer_addVarForDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, statements: GoSlice<GoPtr<Statement>>, node: GoPtr<Declaration>): [GoSlice<GoPtr<Statement>>, bool];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitEnumDeclaration","kind":"method","status":"implemented","sigHash":"fd11e7f151ea4867cb66fae4d5210c2eaa84fbccc469bf2673d990ee4d083c57","bodyHash":"290f9137965949f757d506fdb5b9c46881c7ddd4b0c860cb5bc2d5c8ee1e5c6a"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitEnumDeclaration(node *ast.EnumDeclaration) *ast.Node {
 * 	if !tx.shouldEmitEnumDeclaration(node) {
 * 		return tx.EmitContext().NewNotEmittedStatement(node.AsNode())
 * 	}
 *
 * 	statements := []*ast.Statement{}
 * 	statements, varAdded := tx.addVarForDeclaration(statements, node.AsNode())
 * 	emitFlags := printer.EFNone
 * 	if varAdded && (tx.compilerOptions.GetEmitModuleKind() != core.ModuleKindSystem || tx.currentScope != tx.currentSourceFile) {
 * 		emitFlags |= printer.EFNoLeadingComments
 * 	}
 * 	enumArg := tx.Factory().NewLogicalORExpression(...)
 * 	...
 * 	return tx.Factory().NewSyntaxList(append(statements, enumStatement))
 * }
 */
export declare function RuntimeSyntaxTransformer_visitEnumDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformEnumBody","kind":"method","status":"implemented","sigHash":"9fef6ae9d34c97a4043a9ffd682b3f1a94b4af5227c0ae8d211228ad7644dfd0","bodyHash":"e5fe96ef2e1d4660802ae3666ce18a070cc3af4b68ee9eb78e8112a0e99cf52b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformEnumBody(node *ast.EnumDeclaration) *ast.BlockNode {
 * 	savedCurrentEnum := tx.currentEnum
 * 	tx.currentEnum = node.AsNode()
 * 	node = tx.Visitor().VisitEachChild(node.AsNode()).AsEnumDeclaration()
 * 	...
 * 	return tx.Factory().NewBlock(statementList, true /*multiline* /)
 * }
 */
export declare function RuntimeSyntaxTransformer_transformEnumBody(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): GoPtr<BlockNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformEnumMember","kind":"method","status":"implemented","sigHash":"4fd24669997aaec2c65b694a1c2450f4c2ef8a83b517ca7cef4bcdffae1186a0","bodyHash":"b83e04cc22e0772053ae1e55d8c88b2f578c02c27becaa4d0fb1150b588639d8"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformEnumMember(statements []*ast.Statement, enum *ast.EnumDeclaration, index int) []*ast.Statement {
 * 	... (depends on getExpressionForPropertyName which is blocked on Node.Text/Visitor)
 * }
 */
export declare function RuntimeSyntaxTransformer_transformEnumMember(receiver: GoPtr<RuntimeSyntaxTransformer>, statements: GoSlice<GoPtr<Statement>>, enum_: GoPtr<EnumDeclaration>, index: int): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitModuleDeclaration","kind":"method","status":"implemented","sigHash":"41dcfe9d138ac07c2622eebf7c4774501777738dfe9f45eabaf372de70e8228e","bodyHash":"e34226ccf3c5cc637b6f6b2c47d9c253a45efc8c06daef8668980fd35073d59d"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitModuleDeclaration(node *ast.ModuleDeclaration) *ast.Node {
 * 	... (depends on transformModuleBody which is blocked on Visitor)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitModuleDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformModuleBody","kind":"method","status":"implemented","sigHash":"49dd4d5a8be1fd451738b376bbd3e3d0c5a4e02ea98c7c6c89aa6f32a377bf4c","bodyHash":"80ff4703f8d2ec7ca921c6be9dfc6a05614ab0204b03cf01f73047278eccaaec"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformModuleBody(node *ast.ModuleDeclaration, namespaceLocalName *ast.IdentifierNode) *ast.BlockNode {
 * 	... (uses tx.Visitor().VisitEachChild / VisitSlice)
 * }
 */
export declare function RuntimeSyntaxTransformer_transformModuleBody(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>, namespaceLocalName: GoPtr<IdentifierNode>): GoPtr<BlockNode>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitImportEqualsDeclaration","kind":"method","status":"implemented","sigHash":"e362299bbc7fabda2e4503f90ffd3eca5122c7509dd0d47829a0d0f0f175f814","bodyHash":"ee8292060e5ef2fae90c8c8c59c96f5594f4d90f304ac5b88b0f702767438813"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitImportEqualsDeclaration(node *ast.ImportEqualsDeclaration) *ast.Node {
 * 	... (uses tx.Visitor().VisitEachChild)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitImportEqualsDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ImportEqualsDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitVariableStatement","kind":"method","status":"implemented","sigHash":"f9ebe80593846a36ebf6eef57eda6731f1b4a59ed38ba2d27bcecffb256a6130","bodyHash":"afd578072c77f975963dc6f56639024a580ad498c2e773915df691fdcdfaa14b"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitVariableStatement(node *ast.VariableStatement) *ast.Node {
 * 	... (uses tx.Visitor(), ast.IsBindingPattern, transformers.FlattenDestructuringAssignment)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitVariableStatement(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<VariableStatement>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createNamespaceExportExpression","kind":"method","status":"implemented","sigHash":"800271c45d40f398b922db380c69904ab928d959a9940bae3259cc6fb3ca42c9","bodyHash":"172254f1b5981ea71c1d4f54c5ebe7a82d41b4182f0c2162caa9443a119b8d66"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createNamespaceExportExpression(exportName *ast.IdentifierNode, exportValue *ast.Expression, location *core.TextRange) *ast.Expression {
 * 	memberName := tx.getNamespaceQualifiedProperty(tx.getNamespaceContainerName(tx.currentNamespace), exportName)
 * 	expression := tx.Factory().NewAssignmentExpression(memberName, exportValue)
 * 	if location != nil {
 * 		expression.Loc = *location
 * 	}
 * 	return expression
 * }
 */
export declare function RuntimeSyntaxTransformer_createNamespaceExportExpression(receiver: GoPtr<RuntimeSyntaxTransformer>, exportName: GoPtr<IdentifierNode>, exportValue: GoPtr<Expression>, location: GoPtr<TextRange>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitFunctionDeclaration","kind":"method","status":"implemented","sigHash":"a61907da3eb16cd8b124d8d4d3f3344f75a85082e798eb8fe2458bb9a8357582","bodyHash":"a26cf92cd525abd41b406a0d088469a9e64243c7d24a94c19b4d3c6c7c0e41de"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitFunctionDeclaration(node *ast.FunctionDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateFunctionDeclaration)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitFunctionDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<FunctionDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.getParameterProperties","kind":"method","status":"implemented","sigHash":"9f55290e5e1fb208e367288c3432369b4c7a5d608d1e2778b8b5feb679f40bfc","bodyHash":"fc07721c009c186d6687e3166187ee396555f452380a445f93c57138bb68ce42"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) getParameterProperties(constructor *ast.Node) []*ast.ParameterDeclaration {
 * 	... (uses constructor.Parameters(), ast.IsParameterPropertyDeclaration)
 * }
 */
export declare function RuntimeSyntaxTransformer_getParameterProperties(receiver: GoPtr<RuntimeSyntaxTransformer>, constructor_: GoPtr<Node>): GoSlice<GoPtr<ParameterDeclaration>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitClassDeclaration","kind":"method","status":"implemented","sigHash":"fa3cb6d45c2c5202e35670a1a37c567b575e6f4b27e87c1204d5b5bea2261779","bodyHash":"86c19d841897b853c3cf97070fe6717e08a2bde174d94f202cffa3b32bc12443"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitClassDeclaration(node *ast.ClassDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateClassDeclaration, getParameterProperties)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitClassDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ClassDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitClassExpression","kind":"method","status":"implemented","sigHash":"c908858ce6c414b479791ee872cae9d2a2c79b4a33581ac5e9a65dd44262c485","bodyHash":"10ce0015c7aba18818809da30c77441c78b61da8ae52636722a6e5b2cd6b7c3c"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitClassExpression(node *ast.ClassExpression) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateClassExpression)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitClassExpression(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ClassExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitConstructorDeclaration","kind":"method","status":"implemented","sigHash":"11e29e5207a46b38904dde972d9814cf46f4fe9ecadcc92011735d0e3d84486f","bodyHash":"705c6ad3d56dcb6a00fc5ac834a169ba2dc4881acc102b4bcf802c32b3e7d7d4"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitConstructorDeclaration(node *ast.ConstructorDeclaration) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateConstructorDeclaration)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitConstructorDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ConstructorDeclaration>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitConstructorBody","kind":"method","status":"implemented","sigHash":"f26e6927b04c1c762c07d2f92f7aff8a76cbe8fada048242bd6989dc0af8b873","bodyHash":"7ed7b666a1d1b7bccc6e54ee80938aedaedbc2a54457e5f00d553e1013c0abae"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitConstructorBody(body *ast.Block, constructor *ast.Node) *ast.Node {
 * 	... (uses tx.Visitor(), getParameterProperties)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitConstructorBody(receiver: GoPtr<RuntimeSyntaxTransformer>, body: GoPtr<Block>, constructor_: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.transformConstructorBodyWorker","kind":"method","status":"implemented","sigHash":"2b9c44f7506c3f56880b07642955bb17621b70cf30342bf0308ecb7f05ea8535","bodyHash":"a9fa71fb4aaf48b9ff51c626cc24ce4be2a710dafa5f0580de118dd14916568f"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) transformConstructorBodyWorker(statementsIn []*ast.Statement, superPath []int, initializerStatements []*ast.Statement) []*ast.Statement {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateTryStatement, UpdateBlock)
 * }
 */
export declare function RuntimeSyntaxTransformer_transformConstructorBodyWorker(receiver: GoPtr<RuntimeSyntaxTransformer>, statementsIn: GoSlice<GoPtr<Statement>>, superPath: GoSlice<int>, initializerStatements: GoSlice<GoPtr<Statement>>): GoSlice<GoPtr<Statement>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitShorthandPropertyAssignment","kind":"method","status":"implemented","sigHash":"d347960d42f97b5b4174736b1ca70908851b64faab2702e0fa27d7f5381ef7a3","bodyHash":"4eae69d24d1bc8c996cd9fa0166c8304e0c71c75fbace7f8054382b5acc0fb2f"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitShorthandPropertyAssignment(node *ast.ShorthandPropertyAssignment) *ast.Node {
 * 	... (uses tx.Visitor(), tx.Factory().UpdateShorthandPropertyAssignment)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitShorthandPropertyAssignment(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ShorthandPropertyAssignment>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitIdentifier","kind":"method","status":"implemented","sigHash":"5a994fe05f1934aa19109110509e906d0ac29493c07727cca00028e13edd120f","bodyHash":"5b71c89ac5f4a9a8f6cbf8299f07c2f328e19aa36a789be8c3ba23902fa6f288"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	if transformers.IsIdentifierReference(node, tx.parentNode) {
 * 		return tx.visitExpressionIdentifier(node)
 * 	}
 * 	return node
 * }
 */
export declare function RuntimeSyntaxTransformer_visitIdentifier(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.visitExpressionIdentifier","kind":"method","status":"implemented","sigHash":"2346ab7003eb8d9f9a4550a571a43dd901f31971491c4c06be5cefb3d6e0c130","bodyHash":"7d73623a1f61e98e6b179b91759d35e817ec474fdddf8cea5b4a37667436b5b5"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) visitExpressionIdentifier(node *ast.IdentifierNode) *ast.Node {
 * 	... (uses transformers.IsGeneratedIdentifier/IsLocalName, resolver.GetReferencedExportContainer)
 * }
 */
export declare function RuntimeSyntaxTransformer_visitExpressionIdentifier(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<IdentifierNode>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportStatementForDeclaration","kind":"method","status":"implemented","sigHash":"6569b0300c477a1a2ae590ff0896cf2402b90e2e508acdb0346d8e614c58398f","bodyHash":"fce4f9c5a24bd2fca4059ed77a7fb2b3a06fb392e6692eb725c52be4f8f29aba"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportStatementForDeclaration(node *ast.Declaration) *ast.Statement {
 * 	exportName := tx.Factory().GetExternalModuleOrNamespaceExportName(tx.getNamespaceContainerName(tx.currentNamespace), node, false /*allowComments* /, true /*allowSourceMaps* /)
 * 	localName := tx.Factory().GetLocalName(node)
 * 	expression := tx.Factory().NewAssignmentExpression(exportName, localName)
 * 	exportAssignmentSourceMapRange := node.Loc
 * 	if node.Name() != nil {
 * 		exportAssignmentSourceMapRange = exportAssignmentSourceMapRange.WithPos(node.Name().Pos())
 * 	}
 * 	tx.EmitContext().SetSourceMapRange(expression, exportAssignmentSourceMapRange)
 *
 * 	statement := tx.Factory().NewExpressionStatement(expression)
 * 	exportStatementSourceMapRange := node.Loc.WithPos(-1)
 * 	tx.EmitContext().SetSourceMapRange(statement, exportStatementSourceMapRange)
 * 	return statement
 * }
 */
export declare function RuntimeSyntaxTransformer_createExportStatementForDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<Declaration>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportAssignment","kind":"method","status":"implemented","sigHash":"768d5226b7bf2a60b835395f9ae82318822af9c91cf0df55eef04a0fde854e28","bodyHash":"7ba6eca9594aae8883f71a76729e3dad79e0226313c0dcc43e451f29977a2d7e"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportAssignment(name *ast.IdentifierNode, expression *ast.Expression, exportAssignmentSourceMapRange core.TextRange, original *ast.Node) *ast.Expression {
 * 	exportName := tx.getNamespaceQualifiedProperty(tx.getNamespaceContainerName(tx.currentNamespace), name)
 * 	exportAssignment := tx.Factory().NewAssignmentExpression(exportName, expression)
 * 	tx.EmitContext().SetOriginal(exportAssignment, original)
 * 	tx.EmitContext().SetSourceMapRange(exportAssignment, exportAssignmentSourceMapRange)
 * 	return exportAssignment
 * }
 */
export declare function RuntimeSyntaxTransformer_createExportAssignment(receiver: GoPtr<RuntimeSyntaxTransformer>, name: GoPtr<IdentifierNode>, expression: GoPtr<Expression>, exportAssignmentSourceMapRange: TextRange, original: GoPtr<Node>): GoPtr<Expression>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.createExportStatement","kind":"method","status":"implemented","sigHash":"0635a426ae940b5638fc0ba2c558061baee0372dd54cb0f016b8146e1f78d34a","bodyHash":"c80c8006bd88a32600a2d97123b7c81a4f770c225241da4b380168db10ba0c94"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) createExportStatement(name *ast.IdentifierNode, expression *ast.Expression, exportAssignmentSourceMapRange core.TextRange, exportStatementSourceMapRange core.TextRange, original *ast.Node) *ast.Statement {
 * 	exportStatement := tx.Factory().NewExpressionStatement(tx.createExportAssignment(name, expression, exportAssignmentSourceMapRange, original))
 * 	tx.EmitContext().SetOriginal(exportStatement, original)
 * 	tx.EmitContext().SetSourceMapRange(exportStatement, exportStatementSourceMapRange)
 * 	return exportStatement
 * }
 */
export declare function RuntimeSyntaxTransformer_createExportStatement(receiver: GoPtr<RuntimeSyntaxTransformer>, name: GoPtr<IdentifierNode>, expression: GoPtr<Expression>, exportAssignmentSourceMapRange: TextRange, exportStatementSourceMapRange: TextRange, original: GoPtr<Node>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.shouldEmitEnumDeclaration","kind":"method","status":"implemented","sigHash":"f2e278a05e2e53881e8b06d83924b6ffa6b09a33b82987a6b9f906dc2d15e5a1","bodyHash":"54fb4053c2e47f6ae2972e4b16b2035a0665bc61152fd7590aba8c02e8243fa2"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) shouldEmitEnumDeclaration(node *ast.EnumDeclaration) bool {
 * 	return !ast.IsEnumConst(node.AsNode()) || tx.compilerOptions.ShouldPreserveConstEnums()
 * }
 */
export declare function RuntimeSyntaxTransformer_shouldEmitEnumDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<EnumDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::method::RuntimeSyntaxTransformer.shouldEmitModuleDeclaration","kind":"method","status":"implemented","sigHash":"3d54a15b48048facc9354b5188f7518c8d6f75328d44acdda1f8d851572fc6dd","bodyHash":"4773aeaf083f1afcd5461fb448998677bfb05b14735e334ba4a51622e0546ab7"}
 *
 * Go source:
 * func (tx *RuntimeSyntaxTransformer) shouldEmitModuleDeclaration(node *ast.ModuleDeclaration) bool {
 * 	pn := tx.EmitContext().ParseNode(node.AsNode())
 * 	if pn == nil {
 * 		return true
 * 	}
 * 	return ast.IsInstantiatedModule(pn, tx.compilerOptions.ShouldPreserveConstEnums())
 * }
 */
export declare function RuntimeSyntaxTransformer_shouldEmitModuleDeclaration(receiver: GoPtr<RuntimeSyntaxTransformer>, node: GoPtr<ModuleDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/runtimesyntax.go::func::getInnermostModuleDeclarationFromDottedModule","kind":"func","status":"implemented","sigHash":"648742e448f5345dd98e1ed53093cdb0564351808112b98534971556113825ee","bodyHash":"dabc2f44d8b995c676926c3b6dffd9425e20ae3da73995b35d197d29de9976b5"}
 *
 * Go source:
 * func getInnermostModuleDeclarationFromDottedModule(moduleDeclaration *ast.ModuleDeclaration) *ast.ModuleDeclaration {
 * 	for moduleDeclaration.Body != nil && moduleDeclaration.Body.Kind == ast.KindModuleDeclaration {
 * 		moduleDeclaration = moduleDeclaration.Body.AsModuleDeclaration()
 * 	}
 * 	return moduleDeclaration
 * }
 */
export declare function getInnermostModuleDeclarationFromDottedModule(moduleDeclaration: GoPtr<ModuleDeclaration>): GoPtr<ModuleDeclaration>;
//# sourceMappingURL=runtimesyntax.d.ts.map