import type { bool } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../../go/compat.js";
import type { ModifierList, Node, NodeList, NodeVisitor } from "../../ast/spine.js";
import { NodeFactory_NewNodeList, Node_Name } from "../../ast/spine.js";
import type { CallExpression, ClassDeclaration, PropertyDeclaration } from "../../ast/generated/data.js";
import type { Expression, IdentifierNode } from "../../ast/generated/unions.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import { OrderedSet_Values, OrderedSet_Add } from "../../collections/ordered_set.js";
import { EmitContext_NewNodeVisitor, EmitContext_SetOriginal } from "../../printer/emitcontext.js";
import type { EmitContext, AutoGenerateOptions } from "../../printer/emitcontext.js";
import type { NodeFactory } from "../../printer/factory.js";
import {
  NodeFactory_NewGeneratedPrivateNameForNodeEx,
  NodeFactory_NewAssignmentExpression,
  NodeFactory_NewThisExpression,
  NodeFactory_NewStrictEqualityExpression,
  NodeFactory_NewStrictInequalityExpression,
  NodeFactory_NewVoidZeroExpression,
} from "../../printer/factory.js";
import {
  NewBinaryExpression,
  NewClassExpression,
  NewPropertyAccessExpression,
  NewKeywordExpression,
  NewIdentifier,
  NewToken,
  NewArrowFunction,
  NewParameterDeclaration,
  NewPropertyAssignment,
  NewObjectLiteralExpression,
  NewCallExpression,
  NewVariableDeclaration,
  NewVariableDeclarationList,
  NewVariableStatement,
} from "../../ast/generated/factory.js";
import { AsCallExpression, AsPropertyAccessExpression, AsElementAccessExpression, AsPrefixUnaryExpression, AsPostfixUnaryExpression, AsBinaryExpression } from "../../ast/generated/casts.js";
import { IsPropertyAccessExpression, IsElementAccessExpression, IsAssignmentOperator } from "../../ast/generated/predicates.js";
import { IsSuperProperty } from "../../ast/utilities.js";
import { Node_Expression, Node_Text, NodeFactory_UpdatePropertyDeclaration } from "../../ast/ast.js";
import {
  KindSuperKeyword,
  KindNullKeyword,
  KindEqualsGreaterThanToken,
  KindCallExpression as KindCallExpressionKind,
  KindPropertyAccessExpression as KindPropertyAccessExpressionKind,
  KindElementAccessExpression as KindElementAccessExpressionKind,
  KindBinaryExpression as KindBinaryExpressionKind,
  KindPrefixUnaryExpression as KindPrefixUnaryExpressionKind,
  KindPostfixUnaryExpression as KindPostfixUnaryExpressionKind,
  KindFunctionExpression,
  KindFunctionDeclaration,
  KindMethodDeclaration,
  KindGetAccessor,
  KindSetAccessor,
  KindConstructor,
  KindClassDeclaration,
  KindClassExpression,
  KindAmpersandAmpersandToken,
  KindBarBarToken,
} from "../../ast/generated/kinds.js";
import { NodeFlagsNone, NodeFlagsConst } from "../../ast/generated/flags.js";
import { ModifierFlagsExportDefault } from "../../ast/modifierflags.js";
import type { ModifierFlags } from "../../ast/modifierflags.js";
import { ExtractModifiers } from "../modifiervisitor.js";
import { assignmentTargetContainsSuperProperty, isUpdateExpression } from "./async.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNodes, NodeVisitor_VisitNode } from "../../ast/visitor.js";
import type { NodeVisitor as ConcreteNodeVisitor } from "../../ast/visitor.js";
import type { TextRange } from "../../core/text.js";
import { GeneratedIdentifierFlagsNone } from "../../printer/generatedidentifierflags.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::func::convertClassDeclarationToClassExpression","kind":"func","status":"implemented","sigHash":"31775bc4552139bac27ccfa6417ca5c0b59581916471656fac15a401ab69d54e","bodyHash":"d79dc5737215ecc58b08b6027a86da0dac034fb88acf466a58a9b5b9fc220183"}
 *
 * Go source:
 * func convertClassDeclarationToClassExpression(emitContext *printer.EmitContext, node *ast.ClassDeclaration) *ast.Expression {
 * 	updated := emitContext.Factory.NewClassExpression(
 * 		transformers.ExtractModifiers(emitContext, node.Modifiers(), ^ast.ModifierFlagsExportDefault),
 * 		node.Name(),
 * 		node.TypeParameters,
 * 		node.HeritageClauses,
 * 		node.Members,
 * 	)
 * 	emitContext.SetOriginal(updated, node.AsNode())
 * 	updated.Loc = node.Loc
 * 	return updated
 * }
 */
