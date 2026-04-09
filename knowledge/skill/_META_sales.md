# Skill: sales

## Description
Sales analytics: total revenue overview, top customers by revenue, monthly revenue reports, individual customer order history.

## Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `customerName` | string | no | Customer name (exact or partial) | "Adam Davis" |
| `dateRange` | string | no | Month in YYYY-MM format | "2026-03" |
| `country` | string | no | Country name | "Canada" |
| `city` | string | no | City name | "Los Angeles" |
| `state` | string | no | US state name | "California" |
| `action` | string | no | "top_customers", "overview", "monthly_report" | "top_customers" |
| `limit` | number | no | Max number of results (default 5) | 10 |

## Output Types

| Type | When returned | Example fields |
|------|---------------|----------------|
| `overview` | No specific filters, or country/city/state without dateRange | revenue, orders, customers, countries |
| `monthly_report` | dateRange provided | month, totalRevenue, totalOrders, uniqueCustomers, products[] |
| `top_customers` | action="top_customers" or query implies ranking | data[] with name, revenue, orders, country, city |
| `sales_data` | customerName provided | customer, totalSpent, orderCount, orders[] |

## Common Mistakes

1. **Using `dateRange` with trailing punctuation** (e.g., "2026-03.") → The skill normalises it, but planning should avoid generating it.
2. **Asking for "top customers in Canada"** → This is a `customer` skill query, not `sales`. Use `customer(country: "Canada")`.
3. **Assuming monthly report works without `dateRange`** → It will fall back to `overview`.

## Example Queries and Resulting Calls

| User query | Skill call |
|------------|------------|
| "sales overview" | `sales({})` |
| "top 5 customers" | `sales({ action: "top_customers", limit: 5 })` |
| "revenue last month" | `sales({ dateRange: "2026-03" })` |
| "show me Adam Davis orders" | `sales({ customerName: "Adam Davis" })` |
| "revenue by country" | `sales({ action: "country_ranking" })` (future) |

## See Also
- `customer` skill (for customer profiles without revenue)
- `support` skill (for support tickets)