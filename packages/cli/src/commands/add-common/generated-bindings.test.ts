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
import { installGeneratedBindingsPackage } from "./generated-bindings.js";

describe("generated bindings package install", () => {
  it("replaces legacy generated directories that predate package.json", () => {
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

      const legacyTarget = join(dir, "node_modules", "nodejs-types");
      mkdirSync(legacyTarget, { recursive: true });
      writeFileSync(join(legacyTarget, "families.json"), "{}\n", "utf-8");
      writeFileSync(join(legacyTarget, "index.d.ts"), "export {};\n", "utf-8");

      const result = installGeneratedBindingsPackage(
        dir,
        "nodejs-types",
        fromDir
      );

      expect(result.ok).to.equal(true);
      expect(existsSync(join(legacyTarget, "package.json"))).to.equal(true);

      const pkgJson = JSON.parse(
        readFileSync(join(legacyTarget, "package.json"), "utf-8")
      ) as { readonly tsonic?: { readonly generated?: boolean } };
      expect(pkgJson.tsonic?.generated).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
