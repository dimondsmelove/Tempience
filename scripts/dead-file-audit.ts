import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

type RootKind = "production" | "test";
type FileCategory = "entrypoint" | "referenced" | "test-only" | "unused";

type PackageInfo = {
  name: string;
  root: string;
  manifest: Record<string, unknown>;
};

type ImportReference = {
  from: string;
  specifier: string;
};

type AuditReport = {
  generatedAt: string;
  scope: {
    repository: string;
    included: string[];
    excluded: string[];
  };
  counts: {
    inventory: number;
    executable: number;
    productionReachable: number;
    testOnlyReachable: number;
    unused: number;
    testOnly: number;
    documentation: number;
    assets: number;
  };
  entryPoints: string[];
  unused: string[];
  testOnly: string[];
  unresolvedRoots: string[];
  unresolvedImports: ImportReference[];
  dynamicImports: ImportReference[];
  documentation: string[];
  assets: string[];
};

const repositoryRoot = resolve(process.cwd());
const frontendRoot = join(repositoryRoot, "FE Svelte");
const sourceExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".scss",
  ".svelte",
  ".ts",
  ".tsx",
]);
const assetExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".png",
  ".svg",
  ".ttf",
  ".wasm",
  ".webp",
  ".woff",
  ".woff2",
]);
const excludedPrefixes = [
  ".git/",
  "data/",
  "uploads/",
  "exports/",
  "node_modules/",
  "FE Svelte/.svelte-kit/",
  "FE Svelte/build/",
  "FE Svelte/build-public/",
  "FE Svelte/node_modules/",
];

const toRepoPath = (value: string): string =>
  relative(repositoryRoot, value).split(sep).join("/");

const fromRepoPath = (value: string): string => resolve(repositoryRoot, value);

const isExcluded = (repoPath: string): boolean =>
  excludedPrefixes.some((prefix) => {
    if (prefix.endsWith("/*/node_modules/")) {
      return (
        repoPath.startsWith(prefix.replace("*", "")) ||
        repoPath.includes("/node_modules/")
      );
    }
    return repoPath.startsWith(prefix);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readGitFiles = (): string[] =>
  execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file.length > 0)
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !isExcluded(file))
    .filter((file) => existsSync(fromRepoPath(file)));

const allFiles = new Set(readGitFiles());

const isDocumentation = (repoPath: string): boolean =>
  extname(repoPath).toLowerCase() === ".md" || repoPath.endsWith(".mdx");

const isAsset = (repoPath: string): boolean =>
  assetExtensions.has(extname(repoPath).toLowerCase());

const isExecutable = (repoPath: string): boolean => {
  const fileName = repoPath.split("/").at(-1) ?? "";
  if (fileName === "package-lock.json") return false;
  if (sourceExtensions.has(extname(repoPath).toLowerCase())) return true;
  return (
    fileName.startsWith("tsconfig") ||
    fileName.endsWith(".config") ||
    fileName.includes(".config.") ||
    fileName === ".eslintrc" ||
    fileName === ".prettierrc"
  );
};

const executableFiles = [...allFiles].filter(isExecutable).sort();
const documentationFiles = [...allFiles].filter(isDocumentation).sort();
const assetFiles = [...allFiles].filter(isAsset).sort();
const executableSet = new Set(executableFiles);

const packageInfos = new Map<string, PackageInfo>();
for (const packagePath of [...allFiles].filter(
  (file) => file.endsWith("/package.json") || file === "package.json",
)) {
  try {
    const manifest = JSON.parse(
      readFileSync(fromRepoPath(packagePath), "utf8"),
    ) as unknown;
    if (isRecord(manifest) && typeof manifest.name === "string") {
      packageInfos.set(manifest.name, {
        name: manifest.name,
        root: dirname(fromRepoPath(packagePath)),
        manifest,
      });
    }
  } catch {
    // Invalid manifests are reported by the existing project checks.
  }
}

const rootReasons = new Map<string, Set<string>>();
const testRoots = new Set<string>();
const unresolvedRoots = new Set<string>();

