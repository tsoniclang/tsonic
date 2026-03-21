import {
  describe,
  it,
  expect,
  isTypeOnlyStructuralTarget,
  type EmitterContext,
  type EmitterOptions,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("isTypeOnlyStructuralTarget", () => {
    const defaultOptions: EmitterOptions = {
      rootNamespace: "Test",
      indent: 4,
    };

    const createContext = (
      localTypes: ReadonlyMap<string, LocalTypeInfo>
    ): EmitterContext => ({
      indentLevel: 0,
      options: defaultOptions,
      isStatic: false,
      isAsync: false,
      localTypes,
      usings: new Set<string>(),
    });

    it("treats compiler-generated anonymous carrier classes as structural", () => {
      const context = createContext(
        new Map([
          [
            "__Anon_handler",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "__Anon_handler",
            resolvedClrType: "Test.__Anon_handler",
          },
          context
        )
      ).to.equal(true);
    });

    it("treats compiler-generated rest carrier classes as structural", () => {
      const context = createContext(
        new Map([
          [
            "__Rest_handler",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "__Rest_handler",
            resolvedClrType: "Test.__Rest_handler",
          },
          context
        )
      ).to.equal(true);
    });

    it("preserves user-authored nominal classes as runtime cast targets", () => {
      const context = createContext(
        new Map([
          [
            "Animal",
            {
              kind: "class",
              typeParameters: [],
              members: [],
              implements: [],
            },
          ],
        ])
      );

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "referenceType",
            name: "Animal",
            resolvedClrType: "Test.Animal",
          },
          context
        )
      ).to.equal(false);
    });

    it("treats dictionary targets as structural runtime-erased assertion targets", () => {
      const context = createContext(new Map());

      expect(
        isTypeOnlyStructuralTarget(
          {
            kind: "dictionaryType",
            keyType: { kind: "primitiveType", name: "string" },
            valueType: { kind: "unknownType" },
          },
          context
        )
      ).to.equal(true);
    });
  });
});
