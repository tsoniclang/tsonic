import type {
  BoundProducer, BoundProducerRef, CallbackExchange, InitializationEvent, InitializationPoint, InitializationTable,
  LogicalCell, LogicalCellLifetime, LogicalCellOccurrence, LogicalCellRow, OpenBoundary, ProjectionPath,
  RelationalArena, RelationalOwner, StableReference, Summary, SummaryBacking, SummaryKey, SummaryPosition, SummaryRetention,
} from "../ir-facts/contract.js";
import type { ArtifactBindings, DeclarationRequest, DeclaredExecution, Execution } from "../ir-types/contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import type { PreparedSyntaxSlot } from "../ir-hir/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { PreparedReferenceProjection, ProjectionInventory } from "./program-values.js";
import {
  inventoryFields, inventoryRecord, inventorySignature, prepareArtifactBindings, prepareBindingsProjection, prepareInstance, prepareProjectionRows,
} from "./program-values.js";
import { chargeInstantiationWork, reserveInstantiationRecord } from "./work.js";
import { prepareSelection } from "./instantiate-phase.js";

type Ready<Value> = PreparedReferenceProjection<Value>;
type Plan<Value> = PreparedSyntaxSlot<Value, TypeReferenceRewrite>;

const incompleteCallback: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A prepared callback must retain its actual nonempty signature inventory." };

function held<Value>(value: Value): Ready<Value> {
  return { kind: "copied", value: () => value };
}

function after<Before, After>(result: Ready<Before>, build: (value: Plan<Before>) => Ready<After>): Ready<After> {
  return result.kind === "refused" ? result : build(result.value);
}

function record<Value>(scan: ProjectionInventory, fields: number, build: () => Ready<Value>): Ready<Value> {
  const stop = inventoryRecord(scan, fields);
  return stop === null ? build() : { kind: "refused", stop };
}

function borrowed<Value>(scan: ProjectionInventory, fields: number, value: Value): Ready<Value> {
  const stop = inventoryFields(scan, fields);
  return stop === null ? held(value) : { kind: "refused", stop };
}

export function prepareExecution(scan: ProjectionInventory, value: Execution, selected: ArtifactBindings | null): Ready<Execution> {
  return record(scan, 2, () => after(prepareInstance(scan, value.instance, selected), instance => {
    const provided = value.provided;
    return { kind: "copied", value: rewrite => ({ instance: instance(rewrite), provided }) };
  }));
}

function declaredExecution(scan: ProjectionInventory, value: DeclaredExecution, selected: ArtifactBindings | null): Ready<DeclaredExecution> {
  return record(scan, 2, () => record(scan, 4, () => {
    const request = value.request;
    return after(prepareArtifactBindings(scan, request.bindings), bindings => {
      const { definition, endpoint, ordinal } = request;
      const provided = value.provided;
      return { kind: "copied", value: rewrite => ({ request: { definition, endpoint, ordinal, bindings: selected ?? bindings(rewrite) }, provided }) };
    });
  }));
}

export function prepareSummaryKey(scan: ProjectionInventory, value: SummaryKey, selected: ArtifactBindings | null): Ready<SummaryKey> {
  return record<SummaryKey>(scan, 2, () => {
    switch (value.kind) {
      case "body": return after(prepareExecution(scan, value.execution, selected), execution => ({
        kind: "copied", value: rewrite => ({ kind: "body", execution: execution(rewrite) }),
      }));
      case "declared": return after(declaredExecution(scan, value.execution, selected), execution => ({
        kind: "copied", value: rewrite => ({ kind: "declared", execution: execution(rewrite) }),
      }));
    }
  });
}

export function prepareRelationalOwner(scan: ProjectionInventory, value: RelationalOwner): Ready<RelationalOwner> {
  return record<RelationalOwner>(scan, 2, () => {
    switch (value.kind) {
      case "body": return after(prepareExecution(scan, value.execution, null), ready => ({
        kind: "copied", value: rewrite => ({ kind: "body", execution: ready(rewrite) }),
      }));
      case "summary": return after(prepareSummaryKey(scan, value.key, null), key => ({
        kind: "copied", value: rewrite => ({ kind: "summary", key: key(rewrite) }),
      }));
    }
  });
}

type StaticCell = { readonly kind: "static"; readonly declaration: DeclarationRequest };

function staticCell(scan: ProjectionInventory, value: StaticCell): Ready<StaticCell> {
  return record(scan, 2, () => record(scan, 2, () => {
    const declaration = value.declaration;
    return after(prepareArtifactBindings(scan, declaration.bindings), bindings => {
      const definition = declaration.definition;
      return { kind: "copied", value: rewrite => ({ kind: "static", declaration: { definition, bindings: bindings(rewrite) } }) };
    });
  }));
}

