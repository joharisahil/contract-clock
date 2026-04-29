import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type TeamInviteEmailProps = {
  inviterName: string;
  orgName: string;
  inviteUrl: string;
};

export function TeamInviteEmail({
  inviterName,
  orgName,
  inviteUrl,
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to ContractClock</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>ContractClock</Text>
          <Heading style={heading}>
            {inviterName} has invited you to manage contracts in ContractClock
          </Heading>
          <Text style={lead}>
            Join {orgName} to review renewals, share ownership, and keep the
            whole team aligned on upcoming contract actions.
          </Text>
          <Button href={inviteUrl} style={cta}>
            Accept invitation
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

const cta = {
  backgroundColor: "#111827",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  padding: "14px 22px",
  textDecoration: "none",
};

export type { TeamInviteEmailProps };
