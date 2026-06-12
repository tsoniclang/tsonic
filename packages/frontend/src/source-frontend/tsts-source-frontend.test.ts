import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
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
