import type { Node } from "@tsonic/tsts";
import type { SourceMemberOrigin, SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceLiteralKey } from "./literals/key.js";

export interface SourceCorrespondenceMember {
  readonly receiver: SourceTypeEvidence;
  readonly key: SourceLiteralKey;
  readonly name: string;
  readonly declarations: readonly Node[];
  readonly origins: readonly SourceMemberOrigin[];
  readonly readOrigins: readonly SourceMemberOrigin[];
  readonly writeOrigins: readonly SourceMemberOrigin[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly read: "property" | "accessor" | "method" | "unavailable";
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
}

export interface SourceCorrespondenceIndex {
  readonly receiver: SourceTypeEvidence;
  readonly declarations: readonly Node[];
  readonly keyType: SourceTypeEvidence;
  readonly readType: SourceTypeEvidence | undefined;
  readonly writeType: SourceTypeEvidence | undefined;
  readonly readonly: boolean;
}

export type SourceCorrespondenceMemberIdentity = Omit<SourceCorrespondenceMember, "receiver" | "readType" | "writeType">;

export type SourceMemberPair<Member extends SourceCorrespondenceMemberIdentity = SourceCorrespondenceMember> =
  | { readonly kind: "present"; readonly source: Member; readonly destination: Member }
  | { readonly kind: "absent"; readonly destination: Member };

export interface SourceIndexPair {
  readonly destination: SourceCorrespondenceIndex;
  readonly sources: readonly {
    readonly source: SourceCorrespondenceIndex;
    readonly coverage: "yes" | "deferred";
  }[];
}

export type SourceMemberCorrespondence =
  | { readonly kind: "available"; readonly source: SourceTypeEvidence; readonly destination: SourceTypeEvidence;
      readonly members: readonly SourceMemberPair[]; readonly indexes: readonly SourceIndexPair[] }
  | { readonly kind: "unavailable"; readonly reason: "unresolved-shape" | "missing-required-member" |
      "inconsistent-member" | "unreadable-member" | "disjoint-shape" };

export interface SourceMemberCorrespondenceQueries {
  correspondence(source: SourceTypeEvidence, destination: SourceTypeEvidence,
    purpose: "correspondence" | "read"): SourceResult<SourceMemberCorrespondence>;
  correspondingMember(source: SourceTypeEvidence, destination: SourceTypeEvidence, declaration: Node,
    purpose: "correspondence" | "read"): SourceResult<SourcePresence<SourceMemberPair>>;
}
