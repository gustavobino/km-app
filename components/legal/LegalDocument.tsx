import Link from "next/link";
import type { Block, Inline } from "@/lib/legal/markdown";

function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.type === "bold" ? (
          <strong key={i} className="font-extrabold">
            {p.text}
          </strong>
        ) : p.type === "link" ? (
          <Link
            key={i}
            href={p.href}
            className="font-bold underline underline-offset-2"
          >
            {p.text}
          </Link>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function LegalDocument({ blocks }: { blocks: Block[] }) {
  return (
    <article className="flex flex-col gap-3 text-[15px] leading-relaxed font-medium">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h1":
            return (
              <h1
                key={i}
                className="font-display text-[28px] leading-[1.15] font-extrabold"
              >
                {b.text}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={i}
                className="mt-3 font-display text-[19px] leading-snug font-extrabold"
              >
                {b.text}
              </h2>
            );
          case "quote":
            return (
              <p
                key={i}
                className="rounded-card bg-lime px-4 py-3 text-[14px] font-bold"
              >
                <Text parts={b.content} />
              </p>
            );
          case "p":
            return (
              <p key={i}>
                <Text parts={b.content} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Text parts={it} />
                  </li>
                ))}
              </ul>
            );
          case "table":
            return (
              <div
                key={i}
                className="overflow-x-auto rounded-card border border-border bg-surface"
              >
                <table className="w-full text-left text-[14px]">
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="border-b border-divider px-3 py-2 font-extrabold"
                        >
                          <Text parts={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td
                            key={k}
                            className="border-t border-divider px-3 py-2 align-top"
                          >
                            <Text parts={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </article>
  );
}
