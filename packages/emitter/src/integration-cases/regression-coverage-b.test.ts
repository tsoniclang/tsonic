import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("preserves reference nullable narrowing across repeated reassignment guards", () => {
      const source = `
        class ImageDimensions {
          readonly width: number;
          readonly height: number;

          constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
          }
        }

        declare const Resource: {
          parsePngDimensions(bytes: string): ImageDimensions | undefined;
          parseJpegDimensions(bytes: string): ImageDimensions | undefined;
          parseGifDimensions(bytes: string): ImageDimensions | undefined;
        };

        export function parseImageDimensions(bytes: string): ImageDimensions | undefined {
          let dims = Resource.parsePngDimensions(bytes);
          if (dims !== undefined) return dims;

          dims = Resource.parseJpegDimensions(bytes);
          if (dims !== undefined) return dims;

          dims = Resource.parseGifDimensions(bytes);
          if (dims !== undefined) return dims;

          return undefined;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("if (dims != null)");
      expect(csharp).to.not.include("if ((object)dims != null)");
      expect(csharp).to.not.include("return (object)dims;");
      expect(csharp).to.include("return dims;");
    });

    it("materializes Array.isArray-narrowed unknown locals before array storage declarations", () => {
      const source = `
        export function parseJsonStringArray(value: unknown): string[] | undefined {
          if (!Array.isArray(value)) return undefined;
          const values = value as unknown[];
          const items: string[] = [];
          for (let i = 0; i < values.length; i++) {
            const current = values[i];
            if (typeof current === "string") items.push(current);
          }
          return items;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("object?[] values = (object?[])value;");
      expect(csharp).to.not.include("object?[] values = value;");
    });

    it("preserves runtime-union member numbering across nested array and instanceof fallthrough guards", () => {
      const source = `
        type RequestHandler = (value: string) => void;
        type MiddlewareLike = RequestHandler | Router | readonly MiddlewareLike[];

        class Router {}

        function isMiddlewareHandler(value: MiddlewareLike): value is RequestHandler {
          return typeof value === "function";
        }

        export function flatten(entries: readonly MiddlewareLike[]): readonly (RequestHandler | Router)[] {
          const result: (RequestHandler | Router)[] = [];
          const append = (handler: MiddlewareLike): void => {
            if (Array.isArray(handler)) {
              for (let index = 0; index < handler.length; index += 1) {
                append(handler[index]!);
              }
              return;
            }
            if (handler instanceof Router) {
              result.push(handler);
              return;
            }
            if (!isMiddlewareHandler(handler)) {
              throw new Error("middleware handlers must be functions");
            }
            result.push(handler);
          };
          return result;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("if (handler.Is1())");
      expect(csharp).to.include(
        "for (int index = 0; index < (handler.As1()).Length; index += 1)"
      );
      expect(csharp).to.not.include(
        "new global::js.Array<global::Tsonic.Runtime.Union<object?[], global::System.Action<string>, Router>>((handler.As1())).length"
      );
      expect(csharp).to.not.include("isMiddlewareHandler(handler.Match(");
      expect(csharp).to.include(
        "if (!isMiddlewareHandler(global::Tsonic.Runtime.Union<object?[], global::System.Action<string>, Router>.From2((handler.As2()))))"
      );
      expect(csharp).to.include(
        'throw new Error("middleware handlers must be functions");'
      );
      expect(csharp).to.include("result.push((handler.As2()));");
    });

    it("prefers assignable conditional supertypes without double runtime-union projection", () => {
      const source = `
        class TemplateValue {}
        class PageValue extends TemplateValue {
          readonly slug: string;
          constructor(slug: string) {
            super();
            this.slug = slug;
          }
        }

        declare function resolve(flag: boolean): TemplateValue;
        declare function consume(value: TemplateValue): void;

        export function run(flag: boolean): void {
          const actual = flag ? new PageValue("home") : resolve(flag);
          consume(actual);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.not.include("actual.Match(");
      expect(csharp).to.not.include(")).Match(");
      expect(csharp).to.include("consume(actual);");
    });

    it("preserves exact rest arrays when forwarding single spreads into params calls", () => {
      const source = `
        type Handler = () => void;

        class Router {
          get(path: string, ...handlers: Handler[]): this {
            void path;
            void handlers;
            return this;
          }

          use(path: string, ...handlers: Handler[]): this {
            void path;
            void handlers;
            return this;
          }
        }

        export class App extends Router {
          override get(path: string, ...handlers: Handler[]): this {
            return super.get(path, ...handlers);
          }

          override use(path: string, ...handlers: Handler[]): this {
            const args = [path, ...handlers] as [string, ...Handler[]];
            return super.use(...args);
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("base.get(path, handlers)");
      expect(csharp).to.not.include("ToArray((object[])(object)handlers)");
      expect(csharp).to.not.include(
        "new global::js.Array<object>(args).slice(1).toArray()"
      );
    });

    it("slices overload-wrapper rest tails through raw array storage instead of js.Array wrappers", () => {
      const source = `
        export class Values<T> {
          constructor();
          constructor(...items: T[]);
          constructor(firstOrNothing?: T, ...rest: T[]) {
            void firstOrNothing;
            void rest;
          }
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(
        /global::System\.Linq\.Enumerable\.Skip\([A-Za-z_][A-Za-z0-9_]*, 1\)/
      );
      expect(csharp).to.include("global::System.Linq.Enumerable.ToArray(");
      expect(csharp).to.not.include("new global::js.Array<T>(");
    });

    it("narrows reassigned locals before native array mutation interop calls", () => {
      const source = `
        class Item {
          readonly name: string;

          constructor(name: string) {
            this.name = name;
          }
        }

        export function run(): number {
          const items: Item[] = [];
          let entry = items.find((current) => current.name === "x");
          if (entry === undefined) {
            entry = new Item("x");
            items.push(entry);
          }
          return items.length;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.match(/\.push\((?:\(Item\))?entry\);/);
      expect(csharp).to.not.include(".push((object)entry);");
    });

    it("narrows reassigned member accesses before subsequent reads", () => {
      const source = `
        class Item {
          readonly name: string;

          constructor(name: string) {
            this.name = name;
          }
        }

        declare function consume(item: Item): void;

        class Holder {
          current: Item | undefined;

          setCurrent(name: string): void {
            this.current = new Item(name);
            consume(this.current);
          }
        }

        export function run(): void {
          new Holder().setCurrent("ok");
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("consume(this.current);");
      expect(csharp).not.to.include("consume((object)this.current)");
      expect(csharp).not.to.include("consume(this.current.Value)");
    });

    it("lowers typed object spreads into object-root dictionary results", () => {
      const source = `
        type ApiKeyData = {
          apiKey: string;
          userId: string;
        };

        export function buildResponse(data: ApiKeyData): object {
          return { result: "success", msg: "", ...data };
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Collections.Generic.Dictionary<string, object?>"
      );
      expect(csharp).to.include('__tmp["result"] = "success"');
      expect(csharp).to.include('__tmp["msg"] = ""');
      expect(csharp).to.include('__tmp["apiKey"] = __spread.apiKey');
      expect(csharp).to.include('__tmp["userId"] = __spread.userId');
    });

    it("lowers dictionary spreads into object-root dictionary results", () => {
      const source = `
        type StringMap = {
          [key: string]: string;
        };

        export function buildResponse(data: StringMap): object {
          return { result: "success", ...data, msg: "" };
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("foreach (var __entry in __spread)");
      expect(csharp).to.include("__tmp[__entry.Key] = __entry.Value;");
      expect(csharp).to.include('__tmp["result"] = "success";');
      expect(csharp).to.include('__tmp["msg"] = "";');
    });

    it("uses element access for index-signature property reads and writes", () => {
      const source = `
        export function buildState(): Record<string, unknown> {
          const state: Record<string, unknown> = {};
          state.user_id = "u1";
          state.email = "u@example.com";
          const bot = state.user_id;
          state.is_bot = bot === "u1";
          return state;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('state["user_id"] = "u1";');
      expect(csharp).to.include('state["email"] = "u@example.com";');
      expect(csharp).to.match(/var bot = .*state\["user_id"\];/);
      expect(csharp).to.match(/state\["is_bot"\] = .*bot.*"u1".*;/);
      expect(csharp).not.to.include("state.user_id");
      expect(csharp).not.to.include("state.email");
      expect(csharp).not.to.include("state.is_bot");
    });
  });
});
