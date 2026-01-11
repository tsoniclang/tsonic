/**
 * Regression tests for CLR member binding disambiguation.
 *
 * Critical case: multiple tsbindgen namespaces can export the same TS type alias
 * (e.g., `Server`), but with different CLR declaring types and member casing.
 *
 * Tsonic must not guess CLR member names via naming policy in these cases.
 * It must use the correct tsbindgen bindings determined by the TS declaration source.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildIrModule } from "./builder.js";
import { createProgramContext } from "./program-context.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "./binding/index.js";

describe("CLR member binding disambiguation", () => {
  it("should disambiguate collisions by nearest bindings.json (Server.listen)", () => {
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
              tsEmitName: "Server",
              clrName: "nodejs.Http.Server",
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
          tsEmitName: "Server",
          assemblyName: "nodejs",
          methods: [
            {
              clrName: "listen",
              tsEmitName: "listen",
              normalizedSignature: "listen|(System.Int32,System.Action):nodejs.Http.Server|static=false",
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

    // Collision: another namespace also exports a `Server.listen`, but the CLR member
    // name casing differs (Listen vs listen). Tsonic must select the correct one
    // using the declaration source file's nearest bindings.json.
    bindings.addBindings("/test/nodejs.json", {
      namespace: "nodejs",
      types: [
        {
          clrName: "nodejs.Server",
          tsEmitName: "Server",
          assemblyName: "nodejs",
          methods: [
            {
              clrName: "Listen",
              tsEmitName: "listen",
              normalizedSignature: "Listen|(System.Int32,System.Action):nodejs.Server|static=false",
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

    const ctx = createProgramContext(testProgram, {
      sourceRoot: tmpRoot,
      rootNamespace: "TestApp",
    });

    const irResult = buildIrModule(sourceFile, testProgram, testProgram.options, ctx);
    if (!irResult.ok) {
      console.error("IR build failed:", irResult.error);
      throw new Error(
        `IR build MUST succeed for disambiguation test, got: ${JSON.stringify(irResult.error)}`
      );
    }

    const overloads = bindings.getMemberOverloads("Server", "listen");
    expect(overloads?.length).to.equal(
      2,
      "Test setup must have two Server.listen overload targets"
    );

    const funcDecl = irResult.value.body[0];
    if (funcDecl?.kind !== "functionDeclaration") {
      throw new Error("Expected function declaration");
    }

    const exprStmt = funcDecl.body.statements[0];
    if (exprStmt?.kind !== "expressionStatement") {
      throw new Error("Expected expression statement");
    }

    const callExpr = exprStmt.expression;
    if (callExpr.kind !== "call") {
      throw new Error("Expected call expression");
    }

    const callee = callExpr.callee;
    if (callee.kind !== "memberAccess") {
      throw new Error("Expected member access callee");
    }

    expect(callee.memberBinding, "Member binding must be resolved").to.not.equal(
      undefined
    );
    expect(callee.memberBinding?.type).to.equal("nodejs.Http.Server");
    expect(callee.memberBinding?.member).to.equal("listen");
  });
});

