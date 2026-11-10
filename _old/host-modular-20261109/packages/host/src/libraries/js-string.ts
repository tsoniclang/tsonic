import type { LibraryDeclaration, LibraryExportIdentity, LibraryMember, LibraryParameter, LibraryRole, LibrarySignature, LibraryType, Presence } from '../model/contract.js';
import { jsTypesIdentity, jsLangIdentity } from './identities.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

const emptyItems = Object.freeze<readonly never[]>([]);

const int32Type = Object.freeze<LibraryType>({ kind: "source-primitive", name: "int32" });

const presentValue = Object.freeze<Presence<LibraryType>>({ kind: "present", value: int32Type });

const sharedRecord = Object.freeze<LibraryParameter>({ name: "index", type: int32Type, passingMode: "by-value", optional: false, rest: false, defaultType: noValue });

const sharedItems = Object.freeze<readonly LibraryParameter[]>([sharedRecord]);

const jsStringType = Object.freeze<LibraryType>({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/js/types.js",
  exportName: "JsString",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
});

const presentValue1 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: jsStringType });

const undefinedData = Object.freeze<LibraryType>({ kind: "undefined" });

const sharedItems1 = Object.freeze<readonly LibraryType[]>([jsStringType, undefinedData]);

const unionData = Object.freeze<LibraryType>({ kind: "union", types: sharedItems1 });

const arrayData = Object.freeze<LibraryType>({ kind: "array", elementType: jsStringType });

