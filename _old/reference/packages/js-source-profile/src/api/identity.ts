import type { SourceProfileDeclarationIdentity } from "@tsonic/target-api/source";
import { jsSourceSemanticsIdentity } from "../identities/source.js";

export interface JsProfileIdentity {
  readonly scope: "js" | "shared";
  readonly identity: SourceProfileDeclarationIdentity;
}

export function jsProfileIdentity(identity: SourceProfileDeclarationIdentity): JsProfileIdentity {
  return Object.freeze({ scope: identity.owner === "js" || identity.owner === jsSourceSemanticsIdentity.providerId ? "js" : "shared", identity });
}
