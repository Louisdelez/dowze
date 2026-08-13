import { TopBar } from '@/components/topbar';

export const metadata = {
  title: 'À propos — Dowze',
  description: 'La philosophie de Dowze, en quelques mots.',
};

export default function APropos() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <TopBar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <h1 className="text-4xl font-black italic uppercase tracking-tight sm:text-5xl">
          Notre idée est simple.
        </h1>
        <div className="mt-7 space-y-5 text-lg font-medium leading-relaxed text-black/80">
          <p>
            Le savoir humain, l’IA l’a déjà absorbé. Dowze te le débloque — avec la bonne méthode,
            pas un chatbot.
          </p>
          <p>
            Et apprendre n’est qu’une partie de la vie. Bouger, se nourrir, progresser en font aussi
            partie. Dowze les réunit sous un{' '}
            <span className="bg-dowze-red px-1 font-extrabold italic text-white">seul compte</span>{' '}
            et un{' '}
            <span className="bg-black px-1 font-extrabold italic text-white">seul compagnon</span>{' '}
            qui t’accompagne partout.
          </p>
          <p>
            Pas de lieu, pas d’âge, pas de diplôme requis. Pas de plafond. Juste toi qui grandis,
            toute ta vie.
          </p>
        </div>
        <a
          href="/"
          className="mt-10 w-fit text-sm font-extrabold uppercase italic tracking-tight text-dowze-red transition hover:underline"
        >
          ← Retour
        </a>
      </main>
    </div>
  );
}
