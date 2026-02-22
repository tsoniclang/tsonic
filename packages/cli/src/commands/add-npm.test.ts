/**
 * Integration tests for `tsonic add npm`.
 *
 * These tests are intentionally end-to-end at the CLI command level:
 * - Use local `file:` npm packages (no registry)
 * - Verify `tsonic.bindings.json` manifest merging behavior
 * - Verify airplane-grade conflict detection
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNpmCommand } from "./add-npm.js";

const writeWorkspaceConfig = (dir: string): string => {
  const configPath = join(dir, "tsonic.workspace.json");
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        dotnet: {
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
      "\n",
    "utf-8"
  );

  return configPath;
};

const readWorkspaceConfig = (dir: string): any => {
  return JSON.parse(readFileSync(join(dir, "tsonic.workspace.json"), "utf-8"));
};

const writeLocalNpmPackage = (
  workspaceRoot: string,
  relDir: string,
  pkg: { readonly name: string; readonly manifest?: unknown }
): string => {
  const pkgRoot = join(workspaceRoot, relDir);
  mkdirSync(pkgRoot, { recursive: true });

  writeFileSync(
    join(pkgRoot, "package.json"),
    JSON.stringify(
      {
        name: pkg.name,
        private: true,
        version: "1.0.0",
        type: "module",
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  if (pkg.manifest !== undefined) {
    writeFileSync(
      join(pkgRoot, "tsonic.bindings.json"),
      JSON.stringify(pkg.manifest, null, 2) + "\n",
      "utf-8"
    );
  }

  return pkgRoot;
};

describe("add npm", function () {
  this.timeout(3 * 60 * 1000);

  it("installs local package and merges manifest into workspace config", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-"));
    try {
      const configPath = writeWorkspaceConfig(dir);

      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          dotnet: {
            frameworkReferences: [
              { id: "Microsoft.AspNetCore.App", types: pkgName },
            ],
            packageReferences: [
              { id: "Acme.A", version: "1.0.0", types: pkgName },
            ],
            msbuildProperties: { InterceptorsNamespaces: "Acme.Generated" },
          },
          testDotnet: {
            packageReferences: [
              { id: "Acme.Test", version: "2.0.0", types: false },
            ],
          },
        },
      });

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(result.ok ? result.value.packageName : "").to.equal(pkgName);

      expect(existsSync(join(dir, "node_modules", pkgName))).to.equal(true);

      const cfg = readWorkspaceConfig(dir);
      expect(cfg.dotnet.frameworkReferences).to.deep.equal([
        { id: "Microsoft.AspNetCore.App", types: pkgName },
      ]);
      expect(cfg.dotnet.packageReferences).to.deep.equal([
        { id: "Acme.A", version: "1.0.0", types: pkgName },
      ]);
      expect(cfg.dotnet.msbuildProperties).to.deep.equal({
        InterceptorsNamespaces: "Acme.Generated",
      });
      expect(cfg.testDotnet.packageReferences).to.deep.equal([
        { id: "Acme.Test", version: "2.0.0", types: false },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors on manifest conflicts (different NuGet version)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-conflict-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      const pkgName = "acme-bindings";
      writeLocalNpmPackage(dir, "local/acme-bindings", {
        name: pkgName,
        manifest: {
          dotnet: {
            packageReferences: [
              { id: "Acme.A", version: "1.0.0", types: pkgName },
            ],
          },
        },
      });

      // Seed a conflicting workspace package reference.
      const cfg = readWorkspaceConfig(dir);
      cfg.dotnet.packageReferences = [{ id: "Acme.A", version: "0.9.0" }];
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(cfg, null, 2) + "\n",
        "utf-8"
      );

      const result = addNpmCommand("./local/acme-bindings", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(/different version/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("errors when the npm package lacks tsonic.bindings.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-npm-missing-"));
    try {
      const configPath = writeWorkspaceConfig(dir);
      writeLocalNpmPackage(dir, "local/no-manifest", { name: "no-manifest" });

      const result = addNpmCommand("./local/no-manifest", configPath, {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.match(
        /Missing tsonic\.bindings\.json/
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
