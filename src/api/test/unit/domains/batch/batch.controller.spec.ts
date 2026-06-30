import { BatchController } from "@domains/batch/batch.controller";
import type { BatchRequestDto } from "@domains/batch/dto/ingest-batch.dto";
import type { BatchStatusResponse, BatchSubmitResponse } from "@domains/batch/types";
import { BATCH_JOB_ITEM, BATCH_JOB_ITEM_EXT, buildBatchItems } from "../../../helpers/batch.fixtures";
import { ValidationError } from "@core/error/errors";
import type { Response } from "express";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const batchServiceMock = {
  ingest: jest.fn(),
  getStatus: jest.fn(),
};

const syncStatus: BatchStatusResponse = {
  batchId: "batch-uuid-ctrl",
  status: "completed",
  total: 1,
  created: 1,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
  startedAt: null,
  completedAt: new Date().toISOString(),
};

const asyncResponse: BatchSubmitResponse = {
  batchId: "batch-uuid-async",
  status: "queued",
  count: 150,
  message: "Batch queued",
};

function makeReq(apiKeyAuth?: { apiKeyId: string | null; companyId: string | null }) {
  return { apiKeyAuth: apiKeyAuth ?? null, body: {} } as never;
}

const resMock: Partial<Response> = { status: jest.fn().mockReturnThis() };

let ctrl: BatchController;

beforeEach(() => {
  jest.clearAllMocks();
  ctrl = new BatchController(batchServiceMock as never);
});

// ── POST /api/v1/jobs/batch (JSON) ────────────────────────────────────────────

describe("BatchController.ingest (JSON)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns sync BatchStatusResponse (≤100 items)", async () => {
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: true, data: syncStatus });

    const dto: BatchRequestDto = { jobs: [BATCH_JOB_ITEM], source: "test-feed" };
    const result = await ctrl.ingest(undefined, dto, makeReq(), resMock as Response);

    expect(result).toBe(syncStatus);
    expect(batchServiceMock.ingest).toHaveBeenCalledWith(dto.jobs, dto.source, null, undefined);
    expect(resMock.status).not.toHaveBeenCalled();
  });

  it("sets response status 202 for async batch (>100 items)", async () => {
    const items = buildBatchItems(150);
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: false, data: asyncResponse });

    const dto: BatchRequestDto = { jobs: items };
    const result = await ctrl.ingest(undefined, dto, makeReq(), resMock as Response);

    expect(result).toBe(asyncResponse);
    expect(resMock.status).toHaveBeenCalledWith(202);
  });

  it("passes companyId from apiKeyAuth to service", async () => {
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: true, data: syncStatus });
    const dto: BatchRequestDto = { jobs: [BATCH_JOB_ITEM_EXT] };

    await ctrl.ingest(undefined, dto, makeReq({ apiKeyId: "k-1", companyId: "co-abc" }), resMock as Response);

    expect(batchServiceMock.ingest).toHaveBeenCalledWith(expect.any(Array), undefined, "co-abc", undefined);
  });

  it("throws ValidationError on invalid JSON body", async () => {
    await expect(
      ctrl.ingest(undefined, { jobs: [] }, makeReq(), resMock as Response),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── POST /api/v1/jobs/batch (CSV multipart) ───────────────────────────────────

describe("BatchController.ingest (CSV)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws ValidationError when CSV file field is missing on multipart path", () => {
    expect(() => ctrl.parseCsvFile(undefined as never)).toThrow(ValidationError);
  });

  it("parses CSV buffer and calls service", async () => {
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: true, data: syncStatus });

    const csvContent = [
      "title,location,city,state,employmentType,shift,description,sourceType,payMin,payMax",
      "Forklift Op,Dallas TX,Dallas,TX,full_time,first,Operate forklifts safely at all times.,scraped,18.5,not-a-number",
    ].join("\n");

    const file = {
      buffer: Buffer.from(csvContent),
      originalname: "jobs.csv",
      mimetype: "text/csv",
    } as Express.Multer.File;

    const result = await ctrl.ingest(file, {}, makeReq(), resMock as Response);
    expect(result).toBe(syncStatus);
    expect(batchServiceMock.ingest).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: "Forklift Op", sourceType: "scraped", payMin: 18.5 }),
      ]),
      undefined,
      null,
      undefined,
    );
  });

  it("passes source from req.body to service", async () => {
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: true, data: syncStatus });

    const csvContent = [
      "title,location,employmentType,shift,description,sourceType",
      "Picker Packer,Austin TX,part_time,second,Pack orders for delivery every day.,scraped",
    ].join("\n");

    const file = { buffer: Buffer.from(csvContent), originalname: "jobs.csv" } as Express.Multer.File;
    const req = { apiKeyAuth: null, body: { source: "my-feed" } } as never;

    await ctrl.ingest(file, {}, req, resMock as Response);

    expect(batchServiceMock.ingest).toHaveBeenCalledWith(expect.any(Array), "my-feed", null, undefined);
  });

  it("sets response status 202 for async CSV batch", async () => {
    batchServiceMock.ingest.mockResolvedValueOnce({ sync: false, data: asyncResponse });

    const csvContent = [
      "title,location,employmentType,shift,description,sourceType",
      "Picker,Austin TX,part_time,second,Pack and ship orders for next day delivery.,scraped",
    ].join("\n");

    const file = { buffer: Buffer.from(csvContent), originalname: "jobs.csv" } as Express.Multer.File;
    await ctrl.ingest(file, {}, makeReq(), resMock as Response);
    expect(resMock.status).toHaveBeenCalledWith(202);
  });

  it("throws ValidationError on empty CSV (no data rows)", async () => {
    const file = { buffer: Buffer.from("title,location\n"), originalname: "empty.csv" } as Express.Multer.File;
    await expect(ctrl.ingest(file, {}, makeReq(), resMock as Response)).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError on malformed CSV", async () => {
    const file = { buffer: Buffer.from('"unclosed'), originalname: "bad.csv" } as Express.Multer.File;
    await expect(ctrl.ingest(file, {}, makeReq(), resMock as Response)).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── GET /api/v1/jobs/batch/:batchId/status ───────────────────────────────────

describe("BatchController.getStatus", () => {
  it("calls service.getStatus with batchId and returns result", async () => {
    batchServiceMock.getStatus.mockResolvedValueOnce(syncStatus);

    const result = await ctrl.getStatus("batch-uuid-ctrl");

    expect(result).toBe(syncStatus);
    expect(batchServiceMock.getStatus).toHaveBeenCalledWith("batch-uuid-ctrl");
  });
});
