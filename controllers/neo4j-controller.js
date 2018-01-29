const fs = require('fs'),
	_ = require('lodash'),
  asyncMethods = require('async'),

  Promise = require('bluebird'),
  // neo4j = require('neo4j-driver').v1,
  nodeNeo4j = require('node-neo4j'),
  neo4j = require('neo4j'),
  cypher = require('cypher-query'),
  parser = require("neo4j-parser"),
  uuidv1 = require('uuid/v1'),
  uuidv4 = require('uuid/v4'),
  distance = require('euclidean-distance'),
  curl = require('curl'),
  perf = require('execution-time')();


const Planet = require('../data-classes/classes.js').Planet;
const HyperSpaceLane = require('../data-classes/classes.js').HyperSpaceLane;
const HyperSpacePath = require('../data-classes/classes.js').HyperSpacePath;
const HyperSpaceNode = require('../data-classes/classes.js').HyperSpaceNode;
const HyperSpacePathCollection = require('../data-classes/classes.js').HyperSpacePathCollection;
const HyperSpaceResultsStructure = require('../data-classes/classes.js').HyperSpaceResultsStructure;

const DatabaseLinks = require('docker-links').parseLinks(process.env);
const MongoController = require('./mongo-controller.js');

console.log("DatabaseLinks in NeoController: ", DatabaseLinks);

let neo4jHostname = "";
let hyperLanesCount = 0;
let undefinedLanes = [];
const errorArray = [];
const zeroNodesArray = [];

console.log("NODE_ENV: ", process.env.NODE_ENV);
const isDeveloping = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
console.log("Neo Controller isProduction: ", isProduction);

// db = new neo4j('http://username:password@domain:port');
let graphDatabaseHostname = DatabaseLinks.graph.hostname;

if(DatabaseLinks.hasOwnProperty('graph') && isDeveloping) {
  neo4jHostname = DatabaseLinks.graph.hostname;
} else {
  neo4jHostname = '0.0.0.0';
}

console.log("neo4jHostname: ", neo4jHostname);

const neo4jUrl = "http://neo4j:neo4j@" + graphDatabaseHostname + ":7474";
const neo4jAccessUrl = "http://" + graphDatabaseHostname + ":7474";

db = new nodeNeo4j(neo4jUrl);

Promise.promisifyAll(db);

console.log("db: ", db);


dbRaw = new neo4j.GraphDatabase(neo4jUrl);


const dbSeraph = require("seraph")({
  server: neo4jAccessUrl,
  endpoint: "/db/data",
  user: "neo4j",
  pass: "neo4j"
});



console.log("db: ", db);


function insertHyperspaceNodeIntoGraph(hyperspaceNode, cb) {
  db.insertNodeAsync({
    system: hyperspaceNode.system,
    lng: hyperspaceNode.lng,
    lat: hyperspaceNode.lat,
    xGalacticLong: hyperspaceNode.xGalacticLong,
    yGalacticLong: hyperspaceNode.yGalacticLong,
    hyperspaceLanes: hyperspaceNode.hyperspaceLanes
  }).then(nodeDataInserted => {
      console.log("node inserted: ", nodeDataInserted._id);
      if(nodeDataInserted._id === 0) { zeroNodesArray.push(hyperspaceNode.system) }
      db.addLabelsToNodeAsync(nodeDataInserted._id, 'Hyperspace_Node')
        .then(lablesAddedData => {
          db.readLabelsAsync(nodeDataInserted._id).then(dataRead => {
            MongoController.findHyperspaceNodeAndUpdate({system: hyperspaceNode.system}, {nodeId: nodeDataInserted._id})
              .then(nodeData => {
                // console.log("Found and Updated a Hyperspace Node: ", nodeData);
                cb(null, nodeData);
              }).catch(err => {
                console.log("errorNodeUpdate: ", errorNodeUpdate);
                errorArray.push(errorNodeUpdate);
              });
          }).catch(errorRead => {
            console.log('Error reading labels: ', errorRead);
            cb(errorRead, null);
          });
      })
      .catch(lablesAddedError => {
        console.log("Error adding labels: ", lablesAddedError);
        cb(lablesAddedError, null);
      });
    }).catch(nodeDataError => {
      console.log("node insertion error: ", nodeDataError);
      cb(nodeDataError, null);
    });
};


