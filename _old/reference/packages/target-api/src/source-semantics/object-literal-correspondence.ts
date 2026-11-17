import type { Node } from "@tsonic/tsts";
import type { SourcePresence, SourceResult, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceCorrespondenceMember, SourceMemberCorrespondenceQueries } from "../source-model/members.js";

export function sourceObjectLiteralDestinationMember(element: Node, source: SourceTypeEvidence,
  destination: SourceTypeEvidence, objects: SourceMemberCorrespondenceQueries):
  SourceResult<SourcePresence<SourceCorrespondenceMember>> {
  const correspondence = objects.correspondence(source, destination, "correspondence");
  if (correspondence.kind === "refused") return correspondence;
  if (correspondence.value.kind !== "available") return Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) });
  const pairs = correspondence.value.members.filter(pair => pair.kind === "present" &&
    pair.source.declarations.includes(element));
  return Object.freeze({ kind: "resolved", value: pairs.length === 1
    ? Object.freeze({ kind: "present", value: pairs[0]!.destination }) : Object.freeze({ kind: "none" }) });
}
