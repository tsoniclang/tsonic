/**
 * Full pipeline test: TypeScript -> IR -> C#
 * Tests hierarchical bindings end-to-end
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import {
  buildIrModule,
  DotnetMetadataRegistry,
  BindingRegistry,
  createClrBindingsResolver,
  createBinding,
  createProgramContext,
} from "@tsonic/frontend";
import { emitModule } from "./emitter.js";

describe("Hierarchical Bindings - Full Pipeline", () => {
  it("should compile TypeScript with hierarchical bindings to correct C#", () => {
    const source = `
      export function processData() {
        const arr = [1, 2, 3];
        const result = systemLinq.enumerable.selectMany(arr, x => [x, x * 2]);
        return result;
      }
    `;

    // Create hierarchical binding manifest
    const bindings = new BindingRegistry();
    bindings.addBindings("/test/system-linq.json", {
      assembly: "System.Linq",
      namespaces: [
        {
          name: "System.Linq",
          alias: "systemLinq",
          types: [
            {
              name: "Enumerable",
              alias: "enumerable",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "SelectMany",
                  alias: "selectMany",
                  binding: {
                    assembly: "System.Linq",
                    type: "System.Linq.Enumerable",
                    member: "SelectMany",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    // Create TypeScript program
    const fileName = "/test/sample.ts";
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true,
      ts.ScriptKind.TS
    );

    const program = ts.createProgram(
      [fileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
        writeFile: () => {},
        getCurrentDirectory: () => "/test",
        getDirectories: () => [],
        fileExists: () => true,
        readFile: () => source,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: (_options) => "lib.d.ts",
      }
    );

    const checker = program.getTypeChecker();
    const testProgram = {
      program,
      checker,
      binding: createBinding(checker),
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver("/test"),
    };

    // Phase 5: Create ProgramContext for this compilation
    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    // Step 1: Build IR
    const irResult = buildIrModule(sourceFile, testProgram, options, ctx);

    if (!irResult.ok) {
      throw new Error(
        `IR build must succeed for full pipeline test: ${JSON.stringify(irResult.error)}`
      );
    }

    const irModule = irResult.value;

    // Step 2: Emit C# code
    const csharpCode = emitModule(irModule);

    // Verify correct CLR member call
    expect(csharpCode).to.include(
      "System.Linq.Enumerable.SelectMany",
      "C# should use full CLR type.member from binding"
    );

    // Verify NO using statements - all types use global:: FQN
    expect(csharpCode).to.not.include(
      "using System.Linq",
      "C# should NOT include using directives - uses global:: FQN"
    );

    // Verify intermediate TypeScript names are NOT in output
    expect(csharpCode).to.not.include(
      "systemLinq",
      "C# should not contain TS namespace identifier"
    );
    expect(csharpCode).to.not.include(
      "enumerable",
      "C# should not contain TS type identifier"
    );

    // Verify function structure (may be void if return type not inferred)
    expect(csharpCode).to.match(
      /public static (void|object) ProcessData\(/,
      "C# should have processData function"
    );
  });

  it("should handle multiple hierarchical bindings in same code", () => {
    const source = `
      export function multipleBindings() {
        const a = myLib.typeA.methodA(1);
        const b = myLib.typeB.methodB("test");
        return a + b;
      }
    `;

    const bindings = new BindingRegistry();
    bindings.addBindings("/test/mylib.json", {
      assembly: "MyLib",
      namespaces: [
        {
          name: "MyLib",
          alias: "myLib",
          types: [
            {
              name: "TypeA",
              alias: "typeA",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "MethodA",
                  alias: "methodA",
                  binding: {
                    assembly: "MyLib",
                    type: "MyLib.TypeA",
                    member: "MethodA",
                  },
                },
              ],
            },
            {
              name: "TypeB",
              alias: "typeB",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "MethodB",
                  alias: "methodB",
                  binding: {
                    assembly: "MyLib",
                    type: "MyLib.TypeB",
                    member: "MethodB",
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const fileName = "/test/multi.ts";
    const sourceFile = ts.createSourceFile(
      fileName,
      source,
      ts.ScriptTarget.ES2022,
      true
    );

    const program = ts.createProgram(
      [fileName],
      {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
      {
        getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
        writeFile: () => {},
        getCurrentDirectory: () => "/test",
        getDirectories: () => [],
        fileExists: () => true,
        readFile: () => source,
        getCanonicalFileName: (f) => f,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
        getDefaultLibFileName: (_options) => "lib.d.ts",
      }
    );

    const checker2 = program.getTypeChecker();
    const testProgram = {
      program,
      checker: checker2,
      binding: createBinding(checker2),
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver("/test"),
    };

    // Phase 5: Create ProgramContext for this compilation
    const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
    const ctx = createProgramContext(testProgram, options);

    const irResult = buildIrModule(sourceFile, testProgram, options, ctx);

    if (!irResult.ok) {
      throw new Error("IR build failed for multiple bindings test");
    }

    const csharpCode = emitModule(irResult.value);

    // Both CLR calls should be present
    expect(csharpCode).to.include("MyLib.TypeA.MethodA");
    expect(csharpCode).to.include("MyLib.TypeB.MethodB");

    // TypeScript identifiers should not appear
    expect(csharpCode).to.not.include("myLib");
    expect(csharpCode).to.not.include("typeA");
    expect(csharpCode).to.not.include("typeB");
  });
});
