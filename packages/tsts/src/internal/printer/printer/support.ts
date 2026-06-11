import type { ListFormat } from "./state.js";
import {
  LFBracketsMask,
  LFBraces,
  LFParenthesis,
  LFAngleBrackets,
  LFSquareBrackets,
} from "./state.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::func::getOpeningBracket","kind":"func","status":"implemented","sigHash":"5bc08903b653564477defebd80c842ab0f42c833597514c1f7415fabde455f02","bodyHash":"2f382faded1adbe2d09e56c4b8319d414a11bd08ff937be0a42a5db853ac0c9b"}
 *
 * Go source:
 * func getOpeningBracket(format ListFormat) string {
 * 	switch format & LFBracketsMask {
 * 	case LFBraces:
 * 		return "{"
 * 	case LFParenthesis:
 * 		return "("
 * 	case LFAngleBrackets:
 * 		return "<"
 * 	case LFSquareBrackets:
 * 		return "["
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected bracket: %v", format&LFBracketsMask))
 * 	}
 * }
 */
export function getOpeningBracket(format: ListFormat): string {
  switch (format & LFBracketsMask) {
    case LFBraces:
      return "{";
    case LFParenthesis:
      return "(";
    case LFAngleBrackets:
      return "<";
    case LFSquareBrackets:
      return "[";
    default:
      throw new globalThis.Error(`Unexpected bracket: ${format & LFBracketsMask}`);
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/printer.go::func::getClosingBracket","kind":"func","status":"implemented","sigHash":"2726915a935c36656a921b50ee6875446e76766b779a0246fa5f59515841236b","bodyHash":"e7eed6bdb64015115553a637ea703a3462129d3c908c7daccfb00cecf36ae6c6"}
 *
 * Go source:
 * func getClosingBracket(format ListFormat) string {
 * 	switch format & LFBracketsMask {
 * 	case LFBraces:
 * 		return "}"
 * 	case LFParenthesis:
 * 		return ")"
 * 	case LFAngleBrackets:
 * 		return ">"
 * 	case LFSquareBrackets:
 * 		return "]"
 * 	default:
 * 		panic(fmt.Sprintf("Unexpected bracket: %v", format&LFBracketsMask))
 * 	}
 * }
 */
export function getClosingBracket(format: ListFormat): string {
  switch (format & LFBracketsMask) {
    case LFBraces:
      return "}";
    case LFParenthesis:
      return ")";
    case LFAngleBrackets:
      return ">";
    case LFSquareBrackets:
      return "]";
    default:
      throw new globalThis.Error(`Unexpected bracket: ${format & LFBracketsMask}`);
  }
}
