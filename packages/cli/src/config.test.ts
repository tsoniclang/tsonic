/**
 * Tests for configuration loading and resolution
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveConfig } from "./config.js";
import type { TsonicConfig, CliOptions } from "./types.js";

describe("Config", () => {
  describe("resolveConfig", () => {
    it("should use config values as defaults", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        entryPoint: "src/main.ts",
        sourceRoot: "src",
        outputDirectory: "dist",
        outputName: "myapp",
        rid: "linux-x64",
        dotnetVersion: "net10.0",
        optimize: "speed",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.rootNamespace).to.equal("MyApp");
      expect(result.entryPoint).to.equal("src/main.ts");
      expect(result.projectRoot).to.equal("/project");
      expect(result.sourceRoot).to.equal("src");
      expect(result.outputDirectory).to.equal("dist");
      expect(result.outputName).to.equal("myapp");
      expect(result.rid).to.equal("linux-x64");
      expect(result.dotnetVersion).to.equal("net10.0");
      expect(result.optimize).to.equal("speed");
    });

    it("should override config with CLI options", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        outputName: "myapp",
      };

      const cliOptions: CliOptions = {
        namespace: "OverriddenApp",
        out: "custom",
        src: "source",
        optimize: "size",
      };

      const result = resolveConfig(config, cliOptions, "/project");
      expect(result.rootNamespace).to.equal("OverriddenApp");
      expect(result.outputName).to.equal("custom");
      expect(result.sourceRoot).to.equal("source");
      expect(result.optimize).to.equal("size");
    });

    it("should use entry file parameter over config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        entryPoint: "src/main.ts",
      };

      const result = resolveConfig(config, {}, "/project", "custom/entry.ts");
      expect(result.entryPoint).to.equal("custom/entry.ts");
    });

    it("should leave entryPoint as undefined when not specified", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.entryPoint).to.equal(undefined);
    });

    it("should default sourceRoot to dirname of entryPoint", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        entryPoint: "app/index.ts",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.sourceRoot).to.equal("app");
    });

    it("should default outputDirectory to 'generated'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.outputDirectory).to.equal("generated");
    });

    it("should default outputName to 'app'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.outputName).to.equal("app");
    });

    it("should default dotnetVersion to 'net10.0'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.dotnetVersion).to.equal("net10.0");
    });

    it("should default optimize to 'speed'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.optimize).to.equal("speed");
    });

    it("should default namingPolicy.classes to 'default'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.namingPolicy.classes).to.equal("default");
    });

    it("should allow namingPolicy.classes override", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        namingPolicy: {
          classes: "PascalCase",
        },
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.namingPolicy.classes).to.equal("PascalCase");
    });

    it("should default stripSymbols to true", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.stripSymbols).to.equal(true);
    });

    it("should use buildOptions.stripSymbols from config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          stripSymbols: false,
        },
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.stripSymbols).to.equal(false);
    });

    it("should override stripSymbols with --no-strip CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          stripSymbols: true,
        },
      };

      const result = resolveConfig(config, { noStrip: true }, "/project");
      expect(result.stripSymbols).to.equal(false);
    });

    it("should default invariantGlobalization to true", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.invariantGlobalization).to.equal(true);
    });

    it("should use buildOptions.invariantGlobalization from config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          invariantGlobalization: false,
        },
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.invariantGlobalization).to.equal(false);
    });

    it("should default keepTemp to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.keepTemp).to.equal(false);
    });

    it("should set keepTemp from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { keepTemp: true }, "/project");
      expect(result.keepTemp).to.equal(true);
    });

    it("should default verbose to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.verbose).to.equal(false);
    });

    it("should set verbose from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { verbose: true }, "/project");
      expect(result.verbose).to.equal(true);
    });

    it("should default quiet to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.quiet).to.equal(false);
    });

    it("should set quiet from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { quiet: true }, "/project");
      expect(result.quiet).to.equal(true);
    });

    it("should default typeRoots to globals only", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/globals"]);
    });

    it("should use typeRoots from config.dotnet.typeRoots", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        dotnet: {
          typeRoots: ["custom/path/types", "another/path/types"],
        },
      };

      const result = resolveConfig(config, {}, "/project");
      expect(result.typeRoots).to.deep.equal([
        "custom/path/types",
        "another/path/types",
      ]);
    });

    it("should handle all options together", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "out",
        outputName: "program",
        rid: "linux-x64",
        dotnetVersion: "net9.0",
        optimize: "size",
        buildOptions: {
          stripSymbols: false,
          invariantGlobalization: false,
        },
      };

      const cliOptions: CliOptions = {
        namespace: "CLI.Override",
        src: "source",
        out: "binary",
        rid: "win-x64",
        optimize: "speed",
        noStrip: true,
        keepTemp: true,
        verbose: true,
        quiet: false,
      };

      const result = resolveConfig(config, cliOptions, "/project", "custom.ts");

      expect(result.rootNamespace).to.equal("CLI.Override");
      expect(result.entryPoint).to.equal("custom.ts");
      expect(result.projectRoot).to.equal("/project");
      expect(result.sourceRoot).to.equal("source");
      expect(result.outputDirectory).to.equal("out");
      expect(result.outputName).to.equal("binary");
      expect(result.rid).to.equal("win-x64");
      expect(result.dotnetVersion).to.equal("net9.0");
      expect(result.optimize).to.equal("speed");
      expect(result.stripSymbols).to.equal(false);
      expect(result.invariantGlobalization).to.equal(false);
      expect(result.keepTemp).to.equal(true);
      expect(result.verbose).to.equal(true);
      expect(result.quiet).to.equal(false);
    });
  });
});
