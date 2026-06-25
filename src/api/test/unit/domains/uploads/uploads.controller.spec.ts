import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UploadsController } from "../../../../src/domains/uploads/uploads.controller.js";
import { StorageService } from "../../../../src/core/storage/storage.service.js";

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "logo.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
    size: 1024,
    stream: null as unknown as NodeJS.ReadableStream,
    destination: "",
    filename: "",
    path: "",
    ...overrides,
  };
}

describe("UploadsController", () => {
  let controller: UploadsController;
  let storageMock: jest.Mocked<Pick<StorageService, "upload">>;

  beforeEach(async () => {
    storageMock = {
      upload: jest.fn().mockResolvedValue({
        key: "uuid-123",
        bucket: "company-logos",
        url: "http://localhost:9000/company-logos/uuid-123",
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        { provide: StorageService, useValue: storageMock },
      ],
    }).compile();

    controller = module.get(UploadsController);
  });

  describe("uploadLogo", () => {
    it("returns url and key on success", async () => {
      const result = await controller.uploadLogo(makeFile());
      expect(result).toEqual({
        url: "http://localhost:9000/company-logos/uuid-123",
        key: "uuid-123",
      });
      expect(storageMock.upload).toHaveBeenCalledWith(
        "company-logos",
        expect.any(Buffer),
        "image/jpeg",
      );
    });

    it("throws BadRequestException when no file provided", async () => {
      await expect(controller.uploadLogo(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws PayloadTooLargeException for files over 2 MB", async () => {
      const bigFile = makeFile({ size: 3 * 1024 * 1024 });
      await expect(controller.uploadLogo(bigFile)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it("throws BadRequestException for unsupported mime type", async () => {
      const svgFile = makeFile({ mimetype: "image/svg+xml" });
      await expect(controller.uploadLogo(svgFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("accepts PNG files", async () => {
      const pngFile = makeFile({ mimetype: "image/png" });
      const result = await controller.uploadLogo(pngFile);
      expect(result.url).toBeDefined();
    });

    it("accepts WebP files", async () => {
      const webpFile = makeFile({ mimetype: "image/webp" });
      const result = await controller.uploadLogo(webpFile);
      expect(result.url).toBeDefined();
    });
  });
});
