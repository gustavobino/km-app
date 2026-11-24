/**
 * Tiny Markdown subset for the legal pages (headings, quotes, lists, tables,
 * paragraphs, **bold** and [links](/x)). Enough for legal/*.md, no dependency.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "h1" | "h2"; text: string }
  | { type: "quote"; content: Inline[] }
  | { type: "p"; content: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] };

export function inline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last)
      out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "bold", text: m[1] });
    else out.push({ type: "link", text: m[2]!, href: m[3]! });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => inline(c.trim()));

export function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith("> ")) {
      blocks.push({ type: "quote", content: inline(line.slice(2).trim()) });
      i++;
    } else if (line.startsWith("- ")) {
      const items: Inline[][] = [];
      while (i < lines.length && lines[i]!.startsWith("- "))
        items.push(inline(lines[i++]!.slice(2).trim()));
      blocks.push({ type: "ul", items });
    } else if (line.startsWith("|")) {
      const head = cells(line);
      i += 2; // header + separator
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i]!.startsWith("|"))
        rows.push(cells(lines[i++]!));
      blocks.push({ type: "table", head, rows });
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        !/^(#|> |- |\|)/.test(lines[i]!)
      )
        para.push(lines[i++]!.trim());
      blocks.push({ type: "p", content: inline(para.join(" ")) });
    }
  }
  return blocks;
}

/** Replaces {{KEY}} placeholders; unknown keys become "[a definir]". */
export function fillTemplate(
  text: string,
  values: Record<string, string | undefined>,
): string {
  return text.replace(
    /\{\{([A-Z_]+)\}\}/g,
    (_, key: string) => values[key]?.trim() || "[a definir]",
  );
}
