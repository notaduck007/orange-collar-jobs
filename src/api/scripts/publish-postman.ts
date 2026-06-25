/**
 * Publish the Postman collection and environment to the Postman API.
 *
 * Requires the following environment variables:
 *   POSTMAN_API_KEY      — Personal API key from https://go.postman.co/settings/me/api-keys
 *   POSTMAN_WORKSPACE_ID — Target workspace ID (from the workspace URL in Postman app)
 *   POSTMAN_COLLECTION_ID — (optional) existing collection UID to update; omit to create new
 *   POSTMAN_ENVIRONMENT_ID — (optional) existing environment UID to update; omit to create new
 *
 * Usage (from src/api/):
 *   bun run postman:publish
 *
 * Usage (from repo root):
 *   bun run api:postman:publish
 *
 * The collection and environment files must be up to date before publishing.
 * Run `bun run postman:generate` (or `bun run api:postman:generate`) first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COLLECTION_PATH = resolve(process.cwd(), "postman/warehousejobs.postman_collection.json");
const ENVIRONMENT_PATH = resolve(process.cwd(), "postman/warehousejobs.postman_environment.json");
const POSTMAN_API_BASE = "https://api.getpostman.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function upsertCollection(
  apiKey: string,
  workspaceId: string,
  collectionJson: string,
  existingCollectionId: string | undefined,
): Promise<string> {
  const collection = JSON.parse(collectionJson) as Record<string, unknown>;

  if (existingCollectionId) {
    const response = await fetch(
      `${POSTMAN_API_BASE}/collections/${existingCollectionId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ collection }),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update collection (${response.status}): ${errorText}`);
    }
    const result = (await response.json()) as { collection: { id: string } };
    return result.collection.id;
  }

  const response = await fetch(
    `${POSTMAN_API_BASE}/collections?workspace=${workspaceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ collection }),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create collection (${response.status}): ${errorText}`);
  }
  const result = (await response.json()) as { collection: { id: string } };
  return result.collection.id;
}

async function upsertEnvironment(
  apiKey: string,
  workspaceId: string,
  environmentJson: string,
  existingEnvironmentId: string | undefined,
): Promise<string> {
  const environment = JSON.parse(environmentJson) as Record<string, unknown>;

  if (existingEnvironmentId) {
    const response = await fetch(
      `${POSTMAN_API_BASE}/environments/${existingEnvironmentId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ environment }),
      },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update environment (${response.status}): ${errorText}`);
    }
    const result = (await response.json()) as { environment: { id: string } };
    return result.environment.id;
  }

  const response = await fetch(
    `${POSTMAN_API_BASE}/environments?workspace=${workspaceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({ environment }),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create environment (${response.status}): ${errorText}`);
  }
  const result = (await response.json()) as { environment: { id: string } };
  return result.environment.id;
}

async function main(): Promise<void> {
  const postmanApiKey = requireEnv("POSTMAN_API_KEY");
  const workspaceId = requireEnv("POSTMAN_WORKSPACE_ID");
  const existingCollectionId = process.env["POSTMAN_COLLECTION_ID"];
  const existingEnvironmentId = process.env["POSTMAN_ENVIRONMENT_ID"];

  const collectionJson = readFileSync(COLLECTION_PATH, "utf8");
  const environmentJson = readFileSync(ENVIRONMENT_PATH, "utf8");

  console.log("Publishing Postman collection...");
  const publishedCollectionId = await upsertCollection(
    postmanApiKey,
    workspaceId,
    collectionJson,
    existingCollectionId,
  );
  console.log(`  Collection ID: ${publishedCollectionId}`);

  console.log("Publishing Postman environment...");
  const publishedEnvironmentId = await upsertEnvironment(
    postmanApiKey,
    workspaceId,
    environmentJson,
    existingEnvironmentId,
  );
  console.log(`  Environment ID: ${publishedEnvironmentId}`);

  console.log("Done. Set these in your environment for future updates:");
  console.log(`  POSTMAN_COLLECTION_ID=${publishedCollectionId}`);
  console.log(`  POSTMAN_ENVIRONMENT_ID=${publishedEnvironmentId}`);
}

main().catch((error: unknown) => {
  console.error(
    "postman:publish failed:",
    error instanceof Error ? error.stack : error,
  );
  process.exitCode = 1;
});
