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

  it("optionalizes brand markers for non-exported source interfaces used in exported signatures", () => {
    withBindingsWorkspace("tsonic-local-interface-brand-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          "interface LocalInput {",
          "  value: string;",
          "}",
          "",
          "export const useLocalInput = async (",
          "  input: LocalInput",
          "): Promise<boolean> => {",
          "  void input;",
          "  return true;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const { internalIndex } = writeInternalFacade({
        bindingsOutDir: workspace.bindingsOutDir,
        internalLines: [
          "export interface LocalInput$instance {",
          "  readonly __tsonic_type_TestApp_LocalInput: never;",
          "  value: string;",
          "}",
          "",
        ],
        facadeLines: [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export declare function useLocalInput(input: Internal.LocalInput): Promise<boolean>;",
          "",
        ],
      });

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include(
        "readonly __tsonic_type_TestApp_LocalInput?: never;"
      );
      expect(patched).to.not.include(
        "readonly __tsonic_type_TestApp_LocalInput: never;"
      );
    });
  });

  it("optionalizes brand markers for non-exported structural type aliases", () => {
    withBindingsWorkspace("tsonic-local-alias-brand-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          "type LocalPayload = {",
          "  id: string;",
          "};",
          "",
          "export const useLocalAlias = async (",
          "  payload: LocalPayload",
          "): Promise<boolean> => {",
          "  void payload;",
          "  return true;",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      const { internalIndex } = writeInternalFacade({
        bindingsOutDir: workspace.bindingsOutDir,
        internalLines: [
          "export interface LocalPayload__Alias$instance {",
          "  readonly __tsonic_type_TestApp_LocalPayload__Alias: never;",
          "  id: string;",
          "}",
          "",
        ],
        facadeLines: [
          "// Namespace: TestApp",
          "import * as Internal from './TestApp/internal/index.js';",
          "",
          "export declare function useLocalAlias(payload: Internal.LocalPayload__Alias): Promise<boolean>;",
          "",
        ],
      });

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include(
        "readonly __tsonic_type_TestApp_LocalPayload__Alias?: never;"
      );
      expect(patched).to.not.include(
        "readonly __tsonic_type_TestApp_LocalPayload__Alias: never;"
      );
    });
  });
});
