// Ficha de cada TEMA de universo: paleta, fonte de apoio, peças e como ele respeita os direitos da obra.
// Módulo PURO (sem React, sem Three): é o que `pnpm mce arsenal themes`, `pnpm mce analogies`, o lint e os testes leem.
// O desenho de cada tema fica em `./<id>/index.tsx` e entra no registro em `./index.ts`.
//
// REGRA DE DIREITOS (vale para todo tema): evocar o universo por ESTILO, paleta, atmosfera e iconografia genérica
// desenhada do zero. Nunca logotipo oficial, arte, sprite, textura, fonte proprietária, trilha ou personagem com o
// desenho original. O nome da obra pode aparecer em texto. O coral e a tipografia do canal continuam no conteúdo.
//
// Tema novo: 1) uma entrada aqui (mesmo id do universo em `src/analogy/catalog.ts`); 2) `./<id>/index.tsx` com as peças;
// 3) uma linha em `./index.ts`. Um tema `minimo` só precisa de paleta + 2–3 peças: o resto ele herda de `base`.

import type { ThemeCategory, ThemePalette, ThemeSpec, ThemeStatus } from './types';

export const NEUTRAL_THEME = 'neutro';

const OK = '#34d399';
const DANGER = '#ff6b6b';

const neutro: ThemeSpec = {
  id: NEUTRAL_THEME,
  name: 'Neutro (padrão do canal)',
  category: 'neutro',
  status: 'neutro',
  dark: false,
  chromeFont: 'Inter',
  description: 'Papel com glows e figuras de traço limpo: a analogia sem universo, no estilo padrão do canal.',
  pieces: ['figuras em peão arredondado', 'pedestal', 'selo', 'bloco de papel'],
  rights: 'Só o design system MChiodi.',
  palette: {
    sky: ['#f8f8f2', '#f4f4ec', '#efeee6'],
    ground: '#e6e5da',
    shade: '#cbd5e1',
    figure: '#0f172a',
    primary: '#475569',
    secondary: '#7c93ff',
    glow: '#9dffce',
    title: '#0f172a',
    text: '#475569',
    panel: 'rgba(255,255,255,0.8)',
    panelBorder: 'rgba(255,255,255,0.95)',
    panelText: '#0f172a',
    panelMuted: '#475569',
    ok: OK,
    danger: '#e11d48',
  },
};

