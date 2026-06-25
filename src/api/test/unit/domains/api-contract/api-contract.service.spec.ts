import { RequestMethod, VERSION_NEUTRAL } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA, VERSION_METADATA } from "@nestjs/common/constants";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { mock } from "jest-mock-extended";
import { ApiContractService } from "@domains/api-contract";
import type { RouteSignature } from "@domains/api-contract";

class FullController {
  getOne(): void {}
  postOne(): void {}
  putOne(): void {}
  patchOne(): void {}
  deleteOne(): void {}
  headOne(): void {}
  optionsOne(): void {}
  allOne(): void {}
  plain(): void {}
}

class NeutralController {
  health(): void {}
}

class ArrayBaseController {
  list(): void {}
}

class NoBaseController {
  ping(): void {}
}

type Controllers = ReturnType<DiscoveryService["getControllers"]>;

function buildService(): ApiContractService {
  const discovery = mock<DiscoveryService>();
  const scanner = mock<MetadataScanner>();
  const reflector = mock<Reflector>();

  discovery.getControllers.mockReturnValue([
    { instance: new FullController(), metatype: FullController },
    { instance: new NeutralController(), metatype: NeutralController },
    { instance: new ArrayBaseController(), metatype: ArrayBaseController },
    { instance: new NoBaseController(), metatype: NoBaseController },
    { instance: undefined, metatype: undefined },
  ] as unknown as Controllers);

  scanner.getAllMethodNames.mockImplementation((prototype: object | null) => {
    if (prototype === FullController.prototype) {
      return [
        "getOne",
        "postOne",
        "putOne",
        "patchOne",
        "deleteOne",
        "headOne",
        "optionsOne",
        "allOne",
        "plain",
      ];
    }
    if (prototype === NeutralController.prototype) return ["health"];
    if (prototype === ArrayBaseController.prototype) return ["list"];
    return ["ping"];
  });

  const proto = FullController.prototype;
  const verbByHandler = new Map<unknown, number>([
    [proto.getOne, RequestMethod.GET],
    [proto.postOne, RequestMethod.POST],
    [proto.putOne, RequestMethod.PUT],
    [proto.patchOne, RequestMethod.PATCH],
    [proto.deleteOne, RequestMethod.DELETE],
    [proto.headOne, RequestMethod.HEAD],
    [proto.optionsOne, RequestMethod.OPTIONS],
    [proto.allOne, RequestMethod.ALL],
  ]);
  const pathByHandler = new Map<unknown, string>([
    [proto.getOne, ":id"],
    [proto.postOne, ""],
    [proto.putOne, ":id"],
    [proto.patchOne, ":id"],
    [proto.deleteOne, ":id"],
    [proto.headOne, ""],
    [proto.optionsOne, ""],
    [proto.allOne, "wild"],
  ]);

  (reflector.get as jest.Mock).mockImplementation((key: unknown, target: unknown) => {
    if (key === VERSION_METADATA) {
      if (target === NeutralController) return VERSION_NEUTRAL;
      if (
        target === FullController ||
        target === ArrayBaseController ||
        target === NoBaseController
      ) {
        return "1";
      }
      return undefined;
    }
    if (target === FullController) return "items";
    if (target === NeutralController) return "health";
    if (target === ArrayBaseController) return ["a", "b"];
    if (target === NoBaseController) return undefined;
    if (target === ArrayBaseController.prototype.list) {
      return key === PATH_METADATA ? ["x", "y"] : RequestMethod.GET;
    }
    if (target === NeutralController.prototype.health) {
      return key === PATH_METADATA ? "" : RequestMethod.GET;
    }
    if (target === NoBaseController.prototype.ping) {
      return key === PATH_METADATA ? "ping" : RequestMethod.GET;
    }
    if (key === PATH_METADATA) return pathByHandler.get(target);
    if (key === METHOD_METADATA) return verbByHandler.get(target);
    return undefined;
  });

  return new ApiContractService(discovery, scanner, reflector);
}

