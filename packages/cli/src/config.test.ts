/**
 * Tests for configuration loading and resolution
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { resolveConfig } from "./config.js";
import type {
  CliOptions,
  TsonicProjectConfig,
  TsonicWorkspaceConfig,
} from "./types.js";

const WORKSPACE_ROOT = "/workspace";
const PROJECT_ROOT = "/workspace/packages/myapp";

const makeWorkspaceConfig = (
  overrides: Partial<TsonicWorkspaceConfig> = {}
): TsonicWorkspaceConfig => ({
  dotnetVersion: "net10.0",
  ...overrides,
});

const makeProjectConfig = (
  overrides: Partial<TsonicProjectConfig> = {}
): TsonicProjectConfig => ({
  rootNamespace: "MyApp",
  ...overrides,
});

describe("Config", () => {
  describe("resolveConfig", () => {
    it("should use config values as defaults", () => {
      const workspaceConfig = makeWorkspaceConfig({
        rid: "linux-x64",
        dotnetVersion: "net10.0",
        optimize: "speed",
      });
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        sourceRoot: "src",
        outputDirectory: "dist",
        outputName: "myapp",
        optimize: "speed",
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.rootNamespace).to.equal("MyApp");
      expect(result.entryPoint).to.equal("src/main.ts");
      expect(result.workspaceRoot).to.equal(WORKSPACE_ROOT);
      expect(result.projectRoot).to.equal(PROJECT_ROOT);
      expect(result.sourceRoot).to.equal("src");
      expect(result.outputDirectory).to.equal("dist");
      expect(result.outputName).to.equal("myapp");
      expect(result.rid).to.equal("linux-x64");
      expect(result.dotnetVersion).to.equal("net10.0");
      expect(result.optimize).to.equal("speed");
    });

    it("should override config with CLI options", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({ outputName: "myapp" });

      const cliOptions: CliOptions = {
        namespace: "OverriddenApp",
        out: "custom",
        src: "source",
        optimize: "size",
      };

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        cliOptions,
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.rootNamespace).to.equal("OverriddenApp");
      expect(result.outputName).to.equal("custom");
      expect(result.sourceRoot).to.equal("source");
      expect(result.optimize).to.equal("size");
    });

    it("should default frameworkReferences and packageReferences to empty arrays", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.frameworkReferences).to.deep.equal([]);
      expect(result.packageReferences).to.deep.equal([]);
    });

    it("should preserve frameworkReferences and packageReferences from workspace.dotnet", () => {
      const workspaceConfig = makeWorkspaceConfig({
        dotnet: {
          frameworkReferences: [
            "Microsoft.AspNetCore.App",
            { id: "Foo.Bar", types: "@foo/bar-types" },
          ],
          packageReferences: [
            {
              id: "Microsoft.EntityFrameworkCore",
              version: "10.0.1",
              types: "@tsonic/efcore",
            },
          ],
        },
      });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.frameworkReferences).to.deep.equal([
        "Microsoft.AspNetCore.App",
        "Foo.Bar",
      ]);
      expect(result.packageReferences).to.deep.equal([
        { id: "Microsoft.EntityFrameworkCore", version: "10.0.1" },
      ]);
    });

    it("should use entry file parameter over config", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({ entryPoint: "src/main.ts" });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT,
        "custom/entry.ts"
      );
      expect(result.entryPoint).to.equal("custom/entry.ts");
    });

    it("should leave entryPoint as undefined when not specified", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({ entryPoint: undefined });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.entryPoint).to.equal(undefined);
    });

    it("should default sourceRoot to dirname of entryPoint", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({ entryPoint: "app/index.ts" });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.sourceRoot).to.equal("app");
    });

    it("should default outputDirectory to 'generated'", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.outputDirectory).to.equal("generated");
    });

    it("should default outputName to 'app'", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.outputName).to.equal("app");
    });

    it("should use dotnetVersion from workspace", () => {
      const workspaceConfig = makeWorkspaceConfig({ dotnetVersion: "net9.0" });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.dotnetVersion).to.equal("net9.0");
    });

    it("should default optimize to 'speed'", () => {
      const workspaceConfig = makeWorkspaceConfig({ optimize: undefined });
      const projectConfig = makeProjectConfig({ optimize: undefined });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.optimize).to.equal("speed");
    });

    it("should default stripSymbols to true", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.stripSymbols).to.equal(true);
    });

    it("should use buildOptions.stripSymbols from config", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        buildOptions: {
          stripSymbols: false,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.stripSymbols).to.equal(false);
    });

    it("should override stripSymbols with --no-strip CLI option", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        buildOptions: {
          stripSymbols: true,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        { noStrip: true },
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.stripSymbols).to.equal(false);
    });

    it("should default invariantGlobalization to true", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.invariantGlobalization).to.equal(true);
    });

    it("should use buildOptions.invariantGlobalization from config", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        buildOptions: {
          invariantGlobalization: false,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.invariantGlobalization).to.equal(false);
    });

    it("should allow output.invariantGlobalization to override buildOptions", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        buildOptions: {
          invariantGlobalization: true,
        },
        output: {
          invariantGlobalization: false,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.invariantGlobalization).to.equal(false);
      expect(result.outputConfig.invariantGlobalization).to.equal(false);
    });

    it("should allow output.stripSymbols to override buildOptions", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        buildOptions: {
          stripSymbols: true,
        },
        output: {
          stripSymbols: false,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.stripSymbols).to.equal(false);
      expect(result.outputConfig.stripSymbols).to.equal(false);
    });

    it("should use output.optimization when optimize is not set", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        output: {
          optimization: "size",
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.optimize).to.equal("size");
      expect(result.outputConfig.optimization).to.equal("size");
    });

    it("should prefer top-level optimize over output.optimization", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        optimize: "speed",
        output: {
          optimization: "size",
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.optimize).to.equal("speed");
      expect(result.outputConfig.optimization).to.equal("speed");
    });

    it("should resolve console-app output config", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig({
        entryPoint: "src/main.ts",
        output: {
          type: "console-app",
          targetFramework: "net8.0",
          singleFile: false,
          selfContained: false,
        },
      });

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.outputConfig.type).to.equal("console-app");
      expect(result.outputConfig.targetFramework).to.equal("net8.0");
      expect(result.outputConfig.singleFile).to.equal(false);
      expect(result.outputConfig.selfContained).to.equal(false);
    });

    it("should default keepTemp to false", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.keepTemp).to.equal(false);
    });

    it("should set keepTemp from CLI option", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        { keepTemp: true },
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.keepTemp).to.equal(true);
    });

    it("should default verbose to false", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.verbose).to.equal(false);
    });

    it("should set verbose from CLI option", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        { verbose: true },
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.verbose).to.equal(true);
    });

    it("should default quiet to false", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.quiet).to.equal(false);
    });

    it("should set quiet from CLI option", () => {
      const workspaceConfig = makeWorkspaceConfig();
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        { quiet: true },
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.quiet).to.equal(true);
    });

    it("should default typeRoots to globals only", () => {
      const workspaceConfig = makeWorkspaceConfig({ dotnet: {} });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.typeRoots).to.deep.equal(["node_modules/@tsonic/globals"]);
    });

    it("should use typeRoots from workspace.dotnet.typeRoots", () => {
      const workspaceConfig = makeWorkspaceConfig({
        dotnet: {
          typeRoots: ["custom/path/types", "another/path/types"],
        },
      });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );
      expect(result.typeRoots).to.deep.equal([
        "custom/path/types",
        "another/path/types",
      ]);
    });

    it("should handle all options together", () => {
      const workspaceConfig = makeWorkspaceConfig({
        rid: "linux-x64",
        dotnetVersion: "net9.0",
        optimize: "size",
        buildOptions: {
          stripSymbols: false,
          invariantGlobalization: false,
        },
      });

      const projectConfig = makeProjectConfig({
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "out",
        outputName: "program",
        buildOptions: {
          stripSymbols: false,
          invariantGlobalization: false,
        },
      });

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

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        cliOptions,
        WORKSPACE_ROOT,
        PROJECT_ROOT,
        "custom.ts"
      );

      expect(result.rootNamespace).to.equal("CLI.Override");
      expect(result.entryPoint).to.equal("custom.ts");
      expect(result.projectRoot).to.equal(PROJECT_ROOT);
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

    it("should merge workspace dotnet.libraries with CLI --lib", () => {
      const workspaceConfig = makeWorkspaceConfig({
        dotnet: { libraries: ["libs/A.dll", "libs/B.dll"] },
      });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        { lib: ["libs/C.dll"] },
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );

      expect(result.libraries).to.deep.equal([
        "libs/A.dll",
        "libs/B.dll",
        "libs/C.dll",
      ]);
    });

    it("should flatten dotnet.libraries object entries to paths", () => {
      const workspaceConfig = makeWorkspaceConfig({
        dotnet: {
          libraries: [
            { path: "libs/A.dll", types: "@acme/a-types" },
            "libs/B.dll",
          ],
        },
      });
      const projectConfig = makeProjectConfig();

      const result = resolveConfig(
        workspaceConfig,
        projectConfig,
        {},
        WORKSPACE_ROOT,
        PROJECT_ROOT
      );

      expect(result.libraries).to.deep.equal(["libs/A.dll", "libs/B.dll"]);
    });
  });
});
