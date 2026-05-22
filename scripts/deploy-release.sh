#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <deploy_root> <release_name> <archive_path>"
  exit 1
fi

DEPLOY_ROOT="$1"
RELEASE_NAME="$2"
ARCHIVE_PATH="$3"

CURRENT_DIR="$DEPLOY_ROOT/current"
BACKUP_DIR="$DEPLOY_ROOT/backup"
TEMP_DIR="$DEPLOY_ROOT/.tmp_$RELEASE_NAME"
ECOSYSTEM_FILE="$DEPLOY_ROOT/ecosystem.config.js"

if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  echo "Missing ecosystem file: $ECOSYSTEM_FILE"
  exit 1
fi

# 임시 디렉토리에 새 릴리즈 압축 해제
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
tar -xzf "$ARCHIVE_PATH" -C "$TEMP_DIR"
rm -f "$ARCHIVE_PATH"

# current → backup 교체 (기존 backup 은 삭제)
if [[ -d "$CURRENT_DIR" ]]; then
  rm -rf "$BACKUP_DIR"
  mv "$CURRENT_DIR" "$BACKUP_DIR"
fi

mv "$TEMP_DIR" "$CURRENT_DIR"

# 로그 디렉토리는 배포와 무관하게 유지
mkdir -p "$DEPLOY_ROOT/logs"

# PM2 reload, 실패 시 backup 으로 롤백
if ! pm2 startOrReload "$ECOSYSTEM_FILE" --update-env; then
  echo "Deployment failed. Rolling back to backup..."
  rm -rf "$CURRENT_DIR"
  if [[ -d "$BACKUP_DIR" ]]; then
    mv "$BACKUP_DIR" "$CURRENT_DIR"
    pm2 startOrReload "$ECOSYSTEM_FILE" --update-env \
      || echo "Rollback reload failed. Manual intervention required."
  else
    echo "No backup available. Manual intervention required."
  fi
  exit 1
fi

pm2 save
echo "Deployment successful: $RELEASE_NAME"
