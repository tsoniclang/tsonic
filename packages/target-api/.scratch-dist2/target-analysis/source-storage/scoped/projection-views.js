import { sourceStorageComponentType, sourceStorageSubjectType } from "../model/components.js";
import { sourceStorageIsMemberProjection } from "../model/subjects.js";
function selectedView(subject, views) {
    for (let index = (views?.length ?? 0) - 1; index >= 0; index -= 1) {
        const view = views[index];
        const receiver = view.receiver;
        if (receiver.node !== subject.node || receiver.kind !== subject.kind || receiver.projection.length > subject.projection.length)
            continue;
        if (receiver.projection.every((component, ordinal) => {
            const other = subject.projection[ordinal];
            return other?.kind === component.kind && (sourceStorageIsMemberProjection(component)
                ? sourceStorageIsMemberProjection(other) && component.declaration === other.declaration
                : component.kind !== "tuple-element" || other.kind === "tuple-element" && component.index === other.index);
        }))
            return view;
    }
    return undefined;
}
export function sourceStorageProjectionType(source, subject, views, sourceFile) {
    const view = selectedView(subject, views);
    if (view === undefined)
        return sourceStorageSubjectType(source, subject, sourceFile);
    let type = view.type;
    for (const component of subject.projection.slice(view.receiver.projection.length)) {
        if (type === undefined)
            return undefined;
        type = sourceStorageComponentType(source, type, component);
    }
    return type;
}
export function sourceStorageProjectionSubject(subject, views, select) {
    const view = selectedView(subject, views);
    return view === undefined ? subject : select(view.source.node, view.source.kind, [...view.source.projection, ...subject.projection.slice(view.receiver.projection.length)]);
}
export function sourceStorageWithProjectionView(views, receiver, checked, type) {
    const previous = views?.find(view => view.receiver === receiver);
    if (previous?.source === checked && previous.type === type)
        return views;
    return Object.freeze([...(views ?? []).filter(view => view.receiver !== receiver),
        Object.freeze({ receiver, source: checked, type })]);
}
//# sourceMappingURL=projection-views.js.map