import type { Node } from "@tsonic/tsts";
import type { SourceInputCoreQueries, SourceInputOriginalSubjects } from "../host-input/core-input.js";
import type { SourceInputComponent } from "../host-input/identities.js";
import type { SourceApplicationFacts, SourceDescriptorView, SourcePresence, SourceRefusal, SourceResult, SourceTypeEvidence, SourceValueFacts } from "../public/source/contracts.js";
import type { SourceStoragePlace } from "../source-model/protocols.js";

export interface SourcePointerProductionInput {
  readonly core: SourceInputCoreQueries;
  readonly applications: SourceApplicationFacts;
  readonly values: SourceValueFacts;
  readonly view: SourceDescriptorView;
  readonly assertNode: (node: Node) => void;
  readonly originalComponent: (value: SourceTypeEvidence) => SourcePresence<SourceInputComponent>;
  readonly sourceOriginSubjects: (value: SourceTypeEvidence) => SourceInputOriginalSubjects["origins"];
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly publish: (component: SourceInputComponent, receiver?: SourceTypeEvidence) => SourceResult<SourceTypeEvidence>;
  readonly storage: (occurrence: Node) => SourceResult<SourcePresence<SourceStoragePlace>>;
  readonly unavailable: (node: Node, reason: string) => SourceRefusal;
}
