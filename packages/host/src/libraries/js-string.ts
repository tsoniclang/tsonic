import type { LibraryDeclaration, LibraryRole } from '../model/contract.js';
import { jsTypesIdentity, jsLangIdentity } from './identities.js';

const noValue = Object.freeze({ kind: "none" } as const);

const emptyItems = Object.freeze([] as const);

const int32Type = Object.freeze({ kind: "source-primitive", name: "int32" } as const);

const presentValue = Object.freeze({ kind: "present", value: int32Type } as const);

const sharedRecord = Object.freeze({ name: "index", type: int32Type, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems = Object.freeze([sharedRecord] as const);

const jsStringType = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: "@tsonic/js/types.js",
  exportName: "JsString",
  localName: noValue,
  namespaceImport: noValue,
  typeArguments: emptyItems,
} as const);

const presentValue1 = Object.freeze({ kind: "present", value: jsStringType } as const);

const undefinedData = Object.freeze({ kind: "undefined" } as const);

const sharedItems1 = Object.freeze([jsStringType, undefinedData] as const);

const unionData = Object.freeze({ kind: "union", types: sharedItems1 } as const);

const arrayData = Object.freeze({ kind: "array", elementType: jsStringType } as const);

const sharedRecord1 = Object.freeze({
  name: "searchString",
  type: jsStringType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
} as const);

const booleanData = Object.freeze({ kind: "boolean" } as const);

const presentValue2 = Object.freeze({ kind: "present", value: booleanData } as const);

const sharedRecord2 = Object.freeze({ name: "position", type: int32Type, passingMode: "by-value", optional: true, rest: false, defaultType: noValue } as const);

const sharedItems2 = Object.freeze([sharedRecord1, sharedRecord2] as const);

const stringData = Object.freeze({ kind: "string" } as const);

