# .NET Interop Examples

## File I/O

### TypeScript Input

```typescript
// src/fileOperations.ts
import { File, Directory, Path } from "System.IO";

export function createBackup(sourceFile: string): string {
  if (!File.Exists(sourceFile)) {
    throw new Error(`File not found: ${sourceFile}`);
  }

  const backupDir = "backups";
  if (!Directory.Exists(backupDir)) {
    Directory.CreateDirectory(backupDir);
  }

  const fileName = Path.GetFileName(sourceFile);
  const timestamp = Date.now();
  const backupPath = Path.Combine(backupDir, `${timestamp}_${fileName}`);

  File.Copy(sourceFile, backupPath, true);
  console.log(`Backup created: ${backupPath}`);

  return backupPath;
}

export function readConfig(configPath: string): any {
  const content = File.ReadAllText(configPath);
  return JSON.parse(content);
}

export function saveConfig(configPath: string, config: any): void {
  const json = JSON.stringify(config);
  File.WriteAllText(configPath, json);
}
```

### C# Output

```csharp
using System.IO;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class fileOperations
    {
        public static string createBackup(string sourceFile)
        {
            if (!File.Exists(sourceFile))
            {
                throw new System.Exception($"File not found: {sourceFile}");
            }

            var backupDir = "backups";
            if (!Directory.Exists(backupDir))
            {
                Directory.CreateDirectory(backupDir);
            }

            var fileName = Path.GetFileName(sourceFile);
            var timestamp = Date.now();
            var backupPath = Path.Combine(backupDir, $"{timestamp}_{fileName}");

            File.Copy(sourceFile, backupPath, true);
            console.log($"Backup created: {backupPath}");

            return backupPath;
        }

        public static dynamic readConfig(string configPath)
        {
            var content = File.ReadAllText(configPath);
            return JSON.parse<dynamic>(content);
        }

        public static void saveConfig(string configPath, dynamic config)
        {
            var json = JSON.stringify(config);
            File.WriteAllText(configPath, json);
        }
    }
}
```

## HTTP Client

### TypeScript Input

```typescript
// src/httpClient.ts
import { HttpClient, StringContent } from "System.Net.Http";

export async function fetchJson<T>(url: string): Promise<T> {
  const client = new HttpClient();
  try {
    const response = await client.GetStringAsync(url);
    return JSON.parse(response) as T;
  } finally {
    client.Dispose();
  }
}

export async function postData(url: string, data: any): Promise<boolean> {
  const client = new HttpClient();
  try {
    const json = JSON.stringify(data);
    const content = new StringContent(json, "utf-8", "application/json");
    const response = await client.PostAsync(url, content);
    return response.IsSuccessStatusCode;
  } finally {
    client.Dispose();
  }
}

export class ApiClient {
  private client: HttpClient;

  constructor(baseUrl: string) {
    this.client = new HttpClient();
    this.client.BaseAddress = baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.client.GetStringAsync(path);
    return JSON.parse(response) as T;
  }

  async post(path: string, data: any): Promise<void> {
    const json = JSON.stringify(data);
    const content = new StringContent(json, "utf-8", "application/json");
    await this.client.PostAsync(path, content);
  }

  dispose(): void {
    this.client.Dispose();
  }
}
```

### C# Output

```csharp
using System.Net.Http;
using System.Threading.Tasks;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class httpClient
    {
        public static async Task<T> fetchJson<T>(string url)
        {
            var client = new HttpClient();
            try
            {
                var response = await client.GetStringAsync(url);
                return JSON.parse<T>(response);
            }
            finally
            {
                client.Dispose();
            }
        }

        public static async Task<bool> postData(string url, dynamic data)
        {
            var client = new HttpClient();
            try
            {
                var json = JSON.stringify(data);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, content);
                return response.IsSuccessStatusCode;
            }
            finally
            {
                client.Dispose();
            }
        }
    }

    public class ApiClient
    {
        private HttpClient client;

        public ApiClient(string baseUrl)
        {
            this.client = new HttpClient();
            this.client.BaseAddress = new System.Uri(baseUrl);
        }

        public async Task<T> get<T>(string path)
        {
            var response = await this.client.GetStringAsync(path);
            return JSON.parse<T>(response);
        }

        public async Task post(string path, dynamic data)
        {
            var json = JSON.stringify(data);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            await this.client.PostAsync(path, content);
        }

        public void dispose()
        {
            this.client.Dispose();
        }
    }
}
```

