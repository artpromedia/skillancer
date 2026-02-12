/**
 * @skillancer/utils
 * Shared utility functions for the Skillancer platform
 *
 * @example
 * // Import everything
 * import * as utils from '@skillancer/utils';
 *
 * // Import specific modules
 * import { formatDate, addDays } from '@skillancer/utils/dates';
 * import { formatCurrency } from '@skillancer/utils/currency';
 * import { slugify, truncate } from '@skillancer/utils/strings';
 * import { isValidEmail } from '@skillancer/utils/validation';
 * import { retry, debounce } from '@skillancer/utils/async';
 * import { AppError, NotFoundError } from '@skillancer/utils/errors';
 * import { generateUuid, generateNanoId } from '@skillancer/utils/ids';
 * import { pick, omit, deepMerge } from '@skillancer/utils/objects';
 */

// Date utilities
export * from './dates';

// Currency utilities
export * from './currency';

// String utilities
export * from './strings';

// Validation utilities
export * from './validation';

// Async utilities
export * from './async';

// Error utilities
export * from './errors';

// ID utilities
export * from './ids';

// Object utilities
export * from './objects';
