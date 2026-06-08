import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

const PILIERS = [
  {
    titre: 'Un cursus prescrit, à ton rythme',
    desc: 'Le tronc commun (Fondations, Aptitudes durables, Concepts-clés) que l’IA te fait parcourir par maîtrise — zéro trou garanti.',
  },
  {
    titre: 'L’IA enseigne, l’intra structure',
    desc: 'Ton abonnement IA fait les cours ; l’app tient la carte des compétences, ta progression et le pont .json (sans API).',
  },
  {
    titre: 'Validation par les pairs',
    desc: 'Pas de QCM : tu démontres, tu fais valider (auto puis pairs, modèle École 42). Des badges de confiance.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-5">
        <p className="text-sm font-medium text-accent">Le système d’éducation 2.0</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Apprendre toute sa vie, pour tous, avec une IA-tuteur.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Pas un lieu, pas un âge, pas un diplôme. Juste un terminal, une connexion, et l’envie
          d’apprendre — de la naissance à la mort. Dowze est un <strong>commun</strong> ouvert.
        </p>
        <div className="flex gap-3">
          <Link href="/dashboard">
            <Button>Voir le tableau de bord</Button>
          </Link>
          <Link href="/bridge">
            <Button variant="ghost">Essayer le pont .json</Button>
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
