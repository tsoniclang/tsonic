import type { AstReader, Node } from "@tsonic/tsts";
export declare function createSourceIntegerConstantReader(ast: AstReader, integerLiteralValue?: (literal: Node) => bigint | undefined): (expression: Node) => bigint | undefined;
export declare function sourceIntegerConstantValue(ast: AstReader, expression: Node): bigint | undefined;
//# sourceMappingURL=integer-constant.d.ts.map