const sharedRecord1 = Object.freeze<LibraryParameter>({
  name: "searchString",
  type: jsStringType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const booleanData = Object.freeze<LibraryType>({ kind: "boolean" });

const presentValue2 = Object.freeze<Presence<LibraryType>>({ kind: "present", value: booleanData });

const sharedRecord2 = Object.freeze<LibraryParameter>({
  name: "position",
  type: int32Type,
  passingMode: "by-value",
  optional: true,
  rest: false,
  defaultType: noValue,
});

const sharedItems2 = Object.freeze<readonly LibraryParameter[]>([sharedRecord1, sharedRecord2]);

const stringData = Object.freeze<LibraryType>({ kind: "string" });

const sharedRecord3 = Object.freeze<LibraryParameter>({
  name: "maxLength",
  type: int32Type,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedRecord4 = Object.freeze<LibraryParameter>({
  name: "fillString",
  type: jsStringType,
  passingMode: "by-value",
  optional: true,
  rest: false,
  defaultType: noValue,
});

const sharedItems3 = Object.freeze<readonly LibraryParameter[]>([sharedRecord3, sharedRecord4]);

const sharedRecord5 = Object.freeze<LibraryParameter>({ name: "end", type: int32Type, passingMode: "by-value", optional: true, rest: false, defaultType: noValue });

const sourceglobalData = Object.freeze<LibraryType>({ kind: "source-global", name: "RegExp", typeArguments: emptyItems });

const sharedRecord6 = Object.freeze<LibraryParameter>({
  name: "regexp",
  type: sourceglobalData,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedItems4 = Object.freeze<readonly LibraryParameter[]>([sharedRecord6]);

const sharedItems5 = Object.freeze<readonly LibraryType[]>([jsStringType, sourceglobalData]);

const unionData1 = Object.freeze<LibraryType>({ kind: "union", types: sharedItems5 });

const sharedRecord7 = Object.freeze<LibraryParameter>({
  name: "searchValue",
  type: unionData1,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedRecord8 = Object.freeze<LibraryParameter>({
  name: "replaceValue",
  type: jsStringType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedItems6 = Object.freeze<readonly LibraryParameter[]>([sharedRecord7, sharedRecord8]);

const sourceglobalData1 = Object.freeze<LibraryType>({ kind: "source-global", name: "JsRegExpReplaceCallback", typeArguments: emptyItems });

const sharedRecord9 = Object.freeze<LibraryParameter>({
  name: "replacer",
  type: sourceglobalData1,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
});

const sharedItems7 = Object.freeze<readonly LibraryParameter[]>([sharedRecord7, sharedRecord9]);

const numberData = Object.freeze<LibraryType>({ kind: "number" });

const sharedRecord10 = Object.freeze<LibraryParameter>({ name: "limit", type: numberData, passingMode: "by-value", optional: true, rest: false, defaultType: noValue });

export const jsStringDeclarations: readonly [LibraryDeclaration, LibraryDeclaration] = Object.freeze<readonly [LibraryDeclaration, LibraryDeclaration]>([
  Object.freeze<LibraryDeclaration>({
  id: "JsString",
  name: "JsString",
  exportName: "JsString",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze<readonly LibraryMember[]>([
    Object.freeze<LibraryMember>({
      id: "__tsonicJsStringIdentity",
      name: "__tsonicJsStringIdentity",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze<Presence<LibraryType>>({ kind: "present", value: Object.freeze<LibraryType>({ kind: "never" }) }),
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "index",
      name: "index",
      kind: "indexer",
      static: false,
      readonly: true,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "index(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "at",
      name: "at",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "at(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: unionData }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "charAt",
      name: "charAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "charAt(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "charCodeAt",
      name: "charCodeAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "charCodeAt(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "codePointAt",
      name: "codePointAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "codePointAt(pos)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "pos",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
          ]),
          returnType: Object.freeze<Presence<LibraryType>>({
            kind: "present",
            value: Object.freeze<LibraryType>({ kind: "union", types: Object.freeze<readonly LibraryType[]>([int32Type, undefinedData]) }),
          }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "concat",
      name: "concat",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "concat(strings)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "strings",
              type: arrayData,
              passingMode: "by-value",
              optional: false,
              rest: true,
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
      id: "endsWith",
      name: "endsWith",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "endsWith(searchString,endPosition)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            sharedRecord1,
            Object.freeze<LibraryParameter>({
              name: "endPosition",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
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
      id: "includes",
      name: "includes",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "includes(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "indexOf",
      name: "indexOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "indexOf(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "lastIndexOf",
      name: "lastIndexOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "lastIndexOf(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "normalize",
      name: "normalize",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "normalize(form)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "form",
              type: stringData,
              passingMode: "by-value",
              optional: true,
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
      id: "padEnd",
      name: "padEnd",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "padEnd(maxLength,fillString)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems3,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "padStart",
      name: "padStart",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "padStart(maxLength,fillString)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems3,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "repeat",
      name: "repeat",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "repeat(count)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "count",
              type: int32Type,
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
      id: "slice",
      name: "slice",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "slice(start,end)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "start",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
              rest: false,
              defaultType: noValue,
            }),
            sharedRecord5,
          ]),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "startsWith",
      name: "startsWith",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "startsWith(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "substring",
      name: "substring",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "substring(start,end)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "start",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
            sharedRecord5,
          ]),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "substr",
      name: "substr",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "substr(from,length)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "from",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
            Object.freeze<LibraryParameter>({
              name: "length",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
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
      id: "toLowerCase",
      name: "toLowerCase",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "toLowerCase()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "toUpperCase",
      name: "toUpperCase",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "toUpperCase()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "trim",
      name: "trim",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "trim()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "trimEnd",
      name: "trimEnd",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "trimEnd()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "trimStart",
      name: "trimStart",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "trimStart()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "toString",
      name: "toString",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "toString()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "valueOf",
      name: "valueOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "valueOf()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "isWellFormed",
      name: "isWellFormed",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "isWellFormed()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "toWellFormed",
      name: "toWellFormed",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "toWellFormed()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: stringData }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "match",
      name: "match",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "match(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: Object.freeze<Presence<LibraryType>>({
            kind: "present",
            value: Object.freeze<LibraryType>({
              kind: "union",
              types: Object.freeze<readonly LibraryType[]>([
                Object.freeze<LibraryType>({ kind: "source-global", name: "JsRegExpMatchArray", typeArguments: emptyItems }),
                Object.freeze<LibraryType>({ kind: "literal", value: null }),
              ]),
            }),
          }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "matchAll",
      name: "matchAll",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "matchAll(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: Object.freeze<Presence<LibraryType>>({
            kind: "present",
            value: Object.freeze<LibraryType>({
              kind: "source-global",
              name: "JsRegExpStringIterator",
              typeArguments: Object.freeze<readonly LibraryType[]>([
                Object.freeze<LibraryType>({ kind: "source-global", name: "JsRegExpExecArray", typeArguments: emptyItems }),
              ]),
            }),
          }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "replace",
      name: "replace",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "replace(searchValue,replaceValue)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems6,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
        Object.freeze<LibrarySignature>({
          id: "replace(searchValue,replacer)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems7,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "replaceAll",
      name: "replaceAll",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "replaceAll(searchValue,replaceValue)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems6,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
        Object.freeze<LibrarySignature>({
          id: "replaceAll(searchValue,replacer)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems7,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "search",
      name: "search",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "search(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        }),
      ]),
      documentation: noValue,
    }),
    Object.freeze<LibraryMember>({
      id: "split",
      name: "split",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze<readonly LibrarySignature[]>([
        Object.freeze<LibrarySignature>({
          id: "split(separator,limit)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "separator",
              type: jsStringType,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
            sharedRecord10,
          ]),
          returnType: Object.freeze<Presence<LibraryType>>({ kind: "present", value: arrayData }),
          typeParameters: emptyItems,
          documentation: noValue,
        }),
        Object.freeze<LibrarySignature>({
          id: "split(regexp,limit)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze<readonly LibraryParameter[]>([
            Object.freeze<LibraryParameter>({
              name: "separator",
              type: sourceglobalData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            }),
            sharedRecord10,
          ]),
          returnType: Object.freeze<Presence<LibraryType>>({
            kind: "present",
            value: Object.freeze<LibraryType>({ kind: "array", elementType: unionData }),
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
  Object.freeze<LibraryDeclaration>({
  id: "jsstr",
  name: "jsstr",
  exportName: "jsstr",
  exportKind: "named",
  kind: "function",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: emptyItems,
  signatures: Object.freeze<readonly LibrarySignature[]>([
    Object.freeze<LibrarySignature>({
      id: "jsstr(value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze<readonly LibraryParameter[]>([
        Object.freeze<LibraryParameter>({
          name: "value",
          type: stringData,
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
]);

export const jsStringRoles: readonly [LibraryRole, LibraryRole] = Object.freeze<readonly [LibraryRole, LibraryRole]>([
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: jsTypesIdentity, exportId: "JsString", memberId: noValue, signatureId: noValue }),
  role: "js-string",
}),
  Object.freeze<LibraryRole>({
  identity: Object.freeze<LibraryExportIdentity>({ module: jsLangIdentity, exportId: "jsstr", memberId: noValue, signatureId: noValue }),
  role: "js-string",
}),
]);
