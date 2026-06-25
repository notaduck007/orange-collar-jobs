import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { UploadsController } from "./uploads.controller.js";

@Module({
  imports: [
    // memoryStorage is the Multer default when no disk destination is set
    MulterModule.register({}),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
