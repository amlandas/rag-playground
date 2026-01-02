# Project Rules

## Deployment
- **Review Tags**: Always tag Cloud Run revisions with a version string (e.g., `v13`, `v13-1`, `v14-beta`) to ensure easy rollback and identification.

## Code Quality
- **Linter**: Ensure no lint errors before requesting review.

## Security
- **Secrets**: Never commit secrets. Use Secret Manager.
