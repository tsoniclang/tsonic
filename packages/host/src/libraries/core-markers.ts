import type { LibraryDeclaration, LibraryExportIdentity, LibraryMember, LibraryParameter, LibraryPropertyName, LibraryRole, LibrarySignature, LibraryType, LibraryTypeParameter, Presence } from '../model/contract.js';
import { coreTypesIdentity, coreLangIdentity } from './identities.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const sharedRecord = Object.freeze<LibraryTypeParameter>({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord]);

const tType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "T" });

const sharedRecord1 = Object.freeze<LibraryParameter>({ name: "value", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue });

const sharedItems1 = Object.freeze<readonly LibraryParameter[]>([sharedRecord1]);

const literalData = Object.freeze<LibraryType>({ kind: "literal", value: "RawPointer" });

const int32Type = Object.freeze<LibraryType>({ kind: "source-primitive", name: "int32" });

const presentValue = Object.freeze<Presence<LibraryType>>({ kind: "present", value: tType });

const sharedItems2 = Object.freeze<readonly LibraryType[]>([tType]);

const undefinedData = Object.freeze<LibraryType>({ kind: "undefined" });

const pointerType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const presentValue1 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: pointerType });

const sharedRecord2 = Object.freeze<LibraryParameter>({
  name: "pointer",
  type: pointerType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const voidData = Object.freeze<LibraryType>({ kind: "void" });

const sharedItems3 = Object.freeze<readonly LibraryType[]>([pointerType, undefinedData]);

const unionData = Object.freeze<LibraryType>({ kind: "union", types: sharedItems3 });

const booleanData = Object.freeze<LibraryType>({ kind: "boolean" });

const presentValue2 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: booleanData });

const uint32Type = Object.freeze<LibraryType>({ kind: "source-primitive", name: "uint32" });

const presentValue3 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: uint32Type });

const fType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "F" });

const sharedItems4 = Object.freeze<readonly LibraryType[]>([fType]);

const pointerType1 = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems4,
});

const sharedRecord3 = Object.freeze<LibraryParameter>({ name: "value", type: fType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue });

const sharedItems5 = Object.freeze<readonly LibraryParameter[]>([sharedRecord3]);

const sharedRecord4 = Object.freeze<LibraryTypeParameter>({ name: "F", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems6 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord4, sharedRecord]);

const rawPointerType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "RawPointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
});

const sharedItems7 = Object.freeze<readonly LibraryType[]>([rawPointerType, undefinedData]);

const unionData1 = Object.freeze<LibraryType>({ kind: "union", types: sharedItems7 });

export const coreTypeMarkers: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "Pointer",
  name: "Pointer",
  exportName: "Pointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "Pointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "Pointer.__tsonicSourceType",
          parameters: sharedItems1,
          returnType: tType,
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
  id: "RawPointer",
  name: "RawPointer",
  exportName: "RawPointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "RawPointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "RawPointer.__tsonicSourceType",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "value",
              type: literalData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: literalData,
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
  id: "FunctionPointer",
  name: "FunctionPointer",
  exportName: "FunctionPointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: Object.freeze<readonly LibraryTypeParameter[]>([
    Object.freeze<LibraryTypeParameter>({ name: "TArgs", constraints: emptyItems, defaultType: noValue, variance: "invariant" }),
    Object.freeze<LibraryTypeParameter>({ name: "TReturn", constraints: emptyItems, defaultType: noValue, variance: "invariant" }),
  ]),
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "FunctionPointer.__tsonicSourceType",
      name: "__tsonicSourceType",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "FunctionPointer.__tsonicSourceType",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "value",
              type: Object.freeze<LibraryType>({ kind: "type-parameter", name: "TArgs" }),
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: Object.freeze<LibraryType>({ kind: "type-parameter", name: "TReturn" }),
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
  id: "FixedArray",
  name: "FixedArray",
  exportName: "FixedArray",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: Object.freeze<readonly LibraryTypeParameter[]>([
    sharedRecord,
    Object.freeze<LibraryTypeParameter>({
      name: "TLength",
      constraints: Object.freeze<readonly LibraryType[]>([
        Object.freeze<LibraryType>({
          kind: "union",
          types: Object.freeze<readonly LibraryType[]>([
            Object.freeze<LibraryType>({ kind: "number" }),
            Object.freeze<LibraryType>({ kind: "bigint" }),
          ]),
        }),
      ]),
      defaultType: noValue,
      variance: "invariant",
    }),
  ]),
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "FixedArray.index",
      name: "index",
      kind: "indexer",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "FixedArray.index(number)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "index",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "FixedArray.length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({ kind: "present", value: int32Type }),
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "FixedArray.iterator",
      name: Object.freeze<LibraryPropertyName>({ kind: "well-known-symbol", name: "iterator" }),
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "FixedArray.iterator()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: Object.freeze<Presence<LibraryType>>({
            kind: "present",
            value: Object.freeze<LibraryType>({ kind: "source-global", name: "Iterator", typeArguments: sharedItems2 }),
          }),
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

