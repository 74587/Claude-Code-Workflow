// ========================================
// CodexLens GPU Selector
// ========================================
// GPU detection, listing, and selection component

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Cpu, Search, Check, X, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCodexLensGpu, useSelectGpu } from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import type { CodexLensGpuDevice } from '@/lib/api';

interface GpuSelectorProps {
  enabled?: boolean;
  compact?: boolean;
}

export function GpuSelector({ enabled = true, compact = false }: GpuSelectorProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();

  const {
    supported,
    devices,
    selectedDeviceId,
    isLoadingDetect,
    isLoadingList,
    refetch,
  } = useCodexLensGpu({ enabled });

  const { selectGpu, resetGpu, isSelecting, isResetting } = useSelectGpu();

  const [isDetecting, setIsDetecting] = useState(false);

  const isLoading = isLoadingDetect || isLoadingList || isDetecting;

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      await refetch();
      success(
        formatMessage({ id: 'codexlens.gpu.detectSuccess' }),
        formatMessage({ id: 'codexlens.gpu.detectComplete' }, { count: devices?.length ?? 0 })
      );
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.gpu.detectFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.gpu.detectError' })
      );
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelect = async (deviceId: string | number) => {
    try {
      const result = await selectGpu(deviceId);
      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.gpu.selectSuccess' }),
          result.message || formatMessage({ id: 'codexlens.gpu.gpuSelected' })
        );
        refetch();
      } else {
        showError(
          formatMessage({ id: 'codexlens.gpu.selectFailed' }),
          result.message || formatMessage({ id: 'codexlens.gpu.selectError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.gpu.selectFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.gpu.unknownError' })
      );
    }
  };

  const handleReset = async () => {
    try {
      const result = await resetGpu();
      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.gpu.resetSuccess' }),
          result.message || formatMessage({ id: 'codexlens.gpu.gpuReset' })
        );
        refetch();
      } else {
        showError(
          formatMessage({ id: 'codexlens.gpu.resetFailed' }),
          result.message || formatMessage({ id: 'codexlens.gpu.resetError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.gpu.resetFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.gpu.unknownError' })
      );
    }
  };

  if (compact) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'codexlens.gpu.status' })}:
            </span>
            {supported !== false ? (
              selectedDeviceId !== undefined ? (
                <Badge variant="success" className="text-xs">
                  {formatMessage({ id: 'codexlens.gpu.enabled' })}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {formatMessage({ id: 'codexlens.gpu.available' })}
                </Badge>
              )
            ) : (
              <Badge variant="secondary" className="text-xs">
                {formatMessage({ id: 'codexlens.gpu.unavailable' })}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetect}
              disabled={isLoading}
            >
              <Search className={cn('w-3 h-3 mr-1', isLoading && 'animate-spin')} />
              {formatMessage({ id: 'codexlens.gpu.detect' })}
            </Button>
            {selectedDeviceId !== undefined && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
              >
                <X className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'codexlens.gpu.reset' })}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              supported !== false ? 'bg-success/10' : 'bg-secondary'
            )}>
              <Cpu className={cn(
                'w-5 h-5',
                supported !== false ? 'text-success' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'codexlens.gpu.title' })}
              </h4>
              <p className="text-xs text-muted-foreground">
                {supported !== false
                  ? formatMessage({ id: 'codexlens.gpu.supported' })
                  : formatMessage({ id: 'codexlens.gpu.notSupported' })
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDetect}
              disabled={isLoading}
            >
              <Search className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              {formatMessage({ id: 'codexlens.gpu.detect' })}
            </Button>
            {selectedDeviceId !== undefined && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isResetting && 'animate-spin')} />
                {formatMessage({ id: 'codexlens.gpu.reset' })}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Device List */}
      {devices && devices.length > 0 ? (
        <div className="space-y-2">
          {devices.map((device) => {
            const deviceId = device.device_id ?? device.index;
            return (
              <DeviceCard
                key={deviceId}
                device={device}
                isSelected={deviceId === selectedDeviceId}
                onSelect={() => handleSelect(deviceId)}
                isSelecting={isSelecting}
              />
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Cpu className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {supported !== false
              ? formatMessage({ id: 'codexlens.gpu.noDevices' })
              : formatMessage({ id: 'codexlens.gpu.notAvailable' })
            }
          </p>
        </Card>
      )}
    </div>
  );
}

interface DeviceCardProps {
  device: CodexLensGpuDevice;
  isSelected: boolean;
  onSelect: () => void;
  isSelecting: boolean;
}

function DeviceCard({ device, isSelected, onSelect, isSelecting }: DeviceCardProps) {
  const { formatMessage } = useIntl();

  return (
    <Card className={cn(
      'p-4 transition-colors',
      isSelected && 'border-primary bg-primary/5'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h5 className="text-sm font-medium text-foreground">
              {device.name || formatMessage({ id: 'codexlens.gpu.unknownDevice' })}
            </h5>
            {isSelected && (
              <Badge variant="success" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'codexlens.gpu.selected' })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'codexlens.gpu.type' })}: {formatMessage({ id: device.type === 'discrete' ? 'codexlens.gpu.discrete' : 'codexlens.gpu.integrated' })}
          </p>
          {device.memory?.total && (
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.gpu.memory' })}: {(device.memory.total / 1024).toFixed(1)} GB
            </p>
          )}
        </div>
        <Button
          variant={isSelected ? 'outline' : 'default'}
          size="sm"
          onClick={onSelect}
          disabled={isSelected || isSelecting}
        >
          {isSelected
            ? formatMessage({ id: 'codexlens.gpu.active' })
            : formatMessage({ id: 'codexlens.gpu.select' })
          }
        </Button>
      </div>
    </Card>
  );
}

export default GpuSelector;