const COMPLETE: ThemeSpec[] = [
  {
    id: 'batman',
    name: 'Batman',
    category: 'super-herois',
    status: 'completo',
    dark: true,
    chromeFont: 'Bebas Neue',
    description: 'Noir gótico: noite azul-carvão, cidade em silhueta com agulhas, lua entre nuvens, holofote varrendo o céu e chuva fina.',
    pieces: ['cidade gótica em três planos', 'holofote com emblema de morcego próprio', 'telhado com parapeito', 'vigilante de capa em silhueta', 'mordomo de fraque com bandeja', 'vilão de cartola', 'gárgula', 'chuva e névoa'],
    rights: 'Silhuetas e emblema de morcego geométrico desenhados do zero; nenhum logotipo, traje ou personagem oficial; fonte Bebas Neue (livre).',
    palette: {
      sky: ['#060a14', '#0e1a30', '#243552'],
      ground: '#04060b',
      shade: '#0c1424',
      figure: '#03050a',
      primary: '#f2c94c',
      secondary: '#6f8fc9',
      glow: '#dfe9ff',
      title: '#ffffff',
      text: '#b8c4dc',
      panel: 'rgba(9,14,27,0.88)',
      panelBorder: 'rgba(143,170,222,0.4)',
      panelText: '#f4f7ff',
      panelMuted: '#9fb0d0',
      ok: OK,
      danger: DANGER,
    },
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    category: 'jogo-8bit',
    status: 'completo',
    dark: true,
    chromeFont: 'Press Start 2P',
    description: 'Mundo voxel 3D (kit voxel): grama, terra e pedra geradas por código, morros, árvores de cubos, céu chapado com nuvens quadradas e interface de inventário em pixel.',
    pieces: ['terreno voxel com morros e árvores', 'nuvens e sol quadrados', 'aventureiro de cubos', 'guia de cubos', 'criatura de cubos', 'blocos de construção', 'painel de inventário chanfrado', 'barra segmentada'],
    rights: 'Texturas procedurais próprias e personagens de cubos genéricos (sem as skins, criaturas ou a fonte do jogo); fonte Press Start 2P (livre).',
    palette: {
      sky: ['#6fa2f5', '#9cc3ff', '#d3e6ff'],
      ground: '#5d9b3c',
      shade: '#3f6e2a',
      figure: '#2b2b2b',
      primary: '#5d9b3c',
      secondary: '#8b5a2b',
      glow: '#fff1c2',
      title: '#ffffff',
      text: '#f4f4f8',
      panel: '#c6c6c6',
      panelBorder: '#2b2b2b',
      panelText: '#1f1f1f',
      panelMuted: '#454545',
      ok: '#3fae4a',
      danger: '#d8343a',
    },
  },
  {
    id: 'mario',
    name: 'Super Mario',
    category: 'jogo-8bit',
    status: 'completo',
    dark: true,
    chromeFont: 'Press Start 2P',
    description: 'Plataforma 8/16-bit: céu chapado, nuvens e morros em pixel, chão de tijolos, blocos, canos e moedas.',
    pieces: ['nuvens e morros em pixel', 'chão de tijolos', 'cano', 'bloco-surpresa com estrela', 'moeda girando', 'herói de boné em pixel', 'companheiro-estrela', 'monstro de chifres', 'mastro de chegada'],
    rights: 'Sprites próprios em pixel (herói de boné sem bigode nem macacão, monstro e blocos genéricos); nenhum sprite, personagem ou fonte do jogo; fonte Press Start 2P (livre).',
    palette: {
      sky: ['#5c94fc', '#7fb0ff', '#b9d6ff'],
      ground: '#c8672c',
      shade: '#4aa02c',
      figure: '#1b1b3a',
      primary: '#fbd000',
      secondary: '#43b047',
      glow: '#ffffff',
      title: '#ffffff',
      text: '#f8f8f2',
      panel: '#fff8e7',
      panelBorder: '#1b1b3a',
      panelText: '#1b1b3a',
      panelMuted: '#4a4a6a',
      ok: '#2f9e44',
      danger: '#d8343a',
    },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    category: 'ficcao-cientifica',
    status: 'completo',
    dark: true,
    chromeFont: 'JetBrains Mono',
    description: 'Chuva de código verde em três profundidades, chão em grade de perspectiva, varredura de CRT e janelas de terminal.',
    pieces: ['chuva de código em camadas', 'grade de perspectiva', 'figura de sobretudo', 'operador com fone', 'agente de terno', 'pílulas (duas cores)', 'janela de terminal', 'linhas de varredura'],
    rights: 'Chuva feita só com caracteres de código (ASCII); silhuetas genéricas de sobretudo e terno; nenhuma imagem, glifo ou fonte do filme; fonte JetBrains Mono (livre).',
    palette: {
      sky: ['#000300', '#010c04', '#031a0a'],
      ground: '#010a03',
      shade: '#06310f',
      figure: '#000000',
      primary: '#39ff7a',
      secondary: '#0f9d3d',
      glow: '#b6ffcc',
      title: '#eafff0',
      text: '#8fe3a7',
      panel: 'rgba(0,12,4,0.9)',
      panelBorder: 'rgba(57,255,122,0.6)',
      panelText: '#e6ffee',
      panelMuted: '#7fd69a',
      ok: '#39ff7a',
      danger: '#ff4d5e',
    },
  },
  {
    id: 'star-wars',
    name: 'Star Wars',
    category: 'ficcao-cientifica',
    status: 'completo',
    dark: true,
    chromeFont: 'Orbitron',
    description: 'Espaço profundo: estrelas em três planos de parallax, nebulosa, planeta anelado e lua, horizonte de rocha, hologramas e letreiro em perspectiva.',
    pieces: ['estrelas em parallax', 'planeta anelado e lua', 'horizonte de rocha', 'letreiro em perspectiva', 'cavaleiro de manto com sabre de luz', 'droide flutuante', 'senhor sombrio de armadura', 'holograma'],
    rights: 'Sabres, droide, armadura e naves com desenho próprio e genérico; o letreiro usa a tipografia do canal; nenhum logotipo, personagem ou fonte da franquia; fonte Orbitron (livre).',
    palette: {
      sky: ['#01030a', '#050a1c', '#0b1433'],
      ground: '#080b16',
      shade: '#141b33',
      figure: '#04060d',
      primary: '#ffe081',
      secondary: '#58c8ff',
      glow: '#9fd8ff',
      title: '#ffffff',
      text: '#b9c6e6',
      panel: 'rgba(24,96,150,0.22)',
      panelBorder: 'rgba(110,205,255,0.65)',
      panelText: '#eaf7ff',
      panelMuted: '#9fcfee',
      ok: '#5ef2a0',
      danger: '#ff5a4d',
    },
  },
  {
    id: 'rpg',
    name: 'RPG',
    category: 'fantasia',
    status: 'completo',
    dark: false,
    chromeFont: 'Cinzel',
    description: 'Fantasia de mesa: pergaminho envelhecido, mapa desenhado à tinta (montanhas, floresta, castelo, rosa dos ventos), barras de vida e XP, inventário e dados.',
    pieces: ['pergaminho com manchas e borda', 'mapa à tinta', 'rosa dos ventos', 'classes de herói (guerreiro, maga, arqueiro, ladino, clériga, bardo)', 'sábio com lanterna', 'dragão', 'baú e dado', 'cartão de pergaminho', 'barra de vida/XP'],
    rights: 'Ilustração própria à tinta; nenhuma arte, ficha ou marca de sistema de RPG existente; fonte Cinzel (livre).',
    palette: {
      sky: ['#f3e3bd', '#ecd6a6', '#dfc589'],
      ground: '#c9a868',
      shade: '#7a5c30',
      figure: '#3b2a1a',
      primary: '#2f5d50',
      secondary: '#b8862b',
      glow: '#fff4cf',
      title: '#2b1d10',
      text: '#5a4630',
      panel: '#f8ecce',
      panelBorder: '#5a3d1e',
      panelText: '#2b1d10',
      panelMuted: '#6b5437',
      ok: '#3f8f5b',
      danger: '#b3261e',
    },
  },
];

