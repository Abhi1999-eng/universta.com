#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-$HOME/Projects/universta-platform}"
mkdir -p "$PROJECT_ROOT"
cd "$PROJECT_ROOT"

if [ ! -d .git ]; then git init; fi
mkdir -p apps packages docs database scripts

if [ ! -d apps/web ]; then
  npx create-next-app@latest apps/web     --typescript --tailwind --eslint --app --src-dir     --import-alias "@/*" --use-npm --yes
fi

if [ ! -d apps/admin ]; then
  npx create-next-app@latest apps/admin     --typescript --tailwind --eslint --app --src-dir     --import-alias "@/*" --use-npm --yes
fi

if [ ! -d apps/api ]; then
  npx @nestjs/cli@latest new apps/api     --package-manager npm --skip-git --strict
fi

cd apps/api
npm install @prisma/client @prisma/adapter-mariadb dotenv
npm install --save-dev prisma tsx @types/node
if [ ! -d prisma ]; then
  npx prisma init --datasource-provider mysql --output ./src/generated/prisma
fi
cd "$PROJECT_ROOT"

cat > package.json <<'JSON'
{
  "name": "universta-platform",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "npm --workspace apps/web run dev",
    "dev:admin": "npm --workspace apps/admin run dev -- --port 3001",
    "dev:api": "npm --workspace apps/api run start:dev",
    "build:web": "npm --workspace apps/web run build",
    "build:admin": "npm --workspace apps/admin run build",
    "build:api": "npm --workspace apps/api run build",
    "build": "npm run build:web && npm run build:admin && npm run build:api",
    "lint": "npm run lint --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:format": "npm --workspace apps/api exec prisma format",
    "db:validate": "npm --workspace apps/api exec prisma validate",
    "db:generate": "npm --workspace apps/api exec prisma generate",
    "db:migrate:dev": "npm --workspace apps/api exec prisma migrate dev",
    "db:migrate:deploy": "npm --workspace apps/api exec prisma migrate deploy",
    "db:migrate:status": "npm --workspace apps/api exec prisma migrate status",
    "db:studio": "npm --workspace apps/api exec prisma studio",
    "db:seed": "npm --workspace apps/api exec prisma db seed"
  },
  "engines": {"node": ">=24 <25"}
}
JSON

find apps -name package-lock.json -delete
npm install

echo "Foundation scaffold completed."
