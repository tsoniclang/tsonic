import type { bool } from "../../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { Node, NodeList } from "../../ast/spine.js";
import { Node_Clone, Node_Name, NodeFactory_NewNodeList } from "../../ast/spine.js";
import type { GetAccessorDeclaration, QualifiedName, SetAccessorDeclaration, TypeReferenceNode } from "../../ast/generated/data.js";
import type { AccessorDeclaration, EntityName } from "../../ast/generated/unions.js";
import { AsConditionalExpression, AsConditionalTypeNode, AsBinaryExpression, AsIdentifier, AsIntersectionTypeNode, AsLiteralTypeNode, AsParameterDeclaration, AsQualifiedName, AsTypeOperatorNode, AsTypePredicateNode, AsTypeReferenceNode, AsUnionTypeNode, AsPrefixUnaryExpression } from "../../ast/generated/casts.js";
import { KindColonToken, KindGetAccessor, KindSetAccessor, KindClassDeclaration, KindClassExpression, KindMethodDeclaration, KindPropertyDeclaration, KindParameter, KindVoidKeyword, KindUndefinedKeyword, KindNeverKeyword, KindFunctionType, KindConstructorType, KindArrayType, KindTupleType, KindTypePredicate, KindBooleanKeyword, KindTemplateLiteralType, KindStringKeyword, KindObjectKeyword, KindLiteralType, KindNumberKeyword, KindBigIntKeyword, KindSymbolKeyword, KindTypeReference, KindIntersectionType, KindUnionType, KindConditionalType, KindTypeOperator, KindReadonlyKeyword, KindStringLiteral, KindNoSubstitutionTemplateLiteral, KindPrefixUnaryExpression, KindNumericLiteral, KindBigIntLiteral, KindTrueKeyword, KindFalseKeyword, KindNullKeyword, KindAnyKeyword, KindUnknownKeyword, KindIdentifier, KindJSDocNullableType, KindJSDocNonNullableType, KindJSDocOptionalType, KindQualifiedName, KindQuestionToken } from "../../ast/generated/kinds.js";
import { IsBinaryExpression, IsConditionalExpression, IsIdentifier, IsLiteralTypeNode, IsNumericLiteral, IsParenthesizedExpression, IsPropertyAccessExpression, IsStringLiteral, IsTypeOfExpression, IsVoidExpression } from "../../ast/generated/predicates.js";
import { GetAllAccessorDeclarations, GetFirstConstructorWithBody, GetRestParameterElementType, IsAsyncFunction, IsClassLike, IsFunctionLike, IsThisParameter, NodeIsPresent, SkipTypeParentheses } from "../../ast/utilities.js";
import { Node_Body, Node_Expression, Node_Members, Node_ParameterList, Node_Text, Node_Type } from "../../ast/ast.js";
import { EmitContext_AddVariableDeclaration, EmitContext_ParseNode, EmitContext_UnsetOriginal } from "../../printer/emitcontext.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import { TypeReferenceSerializationKindArrayLikeType, TypeReferenceSerializationKindBigIntLikeType, TypeReferenceSerializationKindBooleanType, TypeReferenceSerializationKindESSymbolType, TypeReferenceSerializationKindNumberLikeType, TypeReferenceSerializationKindObjectType, TypeReferenceSerializationKindPromise, TypeReferenceSerializationKindStringLikeType, TypeReferenceSerializationKindTypeWithCallSignature, TypeReferenceSerializationKindTypeWithConstructSignatureAndValue, TypeReferenceSerializationKindUnknown, TypeReferenceSerializationKindVoidNullableOrNeverType } from "../../printer/emitresolver.js";
import type { NodeFactory } from "../../printer/factory.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewLogicalANDExpression, NodeFactory_NewStrictInequalityExpression, NodeFactory_NewTempVariable, NodeFactory_NewTypeCheck, NodeFactory_NewVoidZeroExpression } from "../../printer/factory.js";
import { NewArrayLiteralExpression, NewConditionalExpression, NewIdentifier, NewPropertyAccessExpression, NewStringLiteral, NewToken, NewTypeOfExpression } from "../../ast/generated/factory.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { NodeFlagsNone } from "../../ast/generated/flags.js";
import { IsGeneratedIdentifier } from "../utilities.js";
import { ScriptTargetES2020 } from "../../core/compileroptions.js";
import type { ScriptTarget } from "../../core/compileroptions.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::type::metadataSerializer","kind":"type","status":"implemented","sigHash":"6b0daffe0469d09ea80639f2e02158cafe11021b60fa00adcef956655fdb4f9a","bodyHash":"22b1519fdeaf3cffc9fac77e5b92464bd60d3c11862b52fe6451e6bdc94fca3f"}
 *
 * Go source:
 * metadataSerializer struct {
 * 	resolver         printer.EmitResolver
 * 	languageVersion  core.ScriptTarget
 * 	strictNullChecks bool
 * 	f                *printer.NodeFactory
 * 	ec               *printer.EmitContext
 * 	c                metadataSerializerContext
 * }
 */
