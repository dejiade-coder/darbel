import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/certificates.xls',
    'darbel-certificates.xls',
    'application/vnd.ms-excel',
  );
}
