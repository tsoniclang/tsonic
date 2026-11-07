import type { SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceFile } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";
import type { SourceStorageProjectionView } from "../graph/scoped-model.js";
import { sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageIsMemberProjection } from "../model/subjects.js";

function selectedView(subject: SourceStorageSubject, views: readonly SourceStorageProjectionView[] | undefined):
  SourceStorageProjectionView | undefined {
  for (let index = (views?.length ?? 0) - 1; index >= 0; index -= 1) {
    const view = views![index]!;
    const receiver = view.receiver;
    if (receiver.node !== subject.node || receiver.kind !== subject.kind || receiver.projection.length > subject.projection.length) continue;
    if (receiver.projection.every((component, ordinal) => {
      const other = subject.projection[ordinal];
      return other?.kind === component.kind && (sourceStorageIsMemberProjection(component)
        ? sourceStorageIsMemberProjection(other) && component.declaration === other.declaration
        : component.kind !== "tuple-element" || other.kind === "tuple-element" && component.index === other.index);
    })) return view;
  }
  return undefined;
}

export function sourceStorageProjectionType(source: SourceAnalysisProgram, subject: SourceStorageSubject,
  views: readonly SourceStorageProjectionView[] | undefined, sourceFile?: SourceFile): SourceTypeDescriptor | undefined {
  const view = selectedView(subject, views);
  if (view === undefined) return sourceStorageSubjectType(source, subject, sourceFile);
  let type: SourceTypeDescriptor | undefined = view.type;
  for (const component of subject.projection.slice(view.receiver.projection.length)) {
    if (type === undefined) return undefined;
    type = sourceStorageComponentType(source, type, component);
  }
  return type;
}

export function sourceStorageProjectionSubject(subject: SourceStorageSubject,
  views: readonly SourceStorageProjectionView[] | undefined, select: SourceStorageSubjectQuery): SourceStorageSubject | undefined {
  const view = selectedView(subject, views);
  return view === undefined ? subject : select(view.source.node, view.source.kind,
    [...view.source.projection, ...subject.projection.slice(view.receiver.projection.length)]);
}

export function sourceStorageWithProjectionView(views: readonly SourceStorageProjectionView[] | undefined,
  receiver: SourceStorageSubject, checked: SourceStorageSubject, type: SourceTypeDescriptor): readonly SourceStorageProjectionView[] {
  const previous = views?.find(view => view.receiver === receiver);
  if (previous?.source === checked && previous.type === type) return views!;
  return Object.freeze([...(views ?? []).filter(view => view.receiver !== receiver),
    Object.freeze({ receiver, source: checked, type })]);
}
