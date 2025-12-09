#!/bin/bash
# =============================================================================
# Doppler Setup Script
# Configures Doppler for local development secrets management
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="skillancer"
DEFAULT_CONFIG="dev"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Skillancer Doppler Setup                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    echo -e "${YELLOW}Doppler CLI not found. Installing...${NC}"
    
    # Detect OS and install
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -Ls https://cli.doppler.com/install.sh | sh
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install dopplerhq/cli/doppler
        else
            curl -Ls https://cli.doppler.com/install.sh | sh
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows (Git Bash)
        echo -e "${RED}Please install Doppler manually on Windows:${NC}"
        echo "  scoop install doppler"
        echo "  OR"
        echo "  choco install doppler"
        exit 1
    else
        echo -e "${RED}Unsupported OS. Please install Doppler manually:${NC}"
        echo "  https://docs.doppler.com/docs/install-cli"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Doppler CLI installed successfully${NC}"
else
    DOPPLER_VERSION=$(doppler --version 2>&1 | head -n1)
    echo -e "${GREEN}✓ Doppler CLI found: ${DOPPLER_VERSION}${NC}"
fi

echo ""

# Check if user is logged in
if ! doppler me &> /dev/null; then
    echo -e "${YELLOW}You are not logged in to Doppler.${NC}"
    echo ""
    echo -e "${BLUE}Opening Doppler login...${NC}"
    doppler login
    echo ""
    echo -e "${GREEN}✓ Successfully logged in to Doppler${NC}"
else
    DOPPLER_USER=$(doppler me --json 2>/dev/null | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "authenticated")
    echo -e "${GREEN}✓ Already logged in as: ${DOPPLER_USER}${NC}"
fi

echo ""

# Setup project
echo -e "${BLUE}Setting up Doppler project...${NC}"
echo ""

# Check if doppler.yaml exists (indicates project is already configured)
if [ -f "doppler.yaml" ]; then
    echo -e "${YELLOW}Found existing doppler.yaml configuration.${NC}"
    read -p "Do you want to reconfigure? (y/N): " RECONFIGURE
    if [[ ! "$RECONFIGURE" =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Using existing configuration.${NC}"
        doppler setup --no-interactive
        echo ""
        echo -e "${GREEN}✓ Doppler setup complete!${NC}"
        exit 0
    fi
fi

# Configure project
echo -e "${BLUE}Available environments:${NC}"
echo "  1) dev     - Development (local development)"
echo "  2) staging - Staging (pre-production testing)"
echo "  3) prod    - Production (live environment)"
echo ""
read -p "Select environment [1-3] (default: 1): " ENV_CHOICE

case $ENV_CHOICE in
    2) CONFIG="staging" ;;
    3) CONFIG="prod" ;;
    *) CONFIG="dev" ;;
esac

echo ""
echo -e "${BLUE}Configuring Doppler for ${PROJECT_NAME} (${CONFIG})...${NC}"

# Try to setup the project
if doppler setup --project "$PROJECT_NAME" --config "$CONFIG" 2>/dev/null; then
    echo -e "${GREEN}✓ Project configured successfully${NC}"
else
    echo -e "${YELLOW}Project '${PROJECT_NAME}' not found in Doppler.${NC}"
    echo ""
    echo "Would you like to create it? This requires Doppler project admin access."
    read -p "Create project? (y/N): " CREATE_PROJECT
    
    if [[ "$CREATE_PROJECT" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Creating Doppler project '${PROJECT_NAME}'...${NC}"
        doppler projects create "$PROJECT_NAME" --description "Skillancer application secrets"
        
        # Create configs
        echo -e "${BLUE}Creating environment configs...${NC}"
        doppler configs create --project "$PROJECT_NAME" --environment development --name dev
        doppler configs create --project "$PROJECT_NAME" --environment staging --name staging  
        doppler configs create --project "$PROJECT_NAME" --environment production --name prod
        
        # Setup with new project
        doppler setup --project "$PROJECT_NAME" --config "$CONFIG"
        echo -e "${GREEN}✓ Project created and configured${NC}"
    else
        echo -e "${YELLOW}Please ask your team lead to create the Doppler project.${NC}"
        exit 1
    fi
fi

echo ""

# Create doppler.yaml if it doesn't exist
if [ ! -f "doppler.yaml" ]; then
    echo -e "${BLUE}Creating doppler.yaml configuration file...${NC}"
    cat > doppler.yaml << EOF
# Doppler configuration for Skillancer
# See: https://docs.doppler.com/docs/doppler-yaml
setup:
  project: ${PROJECT_NAME}
  config: ${CONFIG}
EOF
    echo -e "${GREEN}✓ Created doppler.yaml${NC}"
fi

echo ""

# Verify configuration
echo -e "${BLUE}Verifying configuration...${NC}"
if doppler secrets --only-names &> /dev/null; then
    SECRET_COUNT=$(doppler secrets --only-names 2>/dev/null | wc -l)
    echo -e "${GREEN}✓ Configuration verified (${SECRET_COUNT} secrets available)${NC}"
else
    echo -e "${YELLOW}⚠ No secrets found. Please add secrets in Doppler dashboard.${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Doppler Setup Complete!                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Usage:${NC}"
echo ""
echo "  Run application with secrets:"
echo -e "    ${YELLOW}doppler run -- pnpm dev${NC}"
echo ""
echo "  Run specific app:"
echo -e "    ${YELLOW}doppler run -- pnpm --filter @skillancer/api dev${NC}"
echo ""
echo "  View secrets (names only):"
echo -e "    ${YELLOW}doppler secrets --only-names${NC}"
echo ""
echo "  Download secrets to .env file (for debugging only):"
echo -e "    ${YELLOW}doppler secrets download --no-file --format env > .env.local${NC}"
echo ""
echo "  Switch environment:"
echo -e "    ${YELLOW}doppler setup --config staging${NC}"
echo ""
echo -e "${RED}⚠ Never commit .env files with real secrets!${NC}"
echo ""
