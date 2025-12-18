/**
 * @module @skillancer/skillpod-svc/templates
 * Default pre-configured template definitions
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {
  ToolDefinition,
  ResourceSpec,
  CreateTemplateParams,
} from '../types/environment.types.js';
import type { TemplateCategory } from '@prisma/client';

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

// Type assertion to avoid ToolDefinition | undefined when accessing properties
export const COMMON_TOOLS = {
  // Version Control
  git: {
    name: 'Git',
    version: 'latest',
    category: 'version-control',
    description: 'Distributed version control system',
  },

  // Editors
  vscode: {
    name: 'VS Code',
    version: 'latest',
    category: 'editor',
    description: 'Visual Studio Code editor',
    installCommand: 'snap install code --classic || apt-get install -y code',
    configPath: '/home/kasm-user/.config/Code',
  },

  vim: {
    name: 'Vim',
    version: 'latest',
    category: 'editor',
    description: 'Highly configurable text editor',
  },

  // Runtime Environments
  nodejs20: {
    name: 'Node.js',
    version: '20.x',
    category: 'runtime',
    description: 'JavaScript runtime',
    installCommand:
      'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs',
    verifyCommand: 'node --version',
  },

  nodejs22: {
    name: 'Node.js',
    version: '22.x',
    category: 'runtime',
    description: 'JavaScript runtime',
    installCommand:
      'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs',
    verifyCommand: 'node --version',
  },

  python311: {
    name: 'Python',
    version: '3.11',
    category: 'runtime',
    description: 'Python programming language',
    installCommand: 'apt-get install -y python3.11 python3.11-venv python3-pip',
    verifyCommand: 'python3.11 --version',
  },

  python312: {
    name: 'Python',
    version: '3.12',
    category: 'runtime',
    description: 'Python programming language',
    installCommand: 'apt-get install -y python3.12 python3.12-venv python3-pip',
    verifyCommand: 'python3.12 --version',
  },

  java21: {
    name: 'Java',
    version: '21',
    category: 'runtime',
    description: 'Java Development Kit',
    installCommand: 'apt-get install -y openjdk-21-jdk',
    verifyCommand: 'java -version',
  },

  go: {
    name: 'Go',
    version: '1.22',
    category: 'runtime',
    description: 'Go programming language',
    installCommand:
      'wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz && tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz && rm go1.22.0.linux-amd64.tar.gz',
    verifyCommand: '/usr/local/go/bin/go version',
  },

  rust: {
    name: 'Rust',
    version: 'stable',
    category: 'runtime',
    description: 'Rust programming language',
    installCommand: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
    verifyCommand: 'source $HOME/.cargo/env && rustc --version',
  },

  // Package Managers
  pnpm: {
    name: 'pnpm',
    version: 'latest',
    category: 'package-manager',
    description: 'Fast, disk space efficient package manager',
    installCommand: 'npm install -g pnpm',
    verifyCommand: 'pnpm --version',
  },

  yarn: {
    name: 'Yarn',
    version: 'latest',
    category: 'package-manager',
    description: 'Fast, reliable, and secure dependency management',
    installCommand: 'npm install -g yarn',
    verifyCommand: 'yarn --version',
  },

  // Containers & Orchestration
  docker: {
    name: 'Docker',
    version: 'latest',
    category: 'container',
    description: 'Container runtime',
    installCommand: 'apt-get install -y docker.io && usermod -aG docker kasm-user',
    verifyCommand: 'docker --version',
  },

  kubectl: {
    name: 'kubectl',
    version: 'latest',
    category: 'container',
    description: 'Kubernetes CLI',
    installCommand:
      'curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl',
    verifyCommand: 'kubectl version --client',
  },

  helm: {
    name: 'Helm',
    version: 'latest',
    category: 'container',
    description: 'Kubernetes package manager',
    installCommand:
      'curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash',
    verifyCommand: 'helm version',
  },

  // Databases
  postgresql: {
    name: 'PostgreSQL Client',
    version: 'latest',
    category: 'database',
    description: 'PostgreSQL database client',
    installCommand: 'apt-get install -y postgresql-client',
    verifyCommand: 'psql --version',
  },

  redis: {
    name: 'Redis CLI',
    version: 'latest',
    category: 'database',
    description: 'Redis CLI tools',
    installCommand: 'apt-get install -y redis-tools',
    verifyCommand: 'redis-cli --version',
  },

  mongodb: {
    name: 'MongoDB Shell',
    version: 'latest',
    category: 'database',
    description: 'MongoDB shell',
    installCommand:
      'wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add - && apt-get update && apt-get install -y mongodb-mongosh',
    verifyCommand: 'mongosh --version',
  },

  // Cloud CLIs
  awsCli: {
    name: 'AWS CLI',
    version: '2',
    category: 'cloud',
    description: 'AWS Command Line Interface',
    installCommand:
      'curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && ./aws/install && rm -rf awscliv2.zip aws',
    verifyCommand: 'aws --version',
  },

  gcloudCli: {
    name: 'Google Cloud CLI',
    version: 'latest',
    category: 'cloud',
    description: 'Google Cloud SDK',
    installCommand: 'curl https://sdk.cloud.google.com | bash',
    verifyCommand: 'gcloud --version',
  },

  azureCli: {
    name: 'Azure CLI',
    version: 'latest',
    category: 'cloud',
    description: 'Azure Command Line Interface',
    installCommand: 'curl -sL https://aka.ms/InstallAzureCLIDeb | bash',
    verifyCommand: 'az --version',
  },

  terraform: {
    name: 'Terraform',
    version: 'latest',
    category: 'infrastructure',
    description: 'Infrastructure as Code tool',
    installCommand:
      'apt-get update && apt-get install -y gnupg software-properties-common && wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg && echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | tee /etc/apt/sources.list.d/hashicorp.list && apt-get update && apt-get install -y terraform',
    verifyCommand: 'terraform --version',
  },

  // Data Science
  jupyter: {
    name: 'Jupyter Lab',
    version: 'latest',
    category: 'data-science',
    description: 'Interactive computing environment',
    installCommand: 'pip install jupyterlab',
    verifyCommand: 'jupyter --version',
  },

  pandas: {
    name: 'Pandas',
    version: 'latest',
    category: 'data-science',
    description: 'Data analysis library',
    installCommand: 'pip install pandas',
    verifyCommand: 'python -c "import pandas; print(pandas.__version__)"',
  },

  numpy: {
    name: 'NumPy',
    version: 'latest',
    category: 'data-science',
    description: 'Numerical computing library',
    installCommand: 'pip install numpy',
    verifyCommand: 'python -c "import numpy; print(numpy.__version__)"',
  },

  matplotlib: {
    name: 'Matplotlib',
    version: 'latest',
    category: 'data-science',
    description: 'Plotting library',
    installCommand: 'pip install matplotlib',
    verifyCommand: 'python -c "import matplotlib; print(matplotlib.__version__)"',
  },

  scikit: {
    name: 'scikit-learn',
    version: 'latest',
    category: 'data-science',
    description: 'Machine learning library',
    installCommand: 'pip install scikit-learn',
    verifyCommand: 'python -c "import sklearn; print(sklearn.__version__)"',
  },

  pytorch: {
    name: 'PyTorch',
    version: 'latest',
    category: 'data-science',
    description: 'Deep learning framework',
    installCommand: 'pip install torch torchvision torchaudio',
    verifyCommand: 'python -c "import torch; print(torch.__version__)"',
  },

  tensorflow: {
    name: 'TensorFlow',
    version: 'latest',
    category: 'data-science',
    description: 'Machine learning platform',
    installCommand: 'pip install tensorflow',
    verifyCommand: 'python -c "import tensorflow; print(tensorflow.__version__)"',
  },

  // Design Tools
  figma: {
    name: 'Figma',
    version: 'latest',
    category: 'design',
    description: 'Figma desktop app',
    installCommand:
      'wget -O figma.deb https://desktop.figma.com/linux/Figma-latest.deb && dpkg -i figma.deb && rm figma.deb',
    verifyCommand: 'which figma',
  },

  gimp: {
    name: 'GIMP',
    version: 'latest',
    category: 'design',
    description: 'GNU Image Manipulation Program',
    installCommand: 'apt-get install -y gimp',
    verifyCommand: 'gimp --version',
  },

  inkscape: {
    name: 'Inkscape',
    version: 'latest',
    category: 'design',
    description: 'Vector graphics editor',
    installCommand: 'apt-get install -y inkscape',
    verifyCommand: 'inkscape --version',
  },

  // Security Tools
  nmap: {
    name: 'Nmap',
    version: 'latest',
    category: 'security',
    description: 'Network scanner',
    installCommand: 'apt-get install -y nmap',
    verifyCommand: 'nmap --version',
  },

  wireshark: {
    name: 'Wireshark',
    version: 'latest',
    category: 'security',
    description: 'Network protocol analyzer',
    installCommand: 'apt-get install -y wireshark',
    verifyCommand: 'wireshark --version',
  },

  burpsuite: {
    name: 'Burp Suite',
    version: 'community',
    category: 'security',
    description: 'Web security testing tool',
    installCommand:
      'wget -O burpsuite.sh "https://portswigger-cdn.net/burp/releases/download?product=community&version=2024.1.1.6&type=Linux" && chmod +x burpsuite.sh && ./burpsuite.sh -q',
    verifyCommand: 'which burpsuite',
  },

  // Utilities
  curl: {
    name: 'cURL',
    version: 'latest',
    category: 'utility',
    description: 'Command line HTTP client',
  },

  jq: {
    name: 'jq',
    version: 'latest',
    category: 'utility',
    description: 'JSON processor',
  },

  htop: {
    name: 'htop',
    version: 'latest',
    category: 'utility',
    description: 'Interactive process viewer',
  },
} as const satisfies Record<string, ToolDefinition>;

// =============================================================================
// DEFAULT TEMPLATES
// =============================================================================

export interface DefaultTemplate extends Omit<CreateTemplateParams, 'baseImageId' | 'tenantId'> {
  baseImageSlug: string; // Will be resolved to baseImageId
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // ===========================================================================
  // DEVELOPMENT TEMPLATES
  // ===========================================================================
  {
    name: 'Full-Stack Development',
    slug: 'full-stack-development',
    description:
      'Complete full-stack development environment with Node.js, Python, Docker, and essential tools for building modern web applications.',
    shortDescription: 'Node.js, Python, Docker, VS Code, Git',
    category: 'DEVELOPMENT' as TemplateCategory,
    tags: ['nodejs', 'python', 'docker', 'fullstack', 'web'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.nodejs20,
      COMMON_TOOLS.python311,
      COMMON_TOOLS.docker,
      COMMON_TOOLS.pnpm,
      COMMON_TOOLS.postgresql,
      COMMON_TOOLS.redis,
      COMMON_TOOLS.curl,
      COMMON_TOOLS.jq,
    ],
    defaultResources: {
      cpu: 4,
      memory: 8192,
      storage: 50,
      gpu: false,
    } as ResourceSpec,
    minResources: {
      cpu: 2,
      memory: 4096,
      storage: 20,
      gpu: false,
    } as ResourceSpec,
    maxResources: {
      cpu: 16,
      memory: 32768,
      storage: 200,
      gpu: false,
    } as ResourceSpec,
    environmentVars: {
      NODE_ENV: 'development',
      EDITOR: 'code',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  {
    name: 'React Development',
    slug: 'react-development',
    description:
      'Optimized environment for React application development with Node.js, TypeScript, and modern tooling.',
    shortDescription: 'React, Node.js, TypeScript, VS Code',
    category: 'DEVELOPMENT' as TemplateCategory,
    tags: ['react', 'nodejs', 'typescript', 'frontend'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.nodejs22,
      COMMON_TOOLS.pnpm,
      COMMON_TOOLS.curl,
    ],
    defaultResources: {
      cpu: 4,
      memory: 8192,
      storage: 30,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 4096,
      storage: 20,
      gpu: false,
    },
    maxResources: {
      cpu: 8,
      memory: 16384,
      storage: 100,
      gpu: false,
    },
    environmentVars: {
      NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  {
    name: 'Python Backend',
    slug: 'python-backend',
    description:
      'Python development environment with Django/FastAPI support, database clients, and testing tools.',
    shortDescription: 'Python 3.12, Django, PostgreSQL, Redis',
    category: 'DEVELOPMENT' as TemplateCategory,
    tags: ['python', 'django', 'fastapi', 'backend'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.python312,
      COMMON_TOOLS.postgresql,
      COMMON_TOOLS.redis,
      COMMON_TOOLS.docker,
      COMMON_TOOLS.curl,
    ],
    defaultResources: {
      cpu: 4,
      memory: 8192,
      storage: 40,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 4096,
      storage: 20,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 32768,
      storage: 200,
      gpu: false,
    },
    environmentVars: {
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONUNBUFFERED: '1',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  {
    name: 'Java Enterprise',
    slug: 'java-enterprise',
    description:
      'Java development environment with JDK 21, Maven/Gradle, and enterprise tooling for Spring Boot applications.',
    shortDescription: 'Java 21, Maven, Spring Boot, PostgreSQL',
    category: 'DEVELOPMENT' as TemplateCategory,
    tags: ['java', 'spring', 'enterprise', 'backend'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.java21,
      COMMON_TOOLS.docker,
      COMMON_TOOLS.postgresql,
      COMMON_TOOLS.redis,
      COMMON_TOOLS.curl,
    ],
    defaultResources: {
      cpu: 4,
      memory: 16384,
      storage: 60,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 8192,
      storage: 30,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 65536,
      storage: 200,
      gpu: false,
    },
    environmentVars: {
      JAVA_HOME: '/usr/lib/jvm/java-21-openjdk-amd64',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  // ===========================================================================
  // DATA SCIENCE TEMPLATES
  // ===========================================================================
  {
    name: 'Python Data Science',
    slug: 'python-data-science',
    description:
      'Comprehensive data science environment with Jupyter Lab, pandas, NumPy, scikit-learn, and visualization tools.',
    shortDescription: 'Jupyter, pandas, scikit-learn, matplotlib',
    category: 'DATA_SCIENCE' as TemplateCategory,
    tags: ['python', 'jupyter', 'datascience', 'ml', 'analytics'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.python312,
      COMMON_TOOLS.jupyter,
      COMMON_TOOLS.pandas,
      COMMON_TOOLS.numpy,
      COMMON_TOOLS.matplotlib,
      COMMON_TOOLS.scikit,
    ],
    defaultResources: {
      cpu: 8,
      memory: 16384,
      storage: 100,
      gpu: false,
    },
    minResources: {
      cpu: 4,
      memory: 8192,
      storage: 50,
      gpu: false,
    },
    maxResources: {
      cpu: 32,
      memory: 131072,
      storage: 500,
      gpu: true,
      gpuType: 'nvidia-t4',
    },
    environmentVars: {
      JUPYTER_ENABLE_LAB: 'yes',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  {
    name: 'Deep Learning GPU',
    slug: 'deep-learning-gpu',
    description:
      'GPU-accelerated deep learning environment with PyTorch, TensorFlow, and CUDA support.',
    shortDescription: 'PyTorch, TensorFlow, CUDA, Jupyter',
    category: 'DATA_SCIENCE' as TemplateCategory,
    tags: ['deeplearning', 'pytorch', 'tensorflow', 'gpu', 'ml'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.python312,
      COMMON_TOOLS.jupyter,
      COMMON_TOOLS.pandas,
      COMMON_TOOLS.numpy,
      COMMON_TOOLS.pytorch,
      COMMON_TOOLS.tensorflow,
    ],
    defaultResources: {
      cpu: 8,
      memory: 32768,
      storage: 200,
      gpu: true,
      gpuType: 'nvidia-t4',
    },
    minResources: {
      cpu: 4,
      memory: 16384,
      storage: 100,
      gpu: true,
      gpuType: 'nvidia-t4',
    },
    maxResources: {
      cpu: 32,
      memory: 131072,
      storage: 1000,
      gpu: true,
      gpuType: 'nvidia-a10g',
    },
    environmentVars: {
      CUDA_VISIBLE_DEVICES: '0',
    },
    isPublic: true,
    baseImageSlug: 'nvidia-cuda-12.0',
  },

  // ===========================================================================
  // FINANCE TEMPLATES
  // ===========================================================================
  {
    name: 'Financial Analysis',
    slug: 'financial-analysis',
    description:
      'Secure environment for financial analysis with Excel-compatible tools, Python for quantitative analysis, and secure connectivity.',
    shortDescription: 'Excel, Python, Bloomberg Terminal',
    category: 'FINANCE' as TemplateCategory,
    tags: ['finance', 'excel', 'analytics', 'quantitative'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.python312,
      COMMON_TOOLS.jupyter,
      COMMON_TOOLS.pandas,
      COMMON_TOOLS.numpy,
    ],
    defaultResources: {
      cpu: 4,
      memory: 16384,
      storage: 50,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 8192,
      storage: 30,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 65536,
      storage: 200,
      gpu: false,
    },
    environmentVars: {},
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  // ===========================================================================
  // DESIGN TEMPLATES
  // ===========================================================================
  {
    name: 'UI/UX Design',
    slug: 'ui-ux-design',
    description:
      'Creative design environment with Figma, GIMP, Inkscape, and color management tools for UI/UX designers.',
    shortDescription: 'Figma, GIMP, Inkscape, Color Tools',
    category: 'DESIGN' as TemplateCategory,
    tags: ['design', 'figma', 'uiux', 'creative'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.figma,
      COMMON_TOOLS.gimp,
      COMMON_TOOLS.inkscape,
    ],
    defaultResources: {
      cpu: 4,
      memory: 16384,
      storage: 100,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 8192,
      storage: 50,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 65536,
      storage: 500,
      gpu: true,
    },
    environmentVars: {},
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  // ===========================================================================
  // DEVOPS TEMPLATES
  // ===========================================================================
  {
    name: 'DevOps & Cloud',
    slug: 'devops-cloud',
    description:
      'Complete DevOps environment with Docker, Kubernetes, Terraform, and cloud CLIs for infrastructure automation.',
    shortDescription: 'Docker, K8s, Terraform, AWS/GCP/Azure',
    category: 'DEVOPS' as TemplateCategory,
    tags: ['devops', 'docker', 'kubernetes', 'terraform', 'cloud'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.docker,
      COMMON_TOOLS.kubectl,
      COMMON_TOOLS.helm,
      COMMON_TOOLS.terraform,
      COMMON_TOOLS.awsCli,
      COMMON_TOOLS.gcloudCli,
      COMMON_TOOLS.azureCli,
      COMMON_TOOLS.python311,
      COMMON_TOOLS.jq,
    ],
    defaultResources: {
      cpu: 4,
      memory: 8192,
      storage: 100,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 4096,
      storage: 50,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 32768,
      storage: 500,
      gpu: false,
    },
    environmentVars: {
      KUBECONFIG: '/home/kasm-user/.kube/config',
    },
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },

  // ===========================================================================
  // SECURITY TEMPLATES
  // ===========================================================================
  {
    name: 'Security Research',
    slug: 'security-research',
    description:
      'Secure environment for security research with network analysis, penetration testing, and forensic tools.',
    shortDescription: 'Kali tools, Wireshark, Burp Suite',
    category: 'SECURITY' as TemplateCategory,
    tags: ['security', 'pentest', 'forensics', 'research'],
    installedTools: [
      COMMON_TOOLS.git,
      COMMON_TOOLS.vscode,
      COMMON_TOOLS.nmap,
      COMMON_TOOLS.wireshark,
      COMMON_TOOLS.burpsuite,
      COMMON_TOOLS.python312,
      COMMON_TOOLS.curl,
    ],
    defaultResources: {
      cpu: 4,
      memory: 8192,
      storage: 100,
      gpu: false,
    },
    minResources: {
      cpu: 2,
      memory: 4096,
      storage: 50,
      gpu: false,
    },
    maxResources: {
      cpu: 16,
      memory: 32768,
      storage: 500,
      gpu: false,
    },
    environmentVars: {},
    isPublic: true,
    baseImageSlug: 'kali-linux',
  },

  // ===========================================================================
  // GENERAL TEMPLATES
  // ===========================================================================
  {
    name: 'General Purpose',
    slug: 'general-purpose',
    description:
      'Lightweight general-purpose environment with basic tools for everyday computing tasks.',
    shortDescription: 'Basic tools, browser, utilities',
    category: 'GENERAL' as TemplateCategory,
    tags: ['general', 'basic', 'browser'],
    installedTools: [COMMON_TOOLS.git, COMMON_TOOLS.vim, COMMON_TOOLS.curl, COMMON_TOOLS.htop],
    defaultResources: {
      cpu: 2,
      memory: 4096,
      storage: 20,
      gpu: false,
    },
    minResources: {
      cpu: 1,
      memory: 2048,
      storage: 10,
      gpu: false,
    },
    maxResources: {
      cpu: 4,
      memory: 8192,
      storage: 50,
      gpu: false,
    },
    environmentVars: {},
    isPublic: true,
    baseImageSlug: 'ubuntu-22.04',
  },
];

// =============================================================================
// BASE IMAGES
// =============================================================================

export interface DefaultBaseImage {
  name: string;
  slug: string;
  description: string;
  osType: 'LINUX' | 'WINDOWS';
  registryType: 'KASM' | 'ECR' | 'DOCKERHUB' | 'CUSTOM';
  registryUri: string;
  imageTag: string;
  kasmImageId?: string;
  minCpu: number;
  minMemory: number;
  minStorage: number;
  gpuCompatible: boolean;
}

export const DEFAULT_BASE_IMAGES: DefaultBaseImage[] = [
  {
    name: 'Ubuntu 22.04 Desktop',
    slug: 'ubuntu-22.04',
    description: 'Ubuntu 22.04 LTS with desktop environment',
    osType: 'LINUX',
    registryType: 'KASM',
    registryUri: 'kasmweb/ubuntu-jammy-desktop',
    imageTag: '1.14.0',
    kasmImageId: 'ubuntu-22.04-desktop',
    minCpu: 2,
    minMemory: 2048,
    minStorage: 10,
    gpuCompatible: true,
  },
  {
    name: 'NVIDIA CUDA 12.0',
    slug: 'nvidia-cuda-12.0',
    description: 'Ubuntu with NVIDIA CUDA 12.0 for GPU workloads',
    osType: 'LINUX',
    registryType: 'KASM',
    registryUri: 'kasmweb/cuda-desktop',
    imageTag: '1.14.0-cuda12.0',
    kasmImageId: 'cuda-desktop-12.0',
    minCpu: 4,
    minMemory: 8192,
    minStorage: 50,
    gpuCompatible: true,
  },
  {
    name: 'Kali Linux',
    slug: 'kali-linux',
    description: 'Kali Linux for security research and testing',
    osType: 'LINUX',
    registryType: 'KASM',
    registryUri: 'kasmweb/kali-rolling-desktop',
    imageTag: '1.14.0',
    kasmImageId: 'kali-desktop',
    minCpu: 2,
    minMemory: 4096,
    minStorage: 30,
    gpuCompatible: false,
  },
  {
    name: 'Windows 11',
    slug: 'windows-11',
    description: 'Windows 11 desktop environment',
    osType: 'WINDOWS',
    registryType: 'CUSTOM',
    registryUri: 'skillancer/windows-11-base',
    imageTag: 'latest',
    minCpu: 4,
    minMemory: 8192,
    minStorage: 60,
    gpuCompatible: true,
  },
];
