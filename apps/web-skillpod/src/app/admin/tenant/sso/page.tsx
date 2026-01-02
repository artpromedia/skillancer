'use client';

/**
 * SSO Configuration Page
 * Configure and manage SAML/OIDC single sign-on
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Key,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  Upload,
  ExternalLink,
  Play,
  Power,
  Trash2,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@skillancer/ui/card';
import { Button } from '@skillancer/ui/button';
import { Input } from '@skillancer/ui/input';
import { Label } from '@skillancer/ui/label';
import { Textarea } from '@skillancer/ui/textarea';
import { Badge } from '@skillancer/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@skillancer/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@skillancer/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@skillancer/ui/select';
import { Switch } from '@skillancer/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@skillancer/ui/alert';
import { useToast } from '@skillancer/ui/use-toast';

// =============================================================================
// TYPES
// =============================================================================

interface SsoConfig {
  tenantId: string;
  type: 'SAML' | 'OIDC';
  provider: string;
  displayName: string;
  enabled: boolean;
  status: 'PENDING_SETUP' | 'CONFIGURED' | 'TESTING' | 'ACTIVE' | 'DISABLED' | 'ERROR';
  jitProvisioning: boolean;
  defaultRole: string;
  allowedDomains: string[];
  enforceForAllUsers: boolean;
  lastTestedAt?: string;
  lastTestResult?: {
    success: boolean;
    message: string;
  };
}

interface SpMetadata {
  entityId: string;
  acsUrl: string;
  sloUrl: string;
  certificate: string;
  metadataXml: string;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function fetchSsoConfig(): Promise<SsoConfig | null> {
  const response = await fetch('/api/admin/tenant/sso');
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch SSO config');
  return response.json();
}

async function fetchSpMetadata(): Promise<SpMetadata> {
  const response = await fetch('/api/admin/tenant/sso/metadata');
  if (!response.ok) throw new Error('Failed to fetch SP metadata');
  return response.json();
}

async function configureSaml(config: {
  provider: string;
  displayName?: string;
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  jitProvisioning?: boolean;
  defaultRole?: string;
  allowedDomains?: string[];
  enforceForAllUsers?: boolean;
}): Promise<void> {
  const response = await fetch('/api/admin/tenant/sso/saml', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to configure SAML');
  }
}

async function configureOidc(config: {
  provider: string;
  displayName?: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  jitProvisioning?: boolean;
  defaultRole?: string;
  allowedDomains?: string[];
  enforceForAllUsers?: boolean;
}): Promise<void> {
  const response = await fetch('/api/admin/tenant/sso/oidc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to configure OIDC');
  }
}

async function testSso(): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/admin/tenant/sso/test', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to test SSO');
  return response.json();
}

async function activateSso(): Promise<void> {
  const response = await fetch('/api/admin/tenant/sso/activate', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to activate SSO');
}

async function deactivateSso(): Promise<void> {
  const response = await fetch('/api/admin/tenant/sso/deactivate', {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to deactivate SSO');
}

async function deleteSso(): Promise<void> {
  const response = await fetch('/api/admin/tenant/sso', {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete SSO');
}

// =============================================================================
// COMPONENTS
// =============================================================================

const providerOptions = [
  { value: 'okta', label: 'Okta', type: 'both' },
  { value: 'azure_ad', label: 'Azure AD / Entra ID', type: 'both' },
  { value: 'google', label: 'Google Workspace', type: 'oidc' },
  { value: 'onelogin', label: 'OneLogin', type: 'saml' },
  { value: 'ping', label: 'Ping Identity', type: 'saml' },
  { value: 'custom', label: 'Custom Provider', type: 'both' },
];

const statusColors: Record<string, string> = {
  PENDING_SETUP: 'bg-gray-100 text-gray-800',
  CONFIGURED: 'bg-yellow-100 text-yellow-800',
  TESTING: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  DISABLED: 'bg-gray-100 text-gray-800',
  ERROR: 'bg-red-100 text-red-800',
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard.writeText(value);
    toast({ title: 'Copied', description: `${label} copied to clipboard` });
  };

  return (
    <Button variant="ghost" size="icon" onClick={copy} title="Copy">
      <Copy className="h-4 w-4" />
    </Button>
  );
}

function SpMetadataCard({ metadata }: { metadata: SpMetadata }) {
  const downloadMetadata = () => {
    const blob = new Blob([metadata.metadataXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skillpod-sp-metadata.xml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Service Provider Details</CardTitle>
        <CardDescription>
          Provide these values to your Identity Provider (IdP)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Entity ID (Audience)</Label>
          <div className="flex gap-2">
            <Input value={metadata.entityId} readOnly />
            <CopyButton value={metadata.entityId} label="Entity ID" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>ACS URL (Reply URL)</Label>
          <div className="flex gap-2">
            <Input value={metadata.acsUrl} readOnly />
            <CopyButton value={metadata.acsUrl} label="ACS URL" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Single Logout URL</Label>
          <div className="flex gap-2">
            <Input value={metadata.sloUrl} readOnly />
            <CopyButton value={metadata.sloUrl} label="SLO URL" />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={downloadMetadata}>
          <Download className="h-4 w-4 mr-2" />
          Download SP Metadata XML
        </Button>
      </CardFooter>
    </Card>
  );
}

function SamlConfigForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState('okta');
  const [displayName, setDisplayName] = useState('');
  const [entityId, setEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [sloUrl, setSloUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [jitProvisioning, setJitProvisioning] = useState(true);
  const [defaultRole, setDefaultRole] = useState('USER');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [enforceForAllUsers, setEnforceForAllUsers] = useState(false);

  const mutation = useMutation({
    mutationFn: configureSaml,
    onSuccess: () => {
      toast({ title: 'SAML configured', description: 'Test the configuration before activating' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      provider,
      displayName,
      entityId,
      ssoUrl,
      sloUrl: sloUrl || undefined,
      certificate,
      jitProvisioning,
      defaultRole,
      allowedDomains: allowedDomains.split('\n').filter(Boolean),
      enforceForAllUsers,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Identity Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerOptions
                .filter((p) => p.type === 'saml' || p.type === 'both')
                .map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Display Name (optional)</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Company SSO"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>IdP Entity ID *</Label>
        <Input
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          placeholder="https://idp.example.com/saml"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>SSO URL (Login URL) *</Label>
        <Input
          value={ssoUrl}
          onChange={(e) => setSsoUrl(e.target.value)}
          placeholder="https://idp.example.com/sso"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Single Logout URL (optional)</Label>
        <Input
          value={sloUrl}
          onChange={(e) => setSloUrl(e.target.value)}
          placeholder="https://idp.example.com/slo"
        />
      </div>

      <div className="space-y-2">
        <Label>IdP Signing Certificate (PEM format) *</Label>
        <Textarea
          value={certificate}
          onChange={(e) => setCertificate(e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          rows={6}
          required
          className="font-mono text-sm"
        />
      </div>

      <div className="border-t pt-6 space-y-4">
        <h4 className="font-medium">Provisioning Settings</h4>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Just-in-Time Provisioning</p>
            <p className="text-sm text-muted-foreground">
              Automatically create users on first SSO login
            </p>
          </div>
          <Switch checked={jitProvisioning} onCheckedChange={setJitProvisioning} />
        </div>

        {jitProvisioning && (
          <div className="space-y-2 pl-4">
            <Label>Default Role for New Users</Label>
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Allowed Email Domains (optional)</Label>
          <Textarea
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="example.com&#10;subsidiary.com"
            rows={3}
          />
          <p className="text-sm text-muted-foreground">
            Only users with these email domains can log in. Leave empty to allow all.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enforce SSO for All Users</p>
            <p className="text-sm text-muted-foreground">
              Disable password login for all users (recommended)
            </p>
          </div>
          <Switch checked={enforceForAllUsers} onCheckedChange={setEnforceForAllUsers} />
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save SAML Configuration'}
      </Button>
    </form>
  );
}

function OidcConfigForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState('azure_ad');
  const [displayName, setDisplayName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [scopes, setScopes] = useState('openid email profile');
  const [jitProvisioning, setJitProvisioning] = useState(true);
  const [defaultRole, setDefaultRole] = useState('USER');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [enforceForAllUsers, setEnforceForAllUsers] = useState(false);

  const mutation = useMutation({
    mutationFn: configureOidc,
    onSuccess: () => {
      toast({ title: 'OIDC configured', description: 'Test the configuration before activating' });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      provider,
      displayName,
      issuer,
      clientId,
      clientSecret,
      scopes: scopes.split(' ').filter(Boolean),
      jitProvisioning,
      defaultRole,
      allowedDomains: allowedDomains.split('\n').filter(Boolean),
      enforceForAllUsers,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Identity Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerOptions
                .filter((p) => p.type === 'oidc' || p.type === 'both')
                .map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Display Name (optional)</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Company SSO"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Issuer URL *</Label>
        <Input
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
          required
        />
        <p className="text-sm text-muted-foreground">
          The OIDC discovery endpoint will be derived from this URL
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Client ID *</Label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Client Secret *</Label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Scopes</Label>
        <Input
          value={scopes}
          onChange={(e) => setScopes(e.target.value)}
          placeholder="openid email profile"
        />
      </div>

      <div className="border-t pt-6 space-y-4">
        <h4 className="font-medium">Provisioning Settings</h4>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Just-in-Time Provisioning</p>
            <p className="text-sm text-muted-foreground">
              Automatically create users on first SSO login
            </p>
          </div>
          <Switch checked={jitProvisioning} onCheckedChange={setJitProvisioning} />
        </div>

        {jitProvisioning && (
          <div className="space-y-2 pl-4">
            <Label>Default Role for New Users</Label>
            <Select value={defaultRole} onValueChange={setDefaultRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Allowed Email Domains (optional)</Label>
          <Textarea
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            placeholder="example.com&#10;subsidiary.com"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enforce SSO for All Users</p>
            <p className="text-sm text-muted-foreground">
              Disable password login for all users
            </p>
          </div>
          <Switch checked={enforceForAllUsers} onCheckedChange={setEnforceForAllUsers} />
        </div>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save OIDC Configuration'}
      </Button>
    </form>
  );
}

function SsoStatusCard({ config }: { config: SsoConfig }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const testMutation = useMutation({
    mutationFn: testSso,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sso-config'] });
      if (result.success) {
        toast({ title: 'Test successful', description: result.message });
      } else {
        toast({ title: 'Test failed', description: result.message, variant: 'destructive' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to test SSO', variant: 'destructive' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateSso,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-config'] });
      toast({ title: 'SSO activated', description: 'Users can now sign in with SSO' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to activate SSO', variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSso,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-config'] });
      toast({ title: 'SSO deactivated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to deactivate SSO', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSso,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-config'] });
      toast({ title: 'SSO configuration deleted' });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete SSO', variant: 'destructive' });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{config.displayName}</CardTitle>
              <CardDescription>
                {config.type} • {config.provider}
              </CardDescription>
            </div>
            <Badge className={statusColors[config.status]}>{config.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{config.type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">JIT Provisioning</p>
              <p className="font-medium">{config.jitProvisioning ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Default Role</p>
              <p className="font-medium">{config.defaultRole}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Enforce SSO</p>
              <p className="font-medium">{config.enforceForAllUsers ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {config.lastTestResult && (
            <Alert variant={config.lastTestResult.success ? 'default' : 'destructive'}>
              {config.lastTestResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>Last Test Result</AlertTitle>
              <AlertDescription>{config.lastTestResult.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>

          {config.status === 'CONFIGURED' && (
            <Button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              <Power className="h-4 w-4 mr-2" />
              Activate
            </Button>
          )}

          {config.status === 'ACTIVE' && (
            <Button
              variant="secondary"
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
            >
              <Power className="h-4 w-4 mr-2" />
              Deactivate
            </Button>
          )}

          {!config.enabled && (
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SSO Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this SSO configuration? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function SsoConfigPage() {
  const queryClient = useQueryClient();
  const [configTab, setConfigTab] = useState<'saml' | 'oidc'>('saml');

  const { data: config, isLoading } = useQuery({
    queryKey: ['sso-config'],
    queryFn: fetchSsoConfig,
  });

  const { data: metadata } = useQuery({
    queryKey: ['sp-metadata'],
    queryFn: fetchSpMetadata,
  });

  const handleConfigSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['sso-config'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Single Sign-On</h1>
        <p className="text-muted-foreground">
          Configure SAML 2.0 or OIDC for enterprise authentication
        </p>
      </div>

      {/* Existing configuration */}
      {config && (
        <div className="mb-8">
          <SsoStatusCard config={config} />
        </div>
      )}

      {/* SP Metadata for SAML */}
      {metadata && (
        <div className="mb-8">
          <SpMetadataCard metadata={metadata} />
        </div>
      )}

      {/* Configuration Forms */}
      {!config && (
        <Card>
          <CardHeader>
            <CardTitle>Configure SSO</CardTitle>
            <CardDescription>
              Choose your authentication protocol and enter your Identity Provider details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={configTab} onValueChange={(v) => setConfigTab(v as 'saml' | 'oidc')}>
              <TabsList className="mb-6">
                <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
                <TabsTrigger value="oidc">OpenID Connect</TabsTrigger>
              </TabsList>

              <TabsContent value="saml">
                <SamlConfigForm onSuccess={handleConfigSuccess} />
              </TabsContent>

              <TabsContent value="oidc">
                <OidcConfigForm onSuccess={handleConfigSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Setup Guides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Okta', url: 'https://docs.skillancer.io/skillpod/sso/okta' },
              { name: 'Azure AD', url: 'https://docs.skillancer.io/skillpod/sso/azure' },
              { name: 'Google Workspace', url: 'https://docs.skillancer.io/skillpod/sso/google' },
              { name: 'OneLogin', url: 'https://docs.skillancer.io/skillpod/sso/onelogin' },
            ].map((guide) => (
              <a
                key={guide.name}
                href={guide.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span>{guide.name}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