function stableCell(scan: ProjectionInventory, value: StableReference): Ready<StableReference> {
  return value.kind === "static" ? staticCell(scan, value) : borrowed(scan, value.kind === "receiver" ? 1 : 2, value);
}

function cellRole(scan: ProjectionInventory, value: LogicalCell): Ready<LogicalCell> {
  if (value.kind === "detached") return borrowed(scan, 1, value);
  if (value.kind !== "created") return value.kind === "static" ? staticCell(scan, value) : borrowed(scan, 2, value);
  return record<LogicalCell>(scan, 3, () => {
    const original = value.anchor;
    const anchor: Ready<StableReference | { readonly kind: "result" }> = original.kind === "result" ? borrowed(scan, 1, original) : stableCell(scan, original);
    if (anchor.kind === "refused") return anchor;
    const slot = value.slot;
    switch (slot.kind) {
      case "field": return record(scan, 2, () => record(scan, 5, () => {
        const member = slot.member;
        return after(prepareBindingsProjection(scan, member.bindings), bindings => {
          const { key, origins, selectedDeclarations, primary } = member;
          return { kind: "copied", value: rewrite => ({
            kind: "created", anchor: anchor.value(rewrite),
            slot: { kind: "field", member: { key, origins, selectedDeclarations, primary, bindings: bindings(rewrite) } },
          }) };
        });
      }));
      case "capture": case "local": case "entity": {
        const stop = inventoryFields(scan, slot.kind === "capture" ? 3 : slot.kind === "local" ? 2 : 1);
        return stop === null ? { kind: "copied", value: rewrite => ({ kind: "created", anchor: anchor.value(rewrite), slot }) }
          : { kind: "refused", stop };
      }
    }
  });
}

function occurrence(scan: ProjectionInventory, value: LogicalCellOccurrence): Ready<LogicalCellOccurrence> {
  if (value.kind === "declared") return borrowed(scan, 2, value);
  return record(scan, 3, () => after(prepareExecution(scan, value.execution, null), (execution): Ready<LogicalCellOccurrence> => {
    if (value.kind === "entry") {
      const local = value.local;
      return { kind: "copied", value: rewrite => ({ kind: "entry", execution: execution(rewrite), local }) };
    }
    const point = value.point;
    return { kind: "copied", value: rewrite => ({ kind: "statement", execution: execution(rewrite), point }) };
  }));
}

function cellRow(scan: ProjectionInventory, read: () => LogicalCellRow): Ready<LogicalCellRow> {
  return record(scan, 4, () => {
    const cell = read();
    return after(cellRole(scan, cell.role), role => {
      const lifetimes = prepareProjectionRows<LogicalCellLifetime, LogicalCellLifetime>(scan, cell.lifetimes, read =>
        record(scan, 4, () => {
          const marker = read();
          return after(prepareExecution(scan, marker.execution, null), execution => {
            const { kind, point, local } = marker;
            return { kind: "copied", value: rewrite => ({ kind, point, local, execution: execution(rewrite) }) };
          });
        }));
      return after(occurrence(scan, cell.occurrence), occurrence => {
        const id = cell.id;
        return { kind: "copied", value: rewrite => ({ id, role: role(rewrite), occurrence: occurrence(rewrite), lifetimes: lifetimes(rewrite) }) };
      });
    });
  });
}

function projectionRow(scan: ProjectionInventory, read: () => ProjectionPath): Ready<ProjectionPath> {
  const slot = chargeInstantiationWork(scan.meter);
  if (slot !== null) return { kind: "refused", stop: slot };
  const row = read();
  const projection = row.projection;
  switch (projection.kind) {
    case "field": case "method-value": {
      const stop = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3) ?? inventoryRecord(scan, 2);
      if (stop !== null) return { kind: "refused", stop };
      return after(prepareSelection(scan, projection.member), member => {
        const { id, parent } = row;
        const kind = projection.kind;
        return { kind: "copied", value: rewrite => ({ id, parent, projection: { kind, member: member(rewrite) } }) };
      });
    }
    case "element": case "index": case "deref": return borrowed(scan, 1, row);
  }
}

function producer(scan: ProjectionInventory, read: () => BoundProducer): Ready<BoundProducer> {
  return record(scan, 4, () => {
    const row = read();
    return after(prepareBindingsProjection(scan, row.bindings), bindings => {
      const { id, producer, context } = row;
      return { kind: "copied", value: rewrite => ({ id, producer, context, bindings: bindings(rewrite) }) };
    });
  });
}

function boundary(scan: ProjectionInventory, read: () => OpenBoundary): Ready<OpenBoundary> {
  return record(scan, 8, () => {
    const row = read();
    return after(prepareBindingsProjection(scan, row.bindings), bindings => {
      const { id, kind, at, subject, owner, context, detail } = row;
      return { kind: "copied", value: rewrite => ({ id, kind, at, subject, owner, context, detail, bindings: bindings(rewrite) }) };
    });
  });
}

