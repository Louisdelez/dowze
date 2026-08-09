import { memo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Rendu Markdown : titres (#..####), **gras**, *italique*, `code`, listes à puces et numérotées, paragraphes,
 * et MATHS via KaTeX (`$inline$` et `$$bloc$$`). Couvre ce que l'IA de Dowze produit dans les fiches de cours.
 */

/** Formule KaTeX inline (`$...$`). `throwOnError:false` → dégrade en texte si le LaTeX est invalide. */
function MathSpan({ latex }: { latex: string }) {
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: false });
  } catch {
    return <span>{latex}</span>;
  }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Formule KaTeX en bloc (`$$...$$`), centrée. */
function DisplayMath({ latex }: { latex: string }) {
  let html: string;
  try {
    html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
  } catch {
    return <pre className="overflow-x-auto text-sm">{latex}</pre>;
  }
  return <div className="my-2 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline Markdown SANS math : **gras**, *italique*, `code`. */
function mdInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] != null) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={`${keyBase}-i${i}`}>{m[3]}</em>);
    else if (m[4] != null)
      nodes.push(
        <code key={`${keyBase}-c${i}`} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {m[4]}
        </code>,
      );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Inline complet : on EXTRAIT d'abord les maths `$...$` (protégées du parsing markdown), puis markdown. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const mathRe = /\$([^$\n]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = mathRe.exec(text))) {
    if (m.index > last) out.push(...mdInline(text.slice(last, m.index), `${keyBase}-t${i}`));
    out.push(<MathSpan key={`${keyBase}-m${i}`} latex={m[1] ?? ''} />);
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(...mdInline(text.slice(last), `${keyBase}-t${i}`));
  return out;
}

// ⚠️ Cette régex doit reconnaître EXACTEMENT les mêmes lignes que les branches de la boucle de blocs :
// une ligne « spéciale » ici mais traitée par aucune branche (ex. `$$$$` vide) provoquait une boucle
// infinie (le paragraphe ne consommait pas la ligne). D'où `.+` (comme la branche display) + le garde-fou
// `para.length === 0` plus bas.
const isSpecial = (l: string) =>
  /^(#{1,4})\s|^\s*[-*]\s|^\s*\d+\.\s|^\s*\$\$.+\$\$\s*$|^\s*\$\$\s*$/.test(l);

/** `memo` : le parsing + KaTeX sont coûteux ; le texte d'une fiche ne change jamais après génération. */
export const Markdown = memo(function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const at = (n: number): string => lines[n] ?? '';
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = at(i);
    if (!line.trim()) {
      i++;
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const cls = level <= 1 ? 'text-lg font-bold' : level === 2 ? 'text-base font-bold' : 'text-sm font-semibold';
      blocks.push(
        <p key={k++} className={`${cls} mt-2`}>
          {inline(h[2] ?? '', `h${k}`)}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(at(i))) {
        items.push(<li key={items.length}>{inline(at(i).replace(/^\s*[-*]\s+/, ''), `ul${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        <ul key={k++} className="list-disc space-y-1 pl-6">
          {items}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(at(i))) {
        items.push(<li key={items.length}>{inline(at(i).replace(/^\s*\d+\.\s+/, ''), `ol${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        <ol key={k++} className="list-decimal space-y-1 pl-6">
          {items}
        </ol>,
      );
      continue;
    }

    // Maths en bloc : $$...$$ sur une ligne.
    const dm = /^\s*\$\$(.+)\$\$\s*$/.exec(line);
    if (dm) {
      blocks.push(<DisplayMath key={k++} latex={dm[1] ?? ''} />);
      i++;
      continue;
    }

    // Maths en bloc MULTILIGNE : `$$` ouvrant seul sur sa ligne … `$$` fermant.
    if (/^\s*\$\$\s*$/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(at(i))) {
        buf.push(at(i));
        i++;
      }
      i++; // consomme la ligne fermante (ou dépasse proprement la fin)
      if (buf.length > 0) blocks.push(<DisplayMath key={k++} latex={buf.join('\n')} />);
      continue;
    }

    // Paragraphe : regroupe les lignes consécutives « normales ».
    const para: string[] = [];
    while (i < lines.length && at(i).trim() && !isSpecial(at(i))) {
      para.push(at(i));
      i++;
    }
    // Garde-fou anti-boucle infinie : si la ligne courante n'a été consommée par AUCUNE branche,
    // on l'avance quand même (rendue telle quelle) plutôt que de figer l'onglet.
    if (para.length === 0) {
      blocks.push(<p key={k++}>{at(i)}</p>);
      i++;
      continue;
    }
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>);
  }

  return <div className={`space-y-2 text-sm leading-relaxed ${className ?? ''}`}>{blocks}</div>;
});
