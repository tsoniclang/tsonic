import type { bool } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Node, NodeList } from "../ast/spine.js";
import type { PseudoParameter, PseudoType } from "../pseudochecker/type.js";
import type { NodeBuilderImpl } from "./nodebuilderimpl.js";
import type { Signature, Type, TypePredicate } from "./types.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeToNodeWithCheckerFallback","kind":"method","status":"implemented","sigHash":"8a9f5649c6a56ec2a9c83e4eed9cf68fb5429cd91fb54fe021f46b65d52b76c0","bodyHash":"ea437a86880cf12ceefbd487e7d6f5d6df53237efdddaf3a44bc7786370207df"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoTypeToNodeWithCheckerFallback(t *pseudochecker.PseudoType, checkerType *Type) *ast.Node {
 * 	if t.Kind == pseudochecker.PseudoTypeKindInferred {
 * 		if !b.ctx.suppressReportInferenceFallback {
 * 			if errorNodes := t.AsPseudoTypeInferred().ErrorNodes; len(errorNodes) > 0 {
 * 				for _, n := range errorNodes {
 * 					b.ctx.tracker.ReportInferenceFallback(n)
 * 				}
 * 			} else {
 * 				b.ctx.tracker.ReportInferenceFallback(t.AsPseudoTypeInferred().Expression)
 * 			}
 * 		}
 * 		oldSuppress := b.ctx.suppressReportInferenceFallback
 * 		b.ctx.suppressReportInferenceFallback = true
 * 		result := b.typeToTypeNode(checkerType)
 * 		b.ctx.suppressReportInferenceFallback = oldSuppress
 * 		return result
 * 	} else if t.Kind == pseudochecker.PseudoTypeKindDirect {
 * 		existing := t.AsPseudoTypeDirect().TypeNode
 * 		if !b.existingTypeNodeIsNotReferenceOrIsReferenceWithCompatibleTypeArgumentCount(existing, checkerType) {
 * 			if !b.ctx.suppressReportInferenceFallback {
 * 				b.ctx.tracker.ReportInferenceFallback(existing)
 * 			}
 * 			oldSuppress := b.ctx.suppressReportInferenceFallback
 * 			b.ctx.suppressReportInferenceFallback = true
 * 			result := b.typeToTypeNode(checkerType)
 * 			b.ctx.suppressReportInferenceFallback = oldSuppress
 * 			return result
 * 		}
 * 	}
 * 	return b.pseudoTypeToNode(t)
 * }
 */
