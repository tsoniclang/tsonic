import { Widget as SourceWidget } from "./src/Widget.js";
import { parse as SourceParse } from "./src/parse.js";

declare global {
  interface Widget extends SourceWidget {}
  const Widget: typeof SourceWidget;
  const parse: typeof SourceParse;
}

export {};
