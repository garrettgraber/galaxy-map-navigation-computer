#!/bin/bash

./build.sh
# echo "Deleting "
docker rm -f navi-computer-node 
echo "Running navi-computer-node.."

docker run --name navi-computer-node  --env NODE_ENV=production  -v /${PWD}/../://root/app  -p 80:8117  -e "RUN_STATUS=server" navi-computer-node

