import { expect } from "chai";
import { describe, it } from "mocha";
import { loadDotnetMetadata } from "./metadata.js";
import { materializeFrontendFixture } from "../testing/filesystem-fixtures.js";

describe("Program Metadata", () => {
  it("should load CLR metadata through surface package dependencies", () => {
    const fixture = materializeFrontendFixture(
      "program/metadata/surface-dependency"
    );

    try {
      const globalsRoot = fixture.path("app/node_modules/@tsonic/globals");

      const metadata = loadDotnetMetadata([globalsRoot]);
      expect(metadata.getTypeMetadata("System.String")).to.not.equal(undefined);
    } finally {
      fixture.cleanup();
    }
  });

  it("should load CLR metadata through sibling workspace package dependencies", () => {
    const fixture = materializeFrontendFixture(
      "program/metadata/sibling-workspace-dependency"
    );

    try {
      const globalsRoot = fixture.path("workspace/globals/versions/10");

      const metadata = loadDotnetMetadata([globalsRoot]);
      expect(metadata.getTypeMetadata("System.String")).to.not.equal(undefined);
    } finally {
      fixture.cleanup();
    }
  });

  it("should load CLR metadata from the dotnet payload of first-party bindings v2 manifests", () => {
    const fixture = materializeFrontendFixture(
      "program/metadata/firstparty-bindings-v2"
    );

    try {
      const globalsRoot = fixture.path("app/node_modules/@tsonic/globals");

      const metadata = loadDotnetMetadata([globalsRoot]);
      expect(metadata.getTypeMetadata("Acme.Core.Widget")).to.not.equal(
        undefined
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("ignores CLR metadata files inside source package roots while traversing dependencies", () => {
    const fixture = materializeFrontendFixture(
      "program/metadata/ignore-source-package-bindings"
    );

    try {
      const sourceRoot = fixture.path("app/node_modules/@tsonic/js");

      const metadata = loadDotnetMetadata([sourceRoot]);
      expect(metadata.getTypeMetadata("Ignored.ShouldNotLoad")).to.equal(
        undefined
      );
      expect(metadata.getTypeMetadata("System.String")).to.not.equal(
        undefined
      );
    } finally {
      fixture.cleanup();
    }
  });
});
