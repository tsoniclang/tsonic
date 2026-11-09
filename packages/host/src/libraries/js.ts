import type { SourceLibrary } from '../model/contract.js';
import { jsTypesIdentity, jsLangIdentity } from './identities.js';
import { jsStringDeclarations, jsStringRoles } from './js-string.js';
import { jsGlobalsText } from './js-globals.js';

const noValue = Object.freeze({ kind: "none" } as const);

export const jsLibrary: SourceLibrary = Object.freeze({
  id: "tsonic.js.source-semantics",
  modules: Object.freeze([
    Object.freeze({
      identity: jsTypesIdentity,
      imports: Object.freeze([] as const),
      exports: Object.freeze([jsStringDeclarations[0]!]),
      roles: Object.freeze([jsStringRoles[0]!]),
    } as const),
    Object.freeze({
      identity: jsLangIdentity,
      imports: Object.freeze([
        Object.freeze({
          moduleSpecifier: "@tsonic/js/types.js",
          defaultImport: noValue,
          namespaceImport: noValue,
          typeOnly: true,
          namedImports: Object.freeze([Object.freeze({ exportedName: "JsString", kind: "type" } as const)] as const),
        } as const),
      ] as const),
      exports: Object.freeze([jsStringDeclarations[1]!]),
      roles: Object.freeze([jsStringRoles[1]!]),
    } as const),
  ] as const),
  declarations: Object.freeze([Object.freeze({ fileName: "js-globals.d.ts", sourceText: jsGlobalsText, module: noValue } as const)] as const),
} as const);
