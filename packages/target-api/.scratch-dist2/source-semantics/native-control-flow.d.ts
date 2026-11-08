import type { AstReader, Node } from "@tsonic/tsts";
export declare function sourceStatementAlwaysExits(ast: AstReader, statement: Node | undefined, conditionResult: (expression: Node) => boolean | undefined, enter: () => boolean): boolean;
export declare function sourceNodeIsNativeUnreachable(ast: AstReader, node: Node, conditionResult: (expression: Node) => boolean | undefined): boolean;
//# sourceMappingURL=native-control-flow.d.ts.map