import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from 'recharts';

interface GerenciaRow {
  gerencia: string;
  ALTO: number;
  MEDIO: number;
  BAJO: number;
}

export default function GerenciaBar({ data }: { data: GerenciaRow[] }) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Sin datos</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
        <YAxis dataKey="gerencia" type="category" width={140} tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
        <Bar dataKey="ALTO" stackId="risk" fill="#ef4444" name="Alto riesgo" />
        <Bar dataKey="MEDIO" stackId="risk" fill="#f59e0b" name="Riesgo medio" />
        <Bar dataKey="BAJO" stackId="risk" fill="#10b981" name="Riesgo bajo" />
      </BarChart>
    </ResponsiveContainer>
  );
}
