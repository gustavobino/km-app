"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";

export function DevControls() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");
  const [on, setOn] = useState(true);
  return (
    <>
      <Segmented
        label="Período"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "day", label: "Hoje" },
          { value: "week", label: "Semana" },
          { value: "month", label: "Mês" },
        ]}
      />
      <Card className="flex items-center justify-between px-4 py-2">
        <span className="text-[15px] font-extrabold">Modo veículo</span>
        <Switch checked={on} onChange={setOn} label="Modo veículo" />
      </Card>
    </>
  );
}