function insertHyperspaceNodePromise(error, result) {
  return Promise.try(function() {
    if (error) {
      // Courtesy of Promise.try() this exception will be turned 
      // into a returned promise that is rejected with the 
      // exception as the reason
      throw new Error(error);
    }
    return result;
  });
};



function insertHyperspaceLaneIntoGraph(hyperspaceLane, cb) {
  console.log("hyperspaceLane: ", hyperspaceLane);

  const NodeFoundStartPromise = MongoController.findOneHyperspaceNodeAsync({
    lng: hyperspaceLane.startCoordsLngLat[0],
    lat: hyperspaceLane.startCoordsLngLat[1]
  });

  const NodeFoundEndPromise = MongoController.findOneHyperspaceNodeAsync({
    lng: hyperspaceLane.endCoordsLngLat[0],
    lat: hyperspaceLane.endCoordsLngLat[1]
  });

  Promise.all([NodeFoundStartPromise, NodeFoundEndPromise])
    .then(function([startNodeData, endNodeData]) {

      const startNode = (startNodeData === null)? {status:false, doc:null} : {status:true, doc:startNodeData};
      const endNode = (endNodeData === null)? {status:false, doc:null} : {status:true, doc:endNodeData};
      // console.log("\nresults: ", results);
      // const startNode = results[0];
      // const endNode = results[1];
      // console.log("start Node: ", startNode);
      // console.log("end Node: ", endNode);
      if(startNode.status && endNode.status) {
        const LaneData = {
          name: hyperspaceLane.name,
          hyperspaceHash: hyperspaceLane.hyperspaceHash,
          start: hyperspaceLane.start,
          end: hyperspaceLane.end,
          length: hyperspaceLane.length,
          link: hyperspaceLane.link,
          endCoordsLngLat: hyperspaceLane.endCoordsLngLat,
          startCoordsLngLat: hyperspaceLane.startCoordsLngLat,
          coordinates: hyperspaceLane.coordinates
        };
        db.insertRelationshipAsync(startNode.doc.nodeId, endNode.doc.nodeId, 'HYPERSPACE_LANE', LaneData)
          .then(relationship => {
          console.log("hyperspace lane added: ", relationship._id);
          if(relationship._id === undefined) {
            undefinedLanes.push({
              StartId: startNode.doc.nodeId,
              EndId: endNode.doc.nodeId,
              LaneData: LaneData,
              Relationship: relationship,
              Error: {message: 'relationship id does not exist'}
            });
            db.insertRelationshipAsync(startNode.doc.nodeId, endNode.doc.nodeId, 'HYPERSPACE_LANE', LaneData).then(relationshipRetry => {
                console.log("relationshipRetry: ", relationshipRetry);
                hyperLanesCount++;
                cb(null, relationshipRetry);
              }).catch(errRetry => {
                cb(errRetry, null);
              });
          } else {
            hyperLanesCount++;
            cb(null, relationship);
          }
        }).catch(err => {
            cb(err, null);
        });
      } else {
        console.log("\nHyperlane not instered. Hyperspace Lane: ", hyperspaceLane);
        (startNode.status)? '' : console.log("Start node: ", startNode);
        (endNode.status)? '' : console.log("End node: ", endNode);
        cb(null, null);
      }

  }).catch(nodesFoundError => {
    console.log("Error Finding Hyperspace Node: ", nodesFoundError);
    cb(nodesFoundError, null);
  });
};

function deleteNodeFromGraph(nodeId) {
  return db.deleteNodeAsync(nodeId);
};

function getFirstThirtyNodesFromGraph() {
  for(let hyperspaceNode = 1; hyperspaceNode < 31; hyperspaceNode++) {
    db.readNode(hyperspaceNode).then(node => {
      console.log(node);
    }).catch(err => {
      console.log("error reading node: ", err);      
    });
  }
};

