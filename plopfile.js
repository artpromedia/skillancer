/**
 * @file plopfile.js
 * Plop.js code generation configuration for Skillancer monorepo
 *
 * Usage:
 *   pnpm plop              # Interactive mode
 *   pnpm plop service      # Create a new service
 *   pnpm plop endpoint     # Create a new API endpoint
 *   pnpm plop component    # Create a new React component
 *   pnpm plop package      # Create a new shared package
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
  // ============================================================================
  // HELPERS
  // ============================================================================

  plop.setHelper('upperCase', (text) => text.toUpperCase());
  plop.setHelper('lowerCase', (text) => text.toLowerCase());
  plop.setHelper('includes', (array, item) => array && array.includes(item));
  plop.setHelper('eq', (a, b) => a === b);
  plop.setHelper('year', () => new Date().getFullYear());

  // Convert service name to valid package scope
  plop.setHelper('packageScope', (name) => {
    return name.replace(/-svc$/, '').replace(/-/g, '-');
  });

  // ============================================================================
  // SERVICE GENERATOR
  // ============================================================================

  plop.setGenerator('service', {
    description: 'Create a new backend microservice',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Service name (e.g., analytics-svc):',
        validate: (value) => {
          if (!value) return 'Service name is required';
          if (!/^[a-z][a-z0-9-]*-svc$/.test(value)) {
            return 'Service name must end with -svc and contain only lowercase letters, numbers, and hyphens (e.g., analytics-svc)';
          }
          if (fs.existsSync(path.join('services', value))) {
            return `Service "${value}" already exists`;
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Service description:',
        default: 'A Skillancer microservice',
      },
      {
        type: 'input',
        name: 'port',
        message: 'Port number:',
        default: '3010',
        validate: (value) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1000 || port > 65535) {
            return 'Port must be a number between 1000 and 65535';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'withDatabase',
        message: 'Include database connection?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withRedis',
        message: 'Include Redis/cache support?',
        default: false,
      },
      {
        type: 'confirm',
        name: 'withQueue',
        message: 'Include BullMQ queue support?',
        default: false,
      },
    ],
    actions: (data) => {
      const actions = [
        // Package.json
        {
          type: 'add',
          path: 'services/{{name}}/package.json',
          templateFile: 'plop-templates/service/package.json.hbs',
        },
        // TypeScript config
        {
          type: 'add',
          path: 'services/{{name}}/tsconfig.json',
          templateFile: 'plop-templates/service/tsconfig.json.hbs',
        },
        // Dockerfile
        {
          type: 'add',
          path: 'services/{{name}}/Dockerfile',
          templateFile: 'plop-templates/service/Dockerfile.hbs',
        },
        // Source files
        {
          type: 'add',
          path: 'services/{{name}}/src/app.ts',
          templateFile: 'plop-templates/service/src/app.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/server.ts',
          templateFile: 'plop-templates/service/src/server.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/index.ts',
          templateFile: 'plop-templates/service/src/index.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/config/index.ts',
          templateFile: 'plop-templates/service/src/config/index.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/plugins/index.ts',
          templateFile: 'plop-templates/service/src/plugins/index.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/routes/index.ts',
          templateFile: 'plop-templates/service/src/routes/index.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/routes/health.ts',
          templateFile: 'plop-templates/service/src/routes/health.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/middleware/error-handler.ts',
          templateFile: 'plop-templates/service/src/middleware/error-handler.ts.hbs',
        },
        {
          type: 'add',
          path: 'services/{{name}}/src/types/index.ts',
          templateFile: 'plop-templates/service/src/types/index.ts.hbs',
        },
        // Test setup
        {
          type: 'add',
          path: 'services/{{name}}/src/__tests__/app.test.ts',
          templateFile: 'plop-templates/service/src/__tests__/app.test.ts.hbs',
        },
        // Environment file
        {
          type: 'add',
          path: 'services/{{name}}/.env.example',
          templateFile: 'plop-templates/service/.env.example.hbs',
        },
        // README
        {
          type: 'add',
          path: 'services/{{name}}/README.md',
          templateFile: 'plop-templates/service/README.md.hbs',
        },
        // Install dependencies
        function installDependencies(answers) {
          console.log('\n📦 Installing dependencies...');
          try {
            execSync('pnpm install', {
              cwd: path.join('services', answers.name),
              stdio: 'inherit',
            });
            return '✓ Dependencies installed';
          } catch (error) {
            return '⚠ Failed to install dependencies. Run "pnpm install" manually.';
          }
        },
        // Final message
        function finalMessage(answers) {
          return `
╔══════════════════════════════════════════════════════════════╗
║                  ✅ Service Created Successfully!             ║
╚══════════════════════════════════════════════════════════════╝

📁 Location: services/${answers.name}/

Next steps:
  1. cd services/${answers.name}
  2. Copy .env.example to .env and configure
  3. Add your routes in src/routes/
  4. Run: pnpm dev

🌐 Service URL:     http://localhost:${answers.port}
📚 API Docs:        http://localhost:${answers.port}/docs
❤️  Health Check:   http://localhost:${answers.port}/health
          `;
        },
      ];

      return actions;
    },
  });

  // ============================================================================
  // ENDPOINT GENERATOR
  // ============================================================================

  plop.setGenerator('endpoint', {
    description: 'Create a new API endpoint in a service',
    prompts: [
      {
        type: 'list',
        name: 'service',
        message: 'Which service?',
        choices: function () {
          const servicesDir = 'services';
          if (!fs.existsSync(servicesDir)) return [];
          return fs
            .readdirSync(servicesDir)
            .filter((f) => {
              const stat = fs.statSync(path.join(servicesDir, f));
              return stat.isDirectory() && f !== 'service-template';
            })
            .map((name) => ({ name, value: name }));
        },
      },
      {
        type: 'input',
        name: 'name',
        message: 'Endpoint name (e.g., users, projects):',
        validate: (value) => {
          if (!value) return 'Endpoint name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Endpoint name must be lowercase with hyphens only';
          }
          return true;
        },
      },
      {
        type: 'checkbox',
        name: 'methods',
        message: 'HTTP methods to generate:',
        choices: [
          { name: 'GET (list all)', value: 'list', checked: true },
          { name: 'GET (get by ID)', value: 'get', checked: true },
          { name: 'POST (create)', value: 'create', checked: true },
          { name: 'PATCH (update)', value: 'update', checked: true },
          { name: 'DELETE (remove)', value: 'delete', checked: true },
        ],
      },
      {
        type: 'confirm',
        name: 'withService',
        message: 'Generate service layer?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'withRepository',
        message: 'Generate repository layer?',
        default: true,
      },
    ],
    actions: (data) => {
      const actions = [
        // Route file
        {
          type: 'add',
          path: 'services/{{service}}/src/routes/{{name}}.ts',
          templateFile: 'plop-templates/endpoint/route.ts.hbs',
        },
        // Schema file
        {
          type: 'add',
          path: 'services/{{service}}/src/schemas/{{name}}.schema.ts',
          templateFile: 'plop-templates/endpoint/schema.ts.hbs',
        },
      ];

      if (data.withService) {
        actions.push({
          type: 'add',
          path: 'services/{{service}}/src/services/{{name}}.service.ts',
          templateFile: 'plop-templates/endpoint/service.ts.hbs',
        });
      }

      if (data.withRepository) {
        actions.push({
          type: 'add',
          path: 'services/{{service}}/src/repositories/{{name}}.repository.ts',
          templateFile: 'plop-templates/endpoint/repository.ts.hbs',
        });
      }

      // Add route registration reminder
      actions.push(function routeReminder(answers) {
        return `
╔══════════════════════════════════════════════════════════════╗
║                  ✅ Endpoint Created Successfully!            ║
╚══════════════════════════════════════════════════════════════╝

📁 Files created:
  - services/${answers.service}/src/routes/${answers.name}.ts
  - services/${answers.service}/src/schemas/${answers.name}.schema.ts
  ${answers.withService ? `- services/${answers.service}/src/services/${answers.name}.service.ts` : ''}
  ${answers.withRepository ? `- services/${answers.service}/src/repositories/${answers.name}.repository.ts` : ''}

⚠️  Don't forget to register the route in routes/index.ts:

  import { ${plop.getHelper('camelCase')(answers.name)}Routes } from './${answers.name}.js';

  // In registerRoutes function:
  await app.register(${plop.getHelper('camelCase')(answers.name)}Routes, { prefix: '/api/${answers.name}' });
        `;
      });

      return actions;
    },
  });

  // ============================================================================
  // REACT COMPONENT GENERATOR
  // ============================================================================

  plop.setGenerator('component', {
    description: 'Create a new React component',
    prompts: [
      {
        type: 'list',
        name: 'location',
        message: 'Where should this component live?',
        choices: [
          { name: 'Shared UI package (packages/ui)', value: 'packages/ui' },
          { name: 'Web app (apps/web)', value: 'apps/web' },
          { name: 'Market app (apps/web-market)', value: 'apps/web-market' },
          { name: 'Cockpit app (apps/web-cockpit)', value: 'apps/web-cockpit' },
          { name: 'SkillPod app (apps/web-skillpod)', value: 'apps/web-skillpod' },
        ],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Component name (PascalCase, e.g., UserProfile):',
        validate: (value) => {
          if (!value) return 'Component name is required';
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return 'Component name must be in PascalCase (e.g., UserProfile)';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'componentType',
        message: 'Component type:',
        choices: [
          { name: 'Functional component with forwardRef', value: 'forwardRef' },
          { name: 'Simple functional component', value: 'simple' },
          { name: 'Server component (Next.js)', value: 'server' },
        ],
        default: 'forwardRef',
      },
      {
        type: 'confirm',
        name: 'withStory',
        message: 'Generate Storybook story?',
        default: true,
        when: (answers) => answers.location === 'packages/ui',
      },
      {
        type: 'confirm',
        name: 'withTest',
        message: 'Generate test file?',
        default: true,
      },
    ],
    actions: (data) => {
      const basePath =
        data.location === 'packages/ui'
          ? '{{location}}/src/components/{{kebabCase name}}'
          : '{{location}}/src/components/{{kebabCase name}}';

      const actions = [
        // Component file
        {
          type: 'add',
          path: `${basePath}/{{kebabCase name}}.tsx`,
          templateFile: `plop-templates/component/component-${data.componentType}.tsx.hbs`,
        },
        // Index barrel export
        {
          type: 'add',
          path: `${basePath}/index.ts`,
          templateFile: 'plop-templates/component/index.ts.hbs',
        },
      ];

      // Storybook story
      if (data.withStory) {
        actions.push({
          type: 'add',
          path: `${basePath}/{{kebabCase name}}.stories.tsx`,
          templateFile: 'plop-templates/component/component.stories.tsx.hbs',
        });
      }

      // Test file
      if (data.withTest) {
        actions.push({
          type: 'add',
          path: `${basePath}/{{kebabCase name}}.test.tsx`,
          templateFile: 'plop-templates/component/component.test.tsx.hbs',
        });
      }

      // Final message
      actions.push(function componentMessage(answers) {
        const exportLine = `export * from './components/${plop.getHelper('kebabCase')(answers.name)}';`;
        return `
╔══════════════════════════════════════════════════════════════╗
║                ✅ Component Created Successfully!             ║
╚══════════════════════════════════════════════════════════════╝

📁 Location: ${answers.location}/src/components/${plop.getHelper('kebabCase')(answers.name)}/

${answers.location === 'packages/ui' ? `⚠️  Add export to packages/ui/src/index.ts:\n\n  ${exportLine}` : ''}

Usage:
  import { ${answers.name} } from '${answers.location === 'packages/ui' ? '@skillancer/ui' : `@/components/${plop.getHelper('kebabCase')(answers.name)}`}';
        `;
      });

      return actions;
    },
  });

  // ============================================================================
  // PACKAGE GENERATOR
  // ============================================================================

  plop.setGenerator('package', {
    description: 'Create a new shared package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name (lowercase, e.g., analytics):',
        validate: (value) => {
          if (!value) return 'Package name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(value)) {
            return 'Package name must be lowercase with hyphens only';
          }
          if (fs.existsSync(path.join('packages', value))) {
            return `Package "${value}" already exists`;
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Package description:',
        default: 'A shared Skillancer package',
      },
      {
        type: 'list',
        name: 'type',
        message: 'Package type:',
        choices: [
          { name: 'TypeScript utility library', value: 'ts-lib' },
          { name: 'React component library', value: 'react-lib' },
          { name: 'Node.js service utilities', value: 'node-lib' },
        ],
      },
    ],
    actions: (data) => {
      const templateDir = `plop-templates/package/${data.type}`;
      const actions = [
        // Package.json
        {
          type: 'add',
          path: 'packages/{{name}}/package.json',
          templateFile: `${templateDir}/package.json.hbs`,
        },
        // TypeScript config
        {
          type: 'add',
          path: 'packages/{{name}}/tsconfig.json',
          templateFile: `${templateDir}/tsconfig.json.hbs`,
        },
        // tsup config
        {
          type: 'add',
          path: 'packages/{{name}}/tsup.config.ts',
          templateFile: 'plop-templates/package/tsup.config.ts.hbs',
        },
        // Source entry
        {
          type: 'add',
          path: 'packages/{{name}}/src/index.ts',
          templateFile: `${templateDir}/src/index.ts.hbs`,
        },
        // README
        {
          type: 'add',
          path: 'packages/{{name}}/README.md',
          templateFile: 'plop-templates/package/README.md.hbs',
        },
      ];

      // React library extras
      if (data.type === 'react-lib') {
        actions.push({
          type: 'add',
          path: 'packages/{{name}}/src/components/.gitkeep',
          template: '',
        });
      }

      // Install dependencies
      actions.push(function installDeps(answers) {
        console.log('\n📦 Installing dependencies...');
        try {
          execSync('pnpm install', {
            cwd: path.join('packages', answers.name),
            stdio: 'inherit',
          });
          return '✓ Dependencies installed';
        } catch (error) {
          return '⚠ Failed to install dependencies. Run "pnpm install" manually.';
        }
      });

      // Final message
      actions.push(function packageMessage(answers) {
        return `
╔══════════════════════════════════════════════════════════════╗
║                ✅ Package Created Successfully!               ║
╚══════════════════════════════════════════════════════════════╝

📁 Location: packages/${answers.name}/

Usage in other packages:
  // package.json
  "@skillancer/${answers.name}": "workspace:*"

  // In code
  import { ... } from '@skillancer/${answers.name}';

Build:
  pnpm --filter @skillancer/${answers.name} build
        `;
      });

      return actions;
    },
  });

  // ============================================================================
  // MIGRATION GENERATOR
  // ============================================================================

  plop.setGenerator('migration', {
    description: 'Create a new database migration',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Migration name (e.g., add_user_preferences):',
        validate: (value) => {
          if (!value) return 'Migration name is required';
          if (!/^[a-z][a-z0-9_]*$/.test(value)) {
            return 'Migration name must be lowercase with underscores only';
          }
          return true;
        },
      },
    ],
    actions: [
      function createMigration(answers) {
        console.log('\n📝 Creating migration...');
        try {
          execSync(`pnpm db:migrate:create --name ${answers.name}`, {
            stdio: 'inherit',
          });
          return '✓ Migration created';
        } catch (error) {
          return '⚠ Failed to create migration. Check Prisma configuration.';
        }
      },
    ],
  });
};
