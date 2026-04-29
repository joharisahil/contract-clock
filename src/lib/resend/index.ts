import { createElement, type ReactElement } from "react";
import { Resend } from "resend";

import {
  BillingStatusEmail,
  type BillingStatusEmailProps,
} from "@/lib/resend/emails/BillingStatusEmail";
import {
  ReminderEmail,
  type ReminderEmailProps,
} from "@/lib/resend/emails/ReminderEmail";
import {
  TeamInviteEmail,
  type TeamInviteEmailProps,
} from "@/lib/resend/emails/TeamInviteEmail";
import {
  TrialEndingEmail,
  type TrialEndingEmailProps,
} from "@/lib/resend/emails/TrialEndingEmail";
import {
  WelcomeEmail,
  type WelcomeEmailProps,
} from "@/lib/resend/emails/WelcomeEmail";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "ContractClock <reminders@contractclock.com>";

async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: ReactElement;
}) {
  if (!resend) {
    console.warn("[resend] Skipping email because RESEND_API_KEY is missing.");
    return { skipped: true, reason: "Missing RESEND_API_KEY." };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      react,
    });

    if (result.error) {
      console.error("[resend] Email send failed", result.error);
      throw new Error(result.error.message);
    }

    return result;
  } catch (error) {
    console.error("[resend] Unexpected email send error", error);
    throw error;
  }
}

export async function sendReminderEmail(
  to: string,
  props: ReminderEmailProps,
) {
  return sendEmail({
    to,
    subject: `${props.vendorName} renews in ${props.daysUntilRenewal} days`,
    react: createElement(ReminderEmail, props),
  });
}

export async function sendTrialEndingEmail(
  to: string,
  props: TrialEndingEmailProps,
) {
  return sendEmail({
    to,
    subject: `Your ContractClock trial ends in ${props.daysLeft} days`,
    react: createElement(TrialEndingEmail, props),
  });
}

export async function sendWelcomeEmail(
  to: string,
  props: WelcomeEmailProps,
) {
  return sendEmail({
    to,
    subject: "Welcome to ContractClock",
    react: createElement(WelcomeEmail, props),
  });
}

export async function sendTeamInviteEmail(
  to: string,
  props: TeamInviteEmailProps,
) {
  return sendEmail({
    to,
    subject: `${props.inviterName} invited you to ContractClock`,
    react: createElement(TeamInviteEmail, props),
  });
}

export async function sendBillingStatusEmail(
  to: string,
  props: BillingStatusEmailProps,
) {
  return sendEmail({
    to,
    subject: props.heading,
    react: createElement(BillingStatusEmail, props),
  });
}

export type {
  BillingStatusEmailProps,
  ReminderEmailProps,
  TeamInviteEmailProps,
  TrialEndingEmailProps,
  WelcomeEmailProps,
};
