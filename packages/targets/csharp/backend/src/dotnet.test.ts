/**
 * Tests for dotnet CLI wrapper
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { detectRid } from "./dotnet.js";

describe("Dotnet CLI Wrapper", () => {
  describe("detectRid", () => {
    it("should return a valid runtime identifier", () => {
      const rid = detectRid();

      // Should match one of the known RID patterns
      const validRids = [
        "osx-x64",
        "osx-arm64",
        "linux-x64",
        "linux-arm64",
        "win-x64",
        "win-arm64",
      ];

      expect(validRids).to.include(rid);
    });

    it("should detect current platform RID", () => {
      const rid = detectRid();
      const platform = process.platform;
      const arch = process.arch;

      if (platform === "darwin") {
        expect(rid).to.match(/^osx-/);
      } else if (platform === "linux") {
        expect(rid).to.match(/^linux-/);
      } else if (platform === "win32") {
        expect(rid).to.match(/^win-/);
      }

      if (arch === "x64") {
        expect(rid).to.include("x64");
      } else if (arch === "arm64") {
        expect(rid).to.include("arm64");
      }
    });
  });

  // Note: checkDotnetInstalled and publishNativeAot are integration tests
  // that require dotnet to be installed, so we skip them in unit tests
});
