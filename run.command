#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Excel → Word Generator  |  macOS double-click launcher
#  Just double-click this file in Finder to start the app.
# ─────────────────────────────────────────────────────────────

# Move to the folder this script lives in (works wherever you put it)
cd "$(dirname "$0")"

echo "────────────────────────────────────────"
echo "  Excel → Word Generator"
echo "────────────────────────────────────────"

# ── 1. Find Python 3 ─────────────────────────────────────────
PYTHON=""
for candidate in python3 python3.12 python3.11 python3.10 python3.9; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo ""
    echo "  ERROR: Python 3 is not installed."
    echo ""
    echo "  Install it with Homebrew:"
    echo "    brew install python"
    echo ""
    echo "  Or download from: https://www.python.org/downloads/"
    echo ""
    read -p "  Press Enter to close..."
    exit 1
fi

echo "  Using: $($PYTHON --version)"

# ── 2. Create virtual environment (only once) ────────────────
if [ ! -d "venv" ]; then
    echo ""
    echo "  First run — setting up virtual environment..."
    $PYTHON -m venv venv
    if [ $? -ne 0 ]; then
        echo "  ERROR: Failed to create virtual environment."
        read -p "  Press Enter to close..."
        exit 1
    fi
    echo "  Virtual environment created."
fi

# Activate it
source venv/bin/activate

# ── 3. Install / update dependencies (only when needed) ──────
MARKER="venv/.deps_installed"
if [ ! -f "$MARKER" ] || [ "requirements.txt" -nt "$MARKER" ]; then
    echo ""
    echo "  Installing dependencies (one-time, may take a minute)..."
    pip install --quiet --upgrade pip
    pip install --quiet -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "  ERROR: Dependency installation failed."
        echo "  Check your internet connection and try again."
        read -p "  Press Enter to close..."
        exit 1
    fi
    touch "$MARKER"
    echo "  Dependencies ready."
fi

# ── 4. Create sample files if data.xlsx / template.docx missing
if [ ! -f "data.xlsx" ] || [ ! -f "template.docx" ]; then
    echo ""
    echo "  No data.xlsx or template.docx found."
    echo "  Creating sample files so you can test right away..."
    python create_sample.py
fi

# ── 5. Launch the app ────────────────────────────────────────
echo ""
echo "  Launching app..."
echo "────────────────────────────────────────"
python main.py
