import type { JobRequest, JobResponse } from './jobs';

type WorkerScope = {
  onmessage: ((event: MessageEvent<JobRequest<unknown>>) => void) | null;
  postMessage(message: unknown): void;
};

/**
 * Côté Web Worker : répond aux traitements envoyés par `WorkerJobs`.
 * Une exception du traitement devient une erreur lisible pour l'utilisateur.
 */
export function serveJobs<P, R>(handler: (payload: P) => Promise<R>): void {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = async (event) => {
    const { id, payload } = event.data as JobRequest<P>;
    let response: JobResponse<R>;
    try {
      response = { id, ok: true, value: await handler(payload) };
    } catch (error) {
      response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    scope.postMessage(response);
  };
}
