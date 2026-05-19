/**
 * Tests for Program.cs generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { generateProgramCs } from "./program-generator.js";
import { EntryInfo } from "./types.js";

describe("Program Generator", () => {
  describe("generateProgramCs", () => {
    it("should generate synchronous Main method", () => {
      const entryInfo: EntryInfo = {
        namespace: "MyApp",
        className: "main",
        methodName: "start",
        isAsync: false,
        needsProgram: true,
      };

      const result = generateProgramCs(entryInfo);

      expect(result).to.include("public static void Main(string[] args)");
      expect(result).to.include("global::MyApp.main.start();");
      expect(result).to.not.include("await");
      expect(result).to.not.include("async");
      expect(result).to.not.include("using MyApp;");
    });

    it("should generate async Main method", () => {
      const entryInfo: EntryInfo = {
        namespace: "MyApp.Services",
        className: "main",
        methodName: "run",
        isAsync: true,
        needsProgram: true,
      };

      const result = generateProgramCs(entryInfo);

      expect(result).to.include("public static async Task Main(string[] args)");
      expect(result).to.include("await global::MyApp.Services.main.run();");
      expect(result).to.not.include("using MyApp.Services;");
      expect(result).to.include("using System.Threading.Tasks;");
    });

    it("should include required using statements", () => {
      const entryInfo: EntryInfo = {
        namespace: "Test",
        className: "Program",
        methodName: "Main",
        isAsync: false,
        needsProgram: true,
      };

      const result = generateProgramCs(entryInfo);

      expect(result).to.include("using System;");
      expect(result).to.not.include("using Test;");
      // No Tsonic.Runtime using - we use native CLR types only
      expect(result).not.to.include("using Tsonic.Runtime;");
    });
  });
});
