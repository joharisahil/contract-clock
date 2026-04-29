import type { PlanType } from "@/types";

export const PLAN_CONTRACT_LIMITS: Record<PlanType, number> = {
  free: 3,
  starter: 25,
  pro: 100,
  business: 999999,
  agency: 999999,
};
