const   Promise = require('bluebird'),
							_ = require('lodash');


const HyperSpaceLane = require('../data-classes/hyperspace-lane.js');
const HyperSpaceNode = require('../data-classes/hyperspace-node.js');
const HyperSpacePathCollection = require('../data-classes/hyperspace-path-collection.js');


async function generateStarPathCollection(PathCollectionOptions, db) {
  const start = PathCollectionOptions.start;
  const end = PathCollectionOptions.end;
  const hyperspaceLanesSet = PathCollectionOptions.hyperspaceLanesSet;
  const hyperspaceNodesSet = PathCollectionOptions.hyperspaceNodesSet;
  const hyperspaceRoutes = PathCollectionOptions.hyperspaceRoutes;
  const hyperspaceRoutesLength = PathCollectionOptions.hyperspaceRoutesLength;
  const hyperspaceRoutesNodes = PathCollectionOptions.hyperspaceRoutesNodes;

  const lanesArray = await Promise.map([...hyperspaceLanesSet], function(laneId) {
  	return db.readRelationshipAsync(laneId);
  });

  const nodesArray = await Promise.map([...hyperspaceNodesSet], function(nodeId) {
    return db.readNodeAsync(nodeId);
  });

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
    hyperspaceNodesArray,
    hyperspaceRoutes,
    hyperspaceRoutesLength,
    hyperspaceRoutesNodes    
  );
  StarPathCollection.generatePaths();
  const Path = StarPathCollection.paths[0];
  if(Path) {
    const PathLanes = Path.createArrayOfHyperspaceLanes(StarPathCollection.lanes);
    const PathNodes = Path.createArrayOfHyperspaceNodes(StarPathCollection.nodes);
    StarPathCollection.linkHyperspacePaths();
    return StarPathCollection;
  } else {
    return {};
  }
};




module.exports = generateStarPathCollection;
