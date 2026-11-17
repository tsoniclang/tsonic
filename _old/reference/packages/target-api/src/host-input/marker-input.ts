import type { Node } from "@tsonic/tsts";
import type { SourcePresence } from "../public/source/contracts.js";

export interface SourceInputFieldMarker {
  readonly name: string;
  readonly typeNode: Node;
  readonly readonly: boolean;
}

export interface SourceInputMarkers {
  readonly struct: SourcePresence<{ readonly valueType: boolean; readonly fields: readonly SourceInputFieldMarker[] | undefined }>;
  readonly field: SourcePresence<SourceInputFieldMarker>;
  readonly defaultValue: SourcePresence<{ readonly typeNode: Node }>;
  readonly jsString: boolean;
  readonly pointer: SourcePresence<{
    readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
    readonly exportName: string;
    readonly arguments: readonly Node[];
    readonly typeArguments: readonly Node[];
    readonly selection: "applicable" | "conditional-candidates" | "untyped" | "unvisited";
    readonly pointee: "available" | "unvisited" | "not-applicable" | "missing";
  }>;
}

export interface SourceInputMarkerQueries {
  markers(occurrence: Node): SourceInputMarkers;
}
