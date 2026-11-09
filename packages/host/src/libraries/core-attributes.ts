import type { LibraryDeclaration, LibraryMember, LibraryParameter, LibrarySignature, LibraryType, LibraryTypeParameter, Presence } from '../model/contract.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const sharedRecord = Object.freeze<LibraryTypeParameter>({ name: "TOwner", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord]);

const presentValue = Object.freeze<Presence<string>>({ kind: "present", value: "add" });

const unknownData = Object.freeze<LibraryType>({ kind: "unknown" });

const voidData = Object.freeze<LibraryType>({ kind: "void" });

const presentValue1 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: voidData });

const tOwnerType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "TOwner" });

const sharedRecord1 = Object.freeze<LibraryParameter>({
  name: "target",
  type: tOwnerType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedItems1 = Object.freeze<readonly LibraryParameter[]>([sharedRecord1]);

const sharedItems2 = Object.freeze<readonly LibraryType[]>([tOwnerType]);

const __TsonicAttributeMemberBuilderType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicAttributeMemberBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const presentValue2 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: __TsonicAttributeMemberBuilderType });

const stringData = Object.freeze<LibraryType>({ kind: "string" });

export const coreAttributeDeclarations: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "attribute",
  name: "attribute",
  exportName: "attribute",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "attribute<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/lang.js",
          exportName: "__TsonicAttributeBuilder",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: Object.freeze<readonly LibraryType[]>([Object.freeze<LibraryType>({ kind: "type-parameter", name: "T" })]),
        }),
      }),
      typeParameters: Object.freeze<readonly LibraryTypeParameter[]>([
        Object.freeze<LibraryTypeParameter>({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" }),
      ]),
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicAttributeBuilder",
  name: "__TsonicAttributeBuilder",
  exportName: "__TsonicAttributeBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeBuilder.add",
      name: "add",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeBuilder.add",
          name: presentValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "invocation",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicAttributeBuilder.add.invocation",
                parameters: emptyItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeBuilder.property",
      name: "property",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeBuilder.property",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "property" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "selector",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicAttributeBuilder.property.selector",
                parameters: sharedItems1,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeBuilder.method",
      name: "method",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeBuilder.method",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "method" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "selector",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicAttributeBuilder.method.selector",
                parameters: sharedItems1,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: false,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "__TsonicAttributeBuilder.constructor()",
          parameters: emptyItems,
          returnType: __TsonicAttributeMemberBuilderType,
          typeParameters: emptyItems,
        }),
      }),
      signatures: emptyItems,
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicAttributeMemberBuilder",
  name: "__TsonicAttributeMemberBuilder",
  exportName: "__TsonicAttributeMemberBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeMemberBuilder.add",
      name: "add",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeMemberBuilder.add",
          name: presentValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "invocation",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicAttributeMemberBuilder.add.invocation",
                parameters: emptyItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeMemberBuilder.parameter",
      name: "parameter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeMemberBuilder.parameter",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "parameter" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "name",
              type: stringData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeMemberBuilder.target",
      name: "target",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicAttributeMemberBuilder.target",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "target" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "specifier",
              type: stringData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicAttributeMemberBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({ kind: "present", value: Object.freeze<LibraryType>({ kind: "never" }) }),
      signatures: emptyItems,
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
]);
