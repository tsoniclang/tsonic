import { type SourceAnalysisProgram } from "../../analysis-program.js";
import type { Node } from "@tsonic/tsts";
import type { SourceCallSelection } from "../../../public/source/selections.js";
import type { SourceJsCallStorage, SourceJsNativeConstructorStorage } from "../../../public/source/objects.js";
import type { SourceStorageTargetPremises } from "../../../public/source/analyses.js";
import type { SourceStorageEffects } from "./types.js";
/**
 * The storage effects the Host storage analysis runs with (R2 #8): the JS API call and callback effects the Host
 * publishes in facts.profile, composed here by the Host, never supplied by a target. The one target input is the
 * premise of which ambient provider classes the target binds to plain native constructors (a target ABI fact).
 */
export declare function createSourceProfileStorageEffects(source: SourceAnalysisProgram, premises: SourceStorageTargetPremises): SourceStorageEffects;
/**
 * The global-binding storage effects for one operation selection: a call effect counts only when the call names the
 * operation through its own global binding (or receiver), and a provider global constructs natively only through its
 * declared construct signatures. `select` / `selectConstructor` are the profile answers (createSourceProfileStorageEffects).
 */
export declare function createSourceGlobalCallStorageEffects(source: SourceAnalysisProgram, select: (node: Node, call: SourceCallSelection) => SourceJsCallStorage | undefined, selectConstructor: (declaration: Node) => SourceJsNativeConstructorStorage | undefined): SourceStorageEffects;
//# sourceMappingURL=global-call-effects.d.ts.map