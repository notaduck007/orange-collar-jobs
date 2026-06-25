-- CreateEnum
CREATE TYPE "company_verification_status" AS ENUM ('unverified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "company_status" AS ENUM ('active', 'suspended');

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_owner_id_fkey";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "updated_at" DROP NOT NULL,
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "verified_by" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