interface CategorySeed {
  id: ThemeCategory;
  name: string;
  dark: boolean;
  chromeFont: string;
  description: string;
  pieces: string[];
  palette: ThemePalette;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  {
    id: 'super-herois',
    name: 'Super-heróis (genérico)',
    dark: true,
    chromeFont: 'Bebas Neue',
    description: 'Quadrinho ao entardecer: cidade em silhueta, raios de sol e retícula de impressão; heróis de capa sem identidade.',
    pieces: ['skyline em silhueta', 'raios e retícula', 'herói de capa genérico', 'emblema de estrela'],
    palette: {
      sky: ['#141a4a', '#3a3f9a', '#ff8a5c'],
      ground: '#0c0f2b',
      shade: '#1b2160',
      figure: '#080a1f',
      primary: '#ffd23f',
      secondary: '#4f7cff',
      glow: '#fff0b8',
      title: '#ffffff',
      text: '#d5dbff',
      panel: 'rgba(12,15,43,0.88)',
      panelBorder: 'rgba(255,210,63,0.55)',
      panelText: '#ffffff',
      panelMuted: '#b9c1f2',
      ok: OK,
      danger: DANGER,
    },
  },
  {
    id: 'fantasia',
    name: 'Fantasia medieval (genérico)',
    dark: false,
    chromeFont: 'Cinzel',
    description: 'Livro de histórias: colinas em camadas, castelo ao longe e sol baixo; as classes de herói do tema RPG.',
    pieces: ['colinas em camadas', 'castelo em silhueta', 'sol baixo', 'estandarte'],
    palette: {
      sky: ['#f1e8c6', '#e6dcae', '#d4cb93'],
      ground: '#8f9c5c',
      shade: '#6f7d4a',
      figure: '#2f2a1c',
      primary: '#3f6b4a',
      secondary: '#a9792b',
      glow: '#fff6d6',
      title: '#2a2415',
      text: '#55492f',
      panel: '#f6eed2',
      panelBorder: '#4f4424',
      panelText: '#2a2415',
      panelMuted: '#665a3c',
      ok: '#3f8f5b',
      danger: '#b3261e',
    },
  },
  {
    id: 'ficcao-cientifica',
    name: 'Ficção científica (genérico)',
    dark: true,
    chromeFont: 'Orbitron',
    description: 'Espaço com nebulosa, planeta e grade de horizonte; tripulantes de traje sem identidade e painéis de holograma.',
    pieces: ['estrelas em parallax', 'nebulosa', 'planeta', 'tripulante de traje', 'holograma'],
    palette: {
      sky: ['#02040d', '#07102a', '#101a44'],
      ground: '#070b1a',
      shade: '#131c3d',
      figure: '#04060f',
      primary: '#5ef2ff',
      secondary: '#b388ff',
      glow: '#bfe9ff',
      title: '#ffffff',
      text: '#b7c3e8',
      panel: 'rgba(40,120,150,0.2)',
      panelBorder: 'rgba(94,242,255,0.6)',
      panelText: '#ecfdff',
      panelMuted: '#a5d8e6',
      ok: '#5ef2a0',
      danger: '#ff5a4d',
    },
  },
  {
    id: 'jogo-8bit',
    name: 'Jogo 8-bit (genérico)',
    dark: true,
    chromeFont: 'Press Start 2P',
    description: 'Fliperama à noite: céu roxo com estrelas em pixel, plataformas, moedas e HUD de pontuação.',
    pieces: ['céu de fliperama', 'plataformas em pixel', 'moedas', 'herói em pixel', 'HUD de pontos'],
    palette: {
      sky: ['#120a33', '#22135c', '#3a1f86'],
      ground: '#5a3fc0',
      shade: '#3b2a8c',
      figure: '#0b0620',
      primary: '#ffcc00',
      secondary: '#00e5ff',
      glow: '#ffffff',
      title: '#ffffff',
      text: '#d9d2ff',
      panel: '#17103a',
      panelBorder: '#f4f4f8',
      panelText: '#ffffff',
      panelMuted: '#b8b0e6',
      ok: '#4ade80',
      danger: '#ff5a6e',
    },
  },
  {
    id: 'anime',
    name: 'Anime (genérico)',
    dark: true,
    chromeFont: 'Bebas Neue',
    description: 'Pôr do sol saturado com linhas de velocidade e brilho de impacto; figuras de traço limpo.',
    pieces: ['degradê de pôr do sol', 'linhas de velocidade', 'brilho de impacto', 'nuvens recortadas'],
    palette: {
      sky: ['#3a1d6e', '#c2417c', '#ff9a5a'],
      ground: '#2a1450',
      shade: '#5a2a84',
      figure: '#170a33',
      primary: '#ffe45c',
      secondary: '#ff6fa5',
      glow: '#fff3c4',
      title: '#ffffff',
      text: '#ffe6f0',
      panel: 'rgba(23,10,51,0.88)',
      panelBorder: 'rgba(255,228,92,0.6)',
      panelText: '#ffffff',
      panelMuted: '#f0c7dd',
      ok: OK,
      danger: DANGER,
    },
  },
  {
    id: 'esporte',
    name: 'Esporte (genérico)',
    dark: true,
    chromeFont: 'Bebas Neue',
    description: 'Estádio à noite: gramado em faixas, refletores, arquibancada em pontos de luz e placar.',
    pieces: ['gramado em faixas', 'refletores', 'arquibancada', 'placar'],
    palette: {
      sky: ['#06121f', '#0c2438', '#143a52'],
      ground: '#1f7a3a',
      shade: '#0b1f2e',
      figure: '#071019',
      primary: '#ffffff',
      secondary: '#ffd23f',
      glow: '#f4fbff',
      title: '#ffffff',
      text: '#c5d7e6',
      panel: 'rgba(6,18,31,0.88)',
      panelBorder: 'rgba(255,255,255,0.45)',
      panelText: '#ffffff',
      panelMuted: '#a9bfd0',
      ok: OK,
      danger: DANGER,
    },
  },
  {
    id: 'tabuleiro',
    name: 'Jogo de mesa (genérico)',
    dark: true,
    chromeFont: 'Cinzel',
    description: 'Mesa de madeira sob luz quente com um tabuleiro em perspectiva; as figuras são peões.',
    pieces: ['mesa de madeira', 'tabuleiro em perspectiva', 'luminária', 'peões'],
    palette: {
      sky: ['#241a12', '#3a2a1c', '#553c28'],
      ground: '#7a5a3a',
      shade: '#2b1f16',
      figure: '#1a120c',
      primary: '#e8d5a8',
      secondary: '#3f7d5c',
      glow: '#fff0d0',
      title: '#fff8e8',
      text: '#dccbaa',
      panel: '#f3e7cc',
      panelBorder: '#3d2c1f',
      panelText: '#2b1f16',
      panelMuted: '#6a5540',
      ok: '#3f8f5b',
      danger: '#b3261e',
    },
  },
];

