import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "../creation.js";
import { installMinimalCoreGlobalsSurface } from "./test-package-helpers.js";

const createTempProgram = (): {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly entryPath: string;
  readonly globalsRoot: string;
  readonly cleanup: () => void;
} => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-source-frontend-")
  );
  const sourceRoot = path.join(projectRoot, "src");
  const entryPath = path.join(sourceRoot, "index.ts");
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(entryPath, "export const value = 1;\n");
  const globalsRoot = installMinimalCoreGlobalsSurface(projectRoot);
  return {
    projectRoot,
    sourceRoot,
    entryPath,
    globalsRoot,
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};

describe("Program Creation – source frontend engine", () => {
  it("uses the TypeScript-backed program path by default", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects the TSTS-backed IR path until the TSTS program surface is complete", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        sourceFrontend: "tsts",
      });

      expect(result.ok).to.equal(false);
      if (result.ok) return;

      expect(result.error.diagnostics).to.have.length(1);
      expect(result.error.diagnostics[0]?.code).to.equal("TSN1007");
      expect(result.error.diagnostics[0]?.message).to.contain(
        "not available for IR construction yet"
      );
    } finally {
      fixture.cleanup();
    }
  });
});
