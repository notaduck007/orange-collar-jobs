# E2E Testing Standard

## Rules

- Every endpoint in `docs/api/openapi.yaml` must have at least one E2E test
- Use Supertest against the bootstrapped NestJS application
- Test: status code (per OpenAPI spec), response shape, and RBAC (wrong role → 403)
- Create real JWT tokens via `POST /api/v1/auth/login` at suite setup
- Truncate tables in `afterAll`

## Template

```typescript
import * as request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import {
  truncateAllTables,
  seedActiveJob,
  loginAsSeeker,
  loginAsVendor,
  loginAsAdmin,
} from "../helpers";

describe("Applications E2E — POST /api/v1/jobs/:jobId/apply", () => {
  let app: INestApplication;
  let seekerToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    seekerToken = await loginAsSeeker(app);
    vendorToken = await loginAsVendor(app);
  });

  afterAll(async () => {
    await truncateAllTables(app.get(PrismaService));
    await app.close();
  });

  it("201 — authenticated seeker applies successfully", async () => {
    const { jobId } = await seedActiveJob(app);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({ coverNote: "I have reach truck cert, 3 years experience" });

    expect(res.status).toBe(201);
    expect(res.body.applicationId).toBeDefined();
  });

  it("201 — unauthenticated apply with name + phone + zip", async () => {
    const { jobId } = await seedActiveJob(app);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .send({ name: "Marcus Johnson", phone: "+12145550192", zip: "75201" });

    expect(res.status).toBe(201);
  });

  it("409 — duplicate application returns conflict", async () => {
    const { jobId } = await seedActiveJob(app);

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({});

    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/apply`)
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("404 — non-existent job", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/jobs/00000000-0000-0000-0000-000000000000/apply")
      .set("Authorization", `Bearer ${seekerToken}`)
      .send({});

    expect(res.status).toBe(404);
  });
});
```

## RBAC Coverage Requirement

For every protected endpoint, write a test that:

1. Uses the correct role → expected success status
2. Uses an incorrect role → expects 403
3. Uses no token → expects 401
