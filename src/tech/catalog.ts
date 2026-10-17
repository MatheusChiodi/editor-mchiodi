// Catálogo de tecnologias que o canal cita. Módulo PURO (sem Node nem React): é importado pela análise (`src/`)
// e pelo Remotion (`motion/`). Os desenhos ficam em `motion/src/tech/icons.generated.ts` (`pnpm run sync-tech-icons`).
// As marcas são dos seus donos: o ícone só entra para IDENTIFICAR a tecnologia citada (uso nominativo).

export type TechCategory =
  | 'linguagem'
  | 'frontend'
  | 'backend'
  | 'mobile'
  | 'banco'
  | 'cloud'
  | 'devops'
  | 'sistema'
  | 'editor'
  | 'ferramenta'
  | 'teste'
  | 'ia'
  | 'plataforma'
  | 'rede'
  | 'empresa';

export interface Tech {
  id: string;
  /** grafia oficial, como vai para a tela e para a legenda */
  name: string;
  /** chave em `TECH_ICONS`: slug do simple-icons ou `devicon:<pasta>/<arquivo>`; `null` = sem ícone no conjunto (monograma) */
  icon: string | null;
  /** cor oficial da marca, `#RRGGBB` */
  color: string;
  category: TechCategory;
  /** como a fala e o Whisper escrevem o nome (sem acento/caixa na comparação); o `name` e o `id` já contam */
  aliases: string[];
  /** apelidos que também são palavra comum ("go", "next", "spring"): só valem com contexto */
  weak?: string[];
  /** o próprio nome é palavra do dia a dia ("Meta", "Cursor", "Lua"): nunca é detectado sozinho num rótulo e, na fala, maiúscula não basta */
  common?: true;
  /** apelido falado → grafia na legenda, quando não é o nome inteiro ("postgres" → "Postgres") */
  spoken?: Record<string, string>;
  /** letras do monograma quando não há ícone (padrão: derivado do nome) */
  mono?: string;
}

export const TECH_PREFIX = 'tech:';

/** Token de comparação: minúsculas, sem acento nem pontuação, preservando o que distingue `C#`, `C++` e `.NET`. */
export function techToken(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/c#/g, 'csharp')
    .replace(/\+\+/g, 'plusplus')
    .replace(/^\.net\b/, 'dotnet')
    .replace(/[^a-z0-9]/g, '');
}

/** Tokens de um texto livre; `React/Node` conta como duas palavras. */
export function techTokens(text: string): string[] {
  return text.split(/[\s/]+/).map(techToken).filter(Boolean);
}

export const techKey = (text: string) => techTokens(text).join(' ');

