/**
 * Tests for .csproj generation
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { generateCsproj } from "./project-generator.js";
import { BuildConfig } from "./types.js";

describe("Project Generator", () => {
  describe("generateCsproj", () => {
    it("should generate basic executable .csproj", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        outputConfig: {
          type: "executable",
          nativeAot: true,
          singleFile: true,
          trimmed: true,
          stripSymbols: true,
          optimization: "Speed",
          invariantGlobalization: true,
          selfContained: true,
        },
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

    it("should include assembly references when provided", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        assemblyReferences: [
          { name: "Tsonic.Runtime", hintPath: "lib/Tsonic.Runtime.dll" },
        ],
        outputConfig: {
          type: "executable",
          nativeAot: true,
          singleFile: true,
          trimmed: true,
          stripSymbols: true,
          optimization: "Size",
          invariantGlobalization: true,
          selfContained: true,
        },
      };

      const result = generateCsproj(config);

      expect(result).to.include('<Reference Include="Tsonic.Runtime">');
      expect(result).to.include("<HintPath>lib/Tsonic.Runtime.dll</HintPath>");
      expect(result).to.include(
        "<OptimizationPreference>Size</OptimizationPreference>"
      );
    });

    it("should set invariant globalization correctly", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        outputConfig: {
          type: "executable",
          nativeAot: true,
          singleFile: true,
          trimmed: true,
          stripSymbols: false,
          optimization: "Speed",
          invariantGlobalization: false,
          selfContained: true,
        },
      };

      const result = generateCsproj(config);

      expect(result).to.include(
        "<InvariantGlobalization>false</InvariantGlobalization>"
      );
      expect(result).to.include("<StripSymbols>false</StripSymbols>");
    });

    it("should include framework references when provided", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        frameworkReferences: ["Microsoft.AspNetCore.App"],
        outputConfig: {
          type: "executable",
          nativeAot: false,
          singleFile: true,
          trimmed: false,
          stripSymbols: false,
          optimization: "Speed",
          invariantGlobalization: true,
          selfContained: false,
        },
      };

      const result = generateCsproj(config);

      expect(result).to.include(
        '<FrameworkReference Include="Microsoft.AspNetCore.App" />'
      );
    });

    it("should include NuGet package references when provided", () => {
      const config: BuildConfig = {
        rootNamespace: "TestApp",
        outputName: "test",
        dotnetVersion: "net10.0",
        packageReferences: [
          { id: "Microsoft.EntityFrameworkCore", version: "10.0.1" },
        ],
        outputConfig: {
          type: "executable",
          nativeAot: false,
          singleFile: true,
          trimmed: false,
          stripSymbols: false,
          optimization: "Speed",
          invariantGlobalization: true,
          selfContained: false,
        },
      };

      const result = generateCsproj(config);

      expect(result).to.include(
        '<PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.1" />'
      );
    });

    it("should generate library .csproj", () => {
      const config: BuildConfig = {
        rootNamespace: "TestLib",
        outputName: "testlib",
        dotnetVersion: "net10.0",
        outputConfig: {
          type: "library",
          targetFrameworks: ["net8.0", "net9.0"],
          generateDocumentation: true,
          includeSymbols: true,
          packable: false,
        },
      };

      const result = generateCsproj(config);

      expect(result).to.include("<OutputType>Library</OutputType>");
      expect(result).to.include(
        "<TargetFrameworks>net8.0;net9.0</TargetFrameworks>"
      );
      expect(result).to.include(
        "<GenerateDocumentationFile>true</GenerateDocumentationFile>"
      );
      expect(result).to.include("<DebugType>embedded</DebugType>");
      expect(result).to.include("<IsPackable>false</IsPackable>");
    });
  });
});
