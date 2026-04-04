// -- "D:\.openclaw\workspace\data-sources\extract-contacts.ts"
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SALES_ROOT = 'D:/SalesDoc';
const INDEX_DIR = path.resolve(__dirname, '../indexes');

// Interfaces (unchanged)
interface Order {
  orderNo: string;
  amount: number;
  date: string | null;
  product: string;
  quantity: number;
  sourceFile: string;
}

interface Shipment {
  item: string;
  quantity: number;
  shipmentDate: string | null;
  trackingNo: string | null;
  carrier: string | null;
  fullAddress: string | null;
  sourceFile: string;
}

interface Customer {
  name: string;
  country: string;
  city: string | null;
  postalCode: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  orders: Order[];
  payments: string[];
  shipments: Shipment[];
  metrics: {
    totalSpent: number;
    orderCount: number;
    shipmentCount: number;
    valueLevel: "low" | "medium" | "high";
  };
}

// Helper functions (unchanged)
function safeString(val: any): string | null {
  if (val == null) return null;
  if (typeof val === 'string') return val;
  return String(val);
}

function excelDateToISO(dateVal: number): string | null {
  if (typeof dateVal !== 'number') return null;
  const excelEpoch = new Date(1900, 0, 1);
  const d = new Date(excelEpoch.getTime() + (dateVal - 1) * 86400000);
  return d.toISOString().split('T')[0];
}

// File system scanning (unchanged)
function collectFiles(dir: string, customerMap: Map<string, Customer>) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, customerMap);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) continue;

    const parts = fullPath.split(path.sep);
    const salesIdx = parts.indexOf('SalesDoc');
    if (salesIdx === -1) continue;
    const customerName = parts[salesIdx + 2];
    if (!customerName) continue;

    if (!customerMap.has(customerName)) {
      customerMap.set(customerName, {
        name: customerName,
        country: parts[salesIdx + 1] || 'Unknown',
        city: null,
        postalCode: null,
        address: null,
        email: null,
        phone: null,
        orders: [],
        payments: [],
        shipments: [],
        metrics: { totalSpent: 0, orderCount: 0, shipmentCount: 0, valueLevel: 'low' },
      });
    }
    const customer = customerMap.get(customerName)!;

    const parentFolder = parts[parts.length - 2];
    if (parentFolder === 'Payments' || parentFolder === 'Payment') {
      customer.payments.push(fullPath);
    }
  }
}

// Excel parsing helpers (unchanged)
function readSheetWithHeaders(filePath: string, titleRowsToSkip: number = 0): any[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
  if (rawData.length <= titleRowsToSkip) return [];
  const headers = rawData[titleRowsToSkip] as string[];
  const rows = rawData.slice(titleRowsToSkip + 1);
  return rows.map(row => {
    const obj: any = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx];
    });
    return obj;
  });
}

function isOdooFormat(headers: string[]): boolean {
  return headers.includes('Customer') && headers.includes('Order Reference') && headers.includes('Total');
}
function isChineseBatch2(headers: string[]): boolean {
  return headers.includes('客户名') && headers.includes('国家') && headers.includes('产品名称');
}
function isChineseBatch4(headers: string[]): boolean {
  return headers.includes('*客户名') && headers.includes('*订单号') && headers.includes('品名*');
}

function parseOdooRow(row: any, filePath: string): { customerName: string; country: string; order: Order; details: any } | null {
  const customerName = row['Customer'];
  if (!customerName) return null;
  let dateStr: string | null = null;
  const orderDate = row['Order Date'];
  if (orderDate) {
    if (typeof orderDate === 'number') {
      dateStr = excelDateToISO(orderDate);
    } else if (typeof orderDate === 'string') {
      const match = orderDate.match(/\d{4}-\d{2}-\d{2}/);
      if (match) dateStr = match[0];
      else dateStr = orderDate.slice(0, 10);
    }
  }
  return {
    customerName: customerName.trim(),
    country: row['Invoice Address/Country'] || '',
    order: {
      orderNo: row['Order Reference'] || 'Unknown',
      amount: typeof row['Total'] === 'number' ? row['Total'] : 0,
      date: dateStr,
      product: row['Order Lines/Product'] || '',
      quantity: row['Order Lines/Quantity'] || 1,
      sourceFile: filePath,
    },
    details: {
      city: row['Invoice Address/City'],
      postalCode: row['Invoice Address/Zip'],
      address: row['Invoice Address/Complete Address'],
      email: row['Invoice Address/Email'],
      phone: row['Invoice Address/Phone'] || row['Invoice Address/Mobile'],
    },
  };
}

