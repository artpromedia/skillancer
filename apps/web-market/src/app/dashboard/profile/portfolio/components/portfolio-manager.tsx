/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@skillancer/ui';
import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  type PortfolioItem,
  getMyPortfolio,
  addPortfolioItem as addPortfolioItemApi,
  updatePortfolioItem as updatePortfolioItemApi,
  deletePortfolioItem as deletePortfolioItemApi,
  setPortfolioItemFeatured,
} from '@/lib/api/freelancers';

// Helper to get auth token
function getAuthToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('auth_token') ?? '') : '';
}

// Wrapper functions with token handling
async function addPortfolioItem(
  data: Parameters<typeof addPortfolioItemApi>[1]
): Promise<PortfolioItem> {
  return addPortfolioItemApi(getAuthToken(), data);
}

async function updatePortfolioItem(
  itemId: string,
  data: Partial<PortfolioItem>
): Promise<PortfolioItem> {
  return updatePortfolioItemApi(getAuthToken(), itemId, data);
}

async function deletePortfolioItem(itemId: string): Promise<void> {
  return deletePortfolioItemApi(getAuthToken(), itemId);
}

// ============================================================================
// Schema
// ============================================================================

const portfolioItemSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().max(2000, 'Description must be under 2000 characters').optional(),
  type: z.enum(['IMAGE', 'VIDEO', 'LINK', 'DOCUMENT']),
  thumbnailUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  mediaUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  projectUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  category: z.string().optional(),
  tags: z.string().optional(),
  client: z.string().optional(),
  role: z.string().optional(),
  duration: z.string().optional(),
});

type PortfolioFormData = z.infer<typeof portfolioItemSchema>;

// ============================================================================
// Types
// ============================================================================

interface PortfolioManagerProps {
  userId: string;
}

// ============================================================================
// Component
// ============================================================================

export function PortfolioManager({ userId: _userId }: PortfolioManagerProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PortfolioFormData>({
    resolver: zodResolver(portfolioItemSchema),
    defaultValues: {
      type: 'IMAGE',
    },
  });

  const itemType = watch('type');

  // Load portfolio
  const loadPortfolio = useCallback(async () => {
    try {
      const data = await getMyPortfolio();
      setItems(data.items);
    } catch (err) {
      setError('Failed to load portfolio');
      console.error('Failed to load portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  // Open dialog for new item
  const handleAddNew = () => {
    setEditingItem(null);
    reset({
      title: '',
      description: '',
      type: 'IMAGE',
      thumbnailUrl: '',
      mediaUrl: '',
      projectUrl: '',
      category: '',
      tags: '',
      client: '',
      role: '',
      duration: '',
    });
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item);
    reset({
      title: item.title,
      description: item.description ?? '',
      type: item.type,
      thumbnailUrl: item.thumbnailUrl ?? '',
      mediaUrl: item.mediaUrl ?? '',
      projectUrl: item.projectUrl ?? '',
      category: item.category ?? '',
      tags: item.tags?.join(', ') ?? '',
      client: item.client ?? '',
      role: item.role ?? '',
      duration: item.duration ?? '',
    });
    setDialogOpen(true);
  };

  // Save item
  const onSubmit = async (data: PortfolioFormData) => {
    setSaving(true);
    try {
      const itemData = {
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        thumbnailUrl: data.thumbnailUrl || undefined,
        mediaUrl: data.mediaUrl || undefined,
        projectUrl: data.projectUrl || undefined,
        category: data.category || undefined,
        tags: data.tags
          ? data.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        client: data.client || undefined,
        role: data.role || undefined,
        duration: data.duration || undefined,
      };

      if (editingItem) {
        await updatePortfolioItem(editingItem.id, itemData);
      } else {
        await addPortfolioItem(itemData);
      }

      await loadPortfolio();
      setDialogOpen(false);
    } catch (err) {
      console.error('Failed to save portfolio item:', err);
    } finally {
      setSaving(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this portfolio item?')) return;

    try {
      await deletePortfolioItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete portfolio item:', err);
    }
  };

  // Toggle featured
  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await setPortfolioItemFeatured(id, !isFeatured);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isFeatured: !isFeatured } : item))
      );
    } catch (err) {
      console.error('Failed to update featured status:', err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <Video className="h-4 w-4" />;
      case 'LINK':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <ImageIcon className="h-4 w-4" />;
    }
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Portfolio Items</CardTitle>
              <CardDescription>Showcase your best work to attract clients</CardDescription>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="text-muted-foreground/30 h-12 w-12" />
                <h3 className="mt-4 font-semibold">No portfolio items yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Add your best work to showcase your skills
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div key={item.id} className="group relative overflow-hidden rounded-lg border">
                    {/* Thumbnail */}
                    <div className="bg-muted relative aspect-video">
                      {item.thumbnailUrl ? (
                        <Image
                          fill
                          alt={item.title}
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          src={item.thumbnailUrl}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          {getTypeIcon(item.type)}
                        </div>
                      )}

                      {/* Featured badge */}
                      {item.isFeatured && (
                        <div className="absolute left-2 top-2">
                          <Badge className="bg-amber-500">
                            <Star className="mr-1 h-3 w-3" />
                            Featured
                          </Badge>
                        </div>
                      )}

                      {/* Actions overlay */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="sm" variant="secondary" onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleToggleFeatured(item.id, item.isFeatured)}
                        >
                          <Star
                            className={cn(
                              'h-4 w-4',
                              item.isFeatured && 'fill-amber-500 text-amber-500'
                            )}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-medium">{item.title}</h4>
                      {item.category && (
                        <p className="text-muted-foreground text-sm">{item.category}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Update your portfolio item details'
                : 'Add a new item to your portfolio'}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Type */}
            <div>
              <Label>Type</Label>
              <Select
                value={itemType}
                onValueChange={(v) => setValue('type', v as PortfolioFormData['type'])}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMAGE">Image</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                  <SelectItem value="LINK">External Link</SelectItem>
                  <SelectItem value="DOCUMENT">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register('title')} className="mt-1" />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} {...register('description')} className="mt-1" />
            </div>

            {/* Thumbnail URL */}
            <div>
              <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
              <Input
                id="thumbnailUrl"
                placeholder="https://..."
                type="url"
                {...register('thumbnailUrl')}
                className="mt-1"
              />
            </div>

            {/* Media URL (for video) */}
            {itemType === 'VIDEO' && (
              <div>
                <Label htmlFor="mediaUrl">Video URL</Label>
                <Input
                  id="mediaUrl"
                  placeholder="https://..."
                  type="url"
                  {...register('mediaUrl')}
                  className="mt-1"
                />
              </div>
            )}

            {/* Project URL */}
            <div>
              <Label htmlFor="projectUrl">Project URL</Label>
              <Input
                id="projectUrl"
                placeholder="https://..."
                type="url"
                {...register('projectUrl')}
                className="mt-1"
              />
            </div>

            {/* Category */}
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., Web Design, Mobile App"
                {...register('category')}
                className="mt-1"
              />
            </div>

            {/* Tags */}
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="React, TypeScript, Tailwind"
                {...register('tags')}
                className="mt-1"
              />
            </div>

            {/* Project Details */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="client">Client</Label>
                <Input id="client" {...register('client')} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" {...register('role')} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  placeholder="e.g., 3 months"
                  {...register('duration')}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground space-y-2 text-sm">
            <li>• Feature your best 3-5 projects prominently</li>
            <li>• Use high-quality images and thumbnails</li>
            <li>• Include detailed descriptions of your role and technologies used</li>
            <li>• Link to live projects when possible</li>
            <li>• Add videos or demos for interactive projects</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
