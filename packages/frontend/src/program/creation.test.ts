/**
 * Tests for program creation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgram } from "./creation.js";

describe("Program Creation", () => {
  it("should resolve @tsonic/* imports from the project root (global install)", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-creation-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });

      const fakeDotnetRoot = path.join(tempDir, "node_modules/@tsonic/dotnet");
      fs.mkdirSync(fakeDotnetRoot, { recursive: true });
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "System.d.ts"),
        "export const Marker: unique symbol;\n"
      );
      fs.writeFileSync(
        path.join(fakeDotnetRoot, "System.js"),
        "export const Marker = Symbol('marker');\n"
      );

      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(
        entryPath,
        'import { Marker } from "@tsonic/dotnet/System.js";\nexport const ok = Marker;\n'
      );

      const result = createProgram([entryPath], {
        projectRoot: tempDir,
        sourceRoot: srcDir,
        rootNamespace: "Test",
        useStandardLib: true,
        typeRoots: [],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const expectedDts = path.resolve(
        path.join(fakeDotnetRoot, "System.d.ts")
      );
      expect(result.value.program.getSourceFile(expectedDts)).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
