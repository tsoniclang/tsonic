import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { restoreCommand } from "../restore.js";
import {
  createNugetPackage,
  existsSync,
  join,
  linkStandardBindings,
  mkdirSync,
  tmpdir,
  writeFileSync,
  writeNugetConfig,
  writeWorkspacePackageJson,
} from "./helpers.js";

describe("restore command (NuGet bindings)", function () {
  this.timeout(10 * 60 * 1000);

  it("skips bindings generation for NuGet packages with 'types: false'", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-restore-nuget-types-false-")
    );
    try {
      writeWorkspacePackageJson(dir);
      linkStandardBindings(dir);

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);
      createNugetPackage(dir, feedDir, { id: "Acme.A", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.Tooling",
        version: "1.0.0",
      });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [
                { id: "Acme.A", version: "1.0.0" },
                { id: "Acme.Tooling", version: "1.0.0", types: false },
              ],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(existsSync(join(dir, "node_modules", "acme-a-types"))).to.equal(
        true
      );
      expect(
        existsSync(join(dir, "node_modules", "acme-tooling-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a generated NuGet package depends on a 'types: false' package", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-restore-nuget-types-false-dep-")
    );
    try {
      writeWorkspacePackageJson(dir);
      linkStandardBindings(dir);

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);
      createNugetPackage(dir, feedDir, { id: "Acme.B", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.A",
        version: "1.0.0",
        deps: [{ id: "Acme.B", version: "1.0.0" }],
      });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [
                { id: "Acme.A", version: "1.0.0" },
                { id: "Acme.B", version: "1.0.0", types: false },
              ],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error).to.include("types: false");
        expect(result.error).to.include("Acme.B");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates real bindings for meta-package roots by claiming dependency DLLs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-nuget-meta-root-"));
    try {
      writeWorkspacePackageJson(dir);
      linkStandardBindings(dir);

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);
      createNugetPackage(dir, feedDir, { id: "Acme.A", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.Meta",
        version: "1.0.0",
        includeBuildOutput: false,
        deps: [{ id: "Acme.A", version: "1.0.0" }],
      });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [{ id: "Acme.Meta", version: "1.0.0" }],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);

      const metaTypesDir = join(dir, "node_modules", "acme-meta-types");
      expect(existsSync(metaTypesDir)).to.equal(true);
      expect(existsSync(join(dir, "node_modules", "acme-a-types"))).to.equal(
        false
      );
      expect(
        existsSync(join(metaTypesDir, "Acme_A", "bindings.json"))
      ).to.equal(true);
      expect(existsSync(join(metaTypesDir, "Acme_A.js"))).to.equal(true);
      expect(existsSync(join(metaTypesDir, "Acme_A.d.ts"))).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
