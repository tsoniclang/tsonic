import type { Node } from "@tsonic/tsts";
import type { SourceStorageSubject } from "../../../source-model/storage.js";
import type { SourceStorageWrittenValue } from "../../../source-model/storage.js";
import type { SourceStorageWriteProjection } from "./projections.js";

export interface SourceStorageWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "initialization" | "mutation";
  readonly value?: SourceStorageSubject;
  readonly values: readonly SourceStorageWrittenValue[];
  readonly reason?: string;
  readonly birth?: NonNullable<SourceStorageWriteProjection["birth"]>;
  readonly destination?: "binding" | "member" | "element" | "pointer";
}

export interface SourceStorageStore extends SourceStorageWrite {
  readonly storage: SourceStorageSubject;
  readonly region: Node;
  readonly receiver?: SourceStorageSubject;
  readonly destination: "binding" | "member" | "element" | "pointer";
}
