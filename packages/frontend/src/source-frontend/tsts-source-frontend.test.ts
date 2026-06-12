import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { getTstsIdentifierText, visitTstsSubtree } from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import { createTstsSourceFrontend } from "./tsts-source-frontend.js";
import { createSourceSemanticFactStore } from "./semantic-view.js";
import { numericPrimitiveFactKey } from "./source-facts.js";
import { projectTstsFactsToTypeScriptSource } from "./tsts-fact-projection.js";

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

  const must = <T>(value: GoPtr<T>, message: string): T => {
    if (value === undefined) {
      throw new Error(message);
    }
    return value;
  };

  const findFirstTypeReference = (
    sourceFile: ts.SourceFile,
    name: string
  ): ts.TypeReferenceNode => {
    let match: ts.TypeReferenceNode | undefined;
    const visit = (node: ts.Node): void => {
      if (match) return;
      if (
        ts.isTypeReferenceNode(node) &&
        ts.isIdentifier(node.typeName) &&
        node.typeName.text === name
      ) {
        match = node;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (!match) {
      throw new Error(`Missing TypeReferenceNode ${name}`);
    }
    return match;
  };

  it("creates a TSTS source program through the source frontend boundary", () => {
    withTempSource("export const answer: number = 42;\n", (filePath) => {
      const frontend = createTstsSourceFrontend();
      const program = frontend.createProgram([filePath], {
        projectRoot: path.dirname(filePath),
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
          runSemanticChecks: true,
        });
        const sourceFile = must(program.sourceFiles[0], "source file missing");
        const valueUseTypes: string[] = [];

        program.withSourceSemantics(sourceFile, (semantics) => {
          for (const statement of must(
            sourceFile.Statements,
            "source file statements missing"
          ).Nodes) {
            visitTstsSubtree(statement, (node: GoPtr<TstsNode>) => {
              if (getTstsIdentifierText(node) !== "value") {
                return;
              }

              const type = semantics.getTypeAtLocation(node);
              if (type !== undefined) {
                valueUseTypes.push(semantics.typeToString(type));
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

  it("projects TSTS source facts onto matching TypeScript source nodes", () => {
    const sourceText = [
      'import type { int } from "@tsonic/core/types.js";',
      "export const value: int = 1;",
      "",
    ].join("\n");

    withTempSource(sourceText, (filePath) => {
      const frontend = createTstsSourceFrontend();
      const program = frontend.createProgram([filePath], {
        projectRoot: path.dirname(filePath),
      });
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const factStore = createSourceSemanticFactStore<ts.Node>();

      const projection = projectTstsFactsToTypeScriptSource(
        program,
        [sourceFile],
        factStore
      );
      const intTypeReference = findFirstTypeReference(sourceFile, "int");

      expect(projection.missedFacts).to.deep.equal([]);
      expect(projection.projectedFacts).to.be.greaterThan(0);
      expect(
        factStore.get(numericPrimitiveFactKey, intTypeReference)
      ).to.deep.equal({
        sourceName: "int",
        kind: "int32",
        runtimeBase: "number",
        signed: true,
        width: 32,
      });
    });
  });

  it("reports TSTS source facts that cannot be projected", () => {
    const sourceText = [
      'import type { int } from "@tsonic/core/types.js";',
      "export const value: int = 1;",
      "",
    ].join("\n");

    withTempSource(sourceText, (filePath) => {
      const frontend = createTstsSourceFrontend();
      const program = frontend.createProgram([filePath], {
        projectRoot: path.dirname(filePath),
      });
      const factStore = createSourceSemanticFactStore<ts.Node>();

      const projection = projectTstsFactsToTypeScriptSource(
        program,
        [],
        factStore
      );

      expect(projection.projectedFacts).to.equal(0);
      const intMiss = projection.missedFacts.find(
        (miss) =>
          miss.fileName === filePath &&
          miss.reason === "source-file-not-found" &&
          miss.shape === "typeReference" &&
          miss.name === "int"
      );
      expect(intMiss).to.not.equal(undefined);
      expect(intMiss?.factIds).to.deep.equal([numericPrimitiveFactKey.id]);
      expect(intMiss?.pos).to.be.a("number");
      expect(intMiss?.end).to.be.a("number");
    });
  });

  it("transpiles through the vendored TSTS public API", async () => {
    const frontend = createTstsSourceFrontend();
    const result = await frontend.transpileModule(
      `
        const left: number = 20;
        const right: number = 22;
        export const answer = left + right;
      `,
      {
        fileName: "input.ts",
        compilerOptions: {
          module: "esnext",
          target: "es2020",
        },
      }
    );

    expect(result.engine).to.equal("tsts");
    expect(result.diagnosticCount).to.equal(0);
    expect(result.diagnosticsText).to.equal("");
    expect(result.emitText).to.contain("answer");
    expect(result.emitText).to.contain("left + right");
  });
});
