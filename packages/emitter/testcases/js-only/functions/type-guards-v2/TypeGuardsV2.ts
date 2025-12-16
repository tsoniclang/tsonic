export interface User {
  kind: "user";
  username: string;
  email: string;
}

export interface Admin {
  kind: "admin";
  adminId: number;
  permissions: string[];
}

export type Account = User | Admin;

// Type guard functions
export function isUser(account: Account): account is User {
  return account.kind === "user";
}

export function isAdmin(account: Account): account is Admin {
  return account.kind === "admin";
}

// Case 1: Negated guard - narrow the else branch
export function handleNotUser(account: Account): string {
  if (!isUser(account)) {
    // account is Admin here
    return `Admin ${account.adminId}`;
  } else {
    // account is User here (narrowed)
    return `User ${account.username}`;
  }
}

// Case 2: && guard - compound condition with narrowing
export function getUserWithValidEmail(account: Account): string {
  if (isUser(account) && account.email.length > 0) {
    return account.email;
  }
  return "no email";
}

// Case 3: && guard with method call
export function getUsernameUppercase(account: Account): string {
  if (isUser(account) && account.username !== "") {
    return account.username.toUpperCase();
  }
  return "anonymous";
}