export function prepareRelationalArena(scan: ProjectionInventory, value: RelationalArena): Ready<RelationalArena> {
  return record(scan, 7, () => {
    const cells = prepareProjectionRows(scan, value.cells, read => cellRow(scan, read));
    const projections = prepareProjectionRows(scan, value.projections, read => projectionRow(scan, read));
    const boundProducers = prepareProjectionRows(scan, value.boundProducers, read => producer(scan, read));
    const boundaries = prepareProjectionRows(scan, value.boundaries, read => boundary(scan, read));
    const { producers, contexts, origins } = value;
    return { kind: "copied", value: rewrite => ({
      cells: cells(rewrite), projections: projections(rewrite),
      boundProducers: boundProducers(rewrite), boundaries: boundaries(rewrite), producers, contexts, origins,
    }) };
  });
}

function summaryPosition(scan: ProjectionInventory, value: SummaryPosition): Ready<SummaryPosition> {
  switch (value.kind) {
    case "body": return record(scan, 4, () => after(prepareExecution(scan, value.execution, null), execution => {
      const { point, edge } = value;
      return { kind: "copied", value: rewrite => ({ kind: "body", execution: execution(rewrite), point, edge }) };
    }));
    case "declared": return record(scan, 3, () => after(declaredExecution(scan, value.execution, null), execution => {
      const source = value.source;
      return { kind: "copied", value: rewrite => ({ kind: "declared", execution: execution(rewrite), source }) };
    }));
  }
}

export function prepareProducerRef(scan: ProjectionInventory, read: () => BoundProducerRef): Ready<BoundProducerRef> {
  return record(scan, 2, () => {
    const row = read();
    return after(prepareRelationalOwner(scan, row.owner), owner => {
      const producer = row.producer;
      return { kind: "copied", value: rewrite => ({ owner: owner(rewrite), producer }) };
    });
  });
}

function eventRow(scan: ProjectionInventory, read: () => InitializationEvent): Ready<InitializationEvent> {
  return record(scan, 3, () => {
    const event = read();
    return after(prepareProducerRef(scan, () => event.subject), subject => {
      const { kind, exit } = event;
      return { kind: "copied", value: rewrite => ({ kind, exit, subject: subject(rewrite) }) };
    });
  });
}

function pointRow(scan: ProjectionInventory, read: () => InitializationPoint): Ready<InitializationPoint> {
  const paid = chargeInstantiationWork(scan.meter);
  if (paid !== null) return { kind: "refused", stop: paid };
  const point = read();
  switch (point.kind) {
    case "return": case "unwind": return held(point);
    case "before": {
      const header = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
      if (header !== null) return { kind: "refused", stop: header };
      return after(summaryPosition(scan, point.at), at => after(prepareProducerRef(scan, () => point.subject), subject => ({
        kind: "copied", value: rewrite => ({ kind: "before", at: at(rewrite), subject: subject(rewrite) }),
      })));
    }
    case "completed": {
      const header = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 3);
      if (header !== null) return { kind: "refused", stop: header };
      return after(prepareProducerRef(scan, () => point.handle), handle => {
        const exit = point.exit;
        return { kind: "copied", value: rewrite => ({ kind: "completed", handle: handle(rewrite), exit }) };
      });
    }
    case "need": {
      const header = reserveInstantiationRecord(scan.meter) ?? inventoryFields(scan, 4);
      if (header !== null) return { kind: "refused", stop: header };
      return after(summaryPosition(scan, point.at), at => record(scan, 2, () => {
        const { cell, witness } = point;
        const reference = witness.read;
        const via = prepareProjectionRows(scan, witness.via, read => record(scan, 2, () => {
          const use = read();
          return after(prepareSummaryKey(scan, use.key, null), key => {
            const row = use.row;
            return { kind: "copied", value: rewrite => ({ key: key(rewrite), row }) };
          });
        }));
        return { kind: "copied", value: rewrite => ({ kind: "need", at: at(rewrite), cell, witness: { read: reference, via: via(rewrite) } }) };
      }));
    }
  }
}

function initialization(scan: ProjectionInventory, value: InitializationTable): Ready<InitializationTable> {
  return record(scan, 5, () => {
    const events = prepareProjectionRows(scan, value.events, read => eventRow(scan, read));
    const points = prepareProjectionRows(scan, value.points, read => pointRow(scan, read));
    const { cells, conditions, rows } = value;
    return { kind: "copied", value: rewrite => ({ cells, conditions, rows, events: events(rewrite), points: points(rewrite) }) };
  });
}

