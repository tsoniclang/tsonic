import type { LibraryDeclaration } from '../model/contract.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const voidData = Object.freeze({ kind: "void" } as const);

const presentValue = Object.freeze({ kind: "present", value: voidData } as const);

const tType = Object.freeze({ kind: "type-parameter", name: "T" } as const);

const tOwnerType = Object.freeze({ kind: "type-parameter", name: "TOwner" } as const);

const sharedRecord = Object.freeze({ name: "target", type: tOwnerType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const sharedItems1 = Object.freeze([tOwnerType] as const);

const __TsonicSafetyBuilderType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicSafetyBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems1,
} as const);

const presentValue1 = Object.freeze({ kind: "present", value: __TsonicSafetyBuilderType } as const);

const sharedRecord1 = Object.freeze({ name: "TOwner", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems2 = Object.freeze([sharedRecord1] as const);

const presentValue2 = Object.freeze({ kind: "present", value: "requiresunsafe" } as const);

const presentValue3 = Object.freeze({ kind: "present", value: "safe" } as const);

const unknownData = Object.freeze({ kind: "unknown" } as const);

const __TsonicSafetyMemberBuilderType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicSafetyMemberBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems1,
} as const);

const presentValue4 = Object.freeze({ kind: "present", value: __TsonicSafetyMemberBuilderType } as const);

export const coreSafetyDeclarations: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
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
  signatures: Object.freeze([
    Object.freeze({
      id: "unsafecontext()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "unsafecontext<T>(expression)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "expression", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: tType } as const),
      typeParameters: Object.freeze([Object.freeze({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const)] as const),
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
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
  signatures: Object.freeze([
    Object.freeze({
      id: "safety(target)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems,
      returnType: presentValue1,
      typeParameters: sharedItems2,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "safety<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue1,
      typeParameters: sharedItems2,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "__TsonicSafetyBuilder",
  name: "__TsonicSafetyBuilder",
  exportName: "__TsonicSafetyBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems2,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicSafetyBuilder.requiresunsafe",
      name: "requiresunsafe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyBuilder.requiresunsafe",
          name: presentValue2,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyBuilder.safe",
      name: "safe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyBuilder.safe",
          name: presentValue3,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyBuilder.method",
      name: "method",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyBuilder.method",
          name: Object.freeze({ kind: "present", value: "method" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "selector",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicSafetyBuilder.method.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyBuilder.property",
      name: "property",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyBuilder.property",
          name: Object.freeze({ kind: "present", value: "property" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "selector",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicSafetyBuilder.property.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyBuilder.indexer",
      name: "indexer",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyBuilder.indexer",
          name: Object.freeze({ kind: "present", value: "indexer" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "selector",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicSafetyBuilder.indexer.selector",
                parameters: sharedItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "__TsonicSafetyBuilder.constructor",
          parameters: emptyItems,
          returnType: __TsonicSafetyMemberBuilderType,
          typeParameters: emptyItems,
        } as const),
      } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
  Object.freeze({
  id: "__TsonicSafetyMemberBuilder",
  name: "__TsonicSafetyMemberBuilder",
  exportName: "__TsonicSafetyMemberBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems2,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicSafetyMemberBuilder.requiresunsafe",
      name: "requiresunsafe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyMemberBuilder.requiresunsafe",
          name: presentValue2,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyMemberBuilder.safe",
      name: "safe",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyMemberBuilder.safe",
          name: presentValue3,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyMemberBuilder.getter",
      name: "getter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyMemberBuilder.getter",
          name: Object.freeze({ kind: "present", value: "getter" } as const),
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicSafetyMemberBuilder.setter",
      name: "setter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicSafetyMemberBuilder.setter",
          name: Object.freeze({ kind: "present", value: "setter" } as const),
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue4,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
]);
