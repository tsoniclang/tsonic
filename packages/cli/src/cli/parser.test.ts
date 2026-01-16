/**
 * Tests for CLI argument parser
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { parseArgs } from "./parser.js";

describe("CLI Parser", () => {
  describe("parseArgs", () => {
    describe("Commands", () => {
      it("should parse build command", () => {
        const result = parseArgs(["build"]);
        expect(result.command).to.equal("build");
      });

      it("should parse run command", () => {
        const result = parseArgs(["run"]);
        expect(result.command).to.equal("run");
      });

      it("should parse generate command", () => {
        const result = parseArgs(["generate"]);
        expect(result.command).to.equal("generate");
      });

      it("should parse project:init as two-word command", () => {
        const result = parseArgs(["project", "init"]);
        expect(result.command).to.equal("project:init");
      });

      it("should parse add:package as two-word command", () => {
        const result = parseArgs([
          "add",
          "package",
          "/path/to/lib.dll",
          "@scope/types",
        ]);
        expect(result.command).to.equal("add:package");
        expect(result.positionals).to.deep.equal([
          "/path/to/lib.dll",
          "@scope/types",
        ]);
      });

      it("should parse add:reference as two-word command", () => {
        const result = parseArgs([
          "add",
          "reference",
          "../lib/My.Lib.dll",
          "@scope/my-lib-types",
        ]);
        expect(result.command).to.equal("add:reference");
        expect(result.positionals).to.deep.equal([
          "../lib/My.Lib.dll",
          "@scope/my-lib-types",
        ]);
      });

      it("should parse add:nuget as two-word command", () => {
        const result = parseArgs([
          "add",
          "nuget",
          "My.Package",
          "1.2.3",
          "@scope/my-package-types",
        ]);
        expect(result.command).to.equal("add:nuget");
        expect(result.positionals).to.deep.equal([
          "My.Package",
          "1.2.3",
          "@scope/my-package-types",
        ]);
      });

      it("should parse add:framework as two-word command", () => {
        const result = parseArgs([
          "add",
          "framework",
          "Microsoft.AspNetCore.App",
          "@tsonic/aspnetcore",
        ]);
        expect(result.command).to.equal("add:framework");
        expect(result.positionals).to.deep.equal([
          "Microsoft.AspNetCore.App",
          "@tsonic/aspnetcore",
        ]);
      });

      it("should parse remove:nuget as two-word command", () => {
        const result = parseArgs(["remove", "nuget", "My.Package"]);
        expect(result.command).to.equal("remove:nuget");
        expect(result.positionals).to.deep.equal(["My.Package"]);
      });

      it("should parse update:nuget as two-word command", () => {
        const result = parseArgs([
          "update",
          "nuget",
          "My.Package",
          "1.2.4",
          "@scope/my-package-types",
        ]);
        expect(result.command).to.equal("update:nuget");
        expect(result.positionals).to.deep.equal([
          "My.Package",
          "1.2.4",
          "@scope/my-package-types",
        ]);
      });

      it("should parse help command from --help", () => {
        const result = parseArgs(["--help"]);
        expect(result.command).to.equal("help");
      });

      it("should parse help command from -h", () => {
        const result = parseArgs(["-h"]);
        expect(result.command).to.equal("help");
      });

      it("should parse version command from --version", () => {
        const result = parseArgs(["--version"]);
        expect(result.command).to.equal("version");
      });

      it("should parse version command from -v", () => {
        const result = parseArgs(["-v"]);
        expect(result.command).to.equal("version");
      });
    });

    describe("Entry File", () => {
      it("should parse entry file after command", () => {
        const result = parseArgs(["run", "index.ts"]);
        expect(result.command).to.equal("run");
        expect(result.positionals).to.deep.equal(["index.ts"]);
      });

      it("should parse entry file with path", () => {
        const result = parseArgs(["build", "src/main.ts"]);
        expect(result.command).to.equal("build");
        expect(result.positionals).to.deep.equal(["src/main.ts"]);
      });

      it("should handle no entry file", () => {
        const result = parseArgs(["build"]);
        expect(result.positionals).to.deep.equal([]);
      });
    });

    describe("Options", () => {
      it("should parse --verbose option", () => {
        const result = parseArgs(["build", "--verbose"]);
        expect(result.options.verbose).to.equal(true);
      });

      it("should parse -V short option for verbose", () => {
        const result = parseArgs(["build", "-V"]);
        expect(result.options.verbose).to.equal(true);
      });

      it("should parse --quiet option", () => {
        const result = parseArgs(["build", "--quiet"]);
        expect(result.options.quiet).to.equal(true);
      });

      it("should parse -q short option for quiet", () => {
        const result = parseArgs(["build", "-q"]);
        expect(result.options.quiet).to.equal(true);
      });

      it("should parse --config option with value", () => {
        const result = parseArgs(["build", "--config", "tsonic.json"]);
        expect(result.options.config).to.equal("tsonic.json");
      });

      it("should parse -c short option for config", () => {
        const result = parseArgs(["build", "-c", "custom.json"]);
        expect(result.options.config).to.equal("custom.json");
      });

      it("should parse --src option with value", () => {
        const result = parseArgs(["build", "--src", "source"]);
        expect(result.options.src).to.equal("source");
      });

      it("should parse -s short option for src", () => {
        const result = parseArgs(["build", "-s", "app"]);
        expect(result.options.src).to.equal("app");
      });

      it("should parse --out option with value", () => {
        const result = parseArgs(["build", "--out", "output"]);
        expect(result.options.out).to.equal("output");
      });

      it("should parse -o short option for out", () => {
        const result = parseArgs(["build", "-o", "dist"]);
        expect(result.options.out).to.equal("dist");
      });

      it("should parse --namespace option with value", () => {
        const result = parseArgs(["build", "--namespace", "MyApp"]);
        expect(result.options.namespace).to.equal("MyApp");
      });

      it("should parse -n short option for namespace", () => {
        const result = parseArgs(["build", "-n", "App"]);
        expect(result.options.namespace).to.equal("App");
      });

      it("should parse --rid option with value", () => {
        const result = parseArgs(["build", "--rid", "linux-x64"]);
        expect(result.options.rid).to.equal("linux-x64");
      });

      it("should parse -r short option for rid", () => {
        const result = parseArgs(["build", "-r", "win-x64"]);
        expect(result.options.rid).to.equal("win-x64");
      });

      it("should parse --optimize option with speed", () => {
        const result = parseArgs(["build", "--optimize", "speed"]);
        expect(result.options.optimize).to.equal("speed");
      });

      it("should parse --optimize option with size", () => {
        const result = parseArgs(["build", "--optimize", "size"]);
        expect(result.options.optimize).to.equal("size");
      });

      it("should parse -O short option for optimize", () => {
        const result = parseArgs(["build", "-O", "speed"]);
        expect(result.options.optimize).to.equal("speed");
      });

      it("should parse --keep-temp option", () => {
        const result = parseArgs(["build", "--keep-temp"]);
        expect(result.options.keepTemp).to.equal(true);
      });

      it("should parse -k short option for keep-temp", () => {
        const result = parseArgs(["build", "-k"]);
        expect(result.options.keepTemp).to.equal(true);
      });

      it("should parse --no-strip option", () => {
        const result = parseArgs(["build", "--no-strip"]);
        expect(result.options.noStrip).to.equal(true);
      });

      it("should parse --nodejs option", () => {
        const result = parseArgs(["project", "init", "--nodejs"]);
        expect(result.options.nodejs).to.equal(true);
      });

      it("should parse --js option", () => {
        const result = parseArgs(["project", "init", "--js"]);
        expect(result.options.js).to.equal(true);
      });

      it("should parse --pure option", () => {
        const result = parseArgs(["project", "init", "--pure"]);
        expect(result.options.pure).to.equal(true);
      });

      it("should parse add js as two-word command", () => {
        const result = parseArgs(["add", "js"]);
        expect(result.command).to.equal("add:js");
        expect(result.positionals).to.deep.equal([]);
      });

      it("should parse add nodejs as two-word command", () => {
        const result = parseArgs(["add", "nodejs"]);
        expect(result.command).to.equal("add:nodejs");
        expect(result.positionals).to.deep.equal([]);
      });

      it("should parse --deps option (repeatable)", () => {
        const result = parseArgs([
          "add",
          "package",
          "./lib/MyLib.dll",
          "--deps",
          "./deps1",
          "--deps",
          "./deps2",
        ]);
        expect(result.command).to.equal("add:package");
        expect(result.positionals).to.deep.equal(["./lib/MyLib.dll"]);
        expect(result.options.deps).to.deep.equal(["./deps1", "./deps2"]);
      });

      it("should parse --strict option", () => {
        const result = parseArgs(["restore", "--strict"]);
        expect(result.command).to.equal("restore");
        expect(result.options.strict).to.equal(true);
      });
    });

    describe("Program Arguments", () => {
      it("should parse program arguments after --", () => {
        const result = parseArgs(["run", "index.ts", "--", "arg1", "arg2"]);
        expect(result.programArgs).to.deep.equal(["arg1", "arg2"]);
      });

      it("should handle options in program arguments", () => {
        const result = parseArgs([
          "run",
          "index.ts",
          "--",
          "--verbose",
          "-o",
          "out",
        ]);
        expect(result.programArgs).to.deep.equal(["--verbose", "-o", "out"]);
      });

      it("should handle empty program arguments", () => {
        const result = parseArgs(["run", "index.ts"]);
        expect(result.programArgs).to.deep.equal([]);
      });
    });

    describe("Complex Scenarios", () => {
      it("should parse command with entry file and multiple options", () => {
        const result = parseArgs([
          "build",
          "src/main.ts",
          "--namespace",
          "MyApp",
          "--out",
          "dist",
          "--verbose",
        ]);
        expect(result.command).to.equal("build");
        expect(result.positionals).to.deep.equal(["src/main.ts"]);
        expect(result.options.namespace).to.equal("MyApp");
        expect(result.options.out).to.equal("dist");
        expect(result.options.verbose).to.equal(true);
      });

      it("should parse run command with entry, options, and program args", () => {
        const result = parseArgs([
          "run",
          "index.ts",
          "--verbose",
          "--",
          "programArg1",
          "programArg2",
        ]);
        expect(result.command).to.equal("run");
        expect(result.positionals).to.deep.equal(["index.ts"]);
        expect(result.options.verbose).to.equal(true);
        expect(result.programArgs).to.deep.equal([
          "programArg1",
          "programArg2",
        ]);
      });

      it("should handle empty args array", () => {
        const result = parseArgs([]);
        expect(result.command).to.equal("");
        expect(result.positionals).to.deep.equal([]);
        expect(result.options).to.deep.equal({});
        expect(result.programArgs).to.deep.equal([]);
      });

      it("should handle mixed short and long options", () => {
        const result = parseArgs([
          "build",
          "-n",
          "App",
          "--out",
          "dist",
          "-V",
          "--keep-temp",
        ]);
        expect(result.options.namespace).to.equal("App");
        expect(result.options.out).to.equal("dist");
        expect(result.options.verbose).to.equal(true);
        expect(result.options.keepTemp).to.equal(true);
      });
    });
  });
});
