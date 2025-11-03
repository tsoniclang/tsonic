# Import Examples

## Local Imports

### TypeScript Input

**src/models/User.ts**

```typescript
export class User {
  constructor(
    public name: string,
    public email: string
  ) {}

  toString(): string {
    return `${this.name} <${this.email}>`;
  }
}
```

**src/models/Post.ts**

```typescript
import { User } from "./User.ts";

export class Post {
  constructor(
    public title: string,
    public content: string,
    public author: User
  ) {}

  display(): void {
    console.log(`Title: ${this.title}`);
    console.log(`Author: ${this.author.toString()}`);
    console.log(`Content: ${this.content}`);
  }
}
```

**src/services/BlogService.ts**

```typescript
import { User } from "../models/User.ts";
import { Post } from "../models/Post.ts";

export class BlogService {
  private posts: Post[] = [];

  addPost(title: string, content: string, author: User): void {
    const post = new Post(title, content, author);
    this.posts.push(post);
  }

  listPosts(): void {
    for (const post of this.posts) {
      post.display();
      console.log("---");
    }
  }
}
```

**src/main.ts**

```typescript
import { User } from "./models/User.ts";
import { BlogService } from "./services/BlogService.ts";

export function main(): void {
  const user = new User("Alice", "alice@example.com");
  const service = new BlogService();

  service.addPost("First Post", "This is my first blog post!", user);

  service.addPost("Second Post", "Another interesting post", user);

  service.listPosts();
}
```

### C# Output

**models/User.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App.models
{
    public class User
    {
        public string name { get; set; }
        public string email { get; set; }

        public User(string name, string email)
        {
            this.name = name;
            this.email = email;
        }

        public string toString()
        {
            return $"{this.name} <{this.email}>";
        }
    }
}
```

**models/Post.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.models;

namespace My.App.models
{
    public class Post
    {
        public string title { get; set; }
        public string content { get; set; }
        public User author { get; set; }

        public Post(string title, string content, User author)
        {
            this.title = title;
            this.content = content;
            this.author = author;
        }

        public void display()
        {
            console.log($"Title: {this.title}");
            console.log($"Author: {this.author.toString()}");
            console.log($"Content: {this.content}");
        }
    }
}
```

**services/BlogService.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.models;

namespace My.App.services
{
    public class BlogService
    {
        private Array<Post> posts = new Array<Post>();

        public void addPost(string title, string content, User author)
        {
            var post = new Post(title, content, author);
            this.posts.push(post);
        }

        public void listPosts()
        {
            foreach (var post in this.posts)
            {
                post.display();
                console.log("---");
            }
        }
    }
}
```

**main.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.models;
using My.App.services;

namespace My.App
{
    public static class main
    {
        public static void main()
        {
            var user = new User("Alice", "alice@example.com");
            var service = new BlogService();

            service.addPost(
                "First Post",
                "This is my first blog post!",
                user
            );

            service.addPost(
                "Second Post",
                "Another interesting post",
                user
            );

            service.listPosts();
        }
    }
}
```

## Mixed Exports

### TypeScript Input

**src/utils/helpers.ts**

```typescript
export const VERSION = "1.0.0";
export const DEBUG = true;

export function log(message: string): void {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
  }
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
```

**src/app.ts**

```typescript
import { VERSION, DEBUG, log, formatDate } from "./utils/helpers.ts";

export function run(): void {
  log(`App version: ${VERSION}`);
  log(`Debug mode: ${DEBUG}`);

  const now = new Date();
  log(`Current time: ${formatDate(now)}`);
}
```

### C# Output

**utils/helpers.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App.utils
{
    public static class helpers
    {
        public static readonly string VERSION = "1.0.0";
        public static readonly bool DEBUG = true;

        public static void log(string message)
        {
            if (DEBUG)
            {
                console.log($"[DEBUG] {message}");
            }
        }

        public static string formatDate(Date date)
        {
            return date.toISOString();
        }
    }
}
```

**app.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.utils;

namespace My.App
{
    public static class app
    {
        public static void run()
        {
            helpers.log($"App version: {helpers.VERSION}");
            helpers.log($"Debug mode: {helpers.DEBUG}");

            var now = new Date();
            helpers.log($"Current time: {helpers.formatDate(now)}");
        }
    }
}
```

## Complex Import Paths

### TypeScript Input

**src/features/auth/types/User.ts**

```typescript
export interface UserCredentials {
  username: string;
  password: string;
}

export class AuthUser {
  constructor(
    public id: string,
    public username: string,
    public roles: string[]
  ) {}
}
```

**src/features/auth/services/AuthService.ts**

```typescript
import { AuthUser, UserCredentials } from "../types/User.ts";

export class AuthService {
  login(creds: UserCredentials): AuthUser | null {
    // Simplified auth
    if (creds.username === "admin" && creds.password === "secret") {
      return new AuthUser("1", "admin", ["admin", "user"]);
    }
    return null;
  }
}
```

**src/main.ts**

```typescript
import { AuthService } from "./features/auth/services/AuthService.ts";
import { UserCredentials } from "./features/auth/types/User.ts";

export function main(): void {
  const service = new AuthService();
  const creds: UserCredentials = {
    username: "admin",
    password: "secret",
  };

  const user = service.login(creds);
  if (user) {
    console.log(`Logged in as ${user.username}`);
    console.log(`Roles: ${user.roles.join(", ")}`);
  } else {
    console.log("Login failed");
  }
}
```

### C# Output

**features/auth/types/User.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;

namespace My.App.features.auth.types
{
    public class UserCredentials
    {
        public string username { get; set; }
        public string password { get; set; }
    }

    public class AuthUser
    {
        public string id { get; set; }
        public string username { get; set; }
        public Array<string> roles { get; set; }

        public AuthUser(string id, string username, Array<string> roles)
        {
            this.id = id;
            this.username = username;
            this.roles = roles;
        }
    }
}
```

**features/auth/services/AuthService.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.features.auth.types;

namespace My.App.features.auth.services
{
    public class AuthService
    {
        public AuthUser login(UserCredentials creds)
        {
            // Simplified auth
            if (creds.username == "admin" && creds.password == "secret")
            {
                return new AuthUser("1", "admin", new Array<string>("admin", "user"));
            }
            return null;
        }
    }
}
```

**main.cs**

```csharp
using Tsonic.Runtime;
using static Tsonic.Runtime.Globals;
using My.App.features.auth.services;
using My.App.features.auth.types;

namespace My.App
{
    public static class main
    {
        public static void main()
        {
            var service = new AuthService();
            var creds = new UserCredentials
            {
                username = "admin",
                password = "secret"
            };

            var user = service.login(creds);
            if (user != null)
            {
                console.log($"Logged in as {user.username}");
                console.log($"Roles: {user.roles.join(new String(", "))}");
            }
            else
            {
                console.log("Login failed");
            }
        }
    }
}
```
