#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <target-repo-root>" >&2
  exit 1
fi

TARGET_ROOT="$(cd "$1" && pwd -P)"
TSONICLANG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"

declare -a package_paths=()
declare -A package_map=()

maybe_add_package() {
  local package_name="$1"
  local candidate="$2"
  if [[ -d "$candidate" ]]; then
    package_paths+=("$candidate")
    package_map["$package_name"]="$candidate"
  fi
}

maybe_add_package "@tsonic/core" "$TSONICLANG_ROOT/core/versions/10"
maybe_add_package "@tsonic/dotnet" "$TSONICLANG_ROOT/dotnet/versions/10"
maybe_add_package "@tsonic/globals" "$TSONICLANG_ROOT/globals/versions/10"
maybe_add_package "@tsonic/js" "$TSONICLANG_ROOT/js/versions/10"
maybe_add_package "@tsonic/nodejs" "$TSONICLANG_ROOT/nodejs/versions/10"
maybe_add_package "@tsonic/efcore" "$TSONICLANG_ROOT/efcore"
maybe_add_package "@tsonic/efcore-sqlite" "$TSONICLANG_ROOT/efcore-sqlite"
maybe_add_package "@tsonic/efcore-npgsql" "$TSONICLANG_ROOT/efcore-npgsql"
maybe_add_package "@tsonic/efcore-sqlserver" "$TSONICLANG_ROOT/efcore-sqlserver"
maybe_add_package "@tsonic/aspnetcore" "$TSONICLANG_ROOT/aspnetcore"
maybe_add_package "@tsonic/microsoft-extensions" "$TSONICLANG_ROOT/microsoft-extensions"

if [[ ${#package_paths[@]} -eq 0 ]]; then
  echo "FAIL: no local sibling packages were found under $TSONICLANG_ROOT" >&2
  exit 1
fi

declare -a install_roots=()
if [[ -f "$TARGET_ROOT/package.json" ]]; then
  install_roots+=("$TARGET_ROOT")
else
  while IFS= read -r package_file; do
    package_dir="$(dirname "$package_file")"
    if node -e '
      const fs = require("fs");
      const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
      const relevant = new Set(["@tsonic/js", "@tsonic/nodejs", "@tsonic/dotnet", "@tsonic/efcore"]);
      for (const section of sections) {
        const record = pkg[section];
        if (!record || typeof record !== "object") continue;
        for (const name of Object.keys(record)) {
          if (relevant.has(name)) {
            process.exit(0);
          }
        }
      }
      process.exit(1);
    ' "$package_file"
    then
      install_roots+=("$package_dir")
    fi
  done < <(find "$TARGET_ROOT" -mindepth 2 -maxdepth 2 -name package.json -print | sort)
fi

if [[ ${#install_roots[@]} -eq 0 ]]; then
  echo "FAIL: no package.json roots found under $TARGET_ROOT" >&2
  exit 1
fi

echo "=== bindings-semantics local package wave ==="
echo "target: $TARGET_ROOT"
printf 'install roots:\n'
printf '  %s\n' "${install_roots[@]}"
printf 'packages:\n'
printf '  %s\n' "${package_paths[@]}"

declare -A visited_roots=()
collect_dependency_names() {
  local package_root="$1"
  local mode="$2"

  node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const mode = process.argv[2];
    const sections =
      mode === "consumer"
        ? ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
        : ["dependencies", "optionalDependencies"];
    const names = new Set();
    for (const section of sections) {
      const record = pkg[section];
      if (!record || typeof record !== "object") continue;
      for (const name of Object.keys(record)) names.add(name);
    }
    const values = [...names].sort();
    if (values.length > 0) {
      process.stdout.write(values.join("\n") + "\n");
    }
  ' "$package_root/package.json" "$mode"
}

copy_package_into_root() {
  local package_name="$1"
  local install_root="$2"
  local source_root="${package_map["$package_name"]}"
  local package_dir_name="${package_name#@tsonic/}"
  local dest_root="$install_root/node_modules/@tsonic/$package_dir_name"

  mkdir -p "$install_root/node_modules/@tsonic"
  rm -rf "$dest_root"
  cp -a "$source_root" "$dest_root"
  rm -rf "$dest_root/node_modules" "$dest_root/package-lock.json"
}

expand_package_closure() {
  local install_root="$1"
  local mode="$2"
  shift 2

  declare -A selected_packages=()
  declare -a queue=()

  if [[ "$install_root" == "$TARGET_ROOT" && "$TARGET_ROOT" == "$TSONICLANG_ROOT/tsonic" ]]; then
    for package_name in "${!package_map[@]}"; do
      selected_packages["$package_name"]=1
      queue+=("$package_name")
    done
  else
    while IFS= read -r package_name; do
      if [[ -n "$package_name" && -n "${package_map["$package_name"]:-}" && -z "${selected_packages["$package_name"]:-}" ]]; then
        selected_packages["$package_name"]=1
        queue+=("$package_name")
      fi
    done < <(collect_dependency_names "$install_root" "$mode")
  fi

  while [[ ${#queue[@]} -gt 0 ]]; do
    local current_package="${queue[0]}"
    queue=("${queue[@]:1}")
    local package_root="${package_map["$current_package"]}"

    while IFS= read -r dependency_name; do
      if [[ -n "$dependency_name" && -n "${package_map["$dependency_name"]:-}" && -z "${selected_packages["$dependency_name"]:-}" ]]; then
        selected_packages["$dependency_name"]=1
        queue+=("$dependency_name")
      fi
    done < <(collect_dependency_names "$package_root" "package")
  done

  printf '%s\n' "${!selected_packages[@]}" | sort
}

install_into_root() {
  local install_root="$(cd "$1" && pwd -P)"
  local mode="$2"

  if [[ -n "${visited_roots["$install_root"]:-}" ]]; then
    return 0
  fi
  visited_roots["$install_root"]=1

  declare -a install_names=()
  while IFS= read -r package_name; do
    if [[ -n "$package_name" ]]; then
      install_names+=("$package_name")
    fi
  done < <(expand_package_closure "$install_root" "$mode")

  if [[ ${#install_names[@]} -eq 0 ]]; then
    echo "skip: no local sibling packages referenced by $install_root/package.json ($mode)"
    return 0
  fi

  printf 'installing into %s (%s):\n' "$install_root" "$mode"
  printf '  %s\n' "${install_names[@]}"

  mkdir -p "$install_root/node_modules/@tsonic"
  for package_name in "${install_names[@]}"; do
    copy_package_into_root "$package_name" "$install_root"
  done

  for package_name in "${install_names[@]}"; do
    install_into_root "${package_map["$package_name"]}" "package"
  done
}

for install_root in "${install_roots[@]}"; do
  install_into_root "$install_root" "consumer"
done
