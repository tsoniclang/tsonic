import type { LibraryImport, LibraryModule, LibraryText, Presence, SourceLibrary } from '../model/contract.js';
import { jsTypesIdentity, jsLangIdentity } from './identities.js';
import { jsStringDeclarations, jsStringRoles } from './js-string.js';
import { jsGlobalsText } from './js-globals.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

export const jsLibrary: SourceLibrary = Object.freeze<SourceLibrary>({
  id: "tsonic.js.source-semantics",
  modules: Object.freeze<readonly LibraryModule[]>([
    Object.freeze<LibraryModule>({
      identity: jsTypesIdentity,
      imports: Object.freeze<readonly never[]>([]),
      exports: Object.freeze([jsStringDeclarations[0]]),
      roles: Object.freeze([jsStringRoles[0]]),
    }),
    Object.freeze<LibraryModule>({
      identity: jsLangIdentity,
      imports: Object.freeze<readonly LibraryImport[]>([
        Object.freeze<LibraryImport>({
          moduleSpecifier: "@tsonic/js/types.js",
          defaultImport: noValue,
          namespaceImport: noValue,
          typeOnly: true,
          namedImports: Object.freeze<readonly LibraryImport['namedImports'][number][]>([
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "JsString", kind: "type" }),
          ]),
        }),
      ]),
      exports: Object.freeze([jsStringDeclarations[1]]),
      roles: Object.freeze([jsStringRoles[1]]),
    }),
  ]),
  declarations: Object.freeze<readonly LibraryText[]>([
    Object.freeze<LibraryText>({ fileName: "js-globals.d.ts", sourceText: jsGlobalsText, module: noValue }),
  ]),
});
