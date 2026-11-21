import { afterEach, describe, expect, it, vi } from 'vitest';
import { JOB_ERRORS, WorkerJobs, type JobRequest } from './jobs';

type Behaviour = (worker: FakeWorker, request: JobRequest<number>) => void;

/** Faux Web Worker : le comportement de chaque envoi est fourni par le test. */
class FakeWorker extends EventTarget {
  terminated = false;
  constructor(private readonly behaviour: Behaviour) {
    super();
  }
  postMessage(request: JobRequest<number>) {
    this.behaviour(this, request);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data })));
  }
  crash() {
    queueMicrotask(() => this.dispatchEvent(new Event('error', { cancelable: true })));
  }
}

const double: Behaviour = (w, { id, payload }) => w.reply({ id, ok: true, value: payload * 2 });

function factory(...behaviours: Behaviour[]) {
  const created: FakeWorker[] = [];
  const create = () => {
    const worker = new FakeWorker(behaviours[Math.min(created.length, behaviours.length - 1)]!);
    created.push(worker);
    return worker as unknown as Worker;
  };
  return { create, created };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('WorkerJobs', () => {
  it('renvoie le résultat et réutilise le même worker', async () => {
    const { create, created } = factory(double);
    const jobs = new WorkerJobs<number, number>(create);
    expect(await jobs.run(2)).toEqual({ ok: true, value: 4 });
    expect(await jobs.run(5)).toEqual({ ok: true, value: 10 });
    expect(created).toHaveLength(1);
  });

  it('transmet les erreurs du traitement sans remplacer le worker', async () => {
    const { create, created } = factory((w, { id }) => w.reply({ id, ok: false, error: 'fichier illisible' }));
    const jobs = new WorkerJobs<number, number>(create);
    expect(await jobs.run(1)).toEqual({ ok: false, error: 'fichier illisible' });
    expect(created[0]!.terminated).toBe(false);
  });

  it('remplace un worker qui plante et continue la file', async () => {
    const { create, created } = factory((w) => w.crash(), double);
    const jobs = new WorkerJobs<number, number>(create);
    const first = jobs.run(1);
    const second = jobs.run(3);
    expect(await first).toEqual({ ok: false, error: JOB_ERRORS.crashed });
    expect(await second).toEqual({ ok: true, value: 6 });
    expect(created).toHaveLength(2);
    expect(created[0]!.terminated).toBe(true);
    expect(created[1]!.terminated).toBe(false);
  });

  it('remplace un worker qui refuse un message', async () => {
    const { create, created } = factory(() => {
      throw new DOMException('échec', 'DataCloneError');
    }, double);
    const jobs = new WorkerJobs<number, number>(create);
    expect(await jobs.run(1)).toEqual({ ok: false, error: JOB_ERRORS.unsendable });
    expect(await jobs.run(4)).toEqual({ ok: true, value: 8 });
    expect(created).toHaveLength(2);
  });

  it('abandonne après le délai, sans toucher au worker du traitement suivant', async () => {
    vi.useFakeTimers();
    const { create, created } = factory(() => {}, double);
    const jobs = new WorkerJobs<number, number>(create, 1000);
    const first = jobs.run(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await first).toEqual({ ok: false, error: JOB_ERRORS.timeout });
    const second = jobs.run(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(await second).toEqual({ ok: true, value: 4 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(created[1]!.terminated).toBe(false);
  });

  it('traite un seul fichier à la fois et signale le début', async () => {
    const started: number[] = [];
    let pending = 0;
    let maxPending = 0;
    const { create } = factory((w, { id, payload }) => {
      pending++;
      maxPending = Math.max(maxPending, pending);
      setTimeout(() => {
        pending--;
        w.reply({ id, ok: true, value: payload });
      }, 5);
    });
    const jobs = new WorkerJobs<number, number>(create);
    await Promise.all([1, 2, 3].map((n) => jobs.run(n, () => started.push(n))));
    expect(started).toEqual([1, 2, 3]);
    expect(maxPending).toBe(1);
  });

  it('dispose annule le traitement en cours et la file, sans créer de nouveau worker', async () => {
    const { create, created } = factory(() => {});
    const jobs = new WorkerJobs<number, number>(create);
    const first = jobs.run(1);
    const second = jobs.run(2);
    await Promise.resolve();
    await Promise.resolve();
    jobs.dispose();
    expect(await first).toEqual({ ok: false, error: JOB_ERRORS.cancelled });
    expect(await second).toEqual({ ok: false, error: JOB_ERRORS.cancelled });
    expect(await jobs.run(3)).toEqual({ ok: false, error: JOB_ERRORS.cancelled });
    expect(created).toHaveLength(1);
    expect(created[0]!.terminated).toBe(true);
  });

  it('signale un navigateur sans Web Worker', async () => {
    const jobs = new WorkerJobs<number, number>(() => {
      throw new Error('pas de worker');
    });
    expect(await jobs.run(1)).toEqual({ ok: false, error: JOB_ERRORS.unavailable });
  });
});
