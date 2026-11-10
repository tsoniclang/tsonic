import {
  sourceSemanticsExtensionId,
} from "@tsonic/tsts";
import type { CompilerExtension, ExtensionInitializeContext } from "@tsonic/tsts";
import { jsSourceSemanticsIdentity } from "../identities/source.js";
import { createJsSourceVirtualModulesProvider } from "./source-virtual-modules.js";

export function createJsSourceSemanticsExtension(): CompilerExtension {
  return Object.freeze({
    identity: Object.freeze({
      id: jsSourceSemanticsIdentity.extensionId,
      version: jsSourceSemanticsIdentity.providerVersion,
    }),
    dependencies: Object.freeze({
      dependsOn: Object.freeze([sourceSemanticsExtensionId]),
      runsAfter: Object.freeze([sourceSemanticsExtensionId]),
    }),
    initialize(context: ExtensionInitializeContext): void {
      context.registerSourceDeclarationProvider(
        createJsSourceVirtualModulesProvider(),
      );
    },
  });
}
