const fs = require('fs'),
	_ = require('lodash'),
  Promise = require('bluebird'),
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
const HyperSpacePathCollection = require('../data-classes/hyperspace-path-collection.js');
const HyperSpaceResultsStructure = require('../data-classes/hyperspace-results-structure.js');
const generateStarPathCollection = require('../factories/generate-star-path-collection.js');
const HyperSpacePseudoNode = require('../data-classes/hyperspace-pseudo-node.js');
const HyperSpacePseudoLane = require('../data-classes/hyperspace-pseudo-lane.js');

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
    const nodeDataGeoHash = Geohash.encode(hyperspaceNode.lat, hyperspaceNode.lng, geoHashPrecision);
    const nodeDataInserted = await db.insertNodeAsync({
      system: hyperspaceNode.system,
      lng: hyperspaceNode.lng,
      lat: hyperspaceNode.lat,
      xGalacticLong: hyperspaceNode.xGalacticLong,
      yGalacticLong: hyperspaceNode.yGalacticLong,
      xGalactic: hyperspaceNode.xGalactic,
      yGalactic: hyperspaceNode.yGalactic,
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
    if(hyperspaceNode.nodeId === nodeDataId) {
      return true;
    } else {
      console.log("Node mis-match: ", hyperspaceNode.system);
      return false;
    }
  } catch(err) {
    console.log("error inserting hyperspace node: ", err);
    throw new Error(err);
  }
};

