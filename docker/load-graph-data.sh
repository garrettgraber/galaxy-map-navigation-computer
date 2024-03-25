#!/bin/bash

# ./build.sh
# echo "Deleting "
docker rm -f navi-computer-node 
echo "Running navi-computer-node.."

docker run --name navi-computer-node  --link data-planet:mongo  --link hyperspace-data:graph -v /${PWD}/../://root/app  -p 8117:8117 -e "RUN_STATUS=loader" gmoneycool/navi-computer-node

# docker run --name some-app --link some-postgres:postgres -d application-that-uses-postgres

