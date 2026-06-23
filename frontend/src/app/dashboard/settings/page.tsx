import { readActorFromAccessToken } from '@/lib/auth/claims';
import { apiFetch, ApiError } from '@/lib/api/server-client';
import type { UserPublic } from '@/lib/api/types';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChangePasswordCard } from './change-password-card';
import { MfaCard } from './mfa-card';
import { CertificateTemplateCard } from './certificate-template-card';
import { NotificationProvidersCard, type NotificationProviders } from './notification-providers-card';
import { MessageTemplatesCard, type MessageTemplates } from './message-templates-card';
import { changePasswordAction, startMfaEnrollAction, confirmMfaEnrollAction, disableMfaAction, updateBrandingAction, updateMessageTemplatesAction, updateNotificationProvidersAction } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Settings' };

type CertificateTemplate = {
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  approvedAt: string;
  isApproved: boolean;
  layout: {
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
  signatures?: {
    hod: {
      label: string;
      originalFilename: string | null;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
      fileUrl: string;
    } | null;
    deputyHod: {
      label: string;
      originalFilename: string | null;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
      fileUrl: string;
    } | null;
  };
  fileUrl: string;
} | null;
type Branding = { applicationName: string; accentColor: string };

export default async function SettingsPage() {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;
  if (!actor.permissions.includes('tenant.update_own')) redirect('/dashboard');

  let me: UserPublic | null = null;
  let certificateTemplate: CertificateTemplate = null;
  let notificationProviders: NotificationProviders | null = null;
  let messageTemplates: MessageTemplates | null = null;
  let loadError: string | null = null;
  let branding: Branding = { applicationName: 'Darbel', accentColor: '#0f5257' };
  try {
    const [profile, template, providers, templates, currentBranding] = await Promise.all([
      apiFetch<UserPublic>('/users/me', { authenticated: true }),
      actor.permissions.includes('tenant.view')
        ? apiFetch<CertificateTemplate>('/tenant-settings/certificate-template', { authenticated: true })
        : Promise.resolve(null),
      actor.permissions.includes('tenant.view')
        ? apiFetch<NotificationProviders>('/tenant-settings/notification-providers', { authenticated: true })
        : Promise.resolve(null),
      actor.permissions.includes('tenant.view')
        ? apiFetch<MessageTemplates>('/tenant-settings/message-templates', { authenticated: true })
        : Promise.resolve(null),
      actor.permissions.includes('tenant.view') ? apiFetch<Branding>('/tenant-settings/branding', { authenticated: true }) : Promise.resolve(branding),
    ]);
    me = profile;
    certificateTemplate = template;
    notificationProviders = providers;
    messageTemplates = templates;
    branding = currentBranding;
  } catch (e) {
    loadError = e instanceof ApiError ? e.payload.message : 'Could not load profile';
  }

  return (
    <>
      <PageHeader
        eyebrow="Operator and tenant setup"
        title="Settings"
        description="Manage your account security, certificate template, provider settings, and applicant message templates from one place."
      />

      {loadError && (
        <Alert variant="danger" title="Could not load profile">
          {loadError}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Signed-in operator identity and assigned roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Full name" value={me?.fullName ?? '-'} />
            <Row label="Email" value={actor.email} mono />
            <Row label="Phone" value={me?.phone ?? '-'} mono />
            <Row
              label="Roles"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {me?.roles.map((r) => (
                    <Badge key={r.code} variant="accent">
                      {r.displayName}
                    </Badge>
                  )) ?? '—'}
                </div>
              }
            />
          </CardContent>
        </Card>

        <ChangePasswordCard action={changePasswordAction} />

        <MfaCard
          enabled={me?.mfaEnabled ?? false}
          startAction={startMfaEnrollAction}
          confirmAction={confirmMfaEnrollAction}
          disableAction={disableMfaAction}
        />

        {actor.permissions.includes('tenant.update_own') && (
          <form action={updateBrandingAction} className="rounded-sm border border-ink-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-ink-900">Organization branding</h2><p className="mt-1 text-sm text-ink-600">Set the identity your staff see in this tenant workspace.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_110px]"><Input name="applicationName" defaultValue={branding.applicationName} required /><Input name="accentColor" type="color" defaultValue={branding.accentColor} title="Accent color" /></div>
            <div className="mt-4 flex justify-end"><Button type="submit">Save branding</Button></div>
          </form>
        )}

        {actor.permissions.includes('tenant.update_own') && (
          <CertificateTemplateCard initialTemplate={certificateTemplate} />
        )}

        {actor.permissions.includes('tenant.update_own') && notificationProviders && (
          <NotificationProvidersCard
            initialSettings={notificationProviders}
            action={updateNotificationProvidersAction}
          />
        )}

        {actor.permissions.includes('tenant.update_own') && messageTemplates && (
          <MessageTemplatesCard
            initialTemplates={messageTemplates}
            action={updateMessageTemplatesAction}
          />
        )}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-500">{label}</span>
      <span className={mono ? 'font-mono text-ink-800' : 'text-ink-800'}>{value}</span>
    </div>
  );
}
