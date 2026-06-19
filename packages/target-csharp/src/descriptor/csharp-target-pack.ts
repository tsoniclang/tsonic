import type {
  TargetBackend,
  TargetBackendContext,
  TargetExtensionContext,
  TargetPack,
  TargetToolchain,
} from "@tsonic/target-api";
import type { CompilerExtension } from "@tsonic/tsts";
import { createCsharpBackend } from "../backend/csharp-backend.js";
import { createCsharpCoreVirtualModulesExtension, createCsharpSourceSemanticsExtension } from "../source/csharp-source-semantics.js";
import { createDotnetToolchain } from "../toolchain/dotnet-toolchain.js";

export const csharpTargetId = "csharp";

export function createCsharpTargetPack(): TargetPack {
  return {
    id: csharpTargetId,
    displayName: "C#",
    createExtensions(context: TargetExtensionContext): readonly CompilerExtension[] {
      return [
        createCsharpCoreVirtualModulesExtension(context),
        createCsharpSourceSemanticsExtension(context),
      ];
    },
    createBackend(context: TargetBackendContext): TargetBackend {
      return createCsharpBackend(context);
    },
    createToolchain(context: TargetBackendContext): TargetToolchain {
      return createDotnetToolchain(context);
    },
  };
}
