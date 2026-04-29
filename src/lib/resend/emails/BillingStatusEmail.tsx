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

type BillingStatusEmailProps = {
  preview: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function BillingStatusEmail({
  preview,
  heading,
  body,
  ctaLabel,
  ctaUrl,
}: BillingStatusEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={page}>
        <Container style={container}>
          <Text style={logo}>ContractClock</Text>
          <Heading style={title}>{heading}</Heading>
          <Section style={contentCard}>
            <Text style={copy}>{body}</Text>
            {ctaLabel && ctaUrl ? (
              <Button href={ctaUrl} style={cta}>
                {ctaLabel}
              </Button>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const page = {
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

const title = {
  color: "#111827",
  fontSize: "30px",
  lineHeight: "36px",
  marginBottom: "20px",
};

const contentCard = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "18px",
  padding: "24px",
};

const copy = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 20px",
  whiteSpace: "pre-line" as const,
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

export type { BillingStatusEmailProps };
