const fs = require('fs'),
	_ = require('lodash'),
  async = require('async'),
  // neo4j = require('neo4j-driver').v1,
  neo4j = require('node-neo4j'),
  cypher = require('cypher-query'),
  parser = require("neo4j-parser"),
  uuidv1 = require('uuid/v1'),
  uuidv4 = require('uuid/v4'),
  distance = require('euclidean-distance');

const Planet = require('../data-classes/classes.js').Planet;
const HyperSpaceLane = require('../data-classes/classes.js').HyperSpaceLane;
const HyperSpacePath = require('../data-classes/classes.js').HyperSpacePath;
const HyperSpaceNode = require('../data-classes/classes.js').HyperSpaceNode;
const HyperSpacePathCollection = require('../data-classes/classes.js').HyperSpacePathCollection;
const DatabaseLinks = require('docker-links').parseLinks(process.env);
const MongoController = require('./mongo-controller.js');

console.log("DatabaseLinks in NeoController: ", DatabaseLinks);

let neo4jHostname = "";
let hyperLanesCount = 0;

console.log("NODE_ENV: ", process.env.NODE_ENV);
const isDeveloping = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
console.log("Neo Controller isProduction: ", isProduction);

// db = new neo4j('http://username:password@domain:port');
let graphDatabaseHostname = '';

if(DatabaseLinks.hasOwnProperty('graph') && isDeveloping) {
  neo4jHostname = DatabaseLinks.graph.hostname;
}
 else {
  neo4jHostname = '0.0.0.0';
}

console.log("neo4jHostname: ", neo4jHostname);

db = new neo4j("http://neo4j:neo4j@" + neo4jHostname + ":7474");

console.log("db: ", db);




function insertHyperspaceNodeIntoGraph(hyperspaceNode, cb) {
  db.insertNode({
      system: hyperspaceNode.system,
      lng: hyperspaceNode.lng,
      lat: hyperspaceNode.lat,
      hyperspaceLanes: hyperspaceNode.hyperspaceLanes
  }, function(err, node){
      if(err) {
        console.log("node insertion error: ", err);
        cb(err, null);
      } else {
        console.log("node inserted: ", node._id);
        db.addLabelsToNode(node._id, 'Hyperspace_Node', function (errorAdd, resultAdd) {
            if(errorAdd) {
              console.log("Error adding labels: ", errorAdd);
              cb(errorAdd, null);
            } else {
              db.readLabels(node._id, function (errorRead, resultRead) {
                if(errorRead) {
                  console.log('Error reading labels: ', errorRead);
                  cb(errorRead, null);
                } else {
                  // console.log("Node Labels: ", resultRead);
                  cb(errorRead, resultRead);
                }
              });
            }
        });
        MongoController.findHyperspaceNodeAndUpdate({system: hyperspaceNode.system}, {nodeId: node._id}, function(error, result) {
          if(error) {
            console.log("error: ", error);
          }
        });
      }
  });
};

function insertHyperspaceLaneIntoGraph(hyperspaceLane, cb) {
  async.parallel([
    function(callback) {    
       MongoController.findOneHyperspaceNode({lng: hyperspaceLane.startCoordsLngLat[0], lat:hyperspaceLane.startCoordsLngLat[1]}, function(err, res) {
        callback(err, res);
      });
    },
    function(callback) {
        MongoController.findOneHyperspaceNode({lng: hyperspaceLane.endCoordsLngLat[0], lat:hyperspaceLane.endCoordsLngLat[1]}, function(err, res) {
          callback(err, res);
        });
    }
  ],
  function(error, results) {
      // console.log("hyperspaceLane: ", hyperspaceLane);
      if(error) {
        console.log("Error Finding Hyperspace Node: ", error);
        cb(err, null);
      } else {
        // console.log("\nresults: ", results);
        const startNode = results[0];
        const endNode = results[1];

        // console.log("start Node: ", startNode);
        // console.log("end Node: ", endNode);

        if(startNode.status && endNode.status) {
          db.insertRelationship(startNode.doc.nodeId, endNode.doc.nodeId, 'HYPERSPACE_LANE', {
            name: hyperspaceLane.name,
            hyperspaceHash: hyperspaceLane.hyperspaceHash,
            start: hyperspaceLane.start,
            end: hyperspaceLane.end,
            length: hyperspaceLane.length,
            link: hyperspaceLane.link,
            endCoordsLngLat: hyperspaceLane.endCoordsLngLat,
            startCoordsLngLat: hyperspaceLane.startCoordsLngLat,
            coordinates: hyperspaceLane.coordinates
            }, function(err, relationship){
              if(err) {
                cb(err, null);
              } else {
                console.log("hyperspace lane added: ", relationship._id);
                hyperLanesCount++;
                cb(null, relationship);
              }
          });
        } else {
          console.log("\nHyperlane not instered. Hyperspace Lane: ", hyperspaceLane);
          (startNode.status)? '' : console.log("Start node: ", startNode);
          (endNode.status)? '' : console.log("End node: ", endNode);
          cb(null, null);
        }
      }
  });
};

