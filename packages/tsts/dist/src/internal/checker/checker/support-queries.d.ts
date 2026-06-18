import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { Diagnostic } from "../../ast/diagnostic.js";
import type { Kind } from "../../ast/generated/kinds.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import type { Symbol } from "../../ast/symbol.js";
import type { TypeMapper } from "../mapper.js";
import type { ConditionalRoot, Signature, Type } from "../types.js";
import type { CacheHashKey, CallState, Checker, IterationTypeKind, keyBuilder, ReferenceHint, WideningContext } from "./state.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isIteratorResult","kind":"method","status":"implemented","sigHash":"c68abca3eb06cf808f42dbcbaa7b5579291a43e12a0eda979bc92ec57c49ee0a","bodyHash":"a948f5c897e476bee78001ddb233ed427012e1ed328d507cb9bae7c1ec73bb34"}
 *
 * Go source:
 * func (c *Checker) isIteratorResult(t *Type, kind IterationTypeKind) bool {
 * 	// From https://tc39.github.io/ecma262/#sec-iteratorresult-interface:
 * 	// > [done] is the result status of an iterator `next` method call. If the end of the iterator was reached `done` is `true`.
 * 	// > If the end was not reached `done` is `false` and a value is available.
 * 	// > If a `done` property (either own or inherited) does not exist, it is consider to have the value `false`.
 * 	doneType := core.OrElse(c.getTypeOfPropertyOfType(t, "done"), c.falseType)
 * 	return c.isTypeAssignableTo(core.IfElse(kind == IterationTypeKindYield, c.falseType, c.trueType), doneType)
 * }
 */
export declare function Checker_isIteratorResult(receiver: GoPtr<Checker>, t: GoPtr<Type>, kind: IterationTypeKind): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isReferenced","kind":"method","status":"implemented","sigHash":"390daabce7265ea8383203e8fadf2740bccab724d3d7184c2aa1a677c50d67dd","bodyHash":"11336ae57cf6638cb5739f5c13a125aba4cf3672d041038461124398e91da8b0"}
 *
 * Go source:
 * func (c *Checker) isReferenced(symbol *ast.Symbol) bool {
 * 	return c.symbolReferenceLinks.Get(symbol).referenceKinds != 0
 * }
 */
