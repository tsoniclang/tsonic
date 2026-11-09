import type { LibraryDeclaration, LibraryRole } from '../model/contract.js';
import { coreTypesIdentity, coreLangIdentity } from './identities.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const sharedRecord = Object.freeze({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const tType = Object.freeze({ kind: "type-parameter", name: "T" } as const);

const sharedRecord1 = Object.freeze({ name: "value", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems1 = Object.freeze([sharedRecord1] as const);

const literalData = Object.freeze({ kind: "literal", value: "RawPointer" } as const);

const int32Type = Object.freeze({ kind: "source-primitive", name: "int32" } as const);

const presentValue = Object.freeze({ kind: "present", value: tType } as const);

const sharedItems2 = Object.freeze([tType] as const);

const undefinedData = Object.freeze({ kind: "undefined" } as const);

const pointerType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const presentValue1 = Object.freeze({ kind: "present", value: pointerType } as const);

const sharedRecord2 = Object.freeze({ name: "pointer", type: pointerType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const voidData = Object.freeze({ kind: "void" } as const);

const sharedItems3 = Object.freeze([pointerType, undefinedData] as const);

const unionData = Object.freeze({ kind: "union", types: sharedItems3 } as const);

const booleanData = Object.freeze({ kind: "boolean" } as const);

const presentValue2 = Object.freeze({ kind: "present", value: booleanData } as const);

const uint32Type = Object.freeze({ kind: "source-primitive", name: "uint32" } as const);

const presentValue3 = Object.freeze({ kind: "present", value: uint32Type } as const);

const fType = Object.freeze({ kind: "type-parameter", name: "F" } as const);

const sharedItems4 = Object.freeze([fType] as const);

const pointerType1 = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems4,
} as const);

const sharedRecord3 = Object.freeze({ name: "value", type: fType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems5 = Object.freeze([sharedRecord3] as const);

const sharedRecord4 = Object.freeze({ name: "F", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems6 = Object.freeze([sharedRecord4, sharedRecord] as const);

const rawPointerType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "RawPointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
} as const);

const sharedItems7 = Object.freeze([rawPointerType, undefinedData] as const);

const unionData1 = Object.freeze({ kind: "union", types: sharedItems7 } as const);

export const coreTypeMarkers: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "Pointer",
  name: "Pointer",
  exportName: "Pointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "Pointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "Pointer.__tsonicSourceType",
          parameters: sharedItems1,
          returnType: tType,
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
  id: "RawPointer",
  name: "RawPointer",
  exportName: "RawPointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "RawPointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "RawPointer.__tsonicSourceType",
          parameters: Object.freeze([
            Object.freeze({
              name: "value",
              type: literalData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: literalData,
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
  id: "FunctionPointer",
  name: "FunctionPointer",
  exportName: "FunctionPointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: Object.freeze([
    Object.freeze({ name: "TArgs", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const),
    Object.freeze({ name: "TReturn", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const),
  ] as const),
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "FunctionPointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "FunctionPointer.__tsonicSourceType",
          parameters: Object.freeze([
            Object.freeze({
              name: "value",
              type: Object.freeze({ kind: "type-parameter", name: "TArgs" } as const),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: Object.freeze({ kind: "type-parameter", name: "TReturn" } as const),
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
  id: "FixedArray",
  name: "FixedArray",
  exportName: "FixedArray",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: Object.freeze([
    sharedRecord,
    Object.freeze({
      name: "TLength",
      constraints: Object.freeze([
        Object.freeze({
          kind: "union",
          types: Object.freeze([Object.freeze({ kind: "number" } as const), Object.freeze({ kind: "bigint" } as const)] as const),
        } as const),
      ] as const),
      defaultType: noValue,
      variance: "invariant",
    } as const),
  ] as const),
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "FixedArray.index",
      name: "index",
      kind: "indexer",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "FixedArray.index(number)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "index",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "FixedArray.length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: int32Type } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "FixedArray.iterator",
      name: Object.freeze({ kind: "well-known-symbol", name: "iterator" } as const),
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "FixedArray.iterator()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: Object.freeze({
            kind: "present",
            value: Object.freeze({ kind: "source-global", name: "Iterator", typeArguments: sharedItems2 } as const),
          } as const),
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

export const coreCallMarkers: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "writeonlyref",
  name: "writeonlyref",
  exportName: "writeonlyref",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "writeonlyref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "readwriteref",
  name: "readwriteref",
  exportName: "readwriteref",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "readwriteref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "readonlyref",
  name: "readonlyref",
  exportName: "readonlyref",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "readonlyref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "sharedborrow",
  name: "sharedborrow",
  exportName: "sharedborrow",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "sharedborrow(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "mutableborrow",
  name: "mutableborrow",
  exportName: "mutableborrow",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "mutableborrow(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "move",
  name: "move",
  exportName: "move",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "move(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "struct",
  name: "struct",
  exportName: "struct",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "struct(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "field",
  name: "field",
  exportName: "field",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "field<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "defaultvalue",
  name: "defaultvalue",
  exportName: "defaultvalue",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "defaultvalue<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "addressof",
  name: "addressof",
  exportName: "addressof",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "addressof<T>(storage)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "storage",
          type: Object.freeze({ kind: "union", types: Object.freeze([tType, undefinedData] as const) } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "allocateptr",
  name: "allocateptr",
  exportName: "allocateptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "allocateptr<T>(initial)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "initial", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "loadptr",
  name: "loadptr",
  exportName: "loadptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "loadptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord2] as const),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "storeptr",
  name: "storeptr",
  exportName: "storeptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "storeptr<T>(pointer,value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord2, sharedRecord1] as const),
      returnType: Object.freeze({ kind: "present", value: voidData } as const),
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "equalptr",
  name: "equalptr",
  exportName: "equalptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "equalptr<T>(left,right)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "left", type: unionData, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
        Object.freeze({ name: "right", type: unionData, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue2,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "hashptr",
  name: "hashptr",
  exportName: "hashptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "hashptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "pointer",
          type: unionData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue3,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "bindptr",
  name: "bindptr",
  exportName: "bindptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "bindptr<T>(identity,read,write)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "identity",
          type: Object.freeze({ kind: "object" } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "read",
          type: Object.freeze({
            kind: "function",
            id: "bindptr.read",
            parameters: emptyItems,
            returnType: tType,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "write",
          type: Object.freeze({
            kind: "function",
            id: "bindptr.write",
            parameters: sharedItems1,
            returnType: voidData,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "projectptr",
  name: "projectptr",
  exportName: "projectptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "projectptr<F,T>(pointer,fromSource,toSource)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "pointer",
          type: pointerType1,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "fromSource",
          type: Object.freeze({
            kind: "function",
            id: "projectptr.defined.fromSource",
            parameters: sharedItems5,
            returnType: tType,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "toSource",
          type: Object.freeze({
            kind: "function",
            id: "projectptr.defined.toSource",
            parameters: sharedItems1,
            returnType: fType,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue1,
      typeParameters: sharedItems6,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "projectptr<F,T>(pointer?,fromSource,toSource)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "pointer",
          type: Object.freeze({ kind: "union", types: Object.freeze([pointerType1, undefinedData] as const) } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "fromSource",
          type: Object.freeze({
            kind: "function",
            id: "projectptr.optional.fromSource",
            parameters: sharedItems5,
            returnType: tType,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "toSource",
          type: Object.freeze({
            kind: "function",
            id: "projectptr.optional.toSource",
            parameters: sharedItems1,
            returnType: fType,
            typeParameters: emptyItems,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: unionData } as const),
      typeParameters: sharedItems6,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "equalrawptr",
  name: "equalrawptr",
  exportName: "equalrawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "equalrawptr(left,right)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "left", type: unionData1, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
        Object.freeze({ name: "right", type: unionData1, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue2,
      typeParameters: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "hashrawptr",
  name: "hashrawptr",
  exportName: "hashrawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "hashrawptr(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "pointer",
          type: unionData1,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue3,
      typeParameters: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
]);

export const coreMarkerRoles: readonly LibraryRole[] = Object.freeze([
  Object.freeze({
  identity: Object.freeze({ module: coreTypesIdentity, exportId: "Pointer", memberId: noValue, signatureId: noValue } as const),
  role: "pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreTypesIdentity, exportId: "RawPointer", memberId: noValue, signatureId: noValue } as const),
  role: "raw-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreTypesIdentity, exportId: "FunctionPointer", memberId: noValue, signatureId: noValue } as const),
  role: "function-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreTypesIdentity, exportId: "FixedArray", memberId: noValue, signatureId: noValue } as const),
  role: "fixed-array",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "writeonlyref", memberId: noValue, signatureId: noValue } as const),
  role: "write-only-reference",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "readwriteref", memberId: noValue, signatureId: noValue } as const),
  role: "read-write-reference",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "readonlyref", memberId: noValue, signatureId: noValue } as const),
  role: "read-only-reference",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "sharedborrow", memberId: noValue, signatureId: noValue } as const),
  role: "shared-borrow",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "mutableborrow", memberId: noValue, signatureId: noValue } as const),
  role: "mutable-borrow",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "move", memberId: noValue, signatureId: noValue } as const),
  role: "move",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "struct", memberId: noValue, signatureId: noValue } as const),
  role: "struct",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "field", memberId: noValue, signatureId: noValue } as const),
  role: "field",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "attribute", memberId: noValue, signatureId: noValue } as const),
  role: "attribute",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "defaultvalue", memberId: noValue, signatureId: noValue } as const),
  role: "default-value",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "addressof", memberId: noValue, signatureId: noValue } as const),
  role: "address-of",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "allocateptr", memberId: noValue, signatureId: noValue } as const),
  role: "allocate",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "loadptr", memberId: noValue, signatureId: noValue } as const),
  role: "load",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "storeptr", memberId: noValue, signatureId: noValue } as const),
  role: "store",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "equalptr", memberId: noValue, signatureId: noValue } as const),
  role: "equal-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "hashptr", memberId: noValue, signatureId: noValue } as const),
  role: "hash-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "bindptr", memberId: noValue, signatureId: noValue } as const),
  role: "bind-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "projectptr", memberId: noValue, signatureId: noValue } as const),
  role: "project-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "equalrawptr", memberId: noValue, signatureId: noValue } as const),
  role: "equal-raw-pointer",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: coreLangIdentity, exportId: "hashrawptr", memberId: noValue, signatureId: noValue } as const),
  role: "hash-raw-pointer",
} as const),
]);
