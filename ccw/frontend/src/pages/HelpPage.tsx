// ========================================
// Help Page
// ========================================
// Help documentation and guides with link to full documentation

import {
  HelpCircle,
  Book,
  Video,
  MessageCircle,
  ExternalLink,
  Workflow,
  FolderKanban,
  Terminal,
  FileText,
  ArrowRight,
  Search,
  Code,
  Layers,
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
  badge?: string;
}

interface HelpSectionConfig {
  i18nKey: string;
  descriptionKey: string;
  headingKey?: string;
  icon: React.ElementType;
  link?: string;
  isExternal?: boolean;
  badge?: string;
}

const helpSectionsConfig: HelpSectionConfig[] = [
  {
    i18nKey: 'home.help.gettingStarted.title',
    descriptionKey: 'home.help.gettingStarted.description',
    headingKey: 'home.help.gettingStarted.heading',
    icon: Book,
    link: '/docs/overview',
    isExternal: false,
    badge: 'Docs',
  },
  {
    i18nKey: 'home.help.orchestratorGuide.title',
    descriptionKey: 'home.help.orchestratorGuide.description',
    icon: Workflow,
    link: '/docs/workflows/introduction',
    isExternal: false,
    badge: 'Docs',
  },
  {
    i18nKey: 'home.help.commands.title',
    descriptionKey: 'home.help.commands.description',
    icon: Terminal,
    link: '/docs/commands/general/ccw',
    isExternal: false,
    badge: 'Docs',
  },
  {
    i18nKey: 'home.help.sessionsManagement.title',
    descriptionKey: 'home.help.sessionsManagement.description',
    icon: FolderKanban,
    link: '/sessions',
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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Page Header with CTA */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-primary flex-shrink-0" />
              <span>{formatMessage({ id: 'help.title' })}</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              {formatMessage({ id: 'help.description' })}
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            className="flex-shrink-0"
            asChild
          >
            <a href="/docs" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 whitespace-nowrap">
              <FileText className="w-4 h-4 flex-shrink-0" />
              {formatMessage({ id: 'help.fullDocs' })}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </Button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {helpSections.map((section) => {
          const Icon = section.icon;
          const isDocsLink = section.link?.startsWith('/docs');
          const content = (
            <Card className="p-5 h-full hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
              <div className="flex flex-col h-full gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {formatMessage({ id: section.i18nKey })}
                      </h3>
                      {section.badge && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full flex-shrink-0">
                          {section.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                      {formatMessage({ id: section.descriptionI18nKey })}
                    </p>
                  </div>
                </div>
                {(isDocsLink || section.isExternal) && (
                  <div className="flex justify-end mt-auto">
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                )}
              </div>
            </Card>
          );

          if (section.link?.startsWith('/docs')) {
            return (
              <a key={section.i18nKey} href={section.link} className="block">
                {content}
              </a>
            );
          }

          if (section.link?.startsWith('/') && !section.link.startsWith('/docs')) {
            return (
              <Link key={section.i18nKey} to={section.link}>
                {content}
              </Link>
            );
          }

          return (
            <a key={section.i18nKey} href={section.link} target="_blank" rel="noopener noreferrer">
              {content}
            </a>
          );
        })}
      </div>

      {/* Documentation Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Commands Card */}
        <Card className="p-6 hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground">
              {formatMessage({ id: 'help.commandsOverview.title' })}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            {formatMessage({ id: 'help.commandsOverview.description' })}
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Workflow Commands</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Issue Commands</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">CLI & Memory Commands</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-auto" asChild>
            <a href="/docs/commands/general/ccw" className="inline-flex items-center justify-center whitespace-nowrap">
              {formatMessage({ id: 'help.viewAll' })}
              <ArrowRight className="w-4 h-4 ml-1 flex-shrink-0" />
            </a>
          </Button>
        </Card>

        {/* Workflows Card */}
        <Card className="p-6 hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500 flex-shrink-0">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground">
              {formatMessage({ id: 'help.workflowsOverview.title' })}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            {formatMessage({ id: 'help.workflowsOverview.description' })}
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Code className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Level 1-5 Workflows</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Interactive Diagrams</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Best Practices</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-auto" asChild>
            <a href="/docs/workflows/introduction" className="inline-flex items-center justify-center whitespace-nowrap">
              {formatMessage({ id: 'help.viewAll' })}
              <ArrowRight className="w-4 h-4 ml-1 flex-shrink-0" />
            </a>
          </Button>
        </Card>

        {/* Quick Start Card */}
        <Card className="p-6 hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 flex-shrink-0">
              <Book className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-foreground">
              {formatMessage({ id: 'help.quickStart.title' })}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            {formatMessage({ id: 'help.quickStart.description' })}
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a href="/docs/overview" className="text-muted-foreground hover:text-foreground transition-colors">
                {formatMessage({ id: 'help.quickStart.guide' })}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <a href="/docs/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                {formatMessage({ id: 'help.quickStart.faq' })}
              </a>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-auto" asChild>
            <a href="/docs/overview" className="inline-flex items-center justify-center whitespace-nowrap">
              {formatMessage({ id: 'help.getStarted' })}
              <ArrowRight className="w-4 h-4 ml-1 flex-shrink-0" />
            </a>
          </Button>
        </Card>
      </div>

      {/* Search Documentation CTA */}
      <Card className="p-6 sm:p-8 bg-gradient-accent border-primary/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:justify-between">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="p-3 rounded-lg bg-primary/20 flex-shrink-0">
              <Search className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground">
                {formatMessage({ id: 'help.searchDocs.title' })}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatMessage({ id: 'help.searchDocs.description' })}
              </p>
            </div>
          </div>
          <Button variant="default" size="sm" className="flex-shrink-0 w-full sm:w-auto" asChild>
            <a href="/docs" className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
              {formatMessage({ id: 'help.searchDocs.button' })}
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </a>
          </Button>
        </div>
      </Card>

      {/* Support Section */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 flex-shrink-0">
            <MessageCircle className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({ id: 'help.support.title' })}
            </h3>
            <p className="text-muted-foreground text-sm mt-2">
              {formatMessage({ id: 'help.support.description' })}
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="/docs/faq" className="inline-flex items-center whitespace-nowrap">
                  <Book className="w-4 h-4 mr-2 flex-shrink-0" />
                  {formatMessage({ id: 'help.support.documentation' })}
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://github.com/catlog22/Claude-Code-Workflow/issues" target="_blank" rel="noopener noreferrer" className="inline-flex items-center whitespace-nowrap">
                  <Video className="w-4 h-4 mr-2 flex-shrink-0" />
                  {formatMessage({ id: 'help.support.tutorials' })}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default HelpPage;
