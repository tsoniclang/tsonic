import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { EmitContext } from "../../printer/emitcontext.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/estransforms/classthis.go::func::isClassThisAssignmentBlock","kind":"func","status":"implemented","sigHash":"36e6e9ea32a486cc285e12ffdec2a589da9fcec331f9b214d95e87dea5a80d8e","bodyHash":"3ef57f77c6d56532349703c998cc708f5f3523fdc3fb4ee1dc3b89139d174f95"}
 *
 * Go source:
 * func isClassThisAssignmentBlock(emitContext *printer.EmitContext, node *ast.Node) bool {
 * 	if ast.IsClassStaticBlockDeclaration(node) {
 * 		n := node.AsClassStaticBlockDeclaration()
 * 		body := n.Body.AsBlock()
 * 		if len(body.Statements.Nodes) == 1 {
 * 			statement := body.Statements.Nodes[0]
 * 			if ast.IsExpressionStatement(statement) {
 * 				expression := statement.Expression()
 * 				if ast.IsAssignmentExpression(expression, true /*excludeCompoundAssignment* /) {
 * 					binary := expression.AsBinaryExpression()
 * 					return ast.IsIdentifier(binary.Left) &&
 * 						emitContext.ClassThis(node) == binary.Left &&
 * 						binary.Right.Kind == ast.KindThisKeyword
 * 				}
 * 			}
 * 		}
 * 	}
 * 	return false
 * }
 */
export declare function isClassThisAssignmentBlock(emitContext: GoPtr<EmitContext>, node: GoPtr<Node>): bool;
//# sourceMappingURL=classthis.d.ts.map