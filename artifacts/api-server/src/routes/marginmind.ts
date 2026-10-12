import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateCompanyBody,
  CreateCompanyResponse,
  CreateReportBody,
  CreateReportResponse,
  ExportReportParams,
  ExportReportResponse,
  GetCurrentUserResponse,
  GetDashboardQueryParams,
  GetDashboardResponse,
  GetLatestAnalysisQueryParams,
  GetLatestAnalysisResponse,
  GetSettingsResponse,
  ImportTransactionsBody,
  ImportTransactionsResponse,
  ListAnalysisHistoryQueryParams,
  ListAnalysisHistoryResponse,
  ListCompaniesResponse,
  ListFindingsQueryParams,
  ListFindingsResponse,
  ListImportsQueryParams,
  ListImportsResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ListReportsQueryParams,
  ListReportsResponse,
  ListScenariosQueryParams,
  ListScenariosResponse,
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  RequestImportUploadUrlBody,
  RequestImportUploadUrlResponse,
  RunAnalysisBody,
  RunAnalysisResponse,
  SaveScenarioBody,
  SaveScenarioResponse,
  UpdateCompanyBody,
  UpdateCompanyParams,
  UpdateCompanyResponse,
  UpdateFindingBody,
  UpdateFindingParams,
  UpdateFindingResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import {
  analysesTable,
  companiesTable,
  findingsTable,
  importsTable,
  reportsTable,
  scenariosTable,
  transactionsTable,
  userSettingsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { requireAuth, authenticatedUserId } from "../middlewares/requireAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  calculateAnalysis,
  calculateProducts,
  profitDifferenceFindingThreshold,
  transactionTypes,
  type FinancialRow,
} from "../lib/financialCalculations";

const router: IRouter = Router();
router.use(requireAuth);
const objectStorage = new ObjectStorageService();

function userId(req: Request): string {
  return authenticatedUserId(req);
}

function currencyNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function dateForDatabase(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function serializeCompany(company: typeof companiesTable.$inferSelect) {
  return {
    id: company.id,
    name: company.name,
    description: company.description,
    industry: company.industry,
    country: company.country,
    currency: company.currency,
    fiscalYearEnd: company.fiscalYearEnd,
    createdAt: company.createdAt.toISOString(),
  };
}

function serializeAnalysis(analysis: typeof analysesTable.$inferSelect) {
  return {
    id: analysis.id,
    companyId: analysis.companyId,
    periodStart: analysis.periodStart,
    periodEnd: analysis.periodEnd,
    currency: analysis.currency,
    reconstructedRevenue: Number(analysis.reconstructedRevenue),
    reconstructedExpenses: Number(analysis.reconstructedExpenses),
    reconstructedProfit: Number(analysis.reconstructedProfit),
    reportedRevenue: currencyNumber(analysis.reportedRevenue),
    reportedExpenses: currencyNumber(analysis.reportedExpenses),
    reportedProfit: currencyNumber(analysis.reportedProfit),
    profitDifference: currencyNumber(analysis.profitDifference),
    profitDifferencePercent: currencyNumber(analysis.profitDifferencePercent),
    includedTransactionCount: analysis.includedTransactionCount,
    excludedTransactionCount: analysis.excludedTransactionCount,
    methodology: analysis.methodology,
    limitations: analysis.limitations,
    createdAt: analysis.createdAt.toISOString(),
  };
}

function serializeImport(record: typeof importsTable.$inferSelect) {
  return {
    id: record.id,
    fileName: record.fileName,
    status: record.status,
    sourceObjectPath: record.sourceObjectPath,
    rowCount: record.rowCount,
    validRowCount: record.validRowCount,
    invalidRowCount: record.invalidRowCount,
    duplicateCandidateCount: record.duplicateCandidateCount,
    createdAt: record.createdAt.toISOString(),
  };
}

function serializeTransaction(
  row: typeof transactionsTable.$inferSelect,
) {
  return {
    id: row.id,
    importId: row.importId,
    sourceLine: row.sourceLine,
    sourceId: row.sourceId,
    date: row.date,
    description: row.description,
    type: row.type,
    amount: currencyNumber(row.amount),
    amountBasis: row.amountBasis,
    currency: row.currency,
    productName: row.productName,
    quantity: currencyNumber(row.quantity),
    unitPrice: currencyNumber(row.unitPrice),
    discountAmount: currencyNumber(row.discountAmount),
    unitCost: currencyNumber(row.unitCost),
    packagingCost: currencyNumber(row.packagingCost),
    deliveryCost: currencyNumber(row.deliveryCost),
    paymentFee: currencyNumber(row.paymentFee),
    returnedQuantity: currencyNumber(row.returnedQuantity),
    isValid: row.isValid,
    validationIssues: row.validationIssues,
    duplicateCandidate: row.duplicateCandidate,
    raw: row.raw,
  };
}

function serializeFinding(finding: typeof findingsTable.$inferSelect) {
  return {
    id: finding.id,
    analysisId: finding.analysisId,
    companyId: finding.companyId,
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    explanation: finding.explanation,
    status: finding.status,
    reviewNote: finding.reviewNote,
    transactionIds: finding.transactionIds,
    sourceLines: finding.sourceLines,
    createdAt: finding.createdAt.toISOString(),
  };
}

function serializeReport(report: typeof reportsTable.$inferSelect) {
  return {
    id: report.id,
    companyId: report.companyId,
    analysisId: report.analysisId,
    title: report.title,
    createdAt: report.createdAt.toISOString(),
  };
}

function serializeScenario(scenario: typeof scenariosTable.$inferSelect) {
  return {
    id: scenario.id,
    companyId: scenario.companyId,
    productName: scenario.productName,
    name: scenario.name,
    newUnitPrice: Number(scenario.newUnitPrice),
    newDiscountPercent: Number(scenario.newDiscountPercent),
    newUnitCost: Number(scenario.newUnitCost),
    estimatedUnitContribution: Number(scenario.estimatedUnitContribution),
    estimatedMonthlyContribution:
      currencyNumber(scenario.estimatedMonthlyContribution),
    baselineUnitContribution: currencyNumber(
      scenario.baselineUnitContribution,
    ),
    createdAt: scenario.createdAt.toISOString(),
  };
}

async function ownedCompany(companyId: string, ownerId: string) {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(eq(companiesTable.id, companyId), eq(companiesTable.userId, ownerId)),
    )
    .limit(1);
  return company ?? null;
}

