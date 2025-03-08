#!/bin/bash

# Check if version argument is provided
if [ -z "$1" ]; then
  echo "Error: Please provide a version number (e.g., 1.0.0)"
  exit 1
fi

VERSION=$1
BRANCH="release/v$VERSION"

# Ensure we're on main branch and it's up to date
git checkout main
git pull origin main

# Create and checkout new release branch
git checkout -b $BRANCH

echo "Created release branch: $BRANCH"
echo "Next steps:"
echo "1. Make any final adjustments needed for the release"
echo "2. Run tests: npm test"
echo "3. When ready, run: ./scripts/finish-release.sh $VERSION" 
