export interface ProjectConfig {
  id: string;
  name: string;
  description: string;
  path: string;          // absolute path on disk
  port: number;
  startCmd: string;      // e.g. 'npm run dev'
  techStack: string[];   // e.g. ['Next.js', 'TypeScript']
  status: 'available' | 'no-ui' | 'planned';
}

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'byl',
    name: 'Before You Leap — Landing Page',
    description: 'High-converting landing page for the BYL 30-day validation sprint service.',
    path: '/Users/centrick/CODE/before-you-leap/site',
    port: 3003,
    startCmd: 'npm install --prefer-offline --silent && npm run dev',
    techStack: ['Next.js', 'TypeScript'],
    status: 'available',
  },
  {
    id: 'byl-engine',
    name: 'BAC',
    description: 'Business Advisory Council — 8 collectors + 8 AI analysts + synthesis.',
    path: '/Users/centrick/CODE/before-you-leap/bac',
    port: 3007,
    startCmd: 'npm install --prefer-offline --silent && npm run serve',
    techStack: ['Node.js', 'Claude', 'Multi-agent'],
    status: 'available',
  },
  {
    id: 'legal-assistant',
    name: 'Austrian Legal Assistant',
    description: 'AI-powered Austrian law advisor. Grounded in RIS API v2.6, 12 laws, 3035 vectors.',
    path: '/Users/centrick/clawd/projects/legal-assistant',
    port: 3004,
    startCmd: 'npm install --prefer-offline --silent && node server.js',
    techStack: ['Node.js', 'Qdrant', 'RAG'],
    status: 'available',
  },
  {
    id: 'byl-app',
    name: 'BYL Web App',
    description: 'Full validation platform — dashboard, validations, settings. Requires Supabase + FastAPI backend. Frontend runs standalone (auth disabled without Supabase).',
    path: '/Users/centrick/clawd/coordination/projects/before-you-leap/web/frontend',
    port: 3008,
    startCmd: 'npm install --prefer-offline --silent && npm run dev',
    techStack: ['Next.js', 'Supabase', 'FastAPI'],
    status: 'available',
  },
  {
    id: 'edgewell',
    name: 'EdgeWell',
    description: 'Nervous system training via solo practice. Science-first landing page with HRV integration.',
    path: '/Users/centrick/clawd/coordination/projects/edgewell/site',
    port: 3005,
    startCmd: 'npm install --prefer-offline --silent && npm run dev',
    techStack: ['Next.js', 'Tailwind'],
    status: 'available',
  },
  {
    id: 'essay-pipeline',
    name: 'Essay Pipeline',
    description: '5-stage multi-model essay generator: Brave → Claude → GPT-4o → Claude → Claude.',
    path: '/Users/centrick/clawd/coordination/projects/essay-pipeline',
    port: 3006,
    startCmd: 'npm install --prefer-offline --silent && npm run serve',
    techStack: ['Node.js', 'Multi-model', 'SSE'],
    status: 'available',
  },
];
