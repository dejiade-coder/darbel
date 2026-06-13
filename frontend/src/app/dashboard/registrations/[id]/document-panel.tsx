'use client';

import { useState } from 'react';
import { FileUp, ShieldCheck, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  uploadDocumentAction,
  type DocumentType,
  type RegistrationDocument,
} from './document-actions';

const documentLabels: Record<DocumentType, string> = {
  PHOTOGRAPH: 'Photograph',
  GOVERNMENT_ID: 'Government ID',
  PRIOR_CERTIFICATE: 'Prior certificate',
};

export function DocumentPanel({
  registrationId,
  canUploadDocuments,
  documents,
}: {
  registrationId: string;
  canUploadDocuments: boolean;
  documents: RegistrationDocument[];
}) {
  const [documentType, setDocumentType] = useState<DocumentType>('PHOTOGRAPH');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function uploadDocument() {
    if (!file) {
      setNotice({ type: 'error', message: 'Choose a JPEG, PNG, or PDF document.' });
      return;
    }

    const formData = new FormData();
    formData.set('documentType', documentType);
    formData.set('file', file);
    formData.set('notes', notes);

    setIsUploading(true);
    try {
      const saved = await uploadDocumentAction(registrationId, formData);
      setFile(null);
      setNotes('');
      const input = document.getElementById('documentFile') as HTMLInputElement | null;
      if (input) input.value = '';
      setNotice({
        type: 'success',
        message: `${documentLabels[saved.documentType]} uploaded.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload document.',
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-ink-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px] bg-[#0f766e]/10 text-[#0f766e]">
            <FileUp className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink-900">Documents</h2>
            <p className="mt-1 text-sm text-ink-600">Upload intake documents for this registration.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {!canUploadDocuments && (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              You can view document history, but you do not have permission to upload documents.
            </div>
          )}
          {notice && (
            <div
              className={`rounded-[8px] border p-4 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
              role="status"
            >
              {notice.message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="documentType" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Document type</Label>
              <select
                id="documentType"
                value={documentType}
                disabled={!canUploadDocuments}
                onChange={(event) => setDocumentType(event.target.value as DocumentType)}
                className="mt-2 flex h-11 w-full rounded-[8px] border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 disabled:bg-ink-50"
              >
                <option value="PHOTOGRAPH">Photograph</option>
                <option value="GOVERNMENT_ID">Government ID</option>
                <option value="PRIOR_CERTIFICATE">Prior certificate</option>
              </select>
            </div>
            <div>
              <Label htmlFor="documentFile" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">File</Label>
              <input
                id="documentFile"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={!canUploadDocuments}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-2 block w-full rounded-[8px] border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 file:mr-3 file:rounded-[6px] file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink-800 hover:file:bg-ink-200 disabled:opacity-60"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="documentNotes" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Notes</Label>
              <textarea
                id="documentNotes"
                rows={3}
                value={notes}
                disabled={!canUploadDocuments}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 w-full rounded-[8px] border border-ink-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15 disabled:bg-ink-50"
                placeholder="Optional document notes"
              />
            </div>
          </div>

          <button type="button" onClick={uploadDocument} disabled={!canUploadDocuments || isUploading} className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[#0f766e] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b5f59] disabled:opacity-60">
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload document'}
          </button>
        </div>

        <aside className="rounded-[8px] border border-ink-200 bg-ink-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <ShieldCheck className="h-4 w-4 text-[#0f766e]" />
            Document history
          </div>
          <div className="mt-4 space-y-3">
            {documents.length === 0 && (
              <p className="text-sm text-ink-500">No documents uploaded yet.</p>
            )}
            {documents.map((document) => (
              <div key={document.id} className="rounded-[8px] border border-ink-200 bg-white p-3 text-sm">
                <p className="font-semibold text-ink-900">{documentLabels[document.documentType]}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {document.originalFilename || 'Uploaded file'} - {formatBytes(Number(document.sizeBytes))}
                </p>
                <p className="mt-1 text-xs text-ink-500">{formatDate(document.uploadedAt)}</p>
                <p className="mt-2 break-all font-mono text-[11px] text-ink-500">
                  {document.sha256Hash.slice(0, 16)}...
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