async function insertHyperspaceLaneIntoGraphAsync(hyperspaceLane) {
  try {
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

        const LaneIdUpdated = await MongoController.findHyperspaceLaneAndUpdate({
          hyperspaceHash: hyperspaceLane.hyperspaceHash
        }, {
          laneId: relationshipRetry._id
        });

        hyperLanesCount++;
        return relationshipRetry;
      } else {

        const LaneIdUpdated = await MongoController.findHyperspaceLaneAndUpdate({
          hyperspaceHash: hyperspaceLane.hyperspaceHash
        }, {
          laneId: relationship._id
        });

        console.log("hyperspace lane added: ", LaneIdUpdated.laneId);

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
    const nodesSorted = _.orderBy(nodesFound, ['system'], ['asc']);
    const nodeGraphResults = await generateHyperSpaceNodeGraphAsync(nodesSorted);
    let nodeGraphResultsSimplified = _.uniq(nodeGraphResults);

    if(nodeGraphResultsSimplified.indexOf(false) > -1) {
      console.log("Node Id Integrity failure");
      return false;
    } else {
      console.log("Node Id Integrity Success");
      return true;
    }

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

    const startIsPseudoNode = (isNaN(JumpData.startNodeId))? true : false;
    const endIsPseudoNode = (isNaN(JumpData.endNodeId))? true : false;

    const exteriorStartNodeId = await getExteriorJumpNodeIds(JumpData.startNodeId, JumpData.endNodeId);
    const exteriorEndNodeId = await getExteriorJumpNodeIds(JumpData.endNodeId, exteriorStartNodeId);

    const interiorStartNodeId = await getInteriorJumpNodeIds(JumpData.startNodeId, JumpData.endNodeId);
    const interiorEndNodeId = await getInteriorJumpNodeIds(JumpData.endNodeId, interiorStartNodeId);

    console.time('Shortest Jump Time');
    const MaxNavigationJumps = 120;
    JumpData.maxJumps = MaxNavigationJumps;
    console.log("JumpData: ", JumpData);
    console.log("Start Node: ", JumpData.startNodeId);
    console.log("End Node: ", JumpData.endNodeId);
    console.log("Exterior Start Node: ", exteriorStartNodeId);
    console.log("Exterior End Node: ", exteriorEndNodeId);
    console.log("Interior Start Node: ", interiorStartNodeId);
    console.log("Interior End Node: ", interiorEndNodeId);
    const pathUrlEnd = '/path';


    // const PostData = {
    //   "to" : neo4jAccessUrl + '/db/data/node/' + exteriorEndNodeId,
    //   "cost_property" : "length",
    //   "relationships" : {
    //     "type" : "HYPERSPACE_LANE"
    //   },
    //   "algorithm" : "dijkstra"
    // };
    // const pathUrl = neo4jAccessUrl + '/db/data/node/'  + exteriorStartNodeId + pathUrlEnd;
    // const SearchData = await http.post(pathUrl, PostData);
    // const lanes = _.map(SearchData.relationships, parseUriForIds);
    // const nodes = _.map(SearchData.nodes, parseUriForIds);
    // let start = parseUriForIds(SearchData.start);
    // let end = parseUriForIds(SearchData.end);
    // let jumpDistance = SearchData.weight;



    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + interiorEndNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + interiorStartNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    const lanes = _.map(SearchData.relationships, parseUriForIds);
    const nodes = _.map(SearchData.nodes, parseUriForIds);
    let start = parseUriForIds(SearchData.start);
    let end = parseUriForIds(SearchData.end);
    let jumpDistance = SearchData.weight;


    console.log("SearchData: ", SearchData);



    // const SearchDataResult = (interiorStartNodeId !== interiorEndNodeId)? await getShortesPath({
    //   exteriorEndNodeId: exteriorEndNodeId,
    //   exteriorStartNodeId: exteriorStartNodeId
    // }) : {
    //   lanes: [],
    //   nodes: [],
    //   start: null,
    //   end: null,
    //   jumpDistance: 0
    // };


    // const PostJumpDistanceData = {
    //   "to" : neo4jAccessUrl + '/db/data/node/' + interiorStartNodeId,
    //   "cost_property" : "length",
    //   "relationships" : {
    //     "type" : "HYPERSPACE_LANE"
    //   },
    //   "algorithm" : "dijkstra"
    // };

    // const pathJumpDistanceUrl = neo4jAccessUrl + '/db/data/node/'  + interiorEndNodeId + pathUrlEnd;
    // const InteriorJumpData = await http.post(pathJumpDistanceUrl, PostJumpDistanceData);

    // let jumpDistance = InteriorJumpData.weight;


    const PseudoStartData =  (startIsPseudoNode)? await getStartPseudoNodeAndLocation(JumpData.startNodeId, interiorStartNodeId, exteriorStartNodeId) : {PseudoNode: {}, PseudoLane: {}, laneAdditionValue: 0.0};

    if(startIsPseudoNode) {
      jumpDistance += PseudoStartData.laneAdditionValue;
      start = PseudoStartData.PseudoNode.nodeId;



      // nodes.unshift(PseudoStartData.PseudoNode.nodeId);
      // lanes.unshift(PseudoStartData.PseudoLane._id);
      // lanes.shift();
      // nodes.shift();
    }


    // console.log("PseudoStartData: ", PseudoStartData);

    const PseudoEndData =  (endIsPseudoNode)? await getEndPseudoNodeAndLocation(JumpData.endNodeId, interiorEndNodeId, exteriorEndNodeId) : {PseudoNode: {}, PseudoLane: {}};


    if(endIsPseudoNode) {

      const pseudoLaneLength = PseudoEndData.PseudoLane.length;

      jumpDistance += PseudoEndData.laneAdditionValue;
      end = PseudoEndData.PseudoNode.nodeId;

      // lanes.pop();
      // nodes.pop();


      // nodes.push(PseudoEndData.PseudoNode.nodeId);
      // lanes.push(PseudoEndData.PseudoLane._id);
    }

    // console.log("PseudoEndData: ", PseudoEndData);

    console.log("start: ", start);
    console.log("end: ", end);
    console.log("lanes: ", lanes);
    console.log("nodes: ", nodes);


    const CurrentHyperSpaceResultsStructure = new HyperSpaceResultsStructure({
      start : start,
      end : end,
      lanes : lanes,
      nodes : nodes,
      distance : jumpDistance,
      StartPseudoNode : PseudoStartData.PseudoNode,
      StartPseudoLane : PseudoStartData.PseudoLane,
      EndPseudoNode : PseudoEndData.PseudoNode,
      EndPseudoLane : PseudoEndData.PseudoLane
    });

    CurrentHyperSpaceResultsStructure.hyperspaceSingleJump();
    const StarPathCreated = await CurrentHyperSpaceResultsStructure.generateStarPathCollection(db);

    
    // console.log("StarPathCreated: ", StarPathCreated);


    // console.log("StarPathCreated: ", Object.keys(StarPathCreated));

    console.timeEnd('Shortest Jump Time');
    return StarPathCreated;
  } catch(err) {
    console.log("error finding Shortest hyperspace path: ", err);
    throw new Error(400);
  }
};

