import { useParams } from 'react-router-dom';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { useExperiment, useExperimentMetrics } from '@/hooks/useExperiment';
import { CitationChart } from '@/components/CitationChart';

export function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: experiment } = useExperiment(id ?? '');
  const { data: metrics } = useExperimentMetrics(id ?? '');

  if (!experiment) {
    return <div className="text-text-muted">Loading experiment...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">
          Experiment {experiment.id?.slice(0, 8)}...
        </h2>
        <div className="flex gap-2 mt-2">
          <Badge variant={experiment.record?.status === 'completed' ? 'success' : 'warning'}>
            {experiment.record?.status}
          </Badge>
          <span className="text-sm text-text-secondary">
            {experiment.completed} completed runs
          </span>
        </div>
      </div>

      {metrics ? (
        <div className="space-y-6">
          <CitationChart metrics={metrics} />

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Position Bias" subtitle="Correlation between source position and citation probability" />
              <div className="text-3xl font-bold">
                {metrics.positionBiasScore?.toFixed(3)}
              </div>
              <p className="text-sm text-text-secondary mt-1">
                {Math.abs(metrics.positionBiasScore) < 0.3 ? 'Weak' :
                 Math.abs(metrics.positionBiasScore) < 0.6 ? 'Moderate' : 'Strong'}
                {' '}{metrics.positionBiasScore > 0 ? 'primacy' : 'recency'} bias
              </p>
            </Card>

            <Card>
              <CardHeader title="Format Lift" subtitle="Relative change vs clean HTML baseline" />
              {Object.entries(metrics.formatLift ?? {}).map(([format, lift]) => (
                <div key={format} className="flex justify-between py-1">
                  <span className="text-sm">{format}</span>
                  <span className={`text-sm font-medium ${Number(lift) > 0 ? 'text-emerald-600' : Number(lift) < 0 ? 'text-red-500' : 'text-text-secondary'}`}>
                    {Number(lift) >= 0 ? '+' : ''}{(Number(lift) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <div className="py-12 text-center text-text-muted">
            {experiment.record?.status === 'completed'
              ? 'Loading metrics...'
              : 'Experiment is still running. Metrics will appear when complete.'}
          </div>
        </Card>
      )}
    </div>
  );
}
