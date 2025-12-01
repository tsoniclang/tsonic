# Deployment Guide

**Goal**: Learn how to build and distribute Tsonic applications

**Time**: ~10 minutes

**Prerequisites**: Completed [Building Applications](04-building-apps.md)

---

## Overview

Tsonic compiles to **native executables** via .NET NativeAOT. This means:

- ✅ **Single-file binary** - No runtime dependencies
- ✅ **Fast startup** - No JIT compilation
- ✅ **Small size** - Trimmed to only what you use
- ✅ **Cross-platform** - Build for Windows, Linux, macOS

---

## Building for Production

### Basic Build

```bash
tsonic build main.ts
```

**Output**: `./bin/main` (or `main.exe` on Windows)

**Size**: Depends on what you use (typically 5-50 MB)

### Optimized Build

```bash
tsonic build main.ts --release
```

**Optimizations applied**:

- Code optimization (O3)
- Dead code elimination
- Assembly trimming
- Compression

**Size reduction**: 30-50% smaller than debug builds

---

## Cross-Platform Builds

### Build for Linux (from any OS)

```bash
tsonic build main.ts --runtime linux-x64 --release
```

**Output**: `./bin/main` (Linux ELF binary)

### Build for Windows (from any OS)

```bash
tsonic build main.ts --runtime win-x64 --release
```

**Output**: `./bin/main.exe` (Windows PE binary)

### Build for macOS (from any OS)

```bash
tsonic build main.ts --runtime osx-x64 --release
```

**Output**: `./bin/main` (macOS Mach-O binary)

### Available Runtimes

| Runtime ID    | Platform | Architecture          |
| ------------- | -------- | --------------------- |
| `linux-x64`   | Linux    | x86_64                |
| `linux-arm64` | Linux    | ARM64                 |
| `win-x64`     | Windows  | x86_64                |
| `win-arm64`   | Windows  | ARM64                 |
| `osx-x64`     | macOS    | x86_64 (Intel)        |
| `osx-arm64`   | macOS    | ARM64 (Apple Silicon) |

---

## Distribution

### Single Binary

The compiled executable is **self-contained** - no dependencies required:

```bash
# Copy binary to target system
scp ./bin/main user@server:/usr/local/bin/

# Run directly
ssh user@server '/usr/local/bin/main'
```

### Docker Container

Create a minimal Docker image:

```dockerfile
# Dockerfile
FROM scratch

# Copy binary
COPY bin/main /main

# Set entry point
ENTRYPOINT ["/main"]
```

Build and run:

```bash
# Build Tsonic app
tsonic build main.ts --runtime linux-x64 --release

# Build Docker image
docker build -t my-app .

# Run container
docker run --rm my-app

# Size: Usually 10-60 MB total!
```

### Debian/Ubuntu Package

Create a `.deb` package:

```bash
# 1. Create package structure
mkdir -p my-app_1.0.0/usr/local/bin
mkdir -p my-app_1.0.0/DEBIAN

# 2. Copy binary
cp bin/main my-app_1.0.0/usr/local/bin/

# 3. Create control file
cat > my-app_1.0.0/DEBIAN/control <<EOF
Package: my-app
Version: 1.0.0
Architecture: amd64
Maintainer: Your Name <your@email.com>
Description: My Tsonic application
EOF

# 4. Build package
dpkg-deb --build my-app_1.0.0

# 5. Install
sudo dpkg -i my-app_1.0.0.deb
```

---

## Configuration for Deployment

### Environment-Specific Configs

