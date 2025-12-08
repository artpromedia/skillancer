import type { Meta, StoryObj } from '@storybook/react';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';

import { SkillancerCard } from './skillancer-card';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

const meta: Meta<typeof SkillancerCard> = {
  title: 'Components/SkillancerCard',
  component: SkillancerCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    description: 'Card description goes here.',
    children: (
      <p className="text-sm text-muted-foreground">
        This is the card content. You can put any React elements here.
      </p>
    ),
  },
};

export const WithActions: Story = {
  args: {
    title: 'Project Overview',
    description: 'View and manage your project details.',
    actions: (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    children: (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <span className="text-sm font-medium">Active</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Members</span>
          <span className="text-sm font-medium">12</span>
        </div>
      </div>
    ),
  },
};

export const Hoverable: Story = {
  args: {
    title: 'Click me',
    description: 'This card has a hover effect.',
    hoverable: true,
    children: (
      <p className="text-sm text-muted-foreground">
        Hover over this card to see the shadow effect.
      </p>
    ),
  },
};

export const NoPadding: Story = {
  args: {
    title: 'Image Card',
    noPadding: true,
    children: (
      <div className="h-48 bg-gradient-to-br from-primary to-secondary rounded-b-lg" />
    ),
  },
};

export const ContentOnly: Story = {
  args: {
    children: (
      <div className="space-y-4">
        <h4 className="font-semibold">Custom Content</h4>
        <p className="text-sm text-muted-foreground">
          This card has no title or description, just content.
        </p>
        <Button>Action</Button>
      </div>
    ),
  },
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      <SkillancerCard title="Revenue" description="Monthly revenue">
        <p className="text-2xl font-bold">$12,345</p>
      </SkillancerCard>
      <SkillancerCard title="Users" description="Active users">
        <p className="text-2xl font-bold">1,234</p>
      </SkillancerCard>
      <SkillancerCard title="Orders" description="This week">
        <p className="text-2xl font-bold">567</p>
      </SkillancerCard>
      <SkillancerCard title="Growth" description="vs last month">
        <p className="text-2xl font-bold text-green-600">+23%</p>
      </SkillancerCard>
    </div>
  ),
};
