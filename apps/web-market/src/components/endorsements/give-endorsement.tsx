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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import {
  AlertCircle,
  Award,
  Briefcase,
  Check,
  CheckCircle,
  Heart,
  Loader2,
  Sparkles,
  ThumbsUp,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Person {
  id: string;
  name: string;
  avatar?: string;
  title?: string;
  headline?: string;
  skills?: Array<{
    id: string;
    name: string;
    category: string;
  }>;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  completedAt: string;
  skills: string[];
}

export type RelationshipType =
  | 'client'
  | 'colleague'
  | 'manager'
  | 'mentor'
  | 'collaborator'
  | 'other';

export interface GiveEndorsementData {
  personId: string;
  skillId: string;
  relationship: RelationshipType;
  testimonial?: string;
  projectId?: string;
}

export interface GiveEndorsementProps {
  person: Person;
  projects?: Project[];
  onSubmit: (data: GiveEndorsementData) => Promise<void>;
  onCancel?: () => void;
  defaultSkillId?: string;
  className?: string;
}

export interface GiveEndorsementModalProps extends Omit<GiveEndorsementProps, 'onCancel'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const relationshipOptions: Array<{
  value: RelationshipType;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  {
    value: 'client',
    label: 'Client',
    description: 'I hired this person for a project',
    icon: Briefcase,
  },
  {
    value: 'colleague',
    label: 'Colleague',
    description: 'We worked together on the same team',
    icon: Users,
  },
  {
    value: 'manager',
    label: 'Manager',
    description: 'I managed or supervised this person',
    icon: User,
  },
  {
    value: 'mentor',
    label: 'Mentor',
    description: 'I mentored or taught this person',
    icon: Award,
  },
  {
    value: 'collaborator',
    label: 'Collaborator',
    description: 'We collaborated on a project',
    icon: Heart,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Another professional relationship',
    icon: User,
  },
];

const testimonialPrompts = [
  'What specific skills or qualities made them stand out?',
  'Describe a project where they excelled with this skill.',
  'What would you tell someone considering hiring them?',
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

// ============================================================================
// Skill Quick Select
// ============================================================================

function SkillQuickSelect({
  skills,
  selectedId,
  onSelect,
}: Readonly<{
  skills: Array<{ id: string; name: string; category: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
}>) {
  // Group skills by category
  const groupedSkills = skills.reduce(
    (acc, skill) => {
      acc[skill.category] ??= [];
      acc[skill.category].push(skill);
      return acc;
    },
    {} as Record<string, typeof skills>
  );

  return (
    <div className="space-y-4">
      {Object.entries(groupedSkills).map(([category, categorySkills]) => (
        <div key={category}>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
            {category}
          </p>
          <div className="flex flex-wrap gap-2">
            {categorySkills.map((skill) => (
              <button
                key={skill.id}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  selectedId === skill.id
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-white text-slate-700 hover:bg-slate-50'
                )}
                onClick={() => onSelect(skill.id)}
              >
                {selectedId === skill.id && <Check className="mr-1.5 h-3 w-3" />}
                {skill.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Relationship Selector
// ============================================================================

function RelationshipSelector({
  value,
  onChange,
}: Readonly<{
  value: RelationshipType;
  onChange: (value: RelationshipType) => void;
}>) {
  return (
    <RadioGroup
      className="grid gap-3 sm:grid-cols-2"
      value={value}
      onValueChange={(v) => onChange(v as RelationshipType)}
    >
      {relationshipOptions.map((option) => {
        const Icon = option.icon;
        return (
          <div key={option.value}>
            <RadioGroupItem className="peer sr-only" id={option.value} value={option.value} />
            <Label
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors',
                'peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
                value === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-slate-50 hover:bg-slate-100'
              )}
              htmlFor={option.value}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4',
                  value === option.value ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <div>
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-muted-foreground text-xs">{option.description}</p>
              </div>
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}

// ============================================================================
// Give Endorsement Form
// ============================================================================

export function GiveEndorsement({
  person,
  projects = [],
  onSubmit,
  onCancel,
  defaultSkillId,
  className,
}: Readonly<GiveEndorsementProps>) {
  const [selectedSkillId, setSelectedSkillId] = useState(defaultSkillId || '');
  const [relationship, setRelationship] = useState<RelationshipType>('client');
  const [testimonial, setTestimonial] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const selectedSkill = person.skills?.find((s) => s.id === selectedSkillId);

  const handleSubmit = async () => {
    if (!selectedSkillId) {
      setError('Please select a skill to endorse');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        personId: person.id,
        skillId: selectedSkillId,
        relationship,
        testimonial: testimonial.trim() || undefined,
        projectId: selectedProjectId || undefined,
      });
    } catch (err) {
      console.error('Failed to submit endorsement:', err);
      setError('Failed to submit endorsement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Person Preview */}
      <Card className="bg-gradient-to-r from-slate-50 to-white">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-14 w-14">
            <AvatarImage alt={person.name} src={person.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {getInitials(person.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{person.name}</p>
            {person.title && <p className="text-muted-foreground text-sm">{person.title}</p>}
            {person.headline && (
              <p className="text-muted-foreground mt-1 text-xs">{person.headline}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Skill Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <span className="text-base font-medium">Which skill would you like to endorse?</span>
            <p className="text-muted-foreground mt-1 text-sm">
              Select a skill that you&apos;ve seen {person.name.split(' ')[0]} demonstrate
            </p>
          </div>

          {person.skills && person.skills.length > 0 ? (
            <SkillQuickSelect
              selectedId={selectedSkillId}
              skills={person.skills}
              onSelect={setSelectedSkillId}
            />
          ) : (
            <p className="text-muted-foreground text-sm">No skills listed on profile</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button disabled={!selectedSkillId} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Relationship and Testimonial */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Selected Skill Badge */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Endorsing:</span>
            <Badge className="bg-primary/10 text-primary">
              <ThumbsUp className="mr-1.5 h-3 w-3" />
              {selectedSkill?.name}
            </Badge>
            <Button className="h-6 text-xs" size="sm" variant="ghost" onClick={() => setStep(1)}>
              Change
            </Button>
          </div>

          {/* Relationship Selection */}
          <div className="space-y-3">
            <span className="text-base font-medium">
              How do you know {person.name.split(' ')[0]}?
            </span>
            <RelationshipSelector value={relationship} onChange={setRelationship} />
          </div>

          {/* Project Context (Optional) */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <Label>
                Related project{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
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

          {/* Testimonial */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Add a testimonial{' '}
                <span className="text-muted-foreground font-normal">
                  (optional but recommended)
                </span>
              </Label>
            </div>
            <Textarea
              maxLength={500}
              placeholder={
                testimonialPrompts[Math.floor(Math.random() * testimonialPrompts.length)]
              }
              rows={4}
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Testimonials help candidates stand out to potential clients
              </p>
              <span className="text-muted-foreground text-xs">{testimonial.length}/500</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-3">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    Endorse
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Give Endorsement Modal
// ============================================================================

export function GiveEndorsementModal({
  open,
  onOpenChange,
  ...props
}: Readonly<GiveEndorsementModalProps>) {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (data: GiveEndorsementData) => {
    await props.onSubmit(data);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onOpenChange(false);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {showSuccess ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 rounded-full bg-green-100 p-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Endorsement Sent!</h3>
            <p className="text-muted-foreground mt-1">
              Thank you for helping {props.person.name.split(' ')[0]} build their professional
              reputation.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Give Endorsement</DialogTitle>
              <DialogDescription>
                Endorse {props.person.name}&apos;s skills to help them stand out to potential
                clients.
              </DialogDescription>
            </DialogHeader>

            <GiveEndorsement
              {...props}
              onCancel={() => onOpenChange(false)}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Quick Endorse Button
// ============================================================================

export interface QuickEndorseButtonProps {
  person: Person;
  skillId?: string;
  skillName?: string;
  onEndorse: (personId: string, skillId?: string) => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export function QuickEndorseButton({
  person,
  skillId,
  skillName,
  onEndorse,
  variant = 'default',
  className,
}: Readonly<QuickEndorseButtonProps>) {
  if (variant === 'compact') {
    return (
      <Button
        className={cn('gap-1.5', className)}
        size="sm"
        variant="ghost"
        onClick={() => onEndorse(person.id, skillId)}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        Endorse
      </Button>
    );
  }

  return (
    <Button
      className={cn('gap-2', className)}
      size="sm"
      variant="outline"
      onClick={() => onEndorse(person.id, skillId)}
    >
      <ThumbsUp className="h-4 w-4" />
      {skillName ? `Endorse for ${skillName}` : 'Give Endorsement'}
    </Button>
  );
}
