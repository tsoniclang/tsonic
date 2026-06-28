import { Builder, Index } from "../../../go/strings.js";
import { AsBinaryExpression } from "../../ast/generated/casts.js";
import { KindBinaryExpression, KindElementAccessExpression, KindMinusToken, KindMultiLineCommentTrivia, KindPropertyAccessExpression } from "../../ast/generated/kinds.js";
import { NewBigIntLiteral, NewIdentifier, NewNumericLiteral, NewPrefixUnaryExpression, NewStringLiteral, NodeFactory_UpdateBinaryExpression } from "../../ast/generated/factory.js";
import { TokenFlagsNone } from "../../ast/tokenflags.js";
import { NodeIsSynthesized } from "../../ast/utilities.js";
import { CompilerOptions_GetIsolatedModules } from "../../core/compileroptions.js";
import { Tristate_IsFalseOrUnknown } from "../../core/tristate.js";
import { Fail } from "../../debug/debug.js";
import { Number_Abs, Number_IsInf, Number_IsNaN } from "../../jsnum/jsnum.js";
import { Number_String } from "../../jsnum/string.js";
import { EmitContext_AddSyntheticTrailingComment, EmitContext_MostOriginal, EmitContext_ParseNode } from "../../printer/emitcontext.js";
import { GetTextOfNode } from "../../scanner/utilities.js";
import { Transformer_EmitContext, Transformer_Factory, Transformer_NewTransformer, Transformer_Visitor } from "../transformer.js";
import { NodeVisitor_VisitEachChild, NodeVisitor_VisitModifiers, NodeVisitor_VisitNode } from "../../ast/visitor.js";
// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length and
// slices like `s[i:j]` operate on byte offsets. `strings.Index` likewise returns
// a byte offset, so we mirror that contract by operating over the UTF-8 byte view
// and converting back to a JS string at the boundaries.
const utf8Encoder = new globalThis.TextEncoder();
const utf8Decoder = new globalThis.TextDecoder("utf-8");
const byteSlice = (s, start, end) => {
    const bytes = utf8Encoder.encode(s);
    return utf8Decoder.decode(bytes.subarray(start, end));
};
const byteLen = (s) => utf8Encoder.encode(s).length;
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
export function NewConstEnumInliningTransformer(opt) {
    const compilerOptions = opt.CompilerOptions;
    const emitContext = opt.Context;
    if (CompilerOptions_GetIsolatedModules(compilerOptions)) {
        Fail("const enums are not inlined under isolated modules");
    }
    const tx = {
        __tsgoEmbedded0: { emitContext: undefined, factory: undefined, visitor: undefined },
        compilerOptions: compilerOptions,
        currentSourceFile: undefined,
        emitResolver: opt.EmitResolver,
    };
    return Transformer_NewTransformer(tx.__tsgoEmbedded0, (node) => ConstEnumInliningTransformer_visit(tx, node), emitContext);
}
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
export function ConstEnumInliningTransformer_visit(receiver, node) {
    const emitCtx = Transformer_EmitContext(receiver.__tsgoEmbedded0);
    const printerFactory = Transformer_Factory(receiver.__tsgoEmbedded0);
    const astFactory = printerFactory.__tsgoEmbedded0;
    const visitor = Transformer_Visitor(receiver.__tsgoEmbedded0);
    switch (node.Kind) {
        case KindBinaryExpression:
            return ConstEnumInliningTransformer_visitBinaryExpression(node, visitor, astFactory);
        case KindPropertyAccessExpression:
        case KindElementAccessExpression: {
            const parse = EmitContext_ParseNode(emitCtx, node);
            if (parse === undefined) {
                return NodeVisitor_VisitEachChild(visitor, node);
            }
            const value = receiver.emitResolver.GetConstantValue(parse);
            if (value !== undefined && value !== null) {
                let replacement;
                if (typeof value === "number") {
                    const v = value;
                    if (Number_IsInf(v)) {
                        if (Number_Abs(v) === v) {
                            replacement = NewIdentifier(astFactory, "Infinity");
                        }
                        else {
                            replacement = NewPrefixUnaryExpression(astFactory, KindMinusToken, NewIdentifier(astFactory, "Infinity"));
                        }
                    }
                    else if (Number_IsNaN(v)) {
                        replacement = NewIdentifier(astFactory, "NaN");
                    }
                    else if (Number_Abs(v) === v) {
                        replacement = NewNumericLiteral(astFactory, Number_String(v), TokenFlagsNone);
                    }
                    else {
                        replacement = NewPrefixUnaryExpression(astFactory, KindMinusToken, NewNumericLiteral(astFactory, Number_String(Number_Abs(v)), TokenFlagsNone));
                    }
                }
                else if (typeof value === "string") {
                    replacement = NewStringLiteral(astFactory, value, TokenFlagsNone);
                }
                else {
                    // PseudoBigInt - technically not supported, handled for completeness
                    const v = value;
                    if (v.Base10Value === "") {
                        replacement = NewBigIntLiteral(astFactory, "0", TokenFlagsNone);
                    }
                    else if (!v.Negative) {
                        replacement = NewBigIntLiteral(astFactory, v.Base10Value, TokenFlagsNone);
                    }
                    else {
                        replacement = NewPrefixUnaryExpression(astFactory, KindMinusToken, NewBigIntLiteral(astFactory, v.Base10Value, TokenFlagsNone));
                    }
                }
                if (Tristate_IsFalseOrUnknown(receiver.compilerOptions.RemoveComments)) {
                    const original = EmitContext_MostOriginal(emitCtx, node);
                    if (original !== undefined && !NodeIsSynthesized(original)) {
                        const originalText = GetTextOfNode(original);
                        const escapedText = safeMultiLineComment(originalText);
                        EmitContext_AddSyntheticTrailingComment(emitCtx, replacement, KindMultiLineCommentTrivia, escapedText, false);
                    }
                }
                return replacement;
            }
            return NodeVisitor_VisitEachChild(visitor, node);
        }
    }
    return NodeVisitor_VisitEachChild(visitor, node);
}
function ConstEnumInliningTransformer_visitBinaryExpression(node, visitor, astFactory) {
    const results = new Map();
    const stack = [{
            node: node,
            binary: AsBinaryExpression(node),
            step: 0,
            modifiers: undefined,
            left: undefined,
            typeNode: undefined,
            operatorToken: undefined,
            right: undefined,
        }];
    while (stack.length !== 0) {
        const frame = stack[stack.length - 1];
        const binary = frame.binary;
        if (frame.step === 0) {
            frame.modifiers = NodeVisitor_VisitModifiers(visitor, binary.modifiers);
            frame.step = 1;
            continue;
        }
        if (frame.step === 1) {
            if (binary.Left !== undefined && binary.Left.Kind === KindBinaryExpression && !results.has(binary.Left)) {
                stack.push({
                    node: binary.Left,
                    binary: AsBinaryExpression(binary.Left),
                    step: 0,
                    modifiers: undefined,
                    left: undefined,
                    typeNode: undefined,
                    operatorToken: undefined,
                    right: undefined,
                });
                continue;
            }
            frame.left = binary.Left !== undefined && binary.Left.Kind === KindBinaryExpression
                ? results.get(binary.Left)
                : NodeVisitor_VisitNode(visitor, binary.Left);
            frame.step = 2;
            continue;
        }
        if (frame.step === 2) {
            frame.typeNode = NodeVisitor_VisitNode(visitor, binary.Type);
            frame.step = 3;
            continue;
        }
        if (frame.step === 3) {
            frame.operatorToken = NodeVisitor_VisitNode(visitor, binary.OperatorToken);
            frame.step = 4;
            continue;
        }
        if (frame.step === 4) {
            if (binary.Right !== undefined && binary.Right.Kind === KindBinaryExpression && !results.has(binary.Right)) {
                stack.push({
                    node: binary.Right,
                    binary: AsBinaryExpression(binary.Right),
                    step: 0,
                    modifiers: undefined,
                    left: undefined,
                    typeNode: undefined,
                    operatorToken: undefined,
                    right: undefined,
                });
                continue;
            }
            frame.right = binary.Right !== undefined && binary.Right.Kind === KindBinaryExpression
                ? results.get(binary.Right)
                : NodeVisitor_VisitNode(visitor, binary.Right);
            frame.step = 5;
            continue;
        }
        const updated = NodeFactory_UpdateBinaryExpression(astFactory, binary, frame.modifiers, frame.left, frame.typeNode, frame.operatorToken, frame.right);
        results.set(frame.node, updated);
        stack.pop();
    }
    return results.get(node) ?? node;
}
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
export function safeMultiLineComment(text) {
    const b = new Builder();
    b.Grow((byteLen(text) + 2));
    b.WriteByte(0x20);
    for (;;) {
        const i = Index(text, "*/");
        if (i < 0) {
            break;
        }
        b.WriteString(byteSlice(text, 0, i));
        b.WriteString("*_/");
        text = byteSlice(text, (i + 2));
    }
    b.WriteString(text);
    b.WriteByte(0x20);
    return b.String();
}
//# sourceMappingURL=constenum.js.map