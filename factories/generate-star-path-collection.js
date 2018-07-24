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

      let betterShipAngles = [];
      for(let i=0; i < galacticCoordinatesArray.length - 1; i++) {

        const CurrentPoint = galacticCoordinatesArray[i];
        const TargetPoint = galacticCoordinatesArray[i + 1];
        const newShipJumpAngle = jumpAngleGalactic(CurrentPoint, TargetPoint);
        betterShipAngles.push(newShipJumpAngle);

      }

      const pointJumpAngles = [];
      for(let i=1; i < distanceBetweenPointsArray.length - 1; i++) {
        const previousToCurrentDistance = distanceBetweenPointsArray[i];
        const currentToNextDistance = distanceBetweenPointsArray[i + 1];
        const previousToNextDistance =  distancePreviousToNextArray[i - 1];

        const PreviousPoint = galacticCoordinatesArray[i - 1];
        const CurrentPoint = galacticCoordinatesArray[i];
        const NextPoint = galacticCoordinatesArray[i + 1];

        const jumpAngleCalculated = jumpAngle(currentToNextDistance, previousToCurrentDistance, previousToNextDistance);

        const jumpIsSpinward = destinationIsSpinWardMagnum(CurrentPoint, NextPoint);

        if(jumpIsSpinward) {
          console.log("Jump is Spinward: ", jumpAngleCalculated);
        } else {
          console.log("Jump is Anti-Spinward: ", jumpAngleCalculated);
        }

        


        if(isNaN(jumpAngleCalculated)) {
          pointJumpAngles.push(180.00);
          console.log("\ncurrentToNextDistance: ", currentToNextDistance);
          console.log("previousToCurrentDistance: ", previousToCurrentDistance);
          console.log("previousToNextDistance: ", previousToNextDistance);
        } else {
          const spinWardOffSet = (jumpIsSpinward)? -1 : 1;
          pointJumpAngles.push(spinWardOffSet * jumpAngleCalculated);
        }
      }

      const pointJumpCorrectionAngles = pointJumpAngles.map(currentAngle => {
        const angleSign = Math.sign(currentAngle);
        return (180.00 - Math.abs(currentAngle)) * angleSign;
      });

      const initialStartCoordinates  = galacticCoordinatesArray[0];

      const initialTargetCoordinates = galacticCoordinatesArray[1];

      const xCoordinateNormalizedToOrigin = initialTargetCoordinates.xGalactic - initialStartCoordinates.xGalactic;
      const yCoordinateNormalizedToOrigin = initialTargetCoordinates.yGalactic - initialStartCoordinates.yGalactic;

      const intialJumpAngle = normalizeDegreesToShip(calcAngleDegrees(xCoordinateNormalizedToOrigin, yCoordinateNormalizedToOrigin));
      const shipJumpAngles = [intialJumpAngle];
      let shipJumpAngleCurrent = intialJumpAngle;

      console.log("intialJumpAngle: ", intialJumpAngle);

      const pointJumpCorrectionAnglesSpin = [];
      const jumpTargetYFactorArray = [];
      const jumpTargetXFactorArray = [];
      for(let i=0; i < galacticCoordinatesArray.length - 1; i++) {
        const JumpStartCoordinates  = galacticCoordinatesArray[i];
        const JumpTargetCoordinates = galacticCoordinatesArray[i + 1];
        let jumpCorrectionAngle = pointJumpCorrectionAngles[i - 1];


        // const currentJumpAngle = normalizeDegreesToShip(calcAngleDegrees(initialStartCoordinates.xGalactic, initialStartCoordinates.yGalactic));

        const jumpTargetYFactor = (JumpTargetCoordinates.yGalactic >= 0)? 1 : -1;
        const jumpTargetXFactor = (JumpTargetCoordinates.xGalactic >= 0)? 1 : -1;
        jumpTargetYFactorArray.push(jumpTargetYFactor);
        jumpTargetXFactorArray.push(jumpTargetXFactor);

        // const currentShipJumpAngle = shipJumpAngles.push(shipJumpAngle);

        const targetIsSpinward = destinationIsSpinWardMagnum(JumpStartCoordinates, JumpTargetCoordinates);
        if(targetIsSpinward) {
          // console.log("Target is Spinward");
          // pointJumpCorrectionAngles[i] = jumpCorrectionAngle;
          pointJumpCorrectionAnglesSpin.push(jumpCorrectionAngle);
        } else {
          // console.log("Target is Anti-Spinward");
          if(!isNaN(jumpCorrectionAngle)) {
            pointJumpCorrectionAnglesSpin.push(jumpCorrectionAngle);
          }
        }
      }
      pointJumpCorrectionAnglesSpin.shift();

      pointJumpCorrectionAnglesSpin.forEach(n => {
        if(n >= 0) {
          console.log("Target is Anti-Spinward: ", n);
        } else {
          console.log("Target is Spinward: ", n);
        }
      });

      let shipJumpAnglesActual = [];
      let previousJumpAngle = intialJumpAngle;
      shipJumpAnglesActual.push(intialJumpAngle);

      for(let i=0; i < pointJumpCorrectionAngles.length; i++) {
        const shipCorrectionAngle = pointJumpCorrectionAngles[i];
        const targetYFactor = jumpTargetYFactorArray[i];
        const targetXFactor = jumpTargetXFactorArray[i];
        const targetFactorProduct = targetYFactor * targetXFactor;


        // if(targetYFactor > 0) {

        // } else {

        // }

        // const newJumpAngle = (targetFactorProduct > 0)? previousJumpAngle + (shipCorrectionAngle) : previousJumpAngle - shipCorrectionAngle;

        const newJumpAngle = previousJumpAngle + (shipCorrectionAngle);
        shipJumpAnglesActual.push(newJumpAngle);
        previousJumpAngle = newJumpAngle;
      }


      const latLngCoordinates = reverseCoordinatesLatLng(masterCoordinatesArray);
      // const pointJumpAngles = getArrayOfAnglesBetweenPoints(galacticCoordinatesArray);
      const pointJumpAngleTotal = pointJumpCorrectionAngles.reduce(getSum);

      console.log("masterCoordinatesArray: ", masterCoordinatesArray.length);
      console.log("galacticCoordinatesArray: ", galacticCoordinatesArray.length);
      console.log("Total Distance: ", totalDistance);
      console.log("distanceBetweenPointsArray: ", distanceBetweenPointsArray.length);
      console.log("latLngCoordinates: ", latLngCoordinates.length);
      console.log("pointJumpAngles: ", pointJumpAngles.length);
      console.log("point Jump Angles Found: ", pointJumpAngles.length);
      console.log("pointJumpAnglesTotal: ", pointJumpAngleTotal);
      console.log("pointJumpCorrectionAngles: ", pointJumpCorrectionAngles.length);
      console.log("pointJumpCorrectionAnglesSpin: ", pointJumpCorrectionAnglesSpin.length);
      console.log("shipJumpAnglesActual: ", shipJumpAnglesActual.length);
      console.log("betterShipAngles: ", betterShipAngles.length);

      StarPathCollection.jumpCoordinates = latLngCoordinates;
      StarPathCollection.jumpDistances = distanceBetweenPointsArray;
      StarPathCollection.jumpAngles  = pointJumpCorrectionAnglesSpin;
      StarPathCollection.startingJumpAngle = intialJumpAngle;
      StarPathCollection.shipJumpAnglesActual = shipJumpAnglesActual;
      StarPathCollection.pointJumpCorrectionAngles = pointJumpCorrectionAngles;
      StarPathCollection.pointJumpAngles = pointJumpAngles;
      StarPathCollection.betterShipAngles = betterShipAngles;


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

  const targetIsPositiveX = currentGalacticX <= 0 && targetGalacticX > 0;
  const targetIsNegativeX = currentGalacticX >= 0 && targetGalacticX < 0;

  const xOperator = (targetIsPositiveX || targetIsNegativeX)? -1 : 1 ;


  const targetIsPositiveY = currentGalacticY <= 0 && targetGalacticY > 0;
  const targetIsNegativeY = currentGalacticY >= 0 && targetGalacticY < 0;

  const yOperator = (targetIsPositiveY || targetIsNegativeY)? -1 : 1 ;


  const targetXFromOrigin = (Math.abs(TargetPoint.xGalactic) - Math.abs(CurrentPoint.xGalactic));
  const targetYFromOrigin = (Math.abs(TargetPoint.yGalactic) - Math.abs(CurrentPoint.yGalactic));
  const targetXFromOriginSquared = targetXFromOrigin ** 2;
  const targetYFromOriginSquared = targetYFromOrigin ** 2;

  const radius = Math.sqrt( targetXFromOriginSquared + targetYFromOriginSquared );

  const targetXOverRadius = (targetXFromOrigin / radius);

  const jumpAngle = Math.acos(targetXOverRadius);
  const jumpAngleDegrees = radiansToDegrees(jumpAngle);

  // const jumpAngleDegrees = (Math.sign(targetYFromOrigin) < 0)? 180.0 - radiansToDegrees(jumpAngle) :  radiansToDegrees(jumpAngle);
  // jumpAngleDegrees = (Math.sign(targetXFromOrigin) < 0)? 540.0 - radiansToDegrees(jumpAngle) + 90.0 :  radiansToDegrees(jumpAngle);

  console.log("Jump angle is: ", jumpAngleDegrees);

  if(TargetPoint.xGalactic < 0.00 && TargetPoint.yGalactic < 0.00) { // III

    const jumpAngleInQuad3 = (TargetPoint.yGalactic < CurrentPoint.yGalactic)?  270.0 - jumpAngleDegrees :   270.0 + jumpAngleDegrees;


    const adjustedJumpAngle = jumpAngleInQuad3;
    console.log("Jump angle in III: ", adjustedJumpAngle);
    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  >= 0.00 && TargetPoint.yGalactic >= 0.00) { // I


    const jumpAngleInQuad1 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)?  90.0 - jumpAngleDegrees :   90 + jumpAngleDegrees;


    const adjustedJumpAngle = jumpAngleInQuad1;
    console.log("Jump angle in I: ", adjustedJumpAngle);
    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  >= 0.00 && TargetPoint.yGalactic < 0.00) { // II


    const jumpAngleInQuad2 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)? 450.0 - jumpAngleDegrees :   90.0 + jumpAngleDegrees;

    const adjustedJumpAngle = jumpAngleInQuad2;
    console.log("Jump angle in II: ", adjustedJumpAngle);

    return (adjustedJumpAngle % 360);
  } else if(TargetPoint.xGalactic  < 0.00 && TargetPoint.yGalactic >= 0.00){ // IV


    const jumpAngleInQuad4 = (TargetPoint.yGalactic > CurrentPoint.yGalactic)?  jumpAngleDegrees + 270.0 :   270.0 - jumpAngleDegrees;


    const adjustedJumpAngle = jumpAngleInQuad4;
    console.log("Jump angle in IV: ", adjustedJumpAngle);

    return (adjustedJumpAngle % 360);

  }


  // return radiansToDegrees(jumpAngle) + 90.00;
  // return 90.00 - radiansToDegrees(jumpAngle);
}

