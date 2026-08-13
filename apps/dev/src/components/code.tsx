'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ============================ Coloration syntaxique ============================ */
type Rule = { type: string; re: RegExp };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CLIKE = (kw: string[], cst: string[]): Rule[] => [
  { type: 'comment', re: /\/\*[\s\S]*?\*\//y },
  { type: 'comment', re: /\/\/[^\n]*/y },
  { type: 'string', re: /`(?:\\.|[^`\\])*`/y },
  { type: 'string', re: /"(?:\\.|[^"\\])*"/y },
  { type: 'string', re: /'(?:\\.|[^'\\])*'/y },
  { type: 'number', re: /\b0x[\da-fA-F]+\b|\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b/y },
  { type: 'keyword', re: new RegExp('\\b(?:' + kw.join('|') + ')\\b', 'y') },
  { type: 'const', re: new RegExp('\\b(?:' + cst.join('|') + ')\\b', 'y') },
  { type: 'func', re: /\b[A-Za-z_$][\w$]*(?=\s*\()/y },
  { type: '', re: /\b[A-Za-z_$][\w$]*\b/y },
  { type: 'punct', re: /[+\-*/%=<>!&|^~?:;.,(){}[\]]/y },
];

const JS_KW = [
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'in',
  'of',
  'class',
  'extends',
  'super',
  'import',
  'export',
  'from',
  'as',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'async',
  'await',
  'yield',
  'void',
  'with',
  'static',
  'get',
  'set',
  'public',
  'private',
  'protected',
  'readonly',
  'interface',
  'type',
  'enum',
  'implements',
  'namespace',
  'declare',
  'abstract',
  'satisfies',
  'keyof',
  'infer',
];
const JS_CST = [
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'this',
  'arguments',
  'globalThis',
];
const C_KW = [
  'int',
  'long',
  'short',
  'char',
  'float',
  'double',
  'void',
  'bool',
  'unsigned',
  'signed',
  'struct',
  'enum',
  'union',
  'typedef',
  'const',
  'static',
  'extern',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'goto',
  'sizeof',
  'class',
  'public',
  'private',
  'protected',
  'namespace',
  'template',
  'new',
  'delete',
  'this',
  'using',
  'try',
  'catch',
  'throw',
  'virtual',
  'override',
  'func',
  'package',
  'import',
  'var',
  'fn',
  'let',
  'mut',
  'pub',
  'impl',
  'trait',
  'match',
  'defer',
  'go',
];

const LANGS: Record<string, { label: string; ext: string[]; rules: Rule[] }> = {
  text: { label: 'Texte', ext: ['txt', 'log', 'env', 'gitignore', 'conf'], rules: [] },
  js: {
    label: 'JavaScript / TypeScript',
    ext: ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx'],
    rules: CLIKE(JS_KW, JS_CST),
  },
  clike: {
    label: 'C / Java / Go / Rust',
    ext: ['c', 'h', 'cpp', 'hpp', 'cc', 'java', 'go', 'rs', 'php', 'cs', 'swift', 'kt'],
    rules: CLIKE(C_KW, ['true', 'false', 'null', 'nil', 'NULL', 'None', 'self', 'this']),
  },
  py: {
    label: 'Python',
    ext: ['py', 'pyw'],
    rules: [
      { type: 'comment', re: /#[^\n]*/y },
      { type: 'string', re: /"""[\s\S]*?"""|'''[\s\S]*?'''/y },
      { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
      { type: 'number', re: /\b\d[\d_]*\.?\d*\b/y },
      {
        type: 'keyword',
        re: /\b(?:def|class|import|from|return|if|elif|else|for|while|with|as|try|except|finally|raise|lambda|yield|pass|break|continue|global|nonlocal|assert|del|in|not|and|or|is|async|await|match|case)\b/y,
      },
      { type: 'const', re: /\b(?:True|False|None|self|cls)\b/y },
      { type: 'func', re: /\b[A-Za-z_]\w*(?=\s*\()/y },
      { type: '', re: /\b[A-Za-z_]\w*\b/y },
      { type: 'punct', re: /[+\-*/%=<>!&|^~?:;.,(){}[\]]/y },
    ],
  },
  sh: {
    label: 'Shell',
    ext: ['sh', 'bash', 'zsh', 'fish'],
    rules: [
      { type: 'comment', re: /#[^\n]*/y },
      { type: 'string', re: /"(?:\\.|[^"\\])*"|'[^']*'/y },
      { type: 'const', re: /\$\{?[\w@#?*]+\}?/y },
      {
        type: 'keyword',
        re: /\b(?:if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|return|export|local|source|set|unset|read|exit|shift|trap)\b/y,
      },
      {
        type: 'func',
        re: /\b(?:echo|cd|ls|cat|grep|sed|awk|curl|wget|docker|git|npm|sudo|rm|cp|mv|mkdir|chmod|chown)\b/y,
      },
      { type: 'number', re: /\b\d+\b/y },
      { type: 'punct', re: /[|&;()<>]/y },
    ],
  },
  json: {
    label: 'JSON',
    ext: ['json', 'jsonc', 'webmanifest'],
    rules: [
      { type: 'prop', re: /"(?:\\.|[^"\\])*"(?=\s*:)/y },
      { type: 'string', re: /"(?:\\.|[^"\\])*"/y },
      { type: 'number', re: /-?\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?\b/y },
      { type: 'const', re: /\b(?:true|false|null)\b/y },
      { type: 'punct', re: /[{}[\]:,]/y },
    ],
  },
  css: {
    label: 'CSS',
    ext: ['css', 'scss', 'sass', 'less'],
    rules: [
      { type: 'comment', re: /\/\*[\s\S]*?\*\//y },
      { type: 'string', re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
      { type: 'keyword', re: /@[\w-]+/y },
      { type: 'number', re: /#[0-9a-fA-F]{3,8}\b/y },
      {
        type: 'number',
        re: /-?\b\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|pt|ex|ch)?\b/y,
      },
      { type: 'prop', re: /[A-Za-z-]+(?=\s*:)/y },
      { type: 'func', re: /\b[A-Za-z-]+(?=\s*\()/y },
      { type: 'const', re: /[.#][A-Za-z_][\w-]*/y },
      { type: 'punct', re: /[{}:;,()]/y },
    ],
  },
  html: {
    label: 'HTML / XML',
    ext: ['html', 'htm', 'xml', 'svg', 'vue', 'xhtml'],
    rules: [
      { type: 'comment', re: /<!--[\s\S]*?-->/y },
      { type: 'string', re: /"[^"]*"|'[^']*'/y },
      { type: 'tag', re: /<\/?[A-Za-z][\w:-]*/y },
      { type: 'tag', re: /\/?>/y },
      { type: 'attr', re: /[A-Za-z_:][\w:.-]*(?=\s*=)/y },
      { type: 'punct', re: /=/y },
    ],
  },
  md: {
    label: 'Markdown',
    ext: ['md', 'markdown', 'mdx'],
    rules: [
      { type: 'comment', re: /<!--[\s\S]*?-->/y },
      { type: 'string', re: /```[\s\S]*?```/y },
      { type: 'string', re: /`[^`\n]+`/y },
      { type: 'heading', re: /#{1,6}[ \t]+[^\n]*/y },
      { type: 'strong', re: /\*\*[^*\n]+\*\*|__[^_\n]+__/y },
      { type: 'func', re: /\[[^\]\n]+\]\([^)\n]+\)/y },
    ],
  },
};

