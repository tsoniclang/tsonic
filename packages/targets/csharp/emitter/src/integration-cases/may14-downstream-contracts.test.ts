import { describe, it } from "mocha";
import { expect } from "chai";
import { compileProjectToCSharp, compileToCSharp } from "./helpers.js";

describe("May 14 downstream contract coverage", () => {
  it("wraps contextual lambda expression-body returns into source-owned union aliases", () => {
    const csharp = compileToCSharp(`
      class Request {
        body: string = "";
      }

      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type NextFunction = (value?: string | null) => void | Promise<void>;
      type IgnoredHandlerResult =
        | void
        | Response
        | Promise<void | Response>;
      type RequestHandler = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => IgnoredHandlerResult;

      declare const app: {
        post(path: string, handler: RequestHandler): void;
      };

      export function main(): void {
        app.post("/echo", (req: Request, res: Response) => res.json(req.body));
      }
    `);

    expect(csharp).to.match(
      /return global::Test\.IgnoredHandlerResult\.From\d\(res\.json\(req\.body\)\);/
    );
  });

  it("materializes implicit block-lambda fallthrough as contextual runtime absence", () => {
    const csharp = compileToCSharp(`
      class Request {
        body: string = "";
      }

      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type NextFunction = (value?: string | null) => void | Promise<void>;
      type IgnoredHandlerResult =
        | void
        | Response
        | Promise<void | Response>;
      type RequestHandler = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => IgnoredHandlerResult;

      declare const app: {
        post(path: string, handler: RequestHandler): void;
      };

      export function main(): void {
        app.post("/echo", (req: Request, res: Response) => {
          res.json(req.body);
        });
      }
    `);

    expect(csharp).to.include("res.json(req.body);");
    expect(csharp).to.include(
      "return default(global::Test.IgnoredHandlerResult);"
    );
  });

  it("materializes explicit block-lambda empty returns as contextual runtime absence", () => {
    const csharp = compileToCSharp(`
      class Request {
        body: string = "";
      }

      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type NextFunction = (value?: string | null) => void | Promise<void>;
      type IgnoredHandlerResult =
        | void
        | Response
        | Promise<void | Response>;
      type RequestHandler = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => IgnoredHandlerResult;

      declare const app: {
        post(path: string, handler: RequestHandler): void;
      };

      export function main(): void {
        app.post("/echo", (req: Request, res: Response) => {
          res.json(req.body);
          return;
        });
      }
    `);

    expect(csharp).to.include("res.json(req.body);");
    expect(csharp).to.include(
      "return default(global::Test.IgnoredHandlerResult);"
    );
    expect(csharp).to.not.include("return;");
  });

  it("materializes implicit runtime absence at every function body boundary", () => {
    const csharp = compileToCSharp(`
      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type MaybeHandlerResult =
        | void
        | string
        | Response;

      export function moduleHandler(res: Response): MaybeHandlerResult {
        res.json("module");
      }

      export function outer(res: Response): MaybeHandlerResult {
        function localHandler(): MaybeHandlerResult {
          res.json("local");
        }

        localHandler();
      }

      export class Controller {
        handle(res: Response): MaybeHandlerResult {
          res.json("method");
        }
      }

      export const staticHandler: (res: Response) => MaybeHandlerResult = (
        res: Response
      ) => {
        res.json("static");
      };
    `);

    expect(csharp).to.include('res.json("module");');
    expect(csharp).to.include('res.json("local");');
    expect(csharp).to.include('res.json("method");');
    expect(csharp).to.include('res.json("static");');
    expect(
      csharp.match(/return default\(global::Test\.MaybeHandlerResult\);/g) ??
        []
    ).to.have.length(5);
  });

  it("does not add implicit runtime absence after complete branch returns", () => {
    const csharp = compileToCSharp(`
      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type MaybeHandlerResult =
        | void
        | string
        | Response;

      export function complete(
        flag: boolean,
        res: Response
      ): MaybeHandlerResult {
        if (flag) {
          return "ok";
        } else {
          return res.json("ok");
        }
      }
    `);

    expect(csharp).to.match(
      /return global::Test\.MaybeHandlerResult\.From\d\("ok"\);/
    );
    expect(csharp).to.match(
      /return global::Test\.MaybeHandlerResult\.From\d\(res\.json\("ok"\)\);/
    );
    expect(csharp).to.not.include(
      "return default(global::Test.MaybeHandlerResult);"
    );
  });

  it("materializes runtime absence for async fallthrough and accessor empty returns", () => {
    const csharp = compileToCSharp(`
      class Response {
        json(value: string): Response {
          return this;
        }
      }

      type MaybeHandlerResult =
        | void
        | string
        | Response;

      export async function asyncModule(
        res: Response
      ): Promise<MaybeHandlerResult> {
        res.json("async");
      }

      export class Box {
        get maybe(): MaybeHandlerResult {
          return;
        }
      }
    `);

    expect(csharp).to.include('res.json("async");');
    expect(csharp).to.include(
      "return default(global::Test.MaybeHandlerResult);"
    );
    expect(csharp).to.not.include("return;");
  });

  it("prefers exact contextual union return arms over broad object catch-all arms", () => {
    const csharp = compileToCSharp(`
      type JsValue =
        | string
        | number
        | boolean
        | object
        | null
        | undefined;

      class Request {
        body: JsValue = undefined;
      }

      class Response {
        json(value: JsValue): Response {
          return this;
        }
      }

      type NextFunction = (value?: string | null) => void | Promise<void>;
      type IgnoredHandlerResult =
        | void
        | JsValue
        | Response
        | Promise<void | JsValue | Response>;
      type RequestHandler = (
        req: Request,
        res: Response,
        next: NextFunction
      ) => IgnoredHandlerResult;

      declare const app: {
        post(path: string, handler: RequestHandler): void;
      };

      export function main(): void {
        app.post("/echo", (req: Request, res: Response) => res.json(req.body));
      }
    `);

    expect(csharp).to.match(
      /return global::Test\.IgnoredHandlerResult\.From\d\(res\.json\(req\.body\)\);/
    );
    expect(csharp).to.not.include("return res.json(req.body);");
  });

  it("wraps source-package rest-handler expression returns into the declared handler carrier", () => {
    const csharp = compileProjectToCSharp(
      {
        "node_modules/@fixture/mini-express/package.json": JSON.stringify(
          {
            name: "@fixture/mini-express",
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
        "node_modules/@fixture/mini-express/tsonic.package.json":
          JSON.stringify(
            {
              schemaVersion: 1,
              kind: "tsonic-source-package",
              surfaces: ["@tsonic/js"],
              source: {
                namespace: "Fixture.MiniExpress",
                exports: {
                  ".": "./src/index.ts",
                  "./index.js": "./src/index.ts",
                },
              },
            },
            null,
            2
          ),
        "node_modules/@fixture/mini-express/src/index.ts": `
          export type JsValue =
            | string
            | number
            | boolean
            | object
            | null
            | undefined;
          export type PathSpec = string | RegExp | readonly PathSpec[];
          export type NextFunction = (value?: string | null) => void | Promise<void>;
          export type IgnoredHandlerResult =
            | void
            | JsValue
            | Response
            | Promise<void | JsValue | Response>;
          export type RequestHandler = (
            req: Request,
            res: Response,
            next: NextFunction
          ) => IgnoredHandlerResult;

          export class Request {
            body: JsValue = undefined;
          }

          export class Response {
            json(value: JsValue): Response {
              return this;
            }
          }

          export class Application {
            post(path: PathSpec, ...handlers: RequestHandler[]): Application {
              return this;
            }
          }

          export const express = {
            create(): Application {
              return new Application();
            },
          };
        `,
        "src/App.ts": `
          import {
            express,
            type Request,
            type Response,
          } from "@fixture/mini-express/index.js";

          const app = express.create();

          app.post("/echo", (req: Request, res: Response) => res.json(req.body));
        `,
      },
      "src/App.ts",
      { surface: "@tsonic/js" },
      {
        sourceRootRelativePath: "src",
        rootNamespace: "ExpressHandlerCarrier",
      }
    );

    expect(csharp).to.match(
      /return global::Fixture\.MiniExpress\.IgnoredHandlerResult\.From\d\(res\.json\(req\.body\)\);/
    );
    expect(csharp).to.not.include("return res.json(req.body);");
  });

  it("materializes contextual union returns across lambda and function-expression positions", () => {
    const csharp = compileToCSharp(`
      export class Ok {}
      export class Err {}

      export type Result = Ok | Err;
      export type Handler = () => Result;
      export type Routes = { get: Handler };

      declare function use(handler: Handler): void;
      declare function take(result: Result): void;
      declare function takeHandlers(handlers: Handler[]): void;
      declare function takeRoute(route: Routes): void;

      function ok(): Ok {
        return new Ok();
      }

      function err(): Err {
        return new Err();
      }

      export function directReturn(): Result {
        return ok();
      }

      export function callArgument(): void {
        take(ok());
      }

      export function expressionLambdaArgument(): void {
        use(() => ok());
      }

      export function blockLambdaArgument(): void {
        use(() => {
          return ok();
        });
      }

      export function functionExpressionArgument(): void {
        use(function () {
          return ok();
        });
      }

      export const variableArrow: Handler = () => ok();

      export const variableFunction: Handler = function () {
        return ok();
      };

      export function returnedLambda(): Handler {
        return () => ok();
      }

      export function arrayElement(): void {
        takeHandlers([() => ok()]);
      }

      export function objectProperty(): void {
        takeRoute({ get: () => ok() });
      }

      export function conditionalExpression(flag: boolean): void {
        use(() => flag ? ok() : err());
      }

      export function nestedBlock(flag: boolean): void {
        use(() => {
          if (flag) {
            return ok();
          }
          return err();
        });
      }
    `);

    expect([...csharp.matchAll(/Result\.From\d\(ok\(\)\)/g)]).to.have.length
      .greaterThanOrEqual(10);
    expect([...csharp.matchAll(/Result\.From\d\(err\(\)\)/g)]).to.have.length
      .greaterThanOrEqual(2);
    expect(csharp).to.match(/take\(global::Test\.Result\.From\d\(ok\(\)\)\);/);
    expect(csharp).to.match(/return global::Test\.Result\.From\d\(ok\(\)\);/);
    expect(csharp).to.not.match(/return ok\(\);/);
    expect(csharp).to.not.match(/=> ok\(\)/);
  });

  it("materializes contextual async lambda returns through nested union carriers", () => {
    const csharp = compileToCSharp(`
      export class Ok {}
      export class Err {}

      export type Result = Ok | Err;
      export type AsyncResult = Result | Promise<Result>;
      export type AsyncHandler = () => AsyncResult;

      declare function useAsync(handler: AsyncHandler): void;

      function ok(): Ok {
        return new Ok();
      }

      export function asyncExpression(): void {
        useAsync(async () => ok());
      }

      export function asyncBlock(): void {
        useAsync(async () => {
          return ok();
        });
      }
    `);

    expect([...csharp.matchAll(/AsyncResult\.From\d\(/g)]).to.have.length(2);
    expect([...csharp.matchAll(/Result\.From\d\(ok\(\)\)/g)]).to.have.length(2);
    expect(csharp).to.include("Task.Run<global::Test.Result>");
    expect(csharp).to.not.match(/return ok\(\);/);
  });

  it("adapts void promises returned through contextual union promise arms", () => {
    const csharp = compileToCSharp(`
      export type JsValue =
        | string
        | number
        | boolean
        | object
        | null
        | undefined;

      export class Response {
        set(name: string, value: string): Response {
          return this;
        }
      }

      export type NextFunction = (value?: string | null) => void | Promise<void>;
      export type IgnoredHandlerResult =
        | void
        | JsValue
        | Response
        | Promise<void | JsValue | Response>;
      export type RequestHandler = (
        res: Response,
        next: NextFunction
      ) => IgnoredHandlerResult;

      declare function use(handler: RequestHandler): void;

      export function main(): void {
        use((res: Response, next: NextFunction) => {
          res.set("x-middleware", "on");
          return next();
        });
      }
    `);

    expect(csharp).to.match(
      /IgnoredHandlerResult\.From\d\(global::System\.Threading\.Tasks\.Task\.Run<object\?>\(async/
    );
    expect(csharp).to.include("var __tsonic_await_task");
    expect(csharp).to.match(/if \(__tsonic_await_task(?:_\d+)? == null\)/);
    expect(csharp).to.match(/await __tsonic_await_task(?:_\d+)?;/);
    expect(csharp).to.include("return default(object?);");
    expect(csharp).to.not.match(/IgnoredHandlerResult\.From\d\(next\(/);
  });

  it("adapts promised concrete arms through contextual union promise arms", () => {
    const csharp = compileToCSharp(`
      export class Ok {}
      export class Err {}

      export type Result = Ok | Err;
      export type AsyncOutcome = void | Promise<Result>;

      function accept(value: AsyncOutcome): void {
      }

      async function okAsync(): Promise<Ok> {
        return new Ok();
      }

      export function main(): void {
        accept(okAsync());
      }
    `);

    expect(csharp).to.include(
      "accept(global::System.Threading.Tasks.Task.Run<global::Test.Result>(async"
    );
    expect(csharp).to.match(/var __tsonic_await_value(?:_\d+)? = await okAsync\(\);/);
    expect(csharp).to.match(
      /return global::Test\.Result\.From\d\(__tsonic_await_value(?:_\d+)?\);/
    );
    expect(csharp).to.not.include("accept(okAsync());");
  });

  it("passes declared locals to out parameters without discard lowering", () => {
    const csharp = compileToCSharp(`
      import type { int, out } from "@tsonic/core/types.js";

      declare class Parser {
        static TryParse(text: string, result: out<int>): boolean;
      }

      export function parse(text: string): int {
        let parsed: int = 0;
        if (Parser.TryParse(text, parsed as out<int>)) {
          return parsed;
        }
        return -1;
      }
    `);

    expect(csharp).to.include("Parser.TryParse(text, out parsed)");
    expect(csharp).to.not.include("__tsonic_out_discard");
  });

  it("preserves CLR overload out parameter modes for Int32.TryParse", () => {
    const csharp = compileToCSharp(`
      import { Int32 } from "@tsonic/dotnet/System.js";
      import type { int, out } from "@tsonic/core/types.js";

      export function parseId(text: string): int {
        let parsed: int = 0;
        if (Int32.TryParse(text, parsed as out<int>)) {
          return parsed;
        }
        return -1;
      }
    `);

    expect(csharp).to.include("Int32.TryParse(text, out parsed)");
    expect(csharp).to.not.include("Int32.TryParse(text, parsed)");
  });

  it("supports Record<string,T> reads, writes, and for-in key enumeration", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function tally(metrics: Record<string, int>): int {
        metrics["started"] = 1;
        let total: int = 0;
        for (const key in metrics) {
          total = total + metrics[key];
        }
        return total;
      }
    `);

    expect(csharp).to.include('metrics["started"] = 1');
    expect(csharp).to.include("foreach (var key in metrics.Keys)");
    expect(csharp).to.include("total = total + metrics[key]");
  });

  it("narrows closed structural unions with property-existence checks", () => {
    const csharp = compileToCSharp(`
      type AuthOk = { property_id: string };
      type AuthError = { error: Promise<void> };

      export function readPropertyId(auth: AuthOk | AuthError): string {
        if ("error" in auth) {
          return "denied";
        }
        return auth.property_id;
      }
    `);

    expect(csharp).to.match(/auth\.Is\d+\(\)/);
    expect(csharp).to.include(".property_id");
  });

  it("preserves string typeof narrowing through member access", () => {
    const csharp = compileToCSharp(
      `
        export function hasText(value: string | number | undefined): boolean {
          if (typeof value === "string") {
            return value.length > 0;
          }
          return false;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(".Length > 0");
    expect(csharp).to.not.include("((string)value).Length");
  });

  it("lowers function length over function-type runtime-union arms without reflection", () => {
    const csharp = compileToCSharp(
      `
        type NextFunction = () => void;
        interface Request {}
        interface Response {}
        type RequestHandler = (
          req: Request,
          res: Response,
          next: NextFunction
        ) => void;
        type ErrorRequestHandler = (
          error: Error,
          req: Request,
          res: Response,
          next: NextFunction
        ) => void;

        export function isErrorHandler(
          handler: RequestHandler | ErrorRequestHandler
        ): boolean {
          return handler.length >= 4;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(".Match<int>(");
    expect(csharp).to.include("=> 3");
    expect(csharp).to.include("=> 4");
    expect(csharp).to.not.include("handler.length");
    expect(csharp).to.not.include("GetParameters");
  });

  it("lowers Number(...) over CLR numeric values through explicit numeric conversion", () => {
    const csharp = compileToCSharp(
      `
        import type { long } from "@tsonic/core/types.js";

        declare class FileInfo {
          Length: long;
        }

        export function size(info: FileInfo): number {
          return Number(info.Length);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("(double)info.Length");
    expect(csharp).to.not.include("Number(info.Length)");
  });

  it("infers generic constructor type arguments from constructor arguments", () => {
    const csharp = compileToCSharp(`
      class IntervalAsyncIterator<T> {
        value: T;
        constructor(value: T) {
          this.value = value;
        }
      }

      export function create(value: string): IntervalAsyncIterator<string> {
        return new IntervalAsyncIterator(value);
      }
    `);

    expect(csharp).to.include("new IntervalAsyncIterator<string>(value)");
  });

  it("emits readonly constructor-assigned fields as immutable C# members", () => {
    const csharp = compileToCSharp(`
      export class Segment {
        readonly text: string;

        constructor(text: string) {
          this.text = text;
        }
      }
    `);

    expect(csharp).to.match(
      /readonly\s+string\s+text|private readonly string _text|public string text \{ get; init; \}/
    );
  });

  it("emits private static helpers and preserves private call sites", () => {
    const csharp = compileToCSharp(
      `
        export class Glob {
          private static match(text: string): boolean {
            return text.length > 0;
          }

          static test(text: string): boolean {
            return Glob.match(text);
          }
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("private static bool match(string text)");
    expect(csharp).to.include("return Glob.match(text);");
  });

  it("lowers dynamic JSON.parse to the JsValue runtime carrier", () => {
    const csharp = compileToCSharp(
      `
        import type { int, JsValue } from "@tsonic/core/types.js";

        const isObject = (value: JsValue): value is Record<string, JsValue> => {
          return value !== null && typeof value === "object" && !Array.isArray(value);
        };

        export function countMenuItems(text: string): int {
          const root = JSON.parse(text);
          if (!isObject(root)) return -1;

          const entries = Object.entries(root);
          for (let i = 0; i < entries.length; i++) {
            const [key, value] = entries[i]!;
            if (key === "menu" && Array.isArray(value)) {
              const items = value as JsValue[];
              return items.length;
            }
          }

          return 0;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include(
      "global::Tsonic.Runtime.JSON.parse<object>(text)"
    );
    expect(csharp).to.include("value is global::System.Array");
    expect(csharp).to.not.include("JsonSerializer.Deserialize<object>");
  });

  it("lowers typed Array length construction to native CLR arrays", () => {
    const csharp = compileToCSharp(
      `
        import type { char, int } from "@tsonic/core/types.js";

        export function toChars(source: string): char[] {
          const chars = new Array<char>(source.length);
          for (let i: int = 0; i < source.length; i++) {
            chars[i] = source[i]!;
          }
          return chars;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("var chars = new char[source.Length];");
    expect(csharp).to.include("chars[i] = source[i];");
    expect(csharp).to.not.include("new global::js.Array<char>");
  });

  it("lowers typed empty Array construction to native CLR arrays", () => {
    const csharp = compileToCSharp(
      `
        export function countLarge(): number {
          const values = new Array<number>();
          values.push(1, 2, 3, 4);
          return values.filter((value) => value > 2).length;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("var values = new double[0];");
    expect(csharp).to.include(
      "global::Tsonic.Internal.ArrayInterop.WrapArray(values)"
    );
    expect(csharp).to.not.include("new global::js.Array<double>");
  });

  it("passes source-backed structural aliases through null guards without anonymous rematerialization", () => {
    const csharp = compileToCSharp(`
      type KeyRecord = { property_id: string; kind: string };

      declare function lookupKey(token: string): Promise<KeyRecord | undefined>;
      declare function handleIngestBody(key: KeyRecord): Promise<void>;

      export async function handleIngest(token: string): Promise<void> {
        const key = await lookupKey(token);
        if (!key || key.kind !== "write") {
          return;
        }

        await handleIngestBody(key);
      }
    `);

    expect(csharp).to.include("await handleIngestBody(key)");
    expect(csharp).to.not.include("__Anon_");
    expect(csharp).to.not.include("(__Anon_");
  });

  it("preserves awaited source-backed structural aliases from imported modules", () => {
    const csharp = compileProjectToCSharp(
      {
        "package.json": JSON.stringify({
          name: "emitter-test-project",
          version: "1.0.0",
          type: "module",
        }),
        "src/db/clickmeter-db.ts": `
          export type ApiKeyKind = "write" | "read";
          export type KeyRecord = {
            readonly property_id: string;
            readonly kind: ApiKeyKind;
          };

          export class ClickmeterDb {
            async lookupKey(_token: string): Promise<KeyRecord | undefined> {
              return { property_id: "property", kind: "write" };
            }
          }
        `,
        "src/server/handlers/handle-ingest.ts": `
          import type { KeyRecord } from "../../db/clickmeter-db.ts";
          import { ClickmeterDb } from "../../db/clickmeter-db.ts";

          const handleIngestBody = async (key: KeyRecord): Promise<void> => {
            if (key.kind !== "write") return;
          };

          export const handleIngest = async (db: ClickmeterDb, token: string): Promise<void> => {
            const key = await db.lookupKey(token);
            if (!key || key.kind !== "write") {
              return;
            }

            await handleIngestBody(key);
          };
        `,
      },
      "src/server/handlers/handle-ingest.ts",
      {},
      { sourceRootRelativePath: "src", rootNamespace: "Clickmeter.Server" }
    );

    expect(csharp).to.include("await handleIngestBody(key);");
    expect(csharp).to.not.include(
      "await handleIngestBody(((global::System.Func"
    );
    expect(csharp).to.not.include(
      "var __struct = (global::Clickmeter.Server.__Anon_"
    );
  });

  it("keeps JS source-package coercion helpers isolated from downstream type names", () => {
    const csharp = compileToCSharp(
      `
        export class StringValue {}

        export function logText(text: string): void {
          console.log(text);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("global::js.Globals.String(values[i])");
    expect(csharp).to.not.include("(global::Test.StringValue)values[i]");
  });

  it("projects optional value-type parameters after terminating nullish guards", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      declare function consume(value: int): int;

      export function read(value?: int): int {
        if (value === undefined) {
          return -1;
        }

        return consume(value);
      }
    `);

    expect(csharp).to.include("return consume(value.Value);");
    expect(csharp).to.not.include("return consume(value);");
  });

  it("projects optional value-type parameters inside narrowed ternary branches", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      declare function consume(value: int): int;

      export function read(value?: int): int {
        return value === undefined ? -1 : consume(value);
      }
    `);

    expect(csharp).to.include("consume(value.Value)");
    expect(csharp).to.not.include("consume(value)");
  });

  it("materializes concrete reference returns into declared runtime unions", () => {
    const csharp = compileToCSharp(`
      export class Bytes {}

      export function encode(bytes: Bytes, encoding?: string): string | Bytes {
        if (encoding === undefined) {
          return bytes;
        }

        return encoding;
      }
    `);

    expect(csharp).to.match(
      /return global::Tsonic\.Internal\.(?:Union|Union2_[A-F0-9]+)<string, global::Test\.Bytes>\.From2\((?:\(global::Test\.Bytes\))?bytes\);/
    );
    expect(csharp).to.not.include("return bytes;");
  });

  it("materializes first-arm concrete reference returns into declared runtime unions", () => {
    const csharp = compileToCSharp(
      `
        export function encode(bytes: Uint8Array, encoding?: string): Uint8Array | string {
          if (encoding === undefined) {
            return bytes;
          }

          return encoding;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.match(
      /return global::Tsonic\.Internal\.(?:Union|Union2_[A-F0-9]+)<global::js\.Uint8Array, string>\.From1\(bytes\);/
    );
    expect(csharp).to.not.include("return bytes;");
  });

  it("uses broad storage typeof checks for recursive rest callback values", () => {
    const csharp = compileToCSharp(`
      type RuntimeObject = object;
      type RuntimeArray = RuntimeValue[];
      type RuntimeValue = string | number | boolean | RuntimeArray | RuntimeObject | null | undefined;
      type EventListener = (...args: RuntimeValue[]) => void;

      declare class EventEmitter {
        prependOnceListener(eventName: string, listener: EventListener): EventEmitter;
        emit(eventName: string, ...args: RuntimeValue[]): boolean;
      }

      export function run(emitter: EventEmitter): number {
        let received = 0;
        emitter.prependOnceListener("test", (value: RuntimeValue) => {
          if (typeof value === "number") {
            received = value;
          }
        });
        emitter.emit("test", 42);
        return received;
      }
    `);

    expect(csharp).to.include("object? value = __unused_args[0];");
    expect(csharp).to.include("if ((value is double || value is int))");
    expect(csharp).to.include("received = (int)(value switch");
    expect(csharp).to.not.match(/\bvalue\.Is\d+\(\)/);
  });

  it("allows broad runtime-value Array.isArray checks when returned as booleans", () => {
    const csharp = compileToCSharp(
      `
        type RuntimeObject = object;
        type RuntimeArray = RuntimeValue[];
        type RuntimeValue = string | number | boolean | RuntimeArray | RuntimeObject | null | undefined;

        export function isArrayValue(value: RuntimeValue): boolean {
          return Array.isArray(value);
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("return value is global::System.Array;");
  });

  it("omits invalid object constraints for broad runtime-value generic bounds", () => {
    const csharp = compileToCSharp(`
      type RuntimeObject = object;
      type RuntimeArray = RuntimeValue[];
      type RuntimeValue = string | number | boolean | RuntimeArray | RuntimeObject | null | undefined;

      export class TimersPromises {
        async setImmediate<T extends RuntimeValue>(value?: T): Promise<T | undefined> {
          return value;
        }
      }
    `);

    expect(csharp).to.match(/setImmediate<T>\(T\? value = default\)/);
    expect(csharp).to.not.match(/where\s+T\s*:\s*object\b/);
    expect(csharp).to.not.match(/where\s+T\s*:\s*global::System\.Object\b/);
  });

  it("materializes union array arms into broad recursive runtime-value arrays", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        type RuntimeObject = object;
        type RuntimeArray = RuntimeValue[];
        type RuntimeValue = string | number | boolean | RuntimeArray | RuntimeObject | null | undefined;

        class RecordWithTtl {
          address: string = "";
          ttl: int = 0;
        }

        export function count(result: Array<RecordWithTtl> | Array<string>): number {
          const values = result as Array<RuntimeValue>;
          return values.length;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("result.Match<object?[]>");
    expect(csharp).to.include("global::System.Linq.Enumerable.Select");
    expect(csharp).to.not.include(
      "Cannot materialize runtime union arrayType to arrayType"
    );
  });

  it("applies all conjunctive instanceof narrowings in branch bodies", () => {
    const csharp = compileToCSharp(
      `
        type RuntimeArray = RuntimeValue[];
        type RuntimeValue = string | number | boolean | RuntimeArray | object | null | undefined;

        const areUint8ArraysEqual = (left: Uint8Array, right: Uint8Array): boolean => {
          return left.length === right.length;
        };

        export const areDeepEqual = (left: RuntimeValue, right: RuntimeValue): boolean => {
          if (typeof left !== "object" || typeof right !== "object") {
            return false;
          }

          if (left instanceof Uint8Array && right instanceof Uint8Array) {
            return areUint8ArraysEqual(left, right);
          }

          return false;
        };
      `,
      "/test/test.ts",
      { surface: "@tsonic/nodejs" }
    );

    expect(csharp).to.match(
      /areUint8ArraysEqual\((?:\(global::js\.Uint8Array\))?left, \(global::js\.Uint8Array\)right\)/
    );
    expect(csharp).to.not.include("areUint8ArraysEqual(left, right)");
  });

  it("preserves explicit subclass casts in conditional expressions", () => {
    const csharp = compileToCSharp(
      `
        export class JsonValue {
          kind: string;

          constructor(kind: string) {
            this.kind = kind;
          }
        }

        export class JsonArray extends JsonValue {
          items: JsonValue[];

          constructor(items: JsonValue[]) {
            super("array");
            this.items = items;
          }
        }

        export class JsonObject extends JsonValue {
          items: JsonValue[];

          constructor(items: JsonValue[]) {
            super("object");
            this.items = items;
          }
        }

        export const jsonArray = (value: JsonValue | undefined): JsonArray | undefined =>
          value instanceof JsonArray ? (value as JsonArray) : undefined;

        export const jsonObject = (value: JsonValue | undefined): JsonObject | undefined =>
          value instanceof JsonObject ? (value as JsonObject) : undefined;
      `,
      "/test/test.ts",
      { surface: "@tsonic/nodejs" }
    );

    expect(csharp).to.include(
      "return value is JsonArray ? (JsonArray)value : default(JsonArray);"
    );
    expect(csharp).to.not.include(
      "return value is JsonArray ? value : default(JsonArray);"
    );
    expect(csharp).to.include(
      "return value is JsonObject ? (JsonObject)value : default(JsonObject);"
    );
    expect(csharp).to.not.include(
      "return value is JsonObject ? value : default(JsonObject);"
    );
  });

  it("widens mutable integer-initialized locals to JS numbers outside canonical loops", () => {
    const csharp = compileToCSharp(
      `
        export function pickLength(totalLength?: number): number {
          let len = 0;
          if (totalLength !== undefined) {
            len = totalLength;
          }
          return len;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("double len = 0;");
    expect(csharp).to.include("len = totalLength.Value;");
    expect(csharp).to.not.include("var len = 0;");
  });

  it("keeps nullish-assigned nullable member checks on the nullable storage slot", () => {
    const csharp = compileToCSharp(
      `
        import type { int } from "@tsonic/core/types.js";

        export class ProcessModule {
          get exitCode(): int | undefined {
            return undefined;
          }

          set exitCode(value: int | undefined) {}
        }

        export const process = new ProcessModule();

        export function resetAndCheck(): boolean {
          process.exitCode = undefined;
          return process.exitCode === undefined;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/nodejs" }
    );

    expect(csharp).to.include("process.exitCode = default(int?);");
    expect(csharp).to.include("return process.exitCode == null;");
    expect(csharp).to.not.include("process.exitCode.Value == null");
  });

  it("keeps canonical for-loop counters integral after mutable numeric widening", () => {
    const csharp = compileToCSharp(
      `
        export function sum(values: number[]): number {
          for (let i = 0; i < values.length; i++) {
            if (values[i]! > 10) {
              return i;
            }
          }
          return -1;
        }
      `,
      "/test/test.ts",
      { surface: "@tsonic/js" }
    );

    expect(csharp).to.include("for (int i = 0;");
    expect(csharp).to.include("return i;");
    expect(csharp).to.not.include("for (double i = 0;");
  });
});
