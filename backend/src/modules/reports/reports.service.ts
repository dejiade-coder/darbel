import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  tradeCategory?: string;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ctx: ActorContext, filters: ReportFilters = {}) {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registrationWhere = buildRegistrationWhere(filters);
      const medicalWhere = buildMedicalWhere(filters);
      const certificateWhere = buildCertificateWhere(filters);
      const paymentWhere = buildPaymentWhere(filters);
      const [
        registrations,
        drafts,
        submittedForReview,
        ready,
        paymentsApproved,
        screenings,
        samplesCollected,
        resultsEntered,
        medicalApproved,
        medicalRejected,
        certificatesValid,
        certificatesExpired,
        registrationsByStatus,
        medicalByStatus,
        certificatesByStatus,
        topTrades,
      ] = await Promise.all([
        tx.handlerRegistration.count({ where: registrationWhere }),
        tx.handlerRegistration.count({ where: { ...registrationWhere, status: 'DRAFT' } }),
        tx.handlerRegistration.count({ where: { ...registrationWhere, status: 'SUBMITTED_FOR_REVIEW' } }),
        tx.handlerRegistration.count({ where: { ...registrationWhere, status: 'READY_FOR_SCREENING' } }),
        tx.payment.count({ where: { ...paymentWhere, status: 'APPROVED' } }),
        tx.medicalScreening.count({ where: medicalWhere }),
        tx.medicalScreening.count({ where: { ...medicalWhere, status: 'SAMPLE_COLLECTED' } }),
        tx.medicalScreening.count({ where: { ...medicalWhere, status: 'RESULT_ENTERED' } }),
        tx.medicalScreening.count({ where: { ...medicalWhere, status: 'APPROVED' } }),
        tx.medicalScreening.count({ where: { ...medicalWhere, status: 'REJECTED' } }),
        tx.certificate.count({ where: { ...certificateWhere, status: 'VALID' } }),
        tx.certificate.count({ where: { ...certificateWhere, status: 'VALID', expiresAt: { lt: new Date() } } }),
        tx.handlerRegistration.groupBy({
          by: ['status'],
          where: registrationWhere,
          _count: { _all: true },
          orderBy: { _count: { status: 'desc' } },
        }),
        tx.medicalScreening.groupBy({
          by: ['status'],
          where: medicalWhere,
          _count: { _all: true },
          orderBy: { _count: { status: 'desc' } },
        }),
        tx.certificate.groupBy({
          by: ['status'],
          where: certificateWhere,
          _count: { _all: true },
          orderBy: { _count: { status: 'desc' } },
        }),
        tx.handlerRegistration.groupBy({
          by: ['tradeCategory'],
          where: { ...registrationWhere, tradeCategory: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { tradeCategory: 'desc' } },
          take: 8,
        }),
      ]);
      return {
        registrations,
        drafts,
        submittedForReview,
        readyForScreening: ready,
        approvedPayments: paymentsApproved,
        medicalScreenings: screenings,
        samplesCollected,
        resultsEntered,
        medicalApproved,
        medicalRejected,
        validCertificates: certificatesValid,
        expiredCertificates: certificatesExpired,
        conversion: {
          paymentApprovalRate: percent(paymentsApproved, registrations),
          medicalCompletionRate: percent(medicalApproved + medicalRejected, screenings),
          certificationRate: percent(certificatesValid, registrations),
        },
        registrationStatusBreakdown: registrationsByStatus.map((row) => ({
          label: row.status,
          count: row._count._all,
        })),
        medicalStatusBreakdown: medicalByStatus.map((row) => ({
          label: row.status,
          count: row._count._all,
        })),
        certificateStatusBreakdown: certificatesByStatus.map((row) => ({
          label: row.status,
          count: row._count._all,
        })),
        topTradeCategories: topTrades.map((row) => ({
          label: row.tradeCategory ?? 'Unspecified',
          count: row._count._all,
        })),
      };
    });
  }

  async registrationsCsv(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.handlerRegistration.findMany({
        where: buildRegistrationWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
          uid: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          tradeCategory: true,
          businessName: true,
          businessAddress: true,
          status: true,
          registrationDate: true,
          submittedAt: true,
          createdAt: true,
        },
      });

      return toCsv(
        [
          'uid',
          'first_name',
          'last_name',
          'phone',
          'email',
          'trade_category',
          'business_name',
          'business_address',
          'status',
          'registration_date',
          'submitted_at',
          'created_at',
        ],
        rows.map((row) => [
          row.uid,
          row.firstName,
          row.lastName,
          row.phone,
          row.email,
          row.tradeCategory,
          row.businessName,
          row.businessAddress,
          row.status,
          formatDate(row.registrationDate),
          formatDateTime(row.submittedAt),
          formatDateTime(row.createdAt),
        ]),
      );
    });
  }

  async registrationsXls(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.handlerRegistration.findMany({
        where: buildRegistrationWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
          uid: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          tradeCategory: true,
          businessName: true,
          status: true,
          registrationDate: true,
        },
      });
      return toExcelHtml('Registrations', ['UID', 'First name', 'Last name', 'Phone', 'Email', 'Trade', 'Business', 'Status', 'Registration date'], rows.map((row) => [
        row.uid,
        row.firstName,
        row.lastName,
        row.phone,
        row.email,
        row.tradeCategory,
        row.businessName,
        row.status,
        formatDate(row.registrationDate),
      ]));
    });
  }

  async certificatesCsv(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.certificate.findMany({
        where: buildCertificateWhere(filters),
        orderBy: { issuedAt: 'desc' },
        take: 5000,
        include: { handlerRegistration: true },
      });

      return toCsv(
        [
          'uid',
          'handler_name',
          'phone',
          'trade_category',
          'business_name',
          'certificate_status',
          'issued_at',
          'expires_at',
        ],
        rows.map((row) => [
          row.uid,
          [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
            .filter(Boolean)
            .join(' '),
          row.handlerRegistration.phone,
          row.handlerRegistration.tradeCategory,
          row.handlerRegistration.businessName,
          row.status,
          formatDateTime(row.issuedAt),
          formatDateTime(row.expiresAt),
        ]),
      );
    });
  }

  async certificatesXls(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.certificate.findMany({
        where: buildCertificateWhere(filters),
        orderBy: { issuedAt: 'desc' },
        take: 5000,
        include: { handlerRegistration: true },
      });
      return toExcelHtml('Certificates', ['UID', 'Handler name', 'Phone', 'Trade', 'Business', 'Status', 'Issued', 'Expires'], rows.map((row) => [
        row.uid,
        [row.handlerRegistration.firstName, row.handlerRegistration.lastName].filter(Boolean).join(' '),
        row.handlerRegistration.phone,
        row.handlerRegistration.tradeCategory,
        row.handlerRegistration.businessName,
        row.status,
        formatDateTime(row.issuedAt),
        formatDateTime(row.expiresAt),
      ]));
    });
  }

  async medicalScreeningsCsv(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.medicalScreening.findMany({
        where: buildMedicalWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { handlerRegistration: true },
      });

      return toCsv(
        [
          'uid',
          'handler_name',
          'phone',
          'trade_category',
          'screening_status',
          'fitness_status',
          'mantoux_result',
          'mantoux_induration_mm',
          'hepatitis_b_result',
          'hiv_result',
          'widal_result',
          'sample_collected_at',
          'result_entered_at',
          'reviewed_at',
          'lab_result_summary',
          'medical_officer_notes',
          'review_notes',
        ],
        rows.map((row) => [
          row.handlerRegistration.uid,
          [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
            .filter(Boolean)
            .join(' '),
          row.handlerRegistration.phone,
          row.handlerRegistration.tradeCategory,
          row.status,
          row.fitnessStatus,
          row.mantouxResult,
          row.mantouxIndurationMm === null ? null : String(row.mantouxIndurationMm),
          row.hepatitisBResult,
          row.hivResult,
          row.widalResult,
          formatDateTime(row.sampleCollectedAt),
          formatDateTime(row.enteredAt),
          formatDateTime(row.reviewedAt),
          row.labResultSummary,
          row.medicalOfficerNotes,
          row.reviewNotes,
        ]),
      );
    });
  }

  async medicalScreeningsXls(ctx: ActorContext, filters: ReportFilters = {}): Promise<string> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.medicalScreening.findMany({
        where: buildMedicalWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 5000,
        include: { handlerRegistration: true },
      });
      return toExcelHtml(
        'Medical Screenings',
        [
          'UID',
          'Handler name',
          'Phone',
          'Trade',
          'Screening status',
          'Fitness',
          'Mantoux',
          'Induration mm',
          'Hepatitis B',
          'HIV',
          'Widal',
          'Sample collected',
          'Result entered',
          'Reviewed',
        ],
        rows.map((row) => [
          row.handlerRegistration.uid,
          [row.handlerRegistration.firstName, row.handlerRegistration.lastName].filter(Boolean).join(' '),
          row.handlerRegistration.phone,
          row.handlerRegistration.tradeCategory,
          row.status,
          row.fitnessStatus,
          row.mantouxResult,
          row.mantouxIndurationMm === null ? null : String(row.mantouxIndurationMm),
          row.hepatitisBResult,
          row.hivResult,
          row.widalResult,
          formatDateTime(row.sampleCollectedAt),
          formatDateTime(row.enteredAt),
          formatDateTime(row.reviewedAt),
        ]),
      );
    });
  }

  async summaryPdf(ctx: ActorContext, filters: ReportFilters = {}): Promise<Buffer> {
    const summary = await this.summary(ctx, filters);
    return simplePdf('Darbel Compliance Summary', [
      `Generated: ${new Date().toISOString()}`,
      '',
      `Registrations: ${summary.registrations}`,
      `Drafts: ${summary.drafts}`,
      `Submitted for review: ${summary.submittedForReview}`,
      `Approved payments / UIDs: ${summary.approvedPayments}`,
      `Medical screenings: ${summary.medicalScreenings}`,
      `Medical approved: ${summary.medicalApproved}`,
      `Medical rejected: ${summary.medicalRejected}`,
      `Valid certificates: ${summary.validCertificates}`,
      `Expired certificates: ${summary.expiredCertificates}`,
      '',
      `Payment approval rate: ${summary.conversion.paymentApprovalRate}%`,
      `Medical completion rate: ${summary.conversion.medicalCompletionRate}%`,
      `Certification rate: ${summary.conversion.certificationRate}%`,
      '',
      'Top trade categories:',
      ...summary.topTradeCategories.map((item) => `${item.label}: ${item.count}`),
    ]);
  }

  async registrationsPdf(ctx: ActorContext, filters: ReportFilters = {}): Promise<Buffer> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.handlerRegistration.findMany({
        where: buildRegistrationWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: {
          uid: true,
          firstName: true,
          lastName: true,
          phone: true,
          tradeCategory: true,
          status: true,
        },
      });
      return simplePdf('Darbel Registrations Export', [
        `Generated: ${new Date().toISOString()}`,
        '',
        ...rows.map((row) =>
          [
            row.uid ?? 'NO-UID',
            [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed handler',
            row.phone ?? 'No phone',
            row.tradeCategory ?? 'No category',
            row.status,
          ].join(' | '),
        ),
      ]);
    });
  }

  async certificatesPdf(ctx: ActorContext, filters: ReportFilters = {}): Promise<Buffer> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.certificate.findMany({
        where: buildCertificateWhere(filters),
        orderBy: { issuedAt: 'desc' },
        take: 80,
        include: { handlerRegistration: true },
      });
      return simplePdf('Darbel Certificates Export', [
        `Generated: ${new Date().toISOString()}`,
        '',
        ...rows.map((row) =>
          [
            row.uid,
            [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
              .filter(Boolean)
              .join(' ') || 'Unnamed handler',
            row.handlerRegistration.tradeCategory ?? 'No category',
            row.status,
            `expires ${formatDateTime(row.expiresAt)}`,
          ].join(' | '),
        ),
      ]);
    });
  }

  async medicalScreeningsPdf(ctx: ActorContext, filters: ReportFilters = {}): Promise<Buffer> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const rows = await tx.medicalScreening.findMany({
        where: buildMedicalWhere(filters),
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: { handlerRegistration: true },
      });
      return simplePdf('Darbel Medical Screenings Export', [
        `Generated: ${new Date().toISOString()}`,
        '',
        ...rows.map((row) =>
          [
            row.handlerRegistration.uid ?? 'NO-UID',
            [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
              .filter(Boolean)
              .join(' ') || 'Unnamed handler',
            row.handlerRegistration.tradeCategory ?? 'No category',
            row.status,
            row.fitnessStatus ?? 'No fitness decision',
            `Mantoux ${row.mantouxResult ?? 'pending'}`,
            `HBV ${row.hepatitisBResult ?? 'pending'}`,
            `HIV ${row.hivResult ?? 'pending'}`,
            `Widal ${row.widalResult ?? 'pending'}`,
          ].join(' | '),
        ),
      ]);
    });
  }
}

