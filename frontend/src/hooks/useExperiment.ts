import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// --- Query hooks ---

export function useQueries(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['queries', page, limit],
    queryFn: () => api.getQueries(page, limit),
  });
}

export function useQueryDetail(id: string) {
  return useQuery({
    queryKey: ['query', id],
    queryFn: () => api.getQuery(id),
    enabled: !!id,
  });
}

export function useCreateQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (query: string) => api.createQuery(query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
    },
  });
}

export function useDeleteQuery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteQuery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
    },
  });
}

// --- Experiment hooks ---

export function useExperiments(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['experiments', page, limit],
    queryFn: () => api.getExperiments(page, limit),
  });
}

export function useExperiment(id: string) {
  return useQuery({
    queryKey: ['experiment', id],
    queryFn: () => api.getExperiment(id),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll every 5s while experiment is running
      const data = query.state.data as { record?: { status?: string } } | undefined;
      return data?.record?.status === 'running' ? 5000 : false;
    },
  });
}

export function useCreateExperiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: {
      queryId: string;
      llmProviders: string[];
      enablePositionRotation?: boolean;
    }) => api.createExperiment(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['experiments'] });
    },
  });
}

export function useExperimentRuns(
  id: string,
  filters?: { llm?: string; format?: string; status?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['experiment-runs', id, filters],
    queryFn: () => api.getExperimentRuns(id, filters),
    enabled: !!id,
  });
}

export function useExperimentMetrics(id: string) {
  return useQuery({
    queryKey: ['experiment-metrics', id],
    queryFn: () => api.getExperimentMetrics(id),
    enabled: !!id,
  });
}
