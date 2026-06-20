import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { normalizeRoutePath } from "./route-path.util.js";
import type { HttpVerb, RouteSignature } from "./types.js";

const HTTP_METHODS: readonly HttpVerb[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

interface OpenApiOperation {
  readonly "x-implemented"?: boolean;
}

interface OpenApiDocument {
  readonly paths?: Record<string, Record<string, OpenApiOperation | unknown> | null>;
}

export interface OpenApiLoadOptions {
  /** When true, only operations with `x-implemented: true` are included. */
  readonly implementedOnly?: boolean;
}

/**
 * Parses the hand-authored OpenAPI document into normalized `RouteSignature[]`
 * for diffing against the live NestJS route surface.
 */
@Injectable()
export class OpenApiSpecLoader {
  loadFromFile(absolutePath: string, options?: OpenApiLoadOptions): RouteSignature[] {
    return this.parse(readFileSync(absolutePath, "utf8"), options);
  }

  parse(yamlContent: string, options?: OpenApiLoadOptions): RouteSignature[] {
    const implementedOnly = options?.implementedOnly ?? true;
    const document = parse(yamlContent) as OpenApiDocument | null;
    const paths = document?.paths ?? {};
    const routes: RouteSignature[] = [];

    for (const [template, operations] of Object.entries(paths)) {
      if (!operations || typeof operations !== "object") {
        continue;
      }
      const { path, params } = normalizeRoutePath(template);
      for (const method of HTTP_METHODS) {
        const operation = operations[method.toLowerCase()];
        if (!operation || typeof operation !== "object") {
          continue;
        }
        if (implementedOnly && !(operation as OpenApiOperation)["x-implemented"]) {
          continue;
        }
        routes.push({ method, path, params, rawPath: template });
      }
    }

    return routes;
  }
}
