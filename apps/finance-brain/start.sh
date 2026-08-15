#!/usr/bin/env sh
set -e
[ -f server/.env ] || cp server/.env.example server/.env
npm run install:all
npm run dev
