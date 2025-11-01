# Basic Examples

## Hello World

### TypeScript Input
```typescript
// src/hello.ts
console.log("Hello, World!");
```

### C# Output
```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class hello
    {
        public static void Main()
        {
            console.log("Hello, World!");
        }
    }
}
```

## Variables and Types

### TypeScript Input
```typescript
// src/variables.ts
const name: string = "Alice";
const age = 25;
const isActive = true;
const scores: number[] = [95, 87, 92];
const user = { name: "Bob", age: 30 };

export function printInfo(): void {
    console.log(`Name: ${name}`);
    console.log(`Age: ${age}`);
    console.log(`Active: ${isActive}`);
    console.log(`Scores: ${scores.join(", ")}`);
    console.log(`User: ${user.name} (${user.age})`);
}
```

### C# Output
```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class variables
    {
        private static readonly string name = "Alice";
        private static readonly double age = 25;
        private static readonly bool isActive = true;
        private static readonly Array<double> scores = new Array<double>(95, 87, 92);
        private static readonly object user = new { name = "Bob", age = 30.0 };

        public static void printInfo()
        {
            console.log($"Name: {name}");
            console.log($"Age: {age}");
            console.log($"Active: {isActive}");
            console.log($"Scores: {scores.join(new String(", "))}");
            console.log($"User: {user.name} ({user.age})");
        }
    }
}
```

## Functions

### TypeScript Input
```typescript
// src/functions.ts
export function add(a: number, b: number): number {
    return a + b;
}

export function greet(name: string = "World"): string {
    return `Hello, ${name}!`;
}

export function sum(...numbers: number[]): number {
    let total = 0;
    for (const n of numbers) {
        total += n;
    }
    return total;
}

export async function fetchData(): Promise<string> {
    await delay(100);
    return "Data loaded";
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

### C# Output
```csharp
using System.Threading.Tasks;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class functions
    {
        public static double add(double a, double b)
        {
            return a + b;
        }

        public static string greet(string name = "World")
        {
            return $"Hello, {name}!";
        }

        public static double sum(params double[] numbers)
        {
            double total = 0;
            foreach (var n in numbers)
            {
                total += n;
            }
            return total;
        }

        public static async Task<string> fetchData()
        {
            await delay(100);
            return "Data loaded";
        }

        private static Task delay(double ms)
        {
            return Task.Delay((int)ms);
        }
    }
}
```

## Classes

### TypeScript Input
```typescript
// src/models/Person.ts
export class Person {
    private id: number;
    public name: string;
    protected age: number;

    constructor(name: string, age: number) {
        this.id = Math.random();
        this.name = name;
        this.age = age;
    }

    greet(): string {
        return `Hello, I'm ${this.name}`;
    }

    static create(name: string): Person {
        return new Person(name, 0);
    }
}
```

### C# Output
```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App.models
{
    public class Person
    {
        private double id { get; set; }
        public string name { get; set; }
        protected double age { get; set; }

        public Person(string name, double age)
        {
            this.id = Math.random();
            this.name = name;
            this.age = age;
        }

        public string greet()
        {
            return $"Hello, I'm {this.name}";
        }

        public static Person create(string name)
        {
            return new Person(name, 0);
        }
    }
}
```

## Control Flow

### TypeScript Input
```typescript
// src/control.ts
export function checkValue(value: number): string {
    if (value > 100) {
        return "High";
    } else if (value > 50) {
        return "Medium";
    } else {
        return "Low";
    }
}

export function getDayName(day: number): string {
    switch (day) {
        case 0:
            return "Sunday";
        case 1:
            return "Monday";
        case 2:
            return "Tuesday";
        default:
            return "Unknown";
    }
}

export function countToTen(): void {
    for (let i = 1; i <= 10; i++) {
        console.log(i);
    }
}

export function processArray(items: string[]): void {
    for (const item of items) {
        console.log(`Processing: ${item}`);
    }
}
```

### C# Output
```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class control
    {
        public static string checkValue(double value)
        {
            if (value > 100)
            {
                return "High";
            }
            else if (value > 50)
            {
                return "Medium";
            }
            else
            {
                return "Low";
            }
        }

        public static string getDayName(double day)
        {
            switch (day)
            {
                case 0:
                    return "Sunday";
                case 1:
                    return "Monday";
                case 2:
                    return "Tuesday";
                default:
                    return "Unknown";
            }
        }

        public static void countToTen()
        {
            for (var i = 1; i <= 10; i++)
            {
                console.log(i);
            }
        }

        public static void processArray(Array<string> items)
        {
            foreach (var item in items)
            {
                console.log($"Processing: {item}");
            }
        }
    }
}
```

## Error Handling

### TypeScript Input
```typescript
// src/errors.ts
export function divide(a: number, b: number): number {
    if (b === 0) {
        throw new Error("Division by zero");
    }
    return a / b;
}

export function safeDivide(a: number, b: number): number | null {
    try {
        return divide(a, b);
    } catch (error) {
        console.error("Error:", error);
        return null;
    } finally {
        console.log("Division attempted");
    }
}
```

### C# Output
```csharp
using System;
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App
{
    public static class errors
    {
        public static double divide(double a, double b)
        {
            if (b == 0)
            {
                throw new Exception("Division by zero");
            }
            return a / b;
        }

        public static double? safeDivide(double a, double b)
        {
            try
            {
                return divide(a, b);
            }
            catch (Exception error)
            {
                console.error("Error:", error);
                return null;
            }
            finally
            {
                console.log("Division attempted");
            }
        }
    }
}
```