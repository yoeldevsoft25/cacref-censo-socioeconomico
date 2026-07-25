import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, CartesianGrid } from 'recharts';

export default function QualityOfLifeHistogram({ values }: { values: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bin: String(i + 1),
    count: values.filter(v => v === i + 1).length,
  }));

  const colorFor = (bin: string) => {
    const n = parseInt(bin, 10);
    if (n <= 3) return '#ef4444';
    if (n <= 5) return '#f59e0b';
    if (n <= 7) return '#3b82f6';
    return '#10b981';
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={buckets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="bin" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Calidad de vida (1-10)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {buckets.map((b) => (
            <Cell key={b.bin} fill={colorFor(b.bin)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
