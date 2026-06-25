export type CompanyVerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type CompanyStatusType = "active" | "suspended";

export interface AdminCompanyRecord {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  hqCity: string | null;
  hqState: string | null;
  location: string | null;
  status: CompanyStatusType;
  verified: boolean;
  verificationStatus: CompanyVerificationStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationNote: string | null;
  createdAt: string;
}

export interface AdminUpdateCompanyBody {
  status?: CompanyStatusType;
  verified?: boolean;
  verificationStatus?: CompanyVerificationStatus;
  verificationNote?: string | null;
}

export interface CompanyProfile {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  hqCity: string | null;
  hqState: string | null;
  location: string | null;
  verified: boolean;
  createdAt: string;
}

export interface UpsertCompanyBody {
  name: string;
  industry: string;
  hqCity: string;
  hqState: string;
  website?: string | null;
  description?: string | null;
  logoUrl?: string | null;
}