```typescript
// src/config.ts
import { Environment } from "System";
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

export interface AppConfig {
  database: {
    host: string;
    port: number;
    name: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
}

export function loadConfig(): AppConfig {
  // 1. Try environment variable
  const configPath = Environment.GetEnvironmentVariable("APP_CONFIG");
  if (configPath && File.Exists(configPath)) {
    const json = File.ReadAllText(configPath);
    return JsonSerializer.Deserialize<AppConfig>(json);
  }

  // 2. Try default location
  const defaultPath = "/etc/myapp/config.json";
  if (File.Exists(defaultPath)) {
    const json = File.ReadAllText(defaultPath);
    return JsonSerializer.Deserialize<AppConfig>(json);
  }

  // 3. Use defaults
  return {
    database: {
      host: "localhost",
      port: 5432,
      name: "myapp",
    },
    api: {
      baseUrl: "http://localhost:3000",
      timeout: 30000,
    },
  };
}
```

Deploy with custom config:

```bash
# Set config path
export APP_CONFIG=/opt/myapp/production.json

# Run application
./bin/main
```

### Embedded Resources

Embed configuration into binary during build:

```typescript
// embed-config.ts
export const PRODUCTION_CONFIG = {
  database: {
    host: "db.production.com",
    port: 5432,
    name: "myapp_prod",
  },
  api: {
    baseUrl: "https://api.production.com",
    timeout: 30000,
  },
};
```

```typescript
// main.ts
import { PRODUCTION_CONFIG } from "./embed-config.ts";

export function main(): void {
  const config = PRODUCTION_CONFIG;
  console.log(`Database: ${config.database.host}`);
}
```

**Advantage**: No external files needed, config is in binary.

---

## Logging in Production

### File-Based Logging

```typescript
// src/logger.ts
import { File, Path } from "System.IO";
import { Environment } from "System";

export function log(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${level}: ${message}\n`;

  // Get log path from environment or use default
  const logDir =
    Environment.GetEnvironmentVariable("LOG_DIR") ?? "/var/log/myapp";
  const logPath = Path.Combine(logDir, "app.log");

  // Append to log file
  File.AppendAllText(logPath, logLine);
}
```

```typescript
// main.ts
import { log } from "./src/logger.ts";

export function main(): void {
  log("INFO", "Application started");

  try {
    // Application logic
  } catch (error) {
    log("ERROR", `Application error: ${error}`);
  }

  log("INFO", "Application stopped");
}
```

### Structured Logging (JSON)

```typescript
// src/logger.ts
import { File } from "System.IO";
import { JsonSerializer } from "System.Text.Json";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export function log(
  level: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  const json = JsonSerializer.Serialize(entry);
  File.AppendAllText("/var/log/myapp/app.json", json + "\n");
}
```

Usage:

```typescript
log("INFO", "User logged in", { userId: 123, ip: "192.168.1.1" });
log("ERROR", "Database connection failed", { host: "db.prod.com", port: 5432 });
```

---

## Monitoring

### Health Check Endpoint

```typescript
// src/health.ts
import { File } from "System.IO";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  checks: {
    database: boolean;
    disk: boolean;
    memory: boolean;
  };
}

export function checkHealth(): HealthStatus {
  const checks = {
    database: checkDatabase(),
    disk: checkDisk(),
    memory: checkMemory(),
  };

  const allHealthy = Object.values(checks).every((c) => c);

  return {
    status: allHealthy ? "healthy" : "unhealthy",
    checks,
  };
}

function checkDatabase(): boolean {
  try {
    // Test database connection
    return true;
  } catch {
    return false;
  }
}

function checkDisk(): boolean {
  try {
    // Check disk space
    const driveInfo = new DriveInfo("/");
    const freePercent =
      (driveInfo.AvailableFreeSpace / driveInfo.TotalSize) * 100;
    return freePercent > 10; // At least 10% free
  } catch {
    return false;
  }
}

function checkMemory(): boolean {
  // Check memory usage
  const gcInfo = GC.GetGCMemoryInfo();
  const usedMB = gcInfo.HeapSizeBytes / 1024 / 1024;
  return usedMB < 1000; // Less than 1GB
}
```

Expose via HTTP:

```typescript
// main.ts (HTTP server)
import { checkHealth } from "./src/health.ts";

