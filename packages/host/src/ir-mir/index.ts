import type {
  ConstantKeyOfMir, IsMirCompletionControl, LocalOwnershipOfMir, ParseMir, PrepareMirExecutionGraph, PrintMir, ProjectMirConstantKey, ProjectMirConstantOrdinals, ProjectMirValues, TransferMirCompletion, VerifyMir, VisitMirControlEdges, VisitMirStorageExposures,
} from "./contract.js";
import { ownershipOfMode } from "./local-ownership.js";
import { parseBody } from "./parse.js";
import { printBody } from "./print.js";
import { constantKey, verifyBody } from "./verify.js";
import { projectMirConstantKey as constantKeyProjection, projectMirConstantOrdinals as constantOrdinalProjection } from "./constant-projection.js";
import { projectMirValues as valuesProjection } from "./project-values.js";
import { isCompletionControl, visitControlEdges } from "./verify-control.js";
import { prepareExecutionGraph, transferCompletion } from "./completion.js";
import { visitStorageExposures } from "./storage-exposures.js";

export const printMir: PrintMir = body => printBody(body);
export const parseMir: ParseMir = text => parseBody(text);
export const verifyMir: VerifyMir = (body, context) => verifyBody(body, context);
export const constantKeyOfMir: ConstantKeyOfMir = (type, value) => constantKey(type, value);
export const localOwnershipOfMir: LocalOwnershipOfMir = ownershipOfMode;
export const projectMirConstantKey: ProjectMirConstantKey = constantKeyProjection;
export const projectMirConstantOrdinals: ProjectMirConstantOrdinals = constantOrdinalProjection;
export const projectMirValues: ProjectMirValues = valuesProjection;
export const visitMirControlEdges: VisitMirControlEdges = visitControlEdges;
export const visitMirStorageExposures: VisitMirStorageExposures = visitStorageExposures;
export const isMirCompletionControl: IsMirCompletionControl = isCompletionControl;
export const transferMirCompletion: TransferMirCompletion = transferCompletion;
export const prepareMirExecutionGraph: PrepareMirExecutionGraph = prepareExecutionGraph;