const addRoot = (repoPath: string, reason: string, kind: RootKind): void => {
  const normalized = repoPath.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!executableSet.has(normalized)) {
    unresolvedRoots.add(normalized);
    return;
  }
  const reasons = rootReasons.get(normalized) ?? new Set<string>();
  reasons.add(reason);
  rootReasons.set(normalized, reasons);
  if (kind === "test") testRoots.add(normalized);
};

const addRootAbsolute = (
  absolutePath: string,
  reason: string,
  kind: RootKind,
): void => {
  if (
    absolutePath.startsWith(repositoryRoot + sep) ||
    absolutePath === repositoryRoot
  ) {
    addRoot(toRepoPath(absolutePath), reason, kind);
  }
};

const packageExportTarget = (
  value: unknown,
  subpath: string,
): string | null => {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;

  const requestedKey = subpath ? `./${subpath}` : ".";
  if (requestedKey in value) {
    const requestedTarget = packageExportTarget(value[requestedKey], "");
    if (requestedTarget) return requestedTarget;
  }

  for (const condition of ["import", "svelte", "default", "types", "browser"]) {
    const target = packageExportTarget(value[condition], "");
    if (target) return target;
  }
  return null;
};

const addManifestRoots = (packagePath: string): void => {
  const manifest = packageInfos.get(
    (() => {
      try {
        const value = JSON.parse(
          readFileSync(fromRepoPath(packagePath), "utf8"),
        ) as unknown;
        return isRecord(value) && typeof value.name === "string"
          ? value.name
          : "";
      } catch {
        return "";
      }
    })(),
  );
  addRoot(packagePath, "package manifest", "production");
  if (!manifest) return;

  const exportsValue = manifest.manifest.exports;
  if (typeof exportsValue === "string") {
    addRootAbsolute(
      resolve(manifest.root, exportsValue),
      "package export",
      "production",
    );
  } else if (isRecord(exportsValue)) {
    for (const target of Object.values(exportsValue)) {
      if (typeof target === "string") {
        addRootAbsolute(
          resolve(manifest.root, target),
          "package export",
          "production",
        );
      }
    }
  }

  const scripts = manifest.manifest.scripts;
  if (!isRecord(scripts)) return;
  const pathPattern =
    /(?:^|[\s"'`])((?:\.\/)?(?:scripts|src|drizzle)\/[^\s"'`;&|]+?\.(?:cjs|js|mjs|py|sql|ts|tsx))/g;
  for (const command of Object.values(scripts)) {
    if (typeof command !== "string") continue;
    for (const match of command.matchAll(pathPattern)) {
      addRootAbsolute(
        resolve(manifest.root, match[1]),
        `package script: ${command}`,
        "production",
      );
    }
  }
};

for (const packagePath of [...allFiles].filter(
  (file) => file.endsWith("/package.json") || file === "package.json",
)) {
  addManifestRoots(packagePath);
}

for (const file of executableFiles) {
  const fileName = file.split("/").at(-1) ?? "";
  if (
    fileName.startsWith("tsconfig") ||
    fileName.endsWith(".config") ||
    fileName.includes(".config.") ||
    fileName === ".eslintrc" ||
    fileName === ".prettierrc"
  ) {
    addRoot(file, "project configuration", "production");
  }

  if (
    file === "FE Svelte/src/app.html" ||
    file === "FE Svelte/src/service-worker.ts"
  ) {
    addRoot(file, "SvelteKit framework entry", "production");
  }
  if (file.startsWith("FE Svelte/src/app.") || file.endsWith(".d.ts")) {
    addRoot(file, "framework or type declaration entry", "production");
  }
  if (file.startsWith("API/drizzle/meta/")) {
    addRoot(file, "Drizzle migration metadata", "production");
  }
  if (
    file.startsWith("FE Svelte/src/routes/") ||
    file.startsWith("FE Svelte/src/routes-public/")
  ) {
    if (/\/(?:\+[^/]+|proxy\+page)\.[^/]+$/.test(file)) {
      addRoot(file, "SvelteKit route entry", "production");
    }
  }
  if (
    file.startsWith("FE Svelte/src/hooks.") ||
    file.startsWith("FE Svelte/src/params/")
  ) {
    addRoot(file, "SvelteKit framework entry", "production");
  }
  if (file === "API/src/index.ts") {
    addRoot(file, "API server entry", "production");
  }
}

const importAliases: Array<{ alias: string; directory: string }> = [
  { alias: "$lib", directory: join(frontendRoot, "src/lib") },
];

const extensionAlternatives = (absolutePath: string): string[] => {
  const extension = extname(absolutePath);
  if (!extension) return [];
  if (extension === ".js" || extension === ".jsx") {
    return [
      absolutePath.slice(0, -extension.length) + ".ts",
      absolutePath.slice(0, -extension.length) + ".tsx",
      absolutePath.slice(0, -extension.length) + ".svelte",
    ];
  }
  return [];
};

/**
 * The extensions Vite tries for an import without one, in its order; `.svelte` is never
 * tried that way, so `./DateInput` from `DateInput.svelte` is `DateInput.ts`, not the
 * component itself. The remaining source extensions follow, for files nothing else names.
 */
const extensionOrder = [
  ".mjs",
  ".js",
  ".mts",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ...[...sourceExtensions].filter(
    (extension) =>
      ![".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"].includes(
        extension,
      ),
  ),
];

const resolveFile = (absoluteBase: string): string | null => {
  const candidates = [
    absoluteBase,
    ...extensionAlternatives(absoluteBase),
    ...extensionOrder.map((extension) => `${absoluteBase}${extension}`),
    ...extensionOrder.map((extension) =>
      join(absoluteBase, `index${extension}`),
    ),
  ];
  for (const candidate of candidates) {
    if (!candidate.startsWith(repositoryRoot + sep)) continue;
    const repoPath = toRepoPath(candidate);
    if (allFiles.has(repoPath)) return repoPath;
  }
  return null;
};

for (const packageInfo of packageInfos.values()) {
  if (!packageInfo.root.startsWith(join(repositoryRoot, "packages") + sep))
    continue;
  const sourceEntry = resolveFile(join(packageInfo.root, "src/index"));
  if (sourceEntry) addRoot(sourceEntry, "package source entry", "production");
}

const resolveSpecifier = (
  requester: string,
  specifier: string,
): string | null => {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
  if (
    cleanSpecifier.startsWith("node:") ||
    cleanSpecifier.startsWith("$app/") ||
    cleanSpecifier.startsWith("$env/") ||
    cleanSpecifier === "$service-worker" ||
    cleanSpecifier.endsWith("/$types") ||
    cleanSpecifier.startsWith("virtual:")
  ) {
    return null;
  }

  for (const alias of importAliases) {
    if (
      cleanSpecifier === alias.alias ||
      cleanSpecifier.startsWith(`${alias.alias}/`)
    ) {
      const suffix = cleanSpecifier
        .slice(alias.alias.length)
        .replace(/^\/+/, "");
      return resolveFile(join(alias.directory, suffix));
    }
  }

  if (cleanSpecifier.startsWith("/")) {
    // A dev server serves a source module by its path (`import('/src/lib/…')` from a browser
    // check or a measurement); otherwise an absolute path names a static asset.
    return (
      (cleanSpecifier.startsWith("/src/")
        ? resolveFile(join(frontendRoot, cleanSpecifier))
        : null) ?? resolveFile(join(frontendRoot, "static", cleanSpecifier))
    );
  }

  const requesterAbsolute = fromRepoPath(requester);
  if (cleanSpecifier.startsWith(".")) {
    return resolveFile(resolve(dirname(requesterAbsolute), cleanSpecifier));
  }

  const packageParts = cleanSpecifier.startsWith("@")
    ? cleanSpecifier.split("/").slice(0, 2)
    : cleanSpecifier.split("/").slice(0, 1);
  const packageName = packageParts.join("/");
  const packageInfo = packageInfos.get(packageName);
  if (!packageInfo) return null;

  const subpath = cleanSpecifier.slice(packageName.length).replace(/^\/+/, "");
  const manifest = packageInfo.manifest;
  const target =
    packageExportTarget(manifest.exports, subpath) ??
    (subpath
      ? `./${subpath}`
      : (manifest.module ?? manifest.main ?? "./src/index.ts"));
  if (typeof target !== "string") return null;
  return resolveFile(resolve(packageInfo.root, target));
};

const stripComments = (content: string): string =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[\s;{}])\s*\/\/.*$/gm, "$1");

