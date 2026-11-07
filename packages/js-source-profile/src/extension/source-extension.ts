import { sourceSemanticsExtensionId } from "@tsonic/tsts";
import type { TargetSourceExtensionContribution } from "@tsonic/target-api";
import { jsSourceSemanticsIdentity } from "../identities/source.js";
import { createJsSourceVirtualModulesProvider } from "./source-virtual-modules.js";

/**
 * The JS surface's source extension, as a target contribution (data only, K-2682): its identity, the source-semantics
 * extension it runs after, and the JS virtual-modules declaration provider. The Host composition root builds the
 * compiler extension from it (host createTargetContributedCompilerExtension).
 */
export function jsSourceExtensionContribution(): TargetSourceExtensionContribution {
  return Object.freeze({
    identity: Object.freeze({
      id: jsSourceSemanticsIdentity.extensionId,
      version: jsSourceSemanticsIdentity.providerVersion,
    }),
    dependsOn: Object.freeze([sourceSemanticsExtensionId]),
    declarationProviders: Object.freeze([createJsSourceVirtualModulesProvider()]),
  });
}
