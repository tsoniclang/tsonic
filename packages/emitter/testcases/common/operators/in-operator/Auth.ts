export interface AuthOk {
  ok: true;
}

export interface AuthError {
  error: string;
}

export type AuthResult = AuthOk | AuthError;

export const getAuth = (fail: boolean): AuthResult => {
  const ok: AuthOk = { ok: true };
  const err: AuthError = { error: "no" };
  return fail ? err : ok;
};

