import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/certificates.csv',
    'darbel-certificates.csv',
    'text/csv',
  );
}