export interface metadataSerializer {
  resolver: EmitResolver;
  languageVersion: ScriptTarget;
  strictNullChecks: bool;
  f: GoPtr<NodeFactory>;
  ec: GoPtr<EmitContext>;
  c: metadataSerializerContext;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::type::metadataSerializerContext","kind":"type","status":"implemented","sigHash":"d2a536bed88192bfed33433fb4ab5825ec13b00af3b54d55863c6d87f2d332c3","bodyHash":"09df82f5055e40daeebb8f5b14c7daca1032351416b5e2a560fd59ae6ff69f7b"}
 *
 * Go source:
 * metadataSerializerContext struct {
 * 	currentLexicalScope              *ast.Node
 * 	currentNameScope                 *ast.Node
 * 	serializingConditionalTypeBranch bool
 * }
 */
export interface metadataSerializerContext {
  currentLexicalScope: GoPtr<Node>;
  currentNameScope: GoPtr<Node>;
  serializingConditionalTypeBranch: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::func::newMetadataSerializer","kind":"func","status":"implemented","sigHash":"1623ad25a4611f2988cc8c2512dd68bb399370378573ebfba9f13fca4ea5609d","bodyHash":"b86459ed01b8b1240952476f96637a85bba1960ad16ebc70db2cf65f6dbd6c6c"}
 *
 * Go source:
 * func newMetadataSerializer(resolver printer.EmitResolver, f *printer.NodeFactory, ec *printer.EmitContext, languageVersion core.ScriptTarget, strictNullChecks bool) *metadataSerializer {
 * 	return &metadataSerializer{resolver: resolver, languageVersion: languageVersion, f: f, ec: ec, strictNullChecks: strictNullChecks}
 * }
 */
export function newMetadataSerializer(resolver: EmitResolver, f: GoPtr<NodeFactory>, ec: GoPtr<EmitContext>, languageVersion: ScriptTarget, strictNullChecks: bool): GoPtr<metadataSerializer> {
  return {
    resolver: resolver,
    languageVersion: languageVersion,
    f: f,
    ec: ec,
    strictNullChecks: strictNullChecks,
    c: { currentLexicalScope: undefined, currentNameScope: undefined, serializingConditionalTypeBranch: false },
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.setContext","kind":"method","status":"implemented","sigHash":"951d144422c547683d80d46165725693e1ba3fbf96aa4b3b29464c371a1f43e8","bodyHash":"777b9c89b7c742486226fab54bdd98ee06fa9591bc585d59d01368ef044ed6e6"}
 *
 * Go source:
 * func (s *metadataSerializer) setContext(ctx metadataSerializerContext) {
 * 	s.c = ctx
 * }
 */
export function metadataSerializer_setContext(receiver: GoPtr<metadataSerializer>, ctx: metadataSerializerContext): void {
  receiver!.c = ctx;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.SerializeTypeOfNode","kind":"method","status":"implemented","sigHash":"e517aa9d2e3290c3f51db8e671ddcb866c3efcf2dc7b0dff53655dc36b22db3a","bodyHash":"f0ec5fcb76a9a58472400d6cd6d366d2e7e2621f27729dcda5d14c44d8f30a09"}
 *
 * Go source:
 * func (s *metadataSerializer) SerializeTypeOfNode(ctx metadataSerializerContext, node *ast.Node, container *ast.Node) *ast.Node {
 * 	oldCtx := s.c
 * 	s.c = ctx
 * 	defer s.setContext(oldCtx)
 * 	return s.serializeTypeOfNode(node, container)
 * }
 */
export function metadataSerializer_SerializeTypeOfNode(receiver: GoPtr<metadataSerializer>, ctx: metadataSerializerContext, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Node> {
  const oldCtx = receiver!.c;
  receiver!.c = ctx;
  try {
    return metadataSerializer_serializeTypeOfNode(receiver, node, container);
  } finally {
    metadataSerializer_setContext(receiver, oldCtx);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.SerializeParameterTypesOfNode","kind":"method","status":"implemented","sigHash":"fcdcf2989602e94f84aefb2dbe6f66e2594fea6498472796902563f23e075b6f","bodyHash":"42a38d5d65080c2750499065de4c8ce2b8f30e7bca3c5da5d9a0cd343af36739"}
 *
 * Go source:
 * func (s *metadataSerializer) SerializeParameterTypesOfNode(ctx metadataSerializerContext, node *ast.Node, container *ast.Node) *ast.Node {
 * 	oldCtx := s.c
 * 	s.c = ctx
 * 	defer s.setContext(oldCtx)
 * 	return s.serializeParameterTypesOfNode(node, container)
 * }
 */
export function metadataSerializer_SerializeParameterTypesOfNode(receiver: GoPtr<metadataSerializer>, ctx: metadataSerializerContext, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Node> {
  const oldCtx = receiver!.c;
  receiver!.c = ctx;
  try {
    return metadataSerializer_serializeParameterTypesOfNode(receiver, node, container);
  } finally {
    metadataSerializer_setContext(receiver, oldCtx);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.SerializeReturnTypeOfNode","kind":"method","status":"implemented","sigHash":"10eba6e97f7c8936e06b304abd9ea987b3de5811b6b8170cc078e1d0f88345f1","bodyHash":"d05d096c3db1e837718712a0c6716b2ffda248e6359ad7367359c27972c8bb01"}
 *
 * Go source:
 * func (s *metadataSerializer) SerializeReturnTypeOfNode(ctx metadataSerializerContext, node *ast.Node) *ast.Node {
 * 	oldCtx := s.c
 * 	s.c = ctx
 * 	defer s.setContext(oldCtx)
 * 	return s.serializeReturnTypeOfNode(node)
 * }
 */
export function metadataSerializer_SerializeReturnTypeOfNode(receiver: GoPtr<metadataSerializer>, ctx: metadataSerializerContext, node: GoPtr<Node>): GoPtr<Node> {
  const oldCtx = receiver!.c;
  receiver!.c = ctx;
  try {
    return metadataSerializer_serializeReturnTypeOfNode(receiver, node);
  } finally {
    metadataSerializer_setContext(receiver, oldCtx);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::func::GetSetAccessorValueParameter","kind":"func","status":"implemented","sigHash":"dfe35ad4df6e129cd8285ee76723a0a45a2613c8d9de60530374bbdb1f2390d7","bodyHash":"ffb1c0b717476fee2a7e9307c0175b5cd3dd461384bb082b8fecab849c62e51c"}
 *
 * Go source:
 * func GetSetAccessorValueParameter(node *ast.SetAccessorDeclaration) *ast.Node {
 * 	if node != nil && len(node.Parameters.Nodes) > 0 {
 * 		if len(node.Parameters.Nodes) >= 2 && ast.IsThisParameter(node.Parameters.Nodes[0]) {
 * 			return node.Parameters.Nodes[1]
 * 		}
 * 		return node.Parameters.Nodes[0]
 * 	}
 * 	return nil
 * }
 */
export function GetSetAccessorValueParameter(node: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  if (node !== undefined && node!.Parameters !== undefined && node!.Parameters!.Nodes.length > 0) {
    if (node!.Parameters!.Nodes.length >= 2 && IsThisParameter(node!.Parameters!.Nodes[0])) {
      return node!.Parameters!.Nodes[1];
    }
    return node!.Parameters!.Nodes[0];
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::func::getSetAccessorTypeAnnotationNode","kind":"func","status":"implemented","sigHash":"902ce01c43de69833b32b1ede652a733cca36e54d54ef5fedc8779587de4e3a8","bodyHash":"4fda25ba2ee58b42b85075dd7e91f6608f01bb80727f7e44f74e5c2f5b2dc94f"}
 *
 * Go source:
 * func getSetAccessorTypeAnnotationNode(node *ast.SetAccessorDeclaration) *ast.Node {
 * 	p := GetSetAccessorValueParameter(node)
 * 	if p != nil && p.Type() != nil {
 * 		return p.Type()
 * 	}
 * 	return nil
 * }
 */
export function getSetAccessorTypeAnnotationNode(node: GoPtr<SetAccessorDeclaration>): GoPtr<Node> {
  const p = GetSetAccessorValueParameter(node);
  if (p !== undefined && Node_Type(p) !== undefined) {
    return Node_Type(p);
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::func::getAccessorTypeNode","kind":"func","status":"implemented","sigHash":"d9980bda4630669f3b4fefdbc5bdc35f64c32d3f941dcea0e9d82a94ce780a71","bodyHash":"4107cbcc4e0a36e938e861b9a1603c02d0bd9a16c33fb91752509d7b06a009e6"}
 *
 * Go source:
 * func getAccessorTypeNode(node *ast.Node, container *ast.Node) *ast.Node {
 * 	accessors := ast.GetAllAccessorDeclarations(container.Members(), node)
 * 	if accessors.SetAccessor != nil {
 * 		return getSetAccessorTypeAnnotationNode(accessors.SetAccessor)
 * 	}
 * 	if accessors.GetAccessor != nil {
 * 		return accessors.GetAccessor.Type
 * 	}
 * 	return nil
 * }
 */
export function getAccessorTypeNode(node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Node> {
  const members = Node_Members(container) ?? [];
  const accessors = GetAllAccessorDeclarations(members, node as GoPtr<AccessorDeclaration>);
  if (accessors.SetAccessor !== undefined) {
    return getSetAccessorTypeAnnotationNode(accessors.SetAccessor);
  }
  if (accessors.GetAccessor !== undefined) {
    return (accessors.GetAccessor as GoPtr<GetAccessorDeclaration>)!.Type;
  }
  return undefined;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeTypeOfNode","kind":"method","status":"implemented","sigHash":"a9da4300d57708d34ae7b10e600f50cdcc2a33415fcfe5b31d50aeb9eb6078e0","bodyHash":"d3fd51c107ca901cad3dc98edda9989cb39231da8de0973fe1d9f2dee959583b"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeTypeOfNode(node *ast.Node, container *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindPropertyDeclaration, ast.KindParameter:
 * 		return s.serializeTypeNode(node.Type())
 * 	case ast.KindGetAccessor, ast.KindSetAccessor:
 * 		return s.serializeTypeNode(getAccessorTypeNode(node, container))
 * 	case ast.KindClassDeclaration, ast.KindClassExpression, ast.KindMethodDeclaration:
 * 		return s.f.NewIdentifier("Function")
 * 	default:
 * 		return s.f.NewVoidZeroExpression()
 * 	}
 * }
 */
export function metadataSerializer_serializeTypeOfNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  switch (node!.Kind) {
    case KindPropertyDeclaration:
    case KindParameter:
      return metadataSerializer_serializeTypeNode(receiver, Node_Type(node));
    case KindGetAccessor:
    case KindSetAccessor:
      return metadataSerializer_serializeTypeNode(receiver, getAccessorTypeNode(node, container));
    case KindClassDeclaration:
    case KindClassExpression:
    case KindMethodDeclaration:
      return NewIdentifier(f, "Function");
    default:
      return NodeFactory_NewVoidZeroExpression(receiver!.f);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeParameterTypesOfNode","kind":"method","status":"implemented","sigHash":"3c7eb5e0d7fe5116e01036774773cdad65b99057fd722c2d6ade5906429630bc","bodyHash":"d48a77e8020a861e1bb299acff81f65f0dc1ba1fdd668619c79f5f8921f74ab1"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeParameterTypesOfNode(node *ast.Node, container *ast.Node) *ast.Node {
 * 	var valueDeclaration *ast.Node
 * 	if ast.IsClassLike(node) {
 * 		valueDeclaration = ast.GetFirstConstructorWithBody(node)
 * 	} else if ast.IsFunctionLike(node) && ast.NodeIsPresent(node.Body()) {
 * 		valueDeclaration = node
 * 	}
 *
 * 	if valueDeclaration == nil {
 * 		return s.f.NewArrayLiteralExpression(s.f.NewNodeList([]*ast.Node{}), false)
 * 	}
 *
 * 	var expressions []*ast.Node
 * 	parameters := getParametersOfDecoratedDeclaration(valueDeclaration, container)
 * 	for i, parameter := range parameters.Nodes {
 * 		if i == 0 && ast.IsIdentifier(parameter.Name()) && parameter.Name().Text() == "this" {
 * 			continue
 * 		}
 * 		if parameter.AsParameterDeclaration().DotDotDotToken != nil {
 * 			expressions = append(expressions, s.serializeTypeNode(ast.GetRestParameterElementType(parameter.Type())))
 * 		} else {
 * 			expressions = append(expressions, s.serializeTypeOfNode(parameter, container))
 * 		}
 * 	}
 * 	return s.f.NewArrayLiteralExpression(s.f.NewNodeList(expressions), false)
 * }
 */
export function metadataSerializer_serializeParameterTypesOfNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  const valueDeclaration: GoPtr<Node> = IsClassLike(node) ? GetFirstConstructorWithBody(node) :
    (IsFunctionLike(node) && NodeIsPresent(Node_Body(node)) ? node : undefined);

  if (valueDeclaration === undefined) {
    return NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, []), false);
  }

  const parameters = getParametersOfDecoratedDeclaration(valueDeclaration, container);
  const nodes = parameters !== undefined ? parameters!.Nodes : [];
  const expressions: GoPtr<Node>[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const parameter = nodes[i];
    if (i === 0 && IsIdentifier(Node_Name(parameter) as GoPtr<Node>) && Node_Text(Node_Name(parameter) as GoPtr<Node>) === "this") {
      continue;
    }
    if (AsParameterDeclaration(parameter)!.DotDotDotToken !== undefined) {
      expressions.push(metadataSerializer_serializeTypeNode(receiver, GetRestParameterElementType(Node_Type(parameter))));
    } else {
      expressions.push(metadataSerializer_serializeTypeOfNode(receiver, parameter, container));
    }
  }
  return NewArrayLiteralExpression(f, NodeFactory_NewNodeList(f, expressions), false);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::func::getParametersOfDecoratedDeclaration","kind":"func","status":"implemented","sigHash":"773aa739bb81e64c12d4ae9c9fe2f25e431f9923170783db3d74d54dda812f8e","bodyHash":"6293050b0501b9ec9f9d01a41480bb0c64c46ac69ac2347e346d85a7c6b070cc"}
 *
 * Go source:
 * func getParametersOfDecoratedDeclaration(node *ast.Node, container *ast.Node) *ast.NodeList {
 * 	if container != nil && node.Kind == ast.KindGetAccessor {
 * 		acc := ast.GetAllAccessorDeclarations(container.Members(), node)
 * 		if acc.SetAccessor != nil {
 * 			return acc.SetAccessor.Parameters
 * 		}
 * 	}
 * 	return node.ParameterList()
 * }
 */
export function getParametersOfDecoratedDeclaration(node: GoPtr<Node>, container: GoPtr<Node>): GoPtr<NodeList> {
  if (container !== undefined && node!.Kind === KindGetAccessor) {
    const members = Node_Members(container) ?? [];
    const acc = GetAllAccessorDeclarations(members, node as GoPtr<AccessorDeclaration>);
    if (acc.SetAccessor !== undefined) {
      return acc.SetAccessor!.Parameters as GoPtr<NodeList>;
    }
  }
  return Node_ParameterList(node) as GoPtr<NodeList>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeReturnTypeOfNode","kind":"method","status":"implemented","sigHash":"3920d40183f603ac630d51fcffc89ee52682efd32aeeb490fbc88e10daf7a6f5","bodyHash":"e783c3e1070639998b7d11353675c4be1240b72f49ca5ed933a622c5ff930cfa"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeReturnTypeOfNode(node *ast.Node) *ast.Node {
 * 	if ast.IsFunctionLike(node) && node.Type() != nil {
 * 		return s.serializeTypeNode(node.Type())
 * 	} else if ast.IsAsyncFunction(node) {
 * 		return s.f.NewIdentifier("Promise")
 * 	}
 * 	return s.f.NewVoidZeroExpression()
 * }
 */
export function metadataSerializer_serializeReturnTypeOfNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  if (IsFunctionLike(node) && Node_Type(node) !== undefined) {
    return metadataSerializer_serializeTypeNode(receiver, Node_Type(node));
  } else if (IsAsyncFunction(node)) {
    return NewIdentifier(f, "Promise");
  }
  return NodeFactory_NewVoidZeroExpression(receiver!.f);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeTypeNode","kind":"method","status":"implemented","sigHash":"c22b8edb90b5263f00b3659b79bcf14b1b2f56d7b1b555ed795f5f40e0a434f1","bodyHash":"39e187f88eb247eafc6484c972a9eccea367fec103a04781085d78dcda52660e"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeTypeNode(node *ast.Node) *ast.Node {
 * 	if node == nil {
 * 		return s.f.NewIdentifier("Object")
 * 	}
 *
 * 	node = ast.SkipTypeParentheses(node)
 *
 * 	switch node.Kind {
 * 	case ast.KindVoidKeyword, ast.KindUndefinedKeyword, ast.KindNeverKeyword:
 * 		return s.f.NewVoidZeroExpression()
 * 	case ast.KindFunctionType, ast.KindConstructorType:
 * 		return s.f.NewIdentifier("Function")
 * 	case ast.KindArrayType, ast.KindTupleType:
 * 		return s.f.NewIdentifier("Array")
 * 	case ast.KindTypePredicate:
 * 		if node.AsTypePredicateNode().AssertsModifier != nil {
 * 			return s.f.NewVoidZeroExpression()
 * 		}
 * 		return s.f.NewIdentifier("Boolean")
 * 	case ast.KindBooleanKeyword:
 * 		return s.f.NewIdentifier("Boolean")
 * 	case ast.KindTemplateLiteralType, ast.KindStringKeyword:
 * 		return s.f.NewIdentifier("String")
 * 	case ast.KindObjectKeyword:
 * 		return s.f.NewIdentifier("Object")
 * 	case ast.KindLiteralType:
 * 		return s.serializeLiteralOfLiteralTypeNode(node.AsLiteralTypeNode().Literal)
 * 	case ast.KindNumberKeyword:
 * 		return s.f.NewIdentifier("Number")
 * 	case ast.KindBigIntKeyword:
 * 		return s.serializeBigIntConstructor()
 * 	case ast.KindSymbolKeyword:
 * 		return s.f.NewIdentifier("Symbol")
 * 	case ast.KindTypeReference:
 * 		return s.serializeTypeReferenceNode(node.AsTypeReferenceNode())
 * 	case ast.KindIntersectionType:
 * 		return s.serializeUnionOrIntersectionConstituents(node.AsIntersectionTypeNode().Types.Nodes, true)
 * 	case ast.KindUnionType:
 * 		return s.serializeUnionOrIntersectionConstituents(node.AsUnionTypeNode().Types.Nodes, false)
 * 	case ast.KindConditionalType:
 * 		oldState := s.c.serializingConditionalTypeBranch
 * 		s.c.serializingConditionalTypeBranch = true
 * 		defer func() { s.c.serializingConditionalTypeBranch = oldState }()
 * 		return s.serializeUnionOrIntersectionConstituents([]*ast.Node{node.AsConditionalTypeNode().TrueType, node.AsConditionalTypeNode().FalseType}, false)
 * 	case ast.KindTypeOperator:
 * 		if node.AsTypeOperatorNode().Operator == ast.KindReadonlyKeyword {
 * 			return s.serializeTypeNode(node.Type())
 * 		}
 * 		// TODO: why is `unique symbol` not handled as `Symbol`? This falls back to `Object`
 * 	case ast.KindTypeQuery, ast.KindIndexedAccessType, ast.KindMappedType, ast.KindTypeLiteral, ast.KindAnyKeyword, ast.KindUnknownKeyword, ast.KindThisType, ast.KindImportType:
 * 		break
 *
 * 	// handle JSDoc types from an invalid parse
 * 	case ast.KindJSDocAllType, ast.KindJSDocVariadicType:
 * 		break
 * 	case ast.KindJSDocNullableType, ast.KindJSDocNonNullableType, ast.KindJSDocOptionalType:
 * 		return s.serializeTypeNode(node.Type())
 * 	default:
 * 		debug.FailBadSyntaxKind(node)
 * 		return nil
 * 	}
 * 	return s.f.NewIdentifier("Object")
 * }
 */
export function metadataSerializer_serializeTypeNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  if (node === undefined) {
    return NewIdentifier(f, "Object");
  }

  const skipped = SkipTypeParentheses(node)!;

  switch (skipped.Kind) {
    case KindVoidKeyword:
    case KindUndefinedKeyword:
    case KindNeverKeyword:
      return NodeFactory_NewVoidZeroExpression(receiver!.f);
    case KindFunctionType:
    case KindConstructorType:
      return NewIdentifier(f, "Function");
    case KindArrayType:
    case KindTupleType:
      return NewIdentifier(f, "Array");
    case KindTypePredicate:
      if (AsTypePredicateNode(skipped)!.AssertsModifier !== undefined) {
        return NodeFactory_NewVoidZeroExpression(receiver!.f);
      }
      return NewIdentifier(f, "Boolean");
    case KindBooleanKeyword:
      return NewIdentifier(f, "Boolean");
    case KindTemplateLiteralType:
    case KindStringKeyword:
      return NewIdentifier(f, "String");
    case KindObjectKeyword:
      return NewIdentifier(f, "Object");
    case KindLiteralType:
      return metadataSerializer_serializeLiteralOfLiteralTypeNode(receiver, AsLiteralTypeNode(skipped)!.Literal);
    case KindNumberKeyword:
      return NewIdentifier(f, "Number");
    case KindBigIntKeyword:
      return metadataSerializer_serializeBigIntConstructor(receiver);
    case KindSymbolKeyword:
      return NewIdentifier(f, "Symbol");
    case KindTypeReference:
      return metadataSerializer_serializeTypeReferenceNode(receiver, AsTypeReferenceNode(skipped));
    case KindIntersectionType:
      return metadataSerializer_serializeUnionOrIntersectionConstituents(receiver, AsIntersectionTypeNode(skipped)!.Types!.Nodes, true);
    case KindUnionType:
      return metadataSerializer_serializeUnionOrIntersectionConstituents(receiver, AsUnionTypeNode(skipped)!.Types!.Nodes, false);
    case KindConditionalType: {
      const oldState = receiver!.c.serializingConditionalTypeBranch;
      receiver!.c.serializingConditionalTypeBranch = true;
      try {
        return metadataSerializer_serializeUnionOrIntersectionConstituents(
          receiver,
          [AsConditionalTypeNode(skipped)!.TrueType, AsConditionalTypeNode(skipped)!.FalseType],
          false,
        );
      } finally {
        receiver!.c.serializingConditionalTypeBranch = oldState;
      }
    }
    case KindTypeOperator:
      if (AsTypeOperatorNode(skipped)!.Operator === KindReadonlyKeyword) {
        return metadataSerializer_serializeTypeNode(receiver, Node_Type(skipped));
      }
      // TODO: unique symbol falls through to Object
      break;
    // handle JSDoc types from an invalid parse
    case KindJSDocNullableType:
    case KindJSDocNonNullableType:
    case KindJSDocOptionalType:
      return metadataSerializer_serializeTypeNode(receiver, Node_Type(skipped));
    // These all fall through to "Object"
    // KindTypeQuery, KindIndexedAccessType, KindMappedType, KindTypeLiteral,
    // KindAnyKeyword, KindUnknownKeyword, KindThisType, KindImportType,
    // KindJSDocAllType, KindJSDocVariadicType — no break needed in TS (fall through)
    default:
      break;
  }
  return NewIdentifier(f, "Object");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeUnionOrIntersectionConstituents","kind":"method","status":"implemented","sigHash":"6d66fa056fef90ef201744676bcc1f8e8929dee813d24152c81031991741291f","bodyHash":"a4d77f8b07ccde0002b039c2444aa55d421e36d5feeec1c772efa4fa67b58a00"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeUnionOrIntersectionConstituents(types []*ast.Node, isIntersection bool) *ast.Node {
 * 	// Note when updating logic here also update `getEntityNameForDecoratorMetadata` in checker.ts so that aliases can be marked as referenced
 * 	var serializedType *ast.Node
 * 	for _, typeNode := range types {
 * 		typeNode = ast.SkipTypeParentheses(typeNode)
 * 		if typeNode.Kind == ast.KindNeverKeyword {
 * 			if isIntersection {
 * 				return s.f.NewVoidZeroExpression() // Reduce to `never` in an intersection
 * 			}
 * 			continue // Elide `never` in a union
 * 		}
 *
 * 		if typeNode.Kind == ast.KindUnknownKeyword {
 * 			if !isIntersection {
 * 				return s.f.NewIdentifier("Object") // Reduce to `unknown` in a union
 * 			}
 * 			continue // Elide `unknown` in an intersection
 * 		}
 *
 * 		if typeNode.Kind == ast.KindAnyKeyword {
 * 			return s.f.NewIdentifier("Object") // Reduce to `any` in a union or intersection
 * 		}
 *
 * 		if !s.strictNullChecks && ((ast.IsLiteralTypeNode(typeNode) && typeNode.AsLiteralTypeNode().Literal.Kind == ast.KindNullKeyword) || typeNode.Kind == ast.KindUndefinedKeyword) {
 * 			continue // Elide null and undefined from unions for metadata, just like what we did prior to the implementation of strict null checks
 * 		}
 *
 * 		serializedConstituent := s.serializeTypeNode(typeNode)
 * 		if ast.IsIdentifier(serializedConstituent) && serializedConstituent.AsIdentifier().Text == "Object" {
 * 			// One of the individual is global object, return immediately
 * 			return serializedConstituent
 * 		}
 *
 * 		// If there exists union that is not `void 0` expression, check if the the common type is identifier.
 * 		// anything more complex and we will just default to Object
 * 		if serializedType != nil {
 * 			// Different types
 * 			if !s.equateSerializedTypeNodes(serializedType, serializedConstituent) {
 * 				return s.f.NewIdentifier("Object")
 * 			}
 * 		} else {
 * 			// Initialize the union type
 * 			serializedType = serializedConstituent
 * 		}
 * 	}
 *
 * 	// If we were able to find common type, use it
 * 	if serializedType != nil {
 * 		return serializedType
 * 	}
 * 	return s.f.NewVoidZeroExpression() // Fallback is only hit if all union constituents are null/undefined/never
 * }
 */
export function metadataSerializer_serializeUnionOrIntersectionConstituents(receiver: GoPtr<metadataSerializer>, types: GoSlice<GoPtr<Node>>, isIntersection: bool): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  let serializedType: GoPtr<Node> = undefined;
  for (const rawTypeNode of types) {
    const typeNode = SkipTypeParentheses(rawTypeNode)!;
    if (typeNode.Kind === KindNeverKeyword) {
      if (isIntersection) {
        return NodeFactory_NewVoidZeroExpression(receiver!.f);
      }
      continue;
    }
    if (typeNode.Kind === KindUnknownKeyword) {
      if (!isIntersection) {
        return NewIdentifier(f, "Object");
      }
      continue;
    }
    if (typeNode.Kind === KindAnyKeyword) {
      return NewIdentifier(f, "Object");
    }
    if (!receiver!.strictNullChecks &&
        ((IsLiteralTypeNode(typeNode) && AsLiteralTypeNode(typeNode)!.Literal!.Kind === KindNullKeyword) ||
          typeNode.Kind === KindUndefinedKeyword)) {
      continue;
    }
    const serializedConstituent = metadataSerializer_serializeTypeNode(receiver, typeNode);
    if (IsIdentifier(serializedConstituent) && AsIdentifier(serializedConstituent)!.Text === "Object") {
      return serializedConstituent;
    }
    if (serializedType !== undefined) {
      if (!metadataSerializer_equateSerializedTypeNodes(receiver, serializedType, serializedConstituent)) {
        return NewIdentifier(f, "Object");
      }
    } else {
      serializedType = serializedConstituent;
    }
  }
  if (serializedType !== undefined) {
    return serializedType;
  }
  return NodeFactory_NewVoidZeroExpression(receiver!.f);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeLiteralOfLiteralTypeNode","kind":"method","status":"implemented","sigHash":"70d8898e0b74470f5c4bf671ac8db34e678e1ffa75d91c0199fb9cf98779ab4c","bodyHash":"7633951f1137093fffeab32026937132d948204bf0d050fae09702d6e6586daf"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeLiteralOfLiteralTypeNode(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral:
 * 		return s.f.NewIdentifier("String")
 * 	case ast.KindPrefixUnaryExpression:
 * 		operand := node.AsPrefixUnaryExpression().Operand
 * 		switch operand.Kind {
 * 		case ast.KindNumericLiteral, ast.KindBigIntLiteral:
 * 			return s.serializeLiteralOfLiteralTypeNode(operand)
 * 		default:
 * 			debug.FailBadSyntaxKind(operand)
 * 		}
 * 	case ast.KindNumericLiteral:
 * 		return s.f.NewIdentifier("Number")
 * 	case ast.KindBigIntLiteral:
 * 		return s.serializeBigIntConstructor()
 * 	case ast.KindTrueKeyword, ast.KindFalseKeyword:
 * 		return s.f.NewIdentifier("Boolean")
 * 	case ast.KindNullKeyword:
 * 		return s.f.NewVoidZeroExpression()
 * 	default:
 * 		debug.FailBadSyntaxKind(node)
 * 		return nil
 * 	}
 * 	return nil
 * }
 */
export function metadataSerializer_serializeLiteralOfLiteralTypeNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  switch (node!.Kind) {
    case KindStringLiteral:
    case KindNoSubstitutionTemplateLiteral:
      return NewIdentifier(f, "String");
    case KindPrefixUnaryExpression: {
      const operand = AsPrefixUnaryExpression(node)!.Operand;
      if (operand!.Kind === KindNumericLiteral || operand!.Kind === KindBigIntLiteral) {
        return metadataSerializer_serializeLiteralOfLiteralTypeNode(receiver, operand);
      }
      // debug.FailBadSyntaxKind — fall through to undefined
      return undefined;
    }
    case KindNumericLiteral:
      return NewIdentifier(f, "Number");
    case KindBigIntLiteral:
      return metadataSerializer_serializeBigIntConstructor(receiver);
    case KindTrueKeyword:
    case KindFalseKeyword:
      return NewIdentifier(f, "Boolean");
    case KindNullKeyword:
      return NodeFactory_NewVoidZeroExpression(receiver!.f);
    default:
      // debug.FailBadSyntaxKind
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeTypeReferenceNode","kind":"method","status":"implemented","sigHash":"c462fbc54457bd998dee59b12cbbce58758ef2a0b8701bfc80367ed3b855bbf2","bodyHash":"d93c22195a83f998f7b6ac2714e929bca4aaf36ace2200715a1cc5dd6b048e6c"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeTypeReferenceNode(node *ast.TypeReferenceNode) *ast.Node {
 * 	serialScope := s.c.currentNameScope
 * 	if serialScope == nil {
 * 		serialScope = s.c.currentLexicalScope
 * 	}
 * 	kind := s.resolver.GetTypeReferenceSerializationKind(s.ec.ParseNode(node.TypeName), s.ec.ParseNode(serialScope))
 * 	switch kind {
 * 	case printer.TypeReferenceSerializationKindUnknown:
 * 		// From conditional type type reference that cannot be resolved is Similar to any or unknown
 * 		if s.c.serializingConditionalTypeBranch {
 * 			return s.f.NewIdentifier("Object")
 * 		}
 *
 * 		serialized := s.serializeEntityNameAsExpressionFallback(node.TypeName)
 * 		temp := s.f.NewTempVariable()
 * 		s.ec.AddVariableDeclaration(temp)
 * 		return s.f.NewConditionalExpression(
 * 			s.f.NewTypeCheck(s.f.NewAssignmentExpression(temp, serialized), "function"),
 * 			s.f.NewToken(ast.KindQuestionToken),
 * 			temp,
 * 			s.f.NewToken(ast.KindColonToken),
 * 			s.f.NewIdentifier("Object"),
 * 		)
 *
 * 	case printer.TypeReferenceSerializationKindTypeWithConstructSignatureAndValue:
 * 		return s.serializeEntityNameAsExpression(node.TypeName)
 *
 * 	case printer.TypeReferenceSerializationKindVoidNullableOrNeverType:
 * 		return s.f.NewVoidZeroExpression()
 *
 * 	case printer.TypeReferenceSerializationKindBigIntLikeType:
 * 		return s.serializeBigIntConstructor()
 *
 * 	case printer.TypeReferenceSerializationKindBooleanType:
 * 		return s.f.NewIdentifier("Boolean")
 *
 * 	case printer.TypeReferenceSerializationKindNumberLikeType:
 * 		return s.f.NewIdentifier("Number")
 *
 * 	case printer.TypeReferenceSerializationKindStringLikeType:
 * 		return s.f.NewIdentifier("String")
 *
 * 	case printer.TypeReferenceSerializationKindArrayLikeType:
 * 		return s.f.NewIdentifier("Array")
 *
 * 	case printer.TypeReferenceSerializationKindESSymbolType:
 * 		return s.f.NewIdentifier("Symbol")
 *
 * 	case printer.TypeReferenceSerializationKindTypeWithCallSignature:
 * 		return s.f.NewIdentifier("Function")
 *
 * 	case printer.TypeReferenceSerializationKindPromise:
 * 		return s.f.NewIdentifier("Promise")
 *
 * 	case printer.TypeReferenceSerializationKindObjectType:
 * 		return s.f.NewIdentifier("Object")
 * 	default:
 * 		debug.AssertNever(kind, "unknown type reference serialization kind")
 * 		return nil
 * 	}
 * }
 */
export function metadataSerializer_serializeTypeReferenceNode(receiver: GoPtr<metadataSerializer>, node: GoPtr<TypeReferenceNode>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  const serialScope = receiver!.c.currentNameScope !== undefined ? receiver!.c.currentNameScope : receiver!.c.currentLexicalScope;
  const kind = receiver!.resolver.GetTypeReferenceSerializationKind(
    EmitContext_ParseNode(receiver!.ec, node!.TypeName as GoPtr<Node>),
    EmitContext_ParseNode(receiver!.ec, serialScope),
  );
  switch (kind) {
    case TypeReferenceSerializationKindUnknown: {
      if (receiver!.c.serializingConditionalTypeBranch) {
        return NewIdentifier(f, "Object");
      }
      const serialized = metadataSerializer_serializeEntityNameAsExpressionFallback(receiver, node!.TypeName);
      const temp = NodeFactory_NewTempVariable(receiver!.f);
      EmitContext_AddVariableDeclaration(receiver!.ec, temp);
      return NewConditionalExpression(
        f,
        NodeFactory_NewTypeCheck(receiver!.f, NodeFactory_NewAssignmentExpression(receiver!.f, temp, serialized), "function"),
        NewToken(f, KindQuestionToken),
        temp,
        NewToken(f, KindColonToken),
        NewIdentifier(f, "Object"),
      );
    }
    case TypeReferenceSerializationKindTypeWithConstructSignatureAndValue:
      return metadataSerializer_serializeEntityNameAsExpression(receiver, node!.TypeName);
    case TypeReferenceSerializationKindVoidNullableOrNeverType:
      return NodeFactory_NewVoidZeroExpression(receiver!.f);
    case TypeReferenceSerializationKindBigIntLikeType:
      return metadataSerializer_serializeBigIntConstructor(receiver);
    case TypeReferenceSerializationKindBooleanType:
      return NewIdentifier(f, "Boolean");
    case TypeReferenceSerializationKindNumberLikeType:
      return NewIdentifier(f, "Number");
    case TypeReferenceSerializationKindStringLikeType:
      return NewIdentifier(f, "String");
    case TypeReferenceSerializationKindArrayLikeType:
      return NewIdentifier(f, "Array");
    case TypeReferenceSerializationKindESSymbolType:
      return NewIdentifier(f, "Symbol");
    case TypeReferenceSerializationKindTypeWithCallSignature:
      return NewIdentifier(f, "Function");
    case TypeReferenceSerializationKindPromise:
      return NewIdentifier(f, "Promise");
    case TypeReferenceSerializationKindObjectType:
      return NewIdentifier(f, "Object");
    default:
      // debug.AssertNever
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeBigIntConstructor","kind":"method","status":"implemented","sigHash":"b2e52aabc39a773f69bc8fdc42eecf0cb51accad8e63dcf48e6fb2d43cc81ba6","bodyHash":"4ad20a337c00742026988871df4ba5a4c44a854e36c702c867d4725f23c15e2e"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeBigIntConstructor() *ast.Node {
 * 	if s.languageVersion >= core.ScriptTargetES2020 {
 * 		return s.f.NewIdentifier("BigInt")
 * 	}
 * 	return s.f.NewConditionalExpression(
 * 		s.f.NewTypeCheck(s.f.NewIdentifier("BigInt"), "function"),
 * 		s.f.NewToken(ast.KindQuestionToken),
 * 		s.f.NewIdentifier("BigInt"),
 * 		s.f.NewToken(ast.KindColonToken),
 * 		s.f.NewIdentifier("Object"),
 * 	)
 * }
 */
export function metadataSerializer_serializeBigIntConstructor(receiver: GoPtr<metadataSerializer>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  if (receiver!.languageVersion >= ScriptTargetES2020) {
    return NewIdentifier(f, "BigInt");
  }
  return NewConditionalExpression(
    f,
    NodeFactory_NewTypeCheck(receiver!.f, NewIdentifier(f, "BigInt"), "function"),
    NewToken(f, KindQuestionToken),
    NewIdentifier(f, "BigInt"),
    NewToken(f, KindColonToken),
    NewIdentifier(f, "Object"),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeEntityNameAsExpression","kind":"method","status":"implemented","sigHash":"68b5ec73d0aecd6bc13296de9c2eaf01e4ad0dac7a15636ef8e55418e44d9fff","bodyHash":"22b016ea57819ceee31bcc6f355cb11cf2e24582f0971611fd93928e24bb60dc"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeEntityNameAsExpression(node *ast.EntityName) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindIdentifier:
 * 		// Create a clone of the name with a new parent, and treat it as if it were
 * 		// a source tree node for the purposes of the checker.
 * 		name := node.Clone(s.f)
 * 		name.Loc = node.Loc
 * 		s.ec.UnsetOriginal(name)                              // make this identifier emulate a parse node, making it behave correctly when inspected by the module transforms
 * 		name.Parent = s.ec.ParseNode(s.c.currentLexicalScope) //nolint:customlint // ensure the parent is set to a parse tree node.
 * 		return name
 * 	case ast.KindQualifiedName:
 * 		return s.serializeQualifiedNameAsExpression(node.AsQualifiedName())
 * 	}
 * 	return nil
 * }
 */
export function metadataSerializer_serializeEntityNameAsExpression(receiver: GoPtr<metadataSerializer>, node: GoPtr<EntityName>): GoPtr<Node> {
  switch ((node as GoPtr<Node>)!.Kind) {
    case KindIdentifier: {
      const f = receiver!.f!.__tsgoEmbedded0!;
      const coercible = { AsNodeFactory: (): typeof f => f };
      const name = Node_Clone(node as GoPtr<Node>, coercible)!;
      name.Loc = (node as GoPtr<Node>)!.Loc;
      EmitContext_UnsetOriginal(receiver!.ec, name);
      name.Parent = EmitContext_ParseNode(receiver!.ec, receiver!.c.currentLexicalScope);
      return name;
    }
    case KindQualifiedName:
      return metadataSerializer_serializeQualifiedNameAsExpression(receiver, AsQualifiedName(node as GoPtr<Node>));
    default:
      return undefined;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeQualifiedNameAsExpression","kind":"method","status":"implemented","sigHash":"b5695722ad1600583c3a200f69122ce76592a659d5c2894b80e5428ca24cc83b","bodyHash":"cfa4634fcee7199d734799824f323e8e179b5166186a03993688306c420ca198"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeQualifiedNameAsExpression(node *ast.QualifiedName) *ast.Node {
 * 	return s.f.NewPropertyAccessExpression(s.serializeEntityNameAsExpression(node.Left), nil, node.Right, ast.NodeFlagsNone)
 * }
 */
export function metadataSerializer_serializeQualifiedNameAsExpression(receiver: GoPtr<metadataSerializer>, node: GoPtr<QualifiedName>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  return NewPropertyAccessExpression(
    f,
    metadataSerializer_serializeEntityNameAsExpression(receiver, node!.Left),
    undefined,
    node!.Right,
    NodeFlagsNone,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.serializeEntityNameAsExpressionFallback","kind":"method","status":"implemented","sigHash":"ce1eda31313239045f0f2b397895bad3a38e89c803463dff40a2d70b56350c6b","bodyHash":"e0c83e757623183c7b9411c63104056d741e00ede07b5565a578ddc278dd9a41"}
 *
 * Go source:
 * func (s *metadataSerializer) serializeEntityNameAsExpressionFallback(node *ast.EntityName) *ast.Node {
 * 	if node.Kind == ast.KindIdentifier {
 * 		// A -> typeof A !== "undefined" && A
 * 		copied := s.serializeEntityNameAsExpression(node)
 * 		return s.createCheckedValue(copied, copied)
 * 	}
 * 	if node.AsQualifiedName().Left.Kind == ast.KindIdentifier {
 * 		// A.B -> typeof A !== "undefined" && A.B
 * 		return s.createCheckedValue(s.serializeEntityNameAsExpression(node.AsQualifiedName().Left), s.serializeEntityNameAsExpression(node))
 * 	}
 * 	// A.B.C -> typeof A !== "undefined" && (_a = A.B) !== void 0 && _a.C
 * 	left := s.serializeEntityNameAsExpressionFallback(node.AsQualifiedName().Left)
 * 	temp := s.f.NewTempVariable()
 * 	s.ec.AddVariableDeclaration(temp)
 * 	return s.f.NewLogicalANDExpression(
 * 		s.f.NewLogicalANDExpression(
 * 			left.AsBinaryExpression().Left,
 * 			s.f.NewStrictInequalityExpression(s.f.NewAssignmentExpression(temp, left.AsBinaryExpression().Right), s.f.NewVoidZeroExpression()),
 * 		),
 * 		s.f.NewPropertyAccessExpression(temp, nil, node.AsQualifiedName().Right, ast.NodeFlagsNone),
 * 	)
 * }
 */
export function metadataSerializer_serializeEntityNameAsExpressionFallback(receiver: GoPtr<metadataSerializer>, node: GoPtr<EntityName>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  if ((node as GoPtr<Node>)!.Kind === KindIdentifier) {
    const copied = metadataSerializer_serializeEntityNameAsExpression(receiver, node);
    return metadataSerializer_createCheckedValue(receiver, copied, copied);
  }
  if (AsQualifiedName(node as GoPtr<Node>)!.Left!.Kind === KindIdentifier) {
    return metadataSerializer_createCheckedValue(
      receiver,
      metadataSerializer_serializeEntityNameAsExpression(receiver, AsQualifiedName(node as GoPtr<Node>)!.Left),
      metadataSerializer_serializeEntityNameAsExpression(receiver, node),
    );
  }
  const left = metadataSerializer_serializeEntityNameAsExpressionFallback(receiver, AsQualifiedName(node as GoPtr<Node>)!.Left);
  const temp = NodeFactory_NewTempVariable(receiver!.f);
  EmitContext_AddVariableDeclaration(receiver!.ec, temp);
  return NodeFactory_NewLogicalANDExpression(
    receiver!.f,
    NodeFactory_NewLogicalANDExpression(
      receiver!.f,
      AsBinaryExpression(left)!.Left,
      NodeFactory_NewStrictInequalityExpression(
        receiver!.f,
        NodeFactory_NewAssignmentExpression(receiver!.f, temp, AsBinaryExpression(left)!.Right),
        NodeFactory_NewVoidZeroExpression(receiver!.f),
      ),
    ),
    NewPropertyAccessExpression(f, temp, undefined, AsQualifiedName(node as GoPtr<Node>)!.Right, NodeFlagsNone),
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.createCheckedValue","kind":"method","status":"implemented","sigHash":"7a1eb7d35a39cf90559635667c009229962f57618b5f0ee1724e5d945d03f365","bodyHash":"4d64569de9ea0ade8889b882a91cb27989373f5f318204fc5e633785905ab258"}
 *
 * Go source:
 * func (s *metadataSerializer) createCheckedValue(left *ast.Node, right *ast.Node) *ast.Node {
 * 	return s.f.NewLogicalANDExpression(
 * 		s.f.NewStrictInequalityExpression(s.f.NewTypeOfExpression(left), s.f.NewStringLiteral("undefined", ast.TokenFlagsNone)),
 * 		right,
 * 	)
 * }
 */
export function metadataSerializer_createCheckedValue(receiver: GoPtr<metadataSerializer>, left: GoPtr<Node>, right: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.f!.__tsgoEmbedded0!;
  return NodeFactory_NewLogicalANDExpression(
    receiver!.f,
    NodeFactory_NewStrictInequalityExpression(
      receiver!.f,
      NewTypeOfExpression(f, left),
      NewStringLiteral(f, "undefined", TokenFlagsNone),
    ),
    right,
  );
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/tstransforms/typeserializer.go::method::metadataSerializer.equateSerializedTypeNodes","kind":"method","status":"implemented","sigHash":"7443da1e7a72a7bb3b613ea600cbe57eed730b6b479f82271982b7c01eb70a95","bodyHash":"f62b9bfab75dd6418927c51ecbe6a84394ff4e53fbed4475b4dcd51733e43609"}
 *
 * Go source:
 * func (s *metadataSerializer) equateSerializedTypeNodes(left *ast.Node, right *ast.Node) bool {
 * 	// temp vars used in fallback
 * 	if transformers.IsGeneratedIdentifier(s.ec, left) {
 * 		return transformers.IsGeneratedIdentifier(s.ec, right)
 * 	}
 * 	// entity names
 * 	if ast.IsIdentifier(left) {
 * 		return ast.IsIdentifier(right) && left.Text() == right.Text()
 * 	}
 * 	if ast.IsPropertyAccessExpression(left) {
 * 		return ast.IsPropertyAccessExpression(right) && s.equateSerializedTypeNodes(left.Expression(), right.Expression()) && s.equateSerializedTypeNodes(left.Name(), right.Name())
 * 	}
 * 	// `void 0`
 * 	if ast.IsVoidExpression(left) {
 * 		return ast.IsVoidExpression(right) && ast.IsNumericLiteral(left.Expression()) && ast.IsNumericLiteral(right.Expression()) && left.Expression().Text() == "0" && right.Expression().Text() == "0"
 * 	}
 * 	// `"undefined"` or `"function"` in `typeof` checks
 * 	if ast.IsStringLiteral(left) {
 * 		return ast.IsStringLiteral(right) && left.Text() == right.Text()
 * 	}
 * 	// used in `typeof` checks for fallback
 * 	if ast.IsTypeOfExpression(left) {
 * 		return ast.IsTypeOfExpression(right) && s.equateSerializedTypeNodes(left.Expression(), right.Expression())
 * 	}
 * 	// parens in `typeof` checks with temps
 * 	if ast.IsParenthesizedExpression(left) {
 * 		return ast.IsParenthesizedExpression(right) && s.equateSerializedTypeNodes(left.Expression(), right.Expression())
 * 	}
 * 	// conditionals used in fallback
 * 	if ast.IsConditionalExpression(left) {
 * 		return ast.IsConditionalExpression(right) && s.equateSerializedTypeNodes(left.AsConditionalExpression().Condition, right.AsConditionalExpression().Condition) && s.equateSerializedTypeNodes(left.AsConditionalExpression().WhenTrue, right.AsConditionalExpression().WhenTrue) && s.equateSerializedTypeNodes(left.AsConditionalExpression().WhenFalse, right.AsConditionalExpression().WhenFalse)
 * 	}
 * 	// logical binary and assignments used in fallback
 * 	if ast.IsBinaryExpression(left) {
 * 		return ast.IsBinaryExpression(right) && left.AsBinaryExpression().OperatorToken.Kind == right.AsBinaryExpression().OperatorToken.Kind && s.equateSerializedTypeNodes(left.AsBinaryExpression().Left, right.AsBinaryExpression().Left) && s.equateSerializedTypeNodes(left.AsBinaryExpression().Right, right.AsBinaryExpression().Right)
 * 	}
 * 	return false
 * }
 */
export function metadataSerializer_equateSerializedTypeNodes(receiver: GoPtr<metadataSerializer>, left: GoPtr<Node>, right: GoPtr<Node>): bool {
  if (IsGeneratedIdentifier(receiver!.ec, left)) {
    return IsGeneratedIdentifier(receiver!.ec, right);
  }
  if (IsIdentifier(left)) {
    return IsIdentifier(right) && Node_Text(left) === Node_Text(right);
  }
  if (IsPropertyAccessExpression(left)) {
    return IsPropertyAccessExpression(right) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, Node_Expression(left), Node_Expression(right)) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, Node_Name(left) as GoPtr<Node>, Node_Name(right) as GoPtr<Node>);
  }
  if (IsVoidExpression(left)) {
    return IsVoidExpression(right) &&
      IsNumericLiteral(Node_Expression(left)) &&
      IsNumericLiteral(Node_Expression(right)) &&
      Node_Text(Node_Expression(left)) === "0" &&
      Node_Text(Node_Expression(right)) === "0";
  }
  if (IsStringLiteral(left)) {
    return IsStringLiteral(right) && Node_Text(left) === Node_Text(right);
  }
  if (IsTypeOfExpression(left)) {
    return IsTypeOfExpression(right) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, Node_Expression(left), Node_Expression(right));
  }
  if (IsParenthesizedExpression(left)) {
    return IsParenthesizedExpression(right) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, Node_Expression(left), Node_Expression(right));
  }
  if (IsConditionalExpression(left)) {
    return IsConditionalExpression(right) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, AsConditionalExpression(left)!.Condition, AsConditionalExpression(right)!.Condition) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, AsConditionalExpression(left)!.WhenTrue, AsConditionalExpression(right)!.WhenTrue) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, AsConditionalExpression(left)!.WhenFalse, AsConditionalExpression(right)!.WhenFalse);
  }
  if (IsBinaryExpression(left)) {
    return IsBinaryExpression(right) &&
      AsBinaryExpression(left)!.OperatorToken!.Kind === AsBinaryExpression(right)!.OperatorToken!.Kind &&
      metadataSerializer_equateSerializedTypeNodes(receiver, AsBinaryExpression(left)!.Left, AsBinaryExpression(right)!.Left) &&
      metadataSerializer_equateSerializedTypeNodes(receiver, AsBinaryExpression(left)!.Right, AsBinaryExpression(right)!.Right);
  }
  return false;
}
