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

  useEffect(
    () => () => {
      jobs.current?.terminate();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function update(id: number, patch: Partial<FileItem>) {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  /** Ajoute des fichiers et les traite un par un (mémoire limitée, surtout sur mobile). */
  function process(files: Iterable<File>, toPayload: (file: File) => P, toOutput: (file: File, value: R) => JobOutput) {
    const added: FileItem[] = Array.from(files, (file) => ({ id: nextId.current++, file, status: 'attente' }));
    if (added.length === 0) return;
    setItems((list) => [...list, ...added]);
    jobs.current ??= new WorkerJobs<P, R>(createWorker, options.timeoutMs);
    for (const item of added) {
      void jobs.current
        .run(toPayload(item.file), () => update(item.id, { status: 'cours' }))
        .then((result) => {
          if (!result.ok) {
            update(item.id, { status: 'erreur', detail: result.error });
            return;
          }
          const out = toOutput(item.file, result.value);
          const url = URL.createObjectURL(out.blob);
          urls.current.push(url);
          update(item.id, { status: 'ok', blob: out.blob, name: out.name, url, detail: out.detail });
        });
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
