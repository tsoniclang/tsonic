import type {
  ArrowFunction, AsteriskToken, BlockOrExpression, Decorator, EntityName, EqualsGreaterThanToken, EqualsToken,
  ExclamationToken, Expression, ExpressionStructureReceipt, ExpressionStructureSyntax, ExpressionWithTypeArguments,
  Identifier, LeftHandSideExpression, MetaProperty, ModifierLike, Phase, PropertyAssignment, PropertyName,
  QualifiedName, QuestionDotToken, QuestionToken, ShorthandPropertyAssignment, SyntaxChildListField,
  SyntaxChildSlot, SyntaxCopyResult, SyntaxNode, SyntheticReferenceExpression, TaggedTemplateExpression,
  TemplateLiteral, TemplateMiddleOrTail, TemplateSpan, TypeAssertion, TypeNode, YieldExpression,
} from "./contract.js";
import {
  children, heldChild, heldList, heldOptionalList,
} from "./child-slot-storage.js";
import {
  templateHeadSlots, prepareCallableStructure,
} from "./type-slots.js";

export function isExpressionStructure<P extends Phase>(node: SyntaxNode<P>): node is ExpressionStructureSyntax<P> {
  switch (node.kind) {
    case "QualifiedName": case "YieldExpression": case "ArrowFunction": case "MetaProperty": case "TemplateExpression":
    case "TemplateSpan": case "TaggedTemplateExpression": case "PropertyAssignment": case "ShorthandPropertyAssignment":
    case "TypeAssertionExpression": case "ExpressionWithTypeArguments": case "SyntheticReferenceExpression": case "Decorator": return true;
    default: return false;
  }
}

export function qualifiedNameSlots<P extends Phase>(left: () => EntityName<P>, right: () => Identifier<P>) {
  return children<P, QualifiedName<P>>(["left", "required", left], ["right", "required", right]);
}

export function yieldSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null, expression: () => Expression<P> | null) {
  return children<P, YieldExpression<P>>(["asteriskToken", "nullable", asterisk], ["expression", "nullable", expression]);
}

export function* arrowSlots<P extends Phase>(signature: Iterable<SyntaxChildSlot<P>>, asterisk: () => AsteriskToken<P> | null,
  arrow: () => EqualsGreaterThanToken<P>, body: () => BlockOrExpression<P> | null): Generator<SyntaxChildSlot<P>> {
  yield* signature;
  yield* children<P, ArrowFunction<P>>(["asteriskToken", "nullable", asterisk], ["equalsGreaterThanToken", "required", arrow], ["body", "nullable", body]);
}

export function metaPropertySlots<P extends Phase>(name: () => Identifier<P>) {
  return children<P, MetaProperty<P>>(["name", "required", name]);
}

export function templateSpanSlots<P extends Phase>(expression: () => Expression<P>, literal: () => TemplateMiddleOrTail<P>) {
  return children<P, TemplateSpan<P>>(["expression", "required", expression], ["literal", "required", literal]);
}

export function* taggedTemplateSlots<P extends Phase>(tag: () => Expression<P>, question: () => QuestionDotToken<P> | null,
  args: () => Iterable<SyntaxChildSlot<P>>, template: () => TemplateLiteral<P>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, TaggedTemplateExpression<P>>(["tag", "required", tag], ["questionDotToken", "nullable", question]);
  yield* args();
  yield* children<P, TaggedTemplateExpression<P>>(["template", "required", template]);
}

export function* propertyAssignmentSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>, name: () => PropertyName<P>,
  postfix: () => QuestionToken<P> | ExclamationToken<P> | null, type: () => TypeNode<P> | null,
  tail: Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* children<P, PropertyAssignment<P> | ShorthandPropertyAssignment<P>>(["name", "required", name],
    ["postfixToken", "nullable", postfix], ["type", "nullable", type]);
  yield* tail;
}

export function initializerSlots<P extends Phase>(initializer: () => Expression<P>) {
  return children<P, PropertyAssignment<P>>(["initializer", "required", initializer]);
}

export function shorthandSlots<P extends Phase>(equals: () => EqualsToken<P> | null, initializer: () => Expression<P> | null) {
  return children<P, ShorthandPropertyAssignment<P>>(["equalsToken", "nullable", equals], ["objectAssignmentInitializer", "nullable", initializer]);
}

export function assertionSlots<P extends Phase>(type: () => TypeNode<P>, expression: () => Expression<P>) {
  return children<P, TypeAssertion<P>>(["type", "required", type], ["expression", "required", expression]);
}

export function* expressionArgumentsSlots<P extends Phase>(expression: () => Expression<P>,
  args: () => Iterable<SyntaxChildSlot<P>>): Generator<SyntaxChildSlot<P>> {
  yield* children<P, ExpressionWithTypeArguments<P>>(["expression", "required", expression]);
  yield* args();
}

export function syntheticReferenceSlots<P extends Phase>(expression: () => Expression<P>, thisArg: () => Expression<P>) {
  return children<P, SyntheticReferenceExpression<P>>(["expression", "required", expression], ["thisArg", "required", thisArg]);
}