function asFinancialRow(
  row: typeof transactionsTable.$inferSelect,
): FinancialRow {
  return {
    id: row.id,
    sourceLine: row.sourceLine,
    date: row.date,
    type: row.type,
    amount: row.amount,
    amountBasis: row.amountBasis,
    currency: row.currency,
    productName: row.productName,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    discountAmount: row.discountAmount,
    unitCost: row.unitCost,
    packagingCost: row.packagingCost,
    deliveryCost: row.deliveryCost,
    paymentFee: row.paymentFee,
    returnedQuantity: row.returnedQuantity,
    isValid: row.isValid,
    duplicateCandidate: row.duplicateCandidate,
  };
}

function fingerprint(row: {
  date: string | null;
  type: string;
  amount: number | null;
  currency: string | null;
  description: string | null;
  productName: string | null;
}): string {
  const stable = [
    row.date ?? "",
    row.type.trim().toLowerCase(),
    row.amount === null ? "" : new Decimal(row.amount).toString(),
    row.currency?.trim().toUpperCase() ?? "",
    row.description?.trim().toLowerCase().replace(/\s+/g, " ") ?? "",
    row.productName?.trim().toLowerCase().replace(/\s+/g, " ") ?? "",
  ];
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function clientValidationIssues(raw: Record<string, unknown>): string[] {
  const state = raw["_clientValidation"];
  if (!state || typeof state !== "object") return [];
  const issues = (state as Record<string, unknown>)["issues"];
  return Array.isArray(issues)
    ? issues.filter((item): item is string => typeof item === "string")
    : [];
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

router.get("/me", (req, res): void => {
  const auth = (req as Request & { auth?: { sessionClaims?: unknown } }).auth;
  const claims =
    auth?.sessionClaims && typeof auth.sessionClaims === "object"
      ? (auth.sessionClaims as Record<string, unknown>)
      : {};
  res.json(
    GetCurrentUserResponse.parse({
      id: userId(req),
      email: typeof claims["email"] === "string" ? claims["email"] : null,
      name: typeof claims["name"] === "string" ? claims["name"] : null,
    }),
  );
});

router.get("/companies", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.userId, userId(req)))
    .orderBy(desc(companiesTable.createdAt));
  res.json(ListCompaniesResponse.parse(rows.map(serializeCompany)));
});

