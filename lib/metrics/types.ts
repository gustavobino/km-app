import type { LocalDate } from "../dates";
import type { Cents } from "../money";
import type { Minutes } from "../units";

export type Source = "uber" | "99" | "other";
export type ExpenseCategory =
  "fuel" | "food" | "toll" | "parking" | "wash" | "other";
export type Shift = "morning" | "afternoon" | "evening" | "night";
export type PassPeriod = "day" | "week" | "month";

export type Earning = {
  source: Source;
  /** App name when source is "other". */
  label: string | null;
  amountCents: Cents;
  /** Hours on this app, only when the driver splits hours between apps. */
  minutes: Minutes | null;
};

export type Expense = {
  category: ExpenseCategory;
  label: string | null;
  amountCents: Cents;
  liters: number | null;
  odometerKm: number | null;
  fullTank: boolean | null;
};

export type DayData = {
  date: LocalDate;
  minutes: Minutes | null;
  km: number | null;
  isDayOff: boolean;
  shifts: Shift[] | null;
  earnings: Earning[];
  expenses: Expense[];
};

export type PlatformSetting = {
  source: Source;
  label: string | null;
  mode: "net_already" | "percent" | "pass";
  /** 0–100, when mode is "percent". */
  percent: number | null;
  passCents: Cents | null;
  passPeriod: PassPeriod | null;
};
