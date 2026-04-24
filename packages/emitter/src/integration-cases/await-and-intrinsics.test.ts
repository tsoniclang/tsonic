import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Await Lowering", () => {
    it("awaits non-generic Task values directly", () => {
      const source = `
        import type { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";
        import { Task as TaskValue } from "@tsonic/dotnet/System.Threading.Tasks.js";

        function flush(): Task {
          return TaskValue.CompletedTask;
        }

        export async function run(): Promise<void> {
          await flush();
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("await flush();");
      expect(csharp).not.to.include("Task.FromResult");
    });

    it("awaits non-generic ValueTask values directly", () => {
      const source = `
        import type { ValueTask } from "@tsonic/dotnet/System.Threading.Tasks.js";
        import { ValueTask as ValueTaskValue } from "@tsonic/dotnet/System.Threading.Tasks.js";

        function flush(): ValueTask {
          return ValueTaskValue.CompletedTask;
        }

        export async function run(): Promise<void> {
          await flush();
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("await flush().AsTask();");
      expect(csharp).not.to.include("Task.FromResult");
    });

    it("normalizes mixed Promise-or-value unions before await", () => {
      const source = `
        declare function maybeLoad(flag: boolean): string | Promise<string>;

        export async function run(flag: boolean): Promise<string> {
          return await maybeLoad(flag);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("await maybeLoad(flag).Match");
      expect(csharp).to.include("Task.FromResult(__tsonic_await_value_0)");
    });

    it("normalizes alias-backed Promise-or-value unions before await", () => {
      const source = `
        type IgnoredHandlerResult = void | JsValue | Promise<void | JsValue>;

        declare function invoke(flag: boolean): IgnoredHandlerResult;

        export async function run(flag: boolean): Promise<void | JsValue> {
          return await invoke(flag);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("await (invoke(flag)?.Match");
      expect(csharp).to.include("Task.FromResult(__tsonic_await_value_");
      expect(csharp).not.to.include(
        "await global::System.Threading.Tasks.Task.FromResult(invoke(flag));"
      );
    });

    it("normalizes alias-backed Promise-or-value unions in bare await statements", () => {
      const source = `
        type IgnoredHandlerResult = void | JsValue | Promise<void | JsValue>;

        declare function invoke(flag: boolean): IgnoredHandlerResult;

        export async function run(flag: boolean): Promise<void> {
          await invoke(flag);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include("await (invoke(flag)?.Match");
      expect(csharp).to.include(
        "global::System.Threading.Tasks.Task.FromResult<object?>"
      );
      expect(csharp).not.to.include(
        "global::System.Threading.Tasks.Task.FromResult<IgnoredHandlerResult>"
      );
    });

    it("wraps pure sync unions directly when awaiting", () => {
      const source = `
        declare function render(flag: boolean):
          | { success: true; rendered: string }
          | { success: false; error: string };

        export async function run(flag: boolean): Promise<string> {
          const result = await render(flag);
          if ("error" in result) {
            return result.error;
          }
          return result.rendered;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include(
        "var result = await global::System.Threading.Tasks.Task.FromResult(render(flag));"
      );
      expect(csharp).not.to.include("await render(flag).Match");
    });

    it("wraps pure sync nullish unions directly when awaiting", () => {
      const source = `
        declare function maybeText(flag: boolean): string | undefined;

        export async function run(flag: boolean): Promise<string | undefined> {
          return await maybeText(flag);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include(
        "await global::System.Threading.Tasks.Task.FromResult(maybeText(flag));"
      );
      expect(csharp).not.to.include(
        "?? global::System.Threading.Tasks.Task.CompletedTask"
      );
      expect(csharp).not.to.include("maybeText(flag).Match");
    });

    it("materializes awaited structural return adaptation through an async IIFE", () => {
      const source = `
        interface MetricsResult {
          rows: string[];
          totals: number;
        }

        declare function load(): Promise<{ rows: string[]; totals: number }>;

        export async function run(): Promise<MetricsResult> {
          return await load();
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.match(
        /return await \(\(global::System\.Func<global::System\.Threading\.Tasks\.Task<[^>]+>>\)\(async \(\) =>/
      );
      expect(csharp).to.include("var __struct = await load();");
      expect(csharp).to.match(
        /return new [^{]+ \{ rows = __struct\.rows, totals = __struct\.totals \};/
      );
      expect(csharp).not.to.include("((global::System.Func<MetricsResult");
    });

    it("normalizes mixed Task-or-void unions before await", () => {
      const source = `
        import type { Task } from "@tsonic/dotnet/System.Threading.Tasks.js";

        declare function maybeFlush(flag: boolean): void | Task;

        export async function run(flag: boolean): Promise<void> {
          await maybeFlush(flag);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include(
        "await (maybeFlush(flag) ?? global::System.Threading.Tasks.Task.CompletedTask);"
      );
      expect(csharp).not.to.include("Match((void");
    });

    it("normalizes async function values assigned to mixed value-or-promise handler contracts", () => {
      const source = `
        type NextControl = "route" | string | undefined;
        type NextFunction = (value?: NextControl) => void | Promise<void>;
        type RequestHandler = (next: NextFunction) => JsValue | Promise<JsValue>;

        export function build(): RequestHandler {
          const handler: RequestHandler = async (next) => {
            await next("route");
          };
          return handler;
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).to.include(
        "global::Tsonic.Internal.Union<global::System.Threading.Tasks.Task<object?>, object?>.From1(global::System.Threading.Tasks.Task.Run<object?>"
      );
      expect(csharp).to.include(
        '("route") ?? global::System.Threading.Tasks.Task.CompletedTask);'
      );
    });

    it("strips void from awaited mixed value-or-promise carriers before building Task.FromResult", () => {
      const source = `
        type NextControl = "route" | "router" | string | null | undefined;
        type NextFunction = (value?: NextControl) => void | Promise<void>;
        type RequestHandler = (next: NextFunction) => void | JsValue | Promise<void | JsValue>;

        export async function run(handler: RequestHandler, next: NextFunction): Promise<void> {
          await handler(next);
        }
      `;

      const csharp = compileToCSharp(source);

      expect(csharp).not.to.include(
        "global::Tsonic.Internal.Union<object?, void>"
      );
      expect(csharp).not.to.include(
        "Task.FromResult<global::Tsonic.Internal.Union<object?, void>>"
      );
      expect(csharp).to.include(
        "global::System.Threading.Tasks.Task.FromResult<object?>"
      );
    });
  });

  describe("Core Intrinsics", () => {
    it("lowers nameof to a compile-time string literal using TS-authored names", () => {
      const source = `
        import { nameof } from "@tsonic/core/lang.js";

        interface User {
          name: string;
        }

        export function getName(user: User): string {
          return nameof(user.name);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('return "name";');
    });

    it("lowers sizeof to C# sizeof(T)", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";
        import { sizeof } from "@tsonic/core/lang.js";

        export function getIntSize(): int {
          return sizeof<int>();
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return sizeof(int);");
    });
  });

  describe("Local Function Values", () => {
    it("lowers recursive local arrow functions through explicit delegate initialization", () => {
      const source = `
        type Node = {
          name: string;
          children: Node[];
        };

        export function flatten(nodes: Node[]): string[] {
          const names: string[] = [];
          const walk = (current: Node[]): void => {
            for (let i = 0; i < current.length; i++) {
              const node = current[i]!;
              names.push(node.name);
              walk(node.children);
            }
          };

          walk(nodes);
          return names;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "global::System.Action<Node__Alias[]> walk = default"
      );
      expect(csharp).to.match(/walk\s*=\s*\(Node__Alias\[\]\s+current\)\s*=>/);
      expect(csharp).not.to.include("var walk =");
    });
  });
});
