export const closedUnionEqualitySource = `
import type { int32, int64 } from "@tsonic/core/types.js";
class Token { value: int32 = 3; }
type TextOrToken = string | Token;
type Intermediate = TextOrToken;
type Choice = Intermediate | boolean;
type RangeResult = Token | number;
let effects: int32 = 0;
function observed(value: Choice): Choice { effects++; return value; }
function equal(left: Choice, right: Choice): boolean { return left === right; }
function unequal(left: Choice, right: Choice): boolean { return left !== right; }
function path(value: TextOrToken): boolean { return value === "/" && "/" === value; }
function accepted(value: Choice): boolean {
  const forward = value !== false;
  const reverse = false !== value;
  return forward && reverse;
}
function failed(value: RangeResult): boolean { return value === -1 || -1 === value; }
function wide(value: Token | int64, expected: int64): boolean { return value === expected && expected === value; }
function floating(left: RangeResult, right: RangeResult): boolean { return left === right; }
function arrays(left: string[] | boolean, right: string[] | boolean): boolean { return left === right; }
function evaluation(): boolean {
  let current: Choice = "a";
  const replace = (): Choice => { current = "b"; return "a"; };
  const compared = current === replace();
  return compared && equal(current, "b");
}
export function run(): boolean {
  const token = new Token();
  const other = new Token();
  const exact: int64 = 9007199254740993n;
  const values = ["a"];
  const same = observed(token) === observed(token);
  return same && effects === 2 && equal(token, token) && unequal(token, other) &&
    equal("a", "a") && unequal("a", "b") && equal(false, false) && unequal(false, true) &&
    unequal(token, false) && unequal("a", token) && path("/") && !path(token) &&
    accepted(token) && accepted("a") && !accepted(false) && failed(-1) && !failed(token) &&
    wide(exact, exact) && !wide(token, exact) && !wide(exact, 9007199254740992n) &&
    !floating(Number.NaN, Number.NaN) && floating(0, -0) &&
    arrays(values, values) && !arrays(values, ["a"]) && !arrays(values, true) && evaluation();
}
`;
