// ========================================
// Endpoints Page Tests
// ========================================
// Tests for the CLI endpoints page with i18n

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/i18n';
import userEvent from '@testing-library/user-event';
import { EndpointsPage } from './EndpointsPage';
import type { CliEndpoint } from '@/lib/api';

const mockEndpoints: CliEndpoint[] = [
  {
    id: 'ep-1',
    name: 'Endpoint 1',
    type: 'custom',
    enabled: true,
    config: { foo: 'bar' },
  },
];

const createEndpointMock = vi.fn();
const updateEndpointMock = vi.fn();
const deleteEndpointMock = vi.fn();
const toggleEndpointMock = vi.fn();

vi.mock('@/hooks', () => ({
  useCliEndpoints: () => ({
    endpoints: mockEndpoints,
    litellmEndpoints: [],
    customEndpoints: mockEndpoints,
    wrapperEndpoints: [],
    totalCount: mockEndpoints.length,
    enabledCount: mockEndpoints.length,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
  useToggleCliEndpoint: () => ({
    toggleEndpoint: toggleEndpointMock,
    isToggling: false,
    error: null,
  }),
  useCreateCliEndpoint: () => ({
    createEndpoint: createEndpointMock,
    isCreating: false,
    error: null,
  }),
  useUpdateCliEndpoint: () => ({
    updateEndpoint: updateEndpointMock,
    isUpdating: false,
    error: null,
  }),
  useDeleteCliEndpoint: () => ({
    deleteEndpoint: deleteEndpointMock,
    isDeleting: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('EndpointsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // confirm() used for delete
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('should render page title', () => {
    render(<EndpointsPage />, { locale: 'en' });
    expect(screen.getByText(/CLI Endpoints/i)).toBeInTheDocument();
  });

  it('should open create dialog and call createEndpoint', async () => {
    const user = userEvent.setup();
    createEndpointMock.mockResolvedValueOnce({ id: 'ep-2' });

    render(<EndpointsPage />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: /Add Endpoint/i }));

    expect(screen.getByText(/Add Endpoint/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Name/i), 'New Endpoint');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(createEndpointMock).toHaveBeenCalledWith({
        name: 'New Endpoint',
        type: 'custom',
        enabled: true,
        config: {},
      });
    });
  });

  it('should open edit dialog when edit clicked', async () => {
    const user = userEvent.setup();
    updateEndpointMock.mockResolvedValueOnce({});

    render(<EndpointsPage />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: /Edit Endpoint/i }));

    expect(screen.getByText(/Edit Endpoint/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ID$/i)).toHaveValue('ep-1');
  });

  it('should call deleteEndpoint when delete confirmed', async () => {
    const user = userEvent.setup();
    deleteEndpointMock.mockResolvedValueOnce(undefined);

    render(<EndpointsPage />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: /Delete Endpoint/i }));

    await waitFor(() => {
      expect(deleteEndpointMock).toHaveBeenCalledWith('ep-1');
    });
  });
});