function retentionRow(scan: ProjectionInventory, read: () => SummaryRetention): Ready<SummaryRetention> {
  return record(scan, 3, () => {
    const row = read();
    return after(summaryPosition(scan, row.at), at => {
      const { source, into } = row;
      return { kind: "copied", value: rewrite => ({ source, into, at: at(rewrite) }) };
    });
  });
}

function callbackRow(scan: ProjectionInventory, read: () => CallbackExchange): Ready<CallbackExchange> {
  return record<CallbackExchange>(scan, 0, () => {
    const callback = read();
    const header = inventoryFields(scan, callback.kind === "unknown" ? 6 : 11);
    if (header !== null) return { kind: "refused", stop: header };
    return after(prepareProducerRef(scan, () => callback.subject), subject => {
      if (callback.kind === "unknown") {
        const signatures = prepareProjectionRows(scan, callback.signatures, read => {
          const stop = chargeInstantiationWork(scan.meter);
          if (stop !== null) return { kind: "refused", stop };
          const signature = read();
          scan.signatures.add(signature);
          return { kind: "copied", value: rewrite => rewrite.signature(signature) };
        });
        return record<CallbackExchange>(scan, 2, () => {
          const boundary = callback.boundary;
          return after(prepareRelationalOwner(scan, boundary.owner), owner => {
            const boundaryId = boundary.boundary;
            const { constraint, invocationOnly } = callback;
            return { kind: "copied", value: rewrite => {
              const [first, ...rest] = signatures(rewrite);
              const signature = requirePresent(first, incompleteCallback);
              return {
                kind: "unknown", subject: subject(rewrite), constraint, invocationOnly,
                boundary: { owner: owner(rewrite), boundary: boundaryId }, signatures: [signature, ...rest],
              };
            } };
          });
        });
      }
      return after(summaryPosition(scan, callback.at), at => {
        const signature = callback.signature;
        const stop = inventorySignature(scan, signature);
        if (stop !== null) return { kind: "refused", stop };
        const reference = callback.handle;
        const handle = reference === null ? held(null) : prepareProducerRef(scan, () => reference);
        if (handle.kind === "refused") return handle;
        const { provided, context, result, thrown, timing, shared } = callback;
        return { kind: "copied", value: rewrite => ({
          kind: "known", provided, context, result, thrown, timing, shared, at: at(rewrite),
          subject: subject(rewrite), handle: handle.value(rewrite), signature: rewrite.signature(signature),
        }) };
      });
    });
  });
}

function backingRow(scan: ProjectionInventory, read: () => SummaryBacking): Ready<SummaryBacking> {
  return record(scan, 5, () => {
    const row = read();
    return after(summaryPosition(scan, row.at), (at): Ready<SummaryBacking> => {
      const { operation, pointer, cell } = row;
      const use = row.use;
      if (use.kind === "return") {
        const stop = inventoryFields(scan, 1);
        return stop === null ? { kind: "copied", value: rewrite => ({ at: at(rewrite), operation, pointer, cell, use }) }
          : { kind: "refused", stop };
      }
      return record(scan, 4, () => after(prepareSummaryKey(scan, use.callee, null), callee => {
        const { slot, passing } = use;
        return { kind: "copied", value: rewrite => ({
          at: at(rewrite), operation, pointer, cell, use: { kind: "argument", slot, passing, callee: callee(rewrite) },
        }) };
      }));
    });
  });
}

export function prepareSummary(scan: ProjectionInventory, source: Summary, selected: ArtifactBindings | null):
  Ready<Summary & { readonly retention: SummaryRetention[] }> {
  return record(scan, 20, () => {
    const retention = prepareProjectionRows(scan, source.retention, read => retentionRow(scan, read));
    const callbacks = prepareProjectionRows(scan, source.callbacks, read => callbackRow(scan, read));
    const backing = prepareProjectionRows(scan, source.backing, read => backingRow(scan, read));
    return after(prepareSummaryKey(scan, source.key, selected), key => {
      const signature = source.signature;
      const signatureStop = inventorySignature(scan, signature);
      if (signatureStop !== null) return { kind: "refused", stop: signatureStop };
      return after(prepareRelationalArena(scan, source.arena), arena => after(initialization(scan, source.initialization), initialization => {
        const { parameters, captures, result, thrown, writes, suspends, bindingDependent, resultCells,
          concurrentWrites, contentsOnReturn, contentsOnUnwind, returns, unwinds } = source;
        return { kind: "copied", value: rewrite => ({
          parameters, captures, result, thrown, writes, suspends, bindingDependent, resultCells,
          concurrentWrites, contentsOnReturn, contentsOnUnwind, returns, unwinds,
          key: key(rewrite), signature: rewrite.signature(signature), arena: arena(rewrite), initialization: initialization(rewrite),
          retention: retention(rewrite), callbacks: callbacks(rewrite), backing: backing(rewrite),
        }) };
      }));
    });
  });
}
