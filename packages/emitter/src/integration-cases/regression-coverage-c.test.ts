import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";
import { normalizeRuntimeUnionCarrierNames } from "../runtime-union-cases/helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("adapts inline structural object arguments to the callee interface type", () => {
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
      expect(csharp).to.match(
        /global::Test\.__Anon_[A-Za-z0-9_]+\s+createParams\s*=\s*new global::Test\.__Anon_[A-Za-z0-9_]+\s*\{\s*isPrivate = inviteOnly\s*\};/
      );
      expect(csharp).to.include(
        "subscribe(new CreateParams { isPrivate = createParams.isPrivate });"
      );
      expect(csharp).not.to.include("CreateParams createParams =");
      expect(csharp).not.to.include("subscribe(createParams);");
      expect(csharp).not.to.include(
        "subscribe(((global::System.Func<CreateParams>)(() =>"
      );
    });

    it("materializes source-package structural local arguments to callee parameter types", () => {
      const packageExports = {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
        "./Jotster.Presence.js": "./src/index.ts",
      };
      const csharp = compileProjectToCSharp(
        {
          "src/handler.ts": `
            import { updatePresenceDomain } from "@fixture/presence/Jotster.Presence.js";

            export function run(status: string, client?: string): string {
              const input = {
                status,
                client,
                pingOnly: false,
                slimPresence: undefined,
                historyLimitDays: undefined,
                lastUpdateId: undefined,
              };

              return updatePresenceDomain(input);
            }
          `,
          "node_modules/@fixture/presence/package.json": JSON.stringify(
            {
              name: "@fixture/presence",
              version: "1.0.0",
              type: "module",
              exports: packageExports,
            },
            null,
            2
          ),
          "node_modules/@fixture/presence/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Presence",
                exports: packageExports,
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/presence/src/index.ts": `
            export { updatePresenceDomain } from "./domain/update-presence-domain.ts";
          `,
          "node_modules/@fixture/presence/src/domain/update-presence-domain.ts": `
            interface UpdatePresenceParams {
              status: string;
              client?: string;
              pingOnly?: boolean;
              slimPresence?: boolean;
              historyLimitDays?: number;
              lastUpdateId?: number;
            }

            export function updatePresenceDomain(params: UpdatePresenceParams): string {
              return params.client ?? params.status;
            }
          `,
        },
        "src/handler.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.match(
        /updatePresenceDomain\(new global::Fixture\.Presence\.domain\.UpdatePresenceParams\s*\{\s*status = input\.status,\s*client = input\.client,\s*pingOnly = input\.pingOnly,\s*slimPresence = input\.slimPresence,\s*historyLimitDays = input\.historyLimitDays,\s*lastUpdateId = input\.lastUpdateId\s*\}\)/
      );
      expect(csharp).not.to.include(
        "(global::Fixture.Presence.domain.UpdatePresenceParams)(object)input"
      );
    });

    it("uses runtime equality for unknown-vs-boolean strict comparisons", () => {
      const source = `
        export function hasSubdomain(body: Record<string, unknown>): boolean {
          return body["allow_subdomains"] === true;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        'global::System.Object.Equals(body["allow_subdomains"], true)'
      );
      expect(csharp).not.to.include('body["allow_subdomains"] == true');
    });

    it("casts unknown record member reads after typeof guards when assigning to nullable concrete slots", () => {
      const source = `

        type JwtPayload = {
          email?: string;
          exp?: number;
        };

        export function read(payloadObject: Record<string, unknown>): JwtPayload {
          let exp: number | undefined = undefined;
          if (typeof payloadObject.exp === "number") {
            exp = payloadObject.exp as number;
          }

          const payload: JwtPayload = {};
          if (typeof payloadObject.email === "string") {
            payload.email = payloadObject.email as string;
          }

          if (exp !== undefined) {
            payload.exp = exp as number;
          }
          return payload;
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.match(/exp\s*=\s*\(double\??\)/);
      expect(csharp).to.match(/payload\.email\s*=\s*\(string\??\)/);
      expect(csharp).not.to.include('exp = payloadObject["exp"];');
      expect(csharp).not.to.include('payload.email = payloadObject["email"];');
    });

    it("rejects broad unknown Array.isArray narrowing before emission", () => {
      const source = `

        declare function parseJsonValueText(value: string): unknown;

        export function countObjects(value: string): number {
          const parsed = parseJsonValueText(value);
          if (!Array.isArray(parsed)) {
            return -1;
          }

          let count = 0;
          for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (item !== null && typeof item === "object" && !Array.isArray(item)) {
              count += 1;
            }
          }
          return count;
        }
      `;

      expect(() =>
        compileToCSharp(source, "/test/test.ts", {
          surface: "@tsonic/js",
        })
      ).to.throw(/Array\.isArray cannot narrow a broad runtime value/);
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

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "options?.sameSite is global::Tsonic.Internal.Union<bool, string> __tsonic_union_compare_1"
      );
      expect(csharp).to.include("__tsonic_union_compare_1.Is1()");
      expect(csharp).to.include("__tsonic_union_compare_1.As1() == true");
      expect(csharp).not.to.include("options?.sameSite.Match");
    });

    it("allocates distinct runtime-union comparison temps for sibling literal checks", () => {
      const csharp = compileToCSharp(`
        interface CookieOptions {
          sameSite?: string | boolean;
        }

        export function classifySameSite(options?: CookieOptions): string {
          if (options?.sameSite === true) {
            return "strict";
          }

          if (options?.sameSite === false) {
            return "lax";
          }

          return "other";
        }
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("__tsonic_union_compare_1");
      expect(csharp).to.include("__tsonic_union_compare_2");
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
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("portOrOptionsOrPath.Is2()");
      expect(csharp).to.include("portOrOptionsOrPath.Is1()");
      expect(csharp).to.include(
        "return connectPort((portOrOptionsOrPath.As3()).port, (portOrOptionsOrPath.As3()).host);"
      );
      expect(csharp).not.to.include("portOrOptionsOrPath.As2()).port");
      expect(csharp).not.to.include("portOrOptionsOrPath.As2()).host");
    });

    it("reuses the original carrier when chained typeof guards narrow an optional union twice", () => {
      const csharp = compileToCSharp(`
        declare function decodeInputBytes(
          data: string | number,
          encoding?: string
        ): void;

        export function create(
          generatorOrEncodingStr?: number | string,
          generatorEncoding?: string
        ): void {
          let generatorBytes = 0;

          if (typeof generatorOrEncodingStr === "number") {
            generatorBytes = generatorOrEncodingStr;
          } else if (typeof generatorOrEncodingStr === "string") {
            decodeInputBytes(
              generatorOrEncodingStr,
              generatorEncoding ?? "base64"
            );
          }
        }
      `);

      expect(csharp).to.include(
        "else if (((global::System.Object)(generatorOrEncodingStr)) != null && generatorOrEncodingStr.Is2())"
      );
      expect(csharp).to.include(
        'decodeInputBytes(generatorOrEncodingStr, generatorEncoding ?? "base64");'
      );
      expect(csharp).not.to.include(
        "default(string) : (generatorOrEncodingStr.As2())).As2()"
      );
    });

    it("keeps sibling typeof fallback checks on the original nullable union carrier", () => {
      const csharp = compileToCSharp(`
        export class LookupOptions {
          family: number | string | null = null;
        }

        export function run(options: LookupOptions | null): number | null {
          if (options === null) {
            return null;
          }

          const family = options.family;
          if (typeof family === "string") {
            if (family === "IPv4") {
              return 4;
            }
            if (family === "IPv6") {
              return 6;
            }
            return null;
          }

          if (typeof family === "number") {
            if (family === 0) {
              return 0;
            }
            if (family === 4) {
              return 4;
            }
            if (family === 6) {
              return 6;
            }
          }

          return null;
        }
      `);

      expect(csharp).to.include(
        "if (((global::System.Object)(family)) != null && family.Is1())"
      );
      expect(csharp).not.to.include(
        'if (global::Tsonic.Runtime.Operators.@typeof((object)family == null ? default(double) : (family.As1())) == "number")'
      );
    });

    it("materializes local structural alias arguments through generic result helpers", () => {
      const csharp = compileToCSharp(`
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Ok<T> | Err<E>;

        declare function ok<T>(data: T): Ok<T>;

        type Payload = {
          foundAnchor: boolean;
          foundNewest: boolean;
          foundOldest: boolean;
        };

        export function run(anchor: string): Result<Payload, string> {
          const foundAnchor = anchor !== "newest" && anchor !== "oldest";
          const foundNewest = anchor === "newest";
          const foundOldest = anchor === "oldest";
          return ok({ foundAnchor, foundNewest, foundOldest });
        }
      `);

      expect(csharp).to.include(
        "Result<Payload__Alias, string>.From2(ok(new Payload__Alias"
      );
      expect(csharp).not.to.include("From2(ok(new global::Test.__Anon_");
    });

    it("preserves instanceof catch narrowing across conditional fallbacks", () => {
      const csharp = compileToCSharp(
        `
          type SendFileCallback = (error: Error | null) => void;

          export function run(callback?: SendFileCallback): string {
            try {
              throw new Error("boom");
            } catch (error) {
              const resolved =
                error instanceof Error ? error : new Error("sendFile failed");
              if (callback) {
                callback(resolved);
                return "callback";
              }
              return resolved.message;
            }
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        'error is global::js.Error ? (global::js.Error)error : new global::js.Error("sendFile failed")'
      );
      expect(csharp).not.to.include(
        'error is global::js.Error ? error : new global::js.Error("sendFile failed")'
      );
      expect(csharp).not.to.include(
        'error is global::js.Error ? (object?)(global::js.Error)error : new global::js.Error("sendFile failed")'
      );
      expect(csharp).to.include("return resolved.message;");
      expect(csharp).not.to.include("((object?)resolved).message");
    });

    it("materializes proof-narrowed conditional identifiers before nullable object slots", () => {
      const csharp = compileToCSharp(
        `
          type Result = { error: Error | undefined };

          export function run(error: object): Result {
            const result: Result = { error: undefined };
            result.error =
              error instanceof Error ? error : new Error("sendFile failed");
            return result;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        'result.error = error is global::js.Error ? (global::js.Error)error : new global::js.Error("sendFile failed");'
      );
      expect(csharp).not.to.include(
        'result.error = error is global::js.Error ? error : new global::js.Error("sendFile failed");'
      );
      expect(csharp).not.to.include(
        'result.error = error is global::js.Error ? (object?)(global::js.Error)error : new global::js.Error("sendFile failed");'
      );
    });

    it("collapses literal-plus-string optional callback aliases before default emission", () => {
      const csharp = compileToCSharp(`
        type NextControl = "route" | "router" | string | null | undefined;
        type NextFunction = (value?: NextControl) => void | Promise<void>;

        export async function run(next: NextFunction): Promise<void> {
          await next(undefined);
        }
      `);

      expect(csharp).to.include("next(default(string?))");
      expect(csharp).not.to.include("next(default(object))");
    });

    it("uses source-backed call surfaces through asinterface structural views", () => {
      const csharp = normalizeRuntimeUnionCarrierNames(
        compileToCSharp(
          `
            import { asinterface } from "@tsonic/core/lang.js";
            import type { ServerResponse } from "@tsonic/nodejs/http.js";

            interface TextEndableResponse {
              end(chunk: string): void;
            }

            interface ResponseHeaderLookup {
              getHeader(name: string): string | readonly string[] | undefined;
            }

            declare function normalizeHeaderValue(
              value: string | readonly string[] | undefined
            ): string | undefined;

            export function run(resp: ServerResponse, text: string): string | undefined {
              asinterface<TextEndableResponse>(resp).end(text);
              return normalizeHeaderValue(
                asinterface<ResponseHeaderLookup>(resp).getHeader("x-test")
              );
            }
          `,
          "/test/test.ts",
          { surface: "@tsonic/nodejs" }
        )
      );

      expect(csharp).to.match(
        /resp\.end\(global::Tsonic\.Internal\.Union<[^>]+>\.From2\(text\)\);/
      );
      expect(csharp).to.include(
        'normalizeHeaderValue(resp.getHeader("x-test") == null ? default(global::Tsonic.Internal.Union<string[], string>?) : global::Tsonic.Internal.Union<string[], string>.From2(resp.getHeader("x-test")));'
      );
      expect(csharp).not.to.include("resp.end(text);");
      expect(csharp).not.to.include(
        'normalizeHeaderValue(resp.getHeader("x-test"));'
      );
    });

    it("preserves method-wide local-name reservations across terminating typeof branches", () => {
      const csharp = compileToCSharp(`
        declare function connectPath(path: string, listener?: () => void): string;
        declare function connectPort(
          port: number,
          host?: string,
          listener?: () => void
        ): string;

        export function connect(
          portOrOptionsOrPath: number | string,
          hostOrListener?: string | (() => void),
          connectionListener?: () => void
        ): string {
          if (typeof portOrOptionsOrPath === "string") {
            const listener =
              typeof hostOrListener === "function" ? hostOrListener : undefined;
            return connectPath(portOrOptionsOrPath, listener);
          }

          if (typeof portOrOptionsOrPath === "number") {
            const host =
              typeof hostOrListener === "string" ? hostOrListener : undefined;
            const listener =
              typeof hostOrListener === "function"
                ? hostOrListener
                : connectionListener;
            return connectPort(portOrOptionsOrPath, host, listener);
          }

          const listener =
            typeof hostOrListener === "function" ? hostOrListener : undefined;
          return connectPath("fallback", listener);
        }
      `);

      expect(csharp).to.include("var listener =");
      expect(csharp).to.include("var listener__1 =");
      expect(csharp).to.include("var listener__2 =");
    });

    it("passes boxed storage values through broad calls after typeof-number narrowing", () => {
      const csharp = compileToCSharp(
        `

          const toNumberArg = (value: unknown): number => {
            return Number(value);
          };

          export function run(args: readonly unknown[]): number {
            const arg0 = args.length > 0 ? args[0] : undefined;
            if (typeof arg0 === "number") {
              return toNumberArg(arg0);
            }

            return 0;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("if ((arg0 is double || arg0 is int))");
      expect(csharp).to.include("return toNumberArg(arg0);");
      expect(csharp).not.to.include("toNumberArg((object?)(double)arg0)");
    });

    it("rejects typeof-number narrowing as proof for int storage", () => {
      expect(() =>
        compileToCSharp(
          `
            import type { int } from "@tsonic/core/types.js";

            export function readInt(value: unknown): int {
              if (typeof value === "number") {
                return value;
              }
              return 0;
            }
          `,
          "/test/test.ts",
          { surface: "@tsonic/js" }
        )
      ).to.throw("Implicit narrowing not allowed");
    });

    it("keeps broad unknown typeof-object guards on the runtime typeof helper instead of union member checks", () => {
      const csharp = compileToCSharp(
        `

          export class Checker {
            static isObject(value: unknown | undefined): boolean {
              if (value === undefined || value === null) {
                return false;
              }

              if (typeof value !== "object") {
                return false;
              }

              return true;
            }
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("value != null");
      expect(csharp).not.to.include("global::Tsonic.Runtime.Operators.@typeof");
      expect(csharp).not.to.include(
        "if (!(((global::System.Object)(value)) != null && (value.Is1() || value.Is2())))"
      );
    });

    it("calls exact external member overloads instead of wrapping object arguments into implementation unions", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { BindOptions, Socket } from "@fixture/net/index.js";',
            "",
            "export function run(socket: Socket): void {",
            "  const options = new BindOptions();",
            "  options.port = 0;",
            '  options.address = "127.0.0.1";',
            "  socket.bind(options);",
            "}",
          ].join("\n"),
          "node_modules/@fixture/net/package.json": JSON.stringify(
            { name: "@fixture/net", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "node_modules/@fixture/net/index.js": [
            "export class BindOptions {}",
            "export class Socket {}",
          ].join("\n"),
          "node_modules/@fixture/net/index.d.ts": [
            "export class BindOptions {",
            "  port?: number;",
            "  fd?: number;",
            "  address?: string;",
            "}",
            "",
            "export class Socket {",
            "  bind(): void;",
            "  bind(port: number, address?: string, callback?: () => void): void;",
            "  bind(port: number, callback: () => void): void;",
            "  bind(callback: () => void): void;",
            "  bind(options: BindOptions, callback?: () => void): void;",
            "}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("socket.bind(options);");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<global::System.Action, double, BindOptions>.From3(options)"
      );
    });

    it("calls exact external delegate overloads instead of the implementation union surface", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { createServer } from "@fixture/tls/index.js";',
            "",
            "export function run(): void {",
            "  createServer((_socket) => {});",
            "}",
          ].join("\n"),
          "node_modules/@fixture/tls/package.json": JSON.stringify(
            { name: "@fixture/tls", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "node_modules/@fixture/tls/index.js": [
            "export function createServer(..._args) {",
            "  return undefined;",
            "}",
          ].join("\n"),
          "node_modules/@fixture/tls/index.d.ts": [
            "export class TLSSocket {}",
            "export class TlsOptions {",
            "  requestCert?: boolean;",
            "}",
            "export function createServer(",
            "  options: TlsOptions,",
            "  secureConnectionListener?: (socket: TLSSocket) => void",
            "): void;",
            "export function createServer(",
            "  secureConnectionListener?: (socket: TLSSocket) => void",
            "): void;",
          ].join("\n"),
        },
        "src/index.ts"
      );

      expect(csharp).to.include("createServer((global::TLSSocket _socket) =>");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<global::System.Action<TLSSocket>, TlsOptions>.From1"
      );
    });

    it("materializes source-package function listeners through the runtime union carrier", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { createServer } from "@fixture/tls/index.js";',
            "",
            "export function run(): void {",
            "  createServer((_socket) => {});",
            "}",
          ].join("\n"),
          "node_modules/@fixture/tls/package.json": JSON.stringify(
            {
              name: "@fixture/tls",
              version: "1.0.0",
              type: "module",
              exports: {
                "./index.js": "./src/index.ts",
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/tls/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["clr"],
              source: {
                namespace: "fixture.tls",
                exports: {
                  "./index.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/tls/src/index.ts": [
            "export class TLSSocket {}",
            "export class TlsOptions {",
            "  requestCert?: boolean;",
            "}",
            "export class TLSServer {}",
            "export const createServer = (",
            "  optionsOrListener?: TlsOptions | ((socket: TLSSocket) => void),",
            "  secureConnectionListener?: (socket: TLSSocket) => void,",
            "): TLSServer => {",
            "  void optionsOrListener;",
            "  void secureConnectionListener;",
            "  return new TLSServer();",
            "};",
          ].join("\n"),
        },
        "src/index.ts"
      );

      expect(csharp).to.include(
        "global::fixture.tls.index.createServer(global::Tsonic.Internal.Union<global::System.Action<global::fixture.tls.TLSSocket>, global::fixture.tls.TlsOptions>.From1((global::fixture.tls.TLSSocket _socket) =>"
      );
      expect(csharp).not.to.include(
        "global::fixture.tls.index.createServer((global::fixture.tls.TLSSocket _socket) =>"
      );
    });

    it("materializes direct constructor lambda arguments through runtime union carriers", () => {
      const csharp = compileToCSharp(`
        class TLSSocket {}
        class TlsOptions {}
        class TLSServer {
          constructor(
            options?: TlsOptions | ((socket: TLSSocket) => void),
            listener?: ((socket: TLSSocket) => void) | null
          ) {}
        }

        export function run(): void {
          void new TLSServer((_socket) => {});
        }
      `);

      expect(csharp).to.match(
        /new TLSServer\(global::Tsonic\.Internal\.Union<global::System\.Action<(?:global::Test\.)?TLSSocket>, (?:global::Test\.)?TlsOptions>\.From1\(\(TLSSocket _socket\) =>/
      );
      expect(csharp).not.to.include("new TLSServer((TLSSocket _socket) =>");
    });

    it("adapts named constructor arguments to inline structural constructor parameter types", () => {
      const csharp = compileToCSharp(`
        class SocketAddressInitOptions {
          address?: string;
          family?: string;
          flowlabel?: number;
          port?: number;
        }

        class SocketAddress {
          constructor(options: {
            address?: string;
            family?: string;
            flowlabel?: number;
            port?: number;
          }) {}
        }

        export function run(): void {
          const options = new SocketAddressInitOptions();
          options.address = "127.0.0.1";
          options.port = 8080;
          void new SocketAddress(options);
        }
      `);

      expect(csharp).to.include("new SocketAddress(new global::Test.__Anon_");
      expect(csharp).to.include("address = options.address");
      expect(csharp).to.include("family = options.family");
      expect(csharp).to.include("flowlabel = options.flowlabel");
      expect(csharp).to.include("port = options.port");
      expect(csharp).to.include('address = "127.0.0.1"');
      expect(csharp).to.include("port = 8080");
      expect(csharp).not.to.include("new SocketAddress(options);");
    });

    it("casts preserved runtime-union carriers for nullish checks after callable branch elimination", () => {
      const csharp = compileToCSharp(`
        class TLSSocket {}
        class TlsOptions {}
        class TLSServer {
          constructor(
            options?: TlsOptions | ((socket: TLSSocket) => void),
            listener?: ((socket: TLSSocket) => void) | null
          ) {}
        }

        export const createServer = (
          optionsOrListener?: TlsOptions | ((socket: TLSSocket) => void),
          secureConnectionListener?: (socket: TLSSocket) => void,
        ): TLSServer => {
          if (typeof optionsOrListener === "function") {
            return new TLSServer(optionsOrListener);
          }
          if (optionsOrListener !== undefined) {
            return new TLSServer(optionsOrListener, secureConnectionListener ?? null);
          }
          return new TLSServer();
        };
      `);

      expect(csharp).to.include(
        "if (((global::System.Object)(optionsOrListener)) != null)"
      );
      expect(csharp).not.to.include("if (optionsOrListener != null)");
    });

    it("uses declared out locals instead of bare discards for non-lvalue out arguments", () => {
      const csharp = compileToCSharp(`
        import type { int, out } from "@tsonic/core/types.js";

        declare class Bytes {}
        declare class Reader {
          consume(bytes: Bytes, read: out<int>): void;
        }

        export function run(reader: Reader, bytes: Bytes): void {
          reader.consume(bytes, 0 as out<int>);
        }
      `);

      expect(csharp).to.match(
        /reader\.consume\(bytes,\s*out var __tsonic_out_discard_\d+\);/
      );
      expect(csharp).not.to.include("reader.consume(bytes, out _);");
      expect(csharp).not.to.include("reader.consume(bytes, (int)0);");
    });

    it("reuses inferred structural locals for inline object-type parameters when CLR surfaces already align", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function createBotDomain(input: { fullName: string; shortName: string; botType?: int }): void;

        export function run(botType: int | undefined): void {
          const input = { fullName: "Bot", shortName: "bot", botType };
          createBotDomain(input);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("new global::Test.__Anon_");
      expect(csharp).to.include("var input = new global::Test.__Anon_");
      expect(csharp).to.include('fullName = "Bot"');
      expect(csharp).to.include('shortName = "bot"');
      expect(csharp).to.include("botType = botType");
      expect(csharp).not.to.include(
        "createBotDomain(((global::System.Func<global::Test.__Anon_"
      );
      expect(csharp).to.include("createBotDomain(input);");
      expect(csharp).not.to.include("createBotDomain(new global::Test.__Anon_");
    });

    it("adapts named structural aliases into compiler-owned carriers for inline object-type parameters", () => {
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
      expect(csharp).to.include("createBotDomain(new global::Test.__Anon_");
      expect(csharp).to.include("fullName = input.fullName");
      expect(csharp).to.include("shortName = input.shortName");
      expect(csharp).to.include("botType = input.botType");
    });

    it("reuses named structural array aliases for inline object-type element parameters when CLR surfaces align", () => {
      const source = `
        type AddItem = { name: string; description?: string };

        declare function bulkUpdate(add?: { name: string; description?: string }[]): void;

        export function run(addRaw: string | undefined): void {
          const addList = addRaw ? JSON.parse(addRaw) as AddItem[] : undefined;
          bulkUpdate(addList);
        }
      `;

      const csharp = compileToCSharp(source, "/test/test.ts", {
        surface: "@tsonic/js",
      });
      expect(csharp).to.include(
        "global::System.Text.Json.JsonSerializer.Deserialize<AddItem__Alias[]>(addRaw)"
      );
      expect(csharp).to.include("bulkUpdate(addList);");
      expect(csharp).not.to.include("bulkUpdate((global::Test.__Anon_");
    });

    it("reuses named structural dictionary value aliases for inline object-type parameters when CLR surfaces align", () => {
      const source = `
        type ProfileEntry = { value: string };

        declare function updateProfileData(profileData: Record<string, { value: string }>): void;

        export function run(profileData: Record<string, ProfileEntry>): void {
          updateProfileData(profileData);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.Dictionary<string, ProfileEntry__Alias> profileData"
      );
      expect(csharp).to.include("updateProfileData(profileData);");
      expect(csharp).not.to.include(
        "new global::System.Collections.Generic.Dictionary"
      );
    });

    it("preserves imported named dictionary value types on indexed object-literal writes", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/profile-types.ts": `
            export interface ProfileDataValueInput {
              value: string;
            }

            export type ProfileDataUpdate = Record<string, ProfileDataValueInput>;
          `,
          "src/index.ts": `
            import type { ProfileDataUpdate } from "./profile-types.js";

            export function run(key: string, rawValue: string): ProfileDataUpdate {
              const result: ProfileDataUpdate = {};
              result[key] = { value: rawValue };
              return result;
            }
          `,
        },
        "src/index.ts"
      );

      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
      );
      expect(csharp).to.match(
        /result\[key\]\s*=\s*new\s+ProfileDataValueInput\s*\{\s*value\s*=\s*rawValue\s*\}/
      );
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

    it("preserves compiler-generated anonymous carriers over unrelated structural globals", () => {
      const csharp = compileToCSharp(`
        declare function deepEqual(left: unknown, right: unknown): void;

        export function run(): void {
          const first = { user: { name: "Alice" } };
          const second = { user: { name: "Alice" } };
          deepEqual(first, second);
        }
      `);

      expect(csharp).to.match(
        /new global::Test\.__Anon_[A-Za-z0-9_]+ \{ user = new global::Test\.__Anon_[A-Za-z0-9_]+ \{ name = "Alice" \} \}/
      );
      expect(csharp).not.to.include(
        'new global::js.RangeError { name = "Alice" }'
      );
    });

    it("lowers anonymous object type arguments retained in constructor source metadata", () => {
      const csharp = compileToCSharp(`
        import type { long } from "@tsonic/core/types.js";
        import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

        export function run(userId: long, email: string): long {
          const targetUsers = new List<{ id: long; email: string }>();
          targetUsers.Add({ id: userId, email });
          const target = targetUsers[0];
          return target.id;
        }
      `);

      expect(csharp).to.match(
        /new global::System\.Collections\.Generic\.List<global::Test\.__Anon_[A-Za-z0-9_]+>\(\)/
      );
      expect(csharp).to.match(
        /targetUsers\.Add\(new global::Test\.__Anon_[A-Za-z0-9_]+ \{ id = userId, email = email \}\);/
      );
      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
      );
    });

    it("resolves emitted structural alias storage names during CLR member materialization", () => {
      const csharp = compileToCSharp(`
        import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

        type NarrowFilter = {
          op: string;
          value: unknown | undefined;
          negated?: boolean;
        };

        declare function getObjectField(value: unknown, key: string): unknown | undefined;

        export function parse(entries: unknown[]): NarrowFilter[] | undefined {
          const filters = new List<NarrowFilter>();
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]!;
            if (Array.isArray(entry)) {
              const tuple = entry as unknown[];
              const filter: NarrowFilter = {
                op: tuple[0] as string,
                value: tuple[1],
              };
              filters.Add(filter);
              continue;
            }

            const filter: NarrowFilter = {
              op: "operator",
              value: getObjectField(entry, "operand"),
              negated: getObjectField(entry, "negated") === true,
            };
            filters.Add(filter);
          }
          return filters.ToArray();
        }
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("class NarrowFilter__Alias");
      expect(csharp).to.include(
        "new global::System.Collections.Generic.List<NarrowFilter__Alias>()"
      );
      expect(csharp).to.include("filters.Add(filter);");
      expect(csharp).to.include("return filters.ToArray();");
      expect(csharp).not.to.include("ICE: Unresolved reference type");
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
      expect(csharp).to.include("((global::System.Object)(options)) == null");
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

    it("directly specializes async promise-return overloads when omitted parameters fold away", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";

        export function readValue(flag: boolean): Promise<boolean>;
        export function readValue(flag: boolean, encoding: string): Promise<string>;
        export async function readValue(_flag: any, _encoding?: any): Promise<any> {
          throw new Error("stub");
        }

        export async function readValue_flag(flag: boolean): Promise<boolean> {
          return flag;
        }

        export async function readValue_encoding(
          flag: boolean,
          encoding: string
        ): Promise<string> {
          void flag;
          return encoding;
        }

        O(readValue_flag).family(readValue);
        O(readValue_encoding).family(readValue);
      `);

      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task<bool> readValue(bool flag)"
      );
      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task<string> readValue(bool flag, string encoding)"
      );
      expect(csharp).to.include("return flag;");
      expect(csharp).to.include("return encoding;");
      expect(csharp).not.to.include("readValue_flag");
      expect(csharp).not.to.include("readValue_encoding");
    });

    it("preserves override on methods generated from overload family bodies", () => {
      const source = `
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { int } from "@tsonic/core/types.js";

        export class DbContext {
          SaveChanges(): int {
            return 0 as int;
          }
        }

        export class WorkspaceDbContext extends DbContext {
          override SaveChanges(): int;
          SaveChanges(_acceptAllChangesOnSuccess?: boolean): int {
            throw new Error("stub");
          }

          SaveChangesDefault(): int {
            return super.SaveChanges();
          }
        }

        O<WorkspaceDbContext>()
          .method((context) => context.SaveChangesDefault)
          .family((context) => context.SaveChanges);
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("public override int SaveChanges()");
      expect(csharp).not.to.include("public new int SaveChanges()");
    });

    it("emits expression-tree object literal bodies as anonymous objects", () => {
      const source = `
        interface Expression_1<TDelegate> {}

        export class EntityTypeBuilder<TEntity> {
          HasKey<TKey>(_keySelector: Expression_1<(row: TEntity) => TKey>): void {}
          HasIndex<TKey>(_indexSelector: Expression_1<(row: TEntity) => TKey>): void {}
        }

        export class AuthProvider {
          WorkspaceId: string = "";
          Id: string = "";
          DisplayName: string = "";
        }

        export function configure(builder: EntityTypeBuilder<AuthProvider>): void {
          builder.HasKey((row: AuthProvider) => ({
            WorkspaceId: row.WorkspaceId,
            Id: row.Id,
          }));

          builder.HasIndex((row: AuthProvider) => ({
            WorkspaceId: row.WorkspaceId,
            DisplayName: row.DisplayName,
          }));
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "builder.HasKey((AuthProvider row) => new { WorkspaceId = row.WorkspaceId, Id = row.Id });"
      );
      expect(csharp).to.include(
        "builder.HasIndex((AuthProvider row) => new { WorkspaceId = row.WorkspaceId, DisplayName = row.DisplayName });"
      );
      expect(csharp).not.to.include("Dictionary<string, object?>");
      expect(csharp).not.to.include(
        "new global::System.Collections.Generic.Dictionary"
      );
    });

    it("keeps explicit nominal casts on direct member access", () => {
      const source = `
        export class Person {
          name: string;

          constructor(name: string) {
            this.name = name;
          }
        }

        export function readName(value: object): string {
          return (value as Person).name;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return ((Person)value).name;");
      expect(csharp).not.to.include("Structural.GetProperty");
    });

    it("directly specializes awaited array-or-string overloads when omitted parameters fold away", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): Promise<byte[]>;
        declare function implText(path: string, encoding: string): Promise<string>;

        export function readFile(path: string): Promise<byte[]>;
        export function readFile(path: string, encoding: string): Promise<string>;
        export async function readFile(_path: any, _encoding?: any): Promise<any> {
          throw new Error("stub");
        }

        export async function readFile_bytes(path: string): Promise<byte[]> {
          return await implBytes(path);
        }

        export async function readFile_text(
          path: string,
          encoding: string
        ): Promise<string> {
          return await implText(path, encoding);
        }

        O(readFile_bytes).family(readFile);
        O(readFile_text).family(readFile);
      `);

      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task<byte[]> readFile(string path)"
      );
      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task<string> readFile(string path, string encoding)"
      );
      expect(csharp).to.include("return await implBytes(path);");
      expect(csharp).to.include("return await implText(path, encoding);");
      expect(csharp).not.to.include("readFile_bytes");
      expect(csharp).not.to.include("readFile_text");
    });

    it("re-lowers refreshed anonymous array element carriers before emission", () => {
      const csharp = compileToCSharp(`
        const buildListenerAttempts = (): { prefixes: string[]; address: string; family: string }[] => {
          return [
            {
              prefixes: ["http://127.0.0.1:8080/"],
              address: "127.0.0.1",
              family: "IPv4",
            },
          ];
        };

        export function readAddress(): string {
          const attempts = buildListenerAttempts();

          for (const attempt of attempts) {
            return attempt.address;
          }

          return "";
        }
      `);

      expect(csharp).to.include("class __Anon_");
      expect(csharp).to.include("foreach");
      expect(csharp).not.to.include(
        "ICE: Anonymous object type reached emitter"
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
          #allowHalfOpen: boolean;

          constructor(
            optionsOrListener?: ServerOpts | (() => void)
          ) {
            if (typeof optionsOrListener === "function") {
              this.#allowHalfOpen = false;
            } else {
              this.#allowHalfOpen = optionsOrListener?.allowHalfOpen ?? false;
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
        import type { int } from "@tsonic/core/types.js";

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
        "((global::Tsonic.Internal.Union<int, BindOptions>?)portOrCallbackOrOptions)"
      );
    });

    it("emits source-owned union aliases with source alias carrier names", () => {
      const csharp = compileToCSharp(`
        class Ok<T> {
          value: T;

          constructor(value: T) {
            this.value = value;
          }
        }

        class Err<E> {
          error: E;

          constructor(error: E) {
            this.error = error;
          }
        }

        type Result<T, E> = Ok<T> | Err<E>;

        export function ok(value: string): Result<string, string> {
          return new Ok(value);
        }
      `);

      expect(csharp).to.include("public sealed class Result<T, E>");
      expect(csharp).to.include("global::Test.Result<");
      expect(csharp).to.include(".From");
      expect(csharp).to.not.include("Tsonic.Internal.Union");
    });

    it("erases broad object source-owned union aliases in emitted signatures", () => {
      const csharp = compileToCSharp(`
        type ConsoleValue = string | number | boolean | object | null | undefined;

        export function log(...data: ConsoleValue[]): void {
        }
      `);

      expect(csharp).to.include("public static void log(params object?[] data)");
      expect(csharp).to.not.include("ConsoleValue");
      expect(csharp).to.not.include("Tsonic.Internal.Union");
    });

    it("preserves scalar typeof branches for broad-object-erased unions", () => {
      const csharp = compileToCSharp(`
        type Value = string | number | boolean | object | null | undefined;

        export function coerce(value?: Value): boolean {
          if (value === undefined || value === null) {
            return false;
          }

          if (typeof value === "boolean") {
            return value;
          }

          if (typeof value === "number") {
            return value !== 0;
          }

          return true;
        }
      `);

      expect(csharp).to.include("if (value is bool)");
      expect(csharp).to.include("if ((value is double || value is int))");
      expect(csharp).to.include("return (double)value != 0");
      expect(csharp).to.not.include("if (false)");
      expect(csharp).to.not.include(
        "global::System.Object.Equals((double)value, 0)"
      );
    });

    it("uses projected runtime-union member types in boolean contexts", () => {
      const csharp = compileToCSharp(`
        type NumberValue = string | number | boolean | null | undefined;

        export function coerce(value?: NumberValue): number {
          if (value === undefined || value === null) {
            return 0;
          }

          if (typeof value === "boolean") {
            return value ? 1 : 0;
          }

          return 1;
        }
      `);

      expect(csharp).to.include("return (double)((value.As1()) ? 1 : 0);");
      expect(csharp).to.not.include("value.As1()) is global::Tsonic.Internal.Union");
    });

    it("directly specializes async void overloads when omitted parameters fold away", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";

        declare function implDefault(path: string): Promise<void>;
        declare function implRecursive(path: string, recursive: boolean): Promise<void>;

        export function mkdir(path: string): Promise<void>;
        export function mkdir(path: string, recursive: boolean): Promise<void>;
        export async function mkdir(_path: any, _recursive?: any): Promise<any> {
          throw new Error("stub");
        }

        export async function mkdir_default(path: string): Promise<void> {
          return await implDefault(path);
        }

        export async function mkdir_recursive(
          path: string,
          recursive: boolean
        ): Promise<void> {
          return await implRecursive(path, recursive);
        }

        O(mkdir_default).family(mkdir);
        O(mkdir_recursive).family(mkdir);
      `);

      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task mkdir(string path)"
      );
      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task mkdir(string path, bool recursive)"
      );
      expect(csharp).to.include("await implDefault(path);");
      expect(csharp).to.include("await implRecursive(path, recursive);");
      expect(csharp).to.not.include("__tsonic_discard");
      expect(csharp).to.not.include("mkdir_default");
      expect(csharp).to.not.include("mkdir_recursive");
    });

    it("reuses named structural option types in directly specialized overloads", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { int } from "@tsonic/core/types.js";

        export class MkdirOptions {
          recursive?: boolean;
          mode?: int;
        }

        declare function implDefault(path: string): Promise<void>;
        declare function implRecursive(path: string, recursive: boolean): Promise<void>;
        declare function implOptions(path: string, options: MkdirOptions): Promise<void>;

        export function mkdir(path: string): Promise<void>;
        export function mkdir(path: string, recursive: boolean): Promise<void>;
        export function mkdir(path: string, options: { recursive?: boolean; mode?: int }): Promise<void>;
        export async function mkdir(_path: any, _options?: any): Promise<any> {
          throw new Error("stub");
        }
        export async function mkdir_default(path: string): Promise<void> {
          return await implDefault(path);
        }
        export async function mkdir_recursive(
          path: string,
          recursive: boolean
        ): Promise<void> {
          return await implRecursive(path, recursive);
        }
        export async function mkdir_options(
          path: string,
          options: MkdirOptions
        ): Promise<void> {
          return await implOptions(path, options);
        }

        O(mkdir_default).family(mkdir);
        O(mkdir_recursive).family(mkdir);
        O(mkdir_options).family(mkdir);
      `);

      expect(csharp).to.include(
        "public static async global::System.Threading.Tasks.Task mkdir(string path, MkdirOptions options)"
      );
      expect(csharp).to.include("await implOptions(path, options);");
      expect(csharp).to.not.include(
        "public static global::System.Threading.Tasks.Task mkdir(string path, global::Test.__Anon_"
      );
      expect(csharp).to.not.include(
        "global::Tsonic.Internal.Union<bool, __Anon_"
      );
    });

    it("adapts named structural instances at structural overload call sites", () => {
      const csharp = compileToCSharp(`
        import type { int } from "@tsonic/core/types.js";

        export class MkdirOptions {
          recursive?: boolean;
          mode?: int;
        }

        declare const fs: {
          mkdirSync(path: string): void;
          mkdirSync(path: string, recursive: boolean): void;
          mkdirSync(path: string, options: { recursive?: boolean; mode?: int }): void;
        };

        export function ensure(dir: string): void {
          const options = new MkdirOptions();
          options.recursive = true;
          fs.mkdirSync(dir, options);
        }
      `);

      expect(csharp).to.include("fs.mkdirSync(dir, new global::Test.__Anon_");
      expect(csharp).to.include("recursive = options.recursive");
      expect(csharp).to.include("mode = options.mode");
      expect(csharp).to.not.include("fs.mkdirSync(dir, options);");
    });

    it("preserves imported named structural instances at structural overload call sites", () => {
      const csharp = compileToCSharp(
        `
          import { fs, MkdirOptions } from "@tsonic/nodejs/fs.js";

          export function ensure(dir: string): void {
            const options = new MkdirOptions();
            options.recursive = true;
            fs.mkdirSync(dir, options);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("fs.mkdirSync(dir, options);");
      expect(csharp).to.not.include("fs.mkdirSync(dir, new global::js.__Anon_");
    });

    it("preserves imported named structural instances at async structural overload call sites", () => {
      const csharp = compileToCSharp(
        `
          import { fs, MkdirOptions } from "@tsonic/nodejs/fs.js";

          export async function ensure(dir: string): Promise<void> {
            const options = new MkdirOptions();
            options.recursive = true;
            await fs.mkdir(dir, options);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("fs.mkdir(dir, options)");
      expect(csharp).to.not.include("fs.mkdir(dir, new global::js.__Anon_");
    });

    it("materializes imported structural object literals at structural overload call sites", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { fs, MkdirOptions } from "@tsonic/nodejs/fs.js";',
            "",
            "export function ensure(dir: string): void {",
            "  const options = new MkdirOptions();",
            "  options.recursive = true;",
            "  fs.mkdirSync(dir, { recursive: options.recursive, mode: options.mode });",
            "}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "fs.mkdirSync(dir, new global::nodejs.MkdirOptions { recursive = options.recursive, mode = options.mode });"
      );
      expect(csharp).to.not.include("fs.mkdirSync(dir, new global::js.__Anon_");
    });

    it("materializes imported structural object literals at async structural overload call sites", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { fs, MkdirOptions } from "@tsonic/nodejs/fs.js";',
            "",
            "export async function ensure(dir: string): Promise<void> {",
            "  const options = new MkdirOptions();",
            "  options.recursive = true;",
            "  await fs.mkdir(dir, { recursive: options.recursive, mode: options.mode });",
            "}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("new global::nodejs.MkdirOptions");
      expect(csharp).to.not.include("new global::js.__Anon_");
    });

    it("emits generic property empty-array initializers using the declared element type", () => {
      const csharp = compileToCSharp(`
        export class Box<T> {
          items: Array<T | null> = [] as Array<T | null>;
        }
      `);

      expect(csharp).to.include(
        "public T?[] items { get; set; } = global::System.Array.Empty<T?>();"
      );
      expect(csharp).not.to.include("Select<double, T?>");
    });

    it("emits generic undefined constructor arguments using the generic default type", () => {
      const csharp = compileToCSharp(`
        export class IntervalIterationResult<T> {
          done: boolean;
          value: T | undefined;

          constructor(done: boolean, value: T | undefined) {
            this.done = done;
            this.value = value;
          }
        }

        export class IntervalAsyncIterator<T> {
          close(): IntervalIterationResult<T> {
            return new IntervalIterationResult(true, undefined);
          }
        }
      `);

      expect(csharp).to.include(
        "new IntervalIterationResult<T>(true, default(T))"
      );
      expect(csharp).not.to.include("default(object)");
    });

    it("directly specializes promise-union overload families across module and class methods", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): Promise<byte[]>;
        declare function implText(path: string, encoding: string): Promise<string>;

        export function readFile(path: string): Promise<byte[]>;
        export function readFile(path: string, encoding: string): Promise<string>;
        export async function readFile(_path: any, _encoding?: any): Promise<any> {
          throw new Error("stub");
        }
        export async function readFile_bytes(path: string): Promise<byte[]> {
          return await implBytes(path);
        }
        export async function readFile_text(
          path: string,
          encoding: string
        ): Promise<string> {
          return await implText(path, encoding);
        }

        O(readFile_bytes).family(readFile);
        O(readFile_text).family(readFile);

        export class FsPromises {
          readFile(path: string): Promise<byte[]>;
          readFile(path: string, encoding: string): Promise<string>;
          readFile(_path: any, _encoding?: any): any {
            throw new Error("stub");
          }
          readFile_bytes(path: string): Promise<byte[]> {
            return readFile(path);
          }
          readFile_text(path: string, encoding: string): Promise<string> {
            return readFile(path, encoding);
          }
        }

        O<FsPromises>().method(x => x.readFile_bytes).family(x => x.readFile);
        O<FsPromises>().method(x => x.readFile_text).family(x => x.readFile);
      `);

      expect(csharp).to.include(
        "public global::System.Threading.Tasks.Task<byte[]> readFile(string path)"
      );
      expect(csharp).to.include(
        "public global::System.Threading.Tasks.Task<string> readFile(string path, string encoding)"
      );
      expect(csharp).to.include("return readFile(path);");
      expect(csharp).to.include("return readFile(path, encoding);");
      expect(csharp).not.to.include("__tsonic_overload_impl_readFile");
      expect(csharp).to.not.include(
        "(global::System.Threading.Tasks.Task<global::Tsonic.Internal.Union<byte[], string>>)test.readFile(path)"
      );
    });

    it("directly specializes sync array-or-string overloads when omitted parameters fold away", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
        import type { byte } from "@tsonic/core/types.js";

        declare function implBytes(path: string): byte[];
        declare function implText(path: string, encoding: string): string;

        export function readFileSync(path: string): byte[];
        export function readFileSync(path: string, encoding: string): string;
        export function readFileSync(_path: any, _encoding?: any): any {
          throw new Error("stub");
        }

        export function readFileSync_bytes(path: string): byte[] {
          return implBytes(path);
        }

        export function readFileSync_text(
          path: string,
          encoding: string
        ): string {
          return implText(path, encoding);
        }

        O(readFileSync_bytes).family(readFileSync);
        O(readFileSync_text).family(readFileSync);

        export class FsModuleNamespace {
          readFileSync(path: string): byte[];
          readFileSync(path: string, encoding: string): string;
          readFileSync(_path: any, _encoding?: any): any {
            throw new Error("stub");
          }

          readFileSync_bytes(path: string): byte[] {
            return readFileSync(path);
          }

          readFileSync_text(path: string, encoding: string): string {
            return readFileSync(path, encoding);
          }
        }

        O<FsModuleNamespace>().method(x => x.readFileSync_bytes).family(
          x => x.readFileSync
        );
        O<FsModuleNamespace>().method(x => x.readFileSync_text).family(
          x => x.readFileSync
        );
      `);

      expect(csharp).to.include(
        "public static byte[] readFileSync(string path)"
      );
      expect(csharp).to.include(
        "public static string readFileSync(string path, string encoding)"
      );
      expect(csharp).to.include("public byte[] readFileSync(string path)");
      expect(csharp).to.include(
        "public string readFileSync(string path, string encoding)"
      );
      expect(csharp).to.include("return implBytes(path);");
      expect(csharp).to.include("return implText(path, encoding);");
      expect(csharp).to.include("return readFileSync(path);");
      expect(csharp).to.include("return readFileSync(path, encoding);");
      expect(csharp).not.to.include("readFileSync_bytes");
      expect(csharp).not.to.include("readFileSync_text");
    });

    it("directly specializes sync structural nominal unions when omitted parameters fold away", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";

        declare class Buffer {
          readonly length: number;
        }

        declare function implBytes(path: string): Buffer;
        declare function implText(path: string, encoding: string): string;

        export function readFileSync(path: string): Buffer;
        export function readFileSync(path: string, encoding: string): string;
        export function readFileSync(_path: any, _encoding?: any): any {
          throw new Error("stub");
        }

        export function readFileSync_buffer(path: string): Buffer {
          return implBytes(path);
        }

        export function readFileSync_text(
          path: string,
          encoding: string
        ): string {
          return implText(path, encoding);
        }

        O(readFileSync_buffer).family(readFileSync);
        O(readFileSync_text).family(readFileSync);
      `);

      expect(csharp).to.include(
        "public static global::Test.Buffer readFileSync(string path)"
      );
      expect(csharp).to.include(
        "public static string readFileSync(string path, string encoding)"
      );
      expect(csharp).to.include("return implBytes(path);");
      expect(csharp).to.include("return implText(path, encoding);");
      expect(csharp).not.to.include("readFileSync_buffer");
      expect(csharp).not.to.include("readFileSync_text");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<string, global::Test.Buffer>"
      );
    });

    it("prefers deterministic numeric overloads for erased number arguments", () => {
      const csharp = compileToCSharp(`
        import type { byte, double, int, long } from "@tsonic/core/types.js";

        declare class Convert {
          static ToInt32(value: byte): int;
          static ToInt32(value: double): int;
          static ToInt64(value: byte): long;
          static ToInt64(value: double): long;
        }

        declare const holder: { readonly TotalMilliseconds: double };

        export function fromMember(): long {
          return Convert.ToInt64(holder.TotalMilliseconds);
        }

        export function fromBinary(month: number): int {
          return Convert.ToInt32(month + 1);
        }

        export function fromExplicit(value: byte): int {
          return Convert.ToInt32(value);
        }
      `);

      expect(csharp).to.include(
        "return global::System.Convert.ToInt64(holder.TotalMilliseconds);"
      );
      expect(csharp).to.include(
        "return global::System.Convert.ToInt32(month + 1);"
      );
      expect(csharp).to.include(
        "return global::System.Convert.ToInt32(value);"
      );
      expect(csharp).not.to.include(
        "return global::System.Convert.ToInt64((byte)holder.TotalMilliseconds);"
      );
      expect(csharp).not.to.include(
        "return global::System.Convert.ToInt32((byte)(month + 1));"
      );
    });

    it("rejects broad JS numbers flowing to imported CLR integral overload parameters", () => {
      expect(() =>
        compileToCSharp(`
        import type { int } from "@tsonic/core/types.js";
        import { Process } from "@tsonic/dotnet/System.Diagnostics.js";

        declare const process: Process;

        class ExecOptions {
          timeout: number = 0;
        }

        export function run(options?: ExecOptions | null): boolean {
          const timeout = options?.timeout ?? 0;
          return process.WaitForExit(timeout);
        }
      `)
      ).to.throw("Implicit narrowing not allowed");
    });

    it("null-checks optional Array.isArray runtime-union guards before member tests", () => {
      const csharp = compileToCSharp(`
        export function hasArray(values?: string[] | number): boolean {
          return Array.isArray(values);
        }
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

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
        "(values == null ? default(int?) : values.Length)"
      );
      expect(csharp).to.include("?? 0");
    });

    it("collapses imported nullish date fallbacks to the concrete receiver type", () => {
      const csharp = compileToCSharp(
        `
          import { statSync } from "@tsonic/nodejs/fs.js";

          class FrontMatter {
            date: Date | undefined = undefined;
          }

          export function render(fm: FrontMatter): string {
            const lastModifiedAt = new Date(statSync("tsonic.workspace.json").mtimeMs);
            const dateUtc = fm.date ?? lastModifiedAt;
            return dateUtc.toISOString();
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("var dateUtc = fm.date ?? lastModifiedAt;");
      expect(csharp).to.include("return dateUtc.toISOString();");
      expect(csharp).to.not.include("dateUtc.As");
    });

    it("keeps constructor-backed nullish fallbacks direct in constructor arguments", () => {
      const csharp = compileToCSharp(`
        class Page {}

        class Box {
          constructor(page: Page) {}
        }

        class Holder {
          page: Page | undefined = undefined;
        }

        export function run(holder: Holder): Box {
          const fallback = new Page();
          const selected = holder.page ?? fallback;
          return new Box(selected);
        }
      `);

      expect(csharp).to.include("var selected = holder.page ?? fallback;");
      expect(csharp).to.include("return new Box(selected);");
      expect(csharp).not.to.include(
        "return new Box(global::Tsonic.Internal.Union<global::Test.Page, global::Test.Page>.From1(selected));"
      );
    });

    it("preserves ?? fallbacks after dictionary safe-access lowering for value types", () => {
      const csharp = compileToCSharp(
        `
          export function run(
            allowedCounts: Record<string, number>,
            name: string,
          ): number {
            const current = allowedCounts[name] ?? 0;
            const nextCount = current + 1;
            allowedCounts[name] = nextCount;
            return nextCount;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "ContainsKey(__tsonic_key) ? __tsonic_dict[__tsonic_key] : default"
      );
      expect(csharp).to.include("?? 0");
    });

    it("keeps local safe-read numerics aligned with their emitted storage", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          class Settings {
            Count: int = 0;
          }

          export function run(
            updates: Record<string, int>,
            keys: string[],
          ): Settings {
            const settings = new Settings();
            for (let i = 0; i < keys.length; i++) {
              const value = updates[keys[i]];
              settings.Count = value;
            }
            return settings;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "ContainsKey(__tsonic_key) ? __tsonic_dict[__tsonic_key] : default"
      );
      expect(csharp).to.include(
        "var value = ((global::System.Func<int>)(() =>"
      );
      expect(csharp).not.to.include("settings.Count = value.Value;");
    });

    it("reuses exact union-returning safe dictionary reads without rematerializing them", () => {
      const csharp = compileToCSharp(
        `
          function normalizeHeaderValue(
            value: string | readonly string[] | undefined,
          ): string | undefined {
            if (value === undefined) {
              return undefined;
            }
            if (typeof value === "string") {
              return value;
            }
            return value.join(", ");
          }

          export function run(
            requestHeaders: Record<string, string | readonly string[] | undefined>,
          ): Record<string, string> {
            const headers: Record<string, string> = {};
            for (const key of Object.keys(requestHeaders)) {
              const headerValue = normalizeHeaderValue(requestHeaders[key]);
              if (headerValue !== undefined) {
                headers[key] = headerValue;
              }
            }
            return headers;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "var headerValue = normalizeHeaderValue(((global::System.Func<global::Tsonic.Internal.Union<string[], string>?>)(() =>"
      );
      expect(csharp).not.to.include(
        "var headerValue = normalizeHeaderValue(((global::System.Object)(((global::System.Object)"
      );
    });

    it("prefers contextual union surfaces for local safe dictionary reads", () => {
      const csharp = compileToCSharp(
        `
          import { asinterface } from "@tsonic/core/lang.js";

          interface RequestWithHeadersLookup {
            headers: Record<string, string | readonly string[] | undefined>;
          }

          function normalizeHeaderValue(
            value: string | readonly string[] | undefined,
          ): string | undefined {
            if (value === undefined) {
              return undefined;
            }
            if (typeof value === "string") {
              return value;
            }
            return value.join(", ");
          }

          export function run(request: unknown): Record<string, string> {
            const headers: Record<string, string> = {};
            const requestHeaders = asinterface<RequestWithHeadersLookup>(request).headers;
            for (const key of Object.keys(requestHeaders)) {
              const headerValue = normalizeHeaderValue(requestHeaders[key]);
              if (headerValue !== undefined) {
                headers[key] = headerValue;
              }
            }
            return headers;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "var headerValue = normalizeHeaderValue(((global::System.Func<global::Tsonic.Internal.Union<string[], string>?>)(() =>"
      );
      expect(csharp).not.to.include("((global::System.Func<string?>)(() =>");
      expect(csharp).not.to.include(
        "var headerValue = normalizeHeaderValue(((global::System.Object)(((global::System.Object)"
      );
    });

    it("keeps source-package adapted dictionary locals on union safe-read surfaces", () => {
      const csharp = compileProjectToCSharp(
        {
          "package.json": JSON.stringify(
            { name: "emitter-test-project", version: "1.0.0", type: "module" },
            null,
            2
          ),
          "src/index.ts": [
            'import { asinterface } from "@tsonic/core/lang.js";',
            'import type { IncomingMessage } from "@fixture/http/index.js";',
            "",
            "interface RequestWithHeadersLookup {",
            "  headers: Record<string, string | readonly string[] | undefined>;",
            "}",
            "",
            "function normalizeHeaderValue(",
            "  value: string | readonly string[] | undefined,",
            "): string | undefined {",
            "  if (value === undefined) {",
            "    return undefined;",
            "  }",
            '  if (typeof value === "string") {',
            "    return value;",
            "  }",
            '  return value.join(", ");',
            "}",
            "",
            "export function run(request: IncomingMessage): Record<string, string> {",
            "  const headers: Record<string, string> = {};",
            "  const requestHeaders = asinterface<RequestWithHeadersLookup>(request).headers;",
            "  for (const key of Object.keys(requestHeaders)) {",
            "    const headerValue = normalizeHeaderValue(requestHeaders[key]);",
            "    if (headerValue !== undefined) {",
            "      headers[key] = headerValue;",
            "    }",
            "  }",
            "  return headers;",
            "}",
          ].join("\n"),
          "node_modules/@fixture/http/package.json": JSON.stringify(
            {
              name: "@fixture/http",
              version: "1.0.0",
              type: "module",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/http/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Http",
                exports: {
                  ".": "./src/index.ts",
                  "./index.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/http/src/index.ts": [
            "export class IncomingMessage {",
            "  headers: Record<string, string> = {};",
            "}",
          ].join("\n"),
        },
        "src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "var requestHeaders = global::System.Linq.Enumerable.ToDictionary(request.headers, kvp => kvp.Key, kvp => global::Tsonic.Internal.Union"
      );
      expect(csharp).to.include(
        "var headerValue = normalizeHeaderValue(((global::System.Func<global::Tsonic.Internal.Union"
      );
      expect(csharp).not.to.include("((global::System.Func<string?>)(() =>");
    });

    it("wraps int-valued returns into JS-number union members", () => {
      const csharp = compileToCSharp(
        [
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class ParsedRangeResult {}",
          "",
          "export function run(",
          "  shouldReturnCode: boolean,",
          "  code: int,",
          "): ParsedRangeResult | number {",
          "  if (shouldReturnCode) {",
          "    return code;",
          "  }",
          "",
          "  return new ParsedRangeResult();",
          "}",
        ].join("\n"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "public static global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult> run"
      );
      expect(csharp).to.include(
        "return global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult>.From1((double)code);"
      );
      expect(csharp).not.to.include("return code;");
    });

    it("wraps int literals into JS-number union members", () => {
      const csharp = compileToCSharp(
        [
          "class ParsedRangeResult {}",
          "",
          "export function run(",
          "  shouldReturnCode: boolean,",
          "): ParsedRangeResult | number {",
          "  if (shouldReturnCode) {",
          "    return -2;",
          "  }",
          "",
          "  return new ParsedRangeResult();",
          "}",
        ].join("\n"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "public static global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult> run"
      );
      expect(csharp).to.include(
        "return global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult>.From1(-2);"
      );
      expect(csharp).not.to.include("return -2;");
    });

    it("keeps value-type union arms from matching structural object arms", () => {
      const csharp = compileToCSharp(
        [
          "class ParsedByteRange {",
          "  start: number;",
          "  end: number;",
          "",
          "  constructor(start: number, end: number) {",
          "    this.start = start;",
          "    this.end = end;",
          "  }",
          "}",
          "",
          "class ParsedRangeResult {",
          "  type: string;",
          "  ranges: ParsedByteRange[];",
          "",
          "  constructor(type: string, ranges: ParsedByteRange[]) {",
          "    this.type = type;",
          "    this.ranges = ranges;",
          "  }",
          "}",
          "",
          "export function range(",
          "  header: string | undefined,",
          "  size: number,",
          "): ParsedRangeResult | number {",
          "  if (!header) {",
          "    return -2;",
          "  }",
          "",
          "  if (size <= 0) {",
          "    return -1;",
          "  }",
          "",
          '  return new ParsedRangeResult("bytes", []);',
          "}",
        ].join("\n"),
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "public static global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult> range"
      );
      expect(csharp).to.include(
        "return global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult>.From1(-2);"
      );
      expect(csharp).to.include(
        "return global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult>.From1(-1);"
      );
      const rangeMethodStart = csharp.indexOf(
        "public static global::Tsonic.Internal.Union<double, global::Test.ParsedRangeResult> range"
      );
      const rangeMethodEnd = csharp.indexOf("\n        }\n", rangeMethodStart);
      const rangeMethod = csharp.slice(rangeMethodStart, rangeMethodEnd);

      expect(rangeMethod).not.to.include("return -2;");
      expect(rangeMethod).not.to.include("return -1;");
    });

    it("passes CLR ref-like generic locals without object bridge casts", () => {
      const csharp = compileToCSharp(
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Span } from "@tsonic/dotnet/System.js";',
          "",
          "function processInChunks(span: Span<int>, chunkSize: int): void {",
          "  const chunk = span.Slice(0, chunkSize);",
          "}",
          "",
          "export function run(numbers: int[], dest: int[]): void {",
          "  const span = new Span<int>(numbers);",
          "  processInChunks(span, 3);",
          "  const destSpan = new Span<int>(dest);",
          "  span.CopyTo(destSpan);",
          "}",
        ].join("\n"),
        "/test/App.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("processInChunks(span, 3);");
      expect(csharp).to.include("span.CopyTo(destSpan);");
      expect(csharp).not.to.include("(object)span");
      expect(csharp).not.to.include("(object)destSpan");
    });
    it("keeps unknown spread-array conditionals on object arrays instead of numeric unions", () => {
      const csharp = compileToCSharp(
        `
        declare function inspect(value: unknown): string;

        export function format(
          message?: unknown,
          optionalParams: readonly unknown[] = []
        ): string {
          const values =
            message === undefined ? [...optionalParams] : [message, ...optionalParams];
          return values.map((value) => inspect(value)).join(" ");
        }
      `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).not.to.include("Union<double[], object?[]>");
      expect(csharp).not.to.include("(double)message");
      expect(csharp).not.to.include('.toArray().join(" ")');
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
      expect(csharp).not.to.include("signal.Match");
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
      expect(csharp).not.to.include("(handler.As1()).Match");
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
        "accept(global::Tsonic.Internal.Union<global::System.Action<string>, global::Test.Router>.From1((handler.As2())));"
      );
      expect(csharp).not.to.include(
        "accept(global::Tsonic.Internal.Union<global::System.Action<string>, global::Test.Router>.From2((handler.As2())))"
      );
    });

    it("reuses narrowed recursive array carriers for explicit assertions inside Array.isArray branches", () => {
      const csharp = compileToCSharp(
        `
          type RequestHandler = (value: string) => void;
          type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];
          type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];

          class Router {}

          export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {
            const result: (RequestHandler | Router)[] = [];

            const append = (handler: MiddlewareLike): void => {
              if (Array.isArray(handler)) {
                const items = handler as readonly MiddlewareLike[];
                for (let index = 0; index < items.length; index += 1) {
                  append(items[index]!);
                }
                return;
              }

              result.push(handler);
            };

            for (const entry of entries) {
              append(entry);
            }

            return result;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "global::Test.MiddlewareLike[] items = (handler.As1());"
      );
      expect(csharp).not.to.include("handler.Match<object?[]>");
      expect(csharp).not.to.include(".Match<object[]>(");
    });

    it("wraps recursive middleware rest arrays through nested alias-owned union arms", () => {
      const csharp = compileToCSharp(
        `
          type NextControl = "route" | "router" | string | null | undefined;
          type NextFunction = (value?: NextControl) => void | Promise<void>;
          interface Request { path: string; }
          interface Response { send(text: string): void; }
          interface RequestHandler {
            (req: Request, res: Response, next: NextFunction): void | Promise<void>;
          }
          type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];
          type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];

          class Router {
            use(...handlers: readonly MiddlewareLike[]): this {
              return this;
            }
          }

          class Application extends Router {
            mount(path: string, ...handlers: readonly MiddlewareLike[]): this {
              const state = { path, handlers, owner: this };
              this.use(handlers);
              return state.owner;
            }
          }

          export function main(): Application {
            const app = new Application();
            const handler: RequestHandler = async (_req, _res, next) => {
              await next("route");
            };
            return app.mount("/", [handler]);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'return app.mount("/", global::Test.MiddlewareLike.From1(new global::Test.MiddlewareLike[] { global::Test.MiddlewareLike.From2(global::Test.MiddlewareParam.From2(handler)) }));'
      );
      expect(csharp).not.to.include(
        "global::Test.MiddlewareLike.From3(handler)"
      );
    });

    it("packs rest arrays for local function values inferred from call results", () => {
      const csharp = compileToCSharp(`
        type DebugLogFunction = (message: string, ...args: unknown[]) => void;

        declare function debuglog(section: string): DebugLogFunction;
        declare function deprecate(
          fn: (...args: unknown[]) => unknown,
          message: string
        ): (...args: unknown[]) => unknown;

        export function run(): void {
          const debug = debuglog("test");
          debug("test message");
          debug("test message with args: {0}", 42);

          const wrapped = deprecate(() => 42, "deprecated");
          wrapped();
        }
      `);

      expect(csharp).to.match(
        /debug\("test message", (?:new object\?\[0\]|new object\?\[] \{\s*\})\);/
      );
      expect(csharp).to.match(
        /debug\("test message with args: \{0\}", new object\?\[] \{[\s\S]*42[\s\S]*\}\);/
      );
      expect(csharp).to.match(
        /wrapped\((?:new object\?\[0\]|new object\?\[] \{\s*\})\);/
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

      expect(csharp).to.include("entry.Match");
      expect(csharp).not.to.include("(entry.As1()).Match");
      expect(csharp).not.to.include("(entry.As2()).Match");
      expect(csharp).not.to.include(
        "((global::System.Func<string, object?>)entry)"
      );
      expect(csharp).not.to.include(
        "((global::System.Func<object?, string, object?>)entry)"
      );
    });

    it("invokes predicate-fallthrough callable subsets through their projected member slot", () => {
      const csharp = compileToCSharp(`
        type Request = { readonly path: string };
        type Response = { send(text: string): void };
        type NextControl = "route" | "router" | string | null | undefined;
        type NextFunction = (value?: NextControl) => void | Promise<void>;
        type RequestHandler = (
          request: Request,
          response: Response,
          next: NextFunction
        ) => unknown | Promise<unknown>;
        type ErrorRequestHandler = (
          error: unknown,
          request: Request,
          response: Response,
          next: NextFunction
        ) => unknown | Promise<unknown>;
        type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

        declare function isMiddlewareHandler(value: unknown): value is MiddlewareHandler;
        declare function isErrorHandler(
          value: MiddlewareHandler,
          treatAsError: boolean
        ): value is ErrorRequestHandler;

        export async function run(
          handlers: unknown[],
          request: Request,
          response: Response,
          currentError: unknown
        ): Promise<void> {
          let error = currentError;
          const next = async (_value?: NextControl): Promise<void> => {};

          for (const handler of handlers) {
            if (!isMiddlewareHandler(handler)) {
              continue;
            }

            if (error === undefined) {
              if (isErrorHandler(handler, false)) {
                continue;
              }
              await handler(request, response, next);
            } else {
              if (!isErrorHandler(handler, true)) {
                continue;
              }
              await handler(error, request, response, next);
            }
          }
        }
      `);

      expect(csharp).to.include("isErrorHandler(");
      expect(csharp).to.include(
        "MiddlewareHandler From1(global::System.Func<Request__Alias, Response__Alias"
      );
      expect(csharp).to.include(
        "MiddlewareHandler From2(global::System.Func<object?, Request__Alias, Response__Alias"
      );
      expect(csharp).to.match(
        /\.As1\(\)\)\(request, response, next\)\.Match(?:<[^\n]+>)?\(/
      );
      expect(csharp).to.match(
        /\.As2\(\)\)\(error, request, response, next\)\.Match(?:<[^\n]+>)?\(/
      );
      expect(csharp).not.to.include("handler.Is2()");
    });

    it("passes callable and nominal source-union members directly into broad unknown guard predicates", () => {
      const csharp = compileToCSharp(`
        class Router {}

        type PathSpec = string | RegExp | readonly PathSpec[];
        type RequestHandler = (request: string) => void;

        declare function isPathSpec(value: unknown): value is PathSpec;

        export function run(first: PathSpec | RequestHandler | Router): boolean {
          return isPathSpec(first);
        }
      `);

      expect(csharp).to.include("first.Match<object>(");
      expect(csharp.split(".Match<object>(").length - 1).to.equal(2);
      expect(csharp).not.to.include("new global::System.InvalidCastException");
    });

    it("narrows predicate-guarded source unions before exact branch-local call arguments", () => {
      const csharp = compileToCSharp(`
        class Router {}

        type PathSpec = string | RegExp | readonly PathSpec[];
        type RequestHandler = (request: string) => void;
        type MiddlewareLike = RequestHandler | Router;

        declare function isPathSpec(value: unknown): value is PathSpec;
        declare function addMiddlewareLayer(path: PathSpec, handlers: readonly MiddlewareLike[]): void;
        declare function useRootMiddleware(first: MiddlewareLike, rest: readonly MiddlewareLike[]): void;

        export function run(first: PathSpec | MiddlewareLike, rest: readonly MiddlewareLike[]): void {
          if (isPathSpec(first)) {
            addMiddlewareLayer(first, rest);
            return;
          }

          useRootMiddleware(first, rest);
        }
      `);

      expect(csharp).to.include("if (isPathSpec(first.Match<object>(");
      expect(csharp).to.include("addMiddlewareLayer((first.As1()), rest);");
      expect(csharp).to.include("useRootMiddleware((first.As2()), rest);");
      expect(csharp).not.to.include("addMiddlewareLayer(first, rest);");
      expect(csharp).not.to.include("useRootMiddleware(first, rest);");
    });

    it("keeps broad unknown call arguments on their storage carrier after typeof narrowing", () => {
      const csharp = compileToCSharp(`
        declare function toNumericValue(value: unknown): number;

        export function run(value?: unknown): number {
          if (value === undefined || value === null) {
            return 0;
          }

          if (typeof value === "boolean") {
            return value ? 1 : 0;
          }

          if (typeof value === "string") {
            return value.length;
          }

          return toNumericValue(value);
        }
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("return toNumericValue(value);");
      expect(csharp).not.to.include("toNumericValue(value.Match<object?>");
    });

    it("uses runtime equality for unannotated broad assertion locals", () => {
      const csharp = compileToCSharp(
        `

          export function run<T>(left: T, right: T): boolean {
            const leftValue = left as unknown | undefined;
            const rightValue = right as unknown | undefined;
            return leftValue === rightValue;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "return global::System.Object.Equals(leftValue, rightValue);"
      );
      expect(csharp).not.to.include("return leftValue == rightValue;");
    });

    it("rejects concrete array assertions after broad Array.isArray guards", () => {
      expect(() =>
        compileToCSharp(
          `

            export function run(value: unknown): string[] | undefined {
              if (Array.isArray(value)) {
                const list = value as string[];
                list.push("x");
                return list;
              }

              return undefined;
            }
          `,
          "/test/test.ts",
          { surface: "@tsonic/js" }
        )
      ).to.throw(/Array\.isArray cannot narrow a broad runtime value/);
    });

    it("casts concrete union Array.isArray-narrowed storage directly for concrete array assertions", () => {
      const csharp = compileToCSharp(
        `

          export function run(value: string | string[]): string[] | undefined {
            if (Array.isArray(value)) {
              const list = value as string[];
              list.push("x");
              return list;
            }

            return undefined;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("string[] list = (value.As1());");
      expect(csharp).not.to.include("(global::js.Array)value");
      expect(csharp).not.to.match(
        /global::System\.Linq\.Enumerable\.Select<object\?, string>\(\(global::js\.Array\)value/
      );
    });

    it("keeps recursive Array.isArray fallthrough guards on the original runtime carrier", () => {
      const csharp = compileToCSharp(`
        import { FileInfo } from "@tsonic/dotnet/System.IO.js";

        type PathSpec = string | FileInfo | readonly PathSpec[] | null | undefined;

        export function matchesPathSpec(
          pathSpec: PathSpec,
          requestPath: string
        ): boolean {
          if (pathSpec == null) {
            return true;
          }

          if (typeof pathSpec === "string") {
            return pathSpec.length >= 0 && requestPath.length >= 0;
          }

          if (pathSpec instanceof FileInfo) {
            return requestPath.length >= 0;
          }

          if (Array.isArray(pathSpec)) {
            for (let index = 0; index < pathSpec.length; index += 1) {
              if (matchesPathSpec(pathSpec[index]!, requestPath)) {
                return true;
              }
            }

            return false;
          }

          return false;
        }
      `, "/test/test.ts", {
        surface: "@tsonic/js",
      });

      expect(csharp).to.include("pathSpec.Is1()");
      expect(csharp).not.to.include("(pathSpec.As1()).Is1()");
      expect(csharp).not.to.include("((pathSpec.As1()).As1())[index]");
      expect(csharp).to.include(
        "for (int index = 0; index < (pathSpec.As1()).Length; index += 1)"
      );
      expect(csharp).to.include(
        "if (matchesPathSpec((pathSpec.As1())[index], requestPath))"
      );
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

      expect(csharp).to.include("pathOrName.Is1()");
      expect(csharp).not.to.include("pathOrName.Is3()");
      expect(csharp).to.include("pathOrName.As1()");
    });

    it("keeps js Date nullish constructor fallbacks direct in constructor arguments", () => {
      const csharp = compileToCSharp(
        `
          class Holder {
            date: Date | undefined;

            constructor(date?: Date) {
              this.date = date;
            }
          }

          class Box {
            value: Date;

            constructor(value: Date) {
              this.value = value;
            }
          }

          export function wrap(holder: Holder): Box {
            const fallback = new Date(0);
            const selected = holder.date ?? fallback;
            return new Box(selected);
          }
        `,
        "/test/src/index.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "var fallback = new global::js.Date(0);"
      );
      expect(csharp).to.include("var selected = holder.date ?? fallback;");
      expect(csharp).to.include("return new Box(selected);");
      expect(csharp).not.to.include("Union2_");
      expect(csharp).not.to.include(".From1(selected)");
    });

    it("returns narrowed string members from overload implementations with broad return types", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";
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
          override get(_nameOrPath: any, ..._handlers: any[]): any {
            throw new Error("stub");
          }

          get_name(name: string): unknown {
            return name;
          }

          get_path(path: PathSpec, ...handlers: RouteHandler[]): this {
            return super.get(path, ...handlers);
          }
        }

        O<Application>().method(x => x.get_name).family(x => x.get);
        O<Application>().method(x => x.get_path).family(x => x.get);
      `);

      expect(csharp).to.include("public new object? get(string name)");
      expect(csharp).to.include("return name;");
      expect(csharp).to.not.include("name.Is");
      expect(csharp).not.to.include("get_name");
      expect(csharp).not.to.include("get_path");
    });

    it("erases runtime-union member probes from specialized void overload bodies", () => {
      const csharp = compileToCSharp(`
        import { overloads as O } from "@tsonic/core/lang.js";

        export class KeyStore {
          setValue(value: string): void;
          setValue(value: number): void;
          setValue(_value: any): any {
            throw new Error("stub");
          }

          setValue_string(value: string): void {
            void value;
          }

          setValue_number(value: number): void {
            const stable = value;
            void stable;
          }
        }

        O<KeyStore>().method(x => x.setValue_string).family(x => x.setValue);
        O<KeyStore>().method(x => x.setValue_number).family(x => x.setValue);
      `);

      expect(csharp).to.not.include("publicKey.Is1()");
      expect(csharp).to.not.include("value.Is1()");
      expect(csharp).to.not.include("value.As2()");
      expect(csharp).to.not.include("setValue_string");
      expect(csharp).to.not.include("setValue_number");
    });

    it("lowers Uint8Array array-literal constructors through byte arrays", () => {
      const csharp = compileToCSharp(
        `
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
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From2(global::js.TypedArrayInput<byte>.From1(new byte[] { 1, 2, 3 })))"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array(new int[] { 1, 2, 3 })"
      );
    });

    it("rewraps identifier typed-array constructor arguments through the selected source-backed surface arm", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/typed-array-core.ts": `
            export type TypedArrayInput<TElement extends number> =
              | readonly TElement[]
              | Iterable<number>;

            export type TypedArrayConstructorInput<TElement extends number> =
              | number
              | TypedArrayInput<TElement>;

            export class Uint16Array {
              constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
                void lengthOrValues;
              }
            }
          `,
          "src/index.ts": `
            import { Uint16Array } from "./typed-array-core.js";

            export function run(values: number[]): Uint16Array {
              return new Uint16Array(values);
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        },
        {
          sourceRootRelativePath: "src",
          rootNamespace: "Test",
        }
      );

      expect(csharp).to.include("new global::Test.Uint16Array(");
      expect(csharp).to.include("global::js.TypedArrayConstructorInput");
      expect(csharp).to.include(".From2(global::js.TypedArrayInput");
      expect(csharp).to.include(".From1(");
      expect(csharp).not.to.include(
        "new global::Test.Uint16Array((global::js.TypedArrayConstructorInput"
      );
    });

    it("rewraps null-guarded member-access typed-array constructor arguments through the selected source-backed surface arm", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/typed-array-core.ts": `
            export type TypedArrayInput<TElement extends number> =
              | readonly TElement[]
              | Iterable<number>;

            export type TypedArrayConstructorInput<TElement extends number> =
              | number
              | TypedArrayInput<TElement>;

            export class Uint8Array {
              constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
                void lengthOrValues;
              }
            }
          `,
          "src/index.ts": `
            import type { byte } from "@tsonic/core/types.js";
            import { Uint8Array } from "./typed-array-core.js";

            class Parameters {
              Modulus: byte[] | null = null;
            }

            export function run(parameters: Parameters): Uint8Array {
              if (parameters.Modulus === null || parameters.Modulus === undefined) {
                throw new Error("missing");
              }

              return new Uint8Array(parameters.Modulus);
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        },
        {
          sourceRootRelativePath: "src",
          rootNamespace: "Test",
        }
      );

      expect(csharp).to.include("new global::Test.Uint8Array(");
      expect(csharp).to.include(
        ".From2(global::js.TypedArrayInput<byte>.From1(parameters.Modulus))"
      );
      expect(csharp).not.to.include(
        "new global::Test.Uint8Array((global::js.TypedArrayConstructorInput"
      );
    });

    it("rewraps imported source-package typed-array constructor arguments through nested alias arms", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/index.ts": `
            import type { byte } from "@tsonic/core/types.js";
            import { Uint8Array } from "@tsonic/js/index.js";

            class Parameters {
              Modulus: byte[] | null = null;
            }

            export function run(parameters: Parameters): Uint8Array {
              if (parameters.Modulus === null || parameters.Modulus === undefined) {
                throw new Error("missing");
              }

              return new Uint8Array(parameters.Modulus);
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("new global::js.Uint8Array(");
      expect(csharp).to.include(
        ".From2(global::js.TypedArrayInput<byte>.From1(parameters.Modulus))"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array((global::js.TypedArrayConstructorInput"
      );
    });

    it("materializes source-owned alias carriers before passing them to inline union base constructors", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/typed-array-core.ts": `
            import type { int } from "@tsonic/core/types.js";

            export type TypedArrayInput<TElement extends number> =
              | readonly TElement[]
              | Iterable<number>;

            export type TypedArrayConstructorInput<TElement extends number> =
              | int
              | TypedArrayInput<TElement>;

            export class TypedArrayBase<TElement extends number> {
              constructor(lengthOrValues: int | TypedArrayInput<TElement>) {
                void lengthOrValues;
              }
            }

            export class Uint8Array extends TypedArrayBase<number> {
              constructor(lengthOrValues: TypedArrayConstructorInput<number>) {
                super(lengthOrValues);
              }
            }
          `,
          "src/index.ts": `
            import { Uint8Array } from "./typed-array-core.js";

            export function run(length: number): Uint8Array {
              return new Uint8Array(length);
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        },
        {
          sourceRootRelativePath: "src",
          rootNamespace: "Test",
        }
      );

      expect(csharp).to.include(
        ": base(lengthOrValues.Match<global::Tsonic.Internal.Union"
      );
      expect(csharp).to.include(".From1(__tsonic_union_member_1)");
      expect(csharp).to.include(".From2(__tsonic_union_member_2)");
      expect(csharp).not.to.include("lengthOrValues.Match<object>");
      expect(csharp).not.to.include(
        "Unreachable runtime union reification path"
      );
    });

    it("lowers Uint8Array.set array literals through byte arrays", () => {
      const csharp = compileToCSharp(
        `
          export function run(): void {
            const copied = new Uint8Array(4);
            copied.set([4, 5], 1);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("copied.set(new byte[] { 4, 5 }, 1);");
      expect(csharp).not.to.include("copied.set(new int[] { 4, 5 }, 1);");
    });

    it("preserves narrowed runtime-union members when coercing Uint8Array byte elements", () => {
      const csharp = compileToCSharp(
        `
          import type { byte } from "@tsonic/core/types.js";

          export function create(
            generatorOrEncoding: byte | Uint8Array | string
          ): Uint8Array {
            if (typeof generatorOrEncoding === "number") {
              return new Uint8Array([generatorOrEncoding]);
            }

            return new Uint8Array([2]);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From2(global::js.TypedArrayInput<byte>.From1(new byte[] { (generatorOrEncoding.As3()) })))"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array(new byte[] { (byte)generatorOrEncoding })"
      );
    });

    it("rewraps plain string call arguments through runtime-union surfaces", () => {
      const csharp = normalizeRuntimeUnionCarrierNames(
        compileToCSharp(
          `
            declare class Buffer {
              public static from(
                value: number[] | Uint8Array | string,
                encodingOrOffset?: number | string,
              ): Buffer;
            }

            declare function toUint8Array(value: Buffer): Uint8Array;

            export function run(rawText: string): Uint8Array {
              return toUint8Array(Buffer.from(rawText, "utf-8"));
            }
          `,
          "/test/test.ts",
          {
            surface: "@tsonic/js",
          }
        )
      );

      expect(csharp).to.include(
        'Buffer.from(global::Tsonic.Internal.Union<double[], global::js.Uint8Array, string>.From3(rawText), global::Tsonic.Internal.Union<double, string>.From2("utf-8"))'
      );
      expect(csharp).not.to.include(
        'Buffer.from(rawText, global::Tsonic.Internal.Union<double, string>.From2("utf-8"))'
      );
    });

    it("projects typeof-excluded call arguments onto the surviving runtime-union subset", () => {
      const csharp = normalizeRuntimeUnionCarrierNames(
        compileProjectToCSharp(
          {
            "src/index.ts": `
              import { Uint8Array } from "@fixture/js/index.js";

              export class Buffer {
                static fromString(_value: string, _encoding?: string): Buffer {
                  return new Buffer();
                }

                static fromNonString(_value: number[] | Buffer | Uint8Array): Buffer {
                  return new Buffer();
                }

                static from(
                  value: string | number[] | Buffer | Uint8Array,
                  encodingOrOffset?: string | number,
                ): Buffer {
                  if (typeof value === "string") {
                    return Buffer.fromString(
                      value,
                      typeof encodingOrOffset === "string" ? encodingOrOffset : "utf8",
                    );
                  }

                  return Buffer.fromNonString(value);
                }
              }
            `,
            "node_modules/@fixture/js/package.json": JSON.stringify(
              { name: "@fixture/js", version: "1.0.0", type: "module" },
              null,
              2
            ),
            "node_modules/@fixture/js/tsonic.package.json": JSON.stringify(
              {
                schemaVersion: 1,
                kind: "tsonic-source-package",
                surfaces: ["@tsonic/js"],
                source: {
                  namespace: "fixturejs",
                  exports: {
                    "./index.js": "./src/index.ts",
                  },
                },
              },
              null,
              2
            ),
            "node_modules/@fixture/js/src/index.ts": `
              export class Uint8Array {}
            `,
          },
          "src/index.ts",
          { surface: "@tsonic/js" }
        )
      );

      expect(csharp).to.include(
        "return Buffer.fromNonString(value.Match<global::Tsonic.Internal.Union<double[], global::fixturejs.Uint8Array, global::Test.Buffer>>("
      );
      expect(csharp).not.to.include("return Buffer.fromNonString(value);");
      expect(csharp).not.to.include(
        "return Buffer.fromNonString(global::Tsonic.Internal.Union<double[], global::Test.Buffer, global::fixturejs.Uint8Array, string>"
      );
    });

    it("preserves narrowed runtime-union members in typed byte array literals", () => {
      const csharp = compileToCSharp(
        `
          import type { byte } from "@tsonic/core/types.js";

          declare function takesBytes(values: byte[]): void;

          export function create(
            generatorOrEncoding: byte | Uint8Array | string
          ): void {
            if (typeof generatorOrEncoding === "number") {
              takesBytes([generatorOrEncoding]);
            }
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "takesBytes(new byte[] { (generatorOrEncoding.As3()) })"
      );
      expect(csharp).not.to.include(
        "takesBytes(new byte[] { (byte)generatorOrEncoding })"
      );
    });

    it("preserves explicit numeric assertion targets in arithmetic operands", () => {
      const csharp = compileToCSharp(
        `
          import type { int, long } from "@tsonic/core/types.js";

          export function run(x: int): long {
            return (x as long) * 2000000000;
          }
        `
      );

      expect(csharp).to.include("(long)x * 2000000000");
      expect(csharp).not.to.include("(int)(long)x");
    });

    it("does not unbox nullable numeric arguments with the same CLR carrier", () => {
      const csharp = compileToCSharp(
        `
          import type { long } from "@tsonic/core/types.js";

          interface Box {
            value?: long;
          }

          export function take(value: long | undefined | null): long {
            return value ?? (0 as long);
          }

          export function run(box: Box): long {
            return take(box.value);
          }
        `
      );

      expect(csharp).to.include("take(box.value)");
      expect(csharp).not.to.include("take((long)box.value)");
    });

    it("converts concrete integral storage to JS number without object boxing", () => {
      const csharp = compileToCSharp(
        `
          import type { long } from "@tsonic/core/types.js";

          export function take(value: number): number {
            return value;
          }

          export function run(userId: long): number {
            return take(userId);
          }
        `
      );

      expect(csharp).to.include("return take((double)userId);");
      expect(csharp).not.to.include("(double)(object)userId");
    });

    it("emits shadowed instanceof receivers from actual local storage", () => {
      const csharp = compileToCSharp(
        `
          class BoolValue {
            value: boolean;

            constructor(value: boolean) {
              this.value = value;
            }
          }

          export function run(): void {
            const shadow = 42;
            {
              const shadow = new BoolValue(false);
              if (shadow instanceof BoolValue) {
                void shadow.value;
              }
            }
            void shadow;
          }
        `
      );

      expect(csharp).to.match(/if \(shadow__1 is BoolValue shadow__is_\d+\)/);
      expect(csharp).not.to.include("(int)(object)shadow__1 is BoolValue");
    });

    it("keeps exact-int Uint8Array length constructors on the numeric arm", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          export function run(start: int, end: int): Uint8Array {
            return new Uint8Array(end - start);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1(end - start))"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array((int)global::js.TypedArrayConstructorInput"
      );
    });

    it("does not recast materialized typed-array constructor length unions", () => {
      const csharp = compileToCSharp(
        `
          export function run(): Uint8Array {
            return new Uint8Array(8);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "return new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1(8));"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array((int)global::js.TypedArrayConstructorInput"
      );
    });

    it("keeps asserted int Uint8Array length constructors on the numeric arm", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          export function run(): Uint8Array {
            return new Uint8Array(0 as int);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "return new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1(0));"
      );
      expect(csharp).not.to.include(
        "From2((global::js.TypedArrayInput<TElement>)"
      );
      expect(csharp).not.to.include("TypedArrayInput<byte>)0");
    });

    it("keeps conditional Uint8Array length constructors on the numeric arm", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          export function run(totalLength: int): Uint8Array {
            return new Uint8Array(totalLength === 0 ? 1 : totalLength);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "return new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1(totalLength == 0 ? 1 : totalLength));"
      );
      expect(csharp).not.to.include(
        "return new global::js.Uint8Array(totalLength == 0 ? global::js.TypedArrayConstructorInput<byte>.From2("
      );
    });

    it("keeps narrowed Uint8Array length access as a direct member read", () => {
      const csharp = compileToCSharp(
        `
          export function run(chunk: string | Uint8Array): number {
            if (chunk instanceof Uint8Array) {
              return chunk.length;
            }

            return 0;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("chunk__is_1.length");
      expect(csharp).not.to.include(
        "new global::js.Array<object>(chunk__is_1).length"
      );
    });

    it("materializes imported nullable value-type member reads exactly once after null guards", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/options.ts": `
            export interface MultipartField {
              name: string;
              maxCount?: number;
            }
          `,
          "src/index.ts": `
            import type { MultipartField } from "./options.js";

            function findAllowRule(
              allowList: readonly MultipartField[],
              fieldname: string
            ): MultipartField | undefined {
              for (let index = 0; index < allowList.length; index += 1) {
                const candidate = allowList[index]!;
                if (candidate.name.toLowerCase() === fieldname.toLowerCase()) {
                  return candidate;
                }
              }

              return undefined;
            }

            export function run(
              allowList: readonly MultipartField[],
              fieldname: string
            ): void {
              const rule = findAllowRule(allowList, fieldname);
              if (!rule) {
                return;
              }

              if (rule.maxCount !== undefined) {
                const current = 0;
                const nextCount = current + 1;
                if (nextCount > rule.maxCount) {
                  throw new Error(String(rule.maxCount));
                }
              }
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("if (nextCount > rule.maxCount.Value)");
      expect(csharp).to.include("String(rule.maxCount)");
      expect(csharp).not.to.include("rule.maxCount.Value.Value");
    });

    it("keeps source-package Uint8Array length reads direct inside array-like wrappers", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/index.ts": `
            import { ServerResponse } from "@tsonic/nodejs/http.js";

            export function run(chunk: Uint8Array): boolean {
              const response = new ServerResponse();
              return response.write(chunk);
            }
          `,
        },
        "src/index.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("if (chunk.Is3())");
      expect(csharp).to.include(
        "return ServerResponse._copyUint8Array(chunk__is_1.buffer);"
      );
      expect(csharp).to.include(
        "return ServerResponse._copyUint8Array(chunk__is_2);"
      );
      expect(csharp).to.include("for (int index = 0; index < source.length;");
      expect(csharp).to.include("source.at(index)");
      expect(csharp).not.to.include(
        "new global::js.Array<object>(chunk__is_1).length"
      );
    });

    it("lowers non-byte typed-array array-literal constructors through concrete CLR arrays", () => {
      const csharp = compileToCSharp(
        `
          export function run(): void {
            const ints = new Int16Array([1, 2, 3]);
            const floats = new Float32Array([1.25, 2.5]);
            void ints;
            void floats;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::js.Int16Array(global::js.TypedArrayConstructorInput<short>.From2(global::js.TypedArrayInput<short>.From1(new short[] { 1, 2, 3 })))"
      );
      expect(csharp).to.include(
        "new global::js.Float32Array(global::js.TypedArrayConstructorInput<float>.From2(global::js.TypedArrayInput<float>.From1(new float[] { 1.25f, 2.5f })))"
      );
      expect(csharp).not.to.include(
        "new Int16Array(global::Tsonic.Internal.Union<double[], global::System.Collections.Generic.IEnumerable<double>>"
      );
      expect(csharp).not.to.include(
        "new Float32Array(global::Tsonic.Internal.Union<double[], global::System.Collections.Generic.IEnumerable<double>>"
      );
    });

    it("rejects broad numeric lengths for non-byte typed-array constructors", () => {
      expect(() =>
        compileToCSharp(
          `
          export function run(start: number, end: number): void {
            const view = new Int16Array(end - start);
            void view;
          }
        `,
          "/test/test.ts",
          {
            surface: "@tsonic/js",
          }
        )
      ).to.throw("Implicit narrowing not allowed");
    });

    it("casts Uint8Array element assignments to byte", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

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

      expect(csharp).to.include("data.set(i, 255);");
      expect(csharp).not.to.include("data[i] = 255;");
    });

    it("rejects JS numeric expressions when assigning into int slots", () => {
      expect(() =>
        compileToCSharp(
          `
          import type { int } from "@tsonic/core/types.js";

          class CursorPosition {
            rows: int = 0;
          }

          export function run(totalLength: number): CursorPosition {
            const pos = new CursorPosition();
            pos.rows = Math.floor(totalLength / 80);
            return pos;
          }
        `,
          "/test/test.ts",
          {
            surface: "@tsonic/js",
          }
        )
      ).to.throw("Implicit narrowing not allowed");
    });

    it("emits explicit numeric narrowings when assigning into int slots", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          class CursorPosition {
            rows: int = 0;
          }

          export function run(totalLength: int): CursorPosition {
            const pos = new CursorPosition();
            pos.rows = (totalLength + 1) as int;
            return pos;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "pos.rows = (int)(totalLength + 1);"
      );
    });

    it("rejects JS numeric expressions when assigning through exact int property slots", () => {
      expect(() =>
        compileToCSharp(
          `
          import type { int } from "@tsonic/core/types.js";

          class Counter {
            #value: int = 0;

            set value(v: number) {
              const offset = 123;
              this.#value = v + offset;
            }
          }

          export function run(value: number): void {
            const counter = new Counter();
            counter.value = value;
          }
        `,
          "/test/test.ts",
          {
            surface: "@tsonic/js",
          }
        )
      ).to.throw("Implicit narrowing not allowed");
    });

    it("emits explicit numeric narrowings when assigning through exact int property slots", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          class Counter {
            #value: int = 0;

            set value(v: int) {
              const offset: int = 123;
              this.#value = (v + offset) as int;
            }
          }

          export function run(value: int): void {
            const counter = new Counter();
            counter.value = value;
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include("this.__private_value = (int)(v + offset);");
    });

    it("keeps context-narrowed numeric conditionals on the contextual branch type", () => {
      const csharp = compileToCSharp(
        `
          export function build(): number[] {
            const table: number[] = [0];
            const polynomial = 0xedb88320;
            let crc = 0;
            crc = (crc & 1) === 1 ? (crc >>> 1) ^ polynomial : crc >>> 1;
            table[0] = crc;
            return table;
          }
        `
      );

      expect(csharp).to.include("crc = ((int)crc & (int)1) == 1");
      expect(csharp).not.to.include(
        ": (global::System.Double)((int)crc >>> (int)1)"
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
          for (let i = 0; i < drafts.Length; i++) {
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

    it("materializes source-owned anonymous List<T>.ToArray() arrays to named structural array parameters", () => {
      const source = `
        import type { long } from "@tsonic/core/types.js";

        declare class List<T> {
          Add(item: T): void;
          ToArray(): T[];
        }

        type SubscriptionPropertyUpdate = {
          streamId: long;
          property: string;
          propValue: string;
        };

        declare function update(inputs: SubscriptionPropertyUpdate[]): void;

        export function run(id: long, property: string, propValue: string): void {
          const updates = new List<{ streamId: long; property: string; propValue: string }>();
          updates.Add({ streamId: id, property, propValue });
          update(updates.ToArray());
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("global::System.Linq.Enumerable.Select");
      expect(csharp).to.include("new SubscriptionPropertyUpdate__Alias");
      expect(csharp).not.to.include("update(updates.ToArray());");
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

    it("preserves original runtime-union slots across chained typeof complements with nullish wrappers", () => {
      const csharp = compileToCSharp(`
        declare function a(n: number): string;
        declare function b(s: string): string;

        export function run(x?: number | string): string {
          let y = a(2);
          if (typeof x === "number") {
            y = a(x);
          } else if (typeof x === "string") {
            y = b(x);
          }
          return y;
        }
      `);

      expect(csharp).to.include("x.Is1()");
      expect(csharp).to.include("x.Is2()");
      expect(csharp).to.include("y = b((x.As2()));");
      expect(csharp).not.to.include("y = b((string)x);");
    });

    it("preserves original carrier slot numbering across nested typeof fallthrough guards", () => {
      const csharp = compileToCSharp(
        `
          type Hostname = string;
          type ListenCb = () => void;

          declare function acceptBacklog(backlog: number): void;

          export function run(hostname?: number | Hostname | ListenCb | null): void {
            if (typeof hostname === "function") {
              return;
            }

            if (typeof hostname === "number") {
              acceptBacklog(hostname);
            }
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("acceptBacklog((hostname.As2()));");
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<global::System.Action, double>.From2((hostname.As2()))"
      );
      expect(csharp).not.to.include(
        "(global::Tsonic.Internal.Union<global::System.Action, double>?)(hostname.As2())"
      );
    });

    it("keeps prior typeof complements alive across later undefined guards", () => {
      const csharp = compileToCSharp(
        `
          type TlsOptions = {
            readonly allowHalfOpen?: boolean;
          };

          export function run(
            optionsOrListener?: TlsOptions | (() => void),
          ): boolean {
            if (typeof optionsOrListener === "function") {
              return false;
            }

            if (optionsOrListener !== undefined) {
              return optionsOrListener.allowHalfOpen ?? false;
            }

            return false;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "if (((global::System.Object)(optionsOrListener)) != null)"
      );
      expect(csharp).to.include(
        "return (optionsOrListener.As2()).allowHalfOpen ?? false;"
      );
      expect(csharp).not.to.include(
        "return optionsOrListener.allowHalfOpen ?? false;"
      );
      expect(csharp).not.to.include(
        "return ((TlsOptions__Alias)optionsOrListener).allowHalfOpen ?? false;"
      );
    });

    it("materializes typeof complements before later constructor arguments", () => {
      const csharp = compileToCSharp(
        `
          type TlsOptions = {
            readonly allowHalfOpen?: boolean;
          };

          class TLSSocket {}

          class TLSServer {
            constructor(
              options?: TlsOptions | ((socket: TLSSocket) => void) | null,
              listener?: ((socket: TLSSocket) => void) | null,
            ) {}
          }

          export const createServer = (
            optionsOrListener?: TlsOptions | ((socket: TLSSocket) => void),
            secureConnectionListener?: (socket: TLSSocket) => void,
          ): TLSServer => {
            if (typeof optionsOrListener === "function") {
              return new TLSServer(optionsOrListener);
            }

            if (optionsOrListener !== undefined) {
              return new TLSServer(
                optionsOrListener,
                secureConnectionListener ?? null,
              );
            }

            return new TLSServer();
          };
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "if (((global::System.Object)(optionsOrListener)) != null)"
      );
      expect(csharp).to.include(
        "return new TLSServer(optionsOrListener, secureConnectionListener ?? null);"
      );
      expect(csharp).not.to.include(
        "return new TLSServer((TlsOptions__Alias)(optionsOrListener.As2()), secureConnectionListener ?? null);"
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<global::System.Action<TLSSocket>, TlsOptions__Alias>.From2"
      );
    });

    it("keeps nullable projected union members direct when assigning to matching storage", () => {
      const csharp = compileToCSharp(
        `
          export class Options {
            allowHalfOpen?: boolean;
          }

          class Socket {}

          export class Server {
            _allowHalfOpen: boolean;

            constructor(
              optionsOrListener?: Options | ((socket: Socket) => void) | null,
            ) {
              let options: Options | null = null;
              if (typeof optionsOrListener !== "function") {
                options = optionsOrListener ?? null;
              }

              this._allowHalfOpen = options?.allowHalfOpen ?? false;
            }
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "options = ((object)optionsOrListener == null ? default(Options) : (optionsOrListener.As2())) ?? null;"
      );
      expect(csharp).not.to.include(").Match<Options>");
      expect(csharp).not.to.include("Cannot cast runtime union functionType");
    });

    it("materializes typeof complements before later local initializers in nested nullish guards", () => {
      const csharp = compileToCSharp(
        `
          import type { byte } from "@tsonic/core/types.js";

          declare class Buffer {}
          declare class Uint8Array {}

          export function probe(
            chunkOrCallback?:
              | string
              | Buffer
              | byte[]
              | Uint8Array
              | (() => void)
              | null,
          ): void {
            if (typeof chunkOrCallback === "function") {
              return;
            }

            if (
              chunkOrCallback !== undefined &&
              chunkOrCallback !== null &&
              typeof chunkOrCallback !== "function"
            ) {
              const value = chunkOrCallback;
              void value;
            }
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("var value = chunkOrCallback.Match");
      expect(csharp).to.include(
        "global::Tsonic.Internal.Union<byte[], string, global::js.Uint8Array, global::Test.Buffer>"
      );
      expect(csharp).to.include(
        '__tsonic_union_member_2 => throw new global::System.InvalidCastException("Cannot materialize runtime union functionType to unionType")'
      );
      expect(csharp).not.to.include(
        "var value = (global::Tsonic.Internal.Union<byte[], string, global::js.Uint8Array, global::Test.Buffer>)chunkOrCallback;"
      );
    });

    it("keeps numeric return context for conditionals with mixed numeric carriers", () => {
      const csharp = compileToCSharp(
        `
          import type { byte, int } from "@tsonic/core/types.js";

          export function read(values: byte[], offset: int): number {
            const value = values[offset]!;
            return value >= 0x80 ? value - 0x100 : value;
          }
        `
      );

      expect(csharp).to.include(
        "return value >= 0x80 ? (double)(value - 0x100) : value;"
      );
      expect(csharp).not.to.include("Union<int, byte>");
      expect(csharp).not.to.include(".From1(value - 0x100)");
    });

    it("tightens sequential typeof-plus-undefined ternary locals before storage reuse", () => {
      const csharp = compileToCSharp(
        `
          type Locals = {
            readonly name: string;
          };

          type RenderCallback = (error: object | undefined, html: string) => void;

          export function render(
            localsOrCallback?: Locals | RenderCallback,
            maybeCallback?: RenderCallback,
          ): void {
            const locals =
              typeof localsOrCallback === "function" ||
              localsOrCallback === undefined
                ? { name: "fallback" }
                : localsOrCallback;
            const callback =
              typeof localsOrCallback === "function"
                ? localsOrCallback
                : maybeCallback;
            callback?.(undefined, locals.name);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("var locals =");
      expect(csharp).to.match(/var __struct = \(localsOrCallback\.As2\(\)\);/);
      expect(csharp).to.match(
        /return new global::Test\.__Anon_[A-Za-z0-9_]+ \{ name = __struct\.name \};/
      );
      expect(csharp).not.to.include("localsOrCallback == null ? default");
      expect(csharp).not.to.match(
        /\(\(global::System\.Object\)\(localsOrCallback\)\) == null \? default\(global::Test\.__Anon_[A-Za-z0-9_]+\)/
      );
    });

    it("reuses ternary discriminant narrowings without rematerializing matched members", () => {
      const csharp = compileToCSharp(
        `
          type Shape =
            | { kind: "square"; side: number }
            | { kind: "circle"; radius: number };

          export function tern(s: Shape): number {
            return s.kind === "circle" ? s.radius : 0;
          }

          export function tern2(s: Shape): number {
            return s.kind !== "circle" ? 0 : s.radius;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("return s.Is1() ? (s.As1()).radius : 0;");
      expect(csharp).to.include("return !s.Is1() ? 0 : (s.As1()).radius;");
      expect(csharp).not.to.include("(s.As1()).Match<");
    });

    it("wraps narrowed typeof members before union-typed call arguments", () => {
      const csharp = compileToCSharp(
        `
          declare function decodeInputBytes(
            data: string | Uint8Array,
            encoding?: string,
          ): Uint8Array;

          class Hmac {
            constructor(algorithm: string, key: Uint8Array) {}
          }

          export const createHmac = (
            algorithm: string,
            key: string | Uint8Array,
          ): Hmac => {
            if (typeof key === "string") {
              return new Hmac(algorithm, decodeInputBytes(key, "utf8"));
            }

            return new Hmac(algorithm, key);
          };
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'return new Hmac(algorithm, decodeInputBytes(key, "utf8"));'
      );
      expect(csharp).not.to.include(
        'decodeInputBytes(global::Tsonic.Internal.Union<string, global::js.Uint8Array>.From1(key), "utf8")'
      );
    });

    it("materializes explicit string assertions before wrapping union return arms", () => {
      const csharp = compileToCSharp(
        `
          declare function encodeOutputBytes(
            bytes: Uint8Array,
            encoding?: string,
          ): string | Uint8Array;

          export function run(
            publicKey: Uint8Array,
            encoding?: string,
          ): string | Uint8Array {
            if (typeof encoding === "string") {
              return encodeOutputBytes(publicKey, encoding) as string;
            }

            return publicKey;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "encodeOutputBytes(publicKey, encoding).Match<string>"
      );
      expect(csharp).to.include(
        "throw new global::System.InvalidCastException("
      );
      expect(csharp).not.to.include(
        "encodeOutputBytes(publicKey, encoding).Match<string>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2)"
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<string, global::Uint8Array>.From1(encodeOutputBytes(publicKey, encoding))"
      );
    });

    it("preserves generic iterable assertion surfaces after predicate narrowing", () => {
      const csharp = compileToCSharp(
        `
          declare function isIterableObject(
            value: unknown
          ): value is Iterable<unknown>;
          declare function consume<T>(value: T): void;

          export function run<T>(item: unknown): void {
            if (isIterableObject(item)) {
              for (const value of item as Iterable<T>) {
                consume(value);
              }
            }
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "foreach (var value in (global::System.Collections.Generic.IEnumerable<T>)item)"
      );
      expect(csharp).not.to.include(
        "foreach (var value in (global::System.Collections.Generic.IEnumerable<object?>)item)"
      );
    });

    it("uses instanceof-specific runtime-union probes after primitive fallthrough branches", () => {
      const csharp = compileToCSharp(`
        class Bytes {}
        class KeyObject {}
        class PublicKeyObject extends KeyObject {}
        class PrivateKeyObject extends KeyObject {}

        declare function importPublicKey(key: string | Bytes): KeyObject;
        declare function extractPublicKey(key: PrivateKeyObject): KeyObject;

        export function createPublicKey(
          key: string | Bytes | KeyObject
        ): KeyObject {
          if (typeof key === "string" || key instanceof Bytes) {
            return importPublicKey(key);
          }
          if (key instanceof PublicKeyObject) {
            return key;
          }
          if (key instanceof PrivateKeyObject) {
            return extractPublicKey(key);
          }
          if (key instanceof KeyObject) {
            return key;
          }
          return importPublicKey(key);
        }
      `);

      expect(csharp).to.include(
        "if ((key.As3()) is PublicKeyObject key__is_1)"
      );
      expect(csharp).to.include(
        "if ((key.As3()) is PrivateKeyObject key__is_2)"
      );
      expect(csharp).to.include("if (key.Is3())");
      expect(csharp).not.to.include("if (key is KeyObject");
      expect(csharp).not.to.include("(key.As2()) is PrivateKeyObject");
      expect(csharp).not.to.include(
        "importPublicKey(global::Tsonic.Internal.Union<string, Bytes>.From2((key.As2())))"
      );
    });

    it("preserves runtime carrier probes after predicate fallthrough to a base class member", () => {
      const csharp = compileToCSharp(`
        class Uint8Array {}
        class KeyObject { get type(): string { return "key"; } }
        class PublicKeyObject extends KeyObject {}
        class PrivateKeyObject extends KeyObject {}

        declare function isStringOrBytesKey(
          key: KeyObject | string | Uint8Array
        ): key is string | Uint8Array;
        declare function importPublicKey(
          key: string | Uint8Array
        ): PublicKeyObject;
        declare function extractPublicKey(
          key: PrivateKeyObject
        ): PublicKeyObject;

        export function coercePublicKeyObject(
          key: KeyObject | string | Uint8Array
        ): PublicKeyObject {
          if (isStringOrBytesKey(key)) {
            return importPublicKey(key);
          }
          if (key instanceof PublicKeyObject) {
            return key;
          }
          if (key instanceof PrivateKeyObject) {
            return extractPublicKey(key);
          }
          if (key instanceof KeyObject) {
            return new PublicKeyObject();
          }
          throw new Error("Unexpected key shape");
        }
      `);

      expect(csharp).to.include(
        "if ((key.As2()) is PublicKeyObject key__is_1)"
      );
      expect(csharp).to.include(
        "if ((key.As2()) is PrivateKeyObject key__is_2)"
      );
      expect(csharp).to.include("if (key.Is2())");
      expect(csharp).not.to.include("if (key is KeyObject");
    });

    it("fully qualifies module static helpers when class methods shadow the module container name", () => {
      const csharp = compileToCSharp(
        `
          export function signBytes(): string {
            return "ok";
          }

          export class Sign {
            sign(): string {
              return signBytes();
            }
          }
        `,
        "/test/sign.ts"
      );

      expect(csharp).to.include("return global::Test.sign.signBytes();");
      expect(csharp).not.to.include("return sign.signBytes();");
    });

    it("materializes narrower function arrays into union-element arrays at call sites", () => {
      const csharp = compileToCSharp(`
        type RouteHandler = (req: string) => unknown;
        type ErrorHandler = (error: unknown, req: string) => unknown;
        type Handler = RouteHandler | ErrorHandler;

        class RouteBox {
          handlers: Handler[];

          constructor(handlers: Handler[]) {
            this.handlers = handlers;
          }
        }

        function flatten(handlers: RouteHandler[]): RouteHandler[] {
          return handlers;
        }

        export function main(handler: RouteHandler): RouteBox {
          return new RouteBox(flatten([handler]));
        }
      `);

      expect(csharp).to.include("global::System.Linq.Enumerable.Select");
      expect(csharp).to.match(/\.From1\(__item\)/);
    });

    it("erases imported alias chains that end in callable interface aliases", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/types.ts": `
            export type NextFunction = () => void;
            export interface RequestHandler {
              (req: string, next: NextFunction): string;
            }
            export type RouteHandler = RequestHandler;
          `,
          "src/route.ts": `
            import type { RouteHandler } from "./types.js";

            export class Route {
              get(...handlers: RouteHandler[]): this {
                return this;
              }
            }
          `,
        },
        "src/route.ts",
        {},
        { sourceRootRelativePath: "src", rootNamespace: "Test" }
      );

      expect(csharp).to.include(
        "params global::System.Func<string, global::System.Action, string>[] handlers"
      );
      expect(csharp).not.to.include("RequestHandler[]");
      expect(csharp).not.to.include("RouteHandler[]");
    });

    it("treats fixed lambda parameters against rest callbacks as positional values", () => {
      const csharp = compileToCSharp(`
        type EventListener = (...args: unknown[]) => void;

        declare function consume(listener: EventListener): void;

        export function main(): void {
          let first: unknown = undefined;
          let second: unknown = undefined;
          let third: unknown = undefined;

          consume((arg1, arg2, arg3) => {
            first = arg1;
            second = arg2;
            third = arg3;
          });
        }
      `);

      expect(csharp).to.include("object? arg1 = __unused_args[0];");
      expect(csharp).to.include("first = arg1;");
      expect(csharp).to.not.include("first = (object?[])arg1;");
    });

    it("preserves explicit semantic types for fixed parameters lowered from rest callbacks", () => {
      const csharp = compileToCSharp(`
        type RuntimeValue = string | number | boolean | object | null | undefined;
        type EventListener = (...args: RuntimeValue[]) => void;

        declare function consume(listener: EventListener): void;

        export function main(): void {
          let received: number = 0;
          consume((value: RuntimeValue) => {
            if (typeof value === "number") {
              received = value;
            }
          });
        }
      `);

      expect(csharp).to.include("object? value = __unused_args[0];");
      expect(csharp).to.include("if ((value is double || value is int))");
      expect(csharp).to.not.include("if (false)");
    });

    it("preserves nullable array arguments when forwarding identical signatures", () => {
      const csharp = compileToCSharp(`
        class Child {}

        function spawn(command: string, args?: string[] | null): Child {
          return new Child();
        }

        export function fork(
          modulePath: string,
          args?: string[] | null
        ): Child {
          return spawn(modulePath, args);
        }
      `);

      expect(csharp).to.include("return spawn(modulePath, args);");
      expect(csharp).to.not.include("(string[])(object)args");
      expect(csharp).to.not.include("Enumerable.Select<string, string>(args");
    });

    it("preserves readable array surfaces after setter writes before length reads", () => {
      const csharp = compileToCSharp(
        `
          declare class Assert {
            static Equal(expected: unknown, actual: unknown): void;
          }

          class Proc {
            #argv: string[] = [];

            get argv(): string[] {
              return this.#argv;
            }

            set argv(value: string[] | undefined) {
              this.#argv = value ?? [];
            }
          }

          export function main(p: Proc): void {
            p.argv = undefined;
            Assert.Equal(0, p.argv.length);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("p.argv = default(string[]);");
      expect(csharp).to.include(
        "Assert.Equal((object)(double)0, p.argv.Length);"
      );
      expect(csharp).to.not.include(
        "new global::js.Array<object>((object)p.argv).length"
      );
    });

    it("erases compiler-generated structural assertion casts for nominal receivers", () => {
      const csharp = compileToCSharp(`
        class Server {
          listen(path: string, callback: () => void): void {
            callback();
          }
        }

        class Request {
          on(name: string, listener: (chunk?: string) => void): void {
            listener(name);
          }
        }

        export function main(server: Server, request: Request): void {
          (
            server as object as {
              listen(path: string, callback: () => void): void;
            }
          ).listen("/tmp/socket", () => undefined);

          (
            request as object as {
              on(name: string, listener: (chunk?: string) => void): void;
            }
          ).on("data", (_chunk) => undefined);
        }
      `);

      expect(csharp).to.not.match(/\(\(global::js\.__Anon_/);
      expect(csharp).to.include('server.listen("/tmp/socket"');
      expect(csharp).to.include('request.on("data"');
    });
    it("prefers inferred conditional array surfaces over broad unknown sinks", () => {
      const csharp = compileToCSharp(
        `

          declare function readIds(json: string): string[];

          export function run(json: string, useJson: boolean): Record<string, unknown> {
            const obj: Record<string, unknown> = {};
            obj["channel_ids"] = useJson ? readIds(json) : [];
            return obj;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'obj["channel_ids"] = useJson ? readIds(json) : global::System.Array.Empty<string>();'
      );
    });

    it("keeps nullable conditional array call surfaces direct over broad unknown sinks", () => {
      const csharp = compileToCSharp(
        `

          declare function maybeIds(json: string): string[] | undefined;

          export function run(json: string, useJson: boolean): Record<string, unknown> {
            const obj: Record<string, unknown> = {};
            obj["channel_ids"] = useJson ? maybeIds(json) : [];
            return obj;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'obj["channel_ids"] = useJson ? maybeIds(json) : global::System.Array.Empty<string>();'
      );
      expect(csharp).to.not.include(".Match<object?");
    });

    it("keeps conditional reference-array surfaces direct when one branch is nullish", () => {
      const csharp = compileToCSharp(
        `
          import { JsonSerializer } from "@tsonic/dotnet/System.Text.Json.js";

          export function run(json: string, useJson: boolean): Record<string, unknown> {
            const obj: Record<string, unknown> = {};
            obj["channel_ids"] =
              useJson ? JsonSerializer.Deserialize<string[]>(json) : [];
            return obj;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'obj["channel_ids"] = useJson ? global::System.Text.Json.JsonSerializer.Deserialize<string[]>(json) : global::System.Array.Empty<string>();'
      );
      expect(csharp).not.to.include(
        ".Match<object?>(__tsonic_union_member_1 => __tsonic_union_member_1, __tsonic_union_member_2 => __tsonic_union_member_2)"
      );
    });

    it("preserves source-backed awaited result aliases for inferred locals", () => {
      const csharp = compileToCSharp(`
        type Result<T, E> =
          | { success: true; payload: T }
          | { success: false; error: E };

        declare function ok<T, E>(value: T): Result<T, E>;
        declare function err<T, E>(error: E): Result<T, E>;
        declare function deleteExport(): Promise<Result<boolean, string>>;

        export async function run(): Promise<Result<boolean, string>> {
          const result = await deleteExport();
          if (!result.success) {
            return err<boolean, string>(result.error);
          }
          return ok<boolean, string>(true);
        }
      `);

      expect(csharp).to.include("var result = await deleteExport();");
      expect(csharp).to.include(
        "if (!result.Match<bool>(__tsonic_union_member_1 => __tsonic_union_member_1.success, __tsonic_union_member_2 => __tsonic_union_member_2.success))"
      );
      expect(csharp).to.not.include(
        "(await deleteExport()).Match<global::Test.Result<bool, string>>"
      );
      expect(csharp).to.not.include("(global::Test.Ok__Alias<bool>)");
      expect(csharp).to.not.include("(global::Test.Err__Alias<string>)");
      expect(csharp).to.not.include("__Anon_");
    });

    it("returns awaited result aliases directly from inferred locals", () => {
      const csharp = compileToCSharp(`
        type Result<T, E> =
          | { success: true; payload: T }
          | { success: false; error: E };

        declare function isUserInGroup(): Promise<Result<boolean, string>>;

        export async function run(): Promise<Result<boolean, string>> {
          const membershipResult = await isUserInGroup();
          return membershipResult;
        }
      `);
      expect(csharp).to.include("return membershipResult;");
      expect(csharp).to.not.include(
        "return membershipResult.Match<global::Tsonic.Internal."
      );
      expect(csharp).to.not.include(
        "Cannot materialize runtime union referenceType to unionType"
      );
    });

    it("returns awaited imported result aliases directly from inferred locals", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/result.ts": `
            export type Result<T, E> =
              | { success: true; payload: T }
              | { success: false; error: E };

            export async function isUserInGroup(): Promise<Result<boolean, string>> {
              return { success: true, payload: true };
            }
          `,
          "src/test.ts": `
            import type { Result } from "./result.ts";
            import { isUserInGroup } from "./result.ts";

            export async function run(): Promise<Result<boolean, string>> {
              const membershipResult = await isUserInGroup();
              return membershipResult;
            }
          `,
        },
        "src/test.ts"
      );
      expect(csharp).to.include("return membershipResult;");
      expect(csharp).to.not.include(
        "return membershipResult.Match<global::Tsonic.Internal."
      );
      expect(csharp).to.not.include(
        "Cannot materialize runtime union referenceType to unionType"
      );
    });

    it("wraps narrowed source-owned union members when returning to the carrier alias", () => {
      const csharp = compileToCSharp(`
        type Ok<T> = { success: true; data: T };
        type Err<E> = { success: false; error: E };
        type Result<T, E> = Err<E> | Ok<T>;

        declare function checkPermission(): Promise<Result<boolean, string>>;

        export async function run(): Promise<Result<boolean, string>> {
          const result = await checkPermission();

          if (!result.success) {
            return result;
          }

          return { success: true, data: true };
        }
      `);

      expect(csharp).to.match(
        /return global::Test\.Result<bool, string>\.From1\(result__1_\d+\);/
      );
      expect(csharp).to.not.match(/return result__1_\d+;/);
    });

    it("does not lower truthiness property guards to union tags without literal proof", () => {
      const csharp = compileToCSharp(`
        type Ok = {
          success: boolean;
          value: string;
        };
        type Err = {
          success: false;
          error: string;
        };

        export function run(result: Ok | Err): string {
          if (!result.success) {
            return "not-success";
          }
          return "success";
        }
      `);

      expect(csharp).not.to.include("if (!result.Is1())");
      expect(csharp).not.to.include("if (result.Is2())");
      expect(csharp).to.include("result.Match");
    });

    it("returns awaited imported source-package result aliases directly from inferred locals", () => {
      const csharp = compileProjectToCSharp(
        {
          "src/repo.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { ok } from "@fixture/core/Jotster.Core.js";

            export async function isUserInGroup(): Promise<Result<boolean, string>> {
              return ok(true);
            }
          `,
          "src/test.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { isUserInGroup } from "./repo.ts";

            export async function run(): Promise<Result<boolean, string>> {
              const membershipResult = await isUserInGroup();
              return membershipResult;
            }
          `,
          "node_modules/@fixture/core/package.json": JSON.stringify(
            {
              name: "@fixture/core",
              version: "1.0.0",
              type: "module",
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
                "./Jotster.Core.js": "./src/index.ts",
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/core/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Core",
                exports: {
                  ".": "./src/index.ts",
                  "./index.js": "./src/index.ts",
                  "./Jotster.Core.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/core/src/index.ts": `
            export { ok, err } from "./types/result.ts";
            export type { Result, Ok, Err } from "./types/result.ts";
          `,
          "node_modules/@fixture/core/src/types/result.ts": `
            export type Ok<T> = { success: true; payload: T };
            export type Err<E> = { success: false; error: E };
            export type Result<T, E> = Err<E> | Ok<T>;
            export const ok = <T>(value: T): Ok<T> => ({ success: true, payload: value });
            export const err = <E>(error: E): Err<E> => ({ success: false, error });
          `,
        },
        "src/test.ts",
        { surface: "@tsonic/js" }
      );
      expect(csharp).to.include("return membershipResult;");
      expect(csharp).to.not.include(
        "return membershipResult.Match<global::Tsonic.Internal."
      );
      expect(csharp).to.not.include(
        "Cannot materialize runtime union referenceType to unionType"
      );
    });

    it("auto-awaits async source-package result returns before union adaptation", () => {
      const packageExports = {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
        "./Jotster.Core.js": "./src/index.ts",
      };
      const csharp = compileProjectToCSharp(
        {
          "src/domain.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { ok } from "@fixture/core/Jotster.Core.js";

            export async function setVisibility(): Promise<Result<void, string>> {
              return ok(undefined);
            }
          `,
          "src/test.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { setVisibility } from "./domain.ts";

            export async function run(): Promise<Result<void, string>> {
              return setVisibility();
            }
          `,
          "node_modules/@fixture/core/package.json": JSON.stringify(
            {
              name: "@fixture/core",
              version: "1.0.0",
              type: "module",
              exports: packageExports,
            },
            null,
            2
          ),
          "node_modules/@fixture/core/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Core",
                exports: packageExports,
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/core/src/index.ts": `
            export { ok, err } from "./types/result.ts";
            export type { Result, Ok, Err } from "./types/result.ts";
          `,
          "node_modules/@fixture/core/src/types/result.ts": `
            export type Ok<T> = { success: true; payload: T };
            export type Err<E> = { success: false; error: E };
            export type Result<T, E> = Err<E> | Ok<T>;
            export const ok = <T>(value: T): Ok<T> => ({ success: true, payload: value });
            export const err = <E>(error: E): Err<E> => ({ success: false, error });
          `,
        },
        "src/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.match(/return await .*setVisibility\(\);/);
      expect(csharp).not.to.match(/From[12]\([^;]*setVisibility\(\)/);
    });

    it("wraps source-package generic result helpers through the matching nominal arm", () => {
      const packageExports = {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
        "./Jotster.Core.js": "./src/index.ts",
      };
      const csharp = compileProjectToCSharp(
        {
          "src/test.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { err, ok } from "@fixture/core/Jotster.Core.js";

            type Payload = { email?: string };
            type VerificationError = "segments" | "header";

            export const verify = (token: string): Result<Payload, VerificationError> => {
              if (token.length === 0) {
                return err("segments");
              }
              return ok({ email: token });
            };
          `,
          "node_modules/@fixture/core/package.json": JSON.stringify(
            {
              name: "@fixture/core",
              version: "1.0.0",
              type: "module",
              exports: packageExports,
            },
            null,
            2
          ),
          "node_modules/@fixture/core/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Core",
                exports: packageExports,
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/core/src/index.ts": `
            export { ok, err } from "./types/result.ts";
            export type { Result, Ok, Err } from "./types/result.ts";
          `,
          "node_modules/@fixture/core/src/types/result.ts": `
            export type Ok<T> = { success: true; data: T };
            export type Err<E> = { success: false; error: E };
            export type Result<T, E> = Err<E> | Ok<T>;
            export const ok = <T>(data: T): Ok<T> => ({ success: true, data });
            export const err = <E>(error: E): Err<E> => ({ success: false, error });
          `,
        },
        "src/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        'return global::Fixture.Core.types.Result<global::Test.Payload__Alias, string>.From1(global::Fixture.Core.types.result.err("segments"));'
      );
      expect(csharp).to.include(
        "return global::Fixture.Core.types.Result<global::Test.Payload__Alias, string>.From2(global::Fixture.Core.types.result.ok(new Payload__Alias { email = token }));"
      );
      expect(csharp).not.to.include(
        "From2((global::Fixture.Core.types.Ok__Alias<Payload__Alias>)global::Fixture.Core.types.result.err"
      );
    });

    it("keeps awaited source-backed non-Promise result aliases aligned with runtime slots", () => {
      const packageExports = {
        ".": "./src/index.ts",
        "./index.js": "./src/index.ts",
        "./Jotster.Core.js": "./src/index.ts",
      };
      const csharp = compileProjectToCSharp(
        {
          "src/render.ts": `
            import type { Result } from "@fixture/core/Jotster.Core.js";
            import { ok } from "@fixture/core/Jotster.Core.js";

            export function render(): Result<{ rendered: string }, string> {
              return ok({ rendered: "ok" });
            }
          `,
          "src/test.ts": `
            import { render } from "./render.ts";

            export async function run(): Promise<string> {
              const result = await render();
              if (!result.success) {
                return result.error;
              }
              return result.data.rendered;
            }
          `,
          "node_modules/@fixture/core/package.json": JSON.stringify(
            {
              name: "@fixture/core",
              version: "1.0.0",
              type: "module",
              exports: packageExports,
            },
            null,
            2
          ),
          "node_modules/@fixture/core/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Core",
                exports: packageExports,
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/core/src/index.ts": `
            export { ok, err } from "./types/result.ts";
            export type { Result, Ok, Err } from "./types/result.ts";
          `,
          "node_modules/@fixture/core/src/types/result.ts": `
            export type Ok<T> = { success: true; data: T };
            export type Err<E> = { success: false; error: E };
            export type Result<T, E> = Ok<T> | Err<E>;
            export const ok = <T>(data: T): Ok<T> => ({ success: true, data });
            export const err = <E>(error: E): Err<E> => ({ success: false, error });
          `,
        },
        "src/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "public static Result<T, E> From1(Err__Alias<E> value)"
      );
      expect(csharp).to.include(
        "var result = await global::System.Threading.Tasks.Task.FromResult(global::Test.render__Module.render());"
      );
      expect(csharp).to.include(
        "if (!result.Match<bool>(__tsonic_union_member_1 => __tsonic_union_member_1.success, __tsonic_union_member_2 => __tsonic_union_member_2.success))"
      );
      expect(csharp).to.match(/return result__1_\d+\.error;/);
      expect(csharp).not.to.include("if (result.Is2())");
      expect(csharp).not.to.include("return (result.As1()).data.rendered;");
    });

    it("keeps source-package same-name structural return types in their inferred namespace", () => {
      const packageExports = {
        ".": "./src/index.ts",
        "./Jotster.Channels.js": "./src/index.ts",
      };
      const csharp = compileProjectToCSharp(
        {
          "src/handler.ts": `
            import { getDomainItems } from "@fixture/channels/Jotster.Channels.js";

            export async function run(): Promise<number> {
              const items = await getDomainItems();
              return items.length;
            }
          `,
          "node_modules/@fixture/channels/package.json": JSON.stringify(
            {
              name: "@fixture/channels",
              version: "1.0.0",
              type: "module",
              exports: packageExports,
            },
            null,
            2
          ),
          "node_modules/@fixture/channels/tsonic.package.json": JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.Channels",
                exports: packageExports,
              },
            },
            null,
            2
          ),
          "node_modules/@fixture/channels/src/index.ts": `
            export { getDomainItems } from "./domain/get.ts";
          `,
          "node_modules/@fixture/channels/src/repo/get.ts": `
            import { List } from "@tsonic/dotnet/System.Collections.Generic.js";

            interface Item {
              id: number;
            }

            export async function getItems(): Promise<Item[]> {
              const result = new List<Item>();
              result.Add({ id: 1 });
              return result.ToArray();
            }
          `,
          "node_modules/@fixture/channels/src/domain/get.ts": `
            import { getItems } from "../repo/get.ts";

            interface Item {
              id: number;
            }

            export async function getDomainItems(): Promise<Item[]> {
              const items = await getItems();
              return items;
            }
          `,
        },
        "src/handler.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "var items = await global::Fixture.Channels.domain.get.getDomainItems();"
      );
      expect(csharp).to.include(
        "global::System.Threading.Tasks.Task<global::Fixture.Channels.domain.Item[]>"
      );
      expect(csharp).not.to.include("Fixture.Channels.repo.Item");
      expect(csharp).not.to.include(
        "Select<global::Fixture.Channels.domain.Item, global::Fixture.Channels.repo.Item>"
      );
    });

    it("materializes optional numeric operands before arithmetic calls", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          declare function getLength(value: string): int;
          declare function clamp(value: int, min: int, max: int): int;

          export function sliceLike(
            value: string,
            start: int = 0 as int,
            end?: int
          ): string {
            const lengthValue = getLength(value);
            const actualEnd: int =
              end === undefined
                ? lengthValue
                : end < 0
                  ? clamp(lengthValue + end, 0 as int, lengthValue)
                  : clamp(end, 0 as int, lengthValue);
            return String(actualEnd + start);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "clamp(lengthValue + end.Value, 0, lengthValue)"
      );
      expect(csharp).to.include("clamp(end.Value, 0, lengthValue)");
      expect(csharp).not.to.include("clamp(lengthValue + end, 0, lengthValue)");
    });

    it("wraps nested runtime-union carriers without projecting members", () => {
      const csharp = compileToCSharp(
        `
          import { Uint8Array } from "@tsonic/js/Uint8Array.js";
          import { readFileSync } from "@tsonic/nodejs/fs.js";

          export function run(filePath: string): Uint8Array {
            return new Uint8Array(readFileSync(filePath));
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "return new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From2(global::js.TypedArrayInput<byte>.From2("
      );
      expect(csharp).to.include(
        "global::System.Linq.Enumerable.Select<byte, double>(global::nodejs.FsModule.readFileSync(filePath).__tsonic_symbol_iterator(), __item => (double)__item)"
      );
      expect(csharp).not.to.include(
        ".Match<global::js.TypedArrayConstructorInput<byte>>"
      );
      expect(csharp).not.to.include(
        "(global::js.TypedArrayInput<byte>)__tsonic_union_member_2"
      );
    });

    it("does not nullable-unwrap already projected optional runtime-union members", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          declare function getBufferLength(buffer: object): int;

          export const resolveWriteLength = (
            buffer: object,
            offset: int,
            lengthOrEncoding?: int | string
          ): int =>
            lengthOrEncoding === undefined ||
            typeof lengthOrEncoding === "string"
              ? ((getBufferLength(buffer) - offset) as int)
              : lengthOrEncoding;
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("(lengthOrEncoding.As1())");
      expect(csharp).not.to.include("(lengthOrEncoding.As1())).Value");
      expect(csharp).not.to.include("(lengthOrEncoding.As1()).Value");
    });

    it("probes optional runtime-union members before instanceof projection", () => {
      const csharp = compileToCSharp(
        `
          import { Uint8Array } from "@tsonic/js/Uint8Array.js";
          import type { int } from "@tsonic/core/types.js";

          export function choose(value?: number | Uint8Array | string): int {
            if (value instanceof Uint8Array) {
              return value.length as int;
            }
            return -1;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("value)) != null && value.Is1()");
      expect(csharp).not.to.include("(value.As1()) is global::js.Uint8Array");
    });

    it("maps bare void value-slot members to object storage", () => {
      const csharp = compileToCSharp(`
        type Ok<T> = { success: true; data: T };

        export function run(): Ok<void> {
          return { success: true, data: undefined };
        }
      `);

      expect(csharp).to.include("public required object data { get; set; }");
      expect(csharp).to.include("data = default(object)");
      expect(csharp).not.to.include("required void data");
      expect(csharp).not.to.include("default(void)");
    });

    it("wraps empty array callback arguments through a concrete union array arm", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          interface RecordWithTtl {
            address: string;
            ttl: int;
          }

          type ResolveCallback = (
            error: Error | null,
            records: string[] | RecordWithTtl[]
          ) => void;

          export function run(callback: ResolveCallback): void {
            callback(new Error("ECANCELLED"), []);
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.match(
        /From[12]\(global::System\.Array\.Empty<(?:string|global::Test\.RecordWithTtl)>\(\)\)/
      );
      expect(csharp).not.to.include(
        'callback(new global::js.Error("ECANCELLED"), global::System.Array.Empty<double>())'
      );
      expect(csharp).not.to.include(
        'callback(new global::js.Error("ECANCELLED"), global::System.Array.Empty'
      );
    });

    it("keeps integral conditional branches in assignment storage", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          export function run(flag: boolean, value: int, polynomial: int): int {
            let crc = value;
            crc = flag ? (crc >>> 1) ^ polynomial : crc >>> 1;
            return crc;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include(
        "public static int run(bool flag, int value, int polynomial)"
      );
      expect(csharp).to.include(": (int)crc >>> (int)1");
      expect(csharp).not.to.include(
        ": (global::System.Double)((int)crc >>> (int)1)"
      );
      expect(csharp).not.to.include("crc = (int)(flag ?");
    });

    it("materializes union array arms to broad object arrays without throwing", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          interface RecordWithTtl {
            address: string;
            ttl: int;
          }

          export function run(result: string[] | RecordWithTtl[]): number {
            const values = result as Array<unknown>;
            return values.length;
          }
        `,
        "/test/test.ts",
        { surface: "@tsonic/js" }
      );

      expect(csharp).to.include("result.Match<object?[]>");
      expect(csharp).to.include(
        "__tsonic_union_member_2 => (object?[])__tsonic_union_member_2"
      );
      expect(csharp).not.to.include(
        "Cannot materialize runtime union arrayType to arrayType"
      );
    });

    it("emits in-operator checks only for string-key dictionary carriers", () => {
      const csharp = compileToCSharp(`
        export function hasKey(values: Record<string, number>): boolean {
          return "total" in values;
        }
      `);

      expect(csharp).to.include('return values.ContainsKey("total");');
    });

    it("rejects in-operator checks over declared object properties", () => {
      expect(() =>
        compileToCSharp(`
          export function hasName(value: { name?: string }): boolean {
            return "name" in value;
          }
        `)
      ).to.throw(/'in' operator is only supported/);
    });
  });
});
