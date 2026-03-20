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
      expect(csharp).to.include("handlers.Length == 0 && nameOrPath.Is2()");
      expect(csharp).not.to.include("handlers.Length == 0 && nameOrPath.Is3()");
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
