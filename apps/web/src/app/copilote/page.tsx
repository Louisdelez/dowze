'use client';

import { PageHeader } from '@/components/page-header';
import { CopiloteSettings } from '@/components/copilote-settings';

// Les réglages du Copilote sont désormais accessibles depuis « Mon compagnon » → Paramètres.
// Cette page reste fonctionnelle en accès direct.
export default function CopilotePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon Copilote"
        subtitle="L’IA interne qui prépare tes prompts et lit tes résumés de séance. Choisis ton modèle et comment tu le paies."
      />
      <CopiloteSettings />
    </div>
  );
}
