/**
 * Backend AST Printer – Public API Facade
 *
 * Converts typed C# AST nodes into deterministic C# source text.
 * Pure and stateless - no parsing, no string heuristics.
 *
 * Parenthesization is derived from operator precedence tables,
 * not from advisory metadata on fragments.
 *
 * Implementation is split across focused sub-modules:
 *   printer-shared.ts       – escape helpers, keywords, precedence, printType
 *   printer-expressions.ts  – printExpression, printPattern, printAttributes, printParameter
 *   printer-statements.ts   – printStatement, printStatementFlatBlock
 *   printer-declarations.ts – printMember, printTypeDeclaration, printCompilationUnit
 */

export { printType } from "./printer-shared.js";

export {
  printExpression,
  printPattern,
  printAttributes,
  printParameter,
} from "./printer-expressions.js";

export {
  printStatement,
  printStatementFlatBlock,
} from "./printer-statements.js";

export {
  printMember,
  printTypeDeclaration,
  printCompilationUnit,
} from "./printer-declarations.js";