function getFirstThirtyLanesFromGraph() {
  for(let hyperspaceLane = 1; hyperspaceLane < 31; hyperspaceLane++) {
    db.readRelationshipAsync(hyperspaceLane)
      .then(lane => {
        console.log(lane);
      }).catch(err => {
        console.log("error reading lane: ", err);
      });
  }
};

function buildHyperSpaceNodeGraph(cb) {
  console.log("buildHyperSpaceNodeGraph has fired!");
  MongoController.getAllHyperspaceNodes()
    .then(nodesFound => {
      generateHyperSpaceNodeGraph(nodesFound, cb)
    }).catch(err => {
      console.log("error getting all hyperspace nodes: ", err);
    });
};

function buildHyperSpaceLaneGraph(cb) {
  console.log("buildHyperSpaceLaneGraph has fired!");
  MongoController.getAllHyperspaceLanes()
    .then(laneData => {
      generateHyperSpaceLaneRelationship(laneData, cb);
    }).catch(err => {
      console.log("error getting all hyperspace lanes: ", err);
    });
};

function generateHyperSpaceNodeGraph(hyperSpaceNodes, cb) {
  asyncMethods.eachLimit(hyperSpaceNodes, 5, insertHyperspaceNodeIntoGraph, function(err){
    if(err) {
      console.log("Error loading hyperspace node data: ", err);
      cb(err);
    } else {
      console.log("Hyperspace Node data loaded! Total nodes in graph database: ", hyperSpaceNodes.length);
      cb(null);
    }
  });
};


function generateHyperSpaceNodeGraphAsync(hyperSpaceNodes) {
  return Promise.map(hyperSpaceNodes, node => { 
    return insertHyperspaceNodeIntoGraphAsync(node);
  }, 
    {
      concurrency: 5
    }
  );
};


function generateHyperSpaceLaneRelationship(hyperSpaceLanes, cb) {
  asyncMethods.eachLimit(hyperSpaceLanes, 5, insertHyperspaceLaneIntoGraph, function(err){
    if(err) {
      console.log("Error loading hyperspace lane data: ", err);
      cb(err);
    } else {
      console.log("Hyperspace Lane data loaded! Total lanes in graph database: ", hyperSpaceLanes.length);
      cb(null);
    }
  });
};

// function getHyperSpaceLane(laneId, cb) {
//   db.readRelationship(laneId, function(err, relationship){
//     if(err) throw err;
//     if(err) {
//       cb(err, null)
//     } else {
//       cb(null, relationship);
//     }
//   });
// };

// function getHyperSpaceNode(nodeId, cb) {
//   db.readNode(nodeId, function(err, node){
//     if(err) {
//       cb(err, null);
//     } else {
//       cb(null, node);
//     }
//   });
// };

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
};

function getLaneAndNodeIds(PathObject) {
  const relationshipsIds = _.map(PathObject.relationships, parseUriForIds);
  const nodeIds = _.map(PathObject.nodes, parseUriForIds);
  return {
    lanes: relationshipsIds,
    nodes: nodeIds
  };
};

function findNodeById(nodeId, cb) {
  db.readNode(nodeId, function(err, node){
    if(err) throw err;
    cb(err, node);
  });
};


function findNodeByIdAsync(nodeId) {
  return db.readNodeAsync(nodeId);
};

function findLaneById(laneId, cb) {
  db.readRelationship(laneId, function(err, relationship){
    if(err) throw err;
    cb(err, relationship);
  });
};

function findLaneByIdAsync(laneId) {
  return db.readRelationshipAsync(laneId);
};


