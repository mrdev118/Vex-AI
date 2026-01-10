#!/data/data/com.termux/files/usr/bin/sh
# Auto-start AURABOT with pm2 on device boot (Termux:Boot required)
termux-wake-lock
if command -v pm2 >/dev/null 2>&1; then
  pm2 resurrect >/dev/null 2>&1
fi
