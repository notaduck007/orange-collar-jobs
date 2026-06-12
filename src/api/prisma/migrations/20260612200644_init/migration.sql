-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'vendor', 'seeker');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('draft', 'active', 'published', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "JobSourceType" AS ENUM ('direct', 'scraped', 'api', 'syndicated');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'temp', 'temp_to_hire', 'contract', 'seasonal');

-- CreateEnum
CREATE TYPE "JobShift" AS ENUM ('first', 'second', 'third', 'weekend', 'flexible');

-- CreateEnum
CREATE TYPE "PayPeriod" AS ENUM ('hour', 'day', 'week', 'month', 'year');

-- CreateEnum
CREATE TYPE "TemperatureEnv" AS ENUM ('ambient', 'cooler', 'freezer');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('new', 'reviewing', 'shortlisted', 'interview', 'offer', 'hired', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ScreeningQuestionType" AS ENUM ('yes_no', 'single', 'multi', 'number', 'text');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('active', 'paused', 'ended');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'seeker',
    "full_name" TEXT,
    "phone" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "migration_source" TEXT,
    "requires_reset" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_packages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_credits" INTEGER NOT NULL,
    "used_credits" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "purchased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "company_package_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "employment_type" "EmploymentType" NOT NULL,
    "shift" "JobShift" NOT NULL,
    "pay_min" DOUBLE PRECISION,
    "pay_max" DOUBLE PRECISION,
    "pay_period" "PayPeriod",
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "temperature_env" "TemperatureEnv",
    "certifications_required" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lift_requirement_lbs" INTEGER,
    "overtime_available" BOOLEAN NOT NULL DEFAULT false,
    "weekly_pay" BOOLEAN NOT NULL DEFAULT false,
    "quick_hire" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobStatus" NOT NULL DEFAULT 'draft',
    "source_type" "JobSourceType" NOT NULL DEFAULT 'direct',
    "external_id" TEXT,
    "source_url" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featured_until" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "posted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_questions" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "type" "ScreeningQuestionType" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "screening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_slots" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "max_bookings" INTEGER NOT NULL DEFAULT 1,
    "booked_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "interview_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "seeker_id" TEXT,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "guest_zip" TEXT,
    "guest_email" TEXT,
    "resume_url" TEXT,
    "cover_note" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'new',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_answers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "application_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_bookings" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "company_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "status" "BatchStatus" NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "status" "AdStatus" NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "targeting" JSONB NOT NULL DEFAULT '{}',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_token_key" ON "email_verifications"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "companies_owner_id_key" ON "companies"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "company_packages_company_id_idx" ON "company_packages"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs"("slug");

-- CreateIndex
CREATE INDEX "jobs_status_posted_at_idx" ON "jobs"("status", "posted_at");

-- CreateIndex
CREATE INDEX "jobs_source_type_status_idx" ON "jobs"("source_type", "status");

-- CreateIndex
CREATE INDEX "jobs_city_state_status_idx" ON "jobs"("city", "state", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_company_id_external_id_key" ON "jobs"("company_id", "external_id");

-- CreateIndex
CREATE INDEX "screening_questions_job_id_idx" ON "screening_questions"("job_id");

-- CreateIndex
CREATE INDEX "interview_slots_job_id_idx" ON "interview_slots"("job_id");

-- CreateIndex
CREATE INDEX "applications_job_id_idx" ON "applications"("job_id");

-- CreateIndex
CREATE INDEX "applications_seeker_id_idx" ON "applications"("seeker_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_job_id_seeker_id_key" ON "applications"("job_id", "seeker_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_bookings_application_id_key" ON "interview_bookings"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "batch_jobs_status_idx" ON "batch_jobs"("status");

-- CreateIndex
CREATE INDEX "ad_campaigns_status_starts_at_ends_at_idx" ON "ad_campaigns"("status", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_packages" ADD CONSTRAINT "company_packages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_package_id_fkey" FOREIGN KEY ("company_package_id") REFERENCES "company_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_questions" ADD CONSTRAINT "screening_questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_slots" ADD CONSTRAINT "interview_slots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "screening_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_bookings" ADD CONSTRAINT "interview_bookings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_bookings" ADD CONSTRAINT "interview_bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "interview_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