function deleteNodeFromGraph(nodeId) {
  db.deleteNode(nodeId, function(err, node){
      if(err) throw err;
      if(node === true){
          // node deleted
      } else {
          // node not deleted because not found or because of existing relationships
      }
  });
};

function buildHyperSpaceNodeGraph(cb) {
  console.log("buildHyperSpaceNodeGraph has fired!");
  MongoController.getAllHyperspaceNodes(function(error, result) {
    if(error) {
      console.log("error getting all hyperspace nodes: ", error);
    } else {
      // console.log("result: ", result);
      geneateHyperSpaceNodeGraph(result, cb);
    }
  });
};

function getFirstThirtyNodesFromGraph() {
  for(let hyperspaceNode = 1; hyperspaceNode < 31; hyperspaceNode++) {
    db.readNode(hyperspaceNode, function(err, node){
      if(err) {
        console.log("error reading node: ", err);
      } else {
        console.log(node);
      }
    });
  }
};

function getFirstThirtyLanesFromGraph() {
  for(let hyperspaceLane = 1; hyperspaceLane < 31; hyperspaceLane++) {

    db.readRelationship(hyperspaceLane, function(err, lane){
      if(err) {
        console.log("error reading lane: ", err);
      } else {
        console.log(lane);
      }

    });
  }
};

function buildHyperSpaceLaneGraph(cb) {
  console.log("buildHyperSpaceLaneGraph has fired!");
  MongoController.getAllHyperspaceLanes(function(error, result) {

    if(error) {
      console.log("error getting all hyperspace lanes: ", error);
    } else {
      geneateHyperSpaceLaneRelationship(result, cb);
      // console.log("result: ", result);
    }
  });
};

function geneateHyperSpaceNodeGraph(hyperSpaceNodes, cb) {
  async.eachLimit(hyperSpaceNodes, 5, insertHyperspaceNodeIntoGraph, function(err){
    console.log("async each done!");
    if(err) {
      console.log("Error loading hyperspace node data: ", err);
      cb(err);
    } else {
      console.log("Hyperspace Node data loaded! Total nodes in graph database: ", hyperSpaceNodes.length);
      cb(null);
    }
  });
};

function geneateHyperSpaceLaneRelationship(hyperSpaceLanes, cb) {
  async.eachLimit(hyperSpaceLanes, 5, insertHyperspaceLaneIntoGraph, function(err){
    console.log("async each done!");
    if(err) {
      console.log("Error loading hyperspace lane data: ", err);
      cb(err);
    } else {
      console.log("Hyperspace Lane data loaded! Total lanes in graph database: ", hyperSpaceLanes.length);
      cb(null);
    }
  });
};

function getHyperSpaceLane(laneId, cb) {
  db.readRelationship(laneId, function(err, relationship){
    if(err) throw err;
    if(err) {
      cb(err, null)
    } else {
      cb(null, relationship);
    }
  });
};

function getHyperSpaceNode(nodeId, cb) {
  db.readNode(nodeId, function(err, node){
      if(err) {
        cb(err, null);
      } else {
        cb(null, node);
      }
  });
};

function parseUriForIds(uri) {
  const uriParsed = uri.split('/');
  return parseInt( uriParsed[uriParsed.length - 1] );
};

function getPathData(pathResponseData) {

  const PathObject = pathResponseData[0];
  const distance = pathResponseData[1];
  const relationships = PathObject.relationships;
  const nodes = PathObject.nodes;
  const start = PathObject.start;
  const end = PathObject.end;
  const length = PathObject.length;
  const relationshipsIds = _.map(relationships, parseUriForIds);
  const nodeIds = _.map(nodes, parseUriForIds);

  console.log("relationshipsIds: ", relationshipsIds);
  console.log("nodeIds: ", nodeIds);
};

