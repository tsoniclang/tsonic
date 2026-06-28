import { ModifierFlagsNone, ModifierToFlag } from "../ast/modifierflags.js";
import { NodeVisitor_VisitModifiers } from "../ast/visitor.js";
import { Transformer_NewTransformer } from "./transformer.js";
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
export function modifierVisitor_visit(receiver, node) {
    const flags = ModifierToFlag(node.Kind);
    if (flags !== ModifierFlagsNone && ((flags & receiver.AllowedModifiers) >>> 0) === 0) {
        return undefined;
    }
    return node;
}
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
export function ExtractModifiers(emitContext, modifiers, allowed) {
    if (modifiers === undefined) {
        return undefined;
    }
    const tx = {
        __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
        AllowedModifiers: allowed,
    };
    Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => modifierVisitor_visit(tx, node), emitContext);
    return NodeVisitor_VisitModifiers(tx.__tsgoEmbedded0.visitor, modifiers);
}
//# sourceMappingURL=modifiervisitor.js.map