function graphDatabaseQuery(query, cb) {

  db.cypherQueryAsync(query.compile(true)).then(cypherResult => {

    const numberOfHyperspacePaths = cypherResult.data.length;
    console.log("Hyperspace Paths: ", numberOfHyperspacePaths);

    let hyperspaceNodesSet = new Set();
    let hyperspaceLanesSet = new Set();
    const hyperspaceRoutes = [];
    const hyperspaceRoutesLength = [];
    const hyperspaceRoutesNodes = [];
    let start = null;
    let end = null;

    console.log("cypher result data length: ", cypherResult.data.length);

    _.forEach(cypherResult.data, (value, key) => {

      const LaneNodeIds = getLaneAndNodeIds(value[0]);
      const distance = value[1];

      start = (start)? start : LaneNodeIds.nodes[0];
      end = (end)? end : LaneNodeIds.nodes[ LaneNodeIds.nodes.length - 1 ];

      const CurrentHyperSpaceResultsStructure = new HyperSpaceResultsStructure(
        start,
        end,
        LaneNodeIds.lanes,
        LaneNodeIds.nodes,
        distance
      );

      console.log("\nLame Sauce");
      console.log("CurrentHyperSpaceResultsStructure: ", CurrentHyperSpaceResultsStructure);
      console.log("Distance: ", CurrentHyperSpaceResultsStructure.distance);
      console.log("Total Jumps: ", CurrentHyperSpaceResultsStructure.totalJumps());

      hyperspaceRoutes.push(CurrentHyperSpaceResultsStructure.lanes);
      hyperspaceRoutesNodes.push(CurrentHyperSpaceResultsStructure.nodes);
      let lanesSet = new Set(CurrentHyperSpaceResultsStructure.lanes);
      let nodesSet = new Set(CurrentHyperSpaceResultsStructure.nodes);
      hyperspaceLanesSet = new Set([...hyperspaceLanesSet, ...lanesSet]);
      hyperspaceNodesSet = new Set([...hyperspaceNodesSet, ...nodesSet]);
      hyperspaceRoutesLength.push(CurrentHyperSpaceResultsStructure.distance);

    });

    generateStarPathCollection({
      start: start,
      end: end,
      hyperspaceLanesSet: hyperspaceLanesSet,
      hyperspaceNodesSet: hyperspaceNodesSet,
      hyperspaceRoutes: hyperspaceRoutes,
      hyperspaceRoutesLength: hyperspaceRoutesLength,
      hyperspaceRoutesNodes: hyperspaceRoutesNodes, 
      cb: cb
    });
  }).catch(cypherError => {
    cb(cypherError, null);
  });
};

function buildFastestStarPath(JumpStructure, cb) {

  let hyperspaceNodesSet = new Set();
  let hyperspaceLanesSet = new Set();
  const hyperspaceRoutes = [];
  const hyperspaceRoutesLength = [];
  const hyperspaceRoutesNodes = [];

  console.log("\nSuper Hot Sauce, New Shit");
  console.log("JumpStructure: ", JumpStructure);
  console.log("Distance: ", JumpStructure.distance);
  console.log("Total Jumps: ", JumpStructure.totalJumps());

  hyperspaceRoutes.push(JumpStructure.lanes);
  hyperspaceRoutesNodes.push(JumpStructure.nodes);
  let lanesSet = new Set(JumpStructure.lanes);
  let nodesSet = new Set(JumpStructure.nodes);
  hyperspaceLanesSet = new Set([...hyperspaceLanesSet, ...lanesSet]);
  hyperspaceNodesSet = new Set([...hyperspaceNodesSet, ...nodesSet]);
  hyperspaceRoutesLength.push(JumpStructure.distance);

  generateStarPathCollection({
    start: JumpStructure.start,
    end: JumpStructure.end,
    hyperspaceLanesSet: hyperspaceLanesSet,
    hyperspaceNodesSet: hyperspaceNodesSet,
    hyperspaceRoutes: hyperspaceRoutes,
    hyperspaceRoutesLength: hyperspaceRoutesLength,
    hyperspaceRoutesNodes: hyperspaceRoutesNodes, 
    cb: cb
  });
};

