#!/usr/bin/env bash
# الاستخدام: ./push.sh https://github.com/USERNAME/REPO.git
set -e
git remote remove origin 2>/dev/null || true
git remote add origin "$1"
git branch -M main
git push -u origin main
