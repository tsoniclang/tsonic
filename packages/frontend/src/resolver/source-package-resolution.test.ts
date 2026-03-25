import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  getLocalResolutionBoundary,
  isPathWithinBoundary,
  resolveSourcePackageImport,
} from "./source-package-resolution.js";

describe("Source Package Resolution", () => {
  it("should resolve installed source packages without relying on package.json exports", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-source-package-resolution-")
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
      const entryPath = path.join(srcDir, "index.ts");
      fs.writeFileSync(entryPath, 'import { clamp } from "@acme/math";\n');

      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/math",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./dist/index.js",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "src", "index.ts"),
        "export const clamp = (x: number): number => x;\n"
      );

      const result = resolveSourcePackageImport(
        "@acme/math",
        entryPath,
        "@tsonic/js",
        tempDir
      );

      expect(result.ok).to.equal(true);
      if (!result.ok || !result.value) return;

      expect(result.value.packageRoot).to.equal(packageRoot);
      expect(result.value.resolvedPath).to.equal(
        path.join(packageRoot, "src", "index.ts")
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should use the source package root as the local resolution boundary", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-source-package-boundary-")
    );

    try {
      const sourceRoot = path.join(tempDir, "src");
      fs.mkdirSync(sourceRoot, { recursive: true });

      const packageRoot = path.join(tempDir, "node_modules", "@acme", "math");
      const packageEntry = path.join(packageRoot, "src", "index.ts");
      fs.mkdirSync(path.dirname(packageEntry), { recursive: true });
      fs.mkdirSync(path.join(packageRoot, "tsonic"), { recursive: true });
      fs.writeFileSync(
        path.join(packageRoot, "package.json"),
        JSON.stringify(
          { name: "@acme/math", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(packageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(packageEntry, "export const clamp = 1;\n");

      expect(getLocalResolutionBoundary(packageEntry, sourceRoot)).to.equal(
        packageRoot
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should use path-segment containment instead of string-prefix containment", () => {
    const root = path.join("/tmp", "project", "src");
    const sibling = path.join("/tmp", "project", "src-private", "index.ts");

    expect(isPathWithinBoundary(path.join(root, "index.ts"), root)).to.equal(
      true
    );
    expect(isPathWithinBoundary(sibling, root)).to.equal(false);
  });
});
