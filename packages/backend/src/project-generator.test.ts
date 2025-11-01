/**
 * Tests for .csproj generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { generateCsproj } from "./project-generator.js";
import { BuildConfig } from "./types.js";

describe("Project Generator", () => {
  describe("generateCsproj", () => {
    it("should generate basic .csproj without packages", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        packages: [],
        invariantGlobalization: true,
        stripSymbols: true,
        optimizationPreference: "Speed",
      };

      const result = generateCsproj(config);

      expect(result).to.include('<Project Sdk="Microsoft.NET.Sdk">');
      expect(result).to.include("<TargetFramework>net10.0</TargetFramework>");
      expect(result).to.include("<RootNamespace>TestApp</RootNamespace>");
      expect(result).to.include("<AssemblyName>test</AssemblyName>");
      expect(result).to.include("<PublishAot>true</PublishAot>");
      expect(result).to.include(
        "<OptimizationPreference>Speed</OptimizationPreference>"
      );
    });

    it("should include package references when provided", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        packages: [
          { name: "System.Text.Json", version: "8.0.0" },
          { name: "Newtonsoft.Json", version: "13.0.3" },
        ],
        invariantGlobalization: true,
        stripSymbols: true,
        optimizationPreference: "Size",
      };

      const result = generateCsproj(config);

      expect(result).to.include(
        '<PackageReference Include="System.Text.Json" Version="8.0.0"'
      );
      expect(result).to.include(
        '<PackageReference Include="Newtonsoft.Json" Version="13.0.3"'
      );
      expect(result).to.include(
        "<OptimizationPreference>Size</OptimizationPreference>"
      );
    });

    it("should set invariant globalization correctly", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        packages: [],
        invariantGlobalization: false,
        stripSymbols: false,
        optimizationPreference: "Speed",
      };

      const result = generateCsproj(config);

      expect(result).to.include(
        "<InvariantGlobalization>false</InvariantGlobalization>"
      );
      expect(result).to.include("<StripSymbols>false</StripSymbols>");
    });
  });
});