export declare function NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>, checkerType: GoPtr<Type>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeToNode","kind":"method","status":"implemented","sigHash":"37cf2f717de621c103c51df5aa4f15fc6c5bc7082cda2dd6e6ebec393ef5217d","bodyHash":"605aba82bf14d054086ddb9fa80b69600449fe16b08b9f60847ce88994628487"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoTypeToNode(t *pseudochecker.PseudoType) *ast.Node {
 * 	debug.Assert(t != nil, "Attempted to serialize nil pseudotype")
 * 	switch t.Kind {
 * 	case pseudochecker.PseudoTypeKindDirect:
 * 		return b.reuseTypeNode(t.AsPseudoTypeDirect().TypeNode)
 * 	case pseudochecker.PseudoTypeKindInferred:
 * 		inferred := t.AsPseudoTypeInferred()
 * 		node := inferred.Expression
 * 		if errorNodes := inferred.ErrorNodes; len(errorNodes) > 0 {
 * 			for _, n := range errorNodes {
 * 				b.ctx.tracker.ReportInferenceFallback(n)
 * 			}
 * 		} else if ast.IsEntityNameExpression(node) && ast.IsDeclaration(node.Parent) {
 * 			b.ctx.tracker.ReportInferenceFallback(node.Parent)
 * 		} else {
 * 			b.ctx.tracker.ReportInferenceFallback(node)
 * 		}
 * 		// use symbol type from parent declaration to automatically handle expression type widening without duplicating logic
 * 		if ast.IsReturnStatement(node.Parent) {
 * 			enclosing := ast.GetContainingFunction(node)
 * 			if ast.IsAccessor(enclosing) {
 * 				return b.serializeTypeForDeclaration(enclosing, nil, nil, false)
 * 			}
 * 			return b.serializeReturnTypeForSignature(b.ch.getSignatureFromDeclaration(enclosing), false)
 * 		}
 * 		if ast.IsArrowFunction(node.Parent) && node.Parent.AsArrowFunction().Body == node {
 * 			return b.serializeReturnTypeForSignature(b.ch.getSignatureFromDeclaration(node.Parent), false)
 * 		}
 * 		if ast.IsDeclaration(node.Parent) {
 * 			return b.serializeTypeForDeclaration(node.Parent, nil, nil, false)
 * 		}
 * 		// This might be effectively unreachable. If it's not, it may need more widening rules to mirror checker behavior for whatever expressions are serialized here
 * 		ty := b.ch.getTypeOfExpression(node)
 * 		return b.typeToTypeNode(ty)
 * 	case pseudochecker.PseudoTypeKindNoResult:
 * 		node := t.AsPseudoTypeNoResult().Declaration
 * 		b.ctx.tracker.ReportInferenceFallback(node)
 * 		if ast.IsFunctionLike(node) && !ast.IsAccessor(node) {
 * 			return b.serializeReturnTypeForSignature(b.ch.getSignatureFromDeclaration(node), false)
 * 		}
 * 		return b.serializeTypeForDeclaration(node, nil, nil, false)
 * 	case pseudochecker.PseudoTypeKindMaybeConstLocation:
 * 		d := t.AsPseudoTypeMaybeConstLocation()
 * 		// see checkExpressionWithContextualType for general literal widening rules which need to be emulated here, plus
 * 		// checkTemplateLiteralExpression for template literal widening rules if the pseudochecker ever supports literalized templates
 * 		isInConstContext := b.ch.isConstContext(d.Node)
 * 		if !isInConstContext && pseudochecker.IsInConstContext(d.Node) {
 * 			// Only consult the contextual type if the pseudochecker's syntactic check also puts us in a const context.
 * 			// getContextualType returns post-inference results at node-printing time which may not have existed
 * 			// during initial checking (e.g. when the contextual type depends on inference), causing incorrect
 * 			// literal type preservation.
 * 			contextualType := b.ch.getContextualType(d.Node, ContextFlagsNone)
 * 			t := b.pseudoTypeToType(d.ConstType)
 * 			if t != nil && b.ch.isLiteralOfContextualType(t, b.ch.instantiateContextualType(contextualType, d.Node, ContextFlagsNone)) {
 * 				isInConstContext = true
 * 			}
 * 		}
 * 		if isInConstContext {
 * 			return b.pseudoTypeToNode(d.ConstType)
 * 		} else {
 * 			return b.pseudoTypeToNode(d.RegularType)
 * 		}
 * 	case pseudochecker.PseudoTypeKindUnion:
 * 		var res []*ast.Node
 * 		var hasElidedType bool
 * 		members := t.AsPseudoTypeUnion().Types
 * 		for _, m := range members {
 * 			if !b.ch.strictNullChecks {
 * 				if m.Kind == pseudochecker.PseudoTypeKindUndefined || m.Kind == pseudochecker.PseudoTypeKindNull {
 * 					hasElidedType = true
 * 					continue
 * 				}
 * 			}
 * 			res = append(res, b.pseudoTypeToNode(m))
 * 		}
 * 		if len(res) == 1 {
 * 			return res[0]
 * 		}
 * 		if len(res) == 0 {
 * 			if hasElidedType {
 * 				return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 			}
 * 			return b.f.NewKeywordTypeNode(ast.KindNeverKeyword)
 * 		}
 * 		return b.f.NewUnionTypeNode(b.f.NewNodeList(res))
 * 	case pseudochecker.PseudoTypeKindUndefined:
 * 		if !b.ch.strictNullChecks {
 * 			return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 		}
 * 		return b.f.NewKeywordTypeNode(ast.KindUndefinedKeyword)
 * 	case pseudochecker.PseudoTypeKindNull:
 * 		if !b.ch.strictNullChecks {
 * 			return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 		}
 * 		return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindNullKeyword))
 * 	case pseudochecker.PseudoTypeKindAny:
 * 		return b.f.NewKeywordTypeNode(ast.KindAnyKeyword)
 * 	case pseudochecker.PseudoTypeKindString:
 * 		return b.f.NewKeywordTypeNode(ast.KindStringKeyword)
 * 	case pseudochecker.PseudoTypeKindNumber:
 * 		return b.f.NewKeywordTypeNode(ast.KindNumberKeyword)
 * 	case pseudochecker.PseudoTypeKindBigInt:
 * 		return b.f.NewKeywordTypeNode(ast.KindBigIntKeyword)
 * 	case pseudochecker.PseudoTypeKindBoolean:
 * 		return b.f.NewKeywordTypeNode(ast.KindBooleanKeyword)
 * 	case pseudochecker.PseudoTypeKindFalse:
 * 		return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindFalseKeyword))
 * 	case pseudochecker.PseudoTypeKindTrue:
 * 		return b.f.NewLiteralTypeNode(b.f.NewKeywordExpression(ast.KindTrueKeyword))
 * 	case pseudochecker.PseudoTypeKindSingleCallSignature:
 * 		d := t.AsPseudoTypeSingleCallSignature()
 * 		signature := b.ch.getSignatureFromDeclaration(d.Signature)
 * 		expandedParams := b.ch.getExpandedParameters(signature, true /*skipUnionExpanding* /)[0]
 * 		cleanup := b.enterNewScope(d.Signature, expandedParams, signature.typeParameters, signature.parameters, signature.mapper)
 * 		defer cleanup()
 * 		var typeParams *ast.NodeList
 * 		if len(d.TypeParameters) > 0 {
 * 			res := make([]*ast.Node, 0, len(d.TypeParameters))
 * 			for _, tp := range d.TypeParameters {
 * 				res = append(res, b.reuseNode(tp.AsNode()))
 * 			}
 * 			typeParams = b.f.NewNodeList(res)
 * 		}
 * 		params := b.pseudoParametersToNodeList(d.Parameters)
 * 		returnType := b.pseudoTypeToNode(d.ReturnType)
 * 		return b.f.NewFunctionTypeNode(typeParams, params, returnType)
 * 	case pseudochecker.PseudoTypeKindTuple:
 * 		var res []*ast.Node
 * 		elements := t.AsPseudoTypeTuple().Elements
 * 		for _, e := range elements {
 * 			res = append(res, b.pseudoTypeToNode(e))
 * 		}
 * 		// pseudo-tuples are implicitly `readonly` since they originate from `as const` contexts
 * 		// but strada *sometimes* fails to add the `readonly` modifier to the generated node.
 * 		result := b.f.NewTupleTypeNode(b.f.NewNodeList(res))
 * 		b.e.AddEmitFlags(result, printer.EFSingleLine)
 * 		return b.f.NewTypeOperatorNode(ast.KindReadonlyKeyword, result)
 * 	case pseudochecker.PseudoTypeKindObjectLiteral:
 * 		elements := t.AsPseudoTypeObjectLiteral().Elements
 * 		if len(elements) == 0 {
 * 			result := b.f.NewTypeLiteralNode(b.f.NewNodeList(nil))
 * 			b.e.AddEmitFlags(result, printer.EFSingleLine)
 * 			return result
 * 		}
 * 		// NOTE: using the checker's `isConstContext` instead of the pseudochecker's `isInConstContext`
 * 		// results in different results here. The checker one is more "correct" but means we'll mark
 * 		// objects in parameter positions contextually typed by const type parameters as readonly -
 * 		// something a true syntactic ID emitter couldn't possibly know (since the signature could
 * 		// be from across files). This can't *really* happen in any cases ID doesn't already error on, though.
 * 		// Just something to keep in mind if the ID checker keeps growing.
 * 		isConst := b.ch.isConstContext(elements[0].Name.Parent.Parent)
 * 		newElements := make([]*ast.Node, 0, len(elements))
 *
 * 		// Member types are serialized within an object type literal, so set the
 * 		// corresponding flag to mirror createTypeNodeFromObjectType. This ensures
 * 		// inaccessible `this` references inside the members are reported (TS2527).
 * 		restoreObjectLiteralFlags := b.saveRestoreFlags()
 * 		b.ctx.flags |= nodebuilder.FlagsInObjectTypeLiteral
 *
 * 		for _, e := range elements {
 * 			var modifiers *ast.ModifierList
 * 			if isConst || (e.Kind == pseudochecker.PseudoObjectElementKindPropertyAssignment && e.AsPseudoPropertyAssignment().Readonly) {
 * 				modifiers = b.f.NewModifierList([]*ast.Node{b.f.NewModifier(ast.KindReadonlyKeyword)})
 * 			}
 * 			var cleanup func()
 * 			if e.Kind != pseudochecker.PseudoObjectElementKindPropertyAssignment {
 * 				signature := b.ch.getSignatureFromDeclaration(e.Signature())
 * 				expandedParams := b.ch.getExpandedParameters(signature, true /*skipUnionExpanding* /)[0]
 * 				cleanup = b.enterNewScope(e.Signature(), expandedParams, signature.typeParameters, signature.parameters, signature.mapper)
 * 			}
 * 			var newProp *ast.Node
 * 			switch e.Kind {
 * 			case pseudochecker.PseudoObjectElementKindMethod:
 * 				d := e.AsPseudoObjectMethod()
 * 				var typeParams *ast.NodeList
 * 				if len(d.TypeParameters) > 0 {
 * 					res := make([]*ast.Node, 0, len(d.TypeParameters))
 * 					for _, tp := range d.TypeParameters {
 * 						res = append(res, b.reuseNode(tp.AsNode()))
 * 					}
 * 					typeParams = b.f.NewNodeList(res)
 * 				}
 * 				if isConst {
 * 					newProp = b.f.NewPropertySignatureDeclaration(
 * 						modifiers,
 * 						b.reuseName(e.Name, false /*isMethod* /),
 * 						nil,
 * 						b.f.NewFunctionTypeNode(
 * 							typeParams,
 * 							b.pseudoParametersToNodeList(d.Parameters),
 * 							b.pseudoTypeToNode(d.ReturnType),
 * 						),
 * 						nil,
 * 					)
 * 					break
 * 				}
 * 				newProp = b.f.NewMethodSignatureDeclaration(
 * 					modifiers,
 * 					b.reuseName(e.Name, true /*isMethod* /),
 * 					nil,
 * 					typeParams,
 * 					b.pseudoParametersToNodeList(d.Parameters),
 * 					b.pseudoTypeToNode(d.ReturnType),
 * 				)
 * 			case pseudochecker.PseudoObjectElementKindPropertyAssignment:
 * 				d := e.AsPseudoPropertyAssignment()
 * 				newProp = b.f.NewPropertySignatureDeclaration(
 * 					modifiers,
 * 					b.reuseName(e.Name, false /*isMethod* /),
 * 					nil,
 * 					b.pseudoTypeToNode(d.Type),
 * 					nil,
 * 				)
 * 			case pseudochecker.PseudoObjectElementKindSetAccessor:
 * 				d := e.AsPseudoSetAccessor()
 * 				newProp = b.f.NewSetAccessorDeclaration(
 * 					nil,
 * 					b.reuseName(e.Name, false /*isMethod* /),
 * 					nil,
 * 					b.f.NewNodeList([]*ast.Node{b.pseudoParameterToNode(d.Parameter)}),
 * 					nil,
 * 					nil,
 * 					nil,
 * 				)
 * 			case pseudochecker.PseudoObjectElementKindGetAccessor:
 * 				d := e.AsPseudoGetAccessor()
 * 				newProp = b.f.NewGetAccessorDeclaration(
 * 					nil,
 * 					b.reuseName(e.Name, false /*isMethod* /),
 * 					nil,
 * 					nil,
 * 					b.pseudoTypeToNode(d.Type),
 * 					nil,
 * 					nil,
 * 				)
 * 			}
 * 			if b.ctx.enclosingFile == ast.GetSourceFileOfNode(e.Name) {
 * 				b.e.SetCommentRange(newProp, e.Name.Parent.Loc)
 * 			}
 * 			newElements = append(newElements, newProp)
 * 			if cleanup != nil {
 * 				cleanup()
 * 			}
 * 		}
 * 		restoreObjectLiteralFlags()
 * 		result := b.f.NewTypeLiteralNode(b.f.NewNodeList(newElements))
 * 		if b.ctx.flags&nodebuilder.FlagsMultilineObjectLiterals == 0 {
 * 			b.e.AddEmitFlags(result, printer.EFSingleLine)
 * 		}
 * 		return result
 * 	case pseudochecker.PseudoTypeKindStringLiteral, pseudochecker.PseudoTypeKindNumericLiteral, pseudochecker.PseudoTypeKindBigIntLiteral:
 * 		source := t.AsPseudoTypeLiteral().Node
 * 		return b.f.NewLiteralTypeNode(b.reuseNode(source))
 * 	default:
 * 		debug.AssertNever(t.Kind, "Unhandled pseudotype kind in pseudotype node construction")
 * 		return nil
 * 	}
 * }
 */
export declare function NodeBuilderImpl_pseudoTypeToNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoParametersToNodeList","kind":"method","status":"implemented","sigHash":"f0fe4b415b152c002383a80811a992fc65a5c6b021b6dde24a423bb2907fd723","bodyHash":"bf32582af4421b5c821573823df0a36f36e6d984ad1cf1a0618e0408e751944d"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoParametersToNodeList(params []*pseudochecker.PseudoParameter) *ast.NodeList {
 * 	res := make([]*ast.Node, 0, len(params))
 * 	for _, p := range params {
 * 		res = append(res, b.pseudoParameterToNode(p))
 * 	}
 * 	return b.f.NewNodeList(res)
 * }
 */