async function plotInteriorJump(startNodeId, endNodeId) {
  try {

    if(startNodeId === endNodeId) {
      return {
        lanes: [],
        nodes: [startNodeId],
        start: '',
        end: '',
        jumpDistance: 0.0
      };
    }

    const pathUrlEnd = '/path';


    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + endNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + startNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    const lanes = _.map(SearchData.relationships, parseUriForIds);
    const nodes = _.map(SearchData.nodes, parseUriForIds);
    let start = parseUriForIds(SearchData.start);
    let end = parseUriForIds(SearchData.end);
    let jumpDistance = SearchData.weight;


    console.log("SearchData: ", SearchData);
    return {
      lanes: lanes,
      nodes: nodes,
      start: start,
      end: end,
      jumpDistance: jumpDistance
    };

  } catch(err) {

  }
};

async function getShortesPath(Options) {
  try {

    const exteriorEndNodeId = Options.exteriorEndNodeId;
    const exteriorStartNodeId = Options.exteriorStartNodeId;


    const pathUrlEnd = '/path';
    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + exteriorEndNodeId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };

    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + exteriorStartNodeId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    const lanes = _.map(SearchData.relationships, parseUriForIds);
    const nodes = _.map(SearchData.nodes, parseUriForIds);
    const start = parseUriForIds(SearchData.start);
    const end = parseUriForIds(SearchData.end);

    return {
      lanes: lanes,
      nodes: nodes,
      start: start,
      end: end,
      jumpDistance: SearchData.weight
    };
  } catch(err) {
    console.log("Error getting Shortest Path: ", err);
  }
};

async function getStartPseudoNodeAndLocation(startPseudoNodeId, interiorNodeId, exteriorNodeId){
  try {

    // console.log("startPseudoNodeId: ",  startPseudoNodeId);


    const nodeLocationHash = startPseudoNodeId.split('-')[3];
    const pseudoNodeHyperspaceLaneId = startPseudoNodeId.split('-')[5];

    const PseudoNodeLocation = Geohash.decode(nodeLocationHash);

    // console.log("Start PseudoNodeLocation: ", PseudoNodeLocation);

    const StartLaneFound = await findLaneByIdAsync(pseudoNodeHyperspaceLaneId);

    console.log("Start Lane Found: ", StartLaneFound);

    const PseudoStartNode = new HyperSpacePseudoNode({
      lng: PseudoNodeLocation.lon,
      lat: PseudoNodeLocation.lat,
      hyperspaceLanes: StartLaneFound.name,
      system : startPseudoNodeId,
    });

    console.log("PseudoStartNode: ", PseudoStartNode);

    const PseudoStartLane = new HyperSpacePseudoLane({
      OriginalLane: StartLaneFound,
      PseudoNode: PseudoStartNode,
      interiorNodeId: interiorNodeId,
      exteriorNodeId: exteriorNodeId,
      isStartLane: true,
      isEndLane: false
    });

    console.log("PseudoStartLane: ", PseudoStartLane);

    const laneStartLocation = PseudoStartLane.startCoordsLngLat;
    const laneStartGeoHash = PseudoStartLane.start.split('-')[3];
    const LaneStartLatLng = Geohash.decode(laneStartGeoHash);

    const laneStartLngMatchesNode = (laneStartLocation[0] === PseudoNodeLocation.lon)? true : false;
    const laneStartLatMatchesNode = (laneStartLocation[1] === PseudoNodeLocation.lat)? true : false;
    const laneLocationMatchesNode = (laneStartLngMatchesNode && laneStartLatMatchesNode)? true : false;

    const laneStartLngHashMatchesNode = (PseudoNodeLocation.lon === LaneStartLatLng.lon)? true : false;
    const laneStartLatHashMatchesNode = (PseudoNodeLocation.lat === LaneStartLatLng.lat)? true : false;
    const laneHashMatchesNode = (laneStartLngHashMatchesNode && laneStartLatHashMatchesNode)? true : false;

    if(laneLocationMatchesNode && laneHashMatchesNode){


      console.log("\nPseudo Lane Start Matches Pseudo Node Location and Lane Hash: ", PseudoNodeLocation);
      console.log("\n");
    } else {
      console.log("Pseudo Lane Start: ", laneStartLocation);
      console.log("Does not match Pseudo Node Location: ", LaneStartLatLng);
      console.log("PseudoNodeLocation: ", PseudoNodeLocation);
    }

    const laneSubtractionValue = StartLaneFound.length - PseudoStartLane.length;

    return {
      PseudoNode: PseudoStartNode,
      PseudoLane: PseudoStartLane,
      laneAdditionValue: PseudoStartLane.length
    };



  } catch(err) {

    console.log("Error getting Pseudo Node Location and Hyperspace Lane: ", err);
  }

};


