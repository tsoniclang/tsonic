export const regexpAbsenceSource = `
import { jsstr } from "@tsonic/js/lang.js";
export function run(): boolean {
  const native = /(a)?(b)/d.exec("b");
  const exact = /(a)?(b)/d.exec(jsstr("b"));
  const matched = "b".match(/(a)?(b)/d);
  const split = "b".split(/(a)?b/);
  return native?.[1] === undefined && native?.[1] === null && native?.[2] === "b" &&
    native?.[2]?.length === 1 && native?.indices?.[1] === undefined &&
    native?.indices?.[2]?.[0] === 0 && native?.indices?.[2]?.[1] === 1 &&
    exact?.[1] === undefined && exact?.[1] === null && exact?.[2]?.length === 1 &&
    exact?.indices?.[1] === undefined && exact?.indices?.[2]?.[1] === 1 &&
    matched?.[1] === undefined && matched?.[2] === "b" &&
    split[0] === "" && split[1] === undefined && split[1] === null;
}
`;
