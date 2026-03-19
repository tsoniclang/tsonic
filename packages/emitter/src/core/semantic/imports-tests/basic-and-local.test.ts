/**
 * Tests for Import Handling
 * Tests emission of .NET and local imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Import Handling", () => {
  it("should NOT emit using directives for .NET imports", () => {
    // .NET imports are resolved to fully-qualified names with global:: prefix,
    // so we don't emit using directives
    const module: IrModule = {
      kind: "module",
      filePath: "/src/test.ts",
      namespace: "MyApp",
      className: "test",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "System.IO",
          isLocal: false,
          isClr: true,
          specifiers: [],
          resolvedNamespace: "System.IO",
        },
        {
          kind: "import",
          source: "System.Text.Json",
          isLocal: false,
          isClr: true,
          specifiers: [],
          resolvedNamespace: "System.Text.Json",
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module);

    // Should NOT include using directives - all types use global:: FQN
    expect(result).to.not.include("using System.IO");
    expect(result).to.not.include("using System.Text.Json");
  });

  it("should NOT emit using directives for local imports", () => {
    // Local module imports are always emitted as fully-qualified references,
    // so we don't need using directives for them
    const module: IrModule = {
      kind: "module",
      filePath: "/src/services/api.ts",
      namespace: "MyApp.services",
      className: "api",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "./auth.ts",
          isLocal: true,
          isClr: false,
          specifiers: [],
        },
        {
          kind: "import",
          source: "../models/User.ts",
          isLocal: true,
          isClr: false,
          specifiers: [],
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module, { rootNamespace: "MyApp" });

    // Should NOT include using directives for local modules
    // (identifiers from local imports are emitted fully-qualified)
    expect(result).to.not.include("using MyApp.services;");
    expect(result).to.not.include("using MyApp.models;");
  });

  it("should lower local imports even when resolvedPath is absolute", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "common/operators/in-operator/InOperator.ts",
      namespace: "TestCases.common.operators.inoperator",
      className: "InOperator",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "./Auth.js",
          isLocal: true,
          isClr: false,
          resolvedPath: "/tmp/tsonic/common/operators/in-operator/Auth.ts",
          specifiers: [
            {
              kind: "named",
              name: "getAuth",
              localName: "getAuth",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "getAuth",
            },
            arguments: [{ kind: "literal", value: false }],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "common/operators/in-operator/Auth",
          {
            namespace: "TestCases.common.operators.inoperator",
            className: "Auth",
            filePath: "common/operators/in-operator/Auth.ts",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              {
                name: "getAuth",
                isDefault: false,
                kind: "function",
              },
            ],
            exportedValueKinds: new Map([["getAuth", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include(
      "global::TestCases.common.operators.inoperator.Auth.getAuth(false)"
    );
  });

  it("should lower source-package imports when resolvedPath points into node_modules", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "src/index.ts",
      namespace: "SourcePackageBasic",
      className: "index",
      isStaticContainer: true,
      imports: [
        {
          kind: "import",
          source: "@acme/math",
          isLocal: true,
          isClr: false,
          resolvedPath: "/tmp/project/node_modules/@acme/math/src/index.ts",
          specifiers: [
            {
              kind: "named",
              name: "clamp",
              localName: "clamp",
              isType: false,
            },
          ],
        },
      ],
      body: [
        {
          kind: "expressionStatement",
          expression: {
            kind: "call",
            callee: {
              kind: "identifier",
              name: "clamp",
            },
            arguments: [
              { kind: "literal", value: 10 },
              { kind: "literal", value: 0 },
              { kind: "literal", value: 5 },
            ],
            isOptional: false,
          },
        },
      ],
      exports: [],
    };

    const result = emitModule(module, {
      moduleMap: new Map([
        [
          "node_modules/@acme/math/src/index",
          {
            namespace: "Acme.Math",
            className: "index",
            filePath: "node_modules/@acme/math/src/index",
            hasRuntimeContainer: true,
            hasTopLevelCode: false,
            imports: [],
            exports: [
              {
                name: "clamp",
                isDefault: false,
                kind: "function",
              },
            ],
            exportedValueKinds: new Map([["clamp", "function"]]),
            localTypes: new Map(),
            hasTypeCollision: false,
          },
        ],
      ]),
    });

    expect(result).to.include("global::Acme.Math.index.clamp(10, 0, 5)");
  });

});
