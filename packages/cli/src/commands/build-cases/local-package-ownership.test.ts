import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../config.js";
import { buildCommand } from "../build.js";
import { buildTestTimeoutMs } from "./helpers.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const nodeModulesPackagePath = (
  workspaceRoot: string,
  packageId: string
): string => join(workspaceRoot, "node_modules", ...packageId.split("/"));

const writeJson = (filePath: string, value: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
};

const writeWorkspace = (workspaceRoot: string): void => {
  writeJson(join(workspaceRoot, "package.json"), {
    name: "local-package-ownership-workspace",
    private: true,
    type: "module",
  });
  writeJson(join(workspaceRoot, "tsonic.workspace.json"), {
    $schema: "https://tsonic.org/schema/workspace/v1.json",
    dotnetVersion: "net10.0",
    surface: "clr",
  });
  mkdirSync(join(workspaceRoot, "node_modules"), { recursive: true });

  linkDir(
    join(repoRoot, "node_modules/@tsonic/core"),
    join(workspaceRoot, "node_modules/@tsonic/core")
  );
  linkDir(
    join(repoRoot, "node_modules/@tsonic/dotnet"),
    join(workspaceRoot, "node_modules/@tsonic/dotnet")
  );
  linkDir(
    join(repoRoot, "node_modules/@tsonic/globals"),
    join(workspaceRoot, "node_modules/@tsonic/globals")
  );
};

