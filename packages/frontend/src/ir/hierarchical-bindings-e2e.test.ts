/**
 * End-to-end test for hierarchical bindings
 * Verifies the full pipeline: TypeScript -> IR -> C# with hierarchical bindings
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "./builder.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { BindingRegistry } from "../program/bindings.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";

describe("Hierarchical Bindings End-to-End", () => {
  it("should resolve hierarchical bindings in IR for member access chain", () => {
    // TypeScript source with systemLinq.enumerable.selectMany
    const source = `
      export function processData() {
        const arr = [1, 2, 3];
        // systemLinq.enumerable.selectMany should resolve to System.Linq.Enumerable.SelectMany
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

    const testProgram = {
      program,
      checker: program.getTypeChecker(),
      options: {
        projectRoot: "/test",
        sourceRoot: "/test",
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver("/test"),
    };

    // Build IR
    const irResult = buildIrModule(sourceFile, testProgram, {
      sourceRoot: "/test",
      rootNamespace: "TestApp",
    });

    // MUST succeed - this is a strict test
    if (!irResult.ok) {
      console.error("IR build failed:", irResult.error);
      throw new Error(
        `IR build MUST succeed for e2e test, got error: ${JSON.stringify(irResult.error)}`
      );
    }

    const irModule = irResult.value;

    // Navigate to the selectMany call in IR
    const funcDecl = irModule.body[0];
    expect(funcDecl?.kind).to.equal(
      "functionDeclaration",
      "First body item should be function declaration"
    );
    if (funcDecl?.kind !== "functionDeclaration") return;

    // First statement: const arr = [1, 2, 3];
    // Second statement: const result = systemLinq.enumerable.selectMany(...)
    const resultDecl = funcDecl.body.statements[1];
    expect(resultDecl?.kind).to.equal(
      "variableDeclaration",
      "Second statement should be variable declaration for result"
    );
    if (resultDecl?.kind !== "variableDeclaration") return;

    const declarator = resultDecl.declarations[0];
    if (!declarator?.initializer) {
      throw new Error("Expected initializer for result variable");
    }

    // The initializer is the systemLinq.enumerable.selectMany(...) call
    const callExpr = declarator.initializer;
    expect(callExpr.kind).to.equal(
      "call",
      "Initializer should be call expression"
    );
    if (callExpr.kind !== "call") return;

    // The callee is systemLinq.enumerable.selectMany (member access)
    const memberExpr = callExpr.callee;
    expect(memberExpr.kind).to.equal(
      "memberAccess",
      "Callee should be member access"
    );
    if (memberExpr.kind !== "memberAccess") return;

    // CRITICAL: Verify memberBinding was resolved by the hierarchical binding system
    expect(
      memberExpr.memberBinding,
      "Member binding MUST be resolved for systemLinq.enumerable.selectMany"
    ).to.not.equal(undefined);

    expect(memberExpr.memberBinding?.assembly).to.equal("System.Linq");
    expect(memberExpr.memberBinding?.type).to.equal("System.Linq.Enumerable");
    expect(memberExpr.memberBinding?.member).to.equal("SelectMany");

    console.log("✅ End-to-end test passed: Hierarchical bindings work!");
  });
});
