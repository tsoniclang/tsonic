import { List } from "@fixture/dotnet/System.Collections.Generic.js";
import { DateTimeOffset } from "@fixture/dotnet/System.js";
import { StringBuilder } from "@fixture/dotnet/System.Text.js";

const list = new List<string>();
const builder = new StringBuilder();
const stamp = new DateTimeOffset();

export const listCount = list.Count;
export const builderText = builder.Append("x").ToString();
export const nextStamp = stamp.AddMilliseconds(1);