export declare function Checker_isReferenced(receiver: GoPtr<Checker>, symbol_: GoPtr<Symbol>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addImplementationSuccessElaboration","kind":"method","status":"implemented","sigHash":"acb7d88587e2e89c8fd34143e26626149e1f899f42bf2c704f814544ee3b2fbf","bodyHash":"3e3a9a82c6e7104e19b9175e41aa07778df7343f379c060a8e8b5f4a1761e715"}
 *
 * Go source:
 * func (c *Checker) addImplementationSuccessElaboration(s *CallState, failed *Signature, diagnostic *ast.Diagnostic) {
 * 	if failed.declaration != nil && failed.declaration.Symbol() != nil {
 * 		declarations := failed.declaration.Symbol().Declarations
 * 		if len(declarations) > 1 {
 * 			implementation := core.Find(declarations, func(d *ast.Declaration) bool {
 * 				return ast.IsFunctionLikeDeclaration(d) && ast.NodeIsPresent(d.Body())
 * 			})
 * 			if implementation != nil {
 * 				candidate := c.getSignatureFromDeclaration(implementation)
 * 				localState := *s
 * 				localState.candidates = []*Signature{candidate}
 * 				localState.isSingleNonGenericCandidate = len(candidate.typeParameters) == 0
 * 				if c.chooseOverload(&localState, c.assignableRelation) != nil {
 * 					diagnostic.AddRelatedInfo(NewDiagnosticForNode(implementation, diagnostics.The_call_would_have_succeeded_against_this_implementation_but_implementation_signatures_of_overloads_are_not_externally_visible))
 * 				}
 * 			}
 * 		}
 * 	}
 * }
 */
export declare function Checker_addImplementationSuccessElaboration(receiver: GoPtr<Checker>, s: GoPtr<CallState>, failed: GoPtr<Signature>, diagnostic: GoPtr<Diagnostic>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getThisContainer","kind":"method","status":"implemented","sigHash":"ce7df68de5061be4bf843ae77fc2d67b8f6e60ed1d64ff80b2e01e79094cfebc","bodyHash":"e2fecaf518e1c9b17b8f6b9ebd8402360781926eda1cc78ad87be33fc743afbb"}
 *
 * Go source:
 * func (c *Checker) getThisContainer(node *ast.Node, includeArrowFunctions bool, includeClassComputedPropertyName bool) *ast.Node {
 * 	for {
 * 		node = node.Parent
 * 		if node == nil {
 * 			// If we never pass in a SourceFile, this should be unreachable, since we'll stop when we reach that.
 * 			panic("No parent in getThisContainer")
 * 		}
 * 		switch node.Kind {
 * 		case ast.KindComputedPropertyName:
 * 			// If the grandparent node is an object literal (as opposed to a class),
 * 			// then the computed property is not a 'this' container.
 * 			// A computed property name in a class needs to be a this container
 * 			// so that we can error on it.
 * 			if includeClassComputedPropertyName && ast.IsClassLike(node.Parent.Parent) {
 * 				return node
 * 			}
 * 			// If this is a computed property, then the parent should not
 * 			// make it a this container. The parent might be a property
 * 			// in an object literal, like a method or accessor. But in order for
 * 			// such a parent to be a this container, the reference must be in
 * 			// the *body* of the container.
 * 			node = node.Parent.Parent
 * 		case ast.KindDecorator:
 * 			// Decorators are always applied outside of the body of a class or method.
 * 			if node.Parent.Kind == ast.KindParameter && ast.IsClassElement(node.Parent.Parent) {
 * 				// If the decorator's parent is a Parameter, we resolve the this container from
 * 				// the grandparent class declaration.
 * 				node = node.Parent.Parent
 * 			} else if ast.IsClassElement(node.Parent) {
 * 				// If the decorator's parent is a class element, we resolve the 'this' container
 * 				// from the parent class declaration.
 * 				node = node.Parent
 * 			}
 * 		case ast.KindArrowFunction:
 * 			if !includeArrowFunctions {
 * 				continue
 * 			}
 * 			fallthrough
 * 		case ast.KindFunctionDeclaration, ast.KindFunctionExpression, ast.KindModuleDeclaration, ast.KindClassStaticBlockDeclaration,
 * 			ast.KindPropertyDeclaration, ast.KindPropertySignature, ast.KindMethodDeclaration, ast.KindMethodSignature, ast.KindConstructor,
 * 			ast.KindGetAccessor, ast.KindSetAccessor, ast.KindCallSignature, ast.KindConstructSignature, ast.KindIndexSignature,
 * 			ast.KindEnumDeclaration, ast.KindSourceFile:
 * 			return node
 * 		}
 * 	}
 * }
 */
export declare function Checker_getThisContainer(receiver: GoPtr<Checker>, node: GoPtr<Node>, includeArrowFunctions: bool, includeClassComputedPropertyName: bool): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSuggestedBooleanOperator","kind":"method","status":"implemented","sigHash":"317fc9966aecefe72bc97f8ba26a6d16ffba8834bd8bca3b804c3520ad873a82","bodyHash":"6204ca175116d8edebc40b358fcb0e7b13bd71defaa732b7c14f78b0960ca950"}
 *
 * Go source:
 * func (c *Checker) getSuggestedBooleanOperator(operator ast.Kind) ast.Kind {
 * 	switch operator {
 * 	case ast.KindBarToken, ast.KindBarEqualsToken:
 * 		return ast.KindBarBarToken
 * 	case ast.KindCaretToken, ast.KindCaretEqualsToken:
 * 		return ast.KindExclamationEqualsEqualsToken
 * 	case ast.KindAmpersandToken, ast.KindAmpersandEqualsToken:
 * 		return ast.KindAmpersandAmpersandToken
 * 	}
 * 	return ast.KindUnknown
 * }
 */
export declare function Checker_getSuggestedBooleanOperator(receiver: GoPtr<Checker>, operator: Kind): Kind;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isSideEffectFree","kind":"method","status":"implemented","sigHash":"c040ba7413b2ad899a9f69de6b98cc7135fa28b7bceac3fa04cce95bee749778","bodyHash":"9c582a11e43dc96996e64c5f093135067906472338787e36708d586cd4a05270"}
 *
 * Go source:
 * func (c *Checker) isSideEffectFree(node *ast.Node) bool {
 * 	node = ast.SkipParentheses(node)
 * 	switch node.Kind {
 * 	case ast.KindIdentifier, ast.KindStringLiteral, ast.KindRegularExpressionLiteral, ast.KindTaggedTemplateExpression, ast.KindTemplateExpression,
 * 		ast.KindNoSubstitutionTemplateLiteral, ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindTrueKeyword, ast.KindFalseKeyword,
 * 		ast.KindNullKeyword, ast.KindUndefinedKeyword, ast.KindFunctionExpression, ast.KindClassExpression, ast.KindArrowFunction,
 * 		ast.KindArrayLiteralExpression, ast.KindObjectLiteralExpression, ast.KindTypeOfExpression, ast.KindNonNullExpression, ast.KindJsxSelfClosingElement,
 * 		ast.KindJsxElement:
 * 		return true
 * 	case ast.KindConditionalExpression:
 * 		return c.isSideEffectFree(node.AsConditionalExpression().WhenTrue) && c.isSideEffectFree(node.AsConditionalExpression().WhenFalse)
 * 	case ast.KindBinaryExpression:
 * 		if ast.IsAssignmentOperator(node.AsBinaryExpression().OperatorToken.Kind) {
 * 			return false
 * 		}
 * 		return c.isSideEffectFree(node.AsBinaryExpression().Left) && c.isSideEffectFree(node.AsBinaryExpression().Right)
 * 	case ast.KindPrefixUnaryExpression:
 * 		// Unary operators ~, !, +, and - have no side effects.
 * 		// The rest do.
 * 		switch node.AsPrefixUnaryExpression().Operator {
 * 		case ast.KindExclamationToken, ast.KindPlusToken, ast.KindMinusToken, ast.KindTildeToken:
 * 			return true
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isSideEffectFree(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getExactOptionalUnassignableProperties","kind":"method","status":"implemented","sigHash":"ed00e23887662d8c26e623b8733738664819675d548936a91c311e71cf9285e5","bodyHash":"4965f017d414479b3e9f0d86822329f0134d776609910983f4220f6a9d1b0d4b"}
 *
 * Go source:
 * func (c *Checker) getExactOptionalUnassignableProperties(source *Type, target *Type) []*ast.Symbol {
 * 	if isTupleType(source) && isTupleType(target) {
 * 		return nil
 * 	}
 * 	return core.Filter(c.getPropertiesOfType(target), func(targetProp *ast.Symbol) bool {
 * 		return c.isExactOptionalPropertyMismatch(c.getTypeOfPropertyOfType(source, targetProp.Name), c.getTypeOfSymbol(targetProp))
 * 	})
 * }
 */
export declare function Checker_getExactOptionalUnassignableProperties(receiver: GoPtr<Checker>, source: GoPtr<Type>, target: GoPtr<Type>): GoSlice<GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.hasDefaultValue","kind":"method","status":"implemented","sigHash":"390924be90bd5165629aff40393161e371d5019103557eb160622439eb70f6da","bodyHash":"8c846925cd04e73e410241494892824848ab7974b61fad0f6f81604848dfae24"}
 *
 * Go source:
 * func (c *Checker) hasDefaultValue(node *ast.Node) bool {
 * 	return ast.IsBindingElement(node) && node.Initializer() != nil ||
 * 		ast.IsPropertyAssignment(node) && c.hasDefaultValue(node.Initializer()) ||
 * 		ast.IsShorthandPropertyAssignment(node) && node.AsShorthandPropertyAssignment().ObjectAssignmentInitializer != nil ||
 * 		ast.IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken
 * }
 */
export declare function Checker_hasDefaultValue(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isConstContext","kind":"method","status":"implemented","sigHash":"23cd6c8b976e2b2de21f1310a0d6558b776d54d502f7d427e2750a1b6cc51469","bodyHash":"dc530136653c59b3f2c42b348d8fe334b2cea3e84174f3571c8ab83c0df3cc8c"}
 *
 * Go source:
 * func (c *Checker) isConstContext(node *ast.Node) bool {
 * 	parent := node.Parent
 * 	return ast.IsConstAssertion(parent) ||
 * 		c.isValidConstAssertionArgument(node) && c.isConstTypeVariable(c.getContextualType(node, ContextFlagsNone), 0) ||
 * 		(ast.IsParenthesizedExpression(parent) || ast.IsArrayLiteralExpression(parent) || ast.IsSpreadElement(parent)) && c.isConstContext(parent) ||
 * 		(ast.IsPropertyAssignment(parent) || ast.IsShorthandPropertyAssignment(parent) || ast.IsTemplateSpan(parent)) && c.isConstContext(parent.Parent)
 * }
 */
export declare function Checker_isConstContext(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.createModeMismatchDetails","kind":"method","status":"implemented","sigHash":"9fa3af61056e73f5061e3db5b2191c33d6490cc54f6901794675558bbd5c4a6e","bodyHash":"3f860b13be46053a07e83940f8eeb639a0e6e6200c1bb28f4959e9778448cad2"}
 *
 * Go source:
 * func (c *Checker) createModeMismatchDetails(sourceFile *ast.SourceFile, errorNode *ast.Node) *ast.Diagnostic {
 * 	details := CreateModeMismatchDetails(c.program, sourceFile)
 * 	result := NewDiagnosticForNode(errorNode, details.Message, details.Args...)
 * 	result.SetRepopulateInfo(&ast.RepopulateDiagnosticInfo{
 * 		Kind: ast.RepopulateModeMismatch,
 * 	})
 * 	return result
 * }
 */
export declare function Checker_createModeMismatchDetails(receiver: GoPtr<Checker>, sourceFile: GoPtr<SourceFile>, errorNode: GoPtr<Node>): GoPtr<Diagnostic>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isCommonJSRequire","kind":"method","status":"implemented","sigHash":"909461d3e7faaf3e9ce67876713da2c68abf4b15eba7fae53f5984a275e8898f","bodyHash":"d97d96a0846889696331e21c5322711e8f94518ac00fc303db8a0c1bbe91c4cf"}
 *
 * Go source:
 * func (c *Checker) isCommonJSRequire(node *ast.Node) bool {
 * 	if !ast.IsRequireCall(node, true /*requireStringLiteralLikeArgument* /) {
 * 		return false
 * 	}
 * 	if !ast.IsIdentifier(node.Expression()) {
 * 		panic("Expected identifier for require call")
 * 	}
 * 	// Make sure require is not a local function
 * 	resolvedRequire := c.resolveName(node.Expression(), node.Expression().Text(), ast.SymbolFlagsValue, nil /*nameNotFoundMessage* /, true /*isUse* /, false /*excludeGlobals* /)
 * 	if resolvedRequire == c.requireSymbol {
 * 		return true
 * 	}
 * 	// project includes symbol named 'require' - make sure that it is ambient and local non-alias
 * 	if resolvedRequire == nil || resolvedRequire.Flags&ast.SymbolFlagsAlias != 0 {
 * 		return false
 * 	}
 *
 * 	var targetDeclarationKind ast.Kind
 * 	if resolvedRequire.Flags&ast.SymbolFlagsFunction != 0 {
 * 		targetDeclarationKind = ast.KindFunctionDeclaration
 * 	} else if resolvedRequire.Flags&ast.SymbolFlagsVariable != 0 {
 * 		targetDeclarationKind = ast.KindVariableDeclaration
 * 	} else {
 * 		targetDeclarationKind = ast.KindUnknown
 * 	}
 * 	if targetDeclarationKind != ast.KindUnknown {
 * 		decl := ast.GetDeclarationOfKind(resolvedRequire, targetDeclarationKind)
 * 		// function/variable declaration should be ambient
 * 		return decl != nil && decl.Flags&ast.NodeFlagsAmbient != 0
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isCommonJSRequire(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::keyBuilder.hash","kind":"method","status":"implemented","sigHash":"2104c6c9cd93d3129bc35a7c933f72b8dcee8db01810f0e4b6ad7eb8af63e0e1","bodyHash":"4bf1c89469142c06f771ce0a7b30c2162807d095480f3504efe4dca66116e573"}
 *
 * Go source:
 * func (b *keyBuilder) hash() CacheHashKey {
 * 	return CacheHashKey(b.h.Sum128())
 * }
 */
export declare function keyBuilder_hash(receiver: GoPtr<keyBuilder>): CacheHashKey;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getPropertiesOfContext","kind":"method","status":"implemented","sigHash":"1a23e0780b454b5da5e41f8d8b76d27cf056d0dcc6f258c8cae786e64389455a","bodyHash":"448795a77b3b76b0d93fc8900dbbb4811ecb4c4d6155a563cbe3cf220a517f9a"}
 *
 * Go source:
 * func (c *Checker) getPropertiesOfContext(context *WideningContext) []*ast.Symbol {
 * 	if context.resolvedProperties == nil {
 * 		var names collections.OrderedMap[string, *ast.Symbol]
 * 		for _, t := range c.getSiblingsOfContext(context) {
 * 			if isObjectLiteralType(t) && t.objectFlags&ObjectFlagsContainsSpread == 0 {
 * 				for _, prop := range c.getPropertiesOfType(t) {
 * 					names.Set(prop.Name, prop)
 * 				}
 * 			}
 * 		}
 * 		context.resolvedProperties = slices.Collect(names.Values())
 * 	}
 * 	return context.resolvedProperties
 * }
 */
export declare function Checker_getPropertiesOfContext(receiver: GoPtr<Checker>, context: GoPtr<WideningContext>): GoSlice<GoPtr<Symbol>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSiblingsOfContext","kind":"method","status":"implemented","sigHash":"41393137298475abfd74ae04a0ef2fa9ad34e0bd6e3cde2a538c5ba385aab8fa","bodyHash":"08d6cf59b8a38107437ecc54383dedf6590a9ffb9450b834e6da89d85d1a67c9"}
 *
 * Go source:
 * func (c *Checker) getSiblingsOfContext(context *WideningContext) []*Type {
 * 	if context.siblings == nil {
 * 		siblings := []*Type{}
 * 		for _, t := range c.getSiblingsOfContext(context.parent) {
 * 			if isObjectLiteralType(t) {
 * 				prop := c.getPropertyOfObjectType(t, context.propertyName)
 * 				if prop != nil {
 * 					siblings = append(siblings, c.getTypeOfSymbol(prop).Distributed()...)
 * 				}
 * 			}
 * 		}
 * 		context.siblings = siblings
 * 	}
 * 	return context.siblings
 * }
 */
export declare function Checker_getSiblingsOfContext(receiver: GoPtr<Checker>, context: GoPtr<WideningContext>): GoSlice<GoPtr<Type>>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addOptionality","kind":"method","status":"implemented","sigHash":"482049c3f4b17a1ff05599e171d898e953f5911ddbe56ecf07fb76b87bdc9ae9","bodyHash":"9446346c2f538dccf40f5c232d617b5939d5ae5adca5233542253067a714100e"}
 *
 * Go source:
 * func (c *Checker) addOptionality(t *Type) *Type {
 * 	return c.addOptionalityEx(t, false /*isProperty* /, true /*isOptional* /)
 * }
 */
export declare function Checker_addOptionality(receiver: GoPtr<Checker>, t: GoPtr<Type>): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.addOptionalityEx","kind":"method","status":"implemented","sigHash":"0f378c67ce04156fa0a8ac28be2b6af75e77e5b80e177e78d4f62d9ace1a01ed","bodyHash":"54239a4c2b4f378ee3c928bd1ed9d48e42747d3ebaecbcd421eacfabcfe7f53b"}
 *
 * Go source:
 * func (c *Checker) addOptionalityEx(t *Type, isProperty bool, isOptional bool) *Type {
 * 	if c.strictNullChecks && isOptional {
 * 		return c.getOptionalType(t, isProperty)
 * 	}
 * 	return t
 * }
 */
export declare function Checker_addOptionalityEx(receiver: GoPtr<Checker>, t: GoPtr<Type>, isProperty: bool, isOptional: bool): GoPtr<Type>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isVarConstLike","kind":"method","status":"implemented","sigHash":"ed45b4077927d926ef190ba4b5f8a3ac862a28f8664cf8f81b5220695514ef87","bodyHash":"b42d5f720663aca512553a0495425c70ec6ae18b453bc74292eb4a1b3ecb51c1"}
 *
 * Go source:
 * func (c *Checker) isVarConstLike(node *ast.Node) bool {
 * 	blockScopeKind := c.getCombinedNodeFlagsCached(node) & ast.NodeFlagsBlockScoped
 * 	return blockScopeKind == ast.NodeFlagsConst || blockScopeKind == ast.NodeFlagsUsing || blockScopeKind == ast.NodeFlagsAwaitUsing
 * }
 */
export declare function Checker_isVarConstLike(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getCombinedModifierFlagsCached","kind":"method","status":"implemented","sigHash":"74f3dac4d88be57c7d1233acc69633a741dab86e6be174d2c0c684d99b88b62d","bodyHash":"171c85c87c43ec6121b7de5f09837814cee9779788637785b0ee728524419c6b"}
 *
 * Go source:
 * func (c *Checker) getCombinedModifierFlagsCached(node *ast.Node) ast.ModifierFlags {
 * 	// we hold onto the last node and result to speed up repeated lookups against the same node.
 * 	if c.lastGetCombinedModifierFlagsNode == node {
 * 		return c.lastGetCombinedModifierFlagsResult
 * 	}
 * 	c.lastGetCombinedModifierFlagsNode = node
 * 	c.lastGetCombinedModifierFlagsResult = ast.GetCombinedModifierFlags(node)
 * 	return c.lastGetCombinedModifierFlagsResult
 * }
 */
export declare function Checker_getCombinedModifierFlagsCached(receiver: GoPtr<Checker>, node: GoPtr<Node>): ModifierFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getTailRecursionRoot","kind":"method","status":"implemented","sigHash":"a0fe74d52afc45c7b9cfffcb7e48f271349c9c194a244b1bd721fe9ff8505501","bodyHash":"846fb43c49270cbafd41a27b1b535ae74501b266155b401479d3be2ad8b8d877"}
 *
 * Go source:
 * func (c *Checker) getTailRecursionRoot(newType *Type, newMapper *TypeMapper) (*ConditionalRoot, *TypeMapper) {
 * 	if newType.flags&TypeFlagsConditional != 0 && newMapper != nil {
 * 		newRoot := newType.AsConditionalType().root
 * 		if len(newRoot.outerTypeParameters) != 0 {
 * 			typeParamMapper := c.combineTypeMappers(newType.AsConditionalType().mapper, newMapper)
 * 			typeArguments := core.Map(newRoot.outerTypeParameters, func(t *Type) *Type { return typeParamMapper.Map(t) })
 * 			newRootMapper := newTypeMapper(newRoot.outerTypeParameters, typeArguments)
 * 			var newCheckType *Type
 * 			if newRoot.isDistributive {
 * 				newCheckType = newRootMapper.Map(newRoot.checkType)
 * 			}
 * 			if newCheckType == nil || newCheckType == newRoot.checkType || newCheckType.flags&(TypeFlagsUnion|TypeFlagsNever) == 0 {
 * 				return newRoot, newRootMapper
 * 			}
 * 		}
 * 	}
 * 	return nil, nil
 * }
 */
export declare function Checker_getTailRecursionRoot(receiver: GoPtr<Checker>, newType: GoPtr<Type>, newMapper: GoPtr<TypeMapper>): [GoPtr<ConditionalRoot>, GoPtr<TypeMapper>];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.markLinkedReferences","kind":"method","status":"implemented","sigHash":"9d4446b6e2a0c90550e3b4560025f3613ee6c849fef58a70a9b4156820b0170a","bodyHash":"c7ad211d7a4abb12fe7ff041b0fa8aa1c1429c37a1896387180a157094ff3f83"}
 *
 * Go source:
 * func (c *Checker) markLinkedReferences(location *ast.Node, hint ReferenceHint, propSymbol *ast.Symbol, parentType *Type) {
 * 	if !c.canCollectSymbolAliasAccessibilityData {
 * 		return
 * 	}
 * 	if location.Flags&ast.NodeFlagsAmbient != 0 && !ast.IsPropertySignatureDeclaration(location) && !ast.IsPropertyDeclaration(location) {
 * 		// References within types and declaration files are never going to contribute to retaining a JS import,
 * 		// except for properties (which can be decorated).
 * 		return
 * 	}
 * 	switch hint {
 * 	case ReferenceHintIdentifier:
 * 		c.markIdentifierAliasReferenced(location)
 * 	case ReferenceHintProperty:
 * 		c.markPropertyAliasReferenced(location, propSymbol, parentType)
 * 	case ReferenceHintExportAssignment:
 * 		c.markExportAssignmentAliasReferenced(location)
 * 	case ReferenceHintJsx:
 * 		c.markJsxAliasReferenced(location)
 * 	case ReferenceHintExportImportEquals:
 * 		c.markImportEqualsAliasReferenced(location)
 * 	case ReferenceHintExportSpecifier:
 * 		c.markExportSpecifierAliasReferenced(location)
 * 	case ReferenceHintDecorator:
 * 		c.markDecoratorAliasReferenced(location)
 * 	case ReferenceHintUnspecified:
 * 		// Identifiers in expression contexts are emitted, so we need to follow their referenced aliases and mark them as used
 * 		// Some non-expression identifiers are also treated as expression identifiers for this purpose, eg, `a` in `b = {a}` or `q` in `import r = q`
 * 		// This is the exception, rather than the rule - most non-expression identifiers are declaration names.
 * 		if ast.IsIdentifier(location) &&
 * 			(ast.IsExpressionNode(location) ||
 * 				ast.IsShorthandPropertyAssignment(location.Parent) ||
 * 				(ast.IsImportEqualsDeclaration(location.Parent) &&
 * 					location.Parent.AsImportEqualsDeclaration().ModuleReference == location)) &&
 * 			shouldMarkIdentifierAliasReferenced(location) {
 * 			if ast.IsPropertyAccessOrQualifiedName(location.Parent) {
 * 				var left *ast.Node
 * 				if ast.IsPropertyAccessExpression(location.Parent) {
 * 					left = location.Parent.Expression()
 * 				} else {
 * 					left = location.Parent.AsQualifiedName().Left
 * 				}
 * 				if left != location {
 * 					return // Only mark the LHS (the RHS is a property lookup)
 * 				}
 * 			}
 * 			c.markIdentifierAliasReferenced(location)
 * 			return
 * 		}
 * 		if ast.IsPropertyAccessOrQualifiedName(location) {
 * 			topProp := location
 * 			for ast.IsPropertyAccessOrQualifiedName(topProp) {
 * 				if ast.IsPartOfTypeNode(topProp) {
 * 					return
 * 				}
 * 				topProp = topProp.Parent
 * 			}
 * 			c.markPropertyAliasReferenced(location, nil /*propSymbol* /, nil /*parentType* /)
 * 			return
 * 		}
 * 		if ast.IsExportAssignment(location) {
 * 			c.markExportAssignmentAliasReferenced(location)
 * 			return
 * 		}
 * 		if ast.IsJsxOpeningLikeElement(location) || ast.IsJsxOpeningFragment(location) {
 * 			c.markJsxAliasReferenced(location)
 * 			return
 * 		}
 * 		if ast.IsImportEqualsDeclaration(location) {
 * 			if isInternalModuleImportEqualsDeclaration(location) || c.checkExternalImportOrExportDeclaration(location) {
 * 				c.markImportEqualsAliasReferenced(location)
 * 				return
 * 			}
 * 			return
 * 		}
 * 		if ast.IsExportSpecifier(location) {
 * 			c.markExportSpecifierAliasReferenced(location)
 * 			return
 * 		}
 * 		if !c.compilerOptions.EmitDecoratorMetadata.IsTrue() {
 * 			return
 * 		}
 * 		if !ast.CanHaveDecorators(location) || !ast.HasDecorators(location) || location.Modifiers() == nil || !ast.NodeCanBeDecorated(c.legacyDecorators, location, location.Parent, location.Parent.Parent) {
 * 			return
 * 		}
 *
 * 		c.markDecoratorAliasReferenced(location)
 * 		return
 * 	default:
 * 		panic("Unhandled reference hint")
 * 	}
 * }
 */
export declare function Checker_markLinkedReferences(receiver: GoPtr<Checker>, location: GoPtr<Node>, hint: ReferenceHint, propSymbol: GoPtr<Symbol>, parentType: GoPtr<Type>): void;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.getSpreadIndices","kind":"method","status":"implemented","sigHash":"df037ff12f24f15a35e54c86020e0941409f30ac261a7036b52d32f324d39197","bodyHash":"5ecfe64992fe3d3b9a2273e93a6efcff2b4dfdfbd395c47d27cbe3166fcff065"}
 *
 * Go source:
 * func (c *Checker) getSpreadIndices(node *ast.Node) (int, int) {
 * 	links := c.arrayLiteralLinks.Get(node)
 * 	if !links.indicesComputed {
 * 		first, last := -1, -1
 * 		for i, element := range node.Elements() {
 * 			if ast.IsSpreadElement(element) {
 * 				if first < 0 {
 * 					first = i
 * 				}
 * 				last = i
 * 			}
 * 		}
 * 		links.firstSpreadIndex, links.lastSpreadIndex = first, last
 * 		links.indicesComputed = true
 * 	}
 * 	return links.firstSpreadIndex, links.lastSpreadIndex
 * }
 */
export declare function Checker_getSpreadIndices(receiver: GoPtr<Checker>, node: GoPtr<Node>): [int, int];
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/checker.go::method::Checker.isContextSensitive","kind":"method","status":"implemented","sigHash":"24fe0d73fcb505ece3b2fe654fb31801120fedd7d1deaf1bf62fb363d8b74e84","bodyHash":"7c30b43402182a4da2e551443fb9ebbf73318f536b3abe30b0b274ef82b3eeb7"}
 *
 * Go source:
 * func (c *Checker) isContextSensitive(node *ast.Node) bool {
 * 	switch node.Kind {
 * 	case ast.KindFunctionExpression, ast.KindArrowFunction, ast.KindMethodDeclaration, ast.KindFunctionDeclaration:
 * 		return c.isContextSensitiveFunctionLikeDeclaration(node)
 * 	case ast.KindObjectLiteralExpression:
 * 		return core.Some(node.Properties(), c.isContextSensitive)
 * 	case ast.KindArrayLiteralExpression:
 * 		return core.Some(node.Elements(), c.isContextSensitive)
 * 	case ast.KindConditionalExpression:
 * 		return c.isContextSensitive(node.AsConditionalExpression().WhenTrue) || c.isContextSensitive(node.AsConditionalExpression().WhenFalse)
 * 	case ast.KindBinaryExpression:
 * 		binary := node.AsBinaryExpression()
 * 		return ast.NodeKindIs(binary.OperatorToken, ast.KindBarBarToken, ast.KindQuestionQuestionToken) && (c.isContextSensitive(binary.Left) || c.isContextSensitive(binary.Right))
 * 	case ast.KindPropertyAssignment:
 * 		return c.isContextSensitive(node.Initializer())
 * 	case ast.KindParenthesizedExpression:
 * 		return c.isContextSensitive(node.Expression())
 * 	case ast.KindJsxAttributes:
 * 		return core.Some(node.Properties(), c.isContextSensitive) || ast.IsJsxOpeningElement(node.Parent) && core.Some(node.Parent.Parent.Children().Nodes, c.isContextSensitive)
 * 	case ast.KindJsxAttribute:
 * 		// If there is no initializer, JSX attribute has a boolean value of true which is not context sensitive.
 * 		initializer := node.Initializer()
 * 		return initializer != nil && c.isContextSensitive(initializer)
 * 	case ast.KindJsxExpression:
 * 		// It is possible to that node.expression is undefined (e.g <div x={} />)
 * 		expression := node.Expression()
 * 		return expression != nil && c.isContextSensitive(expression)
 * 	case ast.KindYieldExpression:
 * 		expression := node.Expression()
 * 		return expression != nil && c.isContextSensitive(expression)
 * 	}
 * 	return false
 * }
 */
export declare function Checker_isContextSensitive(receiver: GoPtr<Checker>, node: GoPtr<Node>): bool;
//# sourceMappingURL=support-queries.d.ts.map