const collectReferences = (
  file: string,
): {
  specifiers: string[];
  dynamic: string[];
} => {
  const content = stripComments(readFileSync(fromRepoPath(file), "utf8"));
  const specifiers = new Set<string>();
  // The token generator reads this source through fs rather than an import.
  if (file === "FE Svelte/scripts/generate-theme-tokens.mjs") {
    specifiers.add("../src/theme/design-tokens.json");
  }
  if (file === "FE Svelte/scripts/prepare-data-packs.mjs") {
    const catalogPath = "FE Svelte/src/lib/scenarios/DataPacks/catalog.json";
    specifiers.add("../src/lib/scenarios/DataPacks/catalog.json");
    if (existsSync(fromRepoPath(catalogPath))) {
      const catalog: unknown = JSON.parse(
        readFileSync(fromRepoPath(catalogPath), "utf8"),
      );
      if (Array.isArray(catalog)) {
        for (const pack of catalog) {
          if (!isRecord(pack) || typeof pack.source !== "string") continue;
          const source = resolve(
            dirname(fromRepoPath(catalogPath)),
            pack.source,
          );
          specifiers.add(
            "./" +
              relative(dirname(fromRepoPath(file)), source)
                .split(sep)
                .join("/"),
          );
        }
      }
    }
  }
  const addMatches = (pattern: RegExp): void => {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1]);
    }
  };

  addMatches(/\b(?:import|export)\b[\s\S]{0,500}?\bfrom\s*["']([^"']+)["']/g);
  addMatches(/\bimport\s*["']([^"']+)["']/g);
  addMatches(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g);
  addMatches(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g);
  addMatches(/@import\s*["']([^"']+)["']/g);
  addMatches(/\burl\(\s*["']?([^"')]+)["']?\s*\)/g);

  const dynamic: string[] = [];
  for (const match of content.matchAll(/\bimport\s*\(\s*([^)]*)\)/g)) {
    const expression = match[1].trim();
    if (expression && !/^["'`]/.test(expression)) dynamic.push(expression);
  }
  return { specifiers: [...specifiers], dynamic };
};

const edges = new Map<string, Set<string>>();
const unresolvedImports: ImportReference[] = [];
const dynamicImports: ImportReference[] = [];

for (const file of executableFiles) {
  const { specifiers, dynamic } = collectReferences(file);
  const targets = new Set<string>();
  for (const specifier of specifiers) {
    const target = resolveSpecifier(file, specifier);
    const internal =
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      specifier.startsWith("$lib") ||
      specifier.startsWith("@chronograph/");
    if (target) targets.add(target);
    else if (internal) unresolvedImports.push({ from: file, specifier });
  }
  edges.set(file, targets);
  for (const expression of dynamic)
    dynamicImports.push({ from: file, specifier: expression });
}

const traverse = (roots: Set<string>): Set<string> => {
  const visited = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const target of edges.get(current) ?? []) {
      if (!visited.has(target)) queue.push(target);
    }
  }
  return visited;
};

