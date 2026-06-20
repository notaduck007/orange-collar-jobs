import { JobsController } from "@domains/jobs/jobs.controller";
import type { JobsService } from "@domains/jobs/jobs.service";
import type { AuthUser } from "@core/auth/jwt.strategy";

describe("JobsController", () => {
  const user: AuthUser = { id: "u-1", email: "a@test.com", role: "admin" };
  let service: {
    search: jest.Mock;
    findBySlug: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: JobsController;

  beforeEach(() => {
    service = {
      search: jest.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 } }),
      findBySlug: jest.fn().mockResolvedValue({ id: "j-1", slug: "test-job" }),
      create: jest.fn().mockResolvedValue({ id: "j-1" }),
      update: jest.fn().mockResolvedValue({ id: "j-1", featured: true }),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    controller = new JobsController(service as unknown as JobsService);
  });

  it("search delegates to JobsService.search", async () => {
    const dto = { page: 1, pageSize: 10 };
    await controller.search(dto);
    expect(service.search).toHaveBeenCalledWith(dto);
  });

  it("findBySlug delegates to JobsService.findBySlug", async () => {
    await controller.findBySlug("my-slug");
    expect(service.findBySlug).toHaveBeenCalledWith("my-slug");
  });

  it("create delegates to JobsService.create", async () => {
    const dto = { title: "T", category: "C", location: "L", city: "D", state: "TX", employmentType: "full_time", shift: "first", description: "long enough description for validation rules" } as never;
    await controller.create(dto, user);
    expect(service.create).toHaveBeenCalledWith(dto, user);
  });

  it("update delegates to JobsService.update", async () => {
    const dto = { featured: true };
    await controller.update("job-id", dto, user);
    expect(service.update).toHaveBeenCalledWith("job-id", dto, user);
  });

  it("delete delegates to JobsService.softDelete", async () => {
    await controller.delete("job-id", user);
    expect(service.softDelete).toHaveBeenCalledWith("job-id", user);
  });
});
