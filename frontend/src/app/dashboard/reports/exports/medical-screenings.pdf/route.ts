import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/medical-screenings.pdf',
    'darbel-medical-screenings.pdf',
    'application/pdf',
  );
}
