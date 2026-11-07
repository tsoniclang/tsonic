import type { SourceTypeFlowOperator } from "./types.js";

export const sourceTypeFlowBinaryOperators: ReadonlyMap<string, SourceTypeFlowOperator> = new Map([
  ["KindPlusToken", "add"], ["KindMinusToken", "subtract"], ["KindAsteriskToken", "multiply"],
  ["KindSlashToken", "divide"], ["KindPercentToken", "remainder"], ["KindAsteriskAsteriskToken", "power"],
  ["KindAmpersandToken", "bit-and"], ["KindBarToken", "bit-or"], ["KindCaretToken", "bit-xor"],
  ["KindLessThanLessThanToken", "shift-left"], ["KindGreaterThanGreaterThanToken", "shift-right"],
  ["KindGreaterThanGreaterThanGreaterThanToken", "shift-right-unsigned"],
  ["KindLessThanToken", "less"], ["KindLessThanEqualsToken", "less-equal"],
  ["KindGreaterThanToken", "greater"], ["KindGreaterThanEqualsToken", "greater-equal"],
  ["KindEqualsEqualsToken", "equal"], ["KindEqualsEqualsEqualsToken", "equal"],
  ["KindExclamationEqualsToken", "not-equal"], ["KindExclamationEqualsEqualsToken", "not-equal"],
  ["KindAmpersandAmpersandToken", "logical-and"], ["KindBarBarToken", "logical-or"],
  ["KindQuestionQuestionToken", "coalesce"], ["KindCommaToken", "sequence"],
  ["KindPlusEqualsToken", "add"], ["KindMinusEqualsToken", "subtract"],
  ["KindAsteriskEqualsToken", "multiply"], ["KindSlashEqualsToken", "divide"],
  ["KindPercentEqualsToken", "remainder"], ["KindAsteriskAsteriskEqualsToken", "power"],
  ["KindAmpersandEqualsToken", "bit-and"], ["KindBarEqualsToken", "bit-or"], ["KindCaretEqualsToken", "bit-xor"],
  ["KindLessThanLessThanEqualsToken", "shift-left"], ["KindGreaterThanGreaterThanGreaterThanEqualsToken", "shift-right-unsigned"],
  ["KindGreaterThanGreaterThanEqualsToken", "shift-right"],
  ["KindAmpersandAmpersandEqualsToken", "logical-and"], ["KindBarBarEqualsToken", "logical-or"],
  ["KindQuestionQuestionEqualsToken", "coalesce"],
]);

export const sourceTypeFlowUnaryOperators: ReadonlyMap<string, SourceTypeFlowOperator> = new Map([
  ["KindPlusToken", "positive"], ["KindMinusToken", "negate"], ["KindTildeToken", "bit-not"],
  ["KindExclamationToken", "logical-not"], ["KindPlusPlusToken", "identity"], ["KindMinusMinusToken", "identity"],
]);

/** The source spelling of every operator token (operator records, R4: one token table). */
export const sourceTypeFlowOperatorSpellings: ReadonlyMap<string, string> = new Map([
  ["KindPlusToken", "+"], ["KindMinusToken", "-"], ["KindAsteriskToken", "*"], ["KindSlashToken", "/"], ["KindPercentToken", "%"],
  ["KindAsteriskAsteriskToken", "**"], ["KindAmpersandToken", "&"], ["KindBarToken", "|"], ["KindCaretToken", "^"],
  ["KindLessThanLessThanToken", "<<"], ["KindGreaterThanGreaterThanToken", ">>"], ["KindGreaterThanGreaterThanGreaterThanToken", ">>>"],
  ["KindLessThanToken", "<"], ["KindLessThanEqualsToken", "<="], ["KindGreaterThanToken", ">"], ["KindGreaterThanEqualsToken", ">="],
  ["KindEqualsEqualsToken", "=="], ["KindEqualsEqualsEqualsToken", "==="], ["KindExclamationEqualsToken", "!="],
  ["KindExclamationEqualsEqualsToken", "!=="], ["KindAmpersandAmpersandToken", "&&"], ["KindBarBarToken", "||"],
  ["KindQuestionQuestionToken", "??"], ["KindCommaToken", ","], ["KindEqualsToken", "="], ["KindPlusEqualsToken", "+="],
  ["KindMinusEqualsToken", "-="], ["KindAsteriskEqualsToken", "*="], ["KindSlashEqualsToken", "/="], ["KindPercentEqualsToken", "%="],
  ["KindAsteriskAsteriskEqualsToken", "**="], ["KindAmpersandEqualsToken", "&="], ["KindBarEqualsToken", "|="],
  ["KindCaretEqualsToken", "^="], ["KindLessThanLessThanEqualsToken", "<<="], ["KindGreaterThanGreaterThanEqualsToken", ">>="],
  ["KindGreaterThanGreaterThanGreaterThanEqualsToken", ">>>="], ["KindAmpersandAmpersandEqualsToken", "&&="],
  ["KindBarBarEqualsToken", "||="], ["KindQuestionQuestionEqualsToken", "??="], ["KindTildeToken", "~"],
  ["KindExclamationToken", "!"], ["KindPlusPlusToken", "++"], ["KindMinusMinusToken", "--"],
  ["KindInKeyword", "in"], ["KindInstanceOfKeyword", "instanceof"],
]);

/** Assignment tokens: `=` and every compound assignment. */
export const sourceTypeFlowAssignmentTokens: ReadonlySet<string> = new Set(["KindEqualsToken",
  ...[...sourceTypeFlowBinaryOperators.keys()].filter(token => token.endsWith("EqualsToken") && sourceTypeFlowOperatorSpellings.get(token)?.endsWith("=") === true &&
    !["==", "===", "!=", "!==", "<=", ">="].includes(sourceTypeFlowOperatorSpellings.get(token)!))]);

/** Shift tokens, plain and compound. */
export const sourceTypeFlowShiftTokens: ReadonlySet<string> = new Set([...sourceTypeFlowBinaryOperators]
  .filter(([, operator]) => operator === "shift-left" || operator === "shift-right" || operator === "shift-right-unsigned")
  .map(([token]) => token));
