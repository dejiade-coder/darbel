import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { PrintButton } from './print-button';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export const metadata = { title: 'Print certificate' };

type Verification = {
  uid: string;
  handlerName: string;
  tradeCategory: string | null;
  issuedAt: string;
  expiresAt: string;
  status: string;
};

type CertificateTemplate = {
  mimeType: string;
  fileUrl: string;
  uploadedAt?: string;
  isApproved?: boolean;
  layout?: CertificateTemplateLayout;
} | null;

type CertificateTemplateLayout = {
  nameLeftPercent: number;
  nameTopPercent: number;
  nameWidthPercent: number;
  detailLeftPercent: number;
  detailTopPercent: number;
  detailWidthPercent: number;
  detailBottomPercent: number;
  detailInsetPercent: number;
  nameScale: number;
  detailScale: number;
  showVerification: boolean;
};

export default async function CertificatePrintPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const [result, template] = await Promise.all([fetchCertificate(uid), fetchTemplate()]);
  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const officerScanUrl = `${protocol}://${host}/dashboard/certificates/${encodeURIComponent(uid)}/scan`;
  const layout = normalizeLayout(template?.layout);
  const templateFileUrl = buildTemplateFileUrl(template);

  return (
    <div className="min-h-screen bg-parchment px-6 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link href="/dashboard/certificates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        {result && <PrintButton />}
      </div>

      {!result && (
        <main className="mx-auto max-w-2xl rounded-sm border border-danger/25 bg-white p-6 text-sm text-danger print:border-0">
          No certificate was found for this UID.
        </main>
      )}

      {result && template?.isApproved && template.mimeType.startsWith('image/') && (
        <main
          className="relative mx-auto min-h-[760px] max-w-5xl overflow-hidden bg-white shadow-sm print:min-h-screen print:max-w-none print:shadow-none"
          style={{
            backgroundImage: `url(${templateFileUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            className="absolute text-center"
            style={{
              left: `${layout.nameLeftPercent}%`,
              width: `${layout.nameWidthPercent}%`,
              top: `${layout.nameTopPercent}%`,
            }}
          >
            <p className="text-sm uppercase tracking-[0.18em] text-ink-500">This certifies that</p>
            <p
              className="mt-4 font-display font-medium leading-tight text-ink-950"
              style={{ fontSize: `${3.75 * (layout.nameScale / 100)}rem` }}
            >
              {result.handlerName}
            </p>
            <p className="mt-4 font-mono text-sm text-ink-700">{result.uid}</p>
          </div>
          <div
            className="absolute flex items-end justify-between gap-6 text-ink-800"
            style={{
              left: `${layout.detailLeftPercent}%`,
              top: `${layout.detailTopPercent}%`,
              width: `${layout.detailWidthPercent}%`,
              fontSize: `${0.875 * (layout.detailScale / 100)}rem`,
            }}
          >
            <div>
              <p>{result.tradeCategory || 'Not listed'}</p>
              <p>Issued {formatDate(result.issuedAt)} - Expires {formatDate(result.expiresAt)}</p>
            </div>
            {layout.showVerification && (
              <div className="flex max-w-sm items-end gap-3 text-right">
                <div className="shrink-0 bg-white p-1">
                  <QRCodeSVG value={officerScanUrl} size={72} level="M" includeMargin={false} />
                </div>
                <p className="max-w-28 text-[11px] uppercase tracking-[0.14em] text-ink-500">Officer scan only</p>
              </div>
            )}
          </div>
        </main>
      )}

      {result && template?.isApproved && template.mimeType === 'application/pdf' && (
        <main className="relative mx-auto min-h-[760px] max-w-5xl overflow-hidden bg-white shadow-sm print:min-h-screen print:max-w-none print:shadow-none">
          <iframe
            src={templateFileUrl}
            title="Approved certificate template"
            className="absolute inset-0 h-full w-full border-0"
          />
          <div
            className="absolute bg-white/75 py-6 text-center print:bg-white/80"
            style={{
              left: `${layout.nameLeftPercent}%`,
              width: `${layout.nameWidthPercent}%`,
              top: `${layout.nameTopPercent}%`,
            }}
          >
            <p className="text-sm uppercase tracking-[0.18em] text-ink-500">This certifies that</p>
            <p
              className="mt-4 font-display font-medium leading-tight text-ink-950"
              style={{ fontSize: `${3.75 * (layout.nameScale / 100)}rem` }}
            >
              {result.handlerName}
            </p>
            <p className="mt-4 font-mono text-sm text-ink-700">{result.uid}</p>
          </div>
          <div
            className="absolute flex items-end justify-between gap-6 bg-white/75 p-4 text-ink-800 print:bg-white/80"
            style={{
              left: `${layout.detailLeftPercent}%`,
              top: `${layout.detailTopPercent}%`,
              width: `${layout.detailWidthPercent}%`,
              fontSize: `${0.875 * (layout.detailScale / 100)}rem`,
            }}
          >
            <div>
              <p>{result.tradeCategory || 'Not listed'}</p>
              <p>Issued {formatDate(result.issuedAt)} - Expires {formatDate(result.expiresAt)}</p>
            </div>
            {layout.showVerification && (
              <div className="flex max-w-sm items-end gap-3 text-right">
                <div className="shrink-0 bg-white p-1">
                  <QRCodeSVG value={officerScanUrl} size={72} level="M" includeMargin={false} />
                </div>
                <p className="max-w-28 text-[11px] uppercase tracking-[0.14em] text-ink-500">Officer scan only</p>
              </div>
            )}
          </div>
        </main>
      )}

      {result && (!template?.isApproved || (!template.mimeType.startsWith('image/') && template.mimeType !== 'application/pdf')) && (
        <main className="mx-auto max-w-5xl bg-white p-10 shadow-sm print:min-h-screen print:max-w-none print:p-12 print:shadow-none">
          <section className="border-4 border-double border-ink-900 p-8">
            <div className="flex items-start justify-between gap-8 border-b border-ink-200 pb-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-ink-500">Darbel Compliance Registry</p>
                <h1 className="mt-3 font-display text-5xl font-medium text-ink-950">Food Handler Certificate</h1>
              </div>
              <div className="text-right">
                <ShieldCheck className="ml-auto h-10 w-10 text-success" />
                <p className="mt-3 font-mono text-sm text-ink-700">{result.uid}</p>
              </div>
            </div>

            <div className="py-12 text-center">
              <p className="text-sm uppercase tracking-[0.18em] text-ink-500">This certifies that</p>
              <p className="mt-5 font-display text-6xl font-medium text-ink-950">{result.handlerName}</p>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-ink-700">
                has completed the required registration, payment confirmation, and medical screening workflow for food handler compliance.
              </p>
            </div>

            <div className="grid gap-4 border-y border-ink-200 py-6 md:grid-cols-4">
              <Fact label="Trade category" value={result.tradeCategory || 'Not listed'} />
              <Fact label="Status" value={result.status} />
              <Fact label="Issued" value={formatDate(result.issuedAt)} />
              <Fact label="Expires" value={formatDate(result.expiresAt)} />
            </div>

            <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Officer scan only</p>
                <div className="mt-3 inline-block bg-white p-2">
                  <QRCodeSVG value={officerScanUrl} size={92} level="M" includeMargin={false} />
                </div>
              </div>
              <div className="min-w-56 border-t border-ink-900 pt-3 text-center">
                <p className="text-sm font-medium text-ink-900">Authorized compliance officer</p>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

async function fetchTemplate(): Promise<CertificateTemplate> {
  try {
    const hdrs = await headers();
    const cookie = hdrs.get('cookie') ?? '';
    const host = hdrs.get('host') ?? 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const res = await fetch(`${protocol}://${host}/dashboard/settings/certificate-template`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as CertificateTemplate;
  } catch {
    return null;
  }
}

async function fetchCertificate(uid: string): Promise<Verification | null> {
  try {
    const res = await fetch(`${API_BASE}/verify/${encodeURIComponent(uid)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Verification;
  } catch {
    return null;
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}

function buildTemplateFileUrl(template: CertificateTemplate): string {
  const version = template?.uploadedAt ? `?v=${encodeURIComponent(template.uploadedAt)}` : '';
  return `/dashboard/settings/certificate-template/file${version}`;
}

const DEFAULT_LAYOUT: CertificateTemplateLayout = {
  nameLeftPercent: 12,
  nameTopPercent: 34,
  nameWidthPercent: 76,
  detailLeftPercent: 10,
  detailTopPercent: 78,
  detailWidthPercent: 80,
  detailBottomPercent: 12,
  detailInsetPercent: 10,
  nameScale: 100,
  detailScale: 100,
  showVerification: true,
};

function normalizeLayout(layout: Partial<CertificateTemplateLayout> | undefined): CertificateTemplateLayout {
  const legacyInset = layout?.detailInsetPercent ?? DEFAULT_LAYOUT.detailInsetPercent;
  const detailLeftPercent = layout?.detailLeftPercent ?? legacyInset;
  const detailWidthPercent = layout?.detailWidthPercent ?? 100 - legacyInset * 2;
  return {
    nameLeftPercent: layout?.nameLeftPercent ?? DEFAULT_LAYOUT.nameLeftPercent,
    nameTopPercent: layout?.nameTopPercent ?? DEFAULT_LAYOUT.nameTopPercent,
    nameWidthPercent: layout?.nameWidthPercent ?? DEFAULT_LAYOUT.nameWidthPercent,
    detailLeftPercent,
    detailTopPercent: layout?.detailTopPercent ?? 100 - (layout?.detailBottomPercent ?? DEFAULT_LAYOUT.detailBottomPercent) - 10,
    detailWidthPercent,
    detailBottomPercent: layout?.detailBottomPercent ?? DEFAULT_LAYOUT.detailBottomPercent,
    detailInsetPercent: layout?.detailInsetPercent ?? DEFAULT_LAYOUT.detailInsetPercent,
    nameScale: layout?.nameScale ?? DEFAULT_LAYOUT.nameScale,
    detailScale: layout?.detailScale ?? DEFAULT_LAYOUT.detailScale,
    showVerification: layout?.showVerification ?? DEFAULT_LAYOUT.showVerification,
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}