function langOf(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const [k, v] of Object.entries(LANGS)) if (v.ext.includes(ext)) return k;
  return 'text';
}

function highlight(code: string, langKey: string): string {
  const rules = LANGS[langKey]?.rules ?? [];
  if (!rules.length) return esc(code);
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    let matched = false;
    for (const r of rules) {
      r.re.lastIndex = i;
      const m = r.re.exec(code);
      if (m && m[0].length) {
        const t = m[0];
        out += r.type ? `<span class="t-${r.type}">${esc(t)}</span>` : esc(t);
        i += t.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += esc(code[i]!);
      i++;
    }
  }
  return out;
}

/* ============================ Thèmes ============================ */
type ThemeName = 'dark' | 'light';
interface Palette {
  chrome: string;
  panel: string;
  editor: string;
  text: string;
  muted: string;
  border: string;
  tabActive: string;
  tabActiveText: string;
  tabText: string;
  gutter: string;
  activeLine: string;
  caret: string;
  inputBg: string;
  hover: string;
}
const THEMES: Record<ThemeName, Palette> = {
  dark: {
    chrome: '#21252b',
    panel: '#23272e',
    editor: '#282c34',
    text: '#abb2bf',
    muted: '#8a8f99',
    border: '#181a1f',
    tabActive: '#282c34',
    tabActiveText: '#ffffff',
    tabText: '#8a8f99',
    gutter: '#5c6370',
    activeLine: 'rgba(255,255,255,0.045)',
    caret: '#e6e6e6',
    inputBg: '#1b1e24',
    hover: 'rgba(255,255,255,0.06)',
  },
  light: {
    chrome: '#f3f4f6',
    panel: '#f7f8fa',
    editor: '#ffffff',
    text: '#383a42',
    muted: '#6b7280',
    border: '#e5e7eb',
    tabActive: '#ffffff',
    tabActiveText: '#111827',
    tabText: '#6b7280',
    gutter: '#b6bac2',
    activeLine: 'rgba(0,0,0,0.04)',
    caret: '#111827',
    inputBg: '#ffffff',
    hover: 'rgba(0,0,0,0.05)',
  },
};
const THEME_CSS = `
.ide-dark .t-comment{color:#7d8590;font-style:italic}.ide-dark .t-string{color:#98c379}.ide-dark .t-number{color:#d19a66}.ide-dark .t-keyword{color:#c678dd}.ide-dark .t-const{color:#56b6c2}.ide-dark .t-func{color:#61afef}.ide-dark .t-tag{color:#e06c75}.ide-dark .t-attr{color:#d19a66}.ide-dark .t-prop{color:#61afef}.ide-dark .t-punct{color:#abb2bf}.ide-dark .t-heading{color:#e5c07b;font-weight:700}.ide-dark .t-strong{font-weight:700;color:#e6e6e6}.ide-dark .ide-ta::selection{background:#3d4351}
.ide-light .t-comment{color:#a0a1a7;font-style:italic}.ide-light .t-string{color:#50a14f}.ide-light .t-number{color:#986801}.ide-light .t-keyword{color:#a626a4}.ide-light .t-const{color:#0184bc}.ide-light .t-func{color:#4078f2}.ide-light .t-tag{color:#e45649}.ide-light .t-attr{color:#986801}.ide-light .t-prop{color:#4078f2}.ide-light .t-punct{color:#383a42}.ide-light .t-heading{color:#c18401;font-weight:700}.ide-light .t-strong{font-weight:700;color:#111}.ide-light .ide-ta::selection{background:#d7e6ff}
.ide-dark .ide-row:hover{background:rgba(255,255,255,0.06)!important}.ide-light .ide-row:hover{background:rgba(0,0,0,0.05)!important}
`;

