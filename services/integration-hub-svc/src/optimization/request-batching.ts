// @ts-nocheck
/**
 * Request Batching Service
 * Batches multiple widget data requests into single API calls
 */

interface BatchedRequest {
  integrationId: string;
  widgetId: string;
  params?: Record<string, unknown>;
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
}

interface BatchResult {
  widgetId: string;
  data?: unknown;
  error?: string;
}

export class RequestBatchingService {
  private pendingRequests: Map<string, BatchedRequest[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchWindowMs: number;

  constructor(batchWindowMs = 50) {
    this.batchWindowMs = batchWindowMs;
  }

  /**
   * Add request to batch
   */
  async addRequest(
    integrationId: string,
    widgetId: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const batchKey = integrationId;

      if (!this.pendingRequests.has(batchKey)) {
        this.pendingRequests.set(batchKey, []);
      }

      this.pendingRequests.get(batchKey)!.push({
        integrationId,
        widgetId,
        params,
        resolve,
        reject,
      });

      // Start or reset batch timer
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
      }

      this.batchTimers.set(
        batchKey,
        setTimeout(() => this.executeBatch(batchKey), this.batchWindowMs)
      );
    });
  }

  /**
   * Execute batched requests
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const requests = this.pendingRequests.get(batchKey);
    if (!requests || requests.length === 0) return;

    this.pendingRequests.delete(batchKey);
    this.batchTimers.delete(batchKey);

    const integrationId = requests[0].integrationId;
    const widgets = requests.map((r) => ({
      widgetId: r.widgetId,
      params: r.params,
    }));

    try {
      const response = await fetch(`/api/integrations/${integrationId}/widgets/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets }),
      });

      if (!response.ok) {
        throw new Error(`Batch request failed: ${response.status}`);
      }

      const results: { widgets: Record<string, BatchResult> } = await response.json();

      for (const request of requests) {
        const result = results.widgets[request.widgetId];
        if (result?.error) {
          request.reject(new Error(result.error));
        } else {
          request.resolve(result?.data);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Batch request failed');
      for (const request of requests) {
        request.reject(err);
      }
    }
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    let count = 0;
    for (const requests of this.pendingRequests.values()) {
      count += requests.length;
    }
    return count;
  }

  /**
   * Flush all pending requests immediately
   */
  async flush(): Promise<void> {
    const batchKeys = Array.from(this.pendingRequests.keys());
    await Promise.all(batchKeys.map((key) => this.executeBatch(key)));
  }
}

export const requestBatchingService = new RequestBatchingService();
export default RequestBatchingService;
