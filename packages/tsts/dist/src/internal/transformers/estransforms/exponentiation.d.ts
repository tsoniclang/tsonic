import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { BinaryExpression } from "../../ast/generated/data.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::type::exponentiationTransformer","kind":"type","status":"implemented","sigHash":"ebc8b5b371fca078fe4ad9e897c21e1f94e1212d3d77cfcf3fb427b3fa484a80","bodyHash":"2523adac1feebbc2203b099649dbe314c593b2a554179a79c9641e4a54835db1"}
 *
 * Go source:
 * exponentiationTransformer struct {
 * 	transformers.Transformer
 * }
 */
export interface exponentiationTransformer {
    readonly __tsgoEmbedded0?: Transformer;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::method::exponentiationTransformer.visit","kind":"method","status":"implemented","sigHash":"e9ffa2c1f873f6d47b807b42d38df63e8293d2948ddd39f8523ab4050504be6d","bodyHash":"59dc4e5dcf3a832757960f3d656aefee81e7d2248b4b2d19b45c0f2e39e2d4a7"}
 *
 * Go source:
 * func (ch *exponentiationTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsExponentiationOperator == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindBinaryExpression:
 * 		return ch.visitBinaryExpression(node.AsBinaryExpression())
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export declare function exponentiationTransformer_visit(receiver: GoPtr<exponentiationTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::method::exponentiationTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"610f3653de7e3635bd7c5b337d878d462956fca6ffc88757b446bbddc4de8018","bodyHash":"5929fefe7812d357db0abf32cd3f53a1397d5ed9e6a1fe9373f5b7096143dfdf"}
 *
 * Go source:
 * func (ch *exponentiationTransformer) visitBinaryExpression(node *ast.BinaryExpression) *ast.Node {
 * 	switch node.OperatorToken.Kind {
 * 	case ast.KindAsteriskAsteriskEqualsToken:
 * 		return ch.visitExponentiationAssignmentExpression(node)
 * 	case ast.KindAsteriskAsteriskToken:
 * 		return ch.visitExponentiationExpression(node)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export declare function exponentiationTransformer_visitBinaryExpression(receiver: GoPtr<exponentiationTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::method::exponentiationTransformer.visitExponentiationAssignmentExpression","kind":"method","status":"implemented","sigHash":"ab27c5291c1329e5dffe20ad47c1f6c7363befa3a5c27e53fb176499935bbb35","bodyHash":"a1c731db2cb431397422085332286a7354a715b6327288cbe23067f0e887e933"}
 *
 * Go source:
 * func (ch *exponentiationTransformer) visitExponentiationAssignmentExpression(node *ast.BinaryExpression) *ast.Node {
 * 	var target *ast.Node
 * 	var value *ast.Node
 * 	left := ch.Visitor().VisitNode(node.Left)
 * 	right := ch.Visitor().VisitNode(node.Right)
 * 	if ast.IsElementAccessExpression(left) {
 * 		// Transforms `a[x] **= b` into `(_a = a)[_x = x] = Math.pow(_a[_x], b)`
 * 		expressionTemp := ch.Factory().NewTempVariable()
 * 		ch.EmitContext().AddVariableDeclaration(expressionTemp)
 * 		argumentExpressionTemp := ch.Factory().NewTempVariable()
 * 		ch.EmitContext().AddVariableDeclaration(argumentExpressionTemp)
 *
 * 		objExpr := ch.Factory().NewAssignmentExpression(expressionTemp, left.Expression())
 * 		objExpr.Loc = left.Expression().Loc
 * 		accessExpr := ch.Factory().NewAssignmentExpression(argumentExpressionTemp, left.AsElementAccessExpression().ArgumentExpression)
 * 		accessExpr.Loc = left.AsElementAccessExpression().ArgumentExpression.Loc
 *
 * 		target = ch.Factory().NewElementAccessExpression(objExpr, nil, accessExpr, ast.NodeFlagsNone)
 *
 * 		value = ch.Factory().NewElementAccessExpression(expressionTemp, nil, argumentExpressionTemp, ast.NodeFlagsNone)
 * 		value.Loc = left.Loc
 * 	} else if ast.IsPropertyAccessExpression(left) {
 * 		// Transforms `a.x **= b` into `(_a = a).x = Math.pow(_a.x, b)`
 * 		expressionTemp := ch.Factory().NewTempVariable()
 * 		ch.EmitContext().AddVariableDeclaration(expressionTemp)
 * 		assignment := ch.Factory().NewAssignmentExpression(expressionTemp, left.Expression())
 * 		assignment.Loc = left.Expression().Loc
 * 		target = ch.Factory().NewPropertyAccessExpression(assignment, nil, left.Name(), ast.NodeFlagsNone)
 * 		target.Loc = left.Loc
 *
 * 		value = ch.Factory().NewPropertyAccessExpression(expressionTemp, nil, left.Name(), ast.NodeFlagsNone)
 * 		value.Loc = left.Loc
 * 	} else {
 * 		// Transforms `a **= b` into `a = Math.pow(a, b)`
 * 		target = left
 * 		value = left
 * 	}
 *
 * 	rhs := ch.Factory().NewGlobalMethodCall("Math", "pow", []*ast.Node{value, right})
 * 	rhs.Loc = node.Loc
 * 	result := ch.Factory().NewAssignmentExpression(target, rhs)
 * 	result.Loc = node.Loc
 * 	return result
 * }
 */
export declare function exponentiationTransformer_visitExponentiationAssignmentExpression(receiver: GoPtr<exponentiationTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::method::exponentiationTransformer.visitExponentiationExpression","kind":"method","status":"implemented","sigHash":"840f8f322ebeae75744a71fbc019e3e036e7f919bd27e8b9aaff8f2894840534","bodyHash":"1b59c8a8f4f9245cf1720a38b6b1f126b11cdcdf120b6b995970a597b7c8fde0"}
 *
 * Go source:
 * func (ch *exponentiationTransformer) visitExponentiationExpression(node *ast.BinaryExpression) *ast.Node {
 * 	left := ch.Visitor().VisitNode(node.Left)
 * 	right := ch.Visitor().VisitNode(node.Right)
 * 	result := ch.Factory().NewGlobalMethodCall("Math", "pow", []*ast.Node{left, right})
 * 	result.Loc = node.Loc
 * 	return result
 * }
 */
export declare function exponentiationTransformer_visitExponentiationExpression(receiver: GoPtr<exponentiationTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/exponentiation.go::func::newExponentiationTransformer","kind":"func","status":"implemented","sigHash":"e22a9d453704aac914a1496f5ec2ba3f80ded705229015f0dedeb6db3539bff0","bodyHash":"3967ffaf60b99de5955a84e78968df523f5efdb499c6b9a0e97422ad7ce87764"}
 *
 * Go source:
 * func newExponentiationTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &exponentiationTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function newExponentiationTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
//# sourceMappingURL=exponentiation.d.ts.map