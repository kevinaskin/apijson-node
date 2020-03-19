#!/bin/bash

if [[ $1 = "YES" ]]; then
	# rm -rf node_modules
	echo "NPM INSTALLING ..."
	npm install --registry=https://registry.npm.taobao.org/ 2>&1
fi

echo "npm run build BEGIN ..."
npm run build
echo "npm run build SUCCESS ..."