## JSON Serialization

### TypeScript Input

```typescript
// src/jsonExample.ts
import { JsonSerializer, JsonSerializerOptions } from "System.Text.Json";

interface Product {
  id: number;
  name: string;
  price: number;
  tags: string[];
}

export function serializeProducts(products: Product[]): string {
  const options = new JsonSerializerOptions();
  options.WriteIndented = true;
  options.PropertyNameCaseInsensitive = true;

  return JsonSerializer.Serialize(products, options);
}

export function deserializeProducts(json: string): Product[] {
  const options = new JsonSerializerOptions();
  options.PropertyNameCaseInsensitive = true;

  return JsonSerializer.Deserialize<Product[]>(json, options);
}

export function processProducts(): void {
  const products: Product[] = [
    {
      id: 1,
      name: "Laptop",
      price: 999.99,
      tags: ["electronics", "computers"],
    },
    {
      id: 2,
      name: "Mouse",
      price: 29.99,
      tags: ["electronics", "accessories"],
    },
  ];

  // Serialize
  const json = serializeProducts(products);
  console.log("Serialized:");
  console.log(json);

  // Deserialize
  const loaded = deserializeProducts(json);
  console.log("Deserialized:");
  for (const product of loaded) {
    console.log(`${product.name}: $${product.price}`);
  }
}
```

### C# Output

```csharp
using System.Text.Json;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public class Product
    {
        public double id { get; set; }
        public string name { get; set; }
        public double price { get; set; }
        public Array<string> tags { get; set; }
    }

    public static class jsonExample
    {
        public static string serializeProducts(Array<Product> products)
        {
            var options = new JsonSerializerOptions();
            options.WriteIndented = true;
            options.PropertyNameCaseInsensitive = true;

            // Note: Requires custom JsonConverter for Array<T> or use products.ToArray()
            return JsonSerializer.Serialize(products, options);
        }

        public static Array<Product> deserializeProducts(string json)
        {
            var options = new JsonSerializerOptions();
            options.PropertyNameCaseInsensitive = true;

            return JsonSerializer.Deserialize<Array<Product>>(json, options);
        }

        public static void processProducts()
        {
            var products = new Array<Product>(
                new Product {
                    id = 1,
                    name = "Laptop",
                    price = 999.99,
                    tags = new Array<string>("electronics", "computers")
                },
                new Product {
                    id = 2,
                    name = "Mouse",
                    price = 29.99,
                    tags = new Array<string>("electronics", "accessories")
                }
            );

            // Serialize
            var json = serializeProducts(products);
            console.log("Serialized:");
            console.log(json);

            // Deserialize
            var loaded = deserializeProducts(json);
            console.log("Deserialized:");
            foreach (var product in loaded)
            {
                console.log($"{product.name}: ${product.price}");
            }
        }
    }
}
```

## Collections

### TypeScript Input

