# Darbel Operations Readiness

This checklist covers the items to verify before a tenant goes live.

## Deployment

- Run database migrations with `npm.cmd run prisma:migrate:deploy` from `backend`.
- Build the backend with `npm.cmd run build` from `backend`.
- Build the frontend with `npm.cmd run build` from `frontend`.
- Configure production environment variables for database access, JWT secrets, refresh-token secrets, CORS origin, and the public frontend/API URLs.
- Serve uploaded files from durable storage. The local `backend/storage` directory is fine for development only.

## Backup And Restore

- Schedule a daily PostgreSQL backup with tenant data, audit logs, payments, registrations, screenings, certificates, and tenant settings.
- Back up uploaded documents and certificate templates together with the database snapshot.
- Test restore into a staging database before trusting the backup plan.
- Keep at least one offsite encrypted backup copy.

## Security

- Require strong operator passwords and MFA for tenant admins.
- Rotate JWT and refresh secrets through the hosting environment, not source control.
- Keep audit logs append-only and review unusual payment approval, medical approval, and certificate issuance activity.
- Verify tenant isolation after every migration or query touching tenant-scoped data.

## UAT Workflow

1. Create a new handler registration.
2. Continue directly to payment from the form.
3. Let the registrar record and approve payment.
4. Confirm the UID is issued.
5. Confirm the handler appears in medical screening.
6. Collect sample and enter Mantoux, Hepatitis B, HIV, and Widal results.
7. Approve only FIT medical results for certification.
8. Print the certificate using the approved tenant template.
9. Verify the public UID page.
10. Export registration, medical screening, and certificate reports in CSV, Excel, and PDF.

## Certificate Template

- Upload the approved sample from Settings.
- Adjust name and detail placement using the layout controls.
- Print one test certificate before issuing production certificates.
- Keep the verification link visible unless the physical certificate already contains a QR or verification area.