export function decoratorSlots<P extends Phase>(expression: () => LeftHandSideExpression<P>) {
  return children<P, Decorator<P>>(["expression", "required", expression]);
}

export function prepareExpressionStructure<P extends Phase, Stop>(node: ExpressionStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<ExpressionStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "QualifiedName": {
      const left = heldChild(() => node.left);
      const right = heldChild(() => node.right);
      return { kind: "copied", value: { kind: "qualified-name", ordinal, slots: qualifiedNameSlots<P>(left.pull, right.pull), left: left.read, right: right.read } };
    }
    case "YieldExpression": {
      const asterisk = heldChild(() => node.asteriskToken);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "yield", ordinal, slots: yieldSlots<P>(asterisk.pull, expression.pull), asterisk: asterisk.read, expression: expression.read } };
    }
    case "ArrowFunction": {
      const signature = prepareCallableStructure<P, Stop>(node, admitList);
      if (signature.kind === "refused") return signature;
      const asterisk = heldChild(() => node.asteriskToken);
      const arrow = heldChild(() => node.equalsGreaterThanToken);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "arrow", ordinal, ...signature.value,
        slots: arrowSlots<P>(signature.value.slots, asterisk.pull, arrow.pull, body.pull), asterisk: asterisk.read, arrow: arrow.read, body: body.read } };
    }
    case "MetaProperty": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "meta-property", ordinal, slots: metaPropertySlots<P>(name.pull), name: name.read } };
    }
    case "TemplateExpression": {
      const stop = admitList("templateSpans");
      if (stop !== null) return { kind: "refused", stop };
      const head = heldChild(() => node.head);
      const spans = heldList<P, TemplateSpan<P>>("templateSpans", () => node.templateSpans);
      return { kind: "copied", value: { kind: "template-expression", ordinal, slots: templateHeadSlots<P>(head.pull, spans.slots), head: head.read, spans: spans.finish } };
    }
    case "TemplateSpan": {
      const expression = heldChild(() => node.expression);
      const literal = heldChild(() => node.literal);
      return { kind: "copied", value: { kind: "template-span", ordinal, slots: templateSpanSlots<P>(expression.pull, literal.pull),
        expression: expression.read, literal: literal.read } };
    }
    case "TaggedTemplateExpression": case "ExpressionWithTypeArguments": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      if (node.kind === "TaggedTemplateExpression") {
        const tag = heldChild(() => node.tag);
        const question = heldChild(() => node.questionDotToken);
        const template = heldChild(() => node.template);
        return { kind: "copied", value: { kind: "tagged-template", ordinal, slots: taggedTemplateSlots<P>(tag.pull, question.pull, args.slots, template.pull),
          tag: tag.read, question: question.read, args: args.finish, template: template.read } };
      }
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "expression-type-arguments", ordinal,
        slots: expressionArgumentsSlots<P>(expression.pull, args.slots), expression: expression.read, args: args.finish } };
    }
    case "PropertyAssignment": case "ShorthandPropertyAssignment": {
      const rawModifiers = node.modifiers;
      const stop = rawModifiers === null ? null : admitList("modifiers");
      if (stop !== null) return { kind: "refused", stop };
      const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
      const name = heldChild(() => node.name);
      const postfix = heldChild(() => node.postfixToken);
      const type = heldChild(() => node.type);
      if (node.kind === "PropertyAssignment") {
        const initializer = heldChild(() => node.initializer);
        return { kind: "copied", value: { kind: "property-assignment", ordinal,
          slots: propertyAssignmentSlots<P>(modifiers.slots, name.pull, postfix.pull, type.pull, initializerSlots<P>(initializer.pull)),
          modifiers: modifiers.finish, name: name.read, postfix: postfix.read, type: type.read, initializer: initializer.read } };
      }
      const equals = heldChild(() => node.equalsToken);
      const initializer = heldChild(() => node.objectAssignmentInitializer);
      return { kind: "copied", value: { kind: "shorthand-assignment", ordinal,
        slots: propertyAssignmentSlots<P>(modifiers.slots, name.pull, postfix.pull, type.pull, shorthandSlots<P>(equals.pull, initializer.pull)),
        modifiers: modifiers.finish, name: name.read, postfix: postfix.read, type: type.read, equals: equals.read, initializer: initializer.read } };
    }
    case "TypeAssertionExpression": {
      const type = heldChild(() => node.type);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "type-assertion", ordinal, slots: assertionSlots<P>(type.pull, expression.pull),
        type: type.read, expression: expression.read } };
    }
    case "SyntheticReferenceExpression": {
      const expression = heldChild(() => node.expression);
      const thisArg = heldChild(() => node.thisArg);
      return { kind: "copied", value: { kind: "synthetic-reference", ordinal, slots: syntheticReferenceSlots<P>(expression.pull, thisArg.pull),
        expression: expression.read, thisArg: thisArg.read } };
    }
    case "Decorator": {
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "decorator", ordinal, slots: decoratorSlots<P>(expression.pull), expression: expression.read } };
    }
  }
}
