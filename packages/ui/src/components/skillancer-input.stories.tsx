import type { Meta, StoryObj } from '@storybook/react';

import { SkillancerInput } from './skillancer-input';

const meta: Meta<typeof SkillancerInput> = {
  title: 'Components/SkillancerInput',
  component: SkillancerInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
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
    placeholder: 'Enter text...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter your email',
    type: 'email',
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    helperText: 'Must be at least 8 characters',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'Enter your email',
    value: 'invalid-email',
    error: 'Please enter a valid email address',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'Cannot edit',
    disabled: true,
  },
};

export const FormExample: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <SkillancerInput
        label="Full Name"
        placeholder="John Doe"
        helperText="Enter your legal name"
      />
      <SkillancerInput
        label="Email"
        type="email"
        placeholder="john@example.com"
      />
      <SkillancerInput
        label="Password"
        type="password"
        placeholder="••••••••"
        helperText="Must be at least 8 characters"
      />
      <SkillancerInput
        label="Phone (Optional)"
        type="tel"
        placeholder="+1 (555) 000-0000"
      />
    </div>
  ),
};

export const ValidationStates: Story = {
  render: () => (
    <div className="w-[400px] space-y-4">
      <SkillancerInput
        label="Valid Input"
        value="john@example.com"
        helperText="Email is valid"
      />
      <SkillancerInput
        label="Invalid Input"
        value="invalid-email"
        error="Please enter a valid email address"
      />
      <SkillancerInput
        label="Disabled Input"
        value="Cannot change"
        disabled
        helperText="This field is locked"
      />
    </div>
  ),
};
