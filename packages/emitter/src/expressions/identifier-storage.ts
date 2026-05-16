export {
  buildRuntimeSubsetExpressionAst,
  isBroadStorageTarget,
  matchesEmittedStorageSurface,
  tryEmitCollapsedStorageIdentifier,
  tryEmitExactStorageCompatibleNarrowedIdentifier,
  tryEmitImplicitNarrowedStorageIdentifier,
  tryEmitImplicitRuntimeSubsetStorageIdentifier,
  tryEmitMaterializedNarrowedIdentifier,
  tryEmitReifiedStorageIdentifier,
  tryEmitRuntimeSubsetMemberProjectionIdentifier,
  tryEmitStorageCompatibleIdentifier,
  tryEmitStorageCompatibleNarrowedIdentifier,
} from "./identifier-storage/storage-surface.js";
