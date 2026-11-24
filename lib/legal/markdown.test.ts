import { describe, expect, it } from "vitest";
import { fillTemplate, inline, parse } from "./markdown";

describe("legal markdown", () => {
  it("parses inline bold and links", () => {
    expect(inline("Veja a **Política** e [os termos](/termos).")).toEqual([
      { type: "text", text: "Veja a " },
      { type: "bold", text: "Política" },
      { type: "text", text: " e " },
      { type: "link", text: "os termos", href: "/termos" },
      { type: "text", text: "." },
    ]);
  });

  it("parses the block types used in legal/", () => {
    const md =
      "# Título\n\n> **RASCUNHO**\n\nLinha um\nlinha dois.\n\n## Seção\n\n- a\n- **b**\n\n| A | B |\n|---|---|\n| 1 | **2** |\n| 3 | 4 |\n";
    expect(parse(md)).toEqual([
      { type: "h1", text: "Título" },
      { type: "quote", content: [{ type: "bold", text: "RASCUNHO" }] },
      { type: "p", content: [{ type: "text", text: "Linha um linha dois." }] },
      { type: "h2", text: "Seção" },
      {
        type: "ul",
        items: [[{ type: "text", text: "a" }], [{ type: "bold", text: "b" }]],
      },
      {
        type: "table",
        head: [[{ type: "text", text: "A" }], [{ type: "text", text: "B" }]],
        rows: [
          [[{ type: "text", text: "1" }], [{ type: "bold", text: "2" }]],
          [[{ type: "text", text: "3" }], [{ type: "text", text: "4" }]],
        ],
      },
    ]);
  });

  it("fills placeholders and flags missing ones", () => {
    expect(fillTemplate("{{A}} e {{B}} e {{C}}", { A: "x", B: " " })).toBe(
      "x e [a definir] e [a definir]",
    );
  });
});
