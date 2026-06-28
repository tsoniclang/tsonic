import { Node_SubtreeFacts } from "../../ast/spine.js";
import { AsCatchClause } from "../../ast/generated/casts.js";
import { KindCatchClause } from "../../ast/generated/kinds.js";
import { SubtreeContainsMissingCatchClauseVariable } from "../../ast/subtreefacts.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitNode } from "../../ast/visitor.js";
import { NewCatchClause, NewVariableDeclaration } from "../../ast/generated/factory.js";
import { Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeFactory_NewTempVariable } from "../../printer/factory.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalcatch.go::method::optionalCatchTransformer.visit","kind":"method","status":"implemented","sigHash":"d006030adec850592ad0e4b73a9a54bbba4af16d5aa499394e95da273096da44","bodyHash":"60b5a12b20b56f052ede051f03f04c48e48c772dd3c2168da6420decd6f8875d"}
 *
 * Go source:
 * func (ch *optionalCatchTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.SubtreeFacts()&ast.SubtreeContainsMissingCatchClauseVariable == 0 {
 * 		return node
 * 	}
 * 	switch node.Kind {
 * 	case ast.KindCatchClause:
 * 		return ch.visitCatchClause(node.AsCatchClause())
 * 	default:
 * 		return ch.Visitor().VisitEachChild(node)
 * 	}
 * }
 */
export function optionalCatchTransformer_visit(receiver, node) {
    if ((Node_SubtreeFacts(node) & SubtreeContainsMissingCatchClauseVariable) === 0) {
        return node;
    }
    switch (node.Kind) {
        case KindCatchClause:
            return optionalCatchTransformer_visitCatchClause(receiver, AsCatchClause(node));
        default:
            return NodeVisitor_VisitEachChild(Transformer_Visitor(receiver.__tsgoEmbedded0), node);
    }
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalcatch.go::method::optionalCatchTransformer.visitCatchClause","kind":"method","status":"implemented","sigHash":"a9ab0288f55ad0975583c7cb14e87bbfde73fde570a61eae2bd7d2a74a7d91a1","bodyHash":"aa54f5c009b48e26cdd7888777494c1c90533caf883b4866dd3146a5ed202f40"}
 *
 * Go source:
 * func (ch *optionalCatchTransformer) visitCatchClause(node *ast.CatchClause) *ast.Node {
 * 	if node.VariableDeclaration == nil {
 * 		return ch.Factory().NewCatchClause(
 * 			ch.Factory().NewVariableDeclaration(ch.Factory().NewTempVariable(), nil, nil, nil),
 * 			ch.Visitor().Visit(node.Block),
 * 		)
 * 	}
 * 	return ch.Visitor().VisitEachChild(node.AsNode())
 * }
 */
export function optionalCatchTransformer_visitCatchClause(receiver, node) {
    const printerFactory = Transformer_Factory(receiver.__tsgoEmbedded0);
    const astFactory = printerFactory.__tsgoEmbedded0;
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    if (node.VariableDeclaration === undefined) {
        return NewCatchClause(astFactory, NewVariableDeclaration(astFactory, NodeFactory_NewTempVariable(printerFactory), undefined, undefined, undefined), NodeVisitor_VisitNode(visitor, node.Block));
    }
    return NodeVisitor_VisitEachChild(visitor, node);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalcatch.go::func::newOptionalCatchTransformer","kind":"func","status":"implemented","sigHash":"c1cb7d528651ae4682a2912fc86fe8165864353ed1ad9bc8c423d4558411196a","bodyHash":"8f059b9e0868fa363c198df670de918b1ad3c2e8e3366551762cfb8979f4e63a"}
 *
 * Go source:
 * func newOptionalCatchTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &optionalCatchTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export function newOptionalCatchTransformer(opts) {
    const tx = {
        __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
    };
    return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => optionalCatchTransformer_visit(tx, node), opts.Context);
}
//# sourceMappingURL=optionalcatch.js.map