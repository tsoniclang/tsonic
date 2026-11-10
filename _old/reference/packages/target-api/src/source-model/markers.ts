import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";

export interface SourceFieldMarker {
  readonly name: string;
  readonly typeNode: Node;
  readonly value: SourceTypeEvidence;
  readonly readonly: boolean;
}

export interface SourceTypeMarkers {
  readonly value: SourceTypeEvidence;
  readonly struct: SourcePresence<{
    readonly valueType: boolean;
    readonly fields: readonly SourceFieldMarker[];
  }>;
  readonly jsString: boolean;
}

export interface SourceDeclarationMarkers {
  readonly occurrence: Node;
  readonly field: SourcePresence<SourceFieldMarker>;
  readonly defaultValue: SourcePresence<{ readonly typeNode: Node; readonly value: SourceTypeEvidence }>;
}

export interface SourceMarkerFacts {
  typeMarkers(value: SourceTypeEvidence): SourceResult<SourceTypeMarkers>;
  declarationMarkers(occurrence: Node): SourceResult<SourceDeclarationMarkers>;
}
