import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { CoordinatorInputModal } from './CoordinatorInputModal';

// Mock zustand stores
vi.mock('@/stores/coordinatorStore', () => ({
  useCoordinatorStore: () => ({
    startCoordinator: vi.fn(),
  }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const mockMessages = {
  'coordinator.modal.title': 'Start Coordinator',
  'coordinator.modal.description': 'Describe the task',
  'coordinator.form.taskDescription': 'Task Description',
  'coordinator.form.taskDescriptionPlaceholder': 'Enter task description',
  'coordinator.form.parameters': 'Parameters',
  'coordinator.form.parametersPlaceholder': '{"key": "value"}',
  'coordinator.form.parametersHelp': 'Optional JSON parameters',
  'coordinator.form.characterCount': '{current} / {max} characters (min: {min})',
  'coordinator.form.start': 'Start',
  'coordinator.form.starting': 'Starting...',
  'coordinator.validation.taskDescriptionRequired': 'Task description is required',
  'coordinator.validation.taskDescriptionTooShort': 'Too short',
  'coordinator.validation.taskDescriptionTooLong': 'Too long',
  'coordinator.validation.parametersInvalidJson': 'Invalid JSON',
  'common.actions.cancel': 'Cancel',
};

const renderWithIntl = (ui: React.ReactElement) => {
  return render(
    <IntlProvider locale="en" messages={mockMessages}>
      {ui}
    </IntlProvider>
  );
};

describe('CoordinatorInputModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    renderWithIntl(<CoordinatorInputModal open={true} onClose={mockOnClose} />);

    expect(screen.getByText('Start Coordinator')).toBeInTheDocument();
    expect(screen.getByText('Describe the task')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithIntl(<CoordinatorInputModal open={false} onClose={mockOnClose} />);

    expect(screen.queryByText('Start Coordinator')).not.toBeInTheDocument();
  });

  it('should show validation error for empty task description', async () => {
    renderWithIntl(<CoordinatorInputModal open={true} onClose={mockOnClose} />);

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Task description is required')).toBeInTheDocument();
    });
  });

  it('should show validation error for short task description', async () => {
    renderWithIntl(<CoordinatorInputModal open={true} onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText('Enter task description');
    fireEvent.change(textarea, { target: { value: 'Short' } });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Too short')).toBeInTheDocument();
    });
  });

  it('should show validation error for invalid JSON parameters', async () => {
    renderWithIntl(<CoordinatorInputModal open={true} onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText('Enter task description');
    fireEvent.change(textarea, { target: { value: 'Valid task description here' } });

    const paramsInput = screen.getByPlaceholderText('{"key": "value"}');
    fireEvent.change(paramsInput, { target: { value: 'invalid json' } });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
    });
  });

  it('should submit with valid task description', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = mockFetch;

    renderWithIntl(<CoordinatorInputModal open={true} onClose={mockOnClose} />);

    const textarea = screen.getByPlaceholderText('Enter task description');
    fireEvent.change(textarea, { target: { value: 'Valid task description with more than 10 characters' } });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/coordinator/start',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });
});
