import { Date as SourceDate } from "./src/date-object.js";
import { parseInt as SourceParseInt } from "./src/Globals.js";

declare global {
  const Date: typeof SourceDate;
  const parseInt: typeof SourceParseInt;
}

export {};