function getArrayOfAnglesBetweenPoints(arrayOfGalacticPoints) {
  const anglesBetweenPoints = [];
  for(let i=0; i < arrayOfGalacticPoints.length - 2; i++) {
    const trailingPointInJump = arrayOfGalacticPoints[i];
    const currentPointInJump = arrayOfGalacticPoints[i + 1];
    const leadingPointInJump = arrayOfGalacticPoints[i + 1];
    const currentPointAngle = getAngleBetweenThreePoints(trailingPointInJump, currentPointInJump, leadingPointInJump);
    anglesBetweenPoints.push(currentPointAngle);
  }
  return anglesBetweenPoints;
};



function getSum(total, num) {
  return total + num;
};


function calcAngleDegrees(x, y) {
  return Math.atan2(y, x) * 180 / Math.PI;
};

function radiansToDegrees(radians) {
  return radians * ( 180 / Math.PI) % 360;
};



function normalizeDegreesToShip(degrees) {
  if(degrees === 0) {
    return degrees + 360.00;
  } else if(degrees < 0) {
    return 90.0 + Math.abs(degrees); 
  } else if(degrees > 0) {
    const shipAngle = (180.0 - degrees) - 90.0;
    return (shipAngle >=0 )? shipAngle : shipAngle + 360.0;
  }
};