const GENERIC_RIGHTS = 'Iconografia genérica do gênero, desenhada do zero; nenhuma obra específica é reproduzida.';

const CATEGORIES: ThemeSpec[] = CATEGORY_SEEDS.map((seed) => ({ ...seed, category: seed.id, status: 'categoria' as ThemeStatus, rights: GENERIC_RIGHTS }));

interface MinimalSeed {
  id: string;
  name: string;
  base: ThemeCategory;
  dark?: boolean;
  description: string;
  pieces: string[];
  rights: string;
  palette: Partial<ThemePalette>;
}

const DARK_PANEL = { title: '#ffffff', panelText: '#ffffff' } as const;

const MINIMAL_SEEDS: MinimalSeed[] = [
  {
    id: 'marvel',
    name: 'Vingadores (Marvel)',
    base: 'super-herois',
    description: 'Cidade ao entardecer em vermelho e ouro, com um reator de luz e um escudo redondo genérico.',
    pieces: ['reator de luz', 'escudo redondo com estrela'],
    rights: 'Reator e escudo com desenho próprio (anéis e estrela genéricos); nenhum logotipo, traje ou personagem.',
    palette: { sky: ['#0d1230', '#27306e', '#e2684a'], primary: '#f2b632', secondary: '#d1343a', panelBorder: 'rgba(242,182,50,0.55)' },
  },
  {
    id: 'homem-aranha',
    name: 'Homem-Aranha',
    base: 'super-herois',
    description: 'Arranha-céus em vermelho e azul com teias nos cantos do quadro.',
    pieces: ['teia de canto', 'emblema de aranha geométrico'],
    rights: 'Teia e aranha geométricas próprias; nenhum traje, máscara ou logotipo.',
    palette: { sky: ['#0b1438', '#1f3f9a', '#f08a5d'], primary: '#e8ecf6', secondary: '#d62839', panelBorder: 'rgba(232,236,246,0.5)' },
  },
  {
    id: 'harry-potter',
    name: 'Harry Potter',
    base: 'fantasia',
    dark: true,
    description: 'Noite roxa com castelo de torres ao longe, velas flutuando e estrelas.',
    pieces: ['velas flutuantes', 'chapéu pontudo com estrela', 'castelo de torres'],
    rights: 'Castelo, velas e chapéu genéricos de conto de bruxos; nenhum brasão, personagem ou tipografia da franquia.',
    palette: {
      sky: ['#141033', '#231a52', '#3b2c77'], ground: '#0e0a26', shade: '#0a0720', figure: '#07051a', primary: '#f0c75e', secondary: '#7a1f2b', glow: '#ffe9a8',
      text: '#d6cdf2', panel: 'rgba(20,16,51,0.88)', panelBorder: 'rgba(240,199,94,0.55)', panelMuted: '#c9bfe8', ...DARK_PANEL,
    },
  },
  {
    id: 'senhor-dos-aneis',
    name: 'O Senhor dos Anéis',
    base: 'fantasia',
    dark: true,
    description: 'Entardecer vulcânico: montanha com brilho de lava, colinas escuras e um anel dourado.',
    pieces: ['montanha em brasa', 'anel dourado'],
    rights: 'Montanha e anel liso genéricos; nenhuma inscrição, mapa ou personagem da obra.',
    palette: {
      sky: ['#2a1a12', '#6b3a1e', '#e08a3c'], ground: '#1a100a', shade: '#2e1b10', figure: '#120a06', primary: '#f2c14e', secondary: '#c8553d', glow: '#ffd88a',
      text: '#f0d9bd', panel: 'rgba(26,16,10,0.88)', panelBorder: 'rgba(242,193,78,0.6)', panelMuted: '#e0c7a6', ...DARK_PANEL,
    },
  },
  {
    id: 'game-of-thrones',
    name: 'Game of Thrones',
    base: 'fantasia',
    dark: true,
    description: 'Norte gelado: céu de aço, neve caindo, muralha de gelo ao longe e um trono de lâminas.',
    pieces: ['neve', 'muralha de gelo', 'trono de lâminas'],
    rights: 'Muralha, neve e trono genéricos; nenhum brasão de casa, personagem ou tipografia da série.',
    palette: {
      sky: ['#0d1a26', '#22394d', '#6f8ea3'], ground: '#c9d8e3', shade: '#16283a', figure: '#0a121a', primary: '#b9d4e6', secondary: '#8f1d21', glow: '#eaf6ff',
      text: '#c9d9e6', panel: 'rgba(13,26,38,0.88)', panelBorder: 'rgba(185,212,230,0.55)', panelMuted: '#a9bfd0', ...DARK_PANEL,
    },
  },
  {
    id: 'zelda',
    name: 'The Legend of Zelda',
    base: 'fantasia',
    description: 'Campos verdes de aventura: colinas claras, espada cravada num pedestal e corações de vida.',
    pieces: ['espada no pedestal', 'corações de vida'],
    rights: 'Espada e corações genéricos de aventura; nenhum símbolo, personagem ou item com o desenho do jogo.',
    palette: {
      sky: ['#bfe8c9', '#d9f2c4', '#f4f7c8'], ground: '#4f9d4a', shade: '#2f6d3a', figure: '#1d3b24', primary: '#2f8f4e', secondary: '#e0b93b', glow: '#fffbe0',
      title: '#17301d', text: '#33553a', panel: '#f6f3d6', panelBorder: '#2f6d3a', panelText: '#17301d', panelMuted: '#4a6a4f',
    },
  },
  {
    id: 'dark-souls',
    name: 'Dark Souls',
    base: 'fantasia',
    dark: true,
    description: 'Ruína em cinzas: céu de carvão, arcos quebrados e uma fogueira com espada cravada.',
    pieces: ['fogueira com espada', 'arcos em ruína', 'cinzas subindo'],
    rights: 'Fogueira, ruína e cinzas genéricas; nenhuma tela, tipografia ou personagem do jogo.',
    palette: {
      sky: ['#0b0b0d', '#1c1a1a', '#3a2f28'], ground: '#0a0908', shade: '#161412', figure: '#050505', primary: '#e8842c', secondary: '#8a8a8a', glow: '#ffb86b',
      text: '#cfc6bb', panel: 'rgba(10,9,8,0.9)', panelBorder: 'rgba(232,132,44,0.5)', panelMuted: '#b3a99c', ...DARK_PANEL,
    },
  },
  {
    id: 'pokemon',
    name: 'Pokémon',
    base: 'anime',
    description: 'Dia claro de aventura: grama alta, céu azul e cápsulas de captura.',
    pieces: ['cápsula de captura (duas cores, trava em losango)', 'grama alta', 'raio de energia'],
    rights: 'Cápsula com desenho e cores próprios (não é a esfera da franquia); nenhuma criatura, logotipo ou tipografia.',
    palette: {
      sky: ['#58b7f0', '#8fd0ff', '#d6f0ff'], ground: '#58a83e', shade: '#3f8f3a', figure: '#1f2a44', primary: '#ffcb05', secondary: '#3466af', glow: '#ffffff',
      text: '#f4faff', panel: '#ffffff', panelBorder: '#1f2a44', panelText: '#1f2a44', panelMuted: '#4a5a7a',
    },
  },
  {
    id: 'dragon-ball',
    name: 'Dragon Ball',
    base: 'anime',
    dark: false,
    description: 'Céu laranja com nuvem dourada, aura de energia e esferas com estrelas.',
    pieces: ['esferas com estrelas', 'aura em chamas', 'nuvem dourada'],
    rights: 'Esferas, aura e nuvem genéricas; nenhum personagem, penteado ou logotipo da obra.',
    palette: {
      sky: ['#ff8c1a', '#ffb347', '#ffe08a'], ground: '#b85c0e', shade: '#e07a14', figure: '#2a1406', primary: '#ff7a00', secondary: '#1f5fd6', glow: '#fff2a8',
      title: '#2a1406', text: '#5a3410', panel: '#fff6e0', panelBorder: '#2a1406', panelText: '#2a1406', panelMuted: '#6b4a22',
    },
  },
  {
    id: 'naruto',
    name: 'Naruto',
    base: 'anime',
    description: 'Vila ao pôr do sol: telhados em silhueta, folhas no vento e estrela de arremesso.',
    pieces: ['folhas no vento', 'estrela de arremesso', 'telhados da vila'],
    rights: 'Folha, shuriken e telhados genéricos; nenhuma bandana, símbolo de vila ou personagem.',
    palette: { sky: ['#1f2d4a', '#e2703a', '#ffb25c'], ground: '#2a1c12', shade: '#27344f', figure: '#141c2e', primary: '#ff8c1a', secondary: '#2f6fb0', glow: '#ffd9a0', panelBorder: 'rgba(255,140,26,0.6)' },
  },
  {
    id: 'one-piece',
    name: 'One Piece',
    base: 'anime',
    description: 'Mar aberto: ondas, navio de vela ao longe e chapéu de palha.',
    pieces: ['ondas', 'navio de vela', 'chapéu de palha'],
    rights: 'Navio, ondas e chapéu genéricos; nenhuma bandeira, personagem ou logotipo.',
    palette: {
      sky: ['#2aa5e0', '#7fd0f5', '#e6f7ff'], ground: '#1b6fb0', shade: '#145a90', figure: '#10243a', primary: '#f2c14e', secondary: '#c8102e', glow: '#ffffff',
      text: '#f4faff', panel: '#fff8e7', panelBorder: '#10243a', panelText: '#10243a', panelMuted: '#3f556e',
    },
  },
  {
    id: 'pacman',
    name: 'Pac-Man',
    base: 'jogo-8bit',
    description: 'Labirinto de néon azul sobre preto, com pastilhas e um comilão quadrado.',
    pieces: ['labirinto de néon', 'pastilhas', 'comilão quadrado'],
    rights: 'Labirinto e comilão quadrado próprios; nenhum personagem, fantasma ou tela do jogo.',
    palette: { sky: ['#000000', '#05051a', '#0a0a2e'], ground: '#1b1bd6', shade: '#12127a', figure: '#05051a', primary: '#ffe600', secondary: '#2f2fff', panel: '#05051a', panelBorder: '#2f2fff' },
  },
  {
    id: 'tetris',
    name: 'Tetris',
    base: 'jogo-8bit',
    description: 'Poço de peças: grade escura com peças de quatro blocos caindo e uma linha quase completa.',
    pieces: ['peças de quatro blocos', 'poço em grade'],
    rights: 'Peças geométricas de quatro quadrados (forma matemática) com cores próprias; nenhuma tela, logotipo ou trilha.',
    palette: { sky: ['#0b1020', '#141c3a', '#1f2a55'], ground: '#2b3a7a', shade: '#243066', figure: '#070b18', primary: '#00d8ff', secondary: '#ff9f1c', panel: '#0b1020', panelBorder: '#00d8ff' },
  },
  {
    id: 'among-us',
    name: 'Among Us',
    base: 'jogo-8bit',
    description: 'Corredor de nave em tons frios, com painel de tarefas e botão de emergência.',
    pieces: ['botão de emergência', 'visor de traje'],
    rights: 'Botão e visor genéricos; nenhum personagem, mapa ou interface do jogo.',
    palette: { sky: ['#05070f', '#0d1326', '#1a2140'], ground: '#39456e', shade: '#222b4f', figure: '#05070f', primary: '#38fedc', secondary: '#ff4d4d', panel: '#0d1326', panelBorder: '#38fedc' },
  },
  {
    id: 'de-volta-para-o-futuro',
    name: 'De Volta para o Futuro',
    base: 'ficcao-cientifica',
    description: 'Pôr do sol dos anos 80 com grade de néon, relógio de torre e rastros de fogo.',
    pieces: ['rastros de fogo', 'relógio de torre', 'sol listrado'],
    rights: 'Estética retrô genérica; nenhum veículo, logotipo ou personagem do filme.',
    palette: { sky: ['#0a0618', '#2a1052', '#ff5e3a'], ground: '#0a0618', shade: '#1a0c38', primary: '#ff9f1c', secondary: '#3ad6ff', glow: '#ffe1a8', panelBorder: 'rgba(255,159,28,0.6)', panel: 'rgba(42,16,82,0.5)' },
  },
  {
    id: 'stranger-things',
    name: 'Stranger Things',
    base: 'ficcao-cientifica',
    description: 'Mundo às avessas: névoa vermelha, esporos flutuando, luzes de varal piscando.',
    pieces: ['luzes de varal', 'esporos', 'raízes'],
    rights: 'Varal de luzes, esporos e raízes genéricos; nenhum logotipo, tipografia ou criatura da série.',
    palette: {
      sky: ['#050208', '#1a0510', '#3d0a12'], ground: '#080206', shade: '#12040a', figure: '#030104', primary: '#e01b24', secondary: '#f2c14e', glow: '#ff8a8a',
      text: '#e6c3c6', panel: 'rgba(5,2,8,0.9)', panelBorder: 'rgba(224,27,36,0.6)', panelMuted: '#d0a5a9',
    },
  },
  {
    id: 'futebol',
    name: 'Futebol',
    base: 'esporte',
    description: 'Gramado sob refletores com o círculo central, trave e bola de gomos.',
    pieces: ['trave com rede', 'bola de gomos', 'círculo central'],
    rights: 'Campo, trave e bola genéricos; nenhum escudo de clube, uniforme ou marca.',
    palette: { primary: '#ffffff', secondary: '#ffd23f' },
  },
  {
    id: 'formula-1',
    name: 'Fórmula 1',
    base: 'esporte',
    description: 'Reta de asfalto à noite: zebras, semáforo de largada e bandeira quadriculada.',
    pieces: ['bandeira quadriculada', 'semáforo de largada', 'zebras'],
    rights: 'Pista, semáforo e bandeira genéricos; nenhum carro, equipe, patrocinador ou logotipo.',
    palette: { sky: ['#0a0a0c', '#1c1c22', '#3a3a44'], ground: '#2a2a30', shade: '#15151a', primary: '#ffffff', secondary: '#e10600', panelBorder: 'rgba(255,255,255,0.5)' },
  },
  {
    id: 'xadrez',
    name: 'Xadrez',
    base: 'tabuleiro',
    description: 'Tabuleiro de casas claras e escuras em perspectiva, com rei e cavalo torneados.',
    pieces: ['casas do tabuleiro', 'rei', 'cavalo'],
    rights: 'Peças torneadas clássicas (domínio público) com desenho próprio.',
    palette: { sky: ['#141416', '#232327', '#35353b'], ground: '#d9c7a0', shade: '#101012', primary: '#f0e6cf', secondary: '#2b2b2b', panelBorder: '#141416' },
  },
  {
    id: 'cartas',
    name: 'Jogo de cartas',
    base: 'tabuleiro',
    description: 'Mesa de feltro verde com leque de cartas e fichas empilhadas.',
    pieces: ['leque de cartas', 'fichas', 'naipes'],
    rights: 'Cartas, naipes e fichas genéricos (domínio público) com desenho próprio; nenhuma marca de baralho.',
    palette: { sky: ['#0b2a1c', '#0f3d28', '#145236'], ground: '#0f4a30', shade: '#092015', primary: '#e8d5a8', secondary: '#b3261e', panel: '#fbf6ea', panelBorder: '#1a1a1c', panelText: '#1a1a1c', panelMuted: '#55504a' },
  },
  {
    id: 'lego',
    name: 'Blocos de montar (Lego)',
    base: 'tabuleiro',
    dark: false,
    description: 'Fundo amarelo vivo com base verde e tijolos de encaixe coloridos.',
    pieces: ['tijolo de encaixe com pinos', 'base de montagem'],
    rights: 'Tijolos de encaixe genéricos com pinos lisos (sem a marca gravada); nenhum logotipo, minifigura ou embalagem.',
    palette: {
      sky: ['#ffe26a', '#ffd23f', '#ffc21a'], ground: '#2f9e44', shade: '#f5b700', figure: '#1f1f1f', primary: '#e3000b', secondary: '#0055bf', glow: '#ffffff',
      title: '#1f1f1f', text: '#3a3a3a', panel: '#ffffff', panelBorder: '#1f1f1f', panelText: '#1f1f1f', panelMuted: '#4a4a4a',
    },
  },
];

