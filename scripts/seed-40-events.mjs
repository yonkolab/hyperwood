const BASE_URL = process.env.SEED_BASE_URL ?? 'https://hyperwood.yonkolab.xyz';
const TOKEN = process.env.SEED_TOKEN ?? '';

if (!TOKEN) {
  console.error('SEED_TOKEN (INTERNAL_BOOTSTRAP_TOKEN) is required');
  process.exit(1);
}

const S = '2026-10-04T00:00:00Z';

const events = [
  // ============ ESPORTES (14) ============
  {
    slug: 'mlb-world-series-2026',
    title: 'World Series 2026',
    category: 'Esportes',
    summary: 'A série final do beisebol americano em outubro. Yankees e Dodgers dominam as projeções.',
    markets: [
      { slug: 'mlb-ws-2026-yankees', title: 'Yankees vencem a World Series 2026?', currency: 'BRL', yes: 2400, vol: 1200000, close: '2026-10-28T01:00:00Z', resolve: '2026-10-30T21:00:00Z', tags: ['mlb', 'beisebol'] },
      { slug: 'mlb-ws-2026-dodgers', title: 'Dodgers vencem a World Series 2026?', currency: 'BRL', yes: 2100, vol: 980000, close: '2026-10-28T01:00:00Z', resolve: '2026-10-30T21:00:00Z', tags: ['mlb', 'beisebol'] },
    ],
  },
  {
    slug: 'nba-2026-27-temporada',
    title: 'NBA 2026-27 — Campeão da Temporada',
    category: 'Esportes',
    summary: 'A temporada 2026-27 começa no dia 21 de outubro. Thunder defende o título após o bicampeonato de 2025-26.',
    markets: [
      { slug: 'nba-2027-thunder-campeao', title: 'Thunder vence a NBA 2026-27?', currency: 'BRL', yes: 3100, vol: 2100000, close: '2027-06-15T01:00:00Z', resolve: '2027-06-20T21:00:00Z', tags: ['nba', 'basquete'] },
      { slug: 'nba-2027-celtics-campeao', title: 'Celtics vence a NBA 2026-27?', currency: 'BRL', yes: 1400, vol: 1350000, close: '2027-06-15T01:00:00Z', resolve: '2027-06-20T21:00:00Z', tags: ['nba', 'basquete'] },
      { slug: 'nba-2027-nuggets-campeao', title: 'Nuggets vence a NBA 2026-27?', currency: 'BRL', yes: 1100, vol: 640000, close: '2027-06-15T01:00:00Z', resolve: '2027-06-20T21:00:00Z', tags: ['nba', 'basquete'] },
    ],
  },
  {
    slug: 'nfl-temporada-2026',
    title: 'NFL 2026 — Super Bowl LXI',
    category: 'Esportes',
    summary: 'A temporada regular da NFL até o Super Bowl em fevereiro de 2027. Chiefs buscam o tri.',
    markets: [
      { slug: 'nfl-2026-chiefs-super-bowl', title: 'Chiefs vencem o Super Bowl LXI?', currency: 'BRL', yes: 1200, vol: 2400000, close: '2027-02-07T23:00:00Z', resolve: '2027-02-09T21:00:00Z', tags: ['nfl', 'futebol-americano'] },
      { slug: 'nfl-2026-eagles-super-bowl', title: 'Eagles vencem o Super Bowl LXI?', currency: 'BRL', yes: 1400, vol: 1100000, close: '2027-02-07T23:00:00Z', resolve: '2027-02-09T21:00:00Z', tags: ['nfl', 'futebol-americano'] },
    ],
  },
  {
    slug: 'champions-league-2026-27',
    title: 'Champions League 2026-27',
    category: 'Esportes',
    summary: 'A fase de grupos da Champions 2026-27 já está em andamento com o novo formato de 36 clubes.',
    markets: [
      { slug: 'ucl-2027-real-campeao', title: 'Real Madrid vence a Champions 2026-27?', currency: 'BRL', yes: 1800, vol: 1800000, close: '2027-05-29T19:00:00Z', resolve: '2027-05-31T21:00:00Z', tags: ['futebol', 'champions'] },
      { slug: 'ucl-2027-bayern-campeao', title: 'Bayern vence a Champions 2026-27?', currency: 'BRL', yes: 1200, vol: 920000, close: '2027-05-29T19:00:00Z', resolve: '2027-05-31T21:00:00Z', tags: ['futebol', 'champions'] },
      { slug: 'ucl-2027-barcelona-campeao', title: 'Barcelona vence a Champions 2026-27?', currency: 'BRL', yes: 1100, vol: 780000, close: '2027-05-29T19:00:00Z', resolve: '2027-05-31T21:00:00Z', tags: ['futebol', 'champions'] },
    ],
  },
  {
    slug: 'premier-league-2026-27',
    title: 'Premier League 2026-27',
    category: 'Esportes',
    summary: 'A liga inglesa na era pós-Guardiola. Arsenal, Man City e Liverpool disputam o topo.',
    markets: [
      { slug: 'epl-2027-arsenal-campeao', title: 'Arsenal vence a Premier League 2026-27?', currency: 'BRL', yes: 2700, vol: 950000, close: '2027-05-23T15:00:00Z', resolve: '2027-05-25T21:00:00Z', tags: ['futebol', 'premier-league'] },
      { slug: 'epl-2027-man-city-campeao', title: 'Man City vence a Premier League 2026-27?', currency: 'BRL', yes: 2400, vol: 680000, close: '2027-05-23T15:00:00Z', resolve: '2027-05-25T21:00:00Z', tags: ['futebol', 'premier-league'] },
    ],
  },
  {
    slug: 'ucl-ncaa-semana-8',
    title: 'NCAA Football — Semana 8 (outubro)',
    category: 'Esportes',
    summary: 'Confrontos decisivos do college football americano na semana 8 do calendário.',
    markets: [
      { slug: 'ncaa-w8-texasam-vence', title: 'Texas A&M vence neste fim de semana?', currency: 'BRL', yes: 7200, vol: 320000, close: '2026-10-11T01:00:00Z', resolve: '2026-10-12T06:00:00Z', tags: ['ncaa', 'futebol-americano'] },
      { slug: 'ncaa-w8-georgia-vence', title: 'Georgia vence neste fim de semana?', currency: 'BRL', yes: 8500, vol: 210000, close: '2026-10-11T01:00:00Z', resolve: '2026-10-12T06:00:00Z', tags: ['ncaa', 'futebol-americano'] },
    ],
  },
  {
    slug: 'tennis-atp-finals-2026',
    title: 'ATP Finals 2026 — Turim',
    category: 'Esportes',
    summary: 'Os 8 melhores do ano se enfrentam em Turim em novembro. Sinner e Alcaraz dominam.',
    markets: [
      { slug: 'atp-2026-sinner-campeao', title: 'Sinner vence as ATP Finals 2026?', currency: 'BRL', yes: 3300, vol: 540000, close: '2026-11-22T18:00:00Z', resolve: '2026-11-23T21:00:00Z', tags: ['tenis'] },
      { slug: 'atp-2026-alcaraz-campeao', title: 'Alcaraz vence as ATP Finals 2026?', currency: 'BRL', yes: 2900, vol: 410000, close: '2026-11-22T18:00:00Z', resolve: '2026-11-23T21:00:00Z', tags: ['tenis'] },
    ],
  },
  {
    slug: 'ballon-dor-2026',
    title: 'Bola de Ouro 2026',
    category: 'Esportes',
    summary: 'A premiação do melhor jogador de futebol do ano acontece em outubro em Paris.',
    markets: [
      { slug: 'bd-2026-mbappe', title: 'Mbappé ganha a Bola de Ouro 2026?', currency: 'BRL', yes: 2800, vol: 480000, close: '2026-10-25T20:00:00Z', resolve: '2026-10-26T21:00:00Z', tags: ['futebol', 'premios'] },
      { slug: 'bd-2026-vinicius', title: 'Vinícius Jr. ganha a Bola de Ouro 2026?', currency: 'BRL', yes: 1700, vol: 360000, close: '2026-10-25T20:00:00Z', resolve: '2026-10-26T21:00:00Z', tags: ['futebol', 'premios'] },
    ],
  },
  {
    slug: 'ufc-outubro-2026',
    title: 'UFC — Evento de outubro',
    category: 'Esportes',
    summary: 'O PPV mensal do UFC com disputa de cinturão. Makhachev segue dominando os leves.',
    markets: [
      { slug: 'ufc-out-makhachev-vence', title: 'Makhachev vence no próximo PPV?', currency: 'BRL', yes: 7800, vol: 180000, close: '2026-10-24T23:00:00Z', resolve: '2026-10-25T21:00:00Z', tags: ['mma', 'ufc'] },
    ],
  },
  {
    slug: 'formula-e-2026-27',
    title: 'Fórmula E — Temporada 2026-27',
    category: 'Esportes',
    summary: 'A temporada de corridas elétricas começa em janeiro com circuitos urbanos pelo mundo.',
    markets: [
      { slug: 'fe-2027-campeao-pilotos', title: 'Jaguar vence o Mundial de Pilotos da Fórmula E 2026-27?', currency: 'BRL', yes: 2200, vol: 95000, close: '2027-07-31T18:00:00Z', resolve: '2027-08-02T21:00:00Z', tags: ['formula-e', 'automobilismo'] },
    ],
  },
  {
    slug: 'cs2-major-outubro-2026',
    title: 'CS2 Major — Outubro 2026',
    category: 'Esportes',
    summary: 'O Major de Counter-Strike 2 define o campeão mundial do FPS tático.',
    markets: [
      { slug: 'cs2-major-navi', title: 'NAVI vence o Major de CS2?', currency: 'BRL', yes: 1500, vol: 140000, close: '2026-10-19T22:00:00Z', resolve: '2026-10-20T21:00:00Z', tags: ['esports', 'cs2'] },
      { slug: 'cs2-major-vitality', title: 'Vitality vence o Major de CS2?', currency: 'BRL', yes: 1900, vol: 120000, close: '2026-10-19T22:00:00Z', resolve: '2026-10-20T21:00:00Z', tags: ['esports', 'cs2'] },
    ],
  },
  {
    slug: 'serie-b-2026-promocao',
    title: 'Série B 2026 — Promoção à Série A',
    category: 'Esportes',
    summary: 'Quem sobe à elite do futebol brasileiro em 2027. Coritiba lidera com folga.',
    markets: [
      { slug: 'serie-b-2026-coritiba-sobe', title: 'Coritiba sobe direto à Série A 2027?', currency: 'BRL', yes: 8300, vol: 340000, close: '2026-11-28T23:00:00Z', resolve: '2026-11-30T21:00:00Z', tags: ['futebol', 'serie-b'] },
      { slug: 'serie-b-2026-athletico-sobe', title: 'Athletico-PR sobe à Série A 2027?', currency: 'BRL', yes: 5800, vol: 220000, close: '2026-11-28T23:00:00Z', resolve: '2026-11-30T21:00:00Z', tags: ['futebol', 'serie-b'] },
    ],
  },
  {
    slug: 'f1-abu-dhabi-2026',
    title: 'F1 — GP de Abu Dhabi 2026',
    category: 'Esportes',
    summary: 'A última corrida da temporada 2026 decide o campeonato em Yas Marina.',
    markets: [
      { slug: 'f1-abu-antonelli-vence', title: 'Antonelli vence o GP de Abu Dhabi 2026?', currency: 'BRL', yes: 3600, vol: 420000, close: '2026-12-06T13:00:00Z', resolve: '2026-12-06T21:00:00Z', tags: ['f1', 'automobilismo'] },
    ],
  },
  {
    slug: 'copa-do-brasil-2026',
    title: 'Copa do Brasil 2026 — Finalista',
    category: 'Esportes',
    summary: 'A Copa do Brasil está nas semifinais — quem chega à decisão?',
    markets: [
      { slug: 'cdb-2026-flamengo-finalista', title: 'Flamengo chega à final da Copa do Brasil 2026?', currency: 'BRL', yes: 6200, vol: 380000, close: '2026-11-15T23:00:00Z', resolve: '2026-11-17T21:00:00Z', tags: ['futebol', 'copa-do-brasil'] },
      { slug: 'cdb-2026-cruzeiro-finalista', title: 'Cruzeiro chega à final da Copa do Brasil 2026?', currency: 'BRL', yes: 4500, vol: 260000, close: '2026-11-15T23:00:00Z', resolve: '2026-11-17T21:00:00Z', tags: ['futebol', 'copa-do-brasil'] },
    ],
  },
  {
    slug: 'billboard-2026-hot-100',
    title: 'Billboard Hot 100 — Fim de ano 2026',
    category: 'Entretenimento',
    summary: 'Quem termina 2026 no topo da parada americana?',
    markets: [
      { slug: 'bb-2026-taylor-swift-numero-1', title: 'Taylor Swift termina 2026 com #1 no Hot 100?', currency: 'BRL', yes: 1900, vol: 160000, close: '2026-12-27T23:00:00Z', resolve: '2026-12-31T21:00:00Z', tags: ['musica', 'billboard'] },
    ],
  },

  // ============ POLÍTICA (8) ============
  {
    slug: 'eleicoes-2026-governadores',
    title: 'Eleições 2026 — Governadores',
    category: 'Política',
    summary: 'Além da presidência, 27 estados elegem governadores no dia 4 de outubro.',
    markets: [
      { slug: 'gov-2026-tarcisio-sp', title: 'Tarcísio de Freitas vence em São Paulo?', currency: 'BRL', yes: 8700, vol: 890000, close: '2026-10-03T23:59:00Z', resolve: '2026-10-06T21:00:00Z', tags: ['eleicoes', 'brasil', 'estadual'] },
      { slug: 'gov-2026-romeu-zema-mg', title: 'Zema vence em Minas Gerais?', currency: 'BRL', yes: 5800, vol: 340000, close: '2026-10-03T23:59:00Z', resolve: '2026-10-06T21:00:00Z', tags: ['eleicoes', 'brasil', 'estadual'] },
      { slug: 'gov-2026-claro-reis-rj', title: 'Cabo Daciolo vence no Rio de Janeiro?', currency: 'BRL', yes: 100, vol: 45000, close: '2026-10-03T23:59:00Z', resolve: '2026-10-06T21:00:00Z', tags: ['eleicoes', 'brasil', 'estadual'] },
    ],
  },
  {
    slug: 'eleicoes-2026-congresso-br',
    title: 'Eleições 2026 — Congresso Brasileiro',
    category: 'Política',
    summary: 'A Câmara dos Deputados será renovada completamente. O centrão se mantém?',
    markets: [
      { slug: 'congresso-2026-pt-maior-bancada', title: 'PT continua como maior bancada da Câmara?', currency: 'BRL', yes: 7400, vol: 520000, close: '2026-10-03T23:59:00Z', resolve: '2026-10-08T21:00:00Z', tags: ['eleicoes', 'brasil', 'congresso'] },
      { slug: 'congresso-2026-pl-segundo-turno', title: 'PL elege mais de 80 deputados federais?', currency: 'BRL', yes: 4100, vol: 180000, close: '2026-10-03T23:59:00Z', resolve: '2026-10-08T21:00:00Z', tags: ['eleicoes', 'brasil', 'congresso'] },
    ],
  },
  {
    slug: 'midterms-eua-2026-governadores',
    title: 'Midterms EUA 2026 — Governadores',
    category: 'Internacional',
    summary: '36 estados americanos elegem governadores em 3 de novembro.',
    markets: [
      { slug: 'midterms-gov-2026-california', title: 'Democrata vence na Califórnia?', currency: 'USD', yes: 9200, vol: 210000, close: '2026-11-03T21:00:00Z', resolve: '2026-11-06T21:00:00Z', tags: ['eleicoes', 'eua', 'internacional'] },
      { slug: 'midterms-gov-2026-texas', title: 'Republicano vence no Texas?', currency: 'USD', yes: 8800, vol: 180000, close: '2026-11-03T21:00:00Z', resolve: '2026-11-06T21:00:00Z', tags: ['eleicoes', 'eua', 'internacional'] },
    ],
  },
  {
    slug: 'g20-cupula-2026',
    title: 'Cúpula do G20 2026',
    category: 'Internacional',
    summary: 'O G20 se reúne em novembro na França. Reforma do Conselho de Segurança e clima na pauta.',
    markets: [
      { slug: 'g20-2026-declaracao-clima', title: 'G20 aprova meta de redução de emissões vinculante?', currency: 'BRL', yes: 2300, vol: 65000, close: '2026-11-20T21:00:00Z', resolve: '2026-11-22T21:00:00Z', tags: ['internacional', 'clima'] },
    ],
  },
  {
    slug: 'lula-aprovacao-2026',
    title: 'Aprovação do Governo Lula — Outubro',
    category: 'Política',
    summary: 'Os institutos Datafolha e Quaest publicam novos números de aprovação em outubro.',
    markets: [
      { slug: 'lula-approv-2026-acima-40', title: 'Aprovação de Lula acima de 40% em outubro?', currency: 'BRL', yes: 3800, vol: 120000, close: '2026-10-30T21:00:00Z', resolve: '2026-11-02T21:00:00Z', tags: ['politica', 'brasil', 'pesquisas'] },
      { slug: 'lula-approv-2026-reprovacao-maioria', title: 'Rejeição de Lula supera 50% em outubro?', currency: 'BRL', yes: 3500, vol: 98000, close: '2026-10-30T21:00:00Z', resolve: '2026-11-02T21:00:00Z', tags: ['politica', 'brasil', 'pesquisas'] },
    ],
  },
  {
    slug: 'copom-novembro-2026',
    title: 'Copom — Reunião de Novembro',
    category: 'Economia',
    summary: 'O Comitê de Política Monetária do Banco Central decide a Selic em novembro.',
    markets: [
      { slug: 'copom-nov-2026-corta-selic', title: 'Copom corta a Selic em novembro?', currency: 'BRL', yes: 5600, vol: 680000, close: '2026-11-24T23:00:00Z', resolve: '2026-11-26T21:00:00Z', tags: ['economia', 'selic', 'brasil'] },
      { slug: 'copom-nov-2026-selic-10', title: 'Selic termina 2026 em 10,00% ou menos?', currency: 'BRL', yes: 3300, vol: 240000, close: '2026-12-27T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['economia', 'selic', 'brasil'] },
    ],
  },
  {
    slug: 'dolar-real-novembro-2026',
    title: 'Dólar/Real — Novembro 2026',
    category: 'Economia',
    summary: 'O câmbio volátil pós-eleição. O dólar volta a pressionar a barreira psicológica?',
    markets: [
      { slug: 'dolar-2026-acima-5-50', title: 'Dólar acima de R$ 5,50 em 30/11/2026?', currency: 'BRL', yes: 3200, vol: 420000, close: '2026-11-29T21:00:00Z', resolve: '2026-12-02T21:00:00Z', tags: ['economia', 'dolar', 'brasil'] },
      { slug: 'dolar-2026-volta-a-5-00', title: 'Dólar volta abaixo de R$ 5,00 até 30/11?', currency: 'BRL', yes: 1500, vol: 280000, close: '2026-11-29T21:00:00Z', resolve: '2026-12-02T21:00:00Z', tags: ['economia', 'dolar', 'brasil'] },
    ],
  },
  {
    slug: 'ipca-outubro-2026',
    title: 'IPCA — Outubro 2026',
    category: 'Economia',
    summary: 'O índice de inflação oficial brasileiro será divulgado no início de novembro.',
    markets: [
      { slug: 'ipca-out-2026-acima-45', title: 'IPCA 12 meses acima de 4,5% em outubro?', currency: 'BRL', yes: 4400, vol: 130000, close: '2026-11-08T12:00:00Z', resolve: '2026-11-10T21:00:00Z', tags: ['economia', 'inflacao', 'brasil'] },
    ],
  },

  // ============ ECONOMIA (6) ============
  {
    slug: 'sp500-2026-fechamento',
    title: 'S&P 500 — Fechamento 2026',
    category: 'Economia',
    summary: 'O índice americano em rumo ao recorde ou correção? A linha dos 7.000 pontos é o marco.',
    markets: [
      { slug: 'sp500-2026-acima-7000', title: 'S&P 500 fecha 2026 acima de 7.000 pontos?', currency: 'USD', yes: 2600, vol: 720000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['economia', 'acoes', 'eua'] },
    ],
  },
  {
    slug: 'petroleo-brent-novembro',
    title: 'Petróleo Brent — Novembro 2026',
    category: 'Economia',
    summary: 'Com o cessar-fogo Irã-Israel e o cartel sob pressão, onde fecha o Brent?',
    markets: [
      { slug: 'brent-nov-2026-acima-80', title: 'Brent fecha acima de US$ 80 até 30/11?', currency: 'USD', yes: 3800, vol: 240000, close: '2026-11-29T21:00:00Z', resolve: '2026-12-02T21:00:00Z', tags: ['economia', 'petroleo', 'commodities'] },
    ],
  },
  {
    slug: 'ethereum-2026-staking',
    title: 'Ethereum — Fim de 2026',
    category: 'Economia',
    summary: 'O ETH luta para recuperar o patamar dos US$ 5.000 após o bear market de 2025.',
    markets: [
      { slug: 'eth-2026-acima-5000', title: 'ETH acima de US$ 5.000 em 31/12/2026?', currency: 'USD', yes: 2100, vol: 380000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['cripto', 'ethereum'] },
      { slug: 'eth-2026-abaixo-2000', title: 'ETH abaixo de US$ 2.000 em 31/12/2026?', currency: 'USD', yes: 1700, vol: 190000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['cripto', 'ethereum'] },
    ],
  },
  {
    slug: 'shutdown-eua-2026',
    title: 'Shutdown do Governo Americano',
    category: 'Internacional',
    summary: 'O Congresso americano precisa aprovar o orçamento antes do fim do ano fiscal.',
    markets: [
      { slug: 'shutdown-eua-2026-ocorre', title: 'Haverá shutdown do governo americano em 2026?', currency: 'USD', yes: 3500, vol: 520000, close: '2026-12-31T21:00:00Z', resolve: '2027-01-05T21:00:00Z', tags: ['politica', 'eua', 'internacional'] },
    ],
  },
  {
    slug: 'selic-dezembro-2026',
    title: 'Selic — Fechamento 2026',
    category: 'Economia',
    summary: 'O ciclo de cortes do Banco Central. Onde para a taxa básica ao fim do ano?',
    markets: [
      { slug: 'selic-dez-2026-abaixo-10', title: 'Selic fecha 2026 abaixo de 10,00%?', currency: 'BRL', yes: 2900, vol: 480000, close: '2026-12-27T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['economia', 'selic', 'brasil'] },
      { slug: 'selic-dez-2026-9-50', title: 'Selic fecha 2026 em 9,50% ou menos?', currency: 'BRL', yes: 1600, vol: 220000, close: '2026-12-27T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['economia', 'selic', 'brasil'] },
    ],
  },
  {
    slug: 'nasdaq-100-2026',
    title: 'Nasdaq 100 — Fim de 2026',
    category: 'Economia',
    summary: 'O índice tech puxado pela onda de IA. Pode passar dos 28.000 pontos?',
    markets: [
      { slug: 'nasdaq-2026-acima-28000', title: 'Nasdaq 100 fecha acima de 28.000 em 2026?', currency: 'USD', yes: 3000, vol: 290000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['economia', 'acoes', 'tecnologia'] },
    ],
  },

  // ============ ENTRETENIMENTO (5) ============
  {
    slug: 'oscar-2027-antecipado',
    title: 'Oscar 2027 — Favoritos Antecipados',
    category: 'Entretenimento',
    summary: 'A corrida pelo Oscar começa já com os filmes de outono.quem chega na frente?',
    markets: [
      { slug: 'oscar-2027-oppenheimer-sequel', title: 'Um filme de 2026 ganha mais de 8 Oscars em 2027?', currency: 'BRL', yes: 2200, vol: 85000, close: '2027-01-15T21:00:00Z', resolve: '2027-03-08T21:00:00Z', tags: ['cinema', 'oscar'] },
    ],
  },
  {
    slug: 'streaming-2026-netflix',
    title: 'Streaming — Fim de 2026',
    category: 'Entretenimento',
    summary: 'Qual plataforma termina o ano com a série mais assistida?',
    markets: [
      { slug: 'netflix-2026-stranger-coisas-5', title: 'Stranger Things 5 passa de 1 bi de views?', currency: 'BRL', yes: 1700, vol: 42000, close: '2026-12-27T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['streaming', 'netflix'] },
    ],
  },
  {
    slug: 'grammy-2027-nominacoes',
    title: 'Grammy 2027 — Indicações',
    category: 'Entretenimento',
    summary: 'As indicações saem em novembro de 2026. Quem domina o ano da música?',
    markets: [
      { slug: 'grammy-2027-sabrina-album-ano', title: 'Sabrina Carpenter indicada a Álbum do Ano?', currency: 'BRL', yes: 5200, vol: 34000, close: '2026-11-15T21:00:00Z', resolve: '2026-11-17T21:00:00Z', tags: ['musica', 'grammy'] },
    ],
  },
  {
    slug: 'big-brother-brasil-2027',
    title: 'BBB 2027 — Estreia',
    category: 'Entretenimento',
    summary: 'A próxima temporada do reality já tem data marcada: janeiro de 2027.',
    markets: [
      { slug: 'bbb-2027-audiencia-estreia', title: 'BBB 2027 tem estreia com mais de 25 pontos na Globo?', currency: 'BRL', yes: 6200, vol: 28000, close: '2027-01-20T23:00:00Z', resolve: '2027-01-22T21:00:00Z', tags: ['tv', 'bbb', 'globo'] },
    ],
  },
  {
    slug: 'videogame-2026-goty',
    title: 'The Game Awards 2026 — GOTY',
    category: 'Entretenimento',
    summary: 'Qual jogo leva o prêmio de Game of the Year em dezembro?',
    markets: [
      { slug: 'tga-2026-gta6-goty', title: 'GTA VI vence o GOTY 2026?', currency: 'BRL', yes: 4400, vol: 62000, close: '2026-12-10T23:00:00Z', resolve: '2026-12-12T21:00:00Z', tags: ['games', 'premios'] },
    ],
  },

  // ============ TECNOLOGIA (3) ============
  {
    slug: 'ai-2026-openai',
    title: 'OpenAI — Lançamentos 2026',
    category: 'Tecnologia',
    summary: 'A corrida da IA acelera: a OpenAI pode lançar o GPT-5 até o fim do ano?',
    markets: [
      { slug: 'openai-2026-gpt5-lancamento', title: 'OpenAI lança o GPT-5 até 31/12/2026?', currency: 'USD', yes: 2100, vol: 340000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['tecnologia', 'ia', 'openai'] },
    ],
  },
  {
    slug: 'apple-2026-iphone-18',
    title: 'Apple iPhone 18',
    category: 'Tecnologia',
    summary: 'O iPhone 18 deve chegar em setembro de 2027, mas a safra atual já esquenta.',
    markets: [
      { slug: 'apple-2026-iphone-fold', title: 'Apple anuncia iPhone dobrável até 31/12/2026?', currency: 'USD', yes: 1100, vol: 180000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['tecnologia', 'apple'] },
    ],
  },
  {
    slug: 'cripto-2026-regulacao-br',
    title: 'Regulação Cripto — Brasil 2026',
    category: 'Tecnologia',
    summary: 'O marco regulatório das criptomoedas avança no Congresso.',
    markets: [
      { slug: 'cripto-br-2026-lei-aprovada', title: 'Lei de regulamento cripto sancionada até 31/12/2026?', currency: 'BRL', yes: 2800, vol: 95000, close: '2026-12-30T21:00:00Z', resolve: '2027-01-03T21:00:00Z', tags: ['cripto', 'regulacao', 'brasil'] },
    ],
  },

  // ============ CLIMA (2) ============
  {
    slug: 'furacoes-2026-atlantico',
    title: 'Temporada de Furacões — Atlântico 2026',
    category: 'Clima',
    summary: 'A temporada de furacões no Atlântico vai até 30 de novembro. Quantos nomeados até agora?',
    markets: [
      { slug: 'furacoes-2026-mais-15', title: 'Mais de 15 tempestades nomeadas na temporada 2026?', currency: 'USD', yes: 6800, vol: 42000, close: '2026-11-29T21:00:00Z', resolve: '2026-12-02T21:00:00Z', tags: ['clima', 'furacoes'] },
    ],
  },
  {
    slug: 'temperatura-global-2026',
    title: 'Temperatura Global — 2026',
    category: 'Clima',
    summary: '2026 será o ano mais quente da história registrada? Os dados da NOAA dizem.',
    markets: [
      { slug: 'temp-2026-recorde-calor', title: '2026 é o ano mais quente já registrado?', currency: 'USD', yes: 3400, vol: 120000, close: '2027-01-10T21:00:00Z', resolve: '2027-01-17T21:00:00Z', tags: ['clima', 'temperatura'] },
    ],
  },
];

async function api(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-bootstrap-token': TOKEN,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${path} => ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

let created = 0;
let failed = 0;

for (const event of events) {
  const { markets, ...eventBody } = event;

  try {
    const eventResponse = await api('/api/v1/internal/markets/events', {
      slug: eventBody.slug,
      title: eventBody.title,
      category: eventBody.category,
      ...(eventBody.summary ? { summary: eventBody.summary } : {}),
      startsAt: S,
      endsAt: markets[markets.length - 1].resolve,
    });
    const eventId = eventResponse.event.id;

    for (const m of markets) {
      try {
        await api('/api/v1/internal/markets', {
          eventId,
          slug: m.slug,
          title: m.title,
          ...(m.tags ? { tags: m.tags } : {}),
          currency: m.currency,
          status: 'active',
          resolutionRules: `Resolve conforme fonte oficial. Ver detalhes em ${m.tags?.[0] ?? 'site oficial'}.`,
          resolutionSources: ['https://example.com'],
          yesPriceBps: m.yes,
          noPriceBps: 10000 - m.yes,
          volumeUsdMinor: m.vol,
          opensAt: S,
          closesAt: m.close,
          resolvesAt: m.resolve,
        });
        created += 1;
        console.log(`  ✓ ${m.slug} (${m.yes / 100}%)`);
      } catch (mErr) {
        failed += 1;
        console.log(`  ✗ ${m.slug}: ${mErr.message.slice(0, 100)}`);
      }
    }
    console.log(`evento: ${event.slug} (${eventId})`);
  } catch (eErr) {
    failed += 1;
    console.log(`✗ evento ${event.slug}: ${eErr.message.slice(0, 120)}`);
  }
}

console.log(`\n=== RESUMO ===`);
console.log(`mercados criados: ${created}`);
console.log(`falhas: ${failed}`);
console.log(`eventos processados: ${events.length}`);
