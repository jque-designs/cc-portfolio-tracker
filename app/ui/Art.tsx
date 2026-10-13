"use client";
import { useState } from "react";
import type { ValuedItem } from "@/lib/types";
import { Pokeball, StarBall } from "./icons";
import { gradeText, kindOf } from "./model";
import { Sash } from "./Stripes";

/**
 * The item's photo over a typeset placeholder (grade, set code or initials). The placeholder
 * shows while the photo loads and stays if there is no photo or it fails.
 */
export function Art({ item, size = "card" }: { item: ValuedItem; size?: "card" | "thumb" | "sheet" }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const tryImage = item.image && state !== "failed";
  return (
    <>
      {state !== "ok" && <Placeholder item={item} size={size} />}
      {tryImage && (
        <img
          src={item.image!}
          alt=""
          loading="lazy"
          decoding="async"
          className={state === "ok" ? "is-loaded" : "is-loading"}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
        />
      )}
    </>
  );
}

function Placeholder({ item, size }: { item: ValuedItem; size: "card" | "thumb" | "sheet" }) {
  const k = kindOf(item);
  let big: string;
  let small: string;
  if (k === "graded") {
    big = gradeText(item) || "—";
    small = item.gradingCompany ?? "Graded";
  } else if (k === "sealed") {
    big = item.productCode ?? item.format ?? "Box";
    small = item.format ? `Sealed ${item.format}` : "Sealed";
  } else {
    big = item.itemName
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    small = item.type ?? "Item";
  }
  return (
    <span className={`ph ph-${size}`} aria-hidden>
      {size !== "thumb" && (
        <svg className="ph-sash" viewBox="0 0 100 100" preserveAspectRatio="xMaxYMin slice">
          <Sash from={58} gap={7} />
        </svg>
      )}
      <span className="ph-stack">
        <span className="ph-mono">{big}</span>
        {size !== "thumb" && <span className="ph-sub">{small}</span>}
      </span>
    </span>
  );
}

const CAT_TEXT: [RegExp, string][] = [
  [/one piece/i, "OP"],
  [/magic/i, "MTG"],
  [/yu-?gi/i, "YGO"],
  [/lorcana/i, "LOR"],
  [/comic/i, "CB"],
  [/sport|baseball|basketball|football|soccer/i, "SP"],
];

export function CategoryBadge({ category }: { category: string | null }) {
  const c = category ?? "";
  let inner: React.ReactNode;
  if (/pok/i.test(c)) inner = <Pokeball />;
  else if (/dragon/i.test(c)) inner = <StarBall />;
  else inner = CAT_TEXT.find(([re]) => re.test(c))?.[1] ?? (c.slice(0, 2).toUpperCase() || "··");
  return (
    <span className="badge-cat" title={c || undefined}>
      {inner}
    </span>
  );
}
