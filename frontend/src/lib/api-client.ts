class ApiClient {
  // --- Queries ---

  async createQuery(query: string) {
    const res = await fetch('/api/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error('Failed to create query');
    return res.json();
  }

  async getQueries(page = 1, limit = 20) {
    const res = await fetch(`/api/queries?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch queries');
    return res.json();
  }

  async getQuery(id: string) {
    const res = await fetch(`/api/queries/${id}`);
    if (!res.ok) throw new Error('Failed to fetch query');
    return res.json();
  }

  async deleteQuery(id: string) {
    const res = await fetch(`/api/queries/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete query');
  }

  // --- Experiments ---

  async createExperiment(config: {
    queryId: string;
    llmProviders: string[];
    enablePositionRotation?: boolean;
  }) {
    const res = await fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to create experiment');
    return res.json();
  }

  async getExperiments(page = 1, limit = 20) {
    const res = await fetch(`/api/experiments?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch experiments');
    return res.json();
  }

  async getExperiment(id: string) {
    const res = await fetch(`/api/experiments/${id}`);
    if (!res.ok) throw new Error('Failed to fetch experiment');
    return res.json();
  }

  async getExperimentRuns(
    id: string,
    filters?: { llm?: string; format?: string; status?: string; page?: number; limit?: number },
  ) {
    const params = new URLSearchParams();
    if (filters?.llm) params.set('llm', filters.llm);
    if (filters?.format) params.set('format', filters.format);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));

    const res = await fetch(`/api/experiments/${id}/runs?${params}`);
    if (!res.ok) throw new Error('Failed to fetch runs');
    return res.json();
  }

  async getExperimentMetrics(id: string) {
    const res = await fetch(`/api/experiments/${id}/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  }
}

export const api = new ApiClient();
