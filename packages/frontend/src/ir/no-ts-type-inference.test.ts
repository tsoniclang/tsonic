/**
 * INV-0 Enforcement Test: No TypeScript Compiler API in IR Pipeline
 *
 * TSTS is now the compiler substrate. The IR/lowering pipeline may ask the
 * source semantic facade for use-site types, symbols, signatures, contextual
 * types, narrowing, and module identity. Product frontend code must not import
 * or call the TypeScript compiler API directly.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Banned patterns that use the TypeScript compiler API directly.
 * Equivalent semantic questions must go through sourceSemantics, backed by
 * TSTS.
 */
const BANNED_PATTERNS = [
  // Core TypeScript checker APIs
  /checker\.getTypeAtLocation\s*\(/g,
  /checker\.getTypeOfSymbolAtLocation\s*\(/g,
  /checker\.typeToTypeNode\s*\(/g,

  // Type structure inspection through TypeScript checker
  /checker\.getApparentType\s*\(/g,
  /checker\.getBaseTypes\s*\(/g,
  /checker\.getPropertiesOfType\s*\(/g,

  // Type relationship APIs through TypeScript checker
  /checker\.isTypeAssignableTo\s*\(/g,
  /checker\.getWidenedType\s*\(/g,
  /checker\.getContextualType\s*\(/g,

  // Signature type extraction through TypeScript checker
  /checker\.getSignaturesOfType\s*\(/g,
  /checker\.getReturnTypeOfSignature\s*\(/g,

  // Type parameter inference through TypeScript checker
  /checker\.getTypeArguments\s*\(/g,
  /checker\.inferTypeArguments\s*\(/g,

  // Local semantic ownership that must stay in TSTS.
  /selectBestCallCandidate/g,
  /resolveCallSignatureCandidates/g,
  /resolveConstructorSignatureCandidates/g,
  /candidateSignatureIds/g,
  /withAppliedNarrowings/g,
  /collectTypeNarrowingsIn(?:Truthy|Falsy)Expr/g,
  /call-resolution-candidate-selection/g,
  /flow-narrowing/g,
  /narrowing-collection/g,
  /narrowing-resolvers/g,
  /symbol-table/g,
  /targetSurfaceArtifacts/g,
  /\bfallback\b/g,
  /fallback[A-Z]/g,
  /\blegacy\b/g,
  /\bheuristic/g,
  /\bguess/g,
];

/**
 * Allowed semantic owner. These are representative sourceSemantics calls backed
 * by TSTS.
 */
const ALLOWED_PATTERNS_INFO = [
  "sourceSemantics.getExpressionType - TSTS use-site type",
  "sourceSemantics.getContextualType - TSTS contextual type",
  "sourceSemantics.getResolvedSignature - TSTS overload selection",
  "sourceSemantics.getSymbol - TSTS symbol lookup",
  "sourceSemantics.resolveAlias - TSTS alias resolution",
  "sourceSemantics.getExportedDeclaration - TSTS module/export graph",
];

/**
 * Directories to scan for banned patterns.
 */
const IR_DIRECTORIES = [
  "packages/frontend/src/ir/binding",
  "packages/frontend/src/ir/converters",
  "packages/frontend/src/ir/type-system",
  "packages/frontend/src/ir/type-converter",
  "packages/frontend/src/ir/validation",
];

/**
 * Files to exclude from scanning (allowed to use banned patterns).
 * Intentionally empty — exclusions weaken enforcement.
 */
const EXCLUDED_FILES: string[] = [];

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

describe("INV-0: No TypeScript Compiler API in IR Pipeline", () => {
  it("should not use banned TypeScript compiler APIs in IR converters", () => {
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
        `Found ${allViolations.reduce((sum, v) => sum + v.violations.length, 0)} violations of INV-0 (no TypeScript compiler API):\n${message}\n\n` +
          `These APIs must be replaced with sourceSemantics calls backed by TSTS.\n` +
          `Allowed semantic owner patterns:\n${ALLOWED_PATTERNS_INFO.map((p) => `  - ${p}`).join("\n")}`
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
