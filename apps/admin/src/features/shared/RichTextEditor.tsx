'use client';

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MediaPickerDialog } from '@/features/catalog/editorial/MediaPickerDialog';
import type { EditorialMedia } from '@/features/catalog/catalog.types';
import {
  findVariableTrigger,
  type DynamicVariable,
  type VariableTrigger,
} from './variable-autocomplete';
import { VariableSuggestionMenu } from './VariableSuggestionMenu';

type Command =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'formatBlock'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'undo'
  | 'redo'
  | 'unlink'
  | 'delete'
  | 'createLink';

type ToolbarCommand = {
  name: string;
  label: string;
  command?: Command;
  value?: string;
  action?: 'link';
};
type Picker = { range: Range; trigger: VariableTrigger; activeIndex: number };

const TOOLBAR_COMMANDS: ToolbarCommand[] = [
  { name: 'Paragraph', label: 'Paragraph', command: 'formatBlock', value: 'p' },
  { name: 'H2', label: 'H2', command: 'formatBlock', value: 'h2' },
  { name: 'H3', label: 'H3', command: 'formatBlock', value: 'h3' },
  { name: 'H4', label: 'H4', command: 'formatBlock', value: 'h4' },
  { name: 'Bold', label: 'B', command: 'bold' },
  { name: 'Italic', label: 'I', command: 'italic' },
  { name: 'Underline', label: 'U', command: 'underline' },
  { name: 'Strikethrough', label: 'S', command: 'strikeThrough' },
  { name: 'Bulleted list', label: 'Bullets', command: 'insertUnorderedList' },
  { name: 'Numbered list', label: 'Numbered', command: 'insertOrderedList' },
  { name: 'Blockquote', label: 'Quote', command: 'formatBlock', value: 'blockquote' },
  { name: 'Align left', label: 'Left', command: 'justifyLeft' },
  { name: 'Align center', label: 'Center', command: 'justifyCenter' },
  { name: 'Align right', label: 'Right', command: 'justifyRight' },
  { name: 'Add link', label: 'Link', action: 'link' },
  { name: 'Remove link', label: 'Unlink', command: 'unlink' },
  { name: 'Undo', label: 'Undo', command: 'undo' },
  { name: 'Redo', label: 'Redo', command: 'redo' },
];

const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul',
  'ol', 'li', 'a', 'blockquote', 'hr', 'br', 'img',
]);

export type RichTextEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  allowedVariables?: readonly DynamicVariable[];
  enableImages?: boolean;
  media?: EditorialMedia[];
  minHeight?: string;
  ariaLabel?: string;
  placeholder?: string;
  hideLabel?: boolean;
};

