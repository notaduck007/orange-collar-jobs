import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { StorageService } from "../../core/storage/storage.service.js";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

@ApiTags("Uploads")
@ApiBearerAuth()
@Controller({ path: "uploads", version: "1" })
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post("logo")
  @ApiOperation({ summary: "Upload a company logo" })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_BYTES } }))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException("No file provided. Include a `file` field in the form data.");
    }
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException("Logo must be under 2 MB.");
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF.`,
      );
    }

    const result = await this.storage.upload(
      "company-logos",
      file.buffer,
      file.mimetype,
    );
    return { url: result.url, key: result.key };
  }
}
