import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { restoreCommand } from "../restore.js";
import {
  buildSimpleDll,
  existsSync,
  join,
  linkStandardBindings,
  mkdirSync,
  tmpdir,
  writeFileSync,
  writeWorkspacePackageJson,
} from "./helpers.js";

describe("restore command (explicit DLL types mappings)", function () {
  this.timeout(10 * 60 * 1000);

  it("skips bindings generation for DLLs with an explicit 'types' mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-"));
    try {
      writeWorkspacePackageJson(dir);
      buildSimpleDll(dir, "Acme.Test", "Acme.Test");
      linkStandardBindings(dir);

      const typesPkg = join(dir, "node_modules/@acme/acme-test-types");
      mkdirSync(typesPkg, { recursive: true });
      writeFileSync(
        join(typesPkg, "package.json"),
        JSON.stringify(
          { name: "@acme/acme-test-types", version: "0.0.0", type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [
                { path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" },
              ],
              frameworkReferences: [],
              packageReferences: [],
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
      expect(existsSync(join(dir, "node_modules", "acme-test-types"))).to.equal(
        false
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a DLL has a 'types' mapping but the package is missing", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-restore-dll-types-missing-")
    );
    try {
      writeWorkspacePackageJson(dir);
      buildSimpleDll(dir, "Acme.Test", "Acme.Test");
      linkStandardBindings(dir);

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [
                { path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" },
              ],
              frameworkReferences: [],
              packageReferences: [],
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
        expect(result.error).to.include("Bindings package not found");
        expect(result.error).to.include("@acme/acme-test-types");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
