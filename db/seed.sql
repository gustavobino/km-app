-- cost_reference seed: per-category averages for the "Reserva do carro"
-- (ESTIMATES). Unit: cents of BRL per km driven (numeric, may be fractional).
--
-- compact / sedan / other = average of the researched models in
-- lib/metrics/vehicle-models.ts (scheduled services + brakes + suspension;
-- tires 4 × R$ 653,24 ÷ 50.000 km). Method and sources: docs/custos.md.
-- The same value is used for every age band: the sources only cover the
-- manufacturer plans; the driver's own maintenance expenses adjust it.
-- suv = still a PLACEHOLDER (no SUV among the most used cars; not researched).

insert into public.cost_reference
  (category, age_band, maintenance_cents_per_km, tires_cents_per_km, is_placeholder, source_note)
values
  ('compact', '0-3', 14.72, 5.23, false, 'Média dos compactos pesquisados (docs/custos.md, 25/11/2026)'),
  ('compact', '4-7', 14.72, 5.23, false, 'Média dos compactos pesquisados (docs/custos.md, 25/11/2026)'),
  ('compact', '8+', 14.72, 5.23, false, 'Média dos compactos pesquisados (docs/custos.md, 25/11/2026)'),
  ('sedan', '0-3', 14.21, 5.23, false, 'Média dos sedãs pesquisados (docs/custos.md, 25/11/2026)'),
  ('sedan', '4-7', 14.21, 5.23, false, 'Média dos sedãs pesquisados (docs/custos.md, 25/11/2026)'),
  ('sedan', '8+', 14.21, 5.23, false, 'Média dos sedãs pesquisados (docs/custos.md, 25/11/2026)'),
  ('suv', '0-3', 11.00, 4.50, true, 'PLACEHOLDER — SUV não pesquisado (docs/custos.md)'),
  ('suv', '4-7', 14.00, 4.50, true, 'PLACEHOLDER — SUV não pesquisado (docs/custos.md)'),
  ('suv', '8+', 18.00, 4.50, true, 'PLACEHOLDER — SUV não pesquisado (docs/custos.md)'),
  ('other', '0-3', 14.50, 5.23, false, 'Média de todos os modelos pesquisados (docs/custos.md, 25/11/2026)'),
  ('other', '4-7', 14.50, 5.23, false, 'Média de todos os modelos pesquisados (docs/custos.md, 25/11/2026)'),
  ('other', '8+', 14.50, 5.23, false, 'Média de todos os modelos pesquisados (docs/custos.md, 25/11/2026)')
on conflict (category, age_band) do update set
  maintenance_cents_per_km = excluded.maintenance_cents_per_km,
  tires_cents_per_km = excluded.tires_cents_per_km,
  is_placeholder = excluded.is_placeholder,
  source_note = excluded.source_note;
