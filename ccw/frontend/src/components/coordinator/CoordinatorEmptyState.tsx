// ========================================
// CoordinatorEmptyState Component
// ========================================
// Modern empty state with tech-inspired design for coordinator start page

import { useIntl } from 'react-intl';
import { Play, Rocket, Zap, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface CoordinatorEmptyStateProps {
  onStart: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Empty state component with modern tech-inspired design
 * Displays when no coordinator execution is active
 */
export function CoordinatorEmptyState({
  onStart,
  disabled = false,
  className,
}: CoordinatorEmptyStateProps) {
  const { formatMessage } = useIntl();

  return (
    <div
      className={cn(
        'relative flex items-center justify-center min-h-[600px] overflow-hidden',
        className
      )}
    >
      {/* Animated Background - Using theme colors with gradient utilities */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-background animate-slow-gradient">
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(var(--primary) 1px, transparent 1px),
              linear-gradient(90deg, var(--primary) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />

        {/* Animated Gradient Orbs - Using gradient utility classes */}
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl animate-pulse bg-gradient-primary opacity-15" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse opacity-15"
          style={{
            background: 'radial-gradient(circle, hsl(var(--secondary)) 0%, transparent 70%)',
            animationDelay: '1s',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl animate-pulse bg-gradient-primary opacity-10" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-8 text-center">
        {/* Hero Icon */}
        <div className="relative mb-8 inline-block">
          <div 
            className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse"
            style={{ background: 'hsl(var(--primary))' }}
          />
          <div 
            className="relative p-6 rounded-full shadow-2xl text-white"
            style={{ background: 'hsl(var(--primary))' }}
          >
            <Rocket className="w-16 h-16" strokeWidth={2} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4 text-foreground">
          {formatMessage({ id: 'coordinator.emptyState.title' })}
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground mb-12 max-w-lg mx-auto">
          {formatMessage({ id: 'coordinator.emptyState.subtitle' })}
        </p>

        {/* Start Button - Using primary theme color */}
        <Button
          size="lg"
          onClick={onStart}
          disabled={disabled}
          className="group relative px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          style={{
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
          }}
        >
          <Play className="w-6 h-6 mr-2 group-hover:scale-110 transition-transform" />
          {formatMessage({ id: 'coordinator.emptyState.startButton' })}
          <div 
            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity blur-xl"
            style={{ background: 'hsl(var(--primary) / 0.3)' }}
          />
        </Button>

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="group relative bg-card/80 backdrop-blur-sm rounded-xl p-6 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div 
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'hsl(var(--primary) / 0.05)' }}
            />
            <div className="relative">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2 text-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature1.title' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature1.description' })}
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-card/80 backdrop-blur-sm rounded-xl p-6 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div 
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'hsl(var(--secondary) / 0.05)' }}
            />
            <div className="relative">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))' }}
              >
                <GitBranch className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2 text-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature2.title' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature2.description' })}
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-card/80 backdrop-blur-sm rounded-xl p-6 border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div 
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'hsl(var(--accent) / 0.05)' }}
            />
            <div className="relative">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{ background: 'hsl(var(--accent) / 0.1)', color: 'hsl(var(--accent))' }}
              >
                <Play className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2 text-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature3.title' })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'coordinator.emptyState.feature3.description' })}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mt-12 text-left bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border">
          <h3 className="font-semibold mb-4 text-foreground flex items-center gap-2">
            <span 
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: 'hsl(var(--primary))' }}
            >
              ✓
            </span>
            {formatMessage({ id: 'coordinator.emptyState.quickStart.title' })}
          </h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 text-white"
                style={{ background: 'hsl(var(--primary))' }}
              >
                1
              </span>
              <p>{formatMessage({ id: 'coordinator.emptyState.quickStart.step1' })}</p>
            </div>
            <div className="flex items-start gap-3">
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 text-white"
                style={{ background: 'hsl(var(--secondary))' }}
              >
                2
              </span>
              <p>{formatMessage({ id: 'coordinator.emptyState.quickStart.step2' })}</p>
            </div>
            <div className="flex items-start gap-3">
              <span 
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5 text-white"
                style={{ background: 'hsl(var(--accent))' }}
              >
                3
              </span>
              <p>{formatMessage({ id: 'coordinator.emptyState.quickStart.step3' })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorEmptyState;
