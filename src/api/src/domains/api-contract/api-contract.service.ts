import { createHash } from "node:crypto";
import { Injectable, RequestMethod, VERSION_NEUTRAL, type Type } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA, VERSION_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { joinRoutePath, normalizeRoutePath } from "./route-path.util.js";
import type { ContractDriftReport, HttpVerb, RouteDrift, RouteSignature } from "./types.js";

/** Matches `configureApp()` in `app.factory.ts`. */
const GLOBAL_API_PREFIX = "api";
const DEFAULT_API_VERSION = "1";

/**
 * Detects drift between the implemented NestJS route surface and the
 * hand-authored OpenAPI contract.
 */
@Injectable()
export class ApiContractService {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  /** Enumerate every HTTP operation declared by registered controllers. */
  extractRouteSurface(): RouteSignature[] {
    const routes: RouteSignature[] = [];

    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) {
        continue;
      }

      const controllerPaths = this.resolveControllerBasePaths(metatype as Type<unknown>);
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const methodName of this.metadataScanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[methodName];
        if (typeof handler !== "function") {
          continue;
        }

        const methodPath = this.reflector.get<string | string[] | undefined>(
          PATH_METADATA,
          handler,
        );
        const requestMethod = this.reflector.get<number | undefined>(METHOD_METADATA, handler);
        if (methodPath === undefined || requestMethod === undefined) {
          continue;
        }

        const verb = this.toHttpVerb(requestMethod);
        if (!verb) {
          continue;
        }

        for (const base of controllerPaths) {
          for (const segment of this.toPathArray(methodPath)) {
            const rawPath = joinRoutePath(base, segment);
            const { path, params } = normalizeRoutePath(rawPath);
            routes.push({ method: verb, path, params, rawPath });
          }
        }
      }
    }

    return this.dedupe(routes);
  }

  /** Compare the code route surface against the spec route surface. */
  diff(code: readonly RouteSignature[], spec: readonly RouteSignature[]): ContractDriftReport {
    const codeMap = this.toMap(code);
    const specMap = this.toMap(spec);

    const addedRoutes: RouteDrift[] = [];
    const removedRoutes: RouteDrift[] = [];
    const changedRoutes: RouteDrift[] = [];

    for (const [key, signature] of codeMap) {
      if (!specMap.has(key)) {
        addedRoutes.push({
          kind: "MISSING_IN_SPEC",
          method: signature.method,
          path: signature.path,
          detail: `${signature.method} ${signature.rawPath} is implemented in code but missing from docs/api/openapi.yaml (or lacks x-implemented: true)`,
        });
      }
    }

    for (const [key, specSignature] of specMap) {
      const codeSignature = codeMap.get(key);
      if (!codeSignature) {
        removedRoutes.push({
          kind: "MISSING_IN_CODE",
          method: specSignature.method,
          path: specSignature.path,
          detail: `${specSignature.method} ${specSignature.rawPath} is documented in docs/api/openapi.yaml but not implemented in code`,
        });
        continue;
      }
      if (!this.paramsEqual(codeSignature.params, specSignature.params)) {
        changedRoutes.push({
          kind: "PARAM_MISMATCH",
          method: specSignature.method,
          path: specSignature.path,
          detail: `${specSignature.method} ${specSignature.path} path parameter names differ — code [${codeSignature.params.join(", ")}] vs spec [${specSignature.params.join(", ")}]`,
        });
      }
    }

    return {
      hasDrift: addedRoutes.length > 0 || removedRoutes.length > 0 || changedRoutes.length > 0,
      addedRoutes,
      removedRoutes,
      changedRoutes,
      codeFingerprint: this.computeFingerprint(code),
      specFingerprint: this.computeFingerprint(spec),
    };
  }

  computeFingerprint(surface: readonly RouteSignature[]): string {
    const lines = surface
      .map((signature) => `${signature.method} ${signature.path} (${signature.params.join(",")})`)
      .sort();
    return createHash("sha256").update(lines.join("\n")).digest("hex");
  }

  private resolveControllerBasePaths(metatype: Type<unknown>): string[] {
    const basePaths = this.toPathArray(
      this.reflector.get<string | string[] | undefined>(PATH_METADATA, metatype),
    );
    const version = this.reflector.get(VERSION_METADATA, metatype) as
      | string
      | string[]
      | typeof VERSION_NEUTRAL
      | undefined;

    const resolved: string[] = [];
    for (const base of basePaths) {
      if (version === VERSION_NEUTRAL) {
        resolved.push(joinRoutePath(GLOBAL_API_PREFIX, base));
        continue;
      }

      const versions =
        version === undefined || version === null
          ? [DEFAULT_API_VERSION]
          : Array.isArray(version)
            ? version.map(String)
            : [String(version)];

      for (const ver of versions) {
        resolved.push(joinRoutePath(GLOBAL_API_PREFIX, `v${ver}`, base));
      }
    }

    return resolved;
  }

  private toMap(surface: readonly RouteSignature[]): Map<string, RouteSignature> {
    const map = new Map<string, RouteSignature>();
    for (const signature of surface) {
      map.set(`${signature.method} ${signature.path}`, signature);
    }
    return map;
  }

  private paramsEqual(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  private dedupe(routes: readonly RouteSignature[]): RouteSignature[] {
    const map = new Map<string, RouteSignature>();
    for (const route of routes) {
      map.set(`${route.method} ${route.path}`, route);
    }
    return [...map.values()];
  }

  private toPathArray(value: string | string[] | undefined): string[] {
    if (value === undefined) {
      return [""];
    }
    return Array.isArray(value) ? value.map((item) => String(item)) : [String(value)];
  }

  private toHttpVerb(requestMethod: number): HttpVerb | undefined {
    switch (requestMethod) {
      case RequestMethod.GET:
        return "GET";
      case RequestMethod.POST:
        return "POST";
      case RequestMethod.PUT:
        return "PUT";
      case RequestMethod.PATCH:
        return "PATCH";
      case RequestMethod.DELETE:
        return "DELETE";
      case RequestMethod.HEAD:
        return "HEAD";
      case RequestMethod.OPTIONS:
        return "OPTIONS";
      default:
        return undefined;
    }
  }
}