router.post("/companies", async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({
      userId: userId(req),
      name: parsed.data.name.trim(),
      description: parsed.data.description ?? null,
      industry: parsed.data.industry ?? null,
      country: parsed.data.country ?? null,
      currency: parsed.data.currency.toUpperCase(),
      fiscalYearEnd: parsed.data.fiscalYearEnd ?? null,
    })
    .returning();
  res.status(201).json(CreateCompanyResponse.parse(serializeCompany(company)));
});

router.patch("/companies/:companyId", async (req, res): Promise<void> => {
  const params = UpdateCompanyParams.safeParse(req.params);
  const body = UpdateCompanyBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !body.success
          ? body.error.message
          : "Invalid company update",
    });
    return;
  }
  const [company] = await db
    .update(companiesTable)
    .set({
      ...body.data,
      ...(body.data.currency
        ? { currency: body.data.currency.toUpperCase() }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(companiesTable.id, params.data.companyId),
        eq(companiesTable.userId, userId(req)),
      ),
    )
    .returning();
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  res.json(UpdateCompanyResponse.parse(serializeCompany(company)));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const params = GetDashboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  const company = await ownedCompany(params.data.companyId, ownerId);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const whereCompany = and(
    eq(transactionsTable.userId, ownerId),
    eq(transactionsTable.companyId, company.id),
  );
  const [transactionCount] = await db
    .select({ value: count() })
    .from(transactionsTable)
    .where(whereCompany);
  const [validCount] = await db
    .select({ value: count() })
    .from(transactionsTable)
    .where(and(whereCompany, eq(transactionsTable.isValid, true)));
  const [invalidCount] = await db
    .select({ value: count() })
    .from(transactionsTable)
    .where(and(whereCompany, eq(transactionsTable.isValid, false)));
  const [importCount] = await db
    .select({ value: count() })
    .from(importsTable)
    .where(
      and(
        eq(importsTable.userId, ownerId),
        eq(importsTable.companyId, company.id),
      ),
    );
  const [findingCount] = await db
    .select({ value: count() })
    .from(findingsTable)
    .where(
      and(
        eq(findingsTable.userId, ownerId),
        eq(findingsTable.companyId, company.id),
        eq(findingsTable.status, "open"),
      ),
    );
  const productRows = await db
    .selectDistinct({ productName: transactionsTable.productName })
    .from(transactionsTable)
    .where(
      and(
        whereCompany,
        sql`${transactionsTable.productName} is not null`,
      ),
    );
  const [latest] = await db
    .select()
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, ownerId),
        eq(analysesTable.companyId, company.id),
      ),
    )
    .orderBy(desc(analysesTable.createdAt))
    .limit(1);
  res.json(
    GetDashboardResponse.parse({
      company: serializeCompany(company),
      hasAnalysis: Boolean(latest),
      latestAnalysis: latest ? serializeAnalysis(latest) : null,
      transactionCount: transactionCount.value,
      validTransactionCount: validCount.value,
      invalidTransactionCount: invalidCount.value,
      importCount: importCount.value,
      openFindingCount: findingCount.value,
      productCount: productRows.length,
    }),
  );
});

