---
sidebar_position: 8
---

# Contributing

Thank you for your interest in contributing to Skillancer! This guide will help you get started.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read and follow our Code of Conduct.

## Getting Started

1. [Set up your development environment](/docs/getting-started/installation)
2. Find an issue to work on or create one
3. Fork the repository (external contributors)
4. Create a feature branch
5. Make your changes
6. Submit a pull request

## Finding Issues

Look for issues labeled:

- `good first issue` - Great for newcomers
- `help wanted` - Ready for contribution
- `bug` - Bug fixes
- `enhancement` - New features

## Development Process

### 1. Create an Issue (if needed)

Before starting significant work, create or find an issue to discuss:

- Describe the problem or feature
- Discuss approach with maintainers
- Get approval before large changes

### 2. Create a Branch

```bash
# Update your local main
git checkout staging
git pull origin staging

# Create feature branch
git checkout -b feature/SKILL-123-your-feature
```

### 3. Make Changes

- Write clean, readable code
- Follow our [code style](/docs/getting-started/code-style)
- Add tests for new functionality
- Update documentation if needed

### 4. Commit Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(market): add job search filters"
git commit -m "fix(auth): correct password reset flow"
git commit -m "docs: update API reference"
```

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code change (no feature/fix)
- `test` - Adding tests
- `chore` - Maintenance

### 5. Push and Create PR

```bash
git push origin feature/SKILL-123-your-feature
```

Then create a Pull Request on GitHub.

## Pull Request Guidelines

### PR Title

Use the same format as commits:

```
feat(market): add job search filters
```

### PR Description

Include:

- **What**: Brief description of changes
- **Why**: Motivation and context
- **How**: Technical approach (if complex)
- **Testing**: How you tested the changes
- **Screenshots**: For UI changes

### Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] Self-review completed
- [ ] PR title follows convention

## Code Review

### For Authors

- Respond to feedback promptly
- Explain your reasoning
- Make requested changes
- Keep PR scope focused

### For Reviewers

- Be constructive and kind
- Explain reasoning for suggestions
- Approve when satisfied
- Use "Request changes" sparingly

## Testing Requirements

- Unit tests for utilities and services
- Integration tests for API endpoints
- Component tests for UI components
- E2E tests for critical user flows

```bash
# Run all tests before submitting
pnpm test
pnpm lint
pnpm typecheck
```

## Documentation

Update docs when you:

- Add new features
- Change API behavior
- Add new configuration
- Change architecture

Documentation lives in:

- `docs/` - This documentation site
- `README.md` - Package-specific docs
- Code comments - Implementation details

## Release Process

We use semantic versioning:

- `MAJOR.MINOR.PATCH`
- Breaking changes → Major
- New features → Minor
- Bug fixes → Patch

Releases are automated via GitHub Actions when PRs are merged to `main`.

## Getting Help

- **Discord**: Join our developer community
- **GitHub Issues**: Ask questions
- **Code Review**: Learn from feedback

## Recognition

Contributors are recognized in:

- Release notes
- CONTRIBUTORS.md
- Our public documentation

Thank you for contributing to Skillancer! 🎉
