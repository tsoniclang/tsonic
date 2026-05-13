import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validateUnsupportedFeatures", () => {
  describe("diagnostic-only name sets", () => {
    it("keeps JavaScript diagnostic name sets private to the validator module", () => {
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
          `export const ${name}`,
          `${name} must not become an exported semantic surface API`
        );
      }
    });
  });
});