router.post(
  "/imports/request-upload-url",
  async (req, res): Promise<void> => {
    const parsed = RequestImportUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const safeTypes = new Set([
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ]);
    const extension = parsed.data.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" || !safeTypes.has(parsed.data.contentType)) {
      res.status(400).json({
        error: "Only CSV source files are currently supported.",
      });
      return;
    }
    try {
      const uploadURL = await objectStorage.getObjectEntityUploadURL(userId(req));
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      res.json(
        RequestImportUploadUrlResponse.parse({ uploadURL, objectPath }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Could not create a private source upload URL");
      res.status(500).json({ error: "Could not create a private upload URL" });
    }
  },
);

router.get("/imports", async (req, res): Promise<void> => {
  const params = ListImportsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const records = await db
    .select()
    .from(importsTable)
    .where(
      and(
        eq(importsTable.userId, ownerId),
        eq(importsTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(importsTable.createdAt));
  res.json(ListImportsResponse.parse(records.map(serializeImport)));
});

router.post("/imports", async (req, res): Promise<void> => {
  const parsed = ImportTransactionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ownerId = userId(req);
  const company = await ownedCompany(parsed.data.companyId, ownerId);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const sourcePath = parsed.data.sourceObjectPath ?? null;
  if (
    sourcePath &&
    !sourcePath.startsWith(`/objects/uploads/${ownerId}/`)
  ) {
    res.status(403).json({ error: "Source file is not owned by this user" });
    return;
  }
  const [existing] = await db
    .select()
    .from(importsTable)
    .where(
      and(
        eq(importsTable.userId, ownerId),
        eq(importsTable.companyId, company.id),
        eq(importsTable.idempotencyKey, parsed.data.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    res.json(ImportTransactionsResponse.parse(serializeImport(existing)));
    return;
  }

  if (sourcePath) {
    try {
      await objectStorage.trySetObjectEntityAclPolicy(sourcePath, {
        owner: ownerId,
        visibility: "private",
      });
    } catch (error) {
      req.log.error({ err: error }, "Could not secure uploaded source file");
      res.status(400).json({
        error: "The private source upload is unavailable; retry the upload.",
      });
      return;
    }
  }

  const incoming = parsed.data.rows;
  const fingerprints = incoming.map((row) =>
    fingerprint({
      date: dateForDatabase(row.date),
      type: row.type,
      amount: row.amount,
      currency: row.currency ?? null,
      description: row.description ?? null,
      productName: row.productName ?? null,
    }),
  );
  const existingFingerprintRows =
    fingerprints.length > 0
      ? await db
          .select({ value: transactionsTable.duplicateFingerprint })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.userId, ownerId),
              eq(transactionsTable.companyId, company.id),
              inArray(transactionsTable.duplicateFingerprint, [
                ...new Set(fingerprints),
              ]),
            ),
          )
      : [];
  const existingFingerprints = new Set(
    existingFingerprintRows.map((row) => row.value),
  );
  const frequencies = new Map<string, number>();
  fingerprints.forEach((key) =>
    frequencies.set(key, (frequencies.get(key) ?? 0) + 1),
  );
  const duplicates = fingerprints.map(
    (key) => existingFingerprints.has(key) || (frequencies.get(key) ?? 0) > 1,
  );
  const validation = incoming.map((row) => {
    const issues = clientValidationIssues(row.raw);
    if (!Number.isInteger(row.sourceLine) || row.sourceLine < 1) {
      issues.push("Source line number is invalid.");
    }
    if (row.amount === null || !Number.isFinite(row.amount)) {
      issues.push("Amount is missing or invalid; it was not converted to zero.");
    }
    if (!dateForDatabase(row.date)) {
      issues.push("A supported transaction date is required.");
    }
    if (!transactionTypes.has(row.type)) {
      issues.push(`Unrecognized transaction type: ${row.type}.`);
    }
    if (!row.currency || !/^[A-Z]{3}$/.test(row.currency)) {
      issues.push("A three-letter currency code is required.");
    }
    if (
      row.type === "sale" &&
      !["gross", "net"].includes(row.amountBasis)
    ) {
      issues.push("Sale amount basis must be explicitly marked gross or net.");
    }
    if (
      row.type !== "sale" &&
      row.amountBasis !== "not_applicable"
    ) {
      issues.push("Amount basis must be Not applicable for non-sale rows.");
    }
    return [...new Set(issues)];
  });
  const validRowCount = validation.filter((issues) => issues.length === 0).length;
  const duplicateCandidateCount = duplicates.filter(Boolean).length;
  const [importRecord] = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(importsTable)
      .values({
        userId: ownerId,
        companyId: company.id,
        idempotencyKey: parsed.data.idempotencyKey,
        fileName: parsed.data.fileName,
        sourceObjectPath: sourcePath,
        status:
          validRowCount === incoming.length
            ? "completed"
            : "completed_with_issues",
        rowCount: incoming.length,
        validRowCount,
        invalidRowCount: incoming.length - validRowCount,
        duplicateCandidateCount,
      })
      .returning();
    await tx.insert(transactionsTable).values(
      incoming.map((row, index) => ({
        userId: ownerId,
        companyId: company.id,
        importId: record.id,
        sourceLine: row.sourceLine,
        sourceId: row.sourceId ?? null,
        date: dateForDatabase(row.date),
        description: row.description ?? null,
        type: row.type.trim().toLowerCase(),
        amount: row.amount === null ? null : String(row.amount),
        amountBasis: row.amountBasis,
        currency: row.currency?.toUpperCase() ?? null,
        productName: row.productName ?? null,
        quantity: row.quantity === null ? null : String(row.quantity),
        unitPrice: row.unitPrice === null ? null : String(row.unitPrice),
        discountAmount:
          row.discountAmount === null ? null : String(row.discountAmount),
        unitCost: row.unitCost === null ? null : String(row.unitCost),
        packagingCost:
          row.packagingCost === null ? null : String(row.packagingCost),
        deliveryCost:
          row.deliveryCost === null ? null : String(row.deliveryCost),
        paymentFee: row.paymentFee === null ? null : String(row.paymentFee),
        returnedQuantity:
          row.returnedQuantity === null
            ? null
            : String(row.returnedQuantity),
        duplicateFingerprint: fingerprints[index],
        isValid: validation[index].length === 0,
        validationIssues: validation[index],
        duplicateCandidate: duplicates[index],
        raw: row.raw,
      })),
    );
    return [record];
  });
  res.status(201).json(
    ImportTransactionsResponse.parse(serializeImport(importRecord)),
  );
});

