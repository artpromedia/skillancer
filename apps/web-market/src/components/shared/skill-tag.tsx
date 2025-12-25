import { Badge, cn } from '@skillancer/ui';

interface SkillTagProps {
  skill: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'matched' | 'missing';
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

/**
 * Skill tag component with optional match indicator
 * - default: Standard skill display
 * - matched: Green indicator for matched skills
 * - missing: Red/muted indicator for missing skills
 */
export function SkillTag({
  skill,
  size = 'md',
  variant = 'default',
  onClick,
  removable = false,
  onRemove,
  className,
}: SkillTagProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 h-5',
    md: 'text-xs px-2.5 py-1 h-6',
    lg: 'text-sm px-3 py-1.5 h-7',
  };

  const variantClasses = {
    default: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    matched:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    missing:
      'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800 opacity-70',
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <Badge
      className={cn(
        'font-normal transition-colors',
        sizeClasses[size],
        variantClasses[variant],
        onClick && 'cursor-pointer',
        className
      )}
      variant="outline"
      onClick={onClick}
    >
      {variant === 'matched' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />}
      {variant === 'missing' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-400" />}
      {skill}
      {removable && (
        <button
          aria-label={`Remove ${skill}`}
          className="hover:text-foreground ml-1.5 transition-colors"
          type="button"
          onClick={handleRemove}
        >
          ×
        </button>
      )}
    </Badge>
  );
}