/** Shared Admin WYSIWYG. It stores portable, sanitized HTML rather than editor JSON. */
export function RichTextEditor({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  allowedVariables = [],
  enableImages = true,
  media = [],
  minHeight = 'min-h-36',
  ariaLabel,
  placeholder,
  hideLabel = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const isDisabled = disabled || readOnly;
  const visibleVariables = useMemo(() => {
    const query = picker?.trigger.query.trim().toLowerCase() ?? '';
    return allowedVariables.filter(
      (variable) =>
        !query ||
        variable.key.toLowerCase().includes(query) ||
        variable.label.toLowerCase().includes(query),
    );
  }, [allowedVariables, picker?.trigger.query]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = sanitizeEditorHtml(value);
  }, [value]);

  function emit() {
    const editor = editorRef.current;
    if (editor) onChange(sanitizeEditorHtml(editor.innerHTML));
  }

  function rememberSelection() {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (selection?.rangeCount && editor?.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function command(name: Command, commandValue?: string) {
    if (isDisabled) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(name, false, commandValue);
    rememberSelection();
    emit();
  }

  function addLink() {
    const href = window.prompt('Link URL (https://… or /path)')?.trim();
    if (!href || !safeHref(href)) return;
    command('createLink', href);
  }

  function runToolbarAction(action: ToolbarCommand) {
    if (action.action === 'link') {
      addLink();
    } else if (action.command) {
      command(action.command, action.value);
    }
  }

  function insertImage(item: EditorialMedia) {
    if (isDisabled || !safeImageUrl(item.url)) return;
    editorRef.current?.focus();
    restoreSelection();
    const alt = escapeAttribute(item.alt || item.title || '');
    document.execCommand(
      'insertHTML',
      false,
      `<img src="${escapeAttribute(item.url)}" alt="${alt}">`,
    );
    rememberSelection();
    emit();
  }

  function onInput() {
    rememberSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.anchorNode || selection.anchorNode.nodeType !== Node.TEXT_NODE) {
      setPicker(null);
      emit();
      return;
    }

    const prefix = selection.anchorNode.textContent?.slice(0, selection.anchorOffset) ?? '';
    const trigger = findVariableTrigger(prefix, prefix.length);
    if (!trigger || !allowedVariables.length) {
      setPicker(null);
      emit();
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    range.setStart(selection.anchorNode, Math.max(0, selection.anchorOffset - (trigger.end - trigger.start)));
    setPicker({ range, trigger, activeIndex: 0 });
    emit();
  }

  function insertVariable(variable: DynamicVariable) {
    if (!picker || isDisabled) return;
    const text = document.createTextNode(`{${variable.key}}`);
    picker.range.deleteContents();
    picker.range.insertNode(text);
    const next = document.createRange();
    next.setStartAfter(text);
    next.collapse(true);
    selectionRef.current = next;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(next);
    setPicker(null);
    editorRef.current?.focus();
    emit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!picker) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setPicker(null);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visibleVariables.length) return;
      const by = event.key === 'ArrowDown' ? 1 : -1;
      setPicker((current) => current ? {
        ...current,
        activeIndex: (current.activeIndex + by + visibleVariables.length) % visibleVariables.length,
      } : null);
      return;
    }
    if (event.key === 'Enter') {
      const variable = visibleVariables[picker.activeIndex];
      if (variable) {
        event.preventDefault();
        insertVariable(variable);
      }
    }
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    if (isDisabled) return;
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    event.preventDefault();
    document.execCommand('insertHTML', false, html ? sanitizeEditorHtml(html) : escapeHtml(text).replace(/\n/g, '<br>'));
    rememberSelection();
    emit();
  }

  return (
    <div className="block text-sm font-semibold">
      {hideLabel ? null : <span>{label}</span>}
      <div className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-[#D9E0EA] bg-[#F8FAFC] p-2" aria-label={`${label} formatting`}>
        {TOOLBAR_COMMANDS.map((action) => (
          <button
            key={action.name}
            disabled={isDisabled}
            type="button"
            aria-label={action.name}
            title={action.name}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runToolbarAction(action)}
            className="rounded-md border border-transparent px-2.5 py-1.5 text-xs font-semibold hover:border-[#C9D7F2] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {action.label}
          </button>
        ))}
        {enableImages ? (
          <MediaPickerDialog
            label="Insert image"
            value=""
            media={media}
            onChange={() => undefined}
            onSelectMedia={(item) => insertImage(item)}
            compact
          />
        ) : null}
        <button
          disabled={isDisabled}
          type="button"
          aria-label="Remove selected image"
          title="Remove selected image"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command('delete')}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] disabled:opacity-45"
        >
          Remove image
        </button>
      </div>
      <div className="relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-label={ariaLabel ?? label}
          aria-multiline="true"
          aria-disabled={isDisabled}
          contentEditable={!isDisabled}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onPaste={paste}
          className={`${minHeight} w-full rounded-b-xl border border-[#D9E0EA] bg-white px-3 py-2.5 font-normal [font-family:var(--font-inter),Arial,sans-serif] outline-none empty:before:pointer-events-none empty:before:text-[#98A2B3] empty:before:content-[attr(data-placeholder)] focus:border-[#1657CF] focus:ring-2 focus:ring-[#DCE8FF] [&_h2]:font-[inherit] [&_h3]:font-[inherit] [&_h4]:font-[inherit] [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:font-[inherit] [&_p]:font-[inherit]`}
        />
        {picker ? (
          <VariableSuggestionMenu variables={visibleVariables} activeIndex={picker.activeIndex} onSelect={insertVariable} />
        ) : null}
      </div>
    </div>
  );
}

function safeHref(value: string) {
  return /^https:\/\//i.test(value) || /^\/(?!\/)/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value);
}

function safeImageUrl(value: string) {
  return /^https:\/\//i.test(value) || /^\/api\/v1\/media\//.test(value) || /^\/media\//.test(value);
}

function escapeAttribute(value: string) {
  return value.replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

export function sanitizeEditorHtml(value: string) {
  return value
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?[^>]+>/g, (tag) => {
      const match = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!match || !ALLOWED_TAGS.has(match[2].toLowerCase())) return '';

      const closing = match[1] === '/';
      const name = match[2].toLowerCase();
      if (closing || !['a', 'img'].includes(name)) return `<${closing ? '/' : ''}${name}>`;
      if (name === 'a') {
        const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
        return safeHref(href) ? `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">` : '<a>';
      }

      const src = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      const alt = tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      return safeImageUrl(src) ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">` : '';
    });
}
