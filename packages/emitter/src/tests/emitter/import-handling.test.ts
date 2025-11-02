/**
 * Tests for Import Handling
 * Tests emission of .NET and local imports
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Import Handling", () => {
  it("should handle .NET imports", () => {
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
          isDotNet: true,
          specifiers: [],
          resolvedNamespace: "System.IO",
        },
        {
          kind: "import",
          source: "System.Text.Json",
          isLocal: false,
          isDotNet: true,
          specifiers: [],
          resolvedNamespace: "System.Text.Json",
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("using System.IO");
    expect(result).to.include("using System.Text.Json");
  });

  it("should handle local imports", () => {
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
          isDotNet: false,
          specifiers: [],
        },
        {
          kind: "import",
          source: "../models/User.ts",
          isLocal: true,
          isDotNet: false,
          specifiers: [],
        },
      ],
      body: [],
      exports: [],
    };

    const result = emitModule(module, { rootNamespace: "MyApp" });

    expect(result).to.include("using MyApp.services");
    expect(result).to.include("using MyApp.models");
  });
});
