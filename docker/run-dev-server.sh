#!/bin/bash

./build.sh
# echo "Deleting "
docker rm -f navi-computer-node 
echo "Running navi-computer-node.."

docker run --name navi-computer-node  --link data-planet:mongo  --link hyperspace-data:graph  --env NODE_ENV=development  -v /${PWD}/../://root/app  -p 8117:8117  -e "RUN_STATUS=server" navi-computer-node

