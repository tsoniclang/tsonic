import { expect } from "chai";
import { createTstsSourceFrontend } from "./tsts-source-frontend.js";

describe("TSTS source frontend", () => {
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