export const coreCallMarkers: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "writeonlyref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "readwriteref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "readonlyref(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "sharedborrow(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "mutableborrow(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "move(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "struct(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "field<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "defaultvalue<T>()",
      name: noValue,
      accessibility: "public",
      parameters: emptyItems,
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "addressof<T>(storage)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "storage",
          type: Object.freeze<LibraryType>({ kind: "union", types: Object.freeze<readonly LibraryType[]>([tType, undefinedData]) }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "allocateptr<T>(initial)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "initial",
          type: tType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "loadptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord2]),
      returnType: presentValue,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "storeptr<T>(pointer,value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord2, sharedRecord1]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: voidData }),
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "equalptr<T>(left,right)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "left",
          type: unionData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "right",
          type: unionData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue2,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "hashptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "pointer",
          type: unionData,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue3,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "bindptr<T>(identity,read,write)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "identity",
          type: Object.freeze<LibraryType>({ kind: "object" }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "read",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "bindptr.read",
            parameters: emptyItems,
            returnType: tType,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "write",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "bindptr.write",
            parameters: sharedItems1,
            returnType: voidData,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "projectptr<F,T>(pointer,fromSource,toSource)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "pointer",
          type: pointerType1,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "fromSource",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "projectptr.defined.fromSource",
            parameters: sharedItems5,
            returnType: tType,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "toSource",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "projectptr.defined.toSource",
            parameters: sharedItems1,
            returnType: fType,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue1,
      typeParameters: sharedItems6,
      documentation: noValue,
    }),
    Object.freeze<LibrarySignature>({
      id: "projectptr<F,T>(pointer?,fromSource,toSource)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "pointer",
          type: Object.freeze<LibraryType>({ kind: "union", types: Object.freeze<readonly LibraryType[]>([pointerType1, undefinedData]) }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "fromSource",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "projectptr.optional.fromSource",
            parameters: sharedItems5,
            returnType: tType,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "toSource",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "projectptr.optional.toSource",
            parameters: sharedItems1,
            returnType: fType,
            typeParameters: emptyItems,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: unionData }),
      typeParameters: sharedItems6,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "equalrawptr(left,right)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "left",
          type: unionData1,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "right",
          type: unionData1,
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
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "hashrawptr(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "pointer",
          type: unionData1,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue3,
      typeParameters: emptyItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
]);

export const coreMarkerRoles: readonly [LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole] = Object.freeze<readonly [LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole, LibraryRole]>([
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreTypesIdentity, exportId: "Pointer", memberId: noValue, signatureId: noValue }),
  role: "pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreTypesIdentity, exportId: "RawPointer", memberId: noValue, signatureId: noValue }),
  role: "raw-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreTypesIdentity, exportId: "FunctionPointer", memberId: noValue, signatureId: noValue }),
  role: "function-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreTypesIdentity, exportId: "FixedArray", memberId: noValue, signatureId: noValue }),
  role: "fixed-array",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "writeonlyref", memberId: noValue, signatureId: noValue }),
  role: "write-only-reference",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "readwriteref", memberId: noValue, signatureId: noValue }),
  role: "read-write-reference",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "readonlyref", memberId: noValue, signatureId: noValue }),
  role: "read-only-reference",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "sharedborrow", memberId: noValue, signatureId: noValue }),
  role: "shared-borrow",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "mutableborrow", memberId: noValue, signatureId: noValue }),
  role: "mutable-borrow",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "move", memberId: noValue, signatureId: noValue }),
  role: "move",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "struct", memberId: noValue, signatureId: noValue }),
  role: "struct",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "field", memberId: noValue, signatureId: noValue }),
  role: "field",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "attribute", memberId: noValue, signatureId: noValue }),
  role: "attribute",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "defaultvalue", memberId: noValue, signatureId: noValue }),
  role: "default-value",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "addressof", memberId: noValue, signatureId: noValue }),
  role: "address-of",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "allocateptr", memberId: noValue, signatureId: noValue }),
  role: "allocate",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "loadptr", memberId: noValue, signatureId: noValue }),
  role: "load",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "storeptr", memberId: noValue, signatureId: noValue }),
  role: "store",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "equalptr", memberId: noValue, signatureId: noValue }),
  role: "equal-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "hashptr", memberId: noValue, signatureId: noValue }),
  role: "hash-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "bindptr", memberId: noValue, signatureId: noValue }),
  role: "bind-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "projectptr", memberId: noValue, signatureId: noValue }),
  role: "project-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "equalrawptr", memberId: noValue, signatureId: noValue }),
  role: "equal-raw-pointer",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: coreLangIdentity, exportId: "hashrawptr", memberId: noValue, signatureId: noValue }),
  role: "hash-raw-pointer",
}),
]);
