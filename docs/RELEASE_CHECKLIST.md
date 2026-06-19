# Darbel Release Checklist

Run this checklist before handing Darbel to a tenant for real operational use.

## 1. Local Verification

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\dev-start.ps1 -Restart
powershell.exe -ExecutionPolicy Bypass -File scripts\release-check.ps1
```

For a full workflow smoke test, set credentials for a privileged non-production user:

```powershell
$env:DARBEL_ADMIN_EMAIL = "admin@branddarrow.com"
$env:DARBEL_ADMIN_PASSWORD = "<password>"
powershell.exe -ExecutionPolicy Bypass -File scripts\release-check.ps1 -RunSmokeWorkflow
```

The workflow smoke test verifies:

- Login.
- Registration submission.
- Payment recording.
- Registrar payment approval.
- Medical sample collection.
- Mantoux, Hepatitis B, HIV, and Widal result entry.
- FIT medical approval.
- Certificate creation.
- CSV, Excel, and PDF report exports.

## 2. Production Database

- Confirm `DATABASE_URL` uses the `darbel_app` role.
- Confirm `DATABASE_AUTH_URL` uses the `darbel_auth` role.
- Confirm migrations run with the `darbel_migrator` role.
- Run `npm.cmd run prisma:migrate:deploy` from `backend` with `DATABASE_URL` temporarily pointed to the migrator URL.
- Run `npx.cmd prisma validate`.
- Confirm backups are enabled before first live registration.

## 3. Production Secrets

- Rotate all local placeholder passwords.
- Set a strong `JWT_SECRET`.
- Configure SMTP only with production credentials.
- Configure WhatsApp Business API only with production credentials.
- Store secrets outside Git.

## 4. Tenant Setup

- Create or confirm the production tenant.
- Create the tenant admin user.
- Confirm role assignments for registrar, medical officer, and certificate officers.
- Upload the tenant certificate template.
- Upload HOD and Deputy HOD signatures if required.
- Place certificate fields with the drag-and-drop template editor.
- Print one test certificate and scan the protected barcode as an authorized officer.

## 5. Browser QA

- Create a new registration.
- Move from registration to payment without finance delay.
- Approve payment as registrar.
- Confirm the approved handler appears in the medical queue.
- Collect sample.
- Enter all required test results.
- Approve FIT result.
- Print certificate.
- Submit a revoked certificate appeal.
- Approve and reject sample appeals.
- Export reports as PDF, Excel, and CSV.

## 6. Operational Readiness

- Confirm backup script runs successfully.
- Confirm restore script has been tested on a staging database.
- Confirm health checks are monitored.
- Confirm error logs are being collected.
- Tag a GitHub release after final acceptance.