export declare function NodeBuilderImpl_pseudoParametersToNodeList(receiver: GoPtr<NodeBuilderImpl>, params: GoSlice<GoPtr<PseudoParameter>>): GoPtr<NodeList>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoParameterToNode","kind":"method","status":"implemented","sigHash":"0a9a217c93e6aaa3ee3c061f128d5c336c3f8c6b40606d23b0d0559245ba6f58","bodyHash":"80b72720ca1fe2db12e987f0e9f31df22aab156ffcde6acc6b9628756c02f439"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoParameterToNode(p *pseudochecker.PseudoParameter) *ast.Node {
 * 	var dotDotDot *ast.Node
 * 	var questionMark *ast.Node
 * 	if p.Rest {
 * 		dotDotDot = b.f.NewToken(ast.KindDotDotDotToken)
 * 	}
 * 	if p.Optional {
 * 		questionMark = b.f.NewToken(ast.KindQuestionToken)
 * 	}
 * 	parameter := b.f.NewParameterDeclaration(
 * 		nil,
 * 		dotDotDot,
 * 		// matches strada behavior of always reserializing param names from scratch
 * 		b.parameterToParameterDeclarationName(p.Name.Parent.Symbol(), p.Name.Parent),
 * 		questionMark,
 * 		b.pseudoTypeToNode(p.Type),
 * 		nil,
 * 	)
 * 	if original := p.Name.Parent; ast.IsParameterDeclaration(original) {
 * 		b.setCommentRange(parameter, original)
 * 	}
 * 	return parameter
 * }
 */
