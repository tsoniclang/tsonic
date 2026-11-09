import type { LibraryDeclaration } from '../model/contract.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const sharedRecord = Object.freeze({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const tType = Object.freeze({ kind: "type-parameter", name: "T" } as const);

const sharedRecord1 = Object.freeze({ name: "value", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems1 = Object.freeze([sharedRecord1] as const);

const dataLayoutType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "DataLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
} as const);

const presentValue = Object.freeze({ kind: "present", value: dataLayoutType } as const);

const nativeuintType = Object.freeze({ kind: "source-primitive", name: "native-uint" } as const);

const presentValue1 = Object.freeze({ kind: "present", value: nativeuintType } as const);

const sharedItems2 = Object.freeze([tType] as const);

const memoryFieldLayoutType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryFieldLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const numberData = Object.freeze({ kind: "number" } as const);

const bigintData = Object.freeze({ kind: "bigint" } as const);

const sharedItems3 = Object.freeze([numberData, bigintData] as const);

const unionData = Object.freeze({ kind: "union", types: sharedItems3 } as const);

const sharedItems4 = Object.freeze([unionData] as const);

const sharedRecord2 = Object.freeze({ name: "TLength", constraints: sharedItems4, defaultType: noValue, variance: "invariant" } as const);

const sharedItems5 = Object.freeze([sharedRecord, sharedRecord2] as const);

const memoryLayoutType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const presentValue2 = Object.freeze({ kind: "present", value: memoryLayoutType } as const);

const tLengthType = Object.freeze({ kind: "type-parameter", name: "TLength" } as const);

const sharedRecord3 = Object.freeze({ name: "TField", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems6 = Object.freeze([sharedRecord, sharedRecord3] as const);

const tFieldType = Object.freeze({ kind: "type-parameter", name: "TField" } as const);

const sharedItems7 = Object.freeze([tFieldType] as const);

const pointerType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const undefinedData = Object.freeze({ kind: "undefined" } as const);

const sharedItems8 = Object.freeze([pointerType, undefinedData] as const);

const unionData1 = Object.freeze({ kind: "union", types: sharedItems8 } as const);

const sharedRecord4 = Object.freeze({ name: "layout", type: memoryLayoutType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const rawPointerType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "RawPointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
} as const);

const sharedItems9 = Object.freeze([rawPointerType, undefinedData] as const);

const unionData2 = Object.freeze({ kind: "union", types: sharedItems9 } as const);

const presentValue3 = Object.freeze({ kind: "present", value: unionData2 } as const);

const sharedRecord5 = Object.freeze({ name: "pointer", type: unionData2, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const presentValue4 = Object.freeze({ kind: "present", value: unionData1 } as const);

const sharedRecord6 = Object.freeze({
  name: "dataLayout",
  type: dataLayoutType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
} as const);

const tAddressType = Object.freeze({ kind: "type-parameter", name: "TAddress" } as const);

const sharedRecord7 = Object.freeze({ name: "TAddress", constraints: sharedItems4, defaultType: noValue, variance: "invariant" } as const);

const sharedItems10 = Object.freeze([sharedRecord7] as const);

const sharedItems11 = Object.freeze([tType, tLengthType] as const);

const memoryFieldBindingType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryFieldBinding",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const presentValue5 = Object.freeze({ kind: "present", value: tType } as const);

const sharedItems12 = Object.freeze([sharedRecord4] as const);

const voidData = Object.freeze({ kind: "void" } as const);

const presentValue6 = Object.freeze({ kind: "present", value: voidData } as const);

const fType = Object.freeze({ kind: "type-parameter", name: "F" } as const);

const sharedItems13 = Object.freeze([fType] as const);

const pointerType1 = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems13,
} as const);

const sharedRecord8 = Object.freeze({ name: "F", constraints: emptyItems, defaultType: noValue, variance: "invariant" } as const);

const sharedItems14 = Object.freeze([sharedRecord8, sharedRecord] as const);

const nativePointerType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "NativePointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
} as const);

const sharedRecord9 = Object.freeze({
  name: "pointer",
  type: nativePointerType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
} as const);

