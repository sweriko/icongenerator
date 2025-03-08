#!/bin/bash

# Delete the existing digest.txt if it exists
if [ -f "digest.txt" ]; then
    echo "Deleting existing digest.txt..."
    rm "digest.txt"
fi

# Run gitingest to generate digest.txt
echo "Running gitingest..."
gitingest . --exclude-pattern ingest.sh --exclude-pattern editor.html --exclude-pattern preview.html

# Wait a moment to ensure digest.txt is created
sleep 1

DIGEST_FILE="digest.txt"

# Check if the file exists
if [ -f "$DIGEST_FILE" ]; then
    # Read the content of digest.txt
    DIGEST_CONTENT=$(cat "$DIGEST_FILE")

    # Overwrite digest.txt with the raw content only
    echo "$DIGEST_CONTENT" > "$DIGEST_FILE"

    echo "digest.txt printed without tags!"
else
    echo "Error: digest.txt not found."
fi
