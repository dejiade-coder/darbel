import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/medical-screenings.csv',
    'darbel-medical-screenings.csv',
    'text/csv',
  );
}
