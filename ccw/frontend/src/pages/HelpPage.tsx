// ========================================
// Help Page
// ========================================
// Help documentation and guides

import {
  HelpCircle,
  Book,
  Video,
  MessageCircle,
  ExternalLink,
  Workflow,
  FolderKanban,
  Terminal,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface HelpSection {
  title: string;
  description: string;
  icon: React.ElementType;
  link?: string;
  isExternal?: boolean;
}

const helpSections: HelpSection[] = [
  {
    title: 'Getting Started',
    description: 'Learn the basics of CCW Dashboard and workflow management',
    icon: Book,
    link: '#getting-started',
  },
  {
    title: 'Orchestrator Guide',
    description: 'Master the visual workflow editor with drag-drop flows',
    icon: Workflow,
    link: '/orchestrator',
  },
  {
    title: 'Sessions Management',
    description: 'Understanding workflow sessions and task tracking',
    icon: FolderKanban,
    link: '/sessions',
  },
  {
    title: 'CLI Integration',
    description: 'Using CCW commands and CLI tool integration',
    icon: Terminal,
    link: '#cli-integration',
  },
];

export function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-primary" />
          Help & Documentation
        </h1>
        <p className="text-muted-foreground mt-1">
          Learn how to use CCW Dashboard and get the most out of your workflows
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {helpSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <Card className="p-4 h-full hover:shadow-md hover:border-primary/50 transition-all cursor-pointer group">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {section.description}
                  </p>
                </div>
                {section.isExternal && (
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </Card>
          );

          if (section.link?.startsWith('/')) {
            return (
              <Link key={section.title} to={section.link}>
                {content}
              </Link>
            );
          }

          return (
            <a key={section.title} href={section.link}>
              {content}
            </a>
          );
        })}
      </div>

      {/* Getting Started Section */}
      <Card className="p-6" id="getting-started">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Getting Started with CCW
        </h2>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            CCW (Claude Code Workflow) Dashboard is your central hub for managing
            AI-powered development workflows. Here are the key concepts:
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <strong className="text-foreground">Sessions</strong> - Track the
              progress of multi-step development tasks
            </li>
            <li>
              <strong className="text-foreground">Orchestrator</strong> - Visual
              workflow builder for creating automation flows
            </li>
            <li>
              <strong className="text-foreground">Loops</strong> - Monitor
              iterative development cycles in real-time
            </li>
            <li>
              <strong className="text-foreground">Skills</strong> - Extend Claude
              Code with custom capabilities
            </li>
            <li>
              <strong className="text-foreground">Memory</strong> - Store context
              and knowledge for better AI assistance
            </li>
          </ul>
        </div>
      </Card>

      {/* CLI Integration Section */}
      <Card className="p-6" id="cli-integration">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          CLI Integration
        </h2>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>
            CCW integrates with multiple CLI tools for AI-assisted development:
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                ccw cli -p "prompt" --tool gemini
              </code>
              - Execute with Gemini
            </li>
            <li>
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                ccw cli -p "prompt" --tool qwen
              </code>
              - Execute with Qwen
            </li>
            <li>
              <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                ccw cli -p "prompt" --tool codex
              </code>
              - Execute with Codex
            </li>
          </ul>
        </div>
      </Card>

      {/* Support Section */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              Need more help?
            </h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Check the project documentation or reach out for support.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Book className="w-4 h-4 mr-2" />
                Documentation
              </Button>
              <Button variant="outline" size="sm">
                <Video className="w-4 h-4 mr-2" />
                Tutorials
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default HelpPage;
