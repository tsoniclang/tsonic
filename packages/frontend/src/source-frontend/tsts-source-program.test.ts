import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTstsIdentifierText, visitTstsSubtree } from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import type { SourceBindingProjectedType } from "./source-facts.js";
import { sourceExpressionTypeProjectionFactKey } from "./source-facts.js";
import { createTstsSourceProgram } from "./tsts-source-program.js";

describe("TSTS source program", () => {
  const withTempSource = (
    sourceText: string,
    run: (filePath: string) => void
  ): void => {
    const tempRoot = path.join(process.cwd(), ".temp", "tsts-source-program");
    fs.mkdirSync(tempRoot, { recursive: true });
    const sourceRoot = fs.mkdtempSync(path.join(tempRoot, "case-"));
    const filePath = path.join(sourceRoot, "index.ts");
    fs.writeFileSync(filePath, sourceText);
    try {
      run(filePath);
    } finally {
      fs.rmSync(sourceRoot, { recursive: true, force: true });
    }
  };

  const withTempProject = (
    files: Readonly<Record<string, string>>,
    run: (projectRoot: string, filePaths: Readonly<Record<string, string>>) => void
  ): void => {
    const tempRoot = path.join(process.cwd(), ".temp", "tsts-source-program");
    fs.mkdirSync(tempRoot, { recursive: true });
    const projectRoot = fs.mkdtempSync(path.join(tempRoot, "case-"));
    const filePaths: Record<string, string> = {};
    for (const [relativePath, sourceText] of Object.entries(files)) {
      const filePath = path.join(projectRoot, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, sourceText);
      filePaths[relativePath] = filePath;
    }
    try {
      run(projectRoot, filePaths);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  };

  const must = <T>(value: GoPtr<T>, message: string): T => {
    if (value === undefined) {
      throw new Error(message);
    }
    return value;
  };

  const summarizeProjection = (type: SourceBindingProjectedType): string => {
    switch (type.kind) {
      case "intrinsic":
        return type.name;
      case "union":
        return type.types.map(summarizeProjection).join(" | ");
      default:
        return type.kind;
    }
  };

  const createProgram = (
    filePaths: readonly string[],
    options: {
      readonly projectRoot: string;
      readonly moduleResolutionPaths?: Readonly<
        Record<string, readonly string[]>
      >;
      readonly sourceDiagnosticRoots: readonly string[];
    }
  ) =>
    createTstsSourceProgram(filePaths, {
      projectRoot: options.projectRoot,
      moduleResolutionPaths: options.moduleResolutionPaths ?? {},
      sourceDiagnosticRoots: options.sourceDiagnosticRoots,
    });

  it("creates a TSTS source program through the only source boundary", () => {
    withTempSource("export const answer: number = 42;\n", (filePath) => {
      const sourceProgram = createProgram([filePath], {
        projectRoot: path.dirname(filePath),
        sourceDiagnosticRoots: [path.dirname(filePath)],
      });

      expect(sourceProgram.engine).to.equal("tsts");
      expect(
        sourceProgram.sourceFiles.map((file) => file.FileName())
      ).to.include(filePath);
      expect(sourceProgram.compilerDiagnostics).to.deep.equal([]);
      expect(sourceProgram.diagnostics).to.deep.equal([]);
    });
  });

  it("exposes TSTS source semantic facts through the source program boundary", () => {
    withTempSource(
      `
        export function read(value: string | number) {
          const before = value;
          if (typeof value === "string") {
            const text = value;
            return text;
          }
          const number = value;
          return number;
        }
      `,
      (filePath) => {
        const sourceProgram = createProgram([filePath], {
          projectRoot: path.dirname(filePath),
          sourceDiagnosticRoots: [path.dirname(filePath)],
        });
        const sourceFile = must(
          sourceProgram.sourceFiles[0],
          "source file missing"
        );
        const valueUseTypes: string[] = [];

        for (const statement of must(
          sourceFile.Statements,
          "source file statements missing"
        ).Nodes) {
          visitTstsSubtree(statement, (node: GoPtr<TstsNode>) => {
            if (!node || getTstsIdentifierText(node) !== "value") {
              return;
            }

            const fact = sourceProgram.facts.get(
              sourceExpressionTypeProjectionFactKey,
              node
            );
            if (fact) {
              valueUseTypes.push(summarizeProjection(fact.type));
            }
          });
        }

        expect(sourceProgram.compilerDiagnostics).to.deep.equal([]);
        expect(sourceProgram.diagnostics).to.deep.equal([]);
        expect(valueUseTypes).to.include("string | number");
        expect(valueUseTypes).to.include("string");
        expect(valueUseTypes).to.include("number");
      }
    );
  });

  it("allows explicit TypeScript extension imports during source analysis", () => {
    withTempProject(
      {
        "index.ts": 'import { value } from "./dep.ts";\nexport const answer = value;\n',
        "dep.ts": "export const value: number = 42;\n",
      },
      (projectRoot, filePaths) => {
        const indexFile = must(filePaths["index.ts"], "index.ts missing");
        const depFile = must(filePaths["dep.ts"], "dep.ts missing");
        const program = createProgram([indexFile, depFile], {
          projectRoot,
          sourceDiagnosticRoots: [projectRoot],
        });

        expect(program.compilerDiagnostics).to.deep.equal([]);
        expect(program.diagnostics).to.deep.equal([]);
      }
    );
  });

  it("reports compiler diagnostics only for configured source diagnostic files", () => {
    withTempProject(
      {
        "src/index.ts": "export const answer: number = 42;\n",
        "support/support.ts": 'export const broken: number = "not a number";\n',
      },
      (projectRoot, filePaths) => {
        const indexFile = must(filePaths["src/index.ts"], "index.ts missing");
        const supportFile = must(
          filePaths["support/support.ts"],
          "support.ts missing"
        );
        const program = createProgram([indexFile, supportFile], {
          projectRoot,
          sourceDiagnosticRoots: [path.join(projectRoot, "src")],
        });

        expect(program.compilerDiagnostics).to.deep.equal([]);
        expect(program.diagnostics).to.deep.equal([]);
      }
    );
  });
});
