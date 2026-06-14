import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProgramContext } from "./program-context.js";
import { packageHasExternalMetadata } from "./program-context-types.js";
import { BindingRegistry } from "../program/bindings.js";
import { createTstsTestProgramFromFiles } from "../testing/tsts-test-program.js";

describe("createProgramContext", () => {
  it("treats participating non-@tsonic packages with bindings.json as CLR metadata packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-context-metadata-")
    );

    try {
      const pkgRoot = path.join(tempDir, "node_modules", "markdig-types");
      fs.mkdirSync(path.join(pkgRoot, "Markdig.Syntax"), { recursive: true });
      fs.writeFileSync(
        path.join(pkgRoot, "package.json"),
        JSON.stringify(
          { name: "markdig-types", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(pkgRoot, "Markdig.Syntax", "bindings.json"),
        JSON.stringify(
          {
            schema: "tsonic.bindings",
            provider: { namespace: "Markdig.Syntax" },
            targetSurface: { types: [] },
          },
          null,
          2
        )
      );

      const packageInfoCache = new Map();
      const packageHasMetadataCache = new Map<string, boolean>();

      expect(
        packageHasExternalMetadata(
          pkgRoot,
          packageInfoCache,
          packageHasMetadataCache
        )
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores stray ancestor package roots outside the project boundary", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-context-")
    );

    try {
      const projectRoot = path.join(tempDir, "project");
      const srcDir = path.join(projectRoot, "src");
      const declDir = path.join(projectRoot, "decls");

      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(declDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "stray-root", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.mkdirSync(path.join(tempDir, "Broken"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "Broken", "bindings.json"),
        JSON.stringify(
          {
            schema: "tsonic.bindings",
            provider: { namespace: "Broken" },
            targetSurface: { types: [{ targetName: "Broken.Type" }] },
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );

      const entryFile = path.join(srcDir, "main.ts");
      const declarationFile = path.join(declDir, "globals.d.ts");
      fs.writeFileSync(entryFile, "export const ok = 1;\n");
      fs.writeFileSync(declarationFile, "export {};\n");

      const tsonicProgram = createTstsTestProgramFromFiles(
        {
          [path.relative(projectRoot, entryFile)]: "export const ok = 1;\n",
          [path.relative(projectRoot, declarationFile)]: "export {};\n",
        },
        path.relative(projectRoot, entryFile),
        {
          projectRoot,
          sourceRoot: srcDir,
          rootNamespace: "TestApp",
          strict: true,
          bindings: new BindingRegistry(),
        }
      );

      const ctx = createProgramContext(tsonicProgram, {
        sourceRoot: srcDir,
        rootNamespace: "TestApp",
      });

      expect(ctx.diagnostics).to.deep.equal([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
