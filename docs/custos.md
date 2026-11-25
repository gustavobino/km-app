# Custos do veículo — premissas e fontes

Pesquisa feita em **25/11/2026**. Todos os números são **estimativas**; no app a Reserva do carro sempre aparece como "estimativa" e o motorista pode editar os valores.

## Como funciona no app

O motorista digita o carro em **Lucro líquido → Modo veículo → Editar valores** (ex.: modelo "Kwid", ano 2020). O app reconhece o modelo (`lib/metrics/vehicle-models.ts`) e passa a usar as médias **daquele modelo**. A busca é feita numa tabela guardada no próprio app (funciona sem internet), não na internet em tempo real.

Ordem de preferência para **manutenção por km**:
1. valor digitado pelo motorista;
2. histórico dele (gastos "Outro" com descrição de manutenção, com ≥ 1.000 km de histórico);
3. **média do modelo** reconhecido;
4. média do tipo de carro (`cost_reference`, em `db/seed.sql`).

Para **pneus por km**: valor do motorista → média do modelo → média do tipo.

Reserva por km = manutenção + pneus + (seguro anual + IPVA anual) ÷ km rodados no ano (estimado). Mais, por dia: aluguel ou parcela rateados.

## Método

**Manutenção por km = revisões programadas + desgaste fora da revisão**

- **Revisões programadas:** soma do plano de revisões com preço fixo da montadora ÷ km coberto pelo plano (50 ou 60 mil km).
- **Desgaste fora da revisão** (igual para todos os modelos, ≈ **R$ 0,079/km**):
  - Freios (pastilhas e discos): R$ 1.200–2.000 a cada 30–40 mil km → usamos o meio: **R$ 1.600 / 35.000 km ≈ R$ 0,046/km**.
  - Suspensão: R$ 1.200–1.800 a cada 40–50 mil km → **R$ 1.500 / 45.000 km ≈ R$ 0,033/km**.
  - Embreagem (R$ 1.000–1.300) **não entrou**: a fonte não traz intervalo de troca. Quem lançar esse gasto como manutenção tem a conta ajustada pelo histórico.

**Pneus por km = 4 × preço médio ÷ durabilidade média** (≈ **R$ 0,052/km**)

- Preço: média das medianas de preço das medidas usadas por esses carros: 175/70 R14 (R$ 659,99), 185/65 R15 (R$ 636,29) e 175/65 R14 (R$ 663,45) → **R$ 653,24**.
- Durabilidade: faixa de 40–60 mil km citada para pneus de carro popular → **50.000 km**.

**Conferência:** guias para motoristas de app citam manutenção entre R$ 0,10 e R$ 0,30/km, e uma planilha usa R$ 0,22/km como média de populares. Nossos modelos ficam entre R$ 0,13 e R$ 0,16/km de manutenção, mais R$ 0,05/km de pneus (≈ R$ 0,18–0,22/km no total), dentro dessa faixa.

## Quais carros (os mais usados na Uber e na 99)

Lista baseada em dados das plataformas de 2024 publicados pela CNN Brasil: Onix lidera nas duas; também aparecem Gol, HB20, Kwid, Mobi, Ka, Sandero, Argo, Voyage, Uno e Logan. Incluímos as versões sedã dos mesmos carros (Onix Plus, HB20S, Virtus, Cronos, Ka Sedan).

## Tabela por modelo

| Modelo | Revisões (total / km) | Ano dos preços | Manutenção R$/km | Fonte das revisões |
|---|---|---|---|---|
| Chevrolet Onix | R$ 4.524 / 60 mil | 2026 | 0,154 | Trocando Marcha (tabela Chevrolet linha 2026) |
| Chevrolet Onix Plus | R$ 4.524 / 60 mil | 2026 | 0,154 | mesmo plano do Onix (mesmo motor) |
| Hyundai HB20 | R$ 4.385 / 60 mil | 2026 | 0,152 | Vrum (comparativo 03/2026) |
| Hyundai HB20S | R$ 4.385 / 60 mil | 2026 | 0,152 | Vrum (comparativo 03/2026) |
| Renault Kwid | R$ 3.738 / 50 mil | 2025 | 0,154 | Garagem360 / Napista |
| Fiat Mobi | R$ 4.206 / 50 mil | 2024 | 0,163 | Garagem360 (dados oficiais citados) |
| VW Gol | R$ 3.800 / 60 mil | 2024 | 0,142 | Notícias Automotivas (1.0 MPI) |
| VW Voyage | R$ 3.800 / 60 mil | 2024 | 0,142 | mesmo plano do Gol |
| VW Polo | R$ 3.574,20 / 60 mil | 2021 | 0,139 | tabela 2021 (Roteiro Notícias) |
| VW Virtus | R$ 3.574,20 / 60 mil | 2021 | 0,139 | mesmo plano do Polo 1.0 |
| Fiat Argo | R$ 4.480 / 60 mil | 2025 | 0,154 | CustoCarro (tabela de concessionária) |
| Fiat Cronos | R$ 3.684 / 60 mil | 2020 | 0,140 | AutoPapo (1.3 Firefly) |
| Renault Sandero | R$ 3.166,68 / 60 mil | 2022 | 0,132 | Autossegredos |
| Renault Logan | R$ 3.166,68 / 60 mil | 2022 | 0,132 | mesmo plano do Sandero |
| Ford Ka | R$ 3.344 / 60 mil | 2020 | 0,135 | AutoPapo (1.5) |
| Ford Ka Sedan | R$ 3.344 / 60 mil | 2020 | 0,135 | AutoPapo (1.5) |

