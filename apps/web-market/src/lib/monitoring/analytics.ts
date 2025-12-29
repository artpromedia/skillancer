/* eslint-disable no-console */
/**
 * Analytics Integration
 * Client-side analytics tracking for Skillancer web applications
 */

type EventProperties = Record<string, string | number | boolean | null>;

interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  gtmId?: string;
  mixpanelToken?: string;
  amplitudeApiKey?: string;
}

const config: AnalyticsConfig = {
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  gtmId: process.env.NEXT_PUBLIC_GTM_ID,
  mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
  amplitudeApiKey: process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY,
};

/**
 * Initialize analytics providers
 */
export function initializeAnalytics(): void {
  if (!config.enabled) {
    if (config.debug) {
      console.log('[Analytics] Running in debug mode');
    }
    return;
  }

  // Google Tag Manager
  if (config.gtmId && typeof window !== 'undefined') {
    const script = document.createElement('script');
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${config.gtmId}');
    `;
    document.head.appendChild(script);
  }
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string): void {
  if (config.debug) {
    console.log('[Analytics] Page View:', { path, title });
  }

  if (!config.enabled) return;

  // GTM/GA4
  if (typeof window !== 'undefined' && (window as unknown as { dataLayer: unknown[] }).dataLayer) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: 'page_view',
      page_path: path,
      page_title: title,
    });
  }
}

/**
 * Track custom event
 */
export function trackEvent(eventName: string, properties?: EventProperties): void {
  if (config.debug) {
    console.log('[Analytics] Event:', eventName, properties);
  }

  if (!config.enabled) return;

  // GTM/GA4
  if (typeof window !== 'undefined' && (window as unknown as { dataLayer: unknown[] }).dataLayer) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: eventName,
      ...properties,
    });
  }
}

/**
 * Identify user
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, string | number | boolean>
): void {
  if (config.debug) {
    console.log('[Analytics] Identify:', userId, traits);
  }

  if (!config.enabled) return;

  // GTM/GA4
  if (typeof window !== 'undefined' && (window as unknown as { dataLayer: unknown[] }).dataLayer) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: 'user_identified',
      user_id: userId,
      ...traits,
    });
  }
}

/**
 * Track conversion event
 */
export function trackConversion(conversionType: string, value?: number, currency = 'USD'): void {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value: value ?? 0,
    currency,
  });
}

// Predefined event helpers
export const events = {
  // Authentication
  signUp: (method: string) => trackEvent('sign_up', { method }),
  login: (method: string) => trackEvent('login', { method }),
  logout: () => trackEvent('logout'),

  // Job Events
  jobView: (jobId: string, category: string) => trackEvent('job_view', { job_id: jobId, category }),
  jobSearch: (query: string, filters: string) => trackEvent('job_search', { query, filters }),
  jobSave: (jobId: string) => trackEvent('job_save', { job_id: jobId }),
  jobApply: (jobId: string) => trackEvent('job_apply', { job_id: jobId }),

  // Proposal Events
  proposalStart: (jobId: string) => trackEvent('proposal_start', { job_id: jobId }),
  proposalSubmit: (jobId: string, amount: number) =>
    trackEvent('proposal_submit', { job_id: jobId, amount }),
  proposalAccepted: (jobId: string) => trackEvent('proposal_accepted', { job_id: jobId }),

  // Contract Events
  contractCreated: (contractId: string, value: number) =>
    trackEvent('contract_created', { contract_id: contractId, value }),
  contractCompleted: (contractId: string, value: number) =>
    trackEvent('contract_completed', { contract_id: contractId, value }),

  // Payment Events
  paymentInitiated: (amount: number) => trackEvent('payment_initiated', { amount }),
  paymentCompleted: (amount: number) => trackConversion('payment', amount),

  // VDI Events
  sessionStarted: (podType: string) => trackEvent('vdi_session_started', { pod_type: podType }),
  sessionEnded: (duration: number) =>
    trackEvent('vdi_session_ended', { duration_minutes: duration }),

  // Learning Events
  courseStarted: (courseId: string) => trackEvent('course_started', { course_id: courseId }),
  courseCompleted: (courseId: string) => trackEvent('course_completed', { course_id: courseId }),
  assessmentPassed: (assessmentId: string, score: number) =>
    trackEvent('assessment_passed', { assessment_id: assessmentId, score }),
};

// Performance tracking
export function trackPerformance(): void {
  if (typeof window === 'undefined') return;

  // Web Vitals
  if ('PerformanceObserver' in window) {
    // LCP
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        trackEvent('web_vital', {
          metric: 'LCP',
          value: Math.round(entry.startTime),
        });
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // FID
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming;
        trackEvent('web_vital', {
          metric: 'FID',
          value: Math.round(fidEntry.processingStart - fidEntry.startTime),
        });
      }
    }).observe({ type: 'first-input', buffered: true });

    // CLS
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
        }
      }
      trackEvent('web_vital', {
        metric: 'CLS',
        value: Math.round(clsValue * 1000),
      });
    }).observe({ type: 'layout-shift', buffered: true });
  }
}
