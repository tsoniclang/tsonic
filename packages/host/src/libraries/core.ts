import type { SourceLibrary } from '../model/contract.js';
import { coreTypesIdentity, coreLangIdentity } from './identities.js';
import { corePrimitiveDeclarations, corePrimitiveRoles, corePrimitiveText } from './core-primitives.js';
import { coreTypeMarkers, coreCallMarkers, coreMarkerRoles } from './core-markers.js';
import { coreMemoryTypes, coreMemoryOperations } from './core-memory.js';
import { coreAttributeDeclarations } from './core-attributes.js';
import { coreCompileTimeDeclarations } from './core-comptime.js';
import { coreSafetyDeclarations } from './core-safety.js';
import { sourceBaseText, sourceUtilityText } from './base-text.js';

const noValue = Object.freeze({ kind: "none" } as const);

export const coreLibrary: SourceLibrary = Object.freeze({
  id: "tsonic.source-core",
  modules: Object.freeze([
    Object.freeze({
      identity: coreTypesIdentity,
      imports: Object.freeze([] as const),
      exports: Object.freeze([...coreMemoryTypes, ...corePrimitiveDeclarations, ...coreTypeMarkers]),
      roles: Object.freeze([...corePrimitiveRoles, coreMarkerRoles[0]!, coreMarkerRoles[1]!, coreMarkerRoles[2]!, coreMarkerRoles[3]!]),
    } as const),
    Object.freeze({
      identity: coreLangIdentity,
      imports: Object.freeze([
        Object.freeze({
          moduleSpecifier: "@tsonic/core/types.js",
          defaultImport: noValue,
          namespaceImport: noValue,
          typeOnly: true,
          namedImports: Object.freeze([
            Object.freeze({ exportedName: "Pointer", kind: "type" } as const),
            Object.freeze({ exportedName: "RawPointer", kind: "type" } as const),
            Object.freeze({ exportedName: "NativePointer", kind: "type" } as const),
            Object.freeze({ exportedName: "DataLayout", kind: "type" } as const),
            Object.freeze({ exportedName: "MemoryLayout", kind: "type" } as const),
            Object.freeze({ exportedName: "MemoryFieldLayout", kind: "type" } as const),
            Object.freeze({ exportedName: "MemoryFieldBinding", kind: "type" } as const),
            Object.freeze({ exportedName: "FixedArray", kind: "type" } as const),
          ] as const),
        } as const),
      ] as const),
      exports: Object.freeze([coreAttributeDeclarations[1]!, coreAttributeDeclarations[2]!, coreMemoryOperations[0]!, coreMemoryOperations[1]!, coreMemoryOperations[2]!, coreMemoryOperations[3]!, coreMemoryOperations[4]!, coreMemoryOperations[5]!, coreMemoryOperations[6]!, coreMemoryOperations[7]!, coreMemoryOperations[8]!, coreMemoryOperations[9]!, coreMemoryOperations[10]!, coreMemoryOperations[11]!, coreMemoryOperations[12]!, coreMemoryOperations[13]!, coreMemoryOperations[14]!, coreMemoryOperations[15]!, coreMemoryOperations[16]!, coreMemoryOperations[17]!, coreMemoryOperations[18]!, ...coreCompileTimeDeclarations, coreMemoryOperations[19]!, coreMemoryOperations[20]!, coreMemoryOperations[21]!, ...coreSafetyDeclarations, coreCallMarkers[0]!, coreCallMarkers[1]!, coreCallMarkers[2]!, coreCallMarkers[3]!, coreCallMarkers[4]!, coreCallMarkers[5]!, coreCallMarkers[6]!, coreCallMarkers[7]!, coreAttributeDeclarations[0]!, coreCallMarkers[8]!, coreCallMarkers[9]!, coreCallMarkers[10]!, coreCallMarkers[11]!, coreCallMarkers[12]!, coreCallMarkers[13]!, coreCallMarkers[14]!, coreCallMarkers[15]!, coreCallMarkers[16]!, coreCallMarkers[17]!, coreCallMarkers[18]!]),
      roles: Object.freeze([coreMarkerRoles[4]!, coreMarkerRoles[5]!, coreMarkerRoles[6]!, coreMarkerRoles[7]!, coreMarkerRoles[8]!, coreMarkerRoles[9]!, coreMarkerRoles[10]!, coreMarkerRoles[11]!, coreMarkerRoles[12]!, coreMarkerRoles[13]!, coreMarkerRoles[14]!, coreMarkerRoles[15]!, coreMarkerRoles[16]!, coreMarkerRoles[17]!, coreMarkerRoles[18]!, coreMarkerRoles[19]!, coreMarkerRoles[20]!, coreMarkerRoles[21]!, coreMarkerRoles[22]!, coreMarkerRoles[23]!]),
    } as const),
  ] as const),
  declarations: Object.freeze([
    Object.freeze({ fileName: "source-base.d.ts", sourceText: sourceBaseText, module: noValue } as const),
    Object.freeze({ fileName: "typescript-utilities.d.ts", sourceText: sourceUtilityText, module: noValue } as const),
    Object.freeze({ fileName: "source-primitives.d.ts", sourceText: corePrimitiveText, module: noValue } as const),
  ] as const),
} as const);
