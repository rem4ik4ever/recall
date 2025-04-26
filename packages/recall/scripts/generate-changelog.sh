#!/bin/bash

# Check if CHANGELOG.md exists
if [ ! -f CHANGELOG.md ]; then
    echo "Error: CHANGELOG.md not found"
    exit 1
fi

# Extract content between the first two version headers (## [...])
# If there's only one version, it will show everything after the first header
awk '
    /^## \[/ {
        if (count == 0) {
            print;
            count++;
            next;
        }
        if (count == 1) {
            exit;
        }
    }
    count == 1 { print }
' CHANGELOG.md 