/* ============================ Éditeur ============================ */
interface Doc {
  name: string;
  mtime: number;
  size: number;
}
interface Tab {
  key: string;
  name: string;
  content: string;
  dirty: boolean;
  saved: boolean;
  lang?: string;
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
const LH = 20;
const PAD = 12;
const FONT =
  "'JetBrains Mono','SFMono-Regular',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace";

export function CodeEditor() {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineHiRef = useRef<HTMLDivElement>(null);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([
    { key: uid(), name: 'sans-titre.txt', content: '', dirty: false, saved: false },
  ]);
  const [activeKey, setActiveKey] = useState('');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [wrap, setWrap] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('dark');
  const T = THEMES[theme];

  useEffect(() => {
    const s = typeof localStorage !== 'undefined' ? localStorage.getItem('ide-theme') : null;
    if (s === 'light' || s === 'dark') setTheme(s);
  }, []);
  const applyTheme = (t: ThemeName) => {
    setTheme(t);
    try {
      localStorage.setItem('ide-theme', t);
    } catch {
      /* */
    }
  };

  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.key === activeKey))
      setActiveKey(tabs[tabs.length - 1]!.key);
  }, [tabs, activeKey]);

  const content = active?.content ?? '';
  const lang = active?.lang ?? langOf(active?.name ?? '');
  const lineCount = useMemo(() => content.split('\n').length, [content]);
  const digits = Math.max(2, String(lineCount).length);
  const Gw = digits * 8.4 + 24;
  const highlighted = useMemo(() => highlight(content + '\n', lang), [content, lang]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'),
    [lineCount],
  );

  const refreshDocs = useCallback(() => {
    fetch('/api/code')
      .then((r) => r.json())
      .then((j) => setDocs(j.docs ?? []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshDocs();
  }, [refreshDocs]);

  /* ---- synchro scroll & ligne active ---- */
  const updateCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const upto = ta.value.slice(0, ta.selectionStart);
    const line = upto.split('\n').length;
    const col = upto.length - upto.lastIndexOf('\n');
    setCaret({ line, col });
    if (lineHiRef.current)
      lineHiRef.current.style.top = `${PAD + (line - 1) * LH - ta.scrollTop}px`;
  }, []);
  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
    updateCaret();
  }, [updateCaret]);
  useEffect(() => {
    updateCaret();
  }, [activeKey, updateCaret]);

  /* ---- édition ---- */
  const setContent = (v: string) =>
    setTabs((ts) =>
      ts.map((t) => (t.key === active?.key ? { ...t, content: v, dirty: true, saved: false } : t)),
    );
  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    if (!document.execCommand('insertText', false, text)) {
      const s = ta.selectionStart,
        e = ta.selectionEnd;
      setContent(ta.value.slice(0, s) + text + ta.value.slice(e));
    }
  };
  const PAIRS: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    '`': '`',
  };
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveActive();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      setFindOpen(true);
      return;
    }
    if (e.key === 'Escape' && findOpen) {
      setFindOpen(false);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart,
        en = ta.selectionEnd;
      if (s !== en && ta.value.slice(s, en).includes('\n')) {
        const ls = ta.value.lastIndexOf('\n', s - 1) + 1;
        const block = ta.value.slice(ls, en);
        const next = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
        ta.setSelectionRange(ls, en);
        insert(next);
        ta.setSelectionRange(ls, ls + next.length);
      } else insert('  ');
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const s = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
      const cur = ta.value.slice(lineStart, s);
      const indent = (cur.match(/^[ \t]*/) || [''])[0];
      const extra = /[{([]$/.test(cur.trimEnd()) ? '  ' : '';
      insert('\n' + indent + extra);
      return;
    }
    if (PAIRS[e.key] && ta.selectionStart === ta.selectionEnd) {
      e.preventDefault();
      insert(e.key + PAIRS[e.key]);
      ta.setSelectionRange(ta.selectionStart - 1, ta.selectionStart - 1);
      return;
    }
  }

  /* ---- documents / onglets ---- */
  function newTab() {
    const t: Tab = { key: uid(), name: 'sans-titre.txt', content: '', dirty: false, saved: false };
    setTabs((ts) => [...ts, t]);
    setActiveKey(t.key);
  }
  async function openDoc(name: string) {
    const ex = tabs.find((t) => t.saved && t.name === name);
    if (ex) {
      setActiveKey(ex.key);
      return;
    }
    const res = await fetch(`/api/code?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .catch(() => null);
    if (!res || res.error) return;
    const t: Tab = { key: uid(), name, content: res.content ?? '', dirty: false, saved: true };
    setTabs((ts) => [...ts, t]);
    setActiveKey(t.key);
  }
  function closeTab(key: string) {
    const t = tabs.find((x) => x.key === key);
    if (t && t.dirty && !window.confirm(`Fermer « ${t.name} » sans enregistrer ?`)) return;
    setTabs((ts) => {
      const r = ts.filter((x) => x.key !== key);
      return r.length
        ? r
        : [{ key: uid(), name: 'sans-titre.txt', content: '', dirty: false, saved: false }];
    });
  }
  async function saveActive() {
    if (!active) return;
    let name = active.name;
    if (!active.saved || name === 'sans-titre.txt') {
      const nn = window.prompt(
        'Nom du fichier (avec extension, ex. app.ts) :',
        name === 'sans-titre.txt' ? 'nouveau.txt' : name,
      );
      if (!nn) return;
      name = nn.trim();
    }
    setSaving('saving');
    const res = await fetch('/api/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: active.content }),
    })
      .then((r) => r.json())
      .catch(() => null);
    if (!res || res.error) {
      alert(res?.error || 'échec');
      setSaving('idle');
      return;
    }
    setTabs((ts) =>
      ts.map((t) =>
        t.key === active.key ? { ...t, name: res.name, saved: true, dirty: false } : t,
      ),
    );
    setSaving('saved');
    refreshDocs();
    window.setTimeout(() => setSaving('idle'), 1400);
  }
  async function renameDoc(name: string) {
    const nn = window.prompt('Nouveau nom :', name);
    if (!nn || nn === name) return;
    await fetch('/api/code', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, newName: nn }),
    }).catch(() => {});
    setTabs((ts) => ts.map((t) => (t.saved && t.name === name ? { ...t, name: nn.trim() } : t)));
    refreshDocs();
  }
  async function delDoc(name: string) {
    if (!window.confirm(`Supprimer « ${name} » ?`)) return;
    await fetch(`/api/code?name=${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {});
    setTabs((ts) => ts.filter((t) => !(t.saved && t.name === name)));
    refreshDocs();
  }

  /* ---- recherche / remplacement ---- */
  function findNext(back = false) {
    const ta = taRef.current;
    if (!ta || !findText) return;
    const v = ta.value;
    let idx;
    if (back) {
      idx = v.lastIndexOf(findText, Math.max(0, ta.selectionStart - 1));
      if (idx < 0) idx = v.lastIndexOf(findText);
    } else {
      idx = v.indexOf(findText, ta.selectionEnd);
      if (idx < 0) idx = v.indexOf(findText);
    }
    if (idx < 0) return;
    ta.focus();
    ta.setSelectionRange(idx, idx + findText.length);
    const line = v.slice(0, idx).split('\n').length;
    ta.scrollTop = Math.max(0, (line - 3) * LH);
    syncScroll();
  }
  function replaceOne() {
    const ta = taRef.current;
    if (!ta || !findText) return;
    if (ta.value.slice(ta.selectionStart, ta.selectionEnd) === findText) insert(replaceText);
    findNext();
  }
  function replaceAll() {
    if (!findText || !active) return;
    setContent(active.content.split(findText).join(replaceText));
  }
  const matchCount = useMemo(
    () => (findText ? content.split(findText).length - 1 : 0),
    [findText, content],
  );
  const ext = (active?.name.split('.').pop() || '').toLowerCase();

  const chip = { background: T.inputBg, borderColor: T.border, color: T.text } as const;

  return (
    <div
      className={`ide-root ide-${theme} flex h-full min-h-0`}
      style={{ background: T.chrome, color: T.text }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          setFindOpen(true);
        }
      }}
    >
      <style>{THEME_CSS}</style>

      {/* Sidebar fichiers */}
      <aside
        className="flex w-56 shrink-0 flex-col"
        style={{ background: T.panel, borderRight: `1px solid ${T.border}` }}
      >
        <div className="flex items-center gap-1 px-3 py-2">
          <span
            className="mr-auto text-xs font-bold uppercase tracking-wider"
            style={{ color: T.muted }}
          >
            Fichiers
          </span>
          <button
            onClick={newTab}
            title="Nouveau document"
            className="rounded p-0.5"
            style={{ color: T.muted }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
          {docs.length === 0 ? (
            <p className="px-2 py-4 text-xs" style={{ color: T.muted }}>
              Aucun document
            </p>
          ) : (
            docs.map((d) => {
              const open = active?.saved && active.name === d.name;
              return (
                <div
                  key={d.name}
                  onClick={() => openDoc(d.name)}
                  className="ide-row group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                  style={{
                    background: open ? T.hover : 'transparent',
                    color: open ? T.text : T.muted,
                  }}
                >
                  <FileIcon ext={(d.name.split('.').pop() || '').toLowerCase()} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      renameDoc(d.name);
                    }}
                    title="Renommer"
                    className="opacity-0 transition group-hover:opacity-100"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      delDoc(d.name);
                    }}
                    title="Supprimer"
                    className="opacity-0 transition group-hover:opacity-100 hover:text-[#ef4444]"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Zone principale */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Onglets */}
        <div
          className="flex shrink-0 items-stretch gap-px overflow-x-auto"
          style={{ background: T.panel, borderBottom: `1px solid ${T.border}` }}
        >
          {tabs.map((t) => {
            const on = t.key === active?.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveKey(t.key)}
                className="group flex max-w-[200px] items-center gap-2 px-3 py-2 text-xs"
                style={{
                  borderRight: `1px solid ${T.border}`,
                  background: on ? T.tabActive : 'transparent',
                  color: on ? T.tabActiveText : T.tabText,
                }}
              >
                <FileIcon ext={(t.name.split('.').pop() || '').toLowerCase()} />
                <span className="truncate">{t.name}</span>
                {t.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.key);
                  }}
                  className="shrink-0 rounded px-0.5 opacity-0 transition hover:bg-black/10 group-hover:opacity-100"
                >
                  ✕
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 px-3">
            <ThemeToggle theme={theme} onChange={applyTheme} T={T} />
            <button
              onClick={() => setFindOpen((v) => !v)}
              title="Rechercher (⌘F)"
              className="rounded-md px-2 py-1 text-xs font-medium"
              style={{ border: `1px solid ${T.border}`, color: T.text }}
            >
              Rechercher
            </button>
            <button
              onClick={saveActive}
              className="rounded-md bg-foreground px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent"
            >
              {saving === 'saving'
                ? 'Enregistrement…'
                : saving === 'saved'
                  ? 'Enregistré ✓'
                  : 'Enregistrer'}
            </button>
          </div>
        </div>

        {/* Barre de recherche */}
        {findOpen && (
          <div
            className="flex flex-wrap items-center gap-2 px-3 py-1.5"
            style={{ background: T.panel, borderBottom: `1px solid ${T.border}` }}
          >
            <input
              autoFocus
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') findNext(e.shiftKey);
                if (e.key === 'Escape') setFindOpen(false);
              }}
              placeholder="Rechercher"
              className="w-44 rounded-md px-2 py-1 text-xs outline-none"
              style={{ border: `1px solid ${T.border}`, ...chip }}
            />
            <button
              onClick={() => findNext(true)}
              className="rounded px-2 py-1 text-xs"
              style={{ border: `1px solid ${T.border}`, color: T.text }}
            >
              ↑
            </button>
            <button
              onClick={() => findNext(false)}
              className="rounded px-2 py-1 text-xs"
              style={{ border: `1px solid ${T.border}`, color: T.text }}
            >
              ↓
            </button>
            <span className="text-xs tabular-nums" style={{ color: T.muted }}>
              {matchCount} résultat{matchCount > 1 ? 's' : ''}
            </span>
            <span className="mx-1 h-4 w-px" style={{ background: T.border }} />
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Remplacer par"
              className="w-44 rounded-md px-2 py-1 text-xs outline-none"
              style={{ border: `1px solid ${T.border}`, ...chip }}
            />
            <button
              onClick={replaceOne}
              className="rounded px-2 py-1 text-xs"
              style={{ border: `1px solid ${T.border}`, color: T.text }}
            >
              Remplacer
            </button>
            <button
              onClick={replaceAll}
              className="rounded px-2 py-1 text-xs"
              style={{ border: `1px solid ${T.border}`, color: T.text }}
            >
              Tout
            </button>
            <button
              onClick={() => setFindOpen(false)}
              className="ml-auto rounded px-1 text-xs"
              style={{ color: T.muted }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Éditeur */}
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ background: T.editor }}>
          <div
            ref={lineHiRef}
            className="pointer-events-none absolute left-0 right-0"
            style={{ height: LH, top: PAD, background: T.activeLine, zIndex: 0 }}
          />
          <div
            ref={gutterRef}
            className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden text-right"
            style={{ width: Gw, zIndex: 2, borderRight: `1px solid ${T.border}` }}
          >
            <div
              style={{
                padding: `${PAD}px 8px ${PAD}px 0`,
                font: `13px/${LH}px ${FONT}`,
                color: T.gutter,
                whiteSpace: 'pre',
              }}
            >
              {lineNumbers}
            </div>
          </div>
          <pre
            ref={preRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{
              margin: 0,
              padding: `${PAD}px ${PAD}px ${PAD}px ${Gw + 8}px`,
              font: `13px/${LH}px ${FONT}`,
              color: T.text,
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              wordBreak: wrap ? 'break-word' : 'normal',
              zIndex: 1,
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          <textarea
            key={active?.key}
            ref={taRef}
            className="ide-ta absolute inset-0 resize-none overflow-auto border-0 bg-transparent outline-none"
            style={{
              margin: 0,
              padding: `${PAD}px ${PAD}px ${PAD}px ${Gw + 8}px`,
              font: `13px/${LH}px ${FONT}`,
              color: 'transparent',
              caretColor: T.caret,
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              wordBreak: wrap ? 'break-word' : 'normal',
              zIndex: 3,
              tabSize: 2,
            }}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            onKeyUp={updateCaret}
            onClick={updateCaret}
          />
        </div>

        {/* Barre d'état */}
        <div
          className="flex shrink-0 items-center gap-3 px-3 py-1 text-[11px]"
          style={{ background: T.panel, borderTop: `1px solid ${T.border}`, color: T.muted }}
        >
          <span>
            {active?.name}
            {active?.dirty ? ' •' : ''}
          </span>
          <select
            value={lang}
            onChange={(e) =>
              setTabs((ts) =>
                ts.map((t) => (t.key === active?.key ? { ...t, lang: e.target.value } : t)),
              )
            }
            className="rounded px-1 py-0.5 text-[11px] outline-none"
            style={{ border: `1px solid ${T.border}`, ...chip }}
          >
            {Object.entries(LANGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <span>
            Ln {caret.line}, Col {caret.col}
          </span>
          <span>
            {lineCount} ligne{lineCount > 1 ? 's' : ''}
          </span>
          <span>{new Blob([content]).size} o</span>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={wrap}
              onChange={(e) => setWrap(e.target.checked)}
              className="h-3 w-3 accent-[color:var(--color-accent)]"
            />
            Retour ligne
          </label>
          <span className="ml-auto uppercase">{ext || 'txt'} · UTF-8</span>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onChange,
  T,
}: {
  theme: ThemeName;
  onChange: (t: ThemeName) => void;
  T: Palette;
}) {
  return (
    <div className="flex items-center rounded-md p-0.5" style={{ border: `1px solid ${T.border}` }}>
      <button
        onClick={() => onChange('light')}
        title="Thème clair"
        className="flex h-6 w-6 items-center justify-center rounded"
        style={{
          background: theme === 'light' ? T.tabActive : 'transparent',
          color: theme === 'light' ? '#f59e0b' : T.muted,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </button>
      <button
        onClick={() => onChange('dark')}
        title="Thème sombre"
        className="flex h-6 w-6 items-center justify-center rounded"
        style={{
          background: theme === 'dark' ? T.tabActive : 'transparent',
          color: theme === 'dark' ? '#a5b4fc' : T.muted,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </div>
  );
}

function FileIcon({ ext }: { ext: string }) {
  const color = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)
    ? '#61afef'
    : ['json', 'jsonc'].includes(ext)
      ? '#e5c07b'
      : ['css', 'scss', 'less'].includes(ext)
        ? '#c678dd'
        : ['html', 'htm', 'xml', 'svg'].includes(ext)
          ? '#e06c75'
          : ['md', 'markdown'].includes(ext)
            ? '#56b6c2'
            : ['py'].includes(ext)
              ? '#98c379'
              : ['sh', 'bash'].includes(ext)
                ? '#98c379'
                : '#8a8f99';
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