function getLaneAndNodeIds(pathResponseData) {

  const PathObject = pathResponseData[0];
  const relationshipsIds = _.map(PathObject.relationships, parseUriForIds);
  const nodeIds = _.map(PathObject.nodes, parseUriForIds);

  return {
    lanes: relationshipsIds,
    nodes: nodeIds
  };

  // console.log("relationshipsIds: ", relationshipsIds);
  // console.log("nodeIds: ", nodeIds);
};

function findNodeById(nodeId, cb) {
  db.readNode(nodeId, function(err, node){
    if(err) throw err;

    // console.log("hyperspace lane: ", relationship);

    // Same properties for relationship object as with InsertRelationship
    cb(err, node);
  });
};

function findLaneById(laneId, cb) {
  db.readRelationship(laneId, function(err, relationship){
    if(err) throw err;

    // console.log("hyperspace lane: ", relationship);

    // Same properties for relationship object as with InsertRelationship
    cb(err, relationship);
  });
}

function graphDatabaseQuery(query, cb) {

  db.cypherQuery(query.compile(true), function(cypherError, cypherResult){
    
    if(cypherError) {
      cb(cypherError, null);
    } else {

      // console.log("cypherResult: ", cypherResult);

      const numberOfHyperspacePaths = cypherResult.data.length;
      console.log("Hyperspace Paths: ", numberOfHyperspacePaths);
      let hyperspaceNodesSet = new Set();
      let hyperspaceLanesSet = new Set();
      const hyperspaceRoutes = [];
      const hyperspaceRoutesLength = [];
      const hyperspaceRoutesNodes = [];
      let start = null;
      let end = null;

      _.forEach(cypherResult.data, (value, key) => {

        // console.log("HyperSpace Path: ", value);
        const LaneNodeIds = getLaneAndNodeIds(value);

        // console.log("hyperspace lanes: ", LaneNodeIds.lanes);
        // console.log("hyperspace nodes: ", LaneNodeIds.nodes);

        start = (start)? start : LaneNodeIds.nodes[0];
        end = (end)? end : LaneNodeIds.nodes[ LaneNodeIds.nodes.length - 1 ];

        // console.log("start: ", start);
        // console.log("end: ", end);

        hyperspaceRoutes.push(LaneNodeIds.lanes);
        hyperspaceRoutesNodes.push(LaneNodeIds.nodes);

        let lanesSet = new Set(LaneNodeIds.lanes);
        let nodesSet = new Set(LaneNodeIds.nodes);
        hyperspaceLanesSet = new Set([...hyperspaceLanesSet, ...lanesSet]);
        hyperspaceNodesSet = new Set([...hyperspaceNodesSet, ...nodesSet]);
        // const PathObject = value[0];
        const distance = value[1];
        hyperspaceRoutesLength.push(distance);

        // console.log("\nHyperSpace Path: ", value);
        // console.log("distance: ", distance);

      });

      console.log("total hyperspace lanes set size: ", hyperspaceLanesSet.size);
      console.log("total hyperspace nodes set size: ", hyperspaceNodesSet.size);
      console.log("hyperspace Routes: ", hyperspaceRoutes.length);
      console.log("hyperspace Routes length: ", hyperspaceRoutesLength.length);
      console.log("hyperspace Nodes: ", hyperspaceRoutesNodes.length);

      async.parallel([
        function(callback) {
          async.mapLimit([...hyperspaceLanesSet], 5, findLaneById, function(err, res){
            console.log("async each done!");
            if(err) {
              console.log("Error loading hyperspace lanes: ", err);
              callback(err, null)
            } else {
              // console.log("Hyperspace Lanes found for path: ", res);   
              callback(err, res);
            }
          });
        }, function(callback) {
          async.mapLimit([...hyperspaceNodesSet], 5, findNodeById, function(err, res){
            console.log("async each done!");
            if(err) {
              console.log("Error loading hyperspace nodes: ", err);
              callback(err, null)
            } else {
              // console.log("Hyperspace Nodes found for path: ", res);            
              callback(err, res);
            }
          });
        }
      ], function(error, results) {
        if(error) {
          console.log("Error getting node and lane data: ", error);

        } else {

          const hyperspaceLaneData = results[0];
          const hyperspaceNodeData = results[1];
          const hyperspaceLanesArray = _.map(hyperspaceLaneData, function(Lane) {
            return new HyperSpaceLane(
              Lane.name,
              Lane.hyperspaceHash,
              Lane.start,
              Lane.end,
              Lane.startCoordsLngLat,
              Lane.endCoordsLngLat,
              Lane.length,
              Lane.link,
              Lane._start,
              Lane._end,
              Lane.coordinates,
              Lane._id
            );
          });

          const hyperspaceNodesArray = _.map(hyperspaceNodeData, function(Node) {
            return new HyperSpaceNode(
              Node.system,
              Node.lng,
              Node.lat,
              Node.hyperspaceLanes,
              Node._id
            );
          });

          const StarPathCollection = new HyperSpacePathCollection(
            start,
            end,
            hyperspaceLanesArray,
            hyperspaceNodesArray
          );

          for(let i=0; i < hyperspaceRoutes.length; i++) {

            let routes = hyperspaceRoutes[i];
            let distance = hyperspaceRoutesLength[i];
            let nodes = hyperspaceRoutesNodes[i];
            // console.log("routes: ", routes);
            // console.log('nodes: ', nodes);
            // console.log("distance: ", distance);

            const StarPath = new HyperSpacePath(start, end, distance, routes, nodes, '', routes.length);
            StarPathCollection.paths.push(StarPath);
          }

          // console.log("StarPathCollection.paths: ", StarPathCollection.paths);
          // console.log("hyperspaceLaneData: ", hyperspaceLaneData);
          // console.log("hyperspaceNodeData: ", hyperspaceNodeData);
          // console.log("StarPathCollection: ", StarPathCollection);

          const Path = StarPathCollection.paths[0];

          if(Path) {

            // console.log("Path: ", Path);
            const PathLanes = Path.createArrayOfHyperspaceLanes(StarPathCollection.lanes);
            const PathNodes = Path.createArrayOfHyperspaceNodes(StarPathCollection.nodes);
            // console.log("PathLanes: ", PathLanes.length);
            // console.log("PathNodes: ", PathNodes.length);

            StarPathCollection.linkHyperspacePaths();
            console.log("sending StarPathCollection...");

            cb(error, StarPathCollection);
          } else {
            cb(error, {});
          }
        }
      });
    }
  });
};

