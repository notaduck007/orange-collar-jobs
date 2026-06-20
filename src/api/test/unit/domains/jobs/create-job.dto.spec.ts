import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateJobDto } from "@domains/jobs/dto/create-job.dto";

const VALIDATE_OPTS = { whitelist: true, forbidNonWhitelisted: true };

describe("CreateJobDto", () => {
  const base = {
    title: "Reach Truck Operator — 2nd Shift",
    category: "Forklift Operator",
    location: "Dallas, TX",
    city: "Dallas",
    state: "TX",
    employmentType: "temp_to_hire",
    shift: "weekend",
    description: "Operate reach trucks in a fast-paced warehouse environment.",
    companyId: "a1f76b66-3e18-398f-30cf-501208422ae3",
    companyPackageId: "e0d8eca8-2fc7-3e18-0561-ce061739de2e",
    screeningQuestions: [
      {
        prompt: "Do you have a valid forklift certification?",
        type: "yes_no",
        required: true,
        sortOrder: 1,
      },
    ],
  };

  it("accepts non-v4 UUIDs from OpenAPI-style examples", async () => {
    const dto = plainToInstance(CreateJobDto, base);
    const errors = await validate(dto, VALIDATE_OPTS);
    expect(errors).toHaveLength(0);
  });

  it("accepts screeningQuestions with id (ignored on create)", async () => {
    const dto = plainToInstance(CreateJobDto, {
      ...base,
      screeningQuestions: [
        { ...base.screeningQuestions[0], id: "cbc6a627-0bf3-2fb4-8f61-0023c79d8436" },
      ],
    });
    const errors = await validate(dto, VALIDATE_OPTS);
    expect(errors).toHaveLength(0);
  });
});
