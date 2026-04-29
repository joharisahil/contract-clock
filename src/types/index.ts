export type ContractType =
  | "software_subscription"
  | "vendor_service"
  | "office_lease"
  | "equipment_lease"
  | "insurance"
  | "freelancer_retainer"
  | "professional_membership"
  | "other";

export type ContractStatus =
  | "active"
  | "expiring_soon"
  | "action_required"
  | "expired"
  | "renewed"
  | "cancelled";

export type PlanType = "free" | "starter" | "pro" | "business" | "agency";

export type UserRole = "admin" | "member" | "viewer";

export type ReminderChannel = "email" | "slack";

export type ExtractionConfidenceLevel = "high" | "medium" | "low";

export interface ContractAIExtractionData {
  vendor_name: string | null;
  annual_cost: number | null;
  currency: "GBP" | "USD" | "CAD" | null;
  start_date: string | null;
  renewal_date: string | null;
  notice_period_days: number | null;
  auto_renewal: boolean | null;
  contract_type: ContractType | null;
  confidence: {
    vendor_name: ExtractionConfidenceLevel;
    annual_cost: ExtractionConfidenceLevel;
    currency: ExtractionConfidenceLevel;
    start_date: ExtractionConfidenceLevel;
    renewal_date: ExtractionConfidenceLevel;
    notice_period_days: ExtractionConfidenceLevel;
    auto_renewal: ExtractionConfidenceLevel;
    contract_type: ExtractionConfidenceLevel;
  };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  timezone: string;
  currency: "GBP" | "USD" | "CAD";
  persona: string | null;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  owner_id: string;
  plan: PlanType;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  contract_limit: number;
  created_at: string;
}

export interface Contract {
  id: string;
  organization_id: string;
  client_id: string | null;
  owner_id: string;
  vendor_name: string;
  contract_type: ContractType;
  annual_cost: number | null;
  currency: string;
  start_date: string | null;
  renewal_date: string;
  notice_period_days: number;
  auto_renewal: boolean;
  status: ContractStatus;
  notes: string | null;
  pdf_url: string | null;
  ai_extraction_data: ContractAIExtractionData | null;
  created_at: string;
  updated_at: string;
  days_until_renewal?: number;
  monthly_cost?: number;
}

export interface ReminderSchedule {
  id: string;
  organization_id: string;
  contract_id: string | null;
  days_before: number;
  channel: ReminderChannel;
  enabled: boolean;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  profile_id: string;
  contract_id: string;
  action: "created" | "updated" | "renewed" | "cancelled" | "deleted";
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}

export interface DashboardStats {
  total_contracts: number;
  expiring_30_days: number;
  expiring_30_days_value: number;
  total_annual_spend: number;
  action_required: number;
}
