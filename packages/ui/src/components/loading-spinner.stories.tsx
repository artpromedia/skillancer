import type { Meta, StoryObj } from '@storybook/react';

import { LoadingSpinner } from './loading-spinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    fullscreen: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Small: Story = {
  args: {
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
};

export const ExtraLarge: Story = {
  args: {
    size: 'xl',
  },
};

export const WithText: Story = {
  args: {
    size: 'lg',
    text: 'Loading...',
  },
};

export const CustomText: Story = {
  args: {
    size: 'md',
    text: 'Please wait while we process your request',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-muted-foreground text-xs">Small</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="md" />
        <span className="text-muted-foreground text-xs">Medium</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="lg" />
        <span className="text-muted-foreground text-xs">Large</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="xl" />
        <span className="text-muted-foreground text-xs">XL</span>
      </div>
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <div className="flex h-[200px] w-[400px] items-center justify-center rounded-lg border">
      <LoadingSpinner size="lg" text="Loading content..." />
    </div>
  ),
};
