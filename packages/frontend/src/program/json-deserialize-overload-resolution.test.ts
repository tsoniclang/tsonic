import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import type {
  IrFunctionDeclaration,
  IrModule,
  IrReturnStatement,
} from "../ir/types.js";

const writeTestFixture = (
  tempDir: string,
  files: Record<string, string>
): void => {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
};

const installMinimalJsSurface = (projectRoot: string): void => {
  const jsRoot = path.join(projectRoot, "node_modules", "@tsonic", "js");
  fs.mkdirSync(jsRoot, { recursive: true });
  fs.writeFileSync(
    path.join(jsRoot, "package.json"),
    JSON.stringify(
      { name: "@tsonic/js", version: "1.0.0", type: "module" },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(jsRoot, "tsonic.surface.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "@tsonic/js",
        extends: [],
        requiredTypeRoots: ["@tsonic/dotnet"],
        useStandardLib: true,
      },
      null,
      2
    )
  );
};

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined => {
  const normalizedTarget = filePath.replace(/\\/g, "/");
  const relativeTarget = path.basename(normalizedTarget);
  return modules.find((module) => {
    const normalizedModulePath = module.filePath.replace(/\\/g, "/");
    return (
      normalizedModulePath === normalizedTarget ||
      normalizedModulePath === relativeTarget
    );
  });
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("keeps explicit generic CLR member returns on imported overload families", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-json-deserialize-overload-")
    );

    try {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify(
          { name: "app", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      installMinimalJsSurface(tempDir);
      writeTestFixture(tempDir, {
        "src/index.ts": [
          'import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";',
          "",
          "export function parse<T>(text: string): T {",
          "  return JsonSerializer.Deserialize<T>(text)!;",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/package.json": JSON.stringify({
          name: "@tsonic/dotnet",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/dotnet/System.Text.Json.js": "export {};",
        "node_modules/@tsonic/dotnet/System.Text.Json.d.ts": [
          "export interface JsonSerializerOptions$instance {}",
          "export type JsonSerializerOptions = JsonSerializerOptions$instance;",
          "export interface JsonSerializer$instance {}",
          "export declare const JsonSerializer: (abstract new() => JsonSerializer$instance) & {",
          "  Deserialize<TValue>(text: string, options?: JsonSerializerOptions): TValue | undefined;",
          "};",
        ].join("\n"),
        "node_modules/@tsonic/dotnet/System.Text.Json/bindings.json":
          JSON.stringify(
            {
              namespace: "System.Text.Json",
              types: [
                {
                  alias: "JsonSerializer",
                  stableId: "System.Text.Json:System.Text.Json.JsonSerializer",
                  clrName: "System.Text.Json.JsonSerializer",
                  assemblyName: "System.Text.Json",
                  kind: "Class",
                  accessibility: "Public",
                  isAbstract: false,
                  isSealed: true,
                  isStatic: true,
                  arity: 0,
                  methods: [
                    {
                      stableId:
                        "System.Text.Json:System.Text.Json.JsonSerializer::Deserialize(System.String,System.Text.Json.JsonSerializerOptions):TValue",
                      clrName: "Deserialize",
                      canonicalSignature:
                        "(System.String,System.Text.Json.JsonSerializerOptions):TValue",
                      normalizedSignature:
                        "Deserialize|(System.String,System.Text.Json.JsonSerializerOptions):TValue|static=true",
                      arity: 1,
                      parameterCount: 2,
                      isStatic: true,
                      isAbstract: false,
                      isVirtual: false,
                      isOverride: false,
                      isSealed: false,
                      visibility: "Public",
                      declaringClrType: "System.Text.Json.JsonSerializer",
                      declaringAssemblyName: "System.Text.Json",
                      isExtensionMethod: false,
                    },
                  ],
                  properties: [],
                  fields: [],
                  constructors: [],
                },
              ],
            },
            null,
            2
          ),
      });

      const entryPath = path.join(tempDir, "src/index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "App",
        surface: "@tsonic/js",
        verbose: false,
      });

      expect(
        result.ok,
        result.ok
          ? undefined
          : result.error
              .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
              .join("\n")
      ).to.equal(true);
      if (!result.ok) {
        return;
      }

      const entryModule = findModuleByFilePath(result.value.modules, entryPath);
      expect(entryModule).to.not.equal(undefined);
      if (!entryModule) {
        return;
      }

      const parseFn = entryModule.body.find(
        (statement): statement is IrFunctionDeclaration =>
          statement.kind === "functionDeclaration" && statement.name === "parse"
      );
      expect(parseFn).to.not.equal(undefined);
      if (!parseFn) {
        return;
      }

      const returnStmt = parseFn.body.statements.find(
        (statement): statement is IrReturnStatement =>
          statement.kind === "returnStatement"
      );
      const returnExpression = returnStmt?.expression;
      expect(returnExpression).to.not.equal(undefined);
      expect(returnExpression?.inferredType?.kind).to.not.equal("unknownType");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
