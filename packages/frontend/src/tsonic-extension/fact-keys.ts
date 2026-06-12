import type {
  ExtensionFactKey,
  TstsNode,
} from "@tsonic/tsts";
import { defineExtensionFactKey } from "@tsonic/tsts";
import type {
  FieldSemanticsFact,
  IntrinsicSemanticsFact,
  NumericPrimitiveFact,
  ParameterPassingFact,
  SourceTypeSemanticsFact,
  AttributeSemanticsFact,
} from "../source-frontend/source-facts.js";

export const tsonicNumericPrimitiveFactKey: ExtensionFactKey<
  TstsNode,
  NumericPrimitiveFact
> = defineExtensionFactKey<TstsNode, NumericPrimitiveFact>(
  "tsonic.source.numeric-primitive",
  "Tsonic source primitive identity for imported numeric/primitive aliases.",
);

export const tsonicSourceTypeSemanticsFactKey: ExtensionFactKey<
  TstsNode,
  SourceTypeSemanticsFact
> = defineExtensionFactKey<TstsNode, SourceTypeSemanticsFact>(
  "tsonic.source.type-semantics",
  "Tsonic source type semantics such as struct intent.",
);

export const tsonicFieldSemanticsFactKey: ExtensionFactKey<
  TstsNode,
  FieldSemanticsFact
> = defineExtensionFactKey<TstsNode, FieldSemanticsFact>(
  "tsonic.source.field-semantics",
  "Tsonic source storage field semantics.",
);

export const tsonicParameterPassingFactKey: ExtensionFactKey<
  TstsNode,
  ParameterPassingFact
> = defineExtensionFactKey<TstsNode, ParameterPassingFact>(
  "tsonic.source.parameter-passing",
  "Tsonic source parameter passing mode.",
);

export const tsonicAttributeSemanticsFactKey: ExtensionFactKey<
  TstsNode,
  AttributeSemanticsFact
> = defineExtensionFactKey<TstsNode, AttributeSemanticsFact>(
  "tsonic.source.attribute-semantics",
  "Tsonic source attribute semantics before target rendering.",
);

export const tsonicIntrinsicSemanticsFactKey: ExtensionFactKey<
  TstsNode,
  IntrinsicSemanticsFact
> = defineExtensionFactKey<TstsNode, IntrinsicSemanticsFact>(
  "tsonic.source.intrinsic-semantics",
  "Tsonic source intrinsic semantics.",
);
