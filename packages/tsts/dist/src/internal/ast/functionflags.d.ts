import type { uint } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Node } from "./spine.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/functionflags.go::type::FunctionFlags","kind":"type","status":"implemented","sigHash":"ad2a4b940b1e5651fc938d16a803f2cce0d2eab389ccc956b19be9af960624bd","bodyHash":"e25f657560858fec2beb1c2b5a90b43445f28c936d70ad4cf8d406bfc0211079"}
 *
 * Go source:
 * FunctionFlags uint32
 */
export type FunctionFlags = uint;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/functionflags.go::constGroup::FunctionFlagsNormal+FunctionFlagsGenerator+FunctionFlagsAsync+FunctionFlagsInvalid+FunctionFlagsAsyncGenerator","kind":"constGroup","status":"implemented","sigHash":"36408568466780a8965ed541ad519fce884d222c21ef20ab21dc183c408dc5e6","bodyHash":"21c439a0fda25149ef7795ac581dfd5a9d9943f3096683c599eb5d2ea20f754a"}
 *
 * Go source:
 * const (
 * 	FunctionFlagsNormal         FunctionFlags = 0
 * 	FunctionFlagsGenerator      FunctionFlags = 1 << 0
 * 	FunctionFlagsAsync          FunctionFlags = 1 << 1
 * 	FunctionFlagsInvalid        FunctionFlags = 1 << 2
 * 	FunctionFlagsAsyncGenerator FunctionFlags = FunctionFlagsAsync | FunctionFlagsGenerator
 * )
 */
export declare const FunctionFlagsNormal: FunctionFlags;
export declare const FunctionFlagsGenerator: FunctionFlags;
export declare const FunctionFlagsAsync: FunctionFlags;
export declare const FunctionFlagsInvalid: FunctionFlags;
export declare const FunctionFlagsAsyncGenerator: FunctionFlags;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/ast/functionflags.go::func::GetFunctionFlags","kind":"func","status":"implemented","sigHash":"a00807b6371ab714f00d0abe6825c69e5724a2d81c0f10fd6978b964b6277e68","bodyHash":"79ef5ff003ff4dddad67958efb705c62428f60ec5ec4d17dc840afa506731e0a"}
 *
 * Go source:
 * func GetFunctionFlags(node *Node) FunctionFlags {
 * 	if node == nil {
 * 		return FunctionFlagsInvalid
 * 	}
 * 	data := node.BodyData()
 * 	if data == nil {
 * 		return FunctionFlagsInvalid
 * 	}
 * 	flags := FunctionFlagsNormal
 * 	switch node.Kind {
 * 	case KindFunctionDeclaration, KindFunctionExpression, KindMethodDeclaration:
 * 		if data.AsteriskToken != nil {
 * 			flags |= FunctionFlagsGenerator
 * 		}
 * 		fallthrough
 * 	case KindArrowFunction:
 * 		if HasSyntacticModifier(node, ModifierFlagsAsync) {
 * 			flags |= FunctionFlagsAsync
 * 		}
 * 	}
 * 	if data.Body == nil {
 * 		flags |= FunctionFlagsInvalid
 * 	}
 * 	return flags
 * }
 */
export declare function GetFunctionFlags(node: GoPtr<Node>): FunctionFlags;
//# sourceMappingURL=functionflags.d.ts.map