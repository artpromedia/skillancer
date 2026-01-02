// @ts-nocheck
/**
 * Credential Export Service
 * Export credentials to various formats (JSON-LD, JWT, PDF, embed codes)
 * Sprint M4: Portable Verified Work History
 */

import { createLogger } from '@skillancer/logger';
import { prisma } from '@skillancer/database';
import { createHash, createHmac } from 'crypto';
import {
  VerifiableCredential,
  VerifiablePresentation,
  CredentialBundle,
  getPortableCredentialService,
} from './portable-credential';

const logger = createLogger('credential-export');

// =============================================================================
// TYPES
// =============================================================================

export type ExportFormat =
  | 'json-ld'
  | 'jwt'
  | 'pdf'
  | 'png-badge'
  | 'embed-code'
  | 'linkedin'
  | 'qr-code';

export interface ExportOptions {
  format: ExportFormat;
  credentialId?: string;
  bundleId?: string;
  includeQrCode?: boolean;
  theme?: 'light' | 'dark';
  size?: 'small' | 'medium' | 'large';
}

export interface ExportResult {
  format: ExportFormat;
  data: string | Buffer;
  mimeType: string;
  filename: string;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  credentialId?: string;
  bundleId?: string;
  exportedAt: Date;
  expiresAt?: Date;
  verificationUrl: string;
  size: number;
}

export interface EmbedCode {
  html: string;
  markdown: string;
  iframeUrl: string;
  badgeUrl: string;
  verificationUrl: string;
}

export interface LinkedInCertification {
  name: string;
  organizationId: string;
  organizationName: string;
  issueDate: string;
  expirationDate?: string;
  credentialId: string;
  credentialUrl: string;
}

// =============================================================================
// CREDENTIAL EXPORT SERVICE
// =============================================================================

export class CredentialExportService {
  private readonly baseUrl: string;
  private readonly jwtSecret: string;

  constructor() {
    this.baseUrl = process.env.APP_URL || 'https://skillancer.com';
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  }

  // ---------------------------------------------------------------------------
  // MAIN EXPORT METHODS
  // ---------------------------------------------------------------------------

