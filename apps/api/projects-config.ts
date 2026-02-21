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
    name: 'Before You Leap',
    description: 'Startup idea validation tool — landing page and validation pipeline for founders.',
    path: '/Users/centrick/CODE/before-you-leap/site',
    port: 3003,
    startCmd: 'npm install --prefer-offline --silent && npm run dev',
    techStack: ['Next.js', 'TypeScript'],
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
    id: 'edgewell',
    name: 'EdgeWell',
    description: 'Nervous system training via solo practice. Science-first PWA with HRV integration.',
    path: '',
    port: 3005,
    startCmd: '',
    techStack: ['PWA', 'React'],
    status: 'planned',
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
