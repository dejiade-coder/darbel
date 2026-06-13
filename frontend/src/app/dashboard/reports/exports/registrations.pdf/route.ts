import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/registrations.pdf',
    'darbel-registrations.pdf',
    'application/pdf',
  );
}
