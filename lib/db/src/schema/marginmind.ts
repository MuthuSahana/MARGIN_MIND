import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const companiesTable = pgTable(
  "marginmind_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    industry: text("industry"),
    country: text("country"),
    currency: text("currency").notNull().default("USD"),
    fiscalYearEnd: text("fiscal_year_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("marginmind_companies_user_id_idx").on(table.userId)],
);

export const importsTable = pgTable(
  "marginmind_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    fileName: text("file_name").notNull(),
    sourceObjectPath: text("source_object_path"),
    status: text("status").notNull().default("completed"),
    rowCount: integer("row_count").notNull(),
    validRowCount: integer("valid_row_count").notNull(),
    invalidRowCount: integer("invalid_row_count").notNull(),
    duplicateCandidateCount: integer("duplicate_candidate_count").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marginmind_imports_idempotency_idx").on(
      table.companyId,
      table.idempotencyKey,
    ),
    index("marginmind_imports_user_company_idx").on(table.userId, table.companyId),
  ],
);

export const transactionsTable = pgTable(
  "marginmind_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    importId: uuid("import_id")
      .notNull()
      .references(() => importsTable.id, { onDelete: "cascade" }),
    sourceLine: integer("source_line").notNull(),
    sourceId: text("source_id"),
    date: date("transaction_date", { mode: "string" }),
    description: text("description"),
    type: text("transaction_type").notNull(),
    amount: numeric("amount", { precision: 20, scale: 6 }),
    amountBasis: text("amount_basis").notNull(),
    currency: text("currency"),
    productName: text("product_name"),
    quantity: numeric("quantity", { precision: 20, scale: 6 }),
    unitPrice: numeric("unit_price", { precision: 20, scale: 6 }),
    discountAmount: numeric("discount_amount", { precision: 20, scale: 6 }),
    unitCost: numeric("unit_cost", { precision: 20, scale: 6 }),
    packagingCost: numeric("packaging_cost", { precision: 20, scale: 6 }),
    deliveryCost: numeric("delivery_cost", { precision: 20, scale: 6 }),
    paymentFee: numeric("payment_fee", { precision: 20, scale: 6 }),
    returnedQuantity: numeric("returned_quantity", { precision: 20, scale: 6 }),
    duplicateFingerprint: text("duplicate_fingerprint").notNull(),
    isValid: boolean("is_valid").notNull(),
    validationIssues: text("validation_issues").array().notNull().default([]),
    duplicateCandidate: boolean("duplicate_candidate").notNull().default(false),
    raw: jsonb("raw").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marginmind_transactions_import_line_idx").on(
      table.importId,
      table.sourceLine,
    ),
    index("marginmind_transactions_company_fingerprint_idx").on(
      table.companyId,
      table.duplicateFingerprint,
    ),
    index("marginmind_transactions_user_company_date_idx").on(
      table.userId,
      table.companyId,
      table.date,
    ),
    index("marginmind_transactions_company_type_idx").on(
      table.companyId,
      table.type,
    ),
  ],
);

export const analysesTable = pgTable(
  "marginmind_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    currency: text("currency").notNull(),
    reconstructedRevenue: numeric("reconstructed_revenue", { precision: 20, scale: 6 }).notNull(),
    reconstructedExpenses: numeric("reconstructed_expenses", { precision: 20, scale: 6 }).notNull(),
    reconstructedProfit: numeric("reconstructed_profit", { precision: 20, scale: 6 }).notNull(),
    reportedRevenue: numeric("reported_revenue", { precision: 20, scale: 6 }),
    reportedExpenses: numeric("reported_expenses", { precision: 20, scale: 6 }),
    reportedProfit: numeric("reported_profit", { precision: 20, scale: 6 }),
    profitDifference: numeric("profit_difference", { precision: 20, scale: 6 }),
    profitDifferencePercent: numeric("profit_difference_percent", { precision: 20, scale: 6 }),
    includedTransactionCount: integer("included_transaction_count").notNull(),
    excludedTransactionCount: integer("excluded_transaction_count").notNull(),
    methodology: text("methodology").notNull(),
    limitations: text("limitations").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marginmind_analyses_user_company_created_idx").on(
      table.userId,
      table.companyId,
      table.createdAt,
    ),
  ],
);

export const findingsTable = pgTable(
  "marginmind_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analysesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    severity: text("severity").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    status: text("status").notNull().default("open"),
    reviewNote: text("review_note"),
    transactionIds: jsonb("transaction_ids").notNull().$type<string[]>().default([]),
    sourceLines: jsonb("source_lines").notNull().$type<number[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marginmind_findings_user_company_idx").on(table.userId, table.companyId),
    index("marginmind_findings_analysis_idx").on(table.analysisId),
  ],
);

export const scenariosTable = pgTable(
  "marginmind_scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    productName: text("product_name").notNull(),
    name: text("name").notNull(),
    newUnitPrice: numeric("new_unit_price", { precision: 20, scale: 6 }).notNull(),
    newDiscountPercent: numeric("new_discount_percent", { precision: 8, scale: 4 }).notNull(),
    newUnitCost: numeric("new_unit_cost", { precision: 20, scale: 6 }).notNull(),
    estimatedUnitContribution: numeric("estimated_unit_contribution", { precision: 20, scale: 6 }).notNull(),
    estimatedMonthlyContribution: numeric("estimated_monthly_contribution", { precision: 20, scale: 6 }),
    baselineUnitContribution: numeric("baseline_unit_contribution", { precision: 20, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marginmind_scenarios_user_company_idx").on(table.userId, table.companyId),
  ],
);

export const reportsTable = pgTable(
  "marginmind_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analysesTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("marginmind_reports_user_company_idx").on(table.userId, table.companyId),
  ],
);

export const userSettingsTable = pgTable("marginmind_user_settings", {
  userId: text("user_id").primaryKey(),
  currency: text("currency").notNull().default("USD"),
  periodStartDay: integer("period_start_day").notNull().default(1),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
