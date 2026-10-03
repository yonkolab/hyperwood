const BASE_URL = process.env.SEED_BASE_URL ?? 'https://hyperwood.yonkolab.xyz';
const TOKEN = process.env.SEED_TOKEN ?? '';

if (!TOKEN) {
  console.error('SEED_TOKEN (INTERNAL_BOOTSTRAP_TOKEN) is required');
  process.exit(1);
}

const events = [
  {
    slug: 'eleicoes-brasil-2026',
    title: 'Eleições Presidenciais Brasil 2026',
    category: 'Política',
    summary:
      'O primeiro turno acontece em 4 de outubro de 2026 e um eventual segundo turno em 25 de outubro. Lula (PT) busca a reeleição contra Flávio Bolsonaro (PL), Ronaldo Caiado (PSD), Romeu Zema (NOVO) e outros oito candidatos. Pesquisas de fim de campanha: Lula 42% x Flávio 38% no 1º turno (Datafolha), com segundo turno estatisticamente empatado.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2026-11-05T21:00:00Z',
    markets: [
      {
        slug: 'eleicoes-2026-segundo-turno',
        title: 'Haverá segundo turno na eleição presidencial de 2026?',
        summary:
          'Nenhum candidato alcança 50% dos votos válidos no 1º turno (4/out) e a disputa vai para 25 de outubro.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se nenhum candidato obtiver mais da metade dos votos válidos apurados pelo TSE no 1º turno da eleição presidencial de 2026, havendo portanto 2º turno em 25/10/2026. Fonte oficial: divulgação do TSE (resultados.tse.jus.br).',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 9100,
        noPriceBps: 900,
        volumeUsdMinor: 18_400_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-05T02:59:59Z',
        resolvesAt: '2026-10-06T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
      {
        slug: 'eleicoes-2026-lula-primeiro-turno',
        title: 'Lula (PT) vencerá a presidência já no 1º turno?',
        summary:
          'Lula é eleito presidente com mais de 50% dos votos válidos em 4 de outubro, sem necessidade de 2º turno. Datafolha de 1º/out: 42% das intenções de voto.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM apenas se Lula for declarado eleito pelo TSE no 1º turno (4/10/2026) com maioria absoluta dos votos válidos, sem haver 2º turno presidencial.',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 700,
        noPriceBps: 9300,
        volumeUsdMinor: 6_250_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-05T02:59:59Z',
        resolvesAt: '2026-10-06T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
      {
        slug: 'eleicoes-2026-lula-reeleito',
        title: 'Lula (PT) será reeleito presidente do Brasil em 2026?',
        summary:
          'Lula vence a eleição presidencial, no 1º ou no 2º turno. Cenário de segundo turno: empate técnico — agregadores de 2/out dão Lula 45-50% x Flávio 44-50%.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Lula for diplomado presidente eleito nas eleições de 2026, seja no 1º turno (4/10) ou no 2º turno (25/10), conforme diplomação/certificação do TSE.',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 5200,
        noPriceBps: 4800,
        volumeUsdMinor: 42_700_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-24T23:59:00Z',
        resolvesAt: '2026-10-27T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
      {
        slug: 'eleicoes-2026-flavio-eleito',
        title: 'Flávio Bolsonaro (PL) será eleito presidente do Brasil em 2026?',
        summary:
          'O senador Flávio Bolsonaro, candidato do PL apoiado por Jair Bolsonaro, vence a presidência. Última pesquisa Vox (1º/out): 48% x 45% no cenário de 2º turno.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Flávio Bolsonaro for diplomado presidente eleito nas eleições de 2026, no 1º ou no 2º turno, conforme diplomação/certificação do TSE.',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 4600,
        noPriceBps: 5400,
        volumeUsdMinor: 38_900_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-24T23:59:00Z',
        resolvesAt: '2026-10-27T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
      {
        slug: 'eleicoes-2026-caiado-segundo-turno',
        title: 'Ronaldo Caiado (PSD) avançará para o 2º turno?',
        summary:
          'O ex-governador de Goiás, hoje com 3-4% nas pesquisas nacionais, supera Lula e Flávio Bolsonaro e chega ao 2º turno.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Ronaldo Caiado estiver entre os dois candidatos mais votados do 1º turno presidencial (4/10/2026), conforme apuração oficial do TSE.',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 600,
        noPriceBps: 9400,
        volumeUsdMinor: 2_150_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-05T02:59:59Z',
        resolvesAt: '2026-10-06T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
      {
        slug: 'eleicoes-2026-cury-acima-de-caiado',
        title: 'Augusto Cury (Avante) ficará à frente de Caiado (PSD) no 1º turno?',
        summary:
          'Disputa pela terceira colocação: Datafolha dá Cury 4% x Caiado 3%; Futura colocou Cury à frente com 4,2%. Empate técnico nos institutos.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Augusto Cury obtiver mais votos válidos que Ronaldo Caiado no 1º turno presidencial de 2026, conforme apuração final do TSE. Empate exato resolve NÃO.',
        resolutionSources: ['https://resultados.tse.jus.br'],
        yesPriceBps: 5000,
        noPriceBps: 5000,
        volumeUsdMinor: 4_800_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-05T02:59:59Z',
        resolvesAt: '2026-10-06T21:00:00Z',
        tags: ['eleicoes', 'brasil', 'politica'],
      },
    ],
  },
  {
    slug: 'brasileirao-2026',
    title: 'Brasileirão Série A 2026',
    category: 'Esportes',
    summary:
      'Após 28 rodadas: Flamengo lidera com 60 pontos (campeão de 2025 e atual campeão da Libertadores), seguido por Palmeiras com 57. Athletico-PR (49), Fluminense (48) e Bahia (46) completam o G5. Artilharia: Kevin Viveros (Athletico-PR) com 18 gols. Última rodada: 2 de dezembro.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2026-12-10T21:00:00Z',
    markets: [
      {
        slug: 'brasileirao-2026-flamengo-campeao',
        title: 'Flamengo será campeão do Brasileirão 2026 (bicampeonato)?',
        summary:
          'Líder com 60 pontos após 28 rodadas, três à frente do Palmeiras, com o melhor ataque (55 gols) e a melhor defesa (23). Busca o nono título e o bicampeonato seguido.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Flamengo terminar a Série A 2026 (última rodada em 2/12/2026) na 1ª colocação da classificação final da CBF.',
        resolutionSources: ['https://www.cbf.com.br'],
        yesPriceBps: 6200,
        noPriceBps: 3800,
        volumeUsdMinor: 15_300_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-02T21:00:00Z',
        resolvesAt: '2026-12-04T21:00:00Z',
        tags: ['futebol', 'brasileirao'],
      },
      {
        slug: 'brasileirao-2026-palmeiras-campeao',
        title: 'Palmeiras será campeão do Brasileirão 2026?',
        summary:
          'Vice-líder com 57 pontos em 28 rodadas, invicto em casa sob Abel Ferreira. Disputa também a semifinal da Libertadores.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Palmeiras terminar a Série A 2026 na 1ª colocação da classificação final da CBF.',
        resolutionSources: ['https://www.cbf.com.br'],
        yesPriceBps: 2400,
        noPriceBps: 7600,
        volumeUsdMinor: 9_700_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-02T21:00:00Z',
        resolvesAt: '2026-12-04T21:00:00Z',
        tags: ['futebol', 'brasileirao'],
      },
      {
        slug: 'brasileirao-2026-fluminense-g5',
        title: 'Fluminense terminará no G5 do Brasileirão 2026?',
        summary:
          'Atual 4º colocado com 48 pontos, oito de vantagem sobre o 6º (Cruzeiro, 45), busca vaga direta na fase de grupos da Libertadores 2027.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Fluminense terminar a Série A 2026 entre os cinco primeiros colocados da classificação final da CBF.',
        resolutionSources: ['https://www.cbf.com.br'],
        yesPriceBps: 6400,
        noPriceBps: 3600,
        volumeUsdMinor: 3_400_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-02T21:00:00Z',
        resolvesAt: '2026-12-04T21:00:00Z',
        tags: ['futebol', 'brasileirao'],
      },
      {
        slug: 'brasileirao-2026-santos-rebaixado',
        title: 'Santos será rebaixado para a Série B em 2026?',
        summary:
          'O Santos de Neymar é 8º colocado com 40 pontos em 27 jogos, a sete pontos da zona de rebaixamento.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Santos terminar a Série A 2026 entre os quatro últimos colocados da classificação final da CBF (rebaixamento à Série B 2027).',
        resolutionSources: ['https://www.cbf.com.br'],
        yesPriceBps: 600,
        noPriceBps: 9400,
        volumeUsdMinor: 5_600_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-02T21:00:00Z',
        resolvesAt: '2026-12-04T21:00:00Z',
        tags: ['futebol', 'brasileirao'],
      },
      {
        slug: 'brasileirao-2026-viveros-artilheiro',
        title: 'Kevin Viveros será o artilheiro do Brasileirão 2026?',
        summary:
          'O colombiano do Athletico-PR lidera a artilharia com 18 gols após 28 rodadas, seguido de perto pelos atacantes de Flamengo e Palmeiras.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Kevin Viveros for o artilheiro isolado do Campeonato Brasileiro Série A 2026 (mais gols marcados na competição, conforme estatísticas oficiais da CBF).',
        resolutionSources: ['https://www.cbf.com.br'],
        yesPriceBps: 4800,
        noPriceBps: 5200,
        volumeUsdMinor: 2_900_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-02T21:00:00Z',
        resolvesAt: '2026-12-04T21:00:00Z',
        tags: ['futebol', 'brasileirao'],
      },
    ],
  },
  {
    slug: 'libertadores-2026',
    title: 'Copa Libertadores 2026',
    category: 'Esportes',
    summary:
      'Semifinais em outubro: Flamengo x Fluminense e Palmeiras x Estudiantes (ARG). Três brasileiros entre os quatro finalistas. A final será em 28 de novembro no Estádio Centenario, em Montevidéu. O Flamengo é o atual campeão e defensor do título.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2026-12-04T21:00:00Z',
    markets: [
      {
        slug: 'libertadores-2026-flamengo-bicampeao',
        title: 'Flamengo vencerá a Libertadores 2026 (bicampeonato)?',
        summary:
          'O Rubro-Negro atropelou o Independiente del Valle nas quartas (3-1 no agregado) e busca o quarto título continental, o primeiro bi da história recente do clube.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Flamengo vencer a final da Copa CONMEBOL Libertadores 2026 (28/11/2026, Estádio Centenario), conforme resultado oficial da CONMEBOL.',
        resolutionSources: ['https://www.conmebol.com'],
        yesPriceBps: 5500,
        noPriceBps: 4500,
        volumeUsdMinor: 11_800_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-11-28T20:00:00Z',
        resolvesAt: '2026-11-29T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
      {
        slug: 'libertadores-2026-palmeiras-campeao',
        title: 'Palmeiras vencerá a Libertadores 2026?',
        summary:
          'Eliminou o LDU Quito nos pênaltis nas quartas e enfrenta o Estudiantes na semifinal. Busca o quarto título da competição.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Palmeiras vencer a final da Copa CONMEBOL Libertadores 2026, conforme resultado oficial da CONMEBOL.',
        resolutionSources: ['https://www.conmebol.com'],
        yesPriceBps: 2600,
        noPriceBps: 7400,
        volumeUsdMinor: 7_200_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-11-28T20:00:00Z',
        resolvesAt: '2026-11-29T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
      {
        slug: 'libertadores-2026-fluminense-campeao',
        title: 'Fluminense vencerá a Libertadores 2026?',
        summary:
          'Classificou-se eliminando o Platense nas quartas (3-2) e encara o Flamengo no clássico semifinal. Busca o segundo título (o primeiro foi em 2023).',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o Fluminense vencer a final da Copa CONMEBOL Libertadores 2026, conforme resultado oficial da CONMEBOL.',
        resolutionSources: ['https://www.conmebol.com'],
        yesPriceBps: 1200,
        noPriceBps: 8800,
        volumeUsdMinor: 4_100_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-11-28T20:00:00Z',
        resolvesAt: '2026-11-29T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
      {
        slug: 'libertadores-2026-futebol-brasileiro',
        title: 'Um clube brasileiro será campeão da Libertadores 2026?',
        summary:
          'Flamengo, Fluminense e Palmeiras ocupam três das quatro vagas semifinalistas — só o Estudiantes (ARG) evita o quadrimestre... o feito inédito de quatro brasileiros na final da Libertadores.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se o campeão da Copa CONMEBOL Libertadores 2026 for um clube da Federação Brasileira (Flamengo, Fluminense ou Palmeiras).',
        resolutionSources: ['https://www.conmebol.com'],
        yesPriceBps: 8600,
        noPriceBps: 1400,
        volumeUsdMinor: 8_450_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-11-28T20:00:00Z',
        resolvesAt: '2026-11-29T21:00:00Z',
        tags: ['futebol', 'libertadores'],
      },
    ],
  },
  {
    slug: 'formula-1-2026',
    title: 'Fórmula 1 — Temporada 2026',
    category: 'Esportes',
    summary:
      'A era dos novos motores: Kimi Antonelli (Mercedes) lidera o campeonato de pilotos com 302 pontos após 15 corridas, 66 à frente de George Russell (236), com Lewis Hamilton (199) e Lando Norris (186) na caça. Restam 8 GPs, incluindo Interlagos em 8 de novembro. Na construtores, a Mercedes domina.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2026-12-15T21:00:00Z',
    markets: [
      {
        slug: 'f1-2026-antonelli-campeao',
        title: 'Kimi Antonelli será campeão mundial de F1 em 2026?',
        summary:
          'Com apenas 20 anos, o italiano da Mercedes soma 7 vitórias em 2026 (incluindo Mônaco e Itália) e uma vantagem de 66 pontos com 8 corridas restantes.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Kimi Antonelli for campeão do Campeonato Mundial de Pilotos de F1 2026 (classificação final após o GP de Abu Dhabi, 6/12/2026), conforme resultado oficial da FIA.',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 8000,
        noPriceBps: 2000,
        volumeUsdMinor: 12_600_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-06T12:00:00Z',
        resolvesAt: '2026-12-06T18:00:00Z',
        tags: ['f1', 'automobilismo'],
      },
      {
        slug: 'f1-2026-russell-campeao',
        title: 'George Russell será campeão mundial de F1 em 2026?',
        summary:
          'O companheiro de Antonelli venceu 3 corridas em 2026 (incluindo grand slam no Azerbaijão) e é o principal perseguidor, 66 pontos atrás.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se George Russell for campeão do Campeonato Mundial de Pilotos de F1 2026, conforme resultado oficial da FIA.',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 1200,
        noPriceBps: 8800,
        volumeUsdMinor: 5_400_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-06T12:00:00Z',
        resolvesAt: '2026-12-06T18:00:00Z',
        tags: ['f1', 'automobilismo'],
      },
      {
        slug: 'f1-2026-verstappen-interlagos',
        title: 'Max Verstappen vencerá o GP de São Paulo 2026 (Interlagos)?',
        summary:
          'O tetracampeão vive sua pior temporada na era dos novos motores: nenhum pódio em primeiro lugar até a 15ª corrida. Interlagos, palco do GP Brasil em 8 de novembro, sempre o favoreceu.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Max Verstappen vencer o Grande Prêmio de São Paulo 2026 (8/11/2026, Autódromo de Interlagos), conforme resultado oficial da FIA (classificação da corrida, sem considerar punições posteriores).',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 1400,
        noPriceBps: 8600,
        volumeUsdMinor: 6_900_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-11-08T16:00:00Z',
        resolvesAt: '2026-11-08T21:00:00Z',
        tags: ['f1', 'automobilismo', 'brasil'],
      },
      {
        slug: 'f1-2026-mercedes-construtores',
        title: 'A Mercedes será campeã mundial de construtores de F1 em 2026?',
        summary:
          'A equipe prateada venceu 12 das 15 corridas da nova era de motores, com sete dobradinhas, e lidera com folga o campeonato de construtores.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se a Mercedes for campeã do Campeonato Mundial de Construtores de F1 2026, conforme resultado oficial da FIA após o GP de Abu Dhabi.',
        resolutionSources: ['https://www.fia.com', 'https://www.formula1.com'],
        yesPriceBps: 8600,
        noPriceBps: 1400,
        volumeUsdMinor: 3_700_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-06T12:00:00Z',
        resolvesAt: '2026-12-06T18:00:00Z',
        tags: ['f1', 'automobilismo'],
      },
    ],
  },
  {
    slug: 'cripto-economia-2026',
    title: 'Cripto e Economia 2026',
    category: 'Economia',
    summary:
      'O Bitcoin negocia a cerca de US$ 84.500 (cotação de 2 de outubro de 2026), longe dos máximos históricos do ciclo anterior. O ano ainda reserva o encerramento do halving cycle e as definições de juros no Brasil e nos EUA até dezembro.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2027-01-08T21:00:00Z',
    markets: [
      {
        slug: 'bitcoin-acima-100k-em-2026',
        title: 'Bitcoin acima de US$ 100.000 em 31 de dezembro de 2026?',
        summary:
          'A cotação precisa subir cerca de 18% a partir dos atuais US$ 84.500 até a virada do ano.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o preço do BTC/US$ for superior a US$ 100.000,00 às 21:00 UTC de 31/12/2026, medindo o índice agregado da CoinGecko (média de mercado).',
        resolutionSources: ['https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'],
        yesPriceBps: 2200,
        noPriceBps: 7800,
        volumeUsdMinor: 9_300_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-31T21:00:00Z',
        resolvesAt: '2027-01-02T21:00:00Z',
        tags: ['cripto', 'bitcoin'],
      },
      {
        slug: 'bitcoin-abaixo-70k-em-2026',
        title: 'Bitcoin abaixo de US$ 70.000 em 31 de dezembro de 2026?',
        summary:
          'Um recuo de cerca de 17% a partir dos atuais US$ 84.500 levaria o BTC ao menor fechamento de ano desde 2023.',
        currency: 'USD',
        resolutionRules:
          'Resolve SIM se o preço do BTC/US$ for inferior a US$ 70.000,00 às 21:00 UTC de 31/12/2026, medindo o índice agregado da CoinGecko (média de mercado).',
        resolutionSources: ['https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'],
        yesPriceBps: 1800,
        noPriceBps: 8200,
        volumeUsdMinor: 4_750_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-12-31T21:00:00Z',
        resolvesAt: '2027-01-02T21:00:00Z',
        tags: ['cripto', 'bitcoin'],
      },
    ],
  },
  {
    slug: 'premios-2026',
    title: 'Prêmios de Fim de Ano 2026',
    category: 'Entretenimento',
    summary:
      'A temporada de prêmios se aproxima: o Nobel da Paz 2026 será anunciado na segunda semana de outubro em Oslo, e o anúncio costuma premiar mediadores de conflitos, instituições e ativistas — nomes brasileiros frequentemente especulados.',
    startsAt: '2026-10-02T21:00:00Z',
    endsAt: '2026-10-31T21:00:00Z',
    markets: [
      {
        slug: 'nobel-paz-2026-lula',
        title: 'Lula ganhará o Nobel da Paz 2026?',
        summary:
          'O presidente-candidato é cotado em casas de apostas internacionais após o ano de acordos diplomáticos do governo — mas o prêmio raramente premia chefes de Estado em ano eleitoral.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se Luiz Inácio Lula da Silva for anunciado como laureado (isolado ou compartilhado) do Nobel da Paz 2026 pelo Comitê Nobel Norueguês (anúncio previsto para outubro de 2026).',
        resolutionSources: ['https://www.nobelprize.org'],
        yesPriceBps: 700,
        noPriceBps: 9300,
        volumeUsdMinor: 2_400_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-09T07:00:00Z',
        resolvesAt: '2026-10-10T21:00:00Z',
        tags: ['nobel', 'premios'],
      },
      {
        slug: 'nobel-paz-2026-brasileiro',
        title: 'Um brasileiro ganhará o Nobel da Paz 2026?',
        summary:
          'Além de Lula, instituições e ativistas brasileiros aparecem nas listas de especulação do Comitê de Oslo.',
        currency: 'BRL',
        resolutionRules:
          'Resolve SIM se qualquer cidadão brasileiro for anunciado como laureado (isolado ou compartilhado) do Nobel da Paz 2026 pelo Comitê Nobel Norueguês.',
        resolutionSources: ['https://www.nobelprize.org'],
        yesPriceBps: 900,
        noPriceBps: 9100,
        volumeUsdMinor: 1_300_00,
        opensAt: '2026-10-02T21:00:00Z',
        closesAt: '2026-10-09T07:00:00Z',
        resolvesAt: '2026-10-10T21:00:00Z',
        tags: ['nobel', 'premios'],
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

let createdMarkets = 0;

for (const event of events) {
  const { markets, ...eventBody } = event;
  const eventResponse = await api('/api/v1/internal/markets/events', {
    ...eventBody,
    status: undefined,
  });
  const eventId = eventResponse.event?.id;
  console.log(`evento: ${event.slug} (${eventId})`);

  for (const market of markets) {
    const marketResponse = await api('/api/v1/internal/markets', {
      ...market,
      eventId,
      status: 'active',
    });
    createdMarkets += 1;
    console.log(`  mercado: ${market.slug} (${marketResponse.market?.id})`);
  }
}

console.log(`\n${createdMarkets} mercados criados.`);
