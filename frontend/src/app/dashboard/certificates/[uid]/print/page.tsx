import Link from 'next/link';
import { headers } from 'next/headers';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import { PrintButton } from './print-button';

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
  signatures?: CertificateTemplateSignatures;
} | null;

type CertificateTemplateSignature = {
  label: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  fileUrl: string;
};

type CertificateTemplateSignatures = {
  hod: CertificateTemplateSignature | null;
  deputyHod: CertificateTemplateSignature | null;
};

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
  signatureLeftPercent: number;
  signatureTopPercent: number;
  signatureWidthPercent: number;
  signatureScale: number;
  showName: boolean;
  showTradeCategory: boolean;
  showIssuedDate: boolean;
  showExpiryDate: boolean;
  showUid: boolean;
  showOfficerScanLabel: boolean;
  showStatus: boolean;
  showSignatures: boolean;
  showSignatureLabels: boolean;
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
  const signatures = template?.signatures ?? { hod: null, deputyHod: null };

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
            {layout.showName && (
              <p
                className="font-display font-medium leading-tight text-ink-950"
                style={{ fontSize: `${3.75 * (layout.nameScale / 100)}rem` }}
              >
                {result.handlerName}
              </p>
            )}
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
              {layout.showTradeCategory && <p>{result.tradeCategory || 'Not listed'}</p>}
              {(layout.showIssuedDate || layout.showExpiryDate) && (
                <p>
                  {layout.showIssuedDate && `Issued ${formatDate(result.issuedAt)}`}
                  {layout.showIssuedDate && layout.showExpiryDate && ' - '}
                  {layout.showExpiryDate && `Expires ${formatDate(result.expiresAt)}`}
                </p>
              )}
            </div>
            {layout.showVerification && (
              <div className="flex max-w-sm items-end gap-3 text-right">
                <div className="shrink-0 bg-white p-1">
                  <QRCodeSVG value={officerScanUrl} size={72} level="M" includeMargin={false} />
                </div>
                <div className="max-w-32">
                  {layout.showUid && <p className="font-mono text-xs text-ink-700">{result.uid}</p>}
                  {layout.showOfficerScanLabel && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-500">Officer scan only</p>}
                </div>
              </div>
            )}
          </div>
          {layout.showSignatures && <SignatureOverlay layout={layout} signatures={signatures} />}
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
            {layout.showName && (
              <p
                className="font-display font-medium leading-tight text-ink-950"
                style={{ fontSize: `${3.75 * (layout.nameScale / 100)}rem` }}
              >
                {result.handlerName}
              </p>
            )}
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
              {layout.showTradeCategory && <p>{result.tradeCategory || 'Not listed'}</p>}
              {(layout.showIssuedDate || layout.showExpiryDate) && (
                <p>
                  {layout.showIssuedDate && `Issued ${formatDate(result.issuedAt)}`}
                  {layout.showIssuedDate && layout.showExpiryDate && ' - '}
                  {layout.showExpiryDate && `Expires ${formatDate(result.expiresAt)}`}
                </p>
              )}
            </div>
            {layout.showVerification && (
              <div className="flex max-w-sm items-end gap-3 text-right">
                <div className="shrink-0 bg-white p-1">
                  <QRCodeSVG value={officerScanUrl} size={72} level="M" includeMargin={false} />
                </div>
                <div className="max-w-32">
                  {layout.showUid && <p className="font-mono text-xs text-ink-700">{result.uid}</p>}
                  {layout.showOfficerScanLabel && <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-500">Officer scan only</p>}
                </div>
              </div>
            )}
          </div>
          {layout.showSignatures && <SignatureOverlay layout={layout} signatures={signatures} panel />}
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
                {layout.showUid && <p className="mt-3 font-mono text-sm text-ink-700">{result.uid}</p>}
              </div>
            </div>

            <div className="py-12 text-center">
              {layout.showName && <p className="font-display text-6xl font-medium text-ink-950">{result.handlerName}</p>}
              <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-ink-700">
                has completed the required registration, payment confirmation, and medical screening workflow for food handler compliance.
              </p>
            </div>

            <div className="grid gap-4 border-y border-ink-200 py-6 md:grid-cols-4">
              {layout.showTradeCategory && <Fact label="Trade category" value={result.tradeCategory || 'Not listed'} />}
              {layout.showStatus && <Fact label="Status" value={result.status} />}
              {layout.showIssuedDate && <Fact label="Issued" value={formatDate(result.issuedAt)} />}
              {layout.showExpiryDate && <Fact label="Expires" value={formatDate(result.expiresAt)} />}
            </div>

            {layout.showSignatures && <SignatureRow signatures={signatures} showLabels={layout.showSignatureLabels} />}

            <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                {layout.showOfficerScanLabel && <p className="text-[11px] uppercase tracking-[0.16em] text-ink-500">Officer scan only</p>}
                {layout.showUid && <p className="mt-2 font-mono text-sm text-ink-700">{result.uid}</p>}
                {layout.showVerification && (
                  <div className="mt-3 inline-block bg-white p-2">
                    <QRCodeSVG value={officerScanUrl} size={92} level="M" includeMargin={false} />
                  </div>
                )}
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
    const result = await apiFetch<{ items: Verification[] }>(
      `/certificates?q=${encodeURIComponent(uid)}`,
      { authenticated: true },
    );
    return result.items.find((item) => item.uid.toUpperCase() === uid.toUpperCase()) ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
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

function SignatureOverlay({
  layout,
  signatures,
  panel = false,
}: {
  layout: CertificateTemplateLayout;
  signatures: CertificateTemplateSignatures;
  panel?: boolean;
}) {
  if (!signatures.hod && !signatures.deputyHod) return null;
  return (
    <div
      className={`absolute grid grid-cols-2 gap-8 text-center text-ink-900 ${panel ? 'bg-white/75 p-4 print:bg-white/80' : ''}`}
      style={{
        left: `${layout.signatureLeftPercent}%`,
        top: `${layout.signatureTopPercent}%`,
        width: `${layout.signatureWidthPercent}%`,
        fontSize: `${0.875 * (layout.signatureScale / 100)}rem`,
      }}
    >
      <PrintedSignature slot="hod" signature={signatures.hod} showLabel={layout.showSignatureLabels} />
      <PrintedSignature slot="deputyHod" signature={signatures.deputyHod} showLabel={layout.showSignatureLabels} />
    </div>
  );
}

function SignatureRow({ signatures, showLabels }: { signatures: CertificateTemplateSignatures; showLabels: boolean }) {
  if (!signatures.hod && !signatures.deputyHod) return null;
  return (
    <div className="mt-8 grid gap-10 text-center md:grid-cols-2">
      <PrintedSignature slot="hod" signature={signatures.hod} showLabel={showLabels} />
      <PrintedSignature slot="deputyHod" signature={signatures.deputyHod} showLabel={showLabels} />
    </div>
  );
}

function PrintedSignature({
  slot,
  signature,
  showLabel,
}: {
  slot: keyof CertificateTemplateSignatures;
  signature: CertificateTemplateSignature | null;
  showLabel: boolean;
}) {
  const label = slot === 'hod' ? 'HOD' : 'Dep. HOD';
  return (
    <div>
      <div className="flex h-16 items-end justify-center">
        {signature && (
          <img
            src={signatureFileUrl(slot, signature.uploadedAt)}
            alt={`${label} signature`}
            className="max-h-16 max-w-full object-contain"
          />
        )}
      </div>
      {showLabel && (
        <div className="mt-2 border-t border-ink-900 pt-2">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-700">{label}</p>
        </div>
      )}
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
  signatureLeftPercent: 18,
  signatureTopPercent: 66,
  signatureWidthPercent: 64,
  signatureScale: 100,
  showName: true,
  showTradeCategory: true,
  showIssuedDate: true,
  showExpiryDate: true,
  showUid: true,
  showOfficerScanLabel: true,
  showStatus: true,
  showSignatures: true,
  showSignatureLabels: true,
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
    signatureLeftPercent: layout?.signatureLeftPercent ?? DEFAULT_LAYOUT.signatureLeftPercent,
    signatureTopPercent: layout?.signatureTopPercent ?? DEFAULT_LAYOUT.signatureTopPercent,
    signatureWidthPercent: layout?.signatureWidthPercent ?? DEFAULT_LAYOUT.signatureWidthPercent,
    signatureScale: layout?.signatureScale ?? DEFAULT_LAYOUT.signatureScale,
    showName: layout?.showName ?? DEFAULT_LAYOUT.showName,
    showTradeCategory: layout?.showTradeCategory ?? DEFAULT_LAYOUT.showTradeCategory,
    showIssuedDate: layout?.showIssuedDate ?? DEFAULT_LAYOUT.showIssuedDate,
    showExpiryDate: layout?.showExpiryDate ?? DEFAULT_LAYOUT.showExpiryDate,
    showUid: layout?.showUid ?? DEFAULT_LAYOUT.showUid,
    showOfficerScanLabel: layout?.showOfficerScanLabel ?? DEFAULT_LAYOUT.showOfficerScanLabel,
    showStatus: layout?.showStatus ?? DEFAULT_LAYOUT.showStatus,
    showSignatures: layout?.showSignatures ?? DEFAULT_LAYOUT.showSignatures,
    showSignatureLabels: layout?.showSignatureLabels ?? DEFAULT_LAYOUT.showSignatureLabels,
    showVerification: layout?.showVerification ?? DEFAULT_LAYOUT.showVerification,
  };
}

function signatureFileUrl(slot: keyof CertificateTemplateSignatures, uploadedAt: string): string {
  return `/dashboard/settings/certificate-template/signatures/${slot}/file?v=${encodeURIComponent(uploadedAt)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
}
