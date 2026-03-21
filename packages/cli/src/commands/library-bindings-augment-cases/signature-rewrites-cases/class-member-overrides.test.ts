import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { augmentLibraryBindingsFromSource } from "../../library-bindings-augment.js";
import { createResolvedConfig, withBindingsWorkspace } from "./helpers.js";

describe("library-bindings-augment", function () {
  this.timeout(30000);

  it("overrides class getter/setter types from source for optional value-like members", () => {
    withBindingsWorkspace("tsonic-source-class-augment-", (workspace) => {
      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        ["export class User {", "  Count?: number;", "}", ""].join("\n"),
        "utf-8"
      );

      const internalDir = join(workspace.bindingsOutDir, "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "import * as System_Internal from '@tsonic/dotnet/System/internal/index.js';",
          "import type { Nullable_1 } from '@tsonic/dotnet/System/internal/index.js';",
          "",
          "export interface User$instance {",
          "  get Count(): Nullable_1<System_Internal.Int32> | undefined;",
          "  set Count(value: Nullable_1<System_Internal.Int32> | number | undefined);",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include("get Count(): number | undefined;");
      expect(patched).to.include("set Count(value: number | undefined);");
      expect(patched).to.not.include("Nullable_1<System_Internal.Int32>");
    });
  });

  it("keeps @tsonic/core type aliases when overriding class getter/setter types", () => {
    withBindingsWorkspace("tsonic-source-class-core-augment-", (workspace) => {
      const coreDir = join(workspace.dir, "node_modules", "@tsonic", "core");
      mkdirSync(coreDir, { recursive: true });
      writeFileSync(
        join(coreDir, "package.json"),
        JSON.stringify({ name: "@tsonic/core", type: "module" }, null, 2),
        "utf-8"
      );
      writeFileSync(
        join(coreDir, "types.d.ts"),
        "export type int = number;\n",
        "utf-8"
      );

      writeFileSync(
        join(workspace.srcDir, "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "export class User {",
          "  BotType?: int;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const internalDir = join(workspace.bindingsOutDir, "internal");
      mkdirSync(internalDir, { recursive: true });
      const internalIndex = join(internalDir, "index.d.ts");
      writeFileSync(
        internalIndex,
        [
          "import * as System_Internal from '@tsonic/dotnet/System/internal/index.js';",
          "import type { Nullable_1 } from '@tsonic/dotnet/System/internal/index.js';",
          "",
          "export interface User$instance {",
          "  get BotType(): Nullable_1<System_Internal.Int32> | undefined;",
          "  set BotType(value: Nullable_1<System_Internal.Int32> | int | undefined);",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      const result = augmentLibraryBindingsFromSource(
        createResolvedConfig(workspace.dir, {
          typeRoots: [join(workspace.dir, "node_modules")],
        }),
        workspace.bindingsOutDir
      );
      expect(result.ok, result.ok ? undefined : result.error).to.equal(true);

      const patched = readFileSync(internalIndex, "utf-8");
      expect(patched).to.include("get BotType(): int | undefined;");
      expect(patched).to.include("set BotType(value: int | undefined);");
      expect(patched).to.not.include("Nullable_1<System_Internal.Int32>");
    });
  });
});
