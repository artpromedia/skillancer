# Utils Package

Shared utility functions for the Skillancer monorepo.

## Usage

```typescript
import { formatDate, generateId, slugify } from '@skillancer/utils';
```

## Available Utilities

### String utilities

- `slugify(str)` - Convert string to URL-friendly slug
- `truncate(str, length)` - Truncate string with ellipsis
- `capitalize(str)` - Capitalize first letter

### Date utilities

- `formatDate(date, format)` - Format date string
- `timeAgo(date)` - Relative time string
- `isExpired(date)` - Check if date is past

### ID utilities

- `generateId()` - Generate unique ID (nanoid)
- `isValidId(id)` - Validate ID format

### Object utilities

- `pick(obj, keys)` - Pick object properties
- `omit(obj, keys)` - Omit object properties
- `deepMerge(target, source)` - Deep merge objects
