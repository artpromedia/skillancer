'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import {
  AlertCircle,
  Briefcase,
  Check,
  ChevronDown,
  Loader2,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  category: string;
  endorsementCount?: number;
}

export interface Connection {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  company?: string;
  relationship?: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator';
  lastProject?: {
    id: string;
    title: string;
    completedAt: string;
  };
  connectionStrength?: 'strong' | 'medium' | 'weak';
}

export interface Project {
  id: string;
  title: string;
  client: {
    id: string;
    name: string;
    avatar?: string;
  };
  completedAt: string;
  skills: string[];
}

export interface RequestEndorsementProps {
  skills: Skill[];
  connections: Connection[];
  projects?: Project[];
  onSubmit: (data: EndorsementRequestData) => Promise<void>;
  onCancel?: () => void;
  defaultSkillId?: string;
  defaultConnectionId?: string;
  className?: string;
}

export interface EndorsementRequestData {
  skillId: string;
  connectionId: string;
  projectId?: string;
  message: string;
}

interface RequestEndorsementModalProps extends Omit<RequestEndorsementProps, 'onCancel'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const suggestionTemplates = [
  {
    label: 'General',
    template:
      "Hi {name}, we worked together on {project}. Would you be willing to endorse my {skill} skills? I'd really appreciate it!",
  },
  {
    label: 'Client',
    template:
      'Hi {name}, I really enjoyed working on {project} with you. If you were satisfied with my {skill} work, would you consider endorsing me?',
  },
  {
    label: 'Colleague',
    template:
      "Hey {name}! Since we collaborated on {project}, I thought you'd be a great person to endorse my {skill} skills. Let me know if you'd be open to it!",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getConnectionStrengthColor(strength?: 'strong' | 'medium' | 'weak'): string {
  switch (strength) {
    case 'strong':
      return 'bg-green-100 text-green-700';
    case 'medium':
      return 'bg-amber-100 text-amber-700';
    case 'weak':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

// ============================================================================
// Skill Selector Component
// ============================================================================

function SkillSelector({
  skills,
  value,
  onChange,
}: Readonly<{
  skills: Skill[];
  value: string;
  onChange: (value: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const selectedSkill = skills.find((s) => s.id === value);

  // Group skills by category
  const groupedSkills = skills.reduce(
    (acc, skill) => {
      acc[skill.category] ??= [];
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-full justify-between"
          role="combobox"
          variant="outline"
        >
          {selectedSkill ? (
            <span className="flex items-center gap-2">
              {selectedSkill.name}
              {selectedSkill.endorsementCount !== undefined && (
                <Badge className="text-xs" variant="secondary">
                  {selectedSkill.endorsementCount} endorsements
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a skill...</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skill found.</CommandEmpty>
            {Object.entries(groupedSkills).map(([category, categorySkills]) => (
              <CommandGroup key={category} heading={category}>
                {categorySkills.map((skill) => (
                  <CommandItem
                    key={skill.id}
                    value={skill.name}
                    onSelect={() => {
                      onChange(skill.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === skill.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="flex-1">{skill.name}</span>
                    {skill.endorsementCount !== undefined && (
                      <span className="text-muted-foreground text-xs">
                        {skill.endorsementCount} endorsements
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Connection Selector Component
// ============================================================================

function ConnectionSelector({
  connections,
  value,
  onChange,
  suggestedIds = [],
}: Readonly<{
  connections: Connection[];
  value: string;
  onChange: (value: string) => void;
  suggestedIds?: string[];
}>) {
  const [open, setOpen] = useState(false);
  const selectedConnection = connections.find((c) => c.id === value);

  const suggestedConnections = connections.filter((c) => suggestedIds.includes(c.id));
  const otherConnections = connections.filter((c) => !suggestedIds.includes(c.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-full justify-between"
          role="combobox"
          variant="outline"
        >
          {selectedConnection ? (
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage alt={selectedConnection.name} src={selectedConnection.avatar} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(selectedConnection.name)}
                </AvatarFallback>
              </Avatar>
              {selectedConnection.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Select a connection...</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder="Search connections..." />
          <CommandList>
            <CommandEmpty>No connection found.</CommandEmpty>
            {suggestedConnections.length > 0 && (
              <CommandGroup heading="Suggested">
                {suggestedConnections.map((connection) => (
                  <CommandItem
                    key={connection.id}
                    value={connection.name}
                    onSelect={() => {
                      onChange(connection.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage alt={connection.name} src={connection.avatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(connection.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{connection.name}</p>
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        </div>
                        {connection.title && (
                          <p className="text-muted-foreground truncate text-xs">
                            {connection.title}
                            {connection.company && ` at ${connection.company}`}
                          </p>
                        )}
                      </div>
                      {value === connection.id && <Check className="h-4 w-4" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {otherConnections.length > 0 && (
              <CommandGroup heading="All Connections">
                {otherConnections.map((connection) => (
                  <CommandItem
                    key={connection.id}
                    value={connection.name}
                    onSelect={() => {
                      onChange(connection.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage alt={connection.name} src={connection.avatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(connection.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{connection.name}</p>
                        {connection.title && (
                          <p className="text-muted-foreground truncate text-xs">
                            {connection.title}
                            {connection.company && ` at ${connection.company}`}
                          </p>
                        )}
                      </div>
                      {connection.connectionStrength && (
                        <Badge
                          className={cn(
                            'text-xs',
                            getConnectionStrengthColor(connection.connectionStrength)
                          )}
                          variant="secondary"
                        >
                          {connection.connectionStrength}
                        </Badge>
                      )}
                      {value === connection.id && <Check className="h-4 w-4" />}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Selected Connection Preview
// ============================================================================

function ConnectionPreview({
  connection,
  onRemove,
}: Readonly<{
  connection: Connection;
  onRemove: () => void;
}>) {
  return (
    <Card className="bg-slate-50">
      <CardContent className="flex items-center gap-3 p-3">
        <Avatar className="h-10 w-10">
          <AvatarImage alt={connection.name} src={connection.avatar} />
          <AvatarFallback>{getInitials(connection.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{connection.name}</p>
          {connection.title && (
            <p className="text-muted-foreground text-sm">
              {connection.title}
              {connection.company && ` at ${connection.company}`}
            </p>
          )}
          {connection.lastProject && (
            <p className="text-muted-foreground text-xs">
              <Briefcase className="mr-1 inline h-3 w-3" />
              Last worked on: {connection.lastProject.title}
            </p>
          )}
        </div>
        <Button className="h-8 w-8 p-0" size="sm" variant="ghost" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Request Endorsement Form
// ============================================================================

export function RequestEndorsement({
  skills,
  connections,
  projects = [],
  onSubmit,
  onCancel,
  defaultSkillId,
  defaultConnectionId,
  className,
}: Readonly<RequestEndorsementProps>) {
  const [selectedSkillId, setSelectedSkillId] = useState(defaultSkillId || '');
  const [selectedConnectionId, setSelectedConnectionId] = useState(defaultConnectionId || '');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSkill = skills.find((s) => s.id === selectedSkillId);
  const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

  // Get suggested connections based on selected skill and recent projects
  const suggestedConnectionIds = connections
    .filter((c) => c.lastProject || c.connectionStrength === 'strong')
    .map((c) => c.id)
    .slice(0, 3);

  // Apply template
  const applyTemplate = (template: string) => {
    let filledTemplate = template;
    if (selectedConnection) {
      filledTemplate = filledTemplate.replace('{name}', selectedConnection.name.split(' ')[0]);
    }
    if (selectedSkill) {
      filledTemplate = filledTemplate.replace('{skill}', selectedSkill.name);
    }
    const project = selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId)
      : selectedConnection?.lastProject;
    if (project) {
      filledTemplate = filledTemplate.replace('{project}', project.title);
    } else {
      filledTemplate = filledTemplate.replace(' on {project}', '');
      filledTemplate = filledTemplate.replace('{project}', 'our project');
    }
    setMessage(filledTemplate);
  };

  const handleSubmit = async () => {
    if (!selectedSkillId || !selectedConnectionId) {
      setError('Please select a skill and connection');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        skillId: selectedSkillId,
        connectionId: selectedConnectionId,
        projectId: selectedProjectId || undefined,
        message,
      });
    } catch (err) {
      console.error('Failed to send endorsement request:', err);
      setError('Failed to send endorsement request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Skill Selection */}
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none">Which skill do you want endorsed?</span>
        <SkillSelector skills={skills} value={selectedSkillId} onChange={setSelectedSkillId} />
        {typeof selectedSkill?.endorsementCount === 'number' && (
          <p className="text-muted-foreground text-xs">
            You currently have {selectedSkill.endorsementCount} endorsement
            {selectedSkill.endorsementCount === 1 ? '' : 's'} for this skill
          </p>
        )}
      </div>

      {/* Connection Selection */}
      <div className="space-y-2">
        <span className="text-sm font-medium leading-none">Who would you like to ask?</span>
        <ConnectionSelector
          connections={connections}
          suggestedIds={suggestedConnectionIds}
          value={selectedConnectionId}
          onChange={setSelectedConnectionId}
        />
        {selectedConnection && (
          <ConnectionPreview
            connection={selectedConnection}
            onRemove={() => setSelectedConnectionId('')}
          />
        )}
      </div>

      {/* Project Context (Optional) */}
      {projects.length > 0 && (
        <div className="space-y-2">
          <Label>
            Related project <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a project for context..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {project.title}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Message */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Personal message <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <div className="flex gap-1">
            {suggestionTemplates.map((template) => (
              <Button
                key={template.label}
                className="h-6 text-xs"
                size="sm"
                variant="ghost"
                onClick={() => applyTemplate(template.template)}
              >
                {template.label}
              </Button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder="Add a personal note to your request..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Adding context about your work together increases response rates by 40%
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          disabled={!selectedSkillId || !selectedConnectionId || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Request
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Request Endorsement Modal
// ============================================================================

export function RequestEndorsementModal({
  open,
  onOpenChange,
  ...props
}: Readonly<RequestEndorsementModalProps>) {
  const handleSubmit = async (data: EndorsementRequestData) => {
    await props.onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Endorsement</DialogTitle>
          <DialogDescription>
            Ask a past client or colleague to endorse your skills. Endorsements help build trust
            with potential clients.
          </DialogDescription>
        </DialogHeader>

        <RequestEndorsement
          {...props}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Quick Request Button
// ============================================================================

export interface QuickRequestButtonProps {
  skill: Skill;
  suggestedConnection?: Connection;
  onRequest: (skillId: string, connectionId?: string) => void;
  className?: string;
}

export function QuickRequestButton({
  skill,
  suggestedConnection,
  onRequest,
  className,
}: Readonly<QuickRequestButtonProps>) {
  return (
    <Button
      className={cn('gap-2', className)}
      size="sm"
      variant="outline"
      onClick={() => onRequest(skill.id, suggestedConnection?.id)}
    >
      <Users className="h-4 w-4" />
      Get Endorsed
      {suggestedConnection && (
        <span className="text-muted-foreground">by {suggestedConnection.name.split(' ')[0]}</span>
      )}
    </Button>
  );
}
