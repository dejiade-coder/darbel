# Darbel Backup And Restore Runbook

Darbel stores critical data in two places:

- PostgreSQL database: tenants, users, registrations, payments, medical screenings, certificates, audit logs, and tenant settings.
- Upload storage: handler documents and certificate templates.

Back up both on the same schedule.

## Backup Schedule

Recommended minimum:

- Daily full PostgreSQL dump.
- Daily upload storage archive.
- Weekly restore rehearsal into staging.
- Retain at least 30 daily backups and 12 monthly backups.

## PostgreSQL Backup

Run the backup helper from a secure machine that can reach the database:

```powershell
.\scripts\backup-darbel.ps1 `
  -DatabaseHost "<db-host>" `
  -DatabaseName "darbel" `
  -DatabaseUser "darbel_migrator" `
  -DatabasePassword "<migrator-or-backup-role-password>" `
  -StoragePath "backend/storage" `
  -OutputDirectory "D:\darbel-backups"
```

The script creates a timestamped folder containing the PostgreSQL custom-format dump, upload-storage archive, and a manifest. Encrypt and move the folder to offsite storage immediately.

## Upload Storage Backup

For local durable disk storage, the backup helper archives `backend/storage` together with the database dump. To run storage-only manually:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Compress-Archive `
  -Path "backend/storage/*" `
  -DestinationPath "darbel-storage-$stamp.zip"
```

For S3-compatible storage, use the provider's versioning, lifecycle, and replication features.

## Restore To Staging

Create an empty staging database first.

```powershell
.\scripts\restore-darbel.ps1 `
  -DatabaseHost "<staging-db-host>" `
  -DatabaseName "darbel_staging" `
  -DatabaseUser "darbel_migrator" `
  -DatabasePassword "<migrator-password>" `
  -DatabaseDumpPath "D:\darbel-backups\darbel-YYYYMMDD-HHMMSS\darbel-db-YYYYMMDD-HHMMSS.dump" `
  -StorageArchivePath "D:\darbel-backups\darbel-YYYYMMDD-HHMMSS\darbel-storage-YYYYMMDD-HHMMSS.zip" `
  -StoragePath "backend/storage"
```

Then run the app against staging and verify:

1. Tenant admin can sign in.
2. Existing registrations load.
3. Uploaded documents can be opened.
4. Certificate templates preview correctly.
5. Public certificate verification works.
6. Reports export successfully.

## Production Disaster Recovery

1. Stop frontend and backend services.
2. Restore the database backup into a fresh database.
3. Restore storage backup to the production storage mount.
4. Point environment variables to the restored database/storage.
5. Start backend.
6. Start frontend.
7. Run the post-restore verification list above.

## Security Notes

- Treat backups as sensitive medical/compliance data.
- Encrypt backups at rest.
- Restrict restore credentials to senior operators.
- Test backup integrity regularly; an untested backup is only a hopeful file.
