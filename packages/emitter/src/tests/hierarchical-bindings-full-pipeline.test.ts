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
} from "@tsonic/frontend";
import { emitModule } from "../emitter.js";

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
          name: "systemLinq",
          alias: "System.Linq",
          types: [
            {
              name: "enumerable",
              alias: "Enumerable",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "selectMany",
                  alias: "SelectMany",
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

    const testProgram = {
      program,
      checker: program.getTypeChecker(),
      options: { sourceRoot: "/test", rootNamespace: "TestApp", strict: true },
      sourceFiles: [sourceFile],
      metadata: new DotnetMetadataRegistry(),
      bindings,
    };

    // Step 1: Build IR
    const irResult = buildIrModule(sourceFile, testProgram, {
      sourceRoot: "/test",
      rootNamespace: "TestApp",
    });

    if (!irResult.ok) {
      console.error("IR build failed:", irResult.error);
      throw new Error("IR build must succeed for full pipeline test");
    }

    const irModule = irResult.value;

    // Step 2: Emit C# code
    const csharpCode = emitModule(irModule);

    // Step 3: Verify C# output
    console.log("\n=== Generated C# Code ===");
    console.log(csharpCode);
    console.log("=== End ===\n");

    // Verify correct CLR member call
    expect(csharpCode).to.include(
      "System.Linq.Enumerable.SelectMany",
      "C# should use full CLR type.member from binding"
    );

    // Verify using statement was added
    expect(csharpCode).to.include(
      "using System.Linq",
      "C# should include using for assembly"
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
      /public static (void|object) processData\(/,
      "C# should have processData function"
    );

    console.log(
      "✅ Full pipeline test passed: TypeScript -> IR -> C# with hierarchical bindings"
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
          name: "myLib",
          alias: "MyLib",
          types: [
            {
              name: "typeA",
              alias: "TypeA",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "methodA",
                  alias: "MethodA",
                  binding: {
                    assembly: "MyLib",
                    type: "MyLib.TypeA",
                    member: "MethodA",
                  },
                },
              ],
            },
            {
              name: "typeB",
              alias: "TypeB",
              kind: "class",
              members: [
                {
                  kind: "method",
                  name: "methodB",
                  alias: "MethodB",
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

    const testProgram = {
      program,
      checker: program.getTypeChecker(),
      options: { sourceRoot: "/test", rootNamespace: "TestApp", strict: true },
      sourceFiles: [sourceFile],
      metadata: new DotnetMetadataRegistry(),
      bindings,
    };

    const irResult = buildIrModule(sourceFile, testProgram, {
      sourceRoot: "/test",
      rootNamespace: "TestApp",
    });

    if (!irResult.ok) {
      throw new Error("IR build failed for multiple bindings test");
    }

    const csharpCode = emitModule(irResult.value);

    console.log("\n=== Multiple Bindings C# ===");
    console.log(csharpCode);
    console.log("=== End ===\n");

    // Both CLR calls should be present
    expect(csharpCode).to.include("MyLib.TypeA.MethodA");
    expect(csharpCode).to.include("MyLib.TypeB.MethodB");

    // TypeScript identifiers should not appear
    expect(csharpCode).to.not.include("myLib");
    expect(csharpCode).to.not.include("typeA");
    expect(csharpCode).to.not.include("typeB");

    console.log("✅ Multiple bindings test passed");
  });
});
