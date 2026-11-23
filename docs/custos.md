# Custos do veículo — premissas (RASCUNHO PARA REVISÃO)

> **Atenção:** os valores de `cost_reference` em `db/seed.sql` são **placeholders**. São números redondos escolhidos só para construir e testar a "Reserva do carro". **Não foram pesquisados e não são fatos.** Precisam ser revisados por você antes do lançamento.

No app, a Reserva do carro sempre aparece como **estimativa** e o motorista pode editar os valores.

## Como a reserva é calculada (CLAUDE.md › Modo veículo)

Reserva por km = manutenção por km + pneus por km + (seguro anual + IPVA anual) ÷ km rodados no ano (estimado).
Mais, por dia: aluguel rateado (carro alugado) ou parcela rateada (carro financiado).

Quando o motorista informa os próprios valores (seguro, IPVA, manutenção por km, pneus por km), o dado dele substitui a referência.

## Tabela de referência (placeholders)

Unidade: **centavos por km**. Faixas de idade: 0–3, 4–7 e 8+ anos.

| Categoria | Idade | Manutenção (¢/km) | Pneus (¢/km) |
|---|---|---|---|
| compacto | 0–3 | 8,00 | 3,00 |
| compacto | 4–7 | 10,00 | 3,00 |
| compacto | 8+ | 13,00 | 3,00 |
| sedã | 0–3 | 9,00 | 3,50 |
| sedã | 4–7 | 11,50 | 3,50 |
| sedã | 8+ | 15,00 | 3,50 |
| SUV | 0–3 | 11,00 | 4,50 |
| SUV | 4–7 | 14,00 | 4,50 |
| SUV | 8+ | 18,00 | 4,50 |
| outro | 0–3 | 9,00 | 3,50 |
| outro | 4–7 | 11,50 | 3,50 |
| outro | 8+ | 15,00 | 3,50 |

## Outras premissas (também placeholders)

- km anual estimado = média de km por dia rodado nos últimos 90 dias × dias típicos por mês × 12. Sem histórico: **3.000 km/mês**.
- Carro sem categoria informada usa "outro". Sem ano informado usa a faixa 4–7.

## O que você precisa fazer

1. Pesquisar valores de referência (ex.: planos de revisão das montadoras, preço médio de pneus ÷ durabilidade em km) ou decidir manter estimativas conservadoras.
2. Anotar aqui a fonte de cada número.
3. Atualizar `db/seed.sql` e trocar `is_placeholder` para `false` nas linhas revisadas.