const sharedRecord3 = Object.freeze({ name: "maxLength", type: int32Type, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedRecord4 = Object.freeze({ name: "fillString", type: jsStringType, passingMode: "by-value", optional: true, rest: false, defaultType: noValue } as const);

const sharedItems3 = Object.freeze([sharedRecord3, sharedRecord4] as const);

const sharedRecord5 = Object.freeze({ name: "end", type: int32Type, passingMode: "by-value", optional: true, rest: false, defaultType: noValue } as const);

const sourceglobalData = Object.freeze({ kind: "source-global", name: "RegExp", typeArguments: emptyItems } as const);

const sharedRecord6 = Object.freeze({ name: "regexp", type: sourceglobalData, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedItems4 = Object.freeze([sharedRecord6] as const);

const sharedItems5 = Object.freeze([jsStringType, sourceglobalData] as const);

const unionData1 = Object.freeze({ kind: "union", types: sharedItems5 } as const);

const sharedRecord7 = Object.freeze({ name: "searchValue", type: unionData1, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const);

const sharedRecord8 = Object.freeze({
  name: "replaceValue",
  type: jsStringType,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
} as const);

const sharedItems6 = Object.freeze([sharedRecord7, sharedRecord8] as const);

const sourceglobalData1 = Object.freeze({ kind: "source-global", name: "JsRegExpReplaceCallback", typeArguments: emptyItems } as const);

const sharedRecord9 = Object.freeze({
  name: "replacer",
  type: sourceglobalData1,
  passingMode: "by-value",
  optional: false,
  rest: false,
  defaultType: noValue,
} as const);

const sharedItems7 = Object.freeze([sharedRecord7, sharedRecord9] as const);

const numberData = Object.freeze({ kind: "number" } as const);

const sharedRecord10 = Object.freeze({ name: "limit", type: numberData, passingMode: "by-value", optional: true, rest: false, defaultType: noValue } as const);

export const jsStringDeclarations: readonly LibraryDeclaration[] = Object.freeze([
  Object.freeze({
  id: "JsString",
  name: "JsString",
  exportName: "JsString",
  exportKind: "named",
  kind: "interface",
  typeFamily: noValue,
  type: noValue,
  typeParameters: emptyItems,
  heritage: emptyItems,
  members: Object.freeze([
    Object.freeze({
      id: "__tsonicJsStringIdentity",
      name: "__tsonicJsStringIdentity",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: Object.freeze({ kind: "present", value: Object.freeze({ kind: "never" } as const) } as const),
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "length",
      name: "length",
      kind: "property",
      static: false,
      readonly: true,
      optional: false,
      type: presentValue,
      signatures: emptyItems,
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "index",
      name: "index",
      kind: "indexer",
      static: false,
      readonly: true,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "index(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "at",
      name: "at",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "at(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: Object.freeze({ kind: "present", value: unionData } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "charAt",
      name: "charAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "charAt(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "charCodeAt",
      name: "charCodeAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "charCodeAt(index)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "codePointAt",
      name: "codePointAt",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "codePointAt(pos)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "pos",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
          ] as const),
          returnType: Object.freeze({
            kind: "present",
            value: Object.freeze({ kind: "union", types: Object.freeze([int32Type, undefinedData] as const) } as const),
          } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "concat",
      name: "concat",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "concat(strings)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "strings",
              type: arrayData,
              passingMode: "by-value",
              optional: false,
              rest: true,
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
      id: "endsWith",
      name: "endsWith",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "endsWith(searchString,endPosition)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            sharedRecord1,
            Object.freeze({
              name: "endPosition",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
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
      id: "includes",
      name: "includes",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "includes(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "indexOf",
      name: "indexOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "indexOf(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "lastIndexOf",
      name: "lastIndexOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "lastIndexOf(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "normalize",
      name: "normalize",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "normalize(form)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "form",
              type: stringData,
              passingMode: "by-value",
              optional: true,
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
      id: "padEnd",
      name: "padEnd",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "padEnd(maxLength,fillString)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems3,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "padStart",
      name: "padStart",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "padStart(maxLength,fillString)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems3,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "repeat",
      name: "repeat",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "repeat(count)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "count",
              type: int32Type,
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
      id: "slice",
      name: "slice",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "slice(start,end)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "start",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
              rest: false,
              defaultType: noValue,
            } as const),
            sharedRecord5,
          ] as const),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "startsWith",
      name: "startsWith",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "startsWith(searchString,position)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems2,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "substring",
      name: "substring",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "substring(start,end)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "start",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
            sharedRecord5,
          ] as const),
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "substr",
      name: "substr",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "substr(from,length)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "from",
              type: int32Type,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
            Object.freeze({
              name: "length",
              type: int32Type,
              passingMode: "by-value",
              optional: true,
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
      id: "toLowerCase",
      name: "toLowerCase",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "toLowerCase()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "toUpperCase",
      name: "toUpperCase",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "toUpperCase()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "trim",
      name: "trim",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "trim()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "trimEnd",
      name: "trimEnd",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "trimEnd()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "trimStart",
      name: "trimStart",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "trimStart()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "toString",
      name: "toString",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "toString()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "valueOf",
      name: "valueOf",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "valueOf()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "isWellFormed",
      name: "isWellFormed",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "isWellFormed()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: presentValue2,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "toWellFormed",
      name: "toWellFormed",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "toWellFormed()",
          name: noValue,
          accessibility: "public",
          parameters: emptyItems,
          returnType: Object.freeze({ kind: "present", value: stringData } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "match",
      name: "match",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "match(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: Object.freeze({
            kind: "present",
            value: Object.freeze({
              kind: "union",
              types: Object.freeze([
                Object.freeze({ kind: "source-global", name: "JsRegExpMatchArray", typeArguments: emptyItems } as const),
                Object.freeze({ kind: "literal", value: null } as const),
              ] as const),
            } as const),
          } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "matchAll",
      name: "matchAll",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "matchAll(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: Object.freeze({
            kind: "present",
            value: Object.freeze({
              kind: "source-global",
              name: "JsRegExpStringIterator",
              typeArguments: Object.freeze([Object.freeze({ kind: "source-global", name: "JsRegExpExecArray", typeArguments: emptyItems } as const)] as const),
            } as const),
          } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "replace",
      name: "replace",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "replace(searchValue,replaceValue)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems6,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
        Object.freeze({
          id: "replace(searchValue,replacer)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems7,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "replaceAll",
      name: "replaceAll",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "replaceAll(searchValue,replaceValue)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems6,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
        Object.freeze({
          id: "replaceAll(searchValue,replacer)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems7,
          returnType: presentValue1,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "search",
      name: "search",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "search(regexp)",
          name: noValue,
          accessibility: "public",
          parameters: sharedItems4,
          returnType: presentValue,
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
      ] as const),
      documentation: noValue,
    } as const),
    Object.freeze({
      id: "split",
      name: "split",
      kind: "method",
      static: false,
      readonly: false,
      optional: false,
      type: noValue,
      signatures: Object.freeze([
        Object.freeze({
          id: "split(separator,limit)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "separator",
              type: jsStringType,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
            sharedRecord10,
          ] as const),
          returnType: Object.freeze({ kind: "present", value: arrayData } as const),
          typeParameters: emptyItems,
          documentation: noValue,
        } as const),
        Object.freeze({
          id: "split(regexp,limit)",
          name: noValue,
          accessibility: "public",
          parameters: Object.freeze([
            Object.freeze({
              name: "separator",
              type: sourceglobalData,
              passingMode: "by-value",
              optional: false,
              rest: false,
              defaultType: noValue,
            } as const),
            sharedRecord10,
          ] as const),
          returnType: Object.freeze({ kind: "present", value: Object.freeze({ kind: "array", elementType: unionData } as const) } as const),
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
  Object.freeze({
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
  signatures: Object.freeze([
    Object.freeze({
      id: "jsstr(value)",
      name: noValue,
      accessibility: "public",
      parameters: Object.freeze([
        Object.freeze({ name: "value", type: stringData, passingMode: "by-value", optional: false, rest: false, defaultType: noValue } as const),
      ] as const),
      returnType: presentValue1,
      typeParameters: emptyItems,
      documentation: noValue,
    } as const),
  ] as const),
  documentation: noValue,
} as const),
]);

export const jsStringRoles: readonly LibraryRole[] = Object.freeze([
  Object.freeze({
  identity: Object.freeze({ module: jsTypesIdentity, exportId: "JsString", memberId: noValue, signatureId: noValue } as const),
  role: "js-string",
} as const),
  Object.freeze({
  identity: Object.freeze({ module: jsLangIdentity, exportId: "jsstr", memberId: noValue, signatureId: noValue } as const),
  role: "js-string",
} as const),
]);
