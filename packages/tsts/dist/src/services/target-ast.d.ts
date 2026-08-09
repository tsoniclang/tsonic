import type { SourceFile } from "../internal/ast/ast.js";
import type { Node } from "../internal/ast/spine.js";
import type { NodeFactory } from "../internal/ast/generated/factory.js";
export type TargetAstRewrite = (original: Node, updated: Node, factory: NodeFactory) => Node | undefined;
export declare function transformTargetSourceFile(sourceFile: SourceFile, rewrite: TargetAstRewrite): SourceFile;
export { encodeTargetSourceFileForPrinting, TargetAstEncodingError, } from "./target-ast-encoding.js";
export * from "../internal/ast/generated/casts.js";
export * from "../internal/ast/generated/factory.js";
export * from "../internal/ast/generated/flags.js";
export * from "../internal/ast/generated/kinds.js";
export * from "../internal/ast/generated/predicates.js";
export { AsSourceFile, NodeFactory_UpdateSourceFile } from "../internal/ast/ast.js";
export { NodeFactory_NewNodeList } from "../internal/ast/spine.js";
export type { Node, NodeFactory, SourceFile };
//# sourceMappingURL=target-ast.d.ts.map