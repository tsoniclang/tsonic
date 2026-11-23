import type {
  DocumentationStructureReceipt, DocumentationStructureSyntax, EntityName, Expression, ExpressionWithTypeArguments,
  Identifier, ImportAttributes, ImportClause, JSDocAugmentsTag, JSDocCallbackTag, JSDocComment, JSDocFullName,
  JSDocImplementsTag, JSDocImportTag, JSDocLink, JSDocLinkCode, JSDocLinkPlain, JSDocNameReference,
  JSDocParameterOrPropertyTag, JSDocReturnTag, JSDocSeeTag, JSDocTag, JSDocTemplateTag, JSDocThrowsTag,
  JSDocTypeTag, JSDocTypedefTag, Phase, SyntaxChildListField, SyntaxChildSlot, SyntaxCopyResult, SyntaxNode,
  TypeNode, TypeParameterDeclaration,
} from "./contract.js";
import {
  children, heldChild, heldList, heldOptionalList, heldVector, prependSlots,
} from "./child-slot-storage.js";

export function isDocumentationStructure<P extends Phase>(node: SyntaxNode<P>): node is DocumentationStructureSyntax<P> {
  switch (node.kind) {
    case "SyntaxList": case "JSDoc": case "JSDocNameReference": case "JSDocLink": case "JSDocLinkCode":
    case "JSDocLinkPlain": case "JSDocTypeLiteral": case "JSDocTypeTag": case "JSDocUnknownTag": case "JSDocTemplateTag":
    case "JSDocReturnTag": case "JSDocPublicTag": case "JSDocPrivateTag": case "JSDocProtectedTag": case "JSDocReadonlyTag":
    case "JSDocOverrideTag": case "JSDocDeprecatedTag": case "JSDocSeeTag": case "JSDocImplementsTag": case "JSDocAugmentsTag":
    case "JSDocSatisfiesTag": case "JSDocThrowsTag": case "JSDocThisTag": case "JSDocImportTag": case "JSDocCallbackTag":
    case "JSDocOverloadTag": case "JSDocTypedefTag": case "JSDocParameterTag": case "JSDocPropertyTag": return true;
    default: return false;
  }
}

export function docReferenceSlots<P extends Phase>(name: () => EntityName<P>) {
  return children<P, JSDocNameReference<P>>(["name", "required", name]);
}

export function docLinkSlots<P extends Phase>(name: () => EntityName<P> | null) {
  return children<P, JSDocLink<P> | JSDocLinkPlain<P> | JSDocLinkCode<P>>(["name", "nullable", name]);
}

export function* docTagSlots<P extends Phase>(name: () => Identifier<P>, body: Iterable<SyntaxChildSlot<P>>,
  comment: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, JSDocTag<P>>(["tagName", "required", name]);
  yield* body;
  yield* comment();
}

export function docTypeSlots<P extends Phase>(type: () => SyntaxNode<P>) {
  return children<P, JSDocTypeTag<P>>(["typeExpression", "required", type]);
}

export function docOptionalTypeSlots<P extends Phase>(type: () => TypeNode<P> | null) {
  return children<P, JSDocReturnTag<P> | JSDocThrowsTag<P>>(["typeExpression", "nullable", type]);
}

export function docTemplateSlots<P extends Phase>(constraint: () => SyntaxNode<P>, parameters: () => Iterable<SyntaxChildSlot<P>>) {
  return prependSlots<P>(children<P, JSDocTemplateTag<P>>(["constraint", "required", constraint]), parameters());
}

export function docSeeSlots<P extends Phase>(name: () => TypeNode<P>) {
  return children<P, JSDocSeeTag<P>>(["nameExpression", "required", name]);
}

export function docHeritageSlots<P extends Phase>(name: () => ExpressionWithTypeArguments<P>) {
  return children<P, JSDocAugmentsTag<P> | JSDocImplementsTag<P>>(["className", "required", name]);
}

export function docImportSlots<P extends Phase>(clause: () => ImportClause<P> | null, specifier: () => Expression<P>,
  attributes: () => ImportAttributes<P> | null) {
  return children<P, JSDocImportTag<P>>(["importClause", "nullable", clause], ["moduleSpecifier", "required", specifier], ["attributes", "nullable", attributes]);
}

export function docCallbackSlots<P extends Phase>(type: () => TypeNode<P>, name: () => JSDocFullName<P> | null) {
  return children<P, JSDocCallbackTag<P>>(["typeExpression", "required", type], ["name", "nullable", name]);
}

export function docTypedefSlots<P extends Phase>(type: () => SyntaxNode<P> | null, name: () => JSDocFullName<P> | null) {
  return children<P, JSDocTypedefTag<P>>(["typeExpression", "nullable", type], ["name", "nullable", name]);
}

export function docParameterSlots<P extends Phase>(name: () => EntityName<P>, type: () => TypeNode<P> | null) {
  return children<P, JSDocParameterOrPropertyTag<P>>(["name", "required", name], ["typeExpression", "nullable", type]);
}

