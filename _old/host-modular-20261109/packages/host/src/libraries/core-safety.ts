import type { LibraryDeclaration, LibraryMember, LibraryParameter, LibrarySignature, LibraryType, LibraryTypeParameter, Presence } from '../model/contract.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const voidData = Object.freeze<LibraryType>({ kind: "void" });

const presentValue = Object.freeze<Presence<LibraryType>>({ kind: "present", value: voidData });

const tType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "T" });

const tOwnerType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "TOwner" });

const sharedRecord = Object.freeze<LibraryParameter>({
  name: "target",
  type: tOwnerType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedItems = Object.freeze<readonly LibraryParameter[]>([sharedRecord]);

const sharedItems1 = Object.freeze<readonly LibraryType[]>([tOwnerType]);

const __TsonicSafetyBuilderType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicSafetyBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems1,
});

const presentValue1 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: __TsonicSafetyBuilderType });

const sharedRecord1 = Object.freeze<LibraryTypeParameter>({ name: "TOwner", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems2 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord1]);

const presentValue2 = Object.freeze<Presence<string>>({ kind: "present", value: "requiresunsafe" });

const presentValue3 = Object.freeze<Presence<string>>({ kind: "present", value: "safe" });

const unknownData = Object.freeze<LibraryType>({ kind: "unknown" });

const __TsonicSafetyMemberBuilderType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicSafetyMemberBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems1,
});

const presentValue4 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: __TsonicSafetyMemberBuilderType });

export const coreSafetyDeclarations: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "unsafecontext",
  name: "unsafecontext",
  exportName: "unsafecontext",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "unsafecontext()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibrarySignature>({
      id: "unsafecontext<T>(expression)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "expression",
          type: tType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: tType }),
      typeParameters: Object.freeze<readonly LibraryTypeParameter[]>([
        Object.freeze<LibraryTypeParameter>({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" }),
      ]),
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "safety",
  name: "safety",
  exportName: "safety",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "safety(target)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems,
      returnType: presentValue1,
      typeParameters: sharedItems2,
      documentation: noValue,
    }),
    Object.freeze<LibrarySignature>({
      id: "safety<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue1,
      typeParameters: sharedItems2,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicSafetyBuilder",
  name: "__TsonicSafetyBuilder",
  exportName: "__TsonicSafetyBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems2,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.requiresunsafe",
      name: "requiresunsafe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyBuilder.requiresunsafe",
          name: presentValue2,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.safe",
      name: "safe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyBuilder.safe",
          name: presentValue3,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.method",
      name: "method",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyBuilder.method",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "method" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "selector",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicSafetyBuilder.method.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.property",
      name: "property",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyBuilder.property",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "property" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "selector",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicSafetyBuilder.property.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.indexer",
      name: "indexer",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyBuilder.indexer",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "indexer" }),
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "selector",
              type: Object.freeze<LibraryType>({
                kind: "function",
                id: "__TsonicSafetyBuilder.indexer.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "__TsonicSafetyBuilder.constructor",
          parameters: emptyItems,
          returnType: __TsonicSafetyMemberBuilderType,
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
  id: "__TsonicSafetyMemberBuilder",
  name: "__TsonicSafetyMemberBuilder",
  exportName: "__TsonicSafetyMemberBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems2,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyMemberBuilder.requiresunsafe",
      name: "requiresunsafe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyMemberBuilder.requiresunsafe",
          name: presentValue2,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyMemberBuilder.safe",
      name: "safe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyMemberBuilder.safe",
          name: presentValue3,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyMemberBuilder.getter",
      name: "getter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyMemberBuilder.getter",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "getter" }),
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicSafetyMemberBuilder.setter",
      name: "setter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "__TsonicSafetyMemberBuilder.setter",
          name: Object.freeze<Presence<string>>({ kind: "present", value: "setter" }),
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
]);
