import { describe, it } from "mocha";
import { expect } from "chai";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getJsDiagnosticSurfaceMetadata } from "../../surface/diagnostic-metadata.js";

describe("validateUnsupportedFeatures", () => {
  describe("diagnostic-only surface metadata", () => {
    it("keeps JavaScript diagnostic names out of the validator module", () => {
      const source = readFileSync(
        resolve(process.cwd(), "src/validation/features.ts"),
        "utf8"
      );

      for (const name of [
        "JS_BUILTIN_MEMBER_NAMES",
        "JS_AMBIENT_GLOBAL_CALLS",
        "JS_AMBIENT_GLOBAL_FUNCTIONS",
        "TYPED_ARRAY_SYMBOL_NAMES",
      ]) {
        expect(source).to.not.include(
          name,
          `${name} must not be a validator-owned semantic surface list`
        );
      }
    });

    it("loads JavaScript diagnostic names from the surface metadata module", () => {
      const metadataPath = resolve(
        process.cwd(),
        "src/surface/diagnostic-metadata.ts"
      );
      expect(existsSync(metadataPath)).to.equal(true);

      const metadata = getJsDiagnosticSurfaceMetadata();
      expect(metadata.builtinMemberNames).to.include("length");
      expect(metadata.ambientGlobalCalls.JSON).to.deep.equal([
        "parse",
        "stringify",
      ]);
      expect(metadata.ambientGlobalFunctions).to.include("Array");
      expect(metadata.typedArraySymbolNames).to.include("Uint8Array");
    });
  });
});
