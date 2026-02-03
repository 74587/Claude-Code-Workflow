// ========================================
// Ticker Demo Page
// ========================================
// Development demo for TickerMarquee component

import * as React from 'react';
import { TickerMarquee } from '@/components/shared';
import type { TickerMessage } from '@/hooks/useRealtimeUpdates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const MOCK_MESSAGES: TickerMessage[] = [
  {
    id: 'msg-1',
    text: 'Session WFS-feature-auth completed successfully',
    type: 'session',
    link: '/sessions/WFS-feature-auth',
    timestamp: Date.now() - 60000,
  },
  {
    id: 'msg-2',
    text: 'Task IMPL-001 completed: Implement authentication module',
    type: 'task',
    link: '/tasks/IMPL-001',
    timestamp: Date.now() - 50000,
  },
  {
    id: 'msg-3',
    text: 'Workflow authentication-system started',
    type: 'workflow',
    link: '/workflows/authentication-system',
    timestamp: Date.now() - 40000,
  },
  {
    id: 'msg-4',
    text: 'Build status changed to passing',
    type: 'status',
    timestamp: Date.now() - 30000,
  },
  {
    id: 'msg-5',
    text: 'Session WFS-bugfix-login created',
    type: 'session',
    link: '/sessions/WFS-bugfix-login',
    timestamp: Date.now() - 20000,
  },
  {
    id: 'msg-6',
    text: 'Task IMPL-002 completed: Add JWT validation',
    type: 'task',
    link: '/tasks/IMPL-002',
    timestamp: Date.now() - 10000,
  },
];

export default function TickerDemo() {
  const [speed, setSpeed] = React.useState(30);
  const [showMockMessages, setShowMockMessages] = React.useState(true);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Ticker Marquee Demo</h1>
          <p className="text-muted-foreground">
            Real-time WebSocket ticker with CSS marquee animation
          </p>
        </div>

        {/* Live Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Live Ticker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TickerMarquee
              duration={speed}
              mockMessages={showMockMessages ? MOCK_MESSAGES : undefined}
            />

            <div className="flex items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Speed (seconds):</label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{speed}s</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMockMessages(!showMockMessages)}
              >
                {showMockMessages ? 'Use WebSocket' : 'Use Mock Data'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Examples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Basic Usage</h3>
              <pre className="rounded-md bg-muted p-4 text-sm">
                {`<TickerMarquee />`}
              </pre>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Custom Endpoint and Duration</h3>
              <pre className="rounded-md bg-muted p-4 text-sm">
                {`<TickerMarquee
  endpoint="ws/custom-ticker"
  duration={45}
/>`}
              </pre>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">With Mock Messages (Development)</h3>
              <pre className="rounded-md bg-muted p-4 text-sm">
                {`<TickerMarquee
  mockMessages={[
    {
      id: '1',
      text: 'Session completed',
      type: 'session',
      link: '/sessions/WFS-001',
      timestamp: Date.now(),
    }
  ]}
/>`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Message Format */}
        <Card>
          <CardHeader>
            <CardTitle>WebSocket Message Format</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-sm">
              {JSON.stringify(
                {
                  id: 'msg-001',
                  text: 'Session WFS-feature-auth completed',
                  type: 'session',
                  link: '/sessions/WFS-feature-auth',
                  timestamp: Date.now(),
                },
                null,
                2
              )}
            </pre>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                <strong>Message Types:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>
                  <code className="rounded bg-primary/10 px-1 text-primary">session</code> -
                  Session events (primary color)
                </li>
                <li>
                  <code className="rounded bg-success/10 px-1 text-success">task</code> - Task
                  completions (success color)
                </li>
                <li>
                  <code className="rounded bg-info/10 px-1 text-info">workflow</code> - Workflow
                  events (info color)
                </li>
                <li>
                  <code className="rounded bg-warning/10 px-1 text-warning">status</code> - Status
                  changes (warning color)
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                60 FPS CSS marquee animation (GPU-accelerated)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Pause-on-hover interaction
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Automatic WebSocket reconnection (exponential backoff)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Type-safe message validation (Zod schema)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Clickable message links
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Internationalization support (i18n)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Message buffer management (max 50 messages)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-success">✓</span>
                Mock message support for development
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
