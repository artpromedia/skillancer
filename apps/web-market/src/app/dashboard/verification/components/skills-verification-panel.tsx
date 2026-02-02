'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@skillancer/ui';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  Play,
  RefreshCw,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import { useState } from 'react';

import { useSkillsVerification } from '@/hooks/use-skills-verification';

import type { SkillAssessment } from '@/lib/api/freelancers';

// ============================================================================
// Types
// ============================================================================

interface SkillsVerificationPanelProps {
  readonly className?: string;
}

type AssessmentType = 'QUICK' | 'STANDARD' | 'COMPREHENSIVE';
type RelationshipType = 'COLLEAGUE' | 'MANAGER' | 'CLIENT' | 'MENTOR' | 'OTHER';

// ============================================================================
// Component
// ============================================================================

export function SkillsVerificationPanel({ className }: SkillsVerificationPanelProps) {
  const [selectedAssessment, setSelectedAssessment] = useState<SkillAssessment | null>(null);
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const {
    status,
    assessments,
    isLoading,
    isLoadingAssessments,
    error,
    startAssessment,
    isStarting,
    requestEndorsement,
    isRequesting,
    refetch,
  } = useSkillsVerification();

  const handleStartAssessment = (assessment: SkillAssessment) => {
    setSelectedAssessment(assessment);
    setShowAssessmentDialog(true);
  };

  const handleConfirmStart = async (type: AssessmentType, proctored: boolean) => {
    if (!selectedAssessment) return;

    await startAssessment({
      skillId: selectedAssessment.skillId,
      assessmentType: type,
      proctored,
    });

    setShowAssessmentDialog(false);
  };

  const handleSubmitEndorsementRequest = async (data: {
    endorserEmail: string;
    message: string;
    relationshipType: RelationshipType;
  }) => {
    // In a real implementation, this would let user select which skill to endorse
    // For now, we'll just use the API to request endorsement
    await requestEndorsement({
      skillId: 'default', // Would be selected by user
      ...data,
    });
  };

  if (isLoading) {
    return <SkillsVerificationSkeleton />;
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="text-destructive h-12 w-12" />
          <div className="text-center">
            <p className="font-medium">Failed to load skills verification</p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
          <Button onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="text-primary h-5 w-5" />
            Skills Verification
          </CardTitle>
          <CardDescription>
            Verify your skills through assessments and peer endorsements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              color="emerald"
              icon={CheckCircle2}
              label="Verified Skills"
              value={status?.summary.totalVerifiedSkills ?? 0}
            />
            <StatCard
              color="blue"
              icon={FileText}
              label="Assessments"
              value={status?.summary.assessmentVerified ?? 0}
            />
            <StatCard
              color="purple"
              icon={Users}
              label="Endorsements"
              value={status?.summary.endorsementCount ?? 0}
            />
            <StatCard
              color="amber"
              icon={Clock}
              label="Pending Requests"
              value={status?.summary.pendingEndorsementRequests ?? 0}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assessments">Take Assessment</TabsTrigger>
          <TabsTrigger value="endorsements">Request Endorsement</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4 pt-4" value="overview">
          {/* Verified Skills List */}
          {status?.skills && status.skills.length > 0 ? (
            <div className="space-y-3">
              {status.skills.map((skill) => (
                <VerifiedSkillCard key={skill.skillId} skill={skill} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <GraduationCap className="text-muted-foreground h-12 w-12" />
                <div className="text-center">
                  <p className="font-medium">No verified skills yet</p>
                  <p className="text-muted-foreground text-sm">
                    Take an assessment or request peer endorsements to verify your skills
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setActiveTab('assessments')}>
                    <Play className="mr-2 h-4 w-4" />
                    Take Assessment
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('endorsements')}>
                    <Users className="mr-2 h-4 w-4" />
                    Request Endorsement
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent className="space-y-4 pt-4" value="assessments">
          <AssessmentsContent
            assessments={assessments?.assessments ?? []}
            isLoading={isLoadingAssessments}
            onStart={handleStartAssessment}
          />
        </TabsContent>

        <TabsContent className="space-y-4 pt-4" value="endorsements">
          <Card>
            <CardHeader>
              <CardTitle>Request Peer Endorsement</CardTitle>
              <CardDescription>
                Ask colleagues, clients, or mentors to endorse your skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EndorsementRequestForm
                isSubmitting={isRequesting}
                onSubmit={(data) => void handleSubmitEndorsementRequest(data)}
              />
            </CardContent>
          </Card>

          {/* Pending Requests */}
          {status?.pendingEndorsements && status.pendingEndorsements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status.pendingEndorsements.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <div>
                          <p className="text-sm font-medium">{request.endorserEmail}</p>
                          <p className="text-muted-foreground text-xs">
                            Requested {new Date(request.requestedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Assessment Start Dialog */}
      <AssessmentStartDialog
        assessment={selectedAssessment}
        isStarting={isStarting}
        open={showAssessmentDialog}
        onConfirm={(type, proctored) => void handleConfirmStart(type, proctored)}
        onOpenChange={setShowAssessmentDialog}
      />
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface AssessmentsContentProps {
  readonly assessments: SkillAssessment[];
  readonly isLoading: boolean;
  readonly onStart: (assessment: SkillAssessment) => void;
}

function AssessmentsContent({ assessments, isLoading, onStart }: AssessmentsContentProps) {
  if (isLoading) {
    return <AssessmentsSkeleton />;
  }

  if (assessments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <BookOpen className="text-muted-foreground h-12 w-12" />
          <p className="text-muted-foreground">
            No assessments available. Add skills to your profile first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {assessments.map((assessment) => (
        <AssessmentCard
          key={assessment.skillId}
          assessment={assessment}
          onStart={() => onStart(assessment)}
        />
      ))}
    </div>
  );
}

interface StatCardProps {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly value: number;
  readonly color: 'emerald' | 'blue' | 'purple' | 'amber';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="rounded-lg border p-4">
      <div className={cn('inline-flex rounded-lg p-2', colorClasses[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

interface VerifiedSkillCardProps {
  readonly skill: {
    skillId: string;
    skillName: string;
    category: string;
    currentLevel: string | null;
    verifications: Array<{
      type: string;
      score: number | null;
      verifiedAt: string;
      isActive: boolean;
    }>;
    endorsements: Array<{
      endorserId: string;
      endorserName: string;
    }>;
  };
}

function VerifiedSkillCard({ skill }: VerifiedSkillCardProps) {
  const latestVerification = skill.verifications[0];
  const hasAssessment = skill.verifications.some((v) => v.type === 'ASSESSMENT');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{skill.skillName}</h4>
              {skill.currentLevel && <Badge variant="secondary">{skill.currentLevel}</Badge>}
              {hasAssessment && (
                <Badge className="bg-blue-100 text-blue-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Assessed
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{skill.category}</p>

            <div className="mt-3 flex items-center gap-4 text-sm">
              {latestVerification?.score != null && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span>{latestVerification.score}%</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="text-muted-foreground h-4 w-4" />
                <span>{skill.endorsements.length} endorsements</span>
              </div>
              {latestVerification && (
                <div className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    Verified {new Date(latestVerification.verifiedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AssessmentCardProps {
  readonly assessment: SkillAssessment;
  readonly onStart: () => void;
}

function AssessmentCard({ assessment, onStart }: AssessmentCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{assessment.skillName}</h4>
              <Badge variant="outline">{assessment.category}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {assessment.description || 'Test your proficiency in this skill'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {assessment.assessmentTypes.map((type) => (
                <Badge key={type.type} className="text-xs" variant="secondary">
                  {type.type}: {type.duration}min
                </Badge>
              ))}
            </div>

            {assessment.lastAttempt && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Last attempt:</span>
                <Badge
                  variant={
                    assessment.lastAttempt.proficiencyLevel === 'EXPERT' ? 'default' : 'secondary'
                  }
                >
                  {assessment.lastAttempt.proficiencyLevel}
                </Badge>
                <span className="text-muted-foreground">
                  ({assessment.lastAttempt.score}/{assessment.lastAttempt.maxScore})
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            {assessment.canRetake ? (
              <Button onClick={onStart}>
                <Play className="mr-2 h-4 w-4" />
                {assessment.lastAttempt ? 'Retake' : 'Start'}
              </Button>
            ) : (
              <div className="text-right">
                <Badge variant="outline">
                  <Clock className="mr-1 h-3 w-3" />
                  Cooldown
                </Badge>
                {assessment.nextAttemptAt && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Available {new Date(assessment.nextAttemptAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AssessmentStartDialogProps {
  readonly assessment: SkillAssessment | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (type: AssessmentType, proctored: boolean) => void;
  readonly isStarting: boolean;
}

function AssessmentStartDialog({
  assessment,
  open,
  onOpenChange,
  onConfirm,
  isStarting,
}: AssessmentStartDialogProps) {
  const [selectedType, setSelectedType] = useState<AssessmentType>('STANDARD');
  const [proctored, setProctored] = useState(false);

  if (!assessment) return null;

  const selectedConfig = assessment.assessmentTypes.find((t) => t.type === selectedType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start {assessment.skillName} Assessment</DialogTitle>
          <DialogDescription>Choose your assessment type and preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assessment Type</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => setSelectedType(v as AssessmentType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assessment.assessmentTypes.map((type) => (
                  <SelectItem key={type.type} value={type.type}>
                    <div className="flex items-center gap-2">
                      <span>{type.type}</span>
                      <span className="text-muted-foreground">
                        ({type.duration}min, {type.questions} questions)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConfig && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm">{selectedConfig.description}</p>
              <div className="text-muted-foreground mt-2 flex gap-4 text-sm">
                <span>⏱️ {selectedConfig.duration} minutes</span>
                <span>📝 {selectedConfig.questions} questions</span>
              </div>
            </div>
          )}

          {assessment.proctoredAvailable && (
            <div className="flex items-center gap-2">
              <input
                checked={proctored}
                className="rounded"
                id="proctored"
                type="checkbox"
                onChange={(e) => setProctored(e.target.checked)}
              />
              <Label className="cursor-pointer" htmlFor="proctored">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Enable proctoring
                </div>
                <p className="text-muted-foreground text-xs font-normal">
                  Proctored assessments have higher verification weight
                </p>
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isStarting} onClick={() => onConfirm(selectedType, proctored)}>
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Assessment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EndorsementRequestFormProps {
  readonly onSubmit: (data: {
    endorserEmail: string;
    message: string;
    relationshipType: 'COLLEAGUE' | 'MANAGER' | 'CLIENT' | 'MENTOR' | 'OTHER';
  }) => void;
  readonly isSubmitting: boolean;
}

function EndorsementRequestForm({ onSubmit, isSubmitting }: EndorsementRequestFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [relationship, setRelationship] = useState<
    'COLLEAGUE' | 'MANAGER' | 'CLIENT' | 'MENTOR' | 'OTHER'
  >('COLLEAGUE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ endorserEmail: email, message, relationshipType: relationship });
    setEmail('');
    setMessage('');
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="endorserEmail">Endorser Email</Label>
        <Input
          required
          id="endorserEmail"
          placeholder="colleague@company.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="relationship">Relationship</Label>
        <Select
          value={relationship}
          onValueChange={(v) => setRelationship(v as typeof relationship)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="COLLEAGUE">Colleague</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="MENTOR">Mentor</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Personal Message (Optional)</Label>
        <textarea
          className="min-h-[100px] w-full rounded-md border p-3 text-sm"
          id="message"
          maxLength={500}
          placeholder="Hi, I'd appreciate if you could endorse my skills based on our work together..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <Button disabled={isSubmitting || !email} type="submit">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Send Request
          </>
        )}
      </Button>
    </form>
  );
}

// ============================================================================
// Skeleton Components
// ============================================================================

function SkillsVerificationSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="mt-2 h-6 w-12" />
                <Skeleton className="mt-1 h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AssessmentsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-4 w-64" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