function generateStarPathCollection(PathCollectionOptions) {
  const start = PathCollectionOptions.start;
  const end = PathCollectionOptions.end;
  const hyperspaceLanesSet = PathCollectionOptions.hyperspaceLanesSet;
  const hyperspaceNodesSet = PathCollectionOptions.hyperspaceNodesSet;
  const hyperspaceRoutes = PathCollectionOptions.hyperspaceRoutes;
  const hyperspaceRoutesLength = PathCollectionOptions.hyperspaceRoutesLength;
  const hyperspaceRoutesNodes = PathCollectionOptions.hyperspaceRoutesNodes;
  const cb = PathCollectionOptions.cb;

  const LanesArrayPromise = Promise.map([...hyperspaceLanesSet], function(laneId) {
    // Promise.map awaits for returned promises as well.
    return findLaneByIdAsync(laneId);
  });

  const NodesArrayPromise = Promise.map([...hyperspaceNodesSet], function(nodeId) {
    // Promise.map awaits for returned promises as well.
    return findNodeByIdAsync(nodeId);
  });

  Promise.all([LanesArrayPromise, NodesArrayPromise]).then(function([lanesArray, nodesArray]) {
    console.log("Lane Array length: ", lanesArray.length);
    console.log("Nodes Array length: ", nodesArray.length);
    const hyperspaceLaneData = lanesArray;
    const hyperspaceNodeData = nodesArray;
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
        Node._id,
        Node.xGalacticLong,
        Node.yGalacticLong
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
      const StarPath = new HyperSpacePath(start, end, distance, routes, nodes, '', routes.length);
      StarPathCollection.paths.push(StarPath);
    }
    const Path = StarPathCollection.paths[0];
    if(Path) {
      const PathLanes = Path.createArrayOfHyperspaceLanes(StarPathCollection.lanes);
      const PathNodes = Path.createArrayOfHyperspaceNodes(StarPathCollection.nodes);
      StarPathCollection.linkHyperspacePaths();
      cb(null, StarPathCollection);
    } else {
      cb(null, {});
    }
  }).catch(nodeAndLanesError => {
    console.log("Error finding nodes and lanes: ", nodeAndLanesError);
    cb(nodeAndLanesError, {});
  });
};

function executeDijkstraSearchFastest(JumpData, cb) {

  const PostData = {
    "to" : neo4jAccessUrl + '/db/data/node/' + JumpData.endNodeId,
    "cost_property" : "length",
    "relationships" : {
      "type" : "HYPERSPACE_LANE"
    },
    "algorithm" : "dijkstra"
  };
  const pathUrl = neo4jAccessUrl + '/db/data/node/'  + JumpData.startNodeId + '/path';

  curl.postJSON(pathUrl, PostData, {}, function(err, response, data){
    console.log("dijkstra error: ", err);
    const SearchData = JSON.parse(data);
    const lanes = _.map(SearchData.relationships, parseUriForIds);
    const nodes = _.map(SearchData.nodes, parseUriForIds);
    const start = parseUriForIds(SearchData.start);
    const end = parseUriForIds(SearchData.end);

    const CurrentHyperSpaceResultsStructure = new HyperSpaceResultsStructure(
      start,
      end,
      lanes,
      nodes,
      SearchData.weight
    );

    // console.log("\nThe New Hotness");
    // console.log("CurrentHyperSpaceResultsStructure: ", CurrentHyperSpaceResultsStructure);
    // console.log("Distance: ", CurrentHyperSpaceResultsStructure.distance);
    // console.log("Total Jumps: ", CurrentHyperSpaceResultsStructure.totalJumps());


    buildFastestStarPath(CurrentHyperSpaceResultsStructure, cb);

  });
};

