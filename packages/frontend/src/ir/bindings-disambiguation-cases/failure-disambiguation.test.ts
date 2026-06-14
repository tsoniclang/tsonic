/**
 * Regression tests for external member binding disambiguation -- failure cases.
 *
 * Tsonic must fail compilation when target binding collisions cannot be
 * disambiguated or when an externally declared member has no binding at all.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIr } from "../builder.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createTstsTestProgramFromFiles } from "../../testing/tsts-test-program.js";

const serverDeclarationFiles = (bindingsJson: unknown) => ({
  "sample.ts": `
    export function test(server: Server): void {
      server.listen(3000, () => {});
    }
  `,
  "nodejs.Http/bindings.json": JSON.stringify(bindingsJson),
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
});

describe("external member binding disambiguation (failure)", () => {
  it("fails compilation when collisions cannot be disambiguated", () => {
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
      serverDeclarationFiles({
        schema: "tsonic.bindings",
        provider: { namespace: "nodejs.Http" },
        targetSurface: {
          types: [
            {
              targetName: "nodejs.Http.NotServer",
              methods: [],
              properties: [],
              fields: [],
            },
          ],
        },
      }),
      "sample.ts",
      { bindings }
    );

    const irResult = buildIr(testProgram, {
      sourceRoot: testProgram.options.sourceRoot,
      rootNamespace: "TestApp",
    });

    expect(
      irResult.ok,
      "IR build must fail on ambiguous external bindings"
    ).to.equal(false);

    if (irResult.ok) return;

    const codes = irResult.error.map((d) => d.code);
    expect(codes).to.include("TSN4003");
  });

  it("fails compilation when an externally declared member has no binding", () => {
    const bindings = new BindingRegistry();
    bindings.addBindings("/test/nodejs-http.json", {
      schema: "tsonic.bindings",
      provider: { namespace: "nodejs.Http" },
      targetSurface: {
        types: [
          {
            targetName: "nodejs.Http.Server",
            ownerIdentity: "nodejs",
            methods: [],
            properties: [],
            fields: [],
          },
        ],
      },
    });

    const testProgram = createTstsTestProgramFromFiles(
      serverDeclarationFiles({
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
      "sample.ts",
      { bindings }
    );

    const irResult = buildIr(testProgram, {
      sourceRoot: testProgram.options.sourceRoot,
      rootNamespace: "TestApp",
    });

    expect(
      irResult.ok,
      "IR build must fail on missing external bindings"
    ).to.equal(false);

    if (irResult.ok) return;

    const codes = irResult.error.map((d) => d.code);
    expect(codes).to.include("TSN4004");
  });
});
