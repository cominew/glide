# Glide Skill Template

这是 Glide 技能的标准模板。每个技能必须遵循此契约。

## 因果相位 (Causal Phase)

每个技能在因果链中有固定位置：

| 相位 | 说明 | 示例 |
|------|------|------|
| `identity` | 身份解析 | name-disambiguation |
| `retrieval` | 数据检索 | profile-fetcher, sales |
| `analysis` | 分析推理 | reasoning, persona-summary |
| `synthesis` | 语言合成 | ai (仅在有因果来源时) |

| Phase         | Meaning                  |
| ------------- | ------------------------ |
| identity      | identity resolution      |
| retrieval     | reality acquisition      |
| analysis      | interpretation           |
| synthesis     | linguistic manifestation |
| stabilization | reality closure          |


## 碎片标准

每个技能输出 `fragments`，每个碎片包含：
- `type`: 永远为 `'data'`
- `name`: 碎片类型名 (如 `'identity.resolved'`)
- `phase`: 因果相位
- `source`: 产生此碎片的技能名
- `confidence`: 置信度 (0-1)

## 存在条件 (canExist)

`canExist(event)` 不是 "我该运行吗"，而是 "我是否因果合法"。

```typescript
canExist(event: GlideEvent): boolean {
  // 只在因果条件满足时返回 true
  // 否则静默 — 不是被禁止，是未被允许
}

identity
↓
retrieval
↓
analysis
↓
synthesis
↓
stabilization
↓
causality.closed
↓
return to silence