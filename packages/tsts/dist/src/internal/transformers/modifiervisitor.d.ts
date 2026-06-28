import type { GoPtr } from "../../go/compat.js";
import type { ModifierList, Node } from "../ast/spine.js";
import type { ModifierFlags } from "../ast/modifierflags.js";
import type { EmitContext } from "../printer/emitcontext.js";
import type { Transformer } from "./transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/modifiervisitor.go::type::modifierVisitor","kind":"type","status":"implemented","sigHash":"04d132d918160f7b08793e75f53c42347aae4a8358fe0344509a3c3bf6136ef1","bodyHash":"cdee65c2e92c5822528c8aba69758424ed1776ee3932033aab75078bced25447"}
 *
 * Go source:
 * modifierVisitor struct {
 * 	Transformer
 * 	AllowedModifiers ast.ModifierFlags
 * }
 */
export interface modifierVisitor {
    readonly __tsgoEmbedded0?: Transformer;
    AllowedModifiers: ModifierFlags;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/modifiervisitor.go::method::modifierVisitor.visit","kind":"method","status":"implemented","sigHash":"a425495b08c15499f6537d493c29bb3f25b65e0031a10fda2c0c6f3adf5f78d0","bodyHash":"f7da016c16f5a2ec61279f105d0ad8f2bd5d01bebe82ba5d21f1f6f56d8951f3"}
 *
 * Go source:
 * func (v *modifierVisitor) visit(node *ast.Node) *ast.Node {
 * 	flags := ast.ModifierToFlag(node.Kind)
 * 	if flags != ast.ModifierFlagsNone && flags&v.AllowedModifiers == 0 {
 * 		return nil
 * 	}
 * 	return node
 * }
 */
export declare function modifierVisitor_visit(receiver: GoPtr<modifierVisitor>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/modifiervisitor.go::func::ExtractModifiers","kind":"func","status":"implemented","sigHash":"fd15121c1ac8dc6af27c1e49c846a4cab79b95f5273335992aec0c4dd795ba76","bodyHash":"54545be35aad007d62aa6d48a472e63a4f6af68362df2614b6a91fb89502e735"}
 *
 * Go source:
 * func ExtractModifiers(emitContext *printer.EmitContext, modifiers *ast.ModifierList, allowed ast.ModifierFlags) *ast.ModifierList {
 * 	if modifiers == nil {
 * 		return nil
 * 	}
 * 	tx := modifierVisitor{AllowedModifiers: allowed}
 * 	tx.NewTransformer(tx.visit, emitContext)
 * 	return tx.visitor.VisitModifiers(modifiers)
 * }
 */
export declare function ExtractModifiers(emitContext: GoPtr<EmitContext>, modifiers: GoPtr<ModifierList>, allowed: ModifierFlags): GoPtr<ModifierList>;
//# sourceMappingURL=modifiervisitor.d.ts.map