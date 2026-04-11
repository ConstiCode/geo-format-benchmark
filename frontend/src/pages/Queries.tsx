import { useState } from 'react';
import { Card, CardHeader } from '@/components/Card';
import { Search, Plus } from 'lucide-react';
import { useQueries, useCreateQuery, useDeleteQuery } from '@/hooks/useExperiment';

export function Queries() {
  const [query, setQuery] = useState('');
  const { data } = useQueries();
  const createQuery = useCreateQuery();
  const deleteQuery = useDeleteQuery();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">Queries</h2>
        <p className="text-sm text-text-secondary mt-1">
          Search queries to benchmark across LLM providers
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader title="New Query" subtitle="Enter a search query to start an experiment" />
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. best CRM for startups"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>
          <button
              onClick={() => createQuery.mutate(query)}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
            Add Query
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Saved Queries"
          subtitle="Your search queries and their experiments"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Query
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Experiments
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Created
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
            {data?.queries.map((q: { id: string; queryText: string; experimentCount: number; createdAt: string }) => (
                <tr key={q.id} className="border-b border-border">
                  <td className="py-3 px-4">{q.queryText}</td>
                  <td className="py-3 px-4">{q.experimentCount}</td>
                  <td className="py-3 px-4">{new Date(q.createdAt).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => deleteQuery.mutate(q.id)}>Delete</button>
                  </td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
