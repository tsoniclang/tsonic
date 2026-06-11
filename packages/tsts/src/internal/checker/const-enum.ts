import type { bool } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import type { Symbol } from "../ast/symbol.js";
import { SymbolFlagsConstEnumOnlyModule } from "../ast/generated/flags.js";
import { isConstEnumSymbol } from "./checker/state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/checker/emitresolver.go::func::isConstEnumOrConstEnumOnlyModule","kind":"func","status":"implemented","sigHash":"55d841918a92ed5c2c67ea7b6d8fa0359e2ea281c23c8953dc793fda495b3dca","bodyHash":"a2d41aaabe390d42221701002e1516de3c195f0aca1f32893766700c71431d19"}
 *
 * Go source:
 * func isConstEnumOrConstEnumOnlyModule(s *ast.Symbol) bool {
 * 	return isConstEnumSymbol(s) || s.Flags&ast.SymbolFlagsConstEnumOnlyModule != 0
 * }
 */
export function isConstEnumOrConstEnumOnlyModule(s: GoPtr<Symbol>): bool {
  return (isConstEnumSymbol(s) || (s!.Flags & SymbolFlagsConstEnumOnlyModule) !== 0) as bool;
}
