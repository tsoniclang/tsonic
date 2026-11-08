import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceNumericLiteralToken } from "./literal-values-model.js";
export declare function sourceLiteralToken(ast: AstReader, node: Node): {
    readonly kind: "authored";
    readonly text: string;
} | {
    readonly kind: "synthetic";
};
interface ParsedSourceNumericLiteral {
    readonly token: SourceNumericLiteralToken;
    readonly integer: bigint | undefined;
}
export declare function parseSourceNumericLiteral(text: string): ParsedSourceNumericLiteral | undefined;
export declare function compareSourceNumericLiteralMagnitude(token: Pick<SourceNumericLiteralToken, "coefficient" | "exponent">, limit: bigint): -1 | 0 | 1;
export declare function sourceNumericLiteralIsExactlyRepresentableAsBinaryFloat(token: SourceNumericLiteralToken, target: "float32" | "float64"): boolean;
export declare function sourceIntegerConstantIsExactlyRepresentableAsBinaryFloat(integer: bigint, target: "float32" | "float64"): boolean;
export {};
//# sourceMappingURL=literal-token.d.ts.map