  /**
   * Export credential in specified format
   */
  async exportCredential(credentialId: string, options: ExportOptions): Promise<ExportResult> {
    logger.info({ credentialId, format: options.format }, 'Exporting credential');

    const credential = await this.getCredentialFromDb(credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    switch (options.format) {
      case 'json-ld':
        return this.exportAsJsonLd(credential);
      case 'jwt':
        return this.exportAsJwt(credential);
      case 'pdf':
        return this.exportAsPdf(credential, options);
      case 'png-badge':
        return this.exportAsBadge(credential, options);
      case 'embed-code':
        return this.exportAsEmbedCode(credential);
      case 'linkedin':
        return this.exportForLinkedIn(credential);
      case 'qr-code':
        return this.exportAsQrCode(credential);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export credential bundle
   */
  async exportBundle(userId: string, options: ExportOptions): Promise<ExportResult> {
    logger.info({ userId, format: options.format }, 'Exporting credential bundle');

    const credentialService = getPortableCredentialService();
    const bundle = await credentialService.issueCredentialBundle(userId, [
      'CompleteProfile',
      'WorkHistory',
      'Earnings',
      'Skills',
      'Reviews',
    ]);

    switch (options.format) {
      case 'json-ld':
        return this.exportBundleAsJsonLd(bundle);
      case 'pdf':
        return this.exportBundleAsPdf(bundle, options);
      default:
        throw new Error(`Unsupported bundle export format: ${options.format}`);
    }
  }

  // ---------------------------------------------------------------------------
  // JSON-LD EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsJsonLd(credential: VerifiableCredential): Promise<ExportResult> {
    const jsonLd = JSON.stringify(credential, null, 2);

    return {
      format: 'json-ld',
      data: jsonLd,
      mimeType: 'application/ld+json',
      filename: `credential-${this.extractCredentialId(credential)}.jsonld`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : undefined,
        verificationUrl: this.getVerificationUrl(credential.id),
        size: Buffer.byteLength(jsonLd, 'utf8'),
      },
    };
  }

  private async exportBundleAsJsonLd(bundle: CredentialBundle): Promise<ExportResult> {
    const jsonLd = JSON.stringify(bundle, null, 2);

    return {
      format: 'json-ld',
      data: jsonLd,
      mimeType: 'application/ld+json',
      filename: `credential-bundle-${Date.now()}.jsonld`,
      metadata: {
        bundleId: bundle.metadata.bundleHash.substring(0, 16),
        exportedAt: new Date(),
        verificationUrl: `${this.baseUrl}/verify/bundle/${bundle.metadata.bundleHash.substring(0, 16)}`,
        size: Buffer.byteLength(jsonLd, 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // JWT EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsJwt(credential: VerifiableCredential): Promise<ExportResult> {
    // Create JWT header
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    // Create JWT payload
    const payload = {
      iss: credential.issuer.id,
      sub: credential.credentialSubject.id,
      iat: Math.floor(new Date(credential.issuanceDate).getTime() / 1000),
      exp: credential.expirationDate
        ? Math.floor(new Date(credential.expirationDate).getTime() / 1000)
        : undefined,
      vc: credential,
    };

    // Encode
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Sign
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

    return {
      format: 'jwt',
      data: jwt,
      mimeType: 'application/jwt',
      filename: `credential-${this.extractCredentialId(credential)}.jwt`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        expiresAt: credential.expirationDate ? new Date(credential.expirationDate) : undefined,
        verificationUrl: this.getVerificationUrl(credential.id),
        size: Buffer.byteLength(jwt, 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // PDF EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsPdf(
    credential: VerifiableCredential,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate PDF content
    // In production, use a library like PDFKit or Puppeteer
    const pdfContent = this.generatePdfContent(credential, options);

    // For now, return a placeholder that indicates PDF generation is needed
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Skillancer Verified Credential</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: ${options.theme === 'dark' ? '#1a1a2e' : '#ffffff'};
            color: ${options.theme === 'dark' ? '#ffffff' : '#1a1a2e'};
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #6366f1;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #6366f1;
          }
          .badge {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
          }
          .credential-type {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .subject-id {
            color: #6b7280;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #6366f1;
          }
          .data-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          .data-item {
            background: ${options.theme === 'dark' ? '#252540' : '#f3f4f6'};
            padding: 15px;
            border-radius: 8px;
          }
          .data-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .data-value {
            font-size: 18px;
            font-weight: 600;
          }
          .verification {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            margin-top: 40px;
          }
          .qr-placeholder {
            width: 150px;
            height: 150px;
            background: white;
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid ${options.theme === 'dark' ? '#333' : '#e5e7eb'};
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        ${pdfContent}
      </body>
      </html>
    `;

    return {
      format: 'pdf',
      data: pdfHtml,
      mimeType: 'text/html', // Would be application/pdf in production
      filename: `credential-${this.extractCredentialId(credential)}.html`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        verificationUrl: this.getVerificationUrl(credential.id),
        size: Buffer.byteLength(pdfHtml, 'utf8'),
      },
    };
  }

  private generatePdfContent(credential: VerifiableCredential, options: ExportOptions): string {
    const subject = credential.credentialSubject;
    const type = credential.type[1] || 'Verified Credential';

    return `
      <div class="header">
        <div class="logo">Skillancer</div>
        <div class="badge">✓ Verified</div>
      </div>

      <div class="credential-type">${type.replace('Credential', ' Credential')}</div>
      <div class="subject-id">${subject.id}</div>

      <div class="section">
        <div class="section-title">Credential Details</div>
        <div class="data-grid">
          ${Object.entries(subject)
            .filter(([key]) => !['id', 'type'].includes(key))
            .slice(0, 6)
            .map(
              ([key, value]) => `
              <div class="data-item">
                <div class="data-label">${this.formatLabel(key)}</div>
                <div class="data-value">${this.formatValue(value)}</div>
              </div>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="verification">
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">
          Verified by Skillancer
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          Issued: ${new Date(credential.issuanceDate).toLocaleDateString()}
          ${credential.expirationDate ? ` • Expires: ${new Date(credential.expirationDate).toLocaleDateString()}` : ''}
        </div>
        <div class="qr-placeholder">
          <span style="color: #333;">QR Code</span>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          Scan to verify this credential
        </div>
      </div>

      <div class="footer">
        <p>Credential ID: ${credential.id}</p>
        <p>Verify at: ${this.getVerificationUrl(credential.id)}</p>
        <p>This credential was issued by Skillancer and cryptographically signed.</p>
      </div>
    `;
  }

  private async exportBundleAsPdf(
    bundle: CredentialBundle,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate combined PDF for all credentials
    const sections = bundle.credentials.map((c) => this.generatePdfContent(c, options));

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Skillancer Credential Bundle</title>
        <style>
          /* Same styles as single credential */
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          .page-break { page-break-after: always; margin-top: 60px; }
        </style>
      </head>
      <body>
        ${sections.join('<div class="page-break"></div>')}
      </body>
      </html>
    `;

    return {
      format: 'pdf',
      data: html,
      mimeType: 'text/html',
      filename: `credential-bundle-${Date.now()}.html`,
      metadata: {
        bundleId: bundle.metadata.bundleHash.substring(0, 16),
        exportedAt: new Date(),
        verificationUrl: `${this.baseUrl}/verify/bundle/${bundle.metadata.bundleHash.substring(0, 16)}`,
        size: Buffer.byteLength(html, 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // BADGE EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsBadge(
    credential: VerifiableCredential,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate SVG badge
    const size = options.size === 'small' ? 150 : options.size === 'large' ? 300 : 200;
    const type = credential.type[1]?.replace('Credential', '') || 'Verified';

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#6366f1"/>
            <stop offset="100%" style="stop-color:#8b5cf6"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.25"/>
          </filter>
        </defs>
        
        <!-- Background -->
        <circle cx="100" cy="100" r="95" fill="url(#bgGradient)" filter="url(#shadow)"/>
        
        <!-- Inner circle -->
        <circle cx="100" cy="100" r="80" fill="white" fill-opacity="0.1"/>
        
        <!-- Checkmark -->
        <path d="M65 100 L90 125 L135 75" stroke="white" stroke-width="8" fill="none" 
              stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Text -->
        <text x="100" y="160" text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="14" font-weight="bold" fill="white">${type}</text>
        <text x="100" y="178" text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="10" fill="white" opacity="0.8">Skillancer</text>
      </svg>
    `;

    return {
      format: 'png-badge',
      data: svg,
      mimeType: 'image/svg+xml',
      filename: `badge-${this.extractCredentialId(credential)}.svg`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        verificationUrl: this.getVerificationUrl(credential.id),
        size: Buffer.byteLength(svg, 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // EMBED CODE EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsEmbedCode(credential: VerifiableCredential): Promise<ExportResult> {
    const credentialId = this.extractCredentialId(credential);
    const type = credential.type[1]?.replace('Credential', '') || 'Verified';

    const embedCode: EmbedCode = {
      html: `<a href="${this.baseUrl}/verify/${credentialId}" target="_blank" rel="noopener">
  <img src="${this.baseUrl}/api/v1/credentials/${credentialId}/badge" 
       alt="Skillancer Verified ${type}" 
       width="150" height="150" />
</a>`,
      markdown: `[![Skillancer Verified ${type}](${this.baseUrl}/api/v1/credentials/${credentialId}/badge)](${this.baseUrl}/verify/${credentialId})`,
      iframeUrl: `${this.baseUrl}/embed/credential/${credentialId}`,
      badgeUrl: `${this.baseUrl}/api/v1/credentials/${credentialId}/badge`,
      verificationUrl: this.getVerificationUrl(credentialId),
    };

    return {
      format: 'embed-code',
      data: JSON.stringify(embedCode, null, 2),
      mimeType: 'application/json',
      filename: `embed-${credentialId}.json`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        verificationUrl: embedCode.verificationUrl,
        size: Buffer.byteLength(JSON.stringify(embedCode), 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // LINKEDIN EXPORT
  // ---------------------------------------------------------------------------

  private async exportForLinkedIn(credential: VerifiableCredential): Promise<ExportResult> {
    const type = credential.type[1]?.replace('Credential', '') || 'Verified';
    const credentialId = this.extractCredentialId(credential);

    const linkedInData: LinkedInCertification = {
      name: `Skillancer ${type} Credential`,
      organizationId: process.env.LINKEDIN_ORG_ID || '12345678',
      organizationName: 'Skillancer',
      issueDate: credential.issuanceDate.split('T')[0].replace(/-/g, ''),
      expirationDate: credential.expirationDate
        ? credential.expirationDate.split('T')[0].replace(/-/g, '')
        : undefined,
      credentialId,
      credentialUrl: this.getVerificationUrl(credentialId),
    };

    // LinkedIn Add to Profile URL
    const linkedInUrl = new URL('https://www.linkedin.com/profile/add');
    linkedInUrl.searchParams.set('startTask', 'CERTIFICATION_NAME');
    linkedInUrl.searchParams.set('name', linkedInData.name);
    linkedInUrl.searchParams.set('organizationId', linkedInData.organizationId);
    linkedInUrl.searchParams.set(
      'issueYear',
      new Date(credential.issuanceDate).getFullYear().toString()
    );
    linkedInUrl.searchParams.set(
      'issueMonth',
      (new Date(credential.issuanceDate).getMonth() + 1).toString()
    );
    linkedInUrl.searchParams.set('certId', linkedInData.credentialId);
    linkedInUrl.searchParams.set('certUrl', linkedInData.credentialUrl);

    const result = {
      linkedInData,
      addToProfileUrl: linkedInUrl.toString(),
      instructions: [
        '1. Click the "Add to Profile" URL to open LinkedIn',
        '2. Verify the credential details',
        '3. Click "Save" to add to your profile',
        '4. The credential will appear in your Licenses & Certifications section',
      ],
    };

    return {
      format: 'linkedin',
      data: JSON.stringify(result, null, 2),
      mimeType: 'application/json',
      filename: `linkedin-${credentialId}.json`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        verificationUrl: linkedInData.credentialUrl,
        size: Buffer.byteLength(JSON.stringify(result), 'utf8'),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // QR CODE EXPORT
  // ---------------------------------------------------------------------------

  private async exportAsQrCode(credential: VerifiableCredential): Promise<ExportResult> {
    const verificationUrl = this.getVerificationUrl(credential.id);

    // Generate QR code SVG
    // In production, use a QR code library like qrcode
    const qrSvg = this.generateQrCodePlaceholder(verificationUrl);

    return {
      format: 'qr-code',
      data: qrSvg,
      mimeType: 'image/svg+xml',
      filename: `qr-${this.extractCredentialId(credential)}.svg`,
      metadata: {
        credentialId: credential.id,
        exportedAt: new Date(),
        verificationUrl,
        size: Buffer.byteLength(qrSvg, 'utf8'),
      },
    };
  }

  private generateQrCodePlaceholder(url: string): string {
    // Placeholder QR code SVG
    // In production, use actual QR code generation
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="white"/>
        <rect x="20" y="20" width="60" height="60" fill="#1a1a2e"/>
        <rect x="120" y="20" width="60" height="60" fill="#1a1a2e"/>
        <rect x="20" y="120" width="60" height="60" fill="#1a1a2e"/>
        <rect x="30" y="30" width="40" height="40" fill="white"/>
        <rect x="130" y="30" width="40" height="40" fill="white"/>
        <rect x="30" y="130" width="40" height="40" fill="white"/>
        <rect x="40" y="40" width="20" height="20" fill="#1a1a2e"/>
        <rect x="140" y="40" width="20" height="20" fill="#1a1a2e"/>
        <rect x="40" y="140" width="20" height="20" fill="#1a1a2e"/>
        <!-- Data modules (simplified) -->
        <rect x="90" y="90" width="20" height="20" fill="#6366f1"/>
        <text x="100" y="195" text-anchor="middle" font-family="Arial" font-size="8" fill="#666">
          ${url.substring(0, 40)}...
        </text>
      </svg>
    `;
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private async getCredentialFromDb(credentialId: string): Promise<VerifiableCredential | null> {
    const stored = await prisma.verifiableCredential.findFirst({
      where: {
        OR: [{ id: credentialId }, { id: `urn:uuid:${credentialId}` }],
        revoked: false,
      },
    });

    if (!stored) {
      return null;
    }

    return stored.credentialData as unknown as VerifiableCredential;
  }

  private extractCredentialId(credential: VerifiableCredential): string {
    return credential.id.replace('urn:uuid:', '');
  }

  private getVerificationUrl(credentialId: string): string {
    const id = credentialId.replace('urn:uuid:', '');
    return `${this.baseUrl}/verify/${id}`;
  }

  private formatLabel(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (Array.isArray(value)) {
      return value.length > 3 ? `${value.slice(0, 3).join(', ')}...` : value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).substring(0, 50);
    }
    return String(value);
  }

  // ---------------------------------------------------------------------------
  // BULK OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Export all credentials for a user
   */
  async exportAllCredentials(userId: string, format: ExportFormat): Promise<ExportResult[]> {
    const credentials = await prisma.verifiableCredential.findMany({
      where: {
        subjectId: { contains: userId },
        revoked: false,
      },
    });

    const results: ExportResult[] = [];

    for (const stored of credentials) {
      const credential = stored.credentialData as unknown as VerifiableCredential;
      const result = await this.exportCredential(credential.id, { format });
      results.push(result);
    }

    return results;
  }
}

// Singleton instance
let serviceInstance: CredentialExportService | null = null;

export function getCredentialExportService(): CredentialExportService {
  if (!serviceInstance) {
    serviceInstance = new CredentialExportService();
  }
  return serviceInstance;
}

