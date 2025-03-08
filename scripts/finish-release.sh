#!/bin/bash

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "Error: Please provide a version number (e.g., 1.0.0)"
  exit 1
fi

VERSION=$1
BRANCH="release/v$VERSION"

# Ensure we're on the correct release branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "Error: Not on release branch $BRANCH"
  echo "Current branch: $CURRENT_BRANCH"
  echo "Please run: git checkout $BRANCH"
  exit 1
fi

# Check if user is logged in to npm
if ! npm whoami >/dev/null 2>&1; then
  echo "Error: You are not logged in to npm. Please run 'npm login' first."
  exit 1
fi

# Run tests
echo "Running tests..."
npm test

# If tests pass, proceed with release
if [ $? -eq 0 ]; then
  echo "Tests passed. Proceeding with release..."
  
  # Generate changelog
  echo "Generating changelog..."
  CHANGELOG=$(./scripts/generate-changelog.sh)
  
  # Create temporary file for tag message
  TEMP_MSG=$(mktemp)
  echo "Release version $VERSION" > "$TEMP_MSG"
  echo "" >> "$TEMP_MSG"
  echo "$CHANGELOG" >> "$TEMP_MSG"
  
  # Create version tag with changelog
  git tag -a "v$VERSION" -F "$TEMP_MSG"
  
  # Clean up temporary file
  rm "$TEMP_MSG"
  
  # Merge to main
  git checkout main
  git merge --no-ff "$BRANCH" -m "chore(release): merge release v$VERSION"
  
  # Build the package
  echo "Building package..."
  npm run build
  
  if [ $? -ne 0 ]; then
    echo "Error: Build failed"
    exit 1
  fi
  
  # Update package version
  npm version "$VERSION" --no-git-tag-version
  
  # Publish to npm
  echo "Publishing to npm..."
  npm publish --access public
  
  if [ $? -ne 0 ]; then
    echo "Error: npm publish failed"
    exit 1
  fi
  
  # Push changes
  git push origin main
  git push origin "v$VERSION"
  
  # Clean up release branch
  git branch -d "$BRANCH"
  
  echo "Release v$VERSION completed successfully!"
  echo "Package published to npm as @aksolab/recall@$VERSION"
  echo ""
  echo "Changelog:"
  echo "$CHANGELOG"
  echo ""
  echo "The semantic-release process will automatically create a new release based on the commit history."
else
  echo "Tests failed. Please fix the issues and try again."
  exit 1
fi 
