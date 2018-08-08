const Promise = require('bluebird'),
						_ = require('lodash'),
     distance = require('euclidean-distance');


const HyperSpaceLane = require('../data-classes/hyperspace-lane.js');
const HyperSpaceNode = require('../data-classes/hyperspace-node.js');
const HyperSpacePathCollection = require('../data-classes/hyperspace-path-collection.js');
const GalacticPoint = require('../data-classes/galactic-point.js');


async function generateStarPathCollection(PathCollectionOptions, db) {
  const start = PathCollectionOptions.start;
  const end = PathCollectionOptions.end;
  const hyperspaceLanesSet = PathCollectionOptions.hyperspaceLanesSet;
  const hyperspaceNodesSet = PathCollectionOptions.hyperspaceNodesSet;
  const hyperspaceRoutes = PathCollectionOptions.hyperspaceRoutes;
  const hyperspaceRoutesLength = PathCollectionOptions.hyperspaceRoutesLength;
  const hyperspaceRoutesNodes = PathCollectionOptions.hyperspaceRoutesNodes;


  const PseudoStartNode = PathCollectionOptions.PseudoStartNode;
  const PseudoStartLane = PathCollectionOptions.PseudoStartLane;
  const PseudoEndNode = PathCollectionOptions.PseudoEndNode;
  const PseudoEndLane = PathCollectionOptions.PseudoEndLane;


  const lanesArray = await Promise.map([...hyperspaceLanesSet], function(laneId) {
    if(Math.abs(laneId) < 2000) {
      return db.readRelationshipAsync(laneId);
    } else {
      console.log("Lane is artifical: ", laneId);
    }
  });

  const nodesArray = await Promise.map([...hyperspaceNodesSet], function(nodeId) {
    if(Math.abs(nodeId) < 2000) {
      return db.readNodeAsync(nodeId);
    } else {
      console.log("Node is artifical: ", nodeId);
    }
  });

  // console.log("lanesArray: ", lanesArray);
  // console.log("nodesArray: ", nodesArray);

  const hyperspaceLaneData = lanesArray.filter(lane => lane !== undefined);
  const hyperspaceNodeData = nodesArray.filter(node => node !== undefined);


  console.log("hyperspaceLaneData length: ", hyperspaceLaneData.length);
  console.log("hyperspaceNodeData length: ", hyperspaceNodeData.length);

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


  if(!_.isEmpty(PseudoStartNode)) {
    hyperspaceNodesArray.unshift(PseudoStartNode);
    hyperspaceLanesArray.unshift(PseudoStartLane);
  }

  if(!_.isEmpty(PseudoEndNode)) {
    hyperspaceNodesArray.push(PseudoEndNode);
    hyperspaceLanesArray.push(PseudoEndLane);
  }

  console.log("hyperspaceNodesArray: ", hyperspaceNodesArray.length);
  console.log("hyperspaceLanesArray: ", hyperspaceLanesArray.length);

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

    // console.log("Path: ", Path);

    // console.log("StarPathCollection.lanes: ", StarPathCollection.lanes);

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
        const GalacitcPointLiteral = getGalacticFromLatLng({lat: latitude, lng: longitude});
        galacticCoordinatesArray.push(GalacitcPointLiteral);
      }

      let PreviousPoint;
      let totalDistance = 0.00;
      let distanceBetweenPointsArray = [totalDistance];
      const distancePreviousToNextArray = [];
      for(let i=0; i < galacticCoordinatesArray.length; i++) {
        const CurrentPoint = galacticCoordinatesArray[i];
        if(PreviousPoint) {
          const previousToCurrentDistance = distanceBetweenPoints(PreviousPoint, CurrentPoint);
          totalDistance += previousToCurrentDistance;
          distanceBetweenPointsArray.push(previousToCurrentDistance);
          if(i < galacticCoordinatesArray.length - 1) {
            const NextPoint = galacticCoordinatesArray[i + 1];
            const previousToNextDistance = distanceBetweenPoints(PreviousPoint, NextPoint);
            distancePreviousToNextArray.push(previousToNextDistance);
          }
          PreviousPoint = CurrentPoint;
        } else {
          PreviousPoint = CurrentPoint;
        }
      }

      let shipJumpAngles = [];
      for(let i=0; i < galacticCoordinatesArray.length - 1; i++) {
        const CurrentPoint = galacticCoordinatesArray[i];
        const TargetPoint = galacticCoordinatesArray[i + 1];
        const newShipJumpAngle = jumpAngleGalactic(CurrentPoint, TargetPoint);
        shipJumpAngles.push(newShipJumpAngle);
      }

      const latLngCoordinates = reverseCoordinatesLatLng(masterCoordinatesArray);

      console.log("masterCoordinatesArray: ", masterCoordinatesArray.length);
      console.log("galacticCoordinatesArray: ", galacticCoordinatesArray.length);
      console.log("Total Distance: ", totalDistance);
      console.log("distanceBetweenPointsArray: ", distanceBetweenPointsArray.length);
      console.log("latLngCoordinates: ", latLngCoordinates.length);
      console.log("shipJumpAngles: ", shipJumpAngles.length);

      StarPathCollection.jumpCoordinates = latLngCoordinates;
      StarPathCollection.jumpDistances = distanceBetweenPointsArray;
      StarPathCollection.shipJumpAngles = shipJumpAngles;
    }
    
    return StarPathCollection;
  } else {
    return {};
  }
};



