import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { useExperiments } from '@/hooks/useExperiment';

type Experiment = {
  id: string;
  queryId: string;
  llmProviders: string[];
  totalRuns: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  completed: 'success',
  running: 'warning',
  failed: 'danger',
  pending: 'muted',
};

export function Experiments() {
  const { data } = useExperiments();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">Experiments</h2>
        <p className="text-sm text-text-secondary mt-1">
          Track and analyze format citation experiments
        </p>
      </div>

      <Card>
        <CardHeader
          title="All Experiments"
          subtitle="Results from format benchmark runs"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Experiment
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  LLMs
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Runs
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.experiments?.length > 0 ? (
                data.experiments.map((exp: Experiment) => (
                  <tr
                    key={exp.id}
                    className="border-b border-border hover:bg-background cursor-pointer transition-colors"
                    onClick={() => navigate(`/experiments/${exp.id}`)}
                  >
                    <td className="py-3 px-4 font-medium">
                      {exp.id.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4">
                      {exp.llmProviders.join(', ')}
                    </td>
                    <td className="py-3 px-4">{exp.totalRuns}</td>
                    <td className="py-3 px-4">
                      <Badge variant={statusVariant[exp.status] ?? 'muted'}>
                        {exp.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-text-muted">
                    No experiments yet. Start one from the Queries page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
