import Decimal from "decimal.js";

export const transactionTypes = new Set([
  "sale",
  "refund",
  "expense",
  "discount",
  "shipping",
  "cogs",
  "fee",
  "tax",
  "other",
]);

const expenseTypes = new Set(["expense", "shipping", "cogs", "fee", "tax"]);

export type FinancialRow = {
  id: string;
  sourceLine: number;
  date: string | null;
  type: string;
  amount: string | number | null;
  amountBasis: string;
  currency: string | null;
  productName: string | null;
  quantity: string | number | null;
  unitPrice: string | number | null;
  discountAmount: string | number | null;
  unitCost: string | number | null;
  packagingCost: string | number | null;
  deliveryCost: string | number | null;
  paymentFee: string | number | null;
  returnedQuantity: string | number | null;
  isValid: boolean;
  duplicateCandidate: boolean;
};

export type AnalysisCalculationInput = {
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  reportedRevenue: number | null;
  reportedExpenses: number | null;
  reportedProfit: number | null;
};

export type AnalysisCalculation = {
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  reconstructedRevenue: number;
  reconstructedExpenses: number;
  reconstructedProfit: number;
  reportedRevenue: number | null;
  reportedExpenses: number | null;
  reportedProfit: number | null;
  profitDifference: number | null;
  profitDifferencePercent: number | null;
  includedTransactionCount: number;
  excludedTransactionCount: number;
  methodology: string;
  limitations: string[];
  includedRows: FinancialRow[];
};

export type ProductCalculation = {
  productName: string;
  currency: string;
  unitsSold: number | null;
  grossSales: number;
  discounts: number;
  returns: number;
  retainedNetSales: number;
  variableCosts: number | null;
  contribution: number | null;
  contributionMargin: number | null;
  costCoverage: "complete" | "partial" | "missing";
  costCoverageNotes: string;
  sourceRowCount: number;
  observationDays: number | null;
  avgUnitPrice: number | null;
  avgUnitCost: number | null;
  avgOtherUnitCosts: number | null;
};

