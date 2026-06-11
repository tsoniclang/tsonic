import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import { Node_Body, NodeFactory_NewModifier, Node_Symbol, Node_Text } from "../ast/ast.js";
import { AsTypePredicateNode } from "../ast/generated/casts.js";
import { NewFunctionTypeNode, NewGetAccessorDeclaration, NewKeywordExpression, NewKeywordTypeNode, NewLiteralTypeNode, NewMethodSignatureDeclaration, NewParameterDeclaration, NewPropertySignatureDeclaration, NewSetAccessorDeclaration, NewToken, NewTupleTypeNode, NewTypeLiteralNode, NewTypeOperatorNode, NewUnionTypeNode } from "../ast/generated/factory.js";
import { KindAnyKeyword, KindBigIntKeyword, KindBooleanKeyword, KindDotDotDotToken, KindFalseKeyword, KindNeverKeyword, KindNullKeyword, KindNumberKeyword, KindQuestionToken, KindReadonlyKeyword, KindStringKeyword, KindTrueKeyword, KindUndefinedKeyword } from "../ast/generated/kinds.js";
import { IsArrowFunction, IsReturnStatement, IsThisTypeNode, IsTypePredicateNode } from "../ast/generated/predicates.js";
import { SymbolFlagsOptional } from "../ast/symbolflags.js";
import { GetContainingFunction, GetSourceFileOfNode, IsAccessor, IsDeclaration, IsEntityNameExpression, IsFunctionLike } from "../ast/utilities.js";
import type { Node, NodeList } from "../ast/spine.js";
import { Node_Name, NodeFactory_NewModifierList, NodeFactory_NewNodeList } from "../ast/spine.js";
import { Assert, Fail } from "../debug/debug.js";
import { IsInConstContext } from "../pseudochecker/lookup.js";
import type { PseudoParameter, PseudoObjectElement, PseudoType } from "../pseudochecker/type.js";
import {
  PseudoObjectElement_AsPseudoGetAccessor,
  PseudoObjectElement_AsPseudoObjectMethod,
  PseudoObjectElement_AsPseudoPropertyAssignment,
  PseudoObjectElement_AsPseudoSetAccessor,
  PseudoObjectElement_Signature,
  PseudoObjectElementKindGetAccessor,
  PseudoObjectElementKindMethod,
  PseudoObjectElementKindPropertyAssignment,
  PseudoObjectElementKindSetAccessor,
  PseudoType_AsPseudoTypeDirect,
  PseudoType_AsPseudoTypeInferred,
  PseudoType_AsPseudoTypeLiteral,
  PseudoType_AsPseudoTypeMaybeConstLocation,
  PseudoType_AsPseudoTypeNoResult,
  PseudoType_AsPseudoTypeObjectLiteral,
  PseudoType_AsPseudoTypeSingleCallSignature,
  PseudoType_AsPseudoTypeTuple,
  PseudoType_AsPseudoTypeUnion,
  PseudoTypeKindAny,
  PseudoTypeKindBigInt,
  PseudoTypeKindBigIntLiteral,
  PseudoTypeKindBoolean,
  PseudoTypeKindDirect,
  PseudoTypeKindFalse,
  PseudoTypeKindInferred,
  PseudoTypeKindMaybeConstLocation,
  PseudoTypeKindNull,
  PseudoTypeKindNoResult,
  PseudoTypeKindNumber,
  PseudoTypeKindNumericLiteral,
  PseudoTypeKindObjectLiteral,
  PseudoTypeKindSingleCallSignature,
  PseudoTypeKindString,
  PseudoTypeKindStringLiteral,
  PseudoTypeKindTrue,
  PseudoTypeKindTuple,
  PseudoTypeKindUndefined,
  PseudoTypeKindUnion,
} from "../pseudochecker/type.js";
import { EFSingleLine } from "../printer/emitflags.js";
import { EmitContext_AddEmitFlags, EmitContext_SetCommentRange } from "../printer/emitcontext.js";
import { Checker_isConstContext } from "./checker/support-queries.js";
import { Checker_isErrorType } from "./checker/diagnostics.js";
import { isTupleType, TypeFactsNEUndefined } from "./checker/state.js";
import {
  Checker_getSignatureFromDeclaration,
  Checker_getSingleCallSignature,
  Checker_getTypeArguments,
  Checker_getTypeOfParameter,
  Checker_getReturnTypeOfSignature,
} from "./checker/signatures.js";
import {
  Checker_getPropertyOfType,
  Checker_getTypeOfSymbol,
  Checker_getWriteTypeOfSymbol,
} from "./checker/symbols.js";
import {
  Checker_getContextualType,
  Checker_getPropertiesOfType,
  Checker_getRegularTypeOfExpression,
  Checker_getRegularTypeOfLiteralType,
  Checker_getTypeOfExpression,
  Checker_getTypeFromTypeNode,
  Checker_getTypeWithFacts,
  Checker_getUnionType,
  Checker_getWidenedType,
  Checker_instantiateContextualType,
  Checker_isLiteralOfContextualType,
  Checker_removeMissingType,
} from "./checker/types.js";
import { Checker_isOptionalParameter } from "./utilities.js";
import type { NodeBuilderImpl } from "./nodebuilderimpl.js";
import { Checker_getExpandedParameters, NodeBuilderImpl_parameterToParameterDeclarationName, NodeBuilderImpl_serializeReturnTypeForSignature, NodeBuilderImpl_serializeTypeForDeclaration, NodeBuilderImpl_typeToTypeNode } from "./nodebuilderimpl.js";
import { NodeBuilderImpl_enterNewScope } from "./nodebuilderscopes.js";
import { NodeBuilderImpl_reuseName, NodeBuilderImpl_reuseNode, NodeBuilderImpl_reuseTypeNode } from "./nodecopy.js";
import { Checker_compareTypesIdentical, Checker_getTypePredicateOfSignature } from "./relater.js";
import type { Type, TypePredicate } from "./types.js";
import { ContextFlagsNone, ElementFlagsNonRequired, TernaryTrue, Type_TargetTupleType, TypeFlagsUnion, TypePredicateKindAssertsIdentifier, TypePredicateKindAssertsThis, TypePredicateKindThis } from "./types.js";
import { FlagsMultilineObjectLiterals } from "../nodebuilder/types.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeToNodeWithCheckerFallback","kind":"method","status":"implemented","sigHash":"8a9f5649c6a56ec2a9c83e4eed9cf68fb5429cd91fb54fe021f46b65d52b76c0","bodyHash":"6dff4f2e4e1b894de517b2454b45c1d78af7720118a4a283fdceeccb1f59c224"}
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
 * 	}
 * 	return b.pseudoTypeToNode(t)
 * }
 */
