import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("Integration: satisfies expression semantics", () => {
  it("preserves object literal shapes nested inside array satisfies constraints", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const rows = [
          { enabled: true, count: 7 },
        ] satisfies Record<string, boolean | number>[];

        return rows[0].enabled ? rows[0].count : 0;
      }
    `);

    expect(csharp).to.include("rows[0].enabled");
    expect(csharp).to.include("rows[0].count");
    expect(csharp).to.not.include("Dictionary<string");
    expect(csharp).to.not.include('["enabled"]');
    expect(csharp).to.not.include('["count"]');
  });

  it("preserves nested object and array shapes through object satisfies constraints", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const table = {
          groups: [
            { enabled: true, count: 7 },
          ],
        } satisfies { groups: Record<string, boolean | number>[] };

        return table.groups[0].enabled ? table.groups[0].count : 0;
      }
    `);

    expect(csharp).to.include("table.groups[0].enabled");
    expect(csharp).to.include("table.groups[0].count");
    expect(csharp).to.not.include("Dictionary<string");
    expect(csharp).to.not.include('["enabled"]');
    expect(csharp).to.not.include('["count"]');
  });

  it("keeps non-object satisfies contextual typing for arrays and functions", () => {
    const csharp = compileToCSharp(`
      import type { int } from "@tsonic/core/types.js";

      export function read(): int {
        const numbers = [1, 2] satisfies int[];
        const increment = ((value) => value + 1) satisfies (value: int) => int;
        return increment(numbers[0]);
      }
    `);

    expect(csharp).to.include("increment(numbers[0])");
    expect(csharp).to.not.include("Dictionary<string");
  });
});
