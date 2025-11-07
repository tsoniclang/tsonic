export interface User {
  type: "user";
  id: number;
  username: string;
  email: string;
}

export interface Admin {
  type: "admin";
  id: number;
  username: string;
  email: string;
  permissions: string[];
}

export interface Guest {
  type: "guest";
  sessionId: string;
}

export type Account = User | Admin | Guest;

export function isUser(account: Account): account is User {
  return account.type === "user";
}

export function isAdmin(account: Account): account is Admin {
  return account.type === "admin";
}

export function isGuest(account: Account): account is Guest {
  return account.type === "guest";
}

export function getAccountDescription(account: Account): string {
  if (isUser(account)) {
    return `User: ${account.username} (${account.email})`;
  } else if (isAdmin(account)) {
    return `Admin: ${account.username} with ${account.permissions.length} permissions`;
  } else if (isGuest(account)) {
    return `Guest session: ${account.sessionId}`;
  }
  return "Unknown account type";
}

export function hasEmail(account: Account): boolean {
  return isUser(account) || isAdmin(account);
}

export function getPermissions(account: Account): string[] {
  if (isAdmin(account)) {
    return account.permissions;
  }
  return [];
}

// Type guards with typeof
export function processValue(value: string | number | boolean): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  } else if (typeof value === "number") {
    return value.toFixed(2);
  } else {
    return value ? "yes" : "no";
  }
}

// Array type guard
export function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}