function destinationIsSpinwardTest(CurrentJumpPoint, DestinationJumpPoint) {
  const currentJumpPointAngle = normalizeDegreesToShipDeus(calcAngleDegrees(CurrentJumpPoint.xGalactic, CurrentJumpPoint.yGalactic));
  const destinationJumpPointAngle = normalizeDegreesToShipDeus(calcAngleDegrees(DestinationJumpPoint.xGalactic, DestinationJumpPoint.yGalactic));

  const destinationInGrid4 = (DestinationJumpPoint.xGalactic < 0 && DestinationJumpPoint.yGalactic > 0);
  const currentPointInGrid1 = (CurrentJumpPoint.xGalactic >= 0 && CurrentJumpPoint.yGalactic > 0);
  const destinationIsSpinwardByAngle = (destinationJumpPointAngle < currentJumpPointAngle);

  if((currentPointInGrid1 && destinationInGrid4) || destinationIsSpinwardByAngle) {
    return true;
  } else {
    return false;
  }
};


function destinationIsSpinWardMagnum(CurrentJumpPoint, DestinationJumpPoint) {
  const CurrentPoint = new GalacticPoint(CurrentJumpPoint.xGalactic, CurrentJumpPoint.yGalactic);
  const DestinationPoint = new GalacticPoint(DestinationJumpPoint.xGalactic, DestinationJumpPoint.yGalactic);
  const spinwardStatus = CurrentPoint.jumpToPointIsSpinward(DestinationPoint);
  return spinwardStatus;
}