const categoryById = new Map(CATEGORIES.map((spec) => [spec.id, spec]));

const MINIMAL: ThemeSpec[] = MINIMAL_SEEDS.map((seed) => {
  const base = categoryById.get(seed.base)!;
  return {
    id: seed.id,
    name: seed.name,
    category: seed.base,
    status: 'minimo',
    base: seed.base,
    dark: seed.dark ?? base.dark,
    chromeFont: base.chromeFont,
    description: seed.description,
    pieces: seed.pieces,
    rights: seed.rights,
    palette: { ...base.palette, ...seed.palette },
  };
});

/** Todos os temas, na ordem: neutro, completos, mínimos, categorias. */
export const THEME_SPECS: ThemeSpec[] = [neutro, ...COMPLETE, ...MINIMAL, ...CATEGORIES];

const SPEC_BY_ID = new Map(THEME_SPECS.map((spec) => [spec.id, spec]));

export function hasTheme(id: string): boolean {
  return SPEC_BY_ID.has(id);
}

/**
 * Tema que atende a um pedido: o próprio, se existe; senão o da categoria informada; senão o neutro.
 * É a mesma regra no render (`getTheme`) e na cobrança (`analogia-sem-tema`).
 */
export function resolveThemeId(id: string | undefined | null, category?: string | null): string {
  if (id && SPEC_BY_ID.has(id)) return id;
  if (category && SPEC_BY_ID.has(category)) return category;
  return NEUTRAL_THEME;
}

export function themeSpec(id: string | undefined | null, category?: string | null): ThemeSpec {
  return SPEC_BY_ID.get(resolveThemeId(id, category))!;
}

export const THEME_STATUS_LABEL: Record<ThemeStatus, string> = {
  completo: 'completo',
  minimo: 'mínimo',
  categoria: 'genérico da categoria',
  neutro: 'padrão do canal',
};
