import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("End-to-End Integration", () => {
  describe("Regression Coverage", () => {
    it("passes contextual string expectations through array element assignments", () => {
      const source = `
        export function main(): string[] {
          const chars: string[] = ["", ""];
          const source = "ab";
          chars[0] = source[0];
          return chars;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('string[] chars = new string[] { "", "" };');
      expect(csharp).to.include("chars[0] = source[0].ToString();");
    });

    it("default-initializes explicit locals without initializers", () => {
      const source = `
        export function pick(flag: boolean): string {
          let name: string;
          if (flag) {
            name = "ok";
          } else {
            name = "no";
          }
          return name;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("string name = default(string);");
    });

    it("prefers typed CLR option overloads over erased unknown for object literals", () => {
      const source = `
        declare class MkdirOptions {
          readonly __tsonic_type_nodejs_MkdirOptions: never;
          recursive?: boolean;
        }

        declare const fs: {
          mkdirSync(path: string, options: MkdirOptions): void;
          mkdirSync(path: string, recursive?: boolean): void;
          mkdirSync(path: string, options: unknown): void;
        };

        export function ensure(dir: string): void {
          fs.mkdirSync(dir, { recursive: true });
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include(
        "fs.mkdirSync(dir, new global::Test.MkdirOptions"
      );
      expect(csharp).not.to.include("Dictionary<string, object?>");
    });

    it("emits indexer access for alias-wrapped string dictionaries", () => {
      const source = `
        interface SettingsMap {
          [key: string]: string;
        }

        declare function load(): SettingsMap;

        export function readSetting(): string | undefined {
          const settings = load();
          return settings["waiting_period_threshold"];
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('return settings["waiting_period_threshold"];');
      expect(csharp).not.to.include("settings.waiting_period_threshold");
    });

    it("emits indexer access for generic-return dictionary aliases after null narrowing", () => {
      const source = `
        type SettingsMap = { [key: string]: string };

        declare const JsonSerializer: {
          Deserialize<T>(json: string): T | undefined;
        };

        export function readSetting(json: string): string | undefined {
          const settingsOrNull = JsonSerializer.Deserialize<SettingsMap>(json);
          if (settingsOrNull === undefined) {
            return undefined;
          }
          const settings = settingsOrNull;
          return settings["waiting_period_threshold"];
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include('return settings["waiting_period_threshold"];');
      expect(csharp).not.to.include("settings.waiting_period_threshold");
    });

    it("emits object literals with exact numeric properties after nullish fallback narrowing", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseRole(raw: string): int | undefined;

        export function run(raw: string): int {
          const parsedInviteAsRole = parseRole(raw);
          const inviteAsRole = parsedInviteAsRole ?? (400 as int);
          const input = {
            inviteAsRole,
          };
          return input.inviteAsRole;
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("inviteAsRole = inviteAsRole");
      expect(csharp).not.to.include("Object literal cannot be synthesized");
    });

    it("preserves optional value-type properties in object literals", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseLimit(raw: string, fallback: int): int;

        type Options = {
          limit?: int;
        };

        export function run(limitRaw: string | undefined): int {
          const limit = limitRaw ? parseLimit(limitRaw, 100 as int) : undefined;
          const options: Options = { limit };
          return options.limit ?? (0 as int);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("limit = limit");
      expect(csharp).not.to.include("limit = limit.Value");
      expect(csharp).to.include("int? limit =");
      expect(csharp).not.to.include("var limit =");
    });

    it("preserves optional exact-numeric arguments for function-valued calls", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        type Query = {
          limit?: int;
        };

        declare function takeDeclared(value?: int): void;

        export function run(query: Query): void {
          const takeLocal = (value?: int): void => {};
          const takeTyped: (value?: int) => void = (value?: int): void => {};

          takeDeclared(query.limit);
          takeLocal(query.limit);
          takeTyped(query.limit);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("takeDeclared(query.limit);");
      expect(csharp).to.include("takeLocal(query.limit);");
      expect(csharp).to.include("takeTyped(query.limit);");
      expect(csharp).not.to.include("takeDeclared(query.limit.Value)");
      expect(csharp).not.to.include("takeLocal(query.limit.Value)");
      expect(csharp).not.to.include("takeTyped(query.limit.Value)");
    });

    it("keeps nullable value unwraps on the raw local instead of layering casts before .Value", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parsePostIdRequired(): int | undefined;
        declare function unwrapInt(value: int): int;

        export function run(): int {
          const postIdRaw = parsePostIdRequired();
          if (postIdRaw === undefined) {
            return 0 as int;
          }
          return unwrapInt(postIdRaw);
        }
      `;

      const csharp = compileToCSharp(source);
      expect(csharp).to.include("return unwrapInt(postIdRaw.Value);");
      expect(csharp).not.to.include("((int)(object)postIdRaw).Value");
    });
  });
});
