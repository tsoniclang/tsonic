import {
  defineBackendTargetId,
  type EmittableIrModule,
} from "@tsonic/frontend";

export const CSHARP_EMITTER_TARGET_ID = defineBackendTargetId("csharp");

export type CSharpEmittableIrModule = EmittableIrModule<
  typeof CSHARP_EMITTER_TARGET_ID
>;
