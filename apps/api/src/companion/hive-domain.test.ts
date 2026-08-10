import { describe, expect, it } from 'vitest';
import {
  canCreateHiveTask,
  communicationFrame,
  selectComputeResource,
  shouldDelegate,
  canHandleRequest,
  renderForChannel,
  selectCompanionForRequest,
  selectHiveRuntime,
  findOrganizationalRoute,
  type HiveRuntime,
} from './hive-domain';

describe('fidélité de rôle et routage social', () => {
  const cook = {
    id: 'cook',
    roleKey: 'cook',
    contract: {
      capabilities: ['menus cuisine nutrition'],
      limitations: ['déploiement infrastructure'],
    },
  };
  const devops = {
    id: 'devops',
    roleKey: 'devops',
    contract: { capabilities: ['déploiement infrastructure serveur production'] },
  };

  it('refuse de faire improviser un compagnon hors périmètre', () => {
    expect(canHandleRequest('Déploie le site en production', cook.contract)).toBe(false);
    expect(canHandleRequest('Prépare un menu de cuisine', cook.contract)).toBe(true);
  });

  it('sélectionne la bonne porte organisationnelle', () => {
    expect(
      selectCompanionForRequest('Déploiement du serveur en production', [cook, devops])?.id,
    ).toBe('devops');
  });
});

describe("budget d'exécution récursive", () => {
  const budget = { maxDepth: 4, maxFanout: 3, maxTasks: 24, usedTasks: 8 };

  it('autorise une sous-tâche tant que les trois limites sont respectées', () => {
    expect(canCreateHiveTask(budget, { depth: 3, siblingCount: 2 })).toEqual({ allowed: true });
  });

  it('bloque séparément profondeur, fan-out et nombre total de tâches', () => {
    expect(canCreateHiveTask(budget, { depth: 5, siblingCount: 0 })).toEqual({
      allowed: false,
      reason: 'max_depth',
    });
    expect(canCreateHiveTask(budget, { depth: 2, siblingCount: 3 })).toEqual({
      allowed: false,
      reason: 'max_fanout',
    });
    expect(canCreateHiveTask({ ...budget, usedTasks: 24 }, { depth: 2, siblingCount: 1 })).toEqual({
      allowed: false,
      reason: 'max_tasks',
    });
  });

  it('refuse une bureaucratie dont le coût dépasse le gain attendu', () => {
    expect(
      shouldDelegate({
        expectedGain: 0.2,
        communicationCost: 0.1,
        computeCost: 0.1,
        coordinationCost: 0.1,
      }),
    ).toBe(false);
    expect(
      shouldDelegate({
        expectedGain: 0.9,
        communicationCost: 0.1,
        computeCost: 0.2,
        coordinationCost: 0.1,
      }),
    ).toBe(true);
  });
});

describe('trame de communication humaine', () => {
  it('sépare les faits, la confiance, la prosodie et l’animation', () => {
    expect(
      communicationFrame('**Déploiement terminé.**', {
        intent: 'confirm',
        confidence: 0.92,
        tone: 'joyeux et énergique',
      }),
    ).toEqual({
      intent: 'confirm',
      facts: ['Déploiement terminé.'],
      emotion: 'neutral',
      confidence: 0.92,
      prosody: { rate: 1.08, pitch: 1.08, pauses: 'natural' },
      animation: 'nod',
    });
  });
});

describe('scheduler de calcul', () => {
  const resources = [
    {
      id: 'gpu-busy',
      kind: 'gpu' as const,
      locality: 'local' as const,
      modalities: ['text', 'image'],
      memoryMb: 64_000,
      acceleratorMemoryMb: 24_000,
      maxConcurrency: 2,
      activeAllocations: 2,
      costPerHour: 0,
      health: 'healthy' as const,
      enabled: true,
    },
    {
      id: 'gpu-free',
      kind: 'gpu' as const,
      locality: 'private_cloud' as const,
      modalities: ['text', 'image'],
      memoryMb: 128_000,
      acceleratorMemoryMb: 48_000,
      maxConcurrency: 4,
      activeAllocations: 1,
      costPerHour: 0.8,
      health: 'healthy' as const,
      enabled: true,
    },
  ];

  it('écarte un nœud saturé et respecte mémoire, modalité et confidentialité', () => {
    expect(
      selectComputeResource(
        {
          modality: 'image',
          minimumAcceleratorMemoryMb: 32_000,
          allowedLocality: ['private_cloud'],
        },
        resources,
      )?.id,
    ).toBe('gpu-free');
  });
});

