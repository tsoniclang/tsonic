# .NET Integration Examples

Using .NET libraries in Tsonic.

## File I/O

```typescript
import { File } from "System.IO";

export function main() {
  // Write
  File.WriteAllText("hello.txt", "Hello from Tsonic!");

  // Read
  const content = File.ReadAllText("hello.txt");
  console.log(content);

  // Append
  File.AppendAllText("hello.txt", "\nAnother line");

  // Read all lines
  const lines = File.ReadAllLines("hello.txt");
  for (const line of lines) {
    console.log(line);
  }
}
```

## JSON Serialization

```typescript
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

type User = {
  id: number;
  name: string;
  email: string;
};

export function main() {
  const user: User = {
    id: 1,
    name: "Alice",
    email: "alice@example.com",
  };

  // Serialize
  const json = JsonSerializer.Serialize(user);
  File.WriteAllText("user.json", json);

  // Deserialize
  const loaded = JsonSerializer.Deserialize<User>(
    File.ReadAllText("user.json")
  );
  console.log(loaded.name);
}
```

## HTTP Client

```typescript
import { HttpClient } from "System.Net.Http";

export async function main(): Promise<void> {
  const client = new HttpClient();

  const response = await client.GetAsync("https://api.github.com");
  const content = await response.Content.ReadAsStringAsync();

  console.log(content.substring(0, 100));
}
```

## Collections

```typescript
import { List, Dictionary, HashSet } from "System.Collections.Generic";

export function main() {
  // List
  const list = new List<string>();
  list.Add("apple");
  list.Add("banana");
  console.log(list.Count);

  // Dictionary
  const dict = new Dictionary<string, number>();
  dict.Add("one", 1);
  dict.Add("two", 2);
  console.log(dict["one"]);

  // HashSet
  const set = new HashSet<number>();
  set.Add(1);
  set.Add(2);
  set.Add(1); // Duplicate ignored
  console.log(set.Count); // 2
}
```

## DateTime

```typescript
import { DateTime } from "System";

export function main() {
  const now = DateTime.Now;
  console.log(now.ToString());
  console.log(now.Year);
  console.log(now.Month);
  console.log(now.Day);

  const tomorrow = now.AddDays(1);
  console.log(tomorrow.ToString());
}
```

## See Also

- [.NET Interop Guide](../language/dotnet-interop.md)
- [Type Mappings](../language/type-mappings.md)
