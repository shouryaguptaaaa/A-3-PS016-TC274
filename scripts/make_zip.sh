#!/bin/sh
# Run from the folder that CONTAINS handoverlab/ :  sh handoverlab/scripts/make_zip.sh
zip -r handoverlab.zip handoverlab \
  -x "*/node_modules/*" "*/.venv/*" "*/__pycache__/*" "*.pyc" "*/.pytest_cache/*" "*.db" "*/dist/*" "*/.env" "*.log"
