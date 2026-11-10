export function nativeUnionProjectionMutations(fact, differentCarrier) {
  const indexes = fact.selectedVariantIndexes;
  const first = indexes[0];
  return [
    { unionCarrier: differentCarrier },
    { variants: undefined },
    { variants: [] },
    { variants: new Array(fact.variants.length) },
    { variants: fact.variants.map((variant, index) => index === first ? undefined : variant) },
    { variants: fact.variants.map((variant, index) => index === first ? { ...variant, carrier: undefined } : variant) },
    { variants: fact.variants.map((variant, index) => index === first ? { ...variant, carrier: differentCarrier } : variant) },
    { selectedVariantIndexes: undefined },
    { selectedVariantIndexes: [] },
    { selectedVariantIndexes: new Array(indexes.length) },
    { selectedVariantIndexes: [...indexes, first] },
    { selectedVariantIndexes: indexes.slice(1) },
    { selectedVariantIndexes: [-1] },
    { selectedVariantIndexes: [fact.variants.length] },
    { selectedVariantIndexes: [0.5] },
    { selectedVariantIndexes: ["0"] },
    { selectedVariantIndexes: [Number.NaN] },
    { selectedVariantIndexes: [Number.POSITIVE_INFINITY] },
  ];
}
