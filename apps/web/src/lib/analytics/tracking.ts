/**
 * Analytics & Tracking Integration
 * Supports GA4, Mixpanel, Facebook Pixel, LinkedIn Insight Tag
 */

// ============================================================================
// Types
// ============================================================================

type EventName =
  | 'page_view'
  | 'signup_started'
  | 'signup_completed'
  | 'login'
  | 'cta_click'
  | 'newsletter_subscribe'
  | 'demo_request'
  | 'contact_submit'
  | 'pricing_view'
  | 'plan_selected'
  | 'blog_read'
  | 'help_article_view'
  | 'search'
  | 'social_share';

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// ============================================================================
// UTM Handling
// ============================================================================

const UTM_STORAGE_KEY = 'skillancer_utm';

export function captureUTMParams(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const utmParams: UTMParams = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

  utmKeys.forEach((key) => {
    const value = params.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  if (Object.keys(utmParams).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams));
  }
}

export function getUTMParams(): UTMParams {
  if (typeof window === 'undefined') return {};

  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as UTMParams) : {};
  } catch {
    return {};
  }
}

// ============================================================================
// Google Analytics 4
// ============================================================================

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
    fbq?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    lintrk?: (command: string, params?: Record<string, unknown>) => void;
    mixpanel?: {
      track: (eventName: string, properties?: Record<string, unknown>) => void;
      identify: (userId: string) => void;
      people: {
        set: (properties: Record<string, unknown>) => void;
      };
    };
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function initGA(): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll handle this manually
  });
}

export function trackPageView(url: string): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: url,
    ...getUTMParams(),
  });
}

export function trackGAEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, {
    ...properties,
    ...getUTMParams(),
  });
}

// ============================================================================
// Facebook Pixel
// ============================================================================

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export function initFacebookPixel(): void {
  if (!FB_PIXEL_ID || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.innerHTML = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${FB_PIXEL_ID}');
  `;
  document.head.appendChild(script);
}

export function trackFBEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!FB_PIXEL_ID || typeof window === 'undefined' || !window.fbq) return;

  window.fbq('track', eventName, properties);
}

// ============================================================================
// LinkedIn Insight Tag
// ============================================================================

const LINKEDIN_PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;

export function initLinkedIn(): void {
  if (!LINKEDIN_PARTNER_ID || typeof window === 'undefined') return;

  window._linkedin_partner_id = LINKEDIN_PARTNER_ID;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(LINKEDIN_PARTNER_ID);

  const script = document.createElement('script');
  script.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
  script.async = true;
  document.head.appendChild(script);
}

export function trackLinkedInConversion(conversionId: string): void {
  if (typeof window === 'undefined' || !window.lintrk) return;

  window.lintrk('track', { conversion_id: conversionId });
}

// ============================================================================
// Mixpanel
// ============================================================================

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

export function initMixpanel(): void {
  if (!MIXPANEL_TOKEN || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.innerHTML = `
    (function(c,a){if(!a.__SV){var b=window;try{var d,m,j,k=b.location,f=k.hash;d=function(a,b){return(m=a.match(RegExp(b+"=([^&]*)")))?m[1]:null};f&&d(f,"state")&&(j=JSON.parse(decodeURIComponent(d(f,"state"))),"mpeditor"===j.action&&(b.sessionStorage.setItem("_mpcehash",f),history.replaceState(j.desiredHash||"",c.title,k.pathname+k.search)))}catch(n){}var l,h;window.mixpanel=a;a._i=[];a.init=function(b,d,g){function c(b,i){var a=i.split(".");2==a.length&&(b=b[a[0]],i=a[1]);b[i]=function(){b.push([i].concat(Array.prototype.slice.call(arguments,0)))}}var e=a;"undefined"!==typeof g?e=a[g]=[]:g="mixpanel";e.people=e.people||[];e.toString=function(b){var a="mixpanel";"mixpanel"!==g&&(a+="."+g);b||(a+=" (stub)");return a};e.people.toString=function(){return e.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<l.length;h++)c(e,l[h]);var f="set set_once union unset remove delete".split(" ");e.get_group=function(){function a(c){b[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));e.push([d,call2])}}for(var b={},d=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<f.length;c++)a(f[c]);return b};a._i.push([b,d,g])};a.__SV=1.2;b=c.createElement("script");b.type="text/javascript";b.async=!0;b.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===c.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";d=c.getElementsByTagName("script")[0];d.parentNode.insertBefore(b,d)}})(document,window.mixpanel||[]);
    mixpanel.init('${MIXPANEL_TOKEN}', {batch_requests: true});
  `;
  document.head.appendChild(script);
}

export function trackMixpanelEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.mixpanel) return;

  window.mixpanel.track(eventName, {
    ...properties,
    ...getUTMParams(),
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.mixpanel) return;

  window.mixpanel.identify(userId);
  if (properties) {
    window.mixpanel.people.set(properties);
  }
}

// ============================================================================
// Unified Tracking API
// ============================================================================

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  captureUTMParams();
  initGA();
  initFacebookPixel();
  initLinkedIn();
  initMixpanel();
}

export function trackEvent(eventName: EventName, properties?: EventProperties): void {
  // Track across all platforms
  trackGAEvent(eventName, properties);
  trackMixpanelEvent(eventName, properties);

  // Map to Facebook standard events
  const fbEventMap: Partial<Record<EventName, string>> = {
    signup_completed: 'CompleteRegistration',
    newsletter_subscribe: 'Lead',
    demo_request: 'Lead',
    contact_submit: 'Contact',
  };

  const fbEventName = fbEventMap[eventName];
  if (fbEventName) {
    trackFBEvent(fbEventName, properties);
  }
}

export function trackConversion(conversionType: 'signup' | 'demo' | 'contact'): void {
  // LinkedIn conversion IDs (configure in env)
  const linkedInConversions: Record<string, string | undefined> = {
    signup: process.env.NEXT_PUBLIC_LINKEDIN_SIGNUP_CONVERSION,
    demo: process.env.NEXT_PUBLIC_LINKEDIN_DEMO_CONVERSION,
    contact: process.env.NEXT_PUBLIC_LINKEDIN_CONTACT_CONVERSION,
  };

  const conversionId = linkedInConversions[conversionType];
  if (conversionId) {
    trackLinkedInConversion(conversionId);
  }

  // Track in GA as conversion
  trackGAEvent(`conversion_${conversionType}`, { conversion_type: conversionType });
}
