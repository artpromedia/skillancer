/**
 * @module @skillancer/analytics/client
 * Browser and Node.js analytics client SDK
 */

import { v4 as uuidv4 } from 'uuid';
import type { AnalyticsEvent, BaseEvent, ConsentConfig, EventContext } from '../events/index.js';

// ==================== Types ====================

export interface AnalyticsClientConfig {
  /** API write key for authentication */
  writeKey: string;
  /** Analytics API endpoint */
  apiEndpoint?: string;
  /** Flush interval in milliseconds */
  flushInterval?: number;
  /** Maximum events before auto-flush */
  flushSize?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Default context for all events */
  defaultContext?: Partial<EventContext>;
  /** Middleware functions */
  middleware?: AnalyticsMiddleware[];
  /** Initial consent configuration */
  consent?: ConsentConfig;
  /** Enable offline queue */
  enableOfflineQueue?: boolean;
  /** Maximum offline queue size */
  maxOfflineQueueSize?: number;
}

export type AnalyticsMiddleware = (
  event: Partial<AnalyticsEvent>,
  next: (event: Partial<AnalyticsEvent>) => void
) => void;

interface QueuedEvent {
  event: Partial<AnalyticsEvent>;
  retryCount: number;
  timestamp: number;
}

// ==================== Analytics Client ====================

export class AnalyticsClient {
  private config: Required<AnalyticsClientConfig>;
  private queue: QueuedEvent[] = [];
  private offlineQueue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private anonymousId: string;
  private userId: string | null = null;
  private sessionId: string;
  private sessionStartTime: Date;
  private pageLoadTime: number;
  private consent: ConsentConfig;
  private isOnline = true;

  constructor(config: AnalyticsClientConfig) {
    this.config = {
      apiEndpoint: 'https://analytics.skillancer.com/v1',
      flushInterval: 10000,
      flushSize: 20,
      maxRetries: 3,
      debug: false,
      defaultContext: {},
      middleware: [],
      consent: { analytics: false, marketing: false, personalization: false },
      enableOfflineQueue: true,
      maxOfflineQueueSize: 100,
      ...config,
    };

    this.anonymousId = this.getOrCreateAnonymousId();
    this.sessionId = this.getOrCreateSessionId();
    this.sessionStartTime = new Date();
    this.pageLoadTime = Date.now();
    this.consent = this.loadConsent() || this.config.consent;

    this.startFlushTimer();
    this.setupPageTracking();
    this.setupOnlineListener();
    this.loadOfflineQueue();
  }

  // ==================== Core Methods ====================

