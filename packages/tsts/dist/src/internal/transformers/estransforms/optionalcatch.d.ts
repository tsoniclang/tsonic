import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { CatchClause } from "../../ast/generated/data.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalcatch.go::type::optionalCatchTransformer","kind":"type","status":"implemented","sigHash":"3011be7d52deec581e1efe8bc36962dc6bc0e545892e93866e9425326b15e948","bodyHash":"19bb8324119c0fd2ba82c3352a7abf4bf8f9e2a5e30b836798241cdb63153449"}
 *
 * Go source:
 * optionalCatchTransformer struct {
 * 	transformers.Transformer
 * }
 */
export interface optionalCatchTransformer {
    readonly __tsgoEmbedded0?: Transformer;
}
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
export declare function optionalCatchTransformer_visit(receiver: GoPtr<optionalCatchTransformer>, node: GoPtr<Node>): GoPtr<Node>;
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
export declare function optionalCatchTransformer_visitCatchClause(receiver: GoPtr<optionalCatchTransformer>, node: GoPtr<CatchClause>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/optionalcatch.go::func::newOptionalCatchTransformer","kind":"func","status":"implemented","sigHash":"c1cb7d528651ae4682a2912fc86fe8165864353ed1ad9bc8c423d4558411196a","bodyHash":"8f059b9e0868fa363c198df670de918b1ad3c2e8e3366551762cfb8979f4e63a"}
 *
 * Go source:
 * func newOptionalCatchTransformer(opts *transformers.TransformOptions) *transformers.Transformer {
 * 	tx := &optionalCatchTransformer{}
 * 	return tx.NewTransformer(tx.visit, opts.Context)
 * }
 */
export declare function newOptionalCatchTransformer(opts: GoPtr<TransformOptions>): GoPtr<Transformer>;
//# sourceMappingURL=optionalcatch.d.ts.map