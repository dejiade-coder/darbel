import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/certificates.pdf',
    'darbel-certificates.pdf',
    'application/pdf',
  );
}
