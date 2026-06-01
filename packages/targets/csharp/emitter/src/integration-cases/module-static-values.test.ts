import { describe, it } from "mocha";
import { expect } from "chai";
import { compileToCSharp } from "./helpers.js";

describe("Integration: module static values", () => {
  it("qualifies module constants from namespace-level class closures", () => {
    const csharp = compileToCSharp(`
      type Mode = "any" | "fields";
      const ModeAny: Mode = "any";
      const ModeFields: Mode = "fields";

      type Handler = () => Promise<void>;

      async function parse(mode: Mode): Promise<void> {
        if (mode === "any") {
          return;
        }
      }

      export class Multipart {
        any(): Handler {
          return async () => {
            await parse(ModeAny);
          };
        }

        fields(fields: string[]): Handler {
          return async () => {
            await parse(ModeFields);
          };
        }
      }
    `);

    expect(csharp).to.match(/parse\(global::Test\.test\.ModeAny\)/);
    expect(csharp).to.match(/parse\(global::Test\.test\.ModeFields\)/);
    expect(csharp).to.not.include("parse(ModeAny)");
    expect(csharp).to.not.include("parse(ModeFields)");
  });

  it("keeps local shadows unqualified when names match module constants", () => {
    const csharp = compileToCSharp(`
      type Mode = "any" | "fields";
      const ModeAny: Mode = "any";

      export class Multipart {
        echo(ModeAny: Mode): Mode {
          return ModeAny;
        }
      }
    `);

    expect(csharp).to.include("return ModeAny;");
    expect(csharp).to.not.include("return global::Test.test.ModeAny;");
  });
});
