/**
 * Catálogo de UNIVERSOS de analogia: as referências (games, filmes, séries, animes, esportes, jogos de mesa) que o
 * Matheus usa para explicar as coisas. Cada universo diz como ele aparece na FALA (gatilhos em PT-BR, já com os erros de
 * transcrição prováveis) e qual TEMA visual a animação daquele trecho veste (`motion/src/themes/<id>/`).
 *
 * Módulo puro: sem Node, sem React. Para acrescentar um universo: uma entrada aqui + um tema com o mesmo id
 * (`motion/src/themes/<id>/`, registrado em `motion/src/themes/specs.ts`); sem tema próprio, aponte `theme` para o
 * tema da categoria. Os testes cobram id único, gatilho sem colisão e tema registrado.
 */

export type UniverseCategory = 'super-herois' | 'fantasia' | 'ficcao-cientifica' | 'jogo-8bit' | 'anime' | 'esporte' | 'tabuleiro';

export const UNIVERSE_CATEGORIES: Record<UniverseCategory, string> = {
  'super-herois': 'super-heróis',
  fantasia: 'fantasia medieval',
  'ficcao-cientifica': 'ficção científica',
  'jogo-8bit': 'jogo 8-bit',
  anime: 'anime',
  esporte: 'esporte',
  tabuleiro: 'jogos de mesa e brinquedos',
};

/** A forma da analogia: qual modelo de cena (`scene:modelos/Analogia*`) serve à fala. */
export type AnalogyShape = 'ajudante' | 'equipe' | 'jornada' | 'chefao' | 'inventario' | 'construcao' | 'escolha' | 'levelup';

export const SHAPE_MODELS: Record<AnalogyShape, string> = {
  ajudante: 'AnalogiaAjudante',
  equipe: 'AnalogiaEquipe',
  jornada: 'AnalogiaJornada',
  chefao: 'AnalogiaChefao',
  inventario: 'AnalogiaInventario',
  construcao: 'AnalogiaConstrucao',
  escolha: 'AnalogiaEscolha',
  levelup: 'AnalogiaLevelUp',
};

export interface AmbiguousTrigger {
  /** palavra ou expressão que também existe fora do universo ("bloco", "mario", "coringa") */
  term: string;
  /** só vale com uma destas por perto (mesma frase ou vizinhança) */
  context: string[];
  /** e nunca colada numa destas ("bloco de código", "síndrome do impostor") */
  unless?: string[];
}

export interface Universe {
  id: string;
  name: string;
  category: UniverseCategory;
  /** universo genérico da categoria: recebe as referências que não têm tema próprio */
  fallback?: boolean;
  /** gatilhos fortes: basta aparecer na fala. Escritos como se fala; a comparação ignora acento, caixa e hífen */
  triggers: string[];
  ambiguous?: AmbiguousTrigger[];
  /** id do tema visual em motion/src/themes */
  theme: string;
  /** gatilho → forma da analogia que ele costuma pedir (um ajudante, uma equipe, um chefão…) */
  shapes?: Record<string, AnalogyShape>;
}