export declare function NodeBuilderImpl_pseudoParameterToNode(receiver: GoPtr<NodeBuilderImpl>, p: GoPtr<PseudoParameter>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeEquivalentToType","kind":"method","status":"implemented","sigHash":"2d24409a328982569558d779ab6b959fb123c96438ac4c5338c8b16e3ff89d73","bodyHash":"fa2fbe90b13972a8cbdcd2ebd12417ba738ddf6150061dfd08ced96f2aa0b5b1"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoTypeEquivalentToType(t *pseudochecker.PseudoType, type_ *Type, isOptionalAnnotated bool, reportErrors bool) bool {
 * 	// if type_ resolves to an error, we charitably assume equality, since we might be in a single-file checking mode
 * 	if type_ != nil && b.ch.isErrorType(type_) {
 * 		return true
 * 	}
 * 	// If we can easily operate on just types, we should
 * 	typeFromPseudo := b.pseudoTypeToType(t) // note: cannot convert complex types like objects, which must be validated separately
 * 	if typeFromPseudo == type_ {
 * 		return true
 * 	}
 * 	if typeFromPseudo != nil && type_ != nil {
 * 		if isOptionalAnnotated {
 * 			undefinedStripped := b.ch.getTypeWithFacts(type_, TypeFactsNEUndefined)
 * 			if undefinedStripped == typeFromPseudo {
 * 				return true
 * 			}
 * 			if typeFromPseudo.flags&TypeFlagsUnion != 0 && undefinedStripped.flags&TypeFlagsUnion != 0 {
 * 				// does union comparison in general, since the unions may not be `==` identical due to aliasing and the like
 * 				if b.ch.compareTypesIdentical(typeFromPseudo, undefinedStripped) == TernaryTrue {
 * 					return true
 * 				}
 * 			}
 * 		}
 * 		// handles freshness mismatches (e.g., fresh true vs regular true in as const)
 * 		if b.ch.getRegularTypeOfLiteralType(typeFromPseudo) == b.ch.getRegularTypeOfLiteralType(type_) {
 * 			return true
 * 		}
 * 		if typeFromPseudo.flags&TypeFlagsUnion != 0 && type_.flags&TypeFlagsUnion != 0 {
 * 			// handles union comparison in general, since unions may not be `==` identical due to aliasing
 * 			if b.ch.compareTypesIdentical(typeFromPseudo, type_) == TernaryTrue {
 * 				return true
 * 			}
 * 		}
 * 	}
 * 	// otherwise, fallback to actual pseudo/type cross-comparisons
 * 	switch t.Kind {
 * 	case pseudochecker.PseudoTypeKindInferred:
 * 		// PseudoTypeInferred with error nodes identifies specific problematic children.
 * 		// Report fine-grained errors on them, then return false so the parent falls back
 * 		// to checker-based serialization (avoiding issues like reusing raw JSON string
 * 		// literal property names from the pseudochecker's AST).
 * 		if errorNodes := t.AsPseudoTypeInferred().ErrorNodes; len(errorNodes) > 0 {
 * 			if reportErrors {
 * 				for _, n := range errorNodes {
 * 					b.ctx.tracker.ReportInferenceFallback(n)
 * 				}
 * 			}
 * 			return false
 * 		}
 * 		if reportErrors {
 * 			b.ctx.tracker.ReportInferenceFallback(t.AsPseudoTypeInferred().Expression)
 * 		}
 * 		return false
 * 	case pseudochecker.PseudoTypeKindObjectLiteral:
 * 		pt := t.AsPseudoTypeObjectLiteral()
 * 		if type_ == nil {
 * 			return false
 * 		}
 * 		targetProps := b.ch.getPropertiesOfType(type_)
 * 		// Count total declarations across all target prop symbols to handle getter/setter pairs,
 * 		// which are two elements in pt.Elements but only one symbol in targetProps.
 * 		targetDeclCount := 0
 * 		for _, prop := range targetProps {
 * 			targetDeclCount += len(prop.Declarations)
 * 		}
 * 		if len(pt.Elements) != targetDeclCount {
 * 			return false
 * 		}
 * 		for _, e := range pt.Elements {
 * 			var targetProp *ast.Symbol
 * 			elemSymbol := e.Name.Parent.Symbol()
 * 			if elemSymbol != nil {
 * 				targetProp = b.ch.getPropertyOfType(type_, elemSymbol.Name)
 * 			}
 * 			if targetProp == nil {
 * 				// Name lookup failed or returned no result; search target properties
 * 				// for one whose declaration name node matches the one we have
 * 				for _, prop := range targetProps {
 * 					if prop.ValueDeclaration != nil && prop.ValueDeclaration.Name() == e.Name {
 * 						targetProp = prop
 * 						break
 * 					}
 * 				}
 * 				if targetProp == nil {
 * 					if reportErrors {
 * 						b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 					}
 * 					return false
 * 				}
 * 			}
 * 			targetIsOptional := targetProp.Flags&ast.SymbolFlagsOptional != 0
 * 			if e.Optional != targetIsOptional {
 * 				if reportErrors {
 * 					b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 				}
 * 				return false
 * 			}
 * 			propType := b.ch.getTypeOfSymbol(targetProp)
 * 			propType = b.ch.removeMissingType(propType, targetIsOptional)
 * 			switch e.Kind {
 * 			case pseudochecker.PseudoObjectElementKindPropertyAssignment:
 * 				d := e.AsPseudoPropertyAssignment()
 * 				if !b.pseudoTypeEquivalentToType(d.Type, propType, e.Optional, false) {
 * 					if reportErrors {
 * 						if d.Type.Kind == pseudochecker.PseudoTypeKindInferred && len(d.Type.AsPseudoTypeInferred().ErrorNodes) > 0 {
 * 							// Re-report the fine-grained error nodes; the recursive call used reportErrors=false
 * 							for _, n := range d.Type.AsPseudoTypeInferred().ErrorNodes {
 * 								b.ctx.tracker.ReportInferenceFallback(n)
 * 							}
 * 						} else if !isStructuralPseudoType(d.Type) {
 * 							b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 						}
 * 					}
 * 					return false
 * 				}
 * 			case pseudochecker.PseudoObjectElementKindMethod:
 * 				d := e.AsPseudoObjectMethod()
 * 				targetSig := b.ch.getSingleCallSignature(propType)
 * 				if targetSig == nil {
 * 					// Target property type doesn't have a single call signature; can't validate
 * 					continue
 * 				}
 * 				paramEq := b.pseudoParametersEquivalentToParameters(d.Parameters, targetSig, reportErrors, e.Name.Parent)
 * 				if !paramEq {
 * 					return false
 * 				}
 * 				targetPredicate := b.ch.getTypePredicateOfSignature(targetSig)
 * 				if targetPredicate != nil {
 * 					if !b.pseudoReturnTypeMatchesPredicate(d.ReturnType, targetPredicate) {
 * 						if reportErrors {
 * 							b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 						}
 * 						return false
 * 					}
 * 				} else if !b.pseudoTypeEquivalentToType(d.ReturnType, b.ch.getReturnTypeOfSignature(targetSig), false, false) {
 * 					if reportErrors {
 * 						b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 					}
 * 					return false
 * 				}
 * 			case pseudochecker.PseudoObjectElementKindGetAccessor:
 * 				d := e.AsPseudoGetAccessor()
 * 				if !b.pseudoTypeEquivalentToType(d.Type, propType, false, false) {
 * 					if reportErrors {
 * 						b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 					}
 * 					return false
 * 				}
 * 			case pseudochecker.PseudoObjectElementKindSetAccessor:
 * 				d := e.AsPseudoSetAccessor()
 * 				writeType := b.ch.getWriteTypeOfSymbol(targetProp)
 * 				if !b.pseudoTypeEquivalentToType(d.Parameter.Type, writeType, false, false) {
 * 					if reportErrors {
 * 						b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 					}
 * 					return false
 * 				}
 * 			}
 * 		}
 * 		return true
 * 	case pseudochecker.PseudoTypeKindTuple:
 * 		pt := t.AsPseudoTypeTuple()
 * 		if type_ == nil || !isTupleType(type_) {
 * 			return false
 * 		}
 * 		tupleTarget := type_.TargetTupleType()
 * 		// Pseudo-tuples come from `as const` array literals, so they only ever have required elements.
 * 		// If the target tuple has optional, rest, or variadic elements, the structures can't match.
 * 		if tupleTarget.combinedFlags&ElementFlagsNonRequired != 0 {
 * 			return false
 * 		}
 * 		elementTypes := b.ch.getTypeArguments(type_)
 * 		if len(pt.Elements) != len(elementTypes) {
 * 			return false
 * 		}
 * 		for i, elem := range pt.Elements {
 * 			if !b.pseudoTypeEquivalentToType(elem, elementTypes[i], false, reportErrors) {
 * 				return false
 * 			}
 * 		}
 * 		return true
 * 	case pseudochecker.PseudoTypeKindSingleCallSignature:
 * 		targetSig := b.ch.getSingleCallSignature(type_)
 * 		if targetSig == nil {
 * 			return false
 * 		}
 * 		pt := t.AsPseudoTypeSingleCallSignature()
 * 		if len(targetSig.typeParameters) != len(pt.TypeParameters) {
 * 			if reportErrors {
 * 				b.ctx.tracker.ReportInferenceFallback(pt.Signature)
 * 			}
 * 			return false
 * 		}
 * 		paramEq := b.pseudoParametersEquivalentToParameters(pt.Parameters, targetSig, reportErrors, pt.Signature)
 * 		if !paramEq {
 * 			return false
 * 		}
 * 		targetPredicate := b.ch.getTypePredicateOfSignature(targetSig)
 * 		if targetPredicate != nil {
 * 			if !b.pseudoReturnTypeMatchesPredicate(pt.ReturnType, targetPredicate) {
 * 				if reportErrors {
 * 					b.ctx.tracker.ReportInferenceFallback(pt.Signature)
 * 				}
 * 				return false
 * 			}
 * 		} else if !b.pseudoTypeEquivalentToType(pt.ReturnType, b.ch.getReturnTypeOfSignature(targetSig), false, reportErrors) {
 * 			// error reported within the return type
 * 			return false
 * 		}
 * 		return true
 * 	case pseudochecker.PseudoTypeKindNoResult:
 * 		if reportErrors {
 * 			b.ctx.tracker.ReportInferenceFallback(t.AsPseudoTypeNoResult().Declaration)
 * 		}
 * 		return false
 * 	default:
 * 		return false
 * 	}
 * }
 */