**Fiat Uno** está entre os mais usados, mas não achamos preços de revisão: usa a média do tipo de carro.

## Médias por tipo (`cost_reference`, quando o modelo não é reconhecido)

| Tipo | Manutenção R$/km | Pneus R$/km | Origem |
|---|---|---|---|
| Compacto | 0,1472 | 0,0523 | média dos compactos acima |
| Sedã | 0,1421 | 0,0523 | média dos sedãs acima |
| Outro / não informado | 0,1450 | 0,0523 | média de todos acima |
| SUV | 0,11 / 0,14 / 0,18 (por idade) | 0,045 | **PLACEHOLDER**: nenhum SUV entre os mais usados; não pesquisado |

## Limitações (importante)

- **Preços antigos:** Polo/Virtus (2021), Cronos e Ka (2020) e Sandero/Logan (2022) usam tabelas antigas, sem correção pela inflação. Esses carros tendem a aparecer um pouco mais baratos do que são hoje.
- **Fontes divergem:** para HB20, Kwid e Mobi há totais diferentes entre sites (ex.: HB20 de R$ 2,7 mil a R$ 5,1 mil). Usamos o valor mais recente com total explícito.
- **Idade do carro:** os planos cobrem carros novos (até 3 anos / 60 mil km). Para carros mais velhos usamos o mesmo valor; na prática costuma ser maior. O texto do app avisa isso, e os gastos de manutenção lançados pelo motorista ajustam a conta.
- **Cidade e oficina:** preços variam por região e entre concessionária e oficina independente.
- Consumo de combustível não entra na reserva (o motorista lança o combustível como gasto).

## Fontes

- Carros mais usados: CNN Brasil, "Conheça os carros eletrificados mais usados na 99 e na Uber no último ano" — https://www.cnnbrasil.com.br/auto/conheca-os-carros-eletrificados-mais-usados-na-99-e-na-uber-no-ultimo-ano/
- Onix 2026: https://trocandomarcha.com.br/revisao-do-onix-preco/
- HB20 / HB20S / Onix Plus / Cronos (2026): https://www.vrum.com.br/mercado/2026/03/7379576-cronos-onix-plus-ou-hb20s-qual-sedan-tem-a-manutencao-mais-barata.html
- Kwid e Mobi: https://garagem360.com.br/o-mais-barato-de-manter-custo-de-revisao-do-fiat-mobi-vs-renault-kwid/ e https://napista.com.br/radar/melhores-carros-populares-revisao-barata/
- Gol / Voyage: https://www.noticiasautomotivas.com.br/revisao-volkswagen-precos-e-detalhes/ e https://www.campograndenoticias.com.br/volkswagen-gol-preco-da-revisao-seguro-e-pecas-de-manutencao/
- Polo / Gol (tabela 2021): https://n.roteironoticias.com.br/index.php/2021/10/27/revisao-de-carros-populares-precos-e-detalhes/
- Argo: https://custocarro.com/blog/tabela-revisoes-por-marca/
- Cronos, Ka, Logan: https://autopapo.com.br/noticia/sedas-compactos-revisao/ e https://autopapo.com.br/noticia/hatches-revisoes-baratas/
- Sandero: https://www.autossegredos.com.br/segredos/novo-citroen-c3-1-0-tera-revisoes-mais-baratas-que-argo-mobi-e-208/
- Freios, suspensão, embreagem e faixa de R$/km: https://qualomelhorcurso.com.br/custo-manutencao-carro-uber/ , https://rotadomotorista.pro/quanto-custa-manter-carro-aplicativo-mes/ e https://taxicalcbr.online/blog/despesas-motorista-app-planilha.html
- Pneus (preços por medida): https://www.pneus.org/tabela-de-precos-de-pneus ; durabilidade: https://guiadepneus.com.br/melhor-pneu-175-70-r14/ e https://guiadopneu.com/pneu-185-65-r15-dunlop-e-bom-avaliacao-durabilidade

> Observação sobre a pesquisa: os números vieram de resumos de busca dessas páginas (as páginas não puderam ser abertas diretamente pelo ambiente de desenvolvimento). Vale conferir de tempos em tempos e atualizar `lib/metrics/vehicle-models.ts` e `db/seed.sql`.