export function NodeBuilderImpl_pseudoTypeToNodeWithCheckerFallback(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>, checkerType: GoPtr<Type>): GoPtr<Node> {
  const b = receiver!;
  if (t!.Kind === PseudoTypeKindInferred) {
    if (!b.ctx!.suppressReportInferenceFallback) {
      const errorNodes = PseudoType_AsPseudoTypeInferred(t)!.ErrorNodes;
      if (errorNodes.length > 0) {
        for (const n of errorNodes) {
          b.ctx!.tracker!.ReportInferenceFallback(n);
        }
      } else {
        b.ctx!.tracker!.ReportInferenceFallback(PseudoType_AsPseudoTypeInferred(t)!.Expression);
      }
    }
    const oldSuppress = b.ctx!.suppressReportInferenceFallback;
    b.ctx!.suppressReportInferenceFallback = true;
    const result = NodeBuilderImpl_typeToTypeNode(b, checkerType);
    b.ctx!.suppressReportInferenceFallback = oldSuppress;
    return result;
  }
  return NodeBuilderImpl_pseudoTypeToNode(b, t);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeToNode","kind":"method","status":"implemented","sigHash":"37cf2f717de621c103c51df5aa4f15fc6c5bc7082cda2dd6e6ebec393ef5217d","bodyHash":"a25fab037b086d1eac87177cfd9978a03df709742fe8e57c370f34e3e067bdc2"}
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
 * 		isConst := b.ch.isConstContext(elements[0].Name)
 * 		newElements := make([]*ast.Node, 0, len(elements))
 * 
 * 		for _, e := range elements {
 * 			var modifiers *ast.ModifierList
 * 			if isConst || (e.Kind == pseudochecker.PseudoObjectElementKindPropertyAssignment && e.AsPseudoPropertyAssignment().Readonly) {
 * 				modifiers = b.f.NewModifierList([]*ast.Node{b.f.NewModifier(ast.KindReadonlyKeyword)})
 * 			}
 * 			if e.Kind != pseudochecker.PseudoObjectElementKindPropertyAssignment {
 * 				signature := b.ch.getSignatureFromDeclaration(e.Signature())
 * 				expandedParams := b.ch.getExpandedParameters(signature, true /*skipUnionExpanding* /)[0]
 * 				cleanup := b.enterNewScope(e.Signature(), expandedParams, signature.typeParameters, signature.parameters, signature.mapper)
 * 				defer cleanup()
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
 * 						b.reuseName(e.Name),
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
 * 					b.reuseName(e.Name),
 * 					nil,
 * 					typeParams,
 * 					b.pseudoParametersToNodeList(d.Parameters),
 * 					b.pseudoTypeToNode(d.ReturnType),
 * 				)
 * 			case pseudochecker.PseudoObjectElementKindPropertyAssignment:
 * 				d := e.AsPseudoPropertyAssignment()
 * 				newProp = b.f.NewPropertySignatureDeclaration(
 * 					modifiers,
 * 					b.reuseName(e.Name),
 * 					nil,
 * 					b.pseudoTypeToNode(d.Type),
 * 					nil,
 * 				)
 * 			case pseudochecker.PseudoObjectElementKindSetAccessor:
 * 				d := e.AsPseudoSetAccessor()
 * 				newProp = b.f.NewSetAccessorDeclaration(
 * 					nil,
 * 					b.reuseName(e.Name),
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
 * 					b.reuseName(e.Name),
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
 * 		}
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
export function NodeBuilderImpl_pseudoTypeToNode(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>): GoPtr<Node> {
  const b = receiver!;
  Assert(t !== undefined, "Attempted to serialize nil pseudotype");
  const cleanups: Array<() => void> = [];
  try {
    switch (t!.Kind) {
      case PseudoTypeKindDirect:
        return NodeBuilderImpl_reuseTypeNode(b, PseudoType_AsPseudoTypeDirect(t)!.TypeNode);
      case PseudoTypeKindInferred: {
        const inferred = PseudoType_AsPseudoTypeInferred(t)!;
        const node = inferred.Expression;
        const errorNodes = inferred.ErrorNodes ?? [];
        if (errorNodes.length > 0) {
          for (const n of errorNodes) {
            b.ctx!.tracker!.ReportInferenceFallback(n);
          }
        } else if (IsEntityNameExpression(node) && IsDeclaration(node!.Parent)) {
          b.ctx!.tracker!.ReportInferenceFallback(node!.Parent);
        } else {
          b.ctx!.tracker!.ReportInferenceFallback(node);
        }
        if (IsReturnStatement(node!.Parent)) {
          const enclosing = GetContainingFunction(node);
          if (IsAccessor(enclosing)) {
            return NodeBuilderImpl_serializeTypeForDeclaration(b, enclosing as GoPtr<never>, undefined, undefined, false);
          }
          return NodeBuilderImpl_serializeReturnTypeForSignature(b, Checker_getSignatureFromDeclaration(b.ch, enclosing), false);
        }
        if (IsArrowFunction(node!.Parent) && Node_Body(node!.Parent) === node) {
          return NodeBuilderImpl_serializeReturnTypeForSignature(b, Checker_getSignatureFromDeclaration(b.ch, node!.Parent), false);
        }
        if (IsDeclaration(node!.Parent)) {
          return NodeBuilderImpl_serializeTypeForDeclaration(b, node!.Parent as GoPtr<never>, undefined, undefined, false);
        }
        const ty = Checker_getTypeOfExpression(b.ch, node);
        return NodeBuilderImpl_typeToTypeNode(b, ty);
      }
      case PseudoTypeKindNoResult: {
        const node = PseudoType_AsPseudoTypeNoResult(t)!.Declaration;
        b.ctx!.tracker!.ReportInferenceFallback(node);
        if (IsFunctionLike(node) && !IsAccessor(node)) {
          return NodeBuilderImpl_serializeReturnTypeForSignature(b, Checker_getSignatureFromDeclaration(b.ch, node), false);
        }
        return NodeBuilderImpl_serializeTypeForDeclaration(b, node as GoPtr<never>, undefined, undefined, false);
      }
      case PseudoTypeKindMaybeConstLocation: {
        const d = PseudoType_AsPseudoTypeMaybeConstLocation(t)!;
        let isInConstContext = Checker_isConstContext(b.ch, d.Node);
        if (!isInConstContext && IsInConstContext(d.Node)) {
          const contextualType = Checker_getContextualType(b.ch, d.Node, ContextFlagsNone);
          const typeFromPseudo = NodeBuilderImpl_pseudoTypeToType(b, d.ConstType);
          if (typeFromPseudo !== undefined &&
            Checker_isLiteralOfContextualType(
              b.ch,
              typeFromPseudo,
              Checker_instantiateContextualType(b.ch, contextualType, d.Node, ContextFlagsNone),
            )) {
            isInConstContext = true;
          }
        }
        return isInConstContext
          ? NodeBuilderImpl_pseudoTypeToNode(b, d.ConstType)
          : NodeBuilderImpl_pseudoTypeToNode(b, d.RegularType);
      }
      case PseudoTypeKindUnion: {
        const res: GoPtr<Node>[] = [];
        let hasElidedType = false;
        const members = PseudoType_AsPseudoTypeUnion(t)!.Types;
        for (const member of members) {
          if (!b.ch!.strictNullChecks) {
            if (member!.Kind === PseudoTypeKindUndefined || member!.Kind === PseudoTypeKindNull) {
              hasElidedType = true;
              continue;
            }
          }
          res.push(NodeBuilderImpl_pseudoTypeToNode(b, member));
        }
        if (res.length === 1) {
          return res[0];
        }
        if (res.length === 0) {
          if (hasElidedType) {
            return NewKeywordTypeNode(b.f, KindAnyKeyword);
          }
          return NewKeywordTypeNode(b.f, KindNeverKeyword);
        }
        return NewUnionTypeNode(b.f, NodeFactory_NewNodeList(b.f, res) as GoPtr<never>);
      }
      case PseudoTypeKindUndefined:
        if (!b.ch!.strictNullChecks) {
          return NewKeywordTypeNode(b.f, KindAnyKeyword);
        }
        return NewKeywordTypeNode(b.f, KindUndefinedKeyword);
      case PseudoTypeKindNull:
        if (!b.ch!.strictNullChecks) {
          return NewKeywordTypeNode(b.f, KindAnyKeyword);
        }
        return NewLiteralTypeNode(b.f, NewKeywordExpression(b.f, KindNullKeyword));
      case PseudoTypeKindAny:
        return NewKeywordTypeNode(b.f, KindAnyKeyword);
      case PseudoTypeKindString:
        return NewKeywordTypeNode(b.f, KindStringKeyword);
      case PseudoTypeKindNumber:
        return NewKeywordTypeNode(b.f, KindNumberKeyword);
      case PseudoTypeKindBigInt:
        return NewKeywordTypeNode(b.f, KindBigIntKeyword);
      case PseudoTypeKindBoolean:
        return NewKeywordTypeNode(b.f, KindBooleanKeyword);
      case PseudoTypeKindFalse:
        return NewLiteralTypeNode(b.f, NewKeywordExpression(b.f, KindFalseKeyword));
      case PseudoTypeKindTrue:
        return NewLiteralTypeNode(b.f, NewKeywordExpression(b.f, KindTrueKeyword));
      case PseudoTypeKindSingleCallSignature: {
        const d = PseudoType_AsPseudoTypeSingleCallSignature(t)!;
        const signature = Checker_getSignatureFromDeclaration(b.ch, d.Signature);
        const expandedParams = Checker_getExpandedParameters(b.ch, signature, true)[0];
        cleanups.push(NodeBuilderImpl_enterNewScope(b, d.Signature, expandedParams ?? [], signature!.typeParameters ?? [], signature!.parameters ?? [], signature!.mapper));
        let typeParams: GoPtr<NodeList> = undefined;
        if (d.TypeParameters.length > 0) {
          const res: GoPtr<Node>[] = [];
          for (const tp of d.TypeParameters) {
            res.push(NodeBuilderImpl_reuseNode(b, tp as unknown as GoPtr<Node>));
          }
          typeParams = NodeFactory_NewNodeList(b.f, res);
        }
        const params = NodeBuilderImpl_pseudoParametersToNodeList(b, d.Parameters);
        const returnType = NodeBuilderImpl_pseudoTypeToNode(b, d.ReturnType);
        return NewFunctionTypeNode(b.f, typeParams as GoPtr<never>, params as GoPtr<never>, returnType as GoPtr<never>);
      }
      case PseudoTypeKindTuple: {
        const res: GoPtr<Node>[] = [];
        const elements = PseudoType_AsPseudoTypeTuple(t)!.Elements;
        for (const element of elements) {
          res.push(NodeBuilderImpl_pseudoTypeToNode(b, element));
        }
        const result = NewTupleTypeNode(b.f, NodeFactory_NewNodeList(b.f, res) as GoPtr<never>);
        EmitContext_AddEmitFlags(b.e, result, EFSingleLine);
        return NewTypeOperatorNode(b.f, KindReadonlyKeyword, result as GoPtr<never>);
      }
      case PseudoTypeKindObjectLiteral: {
        const elements = PseudoType_AsPseudoTypeObjectLiteral(t)!.Elements;
        if (elements.length === 0) {
          const result = NewTypeLiteralNode(b.f, NodeFactory_NewNodeList(b.f, []) as GoPtr<never>);
          EmitContext_AddEmitFlags(b.e, result, EFSingleLine);
          return result;
        }
        const isConst = Checker_isConstContext(b.ch, elements[0]!.Name);
        const newElements: GoPtr<Node>[] = [];

        for (const element of elements) {
          const elementNode = element!;
          let modifiers: GoPtr<NodeList> = undefined;
          if (isConst || (elementNode.Kind === PseudoObjectElementKindPropertyAssignment && PseudoObjectElement_AsPseudoPropertyAssignment(elementNode)!.Readonly)) {
            modifiers = NodeFactory_NewModifierList(b.f, [NodeFactory_NewModifier(b.f, KindReadonlyKeyword)]) as GoPtr<NodeList>;
          }
          if (elementNode.Kind !== PseudoObjectElementKindPropertyAssignment) {
            const signatureNode = PseudoObjectElement_Signature(elementNode);
            const signature = Checker_getSignatureFromDeclaration(b.ch, signatureNode);
            const expandedParams = Checker_getExpandedParameters(b.ch, signature, true)[0];
            cleanups.push(NodeBuilderImpl_enterNewScope(b, signatureNode, expandedParams ?? [], signature!.typeParameters ?? [], signature!.parameters ?? [], signature!.mapper));
          }
          let newProp: GoPtr<Node> = undefined;
          switch (elementNode.Kind) {
            case PseudoObjectElementKindMethod: {
              const d = PseudoObjectElement_AsPseudoObjectMethod(elementNode)!;
              let typeParams: GoPtr<NodeList> = undefined;
              if (d.TypeParameters.length > 0) {
                const res: GoPtr<Node>[] = [];
                for (const tp of d.TypeParameters) {
                  res.push(NodeBuilderImpl_reuseNode(b, tp as unknown as GoPtr<Node>));
                }
                typeParams = NodeFactory_NewNodeList(b.f, res);
              }
              if (isConst) {
                newProp = NewPropertySignatureDeclaration(
                  b.f,
                  modifiers as GoPtr<never>,
                  NodeBuilderImpl_reuseName(b, elementNode.Name) as GoPtr<never>,
                  undefined,
                  NewFunctionTypeNode(
                    b.f,
                    typeParams as GoPtr<never>,
                    NodeBuilderImpl_pseudoParametersToNodeList(b, d.Parameters) as GoPtr<never>,
                    NodeBuilderImpl_pseudoTypeToNode(b, d.ReturnType) as GoPtr<never>,
                  ) as GoPtr<never>,
                  undefined,
                );
                break;
              }
              newProp = NewMethodSignatureDeclaration(
                b.f,
                modifiers as GoPtr<never>,
                NodeBuilderImpl_reuseName(b, elementNode.Name) as GoPtr<never>,
                undefined,
                typeParams as GoPtr<never>,
                NodeBuilderImpl_pseudoParametersToNodeList(b, d.Parameters) as GoPtr<never>,
                NodeBuilderImpl_pseudoTypeToNode(b, d.ReturnType) as GoPtr<never>,
              );
              break;
            }
            case PseudoObjectElementKindPropertyAssignment: {
              const d = PseudoObjectElement_AsPseudoPropertyAssignment(elementNode)!;
              newProp = NewPropertySignatureDeclaration(
                b.f,
                modifiers as GoPtr<never>,
                NodeBuilderImpl_reuseName(b, elementNode.Name) as GoPtr<never>,
                undefined,
                NodeBuilderImpl_pseudoTypeToNode(b, d.Type) as GoPtr<never>,
                undefined,
              );
              break;
            }
            case PseudoObjectElementKindSetAccessor: {
              const d = PseudoObjectElement_AsPseudoSetAccessor(elementNode)!;
              newProp = NewSetAccessorDeclaration(
                b.f,
                undefined,
                NodeBuilderImpl_reuseName(b, elementNode.Name) as GoPtr<never>,
                undefined,
                NodeFactory_NewNodeList(b.f, [NodeBuilderImpl_pseudoParameterToNode(b, d.Parameter)]) as GoPtr<never>,
                undefined,
                undefined,
                undefined,
              );
              break;
            }
            case PseudoObjectElementKindGetAccessor: {
              const d = PseudoObjectElement_AsPseudoGetAccessor(elementNode)!;
              newProp = NewGetAccessorDeclaration(
                b.f,
                undefined,
                NodeBuilderImpl_reuseName(b, elementNode.Name) as GoPtr<never>,
                undefined,
                undefined,
                NodeBuilderImpl_pseudoTypeToNode(b, d.Type) as GoPtr<never>,
                undefined,
                undefined,
              );
              break;
            }
          }
          if (b.ctx!.enclosingFile === GetSourceFileOfNode(elementNode.Name)) {
            EmitContext_SetCommentRange(b.e, newProp, elementNode.Name!.Parent!.Loc);
          }
          newElements.push(newProp);
        }
        const result = NewTypeLiteralNode(b.f, NodeFactory_NewNodeList(b.f, newElements) as GoPtr<never>);
        if ((b.ctx!.flags & FlagsMultilineObjectLiterals) === 0) {
          EmitContext_AddEmitFlags(b.e, result, EFSingleLine);
        }
        return result;
      }
      case PseudoTypeKindStringLiteral:
      case PseudoTypeKindNumericLiteral:
      case PseudoTypeKindBigIntLiteral: {
        const source = PseudoType_AsPseudoTypeLiteral(t)!.Node;
        return NewLiteralTypeNode(b.f, NodeBuilderImpl_reuseNode(b, source));
      }
      default:
        Fail("Unhandled pseudotype kind in pseudotype node construction");
        return undefined;
    }
  } finally {
    for (let index = cleanups.length - 1; index >= 0; index--) {
      cleanups[index]!();
    }
  }
}

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
export function NodeBuilderImpl_pseudoParametersToNodeList(receiver: GoPtr<NodeBuilderImpl>, params: GoSlice<GoPtr<PseudoParameter>>): GoPtr<NodeList> {
  const b = receiver!;
  const res: GoSlice<GoPtr<Node>> = [];
  for (const p of params) {
    res.push(NodeBuilderImpl_pseudoParameterToNode(b, p));
  }
  return NodeFactory_NewNodeList(b.f, res);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoParameterToNode","kind":"method","status":"implemented","sigHash":"0a9a217c93e6aaa3ee3c061f128d5c336c3f8c6b40606d23b0d0559245ba6f58","bodyHash":"741475cf40809ce23db99fa9caf2289ae1e43b89cd0a28d7bf8075806ba8b933"}
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
 * 	return b.f.NewParameterDeclaration(
 * 		nil,
 * 		dotDotDot,
 * 		// matches strada behavior of always reserializing param names from scratch
 * 		b.parameterToParameterDeclarationName(p.Name.Parent.Symbol(), p.Name.Parent),
 * 		questionMark,
 * 		b.pseudoTypeToNode(p.Type),
 * 		nil,
 * 	)
 * }
 */
export function NodeBuilderImpl_pseudoParameterToNode(receiver: GoPtr<NodeBuilderImpl>, p: GoPtr<PseudoParameter>): GoPtr<Node> {
  const b = receiver!;
  let dotDotDot: GoPtr<Node> = undefined;
  let questionMark: GoPtr<Node> = undefined;
  if (p!.Rest) {
    dotDotDot = NewToken(b.f, KindDotDotDotToken);
  }
  if (p!.Optional) {
    questionMark = NewToken(b.f, KindQuestionToken);
  }
  return NewParameterDeclaration(
    b.f,
    undefined,
    dotDotDot,
    // matches strada behavior of always reserializing param names from scratch
    NodeBuilderImpl_parameterToParameterDeclarationName(b, Node_Symbol(p!.Name!.Parent), p!.Name!.Parent),
    questionMark,
    NodeBuilderImpl_pseudoTypeToNode(b, p!.Type),
    undefined,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/pseudotypenodebuilder.go::method::NodeBuilderImpl.pseudoTypeEquivalentToType","kind":"method","status":"implemented","sigHash":"2d24409a328982569558d779ab6b959fb123c96438ac4c5338c8b16e3ff89d73","bodyHash":"ceb060c025ee016c2987f24ec4626622fcc659e5257749d04fe29074514fa9fe"}
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
 * 				if len(targetSig.parameters) != len(d.Parameters) {
 * 					if reportErrors {
 * 						b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 					}
 * 					return false
 * 				}
 * 				for i, p := range d.Parameters {
 * 					targetParam := targetSig.parameters[i]
 * 					paramType := b.ch.getTypeOfParameter(targetParam)
 * 					if !b.pseudoTypeEquivalentToType(p.Type, paramType, p.Optional, false) {
 * 						if reportErrors {
 * 							b.ctx.tracker.ReportInferenceFallback(e.Name.Parent)
 * 						}
 * 						return false
 * 					}
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
 * 		if len(targetSig.parameters) != len(pt.Parameters) {
 * 			if reportErrors {
 * 				b.ctx.tracker.ReportInferenceFallback(pt.Signature)
 * 			}
 * 			return false // TODO: spread tuple params may mess with this check
 * 		}
 * 		for i, p := range pt.Parameters {
 * 			targetParam := targetSig.parameters[i]
 * 			if p.Optional != b.ch.isOptionalParameter(targetParam.ValueDeclaration) {
 * 				if reportErrors {
 * 					b.ctx.tracker.ReportInferenceFallback(p.Name.Parent)
 * 				}
 * 				return false
 * 			}
 * 			paramType := b.ch.getTypeOfParameter(targetParam)
 * 			if !b.pseudoTypeEquivalentToType(p.Type, paramType, p.Optional, false) {
 * 				if reportErrors {
 * 					b.ctx.tracker.ReportInferenceFallback(p.Name.Parent)
 * 				}
 * 				return false
 * 			}
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
export function NodeBuilderImpl_pseudoTypeEquivalentToType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>, type_: GoPtr<Type>, isOptionalAnnotated: bool, reportErrors: bool): bool {
  const b = receiver!;
  if (type_ !== undefined && Checker_isErrorType(b.ch, type_)) {
    return true;
  }
  const typeFromPseudo = NodeBuilderImpl_pseudoTypeToType(b, t);
  if (typeFromPseudo === type_) {
    return true;
  }
  if (typeFromPseudo !== undefined && type_ !== undefined) {
    if (isOptionalAnnotated) {
      const undefinedStripped = Checker_getTypeWithFacts(b.ch, type_, TypeFactsNEUndefined);
      if (undefinedStripped === typeFromPseudo) {
        return true;
      }
      if ((typeFromPseudo.flags & TypeFlagsUnion) !== 0 && (undefinedStripped!.flags & TypeFlagsUnion) !== 0) {
        if (Checker_compareTypesIdentical(b.ch, typeFromPseudo, undefinedStripped) === TernaryTrue) {
          return true;
        }
      }
    }
    if (Checker_getRegularTypeOfLiteralType(b.ch, typeFromPseudo) === Checker_getRegularTypeOfLiteralType(b.ch, type_)) {
      return true;
    }
    if ((typeFromPseudo.flags & TypeFlagsUnion) !== 0 && (type_.flags & TypeFlagsUnion) !== 0) {
      if (Checker_compareTypesIdentical(b.ch, typeFromPseudo, type_) === TernaryTrue) {
        return true;
      }
    }
  }

  switch (t!.Kind) {
    case PseudoTypeKindInferred: {
      const inferred = PseudoType_AsPseudoTypeInferred(t)!;
      const errorNodes = inferred.ErrorNodes ?? [];
      if (errorNodes.length > 0) {
        if (reportErrors) {
          for (const n of errorNodes) {
            b.ctx!.tracker!.ReportInferenceFallback(n);
          }
        }
        return false;
      }
      if (reportErrors) {
        b.ctx!.tracker!.ReportInferenceFallback(inferred.Expression);
      }
      return false;
    }
    case PseudoTypeKindObjectLiteral: {
      const pt = PseudoType_AsPseudoTypeObjectLiteral(t)!;
      if (type_ === undefined) {
        return false;
      }
      const targetProps = Checker_getPropertiesOfType(b.ch, type_) ?? [];
      let targetDeclCount = 0;
      for (const prop of targetProps) {
        targetDeclCount += (prop!.Declarations ?? []).length;
      }
      if (pt.Elements.length !== targetDeclCount) {
        return false;
      }
      for (const element of pt.Elements) {
        const elementNode = element!;
        let targetProp = undefined;
        const elemSymbol = Node_Symbol(elementNode.Name!.Parent);
        if (elemSymbol !== undefined) {
          targetProp = Checker_getPropertyOfType(b.ch, type_, elemSymbol.Name);
        }
        if (targetProp === undefined) {
          for (const prop of targetProps) {
            if (prop!.ValueDeclaration !== undefined && Node_Name(prop!.ValueDeclaration) === elementNode.Name) {
              targetProp = prop;
              break;
            }
          }
          if (targetProp === undefined) {
            if (reportErrors) {
              b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
            }
            return false;
          }
        }
        const targetIsOptional = (targetProp!.Flags & SymbolFlagsOptional) !== 0;
        if (elementNode.Optional !== targetIsOptional) {
          if (reportErrors) {
            b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
          }
          return false;
        }
        let propType = Checker_getTypeOfSymbol(b.ch, targetProp);
        propType = Checker_removeMissingType(b.ch, propType, targetIsOptional);
        switch (elementNode.Kind) {
          case PseudoObjectElementKindPropertyAssignment: {
            const d = PseudoObjectElement_AsPseudoPropertyAssignment(elementNode)!;
            if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, d.Type, propType, elementNode.Optional, false)) {
              if (reportErrors) {
                if (d.Type!.Kind === PseudoTypeKindInferred && (PseudoType_AsPseudoTypeInferred(d.Type)!.ErrorNodes ?? []).length > 0) {
                  for (const n of PseudoType_AsPseudoTypeInferred(d.Type)!.ErrorNodes) {
                    b.ctx!.tracker!.ReportInferenceFallback(n);
                  }
                } else if (!isStructuralPseudoType(d.Type)) {
                  b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
                }
              }
              return false;
            }
            break;
          }
          case PseudoObjectElementKindMethod: {
            const d = PseudoObjectElement_AsPseudoObjectMethod(elementNode)!;
            const targetSig = Checker_getSingleCallSignature(b.ch, propType);
            if (targetSig === undefined) {
              continue;
            }
            const targetParams = targetSig.parameters ?? [];
            if (targetParams.length !== d.Parameters.length) {
              if (reportErrors) {
                b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
              }
              return false;
            }
            for (let index = 0; index < d.Parameters.length; index++) {
              const parameter = d.Parameters[index]!;
              const targetParam = targetParams[index]!;
              const paramType = Checker_getTypeOfParameter(b.ch, targetParam);
              if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, parameter.Type, paramType, parameter.Optional, false)) {
                if (reportErrors) {
                  b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
                }
                return false;
              }
            }
            const targetPredicate = Checker_getTypePredicateOfSignature(b.ch, targetSig);
            if (targetPredicate !== undefined) {
              if (!NodeBuilderImpl_pseudoReturnTypeMatchesPredicate(b, d.ReturnType, targetPredicate)) {
                if (reportErrors) {
                  b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
                }
                return false;
              }
            } else if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, d.ReturnType, Checker_getReturnTypeOfSignature(b.ch, targetSig), false, false)) {
              if (reportErrors) {
                b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
              }
              return false;
            }
            break;
          }
          case PseudoObjectElementKindGetAccessor: {
            const d = PseudoObjectElement_AsPseudoGetAccessor(elementNode)!;
            if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, d.Type, propType, false, false)) {
              if (reportErrors) {
                b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
              }
              return false;
            }
            break;
          }
          case PseudoObjectElementKindSetAccessor: {
            const d = PseudoObjectElement_AsPseudoSetAccessor(elementNode)!;
            const writeType = Checker_getWriteTypeOfSymbol(b.ch, targetProp);
            if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, d.Parameter!.Type, writeType, false, false)) {
              if (reportErrors) {
                b.ctx!.tracker!.ReportInferenceFallback(elementNode.Name!.Parent);
              }
              return false;
            }
            break;
          }
        }
      }
      return true;
    }
    case PseudoTypeKindTuple: {
      const pt = PseudoType_AsPseudoTypeTuple(t)!;
      if (type_ === undefined || !isTupleType(type_)) {
        return false;
      }
      const tupleTarget = Type_TargetTupleType(type_);
      if ((tupleTarget!.combinedFlags & ElementFlagsNonRequired) !== 0) {
        return false;
      }
      const elementTypes = Checker_getTypeArguments(b.ch, type_);
      if (pt.Elements.length !== elementTypes.length) {
        return false;
      }
      for (let index = 0; index < pt.Elements.length; index++) {
        if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, pt.Elements[index], elementTypes[index], false, reportErrors)) {
          return false;
        }
      }
      return true;
    }
    case PseudoTypeKindSingleCallSignature: {
      const targetSig = Checker_getSingleCallSignature(b.ch, type_);
      if (targetSig === undefined) {
        return false;
      }
      const pt = PseudoType_AsPseudoTypeSingleCallSignature(t)!;
      const targetTypeParameters = targetSig.typeParameters ?? [];
      const targetParameters = targetSig.parameters ?? [];
      if (targetTypeParameters.length !== pt.TypeParameters.length) {
        if (reportErrors) {
          b.ctx!.tracker!.ReportInferenceFallback(pt.Signature);
        }
        return false;
      }
      if (targetParameters.length !== pt.Parameters.length) {
        if (reportErrors) {
          b.ctx!.tracker!.ReportInferenceFallback(pt.Signature);
        }
        return false;
      }
      for (let index = 0; index < pt.Parameters.length; index++) {
        const parameter = pt.Parameters[index]!;
        const targetParam = targetParameters[index]!;
        if (parameter.Optional !== Checker_isOptionalParameter(b.ch, targetParam.ValueDeclaration)) {
          if (reportErrors) {
            b.ctx!.tracker!.ReportInferenceFallback(parameter.Name!.Parent);
          }
          return false;
        }
        const paramType = Checker_getTypeOfParameter(b.ch, targetParam);
        if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, parameter.Type, paramType, parameter.Optional, false)) {
          if (reportErrors) {
            b.ctx!.tracker!.ReportInferenceFallback(parameter.Name!.Parent);
          }
          return false;
        }
      }
      const targetPredicate = Checker_getTypePredicateOfSignature(b.ch, targetSig);
      if (targetPredicate !== undefined) {
        if (!NodeBuilderImpl_pseudoReturnTypeMatchesPredicate(b, pt.ReturnType, targetPredicate)) {
          if (reportErrors) {
            b.ctx!.tracker!.ReportInferenceFallback(pt.Signature);
          }
          return false;
        }
      } else if (!NodeBuilderImpl_pseudoTypeEquivalentToType(b, pt.ReturnType, Checker_getReturnTypeOfSignature(b.ch, targetSig), false, reportErrors)) {
        return false;
      }
      return true;
    }
    case PseudoTypeKindNoResult:
      if (reportErrors) {
        b.ctx!.tracker!.ReportInferenceFallback(PseudoType_AsPseudoTypeNoResult(t)!.Declaration);
      }
      return false;
    default:
      return false;
  }
}

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
export function isStructuralPseudoType(t: GoPtr<PseudoType>): bool {
  switch (t!.Kind) {
    case PseudoTypeKindObjectLiteral:
    case PseudoTypeKindTuple:
    case PseudoTypeKindSingleCallSignature:
      return true;
    case PseudoTypeKindMaybeConstLocation: {
      const d = PseudoType_AsPseudoTypeMaybeConstLocation(t)!;
      return isStructuralPseudoType(d.ConstType) || isStructuralPseudoType(d.RegularType);
    }
  }
  return false;
}

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
export function NodeBuilderImpl_pseudoReturnTypeMatchesPredicate(receiver: GoPtr<NodeBuilderImpl>, rt: GoPtr<PseudoType>, predicate: GoPtr<TypePredicate>): bool {
  const b = receiver!;
  if (rt!.Kind !== PseudoTypeKindDirect) {
    return false;
  }
  const node = PseudoType_AsPseudoTypeDirect(rt)!.TypeNode;
  if (!IsTypePredicateNode(node)) {
    return false;
  }
  const tp = AsTypePredicateNode(node)!;
  // Check asserts modifier matches
  const isAsserts = tp.AssertsModifier !== undefined;
  const predicateIsAsserts = predicate!.kind === TypePredicateKindAssertsThis || predicate!.kind === TypePredicateKindAssertsIdentifier;
  if (isAsserts !== predicateIsAsserts) {
    return false;
  }
  // Check this vs identifier matches
  const isThis = IsThisTypeNode(tp.ParameterName);
  const predicateIsThis = predicate!.kind === TypePredicateKindThis || predicate!.kind === TypePredicateKindAssertsThis;
  if (isThis !== predicateIsThis) {
    return false;
  }
  // For identifier predicates, check parameter name matches
  if (!isThis) {
    if (Node_Text(tp.ParameterName) !== predicate!.parameterName) {
      return false;
    }
  }
  // Check the narrowed type, if any
  if (predicate!.t !== undefined) {
    if (tp.Type === undefined) {
      return false;
    }
    const predicateTypeFromNode = Checker_getTypeFromTypeNode(b.ch, tp.Type);
    if (predicateTypeFromNode !== predicate!.t) {
      if (Checker_compareTypesIdentical(b.ch, predicateTypeFromNode, predicate!.t) !== TernaryTrue) {
        return false;
      }
    }
  } else if (tp.Type !== undefined) {
    return false;
  }
  return true;
}

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
export function NodeBuilderImpl_pseudoTypeToType(receiver: GoPtr<NodeBuilderImpl>, t: GoPtr<PseudoType>): GoPtr<Type> {
  const b = receiver!;
  // !!! TODO: only literal types currently mapped because this is only used to determine if literal contextual typing need apply to the pseudotype
  // If this is used more broadly, the implementation needs to be filled out more to handle the structural pseudotypes - signatures, objects, tuples, etc
  Assert(t !== undefined, "Attempted to realize nil pseudotype");
  switch (t!.Kind) {
    case PseudoTypeKindDirect:
      return Checker_getTypeFromTypeNode(b.ch, PseudoType_AsPseudoTypeDirect(t)!.TypeNode);
    case PseudoTypeKindInferred: {
      const node = PseudoType_AsPseudoTypeInferred(t)!.Expression;
      const ty = Checker_getWidenedType(b.ch, Checker_getRegularTypeOfExpression(b.ch, node));
      return ty;
    }
    case PseudoTypeKindNoResult:
      return undefined; // TODO: extract type selection logic from `serializeTypeForDeclaration`, not needed for current usecases but needed if completeness becomes required
    case PseudoTypeKindMaybeConstLocation: {
      const d = PseudoType_AsPseudoTypeMaybeConstLocation(t)!;
      if (Checker_isConstContext(b.ch, d.Node)) {
        return NodeBuilderImpl_pseudoTypeToType(b, d.ConstType);
      }
      return NodeBuilderImpl_pseudoTypeToType(b, d.RegularType);
    }
    case PseudoTypeKindUnion: {
      const res: GoSlice<GoPtr<Type>> = [];
      let hasElidedType = false;
      const members = PseudoType_AsPseudoTypeUnion(t)!.Types;
      for (const m of members) {
        if (!b.ch!.strictNullChecks) {
          if (m!.Kind === PseudoTypeKindUndefined || m!.Kind === PseudoTypeKindNull) {
            hasElidedType = true;
            continue;
          }
        }
        const mt = NodeBuilderImpl_pseudoTypeToType(b, m);
        if (mt === undefined) {
          return undefined; // propagate failure
        }
        res.push(mt);
      }
      if (res.length === 1) {
        return res[0];
      }
      if (res.length === 0) {
        if (hasElidedType) {
          return b.ch!.anyType;
        }
        return b.ch!.neverType;
      }
      return Checker_getUnionType(b.ch, res);
    }
    case PseudoTypeKindUndefined:
      return b.ch!.undefinedWideningType;
    case PseudoTypeKindNull:
      return b.ch!.nullWideningType;
    case PseudoTypeKindAny:
      return b.ch!.anyType;
    case PseudoTypeKindString:
      return b.ch!.stringType;
    case PseudoTypeKindNumber:
      return b.ch!.numberType;
    case PseudoTypeKindBigInt:
      return b.ch!.bigintType;
    case PseudoTypeKindBoolean:
      return b.ch!.booleanType;
    case PseudoTypeKindFalse:
      return b.ch!.falseType;
    case PseudoTypeKindTrue:
      return b.ch!.trueType;
    case PseudoTypeKindStringLiteral:
    case PseudoTypeKindNumericLiteral:
    case PseudoTypeKindBigIntLiteral: {
      const source = PseudoType_AsPseudoTypeLiteral(t)!.Node;
      return Checker_getRegularTypeOfExpression(b.ch, source); // big shortcut, uses cached expression types where possible
    }
    case PseudoTypeKindObjectLiteral:
    case PseudoTypeKindSingleCallSignature:
    case PseudoTypeKindTuple:
      return undefined; // no simple mapping to a type, since these are structural types
    default:
      Fail("Unhandled pseudochecker.PseudoTypeKind in pseudoTypeToType");
      return undefined;
  }
}
