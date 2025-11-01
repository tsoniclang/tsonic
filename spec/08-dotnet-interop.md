# .NET Interop

## Overview

Tsonic allows direct importing of .NET namespaces and types, enabling seamless use of the entire .NET ecosystem.

## Import Syntax

### Basic Imports

```typescript
// Import specific types
import { File, Directory } from "System.IO";
import { JsonSerializer } from "System.Text.Json";
import { HttpClient } from "System.Net.Http";

// Use them directly
File.WriteAllText("data.txt", "content");
const json = JsonSerializer.Serialize(data);
```

### Generated C#

```csharp
using System.IO;
using System.Text.Json;
using System.Net.Http;

File.WriteAllText("data.txt", "content");
var json = JsonSerializer.Serialize(data);
```

## TypeScript Declarations for .NET

To enable TypeScript type checking, we provide declaration files:

### lib.cs.d.ts (Minimal BCL)

```typescript
// System namespace
declare namespace System {
    class Console {
        static WriteLine(value?: any): void;
        static Write(value?: any): void;
        static ReadLine(): string;
        static Clear(): void;
    }

    class DateTime {
        constructor();
        constructor(ticks: number);
        constructor(year: number, month: number, day: number);

        Year: number;
        Month: number;
        Day: number;
        Hour: number;
        Minute: number;
        Second: number;

        static Now: DateTime;
        static UtcNow: DateTime;
        static Today: DateTime;

        AddDays(days: number): DateTime;
        AddHours(hours: number): DateTime;
        ToString(): string;
        ToString(format: string): string;
    }

    class Exception {
        constructor(message?: string);
        Message: string;
        StackTrace: string;
        InnerException: Exception | null;
    }

    class Guid {
        constructor();
        static NewGuid(): Guid;
        ToString(): string;
    }

    interface IDisposable {
        Dispose(): void;
    }
}

// System.IO namespace
declare namespace System.IO {
    class File {
        static Exists(path: string): boolean;
        static ReadAllText(path: string): string;
        static WriteAllText(path: string, contents: string): void;
        static ReadAllLines(path: string): string[];
        static WriteAllLines(path: string, contents: string[]): void;
        static Copy(source: string, dest: string, overwrite?: boolean): void;
        static Move(source: string, dest: string): void;
        static Delete(path: string): void;
    }

    class Directory {
        static Exists(path: string): boolean;
        static CreateDirectory(path: string): DirectoryInfo;
        static GetFiles(path: string, searchPattern?: string): string[];
        static GetDirectories(path: string, searchPattern?: string): string[];
        static Delete(path: string, recursive?: boolean): void;
        static Move(source: string, dest: string): void;
    }

    class Path {
        static Combine(...paths: string[]): string;
        static GetFileName(path: string): string;
        static GetDirectoryName(path: string): string;
        static GetExtension(path: string): string;
        static GetFullPath(path: string): string;
        static DirectorySeparatorChar: string;
    }

    class DirectoryInfo {
        Name: string;
        FullName: string;
        Exists: boolean;
        Parent: DirectoryInfo | null;
    }
}

// System.Text.Json namespace
declare namespace System.Text.Json {
    class JsonSerializer {
        static Serialize<T>(value: T, options?: JsonSerializerOptions): string;
        static Deserialize<T>(json: string, options?: JsonSerializerOptions): T;
    }

    class JsonSerializerOptions {
        PropertyNameCaseInsensitive: boolean;
        WriteIndented: boolean;
        DefaultIgnoreCondition: JsonIgnoreCondition;
    }

    enum JsonIgnoreCondition {
        Never = 0,
        Always = 1,
        WhenWritingNull = 2,
        WhenWritingDefault = 3
    }
}

// System.Collections.Generic namespace
declare namespace System.Collections.Generic {
    class List<T> {
        constructor();
        constructor(capacity: number);

        Count: number;

        Add(item: T): void;
        AddRange(items: T[]): void;
        Clear(): void;
        Contains(item: T): boolean;
        Remove(item: T): boolean;
        RemoveAt(index: number): void;
        IndexOf(item: T): number;
        Insert(index: number, item: T): void;
        ToArray(): T[];
    }

    class Dictionary<TKey, TValue> {
        constructor();

        Count: number;
        Keys: TKey[];
        Values: TValue[];

        Add(key: TKey, value: TValue): void;
        ContainsKey(key: TKey): boolean;
        Remove(key: TKey): boolean;
        Clear(): void;
        TryGetValue(key: TKey, out: { value: TValue }): boolean;
    }

    class HashSet<T> {
        constructor();

        Count: number;

        Add(item: T): boolean;
        Contains(item: T): boolean;
        Remove(item: T): boolean;
        Clear(): void;
        UnionWith(other: T[]): void;
        IntersectWith(other: T[]): void;
    }
}

// System.Threading.Tasks namespace
declare namespace System.Threading.Tasks {
    class Task {
        Wait(): void;
        static Delay(milliseconds: number): Task;
        static Run(action: () => void): Task;
        static WhenAll(...tasks: Task[]): Task;
        static WhenAny(...tasks: Task[]): Task;
    }

    class Task<T> {
        Result: T;
        Wait(): void;
        static FromResult<T>(value: T): Task<T>;
    }
}

// System.Net.Http namespace
declare namespace System.Net.Http {
    class HttpClient implements System.IDisposable {
        constructor();

        BaseAddress: string;
        Timeout: number;

        GetAsync(requestUri: string): Promise<HttpResponseMessage>;
        GetStringAsync(requestUri: string): Promise<string>;
        PostAsync(requestUri: string, content: HttpContent): Promise<HttpResponseMessage>;
        PutAsync(requestUri: string, content: HttpContent): Promise<HttpResponseMessage>;
        DeleteAsync(requestUri: string): Promise<HttpResponseMessage>;
        SendAsync(request: HttpRequestMessage): Promise<HttpResponseMessage>;

        Dispose(): void;
    }

    class HttpResponseMessage {
        StatusCode: HttpStatusCode;
        IsSuccessStatusCode: boolean;
        Content: HttpContent;
        Headers: Map<string, string[]>;
    }

    class HttpContent {
        ReadAsStringAsync(): Promise<string>;
    }

    class StringContent extends HttpContent {
        constructor(content: string, encoding?: string, mediaType?: string);
    }

    enum HttpStatusCode {
        OK = 200,
        Created = 201,
        NoContent = 204,
        BadRequest = 400,
        Unauthorized = 401,
        Forbidden = 403,
        NotFound = 404,
        InternalServerError = 500
    }
}

// System.Linq namespace
declare namespace System.Linq {
    interface Enumerable {
        Where<T>(source: T[], predicate: (x: T) => boolean): T[];
        Select<T, U>(source: T[], selector: (x: T) => U): U[];
        FirstOrDefault<T>(source: T[], predicate?: (x: T) => boolean): T | null;
        Any<T>(source: T[], predicate?: (x: T) => boolean): boolean;
        All<T>(source: T[], predicate: (x: T) => boolean): boolean;
        Count<T>(source: T[], predicate?: (x: T) => boolean): number;
        OrderBy<T, K>(source: T[], keySelector: (x: T) => K): T[];
        OrderByDescending<T, K>(source: T[], keySelector: (x: T) => K): T[];
    }
}
```

