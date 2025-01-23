#!/bin/bash

# ./build.sh
# echo "Deleting "
docker rm -f navi-computer-node 
echo "Running navi-computer-node.."

docker run --name navi-computer-node -d --env NODE_ENV=production  --link hyperspace-data:graph -v /${PWD}/../://root/app  -p 80:8117  -e "RUN_STATUS=server" gmoneycool/navi-computer-node

