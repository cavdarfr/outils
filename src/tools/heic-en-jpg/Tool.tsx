import { useEffect, useRef, useState } from 'preact/hooks';
import { zipSync } from 'fflate';
import { formatBytes, outputName, pixelBudget, uniqueNames, type OutputFormat } from './logic';
import type { ConvertRequest, ConvertResponse } from './worker';

type Item = {
  id: number;
  file: File;
  status: 'attente' | 'cours' | 'ok' | 'erreur';
  name?: string;
  url?: string;
  blob?: Blob;
  detail?: string;
};

const SIZES: Array<{ label: string; value: number | null }> = [
  { label: 'Taille originale', value: null },
  { label: '4096 px max', value: 4096 },
  { label: '2048 px max', value: 2048 },
  { label: '1080 px max', value: 1080 },
];

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function triggerDownload(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
}

export default function Tool() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<OutputFormat>('jpeg');
  const [quality, setQuality] = useState(0.9);
  const [maxSide, setMaxSide] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(1);
  const urls = useRef<string[]>([]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function getWorker(): Worker {
    workerRef.current ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    return workerRef.current;
  }

  function update(id: number, patch: Partial<Item>) {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function resetWorker() {
    workerRef.current?.terminate();
    workerRef.current = null;
  }

  function runOne(item: Item, opts: Omit<ConvertRequest, 'id' | 'file'>): Promise<void> {
    return new Promise((resolve) => {
      update(item.id, { status: 'cours' });
      let worker: Worker;
      try {
        worker = getWorker();
      } catch {
        update(item.id, { status: 'erreur', detail: 'Ce navigateur ne permet pas la conversion (Web Worker indisponible).' });
        resolve();
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (patch: Partial<Item>, broken = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        worker.removeEventListener('messageerror', onError);
        // Un worker planté ou bloqué est remplacé : les fichiers suivants repartent d'un état propre.
        if (broken && workerRef.current === worker) resetWorker();
        update(item.id, patch);
        resolve();
      };
      const onError = (event: Event) => {
        event.preventDefault();
        finish({ status: 'erreur', detail: "La conversion s'est arrêtée (mémoire insuffisante ou fichier invalide)." }, true);
      };
      timer = setTimeout(
        () => finish({ status: 'erreur', detail: 'Conversion trop longue, abandonnée. Essayez une taille de sortie plus petite.' }, true),
        120_000,
      );
      const onMessage = (event: MessageEvent<ConvertResponse>) => {
        const res = event.data;
        if (res.id !== item.id) return;
        if (res.ok) {
          const url = URL.createObjectURL(res.blob);
          urls.current.push(url);
          finish({
            status: 'ok',
            blob: res.blob,
            url,
            name: outputName(item.file.name, opts.format),
            detail: `${res.width} × ${res.height} px · ${formatBytes(res.blob.size)}`,
          });
        } else {
          finish({ status: 'erreur', detail: res.error });
        }
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.addEventListener('messageerror', onError);
      const request: ConvertRequest = { id: item.id, file: item.file, ...opts };
      try {
        worker.postMessage(request);
      } catch {
        finish({ status: 'erreur', detail: "Impossible de transmettre ce fichier au module de conversion." }, true);
      }
    });
  }

  function addFiles(files: FileList | File[]) {
    const added: Item[] = Array.from(files).map((file) => ({ id: nextId.current++, file, status: 'attente' }));
    if (added.length === 0) return;
    setItems((list) => [...list, ...added]);
    const opts = { format, quality, maxSide, pixelBudget: pixelBudget(isAppleMobile()) };
    // Un fichier à la fois : limite la mémoire utilisée, surtout sur mobile.
    for (const item of added) {
      queueRef.current = queueRef.current.then(() => runOne(item, opts)).catch(() => undefined);
    }
  }

  async function downloadZip() {
    const done = items.filter((it) => it.status === 'ok' && it.blob && it.name);
    if (done.length === 0) return;
    setZipping(true);
    try {
      const names = uniqueNames(done.map((it) => it.name!));
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
      for (const [i, it] of done.entries()) {
        entries[names[i]!] = [new Uint8Array(await it.blob!.arrayBuffer()), { level: 0 }];
      }
      const zip = zipSync(entries);
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      triggerDownload(url, 'images-converties.zip');
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setZipping(false);
    }
  }

  function clear() {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setItems([]);
  }

  const doneCount = items.filter((it) => it.status === 'ok').length;
  const busy = items.some((it) => it.status === 'attente' || it.status === 'cours');

  return (
    <div class="tool">
      <fieldset class="options">
        <legend class="visually-hidden">Options de conversion</legend>
        <div class="option">
          <span class="option-label" id="format-label">Format</span>
          <div class="segmented" role="radiogroup" aria-labelledby="format-label">
            {(['jpeg', 'png'] as const).map((f) => (
              <label key={f} class={format === f ? 'active' : ''}>
                <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} />
                {f === 'jpeg' ? 'JPG' : 'PNG'}
              </label>
            ))}
          </div>
        </div>
        {format === 'jpeg' && (
          <label class="option">
            <span class="option-label">Qualité {Math.round(quality * 100)} %</span>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={quality}
              onInput={(e) => setQuality(Number((e.target as HTMLInputElement).value))}
            />
          </label>
        )}
        <label class="option">
          <span class="option-label">Taille</span>
          <select
            value={maxSide ?? ''}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              setMaxSide(v ? Number(v) : null);
            }}
          >
            {SIZES.map((s) => (
              <option key={s.label} value={s.value ?? ''}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <label
        class={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif,.avif,.webp"
          data-testid="file-input"
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            if (input.files) addFiles(input.files);
            input.value = '';
          }}
        />
        <span class="dropzone-title">Déposez vos images ici</span>
        <span class="dropzone-hint">ou touchez pour choisir · HEIC, WebP, AVIF, PNG, JPG</span>
      </label>
      <p class="hint">Les réglages s'appliquent aux images ajoutées ensuite.</p>

      {items.length > 0 && (
        <section class="results" aria-live="polite">
          <div class="results-head">
            <h2>
              {doneCount} / {items.length} converties
            </h2>
            <div class="results-actions">
              {doneCount > 1 && (
                <button type="button" class="button primary" onClick={downloadZip} disabled={busy || zipping}>
                  {zipping ? 'Préparation…' : 'Tout télécharger (ZIP)'}
                </button>
              )}
              <button type="button" class="button" onClick={clear} disabled={busy}>
                Effacer
              </button>
            </div>
          </div>
          <ul class="file-list">
            {items.map((it) => (
              <li key={it.id} class={`file ${it.status}`} data-status={it.status}>
                {it.url ? <img src={it.url} alt="" width={48} height={48} /> : <span class="thumb" aria-hidden="true" />}
                <div class="file-info">
                  <span class="file-name">{it.name ?? it.file.name}</span>
                  <span class="file-detail">
                    {it.status === 'attente' && 'En attente'}
                    {it.status === 'cours' && 'Conversion…'}
                    {(it.status === 'ok' || it.status === 'erreur') && it.detail}
                  </span>
                </div>
                {it.status === 'ok' && it.url && (
                  <a class="button" href={it.url} download={it.name}>
                    Télécharger
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
