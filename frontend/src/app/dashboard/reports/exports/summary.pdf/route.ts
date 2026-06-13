import { proxyExport } from '../proxy';

export async function GET(request: Request) {
  return proxyExport(
    request,
    '/reports/exports/summary.pdf',
    'darbel-compliance-summary.pdf',
    'application/pdf',
  );
}
