import type { ProfileDataUpdate } from "./profile-types.js";

export function run(key: string, rawValue: string): ProfileDataUpdate {
  const result: ProfileDataUpdate = {};
  result[key] = { value: rawValue };
  return result;
}