## Common .NET Patterns

### File I/O

```typescript
import { File, Directory, Path } from "System.IO";

export function saveData(data: any): void {
    const json = JSON.stringify(data);
    const path = Path.Combine("data", "output.json");

    if (!Directory.Exists("data")) {
        Directory.CreateDirectory("data");
    }

    File.WriteAllText(path, json);
}
```

### HTTP Requests

```typescript
import { HttpClient, StringContent } from "System.Net.Http";

export async function fetchData(url: string): Promise<string> {
    const client = new HttpClient();
    try {
        const response = await client.GetStringAsync(url);
        return response;
    } finally {
        client.Dispose();
    }
}

export async function postJson(url: string, data: any): Promise<void> {
    const client = new HttpClient();
    try {
        const json = JSON.stringify(data);
        const content = new StringContent(json, "utf-8", "application/json");
        await client.PostAsync(url, content);
    } finally {
        client.Dispose();
    }
}
```

### Collections

```typescript
import { List, Dictionary, HashSet } from "System.Collections.Generic";

export function useCollections(): void {
    // List
    const list = new List<string>();
    list.Add("item1");
    list.Add("item2");
    console.log(`Count: ${list.Count}`);

    // Dictionary
    const dict = new Dictionary<string, number>();
    dict.Add("key1", 100);
    dict.Add("key2", 200);

    // HashSet
    const set = new HashSet<number>();
    set.Add(1);
    set.Add(2);
    set.Add(1); // Duplicate, won't be added
}
```

