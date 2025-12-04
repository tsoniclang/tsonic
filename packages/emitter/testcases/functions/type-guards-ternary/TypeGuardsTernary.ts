export interface User {
  kind: "user";
  username: string;
  email: string;
}

export interface Admin {
  kind: "admin";
  adminId: number;
}

export type Account = User | Admin;

// Type guard function
export function isUser(account: Account): account is User {
  return account.kind === "user";
}

// Case 1: Positive guard - narrow whenTrue branch
export function nameOrAnon(a: Account): string {
  return isUser(a) ? a.username : "anon";
}

// Case 2: Negated guard - narrow whenFalse branch
export function adminOrUser(a: Account): string {
  return !isUser(a) ? "Admin" : a.username;
}

// Case 3: Nested member access in narrowed branch
export function getEmailOrDefault(a: Account): string {
  return isUser(a) ? a.email : "no-email";
}

// Case 4: Method call in narrowed branch
export function getUsernameUpper(a: Account): string {
  return isUser(a) ? a.username.toUpperCase() : "ANON";
}
