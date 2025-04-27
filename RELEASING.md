# Publishing Packages with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versions and publish packages to npm.

## Automated Publishing with Semantic Release

The following packages are automatically published to npm when changes are pushed to the main branch:

- `@aksolab/recall-archive-provider`
- `@aksolab/recall-types`
- `@aksolab/recall-storage-provider`
- `@aksolab/recall-redis-storage-provider`
- `@aksolab/recall-redis-search-adapter`

## How It Works

Changesets provides a way to:
- Track changes across multiple packages in the monorepo
- Generate changelogs automatically
- Manage version bumps (major, minor, patch)
- Publish packages to npm

## Developer Workflow

### 1. Making Changes

When you make changes to one or more packages, you need to create a changeset file that describes those changes:

```bash
npm run changeset
```

This interactive command will:
- Ask which packages you've modified
- Ask what type of version bump is needed (major, minor, patch)
- Prompt for a description of the changes

### 2. Commit the Changeset

The command will create a Markdown file in the `.changeset` directory. Commit this file along with your changes:

```bash
git add .changeset/your-changeset-id.md
git commit -m "Add changeset for your feature or fix"
git push
```

### 3. Automated Release Process

When changes are pushed to the `main` branch, our GitHub Actions workflow will:

1. Create a "Version Packages" pull request that:
   - Updates package versions
   - Updates changelogs
   - Updates dependencies between packages

2. Once this PR is merged, another workflow will:
   - Publish the packages to npm
   - Create GitHub releases

## Types of Changes

- `major`: Breaking changes that require special attention during upgrade
- `minor`: New features or capabilities (non-breaking)
- `patch`: Bug fixes, minor changes, documentation improvements

## Example Changeset File

```md
---
"@aksolab/recall-types": patch
"@aksolab/recall-archive-provider": minor
---

Added new archiving methods and fixed type definitions
```

## Release Requirements

To trigger a release:

1. Create changesets for your changes using `npm run changeset`
2. Push changes and changesets to the `main` branch
3. The GitHub workflow will create a PR to version packages
4. Once approved and merged, the packages will be published

The GitHub repository must have the following secrets configured:
- `NPM_TOKEN`: An npm token with publish access to the @aksolab scope

## Manually Versioning and Publishing

In case you need to manually version packages:

```bash
# Update versions based on changesets
npm run version-packages

# Publish packages
npm run release
```

## Troubleshooting

- If packages aren't being published, check GitHub Actions logs
- Ensure you have the correct NPM_TOKEN in GitHub secrets
- Check that package.json files have the correct access and configurations

## Dependency Management

When a package depends on another package in this monorepo:

1. Changesets automatically handles updating dependent packages
2. Internal dependencies will receive patch bumps by default when their dependencies change
3. This behavior can be configured in the `.changeset/config.json` file

## Publishing Order

Packages are published in the correct order based on their dependencies. Changesets automatically detects dependencies between packages and publishes them in the appropriate order to ensure that all dependencies are published before the packages that depend on them.

The packages in this repository:

- `@aksolab/recall-types`
- `@aksolab/recall-archive-provider`
- `@aksolab/recall-storage-provider`
- `@aksolab/recall-redis-storage-provider`
- `@aksolab/recall-redis-search-adapter` 
