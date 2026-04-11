import {Card, CardHeader} from '@/components/Card';
import {BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer} from 'recharts';


interface CitationChartProps {
    metrics: {
        citationRateByFormat: Record<string, number>;
        crossLlmConsistency?: Record<string, Record<string, number>>;
    };
}

export function CitationChart({metrics}: CitationChartProps) {
    const chartData = Object.entries(metrics.citationRateByFormat).map(([format, rate]) => ({
        format: format,
        rate: Number(rate) * 100,
    }));
    return (
        <Card>
            <CardHeader title="Citation Rate by Format" subtitle="How often each format gets cited"/>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <XAxis dataKey="format"/>
                    <YAxis/>
                    <Tooltip/>
                    <Bar dataKey="rate" fill="#f97066"/>
                </BarChart>
            </ResponsiveContainer>
        </Card>
    );
}

