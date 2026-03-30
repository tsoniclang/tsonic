import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { buildModuleDependencyGraph } from "./dependency-graph.js";
import type {
  IrArrowFunctionExpression,
  IrCallExpression,
  IrFunctionDeclaration,
  IrFunctionExpression,
  IrModule,
  IrStatement,
} from "../ir/types.js";

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
        requiredTypeRoots: [],
        useStandardLib: true,
      },
      null,
      2
    )
  );
};

const writeFixture = (
  tempDir: string,
  files: Record<string, string>
): void => {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(tempDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
};

const findModuleByFilePath = (
  modules: readonly IrModule[],
  filePath: string
): IrModule | undefined => {
  const normalizedTarget = filePath.replace(/\\/g, "/");
  const suffix = normalizedTarget.split("/").slice(-2).join("/");
  return modules.find((module) => {
    const normalizedModulePath = module.filePath.replace(/\\/g, "/");
    return (
      normalizedModulePath === normalizedTarget ||
      normalizedModulePath.endsWith(`/${suffix}`) ||
      normalizedModulePath === path.basename(filePath)
    );
  });
};

const findRunBody = (
  statements: readonly IrStatement[]
):
  | IrFunctionDeclaration["body"]
  | IrArrowFunctionExpression["body"]
  | IrFunctionExpression["body"]
  | undefined => {
  const direct = statements.find(
    (statement): statement is IrFunctionDeclaration =>
      statement.kind === "functionDeclaration" && statement.name === "run"
  );
  if (direct) {
    return direct.body;
  }

  const variable = statements.find(
    (
      statement
    ): statement is Extract<IrStatement, { kind: "variableDeclaration" }> =>
      statement.kind === "variableDeclaration" &&
      statement.declarations.some(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "run"
      )
  );
  if (!variable) {
    return undefined;
  }

  const initializer = variable.declarations.find(
    (declaration) =>
      declaration.name.kind === "identifierPattern" &&
      declaration.name.name === "run"
  )?.initializer;

  if (
    initializer?.kind === "arrowFunction" ||
    initializer?.kind === "functionExpression"
  ) {
    return initializer.body;
  }

  return undefined;
};

const collectMemberCalls = (
  node: unknown,
  propertyName: string,
  acc: IrCallExpression[]
): void => {
  if (!node || typeof node !== "object") {
    return;
  }

  const candidate = node as {
    readonly kind?: string;
    readonly body?: unknown;
    readonly statements?: readonly unknown[];
    readonly declarations?: readonly unknown[];
    readonly initializer?: unknown;
    readonly expression?: unknown;
    readonly condition?: unknown;
    readonly thenStatement?: unknown;
    readonly elseStatement?: unknown;
    readonly tryBlock?: unknown;
    readonly catchClause?: unknown;
    readonly finallyBlock?: unknown;
    readonly callee?: {
      readonly kind?: string;
      readonly property?: unknown;
    };
    readonly arguments?: readonly unknown[];
  };

  if (
    candidate.kind === "call" &&
    candidate.callee?.kind === "memberAccess" &&
    candidate.callee.property === propertyName
  ) {
    acc.push(candidate as IrCallExpression);
  }

  collectMemberCalls(candidate.body, propertyName, acc);
  collectMemberCalls(candidate.initializer, propertyName, acc);
  collectMemberCalls(candidate.expression, propertyName, acc);
  collectMemberCalls(candidate.condition, propertyName, acc);
  collectMemberCalls(candidate.thenStatement, propertyName, acc);
  collectMemberCalls(candidate.elseStatement, propertyName, acc);
  collectMemberCalls(candidate.tryBlock, propertyName, acc);
  collectMemberCalls(candidate.catchClause, propertyName, acc);
  collectMemberCalls(candidate.finallyBlock, propertyName, acc);

  for (const statement of candidate.statements ?? []) {
    collectMemberCalls(statement, propertyName, acc);
  }
  for (const declaration of candidate.declarations ?? []) {
    collectMemberCalls(declaration, propertyName, acc);
  }
  for (const argument of candidate.arguments ?? []) {
    collectMemberCalls(argument, propertyName, acc);
  }
};

describe("Dependency Graph", function () {
  this.timeout(60_000);

  it("specializes tsbindgen instance receiver calls before resolving returns and parameters", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dbset-instance-")
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
      writeFixture(tempDir, {
        "src/db.ts": [
          'import type { int } from "@tsonic/core/types.js";',
          'import type { DbContext, DbSet_1, EntityEntry_1 } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";',
          "",
          "export interface PostEntity {",
          "  Id: int;",
          "}",
          "",
          "export class BlogDbContext implements DbContext {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbContext!: never;",
          "  posts!: DbSet_1<PostEntity>;",
          '  Remove<TEntity>(entity: TEntity): EntityEntry_1<TEntity> { throw new Error(\"not reached\"); }',
          "}",
        ].join("\n"),
        "src/index.ts": [
          'import type { int } from "@tsonic/core/types.js";',
          'import { BlogDbContext } from "./db.js";',
          "",
          "export function run(postId: int): void {",
          "  const db = new BlogDbContext();",
          "  const post = db.posts.Find(postId);",
          "  if (post !== undefined) {",
          "    db.Remove(post);",
          "  }",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": "export type int = number;\n",
        "node_modules/@tsonic/efcore/package.json": JSON.stringify({
          name: "@tsonic/efcore",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/efcore/Microsoft.EntityFrameworkCore.js":
          "export {};",
        "node_modules/@tsonic/efcore/Microsoft.EntityFrameworkCore.d.ts": [
          "export interface EntityEntry_1$instance<TEntity> {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_ChangeTracking_EntityEntry_1: never;",
          "}",
          "export type EntityEntry_1<TEntity> = EntityEntry_1$instance<TEntity>;",
          "",
          "export interface DbSet_1$instance<TEntity> {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbSet_1: never;",
          "  Find(...keyValues: unknown[]): TEntity | undefined;",
          "}",
          "export type DbSet_1<TEntity> = DbSet_1$instance<TEntity>;",
          "",
          "export interface DbContext$instance {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbContext: never;",
          "  Remove<TEntity>(entity: TEntity): EntityEntry_1<TEntity>;",
          "}",
          "export type DbContext = DbContext$instance;",
        ].join("\n"),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, entryPath);
      expect(module).to.not.equal(undefined);
      if (!module) return;

      const runBody = findRunBody(module.body);
      expect(runBody).to.not.equal(undefined);
      if (!runBody) return;

      const findCalls: IrCallExpression[] = [];
      const removeCalls: IrCallExpression[] = [];
      collectMemberCalls(runBody, "Find", findCalls);
      collectMemberCalls(runBody, "Remove", removeCalls);

      expect(findCalls).to.have.length(1);
      expect(removeCalls).to.have.length(1);

      const [findCall] = findCalls;
      const [removeCall] = removeCalls;

      expect(findCall?.inferredType?.kind).to.not.equal("unknownType");
      if (findCall?.inferredType?.kind === "unionType") {
        expect(findCall.inferredType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "undefined",
        });
        expect(findCall.inferredType.types[1]).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      } else {
        expect(findCall?.inferredType).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      }

      expect(removeCall?.parameterTypes).to.have.length(1);
      if (!removeCall?.parameterTypes) {
        return;
      }
      expect(removeCall.parameterTypes[0]).to.include({
        kind: "referenceType",
        name: "PostEntity",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("specializes bound tsbindgen receiver calls from exact CLR member owners", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dbset-instance-bindings-")
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
      writeFixture(tempDir, {
        "src/db.ts": [
          'import type { int } from "@tsonic/core/types.js";',
          'import type { DbContext, DbSet_1, EntityEntry_1 } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";',
          "",
          "export interface PostEntity {",
          "  Id: int;",
          "}",
          "",
          "export class BlogDbContext implements DbContext {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbContext!: never;",
          "  posts!: DbSet_1<PostEntity>;",
          '  Remove<TEntity>(entity: TEntity): EntityEntry_1<TEntity> { throw new Error(\"not reached\"); }',
          "}",
        ].join("\n"),
        "src/index.ts": [
          'import type { int } from "@tsonic/core/types.js";',
          'import { BlogDbContext } from "./db.js";',
          "",
          "export function run(postId: int): void {",
          "  const db = new BlogDbContext();",
          "  const post = db.posts.Find(postId);",
          "  if (post !== undefined) {",
          "    db.Remove(post);",
          "  }",
          "}",
        ].join("\n"),
        "node_modules/@tsonic/core/package.json": JSON.stringify({
          name: "@tsonic/core",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/core/types.js": "export {};",
        "node_modules/@tsonic/core/types.d.ts": "export type int = number;\n",
        "node_modules/@tsonic/efcore/package.json": JSON.stringify({
          name: "@tsonic/efcore",
          version: "1.0.0",
          type: "module",
        }),
        "node_modules/@tsonic/efcore/Microsoft.EntityFrameworkCore.js":
          "export {};",
        "node_modules/@tsonic/efcore/Microsoft.EntityFrameworkCore.d.ts": [
          "export interface EntityEntry_1$instance<TEntity> {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_ChangeTracking_EntityEntry_1: never;",
          "}",
          "export type EntityEntry_1<TEntity> = EntityEntry_1$instance<TEntity>;",
          "",
          "export interface DbSet_1$instance<TEntity> {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbSet_1: never;",
          "  Find(...keyValues: unknown[]): TEntity | undefined;",
          "}",
          "export type DbSet_1<TEntity> = DbSet_1$instance<TEntity>;",
          "",
          "export interface DbContext$instance {",
          "  readonly __tsonic_type_Microsoft_EntityFrameworkCore_DbContext: never;",
          "  Remove<TEntity>(entity: TEntity): EntityEntry_1<TEntity>;",
          "}",
          "export type DbContext = DbContext$instance;",
        ].join("\n"),
        "node_modules/@tsonic/efcore/Microsoft.EntityFrameworkCore/bindings.json":
          JSON.stringify(
            {
              namespace: "Microsoft.EntityFrameworkCore",
              contributingAssemblies: ["Microsoft.EntityFrameworkCore"],
              types: [
                {
                  stableId:
                    "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbContext",
                  clrName: "Microsoft.EntityFrameworkCore.DbContext",
                  assemblyName: "Microsoft.EntityFrameworkCore",
                  metadataToken: 0,
                  kind: "Class",
                  accessibility: "Public",
                  isAbstract: false,
                  isSealed: false,
                  isStatic: false,
                  arity: 0,
                  methods: [
                    {
                      stableId:
                        "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbContext::Remove(TEntity):EntityEntry_1",
                      clrName: "Remove",
                      metadataToken: 0,
                      canonicalSignature: "(TEntity):EntityEntry_1",
                      normalizedSignature:
                        "Remove|(TEntity):EntityEntry_1|static=false",
                      emitScope: "ClassSurface",
                      provenance: "Original",
                      arity: 1,
                      parameterCount: 1,
                      isStatic: false,
                      isAbstract: false,
                      isVirtual: true,
                      isOverride: false,
                      isSealed: false,
                      visibility: "Public",
                      declaringClrType: "Microsoft.EntityFrameworkCore.DbContext",
                      declaringAssemblyName: "Microsoft.EntityFrameworkCore",
                      isExtensionMethod: false,
                    },
                  ],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
                {
                  stableId:
                    "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbSet`1",
                  clrName: "Microsoft.EntityFrameworkCore.DbSet`1",
                  assemblyName: "Microsoft.EntityFrameworkCore",
                  metadataToken: 0,
                  kind: "Class",
                  accessibility: "Public",
                  isAbstract: false,
                  isSealed: false,
                  isStatic: false,
                  arity: 1,
                  methods: [
                    {
                      stableId:
                        "Microsoft.EntityFrameworkCore:Microsoft.EntityFrameworkCore.DbSet`1::Find(System.Object[]):TEntity",
                      clrName: "Find",
                      metadataToken: 0,
                      canonicalSignature: "(System.Object[]):TEntity",
                      normalizedSignature:
                        "Find|(System.Object[]):TEntity|static=false",
                      emitScope: "ClassSurface",
                      provenance: "Original",
                      arity: 0,
                      parameterCount: 1,
                      isStatic: false,
                      isAbstract: false,
                      isVirtual: true,
                      isOverride: false,
                      isSealed: false,
                      visibility: "Public",
                      declaringClrType:
                        "Microsoft.EntityFrameworkCore.DbSet`1",
                      declaringAssemblyName: "Microsoft.EntityFrameworkCore",
                      isExtensionMethod: false,
                    },
                  ],
                  properties: [],
                  fields: [],
                  events: [],
                  constructors: [],
                },
              ],
            },
            null,
            2
          ),
      });

      const entryPath = path.join(tempDir, "src", "index.ts");
      const result = buildModuleDependencyGraph(entryPath, {
        projectRoot: tempDir,
        sourceRoot: path.join(tempDir, "src"),
        rootNamespace: "TestApp",
        surface: "@tsonic/js",
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const module = findModuleByFilePath(result.value.modules, entryPath);
      expect(module).to.not.equal(undefined);
      if (!module) return;

      const runBody = findRunBody(module.body);
      expect(runBody).to.not.equal(undefined);
      if (!runBody) return;

      const findCalls: IrCallExpression[] = [];
      const removeCalls: IrCallExpression[] = [];
      collectMemberCalls(runBody, "Find", findCalls);
      collectMemberCalls(runBody, "Remove", removeCalls);

      expect(findCalls).to.have.length(1);
      expect(removeCalls).to.have.length(1);

      const [findCall] = findCalls;
      const [removeCall] = removeCalls;

      expect(findCall?.callee.kind).to.equal("memberAccess");
      if (findCall?.callee.kind === "memberAccess") {
        expect(findCall.callee.memberBinding?.type).to.equal(
          "Microsoft.EntityFrameworkCore.DbSet`1"
        );
      }

      expect(findCall?.inferredType?.kind).to.not.equal("unknownType");
      if (findCall?.inferredType?.kind === "unionType") {
        expect(findCall.inferredType.types[0]).to.deep.equal({
          kind: "primitiveType",
          name: "undefined",
        });
        expect(findCall.inferredType.types[1]).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      } else {
        expect(findCall?.inferredType).to.include({
          kind: "referenceType",
          name: "PostEntity",
        });
      }

      expect(removeCall?.parameterTypes).to.have.length(1);
      if (!removeCall?.parameterTypes) {
        return;
      }
      expect(removeCall.parameterTypes[0]).to.include({
        kind: "referenceType",
        name: "PostEntity",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