router.get("/transactions", async (req, res): Promise<void> => {
  const params = ListTransactionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const conditions = [
    eq(transactionsTable.userId, ownerId),
    eq(transactionsTable.companyId, params.data.companyId),
  ];
  if (params.data.validOnly === true) {
    conditions.push(eq(transactionsTable.isValid, true));
  }
  const term = params.data.search?.trim();
  if (term) {
    const match = `%${term.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(
      or(
        ilike(transactionsTable.description, match),
        ilike(transactionsTable.type, match),
        ilike(transactionsTable.productName, match),
        ilike(transactionsTable.sourceId, match),
      )!,
    );
  }
  const where = and(...conditions);
  const page = params.data.page ?? 1;
  const pageSize = params.data.pageSize ?? 50;
  const [total] = await db
    .select({ value: count() })
    .from(transactionsTable)
    .where(where);
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(where)
    .orderBy(desc(transactionsTable.createdAt), transactionsTable.sourceLine)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  res.json(
    ListTransactionsResponse.parse({
      items: rows.map(serializeTransaction),
      total: total.value,
      page,
      pageSize,
    }),
  );
});

router.post("/analysis/run", async (req, res): Promise<void> => {
  const parsed = RunAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    parsed.data.periodStart &&
    parsed.data.periodEnd &&
    parsed.data.periodStart > parsed.data.periodEnd
  ) {
    res.status(400).json({ error: "Period start must be on or before period end." });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(parsed.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, ownerId),
        eq(transactionsTable.companyId, parsed.data.companyId),
      ),
    );
  const calculation = calculateAnalysis(rows.map(asFinancialRow), {
    ...parsed.data,
    periodStart: dateForDatabase(parsed.data.periodStart),
    periodEnd: dateForDatabase(parsed.data.periodEnd),
    reportedRevenue: parsed.data.reportedRevenue ?? null,
    reportedExpenses: parsed.data.reportedExpenses ?? null,
    reportedProfit: parsed.data.reportedProfit ?? null,
  });
  if (calculation.includedTransactionCount === 0) {
    res.status(400).json({
      error:
        "No valid, classified rows match this currency and period. Review import validation and date, type, and currency mappings.",
    });
    return;
  }
  const [analysis] = await db
    .insert(analysesTable)
    .values({
      userId: ownerId,
      companyId: parsed.data.companyId,
      periodStart: calculation.periodStart,
      periodEnd: calculation.periodEnd,
      currency: calculation.currency,
      reconstructedRevenue: String(calculation.reconstructedRevenue),
      reconstructedExpenses: String(calculation.reconstructedExpenses),
      reconstructedProfit: String(calculation.reconstructedProfit),
      reportedRevenue:
        parsed.data.reportedRevenue === null
          ? null
          : String(parsed.data.reportedRevenue),
      reportedExpenses:
        parsed.data.reportedExpenses === null
          ? null
          : String(parsed.data.reportedExpenses),
      reportedProfit:
        parsed.data.reportedProfit === null
          ? null
          : String(parsed.data.reportedProfit),
      profitDifference:
        calculation.profitDifference === null
          ? null
          : String(calculation.profitDifference),
      profitDifferencePercent:
        calculation.profitDifferencePercent === null
          ? null
          : String(calculation.profitDifferencePercent),
      includedTransactionCount: calculation.includedTransactionCount,
      excludedTransactionCount: calculation.excludedTransactionCount,
      methodology: calculation.methodology,
      limitations: calculation.limitations,
    })
    .returning();

  const findings: Array<typeof findingsTable.$inferInsert> = [];
  const duplicateRows = calculation.includedRows.filter(
    (row) => row.duplicateCandidate,
  );
  if (duplicateRows.length > 0) {
    findings.push({
      userId: ownerId,
      companyId: parsed.data.companyId,
      analysisId: analysis.id,
      category: "duplicate_candidate",
      severity: "warning",
      title: `${duplicateRows.length} possible duplicate source row${duplicateRows.length === 1 ? "" : "s"}`,
      explanation:
        "Rows with matching date, type, amount, currency, description, or product pattern were flagged by the import rule. They remain included and were not automatically removed. Confirm them against the original source.",
      transactionIds: duplicateRows.map((row) => row.id),
      sourceLines: duplicateRows.map((row) => row.sourceLine),
    });
  }
  if (
    calculation.profitDifference !== null &&
    Math.abs(calculation.profitDifference) >
      profitDifferenceFindingThreshold()
  ) {
    findings.push({
      userId: ownerId,
      companyId: parsed.data.companyId,
      analysisId: analysis.id,
      category: "reported_reconstruction_difference",
      severity: "warning",
      title: "Reported and reconstructed profit differ",
      explanation: `Reported profit exceeds reconstructed profit by ${calculation.currency} ${calculation.profitDifference.toFixed(2)} under the current sign and transaction-type convention. The rule flags any absolute difference greater than ${profitDifferenceFindingThreshold().toFixed(2)} currency units. This is a reconciliation prompt, not evidence of misconduct.`,
      transactionIds: calculation.includedRows.map((row) => row.id),
      sourceLines: calculation.includedRows.map((row) => row.sourceLine),
    });
  }
  const productRows = calculateProducts(
    rows.map(asFinancialRow),
    calculation.currency,
  );
  for (const product of productRows) {
    if (product.contribution === null || product.contribution >= 0) continue;
    const evidence = calculation.includedRows.filter(
      (row) => row.productName === product.productName,
    );
    findings.push({
      userId: ownerId,
      companyId: parsed.data.companyId,
      analysisId: analysis.id,
      category: "negative_product_contribution",
      severity: "warning",
      title: `${product.productName} has negative contribution on supplied costs`,
      explanation: `Retained net sales less the product costs present in source rows is ${calculation.currency} ${product.contribution.toFixed(2)}. Cost coverage is ${product.costCoverage}; missing product costs are not treated as zero, so review the source rows before relying on this result.`,
      transactionIds: evidence.map((row) => row.id),
      sourceLines: evidence.map((row) => row.sourceLine),
    });
  }
  if (findings.length > 0) {
    await db.insert(findingsTable).values(findings);
  }
  res.status(201).json(
    RunAnalysisResponse.parse(serializeAnalysis(analysis)),
  );
});

router.get("/analysis/latest", async (req, res): Promise<void> => {
  const params = GetLatestAnalysisQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, ownerId),
        eq(analysesTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(analysesTable.createdAt))
    .limit(1);
  if (!analysis) {
    res.status(404).json({ error: "No analysis exists for this company" });
    return;
  }
  res.json(GetLatestAnalysisResponse.parse(serializeAnalysis(analysis)));
});

router.get("/analysis/history", async (req, res): Promise<void> => {
  const params = ListAnalysisHistoryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.userId, ownerId),
        eq(analysesTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(analysesTable.createdAt));
  res.json(
    ListAnalysisHistoryResponse.parse(rows.map(serializeAnalysis)),
  );
});

router.get("/anomalies", async (req, res): Promise<void> => {
  const params = ListFindingsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const findings = await db
    .select()
    .from(findingsTable)
    .where(
      and(
        eq(findingsTable.userId, ownerId),
        eq(findingsTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(findingsTable.createdAt));
  res.json(ListFindingsResponse.parse(findings.map(serializeFinding)));
});

router.patch("/anomalies/:findingId", async (req, res): Promise<void> => {
  const params = UpdateFindingParams.safeParse(req.params);
  const body = UpdateFindingBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !body.success
          ? body.error.message
          : "Invalid finding update",
    });
    return;
  }
  const [finding] = await db
    .update(findingsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(findingsTable.id, params.data.findingId),
        eq(findingsTable.userId, userId(req)),
      ),
    )
    .returning();
  if (!finding) {
    res.status(404).json({ error: "Finding not found" });
    return;
  }
  res.json(UpdateFindingResponse.parse(serializeFinding(finding)));
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  const company = await ownedCompany(params.data.companyId, ownerId);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, ownerId),
        eq(transactionsTable.companyId, company.id),
      ),
    );
  const result = calculateProducts(
    rows.map(asFinancialRow),
    company.currency,
  ).map(
    ({
      productName,
      currency,
      unitsSold,
      grossSales,
      discounts,
      returns,
      retainedNetSales,
      variableCosts,
      contribution,
      contributionMargin,
      costCoverage,
      costCoverageNotes,
      sourceRowCount,
    }) => ({
      productName,
      currency,
      unitsSold,
      grossSales,
      discounts,
      returns,
      retainedNetSales,
      variableCosts,
      contribution,
      contributionMargin,
      costCoverage,
      costCoverageNotes,
      sourceRowCount,
    }),
  );
  res.json(ListProductsResponse.parse(result));
});

router.get("/scenarios", async (req, res): Promise<void> => {
  const params = ListScenariosQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(scenariosTable)
    .where(
      and(
        eq(scenariosTable.userId, ownerId),
        eq(scenariosTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(scenariosTable.createdAt));
  res.json(ListScenariosResponse.parse(rows.map(serializeScenario)));
});

router.post("/scenarios", async (req, res): Promise<void> => {
  const parsed = SaveScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ownerId = userId(req);
  const company = await ownedCompany(parsed.data.companyId, ownerId);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, ownerId),
        eq(transactionsTable.companyId, company.id),
      ),
    );
  const product = calculateProducts(
    rows.map(asFinancialRow),
    company.currency,
  ).find((candidate) => candidate.productName === parsed.data.productName);
  if (!product) {
    res.status(400).json({
      error: "No valid product source rows match that product name.",
    });
    return;
  }
  const price = new Decimal(parsed.data.newUnitPrice);
  const discount = new Decimal(parsed.data.newDiscountPercent).div(100);
  const unitCost = new Decimal(parsed.data.newUnitCost);
  const otherUnitCosts = new Decimal(product.avgOtherUnitCosts ?? 0);
  const estimatedUnitContribution = price
    .mul(new Decimal(1).minus(discount))
    .minus(unitCost)
    .minus(otherUnitCosts);
  const baselineUnitContribution =
    product.contribution === null || product.unitsSold === null
      ? null
      : product.unitsSold === 0
        ? null
        : product.contribution / product.unitsSold;
  const estimatedMonthlyContribution =
    product.unitsSold !== null &&
    product.observationDays !== null &&
    product.observationDays >= 14
      ? estimatedUnitContribution
          .mul(new Decimal(product.unitsSold).mul(30).div(product.observationDays))
          .toString()
      : null;
  const [scenario] = await db
    .insert(scenariosTable)
    .values({
      userId: ownerId,
      companyId: company.id,
      productName: parsed.data.productName,
      name: parsed.data.name,
      newUnitPrice: price.toString(),
      newDiscountPercent: parsed.data.newDiscountPercent.toString(),
      newUnitCost: unitCost.toString(),
      estimatedUnitContribution: estimatedUnitContribution.toString(),
      estimatedMonthlyContribution,
      baselineUnitContribution:
        baselineUnitContribution === null
          ? null
          : String(baselineUnitContribution),
    })
    .returning();
  res.status(201).json(SaveScenarioResponse.parse(serializeScenario(scenario)));
});

router.get("/reports", async (req, res): Promise<void> => {
  const params = ListReportsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(params.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const rows = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.userId, ownerId),
        eq(reportsTable.companyId, params.data.companyId),
      ),
    )
    .orderBy(desc(reportsTable.createdAt));
  res.json(ListReportsResponse.parse(rows.map(serializeReport)));
});

router.post("/reports", async (req, res): Promise<void> => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ownerId = userId(req);
  if (!(await ownedCompany(parsed.data.companyId, ownerId))) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const [analysis] = await db
    .select({ id: analysesTable.id })
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.id, parsed.data.analysisId),
        eq(analysesTable.userId, ownerId),
        eq(analysesTable.companyId, parsed.data.companyId),
      ),
    )
    .limit(1);
  if (!analysis) {
    res.status(404).json({ error: "Analysis not found for this company" });
    return;
  }
  const [report] = await db
    .insert(reportsTable)
    .values({
      userId: ownerId,
      companyId: parsed.data.companyId,
      analysisId: parsed.data.analysisId,
      title: parsed.data.title.trim(),
    })
    .returning();
  res.status(201).json(CreateReportResponse.parse(serializeReport(report)));
});

router.get("/reports/:reportId/export", async (req, res): Promise<void> => {
  const params = ExportReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db
    .select()
    .from(reportsTable)
    .where(
      and(
        eq(reportsTable.id, params.data.reportId),
        eq(reportsTable.userId, userId(req)),
      ),
    )
    .limit(1);
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(
      and(
        eq(companiesTable.id, report.companyId),
        eq(companiesTable.userId, userId(req)),
      ),
    )
    .limit(1);
  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(
      and(
        eq(analysesTable.id, report.analysisId),
        eq(analysesTable.companyId, report.companyId),
        eq(analysesTable.userId, userId(req)),
      ),
    )
    .limit(1);
  if (!company || !analysis) {
    res.status(404).json({ error: "Report source is no longer available" });
    return;
  }
  const findings = await db
    .select()
    .from(findingsTable)
    .where(
      and(
        eq(findingsTable.analysisId, analysis.id),
        eq(findingsTable.userId, userId(req)),
      ),
    );
  const imports = await db
    .select()
    .from(importsTable)
    .where(
      and(
        eq(importsTable.companyId, company.id),
        eq(importsTable.userId, userId(req)),
      ),
    );
  const csvRows: unknown[][] = [
    ["MarginMind report", report.title],
    ["Company", company.name],
    ["Analysis ID", analysis.id],
    ["Analysis created", analysis.createdAt.toISOString()],
    ["Period start", analysis.periodStart],
    ["Period end", analysis.periodEnd],
    ["Currency", analysis.currency],
    ["Measure", "Reported", "Reconstructed", "Difference"],
    [
      "Revenue",
      analysis.reportedRevenue,
      analysis.reconstructedRevenue,
      analysis.reportedRevenue === null
        ? null
        : Number(analysis.reportedRevenue) -
          Number(analysis.reconstructedRevenue),
    ],
    [
      "Expenses",
      analysis.reportedExpenses,
      analysis.reconstructedExpenses,
      analysis.reportedExpenses === null
        ? null
        : Number(analysis.reportedExpenses) -
          Number(analysis.reconstructedExpenses),
    ],
    [
      "Profit",
      analysis.reportedProfit,
      analysis.reconstructedProfit,
      analysis.profitDifference,
    ],
    ["Included source rows", analysis.includedTransactionCount],
    ["Excluded source rows", analysis.excludedTransactionCount],
    ["Methodology", analysis.methodology],
    ["Limitations"],
    ...analysis.limitations.map((item) => ["Limitation", item]),
    ["Import", "Status", "Rows", "Valid", "Invalid", "Possible duplicates"],
    ...imports.map((item) => [
      item.fileName,
      item.status,
      item.rowCount,
      item.validRowCount,
      item.invalidRowCount,
      item.duplicateCandidateCount,
    ]),
    ["Finding", "Severity", "Status", "Explanation", "Source lines", "Transaction IDs"],
    ...findings.map((item) => [
      item.title,
      item.severity,
      item.status,
      item.explanation,
      item.sourceLines.join("; "),
      item.transactionIds.join("; "),
    ]),
    ["Disclaimer", "Reconstructed values reflect available uploaded rows and are not audited financial statements."],
  ];
  const content = csvRows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const safeName = report.title.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 90);
  res.json(
    ExportReportResponse.parse({
      fileName: `${safeName || "marginmind-report"}.csv`,
      contentType: "text/csv;charset=utf-8",
      content,
    }),
  );
});

router.get("/settings", async (req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, userId(req)))
    .limit(1);
  res.json(
    GetSettingsResponse.parse({
      currency: settings?.currency ?? "USD",
      periodStartDay: settings?.periodStartDay ?? 1,
      notificationsEnabled: settings?.notificationsEnabled ?? true,
    }),
  );
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ownerId = userId(req);
  const [settings] = await db
    .insert(userSettingsTable)
    .values({
      userId: ownerId,
      currency: parsed.data.currency?.toUpperCase() ?? "USD",
      periodStartDay: parsed.data.periodStartDay ?? 1,
      notificationsEnabled: parsed.data.notificationsEnabled ?? true,
    })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  res.json(
    UpdateSettingsResponse.parse({
      currency: settings.currency,
      periodStartDay: settings.periodStartDay,
      notificationsEnabled: settings.notificationsEnabled,
    }),
  );
});

export default router;
