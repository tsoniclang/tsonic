import type {
  DotDotDotToken, Expression, Identifier, JsxAttribute, JsxAttributeLike, JsxAttributeName, JsxAttributeValue,
  JsxAttributes, JsxChild, JsxClosingElement, JsxClosingFragment, JsxElement, JsxExpression, JsxFragment,
  JsxNamespacedName, JsxOpeningElement, JsxOpeningFragment, JsxSelfClosingElement, JsxStructureReceipt,
  JsxStructureSyntax, JsxTagNameExpression, Phase, SyntaxChildListField, SyntaxChildSlot, SyntaxCopyResult,
  SyntaxNode, TypeNode,
} from "./contract.js";
import {
  children, heldChild, heldList, heldOptionalList,
} from "./child-slot-storage.js";

export function isJsxStructure<P extends Phase>(node: SyntaxNode<P>): node is JsxStructureSyntax<P> {
  switch (node.kind) {
    case "JsxElement": case "JsxAttributes": case "JsxNamespacedName": case "JsxOpeningElement": case "JsxSelfClosingElement":
    case "JsxFragment": case "JsxAttribute": case "JsxClosingElement": case "JsxExpression": return true;
    default: return false;
  }
}

export function* jsxElementSlots<P extends Phase>(opening: () => JsxOpeningElement<P>, inner: () => Iterable<SyntaxChildSlot<P>>,
  closing: () => JsxClosingElement<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, JsxElement<P>>(["openingElement", "required", opening]);
  yield* inner();
  yield* children<P, JsxElement<P>>(["closingElement", "required", closing]);
}

export function* jsxFragmentSlots<P extends Phase>(opening: () => JsxOpeningFragment<P>, inner: () => Iterable<SyntaxChildSlot<P>>,
  closing: () => JsxClosingFragment<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, JsxFragment<P>>(["openingFragment", "required", opening]);
  yield* inner();
  yield* children<P, JsxFragment<P>>(["closingFragment", "required", closing]);
}

export function jsxNameSlots<P extends Phase>(namespace: () => Identifier<P>, name: () => Identifier<P>) {
  return children<P, JsxNamespacedName<P>>(["namespace", "required", namespace], ["name", "required", name]);
}

export function jsxTagSlots<P extends Phase>(name: () => JsxTagNameExpression<P>) {
  return children<P, JsxOpeningElement<P> | JsxSelfClosingElement<P> | JsxClosingElement<P>>(["tagName", "required", name]);
}

export function* jsxOpeningSlots<P extends Phase>(name: () => JsxTagNameExpression<P>, args: () => Iterable<SyntaxChildSlot<P>>,
  attributes: () => JsxAttributes<P>): Generator<SyntaxChildSlot<P>> {
  yield* jsxTagSlots<P>(name);
  yield* args();
  yield* children<P, JsxOpeningElement<P> | JsxSelfClosingElement<P>>(["attributes", "required", attributes]);
}

export function jsxAttributeSlots<P extends Phase>(name: () => JsxAttributeName<P>, initializer: () => JsxAttributeValue<P> | null) {
  return children<P, JsxAttribute<P>>(["name", "required", name], ["initializer", "nullable", initializer]);
}

export function jsxExpressionSlots<P extends Phase>(dots: () => DotDotDotToken<P> | null, expression: () => Expression<P> | null) {
  return children<P, JsxExpression<P>>(["dotDotDotToken", "nullable", dots], ["expression", "nullable", expression]);
}

export function prepareJsxStructure<P extends Phase, Stop>(node: JsxStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<JsxStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "JsxElement": case "JsxFragment": {
      const stop = admitList("children");
      if (stop !== null) return { kind: "refused", stop };
      const inner = heldList<P, JsxChild<P>>("children", () => node.children);
      if (node.kind === "JsxElement") {
        const opening = heldChild(() => node.openingElement);
        const closing = heldChild(() => node.closingElement);
        return { kind: "copied", value: { kind: "jsx-element", ordinal, slots: jsxElementSlots<P>(opening.pull, inner.slots, closing.pull),
          opening: opening.read, closing: closing.read, children: inner.finish } };
      }
      const opening = heldChild(() => node.openingFragment);
      const closing = heldChild(() => node.closingFragment);
      return { kind: "copied", value: { kind: "jsx-fragment", ordinal, slots: jsxFragmentSlots<P>(opening.pull, inner.slots, closing.pull),
        opening: opening.read, closing: closing.read, children: inner.finish } };
    }
    case "JsxAttributes": {
      const stop = admitList("properties");
      if (stop !== null) return { kind: "refused", stop };
      const properties = heldList<P, JsxAttributeLike<P>>("properties", () => node.properties);
      return { kind: "copied", value: { kind: "jsx-attributes", ordinal, slots: properties.slots(), properties: properties.finish } };
    }
    case "JsxNamespacedName": {
      const namespace = heldChild(() => node.namespace);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "jsx-name", ordinal, slots: jsxNameSlots<P>(namespace.pull, name.pull), namespace: namespace.read, name: name.read } };
    }
    case "JsxOpeningElement": case "JsxSelfClosingElement": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      const name = heldChild(() => node.tagName);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "jsx-opening", ordinal, slots: jsxOpeningSlots<P>(name.pull, args.slots, attributes.pull),
        name: name.read, args: args.finish, attributes: attributes.read } };
    }
    case "JsxAttribute": {
      const name = heldChild(() => node.name);
      const initializer = heldChild(() => node.initializer);
      return { kind: "copied", value: { kind: "jsx-attribute", ordinal, slots: jsxAttributeSlots<P>(name.pull, initializer.pull),
        name: name.read, initializer: initializer.read } };
    }
    case "JsxClosingElement": {
      const name = heldChild(() => node.tagName);
      return { kind: "copied", value: { kind: "jsx-closing", ordinal, slots: jsxTagSlots<P>(name.pull), name: name.read } };
    }
    case "JsxExpression": {
      const dots = heldChild(() => node.dotDotDotToken);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "jsx-expression", ordinal, slots: jsxExpressionSlots<P>(dots.pull, expression.pull), dots: dots.read, expression: expression.read } };
    }
  }
}
