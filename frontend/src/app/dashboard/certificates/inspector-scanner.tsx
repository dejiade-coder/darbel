'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Search, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
    };
  }
}

export function InspectorScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [uid, setUid] = useState('');
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('Scan barcode or enter UID');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let frame = 0;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !window.BarcodeDetector) {
        setMessage('Camera barcode scanning is not available on this browser. Enter UID instead.');
        setActive(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              openScan(extractUid(raw));
              return;
            }
          } catch {
            setMessage('Could not read the barcode yet. Hold the camera steady.');
          }
          frame = window.requestAnimationFrame(scan);
        };
        frame = window.requestAnimationFrame(scan);
      } catch {
        setMessage('Camera permission was not granted. Enter UID instead.');
        setActive(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active]);

  function openScan(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    router.push(`/dashboard/certificates/${encodeURIComponent(normalized)}/scan`);
  }

  return (
    <div className="rounded-sm border border-ink-200 bg-ink-50/60 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">Inspector scanner</p>
          <p className="mt-1 text-sm text-ink-600">{message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={active ? 'outline' : 'default'} size="sm" onClick={() => setActive((value) => !value)}>
            {active ? <Square className="mr-2 h-3.5 w-3.5" /> : <Camera className="mr-2 h-3.5 w-3.5" />}
            {active ? 'Stop scan' : 'Scan barcode'}
          </Button>
        </div>
      </div>
      {active && (
        <video ref={videoRef} muted playsInline className="mt-3 aspect-video w-full rounded-sm border border-ink-200 bg-ink-900 object-cover" />
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={uid}
          onChange={(event) => setUid(event.target.value)}
          className="h-9 min-w-0 flex-1 rounded-sm border border-ink-200 bg-white px-3 font-mono text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder="BBH-..."
        />
        <Button type="button" size="sm" variant="outline" onClick={() => openScan(uid)}>
          <Search className="mr-2 h-3.5 w-3.5" />
          Open
        </Button>
      </div>
    </div>
  );
}

function extractUid(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const scanIndex = parts.findIndex((part) => part === 'certificates');
    if (scanIndex >= 0 && parts[scanIndex + 1]) return parts[scanIndex + 1]!;
  } catch {
    // Not a URL; use the raw barcode payload as UID.
  }
  return value;
}
