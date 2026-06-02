// Shared definitions for warehouse-specific job attributes.

export const TEMP_ENVS = [
  { value: "ambient", label: "Ambient", short: "Ambient" },
  { value: "cooler", label: "Cooler (35–55°F)", short: "Cooler" },
  { value: "freezer", label: "Freezer (≤0°F)", short: "Freezer" },
] as const;

export type TempEnv = (typeof TEMP_ENVS)[number]["value"];

export const CERTIFICATIONS = [
  { value: "forklift", label: "Forklift" },
  { value: "reach", label: "Reach truck" },
  { value: "cherry_picker", label: "Cherry picker" },
  { value: "pallet_jack", label: "Electric pallet jack" },
] as const;

export type Certification = (typeof CERTIFICATIONS)[number]["value"];

export const CERT_LABEL: Record<string, string> = Object.fromEntries(
  CERTIFICATIONS.map((c) => [c.value, c.label]),
);

export const TEMP_LABEL: Record<string, string> = Object.fromEntries(
  TEMP_ENVS.map((t) => [t.value, t.short]),
);
