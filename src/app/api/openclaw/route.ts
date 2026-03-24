import { NextRequest, NextResponse } from 'next/server';

export interface OpenClawSkill {
  name: string;
  description: string;
  author: string;
  tags: string[];
  toolCount: number;
  clawHubUrl: string;
  githubUrl: string;
  pactSpecGenerated: boolean;
}

const SKILLS: OpenClawSkill[] = [
  {
    name: 'Web Search',
    description: 'Search the web using multiple engines with structured result extraction, snippets, and pagination support.',
    author: 'openclaw',
    tags: ['search', 'web', 'scraping', 'information-retrieval'],
    toolCount: 4,
    clawHubUrl: 'https://clawhub.ai/skills/web-search',
    githubUrl: 'https://github.com/openclaw/skill-web-search',
    pactSpecGenerated: false,
  },
  {
    name: 'File Manager',
    description: 'Read, write, move, copy, and manage files and directories with permission handling and glob pattern support.',
    author: 'openclaw',
    tags: ['filesystem', 'files', 'io', 'management'],
    toolCount: 8,
    clawHubUrl: 'https://clawhub.ai/skills/file-manager',
    githubUrl: 'https://github.com/openclaw/skill-file-manager',
    pactSpecGenerated: false,
  },
  {
    name: 'GitHub Integration',
    description: 'Interact with GitHub repositories, issues, pull requests, actions, and releases via the GitHub API.',
    author: 'openclaw',
    tags: ['github', 'git', 'devops', 'automation'],
    toolCount: 12,
    clawHubUrl: 'https://clawhub.ai/skills/github-integration',
    githubUrl: 'https://github.com/openclaw/skill-github',
    pactSpecGenerated: false,
  },
  {
    name: 'Docker Manager',
    description: 'Build, run, stop, and manage Docker containers and images. Supports compose, volumes, and network configuration.',
    author: 'openclaw',
    tags: ['docker', 'containers', 'devops', 'infrastructure'],
    toolCount: 10,
    clawHubUrl: 'https://clawhub.ai/skills/docker-manager',
    githubUrl: 'https://github.com/openclaw/skill-docker',
    pactSpecGenerated: false,
  },
  {
    name: 'Database Query',
    description: 'Execute SQL queries against PostgreSQL, MySQL, and SQLite databases with parameterized queries and schema introspection.',
    author: 'openclaw',
    tags: ['database', 'sql', 'postgres', 'mysql'],
    toolCount: 6,
    clawHubUrl: 'https://clawhub.ai/skills/database-query',
    githubUrl: 'https://github.com/openclaw/skill-database-query',
    pactSpecGenerated: false,
  },
  {
    name: 'Email Sender',
    description: 'Send, read, and manage emails via SMTP and IMAP with template rendering, attachments, and HTML support.',
    author: 'openclaw',
    tags: ['email', 'smtp', 'imap', 'communication'],
    toolCount: 5,
    clawHubUrl: 'https://clawhub.ai/skills/email-sender',
    githubUrl: 'https://github.com/openclaw/skill-email',
    pactSpecGenerated: false,
  },
  {
    name: 'Calendar Manager',
    description: 'Create, update, and query calendar events across Google Calendar and Outlook with recurrence and timezone support.',
    author: 'openclaw',
    tags: ['calendar', 'scheduling', 'google', 'outlook'],
    toolCount: 7,
    clawHubUrl: 'https://clawhub.ai/skills/calendar-manager',
    githubUrl: 'https://github.com/openclaw/skill-calendar',
    pactSpecGenerated: false,
  },
  {
    name: 'Slack Integration',
    description: 'Send messages, manage channels, handle reactions, and interact with Slack workspaces via the Slack API.',
    author: 'openclaw',
    tags: ['slack', 'messaging', 'communication', 'automation'],
    toolCount: 9,
    clawHubUrl: 'https://clawhub.ai/skills/slack-integration',
    githubUrl: 'https://github.com/openclaw/skill-slack',
    pactSpecGenerated: false,
  },
  {
    name: 'Image Generation',
    description: 'Generate, edit, and transform images using DALL-E, Stable Diffusion, and other models with prompt engineering support.',
    author: 'openclaw',
    tags: ['image', 'generation', 'ai', 'creative'],
    toolCount: 5,
    clawHubUrl: 'https://clawhub.ai/skills/image-generation',
    githubUrl: 'https://github.com/openclaw/skill-image-gen',
    pactSpecGenerated: false,
  },
  {
    name: 'Code Interpreter',
    description: 'Execute Python, JavaScript, and shell code in a sandboxed environment with output capture and dependency installation.',
    author: 'openclaw',
    tags: ['code', 'execution', 'python', 'sandbox'],
    toolCount: 4,
    clawHubUrl: 'https://clawhub.ai/skills/code-interpreter',
    githubUrl: 'https://github.com/openclaw/skill-code-interpreter',
    pactSpecGenerated: false,
  },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').toLowerCase().trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  let filtered = SKILLS;
  if (q) {
    filtered = SKILLS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)) ||
        s.author.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    skills: filtered.slice(0, limit),
    total: filtered.length,
    source: 'clawhub.ai',
    note: 'Curated popular OpenClaw skills. Full ClawHub API integration coming soon.',
  });
}
