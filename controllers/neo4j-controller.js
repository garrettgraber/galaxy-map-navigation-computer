const fs = require('fs'),
	_ = require('lodash'),
  Promise = require('bluebird'),
  // neo4j = require('neo4j-driver').v1,
  nodeNeo4j = require('node-neo4j'),
  http = require('request-promise-json'),
  neo4j = require('neo4j'),
  cypher = require('cypher-query'),
  parser = require("neo4j-parser"),
  uuidv1 = require('uuid/v1'),
  uuidv4 = require('uuid/v4'),
  distance = require('euclidean-distance'),
  curl = require('curl'),
  Geohash = require('latlon-geohash'),
  perf = require('execution-time')();


const Planet = require('../data-classes/planet.js');
const HyperSpaceLane = require('../data-classes/hyperspace-lane.js');
const HyperSpacePath = require('../data-classes/hyperspace-path.js');
// const HyperSpaceNode = require('../data-classes/hyperspace-node.js');
const HyperSpacePathCollection = require('../data-classes/hyperspace-path-collection.js');
const HyperSpaceResultsStructure = require('../data-classes/hyperspace-results-structure.js');
const generateStarPathCollection = require('../factories/generate-star-path-collection.js');
const DatabaseLinks = require('docker-links').parseLinks(process.env);
const MongoController = require('./mongo-controller.js');

const geoHashPrecision = 22;
let neo4jHostname = "";
let hyperLanesCount = 0;
let undefinedLanes = [];
const errorArray = [];
const zeroNodesArray = [];
const nodesUploadedArray = [];
const nodesNotUploadedArray = [];

console.log("NODE_ENV: ", process.env.NODE_ENV);
const isDeveloping = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
let graphDatabaseHostname = DatabaseLinks.graph.hostname;

if(DatabaseLinks.hasOwnProperty('graph') && isDeveloping) {
  neo4jHostname = DatabaseLinks.graph.hostname;
} else {
  neo4jHostname = '0.0.0.0';
}

const neo4jUrl = "http://neo4j:neo4j@" + graphDatabaseHostname + ":7474";
const neo4jAccessUrl = "http://" + graphDatabaseHostname + ":7474";

db = new nodeNeo4j(neo4jUrl);
Promise.promisifyAll(db);



async function insertHyperspaceNodeIntoGraphAsync(hyperspaceNode) {
  try {
    // console.log("Inserting hyperspace node zoom: ", hyperspaceNode.zoom);
    const nodeDataGeoHash = Geohash.encode(hyperspaceNode.lat, hyperspaceNode.lng, geoHashPrecision);
    const nodeDataInserted = await db.insertNodeAsync({
      system: hyperspaceNode.system,
      lng: hyperspaceNode.lng,
      lat: hyperspaceNode.lat,
      xGalacticLong: hyperspaceNode.xGalacticLong,
      yGalacticLong: hyperspaceNode.yGalacticLong,
      hyperspaceLanes: hyperspaceNode.hyperspaceLanes,
      geoHash: nodeDataGeoHash,
      zoom: hyperspaceNode.zoom,
      emptySpace: hyperspaceNode.emptySpace
    });

    const nodeDataId = nodeDataInserted._id;
    console.log("node inserted: ", nodeDataId);

    if(Number.isInteger(nodeDataId)) {
      nodesUploadedArray.push(nodeDataId);
    } else {
      nodesNotUploadedArray.push(nodeDataId);
    }

    if(nodeDataId === 0) { zeroNodesArray.push(hyperspaceNode.system) }
    const lablesAddedData = await db.addLabelsToNodeAsync(nodeDataId, 'Hyperspace_Node');
    return await MongoController.findHyperspaceNodeAndUpdate({
      geoHash: nodeDataGeoHash
    }, {
      nodeId: nodeDataId
    });
  } catch(err) {
    console.log("error inserting hyperspace node: ", err);
    throw new Error(err);
  }
};

async function insertHyperspaceLaneIntoGraphAsync(hyperspaceLane) {
  try {
    // console.log("hyperspaceLane: ", hyperspaceLane);
    const startNodeData = await MongoController.findOneHyperspaceNodeAsync({
      lng: hyperspaceLane.startCoordsLngLat[0],
      lat: hyperspaceLane.startCoordsLngLat[1]
    });
    const endNodeData = await MongoController.findOneHyperspaceNodeAsync({
      lng: hyperspaceLane.endCoordsLngLat[0],
      lat: hyperspaceLane.endCoordsLngLat[1]
    });
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
      const relationship = await db.insertRelationshipAsync(startNode.doc.nodeId, endNode.doc.nodeId, 'HYPERSPACE_LANE', LaneData);
      console.log("hyperspace lane added: ", relationship._id);

      if(relationship._id === undefined) {
        undefinedLanes.push({
          StartId: startNode.doc.nodeId,
          EndId: endNode.doc.nodeId,
          LaneData: LaneData,
          Relationship: relationship,
          Error: {message: 'relationship id does not exist'}
        });
        const relationshipRetry = await db.insertRelationshipAsync(startNode.doc.nodeId, endNode.doc.nodeId, 'HYPERSPACE_LANE', LaneData);
        console.log("relationshipRetry: ", relationshipRetry);
        hyperLanesCount++;
        return relationshipRetry;
      } else {
        hyperLanesCount++;
        return relationship;
      }
      
    } else {
      console.log("\nHyperlane not instered. Hyperspace Lane: ", hyperspaceLane);
      (startNode.status)? '' : console.log("Start node: ", startNode);
      (endNode.status)? '' : console.log("End node: ", endNode);
      return null;
    }

  } catch(err) {
    console.log("error inserting hyperspace lane: ", err);
    throw new Error(error);
  }
};