// Gives accurate ship display angles
function jumpAngleGalactic(CurrentPoint, TargetPoint) { // (3, 3) and (4, 1)
  const currentGalacticX = CurrentPoint.xGalactic;
  const currentGalacticY = CurrentPoint.yGalactic;
  const targetGalacticX = CurrentPoint.xGalactic;
  const targetGalacticY = CurrentPoint.yGalactic;
  const targetIsPositiveX = (parseFloat(TargetPoint.xGalactic) > 0 && parseFloat(CurrentPoint.xGalactic) < 0)? true : false;
  const targetIsNegativeX = (parseFloat(TargetPoint.xGalactic) < 0 && parseFloat(CurrentPoint.xGalactic) > 0)? true : false;
  const targetHasCrossedYAxis = (targetIsPositiveX || targetIsNegativeX)? true : false ;
  const targetIsPositiveY = (parseFloat(CurrentPoint.yGalactic) < 0 && parseFloat(TargetPoint.yGalactic) > 0)? true : false;
  const targetIsNegativeY = (parseFloat(CurrentPoint.yGalactic) > 0 && parseFloat(TargetPoint.yGalactic) < 0)? true : false;
  const targetHasCrossedXAxis = (targetIsPositiveY || targetIsNegativeY)? true : false ;

  if(targetHasCrossedXAxis || targetHasCrossedYAxis) {
    // console.log("\ntargetHasCrossedYAxis: ", targetHasCrossedYAxis);
    // console.log("targetHasCrossedXAxis: ", targetHasCrossedXAxis);
    // console.log("TargetPoint: ", TargetPoint);
    // console.log("CurrentPoint: ", CurrentPoint);
  }

  if(targetHasCrossedYAxis) {
    const targetXFromOriginCrossOver = Math.abs(TargetPoint.xGalactic - CurrentPoint.xGalactic);
    // console.log("targetXFromOriginCrossOver: ", targetXFromOriginCrossOver);
  }

  if(targetHasCrossedXAxis) {
    const targetYFromOriginCrossOver = Math.abs(TargetPoint.yGalactic - CurrentPoint.yGalactic);
    // console.log("targetYFromOriginCrossOver: ", targetYFromOriginCrossOver);
  }

  const targetXFromOrigin = (targetHasCrossedYAxis)? Math.abs(TargetPoint.xGalactic - CurrentPoint.xGalactic) : (Math.abs(TargetPoint.xGalactic) - Math.abs(CurrentPoint.xGalactic));
  const targetYFromOrigin = (targetHasCrossedXAxis)? Math.abs(TargetPoint.yGalactic - CurrentPoint.yGalactic) : (Math.abs(TargetPoint.yGalactic) -  Math.abs(CurrentPoint.yGalactic)); 

  const targetXFromOriginSquared = targetXFromOrigin ** 2;
  const targetYFromOriginSquared = targetYFromOrigin ** 2;
  const radius = Math.sqrt( targetXFromOriginSquared + targetYFromOriginSquared );
  const targetXOverRadius = (targetXFromOrigin / radius);
  const jumpAngle = Math.acos(targetXOverRadius);
  const jumpAngleDegrees = radiansToDegrees(jumpAngle);
  // console.log("\nJump angle is: ", jumpAngleDegrees);

  if((TargetPoint.xGalactic < 0.00 && TargetPoint.yGalactic < 0.00)) { // III
    const jumpAngleInQuad3 = (TargetPoint.yGalactic < CurrentPoint.yGalactic)?  270.0 - jumpAngleDegrees :   270.0 + jumpAngleDegrees;
    const adjustedJumpAngle = jumpAngleInQuad3;
    // console.log("Jump angle in III: ", adjustedJumpAngle % 360);
    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  >= 0.00 && TargetPoint.yGalactic >= 0.00) { // I
    const jumpAngleInQuad1 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)?  90.0 - jumpAngleDegrees :   90 + jumpAngleDegrees;
    const adjustedJumpAngle = jumpAngleInQuad1;
    // console.log("Jump angle in I: ", adjustedJumpAngle % 360);
    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  >= 0.00 && TargetPoint.yGalactic < 0.00) { // II
    const jumpAngleInQuad2 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)? 450.0 - jumpAngleDegrees :   90.0 + jumpAngleDegrees;
    const adjustedJumpAngle = jumpAngleInQuad2;
    // console.log("Jump angle in II: ", adjustedJumpAngle % 360);
    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  < 0.00 && TargetPoint.yGalactic >= 0.00){ // IV
    const jumpAngleInQuad4 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)?  jumpAngleDegrees + 270.0 :   270.0 - jumpAngleDegrees;
    const adjustedJumpAngle = jumpAngleInQuad4;
    // console.log("Jump angle in IV: ", adjustedJumpAngle % 360);
    return (adjustedJumpAngle % 360);
  }
};

function radiansToDegrees(radians) {
  return radians * ( 180 / Math.PI) % 360;
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
};

function getGalacticXFromLongitude(longitude) {
  return (111.3194866138503 * longitude);
};

function getGalacticFromLatLng(LatLng) {
  return {
    yGalactic: getGalacticYFromLatitude(LatLng.lat),
    xGalactic: getGalacticXFromLongitude(LatLng.lng)
  };
};

function distanceBetweenPoints(Point1, Point2) {
  const pointOneCoordinates = [Point1.xGalactic, Point1.yGalactic];
  const pointTwoCoordinates = [Point2.xGalactic, Point2.yGalactic];
  const distanceBetweenNodeAndPoint = distance(pointOneCoordinates, pointTwoCoordinates);
  return distanceBetweenNodeAndPoint;
};


module.exports = generateStarPathCollection;
