import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installGeneratedBindingsPackage } from "./generated-bindings.js";

describe("generated bindings package install", () => {
  it("refuses to overwrite directories without package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-generated-bindings-"));

    try {
      const fromDir = join(dir, ".tsonic", "bindings", "dll", "nodejs-types");
      mkdirSync(fromDir, { recursive: true });
      writeFileSync(
        join(fromDir, "package.json"),
        JSON.stringify(
          {
            name: "nodejs-types",
            version: "0.0.0",
            private: true,
            type: "module",
            tsonic: {
              generated: true,
              kind: "dll",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(join(fromDir, "families.json"), "{}\n", "utf-8");
      writeFileSync(join(fromDir, "index.d.ts"), "export {};\n", "utf-8");

      const existingTarget = join(dir, "node_modules", "nodejs-types");
      mkdirSync(existingTarget, { recursive: true });
      writeFileSync(join(existingTarget, "families.json"), "{}\n", "utf-8");
      writeFileSync(join(existingTarget, "index.d.ts"), "export {};\n", "utf-8");

      const result = installGeneratedBindingsPackage(
        dir,
        "nodejs-types",
        fromDir
      );

      expect(result.ok).to.equal(false);
      expect(result.ok ? "" : result.error).to.include(
        "Refusing to overwrite existing directory without package.json"
      );
      expect(existsSync(join(existingTarget, "package.json"))).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
