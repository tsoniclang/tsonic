#!/bin/bash
set -e

# Build @tsonic/tsonic npm package
# This script bundles all packages and includes runtime DLLs

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
NPM_DIR="$ROOT_DIR/npm/tsonic"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Building @tsonic/tsonic npm package ==="
echo ""

# Step 1: Build runtime packages from sibling directories
RUNTIME_DIR="$ROOT_DIR/../runtime"
JSRUNTIME_DIR="$ROOT_DIR/../js-runtime"
NODEJS_DIR="$ROOT_DIR/../nodejs-clr"

echo -e "${YELLOW}Building Tsonic.Runtime...${NC}"
if [[ -d "$RUNTIME_DIR" ]]; then
  cd "$RUNTIME_DIR"
  git pull
  dotnet build -c Release
  echo -e "${GREEN}  Tsonic.Runtime built${NC}"
else
  echo -e "${RED}  Error: runtime repo not found at $RUNTIME_DIR${NC}"
  exit 1
fi

echo -e "${YELLOW}Building Tsonic.JSRuntime...${NC}"
if [[ -d "$JSRUNTIME_DIR" ]]; then
  cd "$JSRUNTIME_DIR"
  git pull
  dotnet build -c Release
  echo -e "${GREEN}  Tsonic.JSRuntime built${NC}"
else
  echo -e "${RED}  Error: js-runtime repo not found at $JSRUNTIME_DIR${NC}"
  exit 1
fi

echo -e "${YELLOW}Building nodejs-clr...${NC}"
if [[ -d "$NODEJS_DIR" ]]; then
  cd "$NODEJS_DIR"
  git pull
  dotnet build -c Release
  echo -e "${GREEN}  nodejs-clr built${NC}"
else
  echo -e "${YELLOW}  Warning: nodejs-clr repo not found at $NODEJS_DIR (optional)${NC}"
fi

# Step 2: Build all TypeScript packages
echo -e "${YELLOW}Building TypeScript packages...${NC}"
cd "$ROOT_DIR"
npm run build

# Step 3: Bundle with esbuild
echo -e "${YELLOW}Bundling with esbuild...${NC}"
npx esbuild packages/cli/dist/index.js \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=esm \
  --outfile="$NPM_DIR/dist/cli.js" \
  --external:typescript

# Add shebang (esbuild doesn't preserve it from source, and banner adds it after any existing one)
TEMP_FILE=$(mktemp)
echo '#!/usr/bin/env node' > "$TEMP_FILE"
# Remove any existing shebang from the bundled file
sed '1{/^#!\/usr\/bin\/env node$/d}' "$NPM_DIR/dist/cli.js" >> "$TEMP_FILE"
mv "$TEMP_FILE" "$NPM_DIR/dist/cli.js"
chmod +x "$NPM_DIR/dist/cli.js"

# Step 4: Copy runtime DLLs
echo -e "${YELLOW}Copying runtime DLLs...${NC}"
mkdir -p "$NPM_DIR/runtime"

# Tsonic.Runtime (for dotnet mode)
RUNTIME_SRC="$ROOT_DIR/../runtime/artifacts/bin/Tsonic.Runtime/Release/net10.0"
if [[ -f "$RUNTIME_SRC/Tsonic.Runtime.dll" ]]; then
  cp "$RUNTIME_SRC/Tsonic.Runtime.dll" "$NPM_DIR/runtime/"
  echo -e "${GREEN}  Copied Tsonic.Runtime.dll${NC}"
else
  echo -e "${RED}  Warning: Tsonic.Runtime.dll not found at $RUNTIME_SRC${NC}"
  echo -e "${YELLOW}  Build it with: cd ../runtime && dotnet build -c Release${NC}"
fi

# Tsonic.JSRuntime (for js mode)
JSRUNTIME_SRC="$ROOT_DIR/../js-runtime/artifacts/bin/Tsonic.JSRuntime/Release/net10.0"
if [[ -f "$JSRUNTIME_SRC/Tsonic.JSRuntime.dll" ]]; then
  cp "$JSRUNTIME_SRC/Tsonic.JSRuntime.dll" "$NPM_DIR/runtime/"
  # JSRuntime also needs its dependency on Tsonic.Runtime
  if [[ -f "$JSRUNTIME_SRC/Tsonic.Runtime.dll" ]]; then
    cp "$JSRUNTIME_SRC/Tsonic.Runtime.dll" "$NPM_DIR/runtime/Tsonic.Runtime.JSRuntime.dll"
  fi
  echo -e "${GREEN}  Copied Tsonic.JSRuntime.dll${NC}"
else
  echo -e "${RED}  Warning: Tsonic.JSRuntime.dll not found at $JSRUNTIME_SRC${NC}"
  echo -e "${YELLOW}  Build it with: cd ../js-runtime && dotnet build -c Release${NC}"
fi

# nodejs-clr (for --nodejs flag)
NODEJS_SRC="$ROOT_DIR/../nodejs-clr/artifacts/bin/nodejs/Release/net10.0"
if [[ -f "$NODEJS_SRC/nodejs.dll" ]]; then
  cp "$NODEJS_SRC/nodejs.dll" "$NPM_DIR/runtime/"
  echo -e "${GREEN}  Copied nodejs.dll${NC}"
else
  echo -e "${YELLOW}  Warning: nodejs.dll not found at $NODEJS_SRC (optional)${NC}"
fi

# Step 5: List package contents
echo ""
echo -e "${GREEN}=== Package contents ===${NC}"
find "$NPM_DIR" -type f | while read f; do
  SIZE=$(du -h "$f" | cut -f1)
  echo "  $SIZE  ${f#$NPM_DIR/}"
done

echo ""
echo -e "${GREEN}Build complete!${NC}"
echo "Package directory: $NPM_DIR"
echo ""
echo "To publish:"
echo "  cd $NPM_DIR && npm publish --access public"
