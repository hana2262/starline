import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopUiDir = path.resolve(__dirname, "..");
const localApiDir = path.resolve(desktopUiDir, "..", "local-api");
const workspaceDir = path.resolve(desktopUiDir, "..", "..");
const resourcesDir = path.resolve(desktopUiDir, "src-tauri", "resources");
const storageMigrationsDir = path.join(workspaceDir, "packages", "storage", "migrations");
const runtimeDir = path.join(resourcesDir, "runtime");
const packagedApiDir = path.join(resourcesDir, "local-api");
const packagedNodeModulesDir = path.join(packagedApiDir, "node_modules");
const packagedApiEntry = path.join(packagedApiDir, "index.cjs");

function resolvePackageDir(packageName) {
  const packageJsonCandidates = [
    path.join(workspaceDir, "node_modules", ...packageName.split("/"), "package.json"),
    path.join(localApiDir, "node_modules", ...packageName.split("/"), "package.json"),
  ];

  for (const candidate of packageJsonCandidates) {
    if (existsSync(candidate)) {
      return path.dirname(realpathSync(candidate));
    }
  }

  const pnpmDir = path.join(workspaceDir, "node_modules", ".pnpm");
  for (const entry of readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageJsonPath = path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      ...packageName.split("/"),
      "package.json",
    );

    if (existsSync(packageJsonPath)) {
      return path.dirname(realpathSync(packageJsonPath));
    }
  }

  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [workspaceDir, localApiDir, desktopUiDir],
  });

  return path.dirname(realpathSync(packageJsonPath));
}

function copyPackageTree(packageName, visited = new Set()) {
  if (visited.has(packageName)) {
    return;
  }

  visited.add(packageName);
  const sourceDir = resolvePackageDir(packageName);
  const targetDir = path.join(packagedNodeModulesDir, packageName);

  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true, force: true, dereference: true });

  const packageJson = JSON.parse(readFileSync(path.join(sourceDir, "package.json"), "utf8"));
  const runtimeDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {}),
  };

  for (const depName of Object.keys(runtimeDeps)) {
    copyPackageTree(depName, visited);
  }
}

function resolveEsbuildExecutable() {
  const executableCandidates = [
    path.join(workspaceDir, "node_modules", "@esbuild", "win32-x64", "esbuild.exe"),
  ];

  for (const candidate of executableCandidates) {
    if (existsSync(candidate)) {
      return realpathSync(candidate);
    }
  }

  const pnpmDir = path.join(workspaceDir, "node_modules", ".pnpm");
  for (const entry of readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("@esbuild+win32-x64@")) {
      continue;
    }

    const executablePath = path.join(
      pnpmDir,
      entry.name,
      "node_modules",
      "@esbuild",
      "win32-x64",
      "esbuild.exe",
    );

    if (existsSync(executablePath)) {
      return realpathSync(executablePath);
    }
  }

  throw new Error("Unable to locate esbuild.exe for packaged runtime preparation");
}

const nodeExecutable = process.execPath;
if (!nodeExecutable.toLowerCase().endsWith("node.exe")) {
  throw new Error(`Expected a Windows node.exe runtime, received ${nodeExecutable}`);
}

const localApiEntry = path.join(localApiDir, "dist", "index.js");
if (!existsSync(localApiEntry)) {
  throw new Error(`Missing local-api build output at ${localApiEntry}`);
}
const esbuildExecutable = resolveEsbuildExecutable();

rmSync(resourcesDir, { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });
mkdirSync(packagedNodeModulesDir, { recursive: true });
cpSync(storageMigrationsDir, path.join(resourcesDir, "migrations"), {
  recursive: true,
  force: true,
  dereference: true,
});

const bundleResult = spawnSync(
  esbuildExecutable,
  [
    localApiEntry,
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--target=node20",
    "--external:better-sqlite3",
    `--outfile=${packagedApiEntry}`,
  ],
  {
    cwd: workspaceDir,
    stdio: "inherit",
  },
);

if (bundleResult.error) {
  throw bundleResult.error;
}

if (bundleResult.status !== 0) {
  throw new Error(`esbuild bundling failed with exit code ${bundleResult.status ?? "unknown"}`);
}

copyPackageTree("better-sqlite3");
copyFileSync(nodeExecutable, path.join(runtimeDir, "node.exe"));

console.log("Prepared packaged runtime resources:");
console.log(`- node: ${path.join(runtimeDir, "node.exe")}`);
console.log(`- local-api: ${packagedApiEntry}`);