for (const file of executableFiles) {
  if (
    /\.(?:test|spec)\.[^/]+$/.test(file) ||
    file.startsWith("FE Svelte/e2e/")
  ) {
    testRoots.add(file);
  }
}

const productionRoots = new Set(
  [...rootReasons.entries()]
    .filter(([, reasons]) => reasons.size > 0)
    .map(([file]) => file)
    .filter((file) => !testRoots.has(file)),
);
const productionReachable = traverse(productionRoots);
const testReachable = traverse(testRoots);

const categoryOf = (file: string): FileCategory => {
  if (rootReasons.has(file) && productionRoots.has(file)) return "entrypoint";
  if (productionReachable.has(file)) return "referenced";
  if (testReachable.has(file)) return "test-only";
  return "unused";
};

const unused = executableFiles.filter((file) => categoryOf(file) === "unused");
const testOnly = executableFiles.filter(
  (file) => categoryOf(file) === "test-only",
);
const entryPoints = [...productionRoots].sort();

const report: AuditReport = {
  generatedAt: new Date().toISOString(),
  scope: {
    repository: repositoryRoot,
    included: [
      "FE Svelte",
      "API",
      "packages",
      "scripts",
      "deploy",
      "root configuration",
    ],
    excluded: [
      "node_modules",
      "FE Svelte/build",
      "FE Svelte/build-public",
      "FE Svelte/.svelte-kit",
      "data",
      "uploads",
      "exports",
    ],
  },
  counts: {
    inventory: allFiles.size,
    executable: executableFiles.length,
    productionReachable: [...productionReachable].filter((file) =>
      executableSet.has(file),
    ).length,
    testOnlyReachable: testOnly.length,
    unused: unused.length,
    testOnly: testOnly.length,
    documentation: documentationFiles.length,
    assets: assetFiles.length,
  },
  entryPoints,
  unused,
  testOnly,
  unresolvedRoots: [...unresolvedRoots].sort(),
  unresolvedImports: unresolvedImports.sort((a, b) =>
    `${a.from}:${a.specifier}`.localeCompare(`${b.from}:${b.specifier}`),
  ),
  dynamicImports: dynamicImports.sort((a, b) =>
    `${a.from}:${a.specifier}`.localeCompare(`${b.from}:${b.specifier}`),
  ),
  documentation: documentationFiles,
  assets: assetFiles,
};

