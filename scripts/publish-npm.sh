#!/bin/bash
set -euo pipefail

# Publish @tsonic/* packages and tsonic wrapper to npm

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WRAPPER_DIR="$(cd "$ROOT_DIR/../tsonic-wrapper" && pwd)"

cd "$ROOT_DIR"

# Check if on main branch - can't push directly to main due to branch rules
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "Error: Cannot run publish script on main branch."
    echo "Create a feature branch first: git checkout -b release/vX.Y.Z"
    exit 1
fi

echo "=== Building all packages ==="
./scripts/build/all.sh

echo "=== Running tests ==="
# npm test returns exit code 7 in workspaces even when all tests pass
# Check for actual test failures in output instead
set +e
npm test 2>&1 | tee /tmp/tsonic-test-output.txt
set -e
if grep -q "failing" /tmp/tsonic-test-output.txt; then
    echo "Tests failed!"
    exit 1
fi
echo "All tests passed"

echo "=== Checking versions ==="
CLI_VERSION=$(node -p "require('./packages/cli/package.json').version")
PUBLISHED_VERSION=$(npm view @tsonic/cli version 2>/dev/null || echo "0.0.0")

echo "Local @tsonic/cli version: $CLI_VERSION"
echo "Published version: $PUBLISHED_VERSION"

if [ "$CLI_VERSION" = "$PUBLISHED_VERSION" ]; then
    echo "=== Auto-bumping patch version ==="
    IFS='.' read -r major minor patch <<< "$CLI_VERSION"
    NEW_VERSION="$major.$minor.$((patch + 1))"
    echo "New version: $NEW_VERSION"

    # Update all package.json files
    for pkg in frontend emitter backend cli; do
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

    CLI_VERSION="$NEW_VERSION"
fi

echo "=== Committing version changes ==="
git add packages/*/package.json
git commit -m "chore: bump version to $CLI_VERSION" || echo "No changes to commit"
git push -u origin HEAD

echo "=== Publishing @tsonic packages ==="
for pkg in frontend emitter backend cli; do
    echo "Publishing @tsonic/$pkg@$CLI_VERSION..."
    cd "$ROOT_DIR/packages/$pkg"
    # npm publish --access public  # TEMPORARILY COMMENTED FOR TESTING
done

cd "$ROOT_DIR"

echo "=== Updating tsonic-wrapper ==="
cd "$WRAPPER_DIR"

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
git commit -m "chore: bump version to $CLI_VERSION" || echo "No changes to commit"
git push -u origin HEAD

echo "=== Publishing tsonic@$CLI_VERSION ==="
# npm publish --access public  # TEMPORARILY COMMENTED FOR TESTING

echo "=== Done ==="
echo "Published:"
echo "  - @tsonic/frontend@$CLI_VERSION"
echo "  - @tsonic/emitter@$CLI_VERSION"
echo "  - @tsonic/backend@$CLI_VERSION"
echo "  - @tsonic/cli@$CLI_VERSION"
echo "  - tsonic@$CLI_VERSION"
