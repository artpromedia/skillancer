import type { Meta, StoryObj } from '@storybook/react';
import { FileX, Users, Inbox, Search, Package } from 'lucide-react';

import { EmptyState } from './empty-state';
import { Button } from './button';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No items found',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'No items found',
    description: 'Get started by creating your first item.',
  },
};

export const WithAction: Story = {
  args: {
    title: 'No projects yet',
    description: "You haven't created any projects. Create your first one to get started.",
    actionLabel: 'Create Project',
    onAction: () => alert('Create project clicked'),
  },
};

export const CustomIcon: Story = {
  args: {
    icon: <FileX className="h-12 w-12" />,
    title: 'No files found',
    description: 'Upload your first file to get started.',
    actionLabel: 'Upload File',
    onAction: () => alert('Upload clicked'),
  },
};

export const NoResults: Story = {
  args: {
    icon: <Search className="h-12 w-12" />,
    title: 'No results found',
    description: "Try adjusting your search or filters to find what you're looking for.",
    actionLabel: 'Clear Filters',
    onAction: () => alert('Clear filters clicked'),
  },
};

export const NoTeamMembers: Story = {
  args: {
    icon: <Users className="h-12 w-12" />,
    title: 'No team members',
    description: 'Invite your team members to collaborate on this project.',
    actionLabel: 'Invite Members',
    onAction: () => alert('Invite clicked'),
  },
};

export const WithSecondaryAction: Story = {
  args: {
    icon: <Package className="h-12 w-12" />,
    title: 'No products',
    description: 'Start by adding your first product to the catalog.',
    actionLabel: 'Add Product',
    onAction: () => alert('Add clicked'),
    secondaryAction: (
      <Button variant="link" onClick={() => alert('Learn more clicked')}>
        Learn more about products
      </Button>
    ),
  },
};

export const InCard: Story = {
  render: () => (
    <div className="w-[500px] rounded-lg border">
      <EmptyState
        icon={<Inbox className="h-12 w-12" />}
        title="Your inbox is empty"
        description="When you receive messages, they'll appear here."
      />
    </div>
  ),
};

export const Variations: Story = {
  render: () => (
    <div className="grid w-[800px] grid-cols-2 gap-6">
      <div className="rounded-lg border">
        <EmptyState
          icon={<FileX className="h-10 w-10" />}
          title="No documents"
          description="Upload documents to get started"
          actionLabel="Upload"
          onAction={() => {}}
        />
      </div>
      <div className="rounded-lg border">
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No team members"
          description="Invite people to your team"
          actionLabel="Invite"
          onAction={() => {}}
        />
      </div>
      <div className="rounded-lg border">
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="No search results"
          description="Try different keywords"
        />
      </div>
      <div className="rounded-lg border">
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No products"
          description="Add your first product"
          actionLabel="Add Product"
          onAction={() => {}}
        />
      </div>
    </div>
  ),
};
