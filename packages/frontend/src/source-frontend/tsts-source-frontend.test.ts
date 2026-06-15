import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { getTstsIdentifierText, visitTstsSubtree } from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import { createTstsSourceFrontend } from "./tsts-source-frontend.js";

describe("TSTS source frontend", () => {
  const withTempSource = (
    sourceText: string,
    run: (filePath: string) => void
  ): void => {
    const tempRoot = path.join(process.cwd(), ".temp", "tsts-source-frontend");
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
    const tempRoot = path.join(process.cwd(), ".temp", "tsts-source-frontend");
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

  it("creates a TSTS source program through the source frontend boundary", () => {
    withTempSource("export const answer: number = 42;\n", (filePath) => {
      const frontend = createTstsSourceFrontend();
      const program = frontend.createProgram([filePath], {
        projectRoot: path.dirname(filePath),
        moduleResolutionPaths: {},
        sourceDiagnosticFileNames: [filePath],
      });

      expect(program.engine).to.equal("tsts");
      expect(program.sourceFiles.map((file) => file.FileName())).to.include(
        filePath
      );
      expect(program.compilerDiagnostics).to.deep.equal([]);
      expect(program.diagnostics).to.deep.equal([]);
    });
  });

  it("exposes TSTS source semantic queries through the source program boundary", () => {
    withTempSource(
      `
        export function read(value: string | number) {
          if (typeof value === "string") {
            return value;
          }
          return value;
        }
      `,
      (filePath) => {
        const frontend = createTstsSourceFrontend();
        const program = frontend.createProgram([filePath], {
          projectRoot: path.dirname(filePath),
          moduleResolutionPaths: {},
          sourceDiagnosticFileNames: [filePath],
        });
        const sourceFile = must(program.sourceFiles[0], "source file missing");
        const valueUseTypes: string[] = [];

        program.withTypeChecker(sourceFile, (checker) => {
          for (const statement of must(
            sourceFile.Statements,
            "source file statements missing"
          ).Nodes) {
            visitTstsSubtree(statement, (node: GoPtr<TstsNode>) => {
              if (getTstsIdentifierText(node) !== "value") {
                return;
              }

              const type = checker.getTypeAtLocation(node);
              if (type !== undefined) {
                valueUseTypes.push(checker.typeToString(type));
              }
            });
          }
        });

        expect(program.compilerDiagnostics).to.deep.equal([]);
        expect(program.diagnostics).to.deep.equal([]);
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
        const frontend = createTstsSourceFrontend();
        const program = frontend.createProgram([indexFile, depFile], {
          projectRoot,
          moduleResolutionPaths: {},
          sourceDiagnosticFileNames: [indexFile, depFile],
        });

        expect(program.compilerDiagnostics).to.deep.equal([]);
        expect(program.diagnostics).to.deep.equal([]);
      }
    );
  });

  it("reports compiler diagnostics only for configured source diagnostic files", () => {
    withTempProject(
      {
        "index.ts": "export const answer: number = 42;\n",
        "support.ts": 'export const broken: number = "not a number";\n',
      },
      (projectRoot, filePaths) => {
        const indexFile = must(filePaths["index.ts"], "index.ts missing");
        const supportFile = must(filePaths["support.ts"], "support.ts missing");
        const frontend = createTstsSourceFrontend();
        const program = frontend.createProgram([indexFile, supportFile], {
          projectRoot,
          moduleResolutionPaths: {},
          sourceDiagnosticFileNames: [indexFile],
        });

        expect(program.compilerDiagnostics).to.deep.equal([]);
        expect(program.diagnostics).to.deep.equal([]);
      }
    );
  });
});
