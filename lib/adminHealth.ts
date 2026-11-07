/** Contract of GET /api/admin/health (client-safe types). */
export type HealthState = 'operational' | 'degraded' | 'down';

export interface HealthCheck {
  id: 'database' | 'auth' | 'storage';
  label: string;
  state: HealthState;
  latencyMs: number | null;
}

export interface HealthResponse {
  checkedAt: string;
  overall: HealthState;
  checks: HealthCheck[];
}
