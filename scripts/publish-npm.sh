#!/bin/bash
set -euo pipefail

# Publish @tsonic/* packages and tsonic wrapper to npm
#
# Usage: ./scripts/publish-npm.sh [--ignore-branches-ahead]
#
# Options:
#   --ignore-branches-ahead  Skip check for local branches ahead of main

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WRAPPER_DIR="$(cd "$ROOT_DIR/../tsonic-wrapper" && pwd)"
RUNTIME_DIR="$(cd "$ROOT_DIR/../runtime" && pwd)"
JSRUNTIME_DIR="$(cd "$ROOT_DIR/../js-runtime" && pwd)"
NODEJS_CLR_DIR="$(cd "$ROOT_DIR/../nodejs-clr" && pwd)"

# Parse arguments
IGNORE_BRANCHES_AHEAD=false
for arg in "$@"; do
    case $arg in
        --ignore-branches-ahead)
            IGNORE_BRANCHES_AHEAD=true
            ;;
    esac
done

cd "$ROOT_DIR"

# Helper: Compare semver versions
# Returns: 1 if v1 > v2, 0 if v1 == v2, -1 if v1 < v2
compare_versions() {
    local v1="$1" v2="$2"
    if [ "$v1" = "$v2" ]; then echo 0; return; fi

    IFS='.' read -r v1_major v1_minor v1_patch <<< "$v1"
    IFS='.' read -r v2_major v2_minor v2_patch <<< "$v2"

    if [ "$v1_major" -gt "$v2_major" ]; then echo 1; return; fi
    if [ "$v1_major" -lt "$v2_major" ]; then echo -1; return; fi
    if [ "$v1_minor" -gt "$v2_minor" ]; then echo 1; return; fi
    if [ "$v1_minor" -lt "$v2_minor" ]; then echo -1; return; fi
    if [ "$v1_patch" -gt "$v2_patch" ]; then echo 1; return; fi
    if [ "$v1_patch" -lt "$v2_patch" ]; then echo -1; return; fi
    echo 0
}

# ============================================================
# PRE-FLIGHT CHECKS (before any action)
# ============================================================

echo "=== Pre-flight checks ==="

# 1. Must be on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Error: Must be on main branch to publish."
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# 2. Must be synced with origin (no bypass)
git fetch origin main
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/main)

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo "Error: Local main is not synced with origin/main."
    echo "Please run: git pull"
    exit 1
fi

# 3. Check for local branches ahead of main (bypass with --ignore-branches-ahead)
echo "=== Checking for branches ahead of main ==="
BRANCHES_AHEAD=()

for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
    if [ "$branch" = "main" ]; then
        continue
    fi

    # Get ahead/behind counts relative to main
    COUNTS=$(git rev-list --left-right --count main..."$branch" 2>/dev/null || echo "0 0")
    BEHIND=$(echo "$COUNTS" | awk '{print $1}')
    AHEAD=$(echo "$COUNTS" | awk '{print $2}')

    # Only flag branches that are X ahead and 0 behind (unmerged work)
    if [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -eq 0 ]; then
        BRANCHES_AHEAD+=("$branch ($AHEAD ahead)")
    fi
done