// prettier-ignore
export const TECHS: readonly Tech[] = [
  // linguagens
  { id: 'javascript', name: 'JavaScript', icon: 'javascript', color: '#F7DF1E', category: 'linguagem', aliases: ['java script', 'javascripti', 'java scripti', 'djavascript', 'java escript', 'javascripts'], weak: ['js'] },
  { id: 'typescript', name: 'TypeScript', icon: 'typescript', color: '#3178C6', category: 'linguagem', aliases: ['type script', 'tái script', 'tai script', 'taipscript', 'taip script', 'typescripti', 'tipescript', 'tape script', 'type escript', 'taipescript'], weak: ['ts'] },
  { id: 'python', name: 'Python', icon: 'python', color: '#3776AB', category: 'linguagem', aliases: ['pái ton', 'paiton', 'pyton', 'phyton', 'paitom', 'pythom'], weak: ['piton'] },
  { id: 'java', name: 'Java', icon: 'devicon:java/java-plain', color: '#ED8B00', category: 'linguagem', aliases: ['linguagem java', 'djava'] },
  { id: 'csharp', name: 'C#', icon: 'devicon:csharp/csharp-plain', color: '#512BD4', category: 'linguagem', aliases: ['c sharp', 'cê sharp', 'se sharp', 'si sharp', 'c charp', 'cisharp', 'ci sharp', 'see sharp', 'c xarp', 'cê xarpe'] },
  { id: 'cpp', name: 'C++', icon: 'cplusplus', color: '#00599C', category: 'linguagem', aliases: ['c plus plus', 'cê mais mais', 'c mais mais', 'se mais mais', 'c++'] },
  { id: 'c', name: 'C', icon: 'c', color: '#A8B9CC', category: 'linguagem', aliases: ['linguagem c', 'c puro'], common: true },
  { id: 'go', name: 'Go', icon: 'go', color: '#00ADD8', category: 'linguagem', aliases: ['golang', 'go lang', 'linguagem go', 'gou lang'], weak: ['go'] },
  { id: 'rust', name: 'Rust', icon: 'rust', color: '#000000', category: 'linguagem', aliases: ['linguagem rust', 'rustlang', 'rust lang'], weak: ['rust'] },
  { id: 'kotlin', name: 'Kotlin', icon: 'kotlin', color: '#7F52FF', category: 'linguagem', aliases: ['cótlin', 'kotlim', 'cotlim', 'kótlin'] },
  { id: 'swift', name: 'Swift', icon: 'swift', color: '#F05138', category: 'linguagem', aliases: ['swiftui', 'swift ui', 'linguagem swift'], weak: ['swift'] },
  { id: 'dart', name: 'Dart', icon: 'dart', color: '#0175C2', category: 'linguagem', aliases: ['linguagem dart', 'dartlang'], weak: ['dart'] },
  { id: 'php', name: 'PHP', icon: 'php', color: '#777BB4', category: 'linguagem', aliases: ['pê agá pê', 'p h p'] },
  { id: 'ruby', name: 'Ruby', icon: 'ruby', color: '#CC342D', category: 'linguagem', aliases: ['linguagem ruby'] },
  { id: 'elixir', name: 'Elixir', icon: 'elixir', color: '#4B275F', category: 'linguagem', aliases: ['linguagem elixir'], weak: ['elixir'] },
  { id: 'scala', name: 'Scala', icon: 'scala', color: '#DC322F', category: 'linguagem', aliases: ['linguagem scala'] },
  { id: 'lua', name: 'Lua', icon: 'lua', color: '#000080', category: 'linguagem', aliases: ['linguagem lua'], weak: ['lua'], common: true },
  { id: 'r', name: 'R', icon: 'r', color: '#276DC3', category: 'linguagem', aliases: ['linguagem r'], common: true },
  { id: 'sql', name: 'SQL', icon: null, color: '#00618A', category: 'linguagem', aliases: ['linguagem sql', 'esse quê ele'] },
  { id: 'html', name: 'HTML', icon: 'html5', color: '#E34F26', category: 'linguagem', aliases: ['html5', 'html 5', 'agá tê eme ele', 'h t m l'] },
  { id: 'css', name: 'CSS', icon: 'css', color: '#663399', category: 'linguagem', aliases: ['css3', 'css 3', 'cê esse esse', 'c s s'] },
  { id: 'sass', name: 'Sass', icon: 'sass', color: '#CC6699', category: 'linguagem', aliases: ['scss'], weak: ['sass'] },
  { id: 'bash', name: 'Bash', icon: 'gnubash', color: '#4EAA25', category: 'linguagem', aliases: ['shell script', 'bash script'] },
  { id: 'powershell', name: 'PowerShell', icon: 'devicon:powershell/powershell-plain', color: '#5391FE', category: 'linguagem', aliases: ['power shell'] },
  { id: 'markdown', name: 'Markdown', icon: 'markdown', color: '#000000', category: 'linguagem', aliases: ['mark down'] },
  { id: 'json', name: 'JSON', icon: 'json', color: '#000000', category: 'linguagem', aliases: ['arquivo json'], weak: ['jason'] },
  { id: 'yaml', name: 'YAML', icon: 'yaml', color: '#CB171E', category: 'linguagem', aliases: ['yml'] },
  { id: 'webassembly', name: 'WebAssembly', icon: 'webassembly', color: '#654FF0', category: 'linguagem', aliases: ['web assembly', 'wasm'] },
  // frontend
  { id: 'react', name: 'React', icon: 'react', color: '#61DAFB', category: 'frontend', aliases: ['react js', 'riéqui', 'riact', 'reacti', 'reakt', 'rieact', 'ri act', 'riéct', 'reac', 'riéqui js'] },
  { id: 'nextjs', name: 'Next.js', icon: 'nextdotjs', color: '#000000', category: 'frontend', aliases: ['next js', 'néxt js', 'nexti js'], weak: ['next'] },
  { id: 'vue', name: 'Vue.js', icon: 'vuedotjs', color: '#4FC08D', category: 'frontend', aliases: ['vue js', 'viu js', 'view js', 'vue 3'], weak: ['vue'] },
  { id: 'nuxt', name: 'Nuxt', icon: 'nuxt', color: '#00DC82', category: 'frontend', aliases: ['nuxt js', 'nuxtjs', 'naxt'] },
  { id: 'angular', name: 'Angular', icon: 'angular', color: '#0F0F11', category: 'frontend', aliases: ['angular js', 'angularjs', 'framework angular'], weak: ['angular'] },
  { id: 'svelte', name: 'Svelte', icon: 'svelte', color: '#FF3E00', category: 'frontend', aliases: ['sveltekit', 'svelte kit', 'isvelte', 'esvelt'] },
  { id: 'astro', name: 'Astro', icon: 'astro', color: '#BC52EE', category: 'frontend', aliases: ['astro js', 'astro build'], weak: ['astro'] },
  { id: 'remix', name: 'Remix', icon: 'remix', color: '#000000', category: 'frontend', aliases: ['remix run', 'remix js'], weak: ['remix'], common: true },
  { id: 'solid', name: 'SolidJS', icon: 'solid', color: '#2C4F7C', category: 'frontend', aliases: ['solid js'] },
  { id: 'preact', name: 'Preact', icon: 'preact', color: '#673AB8', category: 'frontend', aliases: [] },
  { id: 'htmx', name: 'HTMX', icon: 'htmx', color: '#3366CC', category: 'frontend', aliases: ['h t m x'] },
  { id: 'alpine', name: 'Alpine.js', icon: 'alpinedotjs', color: '#8BC0D0', category: 'frontend', aliases: ['alpine js'] },
  { id: 'jquery', name: 'jQuery', icon: 'jquery', color: '#0769AD', category: 'frontend', aliases: ['j query', 'jota query', 'jeiquery', 'jay query'] },
  { id: 'tailwind', name: 'Tailwind CSS', icon: 'tailwindcss', color: '#06B6D4', category: 'frontend', aliases: ['tailwind', 'têiuind', 'tailuind', 'tail wind', 'tailwin', 'teilwind', 'tailwind 4'], spoken: { 'tailwind': 'Tailwind', 'tailwin': 'Tailwind', 'teilwind': 'Tailwind' } },
  { id: 'bootstrap', name: 'Bootstrap', icon: 'bootstrap', color: '#7952B3', category: 'frontend', aliases: ['butstrap', 'bootstrep', 'boot strap', 'butstrep'] },
  { id: 'mui', name: 'Material UI', icon: 'mui', color: '#007FFF', category: 'frontend', aliases: ['material ui'], weak: ['mui'] },
  { id: 'shadcn', name: 'shadcn/ui', icon: 'shadcnui', color: '#000000', category: 'frontend', aliases: ['shadcn', 'shad cn', 'xadcn', 'shadcn ui', 'chad cn', 'shad c n', 'shadecn'], spoken: { 'shadcn': 'shadcn', 'xadcn': 'shadcn', 'shadecn': 'shadcn' } },
  { id: 'chakra', name: 'Chakra UI', icon: 'chakraui', color: '#1BB2A9', category: 'frontend', aliases: ['chakra ui'] },
  { id: 'styledcomponents', name: 'styled-components', icon: 'styledcomponents', color: '#DB7093', category: 'frontend', aliases: ['styled components', 'style components'] },
  { id: 'redux', name: 'Redux', icon: 'redux', color: '#764ABC', category: 'frontend', aliases: ['redux toolkit', 'ridux'] },
  { id: 'zustand', name: 'Zustand', icon: null, color: '#443E38', category: 'frontend', aliases: ['zustande'] },
  { id: 'reactquery', name: 'TanStack Query', icon: 'reactquery', color: '#FF4154', category: 'frontend', aliases: ['react query', 'tanstack query', 'tanstack', 'tan stack'], spoken: { 'tanstack': 'TanStack' } },
  { id: 'reactrouter', name: 'React Router', icon: 'reactrouter', color: '#CA4245', category: 'frontend', aliases: ['react router'] },
  { id: 'vite', name: 'Vite', icon: 'vite', color: '#9135FF', category: 'frontend', aliases: ['vite js', 'vitejs'] },
  { id: 'webpack', name: 'Webpack', icon: 'webpack', color: '#8DD6F9', category: 'frontend', aliases: ['web pack'] },
  { id: 'babel', name: 'Babel', icon: 'babel', color: '#F9DC3E', category: 'frontend', aliases: ['babel js'], weak: ['babel'] },
  { id: 'eslint', name: 'ESLint', icon: 'eslint', color: '#4B32C3', category: 'frontend', aliases: ['es lint', 'e s lint'] },
  { id: 'prettier', name: 'Prettier', icon: 'prettier', color: '#F7B93E', category: 'frontend', aliases: ['pritier'] },
  { id: 'storybook', name: 'Storybook', icon: 'storybook', color: '#FF4785', category: 'frontend', aliases: ['story book'] },
  { id: 'threejs', name: 'Three.js', icon: 'threedotjs', color: '#000000', category: 'frontend', aliases: ['three js', 'tri js'] },
  { id: 'framermotion', name: 'Framer Motion', icon: 'framer', color: '#0055FF', category: 'frontend', aliases: ['framer motion'], weak: ['framer'] },
  { id: 'gsap', name: 'GSAP', icon: 'greensock', color: '#88CE02', category: 'frontend', aliases: ['green sock'] },
  { id: 'zod', name: 'Zod', icon: 'zod', color: '#408AFF', category: 'frontend', aliases: [] },
  { id: 'axios', name: 'Axios', icon: 'axios', color: '#5A29E4', category: 'frontend', aliases: ['áxios'] },
  { id: 'remotion', name: 'Remotion', icon: null, color: '#0B84F3', category: 'frontend', aliases: ['remoshion'] },
  // backend
  { id: 'nodejs', name: 'Node.js', icon: 'nodedotjs', color: '#5FA04E', category: 'backend', aliases: ['node js', 'node', 'nódi', 'nodi', 'noud', 'nod js', 'nodi js', 'node jota esse'], spoken: { 'node': 'Node', 'nódi': 'Node', 'nodi': 'Node', 'noud': 'Node' } },
  { id: 'express', name: 'Express', icon: 'express', color: '#0A0A0A', category: 'backend', aliases: ['express js', 'expressjs'], weak: ['express'] },
  { id: 'nestjs', name: 'NestJS', icon: 'nestjs', color: '#E0234E', category: 'backend', aliases: ['nest js'], weak: ['nest'] },
  { id: 'fastify', name: 'Fastify', icon: 'fastify', color: '#000000', category: 'backend', aliases: ['fastfy'] },
  { id: 'deno', name: 'Deno', icon: 'deno', color: '#000000', category: 'backend', aliases: ['deno js'] },
  { id: 'bun', name: 'Bun', icon: 'bun', color: '#000000', category: 'backend', aliases: ['bun js', 'bun runtime'], weak: ['bun'] },
  { id: 'adonis', name: 'AdonisJS', icon: 'adonisjs', color: '#5A45FF', category: 'backend', aliases: ['adonis js', 'adonis'], spoken: { 'adonis': 'Adonis' } },
  { id: 'spring', name: 'Spring', icon: 'spring', color: '#6DB33F', category: 'backend', aliases: ['spring framework'], weak: ['spring'] },
  { id: 'springboot', name: 'Spring Boot', icon: 'springboot', color: '#6DB33F', category: 'backend', aliases: ['spring boot', 'spring but', 'spring boote'] },
  { id: 'quarkus', name: 'Quarkus', icon: 'quarkus', color: '#4695EB', category: 'backend', aliases: [] },
  { id: 'hibernate', name: 'Hibernate', icon: 'hibernate', color: '#59666C', category: 'backend', aliases: [] },
  { id: 'dotnet', name: '.NET', icon: 'dotnet', color: '#512BD4', category: 'backend', aliases: ['dot net', 'ponto net', 'asp net', 'aspnet', 'dotnet core', 'dot net core'] },
  { id: 'django', name: 'Django', icon: 'django', color: '#092E20', category: 'backend', aliases: [], weak: ['jango'] },
  { id: 'flask', name: 'Flask', icon: 'flask', color: '#3BABC3', category: 'backend', aliases: [], weak: ['flask'] },
  { id: 'fastapi', name: 'FastAPI', icon: 'fastapi', color: '#009688', category: 'backend', aliases: ['fast api'] },
  { id: 'laravel', name: 'Laravel', icon: 'laravel', color: '#FF2D20', category: 'backend', aliases: ['lara vel'] },
  { id: 'rails', name: 'Ruby on Rails', icon: 'rubyonrails', color: '#D30001', category: 'backend', aliases: ['ruby on rails', 'rails'], spoken: { 'rails': 'Rails' } },
  { id: 'graphql', name: 'GraphQL', icon: 'graphql', color: '#E10098', category: 'backend', aliases: ['graph ql', 'grafql', 'graf ql', 'graphql api'] },
  { id: 'trpc', name: 'tRPC', icon: 'trpc', color: '#2596BE', category: 'backend', aliases: ['t rpc'] },
  { id: 'grpc', name: 'gRPC', icon: 'devicon:grpc/grpc-plain', color: '#244C5A', category: 'backend', aliases: ['g rpc'] },
  { id: 'prisma', name: 'Prisma', icon: 'prisma', color: '#2D3748', category: 'backend', aliases: ['prisma orm'], weak: ['prisma'], common: true },
  { id: 'drizzle', name: 'Drizzle', icon: 'drizzle', color: '#C5F74F', category: 'backend', aliases: ['drizzle orm'] },
  { id: 'sequelize', name: 'Sequelize', icon: 'sequelize', color: '#52B0E7', category: 'backend', aliases: [] },
  { id: 'typeorm', name: 'TypeORM', icon: 'typeorm', color: '#FE0803', category: 'backend', aliases: ['type orm'] },
  { id: 'mongoose', name: 'Mongoose', icon: 'mongoose', color: '#880000', category: 'backend', aliases: [] },
  { id: 'socketio', name: 'Socket.IO', icon: 'socketdotio', color: '#010101', category: 'backend', aliases: ['socket io'] },
  { id: 'rabbitmq', name: 'RabbitMQ', icon: 'rabbitmq', color: '#FF6600', category: 'backend', aliases: ['rabbit mq'] },
  { id: 'kafka', name: 'Kafka', icon: 'apachekafka', color: '#231F20', category: 'backend', aliases: ['apache kafka', 'cafca'] },
  { id: 'nginx', name: 'Nginx', icon: 'nginx', color: '#009639', category: 'backend', aliases: ['engine x', 'enginex', 'n ginx', 'engine ex'] },
  { id: 'apache', name: 'Apache', icon: 'apache', color: '#D22128', category: 'backend', aliases: ['servidor apache', 'apache http'], weak: ['apache'] },
  { id: 'jwt', name: 'JWT', icon: 'jsonwebtokens', color: '#000000', category: 'backend', aliases: ['json web token', 'json web tokens', 'j w t'] },
  { id: 'oauth', name: 'OAuth', icon: null, color: '#EB5424', category: 'backend', aliases: ['o auth', 'oauth2', 'oauth 2'] },
  { id: 'swagger', name: 'Swagger', icon: 'swagger', color: '#85EA2D', category: 'backend', aliases: [] },
  { id: 'wordpress', name: 'WordPress', icon: 'wordpress', color: '#21759B', category: 'backend', aliases: ['word press'] },
  { id: 'strapi', name: 'Strapi', icon: 'strapi', color: '#4945FF', category: 'backend', aliases: [] },
  { id: 'stripe', name: 'Stripe', icon: 'stripe', color: '#635BFF', category: 'backend', aliases: [] },
  { id: 'mercadopago', name: 'Mercado Pago', icon: 'mercadopago', color: '#00B1EA', category: 'backend', aliases: ['mercado pago'] },
  { id: 'pix', name: 'Pix', icon: 'pix', color: '#77B6A8', category: 'backend', aliases: [], weak: ['pix'], common: true },
  // mobile
  { id: 'reactnative', name: 'React Native', icon: 'react', color: '#61DAFB', category: 'mobile', aliases: ['react native', 'riact native', 'react neitiv', 'react naitiv', 'reacti native', 'riéqui native'] },
  { id: 'expo', name: 'Expo', icon: 'expo', color: '#1C2024', category: 'mobile', aliases: ['expo go'], weak: ['expo'] },
  { id: 'flutter', name: 'Flutter', icon: 'flutter', color: '#02569B', category: 'mobile', aliases: ['fluter', 'framework flutter'], weak: ['flutter', 'flater'] },
  { id: 'android', name: 'Android', icon: 'android', color: '#3DDC84', category: 'mobile', aliases: ['androide'] },
  { id: 'ios', name: 'iOS', icon: 'ios', color: '#000000', category: 'mobile', aliases: ['i os'] },
  { id: 'androidstudio', name: 'Android Studio', icon: 'androidstudio', color: '#3DDC84', category: 'mobile', aliases: ['android studio'] },
  { id: 'xcode', name: 'Xcode', icon: 'xcode', color: '#147EFB', category: 'mobile', aliases: ['x code'] },
  { id: 'ionic', name: 'Ionic', icon: 'ionic', color: '#3880FF', category: 'mobile', aliases: [] },
  { id: 'electron', name: 'Electron', icon: 'electron', color: '#47848F', category: 'mobile', aliases: ['electron js'] },
  { id: 'tauri', name: 'Tauri', icon: 'tauri', color: '#24C8D8', category: 'mobile', aliases: [] },
  { id: 'jetpackcompose', name: 'Jetpack Compose', icon: 'jetpackcompose', color: '#4285F4', category: 'mobile', aliases: ['jetpack compose'] },
  // bancos
  { id: 'postgresql', name: 'PostgreSQL', icon: 'postgresql', color: '#4169E1', category: 'banco', aliases: ['postgres', 'postgre', 'postgree', 'poust gres', 'post gres', 'postgres sql', 'postgre sql', 'postgress', 'pós gres', 'postgrees', 'posgres'], spoken: { 'postgres': 'Postgres', 'postgre': 'Postgres', 'postgree': 'Postgres', 'postgress': 'Postgres', 'postgrees': 'Postgres', 'posgres': 'Postgres' } },
  { id: 'mysql', name: 'MySQL', icon: 'mysql', color: '#4479A1', category: 'banco', aliases: ['my sql', 'mai sql', 'mai esse quê ele', 'maiesquele', 'my sequel', 'mysequel'] },
  { id: 'mariadb', name: 'MariaDB', icon: 'mariadb', color: '#003545', category: 'banco', aliases: ['maria db'] },
  { id: 'sqlite', name: 'SQLite', icon: 'sqlite', color: '#003B57', category: 'banco', aliases: ['sql lite', 'sqlight', 'sequelite', 'sq lite'] },
  { id: 'mongodb', name: 'MongoDB', icon: 'mongodb', color: '#47A248', category: 'banco', aliases: ['mongo db', 'mongo', 'mongo dê bê'], spoken: { 'mongo': 'Mongo' } },
  { id: 'redis', name: 'Redis', icon: 'redis', color: '#FF4438', category: 'banco', aliases: [] },
  { id: 'oracle', name: 'Oracle', icon: 'devicon:oracle/oracle-original', color: '#F80000', category: 'banco', aliases: ['oracle database', 'banco oracle', 'oracle 11g'] },
  { id: 'sqlserver', name: 'SQL Server', icon: 'devicon:microsoftsqlserver/microsoftsqlserver-plain', color: '#CC2927', category: 'banco', aliases: ['sql server', 'sequel server', 'mssql', 'ms sql'] },
  { id: 'supabase', name: 'Supabase', icon: 'supabase', color: '#3FCF8E', category: 'banco', aliases: ['supa base', 'superbase'] },
  { id: 'firebase', name: 'Firebase', icon: 'firebase', color: '#DD2C00', category: 'banco', aliases: ['fire base', 'firestore'] },
  { id: 'dynamodb', name: 'DynamoDB', icon: null, color: '#4053D6', category: 'banco', aliases: ['dynamo db', 'dynamo'], spoken: { 'dynamo': 'Dynamo' } },
  { id: 'elasticsearch', name: 'Elasticsearch', icon: 'elasticsearch', color: '#005571', category: 'banco', aliases: ['elastic search'] },
  { id: 'neo4j', name: 'Neo4j', icon: 'neo4j', color: '#4581C3', category: 'banco', aliases: ['neo 4j', 'neo four j'] },
  // cloud
  { id: 'aws', name: 'AWS', icon: 'devicon:amazonwebservices/amazonwebservices-plain-wordmark', color: '#FF9900', category: 'cloud', aliases: ['amazon web services', 'a w s', 'a dábliu esse', 'aws lambda', 'ec2', 's3'] },
  { id: 'azure', name: 'Azure', icon: 'devicon:azure/azure-plain', color: '#0078D4', category: 'cloud', aliases: ['microsoft azure', 'azur'] },
  { id: 'gcp', name: 'Google Cloud', icon: 'googlecloud', color: '#4285F4', category: 'cloud', aliases: ['google cloud', 'google cloud platform', 'g c p'] },
  { id: 'vercel', name: 'Vercel', icon: 'vercel', color: '#000000', category: 'cloud', aliases: ['versel', 'vercell', 'vercéu'] },
  { id: 'netlify', name: 'Netlify', icon: 'netlify', color: '#00C7B7', category: 'cloud', aliases: ['netlifai', 'netli fy'] },
  { id: 'cloudflare', name: 'Cloudflare', icon: 'cloudflare', color: '#F38020', category: 'cloud', aliases: ['cloud flare', 'cloudfler', 'clodflare', 'cloud fler', 'cloudflér'] },
  { id: 'cloudflareworkers', name: 'Cloudflare Workers', icon: 'cloudflareworkers', color: '#F38020', category: 'cloud', aliases: ['cloudflare workers', 'cloudflare worker', 'cloud flare workers', 'workers kv'] },
  { id: 'cloudflarepages', name: 'Cloudflare Pages', icon: 'cloudflarepages', color: '#F38020', category: 'cloud', aliases: ['cloudflare pages', 'cloud flare pages'] },
  { id: 'heroku', name: 'Heroku', icon: 'devicon:heroku/heroku-plain', color: '#430098', category: 'cloud', aliases: ['eroku'] },
  { id: 'digitalocean', name: 'DigitalOcean', icon: 'digitalocean', color: '#0080FF', category: 'cloud', aliases: ['digital ocean'] },
  { id: 'railway', name: 'Railway', icon: 'railway', color: '#0B0D0E', category: 'cloud', aliases: [] },
  { id: 'flyio', name: 'Fly.io', icon: 'flydotio', color: '#24175B', category: 'cloud', aliases: ['fly io'] },
  { id: 'hostinger', name: 'Hostinger', icon: 'hostinger', color: '#673DE6', category: 'cloud', aliases: [] },
  // devops
  { id: 'docker', name: 'Docker', icon: 'docker', color: '#2496ED', category: 'devops', aliases: ['dóquer', 'doker', 'docker compose', 'dockerfile', 'docker file', 'dócker'] },
  { id: 'kubernetes', name: 'Kubernetes', icon: 'kubernetes', color: '#326CE5', category: 'devops', aliases: ['k8s', 'cubernetes', 'kubernets', 'kubernétis', 'cubernétis', 'kubernete'] },
  { id: 'git', name: 'Git', icon: 'git', color: '#F03C2E', category: 'devops', aliases: ['guit'] },
  { id: 'github', name: 'GitHub', icon: 'github', color: '#181717', category: 'devops', aliases: ['git hub', 'gít rãbi', 'guit hub', 'githubi', 'git rab', 'gitrab', 'guitirrabe', 'git rabi'] },
  { id: 'gitlab', name: 'GitLab', icon: 'gitlab', color: '#FC6D26', category: 'devops', aliases: ['git lab', 'guit lab'] },
  { id: 'bitbucket', name: 'Bitbucket', icon: 'bitbucket', color: '#0052CC', category: 'devops', aliases: ['bit bucket'] },
  { id: 'githubactions', name: 'GitHub Actions', icon: 'githubactions', color: '#2088FF', category: 'devops', aliases: ['github actions', 'git hub actions', 'github action'] },
  { id: 'jenkins', name: 'Jenkins', icon: 'jenkins', color: '#D24939', category: 'devops', aliases: [] },
  { id: 'terraform', name: 'Terraform', icon: 'terraform', color: '#844FBA', category: 'devops', aliases: ['terra form'] },
  { id: 'ansible', name: 'Ansible', icon: 'ansible', color: '#EE0000', category: 'devops', aliases: [] },
  { id: 'grafana', name: 'Grafana', icon: 'grafana', color: '#F46800', category: 'devops', aliases: [] },
  { id: 'prometheus', name: 'Prometheus', icon: 'prometheus', color: '#E6522C', category: 'devops', aliases: [] },
  { id: 'sentry', name: 'Sentry', icon: 'sentry', color: '#362D59', category: 'devops', aliases: [] },
  { id: 'datadog', name: 'Datadog', icon: 'datadog', color: '#632CA6', category: 'devops', aliases: ['data dog'] },
  { id: 'npm', name: 'npm', icon: 'npm', color: '#CB3837', category: 'devops', aliases: ['n p m', 'ene pê eme'] },
  { id: 'pnpm', name: 'pnpm', icon: 'pnpm', color: '#F69220', category: 'devops', aliases: ['p npm', 'p n p m'] },
  { id: 'yarn', name: 'Yarn', icon: 'yarn', color: '#2C8EBB', category: 'devops', aliases: [] },
  { id: 'turborepo', name: 'Turborepo', icon: 'turborepo', color: '#FF1E56', category: 'devops', aliases: ['turbo repo'] },
  // sistemas
  { id: 'linux', name: 'Linux', icon: 'linux', color: '#FCC624', category: 'sistema', aliases: [] },
  { id: 'ubuntu', name: 'Ubuntu', icon: 'ubuntu', color: '#E95420', category: 'sistema', aliases: [] },
  { id: 'kali', name: 'Kali Linux', icon: 'kalilinux', color: '#557C94', category: 'sistema', aliases: ['kali linux', 'kali'], spoken: { 'kali': 'Kali' } },
  { id: 'windows', name: 'Windows', icon: 'devicon:windows11/windows11-original', color: '#0078D4', category: 'sistema', aliases: ['windows 11', 'windows 10', 'uíndous'] },
  { id: 'macos', name: 'macOS', icon: 'macos', color: '#000000', category: 'sistema', aliases: ['mac os'], weak: ['mac'] },
  { id: 'wsl', name: 'WSL', icon: null, color: '#0078D4', category: 'sistema', aliases: ['wsl2', 'wsl 2'] },
  // editores
  { id: 'vscode', name: 'VS Code', icon: 'devicon:vscode/vscode-plain', color: '#007ACC', category: 'editor', aliases: ['vs code', 'visual studio code', 'vê esse code', 'v s code', 'vis code', 'vs cold', 'vscold', 'vs coud', 'vê s code', 'visual code'] },
  { id: 'visualstudio', name: 'Visual Studio', icon: 'devicon:visualstudio/visualstudio-plain', color: '#5C2D91', category: 'editor', aliases: ['visual studio'] },
  { id: 'cursor', name: 'Cursor', icon: 'cursor', color: '#000000', category: 'editor', aliases: ['cursor ai', 'cursor ide', 'editor cursor'], weak: ['cursor'], common: true },
  { id: 'intellij', name: 'IntelliJ IDEA', icon: 'intellijidea', color: '#000000', category: 'editor', aliases: ['intellij', 'intelij', 'intelli j', 'intellij idea'], spoken: { 'intellij': 'IntelliJ', 'intelij': 'IntelliJ' } },
  { id: 'webstorm', name: 'WebStorm', icon: 'webstorm', color: '#000000', category: 'editor', aliases: ['web storm'] },
  { id: 'pycharm', name: 'PyCharm', icon: 'pycharm', color: '#000000', category: 'editor', aliases: ['py charm', 'pai charm'] },
  { id: 'neovim', name: 'Neovim', icon: 'neovim', color: '#57A143', category: 'editor', aliases: ['neo vim', 'nvim'] },
  { id: 'vim', name: 'Vim', icon: 'vim', color: '#019733', category: 'editor', aliases: ['editor vim'], weak: ['vim'], common: true },
  { id: 'zed', name: 'Zed', icon: 'zedindustries', color: '#084CCF', category: 'editor', aliases: ['zed editor'], weak: ['zed'] },
  { id: 'sublime', name: 'Sublime Text', icon: 'sublimetext', color: '#FF9800', category: 'editor', aliases: ['sublime text', 'sublime'], spoken: { 'sublime': 'Sublime' } },
  { id: 'windsurf', name: 'Windsurf', icon: 'windsurf', color: '#0B100F', category: 'editor', aliases: [], weak: ['windsurf'] },
  { id: 'jetbrains', name: 'JetBrains', icon: 'jetbrains', color: '#000000', category: 'editor', aliases: ['jet brains'] },
  { id: 'eclipse', name: 'Eclipse', icon: 'eclipseide', color: '#2C2255', category: 'editor', aliases: ['eclipse ide'], weak: ['eclipse'], common: true },
  // ferramentas
  { id: 'figma', name: 'Figma', icon: 'figma', color: '#F24E1E', category: 'ferramenta', aliases: [] },
  { id: 'postman', name: 'Postman', icon: 'postman', color: '#FF6C37', category: 'ferramenta', aliases: ['post man'] },
  { id: 'insomnia', name: 'Insomnia', icon: 'insomnia', color: '#4000BF', category: 'ferramenta', aliases: [] },
  { id: 'notion', name: 'Notion', icon: 'notion', color: '#000000', category: 'ferramenta', aliases: ['noution'] },
  { id: 'obsidian', name: 'Obsidian', icon: 'obsidian', color: '#7C3AED', category: 'ferramenta', aliases: [] },
  { id: 'trello', name: 'Trello', icon: 'trello', color: '#0052CC', category: 'ferramenta', aliases: [] },
  { id: 'jira', name: 'Jira', icon: 'jira', color: '#0052CC', category: 'ferramenta', aliases: [] },
  { id: 'slack', name: 'Slack', icon: 'devicon:slack/slack-plain', color: '#4A154B', category: 'ferramenta', aliases: [] },
  { id: 'discord', name: 'Discord', icon: 'discord', color: '#5865F2', category: 'ferramenta', aliases: [] },
  { id: 'telegram', name: 'Telegram', icon: 'telegram', color: '#26A5E4', category: 'ferramenta', aliases: [] },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp', color: '#25D366', category: 'ferramenta', aliases: ['whats app', 'whatsap', 'uatizap'] },
  { id: 'googlemeet', name: 'Google Meet', icon: 'googlemeet', color: '#00897B', category: 'ferramenta', aliases: ['google meet'] },
  { id: 'chrome', name: 'Google Chrome', icon: 'googlechrome', color: '#4285F4', category: 'ferramenta', aliases: ['chrome', 'google chrome'], spoken: { 'chrome': 'Chrome' } },
  { id: 'firefox', name: 'Firefox', icon: 'firefoxbrowser', color: '#FF7139', category: 'ferramenta', aliases: ['fire fox', 'mozilla firefox'] },
  { id: 'safari', name: 'Safari', icon: 'safari', color: '#006CFF', category: 'ferramenta', aliases: ['navegador safari'], weak: ['safari'], common: true },
  { id: 'brave', name: 'Brave', icon: 'brave', color: '#FB542B', category: 'ferramenta', aliases: ['navegador brave', 'brave browser'], weak: ['brave'] },
  { id: 'canva', name: 'Canva', icon: 'devicon:canva/canva-original', color: '#00C4CC', category: 'ferramenta', aliases: [] },
  { id: 'obs', name: 'OBS Studio', icon: 'obsstudio', color: '#302E31', category: 'ferramenta', aliases: ['obs studio'], weak: ['obs'] },
  { id: 'davinci', name: 'DaVinci Resolve', icon: 'davinciresolve', color: '#233A51', category: 'ferramenta', aliases: ['davinci resolve', 'da vinci resolve', 'davinci'], spoken: { 'davinci': 'DaVinci' } },
  { id: 'excel', name: 'Excel', icon: null, color: '#217346', category: 'ferramenta', aliases: ['microsoft excel'] },
  { id: 'googlesheets', name: 'Google Sheets', icon: 'googlesheets', color: '#34A853', category: 'ferramenta', aliases: ['google sheets', 'google planilhas'] },
  { id: 'powerbi', name: 'Power BI', icon: null, color: '#F2C811', category: 'ferramenta', aliases: ['power bi'] },
  { id: 'shopify', name: 'Shopify', icon: 'shopify', color: '#7AB55C', category: 'ferramenta', aliases: [] },
  { id: 'n8n', name: 'n8n', icon: 'n8n', color: '#EA4B71', category: 'ferramenta', aliases: ['n 8 n', 'ene oito ene', 'ene 8 ene', 'n eight n'] },
  { id: 'zapier', name: 'Zapier', icon: 'zapier', color: '#FF4F00', category: 'ferramenta', aliases: [] },
  { id: 'excalidraw', name: 'Excalidraw', icon: 'excalidraw', color: '#6965DB', category: 'ferramenta', aliases: [] },
  { id: 'codesandbox', name: 'CodeSandbox', icon: 'codesandbox', color: '#151515', category: 'ferramenta', aliases: ['code sandbox'] },
  { id: 'replit', name: 'Replit', icon: 'replit', color: '#F26207', category: 'ferramenta', aliases: [] },
  // testes
  { id: 'jest', name: 'Jest', icon: 'jest', color: '#C21325', category: 'teste', aliases: [] },
  { id: 'vitest', name: 'Vitest', icon: 'vitest', color: '#00FF74', category: 'teste', aliases: ['vi test'] },
  { id: 'cypress', name: 'Cypress', icon: 'cypress', color: '#69D3A7', category: 'teste', aliases: [] },
  { id: 'playwright', name: 'Playwright', icon: 'devicon:playwright/playwright-plain', color: '#2EAD33', category: 'teste', aliases: ['play wright', 'play right', 'playright'] },
  { id: 'selenium', name: 'Selenium', icon: 'selenium', color: '#43B02A', category: 'teste', aliases: [] },
  { id: 'testinglibrary', name: 'Testing Library', icon: 'testinglibrary', color: '#E33332', category: 'teste', aliases: ['testing library', 'react testing library'] },
  { id: 'junit', name: 'JUnit', icon: 'junit5', color: '#25A162', category: 'teste', aliases: ['j unit'] },
  { id: 'puppeteer', name: 'Puppeteer', icon: 'puppeteer', color: '#40B5A4', category: 'teste', aliases: [] },
  // IA
  { id: 'openai', name: 'OpenAI', icon: null, color: '#412991', category: 'ia', aliases: ['open ai', 'open a i'], mono: 'AI' },
  { id: 'chatgpt', name: 'ChatGPT', icon: null, color: '#10A37F', category: 'ia', aliases: ['chat gpt', 'chat gê pê tê', 'chat gepetê', 'gpt', 'gpt 4', 'gpt 5', 'gpt4', 'gpt5', 'chat g p t'], spoken: { 'gpt': 'GPT', 'gpt4': 'GPT-4', 'gpt5': 'GPT-5' }, mono: 'GPT' },
  { id: 'claude', name: 'Claude', icon: 'claude', color: '#D97757', category: 'ia', aliases: ['claude ai', 'clód'] },
  { id: 'claudecode', name: 'Claude Code', icon: 'claude', color: '#D97757', category: 'ia', aliases: ['claude code', 'cloud code', 'clod code', 'claude cold', 'clód code'] },
  { id: 'anthropic', name: 'Anthropic', icon: 'anthropic', color: '#191919', category: 'ia', aliases: ['antropic', 'anthropik', 'antrópic'] },
  { id: 'gemini', name: 'Gemini', icon: 'googlegemini', color: '#8E75B2', category: 'ia', aliases: ['google gemini'] },
  { id: 'copilot', name: 'GitHub Copilot', icon: 'githubcopilot', color: '#000000', category: 'ia', aliases: ['copilot', 'github copilot', 'co pilot', 'git hub copilot'], spoken: { 'copilot': 'Copilot' } },
  { id: 'ollama', name: 'Ollama', icon: 'ollama', color: '#000000', category: 'ia', aliases: ['olama'] },
  { id: 'huggingface', name: 'Hugging Face', icon: 'huggingface', color: '#FFD21E', category: 'ia', aliases: ['hugging face'] },
  { id: 'langchain', name: 'LangChain', icon: 'langchain', color: '#7FC8FF', category: 'ia', aliases: ['lang chain'] },
  { id: 'openrouter', name: 'OpenRouter', icon: 'openrouter', color: '#94A3B8', category: 'ia', aliases: ['open router'] },
  { id: 'perplexity', name: 'Perplexity', icon: 'perplexity', color: '#1FB8CD', category: 'ia', aliases: [] },
  { id: 'deepseek', name: 'DeepSeek', icon: 'deepseek', color: '#5786FE', category: 'ia', aliases: ['deep seek'] },
  { id: 'mistral', name: 'Mistral', icon: 'mistralai', color: '#FA520F', category: 'ia', aliases: ['mistral ai'], weak: ['mistral'] },
  { id: 'grok', name: 'Grok', icon: null, color: '#000000', category: 'ia', aliases: [] },
  { id: 'lovable', name: 'Lovable', icon: null, color: '#FF4D8D', category: 'ia', aliases: [], weak: ['lovable'] },
  { id: 'v0', name: 'v0', icon: 'v0', color: '#000000', category: 'ia', aliases: ['v zero', 'v0 dev'] },
  { id: 'mcp', name: 'MCP', icon: 'modelcontextprotocol', color: '#000000', category: 'ia', aliases: ['model context protocol', 'm c p'] },
  { id: 'tensorflow', name: 'TensorFlow', icon: 'tensorflow', color: '#FF6F00', category: 'ia', aliases: ['tensor flow'] },
  { id: 'pytorch', name: 'PyTorch', icon: 'pytorch', color: '#EE4C2C', category: 'ia', aliases: ['py torch', 'pai torch'] },
  { id: 'pandas', name: 'pandas', icon: 'pandas', color: '#150458', category: 'ia', aliases: ['biblioteca pandas'], weak: ['pandas'] },
  { id: 'numpy', name: 'NumPy', icon: 'numpy', color: '#013243', category: 'ia', aliases: ['num py', 'nampai', 'numpai'] },
  { id: 'jupyter', name: 'Jupyter', icon: 'jupyter', color: '#F37626', category: 'ia', aliases: ['jupyter notebook'] },
  { id: 'kaggle', name: 'Kaggle', icon: 'kaggle', color: '#20BEFF', category: 'ia', aliases: [] },
  // plataformas de curso e comunidade
  { id: 'dio', name: 'DIO', icon: null, color: '#E4105D', category: 'plataforma', aliases: ['digital innovation one', 'dio me'], weak: ['dio'] },
  { id: 'alura', name: 'Alura', icon: null, color: '#167BF7', category: 'plataforma', aliases: [] },
  { id: 'rocketseat', name: 'Rocketseat', icon: null, color: '#8257E5', category: 'plataforma', aliases: ['rocket seat', 'roquete seat', 'rocketsit'] },
  { id: 'udemy', name: 'Udemy', icon: 'udemy', color: '#A435F0', category: 'plataforma', aliases: ['iudemi', 'udemi'] },
  { id: 'coursera', name: 'Coursera', icon: 'coursera', color: '#0056D2', category: 'plataforma', aliases: ['cursera'] },
  { id: 'freecodecamp', name: 'freeCodeCamp', icon: 'freecodecamp', color: '#0A0A23', category: 'plataforma', aliases: ['free code camp'] },
  { id: 'stackoverflow', name: 'Stack Overflow', icon: 'stackoverflow', color: '#F58025', category: 'plataforma', aliases: ['stack overflow', 'stack over flow', 'estaque overflow'] },
  { id: 'devto', name: 'DEV Community', icon: 'devdotto', color: '#0A0A0A', category: 'plataforma', aliases: ['dev to', 'dev community'] },
  { id: 'medium', name: 'Medium', icon: 'medium', color: '#000000', category: 'plataforma', aliases: [], weak: ['medium'], common: true },
  { id: 'leetcode', name: 'LeetCode', icon: 'leetcode', color: '#FFA116', category: 'plataforma', aliases: ['leet code', 'lit code'] },
  { id: 'hackerrank', name: 'HackerRank', icon: 'hackerrank', color: '#00EA64', category: 'plataforma', aliases: ['hacker rank'] },
  { id: 'beecrowd', name: 'beecrowd', icon: null, color: '#F6A800', category: 'plataforma', aliases: ['bee crowd', 'uri online judge'] },
  { id: 'mdn', name: 'MDN', icon: 'mdnwebdocs', color: '#000000', category: 'plataforma', aliases: ['mdn web docs', 'm d n'] },
  { id: 'w3schools', name: 'W3Schools', icon: 'w3schools', color: '#04AA6D', category: 'plataforma', aliases: ['w3 schools', 'w3school', 'w 3 schools'] },
  { id: 'roadmapsh', name: 'roadmap.sh', icon: 'roadmapdotsh', color: '#000000', category: 'plataforma', aliases: ['roadmap sh'] },
  { id: 'tabnews', name: 'TabNews', icon: null, color: '#24292F', category: 'plataforma', aliases: ['tab news'] },
  // redes
  { id: 'youtube', name: 'YouTube', icon: 'youtube', color: '#FF0000', category: 'rede', aliases: ['you tube', 'iutubi', 'iutube'] },
  { id: 'twitch', name: 'Twitch', icon: 'twitch', color: '#9146FF', category: 'rede', aliases: ['tuitch'] },
  { id: 'linkedin', name: 'LinkedIn', icon: 'devicon:linkedin/linkedin-plain', color: '#0A66C2', category: 'rede', aliases: ['linked in', 'linkedim', 'linquedin', 'linkdin'] },
  { id: 'instagram', name: 'Instagram', icon: 'instagram', color: '#FF0069', category: 'rede', aliases: ['insta'], spoken: { 'insta': 'Insta' } },
  { id: 'x', name: 'X', icon: 'x', color: '#000000', category: 'rede', aliases: ['twitter', 'tuíter', 'x twitter'], spoken: { 'twitter': 'Twitter', 'tuíter': 'Twitter' } },
  { id: 'tiktok', name: 'TikTok', icon: 'tiktok', color: '#000000', category: 'rede', aliases: ['tik tok', 'tic toc'] },
  { id: 'facebook', name: 'Facebook', icon: 'facebook', color: '#0866FF', category: 'rede', aliases: ['face book'] },
  { id: 'reddit', name: 'Reddit', icon: 'reddit', color: '#FF4500', category: 'rede', aliases: [] },
  // empresas e hardware
  { id: 'google', name: 'Google', icon: 'google', color: '#4285F4', category: 'empresa', aliases: [] },
  { id: 'microsoft', name: 'Microsoft', icon: null, color: '#5E5E5E', category: 'empresa', aliases: ['maicrosoft'] },
  { id: 'apple', name: 'Apple', icon: 'apple', color: '#000000', category: 'empresa', aliases: ['iphone', 'ipad', 'macbook', 'mac book'], spoken: { 'iphone': 'iPhone', 'ipad': 'iPad', 'macbook': 'MacBook' } },
  { id: 'meta', name: 'Meta', icon: 'meta', color: '#0467DF', category: 'empresa', aliases: ['meta ai'], weak: ['meta'], common: true },
  { id: 'netflix', name: 'Netflix', icon: 'netflix', color: '#E50914', category: 'empresa', aliases: [] },
  { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1ED760', category: 'empresa', aliases: [] },
  { id: 'nubank', name: 'Nubank', icon: 'nubank', color: '#820AD1', category: 'empresa', aliases: ['nu bank'] },
  { id: 'ifood', name: 'iFood', icon: 'ifood', color: '#EA1D2C', category: 'empresa', aliases: ['i food', 'ai food'] },
  { id: 'uber', name: 'Uber', icon: 'uber', color: '#000000', category: 'empresa', aliases: [] },
  { id: 'arduino', name: 'Arduino', icon: 'arduino', color: '#00878F', category: 'ferramenta', aliases: [] },
  { id: 'raspberrypi', name: 'Raspberry Pi', icon: 'raspberrypi', color: '#A22846', category: 'ferramenta', aliases: ['raspberry pi', 'raspberry'], spoken: { 'raspberry': 'Raspberry' } },
  { id: 'unity', name: 'Unity', icon: 'unity', color: '#FFFFFF', category: 'ferramenta', aliases: ['unity 3d', 'unity engine'], weak: ['unity'] },
  { id: 'unreal', name: 'Unreal Engine', icon: 'unrealengine', color: '#0E1128', category: 'ferramenta', aliases: ['unreal engine', 'unreal'], spoken: { 'unreal': 'Unreal' } },
  { id: 'godot', name: 'Godot', icon: 'godotengine', color: '#478CBF', category: 'ferramenta', aliases: ['godot engine'] },
  { id: 'blender', name: 'Blender', icon: 'blender', color: '#E87D0D', category: 'ferramenta', aliases: [] },
];

export interface TechAlias {
  tech: Tech;
  /** precisa de contexto para valer */
  weak: boolean;
  /** quantas palavras o apelido tem */
  size: number;
  /** grafia na legenda quando o apelido é dito numa palavra só */
  caption: string;
}

function buildIndex(techs: readonly Tech[]): Map<string, TechAlias> {
  const index = new Map<string, TechAlias>();
  // os apelidos escritos à mão entram primeiro: a forma colada ("react js" → "reactjs") nunca toma o lugar de um deles
  const glued: [string, TechAlias][] = [];
  for (const tech of techs) {
    const weak = new Set((tech.weak ?? []).map(techKey));
    const spoken = new Map(Object.entries(tech.spoken ?? {}).map(([alias, caption]) => [techKey(alias), caption]));
    const add = (text: string, isWeak: boolean) => {
      const key = techKey(text);
      if (key.length < 2 || index.has(key)) return;
      const size = key.split(' ').length;
      const entry: TechAlias = { tech, weak: isWeak || weak.has(key), size, caption: spoken.get(key) ?? tech.name };
      index.set(key, entry);
      if (size > 1) glued.push([key.replaceAll(' ', ''), { ...entry, size: 1 }]);
    };
    for (const alias of tech.weak ?? []) add(alias, true);
    for (const alias of [tech.name, tech.id, ...tech.aliases]) add(alias, false);
  }
  for (const [key, entry] of glued) if (!index.has(key)) index.set(key, entry);
  return index;
}

/** Apelido normalizado (`techKey`) → tecnologia. */
export const TECH_ALIASES: ReadonlyMap<string, TechAlias> = buildIndex(TECHS);
export const TECH_BY_ID: ReadonlyMap<string, Tech> = new Map(TECHS.map((tech) => [tech.id, tech]));
/** Maior apelido, em palavras: até onde a detecção olha à frente. */
export const MAX_ALIAS_WORDS = Math.max(...[...TECH_ALIASES.values()].map((alias) => alias.size));

/** Tecnologia pelo id, nome ou apelido; aceita o prefixo `tech:`. */
export function resolveTech(name: string): Tech | undefined {
  const bare = name.startsWith(TECH_PREFIX) ? name.slice(TECH_PREFIX.length) : name;
  return TECH_BY_ID.get(bare.trim()) ?? TECH_ALIASES.get(techKey(bare))?.tech;
}

/** `tech:react` é um nome de ícone válido? */
export function isTechIconName(value: string): boolean {
  return value.startsWith(TECH_PREFIX) && resolveTech(value) !== undefined;
}

const LABEL_TAIL = /\s*(?:[:—–(]|\s-\s).*$/s;
const VERSION_TAIL = /\s+v?\d+(?:\.\d+)*\+?$/;

/**
 * Tecnologia que um RÓTULO de tela nomeia, ou undefined. Vale o rótulo inteiro ("React", "Node.js 22") ou o começo
 * antes de um separador ("Docker: containers"). Palavra comum só vale escrita como o nome oficial ("Go", "Angular"),
 * e tecnologia marcada `common` ("Meta", "Cursor") nunca: essas pedem `tech:<id>` explícito.
 */
export function labelTech(label: string): Tech | undefined {
  const clean = label.replace(/\*|==/g, '').trim();
  if (!clean) return undefined;
  const head = clean.replace(LABEL_TAIL, '').trim();
  for (const candidate of new Set([clean, clean.replace(VERSION_TAIL, ''), head, head.replace(VERSION_TAIL, '')])) {
    const alias = TECH_ALIASES.get(techKey(candidate));
    if (!alias || alias.tech.common) continue;
    if (!alias.weak || candidate === alias.tech.name) return alias.tech;
  }
  return undefined;
}

/** Letras do monograma de uma tecnologia sem ícone: o nome se for curto, senão as maiúsculas, senão as duas primeiras letras. */
export function monogram(tech: Pick<Tech, 'name' | 'mono'>): string {
  if (tech.mono) return tech.mono;
  const letters = tech.name.replace(/[^\p{L}\p{N}]/gu, '');
  if (letters.length <= 3) return letters;
  const capitals = letters.replace(/[^\p{Lu}\p{N}]/gu, '');
  if (capitals.length >= 2) return capitals.slice(0, 2);
  return letters.slice(0, 2);
}

export const TECH_CATEGORIES = [...new Set(TECHS.map((tech) => tech.category))];

/** De qual conjunto vem o desenho. */
export function iconSource(tech: Pick<Tech, 'icon'>): 'simple-icons' | 'devicon' | 'monograma' {
  if (tech.icon === null) return 'monograma';
  return tech.icon.startsWith('devicon:') ? 'devicon' : 'simple-icons';
}
