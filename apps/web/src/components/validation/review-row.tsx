'use client';

import { useState } from 'react';
import type { ValidationSubject } from '@dowze/schemas';
import { reviewValidationSubject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { TextAreaField } from '@/components/ui/field';
import { IconStar, IconX } from '@/components/ui/icons';

/** Une ligne « sujet à évaluer » : validé + étoiles + commentaire, ou passer (✕). Réutilisable. */
export function ReviewRow({
  s,
  profileId,
  onReviewed,
  showAuthor = false,
}: {
  s: ValidationSubject;
  profileId: string;
  onReviewed: () => void;
  showAuthor?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [validated, setValidated] = useState(true);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function envoyer() {
    if (stars < 1 || !comment.trim()) return;
    setBusy(true);
    try {
      await reviewValidationSubject(profileId, s.id, { validated, stars, comment: comment.trim() });
      setOpen(false);
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{s.title}</p>
          {s.description ? <p className="text-xs text-muted-foreground">{s.description}</p> : null}
          <p className="text-xs text-muted-foreground">
            {showAuthor ? <>Par {s.authorName} · niveau {s.authorLevel} · </> : null}
            {s.evidenceUrl ? (
              <a href={s.evidenceUrl} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
                voir la vidéo
              </a>
            ) : (
              'visio en direct'
            )}
          </p>
        </div>
        {!open ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>Évaluer</Button>
        ) : (
          <button type="button" onClick={() => setOpen(false)} aria-label="Passer (ne pas évaluer)" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
            <IconX width={16} height={16} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} />
            <span>Je valide : la personne a bien expliqué et je l'ai comprise.</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Note :</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setStars(n)} aria-label={`${n} étoiles`} className="p-0.5">
                <IconStar width={22} height={22} className={n <= stars ? 'text-amber-500' : 'text-muted-foreground/40'} />
              </button>
            ))}
          </div>
          <TextAreaField
            label="Commentaire (obligatoire)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ce qui était clair, ce qui pourrait être amélioré…"
          />
          <div className="flex gap-2">
            <Button onClick={envoyer} disabled={busy || stars < 1 || !comment.trim()}>
              {busy ? 'Envoi…' : 'Envoyer mon évaluation'}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>Passer</Button>
          </div>
        </div>
      )}
    </div>
  );
}