async function getEndPseudoNodeAndLocation(endPseudoNodeId, interiorNodeId, exteriorNodeId){
  try {

    // console.log("endPseudoNodeId: ", endPseudoNodeId);
    const nodeLocationHash = endPseudoNodeId.split('-')[3];
    const pseudoNodeHyperspaceLaneId = endPseudoNodeId.split('-')[5];


    const PseudoNodeLocation = Geohash.decode(nodeLocationHash);

    // console.log("End PseudoNodeLocation: ", PseudoNodeLocation);


    const EndLaneFound = await findLaneByIdAsync(pseudoNodeHyperspaceLaneId);

    console.log("End Lane Found: ", EndLaneFound);


    const PseudoEndNode = new HyperSpacePseudoNode({
      lng: PseudoNodeLocation.lon,
      lat: PseudoNodeLocation.lat,
      hyperspaceLanes: EndLaneFound.name,
      system : endPseudoNodeId,
    });

    console.log("PseudoEndNode: ", PseudoEndNode);


    const PseudoEndLane = new HyperSpacePseudoLane({
      OriginalLane: EndLaneFound,
      PseudoNode: PseudoEndNode,
      interiorNodeId: interiorNodeId,
      exteriorNodeId: exteriorNodeId,
      isStartLane: false,
      isEndLane: true
    });

    console.log("PseudoEndLane: ", PseudoEndLane);


    const laneEndLocation = PseudoEndLane.endCoordsLngLat;
    const laneEndGeoHash = PseudoEndLane.end.split('-')[3];
    const LaneEndLatLng = Geohash.decode(laneEndGeoHash);

    // console.log("laneStartLocation: ", laneStartLocation);
    // console.log("laneStartGeoHash: ", laneStartGeoHash);
    // console.log("LaneStartLatLng: ", LaneStartLatLng);

    const laneEndLngMatchesNode = (laneEndLocation[0] === PseudoNodeLocation.lon)? true : false;
    const laneEndLatMatchesNode = (laneEndLocation[1] === PseudoNodeLocation.lat)? true : false;
    const laneLocationMatchesNode = (laneEndLngMatchesNode && laneEndLatMatchesNode)? true : false;

    const laneEndLngHashMatchesNode = (PseudoNodeLocation.lon === LaneEndLatLng.lon)? true : false;
    const laneEndLatHashMatchesNode = (PseudoNodeLocation.lat === LaneEndLatLng.lat)? true : false;
    const laneHashMatchesNode = (laneEndLngHashMatchesNode && laneEndLatHashMatchesNode)? true : false;




    if(laneLocationMatchesNode && laneHashMatchesNode){

      console.log("\nPseudo Lane End Matches Pseudo Node Location and Lane Hash: ", PseudoNodeLocation);
      console.log("\n");


    } else {
      console.log("Pseudo Lane End: ", laneEndLocation);
      console.log("Does not match Pseudo Node Location: ", LaneEndLatLng);
      console.log("PseudoNodeLocation: ", PseudoNodeLocation);
    }

    const laneSubtractionValue = EndLaneFound.length - PseudoEndLane.length;


    return {
      PseudoNode: PseudoEndNode,
      PseudoLane: PseudoEndLane,
      laneAdditionValue: PseudoEndLane.length
    };

  } catch(err) {
    console.log("Error getting Pseudo Node Location and Hyperspace Lane: ", err);
  }

};


async function getExteriorJumpNodeIds(nodeOneId, nodeTwoId) {
  try {

    if(isNaN(nodeOneId)) {

      const pseudoNodeArray = nodeOneId.split('-');
      const startNodeId = parseInt(pseudoNodeArray[1]);
      const endNodeId = parseInt(pseudoNodeArray[2]);
      const nodeTwoIdUsed = getNodeIdOrFirstId(nodeTwoId);
      const firstJumpDistance = await distanceBetweenJumpNodes(startNodeId, nodeTwoIdUsed);
      const secondJumpDistane = await distanceBetweenJumpNodes(endNodeId, nodeTwoIdUsed);

      console.log("firstJumpDistance: ", firstJumpDistance);
      console.log("secondJumpDistane: ", secondJumpDistane);

      if(firstJumpDistance < secondJumpDistane) {
        return endNodeId;
      } else {
        return startNodeId;
      }

    } else {
      return nodeOneId;
    }
  } catch(err) {
    console.log("error get start node Id: ", err);
  }
};

