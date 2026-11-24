/** "Exportar meus dados" (LGPD): one CSV per kind of data, bundled in a ZIP. */
import { centsCell, toCsv, type Cell } from "./csv";

type Row = Record<string, unknown>;

export type ExportData = {
  email: string | null;
  profile: Row | null;
  vehicle: Row | null;
  platforms: Row[];
  days: Array<Row & { earnings: Row[]; expenses: Row[] }>;
  maintenance: Row[];
  payments: Row[];
  entitlements: Row[];
};

const v = (x: unknown): Cell =>
  x == null ? null : typeof x === "object" ? JSON.stringify(x) : (x as Cell);
const hours = (minutes: unknown) =>
  typeof minutes === "number"
    ? String(Math.round((minutes / 60) * 100) / 100).replace(".", ",")
    : "";

export function buildExportFiles(
  d: ExportData,
): Array<{ name: string; content: string }> {
  const p = d.profile ?? {};
  const days = [...d.days].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  return [
    {
      name: "LEIA-ME.txt",
      content:
        "Seus dados no Km+.\r\nValores em reais (R$), horas em horas decimais, datas no formato AAAA-MM-DD.\r\n" +
        "Dias registrados sem internet e ainda não enviados não entram neste arquivo.\r\n",
    },
    {
      name: "perfil.csv",
      content: toCsv(
        [
          "email",
          "apps",
          "carro",
          "combustivel",
          "meta_mensal",
          "horas_por_dia",
          "dias_por_mes",
          "modo_veiculo",
          "criado_em",
        ],
        [
          [
            d.email,
            Array.isArray(p.apps) ? (p.apps as string[]).join(", ") : null,
            v(p.vehicle_ownership),
            v(p.fuel_type),
            centsCell(p.monthly_goal_cents as number | null),
            v(p.typical_hours_per_day),
            v(p.typical_days_per_month),
            v(p.vehicle_mode_enabled),
            v(p.created_at),
          ],
        ],
      ),
    },
    {
      name: "carro.csv",
      content: toCsv(
        [
          "marca",
          "modelo",
          "ano",
          "tipo",
          "aluguel",
          "periodo_aluguel",
          "parcela",
          "seguro_ano",
          "ipva_ano",
          "manutencao_por_km_centavos",
          "pneus_por_km_centavos",
        ],
        d.vehicle
          ? [
              [
                v(d.vehicle.brand),
                v(d.vehicle.model),
                v(d.vehicle.year),
                v(d.vehicle.category),
                centsCell(d.vehicle.rent_cents as number | null),
                v(d.vehicle.rent_period),
                centsCell(d.vehicle.installment_cents as number | null),
                centsCell(d.vehicle.insurance_year_cents as number | null),
                centsCell(d.vehicle.ipva_year_cents as number | null),
                v(d.vehicle.maintenance_cents_per_km),
                v(d.vehicle.tires_cents_per_km),
              ],
            ]
          : [],
      ),
    },
    {
      name: "apps.csv",
      content: toCsv(
        ["app", "nome", "como_cobra", "percentual", "passe", "periodo_passe"],
        d.platforms.map((x) => [
          v(x.source),
          v(x.label),
          v(x.mode),
          v(x.percent),
          centsCell(x.pass_cents as number | null),
          v(x.pass_period),
        ]),
      ),
    },
    {
      name: "dias.csv",
      content: toCsv(
        ["data", "horas", "km", "folga", "turnos", "anotacao"],
        days.map((x) => [
          v(x.date),
          hours(x.minutes),
          v(x.km),
          v(x.is_day_off),
          Array.isArray(x.shifts) ? (x.shifts as string[]).join(", ") : null,
          v(x.note),
        ]),
      ),
    },
    {
      name: "ganhos.csv",
      content: toCsv(
        ["data", "app", "nome", "valor", "horas_no_app"],
        days.flatMap((x) =>
          x.earnings.map((e) => [
            v(x.date),
            v(e.source),
            v(e.label),
            centsCell(e.amount_cents as number),
            hours(e.minutes),
          ]),
        ),
      ),
    },
    {
      name: "gastos.csv",
      content: toCsv(
        [
          "data",
          "categoria",
          "descricao",
          "valor",
          "litros",
          "odometro_km",
          "tanque_cheio",
        ],
        days.flatMap((x) =>
          x.expenses.map((e) => [
            v(x.date),
            v(e.category),
            v(e.label),
            centsCell(e.amount_cents as number),
            v(e.liters),
            v(e.odometer_km),
            v(e.full_tank),
          ]),
        ),
      ),
    },
    {
      name: "manutencao.csv",
      content: toCsv(
        ["item", "a_cada_km", "ultima_vez_km", "ultima_vez_data"],
        d.maintenance.map((m) => [
          v(m.name),
          v(m.interval_km),
          v(m.last_done_km),
          v(m.last_done_date),
        ]),
      ),
    },
    {
      name: "pagamentos.csv",
      content: toCsv(
        ["id_mercado_pago", "status", "valor", "pago_em"],
        d.payments.map((x) => [
          v(x.provider_payment_id),
          v(x.status),
          centsCell(x.amount_cents as number),
          v(x.paid_at),
        ]),
      ),
    },
    {
      name: "acesso.csv",
      content: toCsv(
        ["plano", "origem", "liberado_em", "revogado_em", "motivo"],
        d.entitlements.map((x) => [
          v(x.plan),
          v(x.source),
          v(x.granted_at),
          v(x.revoked_at),
          v(x.revoke_reason),
        ]),
      ),
    },
  ];
}