function decimal(value: string | number | null | undefined): Decimal | null {
  if (value == null || value === "") return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function asNumber(value: Decimal): number {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber();
}

function signed(row: FinancialRow): Decimal | null {
  return decimal(row.amount);
}

function inPeriod(
  row: FinancialRow,
  start: string | null,
  end: string | null,
): boolean {
  if (!row.date) return false;
  if (start && row.date < start) return false;
  if (end && row.date > end) return false;
  return true;
}

export function calculateAnalysis(
  rows: FinancialRow[],
  input: AnalysisCalculationInput,
): AnalysisCalculation {
  const eligible: FinancialRow[] = [];
  let sales = new Decimal(0);
  let refunds = new Decimal(0);
  let grossDiscounts = new Decimal(0);
  let expenses = new Decimal(0);
  let separateDiscounts = new Decimal(0);
  let minDate = input.periodStart;
  let maxDate = input.periodEnd;
  let hasNetSale = false;
  let hasGrossSale = false;
  let hasDuplicateCandidates = false;
  let hasOtherRows = false;

  for (const row of rows) {
    if (
      !row.isValid ||
      row.amount === null ||
      !row.date ||
      !transactionTypes.has(row.type) ||
      row.currency !== input.currency ||
      !inPeriod(row, input.periodStart, input.periodEnd)
    ) {
      continue;
    }

    const value = signed(row);
    if (!value) continue;
    if (row.type === "sale" && !["gross", "net"].includes(row.amountBasis)) {
      continue;
    }
    if (row.type === "other") {
      hasOtherRows = true;
      continue;
    }

    eligible.push(row);
    if (row.date && (!minDate || row.date < minDate)) minDate = row.date;
    if (row.date && (!maxDate || row.date > maxDate)) maxDate = row.date;
    if (row.duplicateCandidate) hasDuplicateCandidates = true;

    if (row.type === "sale") {
      sales = sales.plus(value);
      if (row.amountBasis === "net") hasNetSale = true;
      if (row.amountBasis === "gross") {
        hasGrossSale = true;
        const lineDiscount = decimal(row.discountAmount);
        if (lineDiscount) grossDiscounts = grossDiscounts.plus(lineDiscount);
      }
    } else if (row.type === "refund") {
      refunds = refunds.plus(value);
    } else if (row.type === "discount") {
      separateDiscounts = separateDiscounts.plus(value);
    } else if (expenseTypes.has(row.type)) {
      expenses = expenses.plus(value);
    }
  }

  const discounts = hasNetSale
    ? grossDiscounts
    : grossDiscounts.plus(separateDiscounts);
  const reconstructedRevenue = sales.minus(refunds).minus(discounts);
  const reconstructedProfit = reconstructedRevenue.minus(expenses);
  const reportedProfit =
    input.reportedProfit === null ? null : new Decimal(input.reportedProfit);
  const difference =
    reportedProfit === null
      ? null
      : reportedProfit.minus(reconstructedProfit);
  const differencePercent =
    reportedProfit === null || reportedProfit.isZero() || difference === null
      ? null
      : difference.abs().div(reportedProfit.abs()).mul(100);
  const excludedTransactionCount = Math.max(0, rows.length - eligible.length);
  const limitations = [
    "This is a reconstruction from valid uploaded rows, not audited net income. Accruals, depreciation, interest, taxes, or other statement items may be absent.",
    "Sales marked gross have separately mapped discounts deducted once. Sales marked net are already net of discounts; separate discount rows are not deducted again. Positive refund rows reduce revenue; negative refund rows reverse a prior refund.",
    "Expense rows use their mapped transaction type and signed amount. Negative expense values reduce expenses as credits or reimbursements; negative values are not classified by sign alone.",
    "Rows with type Other, invalid rows, rows in other currencies, and rows outside the selected period are excluded.",
  ];
  if (input.reportedProfit === null) {
    limitations.push(
      "No reported profit was supplied, so a reported-versus-reconstructed profit comparison is unavailable.",
    );
  }
  if (hasGrossSale && hasNetSale) {
    limitations.push(
      "The selected data mixes gross and net sale amount conventions; confirm each import's mapping before comparing periods.",
    );
  }
  if (hasDuplicateCandidates) {
    limitations.push(
      "Potential duplicate rows remain included in the reconstruction and are flagged for review; they have not been automatically removed.",
    );
  }
  if (hasOtherRows) {
    limitations.push(
      "Some records were classified as Other and are excluded until they are assigned a supported financial type.",
    );
  }

  return {
    periodStart: minDate,
    periodEnd: maxDate,
    currency: input.currency,
    reconstructedRevenue: asNumber(reconstructedRevenue),
    reconstructedExpenses: asNumber(expenses),
    reconstructedProfit: asNumber(reconstructedProfit),
    reportedRevenue: input.reportedRevenue,
    reportedExpenses: input.reportedExpenses,
    reportedProfit: input.reportedProfit,
    profitDifference: difference ? asNumber(difference) : null,
    profitDifferencePercent: differencePercent
      ? asNumber(differencePercent)
      : null,
    includedTransactionCount: eligible.length,
    excludedTransactionCount,
    methodology:
      "Reconstructed revenue = signed Sale rows − signed Refund rows − applicable Discount rows. Reconstructed expenses = signed Expense, COGS, Shipping, Fee, and Tax rows. Reconstructed profit = reconstructed revenue − reconstructed expenses. A positive profit difference means reported profit exceeds reconstructed profit. Difference percentage = absolute difference ÷ absolute reported profit × 100; it is unavailable when reported profit is zero or missing.",
    limitations,
    includedRows: eligible,
  };
}

type MutableProduct = {
  currency: string;
  grossSales: Decimal;
  discounts: Decimal;
  returns: Decimal;
  quantity: Decimal;
  quantityComplete: boolean;
  sourceRowCount: number;
  saleCount: number;
  salesDates: string[];
  unitPriceTotal: Decimal;
  unitPriceRows: number;
  unitCostTotal: Decimal;
  unitCostRows: number;
  knownOtherCosts: Decimal;
  otherCostRows: number;
  hasAnyCost: boolean;
  fullCostRows: number;
  hasSaleRow: boolean;
  hasLineDiscount: boolean;
  separateDiscounts: Decimal;
  separateRefunds: Decimal;
  separateCost: Decimal;
  hasSeparateCost: boolean;
};

function newProduct(currency: string): MutableProduct {
  return {
    currency,
    grossSales: new Decimal(0),
    discounts: new Decimal(0),
    returns: new Decimal(0),
    quantity: new Decimal(0),
    quantityComplete: true,
    sourceRowCount: 0,
    saleCount: 0,
    salesDates: [],
    unitPriceTotal: new Decimal(0),
    unitPriceRows: 0,
    unitCostTotal: new Decimal(0),
    unitCostRows: 0,
    knownOtherCosts: new Decimal(0),
    otherCostRows: 0,
    hasAnyCost: false,
    fullCostRows: 0,
    hasSaleRow: false,
    hasLineDiscount: false,
    separateDiscounts: new Decimal(0),
    separateRefunds: new Decimal(0),
    separateCost: new Decimal(0),
    hasSeparateCost: false,
  };
}

export function calculateProducts(
  rows: FinancialRow[],
  currency: string,
): ProductCalculation[] {
  const products = new Map<string, MutableProduct>();
  const productFor = (name: string): MutableProduct => {
    let entry = products.get(name);
    if (!entry) {
      entry = newProduct(currency);
      products.set(name, entry);
    }
    return entry;
  };

  for (const row of rows) {
    const name = row.productName?.trim();
    if (!name || !row.isValid || row.currency !== currency || !row.date) {
      continue;
    }
    const entry = productFor(name);
    entry.sourceRowCount += 1;

    if (row.type === "sale" && row.amount !== null) {
      const amount = decimal(row.amount);
      if (!amount) continue;
      entry.hasSaleRow = true;
      entry.saleCount += 1;
      const qty = decimal(row.quantity);
      const price = decimal(row.unitPrice);
      if (qty) {
        entry.quantity = entry.quantity.plus(qty);
        if (price) {
          entry.unitPriceTotal = entry.unitPriceTotal.plus(price.mul(qty));
          entry.unitPriceRows += 1;
        }
      } else {
        entry.quantityComplete = false;
      }

      const basis = row.amountBasis;
      const gross =
        basis === "gross" && qty && price ? qty.mul(price) : amount;
      entry.grossSales = entry.grossSales.plus(gross);
      if (basis === "gross") {
        const lineDiscount = decimal(row.discountAmount);
        if (lineDiscount) {
          entry.discounts = entry.discounts.plus(lineDiscount);
          entry.hasLineDiscount = true;
        }
      }
      if (basis === "net") {
        entry.discounts = entry.discounts.plus(0);
      }

      const unitCost = decimal(row.unitCost);
      if (unitCost && qty) {
        entry.unitCostTotal = entry.unitCostTotal.plus(unitCost.mul(qty));
        entry.unitCostRows += 1;
        entry.hasAnyCost = true;
      }
      for (const cost of [
        row.packagingCost,
        row.deliveryCost,
        row.paymentFee,
      ]) {
        const parsed = decimal(cost);
        if (parsed) {
          entry.knownOtherCosts = entry.knownOtherCosts.plus(parsed);
          entry.otherCostRows += 1;
          entry.hasAnyCost = true;
        }
      }
      if (
        unitCost &&
        qty &&
        row.packagingCost !== null &&
        row.deliveryCost !== null &&
        row.paymentFee !== null
      ) {
        entry.fullCostRows += 1;
      }
      entry.salesDates.push(row.date);
    } else if (row.type === "refund" && row.amount !== null) {
      const amount = decimal(row.amount);
      if (amount) entry.returns = entry.returns.plus(amount);
      const returnedQty = decimal(row.returnedQuantity);
      if (returnedQty) entry.quantity = entry.quantity.minus(returnedQty);
      else entry.quantityComplete = false;
    } else if (row.type === "discount" && row.amount !== null) {
      const amount = decimal(row.amount);
      if (amount) entry.separateDiscounts = entry.separateDiscounts.plus(amount);
    } else if (
      ["cogs", "shipping", "fee", "expense"].includes(row.type) &&
      row.amount !== null
    ) {
      const amount = decimal(row.amount);
      if (amount) {
        entry.separateCost = entry.separateCost.plus(amount);
        entry.hasSeparateCost = true;
        entry.hasAnyCost = true;
      }
    }
  }

  return Array.from(products.entries())
    .map(([productName, entry]) => {
      const discounts = entry.hasLineDiscount
        ? entry.discounts
        : entry.separateDiscounts;
      const returns = entry.returns;
      const retainedNetSales = entry.grossSales.minus(discounts).minus(returns);
      const variableCosts = entry.hasSeparateCost
        ? entry.separateCost
        : entry.hasAnyCost
          ? entry.unitCostTotal.plus(entry.knownOtherCosts)
          : null;
      const contribution =
        variableCosts === null ? null : retainedNetSales.minus(variableCosts);
      const margin =
        contribution === null || retainedNetSales.isZero()
          ? null
          : contribution.div(retainedNetSales).mul(100);
      const start = entry.salesDates.sort()[0];
      const end = entry.salesDates.at(-1);
      const observationDays =
        start && end
          ? Math.floor(
              (new Date(`${end}T00:00:00Z`).getTime() -
                new Date(`${start}T00:00:00Z`).getTime()) /
                86_400_000,
            ) + 1
          : null;
      const unitsSold =
        entry.quantityComplete && entry.saleCount > 0
          ? asNumber(entry.quantity)
          : null;
      const costCoverage: ProductCalculation["costCoverage"] =
        !entry.hasAnyCost
          ? "missing"
          : entry.fullCostRows === entry.saleCount && !entry.hasSeparateCost
            ? "complete"
            : "partial";
      const avgUnitPrice =
        entry.unitPriceRows > 0 && !entry.quantity.isZero()
          ? asNumber(entry.unitPriceTotal.div(entry.quantity))
          : null;
      const avgUnitCost =
        entry.unitCostRows > 0 && !entry.quantity.isZero()
          ? asNumber(entry.unitCostTotal.div(entry.quantity))
          : null;
      const knownUnitCost =
        entry.quantity.isZero() || variableCosts === null
          ? null
          : asNumber(variableCosts.div(entry.quantity));
      const avgOtherUnitCosts =
        knownUnitCost === null || avgUnitCost === null
          ? null
          : Math.max(0, knownUnitCost - avgUnitCost);
      return {
        productName,
        currency: entry.currency,
        unitsSold,
        grossSales: asNumber(entry.grossSales),
        discounts: asNumber(discounts),
        returns: asNumber(returns),
        retainedNetSales: asNumber(retainedNetSales),
        variableCosts: variableCosts === null ? null : asNumber(variableCosts),
        contribution: contribution === null ? null : asNumber(contribution),
        contributionMargin: margin === null ? null : asNumber(margin),
        costCoverage,
        costCoverageNotes:
          costCoverage === "complete"
            ? "All supported per-sale cost fields were supplied for each sale row."
            : costCoverage === "partial"
              ? "Contribution uses only cost inputs present in the source rows; missing cost fields are not treated as zero."
              : "No product-level cost data was supplied, so contribution cannot be calculated.",
        sourceRowCount: entry.sourceRowCount,
        observationDays,
        avgUnitPrice,
        avgUnitCost,
        avgOtherUnitCosts,
      };
    })
    .sort((a, b) => b.retainedNetSales - a.retainedNetSales);
}

export function profitDifferenceFindingThreshold(): number {
  return 0.01;
}