export declare function NodeBuilderImpl_pseudoTypeEquivalentToType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>, type_: GoPtr<Type>, isOptionalAnnotated: bool, reportErrors: bool): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoParametersEquivalentToParameters","kind":"method","status":"implemented","sigHash":"8f17b6baa8627827a8b550e6be52d186f0d7e85a8289ae609ecb3dedbf74bfd5","bodyHash":"0bfc37f74014a6341db6824af1b0860058eb8c3022c2630caf3310a99e3dc3fe"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoParametersEquivalentToParameters(params []*pseudochecker.PseudoParameter, targetSig *Signature, reportErrors bool, nonParamErrorLocation *ast.Node) bool {
 * 	if targetSig.thisParameter != nil && len(params) == 0 {
 * 		if reportErrors {
 * 			b.ctx.tracker.ReportInferenceFallback(nonParamErrorLocation) // missing `this` param
 * 		}
 * 		return false
 * 	} else if targetSig.thisParameter != nil && ast.IsThisIdentifier(params[0].Name) {
 * 		targetParam := targetSig.thisParameter
 * 		paramType := b.ch.getTypeOfParameter(targetParam)
 * 		if !b.pseudoTypeEquivalentToType(params[0].Type, paramType, params[0].Optional, false) {
 * 			if reportErrors {
 * 				b.ctx.tracker.ReportInferenceFallback(params[0].Name.Parent)
 * 			}
 * 			return false
 * 		}
 * 		params = params[1:]
 * 	} else if targetSig.thisParameter != nil {
 * 		if reportErrors {
 * 			b.ctx.tracker.ReportInferenceFallback(nonParamErrorLocation)
 * 		}
 * 		return false
 * 	}
 * 	if len(targetSig.parameters) != len(params) {
 * 		if reportErrors {
 * 			b.ctx.tracker.ReportInferenceFallback(nonParamErrorLocation)
 * 		}
 * 		return false // TODO: spread tuple params may mess with this check
 * 	}
 * 	for i, p := range params {
 * 		targetParam := targetSig.parameters[i]
 * 		if p.Optional != b.ch.isOptionalParameter(targetParam.ValueDeclaration) {
 * 			if reportErrors {
 * 				b.ctx.tracker.ReportInferenceFallback(p.Name.Parent)
 * 			}
 * 			return false
 * 		}
 * 		paramType := b.ch.getTypeOfParameter(targetParam)
 * 		if !b.pseudoTypeEquivalentToType(p.Type, paramType, p.Optional, false) {
 * 			if reportErrors {
 * 				b.ctx.tracker.ReportInferenceFallback(p.Name.Parent)
 * 			}
 * 			return false
 * 		}
 * 	}
 * 	return true
 * }
 */
