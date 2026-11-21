import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBlob, zipFiles } from './files';
import { WorkerJobs } from './jobs';

export type FileStatus = 'attente' | 'cours' | 'ok' | 'erreur';

export interface FileItem {
  id: number;
  file: File;
  status: FileStatus;
  /** Nom du fichier produit. */
  name?: string;
  blob?: Blob;
  /** URL blob: du résultat, révoquée à l'effacement ou à la fermeture. */
  url?: string;
  /** Résumé affiché sous le nom (dimensions, poids) ou message d'erreur. */
  detail?: string;
}

export interface JobOutput {
  blob: Blob;
  name: string;
  detail?: string;
}

/**
 * État d'un outil « fichiers en entrée, fichiers en sortie » : file de traitements dans un worker,
 * liste des résultats, téléchargement groupé en ZIP.
 */
export function useFileJobs<P, R>(createWorker: () => Worker, options: { timeoutMs?: number } = {}) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [zipping, setZipping] = useState(false);
  const jobs = useRef<WorkerJobs<P, R> | null>(null);
  const nextId = useRef(1);
  const urls = useRef<string[]>([]);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      // Après démontage : plus de traitement, plus de mise à jour d'état, plus de création d'URL.
      mounted.current = false;
      jobs.current?.dispose();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function update(id: number, patch: Partial<FileItem>) {
    if (!mounted.current) return;
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  /** Ajoute des fichiers et les traite un par un (mémoire limitée, surtout sur mobile). */
  function process(files: Iterable<File>, toPayload: (file: File) => P, toOutput: (file: File, value: R) => JobOutput) {
    const added: FileItem[] = Array.from(files, (file) => ({ id: nextId.current++, file, status: 'attente' }));
    if (added.length === 0) return;
    setItems((list) => [...list, ...added]);
    jobs.current ??= new WorkerJobs<P, R>(createWorker, options.timeoutMs);
    for (const item of added) {
      let payload: P;
      try {
        payload = toPayload(item.file);
      } catch (error) {
        update(item.id, { status: 'erreur', detail: message(error) });
        continue;
      }
      void jobs.current
        .run(payload, () => update(item.id, { status: 'cours' }))
        .then((result) => {
          if (!mounted.current) return;
          if (!result.ok) {
            update(item.id, { status: 'erreur', detail: result.error });
            return;
          }
          const out = toOutput(item.file, result.value);
          const url = URL.createObjectURL(out.blob);
          urls.current.push(url);
          update(item.id, { status: 'ok', blob: out.blob, name: out.name, url, detail: out.detail });
        })
        .catch((error: unknown) => update(item.id, { status: 'erreur', detail: message(error) }));
    }
  }

  async function downloadAll(zipName: string) {
    const done = items.filter((it): it is FileItem & { blob: Blob; name: string } => it.status === 'ok' && !!it.blob && !!it.name);
    if (done.length === 0) return;
    setZipping(true);
    try {
      downloadBlob(await zipFiles(done), zipName);
    } finally {
      setZipping(false);
    }
  }

  function clear() {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setItems([]);
  }

  return {
    items,
    process,
    downloadAll,
    clear,
    zipping,
    busy: items.some((it) => it.status === 'attente' || it.status === 'cours'),
    doneCount: items.filter((it) => it.status === 'ok').length,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
