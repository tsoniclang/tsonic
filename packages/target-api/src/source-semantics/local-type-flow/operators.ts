import type { SourceTypeFlowOperator } from "./types.js";

export const sourceTypeFlowBinaryOperators: ReadonlyMap<string, SourceTypeFlowOperator> = new Map([
  ["KindPlusToken", "add"], ["KindMinusToken", "subtract"], ["KindAsteriskToken", "multiply"],
  ["KindSlashToken", "divide"], ["KindPercentToken", "remainder"], ["KindAsteriskAsteriskToken", "power"],
  ["KindAmpersandToken", "bit-and"], ["KindBarToken", "bit-or"], ["KindCaretToken", "bit-xor"],
  ["KindLessThanLessThanToken", "shift-left"], ["KindGreaterThanGreaterThanToken", "shift-right"],
  ["KindGreaterThanGreaterThanGreaterThanToken", "shift-right-unsigned"],
  ["KindLessThanToken", "less"], ["KindLessThanEqualsToken", "less-equal"],
  ["KindGreaterThanToken", "greater"], ["KindGreaterThanEqualsToken", "greater-equal"],
  ["KindEqualsEqualsToken", "equal"], ["KindEqualsEqualsEqualsToken", "equal-strict"],
  ["KindExclamationEqualsToken", "not-equal"], ["KindExclamationEqualsEqualsToken", "not-equal-strict"],
  ["KindEqualsToken", "assignment"], ["KindInKeyword", "in"], ["KindInstanceOfKeyword", "instanceof"],
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
  ["KindExclamationToken", "logical-not"], ["KindPlusPlusToken", "increment"], ["KindMinusMinusToken", "decrement"],
]);