export declare function NodeBuilderImpl_pseudoParametersEquivalentToParameters(receiver: GoPtr<NodeBuilderImpl>, params: GoSlice<GoPtr<PseudoParameter>>, targetSig: GoPtr<Signature>, reportErrors: bool, nonParamErrorLocation: GoPtr<Node>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::func::isStructuralPseudoType","kind":"func","status":"implemented","sigHash":"2a1e667d34bc84505730961c22e313a4b894e57e9c173ee40f095605b3f599e9","bodyHash":"13bfaa29a0f9857d8dabe9a42a0ef3326b69b831856d1b7165ef7639a031fb26"}
 *
 * Go source:
 * func isStructuralPseudoType(t *pseudochecker.PseudoType) bool {
 * 	switch t.Kind {
 * 	case pseudochecker.PseudoTypeKindObjectLiteral, pseudochecker.PseudoTypeKindTuple, pseudochecker.PseudoTypeKindSingleCallSignature:
 * 		return true
 * 	case pseudochecker.PseudoTypeKindMaybeConstLocation:
 * 		d := t.AsPseudoTypeMaybeConstLocation()
 * 		return isStructuralPseudoType(d.ConstType) || isStructuralPseudoType(d.RegularType)
 * 	}
 * 	return false
 * }
 */
export declare function isStructuralPseudoType(t: GoPtr<PseudoType>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoReturnTypeMatchesPredicate","kind":"method","status":"implemented","sigHash":"f724e7b5afefecc94a62f0cf82933721516b9d8c8a7cf3dc8752dafa87ff3d14","bodyHash":"3aa0d7ed95fa60e2470898c172f96537cd655e5d57f693a56755a8cc9d4d4968"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoReturnTypeMatchesPredicate(rt *pseudochecker.PseudoType, predicate *TypePredicate) bool {
 * 	if rt.Kind != pseudochecker.PseudoTypeKindDirect {
 * 		return false
 * 	}
 * 	node := rt.AsPseudoTypeDirect().TypeNode
 * 	if !ast.IsTypePredicateNode(node) {
 * 		return false
 * 	}
 * 	tp := node.AsTypePredicateNode()
 * 	// Check asserts modifier matches
 * 	isAsserts := tp.AssertsModifier != nil
 * 	predicateIsAsserts := predicate.kind == TypePredicateKindAssertsThis || predicate.kind == TypePredicateKindAssertsIdentifier
 * 	if isAsserts != predicateIsAsserts {
 * 		return false
 * 	}
 * 	// Check this vs identifier matches
 * 	isThis := ast.IsThisTypeNode(tp.ParameterName)
 * 	predicateIsThis := predicate.kind == TypePredicateKindThis || predicate.kind == TypePredicateKindAssertsThis
 * 	if isThis != predicateIsThis {
 * 		return false
 * 	}
 * 	// For identifier predicates, check parameter name matches
 * 	if !isThis {
 * 		if tp.ParameterName.Text() != predicate.parameterName {
 * 			return false
 * 		}
 * 	}
 * 	// Check the narrowed type, if any
 * 	if predicate.t != nil {
 * 		if tp.Type == nil {
 * 			return false
 * 		}
 * 		predicateTypeFromNode := b.ch.getTypeFromTypeNode(tp.Type)
 * 		if predicateTypeFromNode != predicate.t {
 * 			if b.ch.compareTypesIdentical(predicateTypeFromNode, predicate.t) != TernaryTrue {
 * 				return false
 * 			}
 * 		}
 * 	} else if tp.Type != nil {
 * 		return false
 * 	}
 * 	return true
 * }
 */
export declare function NodeBuilderImpl_pseudoReturnTypeMatchesPredicate(receiver: GoPtr<NodeBuilderImpl>, rt: GoPtr<PseudoType>, predicate: GoPtr<TypePredicate>): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeToType","kind":"method","status":"implemented","sigHash":"514ab67c04d4af90f1383d187835e33312acaf16adc0f56bd81a2a78097466cb","bodyHash":"f519a13fa5c0ee58b2c153ae066a85024e464bf4f38db6c091368c97ee472e02"}
 *
 * Go source:
 * func (b *NodeBuilderImpl) pseudoTypeToType(t *pseudochecker.PseudoType) *Type {
 * 	// !!! TODO: only literal types currently mapped because this is only used to determine if literal contextual typing need apply to the pseudotype
 * 	// If this is used more broadly, the implementation needs to be filled out more to handle the structural pseudotypes - signatures, objects, tuples, etc
 * 	debug.Assert(t != nil, "Attempted to realize nil pseudotype")
 * 	switch t.Kind {
 * 	case pseudochecker.PseudoTypeKindDirect:
 * 		return b.ch.getTypeFromTypeNode(t.AsPseudoTypeDirect().TypeNode)
 * 	case pseudochecker.PseudoTypeKindInferred:
 * 		node := t.AsPseudoTypeInferred().Expression
 * 		ty := b.ch.getWidenedType(b.ch.getRegularTypeOfExpression(node))
 * 		return ty
 * 	case pseudochecker.PseudoTypeKindNoResult:
 * 		return nil // TODO: extract type selection logic from `serializeTypeForDeclaration`, not needed for current usecases but needed if completeness becomes required
 * 	case pseudochecker.PseudoTypeKindMaybeConstLocation:
 * 		d := t.AsPseudoTypeMaybeConstLocation()
 * 		if b.ch.isConstContext(d.Node) {
 * 			return b.pseudoTypeToType(d.ConstType)
 * 		}
 * 		return b.pseudoTypeToType(d.RegularType)
 * 	case pseudochecker.PseudoTypeKindUnion:
 * 		var res []*Type
 * 		var hasElidedType bool
 * 		members := t.AsPseudoTypeUnion().Types
 * 		for _, m := range members {
 * 			if !b.ch.strictNullChecks {
 * 				if m.Kind == pseudochecker.PseudoTypeKindUndefined || m.Kind == pseudochecker.PseudoTypeKindNull {
 * 					hasElidedType = true
 * 					continue
 * 				}
 * 			}
 * 			t := b.pseudoTypeToType(m)
 * 			if t == nil {
 * 				return nil // propagate failure
 * 			}
 * 			res = append(res, t)
 * 		}
 * 		if len(res) == 1 {
 * 			return res[0]
 * 		}
 * 		if len(res) == 0 {
 * 			if hasElidedType {
 * 				return b.ch.anyType
 * 			}
 * 			return b.ch.neverType
 * 		}
 * 		return b.ch.getUnionType(res)
 * 	case pseudochecker.PseudoTypeKindUndefined:
 * 		return b.ch.undefinedWideningType
 * 	case pseudochecker.PseudoTypeKindNull:
 * 		return b.ch.nullWideningType
 * 	case pseudochecker.PseudoTypeKindAny:
 * 		return b.ch.anyType
 * 	case pseudochecker.PseudoTypeKindString:
 * 		return b.ch.stringType
 * 	case pseudochecker.PseudoTypeKindNumber:
 * 		return b.ch.numberType
 * 	case pseudochecker.PseudoTypeKindBigInt:
 * 		return b.ch.bigintType
 * 	case pseudochecker.PseudoTypeKindBoolean:
 * 		return b.ch.booleanType
 * 	case pseudochecker.PseudoTypeKindFalse:
 * 		return b.ch.falseType
 * 	case pseudochecker.PseudoTypeKindTrue:
 * 		return b.ch.trueType
 * 	case pseudochecker.PseudoTypeKindStringLiteral, pseudochecker.PseudoTypeKindNumericLiteral, pseudochecker.PseudoTypeKindBigIntLiteral:
 * 		source := t.AsPseudoTypeLiteral().Node
 * 		return b.ch.getRegularTypeOfExpression(source) // big shortcut, uses cached expression types where possible
 * 	case pseudochecker.PseudoTypeKindObjectLiteral, pseudochecker.PseudoTypeKindSingleCallSignature, pseudochecker.PseudoTypeKindTuple:
 * 		return nil // no simple mapping to a type, since these are structural types
 * 	default:
 * 		debug.Fail("Unhandled pseudochecker.PseudoTypeKind in pseudoTypeToType")
 * 		return nil
 * 	}
 * }
 */
export declare function NodeBuilderImpl_pseudoTypeToType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>): GoPtr<Type>;
//# sourceMappingURL=pseudotypenodebuilder.d.ts.map