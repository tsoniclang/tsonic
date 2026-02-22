/**
 * Tests for `field<T>` class-member emission marker.
 *
 * `field<T>` is a TS-only marker used to force C# field emission for a class member.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { compile } from "../index.js";
import { buildIr } from "./builder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, "../../../..");
const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");

const writeCoreStubWithFieldMarker = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      { name: "@tsonic/core", private: true, type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(dir, "lang.d.ts"),
    [
      'declare module "@tsonic/core/lang.js" {',
      "  export type field<T> = T;",
      "}",
      "",
    ].join("\n")
  );
};

describe("field<T> marker", function () {
  this.timeout(60_000);

  it("fails deterministically when used on an overriding property", () => {
    const tmpDir = `/tmp/field-marker-test-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });

    const stubCore = path.join(tmpDir, "type-roots", "core");
    writeCoreStubWithFieldMarker(stubCore);

    const filePath = path.join(tmpDir, "test.ts");
    fs.writeFileSync(
      filePath,
      `
        import type { field } from "@tsonic/core/lang.js";

        export class Base {
          public name: string = "base";
        }

        export class Derived extends Base {
          public name: field<string> = "derived";
        }
      `
    );

    const compileResult = compile([filePath], {
      projectRoot: monorepoRoot,
      sourceRoot: tmpDir,
      rootNamespace: "Test",
      typeRoots: [globalsPath, stubCore, corePath],
    });

    expect(compileResult.ok).to.equal(true);
    if (!compileResult.ok) return;

    const irResult = buildIr(compileResult.value.program, {
      sourceRoot: tmpDir,
      rootNamespace: "Test",
    });

    expect(irResult.ok).to.equal(false);
    if (irResult.ok) return;

    const codes = new Set(irResult.error.map((d) => d.code));
    expect(codes.has("TSN6204")).to.equal(true);
  });
});
