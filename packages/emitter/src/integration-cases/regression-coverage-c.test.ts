import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("materializes structural object arguments using the callee interface type", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        interface CreateParams {
          isPrivate?: int;
        }

        declare function subscribe(params?: CreateParams): void;

        export function run(inviteOnly: int | undefined): void {
          const createParams: { isPrivate?: int } = { isPrivate: inviteOnly };
          subscribe(createParams);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "subscribe(new CreateParams { isPrivate = createParams.isPrivate });"
      );
      expect(csharp).not.to.include(
        "subscribe(((global::System.Func<CreateParams>)(() =>"
      );
      expect(csharp).not.to.include("subscribe(createParams);");
    });

    it("uses runtime equality for unknown-vs-boolean strict comparisons", () => {
      const source = `
        export function hasSubdomain(body: Record<string, unknown>): boolean {
          return body.allow_subdomains === true;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        'global::System.Object.Equals(body["allow_subdomains"], true)'
      );
      expect(csharp).not.to.include('body["allow_subdomains"] == true');
    });

    it("compares optional runtime-union member reads to literals without Match projections", () => {
      const source = `
        interface CookieOptions {
          sameSite?: string | boolean;
        }

        export function resolveSameSite(options?: CookieOptions): string {
          if (typeof options?.sameSite === "string" && options.sameSite.length > 0) {
            return options.sameSite;
          }

          if (options?.sameSite === true) {
            return "Strict";
          }

          return "None";
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "options?.sameSite is global::Tsonic.Runtime.Union<bool, string> __tsonic_union_compare_1"
      );
      expect(csharp).to.include("__tsonic_union_compare_1.Is1()");
      expect(csharp).to.include("__tsonic_union_compare_1.As1() == true");
      expect(csharp).not.to.include("options?.sameSite.Match(");
    });

    it("aligns typeof guards with emitted overload carrier slots when nested aliases include nullish members", () => {
      const source = `
        declare class Rx {}

        type PathSpec = string | Rx | readonly PathSpec[] | null | undefined;
        type RouteHandler = () => void;

        declare class Router {
          get(path: PathSpec, ...handlers: RouteHandler[]): this;
        }

        export class Application extends Router {
          get(name: string): unknown;
          override get(path: PathSpec, ...handlers: RouteHandler[]): this;
          override get(nameOrPath: string | PathSpec, ...handlers: RouteHandler[]): unknown {
            if (handlers.length === 0 && typeof nameOrPath === "string") {
              return nameOrPath;
            }

            return super.get(nameOrPath as PathSpec, ...handlers);
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "private object? __tsonic_overload_impl_get(global::Tsonic.Runtime.Union<object?[], string, global::Test.Rx> nameOrPath"
      );
      expect(csharp).to.include("nameOrPath.Is2()");
      expect(csharp).not.to.include("nameOrPath.Is3()");
    });

    it("preserves final fallback runtime-union slots after chained typeof guards", () => {
      const csharp = compileToCSharp(`
        type TcpSocketConnectOpts = {
          readonly port: number;
          readonly host?: string;
        };

        declare function connectPath(path: string): string;
        declare function connectPort(port: number, host?: string): string;

        export function connect(
          portOrOptionsOrPath: number | TcpSocketConnectOpts | string
        ): string {
          if (typeof portOrOptionsOrPath === "string") {
            return connectPath(portOrOptionsOrPath);
          }

          if (typeof portOrOptionsOrPath === "number") {
            return connectPort(portOrOptionsOrPath);
          }

          return connectPort(
            portOrOptionsOrPath.port,
            portOrOptionsOrPath.host
          );
        }
      `);

      expect(csharp).to.include("portOrOptionsOrPath.Is2()");
      expect(csharp).to.include("portOrOptionsOrPath.Is1()");
      expect(csharp).to.include(
        "__tsonic_union_member_3 => __tsonic_union_member_3).port"
      );
      expect(csharp).to.include(
        "__tsonic_union_member_3 => __tsonic_union_member_3).host"
      );
      expect(csharp).not.to.include("portOrOptionsOrPath.As2()).port");
      expect(csharp).not.to.include("portOrOptionsOrPath.As2()).host");
    });

    it("materializes structural object arguments for inline object-type parameters", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function createBotDomain(input: { fullName: string; shortName: string; botType?: int }): void;

        export function run(botType: int | undefined): void {
          const input = { fullName: "Bot", shortName: "bot", botType };
          createBotDomain(input);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("createBotDomain(new global::Test.__Anon_");
      expect(csharp).to.include("new global::Test.__Anon_");
      expect(csharp).to.include("fullName = input.fullName");
      expect(csharp).to.include("shortName = input.shortName");
      expect(csharp).to.include("botType = input.botType");
      expect(csharp).not.to.include(
        "createBotDomain(((global::System.Func<global::Test.__Anon_"
      );
      expect(csharp).not.to.include("createBotDomain(input);");
    });

    it("reuses named structural aliases for inline object-type parameters when CLR surfaces already align", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        type CreateInput = { fullName: string; shortName: string; botType?: int };

        declare function createBotDomain(input: { fullName: string; shortName: string; botType?: int }): void;

        export function run(botType: int | undefined): void {
          const input: CreateInput = { fullName: "Bot", shortName: "bot", botType };
          createBotDomain(input);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        'CreateInput__Alias input = new CreateInput__Alias { fullName = "Bot", shortName = "bot", botType = botType };'
      );
      expect(csharp).to.include("createBotDomain(input);");
      expect(csharp).not.to.include("createBotDomain(new global::Test.__Anon_");
    });

    it("materializes structural arrays for inline object-type element parameters", () => {
      const source = `
        type AddItem = { name: string; description?: string };

        declare function bulkUpdate(add?: { name: string; description?: string }[]): void;

        export function run(addRaw: string | undefined): void {
          const addList = addRaw ? JSON.parse(addRaw) as AddItem[] : undefined;
          bulkUpdate(addList);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("global::System.Linq.Enumerable.ToArray");
      expect(csharp).to.include("name =");
      expect(csharp).to.include("description =");
      expect(csharp).not.to.include("bulkUpdate(addList);");
    });

    it("materializes structural dictionary values for inline object-type parameters", () => {
      const source = `
        type ProfileEntry = { value: string };

        declare function updateProfileData(profileData: Record<string, { value: string }>): void;

        export function run(profileData: Record<string, ProfileEntry>): void {
          updateProfileData(profileData);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "new global::System.Collections.Generic.Dictionary"
      );
      expect(csharp).to.include("value =");
      expect(csharp).not.to.include("updateProfileData(profileData);");
    });

    it("materializes imported structural alias locals without re-emitting anonymous object types", () => {
      const csharp = compileToCSharp(`
        type AppContext = {
          readonly options: string;
          readonly config: string;
        };

        export function run(): void {
          const options = "cs";
          const config = "http://localhost:3000";
          const ctx: AppContext = { options, config };
          void ctx;
        }
      `);

      expect(csharp).to.include("class AppContext__Alias");
      expect(csharp).to.match(
        /AppContext__Alias\s+ctx\s*=\s*new\s+AppContext__Alias\s*\{\s*options\s*=\s*options,\s*config\s*=\s*config\s*\}/
      );
      expect(csharp).not.to.match(
        /AppContext__Alias\s+ctx\s*=\s*\(\(global::System\.Func<AppContext__Alias>\)/
      );
      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
      );
    });

    it("reuses structural alias carrier members in typeof checks over boolean unions", () => {
      const csharp = compileToCSharp(`
        import type { int } from "@tsonic/core/types.js";

        type MkdirOptions = {
          readonly recursive?: boolean;
          readonly mode?: int;
        };

        export function isRecursive(options?: boolean | MkdirOptions): boolean {
          if (options === undefined) {
            return false;
          }

          if (typeof options === "boolean") {
            return options;
          }

          return options.recursive === true;
        }
      `);

      expect(csharp).to.include("class MkdirOptions__Alias");
      expect(csharp).to.include("((global::System.Object)(options)) != null");
      expect(csharp).to.include("options.Is1()");
      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
      );
    });

    it("normalizes imported clr constructor values in instanceof checks", () => {
      const csharp = compileToCSharp(`
        import { FileNotFoundException } from "@tsonic/dotnet/System.IO.js";

        export function isMissing(error: unknown): boolean {
          return error instanceof FileNotFoundException;
        }
      `);

      expect(csharp).to.include("is global::System.IO.FileNotFoundException");
      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
      );
    });

    it("await-adapts async overload wrappers before narrowing promise unions", () => {
      const csharp = compileToCSharp(`
        export async function readValue(flag: boolean): Promise<boolean>;
        export async function readValue(flag: boolean, encoding: string): Promise<string>;
        export async function readValue(flag: boolean, encoding?: string): Promise<boolean | string> {
          if (encoding === undefined) {
            return flag;
          }

          return encoding;
        }
      `);

      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task<bool> readValue(bool flag)"
      );
      expect(csharp).to.include(
        "await __tsonic_overload_impl_readValue(flag, default(string))).Match("
      );
      expect(csharp).not.to.include(
        ".Match(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2).Match("
      );
    });

    it("projects awaited array-or-string overload wrappers exactly once", () => {
      const csharp = compileToCSharp(`
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): Promise<byte[]>;
        declare function implText(path: string, encoding: string): Promise<string>;

        export function readFile(path: string): Promise<byte[]>;
        export function readFile(path: string, encoding: string): Promise<string>;
        export async function readFile(
          path: string,
          encoding?: string
        ): Promise<byte[] | string> {
          if (encoding === undefined) {
            return await implBytes(path);
          }

          return await implText(path, encoding);
        }
      `);

      expect(csharp).to.include(
        "return (await __tsonic_overload_impl_readFile(path, default(string))).Match("
      );
      expect(csharp).to.not.include(
        '__tsonic_union_member_2 => throw new global::System.InvalidCastException("Cannot cast runtime union prim:string to arr#0:ref#1:id:System.Private.CoreLib:System.Byte:::tuple::rest:none")).Match('
      );
    });

    it("null-checks optional typeof runtime-union guards before member tests", () => {
      const csharp = compileToCSharp(`
        import type { int } from "@tsonic/core/types.js";

        type MkdirOptions = {
          readonly recursive?: boolean;
          readonly mode?: int;
        };

        export function pickRecursive(options?: boolean | MkdirOptions): boolean {
          const recursive =
            typeof options === "boolean" ? options : options?.recursive ?? false;
          return recursive;
        }
      `);

      expect(csharp).to.include("((global::System.Object)(options)) != null");
      expect(csharp).to.include("options.Is1()");
    });

    it("preserves undefined in typeof complement branches for optional union receivers", () => {
      const csharp = compileToCSharp(`
        type ServerOpts = {
          readonly allowHalfOpen?: boolean;
          readonly pauseOnConnect?: boolean;
        };

        export class ServerLike {
          private readonly _allowHalfOpen: boolean;

          constructor(
            optionsOrListener?: ServerOpts | (() => void)
          ) {
            if (typeof optionsOrListener === "function") {
              this._allowHalfOpen = false;
            } else {
              this._allowHalfOpen = optionsOrListener?.allowHalfOpen ?? false;
            }
          }
        }
      `);

      expect(csharp).to.include(
        "((object)optionsOrListener == null ? default(ServerOpts__Alias) : (optionsOrListener.As2()))?.allowHalfOpen"
      );
      expect(csharp).to.not.include("(optionsOrListener.As2())?.allowHalfOpen");
    });

    it("preserves original runtime union slots across chained typeof object branches", () => {
      const csharp = compileToCSharp(`
        type BindOptions = {
          readonly fd?: int;
          readonly port?: int;
          readonly address?: string;
        };

        export function bindLike(
          portOrCallbackOrOptions?: int | (() => void) | BindOptions
        ): int {
          if (typeof portOrCallbackOrOptions === "function") {
            return 0;
          } else if (
            typeof portOrCallbackOrOptions === "object" &&
            portOrCallbackOrOptions !== null &&
            portOrCallbackOrOptions !== undefined
          ) {
            return portOrCallbackOrOptions.port ?? 0;
          }

          return portOrCallbackOrOptions ?? 0;
        }
      `);

      expect(csharp).to.include("portOrCallbackOrOptions.Is3()");
      expect(csharp).to.not.include("portOrCallbackOrOptions.Is2()");
      expect(csharp).to.not.include("(portOrCallbackOrOptions.As2())");
      expect(csharp).to.not.include(
        "((global::Tsonic.Runtime.Union<int, BindOptions>?)portOrCallbackOrOptions)"
      );
    });

    it("awaits async void overload wrappers without discard locals", () => {
      const csharp = compileToCSharp(`
        declare function implDefault(path: string): Promise<void>;
        declare function implRecursive(path: string, recursive: boolean): Promise<void>;

        export function mkdir(path: string): Promise<void>;
        export function mkdir(path: string, recursive: boolean): Promise<void>;
        export async function mkdir(
          path: string,
          recursive?: boolean
        ): Promise<void> {
          if (recursive === undefined) {
            return await implDefault(path);
          }

          return await implRecursive(path, recursive);
        }
      `);

      expect(csharp).to.include(
        "return __tsonic_overload_impl_mkdir(path, default(bool));"
      );
      expect(csharp).to.not.include("__tsonic_discard");
    });

    it("promotes helper overload methods when promise unions require awaited adaptation", () => {
      const csharp = compileToCSharp(`
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): Promise<byte[]>;
        declare function implText(path: string, encoding: string): Promise<string>;

        export function readFile(path: string): Promise<byte[]>;
        export function readFile(path: string, encoding: string): Promise<string>;
        export async function readFile(
          path: string,
          encoding?: string
        ): Promise<byte[] | string> {
          if (encoding === undefined) {
            return await implBytes(path);
          }

          return await implText(path, encoding);
        }

        export class FsPromises {
          public readFile(path: string): Promise<byte[]>;
          public readFile(path: string, encoding: string): Promise<string>;
          public readFile(
            path: string,
            encoding?: string
          ): Promise<string | byte[]> {
            if (encoding === undefined) {
              return readFile(path);
            }

            return readFile(path, encoding);
          }
        }
      `);

      expect(csharp).to.include(
        "private async global::System.Threading.Tasks.Task<global::Tsonic.Runtime.Union<byte[], string>> __tsonic_overload_impl_readFile"
      );
      expect(csharp).to.include(
        "return global::Tsonic.Runtime.Union<byte[], string>.From1(await test.readFile(path));"
      );
      expect(csharp).to.not.include(
        "(global::System.Threading.Tasks.Task<global::Tsonic.Runtime.Union<byte[], string>>)test.readFile(path)"
      );
    });

    it("narrows sync overload wrappers exactly once for array-or-string unions", () => {
      const csharp = compileToCSharp(`
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): byte[];
        declare function implText(path: string, encoding: string): string;

        export function readFileSync(path: string): byte[];
        export function readFileSync(path: string, encoding: string): string;
        export function readFileSync(
          path: string,
          encoding?: string
        ): byte[] | string {
          if (encoding === undefined) {
            return implBytes(path);
          }

          return implText(path, encoding);
        }

        export class FsModuleNamespace {
          public readFileSync(path: string): byte[];
          public readFileSync(path: string, encoding: string): string;
          public readFileSync(
            path: string,
            encoding?: string
          ): byte[] | string {
            if (encoding === undefined) {
              return readFileSync(path);
            }

            return readFileSync(path, encoding);
          }
        }
      `);

      expect(csharp).to.include(
        "return __tsonic_overload_impl_readFileSync(path, default(string)).Match("
      );
      expect(csharp).to.not.include(
        '__tsonic_union_member_2 => throw new global::System.InvalidCastException("Cannot cast runtime union prim:string to arr#0:ref#1:id:System.Private.CoreLib:System.Byte:::tuple::rest:none")).Match('
      );
      expect(csharp).to.include(
        "return this.__tsonic_overload_impl_readFileSync(path, default(string)).Match("
      );
    });

    it("null-checks optional Array.isArray runtime-union guards before member tests", () => {
      const csharp = compileToCSharp(`
        export function hasArray(values?: string[] | number): boolean {
          return Array.isArray(values);
        }
      `);

      expect(csharp).to.include("((global::System.Object)(values)) != null");
      expect(csharp).to.include("values.Is1()");
    });

    it("preserves ?? fallbacks after JS-surface optional array-wrapper length lowering", () => {
      const source = `
        export function run(values?: string[]): number {
          return values?.length ?? 0;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        rootNamespace: "Test",
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "new global::Tsonic.JSRuntime.JSArray<string>(values).length"
      );
      expect(csharp).to.include("?? 0");
    });

    it("keeps unknown spread-array conditionals on object arrays instead of numeric unions", () => {
      const csharp = compileToCSharp(`
        declare function inspect(value: unknown): string;

        export function format(
          message?: unknown,
          optionalParams: readonly unknown[] = []
        ): string {
          const values =
            message === undefined ? [...optionalParams] : [message, ...optionalParams];
          return values.map((value) => inspect(value)).join(" ");
        }
      `);

      expect(csharp).not.to.include("Union<double[], object?[]>");
      expect(csharp).not.to.include("(double)message");
    });

    it("avoids identity Match projections for identical optional union passthrough calls", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        function normalizeSignal(signal?: int | string): string {
          return signal === undefined ? "SIGTERM" : typeof signal === "string" ? signal : "n";
        }

        export function run(signal?: int | string): string {
          return normalizeSignal(signal);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return normalizeSignal(signal);");
      expect(csharp).not.to.include("signal.Match(");
    });

    it("widens narrowed runtime-subset handlers without re-matching extracted members", () => {
      const csharp = compileToCSharp(`
        type RequestHandler = (request: string) => void;
        type ErrorRequestHandler = (error: unknown, request: string) => void;

        class Router {}

        type MiddlewareLike = RequestHandler | Router;
        type LayerHandler = RequestHandler | ErrorRequestHandler;

        declare function accept(handlers: LayerHandler[]): void;

        export function run(handlers: MiddlewareLike[]): void {
          for (const handler of handlers) {
            if (handler instanceof Router) {
              continue;
            }

            accept([handler]);
          }
        }
      `);

      expect(csharp).to.include("From1((handler.As1()))");
      expect(csharp).not.to.include("(handler.As1()).Match(");
    });

    it("preserves original carrier slot numbering across chained guard refinements", () => {
      const csharp = compileToCSharp(
        `
          type RequestHandler = (value: string) => void;
          type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];

          class Router {}

          declare function accept(value: RequestHandler | Router): void;

          function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {
            return typeof value === "function";
          }

          export function run(handler: MiddlewareLike): void {
            if (Array.isArray(handler)) {
              return;
            }

            if (handler instanceof Router) {
              return;
            }

            if (!isMiddlewareHandler(handler)) {
              throw new Error("bad");
            }

            accept(handler);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "accept(global::Tsonic.Runtime.Union<global::System.Action<string>, Router>.From1((handler.As2())))"
      );
      expect(csharp).not.to.include(
        "accept(global::Tsonic.Runtime.Union<global::System.Action<string>, Router>.From2((handler.As2())))"
      );
    });

    it("invokes narrowed handler assertions without matching extracted delegate members", () => {
      const csharp = compileToCSharp(`
        type RequestHandler = (request: string) => void;
        type ErrorRequestHandler = (error: unknown, request: string) => void;
        type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

        export function run(
          handlers: MiddlewareHandler[],
          currentError?: unknown
        ): void {
          const entry = handlers[0]!;
          if (currentError === undefined) {
            (entry as RequestHandler)("ok");
            return;
          }

          (entry as ErrorRequestHandler)(currentError, "ok");
        }
      `);

      expect(csharp).not.to.include("(entry.As1()).Match(");
      expect(csharp).not.to.include("(entry.As2()).Match(");
    });

    it("preserves runtime carrier slot numbers in typeof string guards over aliased unions", () => {
      const csharp = compileToCSharp(`
        import { FileInfo } from "@tsonic/dotnet/System.IO.js";

        type PathSpec = string | FileInfo | readonly PathSpec[];

        export function read(pathOrName: string | PathSpec): string | undefined {
          if (typeof pathOrName === "string") {
            return pathOrName;
          }

          return undefined;
        }
      `);

      expect(csharp).to.include("pathOrName.Is2()");
      expect(csharp).not.to.include("pathOrName.Is3()");
      expect(csharp).to.include("pathOrName.As2()");
    });

    it("returns narrowed string members from overload implementations with broad return types", () => {
      const csharp = compileToCSharp(`
        import { FileInfo } from "@tsonic/dotnet/System.IO.js";

        type RouteHandler = () => void;

        class Router {
          get(path: PathSpec, ...handlers: RouteHandler[]): this {
            return this;
          }
        }

        type PathSpec = string | FileInfo | readonly PathSpec[];

        class Application extends Router {
          get(name: string): unknown;
          override get(path: PathSpec, ...handlers: RouteHandler[]): this;
          override get(nameOrPath: string | PathSpec, ...handlers: RouteHandler[]): unknown {
            if (handlers.length === 0 && typeof nameOrPath === "string") {
              return nameOrPath;
            }

            return super.get(nameOrPath as PathSpec, ...handlers);
          }
        }
      `);

      expect(csharp).to.include("nameOrPath.Is2()");
      expect(csharp).to.include("nameOrPath.As2()");
      expect(csharp).not.to.include("return nameOrPath;");
    });

    it("erases runtime-union member probes from specialized void overload bodies", () => {
      const csharp = compileToCSharp(`
        export class KeyStore {
          setValue(value: string): void;
          setValue(value: number): void;
          setValue(value: string | number): void {
            if (typeof value === "string") {
              return;
            }

            const stable = value;
            void stable;
          }
        }
      `);

      expect(csharp).to.not.include("publicKey.Is1()");
      expect(csharp).to.not.include("value.Is1()");
      expect(csharp).to.not.include("value.As2()");
    });

    it("lowers Uint8Array array-literal constructors through byte arrays", () => {
      const csharp = compileToCSharp(
        `
          import { Uint8Array } from "@tsonic/js/index.js";

          export function run(): void {
            const bytes = new Uint8Array([1, 2, 3]);
            void bytes;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::Tsonic.JSRuntime.Uint8Array(new byte[] { 1, 2, 3 })"
      );
      expect(csharp).not.to.include(
        "new global::Tsonic.JSRuntime.Uint8Array(new int[] { 1, 2, 3 })"
      );
    });

    it("casts numeric Uint8Array length constructors to int", () => {
      const csharp = compileToCSharp(
        `
          import { Uint8Array } from "@tsonic/js/index.js";

          export function run(start: number, end: number): Uint8Array {
            return new Uint8Array(end - start);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::Tsonic.JSRuntime.Uint8Array((int)(end - start))"
      );
    });

    it("casts Uint8Array element assignments to byte", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";
          import { Uint8Array } from "@tsonic/js/index.js";

          export function run(i: int): void {
            const data = new Uint8Array(16);
            data[i] = 255;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("data[i] = (byte)255;");
    });

    it("casts JS numeric expressions when assigning into int slots", () => {
      const csharp = compileToCSharp(
        `
          import { Math as JSMath } from "@tsonic/js/index.js";
          import type { int } from "@tsonic/core/types.js";

          class CursorPosition {
            public rows: int = 0;
          }

          export function run(totalLength: number): CursorPosition {
            const pos = new CursorPosition();
            pos.rows = JSMath.floor(totalLength / 80);
            return pos;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "pos.rows = (int)global::Tsonic.JSRuntime.Math.floor(totalLength / 80);"
      );
    });

    it("materializes inline object-type elements through generic List<T>.Add", () => {
      const source = `
        declare class List<T> {
          Add(item: T): void;
          ToArray(): T[];
        }

        declare function createDraftsDomain(inputs: { type: string; to: string; topic?: string; content: string }[]): void;

        export function run(): void {
          const inputs = new List<{ type: string; to: string; topic?: string; content: string }>();
          inputs.Add({ type: "stream", to: "general", topic: "t", content: "hi" });
          createDraftsDomain(inputs.ToArray());
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(
        /inputs\.Add\(new .* \{ type = "stream", to = "general", topic = "t", content = "hi" \}\);/
      );
      expect(csharp).not.to.include(
        "inputs.Add(new global::System.Collections.Generic.Dictionary"
      );
    });

    it("materializes inline object-type arrays through generic List<T>.ToArray()", () => {
      const source = `
        declare class List<T> {
          Add(item: T): void;
          ToArray(): T[];
        }

        declare function createDraftsDomain(inputs: { type: string; to: string; topic?: string; content: string }[]): void;

        export function run(drafts: { type: string; to: string; topic?: string; content: string }[]): void {
          const inputs = new List<{ type: string; to: string; topic?: string; content: string }>();
          for (let i = 0; i < drafts.length; i++) {
            const d = drafts[i];
            inputs.Add({ type: d.type, to: d.to, topic: d.topic, content: d.content });
          }
          createDraftsDomain(inputs.ToArray());
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(
        /inputs\.Add\(new .* \{ type = d\.type, to = d\.to, topic = d\.topic, content = d\.content \}\);/
      );
      expect(csharp).to.include("createDraftsDomain(inputs.ToArray());");
    });

    it("reifies structural alias array elements after generic List<T>.ToArray()", () => {
      const source = `
        declare class List<T> {
          Add(item: T): void;
          ToArray(): T[];
        }

        type TopRow = {
          key: string;
          pageviews: number;
        };

        export function run(): number {
          const rows = new List<TopRow>();
          rows.Add({ key: "home", pageviews: 1 });
          const arr = rows.ToArray();
          return arr[0]!.pageviews;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.not.include(
        "ICE: Anonymous object type reached emitter"
      );
      expect(csharp).to.include("rows.ToArray()");
      expect(csharp).to.match(/return .*pageviews;/);
    });

    it("emits empty inline object-type locals with optional properties", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        export function run(name: string | undefined, active: int | undefined): void {
          const updates: { name?: string; active?: int } = {};
          if (name) updates.name = name;
          if (active !== undefined) updates.active = active;
          void updates;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(
        /__Anon_[A-Za-z0-9_]+\s+updates\s*=\s*new\s+global::Test\.__Anon_[A-Za-z0-9_]+\(\);/
      );
      expect(csharp).not.to.include(
        "new global::System.Collections.Generic.Dictionary"
      );
    });
  });
});
