export interface TargetGraphComponentRows {
    add(cost: number): boolean;
    release(): void;
}
export interface TargetGraphComponentResources {
    step(): boolean;
    createRows(): TargetGraphComponentRows;
}
export interface TargetGraphComponentInput<Vertex, Data> {
    readonly data: Data;
    readonly neighbours: ReadonlySet<Vertex>;
}
export interface TargetGraphComponentMember<Vertex, Data, Value> {
    readonly vertex: Vertex;
    readonly data: Data;
    readonly successors: readonly Value[];
}
export declare function createTargetGraphComponentQuery<Vertex, Data, Value>(load: (vertex: Vertex) => TargetGraphComponentInput<Vertex, Data> | undefined, reduce: (members: readonly TargetGraphComponentMember<Vertex, Data, Value>[]) => Value | undefined, resources: TargetGraphComponentResources): (vertex: Vertex) => Value | undefined;
//# sourceMappingURL=graph-component-query.d.ts.map