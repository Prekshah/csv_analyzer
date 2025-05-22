#!/bin/bash

# Start the development server
echo "Starting development server..."

# Change to the script's directory
cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the development server
echo "Starting the server..."
npm start 