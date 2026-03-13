/**
 * Shared constants for the Tsonic emitter
 */

import type { CSharpTriviaAst } from "./core/format/backend-ast/types.js";

/**
 * Generate standard file header for emitted C# files
 *
 * @param filePath - Source TypeScript file path
 * @param options - Header generation options
 * @returns Multi-line header string with trailing newline
 */
export const generateFileHeaderTrivia = (
  filePath: string,
  options: {
    readonly includeTimestamp?: boolean;
    readonly timestamp?: string;
  } = {}
): readonly CSharpTriviaAst[] => {
  const lines: CSharpTriviaAst[] = [];

  lines.push({
    kind: "singleLineCommentTrivia",
    text: `Generated from: ${filePath}`,
  });

  if (options.includeTimestamp ?? true) {
    const timestamp = options.timestamp ?? new Date().toISOString();
    lines.push({
      kind: "singleLineCommentTrivia",
      text: `Generated at: ${timestamp}`,
    });
  }

  lines.push({
    kind: "singleLineCommentTrivia",
    text: "WARNING: Do not modify this file manually",
  });
  lines.push({ kind: "blankLineTrivia" });

  return lines;
};
