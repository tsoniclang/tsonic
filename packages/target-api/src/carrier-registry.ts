export interface TargetCarrierDeclaration {
  readonly module: string;
  readonly symbol: string;
}

export interface TargetCarrierRegistryEntry<Kind extends string> {
  readonly id: string;
  readonly kinds: readonly Kind[];
  readonly declaration: TargetCarrierDeclaration;
  readonly counterpart: TargetCarrierDeclaration | null;
  readonly divergence?: {
    readonly register: string;
    readonly reason: string;
  };
  readonly frozen: boolean;
}
