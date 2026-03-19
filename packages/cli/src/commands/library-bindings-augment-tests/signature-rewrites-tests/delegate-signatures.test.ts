import { describe, it } from "mocha";
import { expect } from "chai";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { augmentLibraryBindingsFromSource } from "../../library-bindings-augment.js";
import {
  createResolvedConfig,
  withBindingsWorkspace,
  writeInternalFacade,
} from "./helpers.js";

describe("library-bindings-augment", function () {
  this.timeout(30000);

  it("rewrites const delegate exports to source signatures and injects required type imports", () => {
    withBindingsWorkspace("tsonic-facade-const-delegate-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export const bulkUpdate = async (",
          "  settings: Record<string, unknown>",
          "): Promise<int> => {",
          "  void settings;",
          "  return 1;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const { facadePath } = writeInternalFacade({
        bindingsOutDir: workspace.bindingsOutDir,
        internalLines: [""],
        facadeLines: [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_bulkUpdate__Delegate = Internal.Service_bulkUpdate__Delegate;",
          "export declare const bulkUpdate: Internal.Service_bulkUpdate__Delegate;",
          "",
        ],
      });

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "export declare function bulkUpdate(settings: Record<string, unknown>): Promise<int>;"
      );
      expect(patched).to.not.include("export declare const bulkUpdate:");
      expect(patched).to.include(
        "import type { int } from '@tsonic/core/types.js';"
      );
    });
  });

  it("injects required imports for value-imported source types in rewritten delegate signatures", () => {
    withBindingsWorkspace("tsonic-facade-value-import-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          "",
          "export const createNames = (): List<string> => {",
          "  return new List<string>();",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const { facadePath } = writeInternalFacade({
        bindingsOutDir: workspace.bindingsOutDir,
        internalLines: [""],
        facadeLines: [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_createNames__Delegate = Internal.Service_createNames__Delegate;",
          "export declare const createNames: Internal.Service_createNames__Delegate;",
          "",
        ],
      });

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "import type { List } from '@tsonic/dotnet/System.Collections.Generic.js';"
      );
      expect(patched).to.include(
        "export declare function createNames(): List<string>;"
      );
      expect(patched).to.not.include("export declare const createNames:");
    });
  });

  it("rewrites delegate exports discovered through local source imports without needing the full frontend graph", () => {
    withBindingsWorkspace("tsonic-facade-local-import-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          'import { bulkUpdate } from "./service.js";',
          "",
          "export const run = () => bulkUpdate({});",
          "",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(workspace.srcDir, "service.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export const bulkUpdate = async (",
          "  settings: Record<string, unknown>",
          "): Promise<int> => {",
          "  void settings;",
          "  return 1;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const { facadePath } = writeInternalFacade({
        bindingsOutDir: workspace.bindingsOutDir,
        internalLines: [""],
        facadeLines: [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export type Service_bulkUpdate__Delegate = Internal.Service_bulkUpdate__Delegate;",
          "export declare const bulkUpdate: Internal.Service_bulkUpdate__Delegate;",
          "",
        ],
      });

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(facadePath, "utf-8");
      expect(patched).to.include(
        "export declare function bulkUpdate(settings: Record<string, unknown>): Promise<int>;"
      );
      expect(patched).to.not.include("export declare const bulkUpdate:");
      expect(patched).to.include(
        "import type { int } from '@tsonic/core/types.js';"
      );
    });
  });
});
