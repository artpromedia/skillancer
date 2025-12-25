/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import { Camera, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getMyProfile, updateProfile, type UpdateProfileData } from '@/lib/api/freelancers';

// ============================================================================
// Schema
// ============================================================================

const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  bio: z.string().max(2000, 'Bio must be under 2000 characters').optional(),
  hourlyRate: z.coerce
    .number()
    .min(5, 'Minimum rate is $5')
    .max(1000, 'Maximum rate is $1000')
    .optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  availability: z
    .enum(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'NOT_AVAILABLE', 'ON_VACATION'])
    .optional(),
  hoursPerWeek: z.coerce.number().min(0).max(80).optional(),
  linkedIn: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  github: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  twitter: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// ============================================================================
// Component
// ============================================================================

interface ProfileEditFormProps {
  userId: string;
}

export function ProfileEditForm({ userId: _userId }: ProfileEditFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const availability = watch('availability');

  // Load profile data
  const loadProfile = useCallback(async () => {
    try {
      const profile = await getMyProfile();

      setValue('displayName', profile.displayName);
      setValue('title', profile.title);
      setValue('bio', profile.bio ?? '');
      setValue('hourlyRate', profile.hourlyRate ?? undefined);
      setValue('city', profile.location?.city ?? '');
      setValue('country', profile.location?.country ?? '');
      setValue('timezone', profile.availability?.timezone ?? '');
      setValue('availability', profile.availability?.status ?? 'AVAILABLE');
      setValue('hoursPerWeek', profile.availability?.hoursPerWeek ?? 40);
      setValue('linkedIn', profile.socialLinks?.linkedIn ?? '');
      setValue('github', profile.socialLinks?.github ?? '');
      setValue('twitter', profile.socialLinks?.twitter ?? '');
      setValue('website', profile.socialLinks?.website ?? '');
      setAvatarUrl(profile.avatarUrl);
    } catch (err) {
      setError('Failed to load profile');
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [setValue]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Handle form submit
  const onSubmit = async (data: ProfileFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData: UpdateProfileData = {
        displayName: data.displayName,
        title: data.title,
        bio: data.bio || undefined,
        hourlyRate: data.hourlyRate,
        location:
          data.city || data.country
            ? {
                city: data.city || '',
                country: data.country || '',
              }
            : undefined,
        availability: {
          status: data.availability ?? 'AVAILABLE',
          hoursPerWeek: data.hoursPerWeek ?? 40,
          timezone: data.timezone,
        },
        socialLinks: {
          linkedIn: data.linkedIn || undefined,
          github: data.github || undefined,
          twitter: data.twitter || undefined,
          website: data.website || undefined,
        },
      };

      await updateProfile(updateData);
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save profile');
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {/* Status messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Profile saved successfully!
        </div>
      )}

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Your profile picture visible to clients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage alt="Profile" src={avatarUrl} />
              <AvatarFallback>{getInitials(watch('displayName') || 'U')}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline">
              <Camera className="mr-2 h-4 w-4" />
              Change Photo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Your public profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" {...register('displayName')} className="mt-1" />
              {errors.displayName && (
                <p className="mt-1 text-sm text-red-600">{errors.displayName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="title">Professional Title</Label>
              <Input
                id="title"
                placeholder="e.g., Senior Full Stack Developer"
                {...register('title')}
                className="mt-1"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Tell clients about yourself..."
              rows={4}
              {...register('bio')}
              className="mt-1"
            />
            {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>}
          </div>

          <div>
            <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
            <Input
              id="hourlyRate"
              max={1000}
              min={5}
              type="number"
              {...register('hourlyRate')}
              className="mt-1 w-32"
            />
            {errors.hourlyRate && (
              <p className="mt-1 text-sm text-red-600">{errors.hourlyRate.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Help clients find local freelancers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., San Francisco"
                {...register('city')}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="e.g., United States"
                {...register('country')}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              placeholder="e.g., America/Los_Angeles"
              {...register('timezone')}
              className="mt-1 w-64"
            />
          </div>
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>Let clients know when you can take on new work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Status</Label>
              <Select
                value={availability}
                onValueChange={(v) =>
                  setValue('availability', v as ProfileFormData['availability'])
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="PARTIALLY_AVAILABLE">Partially Available</SelectItem>
                  <SelectItem value="NOT_AVAILABLE">Not Available</SelectItem>
                  <SelectItem value="ON_VACATION">On Vacation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="hoursPerWeek">Hours per Week</Label>
              <Input
                id="hoursPerWeek"
                max={80}
                min={0}
                type="number"
                {...register('hoursPerWeek')}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>Connect your professional profiles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="linkedIn">LinkedIn</Label>
              <Input
                id="linkedIn"
                placeholder="https://linkedin.com/in/..."
                type="url"
                {...register('linkedIn')}
                className="mt-1"
              />
              {errors.linkedIn && (
                <p className="mt-1 text-sm text-red-600">{errors.linkedIn.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="github">GitHub</Label>
              <Input
                id="github"
                placeholder="https://github.com/..."
                type="url"
                {...register('github')}
                className="mt-1"
              />
              {errors.github && (
                <p className="mt-1 text-sm text-red-600">{errors.github.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="twitter">Twitter / X</Label>
              <Input
                id="twitter"
                placeholder="https://x.com/..."
                type="url"
                {...register('twitter')}
                className="mt-1"
              />
              {errors.twitter && (
                <p className="mt-1 text-sm text-red-600">{errors.twitter.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://..."
                type="url"
                {...register('website')}
                className="mt-1"
              />
              {errors.website && (
                <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button disabled={saving || !isDirty} type="submit">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
