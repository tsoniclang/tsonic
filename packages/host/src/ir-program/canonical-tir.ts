import { chargeWork } from "../dataflow/index.js";
import { throwInvariant } from "../diag/index.js";
import { admitArtifactIdentity } from "../ir-facts/index.js";
import type { MirBody, MirConstantKeyWork, MirCopyOps, MirCopyRefusal, MirKeyedConstant } from "../ir-mir/contract.js";
import { projectMirConstantKey, projectMirConstantOrdinals, projectMirValues } from "../ir-mir/index.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { ArtifactBindings, BodyInstance } from "../ir-types/contract.js";
import type { InstantiationStop } from "./work.js";
import type { ProjectionInventory, ProjectionResult } from "./program-values.js";
import {
  copiedProjection, finishProjection, followingProjection, orderProjection, prepareArtifactBindings, prepareInstance, prepareMirBindingsProjection,
  projectRead, projectRecord, projectRows,
} from "./program-values.js";
import { prepareCallee, prepareSelection, prepareTypedOperation } from "./instantiate-phase.js";

export function projectMirBody(scan: ProjectionInventory, body: MirBody, rewrite: TypeReferenceRewrite, at: string):
  ProjectionResult<MirBody> {
  const instance = (value: BodyInstance): ProjectionResult<BodyInstance> =>
    finishProjection(scan, prepareInstance(scan, value, null), rewrite);
  const bindings = (value: ArtifactBindings): ProjectionResult<ArtifactBindings> =>
    finishProjection(scan, prepareArtifactBindings(scan, value), rewrite);
  const ops: MirCopyOps<InstantiationStop, MirCopyRefusal<InstantiationStop>> = {
    read: build => projectRead(scan, build),
    record: (fields, build) => projectRecord(scan, fields, build),
    rows: (source, row) => projectRows(scan, source, row),
    orderedRows: (source, row, compare) => followingProjection(projectRows(scan, source, row),
      rows => orderProjection(scan, rows, compare)),
    work: count => {
      const stop = scan.meter.failure ?? chargeWork(scan.meter.account, count);
      return stop === null ? null : { kind: "refused", stop };
    },
    type: rewrite.type,
    member: value => finishProjection(scan, prepareSelection(scan, value), rewrite),
    instance,
    operation: (value, path) => finishProjection(scan, prepareTypedOperation(scan, value, path), rewrite),
    callee: value => finishProjection(scan, prepareCallee(scan, value), rewrite),
  };

  const keyWork: MirConstantKeyWork<InstantiationStop, MirCopyRefusal<InstantiationStop>> = {
    work: ops.work,
    record: ops.record,
    bindings: value => finishProjection(scan, prepareMirBindingsProjection(scan, value), rewrite),
    artifact: value => {
      const stop = scan.meter.failure ?? admitArtifactIdentity(value, scan.meter.account);
      return stop === null ? null : { kind: "refused", stop };
    },
  };

  return projectRecord(scan, 8, () => {
    const environment = bindings(body.bindings);
    if (environment.kind === "refused") return environment;
    const locals = projectRows(scan, body.locals, read => projectRecord(scan, 6, () => {
      const { id, storage, role, mode, source, origin } = read();
      return copiedProjection({ id, storage: rewrite.type(storage), role, mode, source, origin });
    }));
    if (locals.kind === "refused") return locals;
    const constants = projectMirConstantOrdinals(compare => ops.orderedRows(body.constants, read => projectRecord<MirKeyedConstant>(scan, 4, () => {
      const current = read();
      return followingProjection(projectMirConstantKey(() => rewrite.type(current.type), () => current.value, keyWork),
        ({ type, value, key }) => key === null
          ? throwInvariant({ owner: "ir-program", query: null, origin: null, message: "A projected MIR constant has incomplete bindings." })
          : copiedProjection({ id: current.id, type, value, key }));
    }), compare), ops, () => ({ owner: "ir-mir", query: null, origin: null, message: "A constant use has no admitted ordinal image." }));
    if (constants.kind === "refused") return constants;
    const ownership = projectRecord(scan, 3, () => copiedProjection(projectMirValues(ops, constants.value.constantOf)));
    if (ownership.kind === "refused") return ownership;
    const projection = ownership.value;
    const places = projectRows(scan, body.places, read => projectRecord(scan, 4, () => {
      const place = read();
      return followingProjection(projection.placeBase(() => place.base), base => copiedProjection({
        id: place.id, base, storage: rewrite.type(place.storage), origin: place.origin,
      }));
    }));
    if (places.kind === "refused") return places;
    const blocks = projectRows(scan, body.blocks, (read, position) => projectRecord(scan, 5, () => {
      const block = read();
      const path = at + ".blocks[" + position + "]";
      return followingProjection(projectRows(scan, block.statements, (read, index) =>
        projection.statement(read, path + ".statements[" + index + "]")), statements =>
        followingProjection(projection.terminator(() => block.terminator, path + ".terminator"), terminator =>
          copiedProjection({ id: block.id, origin: block.origin, tir: block.tir, statements, terminator })));
    }));
    if (blocks.kind === "refused") return blocks;
    return copiedProjection({ body: body.body, bindings: environment.value, entries: body.entries, locals: locals.value,
      constants: constants.value.constants, places: places.value, blocks: blocks.value, result: rewrite.type(body.result) });
  });
}
