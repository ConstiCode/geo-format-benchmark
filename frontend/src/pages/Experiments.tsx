import { Card, CardHeader } from '@/components/Card';

export function Experiments() {
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
                  Query
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
              <tr>
                <td colSpan={5} className="py-12 text-center text-text-muted">
                  No experiments yet. Start one from the Queries page.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