function findShortestHyperspacePath(JumpData, cb) {

  const query = cypher()
    .match('(n1:Hyperspace_Node)')
    .where('n1.system = {start}', {start: JumpData.start})
    .match('(n2:Hyperspace_Node)')
    .where('n2.system = {end}', {end: JumpData.end})
    // .match(pathsString(maxJumps))
    // .match('paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: maxJumps})
    .match('paths = allShortestPaths((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: JumpData.maxJumps})
    .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')

    .return('paths, distance')
    .orderBy('distance')
    .limit("1");


  graphDatabaseQuery(query, cb);


  // db.cypherQuery(query.compile(true), function(error, result){

  //     if(error) {

  //       cb(error, null);

  //     } else {

  //       // console.log(result.data[0]); // delivers an array of query results
  //       console.log(result.columns); // delivers an array of names of objects getting returned

  //       // const hyperspacePathResult = JSON.parse(JSON.stringify(result));

  //       // console.log("Hyperspace Path Result: ", JSON.stringify(result));

  //       // console.log("Hyperspace Path Data: ", result.data);
  //       console.log("Hyperspace Path Start: ", result.data[0][0]);
  //       console.log("Hyperspace Path End: ", result.data[0][1]);
  //       console.log("Hyperspace Path Hyperspace Jumps: ", result.data[0][2]);

  //       const numberOfHyperspacePaths = result.data.length;

  //       console.log("Hyperspace Paths: ", numberOfHyperspacePaths);

  //       cb(error, result);

  //     }

  //   });
};

function findManyHyperspacePaths(JumpData, cb) {

  console.log("JumpData: ", JumpData);

  // const query = cypher()
  //   .match('(n1:Hyperspace_Node)')
  //   .where('n1.system = {start}', {start: start})
  //   .match('(n2:Hyperspace_Node)')
  //   .where('n2.system = {end}', {end: end})
  //   // .match(pathsString(maxJumps))
  //   // .match('paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: maxJumps})
  //   .match('paths = allShortestPaths((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: maxJumps})
  //   .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')

  //   .return('paths, distance')
  //   .orderBy('distance')
  //   .limit(limit.toString());


  const query = cypher()
    .match('(n1:Hyperspace_Node)')
    .where('n1.system = {start}', {start: JumpData.start})
    .match('(n2:Hyperspace_Node)')
    .where('n2.system = {end}', {end: JumpData.end})
    // .match(pathsString(maxJumps))
    .match('paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: JumpData.maxJumps})
    // .match('paths = allShortestPaths((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: maxJumps})
    .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')
    .return('paths, distance')
    .orderBy('distance')
    .limit(JumpData.limit.toString());

  const queryString = query.toString();

  // console.log("query: ", query);
  // console.log("queryString: ", queryString);

  // console.log("query.params(): ",   query.params());

  // console.log("query.compile(true): ", query.compile(true));

  graphDatabaseQuery(query, cb);

  // return query;
};

function pathsString(maxJumps, searchType) {

  const startPathString = 'paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..';
  const endPathString = ']-(n2:Hyperspace_Node))';
  const correctPathString = startPathString + maxJumps.toString() + endPathString;

  return correctPathString;
};

function nodeString(nodeValue, nodeName) {

  const nodeNameString = nodeValue + '.system = ' + nodeName;
  return nodeNameString;
};

function buildNeo4jDatabase(cb) {

  MongoController.connectToDatabase(function(errorConnect, resultConnect) {

    // NeoController.buildHyperSpaceNodeGraph();
    // NeoController.buildHyperSpaceLaneGraph();
    // buildHyperSpaceLaneIndex();

    if(errorConnect) {

      console.log("Error connecting to database: ", errorConnect);
      cb(errorConnect, false);

    } else {

      buildHyperSpaceNodeGraph(function(errorBuildNodes) {

        if(errorBuildNodes) {
          console.log("errorBuild: ", errorBuildNodes);
          cb(errorBuildNodes, false);
        } else {
          console.log("Success building hyperspace node database!!!");

          buildHyperSpaceLaneGraph(function(errorBuildLanes) {

            if(errorBuildLanes) {
              console.log("errorBuildLanes: ", errorBuildLanes);
              cb(errorBuildLanes, false);

            } else {
              console.log("Success building hyperspace lanes database!!!");
              createNodeIndex();
              cb(errorBuildLanes, true);

            }

          })
        }
      });
    }
  });
};

function testNeo4jDatabase(cb) {

  findShortestHyperspacePath({start:'Tatooine', end:'Herdessa', maxJumps:5}, (error, result) => {
    if(error) {
      console.log("error: ", error);
      cb(error, {})
    } else {
      console.log("Shortest hyperspace paths results!!: ", result);
      cb(null, result);
    }
  });

  // findManyHyperspacePaths({start:'Tatooine', end:'Herdessa', maxJumps:20, limit: 10}, (error, result) => {
  //   if(error) {
  //     console.log("error: ", error);
  //   } else {
  //     console.log("Many hyperspace paths results success!!: ");
  //   }
  // });


  // findShortestHyperspacePath({start:'Coruscant', end:'Terminus', maxJumps:60}, (error, result) => {
  //   if(error) {
  //     console.log("error: ", error);
  //   } else {
  //     console.log("Shortest hyperspace paths results!!: ", result);
  //   }
  // });

};

function createNodeIndex() {

  db.cypherQuery('CREATE INDEX ON :Hyperspace_Node(system)', function(cypherError, cypherResult){

    if(cypherError) {
      console.log("cypherError: ", cypherError);
    } else {
      console.log("Index created on system property of Hyperspace Nodes!!");
    }

  });

}



const runStatus = process.env.RUN_STATUS;
console.log("Run Status in neo4j controller: ", runStatus);
console.log("Run Status type: ", typeof runStatus);

const NeoController = {
  db: db,
  buildHyperSpaceNodeGraph: buildHyperSpaceNodeGraph,
  buildHyperSpaceLaneGraph: buildHyperSpaceLaneGraph,
  findShortestHyperspacePath: findShortestHyperspacePath,
  findManyHyperspacePaths: findManyHyperspacePaths,
  buildNeo4jDatabase: buildNeo4jDatabase,
  testNeo4jDatabase: testNeo4jDatabase
};


module.exports = NeoController;
