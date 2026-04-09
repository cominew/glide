# Skill: customer

## Description
Retrieve customer profiles by name, country, city, or US state. Supports abbreviations (CA → California, LA → Los Angeles).

## Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `name` | string | no | Customer name (substring match) | "Adam Davis" |
| `country` | string | no | Country name | "Canada" |
| `city` | string | no | City name (supports aliases) | "Los Angeles" |
| `state` | string | no | US state name (supports abbreviations) | "California" |

## Output Format

```json
{
  "type": "customer_list",
  "data": [
    {
      "name": "Adam Davis",
      "country": "UK",
      "city": "Stokenchurch",
      "address": "63 Eastwood Road...",
      "email": "me@adamdavis.net",
      "phone": "07747444403",
      "orders": 1,
      "revenue": 180
    }
  ]
}