/**
 * Backend AST Printer – Shared Utilities — facade re-exports.
 *
 * Implementations live in:
 *   - printer-identifiers.ts
 *   - printer-colon-detection.ts
 *   - printer-precedence.ts
 */

export {
  escapeCSharpStringLiteral,
  escapeCSharpCharLiteral,
  printTrivia,
  needsPrefixUnarySeparator,
  printNumericLiteral,
  CSHARP_KEYWORDS,
  PREDEFINED_TYPE_KEYWORDS,
  escapeIdentifier,
  escapeQualifiedName,
} from "./printer-identifiers.js";

export {
  nameMayPrintColon,
  typeMayPrintColon,
  patternMayPrintColon,
  expressionMayPrintColon,
} from "./printer-colon-detection.js";

export {
  getOperatorPrecedence,
  getExpressionPrecedence,
  needsParensInBinary,
  printType,
} from "./printer-precedence.js";
