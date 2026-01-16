/**
 * Regression tests for `tsonic add reference`.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addReferenceCommand } from "./add-reference.js";

describe("add reference", () => {
  it("adds a DLL path to dotnet.libraries without copying or generating", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-reference-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "lib"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      // Dummy "DLL" for command validation.
      writeFileSync(join(dir, "lib", "Acme.Widget.dll"), "not-a-real-dll", "utf-8");

      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Test",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "app",
            dotnetVersion: "net10.0",
            dotnet: {
              dllDirs: ["lib"],
              typeRoots: ["node_modules/@tsonic/globals"],
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

      const configPath = join(dir, "tsonic.json");
      const result = addReferenceCommand("lib/Acme.Widget.dll", undefined, configPath);
      expect(result.ok).to.equal(true);

      const updated = JSON.parse(readFileSync(configPath, "utf-8")) as {
        dotnet?: { libraries?: unknown[] };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["lib/Acme.Widget.dll"]);

      // Ensure we did not create any generated bindings packages.
      expect(() => readFileSync(join(dir, "node_modules", "acme-widget-types", "package.json"))).to.throw();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes a relative path when passed an absolute DLL path", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-add-reference-abs-"));
    try {
      mkdirSync(join(dir, "lib"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) + "\n",
        "utf-8"
      );
      writeFileSync(join(dir, "lib", "Acme.Widget.dll"), "not-a-real-dll", "utf-8");
      writeFileSync(
        join(dir, "tsonic.json"),
        JSON.stringify({ rootNamespace: "Test", dotnet: { dllDirs: ["lib"], libraries: [] } }, null, 2) +
          "\n",
        "utf-8"
      );

      const configPath = join(dir, "tsonic.json");
      const dllAbs = join(dir, "lib", "Acme.Widget.dll");
      const result = addReferenceCommand(dllAbs, "@acme/widget-types", configPath);
      expect(result.ok).to.equal(true);

      const updated = JSON.parse(readFileSync(configPath, "utf-8")) as {
        dotnet?: { libraries?: unknown[] };
      };

      const libs = updated.dotnet?.libraries ?? [];
      expect(libs).to.deep.equal([{ path: "lib/Acme.Widget.dll", types: "@acme/widget-types" }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
