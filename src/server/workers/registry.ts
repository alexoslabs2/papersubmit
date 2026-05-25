import type { HealthResponse } from '../../shared/types.js';

export interface WorkerState {
  lastRunAt: string | null;
  pendingJobs?: number;
}

export class WorkerRegistry {
  email: WorkerState = { lastRunAt: null, pendingJobs: 0 };
  sessionPurge: WorkerState = { lastRunAt: null };

  health(dbStatus: 'ok' | 'error'): HealthResponse {
    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      db: dbStatus,
      worker: {
        email: this.email,
        sessionPurge: this.sessionPurge
      }
    };
  }
}
