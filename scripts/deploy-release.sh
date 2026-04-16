#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <deploy_root> <release_name> <archive_path>"
  exit 1
fi

DEPLOY_ROOT="$1"
RELEASE_NAME="$2"
ARCHIVE_PATH="$3"

# deploy_root/releases/<release_name> 에 새 릴리즈를 풀고,
# deploy_root/current 심볼릭 링크를 새 릴리즈로 교체하는 구조다.
RELEASES_DIR="$DEPLOY_ROOT/releases"
CURRENT_LINK="$DEPLOY_ROOT/current"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
ECOSYSTEM_FILE="$DEPLOY_ROOT/ecosystem.config.js"

# 릴리즈 저장소와 이번 배포 대상 폴더를 준비한다.
mkdir -p "$RELEASES_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# 서버에 고정으로 둔 PM2 설정 파일이 없으면 배포를 중단한다.
if [[ ! -f "$ECOSYSTEM_FILE" ]]; then
  echo "Missing ecosystem file: $ECOSYSTEM_FILE"
  exit 1
fi

# GitHub Actions 가 올린 release archive 를 새 릴리즈 폴더에 압축 해제한다.
tar -xzf "$ARCHIVE_PATH" -C "$RELEASE_DIR"

# 새 릴리즈 폴더 기준으로 운영 의존성을 설치한다.
cd "$RELEASE_DIR"
npm ci --omit=dev

# current 링크를 새 릴리즈로 교체한 뒤 PM2 reload 로 반영한다.
# 실제 실행 경로는 ecosystem.config.js 의 cwd(<deploy_root>/current) 를 따른다.
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

# PM2 프로세스 목록을 갱신하고 재부팅 후에도 유지되도록 저장한다.
pm2 startOrReload "$ECOSYSTEM_FILE" --update-env
pm2 save
