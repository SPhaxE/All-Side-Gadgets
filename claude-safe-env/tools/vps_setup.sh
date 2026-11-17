#!/usr/bin/env bash
# 在全新 Ubuntu / Debian 美区 VPS 上一键部署单人独享 VLESS + Vision + Reality (443端口)
# 运行前请确保以 root 执行：sudo bash vps_setup.sh

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "请使用 root 权限运行: sudo bash $0"
  exit 1
fi

PORT="${PORT:-443}"
SNI="${SNI:-www.apple.com}"

echo "[1/4] 安装官方 Xray-core..."
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

echo "[2/4] 生成 UUID 与 Reality X25519 密钥对..."
UUID=$(/usr/local/bin/xray uuid)
KEY_OUT=$(/usr/local/bin/xray x25519)
PRIVATE_KEY=$(echo "$KEY_OUT" | awk -F': ' '/Private key|PrivateKey/{print $2}' | tr -d ' \r')
PUBLIC_KEY=$(echo "$KEY_OUT" | awk -F': ' '/Public key|Password/{print $2}' | tr -d ' \r')
SHORT_ID=$(openssl rand -hex 8)

if [[ -z "$PRIVATE_KEY" || -z "$PUBLIC_KEY" ]]; then
  echo "密钥生成失败，x25519 输出如下："
  echo "$KEY_OUT"
  exit 1
fi

echo "[3/4] 写入 /usr/local/etc/xray/config.json..."
cat >/usr/local/etc/xray/config.json <<EOF
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "port": ${PORT},
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "${UUID}",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "${SNI}:443",
          "xver": 0,
          "serverNames": [
            "${SNI}"
          ],
          "privateKey": "${PRIVATE_KEY}",
          "shortIds": [
            "${SHORT_ID}"
          ]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": [
          "http",
          "tls",
          "quic"
        ]
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    }
  ]
}
EOF

echo "[4/4] 启动并设置开机自启..."
systemctl enable xray
systemctl restart xray

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp"
fi

SERVER_IP=$(curl -4 -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo ""
echo "================ 部署完成 ================"
echo "请把以下参数填入 clash-verge-script.template.js 的 LANDING 配置："
echo "  enabled: true"
echo "  type: \"vless\""
echo "  server: \"${SERVER_IP}\""
echo "  port: ${PORT}"
echo "  uuid: \"${UUID}\""
echo "  servername: \"${SNI}\""
echo "  publicKey: \"${PUBLIC_KEY}\""
echo "  shortId: \"${SHORT_ID}\""
echo "=========================================="