  /**
   * Identify a user with traits
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    this.userId = userId;
    this.persistUserId(userId);

    this.enqueue({
      eventType: 'identify',
      properties: traits || {},
    });

    // Attempt to stitch anonymous events
    if (this.config.debug) {
      console.log('[Analytics] User identified:', userId);
    }
  }

  /**
   * Track a custom event
   */
  track(eventName: string, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'track',
      eventName,
      properties: properties || {},
    } as Partial<AnalyticsEvent>);
  }

  /**
   * Track a page view
   */
  page(pageName?: string, properties?: Record<string, unknown>): void {
    const pageProps = {
      pageName: pageName || this.getPageTitle(),
      pageCategory: properties?.category,
      previousPage: this.getPreviousPage(),
      timeOnPreviousPage: this.getTimeOnPage(),
      ...properties,
    };

    this.enqueue({
      eventType: 'page_view',
      properties: pageProps,
    });

    this.updatePageTracking();
  }

  /**
   * Alias an anonymous ID to a user ID
   */
  alias(newId: string, previousId?: string): void {
    this.enqueue({
      eventType: 'alias' as any,
      properties: {
        newId,
        previousId: previousId || this.anonymousId,
      },
    });
  }

  /**
   * Create a new analytics group
   */
  group(groupId: string, traits?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'group' as any,
      properties: {
        groupId,
        ...traits,
      },
    });
  }

  // ==================== SkillPod Events ====================

  trackCourseViewed(courseId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'course_viewed',
      properties: { courseId, ...properties },
    });
  }

  trackCourseEnrolled(courseId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'course_enrolled',
      properties: { courseId, ...properties },
    });
  }

  trackCourseCompleted(courseId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'course_completed',
      properties: { courseId, ...properties },
    });
  }

  trackLessonStarted(lessonId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'lesson_started',
      properties: { lessonId, ...properties },
    });
  }

  trackLessonCompleted(lessonId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'lesson_completed',
      properties: { lessonId, ...properties },
    });
  }

  trackVideoPlay(videoId: string, position: number, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'video_play',
      properties: { videoId, position, ...properties },
    });
  }

  trackVideoPause(videoId: string, position: number, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'video_pause',
      properties: { videoId, position, ...properties },
    });
  }

  trackVideoComplete(videoId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'video_complete',
      properties: { videoId, ...properties },
    });
  }

  trackAssessmentStarted(assessmentId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'assessment_started',
      properties: { assessmentId, ...properties },
    });
  }

  trackAssessmentSubmitted(assessmentId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'assessment_submitted',
      properties: { assessmentId, ...properties },
    });
  }

  // ==================== Market Events ====================

  trackJobViewed(jobId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'job_viewed',
      properties: { jobId, ...properties },
    });
  }

  trackJobSaved(jobId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'job_saved',
      properties: { jobId, ...properties },
    });
  }

  trackProposalStarted(jobId: string, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'proposal_started',
      properties: { jobId, ...properties },
    });
  }

  trackProposalSubmitted(proposalId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'proposal_submitted',
      properties: { proposalId, ...properties },
    });
  }

  trackSearchPerformed(
    searchType: 'jobs' | 'freelancers' | 'courses' | 'global',
    query: string,
    properties?: Record<string, unknown>
  ): void {
    this.enqueue({
      eventType: 'search_performed',
      properties: { searchType, query, ...properties },
    });
  }

  trackContractCreated(contractId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'contract_created',
      properties: { contractId, ...properties },
    });
  }

  // ==================== Cockpit Events ====================

  trackTimerStarted(properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'timer_started',
      properties,
    });
  }

  trackTimerStopped(duration: number, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'timer_stopped',
      properties: { duration, ...properties },
    });
  }

  trackTimeEntryCreated(entryId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'time_entry_created',
      properties: { entryId, ...properties },
    });
  }

  trackInvoiceCreated(invoiceId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'invoice_created',
      properties: { invoiceId, ...properties },
    });
  }

  trackInvoiceSent(invoiceId: string, properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'invoice_sent',
      properties: { invoiceId, ...properties },
    });
  }

  // ==================== Conversion Events ====================

  trackSignupStarted(properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'signup_started',
      properties: properties || {},
    });
  }

  trackSignupCompleted(properties: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'signup_completed',
      properties,
    });
  }

  trackOnboardingStep(
    stepNumber: number,
    stepName: string,
    properties?: Record<string, unknown>
  ): void {
    this.enqueue({
      eventType: 'onboarding_step_completed',
      properties: { stepNumber, stepName, ...properties },
    });
  }

  trackSubscriptionStarted(
    plan: string,
    value: number,
    properties?: Record<string, unknown>
  ): void {
    this.enqueue({
      eventType: 'subscription_started',
      properties: { subscriptionPlan: plan, subscriptionValue: value, ...properties },
    });
  }

  // ==================== Engagement Events ====================

  trackFeatureUsed(featureName: string, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'feature_used',
      properties: { featureName, ...properties },
    });
  }

  trackNotificationClicked(notificationId: string, notificationType: string): void {
    this.enqueue({
      eventType: 'notification_clicked',
      properties: { notificationId, notificationType },
    });
  }

  trackError(errorMessage: string, properties?: Record<string, unknown>): void {
    this.enqueue({
      eventType: 'error_occurred',
      properties: { errorMessage, ...properties },
    });
  }

  // ==================== Experiment Events ====================

  trackExperimentViewed(experimentId: string, variantId: string, experimentName?: string): void {
    this.enqueue({
      eventType: 'experiment_viewed',
      properties: { experimentId, variantId, experimentName },
    });
  }

  trackExperimentConverted(
    experimentId: string,
    variantId: string,
    conversionGoal: string,
    conversionValue?: number
  ): void {
    this.enqueue({
      eventType: 'experiment_converted',
      properties: { experimentId, variantId, conversionGoal, conversionValue },
    });
  }

  // ==================== Consent Management ====================

  /**
   * Update user consent preferences
   */
  setConsent(consent: Partial<ConsentConfig>): void {
    this.consent = { ...this.consent, ...consent };
    this.persistConsent(this.consent);

    // Track consent change if analytics allowed
    if (this.consent.analytics) {
      this.track('consent_updated', { consent: this.consent });
    }
  }

  /**
   * Get current consent configuration
   */
  getConsent(): ConsentConfig {
    return { ...this.consent };
  }

  // ==================== Session Management ====================

  /**
   * Reset analytics state (logout)
   */
  reset(): void {
    this.userId = null;
    this.sessionId = uuidv4();
    this.anonymousId = uuidv4();
    this.persistAnonymousId(this.anonymousId);
    this.clearUserId();

    if (this.config.debug) {
      console.log('[Analytics] State reset');
    }
  }

  /**
   * Get current anonymous ID
   */
  getAnonymousId(): string {
    return this.anonymousId;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Force flush all queued events
   */
  async flush(): Promise<void> {
    await this.flushQueue();
  }

  /**
   * Shutdown the analytics client
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.saveOfflineQueue();
  }

  // ==================== Private Methods ====================

  private enqueue(eventData: Partial<AnalyticsEvent>): void {
    // Check consent
    if (!this.consent.analytics && eventData.eventType !== 'identify') {
      if (this.config.debug) {
        console.log('[Analytics] Event blocked - no analytics consent');
      }
      return;
    }

    const event = this.buildEvent(eventData);

    // Apply middleware
    let processedEvent = event;
    for (const middleware of this.config.middleware) {
      let nextCalled = false;
      middleware(processedEvent, (e) => {
        processedEvent = e;
        nextCalled = true;
      });
      if (!nextCalled) return; // Middleware blocked the event
    }

    const queuedEvent: QueuedEvent = {
      event: processedEvent,
      retryCount: 0,
      timestamp: Date.now(),
    };

    if (this.isOnline) {
      this.queue.push(queuedEvent);

      if (this.config.debug) {
        console.log('[Analytics] Event queued:', processedEvent.eventType);
      }

      if (this.queue.length >= this.config.flushSize) {
        this.flushQueue();
      }
    } else if (this.config.enableOfflineQueue) {
      this.offlineQueue.push(queuedEvent);
      if (this.offlineQueue.length > this.config.maxOfflineQueueSize) {
        this.offlineQueue.shift(); // Remove oldest
      }
      this.saveOfflineQueue();

      if (this.config.debug) {
        console.log('[Analytics] Event queued offline:', processedEvent.eventType);
      }
    }
  }

  private buildEvent(eventData: Partial<AnalyticsEvent>): Partial<AnalyticsEvent> {
    const now = new Date();

    return {
      eventId: uuidv4(),
      eventVersion: '1.0',
      timestamp: now,
      sentAt: now,
      userId: this.userId || undefined,
      anonymousId: this.anonymousId,
      sessionId: this.sessionId,
      context: this.buildContext(),
      consent: this.consent,
      ...eventData,
    };
  }

  private buildContext(): EventContext {
    const context: EventContext = {
      ...this.config.defaultContext,
    };

    // Browser context
    if (typeof window !== 'undefined') {
      context.page = {
        path: window.location.pathname,
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        search: window.location.search,
      };

      context.screen = {
        width: window.screen.width,
        height: window.screen.height,
        density: window.devicePixelRatio,
      };

      context.browser = this.getBrowserInfo();
      context.os = this.getOSInfo();
      context.device = {
        type: this.getDeviceType(),
      };

      context.locale = navigator.language;
      context.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      context.userAgent = navigator.userAgent;

      // Campaign params
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('utm_source') || urlParams.has('utm_campaign')) {
        context.campaign = {
          source: urlParams.get('utm_source') || undefined,
          medium: urlParams.get('utm_medium') || undefined,
          name: urlParams.get('utm_campaign') || undefined,
          term: urlParams.get('utm_term') || undefined,
          content: urlParams.get('utm_content') || undefined,
        };
      }
    }

    // Server context
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      context.app = {
        name: process.env.SERVICE_NAME || 'unknown',
        version: process.env.APP_VERSION || '0.0.0',
      };
    }

    return context;
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    try {
      await this.sendEvents(eventsToSend);

      if (this.config.debug) {
        console.log(`[Analytics] Flushed ${eventsToSend.length} events`);
      }
    } catch (error) {
      // Re-queue failed events with retry
      const retriedEvents = eventsToSend
        .filter((e) => e.retryCount < this.config.maxRetries)
        .map((e) => ({ ...e, retryCount: e.retryCount + 1 }));

      this.queue = [...retriedEvents, ...this.queue];

      if (this.config.debug) {
        console.error('[Analytics] Flush failed:', error);
      }
    }
  }

  private async sendEvents(events: QueuedEvent[]): Promise<void> {
    const response = await fetch(`${this.config.apiEndpoint}/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.writeKey}`,
      },
      body: JSON.stringify({
        batch: events.map((e) => e.event),
        sentAt: new Date().toISOString(),
      }),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushQueue();
    }, this.config.flushInterval);
  }

  private setupPageTracking(): void {
    if (typeof window === 'undefined') return;

    // Track page views on navigation
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.page();
    };

    window.addEventListener('popstate', () => {
      this.page();
    });

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flushQueue();
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushQueue();
      }
    });
  }

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      // Move offline queue to main queue
      this.queue = [...this.offlineQueue, ...this.queue];
      this.offlineQueue = [];
      this.saveOfflineQueue();
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private updatePageTracking(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('_analytics_previous_page', window.location.pathname);
      sessionStorage.setItem('_analytics_page_load_time', Date.now().toString());
    }
  }

  private getPreviousPage(): string | undefined {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('_analytics_previous_page') || undefined;
    }
    return undefined;
  }

  private getTimeOnPage(): number | undefined {
    if (typeof window !== 'undefined') {
      const loadTime = sessionStorage.getItem('_analytics_page_load_time');
      if (loadTime) {
        return Date.now() - parseInt(loadTime, 10);
      }
    }
    return undefined;
  }

  private getPageTitle(): string {
    if (typeof document !== 'undefined') {
      return document.title || 'Unknown';
    }
    return 'Unknown';
  }

  private getOrCreateAnonymousId(): string {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('_analytics_anonymous_id');
      if (!id) {
        id = uuidv4();
        localStorage.setItem('_analytics_anonymous_id', id);
      }
      return id;
    }
    return uuidv4();
  }

  private persistAnonymousId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('_analytics_anonymous_id', id);
    }
  }

  private getOrCreateSessionId(): string {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('_analytics_session_id');
      if (!id) {
        id = uuidv4();
        sessionStorage.setItem('_analytics_session_id', id);
      }
      return id;
    }
    return uuidv4();
  }

  private persistUserId(userId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('_analytics_user_id', userId);
    }
  }

  private clearUserId(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('_analytics_user_id');
    }
  }

  private loadConsent(): ConsentConfig | null {
    if (typeof window !== 'undefined') {
      const consent = localStorage.getItem('_analytics_consent');
      return consent ? JSON.parse(consent) : null;
    }
    return null;
  }

  private persistConsent(consent: ConsentConfig): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('_analytics_consent', JSON.stringify(consent));
    }
  }

  private loadOfflineQueue(): void {
    if (typeof window !== 'undefined') {
      const queue = localStorage.getItem('_analytics_offline_queue');
      if (queue) {
        try {
          this.offlineQueue = JSON.parse(queue);
        } catch {
          this.offlineQueue = [];
        }
      }
    }
  }

  private saveOfflineQueue(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('_analytics_offline_queue', JSON.stringify(this.offlineQueue));
    }
  }

  private getBrowserInfo(): { name: string; version: string } {
    if (typeof navigator === 'undefined') {
      return { name: 'Unknown', version: '0' };
    }

    const ua = navigator.userAgent;
    let browser = { name: 'Unknown', version: '0' };

    if (ua.includes('Firefox')) {
      browser = { name: 'Firefox', version: ua.match(/Firefox\/(\d+)/)?.[1] || '0' };
    } else if (ua.includes('Edg')) {
      browser = { name: 'Edge', version: ua.match(/Edg\/(\d+)/)?.[1] || '0' };
    } else if (ua.includes('Chrome')) {
      browser = { name: 'Chrome', version: ua.match(/Chrome\/(\d+)/)?.[1] || '0' };
    } else if (ua.includes('Safari')) {
      browser = { name: 'Safari', version: ua.match(/Version\/(\d+)/)?.[1] || '0' };
    }

    return browser;
  }

  private getOSInfo(): { name: string; version: string } {
    if (typeof navigator === 'undefined') {
      return { name: 'Unknown', version: '0' };
    }

    const ua = navigator.userAgent;
    let os = { name: 'Unknown', version: '0' };

    if (ua.includes('Windows')) {
      os = { name: 'Windows', version: ua.match(/Windows NT (\d+\.\d+)/)?.[1] || '0' };
    } else if (ua.includes('Mac')) {
      os = {
        name: 'macOS',
        version: ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '0',
      };
    } else if (ua.includes('Linux')) {
      os = { name: 'Linux', version: '0' };
    } else if (ua.includes('Android')) {
      os = { name: 'Android', version: ua.match(/Android (\d+)/)?.[1] || '0' };
    } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
      os = { name: 'iOS', version: ua.match(/OS (\d+)/)?.[1] || '0' };
    }

    return os;
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'other' {
    if (typeof navigator === 'undefined') {
      return 'other';
    }

    const ua = navigator.userAgent;

    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
}
