/**
 * Regenerate the Postman collection and environment under postman/ from the
 * OpenAPI contract and .env.example, keeping the API client artifacts in sync
 * with the published spec.
 *
 * `--check` fails CI when the committed artifacts have drifted from the spec or
 * .env.example.  The collection comparison is done on the request surface
 * (method + normalized path), not raw bytes, because the converter fills
 * example bodies with random faker data; the environment is fully deterministic
 * and compared byte-for-byte.
 *
 * Usage (from src/api/):
 *   bun run postman:generate    # rewrite postman/*.json
 *   bun run postman:check       # fail if committed files are out of date
 *
 * Usage (from repo root):
 *   bun run api:postman:generate
 *   bun run api:postman:check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeRoutePath } from "@domains/api-contract/route-path.util.js";

const SPEC_PATH = resolve(process.cwd(), "../../docs/api/openapi.yaml");
const ENV_EXAMPLE_PATH = resolve(process.cwd(), "../../.env.example");
const COLLECTION_PATH = "postman/warehousejobs.postman_collection.json";
const ENVIRONMENT_PATH = "postman/warehousejobs.postman_environment.json";

const ENVIRONMENT_ID = "wj-local-env";
const COLLECTION_NAME = "WarehouseJobs API v1";
const ENVIRONMENT_NAME = "WarehouseJobs — Local Dev";

interface PostmanCollection {
  info: { _postman_id?: string; name: string; [key: string]: unknown };
  item: unknown[];
  variable?: unknown[];
  [key: string]: unknown;
}

interface ConvertResult {
  readonly result: boolean;
  readonly reason?: string;
  readonly output: ReadonlyArray<{ type: string; data: PostmanCollection }>;
}

interface OpenApiToPostmanConverter {
  convert(
    input: { type: "file"; data: string },
    options: Record<string, unknown>,
    callback: (error: Error | null, result: ConvertResult) => void,
  ): void;
}

import { createRequire } from "node:module";
const converter = createRequire(import.meta.url)("openapi-to-postmanv2") as OpenApiToPostmanConverter;

const SECRET_MATCHERS: readonly RegExp[] = [
  /PASSWORD/,
  /API_KEY/,
  /_KEY$/,
  /_TOKEN$/,
  /SECRET/,
  /REFRESH_TOKEN/,
  /^DATABASE_URL$/,
];

interface EnvironmentValue {
  readonly key: string;
  readonly value: string;
  readonly type: "default" | "secret";
  readonly enabled: true;
}

function isSecret(key: string): boolean {
  return SECRET_MATCHERS.some((matcher) => matcher.test(key));
}

async function convertSpec(absoluteSpecPath: string): Promise<PostmanCollection> {
  return new Promise((resolvePromise, rejectPromise) => {
    converter.convert(
      { type: "file", data: absoluteSpecPath },
      { folderStrategy: "Tags" },
      (error, result) => {
        if (error) {
          rejectPromise(error);
          return;
        }
        if (!result.result || result.output.length === 0) {
          rejectPromise(new Error(result.reason ?? "OpenAPI → Postman conversion failed"));
          return;
        }
        resolvePromise(result.output[0].data);
      },
    );
  });
}

function buildCollectionJson(collection: PostmanCollection): string {
  // Strip _postman_id so generated output is deterministic (the converter assigns a random UUID)
  const { _postman_id, ...infoWithoutId } = collection.info;
  void _postman_id;
  return `${JSON.stringify({ ...collection, info: { ...infoWithoutId, name: COLLECTION_NAME } }, null, 2)}\n`;
}

function buildEnvironmentJson(envExample: string): string {
  const values: EnvironmentValue[] = [
    { key: "baseUrl", value: "http://localhost:3001", type: "default", enabled: true },
  ];

  for (const rawLine of envExample.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    values.push({ key, value, type: isSecret(key) ? "secret" : "default", enabled: true });
  }

  const environment = {
    id: ENVIRONMENT_ID,
    name: ENVIRONMENT_NAME,
    values,
    _postman_variable_scope: "environment",
    _postman_exported_using: "scripts/generate-postman.ts",
  };

  return `${JSON.stringify(environment, null, 2)}\n`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Walk a collection tree and collect `METHOD /normalized/path` for every request. */
function collectRequestSurface(node: unknown, surface: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectRequestSurface(child, surface);
    }
    return;
  }

  const record = asRecord(node);
  if (!record) return;

  if (Array.isArray(record.item)) {
    collectRequestSurface(record.item, surface);
    return;
  }

  const request = asRecord(record.request);
  if (!request) return;

  const method = String(request.method ?? "").toUpperCase();
  const url = asRecord(request.url);
  const segments = Array.isArray(url?.path)
    ? (url?.path as unknown[]).map((part) => String(part))
    : [];
  const { path } = normalizeRoutePath(`/${segments.join("/")}`);
  surface.add(`${method} ${path}`);
}

function requestSurface(collection: PostmanCollection): string[] {
  const surface = new Set<string>();
  collectRequestSurface(collection.item, surface);
  return [...surface].sort();
}

function readJsonCollection(absolutePath: string): PostmanCollection | undefined {
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as PostmanCollection;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const isCheck = process.argv.slice(2).includes("--check");
  const freshCollection = await convertSpec(SPEC_PATH);
  const collectionJson = buildCollectionJson(freshCollection);
  const environmentJson = buildEnvironmentJson(readFileSync(ENV_EXAMPLE_PATH, "utf8"));

  const collectionFile = resolve(process.cwd(), COLLECTION_PATH);
  const environmentFile = resolve(process.cwd(), ENVIRONMENT_PATH);

  if (isCheck) {
    console.log("Checking Postman artifacts against the OpenAPI spec and .env.example:");
    let allInSync = true;

    const committedCollection = readJsonCollection(collectionFile);
    const freshSurface = requestSurface(freshCollection);
    const committedSurface = committedCollection ? requestSurface(committedCollection) : [];

    if (JSON.stringify(freshSurface) === JSON.stringify(committedSurface)) {
      console.log(`  ok: ${COLLECTION_PATH} request surface matches the spec`);
    } else {
      allInSync = false;
      console.error(
        `  stale: ${COLLECTION_PATH} endpoints differ from the spec — run \`bun run postman:generate\``,
      );
      const missingRoutes = freshSurface.filter((route) => !committedSurface.includes(route));
      const extraRoutes = committedSurface.filter((route) => !freshSurface.includes(route));
      missingRoutes.forEach((route) =>
        console.error(`    + ${route} (in spec, missing from collection)`),
      );
      extraRoutes.forEach((route) =>
        console.error(`    - ${route} (in collection, not in spec)`),
      );
    }

    const committedEnvironment = (() => {
      try {
        return readFileSync(environmentFile, "utf8");
      } catch {
        return "";
      }
    })();

    if (committedEnvironment === environmentJson) {
      console.log(`  ok: ${ENVIRONMENT_PATH} matches .env.example`);
    } else {
      allInSync = false;
      console.error(
        `  stale: ${ENVIRONMENT_PATH} is out of date — run \`bun run postman:generate\``,
      );
    }

    if (!allInSync) {
      process.exitCode = 1;
    }
    return;
  }

  writeFileSync(collectionFile, collectionJson);
  writeFileSync(environmentFile, environmentJson);
  console.log(`Regenerated ${COLLECTION_PATH}`);
  console.log(`Regenerated ${ENVIRONMENT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(
    "postman:generate failed:",
    error instanceof Error ? error.stack : error,
  );
  process.exitCode = 1;
});