function buildRegistrationWhere(filters: ReportFilters): Prisma.HandlerRegistrationWhereInput {
  const where: Prisma.HandlerRegistrationWhereInput = {};
  const createdAt = buildDateRange(filters);
  if (createdAt) where.createdAt = createdAt;
  if (filters.tradeCategory) where.tradeCategory = filters.tradeCategory;
  if (filters.status) where.status = filters.status;
  return where;
}

function buildCertificateWhere(filters: ReportFilters): Prisma.CertificateWhereInput {
  const where: Prisma.CertificateWhereInput = {};
  const issuedAt = buildDateRange(filters);
  if (issuedAt) where.issuedAt = issuedAt;
  if (filters.tradeCategory) {
    where.handlerRegistration = { tradeCategory: filters.tradeCategory };
  }
  if (filters.status) where.status = filters.status;
  return where;
}

function buildMedicalWhere(filters: ReportFilters): Prisma.MedicalScreeningWhereInput {
  const where: Prisma.MedicalScreeningWhereInput = {};
  const createdAt = buildDateRange(filters);
  if (createdAt) where.createdAt = createdAt;
  if (filters.tradeCategory) {
    where.handlerRegistration = { tradeCategory: filters.tradeCategory };
  }
  if (filters.status) where.status = filters.status;
  return where;
}

