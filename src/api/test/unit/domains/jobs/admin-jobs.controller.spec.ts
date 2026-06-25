import { AdminJobsController } from "@domains/jobs/admin-jobs.controller";
import type { JobsService } from "@domains/jobs/jobs.service";
import type { AuthUser } from "@core/auth/jwt.strategy";

describe("AdminJobsController", () => {
  const user: AuthUser = { id: "u-1", email: "admin@test.com", role: "admin" };
  let service: {
    adminSearch: jest.Mock;
    featureJob: jest.Mock;
  };
  let controller: AdminJobsController;

  beforeEach(() => {
    service = {
      adminSearch: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
      featureJob: jest.fn().mockResolvedValue({ id: "j-1", featured: true }),
    };
    controller = new AdminJobsController(service as unknown as JobsService);
  });

  it("adminSearch delegates to JobsService.adminSearch", async () => {
    const dto = { page: 1, pageSize: 10, status: "draft" as const };
    await controller.adminSearch(dto);
    expect(service.adminSearch).toHaveBeenCalledWith(dto);
  });

  it("featureJob delegates to JobsService.featureJob", async () => {
    const dto = { featured: true };
    await controller.featureJob("job-id", dto, user);
    expect(service.featureJob).toHaveBeenCalledWith("job-id", dto, user);
  });
});