export function convertClassDeclarationToClassExpression(emitContext: GoPtr<EmitContext>, node: GoPtr<ClassDeclaration>): GoPtr<Expression> {
  const f = emitContext!.Factory!.__tsgoEmbedded0!;
  const updated = NewClassExpression(
    f,
    ExtractModifiers(emitContext, node!.modifiers, (~ModifierFlagsExportDefault) as ModifierFlags),
    node!.name,
    node!.TypeParameters,
    node!.HeritageClauses,
    node!.Members,
  );
  EmitContext_SetOriginal(emitContext, updated, node as unknown as GoPtr<Node>);
  (updated as unknown as { Loc: TextRange })!.Loc = (node as unknown as { Loc: TextRange })!.Loc;
  return updated as unknown as GoPtr<Expression>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::func::createNotNullCondition","kind":"func","status":"implemented","sigHash":"ad72d06e973ec559fc3a8f46c9001dedd625b2327659b5722fdef99cf45dadab","bodyHash":"c8cedba5533bba67c02d6a1cc9a353bf62cc2d82c29e25d02baa67520933578f"}
 *
 * Go source:
 * func createNotNullCondition(emitContext *printer.EmitContext, left *ast.Node, right *ast.Node, invert bool) *ast.Node {
 * 	token := ast.KindExclamationEqualsEqualsToken
 * 	op := ast.KindAmpersandAmpersandToken
 * 	if invert {
 * 		token = ast.KindEqualsEqualsEqualsToken
 * 		op = ast.KindBarBarToken
 * 	}
 *
 * 	return emitContext.Factory.NewBinaryExpression(
 * 		nil,
 * 		emitContext.Factory.NewBinaryExpression(
 * 			nil,
 * 			left,
 * 			nil,
 * 			emitContext.Factory.NewToken(token),
 * 			emitContext.Factory.NewKeywordExpression(ast.KindNullKeyword),
 * 		),
 * 		nil,
 * 		emitContext.Factory.NewToken(op),
 * 		emitContext.Factory.NewBinaryExpression(
 * 			nil,
 * 			right,
 * 			nil,
 * 			emitContext.Factory.NewToken(token),
 * 			emitContext.Factory.NewVoidZeroExpression(),
 * 		),
 * 	)
 * }
 */
export function createNotNullCondition(emitContext: GoPtr<EmitContext>, left: GoPtr<Node>, right: GoPtr<Node>, invert: bool): GoPtr<Node> {
  const f = emitContext!.Factory!.__tsgoEmbedded0!;
  const pf = emitContext!.Factory!;
  const nullKeyword = NewKeywordExpression(f, KindNullKeyword) as unknown as GoPtr<Expression>;
  const voidZero = NodeFactory_NewVoidZeroExpression(pf);
  let innerLeft: GoPtr<Expression>;
  let innerRight: GoPtr<Expression>;
  let opToken: GoPtr<Node>;
  if (invert) {
    innerLeft = NodeFactory_NewStrictEqualityExpression(pf, left as unknown as GoPtr<Expression>, nullKeyword);
    innerRight = NodeFactory_NewStrictEqualityExpression(pf, right as unknown as GoPtr<Expression>, voidZero);
    opToken = NewToken(f, KindBarBarToken);
  } else {
    innerLeft = NodeFactory_NewStrictInequalityExpression(pf, left as unknown as GoPtr<Expression>, nullKeyword);
    innerRight = NodeFactory_NewStrictInequalityExpression(pf, right as unknown as GoPtr<Expression>, voidZero);
    opToken = NewToken(f, KindAmpersandAmpersandToken);
  }
  return NewBinaryExpression(f, undefined, innerLeft, undefined, opToken, innerRight);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::type::superAccessState","kind":"type","status":"implemented","sigHash":"6fadfc76477c61f01e3b55f61df655444508dd7c7416614ef97d5926ddfd494e","bodyHash":"c6e7b09e44a3bc5045d98474d0375f30738a18b6667d377e2b1574ecc78df5c1"}
 *
 * Go source:
 * superAccessState struct {
 * 	factory *printer.NodeFactory
 *
 * 	// Keeps track of property names accessed on super (`super.x`) within async functions.
 * 	capturedSuperProperties *collections.OrderedSet[string]
 * 	// Whether the async function contains an element access on super (`super[x]`).
 * 	hasSuperElementAccess      bool
 * 	hasSuperPropertyAssignment bool
 *
 * 	superBinding       *ast.IdentifierNode
 * 	superIndexBinding  *ast.IdentifierNode
 * 	superAccessVisitor *ast.NodeVisitor
 * }
 */
export interface superAccessState {
  factory: GoPtr<NodeFactory>;
  capturedSuperProperties: GoPtr<OrderedSet<string>>;
  hasSuperElementAccess: bool;
  hasSuperPropertyAssignment: bool;
  superBinding: GoPtr<IdentifierNode>;
  superIndexBinding: GoPtr<IdentifierNode>;
  superAccessVisitor: GoPtr<NodeVisitor>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.initSuperAccessVisitor","kind":"method","status":"implemented","sigHash":"ad54b9c6480bd0d44c70f145355e03e2746a4c98ebf3ae88fc7bf721c1e2a0a9","bodyHash":"86f67b31176446859b00e3e6b09f977312743a43a9ba8dd89f44db03bdb31f5d"}
 *
 * Go source:
 * func (s *superAccessState) initSuperAccessVisitor(emitContext *printer.EmitContext, factory *printer.NodeFactory) {
 * 	s.factory = factory
 * 	s.superAccessVisitor = emitContext.NewNodeVisitor(s.visitSuperAccessNode)
 * }
 */
export function superAccessState_initSuperAccessVisitor(receiver: GoPtr<superAccessState>, emitContext: GoPtr<EmitContext>, factory: GoPtr<NodeFactory>): void {
  receiver!.factory = factory;
  receiver!.superAccessVisitor = EmitContext_NewNodeVisitor(emitContext, (node: GoPtr<Node>): GoPtr<Node> => superAccessState_visitSuperAccessNode(receiver, node));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.visitSuperAccessNode","kind":"method","status":"implemented","sigHash":"62f174bd1a0e83bcbae23f89c0b3a73b4c98c0c8f9030815f73615d0f296a68c","bodyHash":"bf0414a58861c6336edfaccffea954f10ecf4e165f72feff1f18bbf3626357af"}
 *
 * Go source:
 * func (s *superAccessState) visitSuperAccessNode(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindCallExpression:
 * 		call := node.AsCallExpression()
 * 		if ast.IsSuperProperty(call.Expression) {
 * 			return s.substituteCallExpressionWithSuperAccess(call, s.superAccessVisitor)
 * 		}
 * 		return s.superAccessVisitor.VisitEachChild(node)
 * 	case ast.KindPropertyAccessExpression:
 * 		if node.Expression().Kind == ast.KindSuperKeyword {
 * 			// super.x → _super.x
 * 			return s.factory.NewPropertyAccessExpression(
 * 				s.superBinding, nil, node.Name(), ast.NodeFlagsNone,
 * 			)
 * 		}
 * 		return s.superAccessVisitor.VisitEachChild(node)
 * 	case ast.KindElementAccessExpression:
 * 		if node.Expression().Kind == ast.KindSuperKeyword {
 * 			// super[x] → _superIndex(x) or _superIndex(x).value
 * 			return s.createSuperElementAccessInAsyncMethod(
 * 				node.AsElementAccessExpression().ArgumentExpression,
 * 			)
 * 		}
 * 		return s.superAccessVisitor.VisitEachChild(node)
 * 	// Don't recurse into non-arrow function scopes or classes
 * 	case ast.KindFunctionExpression, ast.KindFunctionDeclaration,
 * 		ast.KindMethodDeclaration, ast.KindGetAccessor, ast.KindSetAccessor,
 * 		ast.KindConstructor, ast.KindClassDeclaration, ast.KindClassExpression:
 * 		return node
 * 	default:
 * 		return s.superAccessVisitor.VisitEachChild(node)
 * 	}
 * }
 */
export function superAccessState_visitSuperAccessNode(receiver: GoPtr<superAccessState>, node: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.factory!.__tsgoEmbedded0!;
  const visitor = receiver!.superAccessVisitor! as ConcreteNodeVisitor;
  switch (node!.Kind) {
    case KindCallExpressionKind: {
      const call = AsCallExpression(node)!;
      if (IsSuperProperty(call.Expression as unknown as GoPtr<Node>)) {
        return superAccessState_substituteCallExpressionWithSuperAccess(receiver, call, receiver!.superAccessVisitor!);
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    }
    case KindPropertyAccessExpressionKind: {
      if (Node_Expression(node)!.Kind === KindSuperKeyword) {
        return NewPropertyAccessExpression(
          f,
          receiver!.superBinding as unknown as GoPtr<Expression>,
          undefined,
          Node_Name(node) as unknown as GoPtr<never>,
          NodeFlagsNone,
        );
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    }
    case KindElementAccessExpressionKind: {
      if (Node_Expression(node)!.Kind === KindSuperKeyword) {
        return superAccessState_createSuperElementAccessInAsyncMethod(
          receiver,
          AsElementAccessExpression(node)!.ArgumentExpression as unknown as GoPtr<Node>,
        );
      }
      return NodeVisitor_VisitEachChild(visitor, node);
    }
    case KindFunctionExpression:
    case KindFunctionDeclaration:
    case KindMethodDeclaration:
    case KindGetAccessor:
    case KindSetAccessor:
    case KindConstructor:
    case KindClassDeclaration:
    case KindClassExpression:
      return node;
    default:
      return NodeVisitor_VisitEachChild(visitor, node);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.substituteSuperAccessesInBody","kind":"method","status":"implemented","sigHash":"2928106c0afd70dba32ba296c179ff2026bdcdf6376b4d697a6a99bc049bd71a","bodyHash":"d46909746c3882d385323e3823cd3b2b877136a1d6e12200770018dfa6fc66fc"}
 *
 * Go source:
 * func (s *superAccessState) substituteSuperAccessesInBody(body *ast.Node) *ast.Node {
 * 	return s.superAccessVisitor.VisitNode(body)
 * }
 */
export function superAccessState_substituteSuperAccessesInBody(receiver: GoPtr<superAccessState>, body: GoPtr<Node>): GoPtr<Node> {
  return NodeVisitor_VisitNode(receiver!.superAccessVisitor! as ConcreteNodeVisitor, body);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.substituteCallExpressionWithSuperAccess","kind":"method","status":"implemented","sigHash":"6c61e86ad615bb79acc5ac471404becf4eae89982e118234ee1ebc143f5d8a77","bodyHash":"586feff107a76601cbd5885ebc58d0764e7d66e3976c5bba903337ef9399a27f"}
 *
 * Go source:
 * func (s *superAccessState) substituteCallExpressionWithSuperAccess(call *ast.CallExpression, visitor *ast.NodeVisitor) *ast.Node {
 * 	expression := call.Expression
 * 	var target *ast.Node
 *
 * 	if ast.IsPropertyAccessExpression(expression) {
 * 		// super.x(args) → _super.x.call(this, args)
 * 		target = s.factory.NewPropertyAccessExpression(
 * 			s.superBinding, nil,
 * 			expression.AsPropertyAccessExpression().Name(), ast.NodeFlagsNone,
 * 		)
 * 	} else if ast.IsElementAccessExpression(expression) {
 * 		// super[x](args) → _superIndex(x).call(this, args) or _superIndex(x).value.call(this, args)
 * 		target = s.createSuperElementAccessInAsyncMethod(
 * 			expression.AsElementAccessExpression().ArgumentExpression,
 * 		)
 * 	} else {
 * 		return visitor.VisitEachChild(call.AsNode())
 * 	}
 *
 * 	callTarget := s.factory.NewPropertyAccessExpression(
 * 		target, nil,
 * 		s.factory.NewIdentifier("call"), ast.NodeFlagsNone,
 * 	)
 *
 * 	var allArgs []*ast.Node
 * 	allArgs = append(allArgs, s.factory.NewThisExpression())
 * 	if call.Arguments != nil {
 * 		visitedArgs := visitor.VisitNodes(call.Arguments)
 * 		if visitedArgs != nil {
 * 			allArgs = append(allArgs, visitedArgs.Nodes...)
 * 		}
 * 	}
 *
 * 	result := s.factory.NewCallExpression(
 * 		callTarget, nil, nil,
 * 		s.factory.NewNodeList(allArgs), ast.NodeFlagsNone,
 * 	)
 * 	result.Loc = call.Loc
 * 	return result
 * }
 */
export function superAccessState_substituteCallExpressionWithSuperAccess(receiver: GoPtr<superAccessState>, call: GoPtr<CallExpression>, visitor: GoPtr<NodeVisitor>): GoPtr<Node> {
  const f = receiver!.factory!.__tsgoEmbedded0!;
  const pf = receiver!.factory!;
  const concreteVisitor = visitor as ConcreteNodeVisitor;
  const expression = call!.Expression as unknown as GoPtr<Node>;
  let target: GoPtr<Node>;

  if (IsPropertyAccessExpression(expression)) {
    target = NewPropertyAccessExpression(
      f,
      receiver!.superBinding as unknown as GoPtr<Expression>,
      undefined,
      AsPropertyAccessExpression(expression)!.name as unknown as GoPtr<never>,
      NodeFlagsNone,
    );
  } else if (IsElementAccessExpression(expression)) {
    target = superAccessState_createSuperElementAccessInAsyncMethod(
      receiver,
      AsElementAccessExpression(expression)!.ArgumentExpression as unknown as GoPtr<Node>,
    );
  } else {
    return NodeVisitor_VisitEachChild(concreteVisitor, call as unknown as GoPtr<Node>);
  }

  const callTarget = NewPropertyAccessExpression(
    f,
    target as unknown as GoPtr<Expression>,
    undefined,
    NewIdentifier(f, "call") as unknown as GoPtr<never>,
    NodeFlagsNone,
  );

  let allArgs: GoSlice<GoPtr<Node>> = [NodeFactory_NewThisExpression(pf) as unknown as GoPtr<Node>];
  if (call!.Arguments !== undefined) {
    const visitedArgs = NodeVisitor_VisitNodes(concreteVisitor, call!.Arguments);
    if (visitedArgs !== undefined) {
      allArgs = [...allArgs, ...(visitedArgs!.Nodes as unknown as GoSlice<GoPtr<Node>>)];
    }
  }

  const result = NewCallExpression(
    f,
    callTarget as unknown as GoPtr<Expression>,
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, allArgs) as unknown as GoPtr<NodeList>,
    NodeFlagsNone,
  );
  (result as unknown as { Loc: TextRange })!.Loc = (call as unknown as { Loc: TextRange })!.Loc;
  return result;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.createSuperElementAccessInAsyncMethod","kind":"method","status":"implemented","sigHash":"b329520bc2c6efbae35dcaec3195892b345feb50610f4285d0da9364d037b94a","bodyHash":"a1a0597b59870baa3ddec37216f2323d4acfc706e15241f6e0bb4daacee80686"}
 *
 * Go source:
 * func (s *superAccessState) createSuperElementAccessInAsyncMethod(argumentExpression *ast.Node) *ast.Node {
 * 	superIndexCall := s.factory.NewCallExpression(
 * 		s.superIndexBinding, nil, nil,
 * 		s.factory.NewNodeList([]*ast.Node{argumentExpression}),
 * 		ast.NodeFlagsNone,
 * 	)
 * 	if s.hasSuperPropertyAssignment {
 * 		return s.factory.NewPropertyAccessExpression(
 * 			superIndexCall, nil,
 * 			s.factory.NewIdentifier("value"), ast.NodeFlagsNone,
 * 		)
 * 	}
 * 	return superIndexCall
 * }
 */
export function superAccessState_createSuperElementAccessInAsyncMethod(receiver: GoPtr<superAccessState>, argumentExpression: GoPtr<Node>): GoPtr<Node> {
  const f = receiver!.factory!.__tsgoEmbedded0!;
  const superIndexCall = NewCallExpression(
    f,
    receiver!.superIndexBinding as unknown as GoPtr<Expression>,
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [argumentExpression]) as unknown as GoPtr<NodeList>,
    NodeFlagsNone,
  );
  if (receiver!.hasSuperPropertyAssignment) {
    return NewPropertyAccessExpression(
      f,
      superIndexCall as unknown as GoPtr<Expression>,
      undefined,
      NewIdentifier(f, "value") as unknown as GoPtr<never>,
      NodeFlagsNone,
    );
  }
  return superIndexCall;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.createSuperAccessVariableStatement","kind":"method","status":"implemented","sigHash":"b49ae2df63bf057970321e86c186cd995c21300ba22befb1b6cec6900553454b","bodyHash":"5409e985f7981fc81d8f679aa77828850d76aebd26d04c2499bd6dac065d4f55"}
 *
 * Go source:
 * func (s *superAccessState) createSuperAccessVariableStatement() *ast.Node {
 * 	f := s.factory
 * 	var accessors []*ast.Node
 *
 * 	for name := range s.capturedSuperProperties.Values() {
 * 		var descriptorProperties []*ast.Node
 *
 * 		// getter: get: () => super.name
 * 		getterBody := f.NewPropertyAccessExpression(
 * 			f.NewKeywordExpression(ast.KindSuperKeyword), nil,
 * 			f.NewIdentifier(name), ast.NodeFlagsNone,
 * 		)
 * 		getterArrow := f.NewArrowFunction(
 * 			nil, nil,
 * 			f.NewNodeList([]*ast.Node{}),
 * 			nil, nil,
 * 			f.NewToken(ast.KindEqualsGreaterThanToken),
 * 			getterBody,
 * 		)
 * 		getter := f.NewPropertyAssignment(nil, f.NewIdentifier("get"), nil, nil, getterArrow)
 * 		descriptorProperties = append(descriptorProperties, getter)
 *
 * 		if s.hasSuperPropertyAssignment {
 * 			// setter: set: v => super.name = v
 * 			vParam := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("v"), nil, nil, nil)
 * 			superProp := f.NewPropertyAccessExpression(
 * 				f.NewKeywordExpression(ast.KindSuperKeyword), nil,
 * 				f.NewIdentifier(name), ast.NodeFlagsNone,
 * 			)
 * 			assignExpr := f.NewAssignmentExpression(superProp, f.NewIdentifier("v"))
 * 			setterArrow := f.NewArrowFunction(
 * 				nil, nil,
 * 				f.NewNodeList([]*ast.Node{vParam}),
 * 				nil, nil,
 * 				f.NewToken(ast.KindEqualsGreaterThanToken),
 * 				assignExpr,
 * 			)
 * 			setter := f.NewPropertyAssignment(nil, f.NewIdentifier("set"), nil, nil, setterArrow)
 * 			descriptorProperties = append(descriptorProperties, setter)
 * 		}
 *
 * 		descriptor := f.NewObjectLiteralExpression(f.NewNodeList(descriptorProperties), false)
 * 		accessor := f.NewPropertyAssignment(nil, f.NewIdentifier(name), nil, nil, descriptor)
 * 		accessors = append(accessors, accessor)
 * 	}
 *
 * 	descriptorsObject := f.NewObjectLiteralExpression(f.NewNodeList(accessors), true)
 *
 * 	objectCreateCall := f.NewCallExpression(
 * 		f.NewPropertyAccessExpression(
 * 			f.NewIdentifier("Object"), nil,
 * 			f.NewIdentifier("create"), ast.NodeFlagsNone,
 * 		), nil, nil,
 * 		f.NewNodeList([]*ast.Node{
 * 			f.NewKeywordExpression(ast.KindNullKeyword),
 * 			descriptorsObject,
 * 		}),
 * 		ast.NodeFlagsNone,
 * 	)
 *
 * 	decl := f.NewVariableDeclaration(s.superBinding, nil, nil, objectCreateCall)
 * 	declList := f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{decl}), ast.NodeFlagsConst)
 * 	return f.NewVariableStatement(nil, declList)
 * }
 */
export function superAccessState_createSuperAccessVariableStatement(receiver: GoPtr<superAccessState>): GoPtr<Node> {
  const f = receiver!.factory!.__tsgoEmbedded0!;
  const pf = receiver!.factory!;
  let accessors: GoSlice<GoPtr<Node>> = [];

  OrderedSet_Values(receiver!.capturedSuperProperties!)((name: string) => {
    let descriptorProperties: GoSlice<GoPtr<Node>> = [];

    const getterBody = NewPropertyAccessExpression(
      f,
      NewKeywordExpression(f, KindSuperKeyword) as unknown as GoPtr<Expression>,
      undefined,
      NewIdentifier(f, name) as unknown as GoPtr<never>,
      NodeFlagsNone,
    );
    const getterArrow = NewArrowFunction(
      f,
      undefined,
      undefined,
      NodeFactory_NewNodeList(f, []) as unknown as GoPtr<NodeList>,
      undefined,
      undefined,
      NewToken(f, KindEqualsGreaterThanToken),
      getterBody,
    );
    const getter = NewPropertyAssignment(f, undefined, NewIdentifier(f, "get") as unknown as GoPtr<never>, undefined, undefined, getterArrow as unknown as GoPtr<Expression>);
    descriptorProperties = [...descriptorProperties, getter];

    if (receiver!.hasSuperPropertyAssignment) {
      const vParam = NewParameterDeclaration(f, undefined, undefined, NewIdentifier(f, "v") as unknown as GoPtr<never>, undefined, undefined, undefined);
      const superProp = NewPropertyAccessExpression(
        f,
        NewKeywordExpression(f, KindSuperKeyword) as unknown as GoPtr<Expression>,
        undefined,
        NewIdentifier(f, name) as unknown as GoPtr<never>,
        NodeFlagsNone,
      );
      const assignExpr = NodeFactory_NewAssignmentExpression(pf, superProp as unknown as GoPtr<Expression>, NewIdentifier(f, "v") as unknown as GoPtr<Expression>);
      const setterArrow = NewArrowFunction(
        f,
        undefined,
        undefined,
        NodeFactory_NewNodeList(f, [vParam]) as unknown as GoPtr<NodeList>,
        undefined,
        undefined,
        NewToken(f, KindEqualsGreaterThanToken),
        assignExpr as unknown as GoPtr<Node>,
      );
      const setter = NewPropertyAssignment(f, undefined, NewIdentifier(f, "set") as unknown as GoPtr<never>, undefined, undefined, setterArrow as unknown as GoPtr<Expression>);
      descriptorProperties = [...descriptorProperties, setter];
    }

    const descriptor = NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, descriptorProperties) as unknown as GoPtr<NodeList>, false);
    const accessor = NewPropertyAssignment(f, undefined, NewIdentifier(f, name) as unknown as GoPtr<never>, undefined, undefined, descriptor as unknown as GoPtr<Expression>);
    accessors = [...accessors, accessor];
    // Go `for ... range` iterates every captured property.
    return true;
  });

  const descriptorsObject = NewObjectLiteralExpression(f, NodeFactory_NewNodeList(f, accessors) as unknown as GoPtr<NodeList>, true);

  const objectCreateCall = NewCallExpression(
    f,
    NewPropertyAccessExpression(
      f,
      NewIdentifier(f, "Object") as unknown as GoPtr<Expression>,
      undefined,
      NewIdentifier(f, "create") as unknown as GoPtr<never>,
      NodeFlagsNone,
    ) as unknown as GoPtr<Expression>,
    undefined,
    undefined,
    NodeFactory_NewNodeList(f, [
      NewKeywordExpression(f, KindNullKeyword),
      descriptorsObject,
    ]) as unknown as GoPtr<NodeList>,
    NodeFlagsNone,
  );

  const decl = NewVariableDeclaration(f, receiver!.superBinding as unknown as GoPtr<never>, undefined, undefined, objectCreateCall as unknown as GoPtr<Expression>);
  const declList = NewVariableDeclarationList(f, NodeFactory_NewNodeList(f, [decl]) as unknown as GoPtr<NodeList>, NodeFlagsConst);
  return NewVariableStatement(f, undefined, declList as unknown as GoPtr<never>);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.trackSuperAccess","kind":"method","status":"implemented","sigHash":"d2eca200ae74a3b7a01443ea75eb1445427eb142003c9d34f19217370478d992","bodyHash":"7910b5116878c13acc8cbb5cf811cda05f6ff3c683a8b3bb4bdb302a99596b1a"}
 *
 * Go source:
 * func (s *superAccessState) trackSuperAccess(node *ast.Node) {
 * 	if s.capturedSuperProperties == nil {
 * 		return
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindPropertyAccessExpression:
 * 		if node.Expression().Kind == ast.KindSuperKeyword {
 * 			s.capturedSuperProperties.Add(node.Name().Text())
 * 		}
 * 	case ast.KindElementAccessExpression:
 * 		if node.Expression().Kind == ast.KindSuperKeyword {
 * 			s.hasSuperElementAccess = true
 * 		}
 * 	case ast.KindBinaryExpression:
 * 		if ast.IsAssignmentOperator(node.AsBinaryExpression().OperatorToken.Kind) && assignmentTargetContainsSuperProperty(node.AsBinaryExpression().Left) {
 * 			s.hasSuperPropertyAssignment = true
 * 		}
 * 	case ast.KindPrefixUnaryExpression:
 * 		if isUpdateExpression(node) && assignmentTargetContainsSuperProperty(node.AsPrefixUnaryExpression().Operand) {
 * 			s.hasSuperPropertyAssignment = true
 * 		}
 * 	case ast.KindPostfixUnaryExpression:
 * 		if isUpdateExpression(node) && assignmentTargetContainsSuperProperty(node.AsPostfixUnaryExpression().Operand) {
 * 			s.hasSuperPropertyAssignment = true
 * 		}
 * 	}
 * }
 */
export function superAccessState_trackSuperAccess(receiver: GoPtr<superAccessState>, node: GoPtr<Node>): void {
  if (receiver!.capturedSuperProperties === undefined) {
    return;
  }
  switch (node!.Kind) {
    case KindPropertyAccessExpressionKind:
      if (Node_Expression(node)!.Kind === KindSuperKeyword) {
        OrderedSet_Add(receiver!.capturedSuperProperties!, Node_Text(Node_Name(node)!));
      }
      break;
    case KindElementAccessExpressionKind:
      if (Node_Expression(node)!.Kind === KindSuperKeyword) {
        receiver!.hasSuperElementAccess = true;
      }
      break;
    case KindBinaryExpressionKind: {
      const be = AsBinaryExpression(node)!;
      if (IsAssignmentOperator(be.OperatorToken!.Kind) && assignmentTargetContainsSuperProperty(be.Left as unknown as GoPtr<Node>)) {
        receiver!.hasSuperPropertyAssignment = true;
      }
      break;
    }
    case KindPrefixUnaryExpressionKind:
      if (isUpdateExpression(node) && assignmentTargetContainsSuperProperty(AsPrefixUnaryExpression(node)!.Operand as unknown as GoPtr<Node>)) {
        receiver!.hasSuperPropertyAssignment = true;
      }
      break;
    case KindPostfixUnaryExpressionKind:
      if (isUpdateExpression(node) && assignmentTargetContainsSuperProperty(AsPostfixUnaryExpression(node)!.Operand as unknown as GoPtr<Node>)) {
        receiver!.hasSuperPropertyAssignment = true;
      }
      break;
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::func::createAccessorPropertyBackingField","kind":"func","status":"implemented","sigHash":"91b8110540ced658c06c7897aa208d2225d24c0fc2f08db792eb9e9d003f2abf","bodyHash":"0c2d1b537e4c5015de615f2ef46eff77f7e525155a0e29b701244d244b68f26a"}
 *
 * Go source:
 * func createAccessorPropertyBackingField(f *printer.NodeFactory, node *ast.PropertyDeclaration, modifiers *ast.ModifierList, initializer *ast.Expression) *ast.Node {
 * 	return f.UpdatePropertyDeclaration(
 * 		node,
 * 		modifiers,
 * 		f.NewGeneratedPrivateNameForNodeEx(node.Name(), printer.AutoGenerateOptions{Suffix: "_accessor_storage"}),
 * 		nil, // postfixToken
 * 		nil, // typeNode
 * 		initializer,
 * 	)
 * }
 */
export function createAccessorPropertyBackingField(f: GoPtr<NodeFactory>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, initializer: GoPtr<Expression>): GoPtr<Node> {
  return NodeFactory_UpdatePropertyDeclaration(
    f!.__tsgoEmbedded0!,
    node,
    modifiers,
    NodeFactory_NewGeneratedPrivateNameForNodeEx(f, node!.name as unknown as GoPtr<Node>, { Flags: GeneratedIdentifierFlagsNone, Prefix: "", Suffix: "_accessor_storage" } as AutoGenerateOptions) as unknown as GoPtr<never>,
    undefined,
    undefined,
    initializer,
  );
}
