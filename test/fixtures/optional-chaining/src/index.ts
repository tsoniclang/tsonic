import { Console } from "@tsonic/dotnet/System";

interface Address {
  street?: string;
  city?: string;
}

interface User {
  name?: string;
  address?: Address;
}

function getCity(user: User | null): string | undefined {
  return user?.address?.city;
}

function getNameLength(user: User | null): number {
  return user?.name?.length ?? 0;
}

const user1: User = {
  name: "Alice",
  address: { city: "NYC", street: "123 Main" },
};
const user2: User = { name: "Bob" };
const user3: User | null = null;

Console.writeLine(`User1 city: ${getCity(user1)}`);
Console.writeLine(`User2 city: ${getCity(user2)}`);
Console.writeLine(`User3 city: ${getCity(user3)}`);
Console.writeLine(`User1 name length: ${getNameLength(user1)}`);
Console.writeLine(`User3 name length: ${getNameLength(user3)}`);