### Entity Framework Core

```typescript
// Requires Microsoft.EntityFrameworkCore declarations
import { DbContext, DbSet } from "Microsoft.EntityFrameworkCore";

export class Blog {
    BlogId: number;
    Url: string;
    Posts: Post[];
}

export class Post {
    PostId: number;
    Title: string;
    Content: string;
    BlogId: number;
    Blog: Blog;
}

export class BlogContext extends DbContext {
    Blogs: DbSet<Blog>;
    Posts: DbSet<Post>;

    protected OnConfiguring(optionsBuilder: DbContextOptionsBuilder): void {
        optionsBuilder.UseSqlite("Data Source=blog.db");
    }
}

export async function createBlog(): Promise<void> {
    const context = new BlogContext();

    const blog = new Blog();
    blog.Url = "https://example.com";

    context.Blogs.Add(blog);
    await context.SaveChangesAsync();
}
```

## Type Mappings for .NET Types

When .NET types are used in TypeScript, they follow these mappings:

| .NET Type | TypeScript Declaration | Notes |
|-----------|----------------------|--------|
| `string` | `string` | Direct mapping |
| `int`, `long`, `double` | `number` | All numbers are double in JS |
| `bool` | `boolean` | Direct mapping |
| `DateTime` | `DateTime` class | Custom class in declarations |
| `Guid` | `Guid` class | Custom class in declarations |
| `List<T>` | `List<T>` class | Not Array (different semantics) |
| `Dictionary<K,V>` | `Dictionary<K,V>` class | Not Map (different API) |
| `Task<T>` | `Promise<T>` | Async interop |
| `IEnumerable<T>` | `T[]` | Simplified for MVP |

## Limitations

### Generics

Complex generic constraints may not be fully supported:

```typescript
// May not work in MVP
import { Repository } from "MyApp.Data";
const repo = new Repository<User, number>();  // Complex generics
```

### Extension Methods

LINQ extension methods need special handling:

```typescript
// Not supported directly
users.Where(u => u.Age > 18);

// Use static methods instead
import { Enumerable } from "System.Linq";
Enumerable.Where(users, u => u.Age > 18);
```

### Attributes

.NET attributes cannot be applied from TypeScript:

```typescript
// Cannot do this in TypeScript
// [Authorize]
// [HttpGet("/api/users")]
export function getUsers() { }
```

### Partial Classes

.NET partial classes appear as single class:

```typescript
// Both partials merged in declarations
import { MyPartialClass } from "MyApp";
```

## NuGet Package Support

For NuGet packages, generate declarations using the separate tool:

```bash
# Future tool (not part of Tsonic compiler)
dotnet-to-ts generate Microsoft.EntityFrameworkCore --output ef.d.ts
```

## Best Practices

1. **Use .NET for I/O**: File, network, database operations
2. **Use Tsonic.Runtime for JS semantics**: Arrays, strings with JS methods
3. **Prefer .NET collections for performance**: When JS semantics not needed
4. **Handle disposal**: Use try/finally for IDisposable
5. **Type declarations**: Generate for all used .NET assemblies

## Examples

### Complete Example: File Processor

```typescript
import { File, Directory, Path } from "System.IO";
import { JsonSerializer } from "System.Text.Json";
import { List } from "System.Collections.Generic";

interface ProcessedFile {
    path: string;
    size: number;
    processed: Date;
}

export class FileProcessor {
    private results: List<ProcessedFile>;

    constructor() {
        this.results = new List<ProcessedFile>();
    }

    processDirectory(dir: string): void {
        const files = Directory.GetFiles(dir, "*.txt");

        for (const file of files) {
            const content = File.ReadAllText(file);
            const processed = this.processContent(content);

            this.results.Add({
                path: file,
                size: content.length,
                processed: new Date()
            });

            const outputPath = Path.ChangeExtension(file, ".processed");
            File.WriteAllText(outputPath, processed);
        }
    }

    private processContent(content: string): string {
        return content.toUpperCase(); // Mix of .NET and JS
    }

    saveResults(): void {
        const json = JsonSerializer.Serialize(this.results.ToArray());
        File.WriteAllText("results.json", json);
    }
}
```