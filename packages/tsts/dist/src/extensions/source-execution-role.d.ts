import type { Node } from "../internal/ast/spine.js";
export type CheckedSourceExecutionRole = "runtime-execution" | "declaration-file-semantic" | "type-only-or-ambient-semantic";
export declare function checkedSourceExecutionRole(node: Node): CheckedSourceExecutionRole;
export declare function isRuntimeCheckedSourceExecution(node: Node): boolean;
//# sourceMappingURL=source-execution-role.d.ts.map