describe('chemin organisationnel', () => {
  it('choisit la chaîne déclarée la plus courte et évite les cycles', () => {
    const route = findOrganizationalRoute('accueil', 'dev', [
      { id: 'accueil', roleKey: 'accueil', contract: { delegatesTo: ['manager'] } },
      { id: 'manager', roleKey: 'manager', contract: { delegatesTo: ['accueil', 'cto'] } },
      { id: 'cto', roleKey: 'cto', contract: { delegatesTo: ['dev'] } },
      { id: 'dev', roleKey: 'dev', contract: { capabilities: ['code'] } },
    ]);
    expect(route).toEqual(['accueil', 'manager', 'cto', 'dev']);
  });

  it('autorise le passage direct lorsque la hiérarchie ne décrit aucun chemin', () => {
    expect(
      findOrganizationalRoute('cook', 'dev', [
        { id: 'cook', roleKey: 'cook' },
        { id: 'dev', roleKey: 'dev' },
      ]),
    ).toEqual(['cook', 'dev']);
  });
});

describe('routeur modèle + harness', () => {
  const runtimes: HiveRuntime[] = [
    {
      id: 'generic-api',
      model: 'generic',
      harness: 'chat',
      modalities: ['text'],
      capabilities: ['conversation recherche'],
      quality: 0.8,
      cost: 0.4,
      latency: 0.2,
      privacy: 'public_cloud',
      entitlement: 'metered',
      available: true,
    },
    {
      id: 'codex-subscription',
      model: 'codex',
      harness: 'codex-mcp',
      modalities: ['text', 'code'],
      capabilities: ['développement code déploiement'],
      quality: 0.95,
      cost: 0.1,
      latency: 0.3,
      privacy: 'private_cloud',
      entitlement: 'subscription',
      available: true,
    },
  ];

  it('sélectionne le couple spécialisé et non le modèle seul', () => {
    expect(
      selectHiveRuntime(
        {
          capability: 'développement de code',
          modality: 'code',
          availableEntitlements: ['subscription'],
        },
        runtimes,
      ),
    ).toMatchObject({ id: 'codex-subscription', harness: 'codex-mcp' });
  });

  it('respecte disponibilité, confidentialité et entitlement avant le score', () => {
    expect(
      selectHiveRuntime(
        {
          capability: 'développement code',
          allowedPrivacy: ['local'],
          availableEntitlements: ['included'],
        },
        runtimes,
      ),
    ).toBeNull();
  });
});

describe('rendu multi-canal', () => {
  const context = { content: 'Le déploiement est terminé.', companionName: 'Alex' };

  it('rend un mail formel signé sans altérer le contenu', () => {
    expect(renderForChannel('email', context)).toContain('Bonjour,');
    expect(renderForChannel('email', context)).toContain('Le déploiement est terminé.');
    expect(renderForChannel('email', context)).toContain('Alex');
  });

  it('borne une notification push', () => {
    expect(
      renderForChannel('push', { ...context, content: 'a'.repeat(200) }).length,
    ).toBeLessThanOrEqual(140);
  });

  it('produit une bulle directe humaine de deux phrases maximum sans markdown', () => {
    const rendered = renderForChannel('direct', {
      ...context,
      content: '**Bonne nouvelle.** Le déploiement est terminé. Voici un troisième détail.',
    });
    expect(rendered).toBe('Bonne nouvelle. Le déploiement est terminé.');
    expect(rendered).not.toMatch(/[*#_`]/);
  });

  it('nettoie le markdown des messages sans perdre les faits', () => {
    expect(
      renderForChannel('messages', {
        ...context,
        content: '- **Serveur** prêt\n- [Rapport](https://dowze.ch/rapport)',
      }),
    ).toBe('Serveur prêt Rapport (https://dowze.ch/rapport)');
  });

  it('transforme le code et les éléments visuels en formulation prononçable', () => {
    const rendered = renderForChannel('voice', {
      ...context,
      content:
        'Le détail est dans `/srv/app/main.py`. ```python\nfor item in items: print(item)\n```',
    });
    expect(rendered).toContain('le fichier concerné');
    expect(rendered).toContain('un extrait de code');
    expect(rendered).not.toMatch(/[`{}]/);
  });

  it('formate un mail sans syntaxe markdown parasite', () => {
    const rendered = renderForChannel('email', {
      ...context,
      content: '## Incident\n\n**Cause :** saturation.',
    });
    expect(rendered).toBe('Bonjour,\n\nIncident\n\nCause : saturation.\n\nBien à vous,\nAlex');
  });

  it('adapte les codes relationnels du mail sans modifier son contenu', () => {
    const rendered = renderForChannel('email', {
      ...context,
      familiarity: 0.9,
      affinity: 0.9,
    });
    expect(rendered).toBe('Salut,\n\nLe déploiement est terminé.\n\nÀ bientôt,\nAlex');
  });

  it('exprime personnalité et émotion par le style sans changer les mots factuels', () => {
    expect(
      renderForChannel('direct', {
        ...context,
        tone: 'énergique et chaleureux',
        emotion: 'joyeux',
      }),
    ).toBe('Le déploiement est terminé !');
  });
});
