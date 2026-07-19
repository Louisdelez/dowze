import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { HeroActions } from '@/components/hero-actions';

const PILIERS = [
  {
    titre: 'La méthode fait le professeur',
    desc: 'Maîtrise pas à pas, questions plutôt que réponses, feedback immédiat. Ce n’est pas l’IA brute — c’est la pédagogie qui te fait vraiment apprendre.',
  },
  {
    titre: 'Un savoir sans plafond',
    desc: 'Du collège au niveau universitaire, dans quasiment tous les domaines. Aussi loin que tu veux aller : il n’y a pas de fin.',
  },
  {
    titre: 'Ta progression est la vérité',
    desc: 'L’IA enseigne ; Dowze tient la carte de tes savoirs, ta mémoire et tes preuves. Pas de QCM : tu démontres, tes pairs valident.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <p className="text-sm font-medium text-accent">L’école du futur</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Apprends tout, toute ta vie, sans plafond.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Le savoir humain, l’IA l’a déjà absorbé. Dowze te le débloque avec la bonne méthode : un
          tuteur 1:1 qui t’amène du collège au niveau universitaire, dans presque tout. Pas un lieu,
          pas un âge, pas un diplôme requis — un terminal, une connexion, l’envie d’apprendre.
        </p>
        <HeroActions />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {PILIERS.map((p) => (
          <Card key={p.titre}>
            <CardTitle>{p.titre}</CardTitle>
            <CardDescription>{p.desc}</CardDescription>
          </Card>
        ))}
      </section>
    </div>
  );
}
