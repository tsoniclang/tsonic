import { getAuth } from "./Auth.js";

export const check = (fail: boolean): string => {
  const auth = getAuth(fail);
  if ("error" in auth) {
    return auth.error;
  }
  return "ok";
};