describe("ApiContractService", () => {
  describe("extractRouteSurface", () => {
    const routes = buildService().extractRouteSurface();
    const keys = routes.map((route) => `${route.method} ${route.path}`).sort();

    it("maps versioned routes under /api/v1", () => {
      expect(keys).toEqual(
        expect.arrayContaining([
          "DELETE /api/v1/items/{}",
          "GET /api/v1/items/{}",
          "HEAD /api/v1/items",
          "OPTIONS /api/v1/items",
          "PATCH /api/v1/items/{}",
          "POST /api/v1/items",
          "PUT /api/v1/items/{}",
        ]),
      );
    });

    it("maps VERSION_NEUTRAL routes under /api without version", () => {
      expect(keys).toContain("GET /api/health");
    });

    it("skips unsupported verbs (ALL)", () => {
      expect(keys.some((key) => key.includes("wild"))).toBe(false);
    });

    it("expands array controller base paths and array method paths", () => {
      expect(keys).toEqual(
        expect.arrayContaining([
          "GET /api/v1/a/x",
          "GET /api/v1/a/y",
          "GET /api/v1/b/x",
          "GET /api/v1/b/y",
        ]),
      );
    });

    it("captures ordered path parameter names", () => {
      const getOne = routes.find(
        (route) => route.method === "GET" && route.path === "/api/v1/items/{}",
      );
      expect(getOne?.params).toEqual(["id"]);
    });

    it("skips non-function prototype entries", () => {
      class OddController {
        get ok(): string {
          return "nope";
        }
      }
      const discovery = mock<DiscoveryService>();
      const scanner = mock<MetadataScanner>();
      const reflector = mock<Reflector>();
      discovery.getControllers.mockReturnValue([
        { instance: new OddController(), metatype: OddController },
      ] as unknown as Controllers);
      scanner.getAllMethodNames.mockReturnValue(["ok"]);
      (reflector.get as jest.Mock).mockImplementation((key: unknown, target: unknown) => {
        if (target === OddController) return "odd";
        if (target === OddController.prototype.ok) {
          return key === PATH_METADATA ? "" : RequestMethod.GET;
        }
        return undefined;
      });
      const svc = new ApiContractService(discovery, scanner, reflector);
      expect(svc.extractRouteSurface()).toEqual([]);
    });

    it("defaults missing controller version to v1", () => {
      class DefaultVersionController {
        ping(): void {}
      }
      const discovery = mock<DiscoveryService>();
      const scanner = mock<MetadataScanner>();
      const reflector = mock<Reflector>();
      discovery.getControllers.mockReturnValue([
        { instance: new DefaultVersionController(), metatype: DefaultVersionController },
      ] as unknown as Controllers);
      scanner.getAllMethodNames.mockReturnValue(["ping"]);
      (reflector.get as jest.Mock).mockImplementation((key: unknown, target: unknown) => {
        if (target === DefaultVersionController) {
          if (key === PATH_METADATA) return "status";
          if (key === VERSION_METADATA) return undefined;
        }
        if (target === DefaultVersionController.prototype.ping) {
          return key === PATH_METADATA ? "" : RequestMethod.GET;
        }
        return undefined;
      });
      const svc = new ApiContractService(discovery, scanner, reflector);
      expect(svc.extractRouteSurface()).toEqual([
        expect.objectContaining({ method: "GET", path: "/api/v1/status" }),
      ]);
    });

    it("expands array controller versions", () => {
      class MultiVersionController {
        info(): void {}
      }
      const discovery = mock<DiscoveryService>();
      const scanner = mock<MetadataScanner>();
      const reflector = mock<Reflector>();
      discovery.getControllers.mockReturnValue([
        { instance: new MultiVersionController(), metatype: MultiVersionController },
      ] as unknown as Controllers);
      scanner.getAllMethodNames.mockReturnValue(["info"]);
      (reflector.get as jest.Mock).mockImplementation((key: unknown, target: unknown) => {
        if (target === MultiVersionController) {
          if (key === PATH_METADATA) return "meta";
          if (key === VERSION_METADATA) return ["1", "2"];
        }
        if (target === MultiVersionController.prototype.info) {
          return key === PATH_METADATA ? "" : RequestMethod.GET;
        }
        return undefined;
      });
      const svc = new ApiContractService(discovery, scanner, reflector);
      const paths = svc.extractRouteSurface().map((r) => r.path).sort();
      expect(paths).toEqual(["/api/v1/meta", "/api/v2/meta"]);
    });
  });

  describe("diff", () => {
    const service = buildService();
    const base: RouteSignature = {
      method: "GET",
      path: "/api/v1/tasks/{}",
      params: ["id"],
      rawPath: "/api/v1/tasks/:id",
    };

    it("reports no drift when surfaces match", () => {
      const code: RouteSignature[] = [
        base,
        { method: "POST", path: "/api/v1/tasks", params: [], rawPath: "/api/v1/tasks" },
      ];
      const spec: RouteSignature[] = [
        { method: "POST", path: "/api/v1/tasks", params: [], rawPath: "/api/v1/tasks" },
        {
          method: "GET",
          path: "/api/v1/tasks/{}",
          params: ["id"],
          rawPath: "/api/v1/tasks/{id}",
        },
      ];
      const report = service.diff(code, spec);
      expect(report.hasDrift).toBe(false);
      expect(report.codeFingerprint).toBe(report.specFingerprint);
    });

    it("flags MISSING_IN_SPEC and MISSING_IN_CODE", () => {
      expect(service.diff([base], []).addedRoutes[0].kind).toBe("MISSING_IN_SPEC");
      expect(service.diff([], [base]).removedRoutes[0].kind).toBe("MISSING_IN_CODE");
    });

    it("flags PARAM_MISMATCH", () => {
      const spec: RouteSignature[] = [
        {
          method: "GET",
          path: "/api/v1/tasks/{}",
          params: ["taskId"],
          rawPath: "/api/v1/tasks/{taskId}",
        },
      ];
      expect(service.diff([base], spec).changedRoutes[0].kind).toBe("PARAM_MISMATCH");
    });
  });

  describe("computeFingerprint", () => {
    const service = buildService();

    it("is stable regardless of route ordering", () => {
      const a: RouteSignature[] = [
        { method: "GET", path: "/api/a", params: [], rawPath: "/api/a" },
        { method: "POST", path: "/api/b", params: [], rawPath: "/api/b" },
      ];
      const b: RouteSignature[] = [...a].reverse();
      expect(service.computeFingerprint(a)).toBe(service.computeFingerprint(b));
    });
  });
});