function parseChineseBatch2Row(row: any, filePath: string): { customerName: string; country: string; order: Order; details: any } | null {
  const customerName = safeString(row['客户名']);
  if (!customerName) return null;
  const country = safeString(row['国家']) || 'Unknown';
  const product = safeString(row['产品名称']) || 'Unknown';
  const model = safeString(row['型号']) || '';
  const fullProduct = model ? `${product} (${model})` : product;
  let quantity = 1;
  const qtyVal = row['数量'];
  if (typeof qtyVal === 'number') quantity = qtyVal;
  else if (typeof qtyVal === 'string') quantity = parseInt(qtyVal) || 1;
  const contactInfo = safeString(row['联系方式']);
  const email = contactInfo && contactInfo.includes('@') ? contactInfo : null;
  const phone = contactInfo && !contactInfo.includes('@') ? contactInfo : null;
  const orderNo = `B2-${customerName.replace(/\s/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    customerName,
    country,
    order: {
      orderNo,
      amount: 0,
      date: null,
      product: fullProduct,
      quantity,
      sourceFile: filePath,
    },
    details: {
      email,
      phone,
    },
  };
}

function parseChineseBatch4Row(row: any, filePath: string): { customerName: string; country: string; order?: Order; shipment?: Shipment; details: any } | null {
  const customerName = safeString(row['*客户名']);
  if (!customerName) return null;
  const country = safeString(row['*目的国家']) || 'Unknown';
  const product = safeString(row['品名*']) || 'Unknown';
  const model = safeString(row['*型号']) || '';
  const attribute = safeString(row['*属性']) || '';
  const fullProduct = `${product}${model ? ` (${model})` : ''}${attribute ? ` [${attribute}]` : ''}`;
  let quantity = 1;
  const qtyVal = row['*数量'];
  if (typeof qtyVal === 'number') quantity = qtyVal;
  else if (typeof qtyVal === 'string') quantity = parseInt(qtyVal) || 1;
  const orderNo = safeString(row['*订单号']);
  let date: string | null = null;
  const dateVal = row['*日期'];
  if (dateVal) {
    if (typeof dateVal === 'number') {
      date = excelDateToISO(dateVal);
    } else if (typeof dateVal === 'string') {
      const match = dateVal.match(/\d{4}-\d{2}-\d{2}/);
      if (match) date = match[0];
    }
  }
  const contactInfo = safeString(row['*联系方式']);
  const email = contactInfo && contactInfo.includes('@') ? contactInfo : null;
  const phone = contactInfo && !contactInfo.includes('@') ? contactInfo : null;
  const addressParts = [
    safeString(row['*地址']),
    safeString(row['*城市']),
    safeString(row['*州/省']),
    safeString(row['*邮政编码']),
    country,
  ].filter(Boolean).join(', ');
  const fullAddress = addressParts || null;

  const shipmentDate = (() => {
    const val = row['出仓日期'];
    if (!val) return null;
    if (typeof val === 'number') return excelDateToISO(val);
    if (typeof val === 'string') {
      const match = val.match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : null;
    }
    return null;
  })();
  const trackingNo = safeString(row['转单号']) || null;
  const carrier = safeString(row['派送渠道']) || null;

  const order: Order = {
    orderNo: orderNo ? orderNo : `B4-${customerName.replace(/\s/g, '')}-${Date.now()}`,
    amount: 0,
    date,
    product: fullProduct,
    quantity,
    sourceFile: filePath,
  };
  const shipment: Shipment = {
    item: fullProduct,
    quantity,
    shipmentDate,
    trackingNo,
    carrier,
    fullAddress,
    sourceFile: filePath,
  };

  return {
    customerName,
    country,
    order,
    shipment,
    details: {
      email,
      phone,
      city: safeString(row['*城市']) || null,
      postalCode: safeString(row['*邮政编码']) || null,
      address: fullAddress,
    },
  };
}

function parseExcelFile(filePath: string, customerMap: Map<string, Customer>) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    if (!rawData.length) return;
    const firstRow = rawData[0];
    const headers = firstRow.map((v: any) => safeString(v)).filter(Boolean) as string[];

    let parseFunction: ((row: any, filePath: string) => any) | null = null;
    if (isOdooFormat(headers)) {
      parseFunction = parseOdooRow;
    } else if (isChineseBatch2(headers)) {
      parseFunction = parseChineseBatch2Row;
    } else if (isChineseBatch4(headers)) {
      parseFunction = parseChineseBatch4Row;
    } else {
      return;
    }

    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    for (const row of data) {
      const parsed = parseFunction(row, filePath);
      if (!parsed) continue;
      const { customerName, country, order, shipment, details } = parsed;
      if (!customerMap.has(customerName)) {
        customerMap.set(customerName, {
          name: customerName,
          country,
          city: details.city || null,
          postalCode: details.postalCode || null,
          address: details.address || null,
          email: details.email || null,
          phone: details.phone || null,
          orders: [],
          payments: [],
          shipments: [],
          metrics: { totalSpent: 0, orderCount: 0, shipmentCount: 0, valueLevel: 'low' },
        });
      }
      const customer = customerMap.get(customerName)!;
      if (details.city && !customer.city) customer.city = details.city;
      if (details.postalCode && !customer.postalCode) customer.postalCode = details.postalCode;
      if (details.address && !customer.address) customer.address = details.address;
      if (details.email && !customer.email) customer.email = details.email;
      if (details.phone && !customer.phone) customer.phone = details.phone;
      if (country !== 'Unknown' && customer.country === 'Unknown') customer.country = country;

      if (order) customer.orders.push(order);
      if (shipment) customer.shipments.push(shipment);
    }
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
  }
}

function computeMetrics(customerMap: Map<string, Customer>) {
  for (const customer of customerMap.values()) {
    const totalSpent = customer.orders.reduce((sum, o) => sum + o.amount, 0);
    const orderCount = customer.orders.length;
    const shipmentCount = customer.shipments.length;
    let valueLevel: "low" | "medium" | "high" = "low";
    if (totalSpent >= 1000) valueLevel = "high";
    else if (totalSpent >= 500) valueLevel = "medium";
    customer.metrics = { totalSpent, orderCount, shipmentCount, valueLevel };
  }
}

// --- Main ---
async function main() {
  const customerMap = new Map<string, Customer>();

  console.log('📂 Scanning files for payments...');
  collectFiles(SALES_ROOT, customerMap);
  console.log(`   Found ${customerMap.size} customers from file system.`);

  const excelFiles: string[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) excelFiles.push(full);
      }
    }
  };
  walk(SALES_ROOT);
  console.log(`📂 Found ${excelFiles.length} Excel files. Parsing...`);
  for (const file of excelFiles) {
    parseExcelFile(file, customerMap);
  }

  computeMetrics(customerMap);

  const customers = Array.from(customerMap.values())
    .filter(c => c.orders.length > 0 || c.payments.length > 0 || c.shipments.length > 0)
    .map(c => ({
      name: c.name,
      country: c.country,
      city: c.city,
      postalCode: c.postalCode,
      address: c.address,
      email: c.email,
      phone: c.phone,
      orders: c.orders,
      payments: c.payments,
      shipments: c.shipments,
      metrics: c.metrics,
    }));

  // Write to the exact location expected by the backend
  const outDir = path.join(INDEX_DIR, 'customers');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'customers.json');
  fs.writeFileSync(outFile, JSON.stringify(customers, null, 2));

  const totalOrders = customers.reduce((sum, c) => sum + c.metrics.orderCount, 0);
  const totalRevenue = customers.reduce((sum, c) => sum + c.metrics.totalSpent, 0);
  console.log(`\n✅ Build complete.`);
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Orders:    ${totalOrders}`);
  console.log(`   Revenue:   $${totalRevenue.toFixed(2)}`);
  console.log(`   Shipments: ${customers.reduce((s, c) => s + c.shipments.length, 0)}`);
  console.log(`   Output:    ${outFile}`);

  // Show top 15 customers
  const tableData = customers
    .map(c => ({
      '客户名称': c.name,
      '国家': c.country,
      '订单数': c.metrics.orderCount,
      '总消费额': c.metrics.totalSpent,
    }))
    .sort((a, b) => b['总消费额'] - a['总消费额'])
    .slice(0, 15);

  console.table(tableData.map(row => ({
    ...row,
    '总消费额': `$${row['总消费额'].toFixed(2)}`
  })));
}

main().catch(console.error);