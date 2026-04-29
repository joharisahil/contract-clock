import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ReminderEmailProps = {
  vendorName: string;
  renewalDate: string;
  daysUntilRenewal: number;
  annualCost: number | null;
  currency: string;
  noticePeriodDays: number;
  cancellationDeadline: string;
  contractUrl: string;
  orgName: string;
};

function formatCurrency(value: number | null, currency = "USD") {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReminderEmail({
  vendorName,
  renewalDate,
  daysUntilRenewal,
  annualCost,
  currency,
  noticePeriodDays,
  cancellationDeadline,
  contractUrl,
  orgName,
}: ReminderEmailProps) {
  const withinNoticePeriod = daysUntilRenewal <= noticePeriodDays;
  const renewingUrl = `${contractUrl}${contractUrl.includes("?") ? "&" : "?"}action=renewing`;
  const cancellingUrl = `${contractUrl}${contractUrl.includes("?") ? "&" : "?"}action=cancelling`;

  return (
    <Html>
      <Head />
      <Preview>{`${vendorName} renews in ${daysUntilRenewal} days`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={headerRow}>
            <Text style={logo}>ContractClock</Text>
            <Text style={orgLabel}>{orgName}</Text>
          </Section>

          <Heading style={heading}>{vendorName} is coming up for renewal</Heading>
          <Section style={heroCard}>
            <Text style={heroNumber}>{daysUntilRenewal} days</Text>
            <Text style={heroLabel}>until renewal</Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailRow}><strong>Vendor:</strong> {vendorName}</Text>
            <Text style={detailRow}><strong>Annual cost:</strong> {formatCurrency(annualCost, currency)}</Text>
            <Text style={detailRow}><strong>Renewal date:</strong> {renewalDate}</Text>
            <Text style={detailRow}><strong>Notice period:</strong> {noticePeriodDays} days</Text>
            <Text style={detailRow}><strong>Cancellation deadline:</strong> {cancellationDeadline}</Text>
          </Section>

          {withinNoticePeriod ? (
            <Section style={warningBox}>
              <Text style={warningTitle}>You must act by {cancellationDeadline}</Text>
              <Text style={warningText}>
                This contract is already inside its notice window. Mark the
                outcome now to keep your renewal pipeline accurate.
              </Text>
            </Section>
          ) : null}

          <Section style={ctaRow}>
            <Button href={renewingUrl} style={renewButton}>
              Mark as Renewing
            </Button>
            <Button href={cancellingUrl} style={cancelButton}>
              Mark as Cancelling
            </Button>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>
            You&apos;re receiving this because you track {vendorName} in
            ContractClock. Manage notification settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f1eb",
  fontFamily: "Arial, sans-serif",
  padding: "24px 0",
};

const container = {
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  margin: "0 auto",
  maxWidth: "640px",
  padding: "32px",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const logo = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "700",
  margin: 0,
};

const orgLabel = {
  color: "#6b7280",
  fontSize: "14px",
  margin: 0,
};

const heading = {
  color: "#111827",
  fontSize: "28px",
  lineHeight: "36px",
  marginBottom: "24px",
};

const heroCard = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "28px",
  textAlign: "center" as const,
  marginBottom: "24px",
};

const heroNumber = {
  color: "#111827",
  fontSize: "42px",
  fontWeight: "700",
  lineHeight: "46px",
  margin: "0 0 8px",
};

const heroLabel = {
  color: "#6b7280",
  fontSize: "16px",
  margin: 0,
};

const detailsBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "22px",
  marginBottom: "24px",
};

const detailRow = {
  color: "#374151",
  fontSize: "15px",
  margin: "0 0 12px",
};

const warningBox = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "18px",
  padding: "20px",
  marginBottom: "24px",
};

const warningTitle = {
  color: "#b91c1c",
  fontSize: "16px",
  fontWeight: "700",
  margin: "0 0 8px",
};

const warningText = {
  color: "#7f1d1d",
  fontSize: "14px",
  lineHeight: "22px",
  margin: 0,
};

const ctaRow = {
  display: "flex",
  gap: "12px",
  marginBottom: "24px",
};

const renewButton = {
  backgroundColor: "#15803d",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  padding: "14px 20px",
  textDecoration: "none",
  marginRight: "12px",
};

const cancelButton = {
  backgroundColor: "#b91c1c",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  padding: "14px 20px",
  textDecoration: "none",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const footer = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

export type { ReminderEmailProps };