export const coreMemoryTypes: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "DataLayout",
  name: "DataLayout",
  exportName: "DataLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "DataLayout.brand",
      name: "__tsonicDataLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: Object.freeze({ kind: "literal", value: "DataLayout" } as const) } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
  Object.freeze({
  id: "MemoryLayout",
  name: "MemoryLayout",
  exportName: "MemoryLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "MemoryLayout.brand",
      name: "__tsonicMemoryLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "MemoryLayout.brand",
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
  id: "MemoryFieldLayout",
  name: "MemoryFieldLayout",
  exportName: "MemoryFieldLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "MemoryFieldLayout.brand",
      name: "__tsonicMemoryFieldLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "MemoryFieldLayout.brand",
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
  id: "MemoryFieldBinding",
  name: "MemoryFieldBinding",
  exportName: "MemoryFieldBinding",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "MemoryFieldBinding.brand",
      name: "__tsonicMemoryFieldBinding",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "MemoryFieldBinding.brand",
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
  id: "NativePointer",
  name: "NativePointer",
  exportName: "NativePointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "NativePointer.__tsonicNativePointer",
      name: "__tsonicNativePointer",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "NativePointer.__tsonicNativePointer",
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
]);

export const coreMemoryOperations: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "__TsonicMemoryLayoutDescriptor",
  name: "__TsonicMemoryLayoutDescriptor",
  exportName: "__TsonicMemoryLayoutDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicMemoryLayoutDescriptor.datalayout",
      name: "datalayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryLayoutDescriptor.bytesize",
      name: "bytesize",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryLayoutDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryLayoutDescriptor.stride",
      name: "stride",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryLayoutDescriptor.fields",
      name: "fields",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: Object.freeze({ kind: "array", elementType: memoryFieldLayoutType } as const) } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
  Object.freeze({
  id: "__TsonicMemoryArrayLayoutDescriptor",
  name: "__TsonicMemoryArrayLayoutDescriptor",
  exportName: "__TsonicMemoryArrayLayoutDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems5,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.datalayout",
      name: "datalayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.bytesize",
      name: "bytesize",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.stride",
      name: "stride",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.elementlayout",
      name: "elementlayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue2,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryArrayLayoutDescriptor.length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: tLengthType } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  signatures: emptyItems,
  documentation: noValue,
} as const),
  Object.freeze({
  id: "__TsonicMemoryFieldDescriptor",
  name: "__TsonicMemoryFieldDescriptor",
  exportName: "__TsonicMemoryFieldDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems6,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__TsonicMemoryFieldDescriptor.select",
      name: "select",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "function",
          id: "memoryfield.selector",
          parameters: sharedItems1,
          returnType: tFieldType,
          typeParameters: emptyItems,
        } as const),
      } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryFieldDescriptor.byteoffset",
      name: "byteoffset",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryFieldDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "__TsonicMemoryFieldDescriptor.fieldlayout",
      name: "fieldlayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/types.js",
          exportName: "MemoryLayout",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: sharedItems7,
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
  id: "torawptr",
  name: "torawptr",
  exportName: "torawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "torawptr<T>(pointer,layout)",
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
        sharedRecord4,
      ] as const),
      returnType: presentValue3,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "reinterpretrawptr",
  name: "reinterpretrawptr",
  exportName: "reinterpretrawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "reinterpretrawptr<T>(pointer,layout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord5, sharedRecord4] as const),
      returnType: presentValue4,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "offsetrawptr",
  name: "offsetrawptr",
  exportName: "offsetrawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "offsetrawptr<TOffset>(pointer,byteOffset,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        sharedRecord5,
        Object.freeze({
          name: "byteOffset",
          type: Object.freeze({ kind: "type-parameter", name: "TOffset" } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        sharedRecord6,
      ] as const),
      returnType: presentValue3,
      typeParameters: Object.freeze([
        Object.freeze({ name: "TOffset", constraints: sharedItems4, defaultType: noValue, variance: "invariant" } as const),
      ] as const),
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "rawptrtoaddressinteger",
  name: "rawptrtoaddressinteger",
  exportName: "rawptrtoaddressinteger",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "rawptrtoaddressinteger<TAddress>(pointer,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord5, sharedRecord6] as const),
      returnType: Object.freeze({ kind: "present", value: tAddressType } as const),
      typeParameters: sharedItems10,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "addressintegertorawptr",
  name: "addressintegertorawptr",
  exportName: "addressintegertorawptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "addressintegertorawptr<TAddress>(address,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "address",
          type: tAddressType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        sharedRecord6,
      ] as const),
      returnType: presentValue3,
      typeParameters: sharedItems10,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "memorylayout",
  name: "memorylayout",
  exportName: "memorylayout",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "memorylayout<T>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "descriptor",
          type: Object.freeze({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryLayoutDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems2,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue2,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "memoryarraylayout",
  name: "memoryarraylayout",
  exportName: "memoryarraylayout",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "memoryarraylayout<T,TLength>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "descriptor",
          type: Object.freeze({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryArrayLayoutDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems11,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({
        kind: "present",
        value: Object.freeze({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/types.js",
          exportName: "MemoryLayout",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: Object.freeze([
            Object.freeze({
              kind: "provider-ref",
              moduleSpecifier: "@tsonic/core/types.js",
              exportName: "FixedArray",
              localName: noValue,
              namespaceImport: noValue,
              typeArguments: sharedItems11,
            } as const),
          ] as const),
        } as const),
      } as const),
      typeParameters: sharedItems5,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "memoryfield",
  name: "memoryfield",
  exportName: "memoryfield",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "memoryfield<T,TField>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "descriptor",
          type: Object.freeze({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryFieldDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: Object.freeze([tType, tFieldType] as const),
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: memoryFieldLayoutType } as const),
      typeParameters: sharedItems6,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "bindmemoryfield",
  name: "bindmemoryfield",
  exportName: "bindmemoryfield",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "bindmemoryfield<T,TField>(field,pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({
          name: "field",
          type: memoryFieldLayoutType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
        Object.freeze({
          name: "pointer",
          type: Object.freeze({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/types.js",
            exportName: "Pointer",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems7,
          } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: memoryFieldBindingType } as const),
      typeParameters: sharedItems6,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "bindmemoryrecord",
  name: "bindmemoryrecord",
  exportName: "bindmemoryrecord",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "bindmemoryrecord<T>(layout,...fields)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        sharedRecord4,
        Object.freeze({
          name: "fields",
          type: Object.freeze({ kind: "array", elementType: memoryFieldBindingType } as const),
          passingMode: "by-value",
          optional: false,
          rest: true,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: presentValue5,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "sizeof",
  name: "sizeof",
  exportName: "sizeof",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "sizeof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "alignof",
  name: "alignof",
  exportName: "alignof",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "alignof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "strideof",
  name: "strideof",
  exportName: "strideof",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "strideof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "fieldoffsetof",
  name: "fieldoffsetof",
  exportName: "fieldoffsetof",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "fieldoffsetof<T,TField>(layout,select)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        sharedRecord4,
        Object.freeze({
          name: "select",
          type: Object.freeze({
            kind: "function",
            id: "fieldoffsetof.selector",
            parameters: sharedItems1,
            returnType: tFieldType,
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
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "keepalive",
  name: "keepalive",
  exportName: "keepalive",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "keepalive<T>(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue6,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "viewptr",
  name: "viewptr",
  exportName: "viewptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "viewptr<F,T>(pointer,read,write)",
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
          name: "read",
          type: Object.freeze({
            kind: "function",
            id: "viewptr.required.read",
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
            id: "viewptr.required.write",
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
      returnType: Object.freeze({ kind: "present", value: pointerType } as const),
      typeParameters: sharedItems14,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "viewptr<F,T>(pointer?,read,write)",
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
          name: "read",
          type: Object.freeze({
            kind: "function",
            id: "viewptr.optional.read",
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
            id: "viewptr.optional.write",
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
      returnType: presentValue4,
      typeParameters: sharedItems14,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "loadnativeptr",
  name: "loadnativeptr",
  exportName: "loadnativeptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "loadnativeptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord9] as const),
      returnType: presentValue5,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "storenativeptr",
  name: "storenativeptr",
  exportName: "storenativeptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "storenativeptr<T>(pointer,value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([sharedRecord9, sharedRecord1] as const),
      returnType: presentValue6,
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
  Object.freeze({
  id: "offsetnativeptr",
  name: "offsetnativeptr",
  exportName: "offsetnativeptr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze([
    Object.freeze({
      id: "offsetnativeptr<T>(pointer,elementOffset)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        sharedRecord9,
        Object.freeze({
          name: "elementOffset",
          type: Object.freeze({ kind: "source-primitive", name: "native-int" } as const),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        } as const),
      ] as const),
      returnType: Object.freeze({ kind: "present", value: nativePointerType } as const),
      typeParameters: sharedItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
]);
