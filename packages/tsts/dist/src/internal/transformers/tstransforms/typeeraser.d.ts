import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { Statement } from "../../ast/generated/unions.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::type::TypeEraserTransformer","kind":"type","status":"implemented","sigHash":"bdb90c2faa90cf896efb0849699ba9fae98beb7beb98d285e9da5884a17f7648","bodyHash":"058402a91184c90a80f6900dde5f432284290b1838798a9284c5e90ea71e461a"}
 *
 * Go source:
 * TypeEraserTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions *core.CompilerOptions
 * 	parentNode      *ast.Node
 * 	currentNode     *ast.Node
 * }
 */
export interface TypeEraserTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    parentNode: GoPtr<Node>;
    currentNode: GoPtr<Node>;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::func::NewTypeEraserTransformer","kind":"func","status":"implemented","sigHash":"53b3e285a69881af65a2487e556bd94560651a4b3806431a557f2e6039edd82f","bodyHash":"fec9e81a116ec6aa1009585bebe43017149a3f9b82bd9e0f6dc0226784ccbb97"}
 *
 * Go source:
 * func NewTypeEraserTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	tx := &TypeEraserTransformer{compilerOptions: compilerOptions}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export declare function NewTypeEraserTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.pushNode","kind":"method","status":"implemented","sigHash":"66a52a570cf7e7f0e502f6dc1a0f30aaafd3e746b6a9972728c3d867453002ff","bodyHash":"dbf805bd336232b52ae2022d1b48bbafbbcde618e66432bcdcb6cfd766a6fb2b"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) pushNode(node *ast.Node) (grandparentNode *ast.Node) {
 * 	grandparentNode = tx.parentNode
 * 	tx.parentNode = tx.currentNode
 * 	tx.currentNode = node
 * 	return grandparentNode
 * }
 */
export declare function TypeEraserTransformer_pushNode(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.popNode","kind":"method","status":"implemented","sigHash":"8a0b52123ec70589eec9709e3fe44cbc0951e4966c6d1f57af1f41746390df9d","bodyHash":"99c5f021d2f47cc4a641b490507f7ba5fe392bf1ab01a8d264a8a30ae82261d7"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) popNode(grandparentNode *ast.Node) {
 * 	tx.currentNode = tx.parentNode
 * 	tx.parentNode = grandparentNode
 * }
 */
export declare function TypeEraserTransformer_popNode(receiver: GoPtr<TypeEraserTransformer>, grandparentNode: GoPtr<Node>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.elide","kind":"method","status":"implemented","sigHash":"d160929a2fd24ba0cb1d649dbdc7e6c185fddccb9bf4160ff303840cc7244186","bodyHash":"98fabb3a981f958fa0718753a59c97a59d3050270cdfeb79b6d5cad7bf9141a9"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) elide(node *ast.Statement) *ast.Statement {
 * 	return tx.EmitContext().NewNotEmittedStatement(node.AsNode())
 * }
 */
