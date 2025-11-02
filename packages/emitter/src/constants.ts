/**
 * Shared constants for the Tsonic emitter
 */

/**
 * Generate standard file header for emitted C# files
 *
 * @param filePath - Source TypeScript file path
 * @param options - Header generation options
 * @returns Multi-line header string with trailing newline
 */
export const generateFileHeader = (
  filePath: string,
  options: {
    readonly includeTimestamp?: boolean;
    readonly timestamp?: string;
  } = {}
): string => {
  const lines: string[] = [];

  lines.push(`// Generated from: ${filePath}`);

  if (options.includeTimestamp ?? true) {
    const timestamp = options.timestamp ?? new Date().toISOString();
    lines.push(`// Generated at: ${timestamp}`);
  }

  lines.push("// WARNING: Do not modify this file manually");
  lines.push("");

  return lines.join("\n");
};
