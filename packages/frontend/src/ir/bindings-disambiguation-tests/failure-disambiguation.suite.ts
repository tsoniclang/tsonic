/**
 * Regression tests for CLR member binding disambiguation -- failure/error cases.
 *
 * Tsonic must fail compilation when CLR binding collisions cannot be disambiguated
 * or when a CLR-declared member has no binding at all.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIr } from "../builder.js";
import { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";
import { createBinding } from "../binding/index.js";

describe("CLR member binding disambiguation (failure)", () => {
  it("should fail compilation when collisions cannot be disambiguated (airplane-grade)", () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-bindings-disambiguation-")
    );

    const dtsDir = path.join(tmpRoot, "nodejs.Http", "internal");
    fs.mkdirSync(dtsDir, { recursive: true });

    // Intentionally incorrect bindings.json: the declaring type ("Server") is missing.
    // This makes overload disambiguation impossible.
    const bindingsJsonPath = path.join(tmpRoot, "nodejs.Http", "bindings.json");
    fs.writeFileSync(
      bindingsJsonPath,
      JSON.stringify(
        {
          namespace: "nodejs.Http",
          types: [
            {
              clrName: "nodejs.Http.NotServer",
              methods: [],
              properties: [],
              fields: [],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const dtsFileName = path.join(dtsDir, "index.d.ts");
    const dtsSource = `
      declare interface Server$instance {
        listen(port: number, callback: () => void): void;
      }
      declare type Server = Server$instance;
    `;

    const fileName = path.join(tmpRoot, "sample.ts");
    const source = `
      export function test(server: Server): void {
        server.listen(3000, () => {});
      }
    `;

    const libFileName = path.join(tmpRoot, "lib.d.ts");
    const libSource = `
      interface Function {}
      interface Object {}
      interface String {}
      interface Boolean {}
      interface Number {}
      interface IArguments {}
      type PropertyKey = string | number | symbol;
    `;

    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );
    const dtsFile = ts.createSourceFile(
      dtsFileName,
      dtsSource,
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
      [fileName, sourceFile],
      [dtsFileName, dtsFile],
      [libFileName, libFile],
    ]);

    const program = ts.createProgram(
      [fileName, dtsFileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => fileMap.get(name),
        writeFile: () => {},
        getCurrentDirectory: () => tmpRoot,
        getDirectories: () => [],
        fileExists: (name) => fileMap.has(name),
        readFile: (name) => fileMap.get(name)?.text,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: () => libFileName,
      }
    );

    const checker = program.getTypeChecker();

    const bindings = new BindingRegistry();
    bindings.addBindings("/test/nodejs-http.json", {
      namespace: "nodejs.Http",
      types: [
        {
          clrName: "nodejs.Http.Server",
          assemblyName: "nodejs",
          methods: [
            {
              clrName: "listen",
              normalizedSignature:
                "listen|(System.Int32,System.Action):nodejs.Http.Server|static=false",
              parameterCount: 2,
              declaringClrType: "nodejs.Http.Server",
              declaringAssemblyName: "nodejs",
            },
          ],
          properties: [],
          fields: [],
        },
      ],
    });

    bindings.addBindings("/test/nodejs.json", {
      namespace: "nodejs",
      types: [
        {
          clrName: "nodejs.Server",
          assemblyName: "nodejs",
          methods: [
            {
              clrName: "listen",
              normalizedSignature:
                "listen|(System.Int32,System.Action):nodejs.Server|static=false",
              parameterCount: 2,
              declaringClrType: "nodejs.Server",
              declaringAssemblyName: "nodejs",
            },
          ],
          properties: [],
          fields: [],
        },
      ],
    });

    const testProgram = {
      program,
      checker,
      options: {
        projectRoot: tmpRoot,
        sourceRoot: tmpRoot,
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [dtsFile],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver(tmpRoot),
      binding: createBinding(checker),
    };

    const irResult = buildIr(testProgram, {
      sourceRoot: tmpRoot,
      rootNamespace: "TestApp",
    });

    expect(
      irResult.ok,
      "IR build must fail on ambiguous CLR bindings"
    ).to.equal(false);

    if (irResult.ok) return;

    const codes = irResult.error.map((d) => d.code);
    expect(codes).to.include("TSN4003");
  });

  it("should fail compilation when a CLR-declared member has no binding (airplane-grade)", () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-bindings-disambiguation-")
    );

    const dtsDir = path.join(tmpRoot, "nodejs.Http", "internal");
    fs.mkdirSync(dtsDir, { recursive: true });

    const bindingsJsonPath = path.join(tmpRoot, "nodejs.Http", "bindings.json");
    fs.writeFileSync(
      bindingsJsonPath,
      JSON.stringify(
        {
          namespace: "nodejs.Http",
          types: [
            {
              clrName: "nodejs.Http.Server",
              methods: [],
              properties: [],
              fields: [],
            },
          ],
        },
        null,
        2
      ),
      "utf8"
    );

    const dtsFileName = path.join(dtsDir, "index.d.ts");
    const dtsSource = `
      declare interface Server$instance {
        listen(port: number, callback: () => void): void;
      }
      declare type Server = Server$instance;
    `;

    const fileName = path.join(tmpRoot, "sample.ts");
    const source = `
      export function test(server: Server): void {
        server.listen(3000, () => {});
      }
    `;

    const libFileName = path.join(tmpRoot, "lib.d.ts");
    const libSource = `
      interface Function {}
      interface Object {}
      interface String {}
      interface Boolean {}
      interface Number {}
      interface IArguments {}
      type PropertyKey = string | number | symbol;
    `;

    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );
    const dtsFile = ts.createSourceFile(
      dtsFileName,
      dtsSource,
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
      [fileName, sourceFile],
      [dtsFileName, dtsFile],
      [libFileName, libFile],
    ]);

    const program = ts.createProgram(
      [fileName, dtsFileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => fileMap.get(name),
        writeFile: () => {},
        getCurrentDirectory: () => tmpRoot,
        getDirectories: () => [],
        fileExists: (name) => fileMap.has(name),
        readFile: (name) => fileMap.get(name)?.text,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: () => libFileName,
      }
    );

    const checker = program.getTypeChecker();

    const bindings = new BindingRegistry();
    // NOTE: Intentionally omit the `listen` member from bindings to simulate missing bindings.
    bindings.addBindings("/test/nodejs-http.json", {
      namespace: "nodejs.Http",
      types: [
        {
          clrName: "nodejs.Http.Server",
          assemblyName: "nodejs",
          methods: [],
          properties: [],
          fields: [],
        },
      ],
    });

    const testProgram = {
      program,
      checker,
      options: {
        projectRoot: tmpRoot,
        sourceRoot: tmpRoot,
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [dtsFile],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver(tmpRoot),
      binding: createBinding(checker),
    };

    const irResult = buildIr(testProgram, {
      sourceRoot: tmpRoot,
      rootNamespace: "TestApp",
    });

    expect(irResult.ok, "IR build must fail on missing CLR bindings").to.equal(
      false
    );

    if (irResult.ok) return;

    const codes = irResult.error.map((d) => d.code);
    expect(codes).to.include("TSN4004");
  });
});
