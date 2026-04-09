import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { FlaskConical, Search, BarChart3, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Total Queries', value: '—', icon: Search, change: '' },
  { label: 'Experiments', value: '—', icon: FlaskConical, change: '' },
  { label: 'Total Runs', value: '—', icon: BarChart3, change: '' },
  { label: 'Avg Citation Lift', value: '—', icon: TrendingUp, change: '' },
];

export function Overview() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">Overview</h2>
        <p className="text-sm text-text-secondary mt-1">
          GEO Format Benchmark — Do LLMs cite structured data more often?
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary font-medium">{label}</p>
                <p className="text-2xl font-semibold mt-1">{value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                <Icon size={20} className="text-text-muted" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Citation Rate by Format"
            subtitle="How often each format gets cited by LLMs"
          />
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Run an experiment to see results
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Position Bias"
            subtitle="Does source position affect citation probability?"
          />
          <div className="h-64 flex items-center justify-center text-text-muted text-sm">
            Run an experiment to see results
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Recent Experiments"
            subtitle="Latest experiment runs"
            action={
              <Badge variant="muted">No experiments yet</Badge>
            }
          />
          <div className="h-32 flex items-center justify-center text-text-muted text-sm">
            Start a new experiment from the Queries page
          </div>
        </Card>
      </div>
    </div>
  );
}
