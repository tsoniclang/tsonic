import { describe, it, expect, hasCode } from "./helpers.js";

describe("Maximus Validation Coverage", () => {
  describe("JSON NativeAOT static safety", () => {
    const allowCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "JSON.parse with explicit DTO target",
        source: `
          type Payload = { ok: boolean; count: number };
          const value = JSON.parse<Payload>('{"ok":true,"count":1}');
          void value;
        `,
      },
      {
        name: "JSON.parse with concrete contextual variable target",
        source: `
          type Payload = { ok: boolean; count: number };
          const value: Payload = JSON.parse('{"ok":true,"count":1}');
          void value;
        `,
      },
      {
        name: "JSON.stringify with concrete DTO source",
        source: `
          type Payload = { ok: boolean; count: number };
          const value: Payload = { ok: true, count: 1 };
          const text = JSON.stringify(value);
          void text;
        `,
      },
      {
        name: "JSON.stringify with closed object literal source",
        source: `
          const text = JSON.stringify({ ok: true, count: 1 });
          void text;
        `,
      },
    ];

    for (const c of allowCases) {
      it(`allows ${c.name}`, () => {
        expect(hasCode(c.source, "TSN5001")).to.equal(false);
      });
    }

    const rejectCases: ReadonlyArray<{
      readonly name: string;
      readonly source: string;
    }> = [
      {
        name: "untyped JSON.parse",
        source: `
          const value = JSON.parse("{}");
          void value;
        `,
      },
      {
        name: "JSON.parse into unknown",
        source: `
          const value: unknown = JSON.parse("{}");
          void value;
        `,
      },
      {
        name: "JSON.parse into union",
        source: `
          type Payload = { ok: boolean };
          const value: Payload | undefined = JSON.parse("{}");
          void value;
        `,
      },
      {
        name: "JSON.stringify unknown source",
        source: `
          declare const value: unknown;
          const text = JSON.stringify(value);
          void text;
        `,
      },
      {
        name: "JSON.stringify object source",
        source: `
          declare const value: object;
          const text = JSON.stringify(value);
          void text;
        `,
      },
      {
        name: "JSON.stringify dictionary source",
        source: `
          declare const value: Record<string, number>;
          const text = JSON.stringify(value);
          void text;
        `,
      },
      {
        name: "JSON.stringify generic source",
        source: `
          function write<T>(value: T): string {
            return JSON.stringify(value);
          }
          void write;
        `,
      },
    ];

    for (const c of rejectCases) {
      it(`rejects ${c.name}`, () => {
        expect(hasCode(c.source, "TSN5001")).to.equal(true);
      });
    }
  });
});