async function buildHyperSpaceNodeGraph() {
  try {
    console.log("buildHyperSpaceNodeGraph has fired!");
    const nodesFound = await MongoController.getAllHyperspaceNodes();
    const nodeGraphResults = await generateHyperSpaceNodeGraphAsync(nodesFound);
    return null;
  } catch(err) {
    console.log("error building hyperspace node graph: ", err);
  }
};

async function buildHyperSpaceLaneGraph() {
  try {
    console.log("buildHyperSpaceLaneGraph has fired!");
    const laneData = await MongoController.getAllHyperspaceLanes();
    const laneGraphResults = await generateHyperSpaceLaneRelationshipAsync(laneData);
    return null;
  } catch(err) {
    console.log("error building hyperspace lane graph: ", err);
  }
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

function generateHyperSpaceNodeGraphAsync(hyperSpaceNodes) {
  return Promise.map(hyperSpaceNodes, node => { 
    return insertHyperspaceNodeIntoGraphAsync(node);
  }, 
    {
      concurrency: 1
    }
  );
};

function generateHyperSpaceLaneRelationshipAsync(hyperSpaceLanes) {
  return Promise.map(hyperSpaceLanes, lane => { 
    return insertHyperspaceLaneIntoGraphAsync(lane);
  }, 
    {
      concurrency: 1
    }
  );
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
};

function getLaneAndNodeIds(PathObject) {
  const relationshipsIds = _.map(PathObject.relationships, parseUriForIds);
  const nodeIds = _.map(PathObject.nodes, parseUriForIds);
  return {
    lanes: relationshipsIds,
    nodes: nodeIds
  };
};

function findNodeByIdAsync(nodeId) {
  return db.readNodeAsync(nodeId);
};

function findLaneByIdAsync(laneId) {
  return db.readRelationshipAsync(laneId);
};


async function graphDatabaseQueryAsync(query) {
  try {
    const cypherResult = await db.cypherQueryAsync(query.compile(true));
    const numberOfHyperspacePaths = cypherResult.data.length;
    console.log("Hyperspace Paths: ", numberOfHyperspacePaths);

    return await generateStarPathCollection(formatHypespaceResultsData(cypherResult), db);
   } catch(err) {
    console.log("error graph database query: ", err);
    throw new Error(400);
  }
};

function formatHypespaceResultsData(cypherResult) {
  let hyperspaceNodesSet = new Set();
  let hyperspaceLanesSet = new Set();
  const hyperspaceRoutes = [];
  const hyperspaceRoutesLength = [];
  const hyperspaceRoutesNodes = [];
  let start = null;
  let end = null;

  console.log("cypher result data length: ", cypherResult.data);

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

  return {
    start: start,
    end: end,
    hyperspaceLanesSet: hyperspaceLanesSet,
    hyperspaceNodesSet: hyperspaceNodesSet,
    hyperspaceRoutes: hyperspaceRoutes,
    hyperspaceRoutesLength: hyperspaceRoutesLength,
    hyperspaceRoutesNodes: hyperspaceRoutesNodes
  };
};

async function findShortestHyperspacePath(JumpData) {
  try {
    // const CoruscantNode = await pointConnectedToCoruscant({});

    console.time('Shortest Jump Time');
    const MaxNavigationJumps = 120;
    JumpData.maxJumps = MaxNavigationJumps;

    console.log("JumpData: ", JumpData);
    const pathUrlEnd = '/path';
    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + JumpData.endNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + JumpData.startNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
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

    CurrentHyperSpaceResultsStructure.hyperspaceSingleJump();
    const StarPathCreated = await CurrentHyperSpaceResultsStructure.generateStarPathCollection(db);
    console.timeEnd('Shortest Jump Time');
    return StarPathCreated;
  } catch(err) {
    console.log("error finding Shortest hyperspace path: ", err);
    throw new Error(400);
  }
};


async function pointConnectedToCoruscant(Point) {
  try {
    console.log("\nChecking Coruscant connection..", Point);
    const JumpData = {
      maxJumps: 120,
      limit: 1,
      start: Point.nodeSystem,
      end: 'Coruscant',
      startPoint: Point.system,
      endPoint: 'Coruscant',
      startNodeId: Point.nodeId,
      endNodeId: 85,
      shortest: true
    };
    const pathUrlEnd = '/path';
    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + JumpData.endNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + JumpData.startNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    const connectedToCoruscant = !_.isEmpty(SearchData)
    console.log("Coruscant connection: ", connectedToCoruscant);
    return connectedToCoruscant;
  } catch(err) {
    console.log("Not connected to Coruscant");
    return false;
  }
};


async function pointConnectedToCsilla(Point) {
  try {
    console.log("\nChecking Csilla connection..", Point);
    const JumpData = {
      maxJumps: 120,
      limit: 1,
      start: Point.nodeSystem,
      end: 'Csilla',
      startPoint: Point.system,
      endPoint: 'Csilla',
      startNodeId: Point.nodeId,
      endNodeId: 826,
      shortest: true
    };
    const pathUrlEnd = '/path';
    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + JumpData.endNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + JumpData.startNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    const connectedToCsilla = !_.isEmpty(SearchData)
    console.log("Csilla connection: ", connectedToCsilla);
    return connectedToCsilla;
  } catch(err) {
    console.log("Not connected to Csilla");
    return false;
  }
};

async function findManyHyperspacePaths(JumpData) {
  try {
    console.log("JumpData: ", JumpData);

    const query = cypher()
      .match('(n1:Hyperspace_Node)')
      .where('n1.system = {start}', {start: JumpData.start})
      .match('(n2:Hyperspace_Node)')
      .where('n2.system = {end}', {end: JumpData.end})
      .match('paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..{maxJumps}]-(n2:Hyperspace_Node))', {maxJumps: JumpData.maxJumps})
      .with('REDUCE(distance = 0, rel in relationships(paths) | distance + rel.length) AS distance, paths')
      .return('paths, distance')
      .orderBy('distance')
      .limit(JumpData.limit.toString());

    return await graphDatabaseQueryAsync(query);
  } catch(err) {
    console.log("error finding Many hyperspace paths: ", err);
    throw new Error(400);
  }
};

async function buildNeo4jDatabaseAsync() {
  try {
    console.time('Build Hyperspace Graph Database');
    await MongoController.connectToMongo();
    const errorBuildNodes = await buildHyperSpaceNodeGraph();

    if(errorBuildNodes) {
      throw new Error(errorBuildNodes);
    } else {
      console.log("Success building hyperspace node database!!!");
      const errorBuildLanes = await buildHyperSpaceLaneGraph();

      if(errorBuildLanes) {
        throw new Error(errorBuildLanes);
      } else {
        console.log("Success building hyperspace lanes database!!!");

        const nodeIndexResult = await createNodeIndex();
        console.log("Index created on system property of Hyperspace Nodes!!");

        const totalUndefinedLanes = undefinedLanes.length;
        const lastTenUndefinedLanes = undefinedLanes.slice(totalUndefinedLanes - 10, totalUndefinedLanes);

        const zeroSearchResult = await findNodeByIdAsync(0);
        console.log("zeroSearchResult: ", zeroSearchResult);
        console.log("errorArray: ", errorArray);
        console.log("zeroNodesArray: ", zeroNodesArray);
        console.log("totalUndefinedLanes: ", totalUndefinedLanes);
        console.log("nodesUploadedArray: ", nodesUploadedArray.length);
        console.log("nodesNotUploadedArray: ", nodesNotUploadedArray.length);
        console.log("undefined lanes: ", lastTenUndefinedLanes);
        console.timeEnd('Build Hyperspace Graph Database');

        return true;
      }
    }
  } catch(error) {
    console.log("Error building neo4j database: ", error);
    throw new Error(error);
  }
};

async function testNeo4jDatabase() {
  try {
    const result = await findShortestHyperspacePath({start:'Tatooine', end:'Herdessa', maxJumps:1});
    console.log("Shortest hyperspace paths results!!: ", result);
    return result;    
  } catch(err) {
    console.log("error testing neo4j database: ", err);
    throw new Error(err);
  }
};

function createNodeIndex() {
  return db.cypherQueryAsync('CREATE INDEX ON :Hyperspace_Node(system)');
};

function pathsString(maxJumps, searchType) {
  const startPathString = 'paths = ((n1:Hyperspace_Node)-[:HYPERSPACE_LANE*..';
  const endPathString = ']-(n2:Hyperspace_Node))';
  return startPathString + maxJumps.toString() + endPathString;
};

function nodeString(nodeValue, nodeName) {
  return nodeValue + '.system = ' + nodeName;
};

const runStatus = process.env.RUN_STATUS;
console.log("Run Status in neo4j controller: ", runStatus);

const NeoController = {
  db: db,
  buildHyperSpaceNodeGraph: buildHyperSpaceNodeGraph,
  buildHyperSpaceLaneGraph: buildHyperSpaceLaneGraph,
  findShortestHyperspacePath: findShortestHyperspacePath,
  findManyHyperspacePaths: findManyHyperspacePaths,
  buildNeo4jDatabaseAsync: buildNeo4jDatabaseAsync,
  testNeo4jDatabase: testNeo4jDatabase,
  pointConnectedToCoruscant: pointConnectedToCoruscant,
  pointConnectedToCsilla: pointConnectedToCsilla
};


module.exports = NeoController;
