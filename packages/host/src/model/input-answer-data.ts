import type { Original, Presence } from "./foundation-data.js";
import type { SourceDocument } from "./program-input-data.js";
import type {
  OriginalRecord, ObservedReference, ObservedModule, ObservedImplementation,
  ObservedHeritageEdge, ObservedConstructor, ObservedEnum, ObservedMemberUse,
  ObservedPropertyName, ObservedProtocol,
} from "./original-input-data.js";
import type {
  ObservedCallableAssociation, ObservedProviderDeclaration, ObservedComponent,
  ObservedType, ObservedSignature, ObservedCallSelection, ObservedConstraint,
  ObservedMemberInventory,
} from "./input-data.js";
import type { CoreInputObservation } from "./core-input-data.js";

export type OriginalObservation =
  | { readonly kind: "record"; readonly record: OriginalRecord }
  | { readonly kind: "document"; readonly document: Presence<SourceDocument> }
  | { readonly kind: "reference"; readonly reference: Presence<ObservedReference> }
  | { readonly kind: "module"; readonly module: ObservedModule }
  | { readonly kind: "implementation"; readonly implementation: ObservedImplementation }
  | { readonly kind: "member-contracts"; readonly declaration: Original;
      readonly contracts: readonly Original[] }
  | { readonly kind: "member-dispatch"; readonly declaration: Original;
      readonly dispatch: Presence<{
        readonly overridesBase: boolean; readonly hasDerivedOverride: boolean;
      }> }
  | { readonly kind: "heritage"; readonly relation:
        | { readonly kind: "related"; readonly edges: readonly ObservedHeritageEdge[] }
        | { readonly kind: "unrelated" } }
  | { readonly kind: "constructors"; readonly constructors: ObservedConstructor }
  | { readonly kind: "callable-association"; readonly association: ObservedCallableAssociation }
  | { readonly kind: "enum"; readonly enumeration: ObservedEnum }
  | { readonly kind: "provider"; readonly provider: Presence<ObservedProviderDeclaration> };
export type ComponentObservation =
  | { readonly kind: "syntax"; readonly component: ObservedComponent }
  | { readonly kind: "describe"; readonly type: ObservedType }
  | { readonly kind: "class-facets"; readonly instance: Original; readonly value: Original }
  | { readonly kind: "signature"; readonly signature: ObservedSignature }
  | { readonly kind: "declaration-signature"; readonly signature: Presence<Original> }
  | { readonly kind: "signature-component"; readonly component: ObservedComponent };
export type ApplicationObservation =
  | { readonly kind: "invocation"; readonly selection: ObservedCallSelection }
  | { readonly kind: "constraints"; readonly constraints: readonly ObservedConstraint[] };
export type MemberObservation =
  | { readonly kind: "inventory"; readonly inventory: ObservedMemberInventory }
  | { readonly kind: "use"; readonly use: Presence<ObservedMemberUse> }
  | { readonly kind: "property-name"; readonly name: ObservedPropertyName };
export type ExtensionObservation =
  | { readonly kind: "core"; readonly observation: CoreInputObservation }
  | { readonly kind: "protocol"; readonly observation: Presence<ObservedProtocol> };
