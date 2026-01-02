'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Progress,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@skillancer/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  GripVertical,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useState } from 'react';

import { apiClient } from '@/lib/api-client';

interface RoadmapPageProps {
  engagementId: string;
}

interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
}

interface Initiative {
  id: string;
  title: string;
  description: string | null;
  quarter: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  category: string | null;
  priority: number;
  ownerName: string | null;
  jiraEpicUrl: string | null;
  githubIssueUrl: string | null;
  milestones: Milestone[];
}

interface Roadmap {
  id: string;
  title: string;
  description: string | null;
  timeframe: string | null;
  initiatives: Initiative[];
}

type ViewMode = 'kanban' | 'list' | 'timeline';

export function RoadmapPage({ engagementId }: RoadmapPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const queryClient = useQueryClient();

  const { data: roadmap, isLoading } = useQuery({
    queryKey: ['roadmap', engagementId],
    queryFn: async () => {
      const response = await apiClient.get<{ data: Roadmap }>(
        `/engagements/${engagementId}/roadmap`
      );
      return response.data;
    },
  });

  const createInitiativeMutation = useMutation({
    mutationFn: async (data: Partial<Initiative>) => {
      await apiClient.post(`/roadmaps/${roadmap?.id}/initiatives`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', engagementId] });
      setShowCreateDialog(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      progress,
    }: {
      id: string;
      status: string;
      progress?: number;
    }) => {
      await apiClient.patch(`/initiatives/${id}/status`, { status, progress });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', engagementId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!roadmap) {
    return <CreateRoadmapPrompt engagementId={engagementId} />;
  }

  const groupedByStatus = groupInitiativesByStatus(roadmap.initiatives);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{roadmap.title}</h1>
          {roadmap.description && (
            <p className="text-muted-foreground mt-1">{roadmap.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Initiative
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New Initiative</DialogTitle>
              </DialogHeader>
              <InitiativeForm
                isLoading={createInitiativeMutation.isPending}
                onSubmit={(data) => createInitiativeMutation.mutate(data)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Bar */}
      <RoadmapStats initiatives={roadmap.initiatives} />

      {/* Main Content */}
      {viewMode === 'kanban' && (
        <KanbanView
          groupedInitiatives={groupedByStatus}
          onEdit={setEditingInitiative}
          onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
        />
      )}

      {viewMode === 'list' && (
        <ListView initiatives={roadmap.initiatives} onEdit={setEditingInitiative} />
      )}

      {viewMode === 'timeline' && <TimelineView initiatives={roadmap.initiatives} />}

      {/* Edit Dialog */}
      <Dialog open={!!editingInitiative} onOpenChange={() => setEditingInitiative(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Initiative</DialogTitle>
          </DialogHeader>
          {editingInitiative && (
            <InitiativeForm initialData={editingInitiative} isLoading={false} onSubmit={() => {}} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Sub-components ====================

function CreateRoadmapPrompt({ engagementId }: { engagementId: string }) {
  const [title, setTitle] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/roadmaps', {
        engagementId,
        title: title || 'Technical Roadmap',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', engagementId] });
    },
  });

  return (
    <Card className="mx-auto mt-16 max-w-md">
      <CardHeader>
        <CardTitle>Create Technical Roadmap</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Roadmap Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button
          className="w-full"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create Roadmap
        </Button>
      </CardContent>
    </Card>
  );
}

function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="bg-muted flex rounded-lg p-1">
      {(['kanban', 'list', 'timeline'] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === mode
              ? 'bg-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(mode)}
        >
          {mode.charAt(0).toUpperCase() + mode.slice(1)}
        </button>
      ))}
    </div>
  );
}

function RoadmapStats({ initiatives }: { initiatives: Initiative[] }) {
  const stats = {
    total: initiatives.length,
    completed: initiatives.filter((i) => i.status === 'COMPLETED').length,
    inProgress: initiatives.filter((i) => i.status === 'IN_PROGRESS').length,
    blocked: initiatives.filter((i) => i.status === 'BLOCKED').length,
  };
  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-4">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-muted-foreground text-sm">Total Initiatives</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-muted-foreground text-sm">Completed</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          <p className="text-muted-foreground text-sm">In Progress</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
          <p className="text-muted-foreground text-sm">Blocked</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <p className="text-2xl font-bold">{completionRate}%</p>
          <Progress className="mt-1" value={completionRate} />
        </CardContent>
      </Card>
    </div>
  );
}

function KanbanView({
  groupedInitiatives,
  onStatusChange,
  onEdit,
}: {
  groupedInitiatives: Record<string, Initiative[]>;
  onStatusChange: (id: string, status: string) => void;
  onEdit: (initiative: Initiative) => void;
}) {
  const columns = ['PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
  const columnLabels: Record<string, string> = {
    PLANNED: 'Planned',
    IN_PROGRESS: 'In Progress',
    BLOCKED: 'Blocked',
    COMPLETED: 'Completed',
  };
  const columnColors: Record<string, string> = {
    PLANNED: 'border-gray-300',
    IN_PROGRESS: 'border-blue-400',
    BLOCKED: 'border-red-400',
    COMPLETED: 'border-green-400',
  };

  return (
    <div className="grid grid-cols-4 gap-4">
      {columns.map((status) => (
        <div
          key={status}
          className={`rounded-lg border-t-4 ${columnColors[status]} bg-muted/50 p-3`}
        >
          <h3 className="mb-3 flex items-center justify-between font-medium">
            {columnLabels[status]}
            <Badge variant="secondary">{groupedInitiatives[status]?.length || 0}</Badge>
          </h3>
          <div className="space-y-2">
            {(groupedInitiatives[status] || []).map((initiative) => (
              <InitiativeCard
                key={initiative.id}
                initiative={initiative}
                onEdit={() => onEdit(initiative)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InitiativeCard({ initiative, onEdit }: { initiative: Initiative; onEdit: () => void }) {
  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onEdit}>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between">
          <h4 className="line-clamp-2 text-sm font-medium">{initiative.title}</h4>
          <GripVertical className="text-muted-foreground h-4 w-4 shrink-0" />
        </div>

        {initiative.quarter && (
          <Badge className="text-xs" variant="outline">
            {initiative.quarter}
          </Badge>
        )}

        <div className="space-y-1">
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>Progress</span>
            <span>{initiative.progress}%</span>
          </div>
          <Progress className="h-1.5" value={initiative.progress} />
        </div>

        {initiative.ownerName && (
          <p className="text-muted-foreground text-xs">👤 {initiative.ownerName}</p>
        )}

        {initiative.milestones.length > 0 && (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <CheckCircle className="h-3 w-3" />
            {initiative.milestones.filter((m) => m.completed).length}/{initiative.milestones.length}{' '}
            milestones
          </div>
        )}

        <div className="flex gap-1">
          {initiative.jiraEpicUrl && (
            <a
              href={initiative.jiraEpicUrl}
              rel="noopener noreferrer"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
            >
              <Badge className="text-xs" variant="secondary">
                Jira
              </Badge>
            </a>
          )}
          {initiative.githubIssueUrl && (
            <a
              href={initiative.githubIssueUrl}
              rel="noopener noreferrer"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
            >
              <Badge className="text-xs" variant="secondary">
                GitHub
              </Badge>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ListView({
  initiatives,
  onEdit,
}: {
  initiatives: Initiative[];
  onEdit: (i: Initiative) => void;
}) {
  return (
    <div className="space-y-2">
      {initiatives.map((initiative) => (
        <Card
          key={initiative.id}
          className="cursor-pointer hover:shadow-md"
          onClick={() => onEdit(initiative)}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <StatusIcon status={initiative.status} />
              <div>
                <h4 className="font-medium">{initiative.title}</h4>
                <p className="text-muted-foreground text-sm">
                  {initiative.quarter || 'Unscheduled'} • {initiative.ownerName || 'Unassigned'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24">
                <Progress value={initiative.progress} />
              </div>
              <span className="w-12 text-right text-sm font-medium">{initiative.progress}%</span>
              <ChevronRight className="text-muted-foreground h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TimelineView({ initiatives }: { initiatives: Initiative[] }) {
  const quarters = [...new Set(initiatives.map((i) => i.quarter || 'Unscheduled'))].sort();

  return (
    <div className="space-y-6">
      {quarters.map((quarter) => (
        <div key={quarter}>
          <h3 className="mb-3 text-lg font-semibold">{quarter}</h3>
          <div className="border-muted space-y-2 border-l-2 pl-4">
            {initiatives
              .filter((i) => (i.quarter || 'Unscheduled') === quarter)
              .map((initiative) => (
                <div key={initiative.id} className="relative pl-4">
                  <div className="bg-background border-primary absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2" />
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{initiative.title}</h4>
                        <StatusBadge status={initiative.status} />
                      </div>
                      <Progress className="mt-2 h-1.5" value={initiative.progress} />
                    </CardContent>
                  </Card>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'IN_PROGRESS':
      return <Clock className="h-5 w-5 text-blue-500" />;
    case 'BLOCKED':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PLANNED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    BLOCKED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  };
  return <Badge className={colors[status] || colors.PLANNED}>{status.replace('_', ' ')}</Badge>;
}

function InitiativeForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Initiative;
  onSubmit: (data: Partial<Initiative>) => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [quarter, setQuarter] = useState(initialData?.quarter || '');
  const [status, setStatus] = useState(initialData?.status || 'PLANNED');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ title, description, quarter, status });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium">Title</label>
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Quarter</label>
          <Input
            placeholder="Q1 2025"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as Initiative['status'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLANNED">Planned</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full" disabled={isLoading} type="submit">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {initialData ? 'Update' : 'Create'} Initiative
      </Button>
    </form>
  );
}

function groupInitiativesByStatus(initiatives: Initiative[]): Record<string, Initiative[]> {
  return initiatives.reduce(
    (acc, initiative) => {
      const status = initiative.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(initiative);
      return acc;
    },
    {} as Record<string, Initiative[]>
  );
}

export default RoadmapPage;
