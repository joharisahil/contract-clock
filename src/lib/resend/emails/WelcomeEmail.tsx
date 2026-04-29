import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type WelcomeEmailProps = {
  userName: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ userName, dashboardUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to ContractClock</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>ContractClock</Text>
          <Heading style={heading}>Welcome to ContractClock</Heading>
          <Text style={lead}>
            Hi {userName}, you&apos;re in. Here&apos;s the fastest way to get
            value from your workspace today.
          </Text>

          <Section style={stepsCard}>
            <Text style={step}><strong>1.</strong> Add your first contract manually or upload a PDF.</Text>
            <Text style={step}><strong>2.</strong> Confirm renewal dates, notice periods, and ownership.</Text>
            <Text style={step}><strong>3.</strong> Let ContractClock keep your reminders and upcoming actions on track.</Text>
          </Section>

          <Button href={dashboardUrl} style={cta}>
            Add your first contract
          </Button>

          <Text style={docs}>
            Need a hand? Visit our{" "}
            <Link href="https://contractclock.com/help" style={docsLink}>
              help docs
            </Link>
            .
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

const stepsCard = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "22px",
  marginBottom: "24px",
};

const step = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 12px",
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

const docs = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "22px",
  marginTop: "24px",
};

const docsLink = {
  color: "#111827",
  textDecoration: "underline",
};

export type { WelcomeEmailProps };
