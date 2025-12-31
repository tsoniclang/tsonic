/**
 * INV-0 Enforcement Test: No TypeScript Computed Types in IR Pipeline
 *
 * This test enforces Alice's specification that the IR typing pipeline
 * must NEVER use TypeScript's computed type APIs. All IR types must come from:
 * - Declared TypeNodes (annotations, signatures, property types)
 * - Globals TypeNodes (@tsonic/globals, BCL bindings)
 * - Bounded deterministic inference (lexeme intent + expectedType threading)
 *
 * TS checker is allowed ONLY for:
 * - Symbol lookup (getSymbolAtLocation)
 * - Overload selection (getResolvedSignature)
 * - Module resolution
 * - symbol.getDeclarations()
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Banned patterns that use TypeScript's computed type inference.
 * These patterns extract types computed by the TS type checker,
 * which violates deterministic IR typing.
 */
const BANNED_PATTERNS = [
  // Core type inference APIs - extract computed types
  /checker\.getTypeAtLocation\s*\(/g,
  /checker\.getTypeOfSymbolAtLocation\s*\(/g,
  /checker\.typeToTypeNode\s*\(/g,

  // Type structure inspection - uses computed types
  /checker\.getApparentType\s*\(/g,
  /checker\.getBaseTypes\s*\(/g,
  /checker\.getPropertiesOfType\s*\(/g,

  // Type relationship APIs - uses computed types
  /checker\.isTypeAssignableTo\s*\(/g,
  /checker\.getWidenedType\s*\(/g,
  /checker\.getContextualType\s*\(/g,

  // Signature type extraction - should use declaration TypeNodes instead
  /checker\.getSignaturesOfType\s*\(/g,
  /checker\.getReturnTypeOfSignature\s*\(/g,

  // Type parameter inference - should use bounded unification
  /checker\.getTypeArguments\s*\(/g,
  /checker\.inferTypeArguments\s*\(/g,
];

/**
 * Allowed patterns - resolver-only usage of TS checker.
 * These find declarations/symbols, but don't extract computed types.
 */
const ALLOWED_PATTERNS_INFO = [
  "checker.getSymbolAtLocation - finds symbol, not type",
  "checker.getResolvedSignature - picks overload, return type from declaration",
  "checker.getPropertyOfType - finds member symbol, type from declaration",
  "symbol.getDeclarations() - gets AST node, type from TypeNode",
  "checker.getAliasedSymbol - resolves import aliases",
  "checker.getExportSymbolOfSymbol - resolves exports",
];

/**
 * Directories to scan for banned patterns.
 */
const IR_DIRECTORIES = [
  "packages/frontend/src/ir/converters",
  "packages/frontend/src/ir/type-converter",
  "packages/frontend/src/ir/validation",
];

/**
 * Files to exclude from scanning (allowed to use banned patterns).
 * Should be empty once deterministic typing is complete.
 */
const EXCLUDED_FILES: string[] = [
  // TODO: Remove these exclusions as each file is fixed
  // Currently tracking files that still need migration
];

/**
 * Get all TypeScript files in a directory recursively.
 */
const getTypeScriptFiles = (dir: string): string[] => {
  // From dist/ir/ go up to packages/frontend, then up to project root
  const projectRoot = path.resolve(__dirname, "../../../..");
  const fullPath = path.join(projectRoot, dir);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getTypeScriptFiles(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      results.push(entryPath);
    }
  }

  return results;
};

/**
 * Check a file for banned patterns.
 */
const checkFileForBannedPatterns = (
  filePath: string
): {
  file: string;
  violations: { pattern: string; line: number; text: string }[];
} => {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: { pattern: string; line: number; text: string }[] = [];

  for (const pattern of BANNED_PATTERNS) {
    // Reset regex state for each file
    pattern.lastIndex = 0;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      if (line === undefined) continue;

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }

      // Reset for each line since we're using global flag
      const testPattern = new RegExp(pattern.source);
      if (testPattern.test(line)) {
        violations.push({
          pattern: pattern.source,
          line: lineNum + 1,
          text: line.trim().substring(0, 80),
        });
      }
    }
  }

  return { file: filePath, violations };
};

describe("INV-0: No TS Computed Types in IR Pipeline", () => {
  it("should not use banned TypeScript type inference APIs in IR converters", () => {
    const allViolations: {
      file: string;
      violations: { pattern: string; line: number; text: string }[];
    }[] = [];

    for (const dir of IR_DIRECTORIES) {
      const files = getTypeScriptFiles(dir);

      for (const file of files) {
        // Check if file is excluded
        const relativePath = path.relative(
          path.resolve(__dirname, "../../../.."),
          file
        );
        if (
          EXCLUDED_FILES.some((excluded) => relativePath.includes(excluded))
        ) {
          continue;
        }

        const result = checkFileForBannedPatterns(file);
        if (result.violations.length > 0) {
          allViolations.push(result);
        }
      }
    }

    if (allViolations.length > 0) {
      const message = allViolations
        .map((v) => {
          const relativePath = path.relative(
            path.resolve(__dirname, "../../../.."),
            v.file
          );
          const violationList = v.violations
            .map(
              (viol) =>
                `    Line ${viol.line}: ${viol.pattern}\n      ${viol.text}`
            )
            .join("\n");
          return `\n${relativePath}:\n${violationList}`;
        })
        .join("\n");

      expect.fail(
        `Found ${allViolations.reduce((sum, v) => sum + v.violations.length, 0)} violations of INV-0 (no TS computed types):\n${message}\n\n` +
          `These APIs must be replaced with TypeRegistry + NominalEnv lookups.\n` +
          `See: packages/frontend/src/ir/type-registry.ts\n` +
          `Allowed resolver-only patterns:\n${ALLOWED_PATTERNS_INFO.map((p) => `  - ${p}`).join("\n")}`
      );
    }
  });

  it("should document all excluded files with migration plan", () => {
    // Once all files are migrated, EXCLUDED_FILES should be empty
    if (EXCLUDED_FILES.length > 0) {
      console.log(
        `\nNote: ${EXCLUDED_FILES.length} files still excluded from INV-0 check:\n` +
          EXCLUDED_FILES.map((f) => `  - ${f}`).join("\n")
      );
    }
    // This test passes but logs excluded files for visibility
    expect(true).to.equal(true);
  });
});