M = {
  xGalactic: 3,
  yGalactic: 3
};

M1 = {
  xGalactic: 3.2,
  yGalactic: 2.5
};

M2 = {
  xGalactic: 1.343,
  yGalactic: 4.234
};

M3 = {
  xGalactic: 1.5,
  yGalactic: 3
};

M4 = {
  xGalactic: 3,
  yGalactic: 4
};

N = {
  xGalactic: -3,
  yGalactic: 3
};

O = {
  xGalactic: -3,
  yGalactic: -3
};

P = {
  xGalactic: 3,
  yGalactic: -3
};


// -180.00 < degrees < 180.0 --> 0 < degrees < 360.0. 0.00 degrees is North
function normalizeDegreesToShipDeus(degrees) {
  if(degrees >= 0 && degrees <= 90) {
    return (90 - degrees);
  } else if(degrees > 90) {
    return 270.0 + (180.0 - degrees);
  } else if(degrees < 0) {
    return 90.0 - degrees;
  }
};



function destinationIsSpinwardDeus(CurrentJumpPoint, DestinationJumpPoint) {
  const xChange = DestinationJumpPoint.xGalactic - CurrentJumpPoint.xGalactic;
  const yChange = DestinationJumpPoint.yGalactic - CurrentJumpPoint.yGalactic;

  const xDestination = DestinationJumpPoint.xGalactic;
  const yDestination = DestinationJumpPoint.yGalactic;

  const xDestinationPositive = (xDestination > 0)? true : false;
  const yDestinationPositive = (yDestination > 0)? true : false;

  const positiveXChange = (xChange >= 0)? true : false;
  const positiveYChange = (yChange >= 0)? true : false;
  const negativeXChange = (xChange < 0)? true : false;
  const negativeYChange = (yChange < 0)? true : false;

  // const positiveXandYChange = (positiveXChange && positiveYChange)? true : false;
  // const negativeXandYChange = (negativeXChange && negativeYChange)? true : false;

  // if(positiveXandYChange && !xDestinationPositive && !yDestinationPositive) {
  //   return true;
  // } else if(positiveYChange && xDestinationPositive && yDestinationPositive) {
  //   return true;
  // } else if(negativeXandYChange && !xDestinationPositive && yDestinationPositive) {
  //   return true;
  // } else if(positiveXChange && xDestinationPositive && !yDestinationPositive) {
  //   return true;
  // } else {
  //   return false;
  // }

  const destinationInGrid1 = xDestinationPositive && yDestinationPositive;
  const destinationInGrid2 = xDestinationPositive && !yDestinationPositive;
  const destinationInGrid3 = !xDestinationPositive && !yDestinationPositive;
  const destinationInGrid4 = !xDestinationPositive && yDestinationPositive;

  if(destinationInGrid1 && (negativeXChange || positiveYChange)) {
    return true;
  } else if(destinationInGrid2 && (positiveXChange || negativeYChange)) {
    return true;
  } else if(destinationInGrid3 && (positiveXChange || positiveYChange)) {
    return true;
  } else if(destinationInGrid4 && (negativeXChange || negativeYChange)) {
    return true;
  } else {
    return false;
  }
};


