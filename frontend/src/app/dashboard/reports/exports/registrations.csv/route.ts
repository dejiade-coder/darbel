import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/registrations.csv',
    'darbel-registrations.csv',
    'text/csv',
  );
}
