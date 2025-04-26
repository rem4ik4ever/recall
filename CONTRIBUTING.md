# Contributing to Recall Packages

## Development Setup

```bash
# Clone the repository
git clone https://github.com/rem4ik4ever/recall.git
cd recall

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Making Changes

1. Create a new branch for your changes
2. Make your changes to the code
3. Add tests for your changes
4. Run tests to ensure everything works
5. Create a changeset to document your changes

## Creating a Changeset

When you've made changes to one or more packages, you need to create a changeset:

```bash
npm run changeset
```

This will:
1. Ask which packages you've modified
2. Ask what type of version bump is needed:
   - `major` for breaking changes
   - `minor` for new features (non-breaking)
   - `patch` for bug fixes and minor changes
3. Prompt you to write a summary of the changes

A new markdown file will be created in the `.changeset` directory. This file should be committed along with your code changes.

## Pull Request Guidelines

1. Make sure all tests pass
2. Ensure you've created a changeset if your changes affect any packages
3. Keep pull requests focused on a single topic
4. Write clear, concise commit messages
5. Document any new features or changes in behavior

## Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Format your code before committing

## Package Structure

Each package should maintain:
- Clear documentation in its README.md
- Comprehensive test coverage
- Proper types and exports
- Consistent API design with other packages

See the [RELEASING.md](./RELEASING.md) file for more information about how we handle versioning and publishing packages.

## Commit Message Guidelines

The project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This allows us to automatically determine the next version number and generate changelogs.

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

#### Type

The type must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

#### Scope

The scope should be the name of the package affected (e.g., `types`, `storage-provider`, `redis-search-adapter`, etc.).

#### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (.) at the end

### Examples

```
feat(redis-search-adapter): add support for vector search operations

fix(storage-provider): resolve issue with object storage retrieval

docs(types): update documentation for memory types
```

## Package Releases

We use [semantic-release](https://github.com/semantic-release/semantic-release) to automate package versioning and publishing based on commit messages.

The release workflow is as follows:

1. Make your changes following the branch naming and commit message conventions
2. Create a pull request to the `main` branch
3. After merge to `main`, the GitHub Actions workflow will:
   - Analyze commit messages to determine the next version
   - Update package versions according to semantic versioning
   - Generate changelogs
   - Publish packages to npm
   - Create GitHub releases

### Versioning

The version numbers follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version when you make incompatible API changes (commit type: `feat!:` or with `BREAKING CHANGE:` in footer)
- **MINOR** version when you add functionality in a backward compatible manner (commit type: `feat:`)
- **PATCH** version when you make backward compatible bug fixes (commit type: `fix:`)

### Dependencies Between Packages

When updating a package that other packages depend on, make sure to:

1. Make necessary changes to the dependent package
2. Reference the updated version in the dependent packages

## Setting Up For Development

```bash
# Clone the repository
git clone https://github.com/rem4ik4ever/recall.git
cd recall

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
``` 
