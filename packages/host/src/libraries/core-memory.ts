import type { LibraryDeclaration, LibraryMember, LibraryParameter, LibrarySignature, LibraryType, LibraryTypeParameter, Presence } from '../model/contract.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const sharedRecord = Object.freeze<LibraryTypeParameter>({ name: "T", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord]);

const tType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "T" });

const sharedRecord1 = Object.freeze<LibraryParameter>({ name: "value", type: tType, passingMode: "by-value", optional: false, rest: false, defaultType: noValue });

const sharedItems1 = Object.freeze<readonly LibraryParameter[]>([sharedRecord1]);

const dataLayoutType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "DataLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
});

const presentValue = Object.freeze<Presence<LibraryType>>({ kind: "present", value: dataLayoutType });

const nativeuintType = Object.freeze<LibraryType>({ kind: "source-primitive", name: "native-uint" });

const presentValue1 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: nativeuintType });

const sharedItems2 = Object.freeze<readonly LibraryType[]>([tType]);

const memoryFieldLayoutType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryFieldLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const numberData = Object.freeze<LibraryType>({ kind: "number" });

const bigintData = Object.freeze<LibraryType>({ kind: "bigint" });

const sharedItems3 = Object.freeze<readonly LibraryType[]>([numberData, bigintData]);

const unionData = Object.freeze<LibraryType>({ kind: "union", types: sharedItems3 });

const sharedItems4 = Object.freeze<readonly LibraryType[]>([unionData]);

const sharedRecord2 = Object.freeze<LibraryTypeParameter>({ name: "TLength", constraints: sharedItems4, defaultType: noValue, variance: "invariant" });

const sharedItems5 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord, sharedRecord2]);

const memoryLayoutType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryLayout",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const presentValue2 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: memoryLayoutType });

const tLengthType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "TLength" });

const sharedRecord3 = Object.freeze<LibraryTypeParameter>({ name: "TField", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems6 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord, sharedRecord3]);

const tFieldType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "TField" });

const sharedItems7 = Object.freeze<readonly LibraryType[]>([tFieldType]);

const pointerType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const undefinedData = Object.freeze<LibraryType>({ kind: "undefined" });

const sharedItems8 = Object.freeze<readonly LibraryType[]>([pointerType, undefinedData]);

const unionData1 = Object.freeze<LibraryType>({ kind: "union", types: sharedItems8 });

const sharedRecord4 = Object.freeze<LibraryParameter>({
  name: "layout",
  type: memoryLayoutType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const rawPointerType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "RawPointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
});

const sharedItems9 = Object.freeze<readonly LibraryType[]>([rawPointerType, undefinedData]);

const unionData2 = Object.freeze<LibraryType>({ kind: "union", types: sharedItems9 });

const presentValue3 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: unionData2 });

const sharedRecord5 = Object.freeze<LibraryParameter>({
  name: "pointer",
  type: unionData2,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const presentValue4 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: unionData1 });

const sharedRecord6 = Object.freeze<LibraryParameter>({
  name: "dataLayout",
  type: dataLayoutType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const tAddressType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "TAddress" });

const sharedRecord7 = Object.freeze<LibraryTypeParameter>({ name: "TAddress", constraints: sharedItems4, defaultType: noValue, variance: "invariant" });

const sharedItems10 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord7]);

const sharedItems11 = Object.freeze<readonly LibraryType[]>([tType, tLengthType]);

const memoryFieldBindingType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "MemoryFieldBinding",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const presentValue5 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: tType });

const sharedItems12 = Object.freeze<readonly LibraryParameter[]>([sharedRecord4]);

const voidData = Object.freeze<LibraryType>({ kind: "void" });

const presentValue6 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: voidData });

const fType = Object.freeze<LibraryType>({ kind: "type-parameter", name: "F" });

const sharedItems13 = Object.freeze<readonly LibraryType[]>([fType]);

const pointerType1 = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "Pointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems13,
});

const sharedRecord8 = Object.freeze<LibraryTypeParameter>({ name: "F", constraints: emptyItems, defaultType: noValue, variance: "invariant" });

const sharedItems14 = Object.freeze<readonly LibraryTypeParameter[]>([sharedRecord8, sharedRecord]);

const nativePointerType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/core/types.js",
  exportName: "NativePointer",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: sharedItems2,
});

