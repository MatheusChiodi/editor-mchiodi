import { describe, expect, it } from 'vitest';

import { allowsLocalScripts, cmdShim, isOurShim, pickBinDir, ps1Shim, SHIM_MARKER, shimTargets } from '../scripts/install-cli.ts';
import { bareGroup, type CommandNode, userPath } from '../src/cli/invocation.ts';

const ROOT = 'D:\\PROJETOS\\Sistemas\\mchiodi-editor';
const HOME = 'C:\\Users\\mathe';

describe('conteúdo do shim', () => {
  it('aponta para o tsx, o tsconfig e a entrada do projeto por caminho absoluto', () => {
    expect(shimTargets(ROOT)).toEqual({
      tsx: `${ROOT}\\node_modules\\tsx\\dist\\cli.mjs`,
      tsconfig: `${ROOT}\\tsconfig.json`,
      entry: `${ROOT}\\src\\cli\\index.ts`,
    });
  });

  it('mce.cmd repassa todos os argumentos e o código de saída', () => {
    const lines = cmdShim(ROOT).split('\r\n');
    expect(lines[0]).toBe('@echo off');
    expect(lines[2]).toBe(`node "${ROOT}\\node_modules\\tsx\\dist\\cli.mjs" --tsconfig "${ROOT}\\tsconfig.json" "${ROOT}\\src\\cli\\index.ts" %*`);
    expect(lines[3]).toBe('exit /b %ERRORLEVEL%');
    expect(cmdShim(ROOT)).not.toMatch(/[^\x00-\x7F]/);
    expect(cmdShim(ROOT).replaceAll('\r\n', '')).not.toContain('\n');
  });

  it('mce.cmd aguenta espaço e % no caminho do projeto', () => {
    const shim = cmdShim('D:\\Meus Projetos\\100%\\editor');
    expect(shim).toContain('"D:\\Meus Projetos\\100%%\\editor\\src\\cli\\index.ts" %*');
  });

  it('mce.ps1 repassa os argumentos e o código de saída, com aspas simples escapadas', () => {
    const lines = ps1Shim("D:\\it's\\editor").split('\r\n');
    expect(lines[1]).toBe("& node 'D:\\it''s\\editor\\node_modules\\tsx\\dist\\cli.mjs' --tsconfig 'D:\\it''s\\editor\\tsconfig.json' 'D:\\it''s\\editor\\src\\cli\\index.ts' @args");
    expect(lines[2]).toBe('exit $LASTEXITCODE');
  });

  it('reconhece só os arquivos que o instalador gerou', () => {
    expect(isOurShim(cmdShim(ROOT))).toBe(true);
    expect(isOurShim(ps1Shim(ROOT))).toBe(true);
    expect(cmdShim(ROOT)).toContain(SHIM_MARKER);
    expect(isOurShim('@echo off\r\nnode outro.js %*')).toBe(false);
  });
});

describe('escolha da pasta do PATH', () => {
  const path = (...dirs: string[]) => ['C:\\Windows\\system32', ...dirs, 'C:\\Program Files\\nodejs\\'].join(';');

  it('usa ~\\.local\\bin quando está no PATH e existe', () => {
    const exists = (dir: string) => dir === `${HOME}\\.local\\bin`;
    expect(pickBinDir(path(`${HOME}\\.local\\bin`, `${HOME}\\bin`), HOME, exists)).toEqual({ dir: `${HOME}\\.local\\bin`, create: false });
  });

  it('prefere a que existe em disco', () => {
    const exists = (dir: string) => dir === `${HOME}\\bin`;
    expect(pickBinDir(path(`${HOME}\\.local\\bin`, `${HOME}\\bin`), HOME, exists)).toEqual({ dir: `${HOME}\\bin`, create: false });
  });

  it('ignora caixa, barra final, barra invertida trocada e aspas', () => {
    expect(pickBinDir(path('"c:/users/MATHE/.local/bin/"'), HOME, () => true)).toEqual({ dir: `${HOME}\\.local\\bin`, create: false });
  });

  it('pasta que está no PATH mas não existe é criada', () => {
    expect(pickBinDir(path(`${HOME}\\bin`), HOME, () => false)).toEqual({ dir: `${HOME}\\bin`, create: true });
  });

  it('pasta que existe mas não está no PATH não serve', () => {
    expect(pickBinDir(path(), HOME, () => true)).toBeNull();
    expect(pickBinDir('', HOME, () => true)).toBeNull();
    expect(pickBinDir(path(`${HOME}\\.local\\bin\\outra`), HOME, () => true)).toBeNull();
  });
});

describe('política de execução do PowerShell', () => {
  it('só cria o .ps1 quando script local sem assinatura pode rodar', () => {
    for (const policy of ['RemoteSigned', 'Unrestricted', 'Bypass', ' remotesigned\r\n']) expect(allowsLocalScripts(policy)).toBe(true);
    for (const policy of ['Restricted', 'AllSigned', 'Undefined', '']) expect(allowsLocalScripts(policy)).toBe(false);
  });
});

describe('grupo sem subcomando mostra a ajuda', () => {
  const node = (name: string, commands: CommandNode[] = [], aliases: string[] = []): CommandNode => ({ name: () => name, aliases: () => aliases, commands });
  const scenes = node('scenes', [node('sync'), node('watch')]);
  const edl = node('edl', [node('list'), node('save')], ['e']);
  const root = node('mce', [node('levels'), scenes, edl]);

  it('mce sem argumentos e grupo sem subcomando', () => {
    expect(bareGroup(root, [])).toBe(root);
    expect(bareGroup(root, ['scenes'])).toBe(scenes);
    expect(bareGroup(root, ['edl'])).toBe(edl);
    expect(bareGroup(root, ['e'])).toBe(edl);
  });

  it('deixa o commander cuidar de comando folha, opção e subcomando desconhecido', () => {
    expect(bareGroup(root, ['levels'])).toBeNull();
    expect(bareGroup(root, ['scenes', 'sync'])).toBeNull();
    expect(bareGroup(root, ['scenes', '--help'])).toBeNull();
    expect(bareGroup(root, ['scenes', 'nada'])).toBeNull();
    expect(bareGroup(root, ['--version'])).toBeNull();
    expect(bareGroup(root, ['edl', 'list', 'teste'])).toBeNull();
  });
});

describe('caminho digitado pelo usuário', () => {
  it('relativo vale a partir da pasta onde ele está', () => {
    expect(userPath('D:\\Gravações\\Aula 1', '.\\vídeo final.mp4')).toBe('D:\\Gravações\\Aula 1\\vídeo final.mp4');
    expect(userPath('D:\\Gravações', '..\\outro\\a.mp4')).toBe('D:\\outro\\a.mp4');
  });

  it('absoluto fica como está', () => {
    expect(userPath('C:\\', 'D:\\Gravações\\Aula 1\\vídeo.mp4')).toBe('D:\\Gravações\\Aula 1\\vídeo.mp4');
  });
});
