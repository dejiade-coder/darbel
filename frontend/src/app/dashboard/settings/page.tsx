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
import { changePasswordAction, startMfaEnrollAction, confirmMfaEnrollAction, disableMfaAction, updateMessageTemplatesAction, updateNotificationProvidersAction } from './actions';
import { Alert } from '@/components/ui/alert';

export const metadata = { title: 'My account' };

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

export default async function SettingsPage() {
  const actor = await readActorFromAccessToken();
  if (!actor) return null;

  let me: UserPublic | null = null;
  let certificateTemplate: CertificateTemplate = null;
  let notificationProviders: NotificationProviders | null = null;
  let messageTemplates: MessageTemplates | null = null;
  let loadError: string | null = null;
  try {
    const [profile, template, providers, templates] = await Promise.all([
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
    ]);
    me = profile;
    certificateTemplate = template;
    notificationProviders = providers;
    messageTemplates = templates;
  } catch (e) {
    loadError = e instanceof ApiError ? e.payload.message : 'Could not load profile';
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="My account"
        description="Manage your password and multi-factor authentication. Changing your password signs out all other sessions."
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
