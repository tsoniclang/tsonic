import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { BinaryExpression } from "../../ast/generated/data.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/logicalassignment.go::type::logicalAssignmentTransformer","kind":"type","status":"implemented","sigHash":"b09bb19ec1eadb5a9ace607f3a03d261b660c1f10d6f675a7b9e007e082efa21","bodyHash":"ebd8aaa8280e61cfad975e2cc1ba9b40d3dabe297c2de9a927d9175e9ed0c717"}
 *
 * Go source:
 * logicalAssignmentTransformer struct {
 * 	transformers.Transformer
 * }
 */
export interface logicalAssignmentTransformer {
    readonly __tsgoEmbedded0?: Transformer;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/logicalassignment.go::method::logicalAssignmentTransformer.visit","kind":"method","status":"implemented","sigHash":"76107665c519402058410017851c730012ebb9e739a3c64d42de3c73b580a1c4","bodyHash":"2f4915ccd08336efef7a11e0ee8bd12bba3b0282992decafa8af17694adbdd89"}
 *
 * Go source:
 * func (ch *logicalAssignmentTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsLogicalAssignments == 0 {
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
export declare function logicalAssignmentTransformer_visit(receiver: GoPtr<logicalAssignmentTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/logicalassignment.go::method::logicalAssignmentTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"f08c96530ad57f7e2137a8262108e7ecec70069da4ff940031827e9cacec2fcc","bodyHash":"c3edacf773fac35d4f906b654569578ca7a423f91e214796e7c583b0ff945b50"}
 *
 * Go source:
 * func (ch *logicalAssignmentTransformer) visitBinaryExpression(node *ast.BinaryExpression) *ast.Node {
 * 	var nonAssignmentOperator ast.Kind
 * 	switch node.OperatorToken.Kind {
 * 	case ast.KindBarBarEqualsToken:
 * 		nonAssignmentOperator = ast.KindBarBarToken
 * 	case ast.KindAmpersandAmpersandEqualsToken:
 * 		nonAssignmentOperator = ast.KindAmpersandAmpersandToken
 * 	case ast.KindQuestionQuestionEqualsToken:
 * 		nonAssignmentOperator = ast.KindQuestionQuestionToken
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node.AsNode())
 * 	}
 *
 * 	left := ast.SkipParentheses(ch.Visitor().VisitNode(node.Left))
 * 	assignmentTarget := left
 * 	right := ast.SkipParentheses(ch.Visitor().VisitNode(node.Right))
 *
 * 	if ast.IsAccessExpression(left) {
 * 		propertyAccessTargetSimpleCopiable := transformers.IsSimpleCopiableExpression(left.Expression())
 * 		propertyAccessTarget := left.Expression()
 * 		propertyAccessTargetAssignment := left.Expression()
 * 		if !propertyAccessTargetSimpleCopiable {
 * 			propertyAccessTarget = ch.Factory().NewTempVariable()
 * 			ch.EmitContext().AddVariableDeclaration(propertyAccessTarget)
 * 			propertyAccessTargetAssignment = ch.Factory().NewAssignmentExpression(
 * 				propertyAccessTarget,
 * 				left.Expression(),
 * 			)
 * 		}
 *
 * 		if ast.IsPropertyAccessExpression(left) {
 * 			assignmentTarget = ch.Factory().NewPropertyAccessExpression(
 * 				propertyAccessTarget,
 * 				nil,
 * 				left.Name(),
 * 				ast.NodeFlagsNone,
 * 			)
 * 			left = ch.Factory().NewPropertyAccessExpression(
 * 				propertyAccessTargetAssignment,
 * 				nil,
 * 				left.Name(),
 * 				ast.NodeFlagsNone,
 * 			)
 * 		} else {
 * 			elementAccessArgumentSimpleCopiable := transformers.IsSimpleCopiableExpression(left.AsElementAccessExpression().ArgumentExpression)
 * 			elementAccessArgument := left.AsElementAccessExpression().ArgumentExpression
 * 			argumentExpr := elementAccessArgument
 * 			if !elementAccessArgumentSimpleCopiable {
 * 				elementAccessArgument = ch.Factory().NewTempVariable()
 * 				ch.EmitContext().AddVariableDeclaration(elementAccessArgument)
 * 				argumentExpr = ch.Factory().NewAssignmentExpression(
 * 					elementAccessArgument,
 * 					left.AsElementAccessExpression().ArgumentExpression,
 * 				)
 * 			}
 *
 * 			assignmentTarget = ch.Factory().NewElementAccessExpression(
 * 				propertyAccessTarget,
 * 				nil,
 * 				elementAccessArgument,
 * 				ast.NodeFlagsNone,
 * 			)
 * 			left = ch.Factory().NewElementAccessExpression(
 * 				propertyAccessTargetAssignment,
 * 				nil,
 * 				argumentExpr,
 * 				ast.NodeFlagsNone,
 * 			)
 * 		}
 *
 * 	}
 *
 * 	return ch.Factory().NewBinaryExpression(
 * 		nil,
 * 		left,
 * 		nil,
 * 		ch.Factory().NewToken(nonAssignmentOperator),
 * 		ch.Factory().NewParenthesizedExpression(
 * 			ch.Factory().NewAssignmentExpression(
 * 				assignmentTarget,
 * 				right,
 * 			),
 * 		),
 * 	)
 * }
 */
export declare function logicalAssignmentTransformer_visitBinaryExpression(receiver: GoPtr<logicalAssignmentTransformer>, node: GoPtr<BinaryExpression>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/logicalassignment.go::func::newLogicalAssignmentTransformer","kind":"func","status":"implemented","sigHash":"e668b93baec8d6b719a939426aa15c17c311d4d58fc95095a2e9ebf6ce198878","bodyHash":"047e678383f404e4921ead21b8dcac2ca9cdcf82e94f80c29e2e3db5c55c99cc"}
 *
 * Go source:
 * func newLogicalAssignmentTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &logicalAssignmentTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function newLogicalAssignmentTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
//# sourceMappingURL=logicalassignment.d.ts.map