// Compatibility re-export barrel: kind_generated.go symbols (Kind enum + KindString)
// are ported into internal/ast/generated/kinds.ts. The scaffolder maps them to
// "../ast/kind_generated.js"; this barrel re-exports the canonical module there.
export * from "./generated/kinds.js";
