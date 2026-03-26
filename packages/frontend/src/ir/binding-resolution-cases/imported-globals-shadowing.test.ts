import * as ts from "typescript";
import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { createProgramContext } from "../program-context.js";
import { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import type { IrIdentifierExpression } from "../types.js";

describe("Binding Resolution in IR", () => {
  describe("Imported globals shadowing", () => {
    it("does not let global bindings override imported values with the same name", () => {
      const rootDir = "/test";
      const mainFileName = `${rootDir}/main.ts`;
      const consoleFileName = `${rootDir}/console.ts`;
      const libFileName = `${rootDir}/lib.d.ts`;

      const mainSource = `
        import { console } from "./console.ts";

        export function test(): void {
          console.dirxml("test", 123, {});
        }
      `;
      const consoleSource = `
        export const console = {
          dirxml(..._data: unknown[]): void {}
        };
      `;
      const libSource = `
        interface Function {}
        interface Object {}
        interface String {}
        interface Boolean {}
        interface Number {}
        interface IArguments {}
        interface Array<T> { length: number; [n: number]: T; }
        type PropertyKey = string | number | symbol;
      `;

      const mainFile = ts.createSourceFile(
        mainFileName,
        mainSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const consoleFile = ts.createSourceFile(
        consoleFileName,
        consoleSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const libFile = ts.createSourceFile(
        libFileName,
        libSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );

      const fileMap = new Map<string, ts.SourceFile>([
        [mainFileName, mainFile],
        [consoleFileName, consoleFile],
        [libFileName, libFile],
      ]);

      const program = ts.createProgram(
        [mainFileName, consoleFileName],
        {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          allowImportingTsExtensions: true,
        },
        {
          getSourceFile: (name) => fileMap.get(name),
          writeFile: () => {},
          getCurrentDirectory: () => rootDir,
          getDirectories: () => [],
          fileExists: (name) => fileMap.has(name),
          readFile: (name) => fileMap.get(name)?.text,
          getCanonicalFileName: (fileName) => fileName,
          useCaseSensitiveFileNames: () => true,
          getNewLine: () => "\n",
          getDefaultLibFileName: () => libFileName,
        }
      );

      const checker = program.getTypeChecker();
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
          },
        },
      });

      const testProgram = {
        program,
        checker,
        options: {
          projectRoot: rootDir,
          sourceRoot: rootDir,
          rootNamespace: "TestApp",
          strict: true,
        },
        sourceFiles: [mainFile, consoleFile],
        declarationSourceFiles: [],
        metadata: new DotnetMetadataRegistry(),
        bindings,
        clrResolver: createClrBindingsResolver(rootDir),
        binding: createBinding(checker),
      };

      const options = { sourceRoot: rootDir, rootNamespace: "TestApp" };
      const ctx = createProgramContext(testProgram, options);
      const result = buildIrModule(mainFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (!funcDecl || funcDecl.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (!exprStmt || exprStmt.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      expect(memberExpr.kind).to.equal("memberAccess");
      if (memberExpr.kind !== "memberAccess") return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.resolvedClrType).to.equal(undefined);
      expect(consoleExpr.resolvedAssembly).to.equal(undefined);
      expect(consoleExpr.declId).to.not.equal(undefined);
      expect(memberExpr.memberBinding).to.equal(undefined);
    });

    it("does not treat imported declaration-module values as ambient globals", () => {
      const rootDir = "/test";
      const mainFileName = `${rootDir}/main.ts`;
      const consoleFileName = `${rootDir}/console.d.ts`;
      const libFileName = `${rootDir}/lib.d.ts`;

      const mainSource = `
        import { console } from "./console.js";

        export function test(): void {
          console.dirxml("test", 123, {});
        }
      `;
      const consoleSource = `
        export declare const console: {
          dirxml(..._data: unknown[]): void;
        };
      `;
      const libSource = `
        interface Function {}
        interface Object {}
        interface String {}
        interface Boolean {}
        interface Number {}
        interface IArguments {}
        interface Array<T> { length: number; [n: number]: T; }
        type PropertyKey = string | number | symbol;
      `;

      const mainFile = ts.createSourceFile(
        mainFileName,
        mainSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const consoleFile = ts.createSourceFile(
        consoleFileName,
        consoleSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const libFile = ts.createSourceFile(
        libFileName,
        libSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );

      const fileMap = new Map<string, ts.SourceFile>([
        [mainFileName, mainFile],
        [consoleFileName, consoleFile],
        [libFileName, libFile],
      ]);

      const program = ts.createProgram(
        [mainFileName, consoleFileName],
        {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          allowJs: true,
        },
        {
          getSourceFile: (name) => fileMap.get(name),
          writeFile: () => {},
          getCurrentDirectory: () => rootDir,
          getDirectories: () => [],
          fileExists: (name) => fileMap.has(name),
          readFile: (name) => fileMap.get(name)?.text,
          getCanonicalFileName: (fileName) => fileName,
          useCaseSensitiveFileNames: () => true,
          getNewLine: () => "\n",
          getDefaultLibFileName: () => libFileName,
        }
      );

      const checker = program.getTypeChecker();
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
          },
        },
      });

      const testProgram = {
        program,
        checker,
        options: {
          projectRoot: rootDir,
          sourceRoot: rootDir,
          rootNamespace: "TestApp",
          strict: true,
        },
        sourceFiles: [mainFile, consoleFile],
        declarationSourceFiles: [],
        metadata: new DotnetMetadataRegistry(),
        bindings,
        clrResolver: createClrBindingsResolver(rootDir),
        binding: createBinding(checker),
      };

      const options = { sourceRoot: rootDir, rootNamespace: "TestApp" };
      const ctx = createProgramContext(testProgram, options);
      const result = buildIrModule(mainFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const funcDecl = result.value.body[0];
      expect(funcDecl?.kind).to.equal("functionDeclaration");
      if (!funcDecl || funcDecl.kind !== "functionDeclaration") return;

      const exprStmt = funcDecl.body.statements[0];
      expect(exprStmt?.kind).to.equal("expressionStatement");
      if (!exprStmt || exprStmt.kind !== "expressionStatement") return;

      const callExpr = exprStmt.expression;
      expect(callExpr.kind).to.equal("call");
      if (callExpr.kind !== "call") return;

      const memberExpr = callExpr.callee;
      expect(memberExpr.kind).to.equal("memberAccess");
      if (memberExpr.kind !== "memberAccess") return;

      const consoleExpr = memberExpr.object as IrIdentifierExpression;
      expect(consoleExpr.kind).to.equal("identifier");
      expect(consoleExpr.name).to.equal("console");
      expect(consoleExpr.resolvedClrType).to.equal(undefined);
      expect(consoleExpr.resolvedAssembly).to.equal(undefined);
      expect(consoleExpr.declId).to.not.equal(undefined);
      expect(memberExpr.memberBinding).to.equal(undefined);
    });

    it("still applies global bindings to ambient declaration-file globals", () => {
      const rootDir = "/test";
      const mainFileName = `${rootDir}/main.ts`;
      const libFileName = `${rootDir}/lib.d.ts`;

      const mainSource = `
        export function test(value: unknown): void {
          const bytes = new Uint8Array(4);
          const parsed = parseInt("42", 10);
          if (parsed > 100) {
            throw new RangeError("too large");
          }

          try {
            throw new Error("bad");
          } catch (e) {
            throw e instanceof Error ? e : new Error(String(value));
          }
        }
      `;
      const libSource = `
        interface Function {}
        interface Object {}
        interface String {}
        interface Boolean {}
        interface Number {}
        interface IArguments {}
        interface Array<T> { length: number; [n: number]: T; }
        type PropertyKey = string | number | symbol;

        declare class Error {
          constructor(message?: string);
        }

        declare class RangeError extends Error {
          constructor(message?: string);
        }

        declare class Uint8Array {
          constructor(length: number);
          readonly length: number;
          [n: number]: number;
        }

        declare const String: {
          (value: unknown): string;
        };

        declare function parseInt(value: string, radix?: number): number;
      `;

      const mainFile = ts.createSourceFile(
        mainFileName,
        mainSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const libFile = ts.createSourceFile(
        libFileName,
        libSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );

      const fileMap = new Map<string, ts.SourceFile>([
        [mainFileName, mainFile],
        [libFileName, libFile],
      ]);

      const program = ts.createProgram(
        [mainFileName],
        {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
        {
          getSourceFile: (name) => fileMap.get(name),
          writeFile: () => {},
          getCurrentDirectory: () => rootDir,
          getDirectories: () => [],
          fileExists: (name) => fileMap.has(name),
          readFile: (name) => fileMap.get(name)?.text,
          getCanonicalFileName: (fileName) => fileName,
          useCaseSensitiveFileNames: () => true,
          getNewLine: () => "\n",
          getDefaultLibFileName: () => libFileName,
        }
      );

      const checker = program.getTypeChecker();
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          Uint8Array: {
            kind: "global",
            assembly: "js",
            type: "js.Uint8Array",
            staticType: "js.Uint8Array",
            typeSemantics: { contributesTypeIdentity: true },
          },
          parseInt: {
            kind: "global",
            assembly: "js",
            type: "js.Globals",
            csharpName: "Globals.parseInt",
          },
          String: {
            kind: "global",
            assembly: "js",
            type: "js.String",
            staticType: "js.String",
            csharpName: "Globals.String",
            typeSemantics: { contributesTypeIdentity: true },
          },
          Error: {
            kind: "global",
            assembly: "js",
            type: "js.Error",
            typeSemantics: { contributesTypeIdentity: true },
          },
          RangeError: {
            kind: "global",
            assembly: "js",
            type: "js.RangeError",
            typeSemantics: { contributesTypeIdentity: true },
          },
        },
      });

      const testProgram = {
        program,
        checker,
        options: {
          projectRoot: rootDir,
          sourceRoot: rootDir,
          rootNamespace: "TestApp",
          strict: true,
        },
        sourceFiles: [mainFile],
        declarationSourceFiles: [libFile],
        metadata: new DotnetMetadataRegistry(),
        bindings,
        clrResolver: createClrBindingsResolver(rootDir),
        binding: createBinding(checker),
      };

      const options = { sourceRoot: rootDir, rootNamespace: "TestApp" };
      const ctx = createProgramContext(testProgram, options);
      const result = buildIrModule(mainFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const identifiers: IrIdentifierExpression[] = [];
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (value === null || typeof value !== "object") {
          return;
        }

        const candidate = value as Record<string, unknown>;
        if (candidate.kind === "identifier") {
          identifiers.push(candidate as unknown as IrIdentifierExpression);
        }

        for (const child of Object.values(candidate)) {
          visit(child);
        }
      };

      visit(result.value);

      const expectBoundIdentifier = (
        name: string,
        expectedClrType: string,
        expectedCsharpName?: string
      ): void => {
        const matches = identifiers.filter(
          (identifier) => identifier.name === name
        );
        expect(
          matches.length,
          `expected identifier '${name}' in IR`
        ).to.be.greaterThan(0);
        expect(
          matches.some(
            (identifier) =>
              identifier.declId !== undefined &&
              identifier.resolvedAssembly === "js" &&
              identifier.resolvedClrType === expectedClrType &&
              (expectedCsharpName === undefined ||
                identifier.csharpName === expectedCsharpName)
          ),
          `expected bound ambient global '${name}'`
        ).to.equal(true);
      };

      expectBoundIdentifier("Uint8Array", "js.Uint8Array");
      expectBoundIdentifier(
        "parseInt",
        "js.Globals",
        "Globals.parseInt"
      );
      expectBoundIdentifier(
        "String",
        "js.String",
        "Globals.String"
      );
      expectBoundIdentifier("Error", "js.Error");
      expectBoundIdentifier("RangeError", "js.RangeError");
    });

    it("still applies global bindings to external-module declare-global augmentations", () => {
      const rootDir = "/test";
      const mainFileName = `${rootDir}/main.ts`;
      const libFileName = `${rootDir}/lib.d.ts`;

      const mainSource = `
        export function test(value: unknown): void {
          const bytes = new Uint8Array(4);
          const parsed = parseInt("42", 10);
          if (parsed > 100) {
            throw new RangeError("too large");
          }

          try {
            throw new Error("bad");
          } catch (e) {
            throw e instanceof Error ? e : new Error(String(value));
          }
        }
      `;
      const libSource = `
        export {};

        declare global {
          interface Function {}
          interface Object {}
          interface String {}
          interface Boolean {}
          interface Number {}
          interface IArguments {}
          interface Array<T> { length: number; [n: number]: T; }
          type PropertyKey = string | number | symbol;

          class Error {
            constructor(message?: string);
          }

          class RangeError extends Error {
            constructor(message?: string);
          }

          class Uint8Array {
            constructor(length: number);
            readonly length: number;
            [n: number]: number;
          }

          const String: {
            (value: unknown): string;
          };

          function parseInt(value: string, radix?: number): number;
        }
      `;

      const mainFile = ts.createSourceFile(
        mainFileName,
        mainSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );
      const libFile = ts.createSourceFile(
        libFileName,
        libSource,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS
      );

      const fileMap = new Map<string, ts.SourceFile>([
        [mainFileName, mainFile],
        [libFileName, libFile],
      ]);

      const program = ts.createProgram(
        [mainFileName],
        {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
        {
          getSourceFile: (name) => fileMap.get(name),
          writeFile: () => {},
          getCurrentDirectory: () => rootDir,
          getDirectories: () => [],
          fileExists: (name) => fileMap.has(name),
          readFile: (name) => fileMap.get(name)?.text,
          getCanonicalFileName: (fileName) => fileName,
          useCaseSensitiveFileNames: () => true,
          getNewLine: () => "\n",
          getDefaultLibFileName: () => libFileName,
        }
      );

      const checker = program.getTypeChecker();
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/runtime.json", {
        bindings: {
          Uint8Array: {
            kind: "global",
            assembly: "js",
            type: "js.Uint8Array",
            staticType: "js.Uint8Array",
            typeSemantics: { contributesTypeIdentity: true },
          },
          parseInt: {
            kind: "global",
            assembly: "js",
            type: "js.Globals",
            csharpName: "Globals.parseInt",
          },
          String: {
            kind: "global",
            assembly: "js",
            type: "js.String",
            staticType: "js.String",
            csharpName: "Globals.String",
            typeSemantics: { contributesTypeIdentity: true },
          },
          Error: {
            kind: "global",
            assembly: "js",
            type: "js.Error",
            typeSemantics: { contributesTypeIdentity: true },
          },
          RangeError: {
            kind: "global",
            assembly: "js",
            type: "js.RangeError",
            typeSemantics: { contributesTypeIdentity: true },
          },
        },
      });

      const testProgram = {
        program,
        checker,
        options: {
          projectRoot: rootDir,
          sourceRoot: rootDir,
          rootNamespace: "TestApp",
          strict: true,
        },
        sourceFiles: [mainFile],
        declarationSourceFiles: [libFile],
        metadata: new DotnetMetadataRegistry(),
        bindings,
        clrResolver: createClrBindingsResolver(rootDir),
        binding: createBinding(checker),
      };

      const options = { sourceRoot: rootDir, rootNamespace: "TestApp" };
      const ctx = createProgramContext(testProgram, options);
      const result = buildIrModule(mainFile, testProgram, options, ctx);

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const identifiers: IrIdentifierExpression[] = [];
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(visit);
          return;
        }
        if (value === null || typeof value !== "object") {
          return;
        }

        const candidate = value as Record<string, unknown>;
        if (candidate.kind === "identifier") {
          identifiers.push(candidate as unknown as IrIdentifierExpression);
        }

        for (const child of Object.values(candidate)) {
          visit(child);
        }
      };

      visit(result.value);

      const expectBoundIdentifier = (
        name: string,
        expectedClrType: string,
        expectedCsharpName?: string
      ): void => {
        const matches = identifiers.filter(
          (identifier) => identifier.name === name
        );
        expect(
          matches.length,
          `expected identifier '${name}' in IR`
        ).to.be.greaterThan(0);
        expect(
          matches.some(
            (identifier) =>
              identifier.declId !== undefined &&
              identifier.resolvedAssembly === "js" &&
              identifier.resolvedClrType === expectedClrType &&
              (expectedCsharpName === undefined ||
                identifier.csharpName === expectedCsharpName)
          ),
          `expected bound declare-global ambient '${name}'`
        ).to.equal(true);
      };

      expectBoundIdentifier("Uint8Array", "js.Uint8Array");
      expectBoundIdentifier(
        "parseInt",
        "js.Globals",
        "Globals.parseInt"
      );
      expectBoundIdentifier(
        "String",
        "js.String",
        "Globals.String"
      );
      expectBoundIdentifier("Error", "js.Error");
      expectBoundIdentifier("RangeError", "js.RangeError");
    });
  });
});