const writeLibraryProject = (workspaceRoot: string): void => {
  const projectRoot = join(workspaceRoot, "packages", "lib");
  mkdirSync(join(projectRoot, "src"), { recursive: true });

  writeJson(join(projectRoot, "package.json"), {
    name: "@acme/lib",
    version: "1.0.0",
    private: true,
    type: "module",
    exports: {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts",
    },
    files: ["src/**/*.ts", "tsonic.package.json"],
  });
  writeJson(join(projectRoot, "tsonic.package.json"), {
    schemaVersion: 1,
    kind: "tsonic-source-package",
    surfaces: ["clr"],
    source: {
      namespace: "Acme.Lib",
      exports: {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
      },
    },
  });
  writeJson(join(projectRoot, "tsonic.json"), {
    $schema: "https://tsonic.org/schema/v1.json",
    rootNamespace: "Acme.Lib",
    entryPoint: "src/index.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: "Acme.Lib",
    output: {
      type: "library",
      nativeAot: false,
      generateDocumentation: false,
      includeSymbols: false,
      packable: false,
    },
  });
  writeFileSync(
    join(projectRoot, "src", "index.ts"),
    [
      "export function double(value: number): number {",
      "  return value * 2;",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );
};

type LocalPackageReference = {
  readonly id: string;
  readonly project: string;
  readonly mode?: "source" | "dll";
};

const writeSourcePackageProject = (options: {
  readonly workspaceRoot: string;
  readonly dirName: string;
  readonly packageId: string;
  readonly namespace: string;
  readonly outputName: string;
  readonly sourceText: string;
  readonly localPackageReferences?: readonly LocalPackageReference[];
}): void => {
  const projectRoot = join(options.workspaceRoot, "packages", options.dirName);
  mkdirSync(join(projectRoot, "src"), { recursive: true });

  writeJson(join(projectRoot, "package.json"), {
    name: options.packageId,
    version: "1.0.0",
    private: true,
    type: "module",
    exports: {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts",
    },
    files: ["src/**/*.ts", "tsonic.package.json"],
  });
  writeJson(join(projectRoot, "tsonic.package.json"), {
    schemaVersion: 1,
    kind: "tsonic-source-package",
    surfaces: ["clr"],
    source: {
      namespace: options.namespace,
      exports: {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
      },
    },
  });
  writeJson(join(projectRoot, "tsonic.json"), {
    $schema: "https://tsonic.org/schema/v1.json",
    rootNamespace: options.namespace,
    entryPoint: "src/index.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: options.outputName,
    output: {
      type: "library",
      nativeAot: false,
      generateDocumentation: false,
      includeSymbols: false,
      packable: false,
    },
    ...(options.localPackageReferences &&
    options.localPackageReferences.length > 0
      ? {
          references: {
            packages: options.localPackageReferences,
          },
        }
      : {}),
  });
  writeFileSync(join(projectRoot, "src", "index.ts"), options.sourceText, "utf-8");

  linkDir(projectRoot, nodeModulesPackagePath(options.workspaceRoot, options.packageId));
};

const writeReexportSourcePackageProject = (options: {
  readonly workspaceRoot: string;
  readonly dirName: string;
  readonly packageId: string;
  readonly namespace: string;
  readonly outputName: string;
  readonly indexSourceText: string;
  readonly runtimeRelativePath: string;
  readonly runtimeSourceText: string;
}): void => {
  const projectRoot = join(options.workspaceRoot, "packages", options.dirName);
  mkdirSync(join(projectRoot, "src", dirname(options.runtimeRelativePath)), {
    recursive: true,
  });

  writeJson(join(projectRoot, "package.json"), {
    name: options.packageId,
    version: "1.0.0",
    private: true,
    type: "module",
    exports: {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts",
    },
    files: ["src/**/*.ts", "tsonic.package.json"],
  });
  writeJson(join(projectRoot, "tsonic.package.json"), {
    schemaVersion: 1,
    kind: "tsonic-source-package",
    surfaces: ["clr"],
    source: {
      namespace: options.namespace,
      exports: {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
      },
    },
  });
  writeJson(join(projectRoot, "tsonic.json"), {
    $schema: "https://tsonic.org/schema/v1.json",
    rootNamespace: options.namespace,
    entryPoint: "src/index.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: options.outputName,
    output: {
      type: "library",
      nativeAot: false,
      generateDocumentation: false,
      includeSymbols: false,
      packable: false,
    },
  });
  writeFileSync(
    join(projectRoot, "src", "index.ts"),
    options.indexSourceText,
    "utf-8"
  );
  writeFileSync(
    join(projectRoot, "src", options.runtimeRelativePath),
    options.runtimeSourceText,
    "utf-8"
  );

  linkDir(projectRoot, nodeModulesPackagePath(options.workspaceRoot, options.packageId));
};

const writeAppProject = (
  workspaceRoot: string,
  mode?: "dll"
): { readonly projectRoot: string; readonly config: ReturnType<typeof resolveConfig> } => {
  const projectRoot = join(workspaceRoot, "packages", "app");
  mkdirSync(join(projectRoot, "src"), { recursive: true });

  writeJson(join(projectRoot, "package.json"), {
    name: "@acme/app",
    version: "1.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@acme/lib": "0.0.0",
    },
  });
  writeJson(join(projectRoot, "tsonic.json"), {
    $schema: "https://tsonic.org/schema/v1.json",
    rootNamespace: "Acme.App",
    entryPoint: "src/index.ts",
    sourceRoot: "src",
    outputDirectory: "generated",
    outputName: "Acme.App",
    output: {
      type: "library",
      nativeAot: false,
      generateDocumentation: false,
      includeSymbols: false,
      packable: false,
    },
    references: {
      packages: [
        {
          id: "@acme/lib",
          project: "../lib",
          ...(mode ? { mode } : {}),
        },
      ],
    },
  });
  writeFileSync(
    join(projectRoot, "src", "index.ts"),
    [
      'import { double } from "@acme/lib/index.js";',
      "",
      "export function main(): number {",
      "  return double(21);",
      "}",
      "",
    ].join("\n"),
    "utf-8"
  );

  linkDir(
    join(workspaceRoot, "packages", "lib"),
    join(workspaceRoot, "node_modules/@acme/lib")
  );

  const workspaceConfig = {
    $schema: "https://tsonic.org/schema/workspace/v1.json",
    dotnetVersion: "net10.0",
    surface: "clr",
  };

  return {
    projectRoot,
    config: resolveConfig(
      workspaceConfig,
      {
        rootNamespace: "Acme.App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "Acme.App",
        output: {
          type: "console-app",
          singleFile: false,
          selfContained: false,
        },
        references: {
          packages: [
            {
              id: "@acme/lib",
              project: "../lib",
              ...(mode ? { mode } : {}),
            },
          ],
        },
      },
      {},
      workspaceRoot,
      projectRoot
    ),
  };
};

