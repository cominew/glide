# Skill: support

## Description
Retrieve customer support tickets, complaints, and service history.

## Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `query` | string | yes | Customer name, ticket ID, or subject keyword | "Adam Davis" |

## Output Format

Returns an array of matching tickets (limited to 10). If none found, returns an error object.

```json
{
  "type": "support_tickets",
  "data": [
    {
      "ticketId": "SUP-123",
      "customerName": "Adam Davis",
      "subject": "Installation issue",
      "status": "closed",
      "date": "2026-03-20"
    }
  ]
}

