import { Date as SourceDate } from "./src/date-object.js";

declare global {
  interface Date extends SourceDate {}
  const Date: typeof SourceDate;
}

export {};
