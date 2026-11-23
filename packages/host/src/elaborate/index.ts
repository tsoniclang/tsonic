import type { AttachFormalDefault, Elaborate, ElaborateSelectedCall } from "./contract.js";
import { elaborateBody, elaborateSelectedCall as selectedCall } from "./elaborate.js";
import { attachFormalDefault as attachDefault } from "./module.js";

export const elaborate: Elaborate = elaborateBody;
export const elaborateSelectedCall: ElaborateSelectedCall = selectedCall;
export const attachFormalDefault: AttachFormalDefault = attachDefault;