export function prepareDocumentationStructure<P extends Phase, Stop>(node: DocumentationStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<DocumentationStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "SyntaxList": {
      const stop = admitList("children");
      if (stop !== null) return { kind: "refused", stop };
      const contents = heldVector<P, SyntaxNode<P>>("children", () => node.children);
      return { kind: "copied", value: { kind: "syntax-list", ordinal, slots: contents.slots(), children: contents.finish } };
    }
    case "JSDoc": {
      const contentStop = admitList("comment");
      if (contentStop !== null) return { kind: "refused", stop: contentStop };
      const rawTags = node.tags;
      const stop = rawTags === null ? null : admitList("tags");
      if (stop !== null) return { kind: "refused", stop };
      const content = heldList<P, JSDocComment<P>>("comment", () => node.comment);
      const tags = heldOptionalList<P, JSDocTag<P>>("tags", rawTags);
      return { kind: "copied", value: { kind: "documentation", ordinal, slots: prependSlots<P>(content.slots(), tags.slots()), content: content.finish, tags: tags.finish } };
    }
    case "JSDocNameReference": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "doc-reference", ordinal, slots: docReferenceSlots<P>(name.pull), name: name.read } };
    }
    case "JSDocLink": case "JSDocLinkPlain": case "JSDocLinkCode": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "doc-link", ordinal, slots: docLinkSlots<P>(name.pull), name: name.read } };
    }
    case "JSDocTypeLiteral": {
      const rawTags = node.jsDocPropertyTags;
      if (rawTags === null) return { kind: "copied", value: { kind: "doc-literal", ordinal, slots: [], tags: () => null } };
      const stop = admitList("jsDocPropertyTags");
      if (stop !== null) return { kind: "refused", stop };
      const tags = heldVector<P, JSDocTag<P>>("jsDocPropertyTags", () => rawTags);
      return { kind: "copied", value: { kind: "doc-literal", ordinal, slots: tags.slots(), tags: tags.finish } };
    }
  }
  const rawComment = node.comment;
  const stop = rawComment === null ? null : admitList("comment");
  if (stop !== null) return { kind: "refused", stop };
  const comment = heldOptionalList<P, JSDocComment<P>>("comment", rawComment);
  const tag = heldChild(() => node.tagName);
  const base = { ordinal, tagName: tag.read, comment: comment.finish };
  const slots = (body: Iterable<SyntaxChildSlot<P>>) => docTagSlots<P>(tag.pull, body, comment.slots);
  switch (node.kind) {
    case "JSDocUnknownTag": case "JSDocPublicTag": case "JSDocPrivateTag": case "JSDocProtectedTag":
    case "JSDocReadonlyTag": case "JSDocOverrideTag": case "JSDocDeprecatedTag":
      return { kind: "copied", value: { kind: "doc-tag", ...base, slots: slots([]) } };
    case "JSDocTypeTag": {
      const type = heldChild(() => node.typeExpression);
      return { kind: "copied", value: { kind: "doc-syntax-type-tag", ...base, slots: slots(docTypeSlots<P>(type.pull)), type: type.read } };
    }
    case "JSDocSatisfiesTag": case "JSDocThisTag": case "JSDocOverloadTag": {
      const type = heldChild(() => node.typeExpression);
      return { kind: "copied", value: { kind: "doc-type-tag", ...base, slots: slots(docTypeSlots<P>(type.pull)), type: type.read } };
    }
    case "JSDocReturnTag": case "JSDocThrowsTag": {
      const type = heldChild(() => node.typeExpression);
      return { kind: "copied", value: { kind: "doc-optional-type-tag", ...base, slots: slots(docOptionalTypeSlots<P>(type.pull)), type: type.read } };
    }
    case "JSDocTemplateTag": {
      const stop = admitList("typeParameters");
      if (stop !== null) return { kind: "refused", stop };
      const constraint = heldChild(() => node.constraint);
      const parameters = heldList<P, TypeParameterDeclaration<P>>("typeParameters", () => node.typeParameters);
      return { kind: "copied", value: { kind: "doc-template", ...base, slots: slots(docTemplateSlots<P>(constraint.pull, parameters.slots)),
        constraint: constraint.read, parameters: parameters.finish } };
    }
    case "JSDocSeeTag": {
      const name = heldChild(() => node.nameExpression);
      return { kind: "copied", value: { kind: "doc-see", ...base, slots: slots(docSeeSlots<P>(name.pull)), name: name.read } };
    }
    case "JSDocImplementsTag": case "JSDocAugmentsTag": {
      const name = heldChild(() => node.className);
      return { kind: "copied", value: { kind: "doc-heritage", ...base, slots: slots(docHeritageSlots<P>(name.pull)), name: name.read } };
    }
    case "JSDocImportTag": {
      const clause = heldChild(() => node.importClause);
      const specifier = heldChild(() => node.moduleSpecifier);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "doc-import", ...base, slots: slots(docImportSlots<P>(clause.pull, specifier.pull, attributes.pull)),
        clause: clause.read, specifier: specifier.read, attributes: attributes.read } };
    }
    case "JSDocCallbackTag": {
      const type = heldChild(() => node.typeExpression);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "doc-callback", ...base, slots: slots(docCallbackSlots<P>(type.pull, name.pull)), type: type.read, name: name.read } };
    }
    case "JSDocTypedefTag": {
      const type = heldChild(() => node.typeExpression);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "doc-typedef", ...base, slots: slots(docTypedefSlots<P>(type.pull, name.pull)), type: type.read, name: name.read } };
    }
    case "JSDocPropertyTag": case "JSDocParameterTag": {
      const name = heldChild(() => node.name);
      const type = heldChild(() => node.typeExpression);
      return { kind: "copied", value: { kind: "doc-parameter", ...base, slots: slots(docParameterSlots<P>(name.pull, type.pull)), type: type.read, name: name.read } };
    }
  }
}
