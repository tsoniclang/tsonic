import type { GoPtr } from "../../../go/compat.js";
import type { Node } from "../../ast/spine.js";
import type { SourceFile } from "../../ast/ast.js";
import type { CompilerOptions } from "../../core/compileroptions.js";
import type { EmitResolver } from "../../printer/emitresolver.js";
import type { TransformOptions } from "../chain.js";
import type { Transformer } from "../transformer.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/inliners/constenum.go::type::ConstEnumInliningTransformer","kind":"type","status":"implemented","sigHash":"ecdbca83f63930f40db6a6ae877fa8d363d0ce5820a063479cbd7a397c1a33e5","bodyHash":"c2fccfbdedb669f62fdf04ab70fbcc081c6139452239bd1e1fc42183fda9d06c"}
 *
 * Go source:
 * ConstEnumInliningTransformer struct {
 * 	transformers.Transformer
 * 	compilerOptions   *core.CompilerOptions
 * 	currentSourceFile *ast.SourceFile
 * 	emitResolver      printer.EmitResolver
 * }
 */
export interface ConstEnumInliningTransformer {
    readonly __tsgoEmbedded0?: Transformer;
    compilerOptions: GoPtr<CompilerOptions>;
    currentSourceFile: GoPtr<SourceFile>;
    emitResolver: EmitResolver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/inliners/constenum.go::func::NewConstEnumInliningTransformer","kind":"func","status":"implemented","sigHash":"861521886af5886f8f9d602e1005ac4ae1ddb59336f6ad96160fd49fd3f6f73a","bodyHash":"eb8fda72a538e530968692e27f7c2342aab6521080d04ff2060cfd4bc52ca4f2"}
 *
 * Go source:
 * func NewConstEnumInliningTransformer(opt *transformers.TransformOptions) *transformers.Transformer {
 * 	compilerOptions := opt.CompilerOptions
 * 	emitContext := opt.Context
 * 	if compilerOptions.GetIsolatedModules() {
 * 		debug.Fail("const enums are not inlined under isolated modules")
 * 	}
 * 	tx := &ConstEnumInliningTransformer{compilerOptions: compilerOptions, emitResolver: opt.EmitResolver}
 * 	return tx.NewTransformer(tx.visit, emitContext)
 * }
 */
export declare function NewConstEnumInliningTransformer(opt: GoPtr<TransformOptions>): GoPtr<Transformer>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/inliners/constenum.go::method::ConstEnumInliningTransformer.visit","kind":"method","status":"implemented","sigHash":"35aa6753d09b1c46da81bb717bb90e4fa9770fccbee16e4692a5a94fcca89b66","bodyHash":"e31d926fe05494c1c4c64d12f6a1babec522b9d03e2a465bd26cd1bd12357bb3"}
 *
 * Go source:
 * func (tx *ConstEnumInliningTransformer) visit(node *ast.Node) *ast.Node {
 * 	switch node.Kind {
 * 	case ast.KindPropertyAccessExpression, ast.KindElementAccessExpression:
 * 		{
 * 			parse := tx.EmitContext().ParseNode(node)
 * 			if parse == nil {
 * 				return tx.Visitor().VisitEachChild(node)
 * 			}
 * 			value := tx.emitResolver.GetConstantValue(parse)
 * 			if value != nil {
 * 				var replacement *ast.Node
 * 				switch v := value.(type) {
 * 				case jsnum.Number:
 * 					if v.IsInf() {
 * 						if v.Abs() == v {
 * 							replacement = tx.Factory().NewIdentifier("Infinity")
 * 						} else {
 * 							replacement = tx.Factory().NewPrefixUnaryExpression(ast.KindMinusToken, tx.Factory().NewIdentifier("Infinity"))
 * 						}
 * 					} else if v.IsNaN() {
 * 						replacement = tx.Factory().NewIdentifier("NaN")
 * 					} else if v.Abs() == v {
 * 						replacement = tx.Factory().NewNumericLiteral(v.String(), ast.TokenFlagsNone)
 * 					} else {
 * 						replacement = tx.Factory().NewPrefixUnaryExpression(ast.KindMinusToken, tx.Factory().NewNumericLiteral(v.Abs().String(), ast.TokenFlagsNone))
 * 					}
 * 				case string:
 * 					replacement = tx.Factory().NewStringLiteral(v, ast.TokenFlagsNone)
 * 				case jsnum.PseudoBigInt: // technically not supported by strada, and issues a checker error, handled here for completeness
 * 					if v == (jsnum.PseudoBigInt{}) {
 * 						replacement = tx.Factory().NewBigIntLiteral("0", ast.TokenFlagsNone)
 * 					} else if !v.Negative {
 * 						replacement = tx.Factory().NewBigIntLiteral(v.Base10Value, ast.TokenFlagsNone)
 * 					} else {
 * 						replacement = tx.Factory().NewPrefixUnaryExpression(ast.KindMinusToken, tx.Factory().NewBigIntLiteral(v.Base10Value, ast.TokenFlagsNone))
 * 					}
 * 				}
 *
 * 				if tx.compilerOptions.RemoveComments.IsFalseOrUnknown() {
 * 					original := tx.EmitContext().MostOriginal(node)
 * 					if original != nil && !ast.NodeIsSynthesized(original) {
 * 						originalText := scanner.GetTextOfNode(original)
 * 						escapedText := safeMultiLineComment(originalText)
 * 						tx.EmitContext().AddSyntheticTrailingComment(replacement, ast.KindMultiLineCommentTrivia, escapedText, false)
 * 					}
 * 				}
 * 				return replacement
 * 			}
 * 			return tx.Visitor().VisitEachChild(node)
 * 		}
 * 	}
 * 	return tx.Visitor().VisitEachChild(node)
 * }
 */
export declare function ConstEnumInliningTransformer_visit(receiver: GoPtr<ConstEnumInliningTransformer>, node: GoPtr<Node>): GoPtr<Node>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/transformers/inliners/constenum.go::func::safeMultiLineComment","kind":"func","status":"implemented","sigHash":"0a059f8de7a03ba6a3f0fb48247500c6844d5422cf1ae3bf00ea434876521113","bodyHash":"28e28a3c4763b3379c6c33405cf7f58d2d67cdf8ccdbdd14630e6978eb2eae49"}
 *
 * Go source:
 * func safeMultiLineComment(text string) string {
 * 	var b strings.Builder
 * 	b.Grow(len(text) + 2)
 * 	b.WriteByte(' ')
 * 	for {
 * 		i := strings.Index(text, "* /")
 * 		if i < 0 {
 * 			break
 * 		}
 * 		b.WriteString(text[:i])
 * 		b.WriteString("*_/")
 * 		text = text[i+2:]
 * 	}
 * 	b.WriteString(text)
 * 	b.WriteByte(' ')
 * 	return b.String()
 * }
 */
export declare function safeMultiLineComment(text: string): string;
//# sourceMappingURL=constenum.d.ts.map