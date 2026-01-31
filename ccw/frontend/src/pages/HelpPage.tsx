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
import { useIntl } from 'react-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface HelpSection {
  i18nKey: string;
  descriptionI18nKey: string;
  headingI18nKey?: string;
  icon: React.ElementType;
  link?: string;
  isExternal?: boolean;
}

interface HelpSectionConfig {
  i18nKey: string;
  descriptionKey: string;
  headingKey?: string;
  icon: React.ElementType;
  link?: string;
  isExternal?: boolean;
}

const helpSectionsConfig: HelpSectionConfig[] = [
  {
    i18nKey: 'home.help.gettingStarted.title',
    descriptionKey: 'home.help.gettingStarted.description',
    headingKey: 'home.help.gettingStarted.heading',
    icon: Book,
    link: '#getting-started',
  },
  {
    i18nKey: 'home.help.orchestratorGuide.title',
    descriptionKey: 'home.help.orchestratorGuide.description',
    icon: Workflow,
    link: '/orchestrator',
  },
  {
    i18nKey: 'home.help.sessionsManagement.title',
    descriptionKey: 'home.help.sessionsManagement.description',
    icon: FolderKanban,
    link: '/sessions',
  },
  {
    i18nKey: 'home.help.cliIntegration.title',
    descriptionKey: 'home.help.cliIntegration.description',
    headingKey: 'home.help.cliIntegration.heading',
    icon: Terminal,
    link: '#cli-integration',
  },
];

export function HelpPage() {
  const { formatMessage } = useIntl();

  // Build help sections with i18n
  const helpSections: HelpSection[] = helpSectionsConfig.map(section => ({
    ...section,
    descriptionI18nKey: section.descriptionKey,
    headingI18nKey: section.headingKey,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-primary" />
          {formatMessage({ id: 'help.title' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'help.description' })}
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
                    {formatMessage({ id: section.i18nKey })}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatMessage({ id: section.descriptionI18nKey })}
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
              <Link key={section.i18nKey} to={section.link}>
                {content}
              </Link>
            );
          }

          return (
            <a key={section.i18nKey} href={section.link}>
              {content}
            </a>
          );
        })}
      </div>

      {/* Getting Started Section */}
      <Card className="p-6" id="getting-started">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {formatMessage({ id: 'home.help.gettingStarted.heading' })}
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
          {formatMessage({ id: 'home.help.cliIntegration.heading' })}
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
              {formatMessage({ id: 'help.support.title' })}
            </h3>
            <p className="text-muted-foreground mt-1 mb-4">
              {formatMessage({ id: 'help.support.description' })}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Book className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'help.support.documentation' })}
              </Button>
              <Button variant="outline" size="sm">
                <Video className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'help.support.tutorials' })}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default HelpPage;
