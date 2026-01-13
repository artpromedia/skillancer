// @ts-nocheck
/**
 * SSO Integration Service
 * SAML 2.0 and OIDC support for enterprise customers
 */

import { PrismaClient } from '@/types/prisma-shim.js';
import { randomBytes, createHash, X509Certificate } from 'crypto';
import { getLogger } from '@skillancer/logger';
import { getAuditClient } from '@skillancer/audit-client';
import { publishEvent } from '../events/publisher';

// =============================================================================
// TYPES
// =============================================================================

type SsoType = 'SAML' | 'OIDC';
type SsoProvider = 'okta' | 'azure_ad' | 'google' | 'onelogin' | 'ping' | 'custom';
type SsoStatus = 'PENDING_SETUP' | 'CONFIGURED' | 'TESTING' | 'ACTIVE' | 'DISABLED' | 'ERROR';

interface SamlConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  signatureAlgorithm: 'sha256' | 'sha512';
  digestAlgorithm: 'sha256' | 'sha512';
  wantAssertionsSigned: boolean;
  wantMessagesSigned: boolean;
  nameIdFormat: 'email' | 'persistent' | 'transient';
  attributeMapping: {
    email: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    role?: string;
  };
}

interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  jwksUri: string;
  scopes: string[];
  responseType: 'code' | 'id_token' | 'code id_token';
  claims: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    department?: string;
  };
}

interface SsoConfiguration {
  tenantId: string;
  type: SsoType;
  provider: SsoProvider;
  displayName: string;
  enabled: boolean;
  samlConfig?: SamlConfig;
  oidcConfig?: OidcConfig;
  jitProvisioning: boolean;
  defaultRole: string;
  allowedDomains: string[];
  enforceForAllUsers: boolean;
}

interface SsoTestResult {
  success: boolean;
  message: string;
  details?: {
    validCertificate?: boolean;
    validEndpoints?: boolean;
    testUserEmail?: string;
    attributesReceived?: Record<string, string>;
    errors?: string[];
  };
}

interface SamlMetadata {
  entityId: string;
  acsUrl: string;
  sloUrl: string;
  certificate: string;
  metadataXml: string;
}

// =============================================================================
// SSO INTEGRATION SERVICE
// =============================================================================

export class SsoIntegrationService {
  private prisma: PrismaClient;
  private logger = getLogger('sso-integration');
  private audit = getAuditClient();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // ===========================================================================
  // SERVICE PROVIDER METADATA
  // ===========================================================================

  /**
   * Generate SAML Service Provider metadata for tenant
   */
  async getSpMetadata(tenantId: string): Promise<SamlMetadata> {
    const tenant = await this.prisma.skillpodTenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const baseUrl = `https://skillpod.skillancer.io/${tenant.slug}`;
    const entityId = `${baseUrl}/saml/metadata`;
    const acsUrl = `${baseUrl}/saml/acs`;
    const sloUrl = `${baseUrl}/saml/slo`;

    // Get or generate SP certificate
    const spCert = await this.getOrCreateSpCertificate(tenantId);

    const metadataXml = this.generateSamlMetadataXml({
      entityId,
      acsUrl,
      sloUrl,
      certificate: spCert.publicCert,
    });

    return {
      entityId,
      acsUrl,
      sloUrl,
      certificate: spCert.publicCert,
      metadataXml,
    };
  }

