import { describe, it } from "mocha";
import { expect } from "chai";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const emitterRoot = join(process.cwd(), "src");

const walkTsFiles = (dir: string): string[] => {
  const entries = readdirSync(dir).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(fullPath));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const productionFiles = (): string[] =>
  walkTsFiles(emitterRoot).filter((file) => !file.endsWith(".test.ts"));

describe("backend-ast architecture invariants", () => {
  it("does not reintroduce raw text bridge nodes or text-to-AST adapters", () => {
    const forbiddenPatterns: readonly [string, RegExp][] = [
      ["rawExpression node", /kind:\s*"rawExpression"/],
      ["rawType node", /kind:\s*"rawType"/],
      ["rawMember node", /kind:\s*"rawMember"/],
      ["legacy literalExpression node", /kind:\s*"literalExpression"/],
      ["fragmentFromText adapter", /\bfragmentFromText\s*\(/],
      ["expressionAstFromText adapter", /\bexpressionAstFromText\s*\(/],
      ["blockStatementAstFromText adapter", /\bblockStatementAstFromText\s*\(/],
      ["renderTypeAst helper", /\brenderTypeAst\s*\(/],
    ];

    const hits: string[] = [];

    for (const file of productionFiles()) {
      const text = readFileSync(file, "utf8");
      for (const [label, pattern] of forbiddenPatterns) {
        if (pattern.test(text)) {
          hits.push(`${relative(emitterRoot, file)} -> ${label}`);
        }
      }
    }

    expect(hits).to.deep.equal([]);
  });

  it("keeps printer imports confined to the printer boundary", () => {
    const printerImportFiles: string[] = [];

    for (const file of productionFiles()) {
      const text = readFileSync(file, "utf8");
      if (
        /from\s+["'][^"']*backend-ast\/printer\.js["']/.test(text) ||
        /from\s+["']\.\/printer\.js["']/.test(text)
      ) {
        printerImportFiles.push(relative(emitterRoot, file));
      }
    }

    expect(printerImportFiles).to.deep.equal([
      "core/format/backend-ast/index.ts",
      "core/format/module-emitter/assembly.ts",
      "emitter.ts",
    ]);
  });

  it("limits free-form text payloads to lexical leaf nodes and trivia only", () => {
    const typesFile = readFileSync(
      join(emitterRoot, "core/format/backend-ast/types.ts"),
      "utf8"
    );

    const textFieldMatches = [
      ...typesFile.matchAll(/readonly text: string;/g),
    ].map((match) => match[0]);

    expect(textFieldMatches).to.have.length(2);
    expect(typesFile).to.include(
      "export type CSharpInterpolatedStringPartText = {"
    );
    expect(typesFile).to.include(
      "export type CSharpSingleLineCommentTriviaAst = {"
    );
    expect(typesFile).to.not.include("literalExpression");
  });
});
