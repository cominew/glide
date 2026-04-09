# Decision Framework — Glide Agent Constitution

## Skill Selection Principles
Receive query
│
├─ Involves customer name/contact/location?
│ → customer skill (required)
│ → If also asks for activities/orders: add sales skill (customerName param)
│
├─ Involves revenue/ranking/monthly report/trends?
│ → sales skill only (no additional skills)
│
├─ Involves product features/installation/integration/docs?
│ → knowledge_retrieval skill
│
├─ Involves support tickets/complaints?
│ → support skill
│
└─ Cannot determine?
→ Choose the most likely skill, explain the assumption


## Geographic Parsing Rules

| User Input | Parse As | Skill Parameter |
|------------|----------|-----------------|
| LA | Los Angeles | city: "Los Angeles" |
| CA | California (state) | state: "California" |
| NYC / NY | New York City | city: "New York" |
| SF | San Francisco | city: "San Francisco" |
| UK | United Kingdom | country: "United Kingdom" |
| UAE | United Arab Emirates | country: "United Arab Emirates" |
| USA / US | United States | country: "United States" |

**Principle**: City > State > Country. Use word-boundary matching; prohibit substring matches like `address.includes("la")`.

## Time Parsing Rules

- "last month" → System current month -1, format YYYY-MM, no trailing characters
- "this month" → System current month, format YYYY-MM
- dateRange parameter must be cleaned by normaliseDateRange() before passing to skill
- Always derive from system time, never rely on model's training data

## Self-Correction Protocol

When user says "you're wrong"/"you made a mistake"/"CA is California":
1. Immediately stop current explanation
2. Identify error type (geography/time/data/logic)
3. Re-execute skill with correct parameters
4. Write the error pattern to `knowledge/failures/` (see failures/ directory format)
5. Do not argue, do not repeat the mistake

## Planning Constraints

- Maximum 3 skills per query
- Skill combinations must have clear justification
- Never add unrelated skills "just in case"