```typescript
// src/collections.ts
import { List, Dictionary, HashSet } from "System.Collections.Generic";

export class DataStore {
  private users: List<string>;
  private settings: Dictionary<string, any>;
  private tags: HashSet<string>;

  constructor() {
    this.users = new List<string>();
    this.settings = new Dictionary<string, any>();
    this.tags = new HashSet<string>();
  }

  addUser(name: string): void {
    this.users.Add(name);
    console.log(`User added: ${name}`);
  }

  setSetting(key: string, value: any): void {
    if (this.settings.ContainsKey(key)) {
      this.settings.Remove(key);
    }
    this.settings.Add(key, value);
    console.log(`Setting updated: ${key} = ${value}`);
  }

  addTag(tag: string): boolean {
    const added = this.tags.Add(tag);
    if (added) {
      console.log(`Tag added: ${tag}`);
    } else {
      console.log(`Tag already exists: ${tag}`);
    }
    return added;
  }

  summary(): void {
    console.log(`Users: ${this.users.Count}`);
    console.log(`Settings: ${this.settings.Count}`);
    console.log(`Tags: ${this.tags.Count}`);
  }
}
```

### C# Output

```csharp
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public class DataStore
    {
        private List<string> users;
        private Dictionary<string, dynamic> settings;
        private HashSet<string> tags;

        public DataStore()
        {
            this.users = new List<string>();
            this.settings = new Dictionary<string, dynamic>();
            this.tags = new HashSet<string>();
        }

        public void addUser(string name)
        {
            this.users.Add(name);
            console.log($"User added: {name}");
        }

        public void setSetting(string key, dynamic value)
        {
            if (this.settings.ContainsKey(key))
            {
                this.settings.Remove(key);
            }
            this.settings.Add(key, value);
            console.log($"Setting updated: {key} = {value}");
        }

        public bool addTag(string tag)
        {
            var added = this.tags.Add(tag);
            if (added)
            {
                console.log($"Tag added: {tag}");
            }
            else
            {
                console.log($"Tag already exists: {tag}");
            }
            return added;
        }

        public void summary()
        {
            console.log($"Users: {this.users.Count}");
            console.log($"Settings: {this.settings.Count}");
            console.log($"Tags: {this.tags.Count}");
        }
    }
}
```

## Mixed Runtime and .NET

### TypeScript Input

```typescript
// src/mixed.ts
import { File } from "System.IO";
import { List } from "System.Collections.Generic";

export function processMixed(): void {
  // JS arrays with Tsonic.Runtime
  const jsArray: string[] = ["one", "two", "three"];
  jsArray[10] = "ten"; // Sparse array
  console.log(`JS Array length: ${jsArray.length}`);

  // .NET List
  const dotnetList = new List<string>();
  for (const item of jsArray) {
    if (item) {
      // Skip undefined
      dotnetList.Add(item);
    }
  }
  console.log(`NET List count: ${dotnetList.Count}`);

  // JS Date
  const jsDate = new Date();
  console.log(`JS Date: ${jsDate.toISOString()}`);

  // .NET file I/O
  const data = {
    array: jsArray,
    list: dotnetList.ToArray(),
    date: jsDate.toISOString(),
  };

  const json = JSON.stringify(data);
  File.WriteAllText("mixed-data.json", json);
  console.log("Data saved to mixed-data.json");
}
```

### C# Output

```csharp
using System.IO;
using System.Collections.Generic;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class mixed
    {
        public static void processMixed()
        {
            // JS arrays with Tsonic.Runtime
            var jsArray = new Array<string>("one", "two", "three");
            jsArray[10] = "ten";  // Sparse array
            console.log($"JS Array length: {jsArray.length}");

            // .NET List
            var dotnetList = new List<string>();
            foreach (var item in jsArray)
            {
                if (item != null)  // Skip undefined
                {
                    dotnetList.Add(item);
                }
            }
            console.log($"NET List count: {dotnetList.Count}");

            // JS Date
            var jsDate = new Date();
            console.log($"JS Date: {jsDate.toISOString()}");

            // .NET file I/O
            var data = new
            {
                array = jsArray,
                list = dotnetList.ToArray(),
                date = jsDate.toISOString()
            };

            var json = JSON.stringify(data);
            File.WriteAllText("mixed-data.json", json);
            console.log("Data saved to mixed-data.json");
        }
    }
}
```
