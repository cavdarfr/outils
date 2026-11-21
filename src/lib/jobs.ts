/**
 * Exécution de traitements dans un Web Worker, un à la fois.
 *
 * Protocole : la page envoie `{ id, payload }`, le worker répond `{ id, ok: true, value }` ou
 * `{ id, ok: false, error }` (voir `serveJobs` dans `job-host.ts`).
 * Un worker qui plante, ne répond pas ou refuse un message est remplacé : la file continue.
 */

export type JobResult<R> = { ok: true; value: R } | { ok: false; error: string };

export type JobRequest<P> = { id: number; payload: P };
export type JobResponse<R> = { id: number; ok: true; value: R } | { id: number; ok: false; error: string };

export const JOB_ERRORS = {
  unavailable: 'Ce navigateur ne permet pas ce traitement (Web Worker indisponible).',
  crashed: "Le traitement s'est arrêté (mémoire insuffisante ou fichier invalide).",
  timeout: 'Traitement trop long, abandonné.',
  unsendable: 'Impossible de transmettre ce fichier au module de traitement.',
} as const;

export class WorkerJobs<P, R> {
  private worker: Worker | null = null;
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly create: () => Worker,
    private readonly timeoutMs = 120_000,
  ) {}

  /** Ajoute un traitement à la file. `onStart` est appelé quand il commence réellement. */
  run(payload: P, onStart?: () => void): Promise<JobResult<R>> {
    const result = this.queue.then(() => {
      onStart?.();
      return this.runNow(payload);
    });
    this.queue = result.catch(() => undefined);
    return result;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private runNow(payload: P): Promise<JobResult<R>> {
    return new Promise((resolve) => {
      let worker: Worker;
      try {
        worker = this.worker ??= this.create();
      } catch {
        resolve({ ok: false, error: JOB_ERRORS.unavailable });
        return;
      }
      const id = this.nextId++;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (result: JobResult<R>, broken = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        worker.removeEventListener('messageerror', onError);
        // Seul le worker fautif est remplacé, jamais celui d'un traitement suivant.
        if (broken && this.worker === worker) this.terminate();
        resolve(result);
      };
      const onMessage = (event: MessageEvent<JobResponse<R>>) => {
        const res = event.data;
        if (!res || res.id !== id) return;
        finish(res.ok ? { ok: true, value: res.value } : { ok: false, error: res.error });
      };
      const onError = (event: Event) => {
        event.preventDefault();
        finish({ ok: false, error: JOB_ERRORS.crashed }, true);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.addEventListener('messageerror', onError);
      timer = setTimeout(() => finish({ ok: false, error: JOB_ERRORS.timeout }, true), this.timeoutMs);
      try {
        const request: JobRequest<P> = { id, payload };
        worker.postMessage(request);
      } catch {
        finish({ ok: false, error: JOB_ERRORS.unsendable }, true);
      }
    });
  }
}
