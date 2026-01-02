/**
 * Time Entry Form Component
 *
 * Modal form for logging time against an engagement.
 * Supports category selection, description, and billable flag.
 */

'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
} from '@skillancer/ui';
import { X, Clock, Calendar, DollarSign } from 'lucide-react';
import { useState } from 'react';

// Types
interface TimeEntryFormProps {
  engagementId: string;
  onClose: () => void;
  onSubmit: (entry: TimeEntryData) => void;
  initialDate?: Date;
}

interface TimeEntryData {
  date: string;
  hours: number;
  description: string;
  category: string;
  billable: boolean;
}

// Time categories
const TIME_CATEGORIES = [
  { value: 'ADVISORY', label: 'Advisory & Consulting', color: 'bg-blue-500' },
  { value: 'STRATEGY', label: 'Strategy & Planning', color: 'bg-purple-500' },
  { value: 'EXECUTION', label: 'Execution & Implementation', color: 'bg-green-500' },
  { value: 'MEETINGS', label: 'Meetings & Calls', color: 'bg-orange-500' },
  { value: 'DOCUMENTATION', label: 'Documentation', color: 'bg-cyan-500' },
  { value: 'REVIEW', label: 'Review & Feedback', color: 'bg-pink-500' },
  { value: 'TRAINING', label: 'Training & Mentoring', color: 'bg-yellow-500' },
  { value: 'ADMIN', label: 'Administrative', color: 'bg-gray-500' },
];

// Quick time presets
const TIME_PRESETS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 8];

export function TimeEntryForm({
  engagementId,
  onClose,
  onSubmit,
  initialDate,
}: TimeEntryFormProps) {
  const [date, setDate] = useState(
    initialDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0] ?? ''
  );
  const [hours, setHours] = useState<number>(1);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ADVISORY');
  const [billable, setBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      onSubmit({
        date,
        hours,
        description,
        category,
        billable,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Log Time
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1" htmlFor="date">
                <Calendar className="h-4 w-4" />
                Date
              </Label>
              <Input
                required
                id="date"
                max={new Date().toISOString().split('T')[0]}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Hours */}
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <div className="flex items-center gap-2">
                <Input
                  required
                  className="w-24"
                  id="hours"
                  max="24"
                  min="0.25"
                  step="0.25"
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(parseFloat(e.target.value))}
                />
                <div className="flex flex-wrap gap-1">
                  {TIME_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      className="h-7 px-2 text-xs"
                      size="sm"
                      type="button"
                      variant={hours === preset ? 'default' : 'outline'}
                      onClick={() => setHours(preset)}
                    >
                      {preset}h
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_CATEGORIES.map((cat) => (
                  <Button
                    key={cat.value}
                    className="justify-start"
                    size="sm"
                    type="button"
                    variant={category === cat.value ? 'default' : 'outline'}
                    onClick={() => setCategory(cat.value)}
                  >
                    <div className={`h-2 w-2 rounded-full ${cat.color} mr-2`} />
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                required
                id="description"
                minLength={5}
                placeholder="What did you work on?"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Billable Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Billable Hours</span>
              </div>
              <Button
                size="sm"
                type="button"
                variant={billable ? 'default' : 'outline'}
                onClick={() => setBillable(!billable)}
              >
                {billable ? 'Yes' : 'No'}
              </Button>
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{hours} hours</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium">
                  {TIME_CATEGORIES.find((c) => c.value === category)?.label}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Billable</span>
                <span className="font-medium">{billable ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button className="flex-1" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
