import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("Integration: runtime union subset reification", () => {
  it("casts a narrowed union alias to another union alias through the target carrier", () => {
    const csharp = compileToCSharp(`
      type IgnoredHandlerResult = Promise<void> | void | null;
      type RequestHandler = (
        request: string,
        next: () => void
      ) => IgnoredHandlerResult;
      type ErrorRequestHandler = (
        error: object,
        request: string,
        next: () => void
      ) => IgnoredHandlerResult;

      class Router {}

      type MiddlewareLike = RequestHandler | ErrorRequestHandler | Router;
      type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

      export function adapt(handler: MiddlewareLike): MiddlewareHandler {
        if (handler instanceof Router) {
          throw new Error("router is not middleware");
        }

        const middlewareHandler = handler as MiddlewareHandler;
        return middlewareHandler;
      }
    `);

    expect(csharp).to.include(".Match<global::Test.MiddlewareHandler>");
    expect(csharp).to.include(
      "is global::Tsonic.Internal.Union<"
    );
    expect(csharp).to.include("__tsonic_reify_union ?");
    expect(csharp).to.include(
      "__tsonic_reify_union.Match<global::Test.MiddlewareHandler>"
    );
    expect(csharp).to.include("global::Test.MiddlewareHandler.From1");
    expect(csharp).to.include("global::Test.MiddlewareHandler.From2");
  });

  it("isolates runtime-union reification pattern locals for repeated same-scope reification", () => {
    const csharp = compileToCSharp(`
      type RequestHandler = (value: string) => void;
      type ErrorRequestHandler = (error: object, value: string) => void;
      type MiddlewareHandler = RequestHandler | ErrorRequestHandler;

      function isMiddlewareHandler(value: unknown): value is MiddlewareHandler {
        return typeof value === "function";
      }

      function isErrorHandler(
        handler: MiddlewareHandler,
        treatAsError: boolean
      ): handler is ErrorRequestHandler {
        return treatAsError;
      }

      export function invoke(handler: unknown): void {
        if (!isMiddlewareHandler(handler)) return;
        if (isErrorHandler(handler, false)) {
          const errorHandler = handler;
          return;
        }

        const requestHandler = handler;
      }
    `);

    expect(csharp).to.include("global::System.Func<global::Test.MiddlewareHandler>");
    expect(csharp).to.include(
      "__tsonic_reify_union.Match<global::Test.MiddlewareHandler>"
    );
    expect(csharp.match(/global::System\.Func<global::Test\.MiddlewareHandler>/g))
      .to.have.length.greaterThan(1);
  });
});
