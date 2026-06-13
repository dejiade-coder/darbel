'use client';

import { useRef, useState } from 'react';
import type React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, FileUp, Grip, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Template = {
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  approvedAt: string;
  isApproved: boolean;
  layout: TemplateLayout;
  fileUrl: string;
} | null;

type TemplateLayout = {
  nameLeftPercent: number;
  nameTopPercent: number;
  nameWidthPercent: number;
  detailLeftPercent: number;
  detailTopPercent: number;
  detailWidthPercent: number;
  detailBottomPercent: number;
  detailInsetPercent: number;
  nameScale: number;
  detailScale: number;
  showVerification: boolean;
};

type DragTarget = 'name' | 'details';

export function CertificateTemplateCard({ initialTemplate }: { initialTemplate: Template }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layout, setLayout] = useState<TemplateLayout>(normalizeLayout(initialTemplate?.layout ?? DEFAULT_LAYOUT));
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage('Choose a PNG, JPEG, or PDF template first.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/dashboard/settings/certificate-template', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Template upload failed');
      setTemplate(data);
      setLayout(normalizeLayout(data.layout ?? DEFAULT_LAYOUT));
      setMessage('Certificate template uploaded.');
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Template upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveLayout() {
    if (!template) {
      setMessage('Upload an approved certificate template before saving layout.');
      return;
    }
    setSavingLayout(true);
    setMessage('');
    try {
      const res = await fetch('/dashboard/settings/certificate-template', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(layout),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Could not save certificate layout');
      setTemplate(data);
      setLayout(normalizeLayout(data.layout ?? layout));
      setMessage('Certificate layout saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save certificate layout');
    } finally {
      setSavingLayout(false);
    }
  }

  function updateLayout<K extends keyof TemplateLayout>(key: K, value: TemplateLayout[K]) {
    setLayout((current) => normalizeLayout({ ...current, [key]: value }));
  }

  function moveBlock(target: DragTarget, clientX: number, clientY: number) {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setLayout((current) => {
      if (target === 'name') {
        return normalizeLayout({
          ...current,
          nameLeftPercent: x - current.nameWidthPercent / 2,
          nameTopPercent: y - 6,
        });
      }
      return normalizeLayout({
        ...current,
        detailLeftPercent: x - current.detailWidthPercent / 2,
        detailTopPercent: y - 5,
        detailBottomPercent: Math.max(5, Math.round(100 - y - 8)),
        detailInsetPercent: Math.max(5, Math.round(x - current.detailWidthPercent / 2)),
      });
    });
  }

  function startDrag(target: DragTarget) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      moveBlock(target, event.clientX, event.clientY);
    };
  }

  function continueDrag(target: DragTarget) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.buttons !== 1) return;
      moveBlock(target, event.clientX, event.clientY);
    };
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    setMessage('Layout reset. Save to apply this placement.');
  }

  function nudgeBlock(target: DragTarget, dx: number, dy: number) {
    setLayout((current) => {
      if (target === 'name') {
        return normalizeLayout({
          ...current,
          nameLeftPercent: current.nameLeftPercent + dx,
          nameTopPercent: current.nameTopPercent + dy,
        });
      }
      return normalizeLayout({
        ...current,
        detailLeftPercent: current.detailLeftPercent + dx,
        detailTopPercent: current.detailTopPercent + dy,
        detailBottomPercent: Math.max(5, current.detailBottomPercent - dy),
        detailInsetPercent: Math.max(0, current.detailInsetPercent + dx),
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approved Certificate Template</CardTitle>
        <CardDescription>
          Import the approved certificate sample. New printed certificates will place the handler name, UID, dates, and verification link over this template.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-sm border border-ink-200 bg-ink-50 p-4">
          <div className="flex items-start gap-3">
            <ImageIcon className="mt-0.5 h-4 w-4 text-accent" />
            <div className="text-sm">
              <p className="font-medium text-ink-900">
                {template?.originalFilename ?? 'No template uploaded yet'}
              </p>
              {template && (
                <p className="mt-1 text-xs text-ink-500">
                  {template.mimeType} - {Math.round(template.sizeBytes / 1024)} KB - approved {formatDate(template.approvedAt ?? template.uploadedAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,application/pdf" className="block w-full text-sm text-ink-700" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={upload} disabled={busy}>
            <FileUp className="mr-2 h-4 w-4" />
            {busy ? 'Uploading...' : 'Upload and approve'}
          </Button>
          {template && (
            <Button asChild type="button" variant="outline">
              <a href="/dashboard/settings/certificate-template/file" target="_blank">Preview</a>
            </Button>
          )}
        </div>
        {message && <p className="text-sm text-ink-600">{message}</p>}

        {template && (
          <div className="grid gap-5 border-t border-ink-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">Live certificate overlay editor</p>
              <p className="mt-1 text-xs text-ink-500">Drag the name and details blocks on the preview. Use the sliders for width and text size, then save.</p>
            </div>

            <div
              ref={previewRef}
              className="relative aspect-[1.414/1] overflow-hidden rounded-sm border border-ink-200 bg-white shadow-inner"
              style={{
                backgroundImage: template.mimeType.startsWith('image/') ? 'url(/dashboard/settings/certificate-template/file)' : undefined,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }}
            >
              {template.mimeType === 'application/pdf' && (
                <iframe
                  src="/dashboard/settings/certificate-template/file"
                  title="Certificate template preview"
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
              <div className="absolute inset-0 bg-white/10" />
              <DraggableBlock
                label="Name"
                className="text-center"
                style={{
                  left: `${layout.nameLeftPercent}%`,
                  top: `${layout.nameTopPercent}%`,
                  width: `${layout.nameWidthPercent}%`,
                }}
                onPointerDown={startDrag('name')}
                onPointerMove={continueDrag('name')}
              >
                <p className="text-[8px] uppercase tracking-[0.18em] text-ink-500">This certifies that</p>
                <p
                  className="mt-1 truncate font-display font-medium leading-tight text-ink-950"
                  style={{ fontSize: `${1.8 * (layout.nameScale / 100)}rem` }}
                >
                  Sample Handler Name
                </p>
                <p className="mt-1 font-mono text-[10px] text-ink-700">BBH-SAMPLE-1</p>
              </DraggableBlock>
              <DraggableBlock
                label="Details"
                style={{
                  left: `${layout.detailLeftPercent}%`,
                  top: `${layout.detailTopPercent}%`,
                  width: `${layout.detailWidthPercent}%`,
                }}
                onPointerDown={startDrag('details')}
                onPointerMove={continueDrag('details')}
              >
                <div
                  className="flex items-end justify-between gap-3 text-ink-800"
                  style={{ fontSize: `${0.72 * (layout.detailScale / 100)}rem` }}
                >
                  <div>
                    <p>Food Vendor</p>
                    <p>Issued 12 June 2026 - Expires 12 June 2027</p>
                  </div>
                  {layout.showVerification && (
                    <div className="flex max-w-[48%] items-end gap-2 text-right">
                      <div className="shrink-0 bg-white p-1">
                        <QRCodeSVG value="https://darbel.example/verify/BBH-SAMPLE-1" size={42} level="M" includeMargin={false} />
                      </div>
                      <div>
                        <p className="text-[8px] uppercase tracking-[0.14em] text-ink-500">Verify</p>
                        <p className="break-all font-mono text-[9px]">https://darbel.example/verify/BBH-SAMPLE-1</p>
                      </div>
                    </div>
                  )}
                </div>
              </DraggableBlock>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Slider
                label="Name width"
                value={layout.nameWidthPercent}
                min={35}
                max={95}
                suffix="%"
                onChange={(value) => updateLayout('nameWidthPercent', value)}
              />
              <Slider
                label="Name size"
                value={layout.nameScale}
                min={70}
                max={125}
                suffix="%"
                onChange={(value) => updateLayout('nameScale', value)}
              />
              <Slider
                label="Details width"
                value={layout.detailWidthPercent}
                min={35}
                max={95}
                suffix="%"
                onChange={(value) => updateLayout('detailWidthPercent', value)}
              />
              <Slider
                label="Details size"
                value={layout.detailScale}
                min={80}
                max={120}
                suffix="%"
                onChange={(value) => updateLayout('detailScale', value)}
              />
            </div>
            <div className="grid gap-3 rounded-sm border border-ink-100 bg-ink-50/40 p-3 md:grid-cols-2">
              <NudgePad title="Nudge name" onNudge={(dx, dy) => nudgeBlock('name', dx, dy)} />
              <NudgePad title="Nudge details" onNudge={(dx, dy) => nudgeBlock('details', dx, dy)} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-sm border border-ink-100 bg-white px-3 py-2 text-sm">
              <span className="font-medium text-ink-800">Show verification link on certificate</span>
              <input
                type="checkbox"
                checked={layout.showVerification}
                onChange={(event) => updateLayout('showVerification', event.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetLayout}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset layout
              </Button>
              <Button type="button" onClick={saveLayout} disabled={savingLayout}>
                {savingLayout ? 'Saving...' : 'Save certificate layout'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DEFAULT_LAYOUT: TemplateLayout = {
  nameLeftPercent: 12,
  nameTopPercent: 34,
  nameWidthPercent: 76,
  detailLeftPercent: 10,
  detailTopPercent: 78,
  detailWidthPercent: 80,
  detailBottomPercent: 12,
  detailInsetPercent: 10,
  nameScale: 100,
  detailScale: 100,
  showVerification: true,
};

function normalizeLayout(layout: Partial<TemplateLayout>): TemplateLayout {
  const next = { ...DEFAULT_LAYOUT, ...layout };
  const nameWidthPercent = clamp(next.nameWidthPercent, 35, 95);
  const detailWidthPercent = clamp(next.detailWidthPercent, 35, 95);
  return {
    ...next,
    nameLeftPercent: clamp(next.nameLeftPercent, 0, 100 - nameWidthPercent),
    nameTopPercent: clamp(next.nameTopPercent, 10, 70),
    nameWidthPercent,
    detailLeftPercent: clamp(next.detailLeftPercent, 0, 100 - detailWidthPercent),
    detailTopPercent: clamp(next.detailTopPercent, 48, 90),
    detailWidthPercent,
    detailBottomPercent: clamp(next.detailBottomPercent, 5, 40),
    detailInsetPercent: clamp(next.detailInsetPercent, 0, 40),
    nameScale: clamp(next.nameScale, 70, 125),
    detailScale: clamp(next.detailScale, 80, 120),
    showVerification: next.showVerification,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function DraggableBlock({
  label,
  children,
  className = '',
  style,
  onPointerDown,
  onPointerMove,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  style: React.CSSProperties;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`absolute cursor-move select-none rounded-sm border border-accent bg-white/80 p-2 shadow-sm ring-2 ring-accent/15 ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <span className="absolute -top-6 left-0 inline-flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white">
        <Grip className="h-3 w-3" />
        {label}
      </span>
      {children}
    </div>
  );
}

function NudgePad({ title, onNudge }: { title: string; onNudge: (dx: number, dy: number) => void }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">{title}</p>
      <div className="grid w-32 grid-cols-3 gap-1">
        <span />
        <NudgeButton label="Up" onClick={() => onNudge(0, -1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </NudgeButton>
        <span />
        <NudgeButton label="Left" onClick={() => onNudge(-1, 0)}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </NudgeButton>
        <span className="rounded-sm border border-ink-200 bg-white text-center text-[10px] leading-8 text-ink-400">1%</span>
        <NudgeButton label="Right" onClick={() => onNudge(1, 0)}>
          <ArrowRight className="h-3.5 w-3.5" />
        </NudgeButton>
        <span />
        <NudgeButton label="Down" onClick={() => onNudge(0, 1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </NudgeButton>
        <span />
      </div>
    </div>
  );
}

function NudgeButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-ink-200 bg-white text-ink-700 transition hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
        <span className="font-mono text-ink-700">{value}{suffix}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[hsl(var(--primary))]"
      />
    </label>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
