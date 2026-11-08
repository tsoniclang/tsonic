export type TargetGraphComponentsSelection<TVertex> = {
    readonly kind: "resolved";
    readonly components: readonly (readonly TVertex[])[];
} | {
    readonly kind: "unresolved";
    readonly reason: string;
};
export declare function targetStronglyConnectedComponents<TVertex>(vertices: ReadonlySet<TVertex>, neighbours: (vertex: TVertex) => Iterable<TVertex>, maximumSteps?: number | (() => boolean)): TargetGraphComponentsSelection<TVertex>;
//# sourceMappingURL=graph-components.d.ts.map