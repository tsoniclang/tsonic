import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "../types/index.js";
import {
  POLYMORPHIC_THIS_MARKER,
  substitutePolymorphicThis,
} from "./call-resolution-type-ids.js";

describe("call resolution type ids", () => {
  describe("substitutePolymorphicThis", () => {
    it("preserves recursive structural reference graphs", () => {
      const receiverType: IrType = {
        kind: "referenceType",
        name: "Receiver",
        structuralMembers: [],
      };

      const recursiveType = {
        kind: "referenceType",
        name: "Recursive",
        structuralMembers: [],
      } as unknown as Extract<IrType, { kind: "referenceType" }> & {
        structuralMembers: unknown[];
      };

      recursiveType.structuralMembers = [
        {
          kind: "propertySignature",
          name: "self",
          isReadonly: false,
          isOptional: false,
          type: recursiveType,
        },
        {
          kind: "propertySignature",
          name: "value",
          isReadonly: false,
          isOptional: false,
          type: {
            kind: "typeParameterType",
            name: POLYMORPHIC_THIS_MARKER,
          },
        },
        {
          kind: "methodSignature",
          name: "next",
          parameters: [],
          returnType: recursiveType,
        },
      ];

      const substituted = substitutePolymorphicThis(recursiveType, receiverType);

      expect(substituted).to.not.equal(undefined);
      expect(substituted?.kind).to.equal("referenceType");

      const reference = substituted as Extract<IrType, { kind: "referenceType" }>;
      const selfMember = reference.structuralMembers?.[0];
      const valueMember = reference.structuralMembers?.[1];
      const nextMember = reference.structuralMembers?.[2];

      expect(selfMember?.kind).to.equal("propertySignature");
      expect(valueMember?.kind).to.equal("propertySignature");
      expect(nextMember?.kind).to.equal("methodSignature");

      if (
        selfMember?.kind !== "propertySignature" ||
        valueMember?.kind !== "propertySignature" ||
        nextMember?.kind !== "methodSignature"
      ) {
        throw new Error("Expected recursive structural members to be preserved");
      }

      expect(selfMember.type).to.equal(reference);
      expect(valueMember.type).to.equal(receiverType);
      expect(nextMember.returnType).to.equal(reference);
    });
  });
});
