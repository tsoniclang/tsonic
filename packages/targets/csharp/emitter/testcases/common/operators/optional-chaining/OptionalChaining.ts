export interface User {
  name?: string;
  address?: {
    street?: string;
    city?: string;
  };
}

export function getCity(user: User | null): string | undefined {
  return user?.address?.city;
}

export function getNameLength(user: User | null): number {
  return user?.name?.Length ?? 0;
}
