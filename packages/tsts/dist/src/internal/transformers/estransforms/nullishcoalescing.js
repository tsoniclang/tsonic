import { Node_SubtreeFacts } from "../../ast/spine.js";
import { AsBinaryExpression } from "../../ast/generated/casts.js";
import { KindBinaryExpression, KindQuestionQuestionToken, KindColonToken, KindQuestionToken } from "../../ast/generated/kinds.js";
import { NewConditionalExpression, NewToken } from "../../ast/generated/factory.js";
import { SubtreeContainsNullishCoalescing } from "../../ast/subtreefacts.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode } from "../../ast/visitor.js";
import { EmitContext_AddVariableDeclaration } from "../../printer/emitcontext.js";
import { NodeFactory_NewAssignmentExpression, NodeFactory_NewTempVariable } from "../../printer/factory.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { IsSimpleCopiableExpression } from "../utilities.js";
import { createNotNullCondition } from "./utilities.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/nullishcoalescing.go::method::nullishCoalescingTransformer.visit","kind":"method","status":"implemented","sigHash":"a39451f7bffd2d9f965f4475e2105cc0b2ba9ca3607309a415ded3a733de7552","bodyHash":"b380e17afdfc6dd467d12eda3af996931ce4e87c11ef089df05cd95ee56dcdea"}
 *
 * Go source:
 * func (ch *nullishCoalescingTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsNullishCoalescing == 0 {
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
export function nullishCoalescingTransformer_visit(receiver, node) {
    if ((Node_SubtreeFacts(node) & SubtreeContainsNullishCoalescing) === 0) {
        return node;
    }
    switch (node.Kind) {
        case KindBinaryExpression:
            return nullishCoalescingTransformer_visitBinaryExpression(receiver, AsBinaryExpression(node));
        default:
            return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver.__tsgoEmbedded0), node);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/nullishcoalescing.go::method::nullishCoalescingTransformer.visitBinaryExpression","kind":"method","status":"implemented","sigHash":"611efa27abe4213570f4419936858063218b97635130c33b8e236b046c24114e","bodyHash":"5101da77664c9276d9162065fc58df9efd480d3b103104628af4dd39142795b7"}
 *
 * Go source:
 * func (ch *nullishCoalescingTransformer) visitBinaryExpression(node *ast.BinaryExpression) *ast.Node {
 * 	switch node.OperatorToken.Kind {
 * 	case ast.KindQuestionQuestionToken:
 * 		left := ch.Visitor().VisitNode(node.Left)
 * 		right := left
 * 		if !transformers.IsSimpleCopiableExpression(left) {
 * 			right = ch.Factory().NewTempVariable()
 * 			ch.EmitContext().AddVariableDeclaration(right)
 * 			left = ch.Factory().NewAssignmentExpression(right, left)
 * 		}
 * 		return ch.Factory().NewConditionalExpression(
 * 			createNotNullCondition(ch.EmitContext(), left, right, false),
 * 			ch.Factory().NewToken(ast.KindQuestionToken),
 * 			right,
 * 			ch.Factory().NewToken(ast.KindColonToken),
 * 			ch.Visitor().VisitNode(node.Right),
 * 		)
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node.AsNode())
 * 	}
 * }
 */
export function nullishCoalescingTransformer_visitBinaryExpression(receiver, node) {
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    const printerFactory = Transformer_Factory(receiver.__tsgoEmbedded0);
    const astFactory = printerFactory.__tsgoEmbedded0;
    const emitCtx = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    switch (node.OperatorToken.Kind) {
        case KindQuestionQuestionToken: {
            let left = NodeVisitor_VisitNode(visitor, node.Left);
            let right = left;
            if (!IsSimpleCopiableExpression(left)) {
                right = NodeFactory_NewTempVariable(printerFactory);
                EmitContext_AddVariableDeclaration(emitCtx, right);
                left = NodeFactory_NewAssignmentExpression(printerFactory, right, left);
            }
            return NewConditionalExpression(astFactory, createNotNullCondition(emitCtx, left, right, false), NewToken(astFactory, KindQuestionToken), right, NewToken(astFactory, KindColonToken), NodeVisitor_VisitNode(visitor, node.Right));
        }
        default:
            return NodeVisitor_VisitEachChild(visitor, node);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/nullishcoalescing.go::func::newNullishCoalescingTransformer","kind":"func","status":"implemented","sigHash":"4e9f9607161ee0db118659b729bc627d12ea4f44d6c82e4994c3a6a159f5da36","bodyHash":"cf07f8e210e734f1bfd588411207e1ec863cfd21145f40380dce7a6e49cc17c5"}
 *
 * Go source:
 * func newNullishCoalescingTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &nullishCoalescingTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newNullishCoalescingTransformer(opts) {
    const tx = {
        __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    };
    return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => nullishCoalescingTransformer_visit(tx, node), opts.Context);
}
//# sourceMappingURL=nullishcoalescing.js.map