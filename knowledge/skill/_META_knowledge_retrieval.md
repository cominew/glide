# Skill: knowledge_retrieval

## Description
Searches the knowledge base (`knowledge/` directory) for product documentation, feature specs, integration guides, forum posts, and company info.

## Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `query` | string | yes | Search query (natural language) | "Astrion Remote Home Assistant integration" |

## Output Format

```json
{
  "type": "knowledge_answer",
  "answer": "Relevant text extracted from documents..."
}

