const BASE_URL = process.env.SEED_BASE_URL ?? 'https://hyperwood.yonkolab.xyz';
const TOKEN = process.env.SEED_TOKEN ?? '';

if (!TOKEN) {
  console.error('SEED_TOKEN (INTERNAL_BOOTSTRAP_TOKEN) is required');
  process.exit(1);
}

const events = [
  {
    slug: 'midterms-eua-2026',
    title: 'Midterms EUA 2026 — Controle do Congresso',
    category: 'Internacional',
    summary:
      'Em 3 de novembro os EUA renovam a Câmara e um terço do Senado. Com Trump no segundo mandato, os democratas lideram as projeções da Câmara — a disputa pelo Senado está aberta.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2026-11-15T21:00:00Z',
    markets: [
      {
        slug: 'midterms-2026-camera-democratas',
        title: 'Os democratas conquistam a Câmara?',
        summary:
          'O partido de oposição vira maioria na Câmara dos Deputados nos midterms de 2026. Projeção: 91%.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se, segundo a certificação dos resultados oficiais das eleições de novembro de 2026, o Partido Democrata obtiver a maioria dos assentos na Câmara dos Deputados.',
        resolutionSources: ['https://apnews.com'],
        yesPriceBps: 9100,
        noPriceBps: 900,
        volumeUsdMinor: 81_500_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-11-03T21:00:00Z',
        resolvesAt: '2026-11-06T21:00:00Z',
        tags: ['eleicoes', 'eua', 'internacional'],
      },
      {
        slug: 'midterms-2026-senado-democratas',
        title: 'Os democratas conquistam o Senado?',
        summary:
          'O Senado é o prêmio maior: a poluição do mapa favorece os republicanos, mas os democratas sonham com um sweep.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se os democratas conquistarem maioria no Senado dos EUA após a certificação oficial dos resultados de novembro de 2026.',
        resolutionSources: ['https://apnews.com'],
        yesPriceBps: 6400,
        noPriceBps: 3600,
        volumeUsdMinor: 46_250_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-11-03T21:00:00Z',
        resolvesAt: '2026-11-06T21:00:00Z',
        tags: ['eleicoes', 'eua', 'internacional'],
      },
    ],
  },
  {
    slug: 'fed-outubro-2026',
    title: 'Decisão do Fed de outubro de 2026',
    category: 'Economia',
    summary:
      'O Comitê Federal de Mercado Aberto se reúne no fim do mês para decidir a taxa básica americana. Os mais recentes dados de inflação sugerem manutenção.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2026-11-05T21:00:00Z',
    markets: [
      {
        slug: 'fed-outubro-2026-mantem-taxa',
        title: 'O Fed mantém a taxa em outubro?',
        summary:
          'Após cortes em junho e setembro, a ata da reunião sinalizou cautela. O mercado precifica 82% de manutenção.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o FOMC mantiver a faixa da taxa de juros inalterada na reunião de outubro de 2026, conforme comunicado oficial do Federal Reserve.',
        resolutionSources: ['https://www.federalreserve.gov'],
        yesPriceBps: 8200,
        noPriceBps: 1800,
        volumeUsdMinor: 24_700_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-10-28T21:00:00Z',
        resolvesAt: '2026-10-29T21:00:00Z',
        tags: ['economia', 'eua', 'macro'],
      },
      {
        slug: 'fed-outubro-2026-corte-25pb',
        title: 'Corte de 25 pb em outubro?',
        summary: 'Se houver corte, deve ser um quarto de ponto — a hipótese de corte maior morreu com o emprego aquecido.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o FOMC baixar a taxa em 25 pontos-base na reunião de outubro de 2026, conforme comunicado oficial do Federal Reserve.',
        resolutionSources: ['https://www.federalreserve.gov'],
        yesPriceBps: 1600,
        noPriceBps: 8400,
        volumeUsdMinor: 8_900_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-10-28T21:00:00Z',
        resolvesAt: '2026-10-29T21:00:00Z',
        tags: ['economia', 'eua', 'macro'],
      },
    ],
  },
  {
    slug: 'divida-eua-2026',
    title: 'Dívida dos EUA em 2026',
    category: 'Economia',
    summary:
      'Com o teto de 2026 se aproximando e o déficit recorde, o mercado precifica se a dívida federal cruza os marcos de US$ 47,5 e US$ 50 trilhões até o fim do ano.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2027-01-05T21:00:00Z',
    markets: [
      {
        slug: 'divida-eua-47-5-tri-2026',
        title: 'Dívida acima de US$ 47,5 trilhões até fim de 2026?',
        summary: 'Atualmente em US$ 47,3 tri. O ritmo de emissão do Tesouro coloca o marco sob infra de risco.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o relatório oficial do Tesouro dos EUA (Daily Treasury Statement) mostrar dívida federal total superior a US$ 47,5 trilhões em qualquer dia até 31/12/2026.',
        resolutionSources: ['https://fiscaldata.treasury.gov'],
        yesPriceBps: 6100,
        noPriceBps: 3900,
        volumeUsdMinor: 11_600_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-12-30T21:00:00Z',
        resolvesAt: '2027-01-03T21:00:00Z',
        tags: ['economia', 'eua', 'macro'],
      },
      {
        slug: 'divida-eua-50-tri-2026',
        title: 'Dívida acima de US$ 50 trilhões até fim de 2026?',
        summary: 'Muito acima do que os modelos apontam para 2026, mas o "ticking clock" joga contra.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o relatório oficial do Tesouro dos EUA mostrar dívida federal total superior a US$ 50 trilhões em qualquer dia até 31/12/2026.',
        resolutionSources: ['https://fiscaldata.treasury.gov'],
        yesPriceBps: 3200,
        noPriceBps: 6800,
        volumeUsdMinor: 6_300_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-12-30T21:00:00Z',
        resolvesAt: '2027-01-03T21:00:00Z',
        tags: ['economia', 'eua', 'macro'],
      },
    ],
  },
  {
    slug: 'libertadores-2026-semifinais',
    title: 'Semifinais da Libertadores 2026',
    category: 'Esportes',
    summary:
      'Flamengo x Fluminense pelo lado brasileiro e Palmeiras x Estudiantes pelo outro definem quem vai à final do Estádio Centenario, em Montevidéu, dia 28 de novembro.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2026-10-23T21:00:00Z',
    markets: [
      {
        slug: 'lib-2026-semi-ida-flamengo-x-flu',
        title: 'Flamengo vence o Fla-Flu de ida?',
        summary: 'Primeiro jogo da semifinal entre os rivais cariocas, no Maracanã, 14 de outubro.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Flamengo vencer a partida de ida da semifinal da Libertadores 2026 contra o Fluminense, conforme resultado oficial da CONMEBOL para 14/10/2026.',
        resolutionSources: ['https://www.conmebol.com', 'https://ge.globo'],
        yesPriceBps: 5200,
        noPriceBps: 4800,
        volumeUsdMinor: 9_100_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-10-14T21:00:00Z',
        resolvesAt: '2026-10-15T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
      {
        slug: 'lib-2026-semi-ida-palmeiras-x-estudiantes',
        title: 'Palmeiras vence o jogo de ida contra o Estudiantes?',
        summary: 'O Verdão recebe o Pincha na Arena Nubank no dia 14 de outubro.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Palmeiras vencer a partida de ida da semifinal da Libertadores 2026 contra o Estudiantes, conforme resultado oficial da CONMEBOL para 14/10/2026.',
        resolutionSources: ['https://www.conmebol.com', 'https://ge.globo'],
        yesPriceBps: 5800,
        noPriceBps: 4200,
        volumeUsdMinor: 6_400_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-10-14T21:00:00Z',
        resolvesAt: '2026-10-15T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
    ],
  },
  {
    slug: 'f1-gp-sao-paulo-2026',
    title: 'GP de São Paulo 2026 (Interlagos)',
    category: 'Esportes',
    summary:
      'Com Antonelli em casa depois do título precoce da Mercedes e Hamilton correndo em solo especial, o clássico brasileiro vira o ponto de virada da temporada.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2026-11-09T21:00:00Z',
    markets: [
      {
        slug: 'f1-sapao-antonelli-na-frente',
        title: 'Antonelli fica à frente de Russell em Interlagos?',
        summary:
          'O duelo entre os dois Mercedes em solo brasileiro é separador entre os favoritos e o companheiro de equipe do brasileiro.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Kimi Antonelli terminar corridamente à frente de George Russell na classificação final do GP de São Paulo 2026 de 8 de novembro, conforme resultado oficial da FIA.',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 7000,
        noPriceBps: 3000,
        volumeUsdMinor: 5_600_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-11-08T17:00:00Z',
        resolvesAt: '2026-11-08T21:00:00Z',
        tags: ['f1', 'automobilismo', 'brasil'],
      },
      {
        slug: 'f1-sapao-hamilton-podio',
        title: 'Lewis Hamilton sobe ao pódio em Interlagos?',
        summary: 'Em Alpine no papel, mas o GP de São Paulo é a casa espiritual de Lewis — já foi três vezes campeão aqui.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Lewis Hamilton terminar entre os três primeiros (pódio) do GP de São Paulo 2026 de 8 de novembro, conforme resultado oficial da FIA.',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 3300,
        noPriceBps: 6700,
        volumeUsdMinor: 3_900_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-11-08T17:00:00Z',
        resolvesAt: '2026-11-08T21:00:00Z',
        tags: ['f1', 'automobilismo', 'brasil'],
      },
    ],
  },
  {
    slug: 'musica-2026-beyonce',
    title: 'Ano de Beyoncé em 2026',
    category: 'Entretenimento',
    summary: 'Ela já ultrapassou o recorde de streams do ano? O streaming-to-date precifica quase certo.',
    startsAt: '2026-10-03T21:00:00Z',
    endsAt: '2026-12-27T21:00:00Z',
    markets: [
      {
        slug: 'musica-2026-beyonce-6-75b',
        title: 'Beyoncé ultrapassa 6,75 bilhões de streams até o fim do ano?',
        summary: 'Streaming total em plataformas em 2026.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o relatório final de 2026 de streaming consolidado (ChartMasters ou equivalente) mostrar Beyoncé com mais de 6,75 bilhões de streams no ano.',
        resolutionSources: ['https://chartmasters.org'],
        yesPriceBps: 9800,
        noPriceBps: 200,
        volumeUsdMinor: 4_800_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-12-27T21:00:00Z',
        resolvesAt: '2026-12-31T21:00:00Z',
        tags: ['musica', 'streaming', 'records'],
      },
      {
        slug: 'musica-2026-beyonce-8b',
        title: 'Beyoncé ultrapassa 8 bilhões de streams até o fim do ano?',
        summary: 'Marcador premium — precisa de álbum novo ou uma reviravolta viral.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o relatório final de 2026 de streaming consolidado mostrar Beyoncé com mais de 8 bilhões de streams no ano.',
        resolutionSources: ['https://chartmasters.org'],
        yesPriceBps: 2800,
        noPriceBps: 7200,
        volumeUsdMinor: 2_100_00,
        opensAt: '2026-10-03T21:00:00Z',
        closesAt: '2026-12-27T21:00:00Z',
        resolvesAt: '2026-12-31T21:00:00Z',
        tags: ['musica', 'streaming', 'records'],
      },
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

for (const event of events) {
  const { markets, ...eventBody } = event;
  const eventResponse = await api('/api/v1/internal/markets/events', eventBody);
  const eventId = eventResponse.event.id;
  console.log(`evento: ${event.slug} (${eventId})`);

  for (const market of markets) {
    const marketResponse = await api('/api/v1/internal/markets', {
      ...market,
      eventId,
      status: 'active',
    });
    created += 1;
    console.log(`  mercado: ${market.slug} (${marketResponse.market.id})`);
  }
}

console.log(`\n${created} mercados criados em ${events.length} eventos novos.`);
