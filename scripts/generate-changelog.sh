#!/bin/bash

# Get the last tag, if none exists, use the initial commit
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)

echo "Generating changelog since $LAST_TAG..."
echo ""
echo "# Changelog"
echo ""

# Get merged PRs
echo "## Merged Pull Requests"
echo ""
git log "$LAST_TAG"..HEAD --merges --format="* %s" | grep -i "pull request" || echo "No merged pull requests"
echo ""

# Get conventional commits grouped by type
echo "## Commits"
echo ""
echo "### Features"
git log "$LAST_TAG"..HEAD --no-merges --format="* %s" | grep "^feat" || echo "No new features"
echo ""
echo "### Bug Fixes"
git log "$LAST_TAG"..HEAD --no-merges --format="* %s" | grep "^fix" || echo "No bug fixes"
echo ""
echo "### Performance Improvements"
git log "$LAST_TAG"..HEAD --no-merges --format="* %s" | grep "^perf" || echo "No performance improvements"
echo ""
echo "### Other Changes"
git log "$LAST_TAG"..HEAD --no-merges --format="* %s" | grep -vE "^(feat|fix|perf|chore)" || echo "No other changes" 
