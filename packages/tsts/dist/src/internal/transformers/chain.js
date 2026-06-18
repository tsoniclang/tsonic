import { NodeDefault_AsNode } from "../ast/spine.js";
import { AsSourceFile } from "../ast/ast.js";
import { KindSourceFile } from "../ast/generated/kinds.js";
import { Transformer_NewTransformer, Transformer_TransformSourceFile } from "./transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/chain.go::method::chainedTransformer.visit","kind":"method","status":"implemented","sigHash":"76b735d77978416328612ee41871d9358e9e38e5a14c34da05ebff41aacbd713","bodyHash":"c54a03d7644df2373d9a55e1a65d95515d7d5c4697ff6bb40a960b9420287db1"}
 *
 * Go source:
 * func (ch *chainedTransformer) visit(node *ast.Node) *ast.Node {
 * 	if node.Kind != ast.KindSourceFile {
 * 		panic("Chained transform passed non-sourcefile initial node")
 * 	}
 * 	result := node.AsSourceFile()
 * 	for _, t := range ch.components {
 * 		result = t.TransformSourceFile(result)
 * 	}
 * 	return result.AsNode()
 * }
 */
export function chainedTransformer_visit(receiver, node) {
    if (node.Kind !== KindSourceFile) {
        throw new globalThis.Error("Chained transform passed non-sourcefile initial node");
    }
    let result = AsSourceFile(node);
    for (const t of receiver.components) {
        result = Transformer_TransformSourceFile(t, result);
    }
    return NodeDefault_AsNode(result);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/chain.go::func::Chain","kind":"func","status":"implemented","sigHash":"ffa168786f13de590068dd19e5a154dca7785d7e6826fcd87d9d2df9825402b8","bodyHash":"84206909009d95f589a874e1b5db49cd02ccee2ba07e6f64725fc4b75ce1cec3"}
 *
 * Go source:
 * func Chain(transforms ...TransformerFactory) TransformerFactory {
 * 	if len(transforms) < 2 {
 * 		if len(transforms) == 0 {
 * 			panic("Expected some number of transforms to chain, but got none")
 * 		}
 * 		return transforms[0]
 * 	}
 * 	return func(opt *TransformOptions) *Transformer {
 * 		constructed := make([]*Transformer, 0, len(transforms))
 * 		for _, t := range transforms {
 * 			// TODO: flatten nested chains?
 * 			if result := t(opt); result != nil {
 * 				constructed = append(constructed, result)
 * 			}
 * 		}
 * 		switch len(constructed) {
 * 		case 0:
 * 			return nil
 * 		case 1:
 * 			return constructed[0]
 * 		}
 * 		ch := &chainedTransformer{components: constructed}
 * 		return ch.NewTransformer(ch.visit, opt.Context)
 * 	}
 * }
 */
export function Chain(...transforms) {
    if (transforms.length < 2) {
        if (transforms.length === 0) {
            throw new globalThis.Error("Expected some number of transforms to chain, but got none");
        }
        return transforms[0];
    }
    return (opt) => {
        const constructed = [];
        for (const t of transforms) {
            // TODO: flatten nested chains?
            const result = t(opt);
            if (result !== undefined) {
                constructed.push(result);
            }
        }
        switch (constructed.length) {
            case 0:
                return undefined;
            case 1:
                return constructed[0];
        }
        const ch = {
            __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
            components: constructed,
        };
        return Transformer_NewTransformer(ch.__tsgoEmbedded0, (node) => chainedTransformer_visit(ch, node), opt.Context);
    };
}
//# sourceMappingURL=chain.js.map