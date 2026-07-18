import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { IconArrowRight } from '@/components/ui/icons';

const PILIERS = [
  {
    titre: 'Un parcours prescrit, à ton rythme',
    desc: 'Pas besoin de savoir quoi apprendre : l’IA te place et te guide, compétence après compétence.',
  },
  {
    titre: 'L’IA fait les cours',
    desc: 'Ton assistant IA enseigne ; l’app tient la carte de tes savoirs et ta progression.',
  },
  {
    titre: 'Tu démontres, on valide',
    desc: 'Pas de QCM. Tu montres ce que tu sais faire, tes pairs le confirment, tu gagnes des preuves.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="space-y-6">
        <p className="text-sm font-medium text-accent">Le système d’éducation 2.0</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Apprendre toute sa vie, pour tous, avec une IA-tuteur.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Pas un lieu, pas un âge, pas un diplôme. Juste un terminal, une connexion, et l’envie
          d’apprendre. Dowze est un <strong>commun</strong> ouvert.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/inscription">
            <Button className="gap-2">
              Commencer
              <IconArrowRight />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Voir la démo</Button>
          </Link>
        </div>
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
