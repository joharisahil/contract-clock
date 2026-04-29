type SlackContractReminder = {
  vendorName: string;
  daysUntilRenewal: number;
  annualCost: number | null;
  currency: string;
  contractUrl: string;
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

export async function sendSlackNotification(
  webhookUrl: string,
  contract: SlackContractReminder,
) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `ContractClock reminder: ${contract.vendorName} renews in ${contract.daysUntilRenewal} days`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "ContractClock Reminder",
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${contract.vendorName}* renews in *${contract.daysUntilRenewal} days*`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Annual cost*\n${formatCurrency(contract.annualCost, contract.currency)}`,
              },
              {
                type: "mrkdwn",
                text: `*Open contract*\n<${contract.contractUrl}|View in ContractClock>`,
              },
            ],
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View contract",
                },
                url: contract.contractUrl,
                style: "primary",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Mark as renewing",
                },
                url: `${contract.contractUrl}?action=renewing`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "Slack webhook request failed");
    }

    return { ok: true };
  } catch (error) {
    console.error("[slack] Failed to send reminder notification", error);
    throw error;
  }
}
