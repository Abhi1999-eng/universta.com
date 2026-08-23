'use client';

import {
  type ClipboardEvent,
  type KeyboardEvent,
  useCallback,
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
  group: 'block' | 'inline' | 'list' | 'align' | 'link' | 'history';
  toggle?: boolean;
};
type Picker = { range: Range; trigger: VariableTrigger; activeIndex: number };
type ToolbarState = {
  block: 'p' | 'h2' | 'h3' | 'h4' | 'blockquote';
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  unorderedList: boolean;
  orderedList: boolean;
  alignment: 'left' | 'center' | 'right';
  link: boolean;
  imageSelected: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

const EMPTY_TOOLBAR_STATE: ToolbarState = {
  block: 'p',
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  unorderedList: false,
  orderedList: false,
  alignment: 'left',
  link: false,
  imageSelected: false,
  canUndo: false,
  canRedo: false,
};

const TOOLBAR_COMMANDS: ToolbarCommand[] = [
  { name: 'Paragraph', label: 'Paragraph', command: 'formatBlock', value: 'p', group: 'block', toggle: true },
  { name: 'H2', label: 'H2', command: 'formatBlock', value: 'h2', group: 'block', toggle: true },
  { name: 'H3', label: 'H3', command: 'formatBlock', value: 'h3', group: 'block', toggle: true },
  { name: 'H4', label: 'H4', command: 'formatBlock', value: 'h4', group: 'block', toggle: true },
  { name: 'Bold', label: 'B', command: 'bold', group: 'inline', toggle: true },
  { name: 'Italic', label: 'I', command: 'italic', group: 'inline', toggle: true },
  { name: 'Underline', label: 'U', command: 'underline', group: 'inline', toggle: true },
  { name: 'Strikethrough', label: 'S', command: 'strikeThrough', group: 'inline', toggle: true },
  { name: 'Bulleted list', label: 'Bullets', command: 'insertUnorderedList', group: 'list', toggle: true },
  { name: 'Numbered list', label: 'Numbered', command: 'insertOrderedList', group: 'list', toggle: true },
  { name: 'Blockquote', label: 'Quote', command: 'formatBlock', value: 'blockquote', group: 'list', toggle: true },
  { name: 'Align left', label: 'Left', command: 'justifyLeft', group: 'align', toggle: true },
  { name: 'Align center', label: 'Center', command: 'justifyCenter', group: 'align', toggle: true },
  { name: 'Align right', label: 'Right', command: 'justifyRight', group: 'align', toggle: true },
  { name: 'Add link', label: 'Link', action: 'link', group: 'link', toggle: true },
  { name: 'Remove link', label: 'Unlink', command: 'unlink', group: 'link' },
  { name: 'Undo', label: 'Undo', command: 'undo', group: 'history' },
  { name: 'Redo', label: 'Redo', command: 'redo', group: 'history' },
];

const ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul',
  'ol', 'li', 'a', 'blockquote', 'hr', 'br', 'img',
]);
const ALIGNED_BLOCK_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote']);

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
  const [toolbarState, setToolbarState] = useState<ToolbarState>(EMPTY_TOOLBAR_STATE);
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

  const refreshToolbarState = useCallback(() => {
    const editor = editorRef.current;
    const range = currentEditorRange(editor);
    if (!editor || !range) {
      setToolbarState((current) => sameToolbarState(current, EMPTY_TOOLBAR_STATE) ? current : EMPTY_TOOLBAR_STATE);
      return;
    }

    const ancestors = selectionAncestors(range, editor);
    const block = currentBlock(ancestors);
    const alignment = commandIsActive('justifyCenter')
      ? 'center'
      : commandIsActive('justifyRight')
        ? 'right'
        : commandIsActive('justifyLeft')
          ? 'left'
          : currentAlignment(ancestors);
    const next: ToolbarState = {
      block,
      bold: commandIsActive('bold') || hasTag(ancestors, 'strong', 'b'),
      italic: commandIsActive('italic') || hasTag(ancestors, 'em', 'i'),
      underline: commandIsActive('underline') || hasTag(ancestors, 'u'),
      strikeThrough: commandIsActive('strikeThrough') || hasTag(ancestors, 's', 'strike'),
      unorderedList: commandIsActive('insertUnorderedList') || hasTag(ancestors, 'ul'),
      orderedList: commandIsActive('insertOrderedList') || hasTag(ancestors, 'ol'),
      alignment,
      link: hasTag(ancestors, 'a'),
      imageSelected: selectedImage(range, editor),
      canUndo: commandIsEnabled('undo'),
      canRedo: commandIsEnabled('redo'),
    };
    setToolbarState((current) => sameToolbarState(current, next) ? current : next);
  }, []);

  useEffect(() => {
    const onSelectionChange = () => refreshToolbarState();
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [refreshToolbarState]);

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
    refreshToolbarState();
  }

  function restoreSelection() {
    const selection = window.getSelection();
    const range = selectionRef.current;
    if (!range || !selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function command(name: Command, commandValue?: string) {
    if (isDisabled || !canRunCommand(name, toolbarState)) return;
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
    if (actionDisabled(action, isDisabled, toolbarState)) return;
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
      refreshToolbarState();
      return;
    }

    const prefix = selection.anchorNode.textContent?.slice(0, selection.anchorOffset) ?? '';
    const trigger = findVariableTrigger(prefix, prefix.length);
    if (!trigger || !allowedVariables.length) {
      setPicker(null);
      emit();
      refreshToolbarState();
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();
    range.setStart(selection.anchorNode, Math.max(0, selection.anchorOffset - (trigger.end - trigger.start)));
    setPicker({ range, trigger, activeIndex: 0 });
    emit();
    refreshToolbarState();
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
    refreshToolbarState();
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
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-t-xl border border-b-0 border-[#D9E0EA] bg-[#F8FAFC] p-2" aria-label={`${label} formatting`}>
        {(['block', 'inline', 'list', 'align', 'link', 'history'] as const).map((group) => (
          <div key={group} className="flex flex-wrap items-center gap-1 border-r border-[#D9E0EA] pr-2 last:border-r-0 last:pr-0" role="group" aria-label={`${group} formatting`}>
            {TOOLBAR_COMMANDS.filter((action) => action.group === group).map((action) => {
              const active = actionIsActive(action, toolbarState);
              return <button
                key={action.name}
                disabled={actionDisabled(action, isDisabled, toolbarState)}
                type="button"
                aria-label={action.name}
                aria-pressed={action.toggle ? active : undefined}
                title={action.name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runToolbarAction(action)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-[#98A2B3] disabled:opacity-100 ${active ? 'border-[#9DBBFA] bg-[#EAF1FF] text-[#1249AC]' : 'border-transparent text-[#344054] hover:border-[#C9D7F2] hover:bg-white'}`}
              >
                {action.label}
              </button>;
            })}
          </div>
        ))}
        {enableImages ? (
          <div className="flex items-center gap-1" role="group" aria-label="Media formatting">
            <MediaPickerDialog
              label="Insert image"
              value=""
              media={media}
              onChange={() => undefined}
              onSelectMedia={(item) => insertImage(item)}
              compact
              disabled={isDisabled}
            />
            <button
              disabled={isDisabled || !toolbarState.imageSelected}
              type="button"
              aria-label="Remove selected image"
              title="Remove selected image"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command('delete')}
              className="rounded-md border border-transparent px-2.5 py-1.5 text-xs font-semibold text-[#344054] transition-colors hover:border-[#C9D7F2] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1657CF] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-[#98A2B3] disabled:opacity-100"
            >
              Remove image
            </button>
          </div>
        ) : null}
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

function currentEditorRange(editor: HTMLDivElement | null) {
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range : null;
}

function selectionAncestors(range: Range, editor: HTMLDivElement) {
  const elements: HTMLElement[] = [];
  let node: Node | null = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  while (node && node !== editor) {
    if (node instanceof HTMLElement) elements.push(node);
    node = node.parentNode;
  }
  return elements;
}

function hasTag(ancestors: HTMLElement[], ...tags: string[]) {
  return ancestors.some((element) => tags.includes(element.tagName.toLowerCase()));
}

function currentBlock(ancestors: HTMLElement[]): ToolbarState['block'] {
  const element = ancestors.find((item) => ['p', 'h2', 'h3', 'h4', 'blockquote'].includes(item.tagName.toLowerCase()));
  return (element?.tagName.toLowerCase() as ToolbarState['block'] | undefined) ?? 'p';
}

function currentAlignment(ancestors: HTMLElement[]): ToolbarState['alignment'] {
  const aligned = ancestors.find((element) => ['left', 'center', 'right'].includes(element.style.textAlign));
  return (aligned?.style.textAlign as ToolbarState['alignment'] | undefined) ?? 'left';
}

function commandIsActive(command: Command) {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function commandIsEnabled(command: 'undo' | 'redo') {
  try {
    return document.queryCommandEnabled(command);
  } catch {
    return false;
  }
}

function selectedImage(range: Range, editor: HTMLDivElement) {
  const directImage = range.startContainer.nodeType === Node.ELEMENT_NODE && range.startContainer instanceof HTMLImageElement
    ? range.startContainer
    : range.startContainer.parentElement?.closest('img');
  if (directImage && editor.contains(directImage)) return true;
  if (range.collapsed) return false;
  return Array.from(editor.querySelectorAll('img')).some((image) => range.intersectsNode(image));
}

function actionIsActive(action: ToolbarCommand, state: ToolbarState) {
  switch (action.name) {
    case 'Paragraph': return state.block === 'p';
    case 'H2': return state.block === 'h2';
    case 'H3': return state.block === 'h3';
    case 'H4': return state.block === 'h4';
    case 'Bold': return state.bold;
    case 'Italic': return state.italic;
    case 'Underline': return state.underline;
    case 'Strikethrough': return state.strikeThrough;
    case 'Bulleted list': return state.unorderedList;
    case 'Numbered list': return state.orderedList;
    case 'Blockquote': return state.block === 'blockquote';
    case 'Align left': return state.alignment === 'left';
    case 'Align center': return state.alignment === 'center';
    case 'Align right': return state.alignment === 'right';
    case 'Add link': return state.link;
    default: return false;
  }
}

function actionDisabled(action: ToolbarCommand, disabled: boolean, state: ToolbarState) {
  if (disabled) return true;
  if (action.name === 'Undo') return !state.canUndo;
  if (action.name === 'Redo') return !state.canRedo;
  if (action.name === 'Remove link') return !state.link;
  return false;
}

function canRunCommand(command: Command, state: ToolbarState) {
  if (command === 'unlink') return state.link;
  if (command === 'delete') return state.imageSelected;
  if (command === 'undo') return state.canUndo;
  if (command === 'redo') return state.canRedo;
  return true;
}

function sameToolbarState(a: ToolbarState, b: ToolbarState) {
  return Object.keys(a).every((key) => a[key as keyof ToolbarState] === b[key as keyof ToolbarState]);
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
      if (closing) return `</${name}>`;
      if (ALIGNED_BLOCK_TAGS.has(name)) {
        const alignment = safeAlignment(tag);
        return alignment ? `<${name} style="text-align: ${alignment}">` : `<${name}>`;
      }
      if (!['a', 'img'].includes(name)) return `<${name}>`;
      if (name === 'a') {
        const href = tag.match(/\shref\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
        return safeHref(href) ? `<a href="${escapeAttribute(href)}" rel="noopener noreferrer">` : '<a>';
      }

      const src = tag.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      const alt = tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      return safeImageUrl(src) ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">` : '';
    });
}

function safeAlignment(tag: string) {
  const style = tag.match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  const alignment = style.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right)\s*(?:;|$)/i)?.[1]?.toLowerCase();
  return alignment === 'left' || alignment === 'center' || alignment === 'right' ? alignment : null;
}
