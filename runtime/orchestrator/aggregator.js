// runtime/orchestrator/aggregator.ts
export class Aggregator {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    async aggregate(query, results, context) {
        if (!results.length)
            return "No data available.";
        let customerList = null;
        let salesData = null;
        let knowledgeAnswer = null;
        for (const res of results) {
            if (res.type === 'customer_list')
                customerList = res.data;
            else if (res.type === 'total_revenue')
                salesData = res;
            else if (res.type === 'sales_by_country')
                salesData = res;
            else if (res.type === 'sales_data')
                salesData = res;
            else if (res.type === 'top_customers')
                salesData = res;
            else if (res.type === 'knowledge_answer')
                knowledgeAnswer = res.answer;
        }
        const prompt = `
You are a helpful assistant. The user asked: "${query}"

You have the following information:

${customerList ? `CUSTOMER INFORMATION:\n${JSON.stringify(customerList, null, 2)}` : ''}
${salesData ? `SALES INFORMATION:\n${JSON.stringify(salesData, null, 2)}` : ''}
${knowledgeAnswer ? `KNOWLEDGE BASE INFORMATION:\n${knowledgeAnswer}` : ''}

Your task is to generate a single, natural, insightful answer that combines all relevant information. 
- If the user asks about a specific customer, include their contact details, location, purchase history, and any inferred interests (e.g., from forum posts).
- If the user asks for "top customers", list them with their revenue and order count.
- Use a friendly, professional tone. Do not mention that you are "based on the data". Just present the answer directly.
`;
        try {
            const answer = await this.llm.generate(prompt);
            return answer;
        }
        catch (err) {
            return `I was unable to generate a proper answer. Raw data: ${JSON.stringify(results)}`;
        }
    }
}