app.MapGet("/health", () => {
  const health = checkHealth();
  return Results.Json(health, statusCode: health.status === "healthy" ? 200 : 503);
});
```

### Metrics Export

```typescript
// src/metrics.ts
import { File } from "System.IO";

interface Metrics {
  uptime: number;
  requestsTotal: number;
  requestsPerSecond: number;
  errorRate: number;
}

let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

export function recordRequest(): void {
  requestCount++;
}

export function recordError(): void {
  errorCount++;
}

export function getMetrics(): Metrics {
  const uptimeMs = Date.now() - startTime;
  const uptimeSec = uptimeMs / 1000;

  return {
    uptime: uptimeSec,
    requestsTotal: requestCount,
    requestsPerSecond: requestCount / uptimeSec,
    errorRate: requestCount > 0 ? errorCount / requestCount : 0,
  };
}

// Export Prometheus format
export function exportPrometheus(): string {
  const metrics = getMetrics();
  return `
# HELP requests_total Total number of requests
# TYPE requests_total counter
requests_total ${metrics.requestsTotal}

# HELP errors_total Total number of errors
# TYPE errors_total counter
errors_total ${errorCount}

# HELP uptime_seconds Application uptime in seconds
# TYPE uptime_seconds gauge
uptime_seconds ${metrics.uptime}
  `.trim();
}
```

---

## Graceful Shutdown

```typescript
// src/shutdown.ts
import { Console, Environment } from "System";

type ShutdownHandler = () => void;

const handlers: ShutdownHandler[] = [];

export function registerShutdownHandler(handler: ShutdownHandler): void {
  handlers.push(handler);
}

export function setupGracefulShutdown(): void {
  // Listen for SIGTERM/SIGINT
  Console.CancelKeyPress.add((sender, args) => {
    console.log("\nShutting down gracefully...");

    // Run shutdown handlers
    for (const handler of handlers) {
      try {
        handler();
      } catch (error) {
        console.log(`Shutdown handler error: ${error}`);
      }
    }

    console.log("Shutdown complete");
    Environment.Exit(0);
  });
}
```

Usage:

```typescript
// main.ts
import {
  setupGracefulShutdown,
  registerShutdownHandler,
} from "./src/shutdown.ts";
import { Database } from "./src/database.ts";

export function main(): void {
  const db = new Database("connection-string");

  // Register cleanup
  registerShutdownHandler(() => {
    console.log("Closing database connection...");
    db.close();
  });

  setupGracefulShutdown();

  // Application logic
  console.log("Server running. Press Ctrl+C to stop.");
}
```

---

## Systemd Service (Linux)

Create systemd service file:

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Tsonic Application
After=network.target

[Service]
Type=simple
User=myapp
Group=myapp
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/main
Restart=always
RestartSec=10

# Environment
Environment="APP_CONFIG=/etc/myapp/config.json"
Environment="LOG_DIR=/var/log/myapp"

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/myapp

[Install]
WantedBy=multi-user.target
```

Install and run:

```bash
# Install service
sudo cp myapp.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start
sudo systemctl enable myapp
sudo systemctl start myapp

# Check status
sudo systemctl status myapp

# View logs
sudo journalctl -u myapp -f
```

---

## Performance Optimization

### Profile Build Size

```bash
# See what's included in binary
tsonic build main.ts --release --analyze

# Output (mode: "dotnet" - smaller, no runtime):
# Total size: 7.1 MB
# - System.Net.Http: 3.2 MB
# - Application code: 2.5 MB
# - Other: 1.4 MB

# Output (mode: "js" - includes Tsonic.JSRuntime):
# Total size: 15.2 MB
# - Tsonic.JSRuntime: 8.1 MB
# - System.Net.Http: 3.2 MB
# - Application code: 2.5 MB
# - Other: 1.4 MB
```

### Reduce Size

```bash
# Aggressive trimming (may break reflection)
tsonic build main.ts --release --trim aggressive

# Link-time optimization
tsonic build main.ts --release --lto

# Both
tsonic build main.ts --release --trim aggressive --lto
```

