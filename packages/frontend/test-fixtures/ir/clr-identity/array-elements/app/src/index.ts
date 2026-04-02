import { getAttachments } from "../tsonic/bindings/Acme.Core.js";

const attachments = getAttachments();
export const attachmentCount = attachments.length;
