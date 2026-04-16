/**
 * Module Map Tests
 *
 * Tests for module path canonicalization and import path resolution.
 * These tests guard against regressions in ESM import handling.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildModuleMap,
  canonicalizeFilePath,
  resolveImportPath,
} from "./module-map.js";
import {
  normalizedUnionType,
  stampRuntimeUnionAliasCarrier,
  type IrModule,
  type IrType,
} from "@tsonic/frontend";

const makeModule = (filePath: string, body: readonly unknown[]): IrModule =>
  ({
    kind: "module",
    filePath,
    namespace: "Test",
    className: filePath.split("/").pop()?.replace(/\.ts$/, "") ?? "module",
    isStaticContainer: true,
    imports: [],
    body,
    exports: [],
  }) as unknown as IrModule;

describe("Module Map", () => {
  describe("canonicalizeFilePath", () => {
    it("should remove .ts extension", () => {
      expect(canonicalizeFilePath("src/utils/Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should normalize backslashes to forward slashes", () => {
      expect(canonicalizeFilePath("src\\utils\\Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should resolve . segments", () => {
      expect(canonicalizeFilePath("src/./utils/Math.ts")).to.equal(
        "src/utils/Math"
      );
    });

    it("should resolve .. segments", () => {
      expect(canonicalizeFilePath("src/utils/../models/User.ts")).to.equal(
        "src/models/User"
      );
    });

    it("should handle multiple .. segments", () => {
      expect(canonicalizeFilePath("src/a/b/../../c/D.ts")).to.equal("src/c/D");
    });
  });

  describe("resolveImportPath", () => {
    describe("extension handling", () => {
      it("should strip .ts extension from import source", () => {
        const result = resolveImportPath("src/index.ts", "./utils/Math.ts");
        expect(result).to.equal("src/utils/Math");
      });

      it("should strip .js extension from import source (ESM style)", () => {
        // REGRESSION TEST: ESM imports use .js extension for TypeScript files
        // This was the root cause of 7 E2E test failures (multi-file, namespace-imports, etc.)
        const result = resolveImportPath("src/index.ts", "./utils/Math.js");
        expect(result).to.equal("src/utils/Math");
      });

      it("should handle import without extension", () => {
        const result = resolveImportPath("src/index.ts", "./utils/Math");
        expect(result).to.equal("src/utils/Math");
      });

      it(".js and .ts imports should resolve to same canonical path", () => {
        // Critical: Both ESM (.js) and explicit (.ts) imports must resolve identically
        const fromJs = resolveImportPath("src/index.ts", "./utils/Math.js");
        const fromTs = resolveImportPath("src/index.ts", "./utils/Math.ts");
        const fromBare = resolveImportPath("src/index.ts", "./utils/Math");

        expect(fromJs).to.equal(fromTs);
        expect(fromTs).to.equal(fromBare);
        expect(fromJs).to.equal("src/utils/Math");
      });
    });

    describe("relative path resolution", () => {
      it("should resolve ./ imports (same directory)", () => {
        const result = resolveImportPath("src/services/api.ts", "./auth.js");
        expect(result).to.equal("src/services/auth");
      });

      it("should resolve ../ imports (parent directory)", () => {
        const result = resolveImportPath(
          "src/services/api.ts",
          "../models/User.js"
        );
        expect(result).to.equal("src/models/User");
      });

      it("should resolve multiple ../ segments", () => {
        const result = resolveImportPath(
          "src/a/b/c/deep.ts",
          "../../utils/helper.js"
        );
        expect(result).to.equal("src/a/utils/helper");
      });

      it("should handle bare imports (no ./ prefix) as same directory", () => {
        const result = resolveImportPath("src/index.ts", "utils/Math.js");
        expect(result).to.equal("src/utils/Math");
      });
    });

    describe("real-world E2E test cases", () => {
      // These mirror the actual imports from failing E2E tests

      it("multi-file: ./utils/Math.js from src/index.ts", () => {
        const result = resolveImportPath("src/index.ts", "./utils/Math.js");
        expect(result).to.equal("src/utils/Math");
      });

      it("namespace-imports: ./utils/math.js from src/index.ts", () => {
        const result = resolveImportPath("src/index.ts", "./utils/math.js");
        expect(result).to.equal("src/utils/math");
      });

      it("barrel-reexports: ./User.js from src/models/index.ts", () => {
        const result = resolveImportPath("src/models/index.ts", "./User.js");
        expect(result).to.equal("src/models/User");
      });

      it("multi-file-imports: ../utils/index.js from src/index.ts", () => {
        // Note: This tests parent directory + index file
        const result = resolveImportPath(
          "src/app/index.ts",
          "../utils/index.js"
        );
        expect(result).to.equal("src/utils/index");
      });
    });
  });

  describe("buildModuleMap", () => {
    it("marks type-only modules as having no runtime container", () => {
      const module = makeModule("src/types.ts", [
        {
          kind: "interfaceDeclaration",
          name: "User",
          members: [],
        },
        {
          kind: "typeAliasDeclaration",
          name: "UserRecord",
          type: { kind: "objectType", members: [] },
        },
      ]);

      const result = buildModuleMap([module]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const identity = result.value.get("src/types");
      expect(identity?.hasRuntimeContainer).to.equal(false);
    });

    it("marks value-bearing modules as having a runtime container", () => {
      const module = makeModule("src/runtime.ts", [
        {
          kind: "variableDeclaration",
          declarations: [
            {
              name: { kind: "identifierPattern", name: "value" },
              initializer: { kind: "numericLiteral", value: 1 },
            },
          ],
        },
      ]);

      const result = buildModuleMap([module]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const identity = result.value.get("src/runtime");
      expect(identity?.hasRuntimeContainer).to.equal(true);
    });

    it("tracks named export aliases back to local module values", () => {
      const module = {
        ...makeModule("src/path.ts", [
          {
            kind: "variableDeclaration",
            declarations: [
              {
                name: { kind: "identifierPattern", name: "pathObject" },
                initializer: {
                  kind: "object",
                  properties: [],
                  inferredType: { kind: "objectType", members: [] },
                },
              },
            ],
          },
        ]),
        exports: [
          {
            kind: "named" as const,
            name: "path",
            localName: "pathObject",
          },
        ],
      } satisfies IrModule;

      const result = buildModuleMap([module]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.exportMap.get("src/path:path")).to.deep.equal({
        sourceFile: "src/path",
        sourceName: "pathObject",
      });
    });

    it("tracks named exports of imported local values to the original source module", () => {
      const source = {
        ...makeModule("src/path.ts", [
          {
            kind: "functionDeclaration",
            name: "basename",
            parameters: [],
            returnType: { kind: "primitiveType", name: "string" },
            body: { kind: "blockStatement", statements: [] },
            isAsync: false,
            isGenerator: false,
            isExported: true,
          },
        ]),
        exports: [
          {
            kind: "declaration" as const,
            declaration: {
              kind: "functionDeclaration",
              name: "basename",
              parameters: [],
              returnType: { kind: "primitiveType", name: "string" },
              body: { kind: "blockStatement", statements: [] },
              isAsync: false,
              isGenerator: false,
              isExported: true,
            },
          },
        ],
      } satisfies IrModule;

      const barrel = {
        ...makeModule("src/index.ts", []),
        imports: [
          {
            kind: "import" as const,
            source: "./path.js",
            isLocal: true,
            isClr: false,
            resolvedPath: "src/path.ts",
            specifiers: [
              {
                kind: "named" as const,
                name: "basename",
                localName: "basenameImpl",
              },
            ],
          },
        ],
        exports: [
          {
            kind: "named" as const,
            name: "basename",
            localName: "basenameImpl",
          },
        ],
      } satisfies IrModule;

      const result = buildModuleMap([source, barrel]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.exportMap.get("src/index:basename")).to.deep.equal({
        sourceFile: "src/path",
        sourceName: "basename",
      });
    });

    it("tracks named exports of imported source-package values using module-relative keys", () => {
      const source = {
        ...makeModule(
          "../../../node_modules/@tsonic/nodejs/src/process-module.ts",
          [
            {
              kind: "variableDeclaration",
              declarationKind: "const",
              declarations: [
                {
                  kind: "variableDeclarator",
                  name: { kind: "identifierPattern", name: "process" },
                  initializer: {
                    kind: "object",
                    properties: [],
                    inferredType: { kind: "objectType", members: [] },
                  },
                },
              ],
              isExported: true,
            },
          ]
        ),
        exports: [
          {
            kind: "named" as const,
            name: "process",
            localName: "process",
          },
        ],
      } satisfies IrModule;

      const barrel = {
        ...makeModule("../../../node_modules/@tsonic/nodejs/src/index.ts", []),
        imports: [
          {
            kind: "import" as const,
            source: "./process-module.ts",
            isLocal: true,
            isClr: false,
            resolvedPath:
              "/tmp/project/node_modules/@tsonic/nodejs/src/process-module.ts",
            specifiers: [
              {
                kind: "named" as const,
                name: "process",
                localName: "process",
              },
            ],
          },
        ],
        exports: [
          {
            kind: "named" as const,
            name: "process",
            localName: "process",
          },
        ],
      } satisfies IrModule;

      const result = buildModuleMap([source, barrel]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.exportMap.get("node_modules/@tsonic/nodejs/src/index:process")
      ).to.deep.equal({
        sourceFile: "node_modules/@tsonic/nodejs/src/process-module",
        sourceName: "process",
      });
    });

    it("tracks named exports of imported source-package type-like symbols", () => {
      const source = {
        ...makeModule(
          "../../../node_modules/@tsonic/nodejs/src/crypto/key-object.ts",
          [
            {
              kind: "classDeclaration",
              name: "PublicKeyObject",
              members: [],
            },
          ]
        ),
        namespace: "nodejs.Crypto",
        className: "KeyObject",
      } satisfies IrModule;

      const barrel = {
        ...makeModule(
          "../../../node_modules/@tsonic/nodejs/src/crypto/index.ts",
          []
        ),
        namespace: "nodejs",
        className: "crypto",
        imports: [
          {
            kind: "import" as const,
            source: "./key-object.ts",
            isLocal: true,
            isClr: false,
            resolvedPath:
              "/tmp/project/node_modules/@tsonic/nodejs/src/crypto/key-object.ts",
            specifiers: [
              {
                kind: "named" as const,
                name: "PublicKeyObject",
                localName: "PublicKeyObject",
                isType: true,
              },
            ],
          },
        ],
        exports: [
          {
            kind: "named" as const,
            name: "PublicKeyObject",
            localName: "PublicKeyObject",
          },
        ],
      } satisfies IrModule;

      const result = buildModuleMap([source, barrel]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(
        result.exportMap.get(
          "node_modules/@tsonic/nodejs/src/crypto/index:PublicKeyObject"
        )
      ).to.deep.equal({
        sourceFile: "node_modules/@tsonic/nodejs/src/crypto/key-object",
        sourceName: "PublicKeyObject",
      });
    });

    it("promotes source-owned runtime union aliases referenced through exported surfaces", () => {
      const middlewareLike = stampRuntimeUnionAliasCarrier(
        normalizedUnionType([
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "int" },
        ]),
        {
          aliasName: "MiddlewareLike",
          fullyQualifiedName: "Test.MiddlewareLike",
        }
      ) as Extract<IrType, { kind: "unionType" }>;

      const runDeclaration = {
        kind: "functionDeclaration" as const,
        name: "run",
        parameters: [
          {
            kind: "parameter" as const,
            pattern: { kind: "identifierPattern" as const, name: "handler" },
            type: middlewareLike,
            isOptional: false,
            isRest: false,
            passing: "value" as const,
          },
        ],
        returnType: { kind: "voidType" as const },
        body: { kind: "blockStatement" as const, statements: [] },
        isAsync: false,
        isGenerator: false,
        isExported: true,
      };

      const module = {
        ...makeModule("src/index.ts", [
          {
            kind: "typeAliasDeclaration" as const,
            name: "MiddlewareLike",
            type: middlewareLike,
            typeParameters: [],
            isExported: false,
          },
          runDeclaration,
        ]),
        exports: [
          {
            kind: "declaration" as const,
            declaration: runDeclaration,
          },
        ],
      } satisfies IrModule;

      const result = buildModuleMap([module]);
      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.get("src/index")?.publicLocalTypes?.has("MiddlewareLike")).to.equal(true);
    });
  });
});
