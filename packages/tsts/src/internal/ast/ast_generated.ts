// Compatibility re-export barrel for the generated AST layer.
//
// TS-Go's ast_generated.go is ported into internal/ast/generated/* (emitted by
// porter:ast). The porter scaffolder, however, maps ast_generated.go symbols to
// the import path "../ast/ast_generated.js" (Go-file-derived). This barrel
// re-exports the real generated modules at that path so downstream imports
// resolve to the single canonical implementation. (No second representation —
// pure re-export; to be removed once the scaffolder emits generated/* paths.)

export * from "./generated/node.js";
export * from "./generated/data.js";
export * from "./generated/factory.js";
export * from "./generated/predicates.js";
export * from "./generated/casts.js";
export * from "./generated/unions.js";
export * from "./generated/visitor.js";
