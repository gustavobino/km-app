-- cost_reference seed.
-- !!! PLACEHOLDER VALUES — NOT RESEARCHED, NOT FACTS !!!
-- Round numbers chosen only so the "Reserva do carro" feature can be built and
-- tested. The owner must review them (docs/custos.md) before launch.
-- Unit: cents of BRL per km driven (numeric, may be fractional).

insert into public.cost_reference
  (category, age_band, maintenance_cents_per_km, tires_cents_per_km, is_placeholder, source_note)
values
  ('compact', '0-3', 8.00, 3.00, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('compact', '4-7', 10.00, 3.00, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('compact', '8+', 13.00, 3.00, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('sedan', '0-3', 9.00, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('sedan', '4-7', 11.50, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('sedan', '8+', 15.00, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('suv', '0-3', 11.00, 4.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('suv', '4-7', 14.00, 4.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('suv', '8+', 18.00, 4.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('other', '0-3', 9.00, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('other', '4-7', 11.50, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)'),
  ('other', '8+', 15.00, 3.50, true, 'PLACEHOLDER — revisar (docs/custos.md)')
on conflict (category, age_band) do nothing;
