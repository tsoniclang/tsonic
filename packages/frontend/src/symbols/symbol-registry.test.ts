import { expect } from "chai";
import {
  createMemberSymbolId,
  createModuleSymbolId,
  createTypeSymbolId,
  TargetSymbolRegistry,
} from "./index.js";

describe("target symbol registry", () => {
  it("creates deterministic opaque symbol ids", () => {
    expect(createTypeSymbolId("System.Runtime", "System.String")).to.equal(
      createTypeSymbolId("System.Runtime", "System.String")
    );
    expect(createTypeSymbolId("System.Runtime", "System.String")).to.not.equal(
      createTypeSymbolId("System.Private.CoreLib", "System.String")
    );
    expect(
      createMemberSymbolId("Tsumo.Engine", "Tsumo.Engine.BuildSite", "build")
    ).to.equal(
      createMemberSymbolId("Tsumo.Engine", "Tsumo.Engine.BuildSite", "build")
    );
  });

  it("keeps frontend symbol identity separate from target render facts", () => {
    const registry = new TargetSymbolRegistry();
    const typeSymbolId = createTypeSymbolId("System.Runtime", "System.String");
    const memberSymbolId = createMemberSymbolId(
      "System.Console",
      "System.Console.Console",
      "WriteLine"
    );
    const moduleSymbolId = createModuleSymbolId("System.Console", "System");

    registry.addType(
      {
        symbolId: typeSymbolId,
        stableId: "System.Runtime:System.String",
        sourceName: "String",
        ownerIdentity: "System.Runtime",
        origin: "externalSurface",
      },
      {
        symbolId: typeSymbolId,
        qualifiedName: "System.String",
        ownerIdentity: "System.Runtime",
      }
    );
    registry.addMember(
      {
        symbolId: memberSymbolId,
        ownerTypeSymbolId: typeSymbolId,
        stableId: "System.Console:System.Console.Console.WriteLine",
        sourceName: "writeLine",
        ownerIdentity: "System.Console",
        origin: "externalSurface",
      },
      {
        symbolId: memberSymbolId,
        ownerTypeSymbolId: typeSymbolId,
        ownerQualifiedName: "System.Console.Console",
        memberName: "WriteLine",
        ownerIdentity: "System.Console",
      }
    );
    registry.addModule(
      {
        symbolId: moduleSymbolId,
        stableId: "System.Console:System",
        sourceName: "System",
        ownerIdentity: "System.Console",
        origin: "externalSurface",
      },
      {
        symbolId: moduleSymbolId,
        qualifiedName: "System",
        ownerIdentity: "System.Console",
      }
    );

    const artifacts = registry.artifacts();
    expect(artifacts.surface.types.get(typeSymbolId)?.sourceName).to.equal(
      "String"
    );
    expect(artifacts.surface.members.get(memberSymbolId)?.sourceName).to.equal(
      "writeLine"
    );
    expect(artifacts.surface.modules.get(moduleSymbolId)?.sourceName).to.equal(
      "System"
    );
    expect(
      artifacts.renderTable.types.get(typeSymbolId)?.qualifiedName
    ).to.equal("System.String");
    expect(
      artifacts.renderTable.members.get(memberSymbolId)?.ownerQualifiedName
    ).to.equal("System.Console.Console");
    expect(
      artifacts.renderTable.modules.get(moduleSymbolId)?.qualifiedName
    ).to.equal("System");
  });
});
