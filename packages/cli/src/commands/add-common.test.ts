import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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

  it("falls back to the CLI's own tsbindgen when the workspace does not provide one", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-tsbindgen-self-")
    );

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const selfReq = createRequire(import.meta.url);
      const selfPkgRoot = resolve(
        selfReq.resolve("@tsonic/tsbindgen"),
        ".."
      );
      const expectedDll = resolve(selfPkgRoot, "lib", "tsbindgen.dll");

      const result = resolveTsbindgenDllPath(projectRoot);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(expectedDll);
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

  it("resolves sibling @tsonic package root when not installed in node_modules", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-sibling-pkgroot-")
    );

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const result = resolvePackageRoot(projectRoot, "@tsonic/nodejs");
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.match(
        new RegExp(`[/\\\\]nodejs([/\\\\]versions[/\\\\]\\d+)?$`)
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("prefers sibling source-package roots over workspace-installed legacy copies", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-sibling-pref-")
    );

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const pkgRoot = join(projectRoot, "node_modules", "@tsonic", "js");
      mkdirSync(pkgRoot, { recursive: true });
      writeJson(join(pkgRoot, "package.json"), {
        name: "@tsonic/js",
        version: "0.0.0-test",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      });
      writeFileSync(join(pkgRoot, "index.js"), "export {};\n", "utf-8");

      const result = resolvePackageRoot(projectRoot, "@tsonic/js");
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.not.equal(resolve(pkgRoot));
      expect(resolve(result.value)).to.match(
        new RegExp(`[/\\\\]js([/\\\\]versions[/\\\\]\\d+)?$`)
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("prefers workspace-installed source-package roots over sibling source repos", () => {
    const projectRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-installed-source-pref-")
    );

    try {
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const pkgRoot = join(projectRoot, "node_modules", "@tsonic", "js");
      mkdirSync(pkgRoot, { recursive: true });
      writeJson(join(pkgRoot, "package.json"), {
        name: "@tsonic/js",
        version: "10.0.99-test",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      });
      writeJson(join(pkgRoot, "tsonic.package.json"), {
        schemaVersion: 1,
        kind: "tsonic-source-package",
        source: {
          namespace: "Acme.Js",
          exports: {
            ".": "./index.js",
          },
        },
      });
      writeFileSync(join(pkgRoot, "index.js"), "export {};\n", "utf-8");

      const result = resolvePackageRoot(projectRoot, "@tsonic/js");
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.equal(resolve(pkgRoot));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("prefers sibling @tsonic package roots over ancestor-installed copies", () => {
    const parentRoot = mkdtempSync(
      join(tmpdir(), "tsonic-resolve-sibling-parent-")
    );
    const projectRoot = join(parentRoot, "packages", "app");

    try {
      mkdirSync(projectRoot, { recursive: true });
      writeJson(join(projectRoot, "package.json"), {
        name: "test",
        private: true,
        type: "module",
      });

      const pkgRoot = join(parentRoot, "node_modules", "@tsonic", "js");
      mkdirSync(pkgRoot, { recursive: true });
      writeJson(join(pkgRoot, "package.json"), {
        name: "@tsonic/js",
        version: "0.0.0-test",
        type: "module",
        exports: {
          ".": "./index.js",
        },
      });
      writeFileSync(join(pkgRoot, "index.js"), "export {};\n", "utf-8");

      const result = resolvePackageRoot(projectRoot, "@tsonic/js");
      expect(result.ok).to.equal(true);
      if (!result.ok) return;
      expect(resolve(result.value)).to.not.equal(resolve(pkgRoot));
      expect(resolve(result.value)).to.match(
        new RegExp(`[/\\\\]js([/\\\\]versions[/\\\\]\\d+)?$`)
      );
    } finally {
      rmSync(parentRoot, { recursive: true, force: true });
    }
  });
});
