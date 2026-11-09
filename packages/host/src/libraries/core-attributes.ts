import type { LibraryDeclaration } from '../model/contract.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const sharedRecord = Object.freeze({ name: "TOwner", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const presentValue = Object.freeze({ kind: "present", value: "add" } as const);

const unknownData = Object.freeze({ kind: "unknown" } as const);

const voidData = Object.freeze({ kind: "void" } as const);

const presentValue1 = Object.freeze({ kind: "present", value: voidData } as const);

const tOwnerType = Object.freeze({ kind: "type-parameter", name: "TOwner" } as const);

const sharedRecord1 = Object.freeze({ name: "target", type: tOwnerType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems1 = Object.freeze([sharedRecord1] as const);

const sharedItems2 = Object.freeze([tOwnerType] as const);

const __TsonicAttributeMemberBuilderType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/lang.js",
  exportName: "__TsonicAttributeMemberBuilder",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const presentValue2 = Object.freeze({ kind: "present", value: __TsonicAttributeMemberBuilderType } as const);

const stringData = Object.freeze({ kind: "string" } as const);

export const coreAttributeDeclarations: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
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
  signatures: Object.freeze([
    Object.freeze({
      id: "attribute<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/lang.js",
          exportName: "__TsonicAttributeBuilder",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: Object.freeze([Object.freeze({ kind: "type-parameter", name: "T" } as const)] as const),
        } as const),
      } as const),
      typeParameters: Object.freeze([Object.freeze({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const)] as const),
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "__TsonicAttributeBuilder",
  name: "__TsonicAttributeBuilder",
  exportName: "__TsonicAttributeBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicAttributeBuilder.add",
      name: "add",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeBuilder.add",
          name: presentValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "invocation",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicAttributeBuilder.add.invocation",
                parameters: emptyItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeBuilder.property",
      name: "property",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeBuilder.property",
          name: Object.freeze({ kind: "present", value: "property" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "selector",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicAttributeBuilder.property.selector",
                parameters: sharedItems1,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeBuilder.method",
      name: "method",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeBuilder.method",
          name: Object.freeze({ kind: "present", value: "method" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "selector",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicAttributeBuilder.method.selector",
                parameters: sharedItems1,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: false,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "__TsonicAttributeBuilder.constructor()",
          parameters: emptyItems,
          returnType: __TsonicAttributeMemberBuilderType,
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
  id: "__TsonicAttributeMemberBuilder",
  name: "__TsonicAttributeMemberBuilder",
  exportName: "__TsonicAttributeMemberBuilder",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicAttributeMemberBuilder.add",
      name: "add",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeMemberBuilder.add",
          name: presentValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "invocation",
              type: Object.freeze({
                kind: "function",
                id: "__TsonicAttributeMemberBuilder.add.invocation",
                parameters: emptyItems,
                returnType: unknownData,
                typeParameters: emptyItems,
              } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeMemberBuilder.parameter",
      name: "parameter",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeMemberBuilder.parameter",
          name: Object.freeze({ kind: "present", value: "parameter" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "name",
              type: stringData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeMemberBuilder.target",
      name: "target",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "__TsonicAttributeMemberBuilder.target",
          name: Object.freeze({ kind: "present", value: "target" } as const),
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "specifier",
              type: stringData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicAttributeMemberBuilder.constructor",
      name: "constructor",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: Object.freeze({ kind: "never" } as const) } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
]);