function destinationIsSpinWard(CurrentJumpPoint, DestinationJumpPoint) {
  const jumpPointAngleFromOrigin = calcAngleDegrees(CurrentJumpPoint.xGalactic, CurrentJumpPoint.yGalactic);
  const destinationJumpPointAngle = calcAngleDegrees(DestinationJumpPoint.xGalactic, DestinationJumpPoint.yGalactic);

  const jumpPointSpinwardAngle = (jumpPointAngleFromOrigin >= 0)? jumpPointAngleFromOrigin : (jumpPointAngleFromOrigin + 360.00) % 360;
  const destinationPointSpinwardAngle = (destinationJumpPointAngle >= 0)? destinationJumpPointAngle : (destinationJumpPointAngle + 360.00) % 360;

  if(destinationPointSpinwardAngle > jumpPointSpinwardAngle || (destinationPointSpinwardAngle < jumpPointSpinwardAngle && destinationJumpPointAngle >= 0 && jumpPointAngleFromOrigin < 0)) {
    return true;
  } else {
    return false;
  }
};


function getAngleBetweenThreePoints(Point1, Point2, Point3) {
  const decimalPrecision = 10;

  xGalactic1 = galacticToFixed(Point1, 10).xGalactic;
  yGalactic1 = galacticToFixed(Point1, 10).yGalactic;

  xGalactic2 = galacticToFixed(Point2, 10).xGalactic;
  yGalactic2 = galacticToFixed(Point2, 10).yGalactic;

  xGalactic3 = galacticToFixed(Point3, 10).xGalactic;
  yGalactic3 = galacticToFixed(Point3, 10).yGalactic;



  const power12X = Math.pow((xGalactic1 - xGalactic2), 2);
  const power12Y = Math.pow((yGalactic1 - yGalactic2), 2);

  const power13X = Math.pow((xGalactic1 - xGalactic3), 2);
  const power13Y = Math.pow((yGalactic1 - yGalactic3), 2);

  const power23X = Math.pow((xGalactic2 - xGalactic3), 2);
  const power23Y = Math.pow((yGalactic2 - yGalactic3), 2);


  // const p12 = Math.sqrt(Math.pow((Point1.xGalactic - Point2.xGalactic), 2) + Math.pow((Point1.yGalactic - Point2.yGalactic), 2));
  // const p13 = Math.sqrt(Math.pow((Point1.xGalactic - Point3.xGalactic), 2) + Math.pow((Point1.yGalactic - Point3.yGalactic), 2));
  // const p23 = Math.sqrt(Math.pow((Point2.xGalactic - Point3.xGalactic), 2) + Math.pow((Point2.yGalactic - Point3.yGalactic), 2));

  const p12 = Math.sqrt(power12X + power12Y).toFixed(10);
  const p13 = Math.sqrt(power13X + power13Y).toFixed(10);
  const p23 = Math.sqrt(power23X + power23Y).toFixed(10);


  console.log("p12: ", p12);


  //angle in radians
  const resultRadian = Math.acos(((Math.pow(p12, 2)) + (Math.pow(p13, 2)) - (Math.pow(p23, 2))) / (2 * p12 * p13));

  // console.log("resultRadian: ", resultRadian);

  const arcCosine = Math.acos(((Math.pow(p12, 2)) + (Math.pow(p13, 2)) - (Math.pow(p23, 2))) / (2 * p12 * p13));

  // console.log("Arccosine: ", arcCosine);

  //angle in degrees
  const resultDegree = Math.acos(((Math.pow(p12, 2)) + (Math.pow(p13, 2)) - (Math.pow(p23, 2))) / (2 * p12 * p13)) * (180.00 / Math.PI);

  console.log("resultDegree: ", resultDegree);


  return resultDegree;
};


