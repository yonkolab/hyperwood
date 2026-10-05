# Brazil Presidential Election: Polymarket Snapshot (2026-10-05)

**Checked:** 2026-10-05, approximately 20:44 UTC (17:44 BRT), matching the latest Gamma update observed. This is the observed Polymarket state, not an official election result.

## Named candidate contracts

The Gamma event payload contains 32 markets; this table covers its 19 individually named candidate contracts (the 12 generic “Person O”–“Person Z” rows and “another person” are excluded). At the latest Gamma update observed (20:44:13.843557 UTC), 17 named contracts were `closed` and `resolved` No (`outcomePrices` ordered as Yes, No: `[0, 1]`). Lula and Flávio remained open (`closed: false`). [Gamma event payload](https://gamma-api.polymarket.com/events?slug=brazil-presidential-election)

| Candidate | Polymarket contract status |
| --- | --- |
| Tarcisio de Freitas | Closed — resolved No |
| Luiz Inácio Lula da Silva | Open — Yes price 16.50% |
| Jair Bolsonaro | Closed — resolved No |
| Fernando Haddad | Closed — resolved No |
| Michelle Bolsonaro | Closed — resolved No |
| Eduardo Bolsonaro | Closed — resolved No |
| Carlos Roberto Massa Júnior | Closed — resolved No |
| Renan Santos | Closed — resolved No |
| Flávio Bolsonaro | Open — Yes price 83.15% |
| Ronaldo Caiado | Closed — resolved No |
| Romeu Zema | Closed — resolved No |
| Camilo Santana | Closed — resolved No |
| Geraldo Alckmin | Closed — resolved No |
| Eduardo Leite | Closed — resolved No |
| Aldo Rebelo | Closed — resolved No |
| Tereza Cristina | Closed — resolved No |
| Helder Barbalho | Closed — resolved No |
| Pablo Marçal | Closed — resolved No |
| Augusto Cury | Closed — resolved No |

Gamma's Yes prices at that latest update were 83.15% for Flávio and 16.50% for Lula. These are contract prices, not official vote shares or certified probabilities. The values `active: true` on resolved rows do not override their `closed: true` and `resolved` state.

## Expected snapshot and time sensitivity

Expected reference: 17 resolved No; Flávio 82.65%; Lula 17.50%. The 17/19 status count matches the Gamma observation. The current Gamma prices differ by **+0.50 percentage point** for Flávio and **−1.00 point** for Lula.

Polymarket's public [CLOB price-history endpoint for Flávio's Yes token](https://clob.polymarket.com/prices-history?market=109876868437950584369987384406356259939519193117253465815665152916226511121427&startTs=1791158400&endTs=1791233160&fidelity=1) and [Lula's Yes token](https://clob.polymarket.com/prices-history?market=30630994248667897740988010928640156931882346081873066002335460180076741328029&startTs=1791158400&endTs=1791233160&fidelity=1) record both expected prices together during 2026-10-05: the sampled series overlap at 82.65%/17.50% around 19:13–19:31 UTC and again around 19:38–19:45 UTC. Thus the expected pair is supported as an intraday observation; without its capture time, it cannot be attributed to one exact instant. The later Gamma values above are a distinct, time-sensitive observation, not evidence that the expected pair was wrong.

## Resolution and official-results distinction

In my own words, Polymarket says each Yes contract wins if its named candidate wins the 2026 election, including any runoff. If the result remains unknown by June 30, 2027 at 11:59 PM ET, the market resolves to “Other.” Polymarket relies on a consensus of credible reporting, using Brazil's official TSE results if reporting is ambiguous. [Official event page](https://polymarket.com/event/brazil-presidential-election) · [Gamma rules and market data](https://gamma-api.polymarket.com/events?slug=brazil-presidential-election)

The table reports **Polymarket contract states only**. A market marked “resolved No” is not, by itself, a statement of certified election results; this note makes no claim about the official winner. Consult the [TSE official results portal](https://resultados.tse.jus.br/oficial/app/index.html#/eleicao) or [TSE Open Data portal](https://dadosabertos.tse.jus.br/) for official information. The event's own rule points to TSE as the official source when results are ambiguous.
