/**
 * Regression tests for external member binding disambiguation -- success cases.
 *
 * Critical case: multiple tsbindgen namespaces can export the same TS type alias
 * (for example, `Server`), but with different target declaring types and member
 * casing.
 *
 * Tsonic must not guess member names via naming policy in these cases. It must
 * use the correct tsbindgen bindings determined by source declaration identity.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { createProgramContext } from "../program-context.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createTstsTestProgramFromFiles } from "../../testing/tsts-test-program.js";

describe("external member binding disambiguation (success)", () => {
  it("disambiguates collisions when a simple global binding selects the owner (console.log)", () => {
    const bindings = new BindingRegistry();
    bindings.addBindings("/test/js-simple.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "sourceSurface" },
      sourceSurface: {
        bindings: {
          console: {
            kind: "global",
            ownerIdentity: "Acme.Js",
            type: "Acme.Js.console",
          },
        },
      },
      targetSurface: { types: [] },
    });
    bindings.addBindings("/test/js.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "Acme.Js" },
      targetSurface: {
        types: [
          {
            targetName: "Acme.Js.console",
            ownerIdentity: "Acme.Js",
            methods: [
              {
                targetName: "log",
                normalizedSignature:
                  "log|(System.String):System.Void|static=false",
                parameterCount: 1,
                ownerQualifiedName: "Acme.Js.console",
                ownerIdentity: "Acme.Js",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      },
    });
    bindings.addBindings("/test/nodejs.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "nodejs" },
      targetSurface: {
        types: [
          {
            targetName: "nodejs.console",
            ownerIdentity: "nodejs",
            methods: [
              {
                targetName: "log",
                normalizedSignature:
                  "log|(System.String):System.Void|static=false",
                parameterCount: 1,
                ownerQualifiedName: "nodejs.console",
                ownerIdentity: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      },
    });

    const testProgram = createTstsTestProgramFromFiles(
      {
        "sample.ts": `
          export function test(): void {
            console.log("ok");
          }
        `,
        "js/globals.d.ts": `
          declare global {
            interface Console {
              log(message: string): void;
            }
            const console: Console;
          }
          export {};
        `,
        "lib.d.ts": `
          interface Function {}
          interface Object {}
          interface String {}
          interface Boolean {}
          interface Number {}
          interface IArguments {}
          type PropertyKey = string | number | symbol;
        `,
      },
      "sample.ts",
      { bindings }
    );
    const ctx = createProgramContext(testProgram, {
      sourceRoot: testProgram.options.sourceRoot,
      rootNamespace: "TestApp",
    });

    const irResult = buildIrModule(
      testProgram.sourceFile,
      testProgram,
      testProgram.options,
      ctx
    );
    if (!irResult.ok) {
      throw new Error(
        `IR build MUST succeed for simple-manifest disambiguation test, got: ${JSON.stringify(irResult.error)}`
      );
    }

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

    expect(callee.memberBinding).to.not.equal(undefined);
    expect(callee.memberBinding?.type).to.equal("Acme.Js.console");
    expect(callee.memberBinding?.member).to.equal("log");
  });

  it("disambiguates collisions by nearest bindings.json (Server.listen)", () => {
    const bindings = new BindingRegistry();
    bindings.addBindings("/test/nodejs-http.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "nodejs.Http" },
      targetSurface: {
        types: [
          {
            targetName: "nodejs.Http.Server",
            ownerIdentity: "nodejs",
            methods: [
              {
                targetName: "listen",
                normalizedSignature:
                  "listen|(System.Int32,System.Action):nodejs.Http.Server|static=false",
                parameterCount: 2,
                ownerQualifiedName: "nodejs.Http.Server",
                ownerIdentity: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      },
    });
    bindings.addBindings("/test/nodejs.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "nodejs" },
      targetSurface: {
        types: [
          {
            targetName: "nodejs.Server",
            ownerIdentity: "nodejs",
            methods: [
              {
                targetName: "listen",
                normalizedSignature:
                  "listen|(System.Int32,System.Action):nodejs.Server|static=false",
                parameterCount: 2,
                ownerQualifiedName: "nodejs.Server",
                ownerIdentity: "nodejs",
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      },
    });

    const testProgram = createTstsTestProgramFromFiles(
      {
        "sample.ts": `
          export function test(server: Server): void {
            server.listen(3000, () => {});
          }
        `,
        "nodejs.Http/bindings.json": JSON.stringify({
          schema: "tsonic.bindings",
          provider: { namespace: "nodejs.Http" },
          targetSurface: {
            types: [
              {
                targetName: "nodejs.Http.Server",
                methods: [],
                properties: [],
                fields: [],
              },
            ],
          },
        }),
        "nodejs.Http/internal/index.d.ts": `
          declare interface Server$instance {
            listen(port: number, callback: () => void): void;
          }
          declare type Server = Server$instance;
        `,
        "lib.d.ts": `
          interface Function {}
          interface Object {}
          interface String {}
          interface Boolean {}
          interface Number {}
          interface IArguments {}
          type PropertyKey = string | number | symbol;
        `,
      },
      "sample.ts",
      { bindings }
    );

    const ctx = createProgramContext(testProgram, {
      sourceRoot: testProgram.options.sourceRoot,
      rootNamespace: "TestApp",
    });

    const irResult = buildIrModule(
      testProgram.sourceFile,
      testProgram,
      testProgram.options,
      ctx
    );
    if (!irResult.ok) {
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

    expect(
      callee.memberBinding,
      "Member binding must be resolved"
    ).to.not.equal(undefined);
    expect(callee.memberBinding?.type).to.equal("nodejs.Http.Server");
    expect(callee.memberBinding?.member).to.equal("listen");
  });
});