function executeDijkstraSearchMany(JumpData, cb) {

  const PostData = {
    "to" : neo4jAccessUrl + '/db/data/node/' + JumpData.endNodeId,
    "cost_property" : "length",
    "relationships" : {
      "type" : "HYPERSPACE_LANE"
    },
    "algorithm" : "dijkstra"
  };


  const pathUrl = neo4jAccessUrl + '/db/data/node/'  + JumpData.startNodeId + '/paths';


  // curl.get(neo4jAccessUrl + '/db/data/node/' + JumpData.startNodeId, {}, function(err, response, body) {
  //   console.log("body: ", body);
  // });

  curl.postJSON(pathUrl, PostData, {}, function(err, response, data){
    console.log("dijkstra error: ", err);
    // console.log("dijkstra results: ", JSON.parse(data));

    const SearchData = JSON.parse(data);

    console.log("dijkstra results keys: ", SearchData);

    // const lanes = _.map(SearchData.relationships, parseUriForIds);
    // const nodes = _.map(SearchData.nodes, parseUriForIds);
    // const start = parseUriForIds(SearchData.start);
    // const end = parseUriForIds(SearchData.end);

    // const CurrentHyperSpaceResultsStructure = new HyperSpaceResultsStructure(
    //   start,
    //   end,
    //   lanes,
    //   nodes,
    //   SearchData.weight
    // );

    // console.log("\nThe New Hotness, Many Paths");
    // console.log("CurrentHyperSpaceResultsStructure: ", CurrentHyperSpaceResultsStructure);
    // console.log("Distance: ", CurrentHyperSpaceResultsStructure.distance);
    // console.log("Total Jumps: ", CurrentHyperSpaceResultsStructure.totalJumps());

  });
};

function findShortestHyperspacePath(JumpData, cb) {
  const dijkstraActive = true;
  const MaxNavigationJumps = 120;
  const jumpDataMax = JumpData.maxJumps;

  console.log("JumpData: ", JumpData);

  if(dijkstraActive) {

    executeDijkstraSearchFastest(JumpData, function(error, results) {
      cb(error, results);
    });
 
  } else {

    const query = cypher()
      .match('(n1:Hyperspace_Node)')
      .where('n1.system = {start}', {start: JumpData.start})
      .match('(n2:Hyperspace_Node)')
      .where('n2.system = {end}', {end: JumpData.end})
      // .match(pathsString(maxJumps))
      // .match('paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: maxJumps})
      .match('paths = shortestPath((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: MaxNavigationJumps})
      // .match('paths = allShortestPaths((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: MaxNavigationJumps})

      .where('NONE (n IN nodes(paths) WHERE size(filter(x IN nodes(paths) WHERE n = x))> 1)')

      .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')

      .return('paths, distance')
      .orderBy('distance')
      .limit("1");

    graphDatabaseQuery(query, cb);

  }
};

function findManyHyperspacePaths(JumpData, cb) {
  const dijkstraActive = false;
  console.log("JumpData: ", JumpData);

  if(dijkstraActive) {

    executeDijkstraSearchMany(JumpData, function(error, results) {
      // console.log('dijkstra results: ', results);
    });

  } else {

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
      // .match('paths = allShortestPaths((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: JumpData.maxJumps})

      // .where('NONE (n IN nodes(paths) WHERE size(filter(x IN nodes(paths) WHERE n = x))> 1)')

      .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')
      .return('paths, distance')
      .orderBy('distance')
      .limit(JumpData.limit.toString());

    const queryString = query.toString();

    graphDatabaseQuery(query, cb);

  }
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

              createNodeIndex().then(nodeIndexResult => {
                console.log("Index created on system property of Hyperspace Nodes!!");

                findNodeById(0, function(zeroSearchError,  zeroSearchResult) {
                  console.log("zeroSearchResult: ", zeroSearchResult);
                  console.log("errorArray: ", errorArray);
                  console.log("zeroNodesArray: ", zeroNodesArray);
                  console.log("undefined lanes: ", undefinedLanes);
                  cb(errorBuildLanes, true);
                });

              }).catch(nodeIndexError => {
                console.log("Error creating Index created on Hyperspace Nodes!!");
              });
            }
          })
        }
      });
    }
  });
};

function testNeo4jDatabase(cb) {


  findShortestHyperspacePath({start:'Tatooine', end:'Herdessa', maxJumps:1}, (error, result) => {
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
};

function createNodeIndex() {
  return db.cypherQueryAsync('CREATE INDEX ON :Hyperspace_Node(system)');
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
