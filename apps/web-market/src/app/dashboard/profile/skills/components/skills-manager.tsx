/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui';
import { Award, Check, GraduationCap, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { type FreelancerSkill, getMySkills, addSkill, removeSkill } from '@/lib/api/freelancers';
import { searchSkills, type Skill, startSkillAssessment } from '@/lib/api/skills';

// ============================================================================
// Types
// ============================================================================

interface SkillsManagerProps {
  userId: string;
}

// ============================================================================
// Component
// ============================================================================

export function SkillsManager({ userId: _userId }: Readonly<SkillsManagerProps>) {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<FreelancerSkill[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add skill dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Skill[]>([]);
  // Loading indicator for search (setter used, but not displayed yet)
  const [_isSearching, setIsSearching] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [proficiency, setProficiency] = useState<string>('INTERMEDIATE');
  const [yearsExperience, setYearsExperience] = useState<number>(1);
  const [adding, setAdding] = useState(false);

  // Verify dialog state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [skillToVerify, setSkillToVerify] = useState<FreelancerSkill | null>(null);
  const [startingAssessment, setStartingAssessment] = useState(false);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      const data = await getMySkills();
      setSkills(data);
    } catch (err) {
      setError('Failed to load skills');
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // Search skills
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchSkills({ query: searchQuery, limit: 10 });
      // Filter out already added skills
      const existingIds = new Set(skills.map((s) => s.id));
      setSearchResults(results.skills.filter((s) => !existingIds.has(s.id)));
    } catch (err) {
      console.error('Failed to search skills:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, skills]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      void handleSearch();
    }, 300);
    return () => clearTimeout(debounce);
  }, [handleSearch]);

  // Add skill
  const handleAddSkill = async () => {
    if (!selectedSkill) return;

    setAdding(true);
    try {
      await addSkill({
        skillId: selectedSkill.id,
        proficiencyLevel: proficiency as FreelancerSkill['proficiencyLevel'],
        yearsExperience,
      });
      await loadSkills();
      setAddDialogOpen(false);
      setSelectedSkill(null);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to add skill:', err);
    } finally {
      setAdding(false);
    }
  };

  // Remove skill
  const handleRemoveSkill = async (skillId: string) => {
    try {
      await removeSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch (err) {
      console.error('Failed to remove skill:', err);
    }
  };

  // Start assessment
  const handleStartAssessment = async () => {
    if (!skillToVerify) return;

    setStartingAssessment(true);
    try {
      const { assessmentUrl } = await startSkillAssessment(skillToVerify.id);
      window.open(assessmentUrl, '_blank');
      setVerifyDialogOpen(false);
    } catch (err) {
      console.error('Failed to start assessment:', err);
    } finally {
      setStartingAssessment(false);
    }
  };

  const getProficiencyLabel = (level: string) => {
    const labels: Record<string, string> = {
      BEGINNER: 'Beginner',
      INTERMEDIATE: 'Intermediate',
      ADVANCED: 'Advanced',
      EXPERT: 'Expert',
    };
    return labels[level] ?? level;
  };

  const getProficiencyColor = (level: string) => {
    const colors: Record<string, string> = {
      BEGINNER: 'bg-slate-100 text-slate-700',
      INTERMEDIATE: 'bg-blue-100 text-blue-700',
      ADVANCED: 'bg-purple-100 text-purple-700',
      EXPERT: 'bg-amber-100 text-amber-700',
    };
    return colors[level] ?? 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add Skill Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Skills</CardTitle>
              <CardDescription>Add skills to showcase your expertise to clients</CardDescription>
            </div>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Skill
              </Button>
            </DialogTrigger>
          </CardHeader>
          <CardContent>
            {skills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="text-muted-foreground/30 h-12 w-12" />
                <h3 className="mt-4 font-semibold">No skills added yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Add skills to help clients find you
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{skill.name}</span>
                        {skill.isVerified && <Check className="h-4 w-4 text-emerald-600" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          className={cn('text-xs', getProficiencyColor(skill.proficiencyLevel))}
                        >
                          {getProficiencyLabel(skill.proficiencyLevel)}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {skill.yearsExperience} yr{skill.yearsExperience === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!skill.isVerified && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSkillToVerify(skill);
                            setVerifyDialogOpen(true);
                          }}
                        >
                          <Award className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleRemoveSkill(skill.id)}
                      >
                        <Trash2 className="text-muted-foreground h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Skill</DialogTitle>
            <DialogDescription>Search for a skill and set your proficiency level</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div>
              <Label>Search Skills</Label>
              <div className="relative mt-1">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  placeholder="e.g., React, Python, Design..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && !selectedSkill && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                {searchResults.map((skill) => (
                  <button
                    key={skill.id}
                    className="hover:bg-muted flex w-full items-center justify-between rounded-md px-3 py-2 text-left"
                    type="button"
                    onClick={() => {
                      setSelectedSkill(skill);
                      setSearchQuery(skill.name);
                    }}
                  >
                    <span>{skill.name}</span>
                    <span className="text-muted-foreground text-xs">{skill.category}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Skill */}
            {selectedSkill && (
              <div className="bg-muted/50 flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{selectedSkill.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSkill(null);
                    setSearchQuery('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Proficiency */}
            <div>
              <Label>Proficiency Level</Label>
              <Select value={proficiency} onValueChange={setProficiency}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Beginner</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                  <SelectItem value="EXPERT">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Years Experience */}
            <div>
              <Label>Years of Experience</Label>
              <Input
                className="mt-1"
                max={50}
                min={0}
                type="number"
                value={yearsExperience}
                onChange={(e) => setYearsExperience(Number.parseInt(e.target.value, 10) || 0)}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              disabled={!selectedSkill || adding}
              onClick={() => void handleAddSkill()}
            >
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Skill'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verify Skill Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Skill</DialogTitle>
            <DialogDescription>
              Take a SkillPod assessment to verify your {skillToVerify?.name} expertise
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-medium">What to Expect</h4>
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                <li>• Timed assessment (15-30 minutes)</li>
                <li>• Multiple choice and coding challenges</li>
                <li>• Results displayed on your profile</li>
                <li>• Can retake after 30 days if needed</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setVerifyDialogOpen(false)}
              >
                Maybe Later
              </Button>
              <Button
                className="flex-1"
                disabled={startingAssessment}
                onClick={() => void handleStartAssessment()}
              >
                {startingAssessment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Award className="mr-2 h-4 w-4" />
                    Start Assessment
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verification Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Why Verify Your Skills?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <Award className="h-8 w-8 text-emerald-600" />
              <h4 className="mt-2 font-medium">Stand Out</h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Verified skills appear with a badge, helping you stand out to clients
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <Check className="h-8 w-8 text-blue-600" />
              <h4 className="mt-2 font-medium">Build Trust</h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Clients trust freelancers who prove their expertise
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <Search className="h-8 w-8 text-purple-600" />
              <h4 className="mt-2 font-medium">Get Discovered</h4>
              <p className="text-muted-foreground mt-1 text-sm">
                Verified skills boost your ranking in search results
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