describe("build command (local package ownership)", function () {
  this.timeout(buildTestTimeoutMs);

  it("keeps local source packages in the generated source closure by default", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-local-package-source-mode-")
    );

    try {
      writeWorkspace(workspaceRoot);
      writeLibraryProject(workspaceRoot);
      const { projectRoot, config } = writeAppProject(workspaceRoot);

      const result = buildCommand(config);
      expect(result.ok).to.equal(true);
      if (!result.ok) {
        throw new Error(result.error);
      }

      expect(
        existsSync(
          join(
            projectRoot,
            "generated",
            "node_modules",
            "@acme",
            "lib",
            "src",
            "index.cs"
          )
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(workspaceRoot, "packages", "lib", "dist", "net10.0", "Acme.Lib.dll")
        )
      ).to.equal(false);

      const csproj = readFileSync(
        join(projectRoot, "generated", "tsonic.csproj"),
        "utf-8"
      );
      expect(csproj).to.not.include('<Reference Include="Acme.Lib">');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("builds local library packages as DLL boundaries when mode is dll", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-local-package-dll-mode-")
    );

    try {
      writeWorkspace(workspaceRoot);
      writeLibraryProject(workspaceRoot);
      const { projectRoot, config } = writeAppProject(workspaceRoot, "dll");

      const result = buildCommand(config);
      expect(result.ok).to.equal(true);
      if (!result.ok) {
        throw new Error(result.error);
      }

      expect(
        existsSync(
          join(workspaceRoot, "packages", "lib", "dist", "net10.0", "Acme.Lib.dll")
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(
            projectRoot,
            "generated",
            "node_modules",
            "@acme",
            "lib",
            "src",
            "index.cs"
          )
        )
      ).to.equal(false);

      const csproj = readFileSync(
        join(projectRoot, "generated", "tsonic.csproj"),
        "utf-8"
      );
      expect(csproj).to.include('<Reference Include="Acme.Lib">');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("does not source-emit transitive packages behind a DLL boundary", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-local-package-dll-transitive-")
    );

    try {
      writeWorkspace(workspaceRoot);
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "dep",
        packageId: "@acme/dep",
        namespace: "Acme.Dep",
        outputName: "Acme.Dep",
        sourceText: [
          "export type Payload = {",
          "  value: string;",
          "};",
          "",
          "export function makePayload(): Payload {",
          '  return { value: "ok" };',
          "}",
          "",
        ].join("\n"),
      });
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "relay",
        packageId: "@acme/relay",
        namespace: "Acme.Relay",
        outputName: "Acme.Relay",
        localPackageReferences: [
          {
            id: "@acme/dep",
            project: "../dep",
            mode: "dll",
          },
        ],
        sourceText: [
          'import { makePayload, type Payload } from "@acme/dep/index.js";',
          "",
          "export function relay(): Payload {",
          "  return makePayload();",
          "}",
          "",
        ].join("\n"),
      });
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "top",
        packageId: "@acme/top",
        namespace: "Acme.Top",
        outputName: "Acme.Top",
        localPackageReferences: [
          {
            id: "@acme/relay",
            project: "../relay",
            mode: "dll",
          },
        ],
        sourceText: [
          'import { relay } from "@acme/relay/index.js";',
          "",
          "export function top(): void {",
          "  relay();",
          "}",
          "",
        ].join("\n"),
      });

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "clr",
      };
      const topProjectRoot = join(workspaceRoot, "packages", "top");
      const result = buildCommand(
        resolveConfig(
          workspaceConfig,
          {
            rootNamespace: "Acme.Top",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Top",
            output: {
              type: "library",
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
            references: {
              packages: [
                {
                  id: "@acme/relay",
                  project: "../relay",
                  mode: "dll",
                },
              ],
            },
          },
          {},
          workspaceRoot,
          topProjectRoot
        )
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        throw new Error(result.error);
      }

      expect(
        existsSync(
          join(workspaceRoot, "packages", "dep", "dist", "net10.0", "Acme.Dep.dll")
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(
            workspaceRoot,
            "packages",
            "relay",
            "dist",
            "net10.0",
            "Acme.Relay.dll"
          )
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(
            topProjectRoot,
            "generated",
            "node_modules",
            "@acme",
            "relay",
            "src",
            "index.cs"
          )
        )
      ).to.equal(false);
      expect(
        existsSync(
          join(
            topProjectRoot,
            "generated",
            "node_modules",
            "@acme",
            "dep",
            "src",
            "index.cs"
          )
        )
      ).to.equal(false);
      const csproj = readFileSync(
        join(topProjectRoot, "generated", "tsonic.csproj"),
        "utf-8"
      );
      expect(csproj).to.include('<Reference Include="Acme.Relay">');
      expect(csproj).to.include('<Reference Include="Acme.Dep">');
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("prunes synthetic anonymous types that belong only to DLL-boundary packages", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-local-package-dll-anon-prune-")
    );

    try {
      writeWorkspace(workspaceRoot);
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "shared",
        packageId: "@acme/shared",
        namespace: "Acme.Shared",
        outputName: "Acme.Shared",
        sourceText: [
          "export class Widget {",
          '  name: string = "widget";',
          "}",
          "",
        ].join("\n"),
      });
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "dep",
        packageId: "@acme/dep",
        namespace: "Acme.Dep",
        outputName: "Acme.Dep",
        sourceText: [
          'import { Widget } from "@acme/shared/index.js";',
          "",
          "const buildPair = (): { left: Widget; right: Widget } => {",
          "  return { left: new Widget(), right: new Widget() };",
          "};",
          "",
          "export function dep(): string {",
          "  const pair = buildPair();",
          "  return `${pair.left.name}:${pair.right.name}`;",
          "}",
          "",
        ].join("\n"),
      });
      writeSourcePackageProject({
        workspaceRoot,
        dirName: "top",
        packageId: "@acme/top",
        namespace: "Acme.Top",
        outputName: "Acme.Top",
        localPackageReferences: [
          {
            id: "@acme/dep",
            project: "../dep",
            mode: "dll",
          },
        ],
        sourceText: [
          'import { dep } from "@acme/dep/index.js";',
          "",
          "export function top(): string {",
          "  return dep();",
          "}",
          "",
        ].join("\n"),
      });

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "clr",
      };
      const topProjectRoot = join(workspaceRoot, "packages", "top");
      const result = buildCommand(
        resolveConfig(
          workspaceConfig,
          {
            rootNamespace: "Acme.Top",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Top",
            output: {
              type: "library",
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
            references: {
              packages: [
                {
                  id: "@acme/dep",
                  project: "../dep",
                  mode: "dll",
                },
              ],
            },
          },
          {},
          workspaceRoot,
          topProjectRoot
        )
      );
      expect(result.ok).to.equal(true);
      if (!result.ok) {
        throw new Error(result.error);
      }

      const anonymousTypesPath = join(
        topProjectRoot,
        "generated",
        "__tsonic",
        "__tsonic_anonymous_types.g.cs"
      );
      if (existsSync(anonymousTypesPath)) {
        const anonymousTypes = readFileSync(anonymousTypesPath, "utf-8");
        expect(anonymousTypes).to.not.include("global::Acme.Shared.Widget left");
        expect(anonymousTypes).to.not.include(
          "global::Acme.Shared.Widget right"
        );
      }
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it("keeps source-emitting reexport target modules outside DLL boundaries", () => {
    const workspaceRoot = mkdtempSync(
      join(tmpdir(), "tsonic-local-package-reexport-closure-")
    );

    try {
      writeWorkspace(workspaceRoot);
      writeLibraryProject(workspaceRoot);
      writeReexportSourcePackageProject({
        workspaceRoot,
        dirName: "reexport",
        packageId: "@acme/reexport",
        namespace: "Acme.Reexport",
        outputName: "Acme.Reexport",
        indexSourceText: [
          'export { makePayload, type Payload } from "./runtime/payload.js";',
          "",
        ].join("\n"),
        runtimeRelativePath: join("runtime", "payload.ts"),
        runtimeSourceText: [
          "export type Payload = {",
          "  value: string;",
          "};",
          "",
          "export function makePayload(): Payload {",
          '  return { value: "ok" };',
          "}",
          "",
        ].join("\n"),
      });

      const projectRoot = join(workspaceRoot, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });

      writeJson(join(projectRoot, "package.json"), {
        name: "@acme/app",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies: {
          "@acme/lib": "0.0.0",
          "@acme/reexport": "0.0.0",
        },
      });
      writeJson(join(projectRoot, "tsonic.json"), {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "Acme.App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "Acme.App",
        output: {
          type: "console-app",
          singleFile: false,
          selfContained: false,
        },
        references: {
          packages: [
            {
              id: "@acme/lib",
              project: "../lib",
              mode: "dll",
            },
          ],
        },
      });
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { double } from "@acme/lib/index.js";',
          'import { makePayload, type Payload } from "@acme/reexport/index.js";',
          "",
          "export function main(): Payload {",
          "  const payload = makePayload();",
          "  double(21);",
          "  return payload;",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      linkDir(
        join(workspaceRoot, "packages", "lib"),
        join(workspaceRoot, "node_modules/@acme/lib")
      );

      const result = buildCommand(
        resolveConfig(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            surface: "clr",
          },
          {
            rootNamespace: "Acme.App",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.App",
            output: {
              type: "console-app",
              singleFile: false,
              selfContained: false,
            },
            references: {
              packages: [
                {
                  id: "@acme/lib",
                  project: "../lib",
                  mode: "dll",
                },
              ],
            },
          },
          {},
          workspaceRoot,
          projectRoot
        )
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) {
        throw new Error(result.error);
      }

      expect(
        existsSync(
          join(
            projectRoot,
            "generated",
            "node_modules",
            "@acme",
            "reexport",
            "src",
            "index.cs"
          )
        )
      ).to.equal(true);
      expect(
        existsSync(
          join(
            projectRoot,
            "generated",
            "node_modules",
            "@acme",
            "reexport",
            "src",
            "runtime",
            "payload.cs"
          )
        )
      ).to.equal(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });
});
