import { useState } from 'preact/hooks';
import Dropzone from '../../components/Dropzone';
import ResultList from '../../components/ResultList';
import { formatBytes, isAppleMobile } from '../../lib/files';
import { useFileJobs } from '../../lib/useFileJobs';
import { outputName, pixelBudget, type OutputFormat } from './logic';
import type { ConvertPayload, ConvertResult } from './worker';

const SIZES: Array<{ label: string; value: number | null }> = [
  { label: 'Taille originale', value: null },
  { label: '4096 px max', value: 4096 },
  { label: '2048 px max', value: 2048 },
  { label: '1080 px max', value: 1080 },
];

const createWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

export default function Tool() {
  const [format, setFormat] = useState<OutputFormat>('jpeg');
  const [quality, setQuality] = useState(0.9);
  const [maxSide, setMaxSide] = useState<number | null>(null);
  const jobs = useFileJobs<ConvertPayload, ConvertResult>(createWorker);

  function addFiles(files: File[]) {
    const budget = pixelBudget(isAppleMobile());
    jobs.process(
      files,
      (file) => ({ file, format, quality, maxSide, pixelBudget: budget }),
      (file, res) => ({
        blob: res.blob,
        name: outputName(file.name, format),
        detail: `${res.width} × ${res.height} px · ${formatBytes(res.blob.size)}`,
      }),
    );
  }

  return (
    <div class="tool">
      <fieldset class="options">
        <legend class="visually-hidden">Options de conversion</legend>
        <div class="option">
          <span class="option-label" id="format-label">
            Format
          </span>
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

      <Dropzone
        onFiles={addFiles}
        accept="image/*,.heic,.heif,.avif,.webp"
        title="Déposez vos images ici"
        hint="ou touchez pour choisir · HEIC, WebP, AVIF, PNG, JPG"
      />
      <p class="hint">Les réglages s'appliquent aux images ajoutées ensuite.</p>

      <ResultList
        items={jobs.items}
        doneCount={jobs.doneCount}
        busy={jobs.busy}
        zipping={jobs.zipping}
        onDownloadAll={() => jobs.downloadAll('images-converties.zip')}
        onClear={jobs.clear}
        doneLabel="converties"
      />
    </div>
  );
}
