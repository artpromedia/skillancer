---
sidebar_position: 10
---

# Pull Requests

Guidelines for creating and reviewing pull requests.

## Creating a Pull Request

### Before You Submit

1. **Run all checks locally**

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

2. **Update documentation** if needed

3. **Self-review your changes**
   - Read through your diff
   - Remove debug code
   - Check for typos

### PR Title

Use the conventional commit format:

```
<type>(<scope>): <description>
```

Examples:

- `feat(market): add job search filters`
- `fix(auth): correct password reset flow`
- `docs: update API reference`
- `refactor(billing): extract payment logic`

### PR Description Template

```markdown
## Description

Brief description of what this PR does.

## Related Issue

Closes #123

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Documentation update

## How Has This Been Tested?

Describe the tests you ran:

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Screenshots (if applicable)

Add screenshots for UI changes.

## Checklist

- [ ] My code follows the code style of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Size Guidelines

| Size | Lines Changed | Review Time        |
| ---- | ------------- | ------------------ |
| XS   | 0-10          | < 10 min           |
| S    | 11-50         | 10-20 min          |
| M    | 51-200        | 20-40 min          |
| L    | 201-500       | 40-60 min          |
| XL   | 500+          | Consider splitting |

Aim for Small to Medium PRs. Large PRs are harder to review and more likely to have issues.

## Requesting Reviews

- Add relevant reviewers based on code ownership
- Use GitHub's CODEOWNERS for automatic assignment
- Request reviews from at least 1-2 people

## Responding to Feedback

### Addressing Comments

- Respond to all comments
- Use "Resolve conversation" when addressed
- Ask for clarification if needed

### Making Changes

```bash
# Make requested changes
git add .
git commit -m "address review feedback"
git push
```

Or amend if appropriate:

```bash
git add .
git commit --amend --no-edit
git push --force-with-lease
```

## Code Review Guidelines

### For Reviewers

**What to Look For:**

1. **Correctness**
   - Does it work as intended?
   - Are edge cases handled?
   - Are there potential bugs?

2. **Design**
   - Is the code well-structured?
   - Are there better approaches?
   - Is it consistent with existing code?

3. **Readability**
   - Is it easy to understand?
   - Are names descriptive?
   - Are complex parts documented?

4. **Testing**
   - Are tests adequate?
   - Do they test the right things?
   - Are edge cases covered?

5. **Security**
   - Any security concerns?
   - Is input validated?
   - Are secrets protected?

**Review Etiquette:**

- Be constructive and kind
- Explain your reasoning
- Offer alternatives
- Praise good code
- Distinguish between required changes and suggestions

**Comment Prefixes:**

```markdown
# Must fix

REQUIRED: This will cause a bug in production

# Should fix

SUGGESTION: Consider using a more descriptive name

# Optional / FYI

NIT: Extra space here
```

### For Authors

- Don't take feedback personally
- Ask questions if unclear
- Explain your reasoning
- Be open to alternatives

## Merging

### Requirements

- At least 1 approval
- All CI checks passing
- No merge conflicts
- All conversations resolved

### Merge Strategy

- **Squash and merge** for feature branches
- **Merge commit** for release branches
- Delete branch after merge

### After Merging

1. Delete your feature branch
2. Pull latest changes to your local main
3. Celebrate! 🎉

## Emergency Fixes

For critical production issues:

1. Create a `hotfix/` branch from `main`
2. Make the minimal fix
3. Get expedited review
4. Merge to `main` with approval
5. Cherry-pick to `staging` if needed

```bash
git checkout main
git pull
git checkout -b hotfix/SKILL-999-critical-fix
# Make fix
git push origin hotfix/SKILL-999-critical-fix
# Create PR targeting main
```
