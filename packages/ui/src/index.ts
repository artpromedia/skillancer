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
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';

// Input
export { Input } from './components/input';
export type { InputProps } from './components/input';

// Textarea
export { Textarea } from './components/textarea';
export type { TextareaProps } from './components/textarea';

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

// AlertDialog
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/alert-dialog';

// Popover
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './components/popover';

// Collapsible
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/collapsible';

// Command
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './components/command';

// Toast (Sonner)
export { Toaster, toast } from './components/sonner';

// useToast hook (Sonner wrapper)
export { useToast } from './components/use-toast';
export type { ToastOptions, ToastReturn } from './components/use-toast';

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

// Checkbox
export { Checkbox } from './components/checkbox';

// Alert
export { Alert, AlertTitle, AlertDescription } from './components/alert';

// Switch
export { Switch } from './components/switch';

// Radio Group
export { RadioGroup, RadioGroupItem } from './components/radio-group';

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

// Tooltip
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip';

// Progress
export { Progress } from './components/progress';

// Rating Stars
export { RatingStars } from './components/rating-stars';
export type { RatingStarsProps } from './components/rating-stars';

// Progress Ring
export { ProgressRing } from './components/progress-ring';
export type { ProgressRingProps } from './components/progress-ring';

// Step Indicator - Multi-step progress component
export { StepIndicator } from './components/step-indicator';
export type { Step, StepIndicatorProps } from './components/step-indicator';

// Timeline - Activity/event timeline component
export { Timeline, TimelineItemComponent } from './components/timeline';
export type { TimelineItem, TimelineProps, TimelineItemProps } from './components/timeline';

// Status Badge - Configurable status badges
export {
  StatusBadge,
  // Proposal status presets
  ProposalDraftBadge,
  ProposalSubmittedBadge,
  ProposalViewedBadge,
  ProposalShortlistedBadge,
  ProposalRejectedBadge,
  ProposalWithdrawnBadge,
  ProposalHiredBadge,
  // Job status presets
  JobOpenBadge,
  JobClosedBadge,
  JobInProgressBadge,
  JobCompletedBadge,
  // Contract status presets
  ContractPendingBadge,
  ContractActiveBadge,
  ContractCompletedBadge,
  ContractDisputedBadge,
  ContractCancelledBadge,
  // Payment status presets
  PaymentPendingBadge,
  PaymentProcessingBadge,
  PaymentCompletedBadge,
  PaymentFailedBadge,
  PaymentRefundedBadge,
  // Verification status presets
  VerifiedBadge,
  UnverifiedBadge,
  PendingVerificationBadge,
  // Factory functions
  getProposalStatusBadge,
  getJobStatusBadge,
  getContractStatusBadge,
  getPaymentStatusBadge,
} from './components/status-badge';
export type {
  StatusBadgeStatus,
  StatusBadgeSize,
  StatusBadgeProps,
  PresetBadgeProps,
  ProposalStatus,
  JobStatus,
  ContractStatus,
  PaymentStatus,
} from './components/status-badge';

// File Upload - Drag & drop file upload
export { FileUpload } from './components/file-upload';
export type { UploadedFile, FileUploadProps } from './components/file-upload';

// Optimized Image - Performance-optimized image components
export {
  OptimizedImage,
  AvatarImage as OptimizedAvatar,
  BackgroundImage,
  ImageGallery,
} from './components/optimized-image';
export type {
  OptimizedImageProps,
  AvatarImageProps,
  BackgroundImageProps,
  ImageGalleryProps,
} from './components/optimized-image';

// ============================================================================
// Theme Provider
// ============================================================================
export { ThemeProvider, useTheme } from './components/theme-provider';
export type { ThemeProviderProps } from './components/theme-provider';
