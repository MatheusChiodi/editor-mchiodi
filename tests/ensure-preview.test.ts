import { describe, expect, it } from 'vitest';

// @ts-expect-error script .mjs sem tipos
import { classify } from '../scripts/ensure-preview.mjs';

describe('ensure-preview: quando o hook sobe a prévia', () => {
  it('pedido de vídeo de música', () => {
    expect(classify('crie um vídeo a partir da música que passei')).toBe('music');
    expect(classify('gere um clipe com esse mp3 e a letra')).toBe('music');
    expect(classify('Quero um video da música Dói Saber Como Se Ama')).toBe('music');
  });
  it('pedido de edição de vídeo (EDL)', () => {
    expect(classify('edite o vídeo e corte os silêncios')).toBe('cut');
    expect(classify('adicione motion graphics no meio do vídeo')).toBe('cut');
    expect(classify('renderize o vídeo final com as legendas')).toBe('cut');
  });
  it('acento e caixa não importam', () => {
    expect(classify('CRIE UM VIDEO COM MÚSICA')).toBe('music');
    expect(classify('troque a cena 7 por chuva')).toBe('cut');
  });
  it('conversa que não é pedido de vídeo não sobe nada', () => {
    expect(classify('como configuro o git do meu projeto?')).toBeNull();
    expect(classify('explique o que é um vídeo')).toBeNull();
    expect(classify('ok, obrigado')).toBeNull();
    expect(classify('')).toBeNull();
  });
});

describe('ensure-preview: conversa de git não é pedido de vídeo', () => {
  it('gitignore que cita vídeos e músicas não sobe servidor', () => {
    expect(classify('Configure o gitignore para nao subir os videos, as musicas etc que eu criar no github')).toBeNull();
    expect(classify('faça o commit dos vídeos')).toBeNull();
  });
});
