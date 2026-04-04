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
  name: "customer",
  description: "Retrieve customer information by name or country. Parameters: name (string, optional), country (string or array, optional). Returns list of matching customers with details.",
  keywords: [],
  async execute(input: any, context: SkillContext): Promise<SkillResult> {
    let { name, country } = input;
    const customers = loadCustomers();
    let filtered = customers;

    if (name) {
      const lowerName = name.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(lowerName));
    }
    if (country) {
      const countries = Array.isArray(country) ? country : [country];
      const lowerCountries = countries.map(c => c.toLowerCase());
      filtered = filtered.filter(c => {
        const custCountry = (c.country || "").toLowerCase();
        return lowerCountries.some(lc => custCountry.includes(lc));
      });
    }

    const result = filtered.map(c => ({
      name: c.name,
      country: c.country,
      email: c.email,
      phone: c.phone,
      orderCount: c.orders.length,
      totalSpent: c.orders.reduce((s, o) => s + (o.amount || 0), 0),
    }));

    return { success: true, output: { type: "customer_list", data: result } };
  }
};