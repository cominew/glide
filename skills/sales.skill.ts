import { Skill, SkillContext, SkillResult } from "../../framework/core/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE = path.resolve(__dirname, "..");
const CUSTOMERS_FILE = path.join(WORKSPACE, "indexes", "customers", "customers.json");

let cachedCustomers: any[] | null = null;
function loadCustomers(): any[] {
  if (!cachedCustomers) {
    try {
      cachedCustomers = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, "utf-8"));
    } catch (e) {
      cachedCustomers = [];
    }
  }
  return cachedCustomers;
}

export const skill: Skill = {
  name: "sales",
  description: "Sales analytics: total revenue, top customers, country ranking, monthly revenue, and customer-specific orders. Parameters: dateRange (optional), customerName (optional).",
  keywords: [],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    const customers = loadCustomers();
    const { dateRange, customerName } = input;
    const query = input.query || "";

    // 1. 如果指定了客户名，返回该客户的订单历史
    if (customerName) {
      const customer = customers.find(c => c.name.toLowerCase().includes(customerName.toLowerCase()));
      if (!customer) {
        return { success: false, output: { error: `Customer ${customerName} not found` } };
      }
      const totalSpent = customer.orders.reduce((s, o) => s + (o.amount || 0), 0);
      const orderCount = customer.orders.length;
      return {
        success: true,
        output: {
          type: 'sales_data',
          customer: customer.name,
          totalSpent,
          orderCount,
          orders: customer.orders.map(o => ({
            product: o.product,
            amount: o.amount,
            date: o.date,
            quantity: o.quantity,
          }))
        }
      };
    }

    // 2. 如果要求 top customers
    if (/top\s+customers/i.test(query)) {
      const top = customers
        .map(c => ({
          name: c.name,
          revenue: c.orders.reduce((s, o) => s + (o.amount || 0), 0),
          orders: c.orders.length,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      return {
        success: true,
        output: { type: 'top_customers', data: top }
      };
    }

    // 3. 如果提供了月份，计算该月收入
    if (dateRange && /^\d{4}-\d{2}$/.test(dateRange)) {
      let monthlyRevenue = 0;
      for (const c of customers) {
        for (const o of c.orders) {
          if (o.date && o.date.startsWith(dateRange)) {
            monthlyRevenue += o.amount || 0;
          }
        }
      }
      return {
        success: true,
        output: { type: 'monthly_revenue', month: dateRange, revenue: monthlyRevenue }
      };
    }

    // 4. 默认返回总营收
    const totalRevenue = customers.reduce(
      (sum, c) => sum + c.orders.reduce((s, o) => s + (o.amount || 0), 0),
      0
    );
    return { success: true, output: { type: 'total_revenue', total: totalRevenue } };
  }
};