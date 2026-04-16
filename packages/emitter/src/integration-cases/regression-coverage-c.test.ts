import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";

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
      expect(csharp).not.to.include("subscribe(((global::System.Func<CreateParams>)(() =>");
    });

    it("uses runtime equality for JsValue-vs-boolean strict comparisons", () => {
      const source = `
        export function hasSubdomain(body: Record<string, JsValue>): boolean {
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
      `);

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
      `);

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
        'decodeInputBytes(global::Tsonic.Internal.Union<double, string>.From2((generatorOrEncodingStr.As2())), generatorEncoding ?? "base64");'
      );
      expect(csharp).not.to.include(
        "default(string) : (generatorOrEncodingStr.As2())).As2()"
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
          import type { JsValue } from "@tsonic/core/types.js";

          const toNumberArg = (value: JsValue): number => {
            return Number(value);
          };

          export function run(args: readonly JsValue[]): number {
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

      expect(csharp).to.include(
        'if (global::Tsonic.Runtime.Operators.@typeof(arg0) == "number")'
      );
      expect(csharp).to.include("return toNumberArg(arg0);");
      expect(csharp).not.to.include("toNumberArg((object?)(double)arg0)");
    });

    it("keeps broad JsValue typeof-object guards on the runtime typeof helper instead of union member checks", () => {
      const csharp = compileToCSharp(
        `
          import type { JsValue } from "@tsonic/core/types.js";

          export class Checker {
            static isObject(value: JsValue | undefined): boolean {
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

      expect(csharp).to.include(
        'if (global::Tsonic.Runtime.Operators.@typeof(value) != "object")'
      );
      expect(csharp).not.to.include(
        'if (!(((global::System.Object)(value)) != null && (value.Is1() || value.Is2())))'
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
        "src/index.ts"
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

      expect(csharp).to.include(
        "createServer((global::TLSSocket _socket) =>"
      );
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

      expect(csharp).to.include(
        "new TLSServer(global::Tsonic.Internal.Union<global::System.Action<global::Test.TLSSocket>, global::Test.TlsOptions>.From1((TLSSocket _socket) =>"
      );
      expect(csharp).not.to.include(
        "new TLSServer((TLSSocket _socket) =>"
      );
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

      expect(csharp).to.include(
        "new SocketAddress(new global::Test.__Anon_"
      );
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
      expect(csharp).to.include(
        'var input = new global::Test.__Anon_'
      );
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
      expect(csharp).to.include(
        "createBotDomain(new global::Test.__Anon_"
      );
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
        declare function deepEqual(left: JsValue, right: JsValue): void;

        export function run(): void {
          const first = { user: { name: "Alice" } };
          const second = { user: { name: "Alice" } };
          deepEqual(first, second);
        }
      `);

      expect(csharp).to.match(
        /new global::Test\.__Anon_[A-Za-z0-9_]+ \{ user = new global::Test\.__Anon_[A-Za-z0-9_]+ \{ name = "Alice" \} \}/
      );
      expect(csharp).not.to.include("new global::js.RangeError { name = \"Alice\" }");
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

        export function isMissing(error: JsValue): boolean {
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
          constructor(public value: T) {}
        }

        class Err<E> {
          constructor(public error: E) {}
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
          public recursive?: boolean;
          public mode?: int;
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
      expect(csharp).to.include(
        "await implOptions(path, options);"
      );
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
          public recursive?: boolean;
          public mode?: int;
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

      expect(csharp).to.include(
        "fs.mkdirSync(dir, new global::Test.__Anon_"
      );
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
      expect(csharp).to.not.include(
        "fs.mkdirSync(dir, new global::js.__Anon_"
      );
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
      expect(csharp).to.not.include(
        "fs.mkdir(dir, new global::js.__Anon_"
      );
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
        "fs.mkdirSync(dir, new global::nodejs.MkdirOptions { recursive = options.recursive, mode = (int?)options.mode });"
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
          public items: Array<T | null> = [] as Array<T | null>;
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
          public constructor(
            public readonly done: boolean,
            public readonly value: T | undefined
          ) {}
        }

        export class IntervalAsyncIterator<T> {
          public close(): IntervalIterationResult<T> {
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
          public readFile(path: string): Promise<byte[]>;
          public readFile(path: string, encoding: string): Promise<string>;
          public readFile(_path: any, _encoding?: any): any {
            throw new Error("stub");
          }
          public readFile_bytes(path: string): Promise<byte[]> {
            return readFile(path);
          }
          public readFile_text(path: string, encoding: string): Promise<string> {
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
      expect(csharp).to.include(
        "return readFile(path);"
      );
      expect(csharp).to.include(
        "return readFile(path, encoding);"
      );
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
          public readFileSync(path: string): byte[];
          public readFileSync(path: string, encoding: string): string;
          public readFileSync(_path: any, _encoding?: any): any {
            throw new Error("stub");
          }

          public readFileSync_bytes(path: string): byte[] {
            return readFileSync(path);
          }

          public readFileSync_text(path: string, encoding: string): string {
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
      expect(csharp).to.include(
        "public byte[] readFileSync(string path)"
      );
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

      expect(csharp).to.include("public static global::Test.Buffer readFileSync(string path)");
      expect(csharp).to.include("public static string readFileSync(string path, string encoding)");
      expect(csharp).to.include("return implBytes(path);");
      expect(csharp).to.include("return implText(path, encoding);");
      expect(csharp).not.to.include("readFileSync_buffer");
      expect(csharp).not.to.include("readFileSync_text");
      expect(csharp).not.to.include("global::Tsonic.Internal.Union<string, global::Test.Buffer>");
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

    it("casts broad JS numbers to imported CLR integral overload parameters", () => {
      const csharp = compileToCSharp(`
        import type { int } from "@tsonic/core/types.js";
        import { Process } from "@tsonic/dotnet/System.Diagnostics.js";

        declare const process: Process;

        class ExecOptions {
          public timeout: number = 0;
        }

        export function run(options?: ExecOptions | null): boolean {
          const timeout = options?.timeout ?? 0;
          return process.WaitForExit(timeout);
        }
      `);

      expect(csharp).to.include("return process.WaitForExit((int)timeout);");
      expect(csharp).not.to.include("return process.WaitForExit(timeout);");
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
        "(values == null ? default(int?) : values.Length)"
      );
      expect(csharp).to.include("?? 0");
    });

    it("keeps JsValue spread-array conditionals on object arrays instead of numeric unions", () => {
      const csharp = compileToCSharp(`
        declare function inspect(value: JsValue): string;

        export function format(
          message?: JsValue,
          optionalParams: readonly JsValue[] = []
        ): string {
          const values =
            message === undefined ? [...optionalParams] : [message, ...optionalParams];
          return values.map((value) => inspect(value)).join(" ");
        }
      `);

      expect(csharp).not.to.include("Union<double[], object?[]>");
      expect(csharp).not.to.include("(double)message");
      expect(csharp).not.to.include(".toArray().join(\" \")");
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
        type ErrorRequestHandler = (error: JsValue, request: string) => void;

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

      expect(csharp).to.include("global::Test.MiddlewareLike[] items = (handler.As1());");
      expect(csharp).not.to.include("handler.Match<object?[]>");
      expect(csharp).not.to.include(".Match<object[]>(");
    });

    it("packs rest arrays for local function values inferred from call results", () => {
      const csharp = compileToCSharp(`
        type DebugLogFunction = (message: string, ...args: JsValue[]) => void;

        declare function debuglog(section: string): DebugLogFunction;
        declare function deprecate(
          fn: (...args: JsValue[]) => JsValue,
          message: string
        ): (...args: JsValue[]) => JsValue;

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
        type ErrorRequestHandler = (error: JsValue, request: string) => void;
        type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

        export function run(
          handlers: MiddlewareHandler[],
          currentError?: JsValue
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
        ) => JsValue | Promise<JsValue>;
        type ErrorRequestHandler = (
          error: JsValue,
          request: Request,
          response: Response,
          next: NextFunction
        ) => JsValue | Promise<JsValue>;
        type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

        declare function isMiddlewareHandler(value: JsValue): value is MiddlewareHandler;
        declare function isErrorHandler(
          value: MiddlewareHandler,
          treatAsError: boolean
        ): value is ErrorRequestHandler;

        export async function run(
          handlers: JsValue[],
          request: Request,
          response: Response,
          currentError: JsValue
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
        ".As2())).Match<global::System.Func<Request__Alias, Response__Alias, global::System.Func<string?, global::System.Threading.Tasks.Task?>, global::Tsonic.Internal.Union<global::System.Threading.Tasks.Task<object?>, object?>>>("
      );
      expect(csharp).to.include(".As1())(error, request, response, next).Match(");
      expect(csharp).not.to.include("handler.Is2()");
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
      `);

      expect(csharp).to.include("pathSpec.Is1()");
      expect(csharp).not.to.include("(pathSpec.As1()).Is1()");
      expect(csharp).not.to.include("((pathSpec.As1()).As1())[index]");
      expect(csharp).to.include(
        "for (int index = 0; index < (pathSpec.As1()).Length; index += 1)"
      );
      expect(csharp).to.include("if (matchesPathSpec((pathSpec.As1())[index], requestPath))");
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
          get(name: string): JsValue;
          override get(path: PathSpec, ...handlers: RouteHandler[]): this;
          override get(_nameOrPath: any, ..._handlers: any[]): any {
            throw new Error("stub");
          }

          get_name(name: string): JsValue {
            return name;
          }

          get_path(path: PathSpec, ...handlers: RouteHandler[]): this {
            return super.get(path, ...handlers);
          }
        }

        O<Application>().method(x => x.get_name).family(x => x.get);
        O<Application>().method(x => x.get_path).family(x => x.get);
      `);

      expect(csharp).to.include("public object? get(string name)");
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
          export function create(
            generatorOrEncoding: number | Uint8Array | string
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
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From2(global::js.TypedArrayInput<byte>.From1(new byte[] { (byte)(generatorOrEncoding.As2()) })))"
      );
      expect(csharp).not.to.include(
        "new global::js.Uint8Array(new byte[] { (byte)generatorOrEncoding })"
      );
    });

    it("preserves narrowed runtime-union members in typed byte array literals", () => {
      const csharp = compileToCSharp(
        `
          import type { byte } from "@tsonic/core/types.js";

          declare function takesBytes(values: byte[]): void;

          export function create(
            generatorOrEncoding: number | Uint8Array | string
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
        "takesBytes(new byte[] { (byte)(generatorOrEncoding.As2()) })"
      );
      expect(csharp).not.to.include(
        "takesBytes(new byte[] { (byte)generatorOrEncoding })"
      );
    });

    it("casts numeric Uint8Array length constructors to int", () => {
      const csharp = compileToCSharp(
        `
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
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1((int)(end - start)))"
      );
    });

    it("keeps conditional Uint8Array length constructors on the numeric arm", () => {
      const csharp = compileToCSharp(
        `
          export function run(totalLength: number): Uint8Array {
            return new Uint8Array(totalLength === 0 ? 1 : totalLength);
          }
        `,
        "/test/test.ts",
        {
          surface: "@tsonic/js",
        }
      );

      expect(csharp).to.include(
        "new global::js.Uint8Array(global::js.TypedArrayConstructorInput<byte>.From1("
      );
      expect(csharp).not.to.include("TypedArrayConstructorInput<byte>.From3(");
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
      expect(csharp).not.to.include("new global::js.Array<object>(chunk__is_1).length");
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
      expect(csharp).to.include("chunk__is_1.length");
      expect(csharp).to.include("chunk__is_1.at(index)");
      expect(csharp).not.to.include("new global::js.Array<object>(chunk__is_1).length");
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

    it("casts non-byte typed-array numeric length constructors to int", () => {
      const csharp = compileToCSharp(
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
      );

      expect(csharp).to.include(
        "new global::js.Int16Array(global::js.TypedArrayConstructorInput<short>.From1((int)(end - start)))"
      );
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

    it("casts JS numeric expressions when assigning into int slots", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          class CursorPosition {
            public rows: int = 0;
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
      );

      expect(csharp).to.include(
        "pos.rows = (int)global::js.Math.floor(totalLength / 80);"
      );
    });

    it("casts JS numeric expressions when assigning through exact int property slots", () => {
      const csharp = compileToCSharp(
        `
          import type { int } from "@tsonic/core/types.js";

          class Counter {
            private _value: int = 0;

            public set value(v: number) {
              const offset = 123;
              this._value = v + offset;
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
      );

      expect(csharp).to.include("this._value = (int)(v + offset);");
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
        "global::Tsonic.Internal.Union<byte[], global::js.Uint8Array, string, global::Test.Buffer>"
      );
      expect(csharp).to.include(
        "__tsonic_union_member_2 => throw new global::System.InvalidCastException(\"Cannot materialize runtime union functionType to unionType\")"
      );
      expect(csharp).not.to.include(
        "var value = (global::Tsonic.Internal.Union<byte[], global::js.Uint8Array, string, global::Test.Buffer>)chunkOrCallback;"
      );
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
        "encodeOutputBytes(publicKey, encoding).Match"
      );
      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<string, global::Uint8Array>.From1(encodeOutputBytes(publicKey, encoding))"
      );
    });

    it("preserves generic iterable assertion surfaces after predicate narrowing", () => {
      const csharp = compileToCSharp(
        `
          declare function isIterableObject(
            value: JsValue,
          ): value is Iterable<JsValue>;
          declare function consume<T>(value: T): void;

          export function run<T>(item: JsValue): void {
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
        type RouteHandler = (req: string) => JsValue;
        type ErrorHandler = (error: JsValue, req: string) => JsValue;
        type Handler = RouteHandler | ErrorHandler;

        class RouteBox {
          constructor(readonly handlers: Handler[]) {}
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

    it("treats fixed lambda parameters against rest callbacks as positional values", () => {
      const csharp = compileToCSharp(`
        type EventListener = (...args: JsValue[]) => void;

        declare function consume(listener: EventListener): void;

        export function main(): void {
          let first: JsValue = undefined;
          let second: JsValue = undefined;
          let third: JsValue = undefined;

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
            static Equal(expected: JsValue, actual: JsValue): void;
          }

          class Proc {
            private _argv: string[] = [];

            get argv(): string[] {
              return this._argv;
            }

            set argv(value: string[] | undefined) {
              this._argv = value ?? [];
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
      expect(csharp).to.include("Assert.Equal((object)(double)0, (object)(double)p.argv.Length);");
      expect(csharp).to.not.include("new global::js.Array<object>((object)p.argv).length");
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
  });
});
