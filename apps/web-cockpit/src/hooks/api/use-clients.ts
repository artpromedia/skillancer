/**
 * Clients API Hooks
 *
 * React Query hooks for client management operations.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  clientsService,
  type Client,
  type ClientCreate,
  type ClientUpdate,
  type ClientFilters,
  type ClientStats,
  type ClientActivity,
  type ClientSummary,
  type ClientDocument,
  type ClientContact,
} from '../lib/api/services/clients';

import type { ApiResponse, PaginatedResponse } from '@skillancer/shared-api-client';

// =============================================================================
// Query Keys
// =============================================================================

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (filters: ClientFilters) => [...clientKeys.lists(), filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  stats: (id: string) => [...clientKeys.detail(id), 'stats'] as const,
  activity: (id: string) => [...clientKeys.detail(id), 'activity'] as const,
  documents: (id: string) => [...clientKeys.detail(id), 'documents'] as const,
  projects: (id: string) => [...clientKeys.detail(id), 'projects'] as const,
  invoices: (id: string) => [...clientKeys.detail(id), 'invoices'] as const,
  summary: () => [...clientKeys.all, 'summary'] as const,
};

// =============================================================================
// List Hooks
// =============================================================================

export function useClients(
  filters: ClientFilters = {},
  options?: Omit<UseQueryOptions<PaginatedResponse<Client>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.list(filters),
    queryFn: () => clientsService.list(filters),
    ...options,
  });
}

export function useClientsSummary(
  options?: Omit<UseQueryOptions<ApiResponse<ClientSummary>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.summary(),
    queryFn: () => clientsService.getSummary(),
    ...options,
  });
}

// =============================================================================
// Detail Hooks
// =============================================================================

export function useClient(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<Client>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientsService.getById(id),
    enabled: !!id,
    ...options,
  });
}

export function useClientStats(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ClientStats>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.stats(id),
    queryFn: () => clientsService.getStats(id),
    enabled: !!id,
    ...options,
  });
}

export function useClientActivity(
  id: string,
  params?: { page?: number; limit?: number },
  options?: Omit<UseQueryOptions<PaginatedResponse<ClientActivity>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.activity(id),
    queryFn: () => clientsService.getActivity(id, params),
    enabled: !!id,
    ...options,
  });
}

export function useClientDocuments(
  id: string,
  options?: Omit<UseQueryOptions<ApiResponse<ClientDocument[]>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: clientKeys.documents(id),
    queryFn: () => clientsService.getDocuments(id),
    enabled: !!id,
    ...options,
  });
}

export function useClientProjects(
  id: string,
  options?: Omit<
    UseQueryOptions<ApiResponse<Array<{ id: string; name: string; status: string }>>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: clientKeys.projects(id),
    queryFn: () => clientsService.getProjects(id),
    enabled: !!id,
    ...options,
  });
}

export function useClientInvoices(
  id: string,
  options?: Omit<
    UseQueryOptions<
      ApiResponse<Array<{ id: string; invoiceNumber: string; status: string; total: number }>>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: clientKeys.invoices(id),
    queryFn: () => clientsService.getInvoices(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// CRUD Mutations
// =============================================================================

export function useCreateClient(
  options?: UseMutationOptions<ApiResponse<Client>, Error, ClientCreate>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClientCreate) => clientsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.summary() });
    },
    ...options,
  });
}

export function useUpdateClient(
  options?: UseMutationOptions<ApiResponse<Client>, Error, { id: string; data: ClientUpdate }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => clientsService.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteClient(options?: UseMutationOptions<ApiResponse<void>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.summary() });
    },
    ...options,
  });
}

export function useArchiveClient(options?: UseMutationOptions<ApiResponse<Client>, Error, string>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.archive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.summary() });
    },
    ...options,
  });
}

export function useUnarchiveClient(
  options?: UseMutationOptions<ApiResponse<Client>, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.unarchive(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.summary() });
    },
    ...options,
  });
}

// =============================================================================
// Contact Mutations
// =============================================================================

export function useAddClientContact(
  options?: UseMutationOptions<
    ApiResponse<Client>,
    Error,
    { clientId: string; data: Omit<ClientContact, 'id'> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }) => clientsService.addContact(clientId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    },
    ...options,
  });
}

export function useUpdateClientContact(
  options?: UseMutationOptions<
    ApiResponse<Client>,
    Error,
    { clientId: string; contactId: string; data: Partial<ClientContact> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId, data }) =>
      clientsService.updateContact(clientId, contactId, data),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    },
    ...options,
  });
}

export function useDeleteClientContact(
  options?: UseMutationOptions<ApiResponse<Client>, Error, { clientId: string; contactId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId }) => clientsService.deleteContact(clientId, contactId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    },
    ...options,
  });
}

export function useSetPrimaryContact(
  options?: UseMutationOptions<ApiResponse<Client>, Error, { clientId: string; contactId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactId }) => clientsService.setPrimaryContact(clientId, contactId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
    },
    ...options,
  });
}

// =============================================================================
// Document Mutations
// =============================================================================

export function useUploadClientDocument(
  options?: UseMutationOptions<ApiResponse<ClientDocument>, Error, { clientId: string; file: File }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, file }) => clientsService.uploadDocument(clientId, file),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.documents(clientId) });
    },
    ...options,
  });
}

export function useDeleteClientDocument(
  options?: UseMutationOptions<ApiResponse<void>, Error, { clientId: string; documentId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, documentId }) => clientsService.deleteDocument(clientId, documentId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.documents(clientId) });
    },
    ...options,
  });
}

// =============================================================================
// Note Mutations
// =============================================================================

export function useAddClientNote(
  options?: UseMutationOptions<
    ApiResponse<ClientActivity>,
    Error,
    { clientId: string; content: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, content }) => clientsService.addNote(clientId, content),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(clientId) });
    },
    ...options,
  });
}

// =============================================================================
// Bulk Operations
// =============================================================================

export function useBulkUpdateClients(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number }>,
    Error,
    { ids: string[]; data: Partial<ClientUpdate> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, data }) => clientsService.bulkUpdate(ids, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
    ...options,
  });
}

export function useBulkArchiveClients(
  options?: UseMutationOptions<ApiResponse<{ archived: number }>, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => clientsService.bulkArchive(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
    ...options,
  });
}

export function useImportClients(
  options?: UseMutationOptions<ApiResponse<{ imported: number; errors: string[] }>, Error, File>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => clientsService.import(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all });
    },
    ...options,
  });
}
