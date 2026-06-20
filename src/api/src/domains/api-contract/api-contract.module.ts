import { Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { ApiContractService } from "./api-contract.service.js";
import { OpenApiSpecLoader } from "./openapi-spec.loader.js";

@Module({
  imports: [DiscoveryModule],
  providers: [ApiContractService, OpenApiSpecLoader],
  exports: [ApiContractService, OpenApiSpecLoader],
})
export class ApiContractModule {}