**Warning**: Aggressive trimming may break code that uses reflection.

---

## Security Considerations

### 1. Don't Embed Secrets

```typescript
// ❌ BAD - Secrets in code
const API_KEY = "sk_live_abc123...";

// ✅ GOOD - From environment
import { Environment } from "System";
const API_KEY = Environment.GetEnvironmentVariable("API_KEY");
```

### 2. Validate Input

```typescript
// ✅ GOOD - Validate user input
function processFile(path: string): void {
  // Prevent directory traversal
  if (path.includes("..")) {
    throw new Error("Invalid path");
  }

  // Only allow specific directory
  const safePath = Path.Combine("/data/uploads", Path.GetFileName(path));
  File.ReadAllText(safePath);
}
```

### 3. Use HTTPS

```typescript
import { HttpClient } from "System.Net.Http";

const client = new HttpClient();
client.BaseAddress = new Uri("https://api.example.com"); // ← HTTPS
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Built with `--release` flag
- [ ] Tested on target platform
- [ ] Configuration externalized (not hardcoded)
- [ ] Logging configured
- [ ] Health checks implemented
- [ ] Graceful shutdown handled
- [ ] No secrets in code or repository
- [ ] Input validation in place
- [ ] Error handling tested
- [ ] Monitoring/metrics available

---

## Complete Example: Production-Ready Service

```typescript
// main.ts
import { WebApplication } from "Microsoft.AspNetCore.Builder";
import { loadConfig } from "./src/config.ts";
import { setupLogging } from "./src/logger.ts";
import {
  setupGracefulShutdown,
  registerShutdownHandler,
} from "./src/shutdown.ts";
import { checkHealth } from "./src/health.ts";
import { exportPrometheus } from "./src/metrics.ts";

export function main(): void {
  // Load configuration
  const config = loadConfig();

  // Setup logging
  const logger = setupLogging(config.logging.level);
  logger.info("Starting application");

  // Setup HTTP server
  const app = WebApplication.Create();

  // Health check endpoint
  app.MapGet("/health", () => {
    const health = checkHealth();
    return Results.Json(health);
  });

  // Metrics endpoint
  app.MapGet("/metrics", () => {
    return Results.Text(exportPrometheus(), "text/plain");
  });

  // Application endpoints
  app.MapGet("/", () => Results.Ok("Service running"));

  // Graceful shutdown
  registerShutdownHandler(() => {
    logger.info("Shutting down HTTP server");
    app.Stop();
  });
  setupGracefulShutdown();

  // Start server
  logger.info(`Server listening on ${config.api.baseUrl}`);
  app.Run(config.api.baseUrl);
}
```

Build and deploy:

```bash
# Build for production
tsonic build main.ts --runtime linux-x64 --release

# Create deployment package
tar czf myapp-1.0.0.tar.gz \
  bin/main \
  config/production.json \
  scripts/install.sh

# Deploy
scp myapp-1.0.0.tar.gz server:/tmp/
ssh server 'cd /tmp && tar xzf myapp-1.0.0.tar.gz && ./scripts/install.sh'
```

---

## Key Takeaways

1. **Native executables** - Single file, no dependencies
2. **Cross-platform builds** - Build for any OS from any OS
3. **Production configs** - Externalize, use environment variables
4. **Structured logging** - JSON format for analysis
5. **Health checks** - Monitor service status
6. **Graceful shutdown** - Clean up resources properly
7. **Security** - Validate input, use HTTPS, no secrets in code

---

## Next Steps

- **[Reference Documentation](../reference/INDEX.md)** - Complete API reference
- **[Examples](../examples/INDEX.md)** - Real-world applications
- **[Cookbook](../cookbook/INDEX.md)** - Common deployment patterns

---

**Congratulations!** You've completed the Tsonic guide. You now know how to build, test, and deploy production-ready applications.

---

**Previous**: [← Building Applications](04-building-apps.md)
