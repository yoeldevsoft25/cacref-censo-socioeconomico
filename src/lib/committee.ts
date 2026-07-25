export interface CommitteeMember {
  id: string;
  name: string;
  role: string;
}

export const COMMITTEE_MEMBERS: CommitteeMember[] = [
  { id: 'maria.rodriguez', name: 'Maria Rodriguez', role: 'Presidenta del comite' },
  { id: 'carlos.mendez', name: 'Carlos Mendez', role: 'Vocal - Salud' },
  { id: 'ana.torres', name: 'Ana Torres', role: 'Vocal - Economia' },
  { id: 'luis.gonzalez', name: 'Luis Gonzalez', role: 'Secretario tecnico' },
  { id: 'pedro.ramirez', name: 'Pedro Ramirez', role: 'Asesor legal' },
];

export const DECISION_TIPOS = [
  { value: 'MEDICAMENTO', label: 'Apoyo en medicamento' },
  { value: 'CIRUGIA', label: 'Apoyo en cirugia o procedimiento' },
  { value: 'APOYO_FAMILIAR', label: 'Apoyo familiar' },
  { value: 'OTRO', label: 'Otro tipo de apoyo' },
] as const;

export function getMemberById(id: string | null | undefined): CommitteeMember | null {
  if (!id) return null;
  return COMMITTEE_MEMBERS.find(m => m.id === id || m.name === id) || null;
}
