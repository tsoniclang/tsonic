import { expect } from "chai";
import { describe, it } from "mocha";

import { shouldEmitFluentExtensionCall } from "./call-analysis.js";

describe("call-analysis", () => {
  describe("shouldEmitFluentExtensionCall", () => {
    it("should prefer explicit receiver metadata over namespace heuristics", () => {
      expect(
        shouldEmitFluentExtensionCall({
          type: "Acme.WebRuntime.Text",
          member: "trim",
          emitSemantics: {
            callStyle: "receiver",
          },
        })
      ).to.equal(true);
    });

    it("should prefer explicit static metadata over JS receiver heuristics", () => {
      expect(
        shouldEmitFluentExtensionCall({
          type: "js.String",
          member: "trim",
          emitSemantics: {
            callStyle: "static",
          },
        })
      ).to.equal(false);
    });

    it("should not force fluent emission when metadata is absent for unrelated bindings", () => {
      expect(
        shouldEmitFluentExtensionCall({
          type: "Acme.Linq.QueryableExtensions",
          member: "Where",
        })
      ).to.equal(false);

      expect(
        shouldEmitFluentExtensionCall({
          type: "Acme.WebRuntime.Text",
          member: "trim",
        })
      ).to.equal(false);
    });

    it("should not infer fluent emission from migrated families when metadata is absent", () => {
      expect(
        shouldEmitFluentExtensionCall({
          type: "js.String",
          member: "trim",
        })
      ).to.equal(false);

      expect(
        shouldEmitFluentExtensionCall({
          type: "System.Linq.Queryable",
          member: "Where",
        })
      ).to.equal(false);

      expect(
        shouldEmitFluentExtensionCall({
          type: "Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions",
          member: "Include",
        })
      ).to.equal(false);

      expect(
        shouldEmitFluentExtensionCall({
          type: "System.Linq.Enumerable",
          member: "ToList",
        })
      ).to.equal(false);
    });
  });
});
