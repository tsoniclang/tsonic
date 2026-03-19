import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTestTimeoutMs,
  linkDir,
  repoRoot,
} from "./helpers.js";

describe("build command (library bindings)", function () {
  this.timeout(buildTestTimeoutMs);

  it("preserves Maximus lowered type/value surfaces across dependency bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-maximus-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
            workspaces: ["packages/*"],
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        wsConfigPath,
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "package.json"),
        JSON.stringify(
          {
            name: "@acme/core",
            private: true,
            type: "module",
            exports: {
              "./package.json": "./package.json",
              "./*.js": {
                types: "./dist/tsonic/bindings/*.d.ts",
                default: "./dist/tsonic/bindings/*.js",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            private: true,
            type: "module",
            dependencies: {
              "@acme/core": "workspace:*",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Core",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Core",
            output: {
              type: "library",
              targetFrameworks: ["net10.0"],
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.App",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            references: {
              libraries: [
                "../core/generated/bin/Release/net10.0/Acme.Core.dll",
              ],
            },
            outputDirectory: "generated",
            outputName: "Acme.App",
            output: {
              type: "executable",
              targetFrameworks: ["net10.0"],
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "types.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export type User = { name: string; age: int };`,
          `export type UserFlags = { [K in keyof User]?: boolean };`,
          `export type UserReadonly = Readonly<User>;`,
          `export type UserPartial = Partial<User>;`,
          `export type UserRequired = Required<UserFlags>;`,
          `export type UserPick = Pick<User, "name">;`,
          `export type UserOmit = Omit<User, "age">;`,
          `export type Box<T> = { value: T };`,
          `export type BoxReadonly<T> = Readonly<Box<T>>;`,
          `export type BoxPartial<T> = Partial<Box<T>>;`,
          `export type BoxRequired<T> = Required<BoxPartial<T>>;`,
          `export type Mutable<T> = { -readonly [K in keyof T]: T[K] };`,
          `export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;`,
          `export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : never;`,
          `export type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;`,
          `export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;`,
          `export type AsyncValue<T> = T extends Promise<infer U> ? U : T;`,
          `export type AwaitedScore = Awaited<Promise<int>>;`,
          `export type SuccessResult<T> = Extract<{ ok: true; value: T } | { ok: false; error: string }, { ok: true }>;`,
          `export type FailureResult = Exclude<{ ok: true; value: int } | { ok: false; error: string }, { ok: true; value: int }>;`,
          `export type NonNullName = NonNullable<string | null | undefined>;`,
          `export type ExtractStatus = Extract<"ok" | "err", "ok">;`,
          `export type ExcludeStatus = Exclude<"ok" | "err", "err">;`,
          `export type UserAndMeta = User & { id: string };`,
          `export type PrefixSuffix<T extends unknown[]> = [string, ...T, boolean];`,
          `export type UserTuple = [name: string, age: int];`,
          `export type UserTupleSpread<T extends unknown[]> = [User, ...T, boolean];`,
          `export type EventPayload = { kind: "click"; x: int; y: int } | { kind: "keyup"; key: string };`,
          `export type ClickPayload = Extract<EventPayload, { kind: "click" }>;`,
          `export type ApiUserRoute = "/api/users";`,
          `export type ApiPostRoute = "/api/posts";`,
          `export type RoutePair = [ApiUserRoute, ApiPostRoute];`,
          `export type PairJoin<A, B> = [A, B];`,
          `export type Mapper<T> = (value: T) => T;`,
          `export type MapperParams = Parameters<Mapper<User>>;`,
          `export type MapperResult = ReturnType<Mapper<User>>;`,
          `export type SymbolScores = Record<symbol, int>;`,
          ``,
          `export class UserRecord {`,
          `  constructor(public name: string, public age: int) {}`,
          `}`,
          ``,
          `export type UserRecordCtorArgs = ConstructorParameters<typeof UserRecord>;`,
          `export type UserRecordInstance = InstanceType<typeof UserRecord>;`,
          `export type ConstructorArgs = ConstructorParameters<typeof UserRecord>;`,
          `export type RecordInstance = InstanceType<typeof UserRecord>;`,
          ``,
          `export const id = <T>(value: T): T => value;`,
          ``,
          `export function projectFlags(user: User): UserFlags {`,
          `  return { name: user.name.Length > 0, age: user.age > 0 };`,
          `}`,
          ``,
          `export function lookupScore(scores: SymbolScores, key: symbol): int {`,
          `  return scores[key] ?? 0;`,
          `}`,
          ``,
          `export function invokeMapper<T>(value: T, mapper: Mapper<T>): T {`,
          `  return mapper(value);`,
          `}`,
          ``,
          `export function createBox<T>(value: T): Box<T> {`,
          `  return { value };`,
          `}`,
          ``,
          `export function toRoute(path: "users" | "posts"): ApiUserRoute | ApiPostRoute {`,
          `  return path === "users" ? "/api/users" : "/api/posts";`,
          `}`,
          ``,
          `export function projectEvent(payload: EventPayload): PairJoin<string, EventPayload> {`,
          `  return ["evt", payload];`,
          `}`,
          ``,
          `export function createUserTuple(user: User): UserTuple {`,
          `  return [user.name, user.age];`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "runtime.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import "./side-effect.ts";`,
          ``,
          `export function chainScore(seed: Promise<int>): Promise<int> {`,
          `  return seed`,
          `    .then((value) => value + 1)`,
          `    .catch((_error) => 0)`,
          `    .finally(() => {});`,
          `}`,
          ``,
          `export function loadSideEffects(): void {`,
          `  return;`,
          `}`,
          ``,
          `export function* nextValues(start: int): Generator<int, int, int> {`,
          `  const next = (yield start) + 1;`,
          `  yield next;`,
          `  return next + 1;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "side-effect.ts"),
        [`export const loaded = true;`, ``].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export type {`,
          `  User,`,
          `  UserFlags,`,
          `  UserReadonly,`,
          `  UserPartial,`,
          `  UserRequired,`,
          `  UserPick,`,
          `  UserOmit,`,
          `  UnwrapPromise,`,
          `  NonNullName,`,
          `  ExtractStatus,`,
          `  ExcludeStatus,`,
          `  UserAndMeta,`,
          `  PrefixSuffix,`,
          `  Box,`,
          `  BoxReadonly,`,
          `  Mutable,`,
          `  Head,`,
          `  Tail,`,
          `  Last,`,
          `  AsyncValue,`,
          `  AwaitedScore,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  UserTuple,`,
          `  UserTupleSpread,`,
          `  EventPayload,`,
          `  ClickPayload,`,
          `  ApiUserRoute,`,
          `  ApiPostRoute,`,
          `  RoutePair,`,
          `  PairJoin,`,
          `  Mapper,`,
          `  MapperParams,`,
          `  MapperResult,`,
          `  SymbolScores,`,
          `  UserRecordCtorArgs,`,
          `  UserRecordInstance,`,
          `  ConstructorArgs,`,
          `  RecordInstance,`,
          `} from "./types.ts";`,
          `export {`,
          `  id,`,
          `  UserRecord,`,
          `  projectFlags,`,
          `  lookupScore,`,
          `  invokeMapper,`,
          `  createBox,`,
          `  toRoute,`,
          `  projectEvent,`,
          `  createUserTuple,`,
          `} from "./types.ts";`,
          `export { chainScore, loadSideEffects, nextValues } from "./runtime.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { Console } from "@tsonic/dotnet/System.js";`,
          `import type {`,
          `  User,`,
          `  UserFlags,`,
          `  UserReadonly,`,
          `  UserPartial,`,
          `  UserRequired,`,
          `  UserPick,`,
          `  UserOmit,`,
          `  UnwrapPromise,`,
          `  NonNullName,`,
          `  ExtractStatus,`,
          `  ExcludeStatus,`,
          `  UserAndMeta,`,
          `  PrefixSuffix,`,
          `  Mapper,`,
          `  Box,`,
          `  BoxReadonly,`,
          `  BoxPartial,`,
          `  BoxRequired,`,
          `  Mutable,`,
          `  Head,`,
          `  Tail,`,
          `  Last,`,
          `  AsyncValue,`,
          `  AwaitedScore,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  UserTuple,`,
          `  UserTupleSpread,`,
          `  EventPayload,`,
          `  ClickPayload,`,
          `  ApiUserRoute,`,
          `  ApiPostRoute,`,
          `  RoutePair,`,
          `  PairJoin,`,
          `  UserRecordCtorArgs,`,
          `  UserRecordInstance,`,
          `  ConstructorArgs,`,
          `  RecordInstance,`,
          `} from "@acme/core/Acme.Core.js";`,
          `import {`,
          `  id,`,
          `  UserRecord,`,
          `  projectFlags,`,
          `  invokeMapper,`,
          `  createBox,`,
          `  toRoute,`,
          `  projectEvent,`,
          `  createUserTuple,`,
          `} from "@acme/core/Acme.Core.js";`,
          ``,
          `const copied = id<int>(7);`,
          `const copyAlias = id;`,
          `const copiedAgain = copyAlias<int>(copied);`,
          ``,
          `const ctorArgs: UserRecordCtorArgs = ["Ada", copiedAgain];`,
          `void ctorArgs;`,
          `const user: UserRecordInstance = new UserRecord("Ada", copiedAgain);`,
          `const userView: User = { name: user.name, age: user.age };`,
          `const flags = userView as unknown as UserFlags;`,
          `const score: int = copiedAgain;`,
          `const route = toRoute("users");`,
          `const tupleFromFn = createUserTuple(userView);`,
          `const boxUser = createBox(userView);`,
          ``,
          `type ProbeBox = Box<User>;`,
          `type ProbeBoxReadonly = BoxReadonly<User>;`,
          `type ProbeBoxPartial = BoxPartial<User>;`,
          `type ProbeBoxRequired = BoxRequired<User>;`,
          `type ProbeMutable = Mutable<UserReadonly>;`,
          `type ProbeHead = Head<[int, string]>;`,
          `type ProbeTail = Tail<[string, int, boolean]>;`,
          `type ProbeLast = Last<[string, int, boolean]>;`,
          `type ProbeAsync = AsyncValue<Promise<int>>;`,
          `type ProbeAwaited = AwaitedScore;`,
          `type ProbeSuccess = SuccessResult<int>;`,
          `type ProbeFailure = FailureResult;`,
          `type ProbeTuple = UserTuple;`,
          `type ProbeTupleSpread = UserTupleSpread<[int]>;`,
          `type ProbeEvent = EventPayload;`,
          `type ProbeClick = ClickPayload;`,
          `type ProbeRouteA = ApiUserRoute;`,
          `type ProbeRouteB = ApiPostRoute;`,
          `type ProbeRoutePair = RoutePair;`,
          `type ProbePairJoin = PairJoin<ApiUserRoute, EventPayload>;`,
          `type ProbeCtorArgs = ConstructorArgs;`,
          `type ProbeRecordInstance = RecordInstance;`,
          ``,
          `const mappedAgain: int = copiedAgain + 1;`,
          ``,
          `void user;`,
          `void flags;`,
          `void route;`,
          `void tupleFromFn;`,
          `void boxUser;`,
          `Console.WriteLine(mappedAgain + score);`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );

      const cliPath = join(repoRoot, "packages/cli/dist/index.js");
      const buildCore = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "core",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(buildCore.status, buildCore.stderr || buildCore.stdout).to.equal(
        0
      );

      const buildApp = spawnSync(
        "node",
        [
          cliPath,
          "build",
          "--project",
          "app",
          "--config",
          wsConfigPath,
          "--quiet",
        ],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(buildApp.status, buildApp.stderr || buildApp.stdout).to.equal(0);

      const bindingsDir = join(
        dir,
        "packages",
        "core",
        "dist",
        "tsonic",
        "bindings"
      );
      const rootBindingsPath = join(bindingsDir, "Acme.Core", "bindings.json");
      expect(existsSync(rootBindingsPath)).to.equal(true);
      const rootBindings = JSON.parse(
        readFileSync(rootBindingsPath, "utf-8")
      ) as {
        producer?: { tool?: unknown; mode?: unknown };
        exports?: Record<string, unknown>;
      };
      expect(rootBindings.producer?.tool).to.equal("tsonic");
      expect(rootBindings.producer?.mode).to.equal("aikya-firstparty");
      expect(Object.keys(rootBindings.exports ?? {})).to.include(
        "projectFlags"
      );
      expect(Object.keys(rootBindings.exports ?? {})).to.include("createBox");

      const collectDts = (root: string): string[] => {
        const out: string[] = [];
        for (const entry of readdirSync(root, { withFileTypes: true })) {
          const entryPath = join(root, entry.name);
          if (entry.isDirectory()) {
            out.push(...collectDts(entryPath));
            continue;
          }
          if (entry.isFile() && entry.name.endsWith(".d.ts")) {
            out.push(entryPath);
          }
        }
        return out;
      };
      const allFacadeText = collectDts(bindingsDir)
        .map((path) => readFileSync(path, "utf-8"))
        .join("\n");

      const expectedTypeAliases = [
        "UserFlags",
        "UserReadonly",
        "UserPartial",
        "UserRequired",
        "UserPick",
        "UserOmit",
        "Box",
        "BoxReadonly",
        "BoxPartial",
        "BoxRequired",
        "Mutable",
        "Head",
        "Tail",
        "Last",
        "UnwrapPromise",
        "AsyncValue",
        "AwaitedScore",
        "SuccessResult",
        "FailureResult",
        "NonNullName",
        "ExtractStatus",
        "ExcludeStatus",
        "UserAndMeta",
        "PrefixSuffix",
        "UserTuple",
        "UserTupleSpread",
        "EventPayload",
        "ClickPayload",
        "ApiUserRoute",
        "ApiPostRoute",
        "RoutePair",
        "PairJoin",
        "Mapper",
        "MapperParams",
        "MapperResult",
        "SymbolScores",
        "UserRecordCtorArgs",
        "UserRecordInstance",
        "ConstructorArgs",
        "RecordInstance",
      ];
      for (const alias of expectedTypeAliases) {
        expect(
          allFacadeText,
          `expected generated bindings to contain alias '${alias}'`
        ).to.match(new RegExp(`\\bexport\\s+type\\s+${alias}\\b`));
      }

      const expectedValueExports = [
        "id",
        "UserRecord",
        "projectFlags",
        "lookupScore",
        "invokeMapper",
        "createBox",
        "toRoute",
        "projectEvent",
        "createUserTuple",
        "chainScore",
        "loadSideEffects",
        "nextValues",
      ];
      for (const value of expectedValueExports) {
        expect(
          allFacadeText,
          `expected generated bindings to contain value export '${value}'`
        ).to.match(new RegExp(`\\b${value}\\b`));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
