import type { bool, int } from "../../go/scalars.js";
import type { GoPtr } from "../../go/compat.js";
import type { SourceFile } from "../ast/ast.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { BigIntLiteral, BindingElement, ConstructorDeclaration, Decorator, ExportDeclaration, ForInOrOfStatement, HeritageClause, ImportClause, IndexSignatureDeclaration, InterfaceDeclaration, JsxExpression, MappedTypeNode, MetaProperty, NumericLiteral, ObjectLiteralExpression, PrivateIdentifier, RegularExpressionLiteral, TaggedTemplateExpression, TypeOperatorNode, VariableDeclaration, VariableDeclarationList, VariableStatement } from "../ast/generated/data.js";
import type { Kind } from "../ast/generated/kinds.js";
import type { AccessorDeclaration, ClassLikeDeclaration, DeclarationName, Expression, JsxTagNameExpression, Statement, TokenNode } from "../ast/generated/unions.js";
import type { Message } from "../diagnostics/diagnostics.js";
import type { Checker } from "./checker/state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnFirstToken","kind":"method","status":"implemented","sigHash":"9fab30665e440946aaaa3690f3b401ad23c823e57bb21da03bf92c49f43e9680","bodyHash":"142efb60e8b3a9257a937d0286695747aab58d7ed2ce3ce7538c4a22b21c9e7f"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnFirstToken(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		span := scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 		c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, message, args...))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_grammarErrorOnFirstToken(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorAtPos","kind":"method","status":"implemented","sigHash":"8b49203060ee9b54ed6bbb3f858296d437cd8203a72d494dfc10f2d805cb959d","bodyHash":"59cc0362e260ec4f12e2dca742d871b7351d3bd98c1fbbe8ee4e013d1149027c"}
 *
 * Go source:
 * func (c *Checker) grammarErrorAtPos(nodeForSourceFile *ast.Node, start int, length int, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(nodeForSourceFile)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		c.addDiagnostic(ast.NewDiagnostic(sourceFile, core.NewTextRange(start, start+length), message, args...))
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_grammarErrorAtPos(receiver: GoPtr<Checker>, nodeForSourceFile: GoPtr<Node>, start: int, length: int, message: GoPtr<Message>, ...args: Array<unknown>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnNode","kind":"method","status":"implemented","sigHash":"ee108f85250864c3b912ab817057387d981bc8ae5e9065d4b53bd0a6da485184","bodyHash":"db87fbbdbc3b4ade27dd599f8ceebe4b7a640774be6ff6354c4a30698431930b"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnNode(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		c.error(node, message, args...)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_grammarErrorOnNode(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.grammarErrorOnNodeSkippedOnNoEmit","kind":"method","status":"implemented","sigHash":"d85ab3e5c9bf0b30f14ca2a447d4ad20abc51d82e5d5e16bfee84687488e39a1","bodyHash":"cfdfa06c00fbe02656001b8f1b84371e007b1efe70a2cca83f55b6b74d7c98c6"}
 *
 * Go source:
 * func (c *Checker) grammarErrorOnNodeSkippedOnNoEmit(node *ast.Node, message *diagnostics.Message, args ...any) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node)
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		d := NewDiagnosticForNode(node, message, args...)
 * 		d.SetSkippedOnNoEmit()
 * 		c.addDiagnostic(d)
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function Checker_grammarErrorOnNodeSkippedOnNoEmit(receiver: GoPtr<Checker>, node: GoPtr<Node>, message: GoPtr<Message>, ...args: Array<unknown>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::getIdentifierFromEntityNameExpression","kind":"func","status":"implemented","sigHash":"8cd61adabde4b427cda31e169dd32215b90d9a9ffaf010147f3a612299dd9a1e","bodyHash":"29fbafc34d60a746146ba9457cfd5ef0e73f2ca96dfa4735bc2b831ef03646bd"}
 *
 * Go source:
 * func getIdentifierFromEntityNameExpression(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		return node
 * 	case ast.KindPropertyAccessExpression:
 * 		return node.AsPropertyAccessExpression().Name()
 * 	default:
 * 		return nil
 * 	}
 * }
 */
export declare function getIdentifierFromEntityNameExpression(node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarRegularExpressionLiteral","kind":"method","status":"implemented","sigHash":"57120ea3bf3998113239125e5b090db84b7f166cd36c4e71b46f4bd1f0775144","bodyHash":"b94fb259392899e1350c7a3ac731dd31ff7cfd8d896e53334dc1c50fa8302f54"}
 *
 * Go source:
 * func (c *Checker) checkGrammarRegularExpressionLiteral(node *ast.RegularExpressionLiteral) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(node.AsNode())
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		var lastError *ast.Diagnostic
 * 		if c.regExpScanner == nil {
 * 			c.regExpScanner = scanner.NewScanner()
 * 		}
 * 		c.regExpScanner.SetScriptTarget(c.languageVersion)
 * 		c.regExpScanner.SetLanguageVariant(sourceFile.LanguageVariant)
 * 		c.regExpScanner.SetOnError(func(message *diagnostics.Message, start int, length int, args ...any) {
 * 			if message.Category() == diagnostics.CategoryMessage && lastError != nil && start == lastError.Pos() && length == lastError.Len() {
 * 				// For providing spelling suggestions.
 * 				err := ast.NewDiagnostic(nil, core.NewTextRange(start, start+length), message, args...)
 * 				lastError.AddRelatedInfo(err)
 * 			} else if lastError == nil || start != lastError.Pos() {
 * 				lastError = ast.NewDiagnostic(sourceFile, core.NewTextRange(start, start+length), message, args...)
 * 				c.addDiagnostic(lastError)
 * 			}
 * 		})
 * 		c.regExpScanner.SetText(sourceFile.Text())
 * 		c.regExpScanner.ResetTokenState(node.AsNode().Pos())
 * 		c.regExpScanner.Scan()
 * 		tokenIsRegularExpressionLiteral := c.regExpScanner.ReScanSlashToken(true) == ast.KindRegularExpressionLiteral
 * 		c.regExpScanner.SetText("")
 * 		c.regExpScanner.SetOnError(nil)
 * 		debug.Assert(tokenIsRegularExpressionLiteral)
 * 		return lastError != nil
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarRegularExpressionLiteral(receiver: GoPtr<Checker>, node: GoPtr<RegularExpressionLiteral>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarPrivateIdentifierExpression","kind":"method","status":"implemented","sigHash":"47ff992c397ba40a5b8609d0dda1c5fb41ec1657be9c67a6ff7616fd8d186e5d","bodyHash":"cb04324c4ec48279d8931c691d389b3cb26f8f68a870f798a4a6ac8ab9ea1e8f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarPrivateIdentifierExpression(privId *ast.PrivateIdentifier) bool {
 * 	privIdAsNode := privId.AsNode()
 * 	if ast.GetContainingClass(privId.AsNode()) == nil {
 * 		return c.grammarErrorOnNode(privId.AsNode(), diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 	}
 *
 * 	if !ast.IsForInStatement(privId.Parent) {
 * 		if !ast.IsExpressionNode(privIdAsNode) {
 * 			return c.grammarErrorOnNode(privIdAsNode, diagnostics.Private_identifiers_are_only_allowed_in_class_bodies_and_may_only_be_used_as_part_of_a_class_member_declaration_property_access_or_on_the_left_hand_side_of_an_in_expression)
 * 		}
 *
 * 		isInOperation := ast.IsBinaryExpression(privId.Parent) && privId.Parent.AsBinaryExpression().OperatorToken.Kind == ast.KindInKeyword
 * 		if c.getSymbolForPrivateIdentifierExpression(privIdAsNode) == nil && !isInOperation {
 * 			return c.grammarErrorOnNode(privIdAsNode, diagnostics.Cannot_find_name_0, privId.Text)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarPrivateIdentifierExpression(receiver: GoPtr<Checker>, privId: GoPtr<PrivateIdentifier>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMappedType","kind":"method","status":"implemented","sigHash":"0c99c1956e7a2ff074ca723b0db27e809059f504cfdbfcca714d3c5f970a0afb","bodyHash":"66c32a878418ccbca7e1273a575598ef9ad0c20bb13b85ffe73aaed691ecaed9"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMappedType(node *ast.MappedTypeNode) bool {
 * 	if len(node.Members.Nodes) > 0 {
 * 		return c.grammarErrorOnNode(node.Members.Nodes[0], diagnostics.A_mapped_type_may_not_declare_properties_or_methods)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarMappedType(receiver: GoPtr<Checker>, node: GoPtr<MappedTypeNode>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarDecorator","kind":"method","status":"implemented","sigHash":"ce61e354e9b9e38bfb9698e86cf6908a2eb7ba402d80d474b2fe397f31d48013","bodyHash":"1ca27d975ba7ad3fb67b9f160f8327e06ecaff1354afab39847c778192b5e1fa"}
 *
 * Go source:
 * func (c *Checker) checkGrammarDecorator(decorator *ast.Decorator) bool {
 * 	sourceFile := ast.GetSourceFileOfNode(decorator.AsNode())
 * 	if !c.hasParseDiagnostics(sourceFile) {
 * 		node := decorator.Expression
 *
 * 		// DecoratorParenthesizedExpression :
 * 		//   `(` Expression `)`
 *
 * 		if ast.IsParenthesizedExpression(node) {
 * 			return false
 * 		}
 *
 * 		canHaveCallExpression := true
 * 		var errorNode *ast.Node
 * 		for {
 * 			// Allow TS syntax such as non-null assertions and instantiation expressions
 * 			if ast.IsExpressionWithTypeArguments(node) || ast.IsNonNullExpression(node) {
 * 				node = node.Expression()
 * 				continue
 * 			}
 *
 * 			// DecoratorCallExpression :
 * 			//   DecoratorMemberExpression Arguments
 *
 * 			if ast.IsCallExpression(node) {
 * 				callExpr := node.AsCallExpression()
 * 				if !canHaveCallExpression {
 * 					errorNode = node
 * 				}
 * 				if callExpr.QuestionDotToken != nil {
 * 					// Even if we already have an error node, error at the `?.` token since it appears earlier.
 * 					errorNode = callExpr.QuestionDotToken
 * 				}
 * 				node = callExpr.Expression
 * 				canHaveCallExpression = false
 * 				continue
 * 			}
 *
 * 			// DecoratorMemberExpression :
 * 			//   IdentifierReference
 * 			//   DecoratorMemberExpression `.` IdentifierName
 * 			//   DecoratorMemberExpression `.` PrivateIdentifier
 *
 * 			if ast.IsPropertyAccessExpression(node) {
 * 				propertyAccessExpr := node.AsPropertyAccessExpression()
 * 				if propertyAccessExpr.QuestionDotToken != nil {
 * 					// Even if we already have an error node, error at the `?.` token since it appears earlier.
 * 					errorNode = propertyAccessExpr.QuestionDotToken
 * 				}
 * 				node = propertyAccessExpr.Expression
 * 				canHaveCallExpression = false
 * 				continue
 * 			}
 *
 * 			if !ast.IsIdentifier(node) {
 * 				// Even if we already have an error node, error at this node since it appears earlier.
 * 				errorNode = node
 * 			}
 *
 * 			break
 * 		}
 *
 * 		if errorNode != nil {
 * 			err := c.error(decorator.Expression, diagnostics.Expression_must_be_enclosed_in_parentheses_to_be_used_as_a_decorator)
 * 			err.AddRelatedInfo(createDiagnosticForNode(errorNode, diagnostics.Invalid_syntax_in_decorator))
 * 			return true
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarDecorator(receiver: GoPtr<Checker>, decorator: GoPtr<Decorator>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarExportDeclaration","kind":"method","status":"implemented","sigHash":"327154eaf4a7367d9bcb1af0ea0af81f5b6da8a0927c54e12e3a6103edd8f828","bodyHash":"9b6f7dc9b761e9e253f6a9cb42b3e22325824e775b0b5842dfebef69e5a51b77"}
 *
 * Go source:
 * func (c *Checker) checkGrammarExportDeclaration(node *ast.ExportDeclaration) bool {
 * 	if node.IsTypeOnly && node.ExportClause != nil && node.ExportClause.Kind == ast.KindNamedExports {
 * 		return c.checkGrammarTypeOnlyNamedImportsOrExports(node.ExportClause)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarExportDeclaration(receiver: GoPtr<Checker>, node: GoPtr<ExportDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarModuleElementContext","kind":"method","status":"implemented","sigHash":"fa25520d01a571fa5f4d3dc97b44ec31ec02f1d401aad328a5f9d9331afcf22b","bodyHash":"cb7b62b7d603b95607c68f19892361245e0260dbb90df99ff5b18206617678d0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarModuleElementContext(node *ast.Statement, errorMessage *diagnostics.Message) bool {
 * 	isInAppropriateContext := node.Parent.Kind == ast.KindSourceFile || node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindModuleDeclaration
 * 	if !isInAppropriateContext {
 * 		c.grammarErrorOnFirstToken(node, errorMessage)
 * 	}
 * 	return !isInAppropriateContext
 * }
 */
export declare function Checker_checkGrammarModuleElementContext(receiver: GoPtr<Checker>, node: GoPtr<Statement>, errorMessage: GoPtr<Message>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarModifiers","kind":"method","status":"implemented","sigHash":"0b0425938eebf74bfdaf4333c96a425aea880ab0486e0c575ac1707e650b5099","bodyHash":"9b1548c4672ccb417b509ee7648b49911ff4ad73da38084033d56292e35c8c0f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarModifiers(node *ast.Node /*Union[HasModifiers, HasDecorators, HasIllegalModifiers, HasIllegalDecorators]* /) bool {
 * 	if node.Modifiers() == nil {
 * 		return false
 * 	}
 * 	if c.reportObviousDecoratorErrors(node) || c.reportObviousModifierErrors(node) {
 * 		return true
 * 	}
 * 	if ast.IsThisParameter(node) {
 * 		return c.grammarErrorOnFirstToken(node, diagnostics.Neither_decorators_nor_modifiers_may_be_applied_to_this_parameters)
 * 	}
 * 	blockScopeKind := ast.NodeFlagsNone
 * 	if ast.IsVariableStatement(node) {
 * 		blockScopeKind = node.AsVariableStatement().DeclarationList.Flags & ast.NodeFlagsBlockScoped
 * 	}
 * 	var lastStatic *ast.Node
 * 	var lastDeclare *ast.Node
 * 	var lastAsync *ast.Node
 * 	var lastOverride *ast.Node
 * 	var firstDecorator *ast.Node
 * 	flags := ast.ModifierFlagsNone
 * 	sawExportBeforeDecorators := false
 * 	// We parse decorators and modifiers in four contiguous chunks:
 * 	// [...leadingDecorators, ...leadingModifiers, ...trailingDecorators, ...trailingModifiers]. It is an error to
 * 	// have both leading and trailing decorators.
 * 	hasLeadingDecorators := false
 * 	modifiers := node.ModifierNodes()
 * 	for _, modifier := range modifiers {
 * 		if ast.IsDecorator(modifier) {
 * 			if !ast.NodeCanBeDecorated(c.legacyDecorators, node, node.Parent, node.Parent.Parent) {
 * 				if node.Kind == ast.KindMethodDeclaration && !ast.NodeIsPresent(node.Body()) {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.A_decorator_can_only_decorate_a_method_implementation_not_an_overload)
 * 				} else {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.Decorators_are_not_valid_here)
 * 				}
 * 			} else if c.legacyDecorators && (node.Kind == ast.KindGetAccessor || node.Kind == ast.KindSetAccessor) {
 * 				accessors := ast.GetAllAccessorDeclarationsForDeclaration(node, c.getSymbolOfDeclaration(node).Declarations)
 * 				if ast.HasDecorators(accessors.FirstAccessor) && node == accessors.SecondAccessor {
 * 					return c.grammarErrorOnFirstToken(node, diagnostics.Decorators_cannot_be_applied_to_multiple_get_Slashset_accessors_of_the_same_name)
 * 				}
 * 			}
 *
 * 			// if we've seen any modifiers aside from `export`, `default`, or another decorator, then this is an invalid position
 * 			if flags&^(ast.ModifierFlagsExportDefault|ast.ModifierFlagsDecorator) != 0 {
 * 				return c.grammarErrorOnNode(modifier, diagnostics.Decorators_are_not_valid_here)
 * 			}
 *
 * 			// if we've already seen leading decorators and leading modifiers, then trailing decorators are an invalid position
 * 			if hasLeadingDecorators && flags&ast.ModifierFlagsModifier != 0 {
 * 				if firstDecorator == nil {
 * 					panic("Expected firstDecorator to be set")
 * 				}
 * 				sourceFile := ast.GetSourceFileOfNode(modifier)
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					err := c.error(modifier, diagnostics.Decorators_may_not_appear_after_export_or_export_default_if_they_also_appear_before_export)
 * 					err.AddRelatedInfo(createDiagnosticForNode(firstDecorator, diagnostics.Decorator_used_before_export_here))
 * 					return true
 * 				}
 * 				return false
 * 			}
 *
 * 			flags |= ast.ModifierFlagsDecorator
 *
 * 			// if we have not yet seen a modifier, then these are leading decorators
 * 			if flags&ast.ModifierFlagsModifier == 0 {
 * 				hasLeadingDecorators = true
 * 			} else if flags&ast.ModifierFlagsExport != 0 {
 * 				sawExportBeforeDecorators = true
 * 			}
 *
 * 			if firstDecorator == nil {
 * 				firstDecorator = modifier
 * 			}
 * 		} else {
 * 			if modifier.Kind != ast.KindReadonlyKeyword {
 * 				if node.Kind == ast.KindPropertySignature || node.Kind == ast.KindMethodSignature {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_type_member, scanner.TokenToString(modifier.Kind))
 * 				}
 * 				if node.Kind == ast.KindIndexSignature && (modifier.Kind != ast.KindStaticKeyword || !ast.IsClassLike(node.Parent)) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_index_signature, scanner.TokenToString(modifier.Kind))
 * 				}
 * 			}
 * 			if modifier.Kind != ast.KindInKeyword && modifier.Kind != ast.KindOutKeyword && modifier.Kind != ast.KindConstKeyword {
 * 				if node.Kind == ast.KindTypeParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_type_parameter, scanner.TokenToString(modifier.Kind))
 * 				}
 * 			}
 * 			switch modifier.Kind {
 * 			case ast.KindConstKeyword:
 * 				if node.Kind != ast.KindEnumDeclaration && node.Kind != ast.KindTypeParameter {
 * 					return c.grammarErrorOnNode(node, diagnostics.A_class_member_cannot_have_the_0_keyword, scanner.TokenToString(ast.KindConstKeyword))
 * 				}
 * 				parent := node.Parent
 * 				if node.Kind == ast.KindTypeParameter {
 * 					if !(ast.IsFunctionLikeDeclaration(parent) || ast.IsClassLike(parent) ||
 * 						ast.IsFunctionTypeNode(parent) || ast.IsConstructorTypeNode(parent) ||
 * 						ast.IsCallSignatureDeclaration(parent) || ast.IsConstructSignatureDeclaration(parent) ||
 * 						ast.IsMethodSignatureDeclaration(parent)) {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_can_only_appear_on_a_type_parameter_of_a_function_method_or_class, scanner.TokenToString(modifier.Kind))
 * 					}
 * 				}
 * 			case ast.KindOverrideKeyword:
 * 				// If node.kind === SyntaxKind.Parameter, checkParameter reports an error if it's not a parameter property.
 * 				if flags&ast.ModifierFlagsOverride != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "override")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "override", "declare")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "readonly")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "accessor")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "override", "async")
 * 				}
 * 				flags |= ast.ModifierFlagsOverride
 * 				lastOverride = modifier
 *
 * 			case ast.KindPublicKeyword,
 * 				ast.KindProtectedKeyword,
 * 				ast.KindPrivateKeyword:
 * 				text := visibilityToString(ast.ModifierToFlag(modifier.Kind))
 *
 * 				if flags&ast.ModifierFlagsAccessibilityModifier != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.Accessibility_modifier_already_seen)
 * 				} else if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "override")
 * 				} else if flags&ast.ModifierFlagsStatic != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "static")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "accessor")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "readonly")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "async")
 * 				} else if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_module_or_namespace_element, text)
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 {
 * 					if modifier.Kind == ast.KindPrivateKeyword {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, text, "abstract")
 * 					} else if modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, text, "abstract")
 * 					}
 * 				} else if ast.IsPrivateIdentifierClassElementDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.An_accessibility_modifier_cannot_be_used_with_a_private_identifier)
 * 				}
 * 				flags |= ast.ModifierToFlag(modifier.Kind)
 * 			case ast.KindStaticKeyword:
 * 				if flags&ast.ModifierFlagsStatic != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "static")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "readonly")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "async")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "accessor")
 * 				} else if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_module_or_namespace_element, "static")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "static")
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract")
 * 				} else if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "static", "override")
 * 				}
 * 				flags |= ast.ModifierFlagsStatic
 * 				lastStatic = modifier
 * 			case ast.KindAccessorKeyword:
 * 				if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "accessor")
 * 				} else if flags&ast.ModifierFlagsReadonly != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "readonly")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "accessor", "declare")
 * 				} else if node.Kind != ast.KindPropertyDeclaration {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_accessor_modifier_can_only_appear_on_a_property_declaration)
 * 				}
 *
 * 				flags |= ast.ModifierFlagsAccessor
 * 			case ast.KindReadonlyKeyword:
 * 				if flags&ast.ModifierFlagsReadonly != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "readonly")
 * 				} else if node.Kind != ast.KindPropertyDeclaration && node.Kind != ast.KindPropertySignature && node.Kind != ast.KindIndexSignature && node.Kind != ast.KindParameter {
 * 					// If node.kind === SyntaxKind.Parameter, checkParameter reports an error if it's not a parameter property.
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_readonly_modifier_can_only_appear_on_a_property_declaration_or_index_signature)
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "readonly", "accessor")
 * 				}
 * 				flags |= ast.ModifierFlagsReadonly
 * 			case ast.KindExportKeyword:
 * 				if c.compilerOptions.VerbatimModuleSyntax == core.TSTrue && node.Flags&ast.NodeFlagsAmbient == 0 && node.Kind != ast.KindTypeAliasDeclaration && node.Kind != ast.KindInterfaceDeclaration && node.Kind != ast.KindModuleDeclaration && node.Parent.Kind == ast.KindSourceFile && c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node)) == core.ModuleKindCommonJS {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_top_level_export_modifier_cannot_be_used_on_value_declarations_in_a_CommonJS_module_when_verbatimModuleSyntax_is_enabled)
 * 				}
 * 				if flags&ast.ModifierFlagsExport != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "export")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "declare")
 * 				} else if flags&ast.ModifierFlagsAbstract != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "abstract")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "async")
 * 				} else if ast.IsClassLike(node.Parent) && !ast.IsJSTypeAliasDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "export")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "export")
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "export")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "export")
 * 				}
 * 				flags |= ast.ModifierFlagsExport
 * 			case ast.KindDefaultKeyword:
 * 				var container *ast.Node
 * 				if node.Parent.Kind == ast.KindSourceFile {
 * 					container = node.Parent
 * 				} else {
 * 					container = node.Parent.Parent
 * 				}
 * 				if container.Kind == ast.KindModuleDeclaration && !ast.IsAmbientModule(container) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_default_export_can_only_be_used_in_an_ECMAScript_style_module)
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "default")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "default")
 * 				} else if flags&ast.ModifierFlagsExport == 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "export", "default")
 * 				} else if sawExportBeforeDecorators {
 * 					return c.grammarErrorOnNode(firstDecorator, diagnostics.Decorators_are_not_valid_here)
 * 				}
 *
 * 				flags |= ast.ModifierFlagsDefault
 * 			case ast.KindDeclareKeyword:
 * 				if flags&ast.ModifierFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "declare")
 * 				} else if flags&ast.ModifierFlagsAsync != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "async")
 * 				} else if flags&ast.ModifierFlagsOverride != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "override")
 * 				} else if ast.IsClassLike(node.Parent) && !ast.IsPropertyDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_class_elements_of_this_kind, "declare")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "declare")
 * 				} else if blockScopeKind == ast.NodeFlagsUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_using_declaration, "declare")
 * 				} else if blockScopeKind == ast.NodeFlagsAwaitUsing {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_an_await_using_declaration, "declare")
 * 				} else if (node.Parent.Flags&ast.NodeFlagsAmbient != 0) && node.Parent.Kind == ast.KindModuleBlock {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.A_declare_modifier_cannot_be_used_in_an_already_ambient_context)
 * 				} else if ast.IsPrivateIdentifierClassElementDeclaration(node) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_a_private_identifier, "declare")
 * 				} else if flags&ast.ModifierFlagsAccessor != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "declare", "accessor")
 * 				}
 * 				flags |= ast.ModifierFlagsAmbient
 * 				lastDeclare = modifier
 * 			case ast.KindAbstractKeyword:
 * 				if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "abstract")
 * 				}
 * 				if node.Kind != ast.KindClassDeclaration && node.Kind != ast.KindConstructorType {
 * 					if node.Kind != ast.KindMethodDeclaration && node.Kind != ast.KindPropertyDeclaration && node.Kind != ast.KindGetAccessor && node.Kind != ast.KindSetAccessor {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_abstract_modifier_can_only_appear_on_a_class_method_or_property_declaration)
 * 					}
 * 					if !(node.Parent.Kind == ast.KindClassDeclaration && ast.HasSyntacticModifier(node.Parent, ast.ModifierFlagsAbstract)) {
 * 						var message *diagnostics.Message
 * 						if node.Kind == ast.KindPropertyDeclaration {
 * 							message = diagnostics.Abstract_properties_can_only_appear_within_an_abstract_class
 * 						} else {
 * 							message = diagnostics.Abstract_methods_can_only_appear_within_an_abstract_class
 * 						}
 * 						return c.grammarErrorOnNode(modifier, message)
 * 					}
 * 					if flags&ast.ModifierFlagsStatic != 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "static", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsPrivate != 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "private", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsAsync != 0 && lastAsync != nil {
 * 						return c.grammarErrorOnNode(lastAsync, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract")
 * 					}
 * 					if flags&ast.ModifierFlagsOverride != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "abstract", "override")
 * 					}
 * 					if flags&ast.ModifierFlagsAccessor != 0 && modifier.Flags&ast.NodeFlagsReparsed == 0 {
 * 						return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "abstract", "accessor")
 * 					}
 * 				}
 * 				if name := node.Name(); name != nil && name.Kind == ast.KindPrivateIdentifier {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_a_private_identifier, "abstract")
 * 				}
 *
 * 				flags |= ast.ModifierFlagsAbstract
 * 			case ast.KindAsyncKeyword:
 * 				if flags&ast.ModifierFlagsAsync != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, "async")
 * 				} else if flags&ast.ModifierFlagsAmbient != 0 || node.Parent.Flags&ast.NodeFlagsAmbient != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_in_an_ambient_context, "async")
 * 				} else if node.Kind == ast.KindParameter {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_appear_on_a_parameter, "async")
 * 				}
 * 				if flags&ast.ModifierFlagsAbstract != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_cannot_be_used_with_1_modifier, "async", "abstract")
 * 				}
 * 				flags |= ast.ModifierFlagsAsync
 * 				lastAsync = modifier
 * 			case ast.KindInKeyword,
 * 				ast.KindOutKeyword:
 * 				var inOutFlag ast.ModifierFlags
 * 				if modifier.Kind == ast.KindInKeyword {
 * 					inOutFlag = ast.ModifierFlagsIn
 * 				} else {
 * 					inOutFlag = ast.ModifierFlagsOut
 * 				}
 * 				var inOutText string
 * 				if modifier.Kind == ast.KindInKeyword {
 * 					inOutText = "in"
 * 				} else {
 * 					inOutText = "out"
 * 				}
 * 				parent := node.Parent
 * 				if node.Kind != ast.KindTypeParameter || parent != nil && !(ast.IsInterfaceDeclaration(parent) || ast.IsClassLike(parent) || ast.IsTypeOrJSTypeAliasDeclaration(parent)) {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_can_only_appear_on_a_type_parameter_of_a_class_interface_or_type_alias, inOutText)
 * 				}
 * 				if flags&inOutFlag != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_already_seen, inOutText)
 * 				}
 * 				if inOutFlag&ast.ModifierFlagsIn != 0 && flags&ast.ModifierFlagsOut != 0 {
 * 					return c.grammarErrorOnNode(modifier, diagnostics.X_0_modifier_must_precede_1_modifier, "in", "out")
 * 				}
 * 				flags |= inOutFlag
 * 			}
 * 		}
 * 	}
 *
 * 	if node.Kind == ast.KindConstructor {
 * 		if flags&ast.ModifierFlagsStatic != 0 {
 * 			return c.grammarErrorOnNode(lastStatic, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "static")
 * 		}
 * 		if flags&ast.ModifierFlagsOverride != 0 {
 * 			return c.grammarErrorOnNode(lastOverride, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "override")
 * 		}
 * 		if flags&ast.ModifierFlagsAsync != 0 {
 * 			return c.grammarErrorOnNode(lastAsync, diagnostics.X_0_modifier_cannot_appear_on_a_constructor_declaration, "async")
 * 		}
 * 		return false
 * 	} else if (node.Kind == ast.KindImportDeclaration || node.Kind == ast.KindJSImportDeclaration || node.Kind == ast.KindImportEqualsDeclaration) && flags&ast.ModifierFlagsAmbient != 0 {
 * 		return c.grammarErrorOnNode(lastDeclare, diagnostics.A_0_modifier_cannot_be_used_with_an_import_declaration, "declare")
 * 	} else if node.Kind == ast.KindParameter && (flags&ast.ModifierFlagsParameterPropertyModifier != 0) && ast.IsBindingPattern(node.Name()) {
 * 		return c.grammarErrorOnNode(node, diagnostics.A_parameter_property_may_not_be_declared_using_a_binding_pattern)
 * 	} else if node.Kind == ast.KindParameter && (flags&ast.ModifierFlagsParameterPropertyModifier != 0) && node.AsParameterDeclaration().DotDotDotToken != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.A_parameter_property_cannot_be_declared_using_a_rest_parameter)
 * 	}
 * 	if flags&ast.ModifierFlagsAsync != 0 {
 * 		return c.checkGrammarAsyncModifier(node, lastAsync)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarModifiers(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.reportObviousModifierErrors","kind":"method","status":"implemented","sigHash":"74a14bff8368eb7795ec34c9e91916e9e7e2a3fd73b1a9887c0a695d0a1a5c09","bodyHash":"23a2e9ee53fa3b5eec691effe89a3d7d0a9eacabf25d96e213d5dc69645b3a00"}
 *
 * Go source:
 * func (c *Checker) reportObviousModifierErrors(node *ast.Node) bool {
 * 	modifier := c.findFirstIllegalModifier(node)
 * 	if modifier == nil {
 * 		return false
 * 	}
 * 	return c.grammarErrorOnFirstToken(modifier, diagnostics.Modifiers_cannot_appear_here)
 * }
 */
export declare function Checker_reportObviousModifierErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstModifierExcept","kind":"method","status":"implemented","sigHash":"437d953f18fc4295435a134924484c4e5b30aca27fff6632e9b8252f11ffb204","bodyHash":"7207dfb01a9bf77de2528c4249c28fa4abb91b4b14f315d78f846c3a10fd9d25"}
 *
 * Go source:
 * func (c *Checker) findFirstModifierExcept(node *ast.Node, allowedModifier ast.Kind) *ast.Node {
 * 	modifier := core.Find(node.ModifierNodes(), ast.IsModifier)
 * 	if modifier != nil && modifier.Kind != allowedModifier {
 * 		return modifier
 * 	}
 * 	return nil
 * }
 */
export declare function Checker_findFirstModifierExcept(receiver: GoPtr<Checker>, node: GoPtr<Node>, allowedModifier: Kind): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstIllegalModifier","kind":"method","status":"implemented","sigHash":"bf400441e6e93c32dcfec61a751d6fd516cc6787d7457c1790b77d5dd07c840e","bodyHash":"1134c3c1d54997ac7636fd7afa25d610a3907405c8d93275fc071b8a88d33882"}
 *
 * Go source:
 * func (c *Checker) findFirstIllegalModifier(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindGetAccessor,
 * 		ast.KindSetAccessor,
 * 		ast.KindConstructor,
 * 		ast.KindPropertyDeclaration,
 * 		ast.KindPropertySignature,
 * 		ast.KindMethodDeclaration,
 * 		ast.KindMethodSignature,
 * 		ast.KindIndexSignature,
 * 		ast.KindModuleDeclaration,
 * 		ast.KindImportDeclaration,
 * 		ast.KindJSImportDeclaration,
 * 		ast.KindImportEqualsDeclaration,
 * 		ast.KindExportDeclaration,
 * 		ast.KindExportAssignment,
 * 		ast.KindFunctionExpression,
 * 		ast.KindArrowFunction,
 * 		ast.KindParameter,
 * 		ast.KindTypeParameter,
 * 		ast.KindJSTypeAliasDeclaration:
 * 		return nil
 * 	case ast.KindClassStaticBlockDeclaration,
 * 		ast.KindPropertyAssignment,
 * 		ast.KindShorthandPropertyAssignment,
 * 		ast.KindNamespaceExportDeclaration,
 * 		ast.KindMissingDeclaration:
 * 		return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 	default:
 * 		if node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 			return nil
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindFunctionDeclaration:
 * 			return c.findFirstModifierExcept(node, ast.KindAsyncKeyword)
 * 		case ast.KindClassDeclaration,
 * 			ast.KindConstructorType:
 * 			return c.findFirstModifierExcept(node, ast.KindAbstractKeyword)
 * 		case ast.KindClassExpression,
 * 			ast.KindInterfaceDeclaration,
 * 			ast.KindTypeAliasDeclaration:
 * 			return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 		case ast.KindVariableStatement:
 * 			if node.AsVariableStatement().DeclarationList.Flags&ast.NodeFlagsUsing != 0 {
 * 				return c.findFirstModifierExcept(node, ast.KindAwaitKeyword)
 * 			}
 * 			return core.Find(node.ModifierNodes(), ast.IsModifier)
 * 		case ast.KindEnumDeclaration:
 * 			return c.findFirstModifierExcept(node, ast.KindConstKeyword)
 * 		default:
 * 			panic("Unhandled case in findFirstIllegalModifier.")
 * 		}
 * 	}
 * }
 */
export declare function Checker_findFirstIllegalModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.reportObviousDecoratorErrors","kind":"method","status":"implemented","sigHash":"f6984c82989e13d6ecb3db4e6bcfe8ce93da1a4a49f4279749db0dbc62daa98c","bodyHash":"30f42d4662d94ce2f0e5eebd869dfe6be936487cb078ad7feedda5ce8eccc310"}
 *
 * Go source:
 * func (c *Checker) reportObviousDecoratorErrors(node *ast.Node) bool {
 * 	decorator := c.findFirstIllegalDecorator(node)
 * 	if decorator == nil {
 * 		return false
 * 	}
 * 	return c.grammarErrorOnFirstToken(decorator, diagnostics.Decorators_are_not_valid_here)
 * }
 */
export declare function Checker_reportObviousDecoratorErrors(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.findFirstIllegalDecorator","kind":"method","status":"implemented","sigHash":"6f00e6ca045ef8aa8d286e1e57d0b2aa21cb6189edb01229a660c1a85eadb038","bodyHash":"8dd0b94f3747f680a6744b06ece3a75dec03c6a1d92be1004e9868fa3a457c9a"}
 *
 * Go source:
 * func (c *Checker) findFirstIllegalDecorator(node *ast.Node) *ast.Node {
 * 	if ast.CanHaveIllegalDecorators(node) {
 * 		decorator := core.Find(node.ModifierNodes(), ast.IsDecorator)
 * 		return decorator
 * 	} else {
 * 		return nil
 * 	}
 * }
 */
export declare function Checker_findFirstIllegalDecorator(receiver: GoPtr<Checker>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAsyncModifier","kind":"method","status":"implemented","sigHash":"d54b13a9d2fa44460464977bb696ac9ae4dbacb1ec735ce4a01b452ad6cb984f","bodyHash":"c4698c6ff4beab84b73933d8acba4d705b206664ee5be70b14f18341294f56d6"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAsyncModifier(node *ast.Node, asyncModifier *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindMethodDeclaration,
 * 		ast.KindFunctionDeclaration,
 * 		ast.KindFunctionExpression,
 * 		ast.KindArrowFunction:
 * 		return false
 * 	}
 *
 * 	return c.grammarErrorOnNode(asyncModifier, diagnostics.X_0_modifier_cannot_be_used_here, "async")
 * }
 */
export declare function Checker_checkGrammarAsyncModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>, asyncModifier: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForDisallowedTrailingComma","kind":"method","status":"implemented","sigHash":"a35da90b785d8beb5a9c2d22ebd89358077e0bb54c0a11c024fb1f939d182271","bodyHash":"c0e97ca3f274693f4a47174d8906bf814a67cfc79805182a706828fe458fec77"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForDisallowedTrailingComma(list *ast.NodeList, diag *diagnostics.Message) bool {
 * 	if list != nil && list.HasTrailingComma() {
 * 		return c.grammarErrorAtPos(list.Nodes[0], list.End()-len(","), len(","), diag)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForDisallowedTrailingComma(receiver: GoPtr<Checker>, list: GoPtr<NodeList>, diag: GoPtr<Message>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeParameterList","kind":"method","status":"implemented","sigHash":"e0d95c60e6b16c268fa288bbf965cfc1abc6155aa0f2d02fe3b33014bde5e0da","bodyHash":"729efaa2cb75faa37ac3cd5abf90c73c0f3abb10a35454c4c9d49bd40b397afa"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeParameterList(typeParameters *ast.NodeList, file *ast.SourceFile) bool {
 * 	if typeParameters != nil && len(typeParameters.Nodes) == 0 {
 * 		start := typeParameters.Pos() - len("<")
 * 		end := scanner.SkipTrivia(file.Text(), typeParameters.End()) + len(">")
 * 		return c.grammarErrorAtPos(file.AsNode(), start, end-start, diagnostics.Type_parameter_list_cannot_be_empty)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarTypeParameterList(receiver: GoPtr<Checker>, typeParameters: GoPtr<NodeList>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarParameterList","kind":"method","status":"implemented","sigHash":"6d6e4dbbeaefbd4cc4091aa38b4ab5a2ce7d26f1266d8136737c1892ff9cb8b1","bodyHash":"e9d8d1fa67301afe4394612d4ff28b3600214087418ed3a299b88e8a206bf642"}
 *
 * Go source:
 * func (c *Checker) checkGrammarParameterList(parameters *ast.NodeList) bool {
 * 	seenOptionalParameter := false
 * 	parameterCount := len(parameters.Nodes)
 *
 * 	for i := range parameterCount {
 * 		parameter := parameters.Nodes[i].AsParameterDeclaration()
 * 		if parameter.DotDotDotToken != nil {
 * 			if i != parameterCount-1 {
 * 				return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.A_rest_parameter_must_be_last_in_a_parameter_list)
 * 			}
 * 			if parameter.Flags&ast.NodeFlagsAmbient == 0 {
 * 				c.checkGrammarForDisallowedTrailingComma(parameters, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 * 			}
 *
 * 			if parameter.QuestionToken != nil {
 * 				return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.A_rest_parameter_cannot_be_optional)
 * 			}
 *
 * 			if parameter.Initializer != nil {
 * 				return c.grammarErrorOnNode(parameter.Name(), diagnostics.A_rest_parameter_cannot_have_an_initializer)
 * 			}
 * 		} else if isOptionalDeclaration(parameter.AsNode()) {
 * 			seenOptionalParameter = true
 * 			// A reparsed '?' token indicates a bracketed name in @param tag
 * 			if parameter.QuestionToken != nil && parameter.QuestionToken.Flags&ast.NodeFlagsReparsed == 0 && parameter.Initializer != nil {
 * 				return c.grammarErrorOnNode(parameter.Name(), diagnostics.Parameter_cannot_have_question_mark_and_initializer)
 * 			}
 * 		} else if seenOptionalParameter && parameter.Initializer == nil {
 * 			return c.grammarErrorOnNode(parameter.Name(), diagnostics.A_required_parameter_cannot_follow_an_optional_parameter)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarParameterList(receiver: GoPtr<Checker>, parameters: GoPtr<NodeList>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForUseStrictSimpleParameterList","kind":"method","status":"implemented","sigHash":"2e19063ec0a437a8c220065365061dc49d2a3789be9a47cf2e8db62b3d229ce9","bodyHash":"b718e49840666faf668d0537dd89cff537d847791ea166e6f19feda30e41796f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForUseStrictSimpleParameterList(node *ast.Node) bool {
 * 	if c.languageVersion >= core.ScriptTargetES2016 {
 * 		body := node.Body()
 * 		var useStrictDirective *ast.Node
 * 		if body != nil && ast.IsBlock(body) {
 * 			useStrictDirective = binder.FindUseStrictPrologue(ast.GetSourceFileOfNode(node), body.Statements())
 * 		}
 * 		if useStrictDirective != nil {
 * 			nonSimpleParameters := core.Filter(node.Parameters(), func(n *ast.Node) bool {
 * 				parameter := n.AsParameterDeclaration()
 * 				return parameter.Initializer != nil || ast.IsBindingPattern(parameter.Name()) || isRestParameter(parameter.AsNode())
 * 			})
 * 			if len(nonSimpleParameters) != 0 {
 * 				for _, parameter := range nonSimpleParameters {
 * 					err := c.error(parameter, diagnostics.This_parameter_is_not_allowed_with_use_strict_directive)
 * 					err.AddRelatedInfo(createDiagnosticForNode(useStrictDirective, diagnostics.X_use_strict_directive_used_here))
 * 				}
 *
 * 				err := c.error(useStrictDirective, diagnostics.X_use_strict_directive_cannot_be_used_with_non_simple_parameter_list)
 * 				for index, parameter := range nonSimpleParameters {
 * 					var relatedMessage *diagnostics.Message
 * 					if index == 0 {
 * 						relatedMessage = diagnostics.Non_simple_parameter_declared_here
 * 					} else {
 * 						relatedMessage = diagnostics.X_and_here
 * 					}
 * 					err.AddRelatedInfo(createDiagnosticForNode(parameter, relatedMessage))
 * 				}
 *
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForUseStrictSimpleParameterList(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarFunctionLikeDeclaration","kind":"method","status":"implemented","sigHash":"870d17938e226df009bf5a745d939bb4763b608c00ac15058839cae25d211a82","bodyHash":"62bef1861f89393a91c7e637dd60ac50d262015fcfefc4024acbbd1dfa0df455"}
 *
 * Go source:
 * func (c *Checker) checkGrammarFunctionLikeDeclaration(node *ast.Node) bool {
 * 	// Prevent cascading error by short-circuit
 * 	file := ast.GetSourceFileOfNode(node)
 * 	funcData := node.FunctionLikeData()
 * 	return c.checkGrammarModifiers(node) || c.checkGrammarTypeParameterList(funcData.TypeParameters, file) ||
 * 		c.checkGrammarParameterList(funcData.Parameters) || c.checkGrammarArrowFunction(node, file) ||
 * 		(ast.IsFunctionLikeDeclaration(node) && c.checkGrammarForUseStrictSimpleParameterList(node))
 * }
 */
export declare function Checker_checkGrammarFunctionLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarClassLikeDeclaration","kind":"method","status":"implemented","sigHash":"5ce56af70ed0a67134918545c6f91a27f995da5eef93608d35add56509c0a37a","bodyHash":"5fa1697611a8d67acc03d48d2d7b19b9ab668a480bddb226d27776af804ffe53"}
 *
 * Go source:
 * func (c *Checker) checkGrammarClassLikeDeclaration(node *ast.Node) bool {
 * 	file := ast.GetSourceFileOfNode(node)
 * 	return c.checkGrammarClassDeclarationHeritageClauses(node, file) || c.checkGrammarTypeParameterList(node.TypeParameterList(), file)
 * }
 */
export declare function Checker_checkGrammarClassLikeDeclaration(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarArrowFunction","kind":"method","status":"implemented","sigHash":"5e3226bd327fd486b6abd9e2779555b44c3d01056d43c314cf4f536aada72350","bodyHash":"a06aa50d7e1a1648be7c8be83a934490b8422c5bae78e9dd7bfacd97b1b350fc"}
 *
 * Go source:
 * func (c *Checker) checkGrammarArrowFunction(node *ast.Node, file *ast.SourceFile) bool {
 * 	if !ast.IsArrowFunction(node) {
 * 		return false
 * 	}
 *
 * 	arrowFunc := node.AsArrowFunction()
 * 	typeParameters := arrowFunc.TypeParameters
 * 	if typeParameters != nil {
 * 		typeParamNodes := typeParameters.Nodes
 * 		hasConstraint := len(typeParamNodes) > 0 && typeParamNodes[0].AsTypeParameterDeclaration().Constraint != nil
 * 		if !(len(typeParamNodes) > 1 || typeParameters.HasTrailingComma() || hasConstraint) {
 * 			if tspath.FileExtensionIsOneOf(file.FileName(), []string{tspath.ExtensionMts, tspath.ExtensionCts}) {
 * 				// TODO(danielr): should we return early here?
 * 				c.grammarErrorOnNode(typeParameters.Nodes[0], diagnostics.This_syntax_is_reserved_in_files_with_the_mts_or_cts_extension_Add_a_trailing_comma_or_explicit_constraint)
 * 			}
 * 		}
 * 	}
 *
 * 	equalsGreaterThanToken := arrowFunc.EqualsGreaterThanToken
 * 	startLine := scanner.GetECMALineOfPosition(file, equalsGreaterThanToken.Pos())
 * 	endLine := scanner.GetECMALineOfPosition(file, equalsGreaterThanToken.End())
 * 	return startLine != endLine && c.grammarErrorOnNode(equalsGreaterThanToken, diagnostics.Line_terminator_not_permitted_before_arrow)
 * }
 */
export declare function Checker_checkGrammarArrowFunction(receiver: GoPtr<Checker>, node: GoPtr<Node>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarIndexSignatureParameters","kind":"method","status":"implemented","sigHash":"83c0df83bc63fd85c1dbf6c6d1839adbed082d31e52e645fb4981b0a30f33eb1","bodyHash":"ab0d368e8ba74f732caf12e7f833347c47062ad0e65eb0c06a1822560d3bb690"}
 *
 * Go source:
 * func (c *Checker) checkGrammarIndexSignatureParameters(node *ast.IndexSignatureDeclaration) bool {
 * 	paramNodes := node.Parameters.Nodes
 *
 * 	if len(paramNodes) == 0 {
 * 		return c.grammarErrorOnNode(node.AsNode(), diagnostics.An_index_signature_must_have_exactly_one_parameter)
 * 	}
 *
 * 	parameter := paramNodes[0].AsParameterDeclaration()
 * 	if len(paramNodes) != 1 {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_must_have_exactly_one_parameter)
 * 	}
 *
 * 	c.checkGrammarForDisallowedTrailingComma(node.Parameters, diagnostics.An_index_signature_cannot_have_a_trailing_comma)
 * 	if parameter.DotDotDotToken != nil {
 * 		return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.An_index_signature_cannot_have_a_rest_parameter)
 * 	}
 * 	if parameter.Modifiers() != nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_cannot_have_an_accessibility_modifier)
 * 	}
 * 	if parameter.QuestionToken != nil {
 * 		return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.An_index_signature_parameter_cannot_have_a_question_mark)
 * 	}
 * 	if parameter.Initializer != nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_cannot_have_an_initializer)
 * 	}
 * 	typeNode := parameter.Type
 * 	if typeNode == nil {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_must_have_a_type_annotation)
 * 	}
 * 	t := c.getTypeFromTypeNode(typeNode)
 * 	if someType(t, func(t *Type) bool {
 * 		return t.flags&TypeFlagsStringOrNumberLiteralOrUnique != 0
 * 	}) || c.isGenericType(t) {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_type_cannot_be_a_literal_type_or_generic_type_Consider_using_a_mapped_object_type_instead)
 * 	}
 * 	if !everyType(t, c.isValidIndexKeyType) {
 * 		return c.grammarErrorOnNode(parameter.Name(), diagnostics.An_index_signature_parameter_type_must_be_string_number_symbol_or_a_template_literal_type)
 * 	}
 * 	if node.Type == nil {
 * 		return c.grammarErrorOnNode(node.AsNode(), diagnostics.An_index_signature_must_have_a_type_annotation)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarIndexSignatureParameters(receiver: GoPtr<Checker>, node: GoPtr<IndexSignatureDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarIndexSignature","kind":"method","status":"implemented","sigHash":"f4c85d41a1aeef6724f9eaa1178d072ccc8b4b428c7e40aa8bc99487ea6e8fc5","bodyHash":"82c7484247a90e5e5914b79ed7a134420a1d6b0f3f1b55f764fb8be2da78ef2c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarIndexSignature(node *ast.IndexSignatureDeclaration) bool {
 * 	// Prevent cascading error by short-circuit
 * 	return c.checkGrammarModifiers(node.AsNode()) || c.checkGrammarIndexSignatureParameters(node)
 * }
 */
export declare function Checker_checkGrammarIndexSignature(receiver: GoPtr<Checker>, node: GoPtr<IndexSignatureDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForAtLeastOneTypeArgument","kind":"method","status":"implemented","sigHash":"fcbedb418a0e985b8eb57039e04c12907bb55567fdd86499bd2103086242b9a1","bodyHash":"68aade49e5aa318db13f11c7f28247b21599adb72c1b6fdc23f2649bfc5c25d5"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForAtLeastOneTypeArgument(node *ast.Node, typeArguments *ast.NodeList) bool {
 * 	if typeArguments != nil && len(typeArguments.Nodes) == 0 {
 * 		sourceFile := ast.GetSourceFileOfNode(node)
 * 		start := typeArguments.Pos() - len("<")
 * 		end := scanner.SkipTrivia(sourceFile.Text(), typeArguments.End()) + len(">")
 * 		return c.grammarErrorAtPos(sourceFile.AsNode(), start, end-start, diagnostics.Type_argument_list_cannot_be_empty)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForAtLeastOneTypeArgument(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeArguments: GoPtr<NodeList>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeArguments","kind":"method","status":"implemented","sigHash":"8a90235755408d44657bac57e6cc9800285dd139d038c27d5324bee1f13124ca","bodyHash":"bfef6639595660c25f27c8c9c1b62f6269602de33d16079d61d19aba5a7abf65"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeArguments(node *ast.Node, typeArguments *ast.NodeList) bool {
 * 	return c.checkGrammarForDisallowedTrailingComma(typeArguments, diagnostics.Trailing_comma_not_allowed) || c.checkGrammarForAtLeastOneTypeArgument(node, typeArguments)
 * }
 */
export declare function Checker_checkGrammarTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>, typeArguments: GoPtr<NodeList>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTaggedTemplateChain","kind":"method","status":"implemented","sigHash":"188b01ce1fdfda0d94d79eda4aec280e7fd9bdb72684b789a504fe8526796c78","bodyHash":"8168c582adce34621bc3ea08ef6c319403716d63737ca013bac0959889a483ad"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTaggedTemplateChain(node *ast.TaggedTemplateExpression) bool {
 * 	if node.QuestionDotToken != nil || node.Flags&ast.NodeFlagsOptionalChain != 0 {
 * 		return c.grammarErrorOnNode(node.Template, diagnostics.Tagged_template_expressions_are_not_permitted_in_an_optional_chain)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarTaggedTemplateChain(receiver: GoPtr<Checker>, node: GoPtr<TaggedTemplateExpression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarHeritageClause","kind":"method","status":"implemented","sigHash":"123b8fb0790f9d6f266d85a2b84e7ad075b6494d978395ac2015eafe83cca003","bodyHash":"9136aab077f29ab5537410e30027b1d9a623eb122c69a05b5f2188738bd32215"}
 *
 * Go source:
 * func (c *Checker) checkGrammarHeritageClause(node *ast.HeritageClause) bool {
 * 	types := node.Types
 * 	if c.checkGrammarForDisallowedTrailingComma(types, diagnostics.Trailing_comma_not_allowed) {
 * 		return true
 * 	}
 * 	if types != nil && len(types.Nodes) == 0 {
 * 		listType := scanner.TokenToString(node.Token)
 * 		// TODO(danielr): why not error on the token?
 * 		return c.grammarErrorAtPos(node.AsNode(), types.Pos(), 0, diagnostics.X_0_list_cannot_be_empty, listType)
 * 	}
 *
 * 	for _, node := range types.Nodes { //nolint:modernize
 * 		if c.checkGrammarExpressionWithTypeArguments(node) {
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarHeritageClause(receiver: GoPtr<Checker>, node: GoPtr<HeritageClause>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"af6e2eff9c43401e230029def29304e11ed9f61ae6cc473a3bc52c69964b4789","bodyHash":"8ec334978dfb08f4957c60401cbdf0d6a68b09f511b5819a3900c92b7a2d8d5e"}
 *
 * Go source:
 * func (c *Checker) checkGrammarExpressionWithTypeArguments(node *ast.Node /*Union[ExpressionWithTypeArguments, TypeQuery]* /) bool {
 * 	if ast.IsExpressionWithTypeArguments(node) && node.Expression().Kind == ast.KindImportKeyword && node.TypeArgumentList() != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments)
 * 	}
 * 	return c.checkGrammarTypeArguments(node, node.TypeArgumentList())
 * }
 */
export declare function Checker_checkGrammarExpressionWithTypeArguments(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarClassDeclarationHeritageClauses","kind":"method","status":"implemented","sigHash":"c6081052108d5899f0301c930f47c21933a6f8f94cfe1a4316b370536d1cb3a5","bodyHash":"d517a586e6c8baca640866258aa2714b230d333247d7c8055bf37c3bf4f67349"}
 *
 * Go source:
 * func (c *Checker) checkGrammarClassDeclarationHeritageClauses(node *ast.ClassLikeDeclaration, file *ast.SourceFile) bool {
 * 	seenExtendsClause := false
 * 	seenImplementsClause := false
 *
 * 	classLikeData := node.ClassLikeData()
 *
 * 	if !c.checkGrammarModifiers(node) && classLikeData.HeritageClauses != nil {
 * 		for _, heritageClauseNode := range classLikeData.HeritageClauses.Nodes {
 * 			heritageClause := heritageClauseNode.AsHeritageClause()
 * 			if heritageClause.Token == ast.KindExtendsKeyword {
 * 				if seenExtendsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_already_seen)
 * 				}
 *
 * 				if seenImplementsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_must_precede_implements_clause)
 * 				}
 *
 * 				typeNodes := heritageClause.Types.Nodes
 * 				if len(typeNodes) > 1 {
 * 					return c.grammarErrorOnFirstToken(typeNodes[1], diagnostics.Classes_can_only_extend_a_single_class)
 * 				}
 *
 * 				if len(typeNodes) > 0 {
 * 					for _, j := range node.EagerJSDoc(file) {
 * 						if j.AsJSDoc().Tags == nil {
 * 							continue
 * 						}
 * 						for _, tag := range j.AsJSDoc().Tags.Nodes {
 * 							if tag.Kind == ast.KindJSDocAugmentsTag {
 * 								target := typeNodes[0].AsExpressionWithTypeArguments()
 * 								source := tag.ClassName().AsExpressionWithTypeArguments()
 * 								targetName := getIdentifierFromEntityNameExpression(target.Expression)
 * 								sourceName := getIdentifierFromEntityNameExpression(source.Expression)
 * 								if targetName != nil && sourceName != nil && targetName.Text() != sourceName.Text() {
 * 									return c.grammarErrorOnNode(sourceName, diagnostics.JSDoc_0_1_does_not_match_the_extends_2_clause, tag.TagName().Text(), sourceName.Text(), targetName.Text())
 * 								}
 * 							}
 * 						}
 * 					}
 * 				}
 * 				seenExtendsClause = true
 * 			} else {
 * 				if heritageClause.Token != ast.KindImplementsKeyword {
 * 					panic(fmt.Sprintf("Unexpected token %q", heritageClause.Token))
 * 				}
 * 				if seenImplementsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_implements_clause_already_seen)
 * 				}
 *
 * 				seenImplementsClause = true
 * 			}
 *
 * 			// Grammar checking heritageClause inside class declaration
 * 			c.checkGrammarHeritageClause(heritageClause)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarClassDeclarationHeritageClauses(receiver: GoPtr<Checker>, node: GoPtr<ClassLikeDeclaration>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarInterfaceDeclaration","kind":"method","status":"implemented","sigHash":"c9b54167c596379eae7c93fe642627266fa2c134ee4008edabc92329f73050e6","bodyHash":"ef89e20fe1cba09c23ee91640e246e8f6f93327eec6f53114c0b82b648a8edc0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarInterfaceDeclaration(node *ast.InterfaceDeclaration) bool {
 * 	if node.HeritageClauses != nil {
 * 		seenExtendsClause := false
 * 		for _, heritageClauseNode := range node.HeritageClauses.Nodes {
 * 			heritageClause := heritageClauseNode.AsHeritageClause()
 *
 * 			switch heritageClause.Token {
 * 			case ast.KindExtendsKeyword:
 * 				if seenExtendsClause {
 * 					return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.X_extends_clause_already_seen)
 * 				}
 * 				seenExtendsClause = true
 * 			case ast.KindImplementsKeyword:
 * 				return c.grammarErrorOnFirstToken(heritageClauseNode, diagnostics.Interface_declaration_cannot_have_implements_clause)
 * 			default:
 * 				panic(fmt.Sprintf("Unexpected token %q", heritageClause.Token.String()))
 * 			}
 *
 * 			// Grammar checking heritageClause inside class declaration
 * 			c.checkGrammarHeritageClause(heritageClause)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarInterfaceDeclaration(receiver: GoPtr<Checker>, node: GoPtr<InterfaceDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarComputedPropertyName","kind":"method","status":"implemented","sigHash":"5e0329796e2bfc37ebb51cde9c5823f23cd2988bb8fd365239b6cebc9605a1a3","bodyHash":"8b26ca8e08f0493f323cf111b35d54b18be8f69ba2ee6f2a5dab853b3e8ac6e9"}
 *
 * Go source:
 * func (c *Checker) checkGrammarComputedPropertyName(node *ast.Node) bool {
 * 	// If node is not a computedPropertyName, just skip the grammar checking
 * 	if node.Kind != ast.KindComputedPropertyName {
 * 		return false
 * 	}
 *
 * 	computedPropertyName := node.AsComputedPropertyName()
 * 	if computedPropertyName.Expression.Kind == ast.KindBinaryExpression && computedPropertyName.Expression.AsBinaryExpression().OperatorToken.Kind == ast.KindCommaToken {
 * 		return c.grammarErrorOnNode(computedPropertyName.Expression, diagnostics.A_comma_expression_is_not_allowed_in_a_computed_property_name)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarComputedPropertyName(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForGenerator","kind":"method","status":"implemented","sigHash":"21bf494af82f009b66f87db069de7394afd1c3d3a2a4cc3c3f65c8155e08f2eb","bodyHash":"702fc60f1bab8fda929c0622d4fe857a02ac8b5a1fa87ff3d39f7f3f382ca707"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForGenerator(node *ast.Node) bool {
 * 	if bodyData := node.BodyData(); bodyData != nil && bodyData.AsteriskToken != nil {
 * 		if node.Kind != ast.KindFunctionDeclaration && node.Kind != ast.KindFunctionExpression && node.Kind != ast.KindMethodDeclaration {
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.grammarErrorOnNode(bodyData.AsteriskToken, diagnostics.Generators_are_not_allowed_in_an_ambient_context)
 * 		}
 * 		if bodyData.Body == nil {
 * 			return c.grammarErrorOnNode(bodyData.AsteriskToken, diagnostics.An_overload_signature_cannot_be_declared_as_a_generator)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForGenerator(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidQuestionMark","kind":"method","status":"implemented","sigHash":"32e35056d76e9e25f5e2712a0b074ce4bb73efba032e04cb94d590227ecc9b7d","bodyHash":"4c288ecc93f38f277248b5e63670cf82083ec91efd273b04e33e39edde861891"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidQuestionMark(postfixToken *ast.TokenNode, message *diagnostics.Message) bool {
 * 	return postfixToken != nil && postfixToken.Kind == ast.KindQuestionToken && c.grammarErrorOnNode(postfixToken, message)
 * }
 */
export declare function Checker_checkGrammarForInvalidQuestionMark(receiver: GoPtr<Checker>, postfixToken: GoPtr<TokenNode>, message: GoPtr<Message>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidExclamationToken","kind":"method","status":"implemented","sigHash":"568a113bf327b24ebea7f0c6544237efac47eddf6357c196a6590f666ed149a9","bodyHash":"bb882157f738777bc861b5678c786e5316b8516598f4697cdd722af0527771d2"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidExclamationToken(postfixToken *ast.TokenNode, message *diagnostics.Message) bool {
 * 	return postfixToken != nil && postfixToken.Kind == ast.KindExclamationToken && c.grammarErrorOnNode(postfixToken, message)
 * }
 */
export declare function Checker_checkGrammarForInvalidExclamationToken(receiver: GoPtr<Checker>, postfixToken: GoPtr<TokenNode>, message: GoPtr<Message>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarObjectLiteralExpression","kind":"method","status":"implemented","sigHash":"a9c196863e38cf676b534b07fda26c6972ce8786ba7e4da201eed68f8df63b2c","bodyHash":"52d0467ef4fd3442402287687a5bbb8134f7cc34ed02a9fd7299cfeb0bd40c9b"}
 *
 * Go source:
 * func (c *Checker) checkGrammarObjectLiteralExpression(node *ast.ObjectLiteralExpression, inDestructuring bool) bool {
 * 	seen := make(map[string]DeclarationMeaning)
 *
 * 	var properties []*ast.Node
 * 	if node.Properties != nil {
 * 		properties = node.Properties.Nodes
 * 	}
 * 	for _, prop := range properties {
 * 		if prop.Kind == ast.KindSpreadAssignment {
 * 			spreadAssignment := prop.AsSpreadAssignment()
 * 			if inDestructuring {
 * 				// a rest property cannot be destructured any further
 * 				expression := ast.SkipParentheses(spreadAssignment.Expression)
 * 				if ast.IsArrayLiteralExpression(expression) || ast.IsObjectLiteralExpression(expression) {
 * 					return c.grammarErrorOnNode(spreadAssignment.Expression, diagnostics.A_rest_element_cannot_contain_a_binding_pattern)
 * 				}
 * 			}
 * 			continue
 * 		}
 * 		name := prop.Name()
 * 		if name.Kind == ast.KindComputedPropertyName {
 * 			// If the name is not a ComputedPropertyName, the grammar checking will skip it
 * 			c.checkGrammarComputedPropertyName(name)
 * 		}
 *
 * 		if prop.Kind == ast.KindShorthandPropertyAssignment && !inDestructuring {
 * 			shorthandProp := prop.AsShorthandPropertyAssignment()
 * 			if shorthandProp.ObjectAssignmentInitializer != nil {
 * 				// having objectAssignmentInitializer is only valid in an ObjectAssignmentPattern.
 * 				// Outside of destructuring, it is a syntax error.
 *
 * 				// Try to grab the last node prior to the initializer,
 * 				// then error on the first token following (which should be the `=` token).
 * 				var lastNodeBeforeInitializer *ast.Node
 * 				shorthandProp.ForEachChild(func(child *ast.Node) bool {
 * 					if child != shorthandProp.ObjectAssignmentInitializer {
 * 						lastNodeBeforeInitializer = child
 * 						return false
 * 					}
 * 					return true
 * 				})
 *
 * 				c.grammarErrorOnFirstToken(lastNodeBeforeInitializer, diagnostics.Did_you_mean_to_use_a_Colon_An_can_only_follow_a_property_name_when_the_containing_object_literal_is_part_of_a_destructuring_pattern)
 * 			}
 * 		}
 *
 * 		if name.Kind == ast.KindPrivateIdentifier {
 * 			c.grammarErrorOnNode(name, diagnostics.Private_identifiers_are_not_allowed_outside_class_bodies)
 * 		}
 *
 * 		// Modifiers are never allowed on properties except for 'async' on a method declaration
 * 		if modifiers := prop.ModifierNodes(); len(modifiers) != 0 {
 * 			if ast.CanHaveModifiers(prop) {
 * 				for _, mod := range modifiers {
 * 					if ast.IsModifier(mod) && (mod.Kind != ast.KindAsyncKeyword || prop.Kind != ast.KindMethodDeclaration) {
 * 						c.grammarErrorOnNode(mod, diagnostics.X_0_modifier_cannot_be_used_here, scanner.GetTextOfNode(mod))
 * 					}
 * 				}
 * 			} else if ast.CanHaveIllegalModifiers(prop) {
 * 				for _, mod := range modifiers {
 * 					if ast.IsModifier(mod) {
 * 						c.grammarErrorOnNode(mod, diagnostics.X_0_modifier_cannot_be_used_here, scanner.GetTextOfNode(mod))
 * 					}
 * 				}
 * 			}
 * 		}
 *
 * 		// ECMA-262 11.1.5 Object Initializer
 * 		// If previous is not undefined then throw a SyntaxError exception if any of the following conditions are true
 * 		// a.This production is contained in strict code and IsDataDescriptor(previous) is true and
 * 		// IsDataDescriptor(propId.descriptor) is true.
 * 		//    b.IsDataDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true.
 * 		//    c.IsAccessorDescriptor(previous) is true and IsDataDescriptor(propId.descriptor) is true.
 * 		//    d.IsAccessorDescriptor(previous) is true and IsAccessorDescriptor(propId.descriptor) is true
 * 		// and either both previous and propId.descriptor have[[Get]] fields or both previous and propId.descriptor have[[Set]] fields
 * 		var currentKind DeclarationMeaning
 * 		switch prop.Kind {
 * 		case ast.KindShorthandPropertyAssignment,
 * 			ast.KindPropertyAssignment:
 * 			var commonProp *ast.NamedMemberBase
 * 			if prop.Kind == ast.KindShorthandPropertyAssignment {
 * 				prop.ClassLikeData()
 * 				commonProp = &prop.AsShorthandPropertyAssignment().NamedMemberBase
 * 			} else {
 * 				commonProp = &prop.AsPropertyAssignment().NamedMemberBase
 * 			}
 *
 * 			// Grammar checking for computedPropertyName and shorthandPropertyAssignment
 * 			c.checkGrammarForInvalidExclamationToken(commonProp.PostfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context)
 * 			c.checkGrammarForInvalidQuestionMark(commonProp.PostfixToken, diagnostics.An_object_member_cannot_be_declared_optional)
 *
 * 			if name.Kind == ast.KindNumericLiteral {
 * 				c.checkGrammarNumericLiteral(name.AsNumericLiteral())
 * 			}
 *
 * 			if name.Kind == ast.KindBigIntLiteral {
 * 				c.addErrorOrSuggestion(true, createDiagnosticForNode(name, diagnostics.A_bigint_literal_cannot_be_used_as_a_property_name))
 * 			}
 *
 * 			currentKind = DeclarationMeaningPropertyAssignment
 * 		case ast.KindMethodDeclaration:
 * 			currentKind = DeclarationMeaningMethod
 * 		case ast.KindGetAccessor:
 * 			currentKind = DeclarationMeaningGetAccessor
 * 		case ast.KindSetAccessor:
 * 			currentKind = DeclarationMeaningSetAccessor
 * 		default:
 * 			panic(fmt.Sprintf("Unexpected node kind %q", prop.Kind))
 * 		}
 *
 * 		if !inDestructuring {
 * 			effectiveName, ok := c.getEffectivePropertyNameForPropertyNameNode(name)
 * 			if !ok {
 * 				continue
 * 			}
 *
 * 			existingKind := seen[effectiveName]
 * 			if existingKind == 0 {
 * 				seen[effectiveName] = currentKind
 * 			} else {
 * 				if (currentKind&DeclarationMeaningMethod != 0) && (existingKind&DeclarationMeaningMethod != 0) {
 * 					c.grammarErrorOnNode(name, diagnostics.Duplicate_identifier_0, scanner.GetTextOfNode(name))
 * 				} else if (currentKind&DeclarationMeaningPropertyAssignment != 0) && (existingKind&DeclarationMeaningPropertyAssignment != 0) {
 * 					c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_multiple_properties_with_the_same_name, scanner.GetTextOfNode(name))
 * 				} else if (currentKind&DeclarationMeaningGetOrSetAccessor != 0) && (existingKind&DeclarationMeaningGetOrSetAccessor != 0) {
 * 					if existingKind != DeclarationMeaningGetOrSetAccessor && currentKind != existingKind {
 * 						seen[effectiveName] = currentKind | existingKind
 * 					} else {
 * 						return c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_multiple_get_Slashset_accessors_with_the_same_name)
 * 					}
 * 				} else {
 * 					return c.grammarErrorOnNode(name, diagnostics.An_object_literal_cannot_have_property_and_accessor_with_the_same_name)
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarObjectLiteralExpression(receiver: GoPtr<Checker>, node: GoPtr<ObjectLiteralExpression>, inDestructuring: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxElement","kind":"method","status":"implemented","sigHash":"158066c7c61bf24195d7ba706ceb7109a5532cc48c7bb1d119eccd852d7920aa","bodyHash":"5f7a8fd88f75114a89c11c89176f8a17e0c7a275d2830028cdb3b5aabeaa91e4"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxElement(node *ast.Node) bool {
 * 	c.checkGrammarJsxName(node.TagName())
 * 	c.checkGrammarTypeArguments(node, node.TypeArgumentList())
 * 	var seen collections.Set[string]
 * 	for _, attrNode := range node.Attributes().Properties() {
 * 		if attrNode.Kind == ast.KindJsxSpreadAttribute {
 * 			continue
 * 		}
 * 		attr := attrNode.AsJsxAttribute()
 * 		name := attr.Name()
 * 		initializer := attr.Initializer
 * 		textOfName := name.Text()
 * 		if !seen.Has(textOfName) {
 * 			seen.Add(textOfName)
 * 		} else {
 * 			return c.grammarErrorOnNode(name, diagnostics.JSX_elements_cannot_have_multiple_attributes_with_the_same_name)
 * 		}
 * 		if initializer != nil && initializer.Kind == ast.KindJsxExpression && initializer.Expression() == nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.JSX_attributes_must_only_be_assigned_a_non_empty_expression)
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarJsxElement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxName","kind":"method","status":"implemented","sigHash":"81f6096d6b28ad09cd5d3d4b96cd7fe0f6ebe37340724846a93e208e28a3277f","bodyHash":"c11b03d5fa0b6aca8c13f3adba5c8a52ebcc58be8da2c5f29fa0aace41eb1c3f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxName(node *ast.JsxTagNameExpression) bool {
 * 	if ast.IsPropertyAccessExpression(node) && ast.IsJsxNamespacedName(node.Expression()) {
 * 		return c.grammarErrorOnNode(node.Expression(), diagnostics.JSX_property_access_expressions_cannot_include_JSX_namespace_names)
 * 	}
 *
 * 	if ast.IsJsxNamespacedName(node) && c.compilerOptions.GetJSXTransformEnabled() && !scanner.IsIntrinsicJsxName(node.AsJsxNamespacedName().Namespace.Text()) {
 * 		return c.grammarErrorOnNode(node, diagnostics.React_components_cannot_include_JSX_namespace_names)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarJsxName(receiver: GoPtr<Checker>, node: GoPtr<JsxTagNameExpression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarJsxExpression","kind":"method","status":"implemented","sigHash":"b7b40bab6bd76f6ae891fc5a0eb17f5424f2d491683a1f1da42ae0937e2a236b","bodyHash":"2a5d71c6da465a99bea20524c7beb2a43cfe7eecacaf28ff6e368701b7b4f597"}
 *
 * Go source:
 * func (c *Checker) checkGrammarJsxExpression(node *ast.JsxExpression) bool {
 * 	if node.Expression != nil && ast.IsCommaSequence(node.Expression) {
 * 		return c.grammarErrorOnNode(node.Expression, diagnostics.JSX_expressions_may_not_use_the_comma_operator_Did_you_mean_to_write_an_array)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarJsxExpression(receiver: GoPtr<Checker>, node: GoPtr<JsxExpression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInOrForOfStatement","kind":"method","status":"implemented","sigHash":"ffbcc9e0df95aca13d0bca755617f2ce69a0ef9246b0a313c6372abd322912c3","bodyHash":"94a99486e3c003feb16880c86caa8bd8656aca414b57b1010f7048a3789f27e7"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInOrForOfStatement(forInOrOfStatement *ast.ForInOrOfStatement) bool {
 * 	asNode := forInOrOfStatement.AsNode()
 * 	if c.checkGrammarStatementInAmbientContext(asNode) {
 * 		return true
 * 	}
 *
 * 	if forInOrOfStatement.Kind == ast.KindForOfStatement && forInOrOfStatement.AwaitModifier != nil {
 * 		if forInOrOfStatement.Flags&ast.NodeFlagsAwaitContext == 0 {
 * 			sourceFile := ast.GetSourceFileOfNode(asNode)
 * 			if ast.IsInTopLevelContext(asNode) {
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					if !ast.IsEffectiveExternalModule(sourceFile, c.compilerOptions) {
 * 						c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.X_for_await_loops_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module))
 * 					}
 * 					switch c.moduleKind {
 * 					case core.ModuleKindNode16, core.ModuleKindNode18, core.ModuleKindNode20, core.ModuleKindNodeNext:
 * 						sourceFileMetaData := c.program.GetSourceFileMetaData(sourceFile.Path())
 * 						if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindCommonJS {
 * 							c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level))
 * 							break
 * 						}
 * 						fallthrough
 * 					case core.ModuleKindES2022,
 * 						core.ModuleKindESNext,
 * 						core.ModuleKindPreserve,
 * 						core.ModuleKindSystem:
 * 						if c.languageVersion >= core.ScriptTargetES2017 {
 * 							break
 * 						}
 * 						fallthrough
 * 					default:
 * 						c.addDiagnostic(createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.Top_level_for_await_loops_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher))
 * 					}
 * 				}
 * 			} else {
 * 				// use of 'for-await-of' in non-async function
 * 				if !c.hasParseDiagnostics(sourceFile) {
 * 					diagnostic := createDiagnosticForNode(forInOrOfStatement.AwaitModifier, diagnostics.X_for_await_loops_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules)
 * 					containingFunc := ast.GetContainingFunction(forInOrOfStatement.AsNode())
 * 					if containingFunc != nil && containingFunc.Kind != ast.KindConstructor {
 * 						debug.Assert((ast.GetFunctionFlags(containingFunc)&ast.FunctionFlagsAsync) == 0, "Enclosing function should never be an async function.")
 * 						relatedInfo := createDiagnosticForNode(containingFunc, diagnostics.Did_you_mean_to_mark_this_function_as_async)
 * 						diagnostic.AddRelatedInfo(relatedInfo)
 * 					}
 * 					c.addDiagnostic(diagnostic)
 * 					return true
 * 				}
 * 			}
 * 		}
 * 	}
 *
 * 	if ast.IsForOfStatement(asNode) && forInOrOfStatement.Flags&ast.NodeFlagsAwaitContext == 0 && ast.IsIdentifier(forInOrOfStatement.Initializer) && forInOrOfStatement.Initializer.Text() == "async" {
 * 		c.grammarErrorOnNode(forInOrOfStatement.Initializer, diagnostics.The_left_hand_side_of_a_for_of_statement_may_not_be_async)
 * 		return false
 * 	}
 *
 * 	if forInOrOfStatement.Initializer.Kind == ast.KindVariableDeclarationList {
 * 		variableList := forInOrOfStatement.Initializer.AsVariableDeclarationList()
 * 		if !c.checkGrammarVariableDeclarationList(variableList) {
 * 			declarations := variableList.Declarations
 *
 * 			// declarations.length can be zero if there is an error in variable declaration in for-of or for-in
 * 			// See http://www.ecma-international.org/ecma-262/6.0/#sec-for-in-and-for-of-statements for details
 * 			// For example:
 * 			//      var let = 10;
 * 			//      for (let of [1,2,3]) {} // this is invalid ES6 syntax
 * 			//      for (let in [1,2,3]) {} // this is invalid ES6 syntax
 * 			// We will then want to skip on grammar checking on variableList declaration
 * 			if len(declarations.Nodes) == 0 {
 * 				return false
 * 			}
 *
 * 			if len(declarations.Nodes) > 1 {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_in_statement
 * 				} else {
 * 					diagnostic = diagnostics.Only_a_single_variable_declaration_is_allowed_in_a_for_of_statement
 * 				}
 * 				return c.grammarErrorOnFirstToken(declarations.Nodes[1], diagnostic)
 * 			}
 *
 * 			firstVariableDeclaration := declarations.Nodes[0].AsVariableDeclaration()
 * 			if firstVariableDeclaration.Initializer != nil {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.The_variable_declaration_of_a_for_in_statement_cannot_have_an_initializer
 * 				} else {
 * 					diagnostic = diagnostics.The_variable_declaration_of_a_for_of_statement_cannot_have_an_initializer
 * 				}
 * 				return c.grammarErrorOnNode(firstVariableDeclaration.Name(), diagnostic)
 * 			}
 * 			if firstVariableDeclaration.Type != nil {
 * 				var diagnostic *diagnostics.Message
 * 				if forInOrOfStatement.Kind == ast.KindForInStatement {
 * 					diagnostic = diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_use_a_type_annotation
 * 				} else {
 * 					diagnostic = diagnostics.The_left_hand_side_of_a_for_of_statement_cannot_use_a_type_annotation
 * 				}
 * 				return c.grammarErrorOnNode(firstVariableDeclaration.AsNode(), diagnostic)
 * 			}
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForInOrForOfStatement(receiver: GoPtr<Checker>, forInOrOfStatement: GoPtr<ForInOrOfStatement>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAccessor","kind":"method","status":"implemented","sigHash":"485959dd2d0d94678b3f779984008f26ef7f12b135d3e7b4d0d41f2c96fd9147","bodyHash":"1a7a43297a53c032b38c8bc00a43e09a2a1231432ac75d5f158c09770619b390"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAccessor(accessor *ast.AccessorDeclaration) bool {
 * 	body := accessor.Body()
 * 	if accessor.Flags&ast.NodeFlagsAmbient == 0 && (accessor.Parent.Kind != ast.KindTypeLiteral) && (accessor.Parent.Kind != ast.KindInterfaceDeclaration) {
 * 		if body == nil && !ast.HasSyntacticModifier(accessor, ast.ModifierFlagsAbstract) {
 * 			return c.grammarErrorAtPos(accessor, accessor.End()-1, len(";"), diagnostics.X_0_expected, "{")
 * 		}
 * 	}
 * 	if body != nil {
 * 		if ast.HasSyntacticModifier(accessor, ast.ModifierFlagsAbstract) {
 * 			return c.grammarErrorOnNode(accessor, diagnostics.An_abstract_accessor_cannot_have_an_implementation)
 * 		}
 * 		if accessor.Parent.Kind == ast.KindTypeLiteral || accessor.Parent.Kind == ast.KindInterfaceDeclaration {
 * 			return c.grammarErrorOnNode(body, diagnostics.An_implementation_cannot_be_declared_in_ambient_contexts)
 * 		}
 * 	}
 *
 * 	funcData := accessor.FunctionLikeData()
 * 	var typeParameters *ast.NodeList
 * 	if funcData != nil {
 * 		typeParameters = funcData.TypeParameters
 * 	}
 *
 * 	if typeParameters != nil {
 * 		return c.grammarErrorOnNode(accessor.Name(), diagnostics.An_accessor_cannot_have_type_parameters)
 * 	}
 * 	if !c.doesAccessorHaveCorrectParameterCount(accessor) {
 * 		return c.grammarErrorOnNode(accessor.Name(), core.IfElse(accessor.Kind == ast.KindGetAccessor, diagnostics.A_get_accessor_cannot_have_parameters, diagnostics.A_set_accessor_must_have_exactly_one_parameter))
 * 	}
 * 	if accessor.Kind == ast.KindSetAccessor {
 * 		if funcData.Type != nil {
 * 			return c.grammarErrorOnNode(accessor.Name(), diagnostics.A_set_accessor_cannot_have_a_return_type_annotation)
 * 		}
 *
 * 		parameterNode := GetSetAccessorValueParameter(accessor)
 * 		if parameterNode == nil {
 * 			panic("Return value does not match parameter count assertion.")
 * 		}
 * 		parameter := parameterNode.AsParameterDeclaration()
 * 		if parameter.DotDotDotToken != nil {
 * 			return c.grammarErrorOnNode(parameter.DotDotDotToken, diagnostics.A_set_accessor_cannot_have_rest_parameter)
 * 		}
 * 		if parameter.QuestionToken != nil {
 * 			return c.grammarErrorOnNode(parameter.QuestionToken, diagnostics.A_set_accessor_cannot_have_an_optional_parameter)
 * 		}
 * 		if parameter.Initializer != nil {
 * 			return c.grammarErrorOnNode(accessor.Name(), diagnostics.A_set_accessor_parameter_cannot_have_an_initializer)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarAccessor(receiver: GoPtr<Checker>, accessor: GoPtr<AccessorDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.doesAccessorHaveCorrectParameterCount","kind":"method","status":"implemented","sigHash":"e5c96ffc7430da9e5c0b0d33f2df94cf71cac9f5c841eaf08a33966d49f29e8d","bodyHash":"4a01315ba14e780a76e2322ac05e6f807ec75bc6db8e54981cbe85bf1daae05d"}
 *
 * Go source:
 * func (c *Checker) doesAccessorHaveCorrectParameterCount(accessor *ast.AccessorDeclaration) bool {
 * 	// `getAccessorThisParameter` returns `nil` if the accessor's arity is incorrect,
 * 	// even if there is a `this` parameter declared.
 * 	return c.getAccessorThisParameter(accessor) != nil || len(accessor.Parameters()) == core.IfElse(accessor.Kind == ast.KindGetAccessor, 0, 1)
 * }
 */
export declare function Checker_doesAccessorHaveCorrectParameterCount(receiver: GoPtr<Checker>, accessor: GoPtr<AccessorDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeOperatorNode","kind":"method","status":"implemented","sigHash":"acba5f71399d83e8554d2b439a99aeeb66fbd0a9c86cc36e499968330a5d1250","bodyHash":"c4f2802a6143c303ff842e41380e6728bb12377869c477dfe79584482756af4f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeOperatorNode(node *ast.TypeOperatorNode) bool {
 * 	if node.Operator == ast.KindUniqueKeyword {
 * 		innerType := node.Type
 * 		if innerType.Kind != ast.KindSymbolKeyword {
 * 			return c.grammarErrorOnNode(innerType, diagnostics.X_0_expected, scanner.TokenToString(ast.KindSymbolKeyword))
 * 		}
 * 		parent := ast.WalkUpParenthesizedTypes(node.Parent)
 * 		switch parent.Kind {
 * 		case ast.KindVariableDeclaration:
 * 			decl := parent.AsVariableDeclaration()
 * 			if decl.Name().Kind != ast.KindIdentifier {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_may_not_be_used_on_a_variable_declaration_with_a_binding_name)
 * 			}
 * 			if !isVariableDeclarationInVariableStatement(decl.AsNode()) {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_are_only_allowed_on_variables_in_a_variable_statement)
 * 			}
 * 			if decl.Parent.Flags&ast.NodeFlagsConst == 0 {
 * 				return c.grammarErrorOnNode(parent.AsVariableDeclaration().Name(), diagnostics.A_variable_whose_type_is_a_unique_symbol_type_must_be_const)
 * 			}
 * 		case ast.KindPropertyDeclaration:
 * 			if !ast.IsStatic(parent) || !hasReadonlyModifier(parent) {
 * 				return c.grammarErrorOnNode(parent.AsPropertyDeclaration().Name(), diagnostics.A_property_of_a_class_whose_type_is_a_unique_symbol_type_must_be_both_static_and_readonly)
 * 			}
 * 		case ast.KindPropertySignature:
 * 			if !ast.HasSyntacticModifier(parent, ast.ModifierFlagsReadonly) {
 * 				return c.grammarErrorOnNode(parent.AsPropertySignatureDeclaration().Name(), diagnostics.A_property_of_an_interface_or_type_literal_whose_type_is_a_unique_symbol_type_must_be_readonly)
 * 			}
 * 		default:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_unique_symbol_types_are_not_allowed_here)
 * 		}
 * 	} else if node.Operator == ast.KindReadonlyKeyword {
 * 		innerType := node.Type
 * 		if innerType.Kind != ast.KindArrayType && innerType.Kind != ast.KindTupleType {
 * 			return c.grammarErrorOnFirstToken(node.AsNode(), diagnostics.X_readonly_type_modifier_is_only_permitted_on_array_and_tuple_literal_types, scanner.TokenToString(ast.KindSymbolKeyword))
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarTypeOperatorNode(receiver: GoPtr<Checker>, node: GoPtr<TypeOperatorNode>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForInvalidDynamicName","kind":"method","status":"implemented","sigHash":"1b94d484de7b4593d45ea103742133b2b7368240f1f16c848607f82da5475454","bodyHash":"aa939e4f1ad719cf21c1786256f9deab2fb7810a6a88be68e77d5d510b28a082"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForInvalidDynamicName(node *ast.DeclarationName, message *diagnostics.Message) bool {
 * 	if !c.isNonBindableDynamicName(node) {
 * 		return false
 * 	}
 * 	var expression *ast.Node
 * 	if ast.IsElementAccessExpression(node) {
 * 		expression = ast.SkipParentheses(node.AsElementAccessExpression().ArgumentExpression)
 * 	} else {
 * 		expression = node.Expression()
 * 	}
 *
 * 	if !ast.IsEntityNameExpression(expression) {
 * 		return c.grammarErrorOnNode(node, message)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForInvalidDynamicName(receiver: GoPtr<Checker>, node: GoPtr<DeclarationName>, message: GoPtr<Message>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.isNonBindableDynamicName","kind":"method","status":"implemented","sigHash":"78a08b7566c0f2c67c6735ac46f524fca42d763f9e7c69bf7fc3c1823ebce0fc","bodyHash":"d62587a50c67d3624b4a94b787c2f506a4d6ce0bb26206cc271d6e5a35780b31"}
 *
 * Go source:
 * func (c *Checker) isNonBindableDynamicName(node *ast.DeclarationName) bool {
 * 	return ast.IsDynamicName(node) && !c.isLateBindableName(node)
 * }
 */
export declare function Checker_isNonBindableDynamicName(receiver: GoPtr<Checker>, node: GoPtr<DeclarationName>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMethod","kind":"method","status":"implemented","sigHash":"1fb71c827079f43c3953cf62fe1d2b58004836d3a49de2c39bd4686743b58b18","bodyHash":"2e902d2f8a4a3208718f0bdfe4e0f441508490e1d3db11793fdc99d0161e1264"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMethod(node *ast.Node /*Union[MethodDeclaration, MethodSignature]* /) bool {
 * 	if c.checkGrammarFunctionLikeDeclaration(node) {
 * 		return true
 * 	}
 *
 * 	if node.Kind == ast.KindMethodDeclaration {
 * 		if node.Parent.Kind == ast.KindObjectLiteralExpression {
 * 			// We only disallow modifier on a method declaration if it is a property of object-literal-expression
 * 			if modifiers := node.Modifiers(); modifiers != nil && !(len(modifiers.Nodes) == 1 && modifiers.Nodes[0].Kind == ast.KindAsyncKeyword) {
 * 				return c.grammarErrorOnFirstToken(node, diagnostics.Modifiers_cannot_appear_here)
 * 			}
 *
 * 			methodDecl := node.AsMethodDeclaration()
 * 			if c.checkGrammarForInvalidQuestionMark(methodDecl.PostfixToken, diagnostics.An_object_member_cannot_be_declared_optional) {
 * 				return true
 * 			}
 * 			if c.checkGrammarForInvalidExclamationToken(methodDecl.PostfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context) {
 * 				return true
 * 			}
 * 			if node.Body() == nil {
 * 				return c.grammarErrorAtPos(node, node.End()-1, len(";"), diagnostics.X_0_expected, "{")
 * 			}
 * 		}
 * 		if c.checkGrammarForGenerator(node) {
 * 			return true
 * 		}
 * 	}
 *
 * 	if ast.IsClassLike(node.Parent) {
 * 		// Technically, computed properties in ambient contexts is disallowed
 * 		// for property declarations and accessors too, not just methods.
 * 		// However, property declarations disallow computed names in general,
 * 		// and accessors are not allowed in ambient contexts in general,
 * 		// so this error only really matters for methods.
 * 		if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_an_ambient_context_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 		} else if node.Kind == ast.KindMethodDeclaration && node.Body() == nil {
 * 			return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_method_overload_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 		}
 * 	} else if node.Parent.Kind == ast.KindInterfaceDeclaration {
 * 		return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 	} else if node.Parent.Kind == ast.KindTypeLiteral {
 * 		return c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarMethod(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBreakOrContinueStatement","kind":"method","status":"implemented","sigHash":"5268e6a388eb530764bcf9c46f79285d09b53a611ef8c3cf16748de4b0fe8bb6","bodyHash":"a363cf3795b9740fc3b8c516f2806d602ec5e6218f0f94d88473fbb7a0102b88"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBreakOrContinueStatement(node *ast.Node) bool {
 * 	targetLabel := node.Label()
 * 	var current *ast.Node = node
 * 	for current != nil {
 * 		if ast.IsFunctionLikeOrClassStaticBlockDeclaration(current) {
 * 			return c.grammarErrorOnNode(node, diagnostics.Jump_target_cannot_cross_function_boundary)
 * 		}
 *
 * 		switch current.Kind {
 * 		case ast.KindLabeledStatement:
 * 			if targetLabel != nil && current.Label().Text() == targetLabel.Text() {
 * 				// found matching label - verify that label usage is correct
 * 				// continue can only target labels that are on iteration statements
 * 				isMisplacedContinueLabel := node.Kind == ast.KindContinueStatement && !ast.IsIterationStatement(current.Statement(), true /*lookInLabeledStatements* /)
 *
 * 				if isMisplacedContinueLabel {
 * 					return c.grammarErrorOnNode(node, diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement)
 * 				}
 *
 * 				return false
 * 			}
 * 		case ast.KindSwitchStatement:
 * 			if node.Kind == ast.KindBreakStatement && targetLabel == nil {
 * 				// unlabeled break within switch statement - ok
 * 				return false
 * 			}
 * 		default:
 * 			if ast.IsIterationStatement(current, false /*lookInLabeledStatements* /) && targetLabel == nil {
 * 				// unlabeled break or continue within iteration statement - ok
 * 				return false
 * 			}
 * 		}
 *
 * 		current = current.Parent
 * 	}
 *
 * 	if targetLabel != nil {
 * 		var message *diagnostics.Message
 * 		if node.Kind == ast.KindBreakStatement {
 * 			message = diagnostics.A_break_statement_can_only_jump_to_a_label_of_an_enclosing_statement
 * 		} else {
 * 			message = diagnostics.A_continue_statement_can_only_jump_to_a_label_of_an_enclosing_iteration_statement
 * 		}
 *
 * 		return c.grammarErrorOnNode(node, message)
 * 	} else {
 * 		var message *diagnostics.Message
 * 		if node.Kind == ast.KindBreakStatement {
 * 			message = diagnostics.A_break_statement_can_only_be_used_within_an_enclosing_iteration_or_switch_statement
 * 		} else {
 * 			message = diagnostics.A_continue_statement_can_only_be_used_within_an_enclosing_iteration_statement
 * 		}
 * 		return c.grammarErrorOnNode(node, message)
 * 	}
 * }
 */
export declare function Checker_checkGrammarBreakOrContinueStatement(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBindingElement","kind":"method","status":"implemented","sigHash":"e7cc27eb47c93739a9e83a836b7c6333a7cdbc9eea15a075274e6a5ca0f7fec8","bodyHash":"bf5d48331b4c5c29fd419eb9bf1186613593870c36f194db13ce7b6178985de6"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBindingElement(node *ast.BindingElement) bool {
 * 	if node.DotDotDotToken != nil {
 * 		elements := node.Parent.ElementList()
 * 		if node.AsNode() != core.LastOrNil(elements.Nodes) {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.A_rest_element_must_be_last_in_a_destructuring_pattern)
 * 		}
 * 		c.checkGrammarForDisallowedTrailingComma(elements, diagnostics.A_rest_parameter_or_binding_pattern_may_not_have_a_trailing_comma)
 *
 * 		if node.PropertyName != nil {
 * 			return c.grammarErrorOnNode(node.Name(), diagnostics.A_rest_element_cannot_have_a_property_name)
 * 		}
 * 	}
 *
 * 	if node.DotDotDotToken != nil && node.Initializer != nil {
 * 		// Error on equals token which immediately precedes the initializer
 * 		return c.grammarErrorAtPos(node.AsNode(), node.Initializer.Pos()-1, 1, diagnostics.A_rest_element_cannot_have_an_initializer)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarBindingElement(receiver: GoPtr<Checker>, node: GoPtr<BindingElement>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarVariableDeclaration","kind":"method","status":"implemented","sigHash":"f3a10fbff1817b43c569529302272bf422e5a99bb942c00c2c2bbb47af3377b5","bodyHash":"5ebe409076641cfc37baa23afe31c702d034d7766c3e3d252049edf3e173f270"}
 *
 * Go source:
 * func (c *Checker) checkGrammarVariableDeclaration(node *ast.VariableDeclaration) bool {
 * 	nodeFlags := c.getCombinedNodeFlagsCached(node.AsNode())
 * 	blockScopeKind := nodeFlags & ast.NodeFlagsBlockScoped
 * 	if ast.IsBindingPattern(node.Name()) {
 * 		switch blockScopeKind {
 * 		case ast.NodeFlagsAwaitUsing:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_may_not_have_binding_patterns, "await using")
 * 		case ast.NodeFlagsUsing:
 * 			return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_may_not_have_binding_patterns, "using")
 * 		}
 * 	}
 *
 * 	if node.Parent.Parent.Kind != ast.KindForInStatement && node.Parent.Parent.Kind != ast.KindForOfStatement {
 * 		if nodeFlags&ast.NodeFlagsAmbient != 0 {
 * 			c.checkAmbientInitializer(node.AsNode())
 * 		} else if node.Initializer == nil {
 * 			if ast.IsBindingPattern(node.Name()) && !ast.IsBindingPattern(node.Parent) {
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.A_destructuring_declaration_must_have_an_initializer)
 * 			}
 * 			switch blockScopeKind {
 * 			case ast.NodeFlagsAwaitUsing:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "await using")
 * 			case ast.NodeFlagsUsing:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "using")
 * 			case ast.NodeFlagsConst:
 * 				return c.grammarErrorOnNode(node.AsNode(), diagnostics.X_0_declarations_must_be_initialized, "const")
 * 			}
 * 		}
 * 	}
 *
 * 	if node.ExclamationToken != nil && (node.Parent.Parent.Kind != ast.KindVariableStatement || node.Type == nil || node.Initializer != nil || nodeFlags&ast.NodeFlagsAmbient != 0) {
 * 		var message *diagnostics.Message
 * 		switch {
 * 		case node.Initializer != nil:
 * 			message = diagnostics.Declarations_with_initializers_cannot_also_have_definite_assignment_assertions
 * 		case node.Type == nil:
 * 			message = diagnostics.Declarations_with_definite_assignment_assertions_must_also_have_type_annotations
 * 		default:
 * 			message = diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context
 * 		}
 * 		return c.grammarErrorOnNode(node.ExclamationToken, message)
 * 	}
 *
 * 	if c.program.GetEmitModuleFormatOfFile(ast.GetSourceFileOfNode(node.AsNode())) < core.ModuleKindSystem && (node.Parent.Parent.Flags&ast.NodeFlagsAmbient == 0) && ast.HasSyntacticModifier(node.Parent.Parent, ast.ModifierFlagsExport) {
 * 		c.checkGrammarForEsModuleMarkerInBindingName(node.Name())
 * 	}
 *
 * 	// 1. LexicalDeclaration : LetOrConst BindingList ;
 * 	// It is a Syntax Error if the BoundNames of BindingList contains "let".
 * 	// 2. ForDeclaration: ForDeclaration : LetOrConst ForBinding
 * 	// It is a Syntax Error if the BoundNames of ForDeclaration contains "let".
 *
 * 	// It is a SyntaxError if a VariableDeclaration or VariableDeclarationNoIn occurs within strict code
 * 	// and its Identifier is eval or arguments
 * 	return blockScopeKind != 0 && c.checkGrammarNameInLetOrConstDeclarations(node.Name())
 * }
 */
export declare function Checker_checkGrammarVariableDeclaration(receiver: GoPtr<Checker>, node: GoPtr<VariableDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForEsModuleMarkerInBindingName","kind":"method","status":"implemented","sigHash":"ee57ca80a65aac74ffebc88a4a409019d4fd5ee7dd873d8ebdf04f99f54e2e8f","bodyHash":"644d7855f42eafd588b3d4b5acd7c2017879928bf7143d6bb337a32cd686f881"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForEsModuleMarkerInBindingName(name *ast.Node) bool {
 * 	if ast.IsIdentifier(name) {
 * 		if name.Text() == "__esModule" {
 * 			return c.grammarErrorOnNodeSkippedOnNoEmit(name, diagnostics.Identifier_expected_esModule_is_reserved_as_an_exported_marker_when_transforming_ECMAScript_modules)
 * 		}
 * 	} else {
 * 		for _, element := range name.Elements() {
 * 			if element.Name() != nil {
 * 				return c.checkGrammarForEsModuleMarkerInBindingName(element.Name())
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForEsModuleMarkerInBindingName(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarNameInLetOrConstDeclarations","kind":"method","status":"implemented","sigHash":"753105ba22cb5f637622b96da94f130eb8fbc91ead15cc662eab4f626c292f65","bodyHash":"2c63a5cd38efa0ecd6b563bd0e1cb8835dfc42d8942c4b81ec9982281e74fa2c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarNameInLetOrConstDeclarations(name *ast.Node /*Union[Identifier, BindingPattern]* /) bool {
 * 	if name.Kind == ast.KindIdentifier {
 * 		if name.Text() == "let" {
 * 			return c.grammarErrorOnNode(name, diagnostics.X_let_is_not_allowed_to_be_used_as_a_name_in_let_or_const_declarations)
 * 		}
 * 	} else {
 * 		elements := name.Elements()
 * 		for _, element := range elements {
 * 			bindingElement := element.AsBindingElement()
 * 			if bindingElement.Name() != nil {
 * 				c.checkGrammarNameInLetOrConstDeclarations(bindingElement.Name())
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarNameInLetOrConstDeclarations(receiver: GoPtr<Checker>, name: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarVariableDeclarationList","kind":"method","status":"implemented","sigHash":"d9c83212f973a9c95f1d27d9b1faa24c79d357c61842814f25853a5cce1a8760","bodyHash":"902ccddd5118e4cde1b930d55ea1f89d758c0b44b6d29bd0869a42a2f4ecdc11"}
 *
 * Go source:
 * func (c *Checker) checkGrammarVariableDeclarationList(declarationList *ast.VariableDeclarationList) bool {
 * 	declarations := declarationList.Declarations
 * 	if c.checkGrammarForDisallowedTrailingComma(declarations, diagnostics.Trailing_comma_not_allowed) {
 * 		return true
 * 	}
 *
 * 	if len(declarations.Nodes) == 0 {
 * 		return c.grammarErrorAtPos(declarationList.AsNode(), declarations.Pos(), declarations.End()-declarations.Pos(), diagnostics.Variable_declaration_list_cannot_be_empty)
 * 	}
 *
 * 	blockScopeFlags := declarationList.Flags & ast.NodeFlagsBlockScoped
 * 	if blockScopeFlags == ast.NodeFlagsUsing || blockScopeFlags == ast.NodeFlagsAwaitUsing {
 * 		if ast.IsForInStatement(declarationList.Parent) {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_a_using_declaration, diagnostics.The_left_hand_side_of_a_for_in_statement_cannot_be_an_await_using_declaration))
 * 		}
 * 		if declarationList.Flags&ast.NodeFlagsAmbient != 0 {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.X_using_declarations_are_not_allowed_in_ambient_contexts, diagnostics.X_await_using_declarations_are_not_allowed_in_ambient_contexts))
 * 		}
 * 		if ast.IsVariableStatement(declarationList.Parent) && (ast.IsCaseClause(declarationList.Parent.Parent) || ast.IsDefaultClause(declarationList.Parent.Parent)) {
 * 			return c.grammarErrorOnNode(declarationList.AsNode(), core.IfElse(blockScopeFlags == ast.NodeFlagsUsing, diagnostics.X_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block, diagnostics.X_await_using_declarations_are_not_allowed_in_case_or_default_clauses_unless_contained_within_a_block))
 * 		}
 * 	}
 *
 * 	if blockScopeFlags == ast.NodeFlagsAwaitUsing {
 * 		return c.checkGrammarAwaitOrAwaitUsing(declarationList.AsNode())
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarVariableDeclarationList(receiver: GoPtr<Checker>, declarationList: GoPtr<VariableDeclarationList>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarAwaitOrAwaitUsing","kind":"method","status":"implemented","sigHash":"0b96fc8e8dcee43a8e70850ee4409f075482da145f46877afb7f6ecd886b290d","bodyHash":"cae564a4ad367089af21d182c3ced534b8831ef4b91ecadf18587872cd258595"}
 *
 * Go source:
 * func (c *Checker) checkGrammarAwaitOrAwaitUsing(node *ast.Node) bool {
 * 	// Grammar checking
 * 	hasError := false
 * 	container := getContainingFunctionOrClassStaticBlock(node)
 * 	if container != nil && ast.IsClassStaticBlockDeclaration(container) {
 * 		// NOTE: We report this regardless as to whether there are parse diagnostics.
 * 		var message *diagnostics.Message
 * 		if ast.IsAwaitExpression(node) {
 * 			message = diagnostics.X_await_expression_cannot_be_used_inside_a_class_static_block
 * 		} else {
 * 			message = diagnostics.X_await_using_statements_cannot_be_used_inside_a_class_static_block
 * 		}
 * 		c.error(node, message)
 * 		hasError = true
 * 	} else if node.Flags&ast.NodeFlagsAwaitContext == 0 {
 * 		if ast.IsInTopLevelContext(node) {
 * 			sourceFile := ast.GetSourceFileOfNode(node)
 * 			if !c.hasParseDiagnostics(sourceFile) {
 * 				var span core.TextRange
 * 				var spanCalculated bool
 * 				if !ast.IsEffectiveExternalModule(sourceFile, c.compilerOptions) {
 * 					span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 					spanCalculated = true
 * 					var message *diagnostics.Message
 * 					if ast.IsAwaitExpression(node) {
 * 						message = diagnostics.X_await_expressions_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module
 * 					} else {
 * 						message = diagnostics.X_await_using_statements_are_only_allowed_at_the_top_level_of_a_file_when_that_file_is_a_module_but_this_file_has_no_imports_or_exports_Consider_adding_an_empty_export_to_make_this_file_a_module
 * 					}
 * 					diagnostic := ast.NewDiagnostic(sourceFile, span, message)
 * 					c.addDiagnostic(diagnostic)
 * 					hasError = true
 * 				}
 * 				switch c.moduleKind {
 * 				case core.ModuleKindNode16,
 * 					core.ModuleKindNode18,
 * 					core.ModuleKindNode20,
 * 					core.ModuleKindNodeNext:
 * 					sourceFileMetaData := c.program.GetSourceFileMetaData(sourceFile.Path())
 * 					if sourceFileMetaData.ImpliedNodeFormat == core.ModuleKindCommonJS {
 * 						if !spanCalculated {
 * 							span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 						}
 * 						c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, diagnostics.The_current_file_is_a_CommonJS_module_and_cannot_use_await_at_the_top_level))
 * 						hasError = true
 * 						break
 * 					}
 * 					fallthrough
 * 				case core.ModuleKindES2022,
 * 					core.ModuleKindESNext,
 * 					core.ModuleKindPreserve,
 * 					core.ModuleKindSystem:
 * 					if c.languageVersion >= core.ScriptTargetES2017 {
 * 						break
 * 					}
 * 					fallthrough
 * 				default:
 * 					if !spanCalculated {
 * 						span = scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 					}
 * 					var message *diagnostics.Message
 * 					if ast.IsAwaitExpression(node) {
 * 						message = diagnostics.Top_level_await_expressions_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher
 * 					} else {
 * 						message = diagnostics.Top_level_await_using_statements_are_only_allowed_when_the_module_option_is_set_to_es2022_esnext_system_node16_node18_node20_nodenext_or_preserve_and_the_target_option_is_set_to_es2017_or_higher
 * 					}
 * 					c.addDiagnostic(ast.NewDiagnostic(sourceFile, span, message))
 * 					hasError = true
 * 				}
 * 			}
 * 		} else {
 * 			// use of 'await' in non-async function
 * 			sourceFile := ast.GetSourceFileOfNode(node)
 * 			if !c.hasParseDiagnostics(sourceFile) {
 * 				span := scanner.GetRangeOfTokenAtPosition(sourceFile, node.Pos())
 * 				var message *diagnostics.Message
 * 				if ast.IsAwaitExpression(node) {
 * 					message = diagnostics.X_await_expressions_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules
 * 				} else {
 * 					message = diagnostics.X_await_using_statements_are_only_allowed_within_async_functions_and_at_the_top_levels_of_modules
 * 				}
 * 				diagnostic := ast.NewDiagnostic(sourceFile, span, message)
 * 				if container != nil && container.Kind != ast.KindConstructor && !hasAsyncModifier(container) {
 * 					relatedInfo := NewDiagnosticForNode(container, diagnostics.Did_you_mean_to_mark_this_function_as_async)
 * 					diagnostic.AddRelatedInfo(relatedInfo)
 * 				}
 * 				c.addDiagnostic(diagnostic)
 * 				hasError = true
 * 			}
 * 		}
 * 	}
 *
 * 	if ast.IsAwaitExpression(node) && c.isInParameterInitializerBeforeContainingFunction(node) {
 * 		// NOTE: We report this regardless as to whether there are parse diagnostics.
 * 		c.error(node, diagnostics.X_await_expressions_cannot_be_used_in_a_parameter_initializer)
 * 		hasError = true
 * 	}
 *
 * 	return hasError
 * }
 */
export declare function Checker_checkGrammarAwaitOrAwaitUsing(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarYieldExpression","kind":"method","status":"implemented","sigHash":"c6c93506126263e9c6c576fa2e17ebec1040961f8416c0874d3789ad7b35902f","bodyHash":"a5165aee27826bf96adb8e791b4bbe04ce86758ec05be2de84f4d1ff24432756"}
 *
 * Go source:
 * func (c *Checker) checkGrammarYieldExpression(node *ast.Node) bool {
 * 	hasError := false
 * 	if node.Flags&ast.NodeFlagsYieldContext == 0 {
 * 		c.grammarErrorOnFirstToken(node, diagnostics.A_yield_expression_is_only_allowed_in_a_generator_body)
 * 		hasError = true
 * 	}
 * 	if c.isInParameterInitializerBeforeContainingFunction(node) {
 * 		c.error(node, diagnostics.X_yield_expressions_cannot_be_used_in_a_parameter_initializer)
 * 		hasError = true
 * 	}
 * 	return hasError
 * }
 */
export declare function Checker_checkGrammarYieldExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarForDisallowedBlockScopedVariableStatement","kind":"method","status":"implemented","sigHash":"40b32625ee2fc0e2c65c08d5007ecaf0f2f7d982681435fc5be94d1237fedf11","bodyHash":"f0f48fa8b6da7f2e77c64deab74ac504485c98c03ff17edd67cb8cf5de13c986"}
 *
 * Go source:
 * func (c *Checker) checkGrammarForDisallowedBlockScopedVariableStatement(node *ast.VariableStatement) bool {
 * 	if !c.containerAllowsBlockScopedVariable(node.Parent) {
 * 		blockScopeKind := c.getCombinedNodeFlagsCached(node.DeclarationList) & ast.NodeFlagsBlockScoped
 * 		if blockScopeKind != 0 {
 * 			var keyword string
 * 			switch {
 * 			case blockScopeKind == ast.NodeFlagsLet:
 * 				keyword = "let"
 * 			case blockScopeKind == ast.NodeFlagsConst:
 * 				keyword = "const"
 * 			case blockScopeKind == ast.NodeFlagsUsing:
 * 				keyword = "using"
 * 			case blockScopeKind == ast.NodeFlagsAwaitUsing:
 * 				keyword = "await using"
 * 			default:
 * 				panic("Unknown BlockScope flag")
 * 			}
 * 			c.error(node.AsNode(), diagnostics.X_0_declarations_can_only_be_declared_inside_a_block, keyword)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarForDisallowedBlockScopedVariableStatement(receiver: GoPtr<Checker>, node: GoPtr<VariableStatement>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.containerAllowsBlockScopedVariable","kind":"method","status":"implemented","sigHash":"29912bcc5bf48b6d0f23c9a5a8488fd558a4fac90305277baeb5acd83ab00e80","bodyHash":"c1c1ceca4d5e87435da0d5cac89f91cd6136fba2b8e258c02d1b5409869c8eff"}
 *
 * Go source:
 * func (c *Checker) containerAllowsBlockScopedVariable(parent *ast.Node) bool {
 * 	switch parent.Kind {
 * 	case ast.KindIfStatement,
 * 		ast.KindDoStatement,
 * 		ast.KindWhileStatement,
 * 		ast.KindWithStatement,
 * 		ast.KindForStatement,
 * 		ast.KindForInStatement,
 * 		ast.KindForOfStatement:
 * 		return false
 * 	case ast.KindLabeledStatement:
 * 		return c.containerAllowsBlockScopedVariable(parent.Parent)
 * 	}
 *
 * 	return true
 * }
 */
export declare function Checker_containerAllowsBlockScopedVariable(receiver: GoPtr<Checker>, parent: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarMetaProperty","kind":"method","status":"implemented","sigHash":"4bc770ed2984edf4d20feac19b592c92b22c1f7459dd5f3ce865d814c116e833","bodyHash":"b0ebbda8a33c7799cc83c2d8a9f350b71787104bc45dc08ea2c77af0387445e4"}
 *
 * Go source:
 * func (c *Checker) checkGrammarMetaProperty(node *ast.MetaProperty) bool {
 * 	nodeName := node.Name()
 * 	nameText := nodeName.Text()
 *
 * 	switch node.KeywordToken {
 * 	case ast.KindNewKeyword:
 * 		if nameText != "target" {
 * 			return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, scanner.TokenToString(node.KeywordToken), "target")
 * 		}
 * 	case ast.KindImportKeyword:
 * 		if nameText != "meta" {
 * 			isCallee := ast.IsCallExpression(node.Parent) && node.Parent.Expression() == node.AsNode()
 * 			if nameText == "defer" {
 * 				if !isCallee {
 * 					return c.grammarErrorAtPos(node.AsNode(), node.AsNode().End(), 0, diagnostics.X_0_expected, "(")
 * 				}
 * 			} else {
 * 				if isCallee {
 * 					return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_import_Did_you_mean_meta_or_defer, nameText)
 * 				}
 * 				return c.grammarErrorOnNode(nodeName, diagnostics.X_0_is_not_a_valid_meta_property_for_keyword_1_Did_you_mean_2, nameText, scanner.TokenToString(node.KeywordToken), "meta")
 * 			}
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarMetaProperty(receiver: GoPtr<Checker>, node: GoPtr<MetaProperty>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarConstructorTypeParameters","kind":"method","status":"implemented","sigHash":"1670da7194763883460ee547071ec5edbc0296917341511246b310b6111c87ca","bodyHash":"13feb6af29d0b5af98004feda53ab057dd4ad32b8cdcfbac9411b1960683e00e"}
 *
 * Go source:
 * func (c *Checker) checkGrammarConstructorTypeParameters(node *ast.ConstructorDeclaration) bool {
 * 	range_ := node.TypeParameters
 * 	if range_ != nil {
 * 		var pos int
 * 		if range_.Pos() == range_.End() {
 * 			pos = range_.Pos()
 * 		} else {
 * 			pos = scanner.SkipTrivia(ast.GetSourceFileOfNode(node.AsNode()).Text(), range_.Pos())
 * 		}
 * 		return c.grammarErrorAtPos(node.AsNode(), pos, range_.End()-pos, diagnostics.Type_parameters_cannot_appear_on_a_constructor_declaration)
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarConstructorTypeParameters(receiver: GoPtr<Checker>, node: GoPtr<ConstructorDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarConstructorTypeAnnotation","kind":"method","status":"implemented","sigHash":"3af3a54069f7b31e50265e4f6a3be5619c98fecc7b95d99b184981b4d7676e90","bodyHash":"f16b6c3339b76f52daec627cdcf589579065737a2b1a719964dd8d40c44deaef"}
 *
 * Go source:
 * func (c *Checker) checkGrammarConstructorTypeAnnotation(node *ast.ConstructorDeclaration) bool {
 * 	t := node.Type
 * 	if t != nil {
 * 		return c.grammarErrorOnNode(t, diagnostics.Type_annotation_cannot_appear_on_a_constructor_declaration)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarConstructorTypeAnnotation(receiver: GoPtr<Checker>, node: GoPtr<ConstructorDeclaration>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarProperty","kind":"method","status":"implemented","sigHash":"b7d4890ce603bcb5bac702ad1074d7aa11c620541607dc0044831d3492b891a9","bodyHash":"28a9ec427d77647da3f7bb79716121187732512efe59ab28f7159a870405cc3c"}
 *
 * Go source:
 * func (c *Checker) checkGrammarProperty(node *ast.Node /*Union[PropertyDeclaration, PropertySignature]* /) bool {
 * 	propertyName := node.Name()
 * 	if ast.IsComputedPropertyName(propertyName) && ast.IsBinaryExpression(propertyName.Expression()) && propertyName.Expression().AsBinaryExpression().OperatorToken.Kind == ast.KindInKeyword {
 * 		return c.grammarErrorOnNode(node.Parent.Members()[0], diagnostics.A_mapped_type_may_not_declare_properties_or_methods)
 * 	}
 * 	if ast.IsClassLike(node.Parent) {
 * 		if ast.IsStringLiteral(propertyName) && propertyName.Text() == "constructor" {
 * 			return c.grammarErrorOnNode(propertyName, diagnostics.Classes_may_not_have_a_field_named_constructor)
 * 		}
 * 		if c.checkGrammarForInvalidDynamicName(propertyName, diagnostics.A_computed_property_name_in_a_class_property_declaration_must_have_a_simple_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if ast.IsAutoAccessorPropertyDeclaration(node) && c.checkGrammarForInvalidQuestionMark(node.PostfixToken(), diagnostics.An_accessor_property_cannot_be_declared_optional) {
 * 			return true
 * 		}
 * 	} else if ast.IsInterfaceDeclaration(node.Parent) {
 * 		if c.checkGrammarForInvalidDynamicName(propertyName, diagnostics.A_computed_property_name_in_an_interface_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if !ast.IsPropertySignatureDeclaration(node) {
 * 			// Interfaces cannot contain property declarations
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if initializer := node.Initializer(); initializer != nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.An_interface_property_cannot_have_an_initializer)
 * 		}
 * 	} else if ast.IsTypeLiteralNode(node.Parent) {
 * 		if c.checkGrammarForInvalidDynamicName(node.Name(), diagnostics.A_computed_property_name_in_a_type_literal_must_refer_to_an_expression_whose_type_is_a_literal_type_or_a_unique_symbol_type) {
 * 			return true
 * 		}
 * 		if !ast.IsPropertySignatureDeclaration(node) {
 * 			// Type literals cannot contain property declarations
 * 			panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 		}
 * 		if initializer := node.Initializer(); initializer != nil {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.A_type_literal_property_cannot_have_an_initializer)
 * 		}
 * 	}
 *
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		c.checkAmbientInitializer(node)
 * 	}
 *
 * 	if ast.IsPropertyDeclaration(node) {
 * 		propDecl := node.AsPropertyDeclaration()
 * 		postfixToken := propDecl.PostfixToken
 * 		if postfixToken != nil && postfixToken.Kind == ast.KindExclamationToken {
 * 			switch {
 * 			case propDecl.Initializer != nil:
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.Declarations_with_initializers_cannot_also_have_definite_assignment_assertions)
 * 			case propDecl.Type == nil:
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.Declarations_with_definite_assignment_assertions_must_also_have_type_annotations)
 * 			case !ast.IsClassLike(node.Parent) || node.Flags&ast.NodeFlagsAmbient != 0 || ast.IsStatic(node) || ast.HasAbstractModifier(node):
 * 				return c.grammarErrorOnNode(postfixToken, diagnostics.A_definite_assignment_assertion_is_not_permitted_in_this_context)
 * 			}
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarProperty(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkAmbientInitializer","kind":"method","status":"implemented","sigHash":"ee1ed4d76efef776e5c4b5f708d5bcd2d7f255404ec525f49025060cff5a706e","bodyHash":"43b5319f57d1072a199977ef1b711312c3a90509bcff2320cf587dd577dd3542"}
 *
 * Go source:
 * func (c *Checker) checkAmbientInitializer(node *ast.Node) bool {
 * 	var initializer *ast.Expression
 * 	var typeNode *ast.TypeNode
 * 	switch node.Kind {
 * 	case ast.KindVariableDeclaration:
 * 		varDecl := node.AsVariableDeclaration()
 * 		initializer = varDecl.Initializer
 * 		typeNode = varDecl.Type
 * 	case ast.KindPropertyDeclaration:
 * 		propDecl := node.AsPropertyDeclaration()
 * 		initializer = propDecl.Initializer
 * 		typeNode = propDecl.Type
 * 	case ast.KindPropertySignature:
 * 		propSig := node.AsPropertySignatureDeclaration()
 * 		initializer = propSig.Initializer
 * 		typeNode = propSig.Type
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected node kind %q", node.Kind))
 * 	}
 *
 * 	if initializer != nil {
 * 		isInvalidInitializer := !(isInitializerStringOrNumberLiteralExpression(initializer) || c.isInitializerSimpleLiteralEnumReference(initializer) || initializer.Kind == ast.KindTrueKeyword || initializer.Kind == ast.KindFalseKeyword || isInitializerBigIntLiteralExpression(initializer))
 * 		isConstOrReadonly := isDeclarationReadonly(node) || ast.IsVariableDeclaration(node) && c.isVarConstLike(node)
 * 		if isConstOrReadonly && (typeNode == nil) {
 * 			if isInvalidInitializer {
 * 				return c.grammarErrorOnNode(initializer, diagnostics.A_const_initializer_in_an_ambient_context_must_be_a_string_or_numeric_literal_or_literal_enum_reference)
 * 			}
 * 		} else {
 * 			return c.grammarErrorOnNode(initializer, diagnostics.Initializers_are_not_allowed_in_ambient_contexts)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkAmbientInitializer(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::isInitializerStringOrNumberLiteralExpression","kind":"func","status":"implemented","sigHash":"6553a5f71455e8cfc9fa72c8f0e589fc25b094961b0af36dd7e3fee49169881c","bodyHash":"25d8c789509d9c56872b214ddf7a1c733a7ce69f0297392086d8b05b4c446438"}
 *
 * Go source:
 * func isInitializerStringOrNumberLiteralExpression(expr *ast.Expression) bool {
 * 	return ast.IsStringOrNumericLiteralLike(expr) ||
 * 		expr.Kind == ast.KindPrefixUnaryExpression && expr.AsPrefixUnaryExpression().Operator == ast.KindMinusToken && expr.AsPrefixUnaryExpression().Operand.Kind == ast.KindNumericLiteral
 * }
 */
export declare function isInitializerStringOrNumberLiteralExpression(expr: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::func::isInitializerBigIntLiteralExpression","kind":"func","status":"implemented","sigHash":"dfc359fe64c0b1aec32adee93287a0561233d9278954574e8960c7c00b5e713d","bodyHash":"185e334be3f99d1b3805151730820d0babbebe44773310c7305ecc253626921d"}
 *
 * Go source:
 * func isInitializerBigIntLiteralExpression(expr *ast.Expression) bool {
 * 	if expr.Kind == ast.KindBigIntLiteral {
 * 		return true
 * 	}
 *
 * 	if expr.Kind == ast.KindPrefixUnaryExpression {
 * 		unaryExpr := expr.AsPrefixUnaryExpression()
 * 		return unaryExpr.Operator == ast.KindMinusToken && unaryExpr.Operand.Kind == ast.KindBigIntLiteral
 * 	}
 *
 * 	return false
 * }
 */
export declare function isInitializerBigIntLiteralExpression(expr: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.isInitializerSimpleLiteralEnumReference","kind":"method","status":"implemented","sigHash":"b29e0e16bf36f2a495b7fd5902c96e0d54f29f5d8af9555bc8a5af833049e3e6","bodyHash":"980c27ab24b5113d9375efbed8fcee74536f12f4b7e9f235462117604953f5ba"}
 *
 * Go source:
 * func (c *Checker) isInitializerSimpleLiteralEnumReference(expr *ast.Expression) bool {
 * 	if ast.IsPropertyAccessExpression(expr) {
 * 		return c.checkExpressionCached(expr).flags&TypeFlagsEnumLike != 0
 * 	}
 *
 * 	if ast.IsElementAccessExpression(expr) {
 * 		elementAccess := expr.AsElementAccessExpression()
 *
 * 		return isInitializerStringOrNumberLiteralExpression(elementAccess.ArgumentExpression) &&
 * 			ast.IsEntityNameExpression(elementAccess.Expression) &&
 * 			c.checkExpressionCached(expr).flags&TypeFlagsEnumLike != 0
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_isInitializerSimpleLiteralEnumReference(receiver: GoPtr<Checker>, expr: GoPtr<Expression>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTopLevelElementForRequiredDeclareModifier","kind":"method","status":"implemented","sigHash":"39c66fc4c267cc6dcc95a9e3c463181c43cc78b9477eee03820a86e432079084","bodyHash":"9934f0457db57f195da374b3a8a198f0818586b8e3ff423056a20fe9d7a214bd"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTopLevelElementForRequiredDeclareModifier(node *ast.Node) bool {
 * 	// A declare modifier is required for any top level .d.ts declaration except export=, export default, export as namespace
 * 	// interfaces and imports categories:
 * 	//
 * 	//  DeclarationElement:
 * 	//     ExportAssignment
 * 	//     export_opt   InterfaceDeclaration
 * 	//     export_opt   TypeAliasDeclaration
 * 	//     export_opt   ImportDeclaration
 * 	//     export_opt   ExternalImportDeclaration
 * 	//     export_opt   AmbientDeclaration
 * 	//
 * 	// TODO: The spec needs to be amended to reflect this grammar.
 * 	if node.Kind == ast.KindInterfaceDeclaration || node.Kind == ast.KindTypeAliasDeclaration || node.Kind == ast.KindImportDeclaration || node.Kind == ast.KindJSImportDeclaration || node.Kind == ast.KindImportEqualsDeclaration || node.Kind == ast.KindExportDeclaration || node.Kind == ast.KindExportAssignment || node.Kind == ast.KindNamespaceExportDeclaration || ast.HasSyntacticModifier(node, ast.ModifierFlagsAmbient|ast.ModifierFlagsExport|ast.ModifierFlagsDefault) {
 * 		return false
 * 	}
 *
 * 	return c.grammarErrorOnFirstToken(node, diagnostics.Top_level_declarations_in_d_ts_files_must_start_with_either_a_declare_or_export_modifier)
 * }
 */
export declare function Checker_checkGrammarTopLevelElementForRequiredDeclareModifier(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTopLevelElementsForRequiredDeclareModifier","kind":"method","status":"implemented","sigHash":"52d04b72f38c919ea581d38fd5e25217a2a9d597b47b31dcb3e35f883526ce48","bodyHash":"efa6a9449860206a3760379c88aba5646f6aecc43167ce376b3fee04d3aad591"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTopLevelElementsForRequiredDeclareModifier(file *ast.SourceFile) bool {
 * 	for _, decl := range file.Statements.Nodes {
 * 		if ast.IsDeclarationNode(decl) || decl.Kind == ast.KindVariableStatement {
 * 			if c.checkGrammarTopLevelElementForRequiredDeclareModifier(decl) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarTopLevelElementsForRequiredDeclareModifier(receiver: GoPtr<Checker>, file: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarSourceFile","kind":"method","status":"implemented","sigHash":"6b55248003fc85dff7d5c434a0f70b9e32b5bd3fb24fd3239072f38de1493a86","bodyHash":"59604fcfb3b922a9cb27815c3a012d4ee4616ce1e4c79c2db865cab1cdc72f83"}
 *
 * Go source:
 * func (c *Checker) checkGrammarSourceFile(node *ast.SourceFile) bool {
 * 	return node.Flags&ast.NodeFlagsAmbient != 0 && c.checkGrammarTopLevelElementsForRequiredDeclareModifier(node)
 * }
 */
export declare function Checker_checkGrammarSourceFile(receiver: GoPtr<Checker>, node: GoPtr<SourceFile>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarStatementInAmbientContext","kind":"method","status":"implemented","sigHash":"e899617be4cf828ba797385e789c53dbf2a267040b7378d2080a644c6e29ad47","bodyHash":"f41d355f5491362199a770d458115ff5c60056180eb9cbae48b9825b0c5fbf1f"}
 *
 * Go source:
 * func (c *Checker) checkGrammarStatementInAmbientContext(node *ast.Node) bool {
 * 	if node.Flags&ast.NodeFlagsAmbient != 0 {
 * 		// Find containing block which is either Block, ModuleBlock, SourceFile
 * 		links := c.nodeLinks.Get(node)
 * 		if !links.hasReportedStatementInAmbientContext && (ast.IsFunctionLike(node.Parent) || ast.IsAccessor(node.Parent)) {
 * 			links.hasReportedStatementInAmbientContext = c.grammarErrorOnFirstToken(node, diagnostics.An_implementation_cannot_be_declared_in_ambient_contexts)
 * 			return links.hasReportedStatementInAmbientContext
 * 		}
 *
 * 		// We are either parented by another statement, or some sort of block.
 * 		// If we're in a block, we only want to really report an error once
 * 		// to prevent noisiness.  So use a bit on the block to indicate if
 * 		// this has already been reported, and don't report if it has.
 * 		//
 * 		if node.Parent.Kind == ast.KindBlock || node.Parent.Kind == ast.KindModuleBlock || node.Parent.Kind == ast.KindSourceFile {
 * 			links := c.nodeLinks.Get(node.Parent)
 * 			// Check if the containing block ever report this error
 * 			if !links.hasReportedStatementInAmbientContext {
 * 				links.hasReportedStatementInAmbientContext = c.grammarErrorOnFirstToken(node, diagnostics.Statements_are_not_allowed_in_ambient_contexts)
 * 				return links.hasReportedStatementInAmbientContext
 * 			}
 * 		} else {
 * 			// We must be parented by a statement.  If so, there's no need
 * 			// to report the error as our parent will have already done it.
 * 			// debug.Assert(ast.IsStatement(node.Parent)) // !!! commented out in strada - fails if uncommented
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarStatementInAmbientContext(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarNumericLiteral","kind":"method","status":"implemented","sigHash":"8e9bc9f3b74f7e0840ceb4feae42c4b1f5c091770cb3186156cfa5796d094ff1","bodyHash":"441058860d530d31847f22ecdaa754167790a8a81cb018db397d1ee7fa42aac3"}
 *
 * Go source:
 * func (c *Checker) checkGrammarNumericLiteral(node *ast.NumericLiteral) {
 * 	nodeText := scanner.GetTextOfNode(node.AsNode())
 *
 * 	// Realism (size) checking
 * 	// We should test against `getTextOfNode(node)` rather than `node.text`, because `node.text` for large numeric literals can contain "."
 * 	// e.g. `node.text` for numeric literal `1100000000000000000000` is `1.1e21`.
 * 	isFractional := strings.ContainsRune(nodeText, '.')
 * 	isScientific := node.TokenFlags&ast.TokenFlagsScientific != 0
 *
 * 	// Scientific notation (e.g. 2e54 and 1e00000000010) can't be converted to bigint
 * 	// Fractional numbers (e.g. 9000000000000000.001) are inherently imprecise anyway
 * 	if isFractional || isScientific {
 * 		return
 * 	}
 *
 * 	// Here `node` is guaranteed to be a numeric literal representing an integer.
 * 	// We need to judge whether the integer `node` represents is <= 2 ** 53 - 1, which can be accomplished by comparing to `value` defined below because:
 * 	// 1) when `node` represents an integer <= 2 ** 53 - 1, `node.text` is its exact string representation and thus `value` precisely represents the integer.
 * 	// 2) otherwise, although `node.text` may be imprecise string representation, its mathematical value and consequently `value` cannot be less than 2 ** 53,
 * 	//    thus the result of the predicate won't be affected.
 * 	value := jsnum.FromString(node.Text)
 * 	if value <= jsnum.MaxSafeInteger {
 * 		return
 * 	}
 *
 * 	c.addErrorOrSuggestion(false, createDiagnosticForNode(node.AsNode(), diagnostics.Numeric_literals_with_absolute_values_equal_to_2_53_or_greater_are_too_large_to_be_represented_accurately_as_integers))
 * }
 */
export declare function Checker_checkGrammarNumericLiteral(receiver: GoPtr<Checker>, node: GoPtr<NumericLiteral>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarBigIntLiteral","kind":"method","status":"implemented","sigHash":"c360f4c6b0225730377d3ba483b01c580b79be61d6465d256082e20843803a13","bodyHash":"db0e760f394df87730d3192b1a1cf7fdb5d5ed698dc83d9f7cf6e0944a779bf8"}
 *
 * Go source:
 * func (c *Checker) checkGrammarBigIntLiteral(node *ast.BigIntLiteral) bool {
 * 	literalType := ast.IsLiteralTypeNode(node.Parent) || ast.IsPrefixUnaryExpression(node.Parent) && ast.IsLiteralTypeNode(node.Parent.Parent)
 * 	if !literalType {
 * 		// Don't error on BigInt literals in ambient contexts
 * 		if node.Flags&ast.NodeFlagsAmbient == 0 && c.languageVersion < core.ScriptTargetES2020 {
 * 			if c.grammarErrorOnNode(node.AsNode(), diagnostics.BigInt_literals_are_not_available_when_targeting_lower_than_ES2020) {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarBigIntLiteral(receiver: GoPtr<Checker>, node: GoPtr<BigIntLiteral>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarImportClause","kind":"method","status":"implemented","sigHash":"76cf413b7c60dffe9e6275de8e1f5a16a72cda77deca69f93b602c8cc9e3985d","bodyHash":"392930ba0ecd1a00d96c11e64e78bdecee58c17b44545db81d5c759a7083eb91"}
 *
 * Go source:
 * func (c *Checker) checkGrammarImportClause(node *ast.ImportClause) bool {
 * 	switch node.PhaseModifier {
 * 	case ast.KindTypeKeyword:
 * 		if node.Flags&ast.NodeFlagsJSDoc == 0 && node.Name() != nil && node.NamedBindings != nil {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.A_type_only_import_can_specify_a_default_import_or_named_bindings_but_not_both)
 * 		}
 * 		if node.NamedBindings != nil && node.NamedBindings.Kind == ast.KindNamedImports {
 * 			return c.checkGrammarTypeOnlyNamedImportsOrExports(node.NamedBindings)
 * 		}
 * 	case ast.KindDeferKeyword:
 * 		if node.Name() != nil {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Default_imports_are_not_allowed_in_a_deferred_import)
 * 		}
 * 		if node.NamedBindings != nil && node.NamedBindings.Kind == ast.KindNamedImports {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Named_imports_are_not_allowed_in_a_deferred_import)
 * 		}
 * 		if c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 			return c.grammarErrorOnNode(&node.Node, diagnostics.Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve)
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarImportClause(receiver: GoPtr<Checker>, node: GoPtr<ImportClause>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarTypeOnlyNamedImportsOrExports","kind":"method","status":"implemented","sigHash":"dc7b0ef2f77709f35264fb14617473a2c2e3c5f033bc7beb8b293ba092fd6bdf","bodyHash":"6ac6167e29bc647fcff2f0a2c704fe76dac55283c5ab3f0f9607efcbc39450be"}
 *
 * Go source:
 * func (c *Checker) checkGrammarTypeOnlyNamedImportsOrExports(namedBindings *ast.Node) bool {
 * 	nodeList := namedBindings.ElementList()
 * 	for _, specifier := range nodeList.Nodes {
 * 		var specifierIsTypeOnly bool
 * 		var message *diagnostics.Message
 * 		if specifier.Kind == ast.KindImportSpecifier {
 * 			specifierIsTypeOnly = specifier.IsTypeOnly()
 * 			message = diagnostics.The_type_modifier_cannot_be_used_on_a_named_import_when_import_type_is_used_on_its_import_statement
 * 		} else {
 * 			specifierIsTypeOnly = specifier.IsTypeOnly()
 * 			message = diagnostics.The_type_modifier_cannot_be_used_on_a_named_export_when_export_type_is_used_on_its_export_statement
 * 		}
 *
 * 		if specifierIsTypeOnly {
 * 			return c.grammarErrorOnFirstToken(specifier, message)
 * 		}
 * 	}
 *
 * 	return false
 * }
 */
export declare function Checker_checkGrammarTypeOnlyNamedImportsOrExports(receiver: GoPtr<Checker>, namedBindings: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/grammarchecks.go::method::Checker.checkGrammarImportCallExpression","kind":"method","status":"implemented","sigHash":"b2688527c1f504e73e061e8f29331e39aa0e19b3c2f67ab880c22687a3f924d3","bodyHash":"cfcff84e1bc59cb40df9c04fea1a0c2ab7226f8c85153dd90ca95bd9cd617af0"}
 *
 * Go source:
 * func (c *Checker) checkGrammarImportCallExpression(node *ast.Node) bool {
 * 	if c.compilerOptions.VerbatimModuleSyntax == core.TSTrue && c.moduleKind == core.ModuleKindCommonJS {
 * 		return c.grammarErrorOnNode(node, getVerbatimModuleSyntaxErrorMessage(node))
 * 	}
 *
 * 	if node.Expression().Kind == ast.KindMetaProperty {
 * 		if c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 			return c.grammarErrorOnNode(node, diagnostics.Deferred_imports_are_only_supported_when_the_module_flag_is_set_to_esnext_or_preserve)
 * 		}
 * 	} else if c.moduleKind == core.ModuleKindES2015 {
 * 		return c.grammarErrorOnNode(node, diagnostics.Dynamic_imports_are_only_supported_when_the_module_flag_is_set_to_es2020_es2022_esnext_commonjs_amd_system_umd_node16_node18_node20_or_nodenext)
 * 	}
 *
 * 	nodeAsCall := node.AsCallExpression()
 * 	if nodeAsCall.TypeArguments != nil {
 * 		return c.grammarErrorOnNode(node, diagnostics.This_use_of_import_is_invalid_import_calls_can_be_written_but_they_must_have_parentheses_and_cannot_have_type_arguments)
 * 	}
 *
 * 	nodeArguments := nodeAsCall.Arguments
 * 	argumentNodes := nodeArguments.Nodes
 * 	if !(core.ModuleKindNode16 <= c.moduleKind && c.moduleKind <= core.ModuleKindNodeNext) && c.moduleKind != core.ModuleKindESNext && c.moduleKind != core.ModuleKindPreserve {
 * 		// We are allowed trailing comma after proposal-import-assertions.
 * 		c.checkGrammarForDisallowedTrailingComma(nodeArguments, diagnostics.Trailing_comma_not_allowed)
 *
 * 		if len(argumentNodes) > 1 {
 * 			importAttributesArgument := argumentNodes[1]
 * 			return c.grammarErrorOnNode(importAttributesArgument, diagnostics.Dynamic_imports_only_support_a_second_argument_when_the_module_option_is_set_to_esnext_node16_node18_node20_nodenext_or_preserve)
 * 		}
 * 	}
 *
 * 	if len(argumentNodes) == 0 || len(argumentNodes) > 2 {
 * 		return c.grammarErrorOnNode(node, diagnostics.Dynamic_imports_can_only_accept_a_module_specifier_and_an_optional_set_of_attributes_as_arguments)
 * 	}
 *
 * 	// see: parseArgumentOrArrayLiteralElement...we use this function which parse arguments of callExpression to parse specifier for dynamic import.
 * 	// parseArgumentOrArrayLiteralElement allows spread element to be in an argument list which is not allowed as specifier in dynamic import.
 * 	spreadElement := core.Find(argumentNodes, ast.IsSpreadElement)
 * 	if spreadElement != nil {
 * 		return c.grammarErrorOnNode(spreadElement, diagnostics.Argument_of_dynamic_import_cannot_be_spread_element)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_checkGrammarImportCallExpression(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
//# sourceMappingURL=grammarchecks.d.ts.map