export const UNIVERSES: Universe[] = [
  // ------------------------------------------------------------------ temas completos
  {
    id: 'batman',
    name: 'Batman',
    category: 'super-herois',
    theme: 'batman',
    triggers: [
      'batman', 'batmam', 'bat man', 'alfred', 'gotham', 'gotham city', 'batcaverna', 'bat caverna', 'batmóvel', 'bat móvel', 'bat-sinal', 'bat sinal',
      'liga da justiça', 'cavaleiro das trevas', 'bruce wayne', 'arkham', 'cinto de utilidades', 'homem morcego', 'mulher gato',
    ],
    ambiguous: [
      { term: 'alfredo', context: ['batman', 'mordomo', 'bruce', 'gotham', 'batcaverna'] },
      { term: 'robin', context: ['batman', 'parceiro', 'ajudante', 'dupla', 'gotham', 'sidekick'], unless: ['hood'] },
      { term: 'coringa', context: ['batman', 'gotham', 'vilão', 'palhaço', 'risada', 'caos', 'arkham'], unless: ['carta', 'cartas', 'baralho'] },
      { term: 'charada', context: ['batman', 'gotham', 'vilão'] },
      { term: 'mordomo', context: ['batman', 'bruce', 'alfred', 'herói'] },
    ],
    shapes: { alfred: 'ajudante', alfredo: 'ajudante', robin: 'ajudante', mordomo: 'ajudante', 'liga da justiça': 'equipe', coringa: 'chefao', charada: 'chefao', 'cinto de utilidades': 'inventario', batcaverna: 'construcao', 'bat caverna': 'construcao' },
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    category: 'jogo-8bit',
    theme: 'minecraft',
    triggers: [
      'minecraft', 'mine craft', 'maincraft', 'mainecraft', 'creeper', 'criper', 'cripper', 'enderman', 'ender dragon', 'redstone', 'red stone', 'nether',
      'craftar', 'craftando', 'craftei', 'crafting', 'mesa de craft', 'modo criativo', 'modo sobrevivência', 'modo survival', 'herobrine', 'bloco a bloco',
    ],
    ambiguous: [
      { term: 'bloco', context: ['minecraft', 'craftar', 'picareta', 'creeper', 'minerar', 'redstone', 'steve', 'nether'], unless: ['código', 'notas', 'texto', 'comentário', 'try', 'catch', 'anotações', 'carnaval'] },
      { term: 'blocos', context: ['minecraft', 'craftar', 'picareta', 'creeper', 'minerar', 'redstone', 'steve', 'nether'], unless: ['código', 'notas', 'texto', 'comentário', 'anotações'] },
      { term: 'picareta', context: ['minecraft', 'minerar', 'diamante', 'bloco', 'blocos', 'pedra', 'ferro', 'craftar'] },
      { term: 'minerar', context: ['minecraft', 'diamante', 'picareta', 'bloco', 'caverna'], unless: ['bitcoin', 'cripto', 'dados', 'criptomoeda'] },
      { term: 'minerando', context: ['minecraft', 'diamante', 'picareta', 'bloco', 'caverna'], unless: ['bitcoin', 'cripto', 'dados', 'criptomoeda'] },
      { term: 'steve', context: ['minecraft', 'alex', 'bloco', 'creeper'], unless: ['jobs', 'wozniak'] },
      { term: 'sobrevivência', context: ['minecraft', 'criativo', 'modo'] },
      { term: 'criativo', context: ['minecraft', 'sobrevivência', 'survival'] },
      { term: 'diamante', context: ['minecraft', 'picareta', 'minerar', 'bloco'] },
    ],
    shapes: { craftar: 'construcao', craftando: 'construcao', crafting: 'construcao', 'bloco a bloco': 'construcao', bloco: 'construcao', blocos: 'construcao', creeper: 'chefao', 'ender dragon': 'chefao', picareta: 'inventario' },
  },
  {
    id: 'mario',
    name: 'Super Mario',
    category: 'jogo-8bit',
    theme: 'mario',
    triggers: ['super mario', 'mario bros', 'mario kart', 'mario world', 'luigi', 'bowser', 'yoshi', 'koopa', 'goomba', 'princesa peach', 'princesa está em outro castelo', 'outro castelo'],
    ambiguous: [
      { term: 'mario', context: ['nintendo', 'luigi', 'cano', 'canos', 'cogumelo', 'fase', 'fases', 'bowser', 'yoshi', 'princesa', 'kart', 'moeda', 'moedas', 'plataforma', 'jogo', 'videogame', 'bandeira', 'castelo'] },
      { term: 'cano', context: ['mario', 'luigi', 'verde', 'fase'] },
      { term: 'cogumelo', context: ['mario', 'luigi', 'vida', 'crescer', 'fase'] },
      { term: 'moedas', context: ['mario', 'luigi', 'fase', 'pular', 'bloco'] },
    ],
    shapes: { bowser: 'chefao', koopa: 'chefao', luigi: 'ajudante', yoshi: 'ajudante', cogumelo: 'levelup', 'outro castelo': 'jornada', 'princesa está em outro castelo': 'jornada' },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    category: 'ficcao-cientifica',
    theme: 'matrix',
    triggers: ['matrix', 'morpheus', 'morfeu', 'agente smith', 'pílula vermelha', 'pílula azul', 'red pill', 'blue pill', 'toca do coelho', 'glitch na matrix', 'bullet time'],
    ambiguous: [
      { term: 'neo', context: ['matrix', 'morpheus', 'escolhido', 'smith', 'pílula', 'trinity'] },
      { term: 'trinity', context: ['matrix', 'neo', 'morpheus'] },
      { term: 'pílula', context: ['vermelha', 'azul', 'matrix', 'escolher', 'escolha', 'morpheus'] },
      { term: 'pílulas', context: ['vermelha', 'azul', 'matrix', 'escolher', 'escolha', 'morpheus'] },
      { term: 'escolhido', context: ['matrix', 'neo', 'morpheus', 'oráculo'] },
      { term: 'simulação', context: ['matrix', 'neo', 'pílula'] },
    ],
    shapes: { 'pílula vermelha': 'escolha', 'pílula azul': 'escolha', 'red pill': 'escolha', 'blue pill': 'escolha', pílula: 'escolha', pílulas: 'escolha', 'agente smith': 'chefao', morpheus: 'ajudante', morfeu: 'ajudante' },
  },
  {
    id: 'star-wars',
    name: 'Star Wars',
    category: 'ficcao-cientifica',
    theme: 'star-wars',
    triggers: [
      'star wars', 'starwars', 'guerra nas estrelas', 'jedi', 'jedai', 'sith', 'yoda', 'ioda', 'darth vader', 'vader', 'skywalker', 'sabre de luz', 'sabres de luz', 'lightsaber',
      'lado sombrio', 'lado negro da força', 'estrela da morte', 'padawan', 'padauan', 'chewbacca', 'han solo', 'millennium falcon', 'stormtrooper', 'mandaloriano', 'baby yoda', 'grogu',
      'que a força esteja', 'tatooine', 'wookie',
    ],
    ambiguous: [
      { term: 'força', context: ['jedi', 'esteja', 'sabre', 'yoda', 'sith', 'padawan', 'sombrio'] },
      { term: 'império', context: ['rebeldes', 'jedi', 'contra-ataca', 'vader', 'galáxia'] },
      { term: 'rebeldes', context: ['império', 'jedi', 'vader', 'galáxia'] },
    ],
    shapes: { yoda: 'ajudante', ioda: 'ajudante', padawan: 'levelup', padauan: 'levelup', 'darth vader': 'chefao', vader: 'chefao', 'estrela da morte': 'chefao', 'lado sombrio': 'escolha', 'lado negro da força': 'escolha', 'sabre de luz': 'inventario' },
  },
  {
    id: 'rpg',
    name: 'RPG',
    category: 'fantasia',
    theme: 'rpg',
    triggers: [
      'rpg', 'dungeons and dragons', 'dungeons e dragons', 'dungeon', 'masmorra', 'subir de nível', 'upar de nível', 'level up', 'barra de vida',
      'pontos de experiência', 'ganhar xp', 'guilda', 'árvore de habilidades', 'skill tree', 'side quest', 'quest', 'missão secundária', 'chefão final', 'boss final', 'último chefão',
      'paladino', 'necromante', 'npc', 'grindar', 'farmar', 'final fantasy', 'skyrim', 'the witcher', 'witcher', 'tibia', 'world of warcraft', 'poção de vida', 'poção de mana',
    ],
    ambiguous: [
      { term: 'xp', context: ['nível', 'ganhar', 'ganha', 'upar', 'experiência', 'level', 'barra', 'pontos'], unless: ['windows', 'investimentos', 'programming'] },
      { term: 'upar', context: ['nível', 'level', 'personagem', 'xp', 'rank', 'elo', 'skill', 'habilidade'], unless: ['github', 'arquivo', 'projeto', 'site', 'servidor', 'vídeo'] },
      { term: 'upando', context: ['nível', 'level', 'personagem', 'xp', 'rank', 'elo', 'skill', 'habilidade'], unless: ['github', 'arquivo', 'projeto', 'site', 'servidor', 'vídeo'] },
      { term: 'mago', context: ['guerreiro', 'classe', 'feitiço', 'rpg', 'tank', 'arqueiro', 'magia'] },
      { term: 'chefão', context: ['final', 'fase', 'derrotar', 'vida', 'jogo', 'matar', 'enfrentar', 'nível'] },
      { term: 'boss', context: ['final', 'fase', 'derrotar', 'vida', 'jogo', 'matar', 'enfrentar', 'nível'] },
      { term: 'inventário', context: ['item', 'itens', 'mochila', 'poção', 'arma', 'rpg', 'jogo', 'equipar'] },
      { term: 'rank', context: ['subir', 'elo', 'ranqueada', 'patente', 'jogo'] },
      { term: 'mana', context: ['magia', 'feitiço', 'poção', 'vida', 'barra'] },
      { term: 'classe', context: ['guerreiro', 'mago', 'arqueiro', 'rpg', 'paladino'] },
    ],
    shapes: {
      'subir de nível': 'levelup', 'upar de nível': 'levelup', upar: 'levelup', upando: 'levelup', 'level up': 'levelup', xp: 'levelup', 'ganhar xp': 'levelup', rank: 'levelup',
      guilda: 'equipe', 'chefão final': 'chefao', 'boss final': 'chefao', 'último chefão': 'chefao', chefão: 'chefao', boss: 'chefao', inventário: 'inventario', npc: 'ajudante',
      quest: 'jornada', 'side quest': 'jornada', 'missão secundária': 'jornada', dungeon: 'jornada', masmorra: 'jornada', 'árvore de habilidades': 'levelup', 'skill tree': 'levelup',
    },
  },

  // ------------------------------------------------------------------ temas mínimos (paleta + peças; o cenário vem da categoria)
  {
    id: 'marvel',
    name: 'Vingadores (Marvel)',
    category: 'super-herois',
    theme: 'marvel',
    triggers: [
      'marvel', 'vingadores', 'avengers', 'homem de ferro', 'iron man', 'tony stark', 'thanos', 'manopla do infinito', 'joias do infinito', 'estalar de dedos', 'capitão américa',
      'thor', 'hulk', 'wakanda', 'viúva negra', 'doutor estranho', 'ultron', 'nick fury', 'guardiões da galáxia', 'eu sou inevitável',
    ],
    ambiguous: [
      { term: 'jarvis', context: ['tony', 'stark', 'ferro', 'vingadores', 'armadura', 'marvel'] },
      { term: 'multiverso', context: ['marvel', 'aranha', 'estranho', 'loucura', 'vingadores'] },
    ],
    shapes: { vingadores: 'equipe', avengers: 'equipe', thanos: 'chefao', ultron: 'chefao', jarvis: 'ajudante', 'manopla do infinito': 'inventario', 'joias do infinito': 'inventario' },
  },
  {
    id: 'homem-aranha',
    name: 'Homem-Aranha',
    category: 'super-herois',
    theme: 'homem-aranha',
    triggers: ['homem-aranha', 'homem aranha', 'spider man', 'spiderman', 'peter parker', 'miles morales', 'aranhaverso', 'sentido aranha', 'grandes poderes', 'grandes responsabilidades', 'amigão da vizinhança', 'duende verde', 'venom'],
    ambiguous: [{ term: 'teia', context: ['aranha', 'lançar', 'peter', 'herói'] }],
    shapes: { 'grandes poderes': 'levelup', 'grandes responsabilidades': 'levelup', 'duende verde': 'chefao', venom: 'chefao' },
  },
  {
    id: 'harry-potter',
    name: 'Harry Potter',
    category: 'fantasia',
    theme: 'harry-potter',
    triggers: [
      'harry potter', 'hogwarts', 'hermione', 'dumbledore', 'voldemort', 'grifinória', 'sonserina', 'lufa-lufa', 'lufa lufa', 'corvinal', 'quadribol', 'pomo de ouro', 'chapéu seletor',
      'expecto patronum', 'wingardium leviosa', 'avada kedavra', 'hagrid', 'snape', 'beco diagonal',
    ],
    ambiguous: [
      { term: 'trouxa', context: ['bruxo', 'bruxos', 'hogwarts', 'harry', 'magia'] },
      { term: 'bruxo', context: ['hogwarts', 'varinha', 'harry', 'trouxa'] },
      { term: 'varinha', context: ['bruxo', 'hogwarts', 'harry', 'feitiço'] },
    ],
    shapes: { voldemort: 'chefao', dumbledore: 'ajudante', hagrid: 'ajudante', hermione: 'ajudante', 'chapéu seletor': 'escolha', grifinória: 'equipe', sonserina: 'equipe', varinha: 'inventario' },
  },
  {
    id: 'senhor-dos-aneis',
    name: 'O Senhor dos Anéis',
    category: 'fantasia',
    theme: 'senhor-dos-aneis',
    triggers: [
      'senhor dos anéis', 'lord of the rings', 'gandalf', 'frodo', 'mordor', 'sauron', 'hobbit', 'hobbits', 'terra média', 'gollum', 'smeagol', 'meu precioso',
      'sociedade do anel', 'você não vai passar', 'you shall not pass', 'legolas', 'aragorn', 'montanha da perdição',
    ],
    ambiguous: [
      { term: 'anel', context: ['poder', 'governar', 'frodo', 'destruir', 'mordor', 'precioso'] },
      { term: 'condado', context: ['hobbit', 'hobbits', 'frodo', 'bilbo'] },
    ],
    shapes: { gandalf: 'ajudante', 'sociedade do anel': 'equipe', sauron: 'chefao', mordor: 'jornada', 'montanha da perdição': 'jornada', 'você não vai passar': 'chefao', 'you shall not pass': 'chefao' },
  },
  {
    id: 'game-of-thrones',
    name: 'Game of Thrones',
    category: 'fantasia',
    theme: 'game-of-thrones',
    triggers: [
      'game of thrones', 'guerra dos tronos', 'trono de ferro', 'winter is coming', 'inverno está chegando', 'jon snow', 'daenerys', 'mãe dos dragões', 'lannister', 'winterfell',
      'westeros', 'casa do dragão', 'house of the dragon', 'caminhantes brancos', 'white walker', 'casamento vermelho', 'targaryen',
    ],
    ambiguous: [
      { term: 'stark', context: ['casa', 'winterfell', 'jon', 'inverno', 'norte'], unless: ['tony'] },
      { term: 'muralha', context: ['patrulha', 'noite', 'norte', 'jon'] },
    ],
    shapes: { 'trono de ferro': 'chefao', 'caminhantes brancos': 'chefao', 'inverno está chegando': 'chefao', 'winter is coming': 'chefao' },
  },
  {
    id: 'zelda',
    name: 'The Legend of Zelda',
    category: 'fantasia',
    theme: 'zelda',
    triggers: ['zelda', 'hyrule', 'master sword', 'ganon', 'ganondorf', 'triforce', 'breath of the wild', 'ocarina do tempo'],
    ambiguous: [{ term: 'link', context: ['zelda', 'hyrule', 'ganon', 'espada'] }],
    shapes: { ganon: 'chefao', ganondorf: 'chefao', 'master sword': 'inventario' },
  },
  {
    id: 'pokemon',
    name: 'Pokémon',
    category: 'anime',
    theme: 'pokemon',
    triggers: ['pokémon', 'pokemons', 'pikachu', 'picachu', 'pokébola', 'poke bola', 'pokédex', 'charizard', 'equipe rocket', 'ash ketchum', 'bulbasaur', 'temos que pegar', 'mestre pokémon'],
    ambiguous: [
      { term: 'evoluir', context: ['pokémon', 'pikachu', 'pedra', 'pokébola'] },
      { term: 'evolução', context: ['pokémon', 'pikachu', 'pedra', 'pokébola'] },
      { term: 'ginásio', context: ['insígnia', 'insígnias', 'líder', 'pokémon'] },
      { term: 'insígnia', context: ['ginásio', 'líder', 'pokémon'] },
    ],
    shapes: { evoluir: 'levelup', evolução: 'levelup', pokédex: 'inventario', 'equipe rocket': 'chefao', ginásio: 'jornada', insígnia: 'jornada', 'temos que pegar': 'inventario' },
  },
  {
    id: 'pacman',
    name: 'Pac-Man',
    category: 'jogo-8bit',
    theme: 'pacman',
    triggers: ['pac-man', 'pac man', 'pec man', 'come-come', 'come come'],
    ambiguous: [
      { term: 'fantasminha', context: ['labirinto', 'pacman', 'pastilha', 'pastilhas'] },
      { term: 'fantasminhas', context: ['labirinto', 'pacman', 'pastilha', 'pastilhas'] },
      { term: 'labirinto', context: ['fantasma', 'fantasmas', 'fantasminha', 'pacman', 'pastilhas'] },
    ],
    shapes: { labirinto: 'jornada', fantasminha: 'chefao', fantasminhas: 'chefao' },
  },
  {
    id: 'tetris',
    name: 'Tetris',
    category: 'jogo-8bit',
    theme: 'tetris',
    triggers: ['tetris', 'tetrix', 'peça de tetris', 'peças de tetris'],
    shapes: { tetris: 'construcao', 'peça de tetris': 'construcao', 'peças de tetris': 'construcao' },
  },
  {
    id: 'dark-souls',
    name: 'Dark Souls',
    category: 'fantasia',
    theme: 'dark-souls',
    triggers: ['dark souls', 'darksouls', 'elden ring', 'bloodborne', 'sekiro', 'soulslike', 'souls like', 'you died', 'praise the sun'],
    ambiguous: [
      { term: 'fogueira', context: ['souls', 'descansar', 'checkpoint', 'chefão'] },
      { term: 'morreu', context: ['souls', 'tela', 'chefão', 'elden'] },
    ],
    shapes: { 'dark souls': 'chefao', darksouls: 'chefao', 'elden ring': 'chefao', soulslike: 'chefao', 'you died': 'chefao', fogueira: 'jornada' },
  },
  {
    id: 'among-us',
    name: 'Among Us',
    category: 'jogo-8bit',
    theme: 'among-us',
    triggers: ['among us', 'amongus', 'reunião de emergência'],
    ambiguous: [
      { term: 'impostor', context: ['among', 'nave', 'tripulante', 'tripulantes', 'votação', 'ejetado', 'sus'], unless: ['síndrome'] },
      { term: 'tripulante', context: ['among', 'nave', 'impostor', 'tarefas'] },
    ],
    shapes: { impostor: 'chefao', tripulante: 'equipe' },
  },
  {
    id: 'dragon-ball',
    name: 'Dragon Ball',
    category: 'anime',
    theme: 'dragon-ball',
    triggers: [
      'dragon ball', 'dragonball', 'goku', 'vegeta', 'saiyajin', 'super saiyajin', 'sayajin', 'saiyan', 'kamehameha', 'esferas do dragão', 'freeza', 'mais de oito mil', 'mais de 8 mil',
      'mais de 8000', 'genki dama', 'sala do tempo', 'shenlong', 'semente dos deuses', 'kaioken',
    ],
    ambiguous: [{ term: 'fusão', context: ['goku', 'vegeta', 'dança', 'saiyajin'] }],
    shapes: { 'super saiyajin': 'levelup', saiyajin: 'levelup', 'mais de oito mil': 'levelup', 'mais de 8 mil': 'levelup', 'mais de 8000': 'levelup', 'sala do tempo': 'levelup', freeza: 'chefao', 'esferas do dragão': 'inventario' },
  },
  {
    id: 'naruto',
    name: 'Naruto',
    category: 'anime',
    theme: 'naruto',
    triggers: ['naruto', 'hokage', 'sasuke', 'konoha', 'jutsu', 'clone das sombras', 'sharingan', 'rasengan', 'chidori', 'akatsuki', 'kage bunshin', 'kakashi', 'itachi', 'vila da folha', 'chunin', 'genin', 'jounin'],
    ambiguous: [{ term: 'chakra', context: ['jutsu', 'naruto', 'ninja', 'hokage'] }],
    shapes: { hokage: 'levelup', chunin: 'levelup', genin: 'levelup', jounin: 'levelup', akatsuki: 'chefao', kakashi: 'ajudante', 'clone das sombras': 'equipe', 'kage bunshin': 'equipe' },
  },
  {
    id: 'one-piece',
    name: 'One Piece',
    category: 'anime',
    theme: 'one-piece',
    triggers: ['one piece', 'onepiece', 'luffy', 'zoro', 'chapéu de palha', 'rei dos piratas', 'akuma no mi', 'fruta do diabo', 'grand line'],
    ambiguous: [
      { term: 'tripulação', context: ['pirata', 'piratas', 'navio', 'capitão', 'luffy'] },
      { term: 'pirata', context: ['navio', 'tesouro', 'tripulação', 'capitão', 'luffy', 'mapa'], unless: ['software', 'windows', 'licença', 'crackeado', 'pirataria', 'jogo'] },
      { term: 'piratas', context: ['navio', 'tesouro', 'tripulação', 'capitão', 'luffy', 'mapa'], unless: ['software', 'windows', 'licença', 'crackeado', 'pirataria'] },
      { term: 'tesouro', context: ['pirata', 'piratas', 'mapa', 'baú', 'ilha'] },
    ],
    shapes: { tripulação: 'equipe', 'chapéu de palha': 'equipe', 'rei dos piratas': 'levelup', 'grand line': 'jornada', tesouro: 'jornada' },
  },
  {
    id: 'de-volta-para-o-futuro',
    name: 'De Volta para o Futuro',
    category: 'ficcao-cientifica',
    theme: 'de-volta-para-o-futuro',
    triggers: ['de volta para o futuro', 'de volta pro futuro', 'back to the future', 'delorean', 'doc brown', 'marty mcfly', 'mcfly', 'capacitor de fluxo', '88 milhas'],
    shapes: { delorean: 'jornada', 'doc brown': 'ajudante' },
  },
  {
    id: 'stranger-things',
    name: 'Stranger Things',
    category: 'ficcao-cientifica',
    theme: 'stranger-things',
    triggers: ['stranger things', 'mundo invertido', 'demogorgon', 'upside down', 'hawkins', 'vecna'],
    shapes: { demogorgon: 'chefao', vecna: 'chefao', 'mundo invertido': 'escolha', 'upside down': 'escolha' },
  },
  {
    id: 'futebol',
    name: 'Futebol',
    category: 'esporte',
    theme: 'futebol',
    triggers: [
      'futebol', 'gol de placa', 'gol contra', 'bola na trave', 'fazer um gol', 'marcar um gol', 'golaço', 'escanteio', 'cartão vermelho', 'cartão amarelo', 'impedimento', 'camisa 10',
      'camisa dez', 'artilheiro', 'copa do mundo', 'banco de reservas', 'prorrogação', 'pênalti', 'pênaltis', 'zagueiro', 'goleiro', 'messi', 'neymar', 'cristiano ronaldo',
      'chutar pro gol', 'escalação', 'meio de campo',
    ],
    ambiguous: [
      { term: 'atacante', context: ['time', 'bola', 'gol', 'campo', 'zagueiro'], unless: ['segurança', 'hacker', 'invasor', 'ataque', 'vulnerabilidade'] },
      { term: 'gol', context: ['bola', 'marcar', 'fazer', 'time', 'campo', 'chutar', 'jogador'] },
      { term: 'driblar', context: ['bola', 'zagueiro', 'adversário', 'campo'] },
      { term: 'titular', context: ['time', 'reserva', 'banco', 'jogador', 'técnico'] },
      { term: 'campeonato', context: ['time', 'jogador', 'gol', 'rodada'] },
    ],
    shapes: { escalação: 'equipe', 'banco de reservas': 'equipe', titular: 'equipe', goleiro: 'equipe', zagueiro: 'equipe', 'copa do mundo': 'jornada', campeonato: 'jornada', 'camisa 10': 'levelup', 'camisa dez': 'levelup' },
  },
  {
    id: 'formula-1',
    name: 'Fórmula 1',
    category: 'esporte',
    theme: 'formula-1',
    triggers: ['fórmula 1', 'fórmula um', 'pit stop', 'pitstop', 'pole position', 'volta mais rápida', 'bandeira quadriculada', 'ayrton senna', 'senna', 'verstappen', 'grid de largada', 'safety car'],
    ambiguous: [
      { term: 'f1', context: ['corrida', 'piloto', 'pista', 'carro', 'equipe'] },
      { term: 'piloto', context: ['corrida', 'pista', 'carro', 'equipe', 'volta'], unless: ['projeto', 'avião', 'automático'] },
      { term: 'largada', context: ['corrida', 'grid', 'pista', 'piloto'] },
      { term: 'pódio', context: ['corrida', 'chegar', 'lugar', 'piloto'] },
      { term: 'ultrapassagem', context: ['pista', 'corrida', 'curva', 'piloto'] },
    ],
    shapes: { 'pit stop': 'equipe', pitstop: 'equipe', 'pole position': 'levelup', pódio: 'levelup', 'bandeira quadriculada': 'jornada', 'grid de largada': 'jornada' },
  },
  {
    id: 'xadrez',
    name: 'Xadrez',
    category: 'tabuleiro',
    theme: 'xadrez',
    triggers: ['xadrez', 'xeque-mate', 'xeque mate', 'cheque mate', 'gambito', 'gambito da rainha', 'enxadrista'],
    ambiguous: [
      { term: 'peão', context: ['tabuleiro', 'rainha', 'rei', 'xadrez', 'torre', 'bispo', 'peça', 'peças'] },
      { term: 'rainha', context: ['tabuleiro', 'peão', 'xadrez', 'torre', 'bispo', 'peça', 'peças'] },
      { term: 'xeque', context: ['rei', 'tabuleiro', 'xadrez', 'jogada'] },
      { term: 'tabuleiro', context: ['peão', 'rainha', 'rei', 'xadrez', 'torre', 'bispo'] },
    ],
    shapes: { 'xeque-mate': 'chefao', 'xeque mate': 'chefao', 'cheque mate': 'chefao', peão: 'levelup', rainha: 'levelup', gambito: 'escolha', 'gambito da rainha': 'escolha' },
  },
  {
    id: 'cartas',
    name: 'Jogo de cartas',
    category: 'tabuleiro',
    theme: 'cartas',
    triggers: ['pôquer', 'poker', 'baralho', 'carta na manga', 'ás na manga', 'blefe', 'blefar', 'royal flush', 'truco', 'apostar todas as fichas', 'cartada', 'trunfo', 'carta coringa', 'magic the gathering'],
    ambiguous: [
      { term: 'coringa', context: ['carta', 'cartas', 'baralho', 'jogo'], unless: ['batman', 'gotham', 'palhaço', 'vilão'] },
      { term: 'uno', context: ['carta', 'cartas', 'jogar', 'comprar', 'mais quatro'] },
      { term: 'fichas', context: ['apostar', 'poker', 'pôquer', 'mesa'] },
      { term: 'embaralhar', context: ['carta', 'cartas', 'baralho'], unless: ['array', 'lista', 'algoritmo', 'vetor'] },
    ],
    shapes: { 'carta na manga': 'inventario', 'ás na manga': 'inventario', trunfo: 'inventario', 'carta coringa': 'inventario', coringa: 'inventario', 'apostar todas as fichas': 'escolha', blefe: 'escolha', blefar: 'escolha' },
  },
  {
    id: 'lego',
    name: 'Blocos de montar (Lego)',
    category: 'tabuleiro',
    theme: 'lego',
    triggers: ['lego', 'legos', 'pecinha de lego', 'peça de lego', 'peças de lego', 'blocos de montar'],
    shapes: { lego: 'construcao', legos: 'construcao', 'pecinha de lego': 'construcao', 'peça de lego': 'construcao', 'peças de lego': 'construcao', 'blocos de montar': 'construcao' },
  },

  // ------------------------------------------------------------------ fallback por categoria (referência sem tema próprio)
  {
    id: 'super-herois',
    name: 'Super-heróis',
    category: 'super-herois',
    fallback: true,
    theme: 'super-herois',
    triggers: [
      'superman', 'super-homem', 'super homem', 'kryptonita', 'criptonita', 'kriptonita', 'mulher-maravilha', 'mulher maravilha', 'aquaman', 'x-men', 'x men', 'wolverine', 'deadpool',
      'lanterna verde', 'super-herói', 'super herói', 'super-heróis', 'super heróis', 'superpoder', 'superpoderes', 'super poder', 'super poderes', 'identidade secreta', 'os incríveis', 'the boys',
    ],
    ambiguous: [
      { term: 'vilão', context: ['herói', 'heróis', 'história', 'filme', 'derrotar'] },
      { term: 'flash', context: ['herói', 'velocista', 'rápido', 'liga'], unless: ['adobe', 'memória', 'pendrive', 'drive'] },
    ],
    shapes: { kryptonita: 'chefao', criptonita: 'chefao', kriptonita: 'chefao', vilão: 'chefao', superpoder: 'levelup', superpoderes: 'levelup', 'super poder': 'levelup', 'super poderes': 'levelup', 'x-men': 'equipe', 'x men': 'equipe', 'os incríveis': 'equipe' },
  },
  {
    id: 'fantasia',
    name: 'Fantasia medieval',
    category: 'fantasia',
    fallback: true,
    theme: 'fantasia',
    triggers: [
      'elfo', 'elfos', 'orc', 'orcs', 'feiticeiro', 'espada mágica', 'varinha mágica', 'cavaleiro medieval', 'conto de fadas', 'fada madrinha', 'nárnia', 'taverna', 'calabouço', 'excalibur',
      'rei arthur', 'távola redonda', 'matar o dragão', 'matar um dragão',
    ],
    ambiguous: [
      { term: 'dragão', context: ['cavaleiro', 'castelo', 'matar', 'espada', 'fogo', 'medieval', 'princesa'], unless: ['ball', 'esferas'] },
      { term: 'feitiço', context: ['magia', 'lançar', 'bruxo', 'mago'] },
      { term: 'fada', context: ['madrinha', 'varinha', 'magia'] },
    ],
    shapes: { dragão: 'chefao', 'matar o dragão': 'chefao', 'matar um dragão': 'chefao', 'fada madrinha': 'ajudante', fada: 'ajudante', 'távola redonda': 'equipe', calabouço: 'jornada', 'espada mágica': 'inventario', excalibur: 'inventario' },
  },
  {
    id: 'ficcao-cientifica',
    name: 'Ficção científica',
    category: 'ficcao-cientifica',
    fallback: true,
    theme: 'ficcao-cientifica',
    triggers: [
      'star trek', 'jornada nas estrelas', 'spock', 'exterminador do futuro', 'skynet', 'terminator', 'blade runner', 'cyberpunk', 'black mirror', 'interestelar', 'hal 9000',
      'viagem no tempo', 'viajar no tempo', 'máquina do tempo', 'buraco de minhoca', 'nave espacial', 'nave mãe', 'alienígena', 'alienígenas', 'teletransporte', 'ficção científica',
      'doctor who', 'tardis', 'westworld', 'jurassic park', 'parque dos dinossauros', 'transformers', 'optimus prime', 'mad max',
    ],
    ambiguous: [{ term: 'enterprise', context: ['nave', 'spock', 'kirk', 'capitão', 'trek'] }],
    shapes: { skynet: 'chefao', 'exterminador do futuro': 'chefao', terminator: 'chefao', 'hal 9000': 'chefao', 'máquina do tempo': 'jornada', 'viagem no tempo': 'jornada', 'viajar no tempo': 'jornada', 'nave espacial': 'construcao' },
  },
  {
    id: 'jogo-8bit',
    name: 'Jogo 8-bit',
    category: 'jogo-8bit',
    fallback: true,
    theme: 'jogo-8bit',
    triggers: [
      'nintendo', 'super nintendo', 'mega drive', 'atari', 'fliperama', 'arcade', 'game over', 'fase bônus', 'vida extra', 'soprar a fita', 'soprar o cartucho', 'sonic', 'donkey kong',
      'street fighter', 'hadouken', 'mortal kombat', 'fatality', 'mega man', 'megaman', '8 bits', 'oito bits', '16 bits', 'pixel art', 'zerar o jogo', 'zerei o jogo', 'speedrun', 'power up',
      'modo difícil', 'modo hard', 'hard mode', 'new game plus', 'insert coin', 'videogame', 'joystick', 'cheat code', 'konami code', 'gta', 'san andreas', 'counter strike', 'league of legends',
      'valorant', 'fortnite', 'free fire', 'the sims', 'roblox', 'god of war', 'kratos', 'the last of us', 'resident evil', 'playstation', 'xbox',
    ],
    ambiguous: [
      { term: 'checkpoint', context: ['fase', 'jogo', 'salvar', 'chefão', 'morrer'] },
      { term: 'fase', context: ['jogo', 'passar', 'chefão', 'zerar', 'game', 'videogame'] },
      { term: 'zerar', context: ['jogo', 'game', 'fase', 'videogame'] },
      { term: 'cartucho', context: ['soprar', 'fita', 'console', 'nintendo'] },
    ],
    shapes: { 'game over': 'chefao', fatality: 'chefao', 'power up': 'levelup', 'vida extra': 'levelup', 'new game plus': 'levelup', fase: 'jornada', 'fase bônus': 'jornada', checkpoint: 'jornada', 'zerar o jogo': 'jornada', 'zerei o jogo': 'jornada', speedrun: 'jornada', 'modo difícil': 'escolha', 'modo hard': 'escolha', 'hard mode': 'escolha' },
  },
  {
    id: 'anime',
    name: 'Anime',
    category: 'anime',
    fallback: true,
    theme: 'anime',
    triggers: [
      'anime', 'animes', 'one punch man', 'saitama', 'attack on titan', 'ataque dos titãs', 'cavaleiros do zodíaco', 'death note', 'demon slayer', 'jujutsu kaisen', 'my hero academia',
      'hunter x hunter', 'sailor moon', 'yu yu hakusho', 'evangelion', 'studio ghibli', 'protagonista de anime', 'arco de treinamento', 'poder da amizade', 'katana', 'senpai', 'bankai', 'digimon',
    ],
    ambiguous: [
      { term: 'ninja', context: ['shuriken', 'sombra', 'sombras', 'vila', 'katana', 'jutsu'] },
      { term: 'samurai', context: ['katana', 'espada', 'honra', 'mestre'] },
      { term: 'sensei', context: ['aluno', 'dojo', 'mestre', 'treino'] },
    ],
    shapes: { 'arco de treinamento': 'levelup', 'poder da amizade': 'equipe', 'protagonista de anime': 'levelup', sensei: 'ajudante', senpai: 'ajudante', katana: 'inventario' },
  },
  {
    id: 'esporte',
    name: 'Esporte',
    category: 'esporte',
    fallback: true,
    theme: 'esporte',
    triggers: [
      'basquete', 'nba', 'cesta de três', 'michael jordan', 'vôlei', 'match point', 'ufc', 'mma', 'nocaute', 'jogar a toalha', 'boxe', 'linha de chegada', 'cem metros rasos',
      '100 metros rasos', 'corrida de revezamento', 'passar o bastão', 'olimpíadas', 'medalha de ouro', 'home run', 'touchdown', 'super bowl',
    ],
    ambiguous: [
      { term: 'maratona', context: ['corrida', 'correr', 'metros', 'tiro', 'chegada', 'fôlego', 'quilômetros'], unless: ['série', 'séries', 'código', 'programação', 'filmes'] },
      { term: 'academia', context: ['treino', 'treinar', 'músculo', 'músculos', 'peso', 'supino'] },
      { term: 'ringue', context: ['luta', 'lutador', 'round', 'boxe'] },
    ],
    shapes: { nocaute: 'chefao', 'jogar a toalha': 'chefao', 'linha de chegada': 'jornada', maratona: 'jornada', 'passar o bastão': 'equipe', 'corrida de revezamento': 'equipe', 'medalha de ouro': 'levelup', academia: 'levelup' },
  },
  {
    id: 'tabuleiro',
    name: 'Jogo de mesa',
    category: 'tabuleiro',
    fallback: true,
    theme: 'tabuleiro',
    triggers: [
      'jogo de tabuleiro', 'banco imobiliário', 'monopoly', 'efeito dominó', 'jogo da velha', 'quebra-cabeça', 'quebra cabeça', 'cubo mágico', 'rolar os dados', 'jogar os dados',
      'batalha naval', 'jenga', 'jogo de damas', 'peça do quebra-cabeça',
    ],
    ambiguous: [
      { term: 'tabuleiro', context: ['jogo', 'dado', 'casas', 'peça', 'peças', 'jogada'] },
      { term: 'dominó', context: ['peças', 'efeito', 'cair', 'derrubar'] },
    ],
    shapes: { 'quebra-cabeça': 'construcao', 'quebra cabeça': 'construcao', 'peça do quebra-cabeça': 'construcao', jenga: 'construcao', 'efeito dominó': 'jornada', 'banco imobiliário': 'jornada', 'rolar os dados': 'escolha', 'jogar os dados': 'escolha' },
  },
];

const BY_ID = new Map(UNIVERSES.map((universe) => [universe.id, universe]));

export function findUniverse(id: string): Universe | undefined {
  return BY_ID.get(id);
}

/** O universo genérico que recebe as referências de uma categoria sem tema próprio. */
export function categoryFallback(category: UniverseCategory): Universe {
  const fallback = UNIVERSES.find((universe) => universe.fallback && universe.category === category);
  if (!fallback) throw new Error(`categoria sem universo de fallback: ${category}`);
  return fallback;
}
