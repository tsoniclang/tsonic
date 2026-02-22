import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolvePackageRoot, resolveTsbindgenDllPath } from "./add-common.js";

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf-8");
};

describe("add-common module resolution", () => {
  it("resolves tsbindgen DLL when package.json is not exported (Node exports)", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-tsbindgen-")
    );

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const pkgRoot = join(projectRoot, "node_modules", "@tsonic", "tsbindgen");
      mkdirSync(join(pkgRoot, "lib"), { recursive: true });
      writeJson(join(pkgRoot, "package.json"), {
        name: "@tsonic/tsbindgen",
        version: "0.0.0-test",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      });
      writeFileSync(join(pkgRoot, "index.js"), "export {};\n", "utf-8");
      writeFileSync(join(pkgRoot, "lib", "tsbindgen.dll"), "", "utf-8");

      const result = resolveTsbindgenDllPath(projectRoot);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(
        resolve(join(pkgRoot, "lib", "tsbindgen.dll"))
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("resolves package root when package.json subpath is blocked by exports", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "tsonic-resolve-pkgroot-"));

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const pkgRoot = join(projectRoot, "node_modules", "foo");
      mkdirSync(pkgRoot, { recursive: true });
      writeJson(join(pkgRoot, "package.json"), {
        name: "foo",
        version: "0.0.0-test",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      });
      writeFileSync(join(pkgRoot, "index.js"), "export {};\n", "utf-8");

      const result = resolvePackageRoot(projectRoot, "foo");
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(resolve(pkgRoot));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