  /**
   * Generate SAML metadata XML
   */
  private generateSamlMetadataXml(params: {
    entityId: string;
    acsUrl: string;
    sloUrl: string;
    certificate: string;
  }): string {
    // Strip PEM headers and format certificate
    const cert = params.certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\n/g, '');

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${params.entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:KeyDescriptor use="encryption">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${params.sloUrl}"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${params.sloUrl}"/>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${params.acsUrl}" index="0" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * Get or create SP certificate for tenant
   */
  private async getOrCreateSpCertificate(tenantId: string): Promise<{
    publicCert: string;
    privateKey: string;
  }> {
    // Check for existing certificate
    const existing = await this.prisma.skillpodSpCertificate.findFirst({
      where: {
        tenantId,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      return {
        publicCert: existing.publicCert,
        privateKey: existing.privateKey,
      };
    }

    // Generate new self-signed certificate (in production, use proper CA)
    // This is a placeholder - real implementation would use a proper certificate library
    const { publicKey, privateKey } = await import('crypto').then((crypto) => 
      crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      })
    );

    // In production, create proper X509 certificate
    const publicCert = publicKey; // Placeholder

    // Store certificate
    await this.prisma.skillpodSpCertificate.create({
      data: {
        tenantId,
        publicCert,
        privateKey,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        createdAt: new Date(),
      },
    });

    return { publicCert, privateKey };
  }

  // ===========================================================================
  // SSO CONFIGURATION
  // ===========================================================================

  /**
   * Get SSO configuration for tenant
   */
  async getSsoConfig(tenantId: string): Promise<SsoConfiguration | null> {
    const config = await this.prisma.skillpodSsoConfig.findFirst({
      where: { tenantId },
    });

    if (!config) return null;

    return {
      tenantId: config.tenantId,
      type: config.type as SsoType,
      provider: config.provider as SsoProvider,
      displayName: config.displayName || `${config.provider} SSO`,
      enabled: config.enabled,
      samlConfig: config.samlConfig as SamlConfig | undefined,
      oidcConfig: config.oidcConfig ? {
        ...config.oidcConfig as OidcConfig,
        clientSecret: '********', // Mask secret
      } : undefined,
      jitProvisioning: config.jitProvisioning,
      defaultRole: config.defaultRole || 'USER',
      allowedDomains: config.allowedDomains || [],
      enforceForAllUsers: config.enforceForAllUsers,
    };
  }

  /**
   * Configure SAML SSO
   */
  async configureSaml(
    tenantId: string,
    config: {
      provider: SsoProvider;
      displayName?: string;
      entityId: string;
      ssoUrl: string;
      sloUrl?: string;
      certificate: string;
      attributeMapping?: Partial<SamlConfig['attributeMapping']>;
      jitProvisioning?: boolean;
      defaultRole?: string;
      allowedDomains?: string[];
      enforceForAllUsers?: boolean;
    },
    actorId: string
  ): Promise<void> {
    // Validate certificate
    this.validateCertificate(config.certificate);

    // Validate URLs
    this.validateUrl(config.ssoUrl, 'SSO URL');
    if (config.sloUrl) {
      this.validateUrl(config.sloUrl, 'SLO URL');
    }

    const samlConfig: SamlConfig = {
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      sloUrl: config.sloUrl,
      certificate: config.certificate,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantMessagesSigned: true,
      nameIdFormat: 'email',
      attributeMapping: {
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        ...config.attributeMapping,
      },
    };

    await this.prisma.skillpodSsoConfig.upsert({
      where: {
        tenantId_type: { tenantId, type: 'SAML' },
      },
      create: {
        tenantId,
        type: 'SAML',
        provider: config.provider,
        displayName: config.displayName || `${config.provider} SAML`,
        enabled: false, // Must be tested first
        status: 'CONFIGURED',
        samlConfig,
        jitProvisioning: config.jitProvisioning ?? false,
        defaultRole: config.defaultRole || 'USER',
        allowedDomains: config.allowedDomains || [],
        enforceForAllUsers: config.enforceForAllUsers ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        provider: config.provider,
        displayName: config.displayName,
        samlConfig,
        jitProvisioning: config.jitProvisioning,
        defaultRole: config.defaultRole,
        allowedDomains: config.allowedDomains,
        enforceForAllUsers: config.enforceForAllUsers,
        status: 'CONFIGURED',
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'SSO_CONFIGURED',
      resourceType: 'SSO_CONFIG',
      resourceId: tenantId,
      actorId,
      metadata: {
        type: 'SAML',
        provider: config.provider,
      },
    });

    this.logger.info('SAML SSO configured', {
      tenantId,
      provider: config.provider,
    });
  }

  /**
   * Configure OIDC SSO
   */
  async configureOidc(
    tenantId: string,
    config: {
      provider: SsoProvider;
      displayName?: string;
      issuer: string;
      clientId: string;
      clientSecret: string;
      scopes?: string[];
      claims?: Partial<OidcConfig['claims']>;
      jitProvisioning?: boolean;
      defaultRole?: string;
      allowedDomains?: string[];
      enforceForAllUsers?: boolean;
    },
    actorId: string
  ): Promise<void> {
    // Validate issuer URL
    this.validateUrl(config.issuer, 'Issuer URL');

    // Discover OIDC endpoints
    const discovery = await this.discoverOidcEndpoints(config.issuer);

    const oidcConfig: OidcConfig = {
      issuer: config.issuer,
      clientId: config.clientId,
      clientSecret: config.clientSecret, // Will be encrypted before storage
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      userInfoEndpoint: discovery.userinfo_endpoint,
      jwksUri: discovery.jwks_uri,
      scopes: config.scopes || ['openid', 'email', 'profile'],
      responseType: 'code',
      claims: {
        email: 'email',
        name: 'name',
        firstName: 'given_name',
        lastName: 'family_name',
        picture: 'picture',
        ...config.claims,
      },
    };

    // Encrypt client secret before storage
    const encryptedSecret = await this.encryptSecret(config.clientSecret);

    await this.prisma.skillpodSsoConfig.upsert({
      where: {
        tenantId_type: { tenantId, type: 'OIDC' },
      },
      create: {
        tenantId,
        type: 'OIDC',
        provider: config.provider,
        displayName: config.displayName || `${config.provider} OIDC`,
        enabled: false, // Must be tested first
        status: 'CONFIGURED',
        oidcConfig: { ...oidcConfig, clientSecret: encryptedSecret },
        jitProvisioning: config.jitProvisioning ?? true,
        defaultRole: config.defaultRole || 'USER',
        allowedDomains: config.allowedDomains || [],
        enforceForAllUsers: config.enforceForAllUsers ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        provider: config.provider,
        displayName: config.displayName,
        oidcConfig: { ...oidcConfig, clientSecret: encryptedSecret },
        jitProvisioning: config.jitProvisioning,
        defaultRole: config.defaultRole,
        allowedDomains: config.allowedDomains,
        enforceForAllUsers: config.enforceForAllUsers,
        status: 'CONFIGURED',
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'SSO_CONFIGURED',
      resourceType: 'SSO_CONFIG',
      resourceId: tenantId,
      actorId,
      metadata: {
        type: 'OIDC',
        provider: config.provider,
      },
    });

    this.logger.info('OIDC SSO configured', {
      tenantId,
      provider: config.provider,
    });
  }

  /**
   * Discover OIDC endpoints from issuer
   */
  private async discoverOidcEndpoints(issuer: string): Promise<{
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
    jwks_uri: string;
  }> {
    const wellKnownUrl = issuer.endsWith('/')
      ? `${issuer}.well-known/openid-configuration`
      : `${issuer}/.well-known/openid-configuration`;

    const response = await fetch(wellKnownUrl);
    if (!response.ok) {
      throw new Error(`Failed to discover OIDC endpoints: ${response.status}`);
    }

    const discovery = await response.json();

    if (!discovery.authorization_endpoint || !discovery.token_endpoint) {
      throw new Error('Invalid OIDC discovery document');
    }

    return {
      authorization_endpoint: discovery.authorization_endpoint,
      token_endpoint: discovery.token_endpoint,
      userinfo_endpoint: discovery.userinfo_endpoint,
      jwks_uri: discovery.jwks_uri,
    };
  }

  // ===========================================================================
  // SSO TESTING
  // ===========================================================================

  /**
   * Test SSO configuration
   */
  async testSsoConfig(tenantId: string, actorId: string): Promise<SsoTestResult> {
    const config = await this.prisma.skillpodSsoConfig.findFirst({
      where: { tenantId },
    });

    if (!config) {
      return {
        success: false,
        message: 'No SSO configuration found',
      };
    }

    // Update status to testing
    await this.prisma.skillpodSsoConfig.update({
      where: { id: config.id },
      data: { status: 'TESTING' },
    });

    try {
      let result: SsoTestResult;

      if (config.type === 'SAML') {
        result = await this.testSamlConfig(config.samlConfig as SamlConfig);
      } else {
        result = await this.testOidcConfig(config.oidcConfig as OidcConfig);
      }

      // Update status based on result
      await this.prisma.skillpodSsoConfig.update({
        where: { id: config.id },
        data: {
          status: result.success ? 'CONFIGURED' : 'ERROR',
          lastTestedAt: new Date(),
          lastTestResult: result,
        },
      });

      await this.audit.log({
        action: 'SSO_TESTED',
        resourceType: 'SSO_CONFIG',
        resourceId: tenantId,
        actorId,
        metadata: {
          type: config.type,
          success: result.success,
        },
      });

      return result;
    } catch (error) {
      await this.prisma.skillpodSsoConfig.update({
        where: { id: config.id },
        data: {
          status: 'ERROR',
          lastTestedAt: new Date(),
          lastTestResult: {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      throw error;
    }
  }

  /**
   * Test SAML configuration
   */
  private async testSamlConfig(config: SamlConfig): Promise<SsoTestResult> {
    const errors: string[] = [];

    // Validate certificate
    try {
      this.validateCertificate(config.certificate);
    } catch (e) {
      errors.push(`Certificate error: ${e instanceof Error ? e.message : 'Invalid'}`);
    }

    // Test SSO URL accessibility
    try {
      const response = await fetch(config.ssoUrl, { method: 'HEAD' });
      if (!response.ok && response.status !== 405) {
        errors.push(`SSO URL not accessible: ${response.status}`);
      }
    } catch (e) {
      errors.push(`Cannot reach SSO URL: ${e instanceof Error ? e.message : 'Network error'}`);
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0
        ? 'SAML configuration is valid. Ready for activation.'
        : 'SAML configuration has errors',
      details: {
        validCertificate: !errors.some((e) => e.includes('Certificate')),
        validEndpoints: !errors.some((e) => e.includes('URL')),
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  /**
   * Test OIDC configuration
   */
  private async testOidcConfig(config: OidcConfig): Promise<SsoTestResult> {
    const errors: string[] = [];

    // Test JWKS endpoint
    try {
      const jwksResponse = await fetch(config.jwksUri);
      if (!jwksResponse.ok) {
        errors.push(`JWKS endpoint error: ${jwksResponse.status}`);
      }
    } catch (e) {
      errors.push(`Cannot reach JWKS endpoint: ${e instanceof Error ? e.message : 'Network error'}`);
    }

    // Test authorization endpoint
    try {
      const authResponse = await fetch(config.authorizationEndpoint, { method: 'HEAD' });
      if (!authResponse.ok && authResponse.status !== 405 && authResponse.status !== 302) {
        errors.push(`Authorization endpoint error: ${authResponse.status}`);
      }
    } catch (e) {
      errors.push(`Cannot reach authorization endpoint: ${e instanceof Error ? e.message : 'Network error'}`);
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0
        ? 'OIDC configuration is valid. Ready for activation.'
        : 'OIDC configuration has errors',
      details: {
        validEndpoints: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  // ===========================================================================
  // SSO ACTIVATION
  // ===========================================================================

  /**
   * Activate SSO for tenant
   */
  async activateSso(tenantId: string, actorId: string): Promise<void> {
    const config = await this.prisma.skillpodSsoConfig.findFirst({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('No SSO configuration found');
    }

    if (config.status !== 'CONFIGURED') {
      throw new Error(`Cannot activate SSO in ${config.status} status. Please configure and test first.`);
    }

    await this.prisma.skillpodSsoConfig.update({
      where: { id: config.id },
      data: {
        enabled: true,
        status: 'ACTIVE',
        activatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Publish event
    await publishEvent('skillpod.sso.activated', {
      tenantId,
      type: config.type,
      provider: config.provider,
    });

    await this.audit.log({
      action: 'SSO_ACTIVATED',
      resourceType: 'SSO_CONFIG',
      resourceId: tenantId,
      actorId,
      metadata: {
        type: config.type,
        provider: config.provider,
      },
    });

    this.logger.info('SSO activated', { tenantId, type: config.type });
  }

  /**
   * Deactivate SSO for tenant
   */
  async deactivateSso(tenantId: string, actorId: string): Promise<void> {
    const config = await this.prisma.skillpodSsoConfig.findFirst({
      where: { tenantId, enabled: true },
    });

    if (!config) {
      throw new Error('No active SSO configuration found');
    }

    await this.prisma.skillpodSsoConfig.update({
      where: { id: config.id },
      data: {
        enabled: false,
        status: 'DISABLED',
        updatedAt: new Date(),
      },
    });

    await this.audit.log({
      action: 'SSO_DEACTIVATED',
      resourceType: 'SSO_CONFIG',
      resourceId: tenantId,
      actorId,
    });

    this.logger.info('SSO deactivated', { tenantId });
  }

  /**
   * Delete SSO configuration
   */
  async deleteSsoConfig(tenantId: string, actorId: string): Promise<void> {
    const config = await this.prisma.skillpodSsoConfig.findFirst({
      where: { tenantId },
    });

    if (!config) {
      throw new Error('No SSO configuration found');
    }

    if (config.enabled) {
      throw new Error('Cannot delete active SSO configuration. Deactivate first.');
    }

    await this.prisma.skillpodSsoConfig.delete({
      where: { id: config.id },
    });

    await this.audit.log({
      action: 'SSO_DELETED',
      resourceType: 'SSO_CONFIG',
      resourceId: tenantId,
      actorId,
    });

    this.logger.info('SSO configuration deleted', { tenantId });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private validateCertificate(certPem: string): void {
    try {
      const cert = new X509Certificate(certPem);
      
      // Check expiration
      if (new Date(cert.validTo) < new Date()) {
        throw new Error('Certificate has expired');
      }

      // Check not-yet-valid
      if (new Date(cert.validFrom) > new Date()) {
        throw new Error('Certificate is not yet valid');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Certificate')) {
        throw e;
      }
      throw new Error('Invalid certificate format');
    }
  }

  private validateUrl(url: string, name: string): void {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`${name} must use HTTP or HTTPS`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes(name)) {
        throw e;
      }
      throw new Error(`Invalid ${name} format`);
    }
  }

  private async encryptSecret(secret: string): Promise<string> {
    // In production, use proper encryption with KMS
    // This is a placeholder that should be replaced
    const hash = createHash('sha256');
    hash.update(secret);
    return `enc:${hash.digest('hex')}:${secret.length}`;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let ssoService: SsoIntegrationService | null = null;

export function getSsoIntegrationService(): SsoIntegrationService {
  if (!ssoService) {
    const { PrismaClient } = require('@prisma/client');
    ssoService = new SsoIntegrationService(new PrismaClient());
  }
  return ssoService;
}

