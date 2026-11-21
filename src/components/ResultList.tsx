import type { FileItem } from '../lib/useFileJobs';

interface Props {
  items: FileItem[];
  doneCount: number;
  busy: boolean;
  zipping: boolean;
  onDownloadAll: () => void;
  onClear: () => void;
  /** Participe passé accordé avec les éléments traités, par exemple « converties ». */
  doneLabel?: string;
}

/** Liste des fichiers traités, avec téléchargement individuel et groupé. */
export default function ResultList({ items, doneCount, busy, zipping, onDownloadAll, onClear, doneLabel = 'traités' }: Props) {
  if (items.length === 0) return null;

  return (
    <section class="results" aria-live="polite">
      <div class="results-head">
        <h2>
          {doneCount} / {items.length} {doneLabel}
        </h2>
        <div class="results-actions">
          {doneCount > 1 && (
            <button type="button" class="button primary" onClick={onDownloadAll} disabled={busy || zipping}>
              {zipping ? 'Préparation…' : 'Tout télécharger (ZIP)'}
            </button>
          )}
          <button type="button" class="button" onClick={onClear} disabled={busy}>
            Effacer
          </button>
        </div>
      </div>
      <ul class="file-list">
        {items.map((it) => (
          <li key={it.id} class={`file ${it.status}`} data-status={it.status}>
            {it.url && it.blob?.type.startsWith('image/') ? (
              <img src={it.url} alt="" width={48} height={48} />
            ) : (
              <span class="thumb" aria-hidden="true" />
            )}
            <div class="file-info">
              <span class="file-name">{it.name ?? it.file.name}</span>
              <span class="file-detail">
                {it.status === 'attente' && 'En attente'}
                {it.status === 'cours' && 'Traitement…'}
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
  );
}