if [ ${#BRANCHES_AHEAD[@]} -gt 0 ]; then
    echo "Warning: The following branches are ahead of main:"
    for branch_info in "${BRANCHES_AHEAD[@]}"; do
        echo "  - $branch_info"
    done

    if [ "$IGNORE_BRANCHES_AHEAD" = true ]; then
        echo "Continuing anyway (--ignore-branches-ahead specified)"
    else
        echo ""
        echo "Error: Unmerged branches detected. Merge them first or use --ignore-branches-ahead"
        exit 1
    fi
else
    echo "  No branches ahead of main ✓"
fi

# 4. No uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Uncommitted changes detected."
    echo "Please commit or discard changes first."
    exit 1
fi

# 5. Check runtime dependencies are on main
echo "=== Checking runtime dependencies ==="
RUNTIME_PROJECTS=(
    "$RUNTIME_DIR:runtime"
    "$JSRUNTIME_DIR:js-runtime"
    "$NODEJS_CLR_DIR:nodejs-clr"
)

for entry in "${RUNTIME_PROJECTS[@]}"; do
    DIR="${entry%%:*}"
    NAME="${entry##*:}"

    BRANCH=$(cd "$DIR" && git branch --show-current)
    if [ "$BRANCH" != "main" ]; then
        echo "Error: $NAME is not on main branch (currently on: $BRANCH)"
        exit 1
    fi
    echo "  $NAME: on main ✓"
done

# 6. Build runtime projects and copy DLLs
echo "=== Building runtime projects ==="

echo "  Building runtime..."
cd "$RUNTIME_DIR"
dotnet build -c Release --verbosity quiet

echo "  Building js-runtime..."
cd "$JSRUNTIME_DIR"
dotnet build -c Release --verbosity quiet

echo "  Building nodejs-clr..."
cd "$NODEJS_CLR_DIR"
dotnet build -c Release --verbosity quiet

cd "$ROOT_DIR"

echo "=== Copying runtime DLLs ==="
cp "$RUNTIME_DIR/artifacts/bin/Tsonic.Runtime/Release/net10.0/Tsonic.Runtime.dll" "$ROOT_DIR/packages/cli/runtime/"
cp "$JSRUNTIME_DIR/artifacts/bin/Tsonic.JSRuntime/Release/net10.0/Tsonic.JSRuntime.dll" "$ROOT_DIR/packages/cli/runtime/"
cp "$NODEJS_CLR_DIR/artifacts/bin/nodejs/Release/net10.0/nodejs.dll" "$ROOT_DIR/packages/cli/runtime/"
echo "  Copied all runtime DLLs ✓"

# 7. Ensure all packages have the same version (including wrapper)
echo "=== Checking package version consistency ==="
PACKAGES=(frontend emitter backend cli)
FIRST_VERSION=$(node -p "require('./packages/cli/package.json').version")

for pkg in "${PACKAGES[@]}"; do
    PKG_VERSION=$(node -p "require('./packages/$pkg/package.json').version")
    if [ "$PKG_VERSION" != "$FIRST_VERSION" ]; then
        echo "Error: Package version mismatch!"
        echo "  @tsonic/cli: $FIRST_VERSION"
        echo "  @tsonic/$pkg: $PKG_VERSION"
        echo "All packages must have the same version."
        exit 1
    fi
done

# Check wrapper too
WRAPPER_VERSION=$(node -p "require('$WRAPPER_DIR/package.json').version")
if [ "$WRAPPER_VERSION" != "$FIRST_VERSION" ]; then
    echo "Error: Package version mismatch!"
    echo "  @tsonic/cli: $FIRST_VERSION"
    echo "  tsonic (wrapper): $WRAPPER_VERSION"
    echo "All packages must have the same version."
    exit 1
fi

echo "  All packages at version $FIRST_VERSION ✓"

# 8. Check all package versions against npm
echo "=== Checking versions against npm ==="
NEEDS_BUMP=()
ALL_GREATER=true

for pkg in "${PACKAGES[@]}"; do
    LOCAL_VER=$(node -p "require('./packages/$pkg/package.json').version")
    NPM_VER=$(npm view @tsonic/$pkg version 2>/dev/null || echo "0.0.0")
    CMP=$(compare_versions "$LOCAL_VER" "$NPM_VER")

    echo "  @tsonic/$pkg: local=$LOCAL_VER npm=$NPM_VER"

    if [ "$CMP" = "-1" ]; then
        echo "Error: Local version ($LOCAL_VER) is LESS than npm version ($NPM_VER) for @tsonic/$pkg"
        echo "This should never happen. Please investigate."
        exit 1
    elif [ "$CMP" = "0" ]; then
        NEEDS_BUMP+=("$pkg")
        ALL_GREATER=false
    fi
done

# Also check wrapper
WRAPPER_LOCAL_VER=$(node -p "require('$WRAPPER_DIR/package.json').version")
WRAPPER_NPM_VER=$(npm view tsonic version 2>/dev/null || echo "0.0.0")
WRAPPER_CMP=$(compare_versions "$WRAPPER_LOCAL_VER" "$WRAPPER_NPM_VER")

echo "  tsonic (wrapper): local=$WRAPPER_LOCAL_VER npm=$WRAPPER_NPM_VER"

if [ "$WRAPPER_CMP" = "-1" ]; then
    echo "Error: Local wrapper version ($WRAPPER_LOCAL_VER) is LESS than npm version ($WRAPPER_NPM_VER)"
    echo "This should never happen. Please investigate."
    exit 1
elif [ "$WRAPPER_CMP" = "0" ]; then
    NEEDS_BUMP+=("wrapper")
    ALL_GREATER=false
fi

echo ""

# ============================================================
# DETERMINE ACTION
# ============================================================

if [ "$ALL_GREATER" = true ]; then
    echo "=== All local versions are greater than npm - publishing directly ==="
    NEED_BRANCH=false
else
    echo "=== Some packages need version bump: ${NEEDS_BUMP[*]} ==="
    NEED_BRANCH=true

    # Calculate new version (based on cli package)
    CLI_VERSION=$(node -p "require('./packages/cli/package.json').version")
    IFS='.' read -r major minor patch <<< "$CLI_VERSION"
    NEW_VERSION="$major.$minor.$((patch + 1))"

    RELEASE_BRANCH="release/v$NEW_VERSION"
    echo "=== Creating release branch: $RELEASE_BRANCH ==="
    git checkout -b "$RELEASE_BRANCH"
fi

# ============================================================
# BUILD AND TEST
# ============================================================

echo "=== Building all packages ==="
./scripts/build/all.sh --no-format

echo "=== Running ALL tests (unit, golden, E2E) ==="
./test/scripts/run-all.sh
echo "All tests passed"

# ============================================================
# VERSION BUMP (if needed)
# ============================================================

if [ "$NEED_BRANCH" = true ]; then
    echo "=== Bumping versions to $NEW_VERSION ==="

    # Update all package.json files
    for pkg in "${PACKAGES[@]}"; do
        node -e "
            const fs = require('fs');
            const path = './packages/$pkg/package.json';
            const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
            pkg.version = '$NEW_VERSION';
            fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
        "
    done

    # Update internal dependencies in cli/package.json
    node -e "
        const fs = require('fs');
        const path = './packages/cli/package.json';
        const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
        pkg.dependencies['@tsonic/frontend'] = '$NEW_VERSION';
        pkg.dependencies['@tsonic/emitter'] = '$NEW_VERSION';
        pkg.dependencies['@tsonic/backend'] = '$NEW_VERSION';
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    "

    echo "=== Committing version changes ==="
    git add packages/*/package.json
    git commit -m "chore: bump version to $NEW_VERSION"
    git push -u origin HEAD

    CLI_VERSION="$NEW_VERSION"
else
    CLI_VERSION=$(node -p "require('./packages/cli/package.json').version")
fi

# ============================================================
# PUBLISH @tsonic/* PACKAGES
# ============================================================

echo "=== Publishing @tsonic packages ==="
for pkg in "${PACKAGES[@]}"; do
    PKG_VERSION=$(node -p "require('$ROOT_DIR/packages/$pkg/package.json').version")
    echo "Publishing @tsonic/$pkg@$PKG_VERSION..."
    cd "$ROOT_DIR/packages/$pkg"
    npm publish --access public
    cd "$ROOT_DIR"
done

# ============================================================
# UPDATE AND PUBLISH WRAPPER
# ============================================================

echo "=== Updating tsonic-wrapper ==="
cd "$WRAPPER_DIR"

if [ "$NEED_BRANCH" = true ]; then
    # Update wrapper package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$CLI_VERSION';
        pkg.dependencies['@tsonic/cli'] = '$CLI_VERSION';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    echo "=== Committing wrapper changes ==="
    git add package.json
    git commit -m "chore: bump version to $CLI_VERSION"
    git push -u origin HEAD
fi

echo "=== Publishing tsonic@$CLI_VERSION ==="
npm publish --access public

# ============================================================
# DONE
# ============================================================

cd "$ROOT_DIR"

echo ""
echo "=== Done ==="
echo "Published:"
for pkg in "${PACKAGES[@]}"; do
    PKG_VERSION=$(node -p "require('$ROOT_DIR/packages/$pkg/package.json').version")
    echo "  - @tsonic/$pkg@$PKG_VERSION"
done
echo "  - tsonic@$CLI_VERSION"

if [ "$NEED_BRANCH" = true ]; then
    echo ""
    echo "Note: Changes were made on branch '$RELEASE_BRANCH'"
    echo "Please create a PR to merge back to main."
fi