const sharedRecord9 = Object.freeze<LibraryParameter>({
  name: "pointer",
  type: nativePointerType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

export const coreMemoryTypes: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "DataLayout",
  name: "DataLayout",
  exportName: "DataLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "DataLayout.brand",
      name: "__tsonicDataLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({ kind: "present", value: Object.freeze<LibraryType>({ kind: "literal", value: "DataLayout" }) }),
      signatures: emptyItems,
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "MemoryLayout",
  name: "MemoryLayout",
  exportName: "MemoryLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "MemoryLayout.brand",
      name: "__tsonicMemoryLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "MemoryLayout.brand",
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
  id: "MemoryFieldLayout",
  name: "MemoryFieldLayout",
  exportName: "MemoryFieldLayout",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "MemoryFieldLayout.brand",
      name: "__tsonicMemoryFieldLayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "MemoryFieldLayout.brand",
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
  id: "MemoryFieldBinding",
  name: "MemoryFieldBinding",
  exportName: "MemoryFieldBinding",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "MemoryFieldBinding.brand",
      name: "__tsonicMemoryFieldBinding",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "MemoryFieldBinding.brand",
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
  id: "NativePointer",
  name: "NativePointer",
  exportName: "NativePointer",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "NativePointer.__tsonicNativePointer",
      name: "__tsonicNativePointer",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "NativePointer.__tsonicNativePointer",
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
]);