function buildPaymentWhere(filters: ReportFilters): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};
  const createdAt = buildDateRange(filters);
  if (createdAt) where.createdAt = createdAt;
  if (filters.tradeCategory) {
    where.handlerRegistration = { tradeCategory: filters.tradeCategory };
  }
  return where;
}

function buildDateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  const from = parseDate(filters.dateFrom);
  const to = parseDate(filters.dateTo);
  if (from) range.gte = from;
  if (to) {
    to.setHours(23, 59, 59, 999);
    range.lte = to;
  }
  return range.gte || range.lte ? range : undefined;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toCsv(headers: string[], rows: Array<Array<string | null>>): string {
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n') + '\r\n';
}

function escapeCsv(value: string | null): string {
  if (value === null) return '';
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function toExcelHtml(title: string, headers: string[], rows: Array<Array<string | null>>): string {
  const headerCells = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
    th { background: #0f5257; color: white; }
    th, td { border: 1px solid #d6d8dc; padding: 6px 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function formatDateTime(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function simplePdf(title: string, lines: string[]): Buffer {
  const escapedLines = [title, ...lines]
    .slice(0, 90)
    .map((line) => escapePdfText(line).slice(0, 110));
  const text = [
    'BT',
    '/F1 18 Tf',
    '50 780 Td',
    `(${escapedLines[0] ?? title}) Tj`,
    '/F1 10 Tf',
    ...escapedLines.slice(1).map((line) => `0 -16 Td (${line}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(text, 'utf8')} >>\nstream\n${text}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
