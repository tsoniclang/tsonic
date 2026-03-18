import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { identifierType } from "../format/backend-ast/builders.js";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import {
  lookupLocalTypeMemberKind,
  resolveTypeMemberIndexFqn,
  resolveTypeMemberIndexMap,
  resolveTypeMemberKind,
  typeMemberKindToBucket,
} from "./member-surfaces.js";

const mkRef = (name: string, resolvedClrType?: string): IrType => ({
  kind: "referenceType",
  name,
  resolvedClrType,
});

const withContext = (
  patch: Partial<EmitterContext>
): EmitterContext => ({
  ...createContext({ rootNamespace: "Test" }),
  ...patch,
});

describe("member-surfaces", () => {
  it("maps member kinds to naming buckets", () => {
    expect(typeMemberKindToBucket("method")).to.equal("methods");
    expect(typeMemberKindToBucket("field")).to.equal("fields");
    expect(typeMemberKindToBucket("enumMember")).to.equal("enumMembers");
    expect(typeMemberKindToBucket("property")).to.equal("properties");
    expect(typeMemberKindToBucket(undefined)).to.equal("properties");
  });

  it("resolves local enum members by identifier name fallback", () => {
    const context = withContext({
      localTypes: new Map([
        [
          "Color",
          {
            kind: "enum",
            members: ["Red", "Blue"],
          },
        ],
      ]),
    });

    expect(resolveTypeMemberKind(undefined, "Red", context, "Color")).to.equal(
      "enumMember"
    );
    expect(lookupLocalTypeMemberKind("Color", "Blue", context)).to.equal(
      "enumMember"
    );
  });

  it("resolves local object-alias members without the type index", () => {
    const context = withContext({
      localTypes: new Map([
        [
          "Shape",
          {
            kind: "typeAlias",
            typeParameters: [],
            type: {
              kind: "objectType",
              members: [
                {
                  kind: "propertySignature",
                  name: "label",
                  type: { kind: "primitiveType", name: "string" },
                  isOptional: false,
                  isReadonly: false,
                },
              ],
            },
          },
        ],
      ]),
    });

    expect(resolveTypeMemberKind(mkRef("Shape"), "label", context)).to.equal(
      "property"
    );
  });

  it("resolves indexed member kinds through import bindings", () => {
    const context = withContext({
      importBindings: new Map([
        [
          "Router",
          {
            kind: "type",
            typeAst: identifierType("global::Acme.Http.Router"),
          },
        ],
      ]),
      options: {
        rootNamespace: "Test",
        typeMemberIndex: new Map([
          [
            "Acme.Http.Router",
            new Map([
              ["use", "method"],
              ["stack", "property"],
            ]),
          ],
        ]),
      },
    });

    expect(
      resolveTypeMemberIndexFqn(mkRef("Router"), context, "Router")
    ).to.equal("Acme.Http.Router");
    expect(
      resolveTypeMemberIndexMap(mkRef("Router"), context, "Router")?.get("use")
    ).to.equal("method");
    expect(
      resolveTypeMemberKind(mkRef("Router"), "stack", context, "Router")
    ).to.equal("property");
  });

  it("strips global prefixes from resolved CLR names when consulting the type index", () => {
    const context = withContext({
      options: {
        rootNamespace: "Test",
        typeMemberIndex: new Map([
          [
            "Acme.Http.Router",
            new Map([["use", "method"]]),
          ],
        ]),
      },
    });

    expect(
      resolveTypeMemberIndexFqn(
        mkRef("Router", "global::Acme.Http.Router"),
        context
      )
    ).to.equal("Acme.Http.Router");
    expect(
      resolveTypeMemberKind(
        mkRef("Router", "global::Acme.Http.Router"),
        "use",
        context
      )
    ).to.equal("method");
  });
});