export const coreMemoryOperations: readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicMemoryLayoutDescriptor",
  name: "__TsonicMemoryLayoutDescriptor",
  exportName: "__TsonicMemoryLayoutDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryLayoutDescriptor.datalayout",
      name: "datalayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryLayoutDescriptor.bytesize",
      name: "bytesize",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryLayoutDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryLayoutDescriptor.stride",
      name: "stride",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryLayoutDescriptor.fields",
      name: "fields",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({ kind: "array", elementType: memoryFieldLayoutType }),
      }),
      signatures: emptyItems,
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicMemoryArrayLayoutDescriptor",
  name: "__TsonicMemoryArrayLayoutDescriptor",
  exportName: "__TsonicMemoryArrayLayoutDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems5,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.datalayout",
      name: "datalayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.bytesize",
      name: "bytesize",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.stride",
      name: "stride",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.elementlayout",
      name: "elementlayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue2,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryArrayLayoutDescriptor.length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({ kind: "present", value: tLengthType }),
      signatures: emptyItems,
      documentation: noValue,
    }),
  ]),
  signatures: emptyItems,
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
  id: "__TsonicMemoryFieldDescriptor",
  name: "__TsonicMemoryFieldDescriptor",
  exportName: "__TsonicMemoryFieldDescriptor",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: sharedItems6,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryFieldDescriptor.select",
      name: "select",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "function",
          id: "memoryfield.selector",
          parameters: sharedItems1,
          returnType: tFieldType,
          typeParameters: emptyItems,
        }),
      }),
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryFieldDescriptor.byteoffset",
      name: "byteoffset",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryFieldDescriptor.bytealignment",
      name: "bytealignment",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue1,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "__TsonicMemoryFieldDescriptor.fieldlayout",
      name: "fieldlayout",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/types.js",
          exportName: "MemoryLayout",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: sharedItems7,
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "torawptr<T>(pointer,layout)",
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
        sharedRecord4,
      ]),
      returnType: presentValue3,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "reinterpretrawptr<T>(pointer,layout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord5, sharedRecord4]),
      returnType: presentValue4,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "offsetrawptr<TOffset>(pointer,byteOffset,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        sharedRecord5,
        Object.freeze<LibraryParameter>({
          name: "byteOffset",
          type: Object.freeze<LibraryType>({ kind: "type-parameter", name: "TOffset" }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        sharedRecord6,
      ]),
      returnType: presentValue3,
      typeParameters: Object.freeze<readonly LibraryTypeParameter[]>([
        Object.freeze<LibraryTypeParameter>({ name: "TOffset", constraints: sharedItems4, defaultType: noValue, variance: "invariant" }),
      ]),
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "rawptrtoaddressinteger<TAddress>(pointer,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord5, sharedRecord6]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: tAddressType }),
      typeParameters: sharedItems10,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "addressintegertorawptr<TAddress>(address,dataLayout)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "address",
          type: tAddressType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        sharedRecord6,
      ]),
      returnType: presentValue3,
      typeParameters: sharedItems10,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "memorylayout<T>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "descriptor",
          type: Object.freeze<LibraryType>({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryLayoutDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems2,
          }),
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "memoryarraylayout<T,TLength>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "descriptor",
          type: Object.freeze<LibraryType>({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryArrayLayoutDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems11,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({
        kind: "present",
        value: Object.freeze<LibraryType>({
          kind: "provider-ref",
          moduleSpecifier: "@tsonic/core/types.js",
          exportName: "MemoryLayout",
          localName: noValue,
          namespaceImport: noValue,
          typeArguments: Object.freeze<readonly LibraryType[]>([
            Object.freeze<LibraryType>({
              kind: "provider-ref",
              moduleSpecifier: "@tsonic/core/types.js",
              exportName: "FixedArray",
              localName: noValue,
              namespaceImport: noValue,
              typeArguments: sharedItems11,
            }),
          ]),
        }),
      }),
      typeParameters: sharedItems5,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "memoryfield<T,TField>(descriptor)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "descriptor",
          type: Object.freeze<LibraryType>({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/lang.js",
            exportName: "__TsonicMemoryFieldDescriptor",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: Object.freeze<readonly LibraryType[]>([tType, tFieldType]),
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: memoryFieldLayoutType }),
      typeParameters: sharedItems6,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "bindmemoryfield<T,TField>(field,pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "field",
          type: memoryFieldLayoutType,
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
        Object.freeze<LibraryParameter>({
          name: "pointer",
          type: Object.freeze<LibraryType>({
            kind: "provider-ref",
            moduleSpecifier: "@tsonic/core/types.js",
            exportName: "Pointer",
            localName: noValue,
            namespaceImport: noValue,
            typeArguments: sharedItems7,
          }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: memoryFieldBindingType }),
      typeParameters: sharedItems6,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "bindmemoryrecord<T>(layout,...fields)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        sharedRecord4,
        Object.freeze<LibraryParameter>({
          name: "fields",
          type: Object.freeze<LibraryType>({ kind: "array", elementType: memoryFieldBindingType }),
          passingMode: "by-value",
          optional: false,
          rest: true,
          defaultType: noValue,
        }),
      ]),
      returnType: presentValue5,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "sizeof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "alignof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "strideof<T>(layout)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems12,
      returnType: presentValue1,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "fieldoffsetof<T,TField>(layout,select)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        sharedRecord4,
        Object.freeze<LibraryParameter>({
          name: "select",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "fieldoffsetof.selector",
            parameters: sharedItems1,
            returnType: tFieldType,
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
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "keepalive<T>(value)",
      name: noValue,
      accessibility: "public",
      parameters: sharedItems1,
      returnType: presentValue6,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "viewptr<F,T>(pointer,read,write)",
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
          name: "read",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "viewptr.required.read",
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
            id: "viewptr.required.write",
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
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: pointerType }),
      typeParameters: sharedItems14,
      documentation: noValue,
    }),
    Object.freeze<LibrarySignature>({
      id: "viewptr<F,T>(pointer?,read,write)",
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
          name: "read",
          type: Object.freeze<LibraryType>({
            kind: "function",
            id: "viewptr.optional.read",
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
            id: "viewptr.optional.write",
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
      returnType: presentValue4,
      typeParameters: sharedItems14,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "loadnativeptr<T>(pointer)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord9]),
      returnType: presentValue5,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "storenativeptr<T>(pointer,value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([sharedRecord9, sharedRecord1]),
      returnType: presentValue6,
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
  Object.freeze<LibraryDeclaration>({
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
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "offsetnativeptr<T>(pointer,elementOffset)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        sharedRecord9,
        Object.freeze<LibraryParameter>({
          name: "elementOffset",
          type: Object.freeze<LibraryType>({ kind: "source-primitive", name: "native-int" }),
          passingMode: "by-value",
          optional: false,
          rest: false,
          defaultType: noValue,
        }),
      ]),
      returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: nativePointerType }),
      typeParameters: sharedItems,
      documentation: noValue,
    }),
  ]),
  documentation: noValue,
}),
]);
