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

      const result = resolveConfig(config, {});
      expect(result.rootNamespace).to.equal("MyApp");
      expect(result.entryPoint).to.equal("src/main.ts");
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

      const result = resolveConfig(config, cliOptions);
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

      const result = resolveConfig(config, {}, "custom/entry.ts");
      expect(result.entryPoint).to.equal("custom/entry.ts");
    });

    it("should leave entryPoint as undefined when not specified", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.entryPoint).to.be.undefined;
    });

    it("should default sourceRoot to dirname of entryPoint", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        entryPoint: "app/index.ts",
      };

      const result = resolveConfig(config, {});
      expect(result.sourceRoot).to.equal("app");
    });

    it("should default outputDirectory to 'generated'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.outputDirectory).to.equal("generated");
    });

    it("should default outputName to 'app'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.outputName).to.equal("app");
    });

    it("should default dotnetVersion to 'net10.0'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.dotnetVersion).to.equal("net10.0");
    });

    it("should default optimize to 'speed'", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.optimize).to.equal("speed");
    });

    it("should default packages to empty array", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.packages).to.deep.equal([]);
    });

    it("should include packages from config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        packages: [
          { name: "System.Text.Json", version: "8.0.0" },
          { name: "Newtonsoft.Json", version: "13.0.3" },
        ],
      };

      const result = resolveConfig(config, {});
      expect(result.packages).to.deep.equal([
        { name: "System.Text.Json", version: "8.0.0" },
        { name: "Newtonsoft.Json", version: "13.0.3" },
      ]);
    });

    it("should default stripSymbols to true", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.stripSymbols).to.equal(true);
    });

    it("should use buildOptions.stripSymbols from config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          stripSymbols: false,
        },
      };

      const result = resolveConfig(config, {});
      expect(result.stripSymbols).to.equal(false);
    });

    it("should override stripSymbols with --no-strip CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          stripSymbols: true,
        },
      };

      const result = resolveConfig(config, { noStrip: true });
      expect(result.stripSymbols).to.equal(false);
    });

    it("should default invariantGlobalization to true", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.invariantGlobalization).to.equal(true);
    });

    it("should use buildOptions.invariantGlobalization from config", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        buildOptions: {
          invariantGlobalization: false,
        },
      };

      const result = resolveConfig(config, {});
      expect(result.invariantGlobalization).to.equal(false);
    });

    it("should default keepTemp to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.keepTemp).to.equal(false);
    });

    it("should set keepTemp from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { keepTemp: true });
      expect(result.keepTemp).to.equal(true);
    });

    it("should default verbose to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.verbose).to.equal(false);
    });

    it("should set verbose from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { verbose: true });
      expect(result.verbose).to.equal(true);
    });

    it("should default quiet to false", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.quiet).to.equal(false);
    });

    it("should set quiet from CLI option", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, { quiet: true });
      expect(result.quiet).to.equal(true);
    });

    it("should default typeRoots to node_modules/@tsonic/dotnet-types/types", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
      };

      const result = resolveConfig(config, {});
      expect(result.typeRoots).to.deep.equal([
        "node_modules/@tsonic/dotnet-types/types",
      ]);
    });

    it("should use typeRoots from config.dotnet.typeRoots", () => {
      const config: TsonicConfig = {
        rootNamespace: "MyApp",
        dotnet: {
          typeRoots: ["custom/path/types", "another/path/types"],
        },
      };

      const result = resolveConfig(config, {});
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
        packages: [{ name: "Package.Name", version: "1.0.0" }],
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

      const result = resolveConfig(config, cliOptions, "custom.ts");

      expect(result.rootNamespace).to.equal("CLI.Override");
      expect(result.entryPoint).to.equal("custom.ts");
      expect(result.sourceRoot).to.equal("source");
      expect(result.outputDirectory).to.equal("out");
      expect(result.outputName).to.equal("binary");
      expect(result.rid).to.equal("win-x64");
      expect(result.dotnetVersion).to.equal("net9.0");
      expect(result.optimize).to.equal("speed");
      expect(result.packages).to.deep.equal([
        { name: "Package.Name", version: "1.0.0" },
      ]);
      expect(result.stripSymbols).to.equal(false);
      expect(result.invariantGlobalization).to.equal(false);
      expect(result.keepTemp).to.equal(true);
      expect(result.verbose).to.equal(true);
      expect(result.quiet).to.equal(false);
    });
  });
});