async function getInteriorJumpNodeIds(nodeOneId, nodeTwoId) {
  try {

    if(isNaN(nodeOneId)) {

      const pseudoNodeArray = nodeOneId.split('-');
      const startNodeId = parseInt(pseudoNodeArray[1]);
      const endNodeId = parseInt(pseudoNodeArray[2]);
      const nodeTwoIdUsed = getNodeIdOrFirstId(nodeTwoId);
      const firstJumpDistance = await distanceBetweenJumpNodes(startNodeId, nodeTwoIdUsed);
      const secondJumpDistane = await distanceBetweenJumpNodes(endNodeId, nodeTwoIdUsed);

      console.log("firstJumpDistance: ", firstJumpDistance);
      console.log("secondJumpDistane: ", secondJumpDistane);

      if(firstJumpDistance > secondJumpDistane) {
        return endNodeId;
      } else {
        return startNodeId;
      }

    } else {
      return nodeOneId;
    }
  } catch(err) {
    console.log("error get start node Id: ", err);
  }
}



async function getEndNodeId(nodeOneId, nodeTwoId) {
  try {

    if(isNaN(nodeTwoId)) {

      const pseudoNodeArray = nodeTwoId.split('-');

      const laneStartNodeHash = pseudoNodeArray[1];
      const laneEndNodeHash = pseudoNodeArray[2];

      const laneStartNode = Geohash.decode(laneStartNodeHash);
      const laneEndNode = Geohash.decode(laneEndNodeHash);

      console.log("laneStartNode: ", laneStartNode);
      console.log("laneEndNode: ", laneEndNode);

      const pseudoNodeArray = nodeTwoId.split('-');


      const startNodeId = parseInt(pseudoNodeArray[1]);
      const endNodeId = parseInt(pseudoNodeArray[2]);

      const nodeOneIdUsed = getNodeIdOrFirstId(nodeOneId);

      const firstJumpDistance = await distanceBetweenJumpNodes(startNodeId, nodeOneIdUsed);
      const secondJumpDistane = await distanceBetweenJumpNodes(endNodeId, nodeOneIdUsed);


      console.log("firstJumpDistance: ", firstJumpDistance);
      console.log("secondJumpDistane: ", secondJumpDistane);

      if(firstJumpDistance > secondJumpDistane) {
        return endNodeId;
      } else {
        return startNodeId;
      }




    } else {
      return nodeTwoId;
    }
  } catch(err) {
    console.log("error get start node Id: ", err);
  }
};


async function distanceBetweenJumpNodes(nodeOneId, nodeTwoId) {
  try {
    const pathUrlEnd = '/path';
    const PostData = {
      "to" : neo4jAccessUrl + '/db/data/node/' + nodeTwoId,
      "cost_property" : "length",
      "relationships" : {
        "type" : "HYPERSPACE_LANE"
      },
      "algorithm" : "dijkstra"
    };
    const pathUrl = neo4jAccessUrl + '/db/data/node/'  + nodeOneId + pathUrlEnd;
    const SearchData = await http.post(pathUrl, PostData);
    return SearchData.weight;
  } catch(err) {
    console.log("error getting distance between nodes: ", err);
    throw new Error(400);
  }
};


function getNodeIdOrFirstId(nodeIdValue) {
  console.log("nodeIdValue: ", nodeIdValue);
  if(isNaN(nodeIdValue)) {
    const pseudoNodeArray = nodeIdValue.split('-');
    const startNodeId = parseInt(pseudoNodeArray[1]);
    return startNodeId;
  } else {
    return nodeIdValue;
  }
};


function findJumpCoordinatesById(jumpId, lanesArray) {
  const JumpFound = _.find(lanesArray, (n) => { return n._id === jumpId || n._id === -jumpId });
  if(JumpFound) {
    const foundId = JumpFound._id;
    const coordinatesSlice = JumpFound.coordinates.slice();
    if(!jumpIdSignsMatch(jumpId, foundId)) {
      return coordinatesSlice.reverse();
    } else {
      return coordinatesSlice.slice();
    }
  } else {
    return [];
  }
};

function jumpIdSignsMatch(searchId, foundId) {
  return Math.abs(searchId) === foundId && searchId === foundId;
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
      endNodeId: 71,
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
      endNodeId: 808,
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

    console.log("SearchData: ", SearchData);

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
    const nodeIdIntegrity = await buildHyperSpaceNodeGraph();

    if(!nodeIdIntegrity) {
      throw new Error("Node Id Integrity failure");
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
