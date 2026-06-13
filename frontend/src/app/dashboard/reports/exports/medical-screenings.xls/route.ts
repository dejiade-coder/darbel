import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/medical-screenings.xls',
    'darbel-medical-screenings.xls',
    'application/vnd.ms-excel',
  );
}
