import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Props {
  data: Record<string, number>;
}

const COLORS: Record<string, string> = {
  APROBADO_PRIORIDAD_ALTA: '#10b981',
  APROBADO_CONDICIONAL: '#3b82f6',
  REQUIERE_COMITE: '#f59e0b',
  NO_ELEGIBLE: '#ef4444',
};

const LABELS: Record<string, string> = {
  APROBADO_PRIORIDAD_ALTA: 'Prioridad Alta',
  APROBADO_CONDICIONAL: 'Aprobado Condicional',
  REQUIERE_COMITE: 'Comite',
  NO_ELEGIBLE: 'No Elegible',
};

export default function RecommendationPie({ data }: Props) {
  const chartData = Object.entries(data)
    .filter(([_, v]) => v > 0)
    .map(([key, value]) => ({ name: LABELS[key] || key, value, key }));

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Sin datos suficientes</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={COLORS[entry.key] || '#94a3b8'} stroke="white" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