function getAngleBetweenThreePointsBasic(Point1, Point2, Point3) {

  var p12 = Math.sqrt(Math.pow((p1.xGalactic - p2.xGalactic),2) + Math.pow((p1.yGalactic - p2.yGalactic),2));
  var p13 = Math.sqrt(Math.pow((p1.xGalactic - p3.xGalactic),2) + Math.pow((p1.yGalactic - p3.yGalactic),2));
  var p23 = Math.sqrt(Math.pow((p2.xGalactic - p3.xGalactic),2) + Math.pow((p2.yGalactic - p3.yGalactic),2));

  //angle in radians
  var resultRadian = Math.acos(((Math.pow(p12, 2)) + (Math.pow(p13, 2)) - (Math.pow(p23, 2))) / (2 * p12 * p13));

  //angle in degrees
  var resultDegree = Math.acos(((Math.pow(p12, 2)) + (Math.pow(p13, 2)) - (Math.pow(p23, 2))) / (2 * p12 * p13)) * 180 / Math.PI;

  return resultDegree;
};





function jumpAngle(a, b, c) {
  return  Math.acos(((a ** 2) + (b ** 2) - (c ** 2)) / (2 * a * b)) * (180.00 / Math.PI);
};


function slimCoordinates(coordinatesArray) {
  const uniqueCoordinatesArray = [];
  for(let i=0; i < coordinatesArray.length; i++) {
    let currentCoordinate = coordinatesArray[i];
    if(coordinatesArray.indexOf(currentCoordinate) === i) {
      uniqueCoordinatesArray.push(currentCoordinate);
    }
  }
  return uniqueCoordinatesArray;
};


function stringSlicerSlimer(coordinatesArray) {
  let tmp = [];
  return coordinatesArray.filter(function (v) {
    if (tmp.indexOf(v.toString()) < 0) {
      tmp.push(v.toString());
      return v;
    }
  });
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

function galacticToFixed(Point, fixedValue) {
  const xGalacticRaw = Point.xGalactic;
  const yGalacticRaw = Point.yGalactic;
  const xGalactic = parseFloat(xGalacticRaw.toFixed(fixedValue));
  const yGalactic = parseFloat(yGalacticRaw.toFixed(fixedValue));
  return {
    xGalactic: xGalactic,
    yGalactic: yGalactic
  }
}

function distanceBetweenPoints(Point1, Point2) {
  const pointOneCoordinates = [Point1.xGalactic, Point1.yGalactic];
  const pointTwoCoordinates = [Point2.xGalactic, Point2.yGalactic];
  const distanceBetweenNodeAndPoint = distance(pointOneCoordinates, pointTwoCoordinates);
  return distanceBetweenNodeAndPoint;
}


module.exports = generateStarPathCollection;
