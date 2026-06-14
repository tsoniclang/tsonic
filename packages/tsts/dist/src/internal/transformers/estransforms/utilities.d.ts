import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { ModifierList, Node, NodeVisitor } from "../../ast/spine.js";
import type { CallExpression, ClassDeclaration, PropertyDeclaration } from "../../ast/generated/data.js";
import type { Expression, IdentifierNode } from "../../ast/generated/unions.js";
import type { OrderedSet } from "../../collections/ordered_set.js";
import type { EmitContext } from "../../printer/emitcontext.js";
import type { NodeFactory } from "../../printer/factory.js";
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
export declare function convertClassDeclarationToClassExpression(emitContext: GoPtr<EmitContext>, node: GoPtr<ClassDeclaration>): GoPtr<Expression>;
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
export declare function createNotNullCondition(emitContext: GoPtr<EmitContext>, left: GoPtr<Node>, right: GoPtr<Node>, invert: bool): GoPtr<Node>;
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
export declare function superAccessState_initSuperAccessVisitor(receiver: GoPtr<superAccessState>, emitContext: GoPtr<EmitContext>, factory: GoPtr<NodeFactory>): void;
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
export declare function superAccessState_visitSuperAccessNode(receiver: GoPtr<superAccessState>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/utilities.go::method::superAccessState.substituteSuperAccessesInBody","kind":"method","status":"implemented","sigHash":"2928106c0afd70dba32ba296c179ff2026bdcdf6376b4d697a6a99bc049bd71a","bodyHash":"d46909746c3882d385323e3823cd3b2b877136a1d6e12200770018dfa6fc66fc"}
 *
 * Go source:
 * func (s *superAccessState) substituteSuperAccessesInBody(body *ast.Node) *ast.Node {
 * 	return s.superAccessVisitor.VisitNode(body)
 * }
 */
export declare function superAccessState_substituteSuperAccessesInBody(receiver: GoPtr<superAccessState>, body: GoPtr<Node>): GoPtr<Node>;
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
export declare function superAccessState_substituteCallExpressionWithSuperAccess(receiver: GoPtr<superAccessState>, call: GoPtr<CallExpression>, visitor: GoPtr<NodeVisitor>): GoPtr<Node>;
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
export declare function superAccessState_createSuperElementAccessInAsyncMethod(receiver: GoPtr<superAccessState>, argumentExpression: GoPtr<Node>): GoPtr<Node>;
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
export declare function superAccessState_createSuperAccessVariableStatement(receiver: GoPtr<superAccessState>): GoPtr<Node>;
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
export declare function superAccessState_trackSuperAccess(receiver: GoPtr<superAccessState>, node: GoPtr<Node>): void;
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
export declare function createAccessorPropertyBackingField(f: GoPtr<NodeFactory>, node: GoPtr<PropertyDeclaration>, modifiers: GoPtr<ModifierList>, initializer: GoPtr<Expression>): GoPtr<Node>;
//# sourceMappingURL=utilities.d.ts.map