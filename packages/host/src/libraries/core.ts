import type { LibraryImport, LibraryModule, LibraryText, Presence, SourceLibrary } from '../model/contract.js';
import { coreTypesIdentity, coreLangIdentity } from './identities.js';
import { corePrimitiveDeclarations, corePrimitiveRoles, corePrimitiveText } from './core-primitives.js';
import { coreTypeMarkers, coreCallMarkers, coreMarkerRoles } from './core-markers.js';
import { coreMemoryTypes, coreMemoryOperations } from './core-memory.js';
import { coreAttributeDeclarations } from './core-attributes.js';
import { coreCompileTimeDeclarations } from './core-comptime.js';
import { coreSafetyDeclarations } from './core-safety.js';
import { sourceBaseText, sourceUtilityText } from './base-text.js';

const noValue = Object.freeze<Presence<never>>({ kind: "none" });

export const coreLibrary: SourceLibrary = Object.freeze<SourceLibrary>({
  id: "tsonic.source-core",
  modules: Object.freeze<readonly LibraryModule[]>([
    Object.freeze<LibraryModule>({
      identity: coreTypesIdentity,
      imports: Object.freeze<readonly never[]>([]),
      exports: Object.freeze([...coreMemoryTypes, ...corePrimitiveDeclarations, ...coreTypeMarkers]),
      roles: Object.freeze([...corePrimitiveRoles, coreMarkerRoles[0], coreMarkerRoles[1], coreMarkerRoles[2], coreMarkerRoles[3]]),
    }),
    Object.freeze<LibraryModule>({
      identity: coreLangIdentity,
      imports: Object.freeze<readonly LibraryImport[]>([
        Object.freeze<LibraryImport>({
          moduleSpecifier: "@tsonic/core/types.js",
          defaultImport: noValue,
          namespaceImport: noValue,
          typeOnly: true,
          namedImports: Object.freeze<readonly LibraryImport['namedImports'][number][]>([
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "Pointer", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "RawPointer", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "NativePointer", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "DataLayout", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "MemoryLayout", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "MemoryFieldLayout", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "MemoryFieldBinding", kind: "type" }),
            Object.freeze<LibraryImport['namedImports'][number]>({ exportedName: "FixedArray", kind: "type" }),
          ]),
        }),
      ]),
      exports: Object.freeze([coreAttributeDeclarations[1], coreAttributeDeclarations[2], coreMemoryOperations[0], coreMemoryOperations[1], coreMemoryOperations[2], coreMemoryOperations[3], coreMemoryOperations[4], coreMemoryOperations[5], coreMemoryOperations[6], coreMemoryOperations[7], coreMemoryOperations[8], coreMemoryOperations[9], coreMemoryOperations[10], coreMemoryOperations[11], coreMemoryOperations[12], coreMemoryOperations[13], coreMemoryOperations[14], coreMemoryOperations[15], coreMemoryOperations[16], coreMemoryOperations[17], coreMemoryOperations[18], ...coreCompileTimeDeclarations, coreMemoryOperations[19], coreMemoryOperations[20], coreMemoryOperations[21], ...coreSafetyDeclarations, coreCallMarkers[0], coreCallMarkers[1], coreCallMarkers[2], coreCallMarkers[3], coreCallMarkers[4], coreCallMarkers[5], coreCallMarkers[6], coreCallMarkers[7], coreAttributeDeclarations[0], coreCallMarkers[8], coreCallMarkers[9], coreCallMarkers[10], coreCallMarkers[11], coreCallMarkers[12], coreCallMarkers[13], coreCallMarkers[14], coreCallMarkers[15], coreCallMarkers[16], coreCallMarkers[17], coreCallMarkers[18]]),
      roles: Object.freeze([coreMarkerRoles[4], coreMarkerRoles[5], coreMarkerRoles[6], coreMarkerRoles[7], coreMarkerRoles[8], coreMarkerRoles[9], coreMarkerRoles[10], coreMarkerRoles[11], coreMarkerRoles[12], coreMarkerRoles[13], coreMarkerRoles[14], coreMarkerRoles[15], coreMarkerRoles[16], coreMarkerRoles[17], coreMarkerRoles[18], coreMarkerRoles[19], coreMarkerRoles[20], coreMarkerRoles[21], coreMarkerRoles[22], coreMarkerRoles[23]]),
    }),
  ]),
  declarations: Object.freeze<readonly LibraryText[]>([
    Object.freeze<LibraryText>({ fileName: "source-base.d.ts", sourceText: sourceBaseText, module: noValue }),
    Object.freeze<LibraryText>({ fileName: "typescript-utilities.d.ts", sourceText: sourceUtilityText, module: noValue }),
    Object.freeze<LibraryText>({ fileName: "source-primitives.d.ts", sourceText: corePrimitiveText, module: noValue }),
  ]),
});
