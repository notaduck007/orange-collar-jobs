import { Module } from "@nestjs/common";
import { BatchController } from "./batch.controller.js";
import { BatchService } from "./batch.service.js";
import { BatchWorker } from "./batch.worker.js";
import { BatchAuthGuard } from "./batch-auth.guard.js";

@Module({
  controllers: [BatchController],
  providers: [BatchService, BatchWorker, BatchAuthGuard],
  exports: [BatchService],
})
export class BatchModule {}
