const Promise = require('bluebird'),
						_ = require('lodash'),
     distance = require('euclidean-distance');


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
    return new HyperSpaceNode(_.merge({nodeId: Node._id}, Node));
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

    if(StarPathCollection.paths.length === 1) {
      console.log("Single Path calculated");
      console.log("Star Path Created: ", Object.keys(StarPathCollection));
      const FirstStarPath = StarPathCollection.paths[0];
      let coordinatesArray = [];

      for(let i=0; i < FirstStarPath.jumps.length; i++) {
        const CurrentJump = FirstStarPath.jumps[i];
        const jumpCoordinates = findJumpCoordinatesById(CurrentJump, StarPathCollection.lanes);
        if(i !== 0) { jumpCoordinates.shift(); }
        coordinatesArray = coordinatesArray.concat(jumpCoordinates);
      }

      const masterCoordinatesArray = coordinatesArray.slice();
      let galacticCoordinatesArray = [];

      for(let currentCoordinates of masterCoordinatesArray) {
        const longitude = parseFloat(currentCoordinates[0]);
        const latitude = parseFloat(currentCoordinates[1]);
        const GalacitcPoint = getGalacticFromLatLng({lat: latitude, lng: longitude});
        galacticCoordinatesArray.push(GalacitcPoint);
      }

      let PreviousPoint;
      let totalDistance = 0.00;
      let distanceBetweenPointsArray = [totalDistance];
      for(let CurrentPoint of galacticCoordinatesArray) {
        if(PreviousPoint) {
          const previousToCurrentDistance = distanceBetweenPoints(PreviousPoint, CurrentPoint);
          totalDistance += previousToCurrentDistance;
          distanceBetweenPointsArray.push(previousToCurrentDistance);
          PreviousPoint = CurrentPoint;
        } else {
          PreviousPoint = CurrentPoint;
        }
      }

      const latLngCoordinates = reverseCoordinatesLatLng(masterCoordinatesArray);

      console.log("masterCoordinatesArray: ", masterCoordinatesArray.length);
      console.log("galacticCoordinatesArray: ", galacticCoordinatesArray.length);
      console.log("Total Distance: ", totalDistance);
      console.log("distanceBetweenPointsArray: ", distanceBetweenPointsArray.length);
      console.log("latLngCoordinates: ", latLngCoordinates.length);

      StarPathCollection.jumpCoordinates = latLngCoordinates;
      StarPathCollection.jumpDistances = distanceBetweenPointsArray;

    }
    return StarPathCollection;
  } else {
    return {};
  }
};




function slimCoordinatesArray(coordinatesArray) {
  const uniqueCoordinatesArray = [];
  let previousCoordinates = [];
  for(let i=1; i < coordinatesArray.length; i++) {
    let currentCoordinates = coordinatesArray[i];
    if(previousCoordinates.length > 0) {
      const currentLatitude = currentCoordinates[0];
      const previousLatitude = previousCoordinates[0];
      const currentLongitude = currentCoordinates[1];
      const previousLongitude = previousCoordinates[1];
      const previousEqualsCurrentLatitude = (currentLatitude === previousLatitude)? true : false;
      const previousEqualsCurrentLongitude = (currentLongitude === previousLongitude)? true : false;
      const previousAndCurrentMatch = (previousEqualsCurrentLatitude && previousEqualsCurrentLongitude)? true  : false;
      if(!previousAndCurrentMatch) {
        uniqueCoordinatesArray.push(currentCoordinates);
      }
    } else {
      previousCoordinates = currentCoordinates;
    }
  }
  return uniqueCoordinatesArray;
};




function reverseCoordinatesLatLng(coordinatesArray) {
  return _.map(coordinatesArray, (coordinate) => {
    return coordinate.slice().reverse();
  });
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

function getGalacticYFromLatitude(latitude) {
  return  (-3.07e-19*(latitude**12)) + (-1.823e-18*(latitude**11)) + (4.871543e-15*(latitude**10)) + (4.1565807e-14*(latitude**9)) + (-2.900986202e-11 * (latitude**8)) + (-1.40444283864e-10*(latitude**7)) + (7.9614373223054e-8*(latitude**6)) + (7.32976568692443e-7*(latitude**5)) + (-0.00009825374539548058*(latitude**4)) + (0.005511093818675318*(latitude**3)) + (0.04346753629461727 * (latitude**2)) + (111.30155374684914 * latitude);
}

function getGalacticXFromLongitude(longitude) {
  return (111.3194866138503 * longitude);
}

function getGalacticFromLatLng(LatLng) {
  return {
    yGalactic: getGalacticYFromLatitude(LatLng.lat),
    xGalactic: getGalacticXFromLongitude(LatLng.lng)
  };
}

function distanceBetweenPoints(Point1, Point2) {
  const pointOneCoordinates = [Point1.xGalactic, Point1.yGalactic];
  const pointTwoCoordinates = [Point2.xGalactic, Point2.yGalactic];
  const distanceBetweenNodeAndPoint = distance(pointOneCoordinates, pointTwoCoordinates);
  return distanceBetweenNodeAndPoint;
}


module.exports = generateStarPathCollection;
