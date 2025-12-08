import type { Meta, StoryObj } from '@storybook/react';
import { Plus, Save, Trash2 } from 'lucide-react';

import { SkillancerButton } from './skillancer-button';

const meta: Meta<typeof SkillancerButton> = {
  title: 'Components/SkillancerButton',
  component: SkillancerButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    isLoading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Submit',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Saving',
  },
};

export const LoadingWithText: Story = {
  args: {
    isLoading: true,
    loadingText: 'Saving...',
    children: 'Save',
  },
};

export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Plus className="h-4 w-4" />,
    children: 'Add New',
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <Save className="h-4 w-4" />,
    children: 'Save',
  },
};

export const WithBothIcons: Story = {
  args: {
    leftIcon: <Trash2 className="h-4 w-4" />,
    children: 'Delete',
    variant: 'destructive',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <SkillancerButton leftIcon={<Plus className="h-4 w-4" />}>
        Default
      </SkillancerButton>
      <SkillancerButton variant="secondary" leftIcon={<Plus className="h-4 w-4" />}>
        Secondary
      </SkillancerButton>
      <SkillancerButton variant="destructive" leftIcon={<Trash2 className="h-4 w-4" />}>
        Delete
      </SkillancerButton>
      <SkillancerButton variant="outline" leftIcon={<Plus className="h-4 w-4" />}>
        Outline
      </SkillancerButton>
    </div>
  ),
};

export const LoadingStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <SkillancerButton isLoading>Loading...</SkillancerButton>
      <SkillancerButton isLoading variant="secondary">
        Processing
      </SkillancerButton>
      <SkillancerButton isLoading variant="outline">
        Please wait
      </SkillancerButton>
    </div>
  ),
};