const markdownList = (files: string[]): string =>
  files.length > 0 ? files.map((file) => `- \`${file}\``).join("\n") : "- Нет";
const markdown = `# Dead-file audit

Сгенерировано: ${report.generatedAt}

## Результат

| Метрика | Значение |
| --- | ---: |
| Файлов в inventory | ${report.counts.inventory} |
| Исполняемых и конфигурационных файлов | ${report.counts.executable} |
| Достижимых от production entry points | ${report.counts.productionReachable} |
| Только тестовых | ${report.counts.testOnlyReachable} |
| Потенциально неиспользуемых | ${report.counts.unused} |
| Документации | ${report.counts.documentation} |
| Assets | ${report.counts.assets} |

Статус \`unused\` означает только отсутствие пути от зарегистрированного entry point. Это кандидат на ручную проверку, а не безопасная команда удаления.

## Потенциально неиспользуемые

${markdownList(report.unused)}

## Только тестовые

${markdownList(report.testOnly)}

## Неразрешённые внутренние импорты

${report.unresolvedImports.length > 0 ? report.unresolvedImports.map(({ from, specifier }) => `- \`${from}\` → \`${specifier}\``).join("\n") : "- Нет"}

## Неразрешённые entry points

${report.unresolvedRoots.length > 0 ? report.unresolvedRoots.map((file) => `- \`${file}\``).join("\n") : "- Нет"}

## Динамические импорты, требующие ручной проверки

${report.dynamicImports.length > 0 ? report.dynamicImports.map(({ from, specifier }) => `- \`${from}\` → \`${specifier}\``).join("\n") : "- Нет"}

## Entry points

${markdownList(report.entryPoints)}
`;

const outputArgument = process.argv.find((argument) =>
  argument.startsWith("--output-dir="),
);
const outputDirectory = resolve(
  repositoryRoot,
  outputArgument ? outputArgument.slice("--output-dir=".length) : "reports",
);
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  join(outputDirectory, "dead-files-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
writeFileSync(join(outputDirectory, "dead-files-audit.md"), markdown);

console.log(`Dead-file audit: ${outputDirectory}`);
console.log(
  `unused=${report.counts.unused} test-only=${report.counts.testOnly} unresolved=${report.unresolvedImports.length} dynamic=${report.dynamicImports.length}`,
);
if (unresolvedRoots.size > 0) {
  console.log(`unresolved-roots=${[...unresolvedRoots].sort().join(",")}`);
}
