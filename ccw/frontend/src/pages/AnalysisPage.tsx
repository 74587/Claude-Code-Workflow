// ========================================
// Analysis Viewer Page
// ========================================
// View analysis sessions from /workflow:analyze-with-file command

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch,
  Search,
  Calendar,
  CheckCircle,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Code,
  MessageSquare,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { fetchAnalysisSessions, fetchAnalysisDetail } from '@/lib/api';
import { MessageRenderer } from '@/components/shared/CliStreamMonitor/MessageRenderer';
import { JsonCardView } from '@/components/shared/JsonCardView';
import type { AnalysisSessionSummary } from '@/types/analysis';

// ========== Session Card Component ==========

interface SessionCardProps {
  session: AnalysisSessionSummary;
  onClick: () => void;
  isSelected: boolean;
}

function SessionCard({ session, onClick, isSelected }: SessionCardProps) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-colors ${
        isSelected ? 'ring-2 ring-primary bg-accent/50' : 'hover:bg-accent/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileSearch className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium truncate">{session.topic}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{session.id}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
          {session.status === 'completed' ? (
            <><CheckCircle className="w-3 h-3 mr-1" />完成</>
          ) : (
            <><Clock className="w-3 h-3 mr-1" />进行中</>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {session.createdAt}
        </span>
      </div>
    </Card>
  );
}

// ========== Detail Panel Component ==========

interface DetailPanelProps {
  sessionId: string;
  projectPath: string;
  onClose: () => void;
}

function DetailPanel({ sessionId, projectPath, onClose }: DetailPanelProps) {
  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['analysis-detail', sessionId, projectPath],
    queryFn: () => fetchAnalysisDetail(sessionId, projectPath),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>加载失败: {(error as Error).message}</span>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  // Build available tabs based on content
  const tabs = [
    { id: 'discussion', label: '讨论记录', icon: MessageSquare, content: detail.discussion },
    { id: 'conclusions', label: '结论', icon: CheckCircle, content: detail.conclusions },
    { id: 'explorations', label: '代码探索', icon: Code, content: detail.explorations },
    { id: 'perspectives', label: '视角分析', icon: FileText, content: detail.perspectives },
  ].filter(tab => tab.content);

  const defaultTab = tabs[0]?.id || 'discussion';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="font-semibold truncate">{detail.topic}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={detail.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
              {detail.status === 'completed' ? '完成' : '进行中'}
            </Badge>
            <span className="text-xs text-muted-foreground">{detail.createdAt}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs Content */}
      {tabs.length > 0 ? (
        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-4 shrink-0 w-fit">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-auto min-h-0 p-4">
            {/* Discussion Tab */}
            <TabsContent value="discussion" className="mt-0 h-full">
              {detail.discussion && (
                <MessageRenderer content={detail.discussion} format="markdown" />
              )}
            </TabsContent>

            {/* Conclusions Tab */}
            <TabsContent value="conclusions" className="mt-0 h-full">
              {detail.conclusions && (
                <JsonCardView data={detail.conclusions} />
              )}
            </TabsContent>

            {/* Explorations Tab */}
            <TabsContent value="explorations" className="mt-0 h-full">
              {detail.explorations && (
                <JsonCardView data={detail.explorations} />
              )}
            </TabsContent>

            {/* Perspectives Tab */}
            <TabsContent value="perspectives" className="mt-0 h-full">
              {detail.perspectives && (
                <JsonCardView data={detail.perspectives} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          暂无分析内容
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========

export function AnalysisPage() {
  const projectPath = useWorkflowStore((state) => state.projectPath);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['analysis-sessions', projectPath],
    queryFn: () => fetchAnalysisSessions(projectPath),
  });

  // Filter sessions by search query
  const filteredSessions = sessions.filter((session) =>
    session.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Panel - List */}
      <div className={`p-6 space-y-6 overflow-auto ${selectedSession ? 'w-[400px] shrink-0' : 'flex-1'}`}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="w-6 h-6" />
            Analysis Viewer
          </h1>
          <p className="text-muted-foreground mt-1">
            查看 /workflow:analyze-with-file 命令的分析结果
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索分析会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>加载失败: {(error as Error).message}</span>
            </div>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card className="p-12 text-center">
            <FileSearch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? '没有匹配的分析会话' : '暂无分析会话'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              使用 /workflow:analyze-with-file 命令创建分析
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isSelected={selectedSession === session.id}
                onClick={() => setSelectedSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - Detail */}
      {selectedSession && (
        <div className="flex-1 border-l bg-background min-w-0">
          <DetailPanel
            sessionId={selectedSession}
            projectPath={projectPath}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}
    </div>
  );
}

export default AnalysisPage;
