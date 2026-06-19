import type { GoPtr } from "../../../go/compat.js";
import type { bool, int } from "../../../go/scalars.js";
import type { Node } from "../../ast/spine.js";
import { NodeDefault_AsNode, Node_End, Node_Modifiers, Node_Name, Node_Pos, NodeList_End } from "../../ast/spine.js";
import type { ArrayTypeNode, ConditionalTypeNode, ConstructorTypeNode, ExpressionWithTypeArguments, FunctionTypeNode, HeritageClause, ImportAttributes, ImportTypeNode, IndexedAccessTypeNode, InferTypeNode, IntersectionTypeNode, JSDocNonNullableType, JSDocNullableType, JSDocOptionalType, JSDocVariadicType, KeywordTypeNode, LiteralTypeNode, MappedTypeNode, NamedTupleMember, NotEmittedTypeElement, OptionalTypeNode, ParenthesizedTypeNode, PropertyAccessExpression, RestTypeNode, TemplateLiteralTypeNode, TemplateLiteralTypeSpan, ThisTypeNode, TupleTypeNode, TypeAliasDeclaration, TypeAssertion, TypeLiteralNode, TypeOfExpression, TypeOperatorNode, TypeParameterDeclaration, TypePredicateNode, TypeQueryNode, TypeReferenceNode, UnionTypeNode } from "../../ast/generated/data.js";
import type { ExpressionWithTypeArgumentsNode, HeritageClauseNode, TypeArgumentList, TypeElement, TypeNode, TypeParameterDeclarationNode, TypeParameterList, TypePredicateParameterName } from "../../ast/generated/unions.js";
import { KindAnyKeyword, KindArrayType, KindAssertKeyword, KindBigIntKeyword, KindBooleanKeyword, KindCallSignature, KindCloseBracketToken, KindColonToken, KindConditionalType, KindConstructorType, KindConstructSignature, KindExpressionWithTypeArguments, KindFunctionType, KindGetAccessor, KindIdentifier, KindIndexedAccessType, KindIndexSignature, KindInferType, KindIntersectionType, KindIntrinsicKeyword, KindImportType, KindJSDocAllType, KindJSDocNonNullableType, KindJSDocNullableType, KindJSDocOptionalType, KindJSDocVariadicType, KindLiteralType, KindMappedType, KindMethodSignature, KindNamedTupleMember, KindNeverKeyword, KindNotEmittedTypeElement, KindNumberKeyword, KindObjectKeyword, KindOpenBracketToken, KindOptionalType, KindParenthesizedType, KindPropertyAccessExpression, KindPropertySignature, KindQuestionToken, KindReadonlyKeyword, KindRestType, KindSetAccessor, KindStringKeyword, KindSymbolKeyword, KindTemplateLiteralType, KindTemplateLiteralTypeSpan, KindThisType, KindTupleType, KindTypeOfKeyword, KindTypeOperator, KindTypePredicate, KindTypeQuery, KindTypeReference, KindTypeLiteral, KindUndefinedKeyword, KindUnionType, KindUnknownKeyword, KindVoidKeyword } from "../../ast/generated/kinds.js";
import { AsArrayTypeNode, AsCallSignatureDeclaration, AsConditionalTypeNode, AsConstructorTypeNode, AsConstructSignatureDeclaration, AsExpressionWithTypeArguments, AsFunctionTypeNode, AsGetAccessorDeclaration, AsHeritageClause, AsIdentifier, AsImportAttributes, AsImportTypeNode, AsIndexedAccessTypeNode, AsIndexSignatureDeclaration, AsInferTypeNode, AsIntersectionTypeNode, AsJSDocNonNullableType, AsJSDocNullableType, AsJSDocOptionalType, AsJSDocVariadicType, AsKeywordTypeNode, AsLiteralTypeNode, AsMappedTypeNode, AsMethodSignatureDeclaration, AsNamedTupleMember, AsNotEmittedTypeElement, AsOptionalTypeNode, AsParenthesizedTypeNode, AsPropertyAccessExpression, AsPropertySignatureDeclaration, AsRestTypeNode, AsSetAccessorDeclaration, AsTemplateHead, AsTemplateLiteralTypeNode, AsTemplateLiteralTypeSpan, AsThisTypeNode, AsTypeAliasDeclaration, AsTypeAssertion, AsTypeLiteralNode, AsTypeOfExpression, AsTypeOperatorNode, AsTypeParameterDeclaration, AsTypePredicateNode, AsTypeQueryNode, AsTypeReferenceNode, AsTupleTypeNode, AsUnionTypeNode } from "../../ast/generated/casts.js";
import { IsArrowFunction, IsTypeParameterDeclaration } from "../../ast/generated/predicates.js";
import { IsParseTreeNode } from "../../ast/utilities.js";
import { IfElse } from "../../core/core.js";
import { greatestEnd } from "../utilities.js";
import { GetTypeNodePrecedence, OperatorPrecedenceComma, OperatorPrecedenceMember, OperatorPrecedenceUnary, OperatorPrecedenceUpdate, TypePrecedenceConditional, TypePrecedenceFunction, TypePrecedenceHighest, TypePrecedenceJSDoc, TypePrecedenceLowest, TypePrecedenceNonArray, TypePrecedencePostfix, TypePrecedenceTypeOperator, TypePrecedenceUnion } from "../../ast/precedence.js";
import type { TypePrecedence } from "../../ast/precedence.js";
import { Printer_emitBindingIdentifier, Printer_emitConstructSignature, Printer_emitEntityName, Printer_emitGetAccessorDeclaration, Printer_emitIdentifierName, Printer_emitIdentifierReference, Printer_emitIndexSignature, Printer_emitKeywordNode, Printer_emitList, Printer_emitMethodSignature, Printer_emitModifierList, Printer_emitParameters, Printer_emitPropertySignature, Printer_emitPunctuationNode, Printer_emitSetAccessorDeclaration, Printer_emitToken, Printer_emitTokenNode, Printer_enterNode, Printer_exitNode, Printer_decreaseIndent, Printer_increaseIndent, Printer_popNameGenerationScope, Printer_pushNameGenerationScope, Printer_shouldEmitIndented, Printer_writeKeyword, Printer_writeOperator, Printer_writePunctuation, Printer_writeSpace, Printer_writeTrailingSemicolon } from "./emit-core.js";
import { Printer_emitCallSignature, Printer_emitExpression, Printer_emitPropertyAccessExpression, Printer_emitTemplateHead, Printer_generateAllMemberNames } from "./expressions.js";
import { Printer_emitTemplateTypeSpan, Printer_emitTemplateTypeSpanNode, Printer_shouldEmitOnSingleLine, Printer_writeLine } from "./source-maps.js";
import { Printer_decreaseIndentIf, Printer_emitImportAttributeNode, Printer_increaseIndentIf } from "./statements-declarations.js";
import type { Printer } from "./state.js";
import { LFAllowTrailingComma, LFHeritageClauseTypes, LFImportAttributes, LFIntersectionTypeConstituents, LFMultiLineTupleTypeElements, LFMultiLineTypeLiteralMembers, LFNone, LFNoSpaceIfEmpty, LFPreserveLines, LFSingleLineTupleTypeElements, LFSingleLineTypeLiteralMembers, LFTemplateExpressionSpans, LFTypeArguments, LFTypeParameters, LFUnionTypeConstituents, WriteKindKeyword, WriteKindPunctuation } from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeParameter","kind":"method","status":"implemented","sigHash":"64480d54798ef14e55fb0a784e4c68093a25db97e637775258fb43624d08b3a3","bodyHash":"95a5eb29d2d7e5b2d00bd92008e4c88e499621f858ebefa37d3099fe44adc4fe"}
 *
 * Go source:
 * func (p *Printer) emitTypeParameter(node *ast.TypeParameterDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	if node.Constraint != nil {
 * 		p.writeSpace()
 * 		p.writeKeyword("extends")
 * 		p.writeSpace()
 * 		p.emitTypeNodeOutsideExtends(node.Constraint)
 * 	}
 * 	if node.DefaultType != nil {
 * 		p.writeSpace()
 * 		p.writeOperator("=")
 * 		p.writeSpace()
 * 		p.emitTypeNodeOutsideExtends(node.DefaultType)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeParameter(receiver: GoPtr<Printer>, node: GoPtr<TypeParameterDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  if (node!.Constraint !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writeKeyword(receiver, "extends");
    Printer_writeSpace(receiver);
    Printer_emitTypeNodeOutsideExtends(receiver, node!.Constraint);
  }
  if (node!.DefaultType !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writeOperator(receiver, "=");
    Printer_writeSpace(receiver);
    Printer_emitTypeNodeOutsideExtends(receiver, node!.DefaultType);
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeParameterDeclarationNode","kind":"method","status":"implemented","sigHash":"939c6c8f48cd6d4d997cbd5f4c588d1f3c859b53efa7e8f7ef1a739c007810dd","bodyHash":"5e94b76a65c80d2891c671305d384641de98830fc0bebda55f135d6dde4c2149"}
 *
 * Go source:
 * func (p *Printer) emitTypeParameterDeclarationNode(node *ast.TypeParameterDeclarationNode) {
 * 	// NOTE: QuickInfo uses TypeFormatFlagsWriteTypeArgumentsOfSignature to instruct the NodeBuilder to store type arguments
 * 	// (i.e. type nodes) instead of type parameter declarations in the type parameter list.
 * 	if ast.IsTypeParameterDeclaration(node) {
 * 		p.emitTypeParameter(node.AsTypeParameterDeclaration())
 * 	} else {
 * 		p.emitTypeArgument(node)
 * 	}
 * }
 */
export function Printer_emitTypeParameterDeclarationNode(receiver: GoPtr<Printer>, node: GoPtr<TypeParameterDeclarationNode>): void {
  // NOTE: QuickInfo uses TypeFormatFlagsWriteTypeArgumentsOfSignature to instruct the NodeBuilder to store type arguments
  // (i.e. type nodes) instead of type parameter declarations in the type parameter list.
  if (IsTypeParameterDeclaration(node)) {
    Printer_emitTypeParameter(receiver, AsTypeParameterDeclaration(node));
  } else {
    Printer_emitTypeArgument(receiver, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeParameters","kind":"method","status":"implemented","sigHash":"cd43320b50fa33b4ff14ab11b7fd2230c2f08ec87e735626a60ac0cebcd986c2","bodyHash":"aa91b08f4cac30eba5f4ce9d01022b4245848e2ac44c094ddf594c8b39ec01f9"}
 *
 * Go source:
 * func (p *Printer) emitTypeParameters(parentNode *ast.Node, nodes *ast.TypeParameterList) {
 * 	if nodes == nil {
 * 		return
 * 	}
 * 	p.emitList((*Printer).emitTypeParameterDeclarationNode, parentNode, nodes, LFTypeParameters|core.IfElse(ast.IsArrowFunction(parentNode) /*p.shouldAllowTrailingComma(parentNode, nodes)* /, LFAllowTrailingComma, LFNone)) // TODO: preserve trailing comma after Strada migration
 * }
 */
export function Printer_emitTypeParameters(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, nodes: GoPtr<TypeParameterList>): void {
  if (nodes === undefined) {
    return;
  }
  Printer_emitList(receiver, Printer_emitTypeParameterDeclarationNode, parentNode, nodes, LFTypeParameters | IfElse(IsArrowFunction(parentNode) /*p.shouldAllowTrailingComma(parentNode, nodes)*/, LFAllowTrailingComma, LFNone)); // TODO: preserve trailing comma after Strada migration
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeAnnotation","kind":"method","status":"implemented","sigHash":"961d45a3a05e1ee96e42219ec0bf8746c0c2300565cde79bf92a45c36a165e0d","bodyHash":"6f1f658ff5f23a1b161d3e4e31614d25c06786773174cb724310d7a56c755c64"}
 *
 * Go source:
 * func (p *Printer) emitTypeAnnotation(node *ast.TypeNode) {
 * 	if node == nil {
 * 		return
 * 	}
 * 
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node)
 * }
 */
export function Printer_emitTypeAnnotation(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  if (node === undefined) {
    return;
  }

  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeElement","kind":"method","status":"implemented","sigHash":"07faf8beddf8eaf2256c0ce51c64d0260d65af27b5eb05fd168431b9f2420b85","bodyHash":"18a239b7cdc54b932703d347508489cb4c670c1521de834661814412d5c9fb1c"}
 *
 * Go source:
 * func (p *Printer) emitTypeElement(node *ast.TypeElement) {
 * 	switch node.Kind {
 * 	case ast.KindPropertySignature:
 * 		p.emitPropertySignature(node.AsPropertySignatureDeclaration())
 * 	case ast.KindMethodSignature:
 * 		p.emitMethodSignature(node.AsMethodSignatureDeclaration())
 * 	case ast.KindCallSignature:
 * 		p.emitCallSignature(node.AsCallSignatureDeclaration())
 * 	case ast.KindConstructSignature:
 * 		p.emitConstructSignature(node.AsConstructSignatureDeclaration())
 * 	case ast.KindGetAccessor:
 * 		p.emitGetAccessorDeclaration(node.AsGetAccessorDeclaration())
 * 	case ast.KindSetAccessor:
 * 		p.emitSetAccessorDeclaration(node.AsSetAccessorDeclaration())
 * 	case ast.KindIndexSignature:
 * 		p.emitIndexSignature(node.AsIndexSignatureDeclaration())
 * 	case ast.KindNotEmittedTypeElement:
 * 		p.emitNotEmittedTypeElement(node.AsNotEmittedTypeElement())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected TypeElement: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitTypeElement(receiver: GoPtr<Printer>, node: GoPtr<TypeElement>): void {
  switch (node!.Kind) {
    case KindPropertySignature:
      Printer_emitPropertySignature(receiver, AsPropertySignatureDeclaration(node));
      break;
    case KindMethodSignature:
      Printer_emitMethodSignature(receiver, AsMethodSignatureDeclaration(node));
      break;
    case KindCallSignature:
      Printer_emitCallSignature(receiver, AsCallSignatureDeclaration(node));
      break;
    case KindConstructSignature:
      Printer_emitConstructSignature(receiver, AsConstructSignatureDeclaration(node));
      break;
    case KindGetAccessor:
      Printer_emitGetAccessorDeclaration(receiver, AsGetAccessorDeclaration(node));
      break;
    case KindSetAccessor:
      Printer_emitSetAccessorDeclaration(receiver, AsSetAccessorDeclaration(node));
      break;
    case KindIndexSignature:
      Printer_emitIndexSignature(receiver, AsIndexSignatureDeclaration(node));
      break;
    case KindNotEmittedTypeElement:
      Printer_emitNotEmittedTypeElement(receiver, AsNotEmittedTypeElement(node));
      break;
    default:
      throw new globalThis.Error(`unexpected TypeElement: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitKeywordTypeNode","kind":"method","status":"implemented","sigHash":"4f8071cf970fc7a5a08ca9d6b16769841cb6cf949a036bc92bf54d1ca449511b","bodyHash":"392eee2b6459d95d4955546f95e45f8cac8f6206dd15e70dd5175880d7097cfc"}
 *
 * Go source:
 * func (p *Printer) emitKeywordTypeNode(node *ast.KeywordTypeNode) {
 * 	p.emitKeywordNode(node.AsNode())
 * }
 */
export function Printer_emitKeywordTypeNode(receiver: GoPtr<Printer>, node: GoPtr<KeywordTypeNode>): void {
  Printer_emitKeywordNode(receiver, NodeDefault_AsNode(node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypePredicateParameterName","kind":"method","status":"implemented","sigHash":"025b1b06547dfc88bb97a11045c52a18c40e8d71997c963998ca7f1f8b44653c","bodyHash":"34f975ea3c5bed13b779a62e555c287ade860f7518804580f0e349fcaa9f6a78"}
 *
 * Go source:
 * func (p *Printer) emitTypePredicateParameterName(node *ast.TypePredicateParameterName) {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		p.emitIdentifierReference(node.AsIdentifier())
 * 	case ast.KindThisType:
 * 		p.emitThisType(node.AsThisTypeNode())
 * 	default:
 * 		panic(fmt.Sprintf("unexpected TypePredicateParameterName: %v", node.Kind))
 * 	}
 * }
 */
export function Printer_emitTypePredicateParameterName(receiver: GoPtr<Printer>, node: GoPtr<TypePredicateParameterName>): void {
  switch (node!.Kind) {
    case KindIdentifier:
      Printer_emitIdentifierReference(receiver, AsIdentifier(node));
      break;
    case KindThisType:
      Printer_emitThisType(receiver, AsThisTypeNode(node));
      break;
    default:
      throw new globalThis.Error(`unexpected TypePredicateParameterName: ${node!.Kind}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypePredicate","kind":"method","status":"implemented","sigHash":"7b7aaa17a3351b379b0dc7cfa08d25670a81eb64cd83936f1bf40aa9c3d44809","bodyHash":"b2ec92b1fc50b5e5e9dfce05fc8770fd67ba259825d55bae9c8fdbbb9db151c9"}
 *
 * Go source:
 * func (p *Printer) emitTypePredicate(node *ast.TypePredicateNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.AssertsModifier != nil {
 * 		p.emitTokenNode(node.AssertsModifier)
 * 		p.writeSpace()
 * 	}
 * 	p.emitTypePredicateParameterName(node.ParameterName)
 * 	if node.Type != nil {
 * 		p.writeSpace()
 * 		p.writeKeyword("is")
 * 		p.writeSpace()
 * 		p.emitTypeNodeOutsideExtends(node.Type)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypePredicate(receiver: GoPtr<Printer>, node: GoPtr<TypePredicateNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  if (node!.AssertsModifier !== undefined) {
    Printer_emitTokenNode(receiver, node!.AssertsModifier);
    Printer_writeSpace(receiver);
  }
  Printer_emitTypePredicateParameterName(receiver, node!.ParameterName);
  if (node!.Type !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writeKeyword(receiver, "is");
    Printer_writeSpace(receiver);
    Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeArgument","kind":"method","status":"implemented","sigHash":"06d55ad2ff2c8097ca29f298c6e9022053e20561ff5325dc7c02bf466e611750","bodyHash":"518f9b3e8d76681aed7c8bf3deb87727bb97ca1d46fd45a46abe665a4638d41f"}
 *
 * Go source:
 * func (p *Printer) emitTypeArgument(node *ast.TypeNode) {
 * 	p.emitTypeNodeOutsideExtends(node)
 * }
 */
export function Printer_emitTypeArgument(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  Printer_emitTypeNodeOutsideExtends(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeArguments","kind":"method","status":"implemented","sigHash":"08964d8276fc233511ebad6862257c3ed585bd04a6b367c077f95c3e345fb89a","bodyHash":"654953961dbe8568b230be098e61c22c5af488b6184cc6484412d74cd11d2f09"}
 *
 * Go source:
 * func (p *Printer) emitTypeArguments(parentNode *ast.Node, nodes *ast.TypeArgumentList) {
 * 	if nodes == nil {
 * 		return
 * 	}
 * 	p.emitList((*Printer).emitTypeParameterDeclarationNode, parentNode, nodes, LFTypeArguments /*|core.IfElse(p.shouldAllowTrailingComma(parentNode, nodes), LFAllowTrailingComma, LFNone)* /) // TODO: preserve trailing comma after Strada migration
 * }
 */
export function Printer_emitTypeArguments(receiver: GoPtr<Printer>, parentNode: GoPtr<Node>, nodes: GoPtr<TypeArgumentList>): void {
  if (nodes === undefined) {
    return;
  }
  Printer_emitList(receiver, Printer_emitTypeParameterDeclarationNode, parentNode, nodes, LFTypeArguments /*|IfElse(p.shouldAllowTrailingComma(parentNode, nodes), LFAllowTrailingComma, LFNone)*/); // TODO: preserve trailing comma after Strada migration
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeReference","kind":"method","status":"implemented","sigHash":"9e67566b2041db4cedd097342f718aa04b4b960f499221e9a8305c432112f941","bodyHash":"d609ae89b3facf76d652dedf3e7d841a4ba1f5b6701b196b21b7b537331751fc"}
 *
 * Go source:
 * func (p *Printer) emitTypeReference(node *ast.TypeReferenceNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitEntityName(node.TypeName)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeReference(receiver: GoPtr<Printer>, node: GoPtr<TypeReferenceNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitEntityName(receiver, node!.TypeName);
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitReturnType","kind":"method","status":"implemented","sigHash":"3c41232fcd12d0f3b16814586afb7a709b63a1479cd395266de5cae0c030d2f6","bodyHash":"a69ce3f65a33dc68018308c8435712dd0506f41488cb03bdfd92027cead6b624"}
 *
 * Go source:
 * func (p *Printer) emitReturnType(node *ast.TypeNode) {
 * 	if node == nil {
 * 		return
 * 	}
 * 	p.writePunctuation("=>")
 * 	p.writeSpace()
 * 	if p.inExtends && node.Kind == ast.KindInferType && node.AsInferTypeNode().TypeParameter.AsTypeParameterDeclaration().Constraint != nil {
 * 		// if the parent FunctionTypeNode or ConstructorTypeNode is in the `extends` clause of a ConditionalTypeNode,
 * 		// we must parenthesize `infer ... extends ...` so as not to result in an ambiguous parse.
 * 		//
 * 		// `T extends () => infer U extends V ? W : X` would parse the `? W : X` as part of a ConditionalTypeNode in the
 * 		// return type of the FunctionTypeNode, thus we must emit as `T extends () => (infer U extends V) ? W : X`
 * 		p.emitTypeNodePreservingExtends(node, ast.TypePrecedenceHighest)
 * 	} else {
 * 		p.emitTypeNodePreservingExtends(node, ast.TypePrecedenceLowest)
 * 	}
 * }
 */
export function Printer_emitReturnType(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  if (node === undefined) {
    return;
  }
  Printer_writePunctuation(receiver, "=>");
  Printer_writeSpace(receiver);
  if (receiver!.inExtends && node!.Kind === KindInferType && AsTypeParameterDeclaration(AsInferTypeNode(node as unknown as GoPtr<Node>)!.TypeParameter)!.Constraint !== undefined) {
    // if the parent FunctionTypeNode or ConstructorTypeNode is in the `extends` clause of a ConditionalTypeNode,
    // we must parenthesize `infer ... extends ...` so as not to result in an ambiguous parse.
    //
    // `T extends () => infer U extends V ? W : X` would parse the `? W : X` as part of a ConditionalTypeNode in the
    // return type of the FunctionTypeNode, thus we must emit as `T extends () => (infer U extends V) ? W : X`
    Printer_emitTypeNodePreservingExtends(receiver, node, TypePrecedenceHighest);
  } else {
    Printer_emitTypeNodePreservingExtends(receiver, node, TypePrecedenceLowest);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitFunctionType","kind":"method","status":"implemented","sigHash":"66f8f20b9db750d9654c0bf33bc37a08994a017278467e879cd11f60bfacd91c","bodyHash":"49b6ae500f80f6b6714b4db2794edbec88c8165d915d6ee19200f7cd7e5a2d92"}
 *
 * Go source:
 * func (p *Printer) emitFunctionType(node *ast.FunctionTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	// !!! in the old emitter, quickinfo uses type arguments in place of type parameters for instantiated signatures
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitParameters(node.AsNode(), node.Parameters)
 * 	p.writeSpace()
 * 	p.emitReturnType(node.Type)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitFunctionType(receiver: GoPtr<Printer>, node: GoPtr<FunctionTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  // !!! in the old emitter, quickinfo uses type arguments in place of type parameters for instantiated signatures
  Printer_emitTypeParameters(receiver, NodeDefault_AsNode(node), node!.TypeParameters);
  Printer_emitParameters(receiver, NodeDefault_AsNode(node), node!.Parameters);
  Printer_writeSpace(receiver);
  Printer_emitReturnType(receiver, node!.Type);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConstructorType","kind":"method","status":"implemented","sigHash":"702aca9f1551ee6035ecbed9d6de82aff7dd9fc55db4a5bddde6eb0176927f70","bodyHash":"ad8ca2edf04356d3d0036d2b1890ca492c1fde1f5e484593102625ccff8d3b26"}
 *
 * Go source:
 * func (p *Printer) emitConstructorType(node *ast.ConstructorTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("new")
 * 	p.writeSpace()
 * 	indented := p.shouldEmitIndented(node.AsNode())
 * 	p.increaseIndentIf(indented)
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	// !!! in the old emitter, quickinfo uses type arguments in place of type parameters for instantiated signatures
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.emitParameters(node.AsNode(), node.Parameters)
 * 	p.writeSpace()
 * 	p.emitReturnType(node.Type)
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.decreaseIndentIf(indented)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitConstructorType(receiver: GoPtr<Printer>, node: GoPtr<ConstructorTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false);
  Printer_writeKeyword(receiver, "new");
  Printer_writeSpace(receiver);
  const indented = Printer_shouldEmitIndented(receiver, NodeDefault_AsNode(node));
  Printer_increaseIndentIf(receiver, indented);
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  // !!! in the old emitter, quickinfo uses type arguments in place of type parameters for instantiated signatures
  Printer_emitTypeParameters(receiver, NodeDefault_AsNode(node), node!.TypeParameters);
  Printer_emitParameters(receiver, NodeDefault_AsNode(node), node!.Parameters);
  Printer_writeSpace(receiver);
  Printer_emitReturnType(receiver, node!.Type);
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_decreaseIndentIf(receiver, indented);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeQuery","kind":"method","status":"implemented","sigHash":"16502f7dfd9ff538fc1cd7bc9ec2b80197787f902c4031e964091d5fc84cced6","bodyHash":"2d003c5542488d79da972b8b724d93537075e0c090635ab3c7c797bfbfd9b6f5"}
 *
 * Go source:
 * func (p *Printer) emitTypeQuery(node *ast.TypeQueryNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("typeof")
 * 	p.writeSpace()
 * 	p.emitEntityName(node.ExprName)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeQuery(receiver: GoPtr<Printer>, node: GoPtr<TypeQueryNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writeKeyword(receiver, "typeof");
  Printer_writeSpace(receiver);
  Printer_emitEntityName(receiver, node!.ExprName);
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeLiteral","kind":"method","status":"implemented","sigHash":"7a4ab15e3a3538aea1e972cb9c90eea3d8d6d82e1731232113815a172ebb7c53","bodyHash":"95aa14b3015296acd689ea4db2369be90f7b03a1bd75c2c8c62f100fd128e3e6"}
 *
 * Go source:
 * func (p *Printer) emitTypeLiteral(node *ast.TypeLiteralNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.pushNameGenerationScope(node.AsNode())
 * 	p.generateAllMemberNames(node.Members)
 * 	p.writePunctuation("{")
 * 	flags := core.IfElse(p.shouldEmitOnSingleLine(node.AsNode()), LFSingleLineTypeLiteralMembers, LFMultiLineTypeLiteralMembers)
 * 	p.emitList((*Printer).emitTypeElement, node.AsNode(), node.Members, flags|LFNoSpaceIfEmpty)
 * 	p.writePunctuation("}")
 * 	p.popNameGenerationScope(node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeLiteral(receiver: GoPtr<Printer>, node: GoPtr<TypeLiteralNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_pushNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_generateAllMemberNames(receiver, node!.Members);
  Printer_writePunctuation(receiver, "{");
  const flags = IfElse(Printer_shouldEmitOnSingleLine(receiver, NodeDefault_AsNode(node)), LFSingleLineTypeLiteralMembers, LFMultiLineTypeLiteralMembers);
  Printer_emitList(receiver, Printer_emitTypeElement, NodeDefault_AsNode(node), node!.Members, flags | LFNoSpaceIfEmpty);
  Printer_writePunctuation(receiver, "}");
  Printer_popNameGenerationScope(receiver, NodeDefault_AsNode(node));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitArrayType","kind":"method","status":"implemented","sigHash":"2ea4f340ccf08b1769ee23444aeba14157dbefb2bff9db604a1d727d71dd900d","bodyHash":"9e510adcbe42225b632615e9182c85839d24ef002771713354f424c7aa766c04"}
 *
 * Go source:
 * func (p *Printer) emitArrayType(node *ast.ArrayTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPostfixTypeOperand(node.ElementType, node.AsNode())
 * 	p.writePunctuation("[")
 * 	p.writePunctuation("]")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitArrayType(receiver: GoPtr<Printer>, node: GoPtr<ArrayTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitPostfixTypeOperand(receiver, node!.ElementType, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "[");
  Printer_writePunctuation(receiver, "]");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitPostfixTypeOperand","kind":"method","status":"implemented","sigHash":"6b87ec35b5240d571d72503510269e86a4da826cd7f4c87681e5d601286776e9","bodyHash":"925447b6507a051fbfd0d833d131526647d84e448d27c1da66b69e687a64ff67"}
 *
 * Go source:
 * // emitPostfixTypeOperand emits the operand of a postfix type (ArrayType, IndexedAccessType,
 * // OptionalType). It is equivalent to `emitTypeNode(operand, TypePrecedencePostfix)` except
 * // that it preserves a parsed `typeof X` operand without adding parentheses (e.g.,
 * // `typeof C[K]` instead of `(typeof C)[K]`). TypeScript's `parenthesizeNonArrayTypeOfPostfixType`
 * // factory rule wraps `TypeQuery` in `ParenthesizedType` only when a postfix type is constructed
 * // via the factory, so parsed postfix types preserve the source as written during round-trip
 * // emit while synthesized postfix types (e.g., from declaration emit) still get the parentheses.
 * func (p *Printer) emitPostfixTypeOperand(operand *ast.TypeNode, parent *ast.Node) {
 * 	if ast.IsParseTreeNode(parent) && operand.Kind == ast.KindTypeQuery {
 * 		p.emitTypeNode(operand, ast.TypePrecedenceTypeOperator)
 * 		return
 * 	}
 * 	p.emitTypeNode(operand, ast.TypePrecedencePostfix)
 * }
 */
export function Printer_emitPostfixTypeOperand(receiver: GoPtr<Printer>, operand: GoPtr<TypeNode>, parent: GoPtr<Node>): void {
  if (IsParseTreeNode(parent) && operand!.Kind === KindTypeQuery) {
    Printer_emitTypeNode(receiver, operand, TypePrecedenceTypeOperator);
    return;
  }
  Printer_emitTypeNode(receiver, operand, TypePrecedencePostfix);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTupleElementType","kind":"method","status":"implemented","sigHash":"e66866af2c9800483086a9797c690154a9e1100d9c831396e267a89d86326d4a","bodyHash":"b1b81d65d4757ce426f2f08b851e0c4930fa9fbb9dfe5f8f99fdf2a767cc9d52"}
 *
 * Go source:
 * func (p *Printer) emitTupleElementType(node *ast.Node) {
 * 	p.emitTypeNodeOutsideExtends(node)
 * }
 */
export function Printer_emitTupleElementType(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  Printer_emitTypeNodeOutsideExtends(receiver, node as unknown as GoPtr<TypeNode>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTupleType","kind":"method","status":"implemented","sigHash":"e723c28f786f9fc3c8d2ca3ba9377c4bc94a2324fe8383761fa7e92d34938c0a","bodyHash":"0bc110a6ec665565c8c1237c4d32b19a67b8cc70371a7eeae1ba00925d4a9459"}
 *
 * Go source:
 * func (p *Printer) emitTupleType(node *ast.TupleTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindOpenBracketToken, node.Pos(), WriteKindPunctuation, node.AsNode())
 * 	flags := core.IfElse(p.shouldEmitOnSingleLine(node.AsNode()), LFSingleLineTupleTypeElements, LFMultiLineTupleTypeElements)
 * 	p.emitList((*Printer).emitTupleElementType, node.AsNode(), node.Elements, flags|LFNoSpaceIfEmpty)
 * 	p.emitToken(ast.KindCloseBracketToken, node.Elements.End(), WriteKindPunctuation, node.AsNode())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTupleType(receiver: GoPtr<Printer>, node: GoPtr<TupleTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitToken(receiver, KindOpenBracketToken, Node_Pos(NodeDefault_AsNode(node)), WriteKindPunctuation, NodeDefault_AsNode(node));
  const flags = IfElse(Printer_shouldEmitOnSingleLine(receiver, NodeDefault_AsNode(node)), LFSingleLineTupleTypeElements, LFMultiLineTupleTypeElements);
  Printer_emitList(receiver, Printer_emitTupleElementType, NodeDefault_AsNode(node), node!.Elements, flags | LFNoSpaceIfEmpty);
  Printer_emitToken(receiver, KindCloseBracketToken, NodeList_End(node!.Elements), WriteKindPunctuation, NodeDefault_AsNode(node));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitRestType","kind":"method","status":"implemented","sigHash":"f79179fa7a3e4285626ec123f241a84654914f4de76dd4b79d37766b2b5e53ea","bodyHash":"6a40383b118c85a79876a2704da4f81b18cc748d672e2c230e72124dcc623071"}
 *
 * Go source:
 * func (p *Printer) emitRestType(node *ast.RestTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("...")
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitRestType(receiver: GoPtr<Printer>, node: GoPtr<RestTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "...");
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitOptionalType","kind":"method","status":"implemented","sigHash":"82dddde3fe1a15696b1cbea2746ee9dd482a3fb279a828c43f9b4cfecfb239e0","bodyHash":"c1cd8f1480f128c0ad6d33a6806b540d3990e089d597942bc849cdf8beaed509"}
 *
 * Go source:
 * func (p *Printer) emitOptionalType(node *ast.OptionalTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	// !!! May need extra parenthesization if we also have JSDocNullableType
 * 	p.emitPostfixTypeOperand(node.Type, node.AsNode())
 * 	p.writePunctuation("?")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitOptionalType(receiver: GoPtr<Printer>, node: GoPtr<OptionalTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  // !!! May need extra parenthesization if we also have JSDocNullableType
  Printer_emitPostfixTypeOperand(receiver, node!.Type, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "?");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNamedTupleMember","kind":"method","status":"implemented","sigHash":"1a8330c728c5d56a89810f8b849bd2c30bfdcaea5ff0e6df6723e51a3adc87eb","bodyHash":"51d6547a56a2b32810e195925283bc4a1ae709d33f5a1288ad962f67bb06cdff"}
 *
 * Go source:
 * func (p *Printer) emitNamedTupleMember(node *ast.NamedTupleMember) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPunctuationNode(node.DotDotDotToken)
 * 	p.emitIdentifierName(node.Name().AsIdentifier())
 * 	p.emitPunctuationNode(node.QuestionToken)
 * 	p.emitToken(ast.KindColonToken, greatestEnd(node.Name().End(), node.QuestionToken), WriteKindPunctuation, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitNamedTupleMember(receiver: GoPtr<Printer>, node: GoPtr<NamedTupleMember>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitPunctuationNode(receiver, node!.DotDotDotToken);
  Printer_emitIdentifierName(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  Printer_emitPunctuationNode(receiver, node!.QuestionToken);
  Printer_emitToken(receiver, KindColonToken, greatestEnd(Node_End(Node_Name(NodeDefault_AsNode(node))), node!.QuestionToken as unknown as { End: () => int }), WriteKindPunctuation, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitUnionTypeConstituent","kind":"method","status":"implemented","sigHash":"d61cd86b3170b3e44126ce7bed05d84aac40415ef6d7f5bc6cb37b7ccc550370","bodyHash":"da365dee8a5153f4c5491ea89b554a6175ea815b02ce4febb46d989cef9ad463"}
 *
 * Go source:
 * func (p *Printer) emitUnionTypeConstituent(node *ast.TypeNode) {
 * 	p.emitTypeNode(node, ast.TypePrecedenceTypeOperator)
 * }
 */
export function Printer_emitUnionTypeConstituent(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  Printer_emitTypeNode(receiver, node, TypePrecedenceTypeOperator);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitUnionType","kind":"method","status":"implemented","sigHash":"2c6ce8f6e6fb5057334f0f7fdf01332e2b1e66e11476fd3ed74cd581f4aeab19","bodyHash":"5c25760190548a9000700d4833f042ac8d3aece3a47faa2242d1afa40166ddea"}
 *
 * Go source:
 * func (p *Printer) emitUnionType(node *ast.UnionTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitList((*Printer).emitUnionTypeConstituent, node.AsNode(), node.Types, LFUnionTypeConstituents)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitUnionType(receiver: GoPtr<Printer>, node: GoPtr<UnionTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitList(receiver, Printer_emitUnionTypeConstituent, NodeDefault_AsNode(node), node!.Types, LFUnionTypeConstituents);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIntersectionTypeConstituent","kind":"method","status":"implemented","sigHash":"9353a38f872402b4780e0141e7b25b757afc3c56850e52f43b7453858f4a4786","bodyHash":"ccbbe5c1b697308ccc90b0b1b25825c1d8170a32a113954610a7c716b89deee8"}
 *
 * Go source:
 * func (p *Printer) emitIntersectionTypeConstituent(node *ast.TypeNode) {
 * 	p.emitTypeNode(node, ast.TypePrecedenceTypeOperator)
 * }
 */
export function Printer_emitIntersectionTypeConstituent(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  Printer_emitTypeNode(receiver, node, TypePrecedenceTypeOperator);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIntersectionType","kind":"method","status":"implemented","sigHash":"38579cb65f62cafcf357d74b9c23452af94b408801007b7b89557b8e6665e8a0","bodyHash":"c78fea7678036ce61d7b9ded6b9f70df28ecc6f7f9b3bef29826c4241b7add6d"}
 *
 * Go source:
 * func (p *Printer) emitIntersectionType(node *ast.IntersectionTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitList((*Printer).emitIntersectionTypeConstituent, node.AsNode(), node.Types, LFIntersectionTypeConstituents /*, parenthesizer.parenthesizeConstituentTypeOfIntersectionType* /) // !!!
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIntersectionType(receiver: GoPtr<Printer>, node: GoPtr<IntersectionTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitList(receiver, Printer_emitIntersectionTypeConstituent, NodeDefault_AsNode(node), node!.Types, LFIntersectionTypeConstituents /*, parenthesizer.parenthesizeConstituentTypeOfIntersectionType*/); // !!!
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitConditionalType","kind":"method","status":"implemented","sigHash":"4cb38516c25692157b9ba2b1e73b986fbf11736afe342614603e98e1f76b43a5","bodyHash":"f83e60c0d3c45a2350e4448ed364042157e95d2c2875f7696372d8aeb413a9cf"}
 *
 * Go source:
 * func (p *Printer) emitConditionalType(node *ast.ConditionalTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTypeNode(node.CheckType, ast.TypePrecedenceUnion)
 * 	p.writeSpace()
 * 	p.writeKeyword("extends")
 * 	p.writeSpace()
 * 	p.emitTypeNodeInExtends(node.ExtendsType)
 * 	p.writeSpace()
 * 	p.writePunctuation("?")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.TrueType)
 * 	p.writeSpace()
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.FalseType)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitConditionalType(receiver: GoPtr<Printer>, node: GoPtr<ConditionalTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitTypeNode(receiver, node!.CheckType, TypePrecedenceUnion);
  Printer_writeSpace(receiver);
  Printer_writeKeyword(receiver, "extends");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeInExtends(receiver, node!.ExtendsType);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "?");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.TrueType);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.FalseType);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitInferTypeParameter","kind":"method","status":"implemented","sigHash":"30eedf03d41adbb4733e8d9e12435f5afd0fdde7b854cafeab7b03fada2423ba","bodyHash":"c8bddd2e07ff1a64921f7518632bb3054f9dc3afc3e23cff99b3037d34ca94fb"}
 *
 * Go source:
 * func (p *Printer) emitInferTypeParameter(node *ast.TypeParameterDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	if node.Constraint != nil {
 * 		p.writeSpace()
 * 		p.writeKeyword("extends")
 * 		p.writeSpace()
 * 		p.emitTypeNodeInExtends(node.Constraint)
 * 	}
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitInferTypeParameter(receiver: GoPtr<Printer>, node: GoPtr<TypeParameterDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  if (node!.Constraint !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writeKeyword(receiver, "extends");
    Printer_writeSpace(receiver);
    Printer_emitTypeNodeInExtends(receiver, node!.Constraint);
  }
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitInferType","kind":"method","status":"implemented","sigHash":"48f0636beeb3915880dff9356c85c772c115e145817947ca1403956c98e92d17","bodyHash":"3ed2f1395cabf170a28e0a0fff812b47a6310e0fc2ebca5759a4be90a6d5aece"}
 *
 * Go source:
 * func (p *Printer) emitInferType(node *ast.InferTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("infer")
 * 	p.writeSpace()
 * 	p.emitInferTypeParameter(node.TypeParameter.AsTypeParameterDeclaration())
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitInferType(receiver: GoPtr<Printer>, node: GoPtr<InferTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writeKeyword(receiver, "infer");
  Printer_writeSpace(receiver);
  Printer_emitInferTypeParameter(receiver, AsTypeParameterDeclaration(node!.TypeParameter));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitParenthesizedType","kind":"method","status":"implemented","sigHash":"512137af232f9becef592cee81159c201f9013113ba3040664cc9fe3134ad94c","bodyHash":"44d668c99bcda043bcf06208e721c2700bf0dae678f2c566abe690f5d96fb398"}
 *
 * Go source:
 * func (p *Printer) emitParenthesizedType(node *ast.ParenthesizedTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("(")
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.writePunctuation(")")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitParenthesizedType(receiver: GoPtr<Printer>, node: GoPtr<ParenthesizedTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "(");
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_writePunctuation(receiver, ")");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitThisType","kind":"method","status":"implemented","sigHash":"6fdefc4113a45043138701b42a0577810c9c2dc49059783f0afc9ff9ffba42ca","bodyHash":"0f5429ea57c6eb1862968af5ce56f4f7de01d6ab7cd6b51d9ce7ee4192dd2aa5"}
 *
 * Go source:
 * func (p *Printer) emitThisType(node *ast.ThisTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeKeyword("this")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitThisType(receiver: GoPtr<Printer>, node: GoPtr<ThisTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writeKeyword(receiver, "this");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeOperator","kind":"method","status":"implemented","sigHash":"d267aeefcf1dc43f29e4868431dbaa4de1f59a302b3dbb44d0542887f0aca1ea","bodyHash":"249eeaf88dbb3c20c26faf23c5d90762abb6e5aac66496c7b20c9f9b88619fd7"}
 *
 * Go source:
 * func (p *Printer) emitTypeOperator(node *ast.TypeOperatorNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(node.Operator, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitTypeNode(node.Type, core.IfElse(node.Operator == ast.KindReadonlyKeyword, ast.TypePrecedencePostfix, ast.TypePrecedenceTypeOperator))
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeOperator(receiver: GoPtr<Printer>, node: GoPtr<TypeOperatorNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitToken(receiver, node!.Operator, Node_Pos(NodeDefault_AsNode(node)), WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitTypeNode(receiver, node!.Type, IfElse(node!.Operator === KindReadonlyKeyword, TypePrecedencePostfix, TypePrecedenceTypeOperator));
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitIndexedAccessType","kind":"method","status":"implemented","sigHash":"dea61c17168bcc6d3f2d4bb634064cb031d4b0bfa086739c7f07821016f3f20c","bodyHash":"951963c0d7dc49c50c28b9b418d93c1e1b0178b60c0a09d880a6387beb7395f3"}
 *
 * Go source:
 * func (p *Printer) emitIndexedAccessType(node *ast.IndexedAccessTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitPostfixTypeOperand(node.ObjectType, node.AsNode())
 * 	p.writePunctuation("[")
 * 	p.emitTypeNodeOutsideExtends(node.IndexType)
 * 	p.writePunctuation("]")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitIndexedAccessType(receiver: GoPtr<Printer>, node: GoPtr<IndexedAccessTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitPostfixTypeOperand(receiver, node!.ObjectType, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "[");
  Printer_emitTypeNodeOutsideExtends(receiver, node!.IndexType);
  Printer_writePunctuation(receiver, "]");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMappedTypeParameter","kind":"method","status":"implemented","sigHash":"f0f49eef1b4b3e750fbbbc7d4b092fc6fef674a5a6921cacd729bec47fd054cb","bodyHash":"596952cfe61affc2f6a7dc71486d3fefe0845bf410a400c63ff892bb20351bf3"}
 *
 * Go source:
 * func (p *Printer) emitMappedTypeParameter(node *ast.TypeParameterDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.writeSpace()
 * 	p.writeKeyword("in")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Constraint)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitMappedTypeParameter(receiver: GoPtr<Printer>, node: GoPtr<TypeParameterDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  Printer_writeSpace(receiver);
  Printer_writeKeyword(receiver, "in");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Constraint);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitMappedType","kind":"method","status":"implemented","sigHash":"8abdcaa1e740799658b3d67aa7ee0cdbe1e1aae50c6898b1acca61ba46535491","bodyHash":"cc25c6654a23d1ffddf60a19f3a481243e441ea78585977edde52ea31859e01f"}
 *
 * Go source:
 * func (p *Printer) emitMappedType(node *ast.MappedTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	singleLine := p.shouldEmitOnSingleLine(node.AsNode())
 * 	p.writePunctuation("{")
 * 	if singleLine {
 * 		p.writeSpace()
 * 	} else {
 * 		p.writeLine()
 * 		p.increaseIndent()
 * 	}
 * 	if node.ReadonlyToken != nil {
 * 		p.emitTokenNode(node.ReadonlyToken)
 * 		if node.ReadonlyToken.Kind != ast.KindReadonlyKeyword {
 * 			p.writeKeyword("readonly")
 * 		}
 * 		p.writeSpace()
 * 	}
 * 	p.writePunctuation("[")
 * 	p.emitMappedTypeParameter(node.TypeParameter.AsTypeParameterDeclaration())
 * 	if node.NameType != nil {
 * 		p.writeSpace()
 * 		p.writeKeyword("as")
 * 		p.writeSpace()
 * 		p.emitTypeNodeOutsideExtends(node.NameType)
 * 	}
 * 	p.writePunctuation("]")
 * 	if node.QuestionToken != nil {
 * 		p.emitPunctuationNode(node.QuestionToken)
 * 		if node.QuestionToken.Kind != ast.KindQuestionToken {
 * 			p.writePunctuation("?")
 * 		}
 * 	}
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.writeTrailingSemicolon()
 * 	if node.Members != nil {
 * 		if len(node.Members.Nodes) > 0 {
 * 			if singleLine {
 * 				p.writeSpace()
 * 			} else {
 * 				p.writeLine()
 * 			}
 * 			p.emitList((*Printer).emitTypeElement, node.AsNode(), node.Members, LFPreserveLines)
 * 		}
 * 	}
 * 	if singleLine {
 * 		p.writeSpace()
 * 	} else {
 * 		p.writeLine()
 * 		p.decreaseIndent()
 * 	}
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitMappedType(receiver: GoPtr<Printer>, node: GoPtr<MappedTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  const singleLine = Printer_shouldEmitOnSingleLine(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "{");
  if (singleLine) {
    Printer_writeSpace(receiver);
  } else {
    Printer_writeLine(receiver);
    Printer_increaseIndent(receiver);
  }
  if (node!.ReadonlyToken !== undefined) {
    Printer_emitTokenNode(receiver, node!.ReadonlyToken);
    if (node!.ReadonlyToken!.Kind !== KindReadonlyKeyword) {
      Printer_writeKeyword(receiver, "readonly");
    }
    Printer_writeSpace(receiver);
  }
  Printer_writePunctuation(receiver, "[");
  Printer_emitMappedTypeParameter(receiver, AsTypeParameterDeclaration(node!.TypeParameter));
  if (node!.NameType !== undefined) {
    Printer_writeSpace(receiver);
    Printer_writeKeyword(receiver, "as");
    Printer_writeSpace(receiver);
    Printer_emitTypeNodeOutsideExtends(receiver, node!.NameType);
  }
  Printer_writePunctuation(receiver, "]");
  if (node!.QuestionToken !== undefined) {
    Printer_emitPunctuationNode(receiver, node!.QuestionToken);
    if (node!.QuestionToken!.Kind !== KindQuestionToken) {
      Printer_writePunctuation(receiver, "?");
    }
  }
  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_writeTrailingSemicolon(receiver);
  if (node!.Members !== undefined) {
    if (node!.Members!.Nodes.length > 0) {
      if (singleLine) {
        Printer_writeSpace(receiver);
      } else {
        Printer_writeLine(receiver);
      }
      Printer_emitList(receiver, Printer_emitTypeElement, NodeDefault_AsNode(node), node!.Members, LFPreserveLines);
    }
  }
  if (singleLine) {
    Printer_writeSpace(receiver);
  } else {
    Printer_writeLine(receiver);
    Printer_decreaseIndent(receiver);
  }
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitLiteralType","kind":"method","status":"implemented","sigHash":"2fb4edd660966448903d4a6cc951ec9323b6f807f29b5d8c47fcd9d2e3c28e02","bodyHash":"5bc17e624da3860239c3c99204d7187942ad37376897a420c335316476638d08"}
 *
 * Go source:
 * func (p *Printer) emitLiteralType(node *ast.LiteralTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Literal, ast.OperatorPrecedenceComma)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitLiteralType(receiver: GoPtr<Printer>, node: GoPtr<LiteralTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitExpression(receiver, node!.Literal, OperatorPrecedenceComma);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTemplateType","kind":"method","status":"implemented","sigHash":"190bf93f13b190b55f363c223470873021ce5615c51f7c5453f94cb33ed8d7b3","bodyHash":"ad7886aa53e51fffc5ad2112d4648e5ab8dd34b3da7cd56c605b73ee055e12c8"}
 *
 * Go source:
 * func (p *Printer) emitTemplateType(node *ast.TemplateLiteralTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTemplateHead(node.Head.AsTemplateHead())
 * 	p.emitList((*Printer).emitTemplateTypeSpanNode, node.AsNode(), node.TemplateSpans, LFTemplateExpressionSpans)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTemplateType(receiver: GoPtr<Printer>, node: GoPtr<TemplateLiteralTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitTemplateHead(receiver, AsTemplateHead(node!.Head));
  Printer_emitList(receiver, Printer_emitTemplateTypeSpanNode, NodeDefault_AsNode(node), node!.TemplateSpans, LFTemplateExpressionSpans);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportTypeNodeAttributes","kind":"method","status":"implemented","sigHash":"43a8fe8291aeedf3fe749d724feb54a986971b8973cae7cf8b0683fdf102f615","bodyHash":"7b58be392b5eee3075a93a84a073968d879f4705cc42eb4c47036f8f9ebfc327"}
 *
 * Go source:
 * func (p *Printer) emitImportTypeNodeAttributes(node *ast.ImportAttributes) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("{")
 * 	p.writeSpace()
 * 	p.writeKeyword(core.IfElse(node.Token == ast.KindAssertKeyword, "assert", "with"))
 * 	p.writePunctuation(":")
 * 	p.writeSpace()
 * 	p.emitList((*Printer).emitImportAttributeNode, node.AsNode(), node.Attributes, LFImportAttributes)
 * 	p.writeSpace()
 * 	p.writePunctuation("}")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportTypeNodeAttributes(receiver: GoPtr<Printer>, node: GoPtr<ImportAttributes>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "{");
  Printer_writeSpace(receiver);
  Printer_writeKeyword(receiver, IfElse(node!.Token === KindAssertKeyword, "assert", "with"));
  Printer_writePunctuation(receiver, ":");
  Printer_writeSpace(receiver);
  Printer_emitList(receiver, Printer_emitImportAttributeNode, NodeDefault_AsNode(node), node!.Attributes, LFImportAttributes);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "}");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitImportTypeNode","kind":"method","status":"implemented","sigHash":"8421ec00aa2016d30c5eb6085661cbc33fb839824229c99dae3be921dc4d52e9","bodyHash":"ed5f8f7daa7ff08ace5d1fbe83879592de3fb6df5da845df2e46e04432773bbc"}
 *
 * Go source:
 * func (p *Printer) emitImportTypeNode(node *ast.ImportTypeNode) {
 * 	state := p.enterNode(node.AsNode())
 * 	if node.IsTypeOf {
 * 		p.writeKeyword("typeof")
 * 		p.writeSpace()
 * 	}
 * 	p.writeKeyword("import")
 * 	p.writePunctuation("(")
 * 	p.emitTypeNodeOutsideExtends(node.Argument)
 * 	if node.Attributes != nil {
 * 		p.writePunctuation(",")
 * 		p.writeSpace()
 * 		p.emitImportTypeNodeAttributes(node.Attributes.AsImportAttributes())
 * 	}
 * 	p.writePunctuation(")")
 * 	if node.Qualifier != nil {
 * 		p.writePunctuation(".")
 * 		p.emitEntityName(node.Qualifier)
 * 	}
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitImportTypeNode(receiver: GoPtr<Printer>, node: GoPtr<ImportTypeNode>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  if (node!.IsTypeOf) {
    Printer_writeKeyword(receiver, "typeof");
    Printer_writeSpace(receiver);
  }
  Printer_writeKeyword(receiver, "import");
  Printer_writePunctuation(receiver, "(");
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Argument);
  if (node!.Attributes !== undefined) {
    Printer_writePunctuation(receiver, ",");
    Printer_writeSpace(receiver);
    Printer_emitImportTypeNodeAttributes(receiver, AsImportAttributes(node!.Attributes));
  }
  Printer_writePunctuation(receiver, ")");
  if (node!.Qualifier !== undefined) {
    Printer_writePunctuation(receiver, ".");
    Printer_emitEntityName(receiver, node!.Qualifier);
  }
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeNodeInExtends","kind":"method","status":"implemented","sigHash":"172cb339d9695183ccf8201ff72aa68e18a2b0ddb003580baed0ee90c0f4b213","bodyHash":"b73bfd260e6952c43e543375905d39c9a5403558e9a113aa2ed8fa2aa9217753"}
 *
 * Go source:
 * func (p *Printer) emitTypeNodeInExtends(node *ast.TypeNode) {
 * 	savedInExtends := p.inExtends
 * 	p.inExtends = true
 * 	p.emitTypeNodePreservingExtends(node, ast.TypePrecedenceLowest)
 * 	p.inExtends = savedInExtends
 * }
 */
export function Printer_emitTypeNodeInExtends(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  const savedInExtends = receiver!.inExtends;
  receiver!.inExtends = true as unknown as bool;
  Printer_emitTypeNodePreservingExtends(receiver, node, TypePrecedenceLowest);
  receiver!.inExtends = savedInExtends;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeNodeOutsideExtends","kind":"method","status":"implemented","sigHash":"422f54d71f88da0b8987cef4dd5c86bff142b2e350a284628d9a29f2072fb752","bodyHash":"18916f367b082da52339d213d5bb54022549f8ce37101dc3a9701a60aab70412"}
 *
 * Go source:
 * func (p *Printer) emitTypeNodeOutsideExtends(node *ast.TypeNode) {
 * 	savedInExtends := p.inExtends
 * 	p.inExtends = false
 * 	p.emitTypeNodePreservingExtends(node, ast.TypePrecedenceLowest)
 * 	p.inExtends = savedInExtends
 * }
 */
export function Printer_emitTypeNodeOutsideExtends(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>): void {
  const savedInExtends = receiver!.inExtends;
  receiver!.inExtends = false as unknown as bool;
  Printer_emitTypeNodePreservingExtends(receiver, node, TypePrecedenceLowest);
  receiver!.inExtends = savedInExtends;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeNodePreservingExtends","kind":"method","status":"implemented","sigHash":"e0aac6309d1e55545b5b9cf41abd6c5cbeb1fdba4d868f62f2b1ca48f6529b0c","bodyHash":"4cc92d4f065f15bc3ee11d004eafd68acfdea3bfd3a2fb22bdaeee602e151e24"}
 *
 * Go source:
 * func (p *Printer) emitTypeNodePreservingExtends(node *ast.TypeNode, precedence ast.TypePrecedence) {
 * 	p.emitTypeNode(node, precedence)
 * }
 */
export function Printer_emitTypeNodePreservingExtends(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>, precedence: TypePrecedence): void {
  Printer_emitTypeNode(receiver, node, precedence);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeNode","kind":"method","status":"implemented","sigHash":"2fc529beff3ea04e90f8fab333e05d30c187d646370a9e690096f48de95cedda","bodyHash":"afe9a5afc357a0e87939f7ec6328f88e1e59ff529ef14f2c19c5775ea6ee22ee"}
 *
 * Go source:
 * func (p *Printer) emitTypeNode(node *ast.TypeNode, precedence ast.TypePrecedence) {
 * 	if p.inExtends && precedence <= ast.TypePrecedenceConditional {
 * 		// in the `extends` clause of a ConditionalType or InferType, a ConditionalType must be parenthesized
 * 		precedence = ast.TypePrecedenceFunction
 * 	}
 *
 * 	savedInExtends := p.inExtends
 * 	parens := ast.GetTypeNodePrecedence(node) < precedence
 * 	if parens {
 * 		p.inExtends = false
 * 		p.writePunctuation("(")
 * 	}
 *
 * 	switch node.Kind {
 * 	// Keyword Types
 * 	case ast.KindAnyKeyword,
 * 		ast.KindUnknownKeyword,
 * 		ast.KindNumberKeyword,
 * 		ast.KindBigIntKeyword,
 * 		ast.KindObjectKeyword,
 * 		ast.KindBooleanKeyword,
 * 		ast.KindStringKeyword,
 * 		ast.KindSymbolKeyword,
 * 		ast.KindVoidKeyword,
 * 		ast.KindUndefinedKeyword,
 * 		ast.KindNeverKeyword,
 * 		ast.KindIntrinsicKeyword:
 * 		p.emitKeywordTypeNode(node.AsKeywordTypeNode())
 *
 * 	// Types
 * 	case ast.KindTypePredicate:
 * 		p.emitTypePredicate(node.AsTypePredicateNode())
 * 	case ast.KindTypeReference:
 * 		p.emitTypeReference(node.AsTypeReferenceNode())
 * 	case ast.KindFunctionType:
 * 		p.emitFunctionType(node.AsFunctionTypeNode())
 * 	case ast.KindConstructorType:
 * 		p.emitConstructorType(node.AsConstructorTypeNode())
 * 	case ast.KindTypeQuery:
 * 		p.emitTypeQuery(node.AsTypeQueryNode())
 * 	case ast.KindTypeLiteral:
 * 		p.emitTypeLiteral(node.AsTypeLiteralNode())
 * 	case ast.KindArrayType:
 * 		p.emitArrayType(node.AsArrayTypeNode())
 * 	case ast.KindTupleType:
 * 		p.emitTupleType(node.AsTupleTypeNode())
 * 	case ast.KindOptionalType:
 * 		p.emitOptionalType(node.AsOptionalTypeNode())
 * 	case ast.KindRestType:
 * 		p.emitRestType(node.AsRestTypeNode())
 * 	case ast.KindUnionType:
 * 		p.emitUnionType(node.AsUnionTypeNode())
 * 	case ast.KindIntersectionType:
 * 		p.emitIntersectionType(node.AsIntersectionTypeNode())
 * 	case ast.KindConditionalType:
 * 		p.emitConditionalType(node.AsConditionalTypeNode())
 * 	case ast.KindInferType:
 * 		p.emitInferType(node.AsInferTypeNode())
 * 	case ast.KindParenthesizedType:
 * 		p.emitParenthesizedType(node.AsParenthesizedTypeNode())
 * 	case ast.KindThisType:
 * 		p.emitThisType(node.AsThisTypeNode())
 * 	case ast.KindTypeOperator:
 * 		p.emitTypeOperator(node.AsTypeOperatorNode())
 * 	case ast.KindIndexedAccessType:
 * 		p.emitIndexedAccessType(node.AsIndexedAccessTypeNode())
 * 	case ast.KindMappedType:
 * 		p.emitMappedType(node.AsMappedTypeNode())
 * 	case ast.KindLiteralType:
 * 		p.emitLiteralType(node.AsLiteralTypeNode())
 * 	case ast.KindNamedTupleMember:
 * 		p.emitNamedTupleMember(node.AsNamedTupleMember())
 * 	case ast.KindTemplateLiteralType:
 * 		p.emitTemplateType(node.AsTemplateLiteralTypeNode())
 * 	case ast.KindTemplateLiteralTypeSpan:
 * 		p.emitTemplateTypeSpan(node.AsTemplateLiteralTypeSpan())
 * 	case ast.KindImportType:
 * 		p.emitImportTypeNode(node.AsImportTypeNode())
 *
 * 	case ast.KindPropertyAccessExpression:
 * 		// Occurs in pseudo-types such as `f<T>.C`, where `f` is a generic function and `C` is a local type
 * 		p.emitPropertyAccessExpression(node.AsPropertyAccessExpression())
 * 	case ast.KindExpressionWithTypeArguments:
 * 		// !!! Should this actually be considered a type?
 * 		p.emitExpressionWithTypeArguments(node.AsExpressionWithTypeArguments())
 *
 * 	case ast.KindJSDocAllType:
 * 		p.emitJSDocAllType(node)
 * 	case ast.KindJSDocNonNullableType:
 * 		p.emitJSDocNonNullableType(node.AsJSDocNonNullableType())
 * 	case ast.KindJSDocNullableType:
 * 		p.emitJSDocNullableType(node.AsJSDocNullableType())
 * 	case ast.KindJSDocOptionalType:
 * 		p.emitJSDocOptionalType(node.AsJSDocOptionalType())
 * 	case ast.KindJSDocVariadicType:
 * 		p.emitJSDocVariadicType(node.AsJSDocVariadicType())
 *
 * 	default:
 * 		panic(fmt.Sprintf("unhandled TypeNode: %v", node.Kind))
 * 	}
 *
 * 	if parens {
 * 		p.writePunctuation(")")
 * 	}
 *
 * 	p.inExtends = savedInExtends
 * }
 */
export function Printer_emitTypeNode(receiver: GoPtr<Printer>, node: GoPtr<TypeNode>, precedence: TypePrecedence): void {
  if (receiver!.inExtends && precedence <= TypePrecedenceConditional) {
    // in the `extends` clause of a ConditionalType or InferType, a ConditionalType must be parenthesized
    precedence = TypePrecedenceFunction;
  }
  const savedInExtends = receiver!.inExtends;
  const parens = GetTypeNodePrecedence(node) < precedence;
  if (parens) {
    receiver!.inExtends = false as unknown as bool;
    Printer_writePunctuation(receiver, "(");
  }
  switch (node!.Kind) {
    // Keyword Types
    case KindAnyKeyword:
    case KindUnknownKeyword:
    case KindNumberKeyword:
    case KindBigIntKeyword:
    case KindObjectKeyword:
    case KindBooleanKeyword:
    case KindStringKeyword:
    case KindSymbolKeyword:
    case KindVoidKeyword:
    case KindUndefinedKeyword:
    case KindNeverKeyword:
    case KindIntrinsicKeyword:
      Printer_emitKeywordTypeNode(receiver, AsKeywordTypeNode(node as unknown as GoPtr<Node>));
      break;
    // Types
    case KindTypePredicate:
      Printer_emitTypePredicate(receiver, AsTypePredicateNode(node as unknown as GoPtr<Node>));
      break;
    case KindTypeReference:
      Printer_emitTypeReference(receiver, AsTypeReferenceNode(node as unknown as GoPtr<Node>));
      break;
    case KindFunctionType:
      Printer_emitFunctionType(receiver, AsFunctionTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindConstructorType:
      Printer_emitConstructorType(receiver, AsConstructorTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindTypeQuery:
      Printer_emitTypeQuery(receiver, AsTypeQueryNode(node as unknown as GoPtr<Node>));
      break;
    case KindTypeLiteral:
      Printer_emitTypeLiteral(receiver, AsTypeLiteralNode(node as unknown as GoPtr<Node>));
      break;
    case KindArrayType:
      Printer_emitArrayType(receiver, AsArrayTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindTupleType:
      Printer_emitTupleType(receiver, AsTupleTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindOptionalType:
      Printer_emitOptionalType(receiver, AsOptionalTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindRestType:
      Printer_emitRestType(receiver, AsRestTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindUnionType:
      Printer_emitUnionType(receiver, AsUnionTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindIntersectionType:
      Printer_emitIntersectionType(receiver, AsIntersectionTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindConditionalType:
      Printer_emitConditionalType(receiver, AsConditionalTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindInferType:
      Printer_emitInferType(receiver, AsInferTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindParenthesizedType:
      Printer_emitParenthesizedType(receiver, AsParenthesizedTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindThisType:
      Printer_emitThisType(receiver, AsThisTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindTypeOperator:
      Printer_emitTypeOperator(receiver, AsTypeOperatorNode(node as unknown as GoPtr<Node>));
      break;
    case KindIndexedAccessType:
      Printer_emitIndexedAccessType(receiver, AsIndexedAccessTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindMappedType:
      Printer_emitMappedType(receiver, AsMappedTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindLiteralType:
      Printer_emitLiteralType(receiver, AsLiteralTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindNamedTupleMember:
      Printer_emitNamedTupleMember(receiver, AsNamedTupleMember(node as unknown as GoPtr<Node>));
      break;
    case KindTemplateLiteralType:
      Printer_emitTemplateType(receiver, AsTemplateLiteralTypeNode(node as unknown as GoPtr<Node>));
      break;
    case KindTemplateLiteralTypeSpan:
      Printer_emitTemplateTypeSpan(receiver, AsTemplateLiteralTypeSpan(node as unknown as GoPtr<Node>));
      break;
    case KindImportType:
      Printer_emitImportTypeNode(receiver, AsImportTypeNode(node as unknown as GoPtr<Node>));
      break;

    case KindPropertyAccessExpression:
      // Occurs in pseudo-types such as `f<T>.C`, where `f` is a generic function and `C` is a local type
      Printer_emitPropertyAccessExpression(receiver, AsPropertyAccessExpression(node as unknown as GoPtr<Node>));
      break;
    case KindExpressionWithTypeArguments:
      // !!! Should this actually be considered a type?
      Printer_emitExpressionWithTypeArguments(receiver, AsExpressionWithTypeArguments(node as unknown as GoPtr<Node>));
      break;
    case KindJSDocAllType:
      Printer_emitJSDocAllType(receiver, node as unknown as GoPtr<Node>);
      break;
    case KindJSDocNonNullableType:
      Printer_emitJSDocNonNullableType(receiver, AsJSDocNonNullableType(node as unknown as GoPtr<Node>));
      break;
    case KindJSDocNullableType:
      Printer_emitJSDocNullableType(receiver, AsJSDocNullableType(node as unknown as GoPtr<Node>));
      break;
    case KindJSDocOptionalType:
      Printer_emitJSDocOptionalType(receiver, AsJSDocOptionalType(node as unknown as GoPtr<Node>));
      break;
    case KindJSDocVariadicType:
      Printer_emitJSDocVariadicType(receiver, AsJSDocVariadicType(node as unknown as GoPtr<Node>));
      break;
    default:
      throw new globalThis.Error(`unhandled TypeNode: ${node!.Kind}`);
  }
  if (parens) {
    Printer_writePunctuation(receiver, ")");
  }
  receiver!.inExtends = savedInExtends;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocAllType","kind":"method","status":"implemented","sigHash":"93320d37ca110faed33e73aeb2c2bda957c433bd4b59e03fa46ac9c59ff88ffc","bodyHash":"458d731319e88ae98b6b1338c470117bd37a9cbf1255aa539f2b47d5ab558e3b"}
 *
 * Go source:
 * func (p *Printer) emitJSDocAllType(node *ast.Node) {
 * 	p.emitKeywordNode(node)
 * }
 */
export function Printer_emitJSDocAllType(receiver: GoPtr<Printer>, node: GoPtr<Node>): void {
  Printer_emitKeywordNode(receiver, node);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocNonNullableType","kind":"method","status":"implemented","sigHash":"2ec26cb7ffe5600497e104148547329718d942efd22c78913b2586c546204132","bodyHash":"ca486061dedad94c2a8f4c24a432dd0582d536a1563d56363dd76afa632c3435"}
 *
 * Go source:
 * func (p *Printer) emitJSDocNonNullableType(node *ast.JSDocNonNullableType) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("!")
 * 	p.emitTypeNode(node.Type, ast.TypePrecedenceNonArray)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJSDocNonNullableType(receiver: GoPtr<Printer>, node: GoPtr<JSDocNonNullableType>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "!");
  Printer_emitTypeNode(receiver, node!.Type, TypePrecedenceNonArray);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocNullableType","kind":"method","status":"implemented","sigHash":"a3d1ec0b949c79b18802a44ff9f01c9b2cd8ce3e70eec814150d1048bd83ecaa","bodyHash":"1a28a4feb09654825df82ad27f4b58ba95848abd27c0be216a9bfeb2be3d76be"}
 *
 * Go source:
 * func (p *Printer) emitJSDocNullableType(node *ast.JSDocNullableType) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("?")
 * 	p.emitTypeNode(node.Type, ast.TypePrecedenceNonArray)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJSDocNullableType(receiver: GoPtr<Printer>, node: GoPtr<JSDocNullableType>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "?");
  Printer_emitTypeNode(receiver, node!.Type, TypePrecedenceNonArray);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocOptionalType","kind":"method","status":"implemented","sigHash":"eefb7733651faf57afe96f5eab73caa74eb3ff1636c317d4315d4829dcf1c2f7","bodyHash":"25fbb36806c841fe956d1693ad70fa7344628a3be18cea34f1202f5755a313c6"}
 *
 * Go source:
 * func (p *Printer) emitJSDocOptionalType(node *ast.JSDocOptionalType) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitTypeNode(node.Type, ast.TypePrecedenceJSDoc)
 * 	p.writePunctuation("=")
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJSDocOptionalType(receiver: GoPtr<Printer>, node: GoPtr<JSDocOptionalType>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitTypeNode(receiver, node!.Type, TypePrecedenceJSDoc);
  Printer_writePunctuation(receiver, "=");
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitJSDocVariadicType","kind":"method","status":"implemented","sigHash":"66952ed2cac86dd030f21a58564ae35a5cabb688c9e03dbdcc489a57540ede36","bodyHash":"002580a57695e81bd053d83e65249ad707964f5c86bc74bb930709d3283172d9"}
 *
 * Go source:
 * func (p *Printer) emitJSDocVariadicType(node *ast.JSDocVariadicType) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("...")
 * 	p.emitTypeNode(node.Type, ast.TypePrecedenceJSDoc)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitJSDocVariadicType(receiver: GoPtr<Printer>, node: GoPtr<JSDocVariadicType>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "...");
  Printer_emitTypeNode(receiver, node!.Type, TypePrecedenceJSDoc);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeAssertionExpression","kind":"method","status":"implemented","sigHash":"50d793e1ef7d1b0461c67b7578397c1c53c8529a50fb57d39e3c610388ff1529","bodyHash":"6d3ef438552fbfa93c7b3246235654dc6c21c23691c2f2c9079827271fedc32f"}
 *
 * Go source:
 * func (p *Printer) emitTypeAssertionExpression(node *ast.TypeAssertion) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writePunctuation("<")
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.writePunctuation(">")
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceUpdate)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeAssertionExpression(receiver: GoPtr<Printer>, node: GoPtr<TypeAssertion>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writePunctuation(receiver, "<");
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_writePunctuation(receiver, ">");
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceUpdate);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeOfExpression","kind":"method","status":"implemented","sigHash":"19292593457926a27a72266cffea0f3b3d412e266f7944a2167c7ad4dc2f9fc3","bodyHash":"54967aa9d9f75a89527c20ec5e39969813e8b89e147e9fe439ebdcbcfcaad2cd"}
 *
 * Go source:
 * func (p *Printer) emitTypeOfExpression(node *ast.TypeOfExpression) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitToken(ast.KindTypeOfKeyword, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceUnary)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeOfExpression(receiver: GoPtr<Printer>, node: GoPtr<TypeOfExpression>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitToken(receiver, KindTypeOfKeyword, Node_Pos(NodeDefault_AsNode(node)), WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceUnary);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExpressionWithTypeArguments","kind":"method","status":"implemented","sigHash":"9919ccc5dc4f7a2f4e0b110ae26a13fd8e10bc0ff775c242af390edba6ff73f9","bodyHash":"e7e095c1f24cbe578814510427a6a8db47bd71894fe2576d6f7b3cee5a72d9a1"}
 *
 * Go source:
 * func (p *Printer) emitExpressionWithTypeArguments(node *ast.ExpressionWithTypeArguments) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitExpression(node.Expression, ast.OperatorPrecedenceMember)
 * 	p.emitTypeArguments(node.AsNode(), node.TypeArguments)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitExpressionWithTypeArguments(receiver: GoPtr<Printer>, node: GoPtr<ExpressionWithTypeArguments>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitExpression(receiver, node!.Expression, OperatorPrecedenceMember);
  Printer_emitTypeArguments(receiver, NodeDefault_AsNode(node), node!.TypeArguments);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitExpressionWithTypeArgumentsNode","kind":"method","status":"implemented","sigHash":"cee8a4c36577c0a19c169ad7822ce78d6d6db37c4ec654c04413a12cfcd22c1d","bodyHash":"a1c76f53963db7aee713e83ef3cf912c883e5b12648a45371c00e6aa4300f878"}
 *
 * Go source:
 * func (p *Printer) emitExpressionWithTypeArgumentsNode(node *ast.ExpressionWithTypeArgumentsNode) {
 * 	p.emitExpressionWithTypeArguments(node.AsExpressionWithTypeArguments())
 * }
 */
export function Printer_emitExpressionWithTypeArgumentsNode(receiver: GoPtr<Printer>, node: GoPtr<ExpressionWithTypeArgumentsNode>): void {
  Printer_emitExpressionWithTypeArguments(receiver, AsExpressionWithTypeArguments(node as unknown as GoPtr<Node>));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitNotEmittedTypeElement","kind":"method","status":"implemented","sigHash":"cf75540b6d407b1eceb1c45f76c698bc067a5d11e4f15a4a3a1a667b321e620d","bodyHash":"4b8fad9a5032d7128e5b1ca5858b7c0755f8be86d77dcc2d55e1fcf77a04fb12"}
 *
 * Go source:
 * func (p *Printer) emitNotEmittedTypeElement(node *ast.NotEmittedTypeElement) {
 * 	p.exitNode(node.AsNode(), p.enterNode(node.AsNode()))
 * }
 */
export function Printer_emitNotEmittedTypeElement(receiver: GoPtr<Printer>, node: GoPtr<NotEmittedTypeElement>): void {
  Printer_exitNode(receiver, NodeDefault_AsNode(node), Printer_enterNode(receiver, NodeDefault_AsNode(node)));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitTypeAliasDeclaration","kind":"method","status":"implemented","sigHash":"8705c04e30631b6d7e01c32b5fdd683f8470190adc51d40068e06edb47307562","bodyHash":"b15ff6c49a41cf2a2e84fdc2876226897392a6783e0233c9e95d56e24019d125"}
 *
 * Go source:
 * func (p *Printer) emitTypeAliasDeclaration(node *ast.TypeAliasDeclaration) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.emitModifierList(node.AsNode(), node.Modifiers(), false /*allowDecorators* /)
 * 	p.writeKeyword("type")
 * 	p.writeSpace()
 * 	p.emitBindingIdentifier(node.Name().AsIdentifier())
 * 	p.emitTypeParameters(node.AsNode(), node.TypeParameters)
 * 	p.writeSpace()
 * 	p.writePunctuation("=")
 * 	p.writeSpace()
 * 	p.emitTypeNodeOutsideExtends(node.Type)
 * 	p.writeTrailingSemicolon()
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitTypeAliasDeclaration(receiver: GoPtr<Printer>, node: GoPtr<TypeAliasDeclaration>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_emitModifierList(receiver, NodeDefault_AsNode(node), Node_Modifiers(NodeDefault_AsNode(node)), false);
  Printer_writeKeyword(receiver, "type");
  Printer_writeSpace(receiver);
  Printer_emitBindingIdentifier(receiver, AsIdentifier(Node_Name(NodeDefault_AsNode(node))));
  Printer_emitTypeParameters(receiver, NodeDefault_AsNode(node), node!.TypeParameters);
  Printer_writeSpace(receiver);
  Printer_writePunctuation(receiver, "=");
  Printer_writeSpace(receiver);
  Printer_emitTypeNodeOutsideExtends(receiver, node!.Type);
  Printer_writeTrailingSemicolon(receiver);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitHeritageClause","kind":"method","status":"implemented","sigHash":"5d860e1095f453948b40bfe0169d6bc49436288117cfbf2862c035293e99d002","bodyHash":"cb3c3ed5c929b32f7fc90f13bad8fbf912c1fb6ab84a3cc81e21a0a62993bd32"}
 *
 * Go source:
 * func (p *Printer) emitHeritageClause(node *ast.HeritageClause) {
 * 	state := p.enterNode(node.AsNode())
 * 	p.writeSpace()
 * 	p.emitToken(node.Token, node.Pos(), WriteKindKeyword, node.AsNode())
 * 	p.writeSpace()
 * 	p.emitList((*Printer).emitExpressionWithTypeArgumentsNode, node.AsNode(), node.Types, LFHeritageClauseTypes)
 * 	p.exitNode(node.AsNode(), state)
 * }
 */
export function Printer_emitHeritageClause(receiver: GoPtr<Printer>, node: GoPtr<HeritageClause>): void {
  const state = Printer_enterNode(receiver, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitToken(receiver, node!.Token, Node_Pos(NodeDefault_AsNode(node)), WriteKindKeyword, NodeDefault_AsNode(node));
  Printer_writeSpace(receiver);
  Printer_emitList(receiver, Printer_emitExpressionWithTypeArgumentsNode, NodeDefault_AsNode(node), node!.Types, LFHeritageClauseTypes);
  Printer_exitNode(receiver, NodeDefault_AsNode(node), state);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::method::Printer.emitHeritageClauseNode","kind":"method","status":"implemented","sigHash":"e2929d9080e903d496495ec57d68d9ddadc67c8242152722846f5aa02ad9da27","bodyHash":"a335a46a483a2acb8fa8a65b5220750444a623a2e5e9aef6392b1d2ddde919b7"}
 *
 * Go source:
 * func (p *Printer) emitHeritageClauseNode(node *ast.HeritageClauseNode) {
 * 	p.emitHeritageClause(node.AsHeritageClause())
 * }
 */
export function Printer_emitHeritageClauseNode(receiver: GoPtr<Printer>, node: GoPtr<HeritageClauseNode>): void {
  Printer_emitHeritageClause(receiver, AsHeritageClause(node as unknown as GoPtr<Node>));
}
