// @skillancer/ui
// Shared React UI components for Skillancer design system

// ============================================================================
// Utilities
// ============================================================================
export {
  cn,
  formatDate,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  truncate,
  getInitials,
  sleep,
  debounce,
  isServer,
  isClient,
} from './lib/utils';

// ============================================================================
// Base shadcn/ui Components
// ============================================================================

// Button
export { Button, buttonVariants } from './components/Button';
export type { ButtonProps } from './components/Button';

// Input
export { Input } from './components/input';
export type { InputProps } from './components/input';

// Label
export { Label } from './components/label';

// Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './components/card';

// Dialog
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog';

// Toast (Sonner)
export { Toaster, toast } from './components/sonner';

// Avatar
export { Avatar, AvatarImage, AvatarFallback } from './components/avatar';

// Badge
export { Badge, badgeVariants } from './components/badge';
export type { BadgeProps } from './components/badge';

// Skeleton
export { Skeleton } from './components/skeleton';

// Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './components/select';

// Dropdown Menu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from './components/dropdown-menu';

// Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs';

// Separator
export { Separator } from './components/separator';

// Scroll Area
export { ScrollArea, ScrollBar } from './components/scroll-area';

// ============================================================================
// Custom Skillancer Components
// ============================================================================

// SkillancerButton - Enhanced button with loading state
export { SkillancerButton } from './components/skillancer-button';
export type { SkillancerButtonProps } from './components/skillancer-button';

// SkillancerCard - Branded card with header actions
export { SkillancerCard } from './components/skillancer-card';
export type { SkillancerCardProps } from './components/skillancer-card';

// SkillancerInput - Form input with label and error
export { SkillancerInput } from './components/skillancer-input';
export type { SkillancerInputProps } from './components/skillancer-input';

// LoadingSpinner - Branded loading indicator
export { LoadingSpinner } from './components/loading-spinner';
export type { LoadingSpinnerProps } from './components/loading-spinner';

// EmptyState - Empty state placeholder
export { EmptyState } from './components/empty-state';
export type { EmptyStateProps } from './components/empty-state';

// ============================================================================
// Theme Provider
// ============================================================================
export { ThemeProvider, useTheme } from './components/theme-provider';
export type { ThemeProviderProps } from './components/theme-provider';
