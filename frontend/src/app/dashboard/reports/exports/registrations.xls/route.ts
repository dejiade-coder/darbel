import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/registrations.xls',
    'darbel-registrations.xls',
    'application/vnd.ms-excel',
  );
}
