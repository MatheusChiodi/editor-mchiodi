/**
 * O pacote que cada vídeo enviado precisa virar: o vídeo editado e tudo o que o YouTube pede para publicar.
 * A lista é a fonte única para o pedido da sessão headless, a conferência do resultado e a notificação.
 */
export interface Deliverable {
  key: 'video' | 'thumbnail' | 'title' | 'description' | 'chapters' | 'report';
  label: string;
  /** como aparece no pedido ao diretor */
  file: string;
  matches: (file: string) => boolean;
  /** sem ele não há entrega; os outros viram pendência na notificação */
  required: boolean;
}

const named = (name: string) => (file: string) => file === name;

export const DELIVERABLES: Deliverable[] = [
  { key: 'video', label: 'vídeo editado', file: 'final.mp4', matches: named('final.mp4'), required: true },
  { key: 'thumbnail', label: 'capa', file: 'capa-1.png (e variantes)', matches: (file) => /^capa-\d+\.png$/.test(file), required: false },
  { key: 'title', label: 'título', file: 'titulo.txt', matches: named('titulo.txt'), required: false },
  { key: 'description', label: 'descrição', file: 'descricao.txt', matches: named('descricao.txt'), required: false },
  { key: 'chapters', label: 'capítulos', file: 'capitulos.txt', matches: named('capitulos.txt'), required: false },
  { key: 'report', label: 'relatório', file: 'relatorio.md', matches: named('relatorio.md'), required: false },
];

export interface DeliveryCheck {
  /** o vídeo existe */
  delivered: boolean;
  present: string[];
  missing: string[];
}

/** Confere a pasta output/<slug>/ contra o pacote. */
export function checkDeliverables(files: string[]): DeliveryCheck {
  const has = (item: Deliverable) => files.some(item.matches);
  return {
    delivered: DELIVERABLES.filter((item) => item.required).every(has),
    present: DELIVERABLES.filter(has).map((item) => item.label),
    missing: DELIVERABLES.filter((item) => !has(item)).map((item) => item.label),
  };
}

/** "vídeo editado, capa, título" + o que faltou, para o log e o push. */
export function describeDelivery(check: DeliveryCheck): string {
  const lines = [`entregue: ${check.present.join(', ') || 'nada'}`];
  if (check.missing.length) lines.push(`faltou: ${check.missing.join(', ')}`);
  return lines.join('\n');
}
