"use client";

import { useEffect, useRef } from "react";

type Command = "bold" | "italic" | "insertUnorderedList" | "insertOrderedList" | "undo" | "redo" | "removeFormat" | "formatBlock";

function safeHtml(value: string) {
  return value
    .replace(/<\/?(script|style|iframe|object|embed)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function RichTextEditor({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = safeHtml(value);
  }, [value]);
  function command(commandName: Command, commandValue?: string) {
    ref.current?.focus();
    document.execCommand(commandName, false, commandValue);
    onChange(safeHtml(ref.current?.innerHTML ?? ""));
  }
  function addLink() {
    const href = window.prompt("Link URL (https://…)")?.trim();
    if (href && /^https?:\/\//i.test(href)) command("createLink" as Command, href);
  }
  return <div className="block text-sm font-semibold">
    <span>{label}</span>
    <div className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-[#D9E0EA] bg-[#F8FAFC] p-2" aria-label={`${label} formatting`}>
      <button disabled={disabled} type="button" onClick={() => command("formatBlock", "p")}>Paragraph</button>
      <button disabled={disabled} type="button" onClick={() => command("formatBlock", "h2")}>H2</button>
      <button disabled={disabled} type="button" onClick={() => command("formatBlock", "h3")}>H3</button>
      <button disabled={disabled} type="button" onClick={() => command("formatBlock", "h4")}>H4</button>
      <button disabled={disabled} type="button" onClick={() => command("bold")}><strong>B</strong></button>
      <button disabled={disabled} type="button" onClick={() => command("italic")}><em>I</em></button>
      <button disabled={disabled} type="button" onClick={() => command("insertUnorderedList")}>Bullets</button>
      <button disabled={disabled} type="button" onClick={() => command("insertOrderedList")}>Numbered</button>
      <button disabled={disabled} type="button" onClick={addLink}>Link</button>
      <button disabled={disabled} type="button" onClick={() => command("undo")}>Undo</button>
      <button disabled={disabled} type="button" onClick={() => command("redo")}>Redo</button>
      <button disabled={disabled} type="button" onClick={() => command("removeFormat")}>Clear</button>
    </div>
    <div ref={ref} role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning onInput={(event) => { if (!disabled) onChange(safeHtml(event.currentTarget.innerHTML)); }} className="min-h-36 w-full rounded-b-xl border border-[#D9E0EA] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF] disabled:cursor-not-allowed" />
  </div>;
}
