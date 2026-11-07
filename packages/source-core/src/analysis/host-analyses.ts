// Source-core analyses published to targets as SourceProgramFacts.analyses.extension(tsonicCoreAnalysisKey).
// The composition root registers `tsonicCoreSourceAnalyses` with createTargetSourceProgram; targets never call the
// program-taking factories below directly (supervisor ruling 2026-11-07: Host analyses are facts members).
// Every member is checker-free (I1): Host descriptors, declaration/operand nodes and exact values (host-records.ts).
import type { Node } from "@tsonic/tsts";
import { createSourceAnalysisKey, hostSourceProgramOfAnalysisHost } from "@tsonic/target-api/host";
import type { SourceStorageQueries } from "@tsonic/target-api/analysis";
import type { SourceAnalysisExtension, SourceAnalysisHost, SourceAnalysisKey } from "@tsonic/target-api/source";
import { createTsonicMemoryMetadataIndex, type TsonicMemoryMetadataIndex } from "../memory-layout/metadata-index.js";
import { createTsonicClosedArrayStorageQueries, type TsonicClosedArrayStorage } from "../pointers/backing/array-storage.js";
import { selectTsonicProviderPointerShape, type TsonicProviderPointerSelection } from "../pointers/provider-return-evidence.js";
import { createTsonicPointerStorageRelation, type TsonicPointerStorageRelation } from "../pointers/storage-relation.js";
import { createTsonicHostRecords, type TsonicMemoryBindings, type TsonicMemoryFacts, type TsonicPointerFacts } from "./host-records.js";

/** Source-value budget of one closed native array proof (the value C# used, now owned by the Host). */
export const tsonicClosedArrayStorageValueBudget = 131_072;

export interface TsonicCoreSourceAnalyses {
  /** Compile-time memory metadata (data layouts, memory layouts, memory fields) and their use issues. */
  readonly memoryMetadata: TsonicMemoryMetadataIndex;
  /** Raw locations (torawptr / reinterpretrawptr with their layouts), raw address arithmetic, layout observations, keepalive. */
  readonly memory: TsonicMemoryFacts;
  /** Field and record memory bindings, their issues and the bound field declarations. */
  readonly memoryBindings: TsonicMemoryBindings;
  /** Pointer views and native pointer operations. */
  readonly pointers: TsonicPointerFacts;
  /** The pointer storage relation over a storage query: allocation, address, binding, projection and reinterpret producers. */
  pointerStorage(storage: SourceStorageQueries): TsonicPointerStorageRelation;
  /** Closed native array storage behind an element access, or why it is unproven. */
  closedArrayStorage(access: Node): TsonicClosedArrayStorage;
  /** Pointer result shape of a provider call; fold it with foldTsonicProviderPointerResult. Undefined: no pointer result. */
  providerPointerResult(call: Node): TsonicProviderPointerSelection | undefined;
}

export const tsonicCoreAnalysisKey: SourceAnalysisKey<TsonicCoreSourceAnalyses> =
  createSourceAnalysisKey<TsonicCoreSourceAnalyses>("tsonic.source-core");

export const tsonicCoreSourceAnalyses: SourceAnalysisExtension<TsonicCoreSourceAnalyses> = Object.freeze({
  key: tsonicCoreAnalysisKey,
  create(handle: SourceAnalysisHost) {
    const host = hostSourceProgramOfAnalysisHost(handle);
    const arrays = createTsonicClosedArrayStorageQueries(host, tsonicClosedArrayStorageValueBudget);
    const records = createTsonicHostRecords(host);
    const relations = new Map<SourceStorageQueries, TsonicPointerStorageRelation>();
    return Object.freeze({
      memoryMetadata: createTsonicMemoryMetadataIndex(host),
      memory: records.memory,
      get memoryBindings() { return records.memoryBindings; },
      pointers: records.pointers,
      pointerStorage(storage: SourceStorageQueries) {
        const existing = relations.get(storage);
        if (existing !== undefined) return existing;
        const relation = createTsonicPointerStorageRelation(host, storage, records.reinterpret);
        relations.set(storage, relation);
        return relation;
      },
      closedArrayStorage: (access: Node) => arrays.resolve(access),
      providerPointerResult: (call: Node) => selectTsonicProviderPointerShape(host, call),
    });
  },
});
