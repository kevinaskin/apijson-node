#!/bin/bash
echo "type node: `type node`"

PM2_COMMAND=$1
SERVER_PORT=9771

# 安装pm2 logrotate依赖
pm2 describe pm2-logrotate > /dev/null
if [ $? -ne 0 ]; then
  echo 'install pm2-logrotate'
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:compress true
else
  echo 'pm2-logrotate has running'
  pm2 set pm2-logrotate:compress true
fi

start () {
  export PORT=$SERVER_PORT
  pm2 start ./pm2.config.json
}

stop () {
  pm2 delete ai-apijson-node
}

restart () {
  pm2 describe server > /dev/null
  if [ $? -eq 0 ]; then
    pm2 reload ai-apijson-node
  else
    start
  fi
}

case $PM2_COMMAND in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    restart
    ;;
  *)
    ;;
esac

sleep 2
pm2 status
