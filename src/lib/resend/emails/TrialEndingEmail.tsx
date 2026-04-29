import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type TrialEndingEmailProps = {
  userName: string;
  daysLeft: number;
  upgradeUrl: string;
  contractCount: number;
};

export function TrialEndingEmail({
  userName,
  daysLeft,
  upgradeUrl,
  contractCount,
}: TrialEndingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your free trial ends in ${daysLeft} days`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>ContractClock</Text>
          <Heading style={heading}>Your free trial ends in {daysLeft} days</Heading>
          <Text style={lead}>
            Hi {userName}, you&apos;re tracking {contractCount}{" "}
            {contractCount === 1 ? "contract" : "contracts"}. Don&apos;t lose
            access to your reminders, renewal timelines, and spend history.
          </Text>

          <Section style={pricingCard}>
            <Text style={pricingTitle}>Choose the plan that fits your workflow</Text>
            <Text style={pricingRow}><strong>Starter</strong> - Track more contracts with essential reminders</Text>
            <Text style={pricingRow}><strong>Pro</strong> - Team collaboration, owner filters, and better visibility</Text>
            <Text style={pricingRow}><strong>Business</strong> - More seats, more controls, more peace of mind</Text>
          </Section>

          <Button href={upgradeUrl} style={cta}>
            Upgrade now and keep your data
          </Button>
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

const logo = {
  color: "#111827",
  fontSize: "20px",
  fontWeight: "700",
  margin: "0 0 20px",
};

const heading = {
  color: "#111827",
  fontSize: "30px",
  lineHeight: "36px",
  marginBottom: "16px",
};

const lead = {
  color: "#4b5563",
  fontSize: "16px",
  lineHeight: "26px",
  marginBottom: "24px",
};

const pricingCard = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "22px",
  marginBottom: "24px",
};

const pricingTitle = {
  color: "#111827",
  fontSize: "16px",
  fontWeight: "700",
  margin: "0 0 14px",
};

const pricingRow = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 10px",
};

const cta = {
  backgroundColor: "#111827",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  padding: "14px 22px",
  textDecoration: "none",
};

export type { TrialEndingEmailProps };