export declare function TypeEraserTransformer_elide(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Statement>): GoPtr<Statement>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeeraser.go::method::TypeEraserTransformer.visit","kind":"method","status":"implemented","sigHash":"4f2cad082d0fa0662cb1701ceefd0650600ea695e15609c7856edb96ec19ac05","bodyHash":"2c50095f14c9e318f3e90872ea643e4fc6093f9206679681bd9ee78a6601b45c"}
 *
 * Go source:
 * func (tx *TypeEraserTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsTypeScript == 0 {
 * 		return node
 * 	}
 *
 * 	if ast.IsStatement(node) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient) {
 * 		return tx.elide(node)
 * 	}
 *
 * 	grandparentNode := tx.pushNode(node)
 * 	defer tx.popNode(grandparentNode)
 *
 * 	switch node.Kind {
 * 	case
 * 		// TypeScript accessibility and readonly modifiers are elided
 * 		ast.KindPublicKeyword,
 * 		ast.KindPrivateKeyword,
 * 		ast.KindProtectedKeyword,
 * 		ast.KindAbstractKeyword,
 * 		ast.KindOverrideKeyword,
 * 		ast.KindConstKeyword,
 * 		ast.KindDeclareKeyword,
 * 		ast.KindReadonlyKeyword,
 * 		// TypeScript type nodes are elided.
 * 		ast.KindArrayType,
 * 		ast.KindTupleType,
 * 		ast.KindOptionalType,
 * 		ast.KindRestType,
 * 		ast.KindTypeLiteral,
 * 		ast.KindTypePredicate,
 * 		ast.KindTypeParameter,
 * 		ast.KindAnyKeyword,
 * 		ast.KindUnknownKeyword,
 * 		ast.KindBooleanKeyword,
 * 		ast.KindStringKeyword,
 * 		ast.KindNumberKeyword,
 * 		ast.KindNeverKeyword,
 * 		ast.KindVoidKeyword,
 * 		ast.KindSymbolKeyword,
 * 		ast.KindConstructorType,
 * 		ast.KindFunctionType,
 * 		ast.KindTypeQuery,
 * 		ast.KindTypeReference,
 * 		ast.KindUnionType,
 * 		ast.KindIntersectionType,
 * 		ast.KindConditionalType,
 * 		ast.KindParenthesizedType,
 * 		ast.KindThisType,
 * 		ast.KindTypeOperator,
 * 		ast.KindIndexedAccessType,
 * 		ast.KindMappedType,
 * 		ast.KindLiteralType,
 * 		// TypeScript index signatures are elided.
 * 		ast.KindIndexSignature:
 * 		return nil
 *
 * 	case ast.KindInKeyword, ast.KindOutKeyword:
 * 		// TypeScript `in`/`out` variance modifiers are elided. These keywords are only
 * 		// meaningful as modifiers on type parameters (which are themselves elided), but they may
 * 		// appear as a grammar error on other declarations and must not leak into the emitted JS.
 * 		// The `in` binary operator shares this token kind, so only elide when used as a modifier.
 * 		if tx.parentNode == nil || !ast.IsBinaryExpression(tx.parentNode) {
 * 			return nil
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 *
 * 	case ast.KindJSImportDeclaration:
 * 		// reparsed commonjs are elided
 * 		return nil
 * 	case ast.KindTypeAliasDeclaration,
 * 		ast.KindJSTypeAliasDeclaration,
 * 		ast.KindInterfaceDeclaration:
 * 		// TypeScript type-only declarations are elided.
 * 		return tx.elide(node)
 *
 * 	case ast.KindNamespaceExportDeclaration:
 * 		// TypeScript namespace export declarations are elided.
 * 		return nil
 *
 * 	case ast.KindModuleDeclaration:
 * 		if !ast.IsIdentifier(node.Name()) ||
 * 			!ast.IsInstantiatedModule(node, tx.compilerOptions.ShouldPreserveConstEnums()) ||
 * 			getInnermostModuleDeclarationFromDottedModule(node.AsModuleDeclaration()).Body == nil {
 * 			// TypeScript module declarations are elided if they are not instantiated or have no body
 * 			return tx.elide(node)
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 *
 * 	case ast.KindExpressionWithTypeArguments:
 * 		n := node.AsExpressionWithTypeArguments()
 * 		return tx.Factory().UpdateExpressionWithTypeArguments(n, tx.Visitor().VisitNode(n.Expression), nil)
 *
 * 	case ast.KindPropertyDeclaration:
 * 		if tx.compilerOptions.ExperimentalDecorators.IsTrue() && ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsAbstract) && ast.HasDecorators(node) {
 * 			// declare/abstract props with decorators must be preserved until the decorator transform can process them and remove them
 * 			n := node.AsPropertyDeclaration()
 * 			return tx.Factory().UpdatePropertyDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 		}
 * 		if ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsAbstract) {
 * 			// TypeScript `declare` fields are elided
 * 			return nil
 * 		}
 * 		n := node.AsPropertyDeclaration()
 * 		return tx.Factory().UpdatePropertyDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 *
 * 	case ast.KindConstructor:
 * 		n := node.AsConstructorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateConstructorDeclaration(n, nil, nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 *
 * 	case ast.KindMethodDeclaration:
 * 		n := node.AsMethodDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateMethodDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 *
 * 	case ast.KindGetAccessor:
 * 		n := node.AsGetAccessorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 			// Abstract accessors are elided
 * 			return nil
 * 		}
 * 		body := tx.Visitor().VisitNode(n.Body)
 * 		if body == nil {
 * 			body = tx.Factory().NewBlock(tx.Factory().NewNodeList(nil), false)
 * 		}
 * 		return tx.Factory().UpdateGetAccessorDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, body)
 *
 * 	case ast.KindSetAccessor:
 * 		n := node.AsSetAccessorDeclaration()
 * 		if ast.NodeIsMissing(n.Body) && ast.HasSyntacticModifier(node, ast.ModifierFlagsAbstract) {
 * 			// Abstract accessors are elided
 * 			return nil
 * 		}
 * 		body := tx.Visitor().VisitNode(n.Body)
 * 		if body == nil {
 * 			body = tx.Factory().NewBlock(tx.Factory().NewNodeList(nil), false)
 * 		}
 * 		return tx.Factory().UpdateSetAccessorDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, body)
 *
 * 	case ast.KindVariableDeclaration:
 * 		n := node.AsVariableDeclaration()
 * 		updated := tx.Factory().UpdateVariableDeclaration(n, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 * 		if n.Type != nil {
 * 			tx.EmitContext().SetTypeNode(updated.AsVariableDeclaration().Name(), n.Type)
 * 		}
 * 		return updated
 *
 * 	case ast.KindHeritageClause:
 * 		n := node.AsHeritageClause()
 * 		if n.Token == ast.KindImplementsKeyword {
 * 			// TypeScript `implements` clauses are elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateHeritageClause(n, n.Token, tx.Visitor().VisitNodes(n.Types))
 *
 * 	case ast.KindClassDeclaration:
 * 		n := node.AsClassDeclaration()
 * 		return tx.Factory().UpdateClassDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.HeritageClauses), tx.Visitor().VisitNodes(n.Members))
 *
 * 	case ast.KindClassExpression:
 * 		n := node.AsClassExpression()
 * 		return tx.Factory().UpdateClassExpression(n, tx.Visitor().VisitModifiers(n.Modifiers()), tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.HeritageClauses), tx.Visitor().VisitNodes(n.Members))
 *
 * 	case ast.KindFunctionDeclaration:
 * 		n := node.AsFunctionDeclaration()
 * 		if ast.NodeIsMissing(n.Body) {
 * 			// TypeScript overloads are elided
 * 			return tx.elide(node)
 * 		}
 * 		return tx.Factory().UpdateFunctionDeclaration(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 *
 * 	case ast.KindFunctionExpression:
 * 		n := node.AsFunctionExpression()
 * 		return tx.Factory().UpdateFunctionExpression(n, tx.Visitor().VisitModifiers(n.Modifiers()), n.AsteriskToken, tx.Visitor().VisitNode(n.Name()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, tx.Visitor().VisitNode(n.Body))
 *
 * 	case ast.KindArrowFunction:
 * 		n := node.AsArrowFunction()
 * 		return tx.Factory().UpdateArrowFunction(n, tx.Visitor().VisitModifiers(n.Modifiers()), nil, tx.Visitor().VisitNodes(n.Parameters), nil, nil, n.EqualsGreaterThanToken, tx.Visitor().VisitNode(n.Body))
 *
 * 	case ast.KindParameter:
 * 		if ast.IsThisParameter(node) {
 * 			// TypeScript `this` parameters are elided
 * 			return nil
 * 		}
 * 		n := node.AsParameterDeclaration()
 * 		// preserve parameter property modifiers to be handled by the runtime transformer
 * 		var modifiers *ast.ModifierList
 * 		if ast.IsParameterPropertyDeclaration(node, tx.parentNode) {
 * 			modifiers = transformers.ExtractModifiers(tx.EmitContext(), n.Modifiers(), ast.ModifierFlagsParameterPropertyModifier)
 * 		}
 * 		// preserve decorators for the decorator transforms
 * 		if ast.HasDecorators(node) {
 * 			decorators := node.Decorators()
 * 			visited, _ := tx.Visitor().VisitSlice(decorators)
 * 			if modifiers == nil {
 * 				modifiers = tx.Factory().NewModifierList(visited)
 * 			} else {
 * 				modifiers = tx.Factory().NewModifierList(slices.Concat(modifiers.Nodes, visited))
 * 			}
 * 		}
 * 		return tx.Factory().UpdateParameterDeclaration(n, modifiers, n.DotDotDotToken, tx.Visitor().VisitNode(n.Name()), nil, nil, tx.Visitor().VisitNode(n.Initializer))
 *
 * 	case ast.KindCallExpression:
 * 		n := node.AsCallExpression()
 * 		return tx.Factory().UpdateCallExpression(n, tx.Visitor().VisitNode(n.Expression), n.QuestionDotToken, nil, tx.Visitor().VisitNodes(n.Arguments), n.Flags)
 *
 * 	case ast.KindNewExpression:
 * 		n := node.AsNewExpression()
 * 		return tx.Factory().UpdateNewExpression(n, tx.Visitor().VisitNode(n.Expression), nil, tx.Visitor().VisitNodes(n.Arguments))
 *
 * 	case ast.KindTaggedTemplateExpression:
 * 		n := node.AsTaggedTemplateExpression()
 * 		return tx.Factory().UpdateTaggedTemplateExpression(n, tx.Visitor().VisitNode(n.Tag), n.QuestionDotToken, nil, tx.Visitor().VisitNode(n.Template), n.Flags)
 *
 * 	case ast.KindNonNullExpression, ast.KindTypeAssertionExpression, ast.KindAsExpression, ast.KindSatisfiesExpression:
 * 		partial := tx.Factory().NewPartiallyEmittedExpression(tx.Visitor().VisitNode(node.Expression()))
 * 		tx.EmitContext().SetOriginal(partial, node)
 * 		partial.Loc = node.Loc
 * 		return partial
 *
 * 	case ast.KindParenthesizedExpression:
 * 		if !ast.IsJSDocTypeAssertion(node) {
 * 			n := node.AsParenthesizedExpression()
 * 			expression := ast.SkipOuterExpressions(n.Expression, ^(ast.OEKAssertions | ast.OEKExpressionsWithTypeArguments))
 * 			if ast.IsAssertionExpression(expression) || ast.IsSatisfiesExpression(expression) {
 * 				partial := tx.Factory().NewPartiallyEmittedExpression(tx.Visitor().VisitNode(n.Expression))
 * 				tx.EmitContext().SetOriginal(partial, node)
 * 				partial.Loc = node.Loc
 * 				return partial
 * 			}
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 *
 * 	case ast.KindJsxSelfClosingElement:
 * 		n := node.AsJsxSelfClosingElement()
 * 		return tx.Factory().UpdateJsxSelfClosingElement(n, tx.Visitor().VisitNode(n.TagName), nil, tx.Visitor().VisitNode(n.Attributes))
 *
 * 	case ast.KindJsxOpeningElement:
 * 		n := node.AsJsxOpeningElement()
 * 		return tx.Factory().UpdateJsxOpeningElement(n, tx.Visitor().VisitNode(n.TagName), nil, tx.Visitor().VisitNode(n.Attributes))
 *
 * 	case ast.KindImportEqualsDeclaration:
 * 		n := node.AsImportEqualsDeclaration()
 * 		if n.IsTypeOnly {
 * 			// elide type-only imports
 * 			return nil
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 *
 * 	case ast.KindImportDeclaration:
 * 		n := node.AsImportDeclaration()
 * 		if n.ImportClause == nil {
 * 			// Do not elide a side-effect only import declaration.
 * 			//  import "foo";
 * 			return node
 * 		}
 * 		importClause := tx.Visitor().VisitNode(n.ImportClause)
 * 		if importClause == nil {
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportDeclaration(n, n.Modifiers(), importClause, n.ModuleSpecifier, n.Attributes)
 *
 * 	case ast.KindImportClause:
 * 		n := node.AsImportClause()
 * 		if n.IsTypeOnly() {
 * 			// Always elide type-only imports
 * 			return nil
 * 		}
 * 		name := n.Name()
 * 		namedBindings := tx.Visitor().VisitNode(n.NamedBindings)
 * 		if name == nil && namedBindings == nil {
 * 			// all import bindings were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateImportClause(n, n.PhaseModifier, name, namedBindings)
 *
 * 	case ast.KindNamedImports:
 * 		n := node.AsNamedImports()
 * 		if len(n.Elements.Nodes) == 0 {
 * 			// Do not elide a side-effect only import declaration.
 * 			return node
 * 		}
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if !tx.compilerOptions.VerbatimModuleSyntax.IsTrue() && len(elements.Nodes) == 0 {
 * 			// all import specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedImports(n, elements)
 *
 * 	case ast.KindImportSpecifier:
 * 		n := node.AsImportSpecifier()
 * 		if n.IsTypeOnly {
 * 			// elide type-only or unused imports
 * 			return nil
 * 		}
 * 		return node
 *
 * 	case ast.KindExportDeclaration:
 * 		n := node.AsExportDeclaration()
 * 		if n.IsTypeOnly {
 * 			// elide type-only exports
 * 			return nil
 * 		}
 * 		var exportClause *ast.Node
 * 		if n.ExportClause != nil {
 * 			exportClause = tx.Visitor().VisitNode(n.ExportClause)
 * 			if exportClause == nil {
 * 				// all export bindings were elided
 * 				return nil
 * 			}
 * 		}
 * 		return tx.Factory().UpdateExportDeclaration(n, nil /*modifiers* /, false /*isTypeOnly* /, exportClause, tx.Visitor().VisitNode(n.ModuleSpecifier), tx.Visitor().VisitNode(n.Attributes))
 *
 * 	case ast.KindNamedExports:
 * 		n := node.AsNamedExports()
 * 		if len(n.Elements.Nodes) == 0 {
 * 			// Do not elide an empty export declaration.
 * 			return node
 * 		}
 *
 * 		elements := tx.Visitor().VisitNodes(n.Elements)
 * 		if !tx.compilerOptions.VerbatimModuleSyntax.IsTrue() && len(elements.Nodes) == 0 {
 * 			// all export specifiers were elided
 * 			return nil
 * 		}
 * 		return tx.Factory().UpdateNamedExports(n, elements)
 *
 * 	case ast.KindExportSpecifier:
 * 		n := node.AsExportSpecifier()
 * 		if n.IsTypeOnly {
 * 			// elide unused export
 * 			return nil
 * 		}
 * 		return node
 *
 * 	case ast.KindEnumDeclaration:
 * 		if ast.IsEnumConst(node) {
 * 			return node
 * 		}
 * 		return tx.Visitor().VisitEachChild(node)
 *
 * 	default:
 * 		return tx.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export declare function TypeEraserTransformer_visit(receiver: GoPtr<TypeEraserTransformer>, node: GoPtr<Node>): GoPtr<Node>;
//# sourceMappingURL=typeeraser.d.ts.map