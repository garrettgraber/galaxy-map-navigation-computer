const uuidv4 = require('uuid/v4');
const distance = require('euclidean-distance');

class HyperSpacePseudoLane {
	constructor(Options) {
		const isStartLane = Options.isStartLane;
		const isEndLane = Options.isEndLane;


		const OriginalHyperspaceLane = Options.OriginalLane;
		const originalStartId = OriginalHyperspaceLane._start;
		const originalEndId = OriginalHyperspaceLane._end;
		const coordinates = this.coordinateStringToArray(OriginalHyperspaceLane.coordinates);

		// const coordinates = OriginalHyperspaceLane.coordinates;

		const PseudoNode = Options.PseudoNode;



		const pseudoNodeCutIndex = parseInt(PseudoNode.system.split('-')[4]);

		console.log("pseudoNodeCutIndex: ", pseudoNodeCutIndex);
		const pseudoNodeLocation = [PseudoNode.lng, PseudoNode.lat];
		const interiorNodeId = Options.interiorNodeId;
		const exteriorNodeId = Options.exteriorNodeId;


		const laneIsReversed = this.shoudLaneReverse(originalStartId, interiorNodeId, exteriorNodeId, isStartLane);
		const directionAdjustedCoordinates = (laneIsReversed)? this.reverseCoordinatesArray(coordinates) : coordinates;

		this.name = OriginalHyperspaceLane.name;
		this.hyperspaceHash = uuidv4();

		const slicedCoordinates = this.insertPseudoNodeCoordinates(pseudoNodeLocation, coordinates, pseudoNodeCutIndex, laneIsReversed, isStartLane);
		this.coordinates = slicedCoordinates;


		console.log("lane is reversed: ",  laneIsReversed);

		if(isStartLane) {
			this.start = PseudoNode.system;
			this.end = (laneIsReversed)? OriginalHyperspaceLane.start : OriginalHyperspaceLane.end;
		}

		if(isEndLane) {
			this.start = (laneIsReversed)? OriginalHyperspaceLane.end : OriginalHyperspaceLane.start;
			this.end = PseudoNode.system;
		}



		this.startCoordsLngLat = slicedCoordinates[0];
		this.endCoordsLngLat = slicedCoordinates[slicedCoordinates.length - 1];

		this.link = OriginalHyperspaceLane.link;
		this._start = (isStartLane)? PseudoNode.nodeId : interiorNodeId;
		this._end = (isStartLane)? interiorNodeId : PseudoNode.nodeId;


		this._id = randomPseudoLaneId();

		const galacticCoordinatesArray = getGalacticCoordinatesArray(this.coordinates);
		const pseudoLaneLength = calculateLaneDistance(galacticCoordinatesArray);

		this.length = pseudoLaneLength;

		console.log("Pseudo Lane Lengths: ", pseudoLaneLength);
	}

	shoudLaneReverse(laneStartValue, interiorNodeId, exteriorNodeId, isStartLane) {
		if(isStartLane && laneStartValue === interiorNodeId) {
			return true;
		} else if(!isStartLane && laneStartValue === exteriorNodeId) {
			return true;
		} else {
			return false;
		}
	}

	coordinateStringToArray(coordinates) {
		if(Array.isArray(coordinates)) {
			return coordinates;
		} else {
			console.log("coordinates are not an Array: ", coordinates);
			let jsonJumpCoordinates = JSON.parse("[" + coordinates + "]");
			// console.log("jsonJumpCoordinates: ", jsonJumpCoordinates[0]);
			// console.log("coordinates type: ", typeof jsonJumpCoordinates[0]);
			return jsonJumpCoordinates[0];			
		}
	}

	reverseCoordinatesArray(coordinates) {
		return coordinates.slice().reverse();
	}

	insertPseudoNodeCoordinates(pseudoNodeCoordinates, originalCoordinates, pseudoNodeCutIndex, laneIsReversed, isStartLane) {

		console.log("insertPseudoNodeCoordinates has fired: ", pseudoNodeCoordinates);
		// console.log("originalCoordinates: ",  originalCoordinates);

		const pseudoNodeLongitude = pseudoNodeCoordinates[0];
		const pseudoNodeLatitude = pseudoNodeCoordinates[1];

		const slicedIndexUsed = (laneIsReversed)? originalCoordinates.length - pseudoNodeCutIndex - 1 : pseudoNodeCutIndex;


		const laneSlice = (isStartLane)?
			(laneIsReversed)?
				originalCoordinates.slice(0, pseudoNodeCutIndex).reverse() : // reversed start lane
				originalCoordinates.slice(pseudoNodeCutIndex + 1): // regular start lane
			(laneIsReversed)?
				originalCoordinates.slice(pseudoNodeCutIndex + 2).reverse() : // reversed end lane
				originalCoordinates.slice(0, pseudoNodeCutIndex) // regular end lane
		;

		if(isStartLane) {
			laneSlice.unshift(pseudoNodeCoordinates);
		} else {
			laneSlice.push(pseudoNodeCoordinates);
		}

		return laneSlice;



		// for(let i=1; i < originalCoordinates.length - 1; i++) {
		// 	const previousCoordinates = originalCoordinates[i - 1];
		// 	const currentCoordinates = originalCoordinates[i];
		// 	const nextCoordinates = originalCoordinates[i + 1];

		// 	const previousLongitude = previousCoordinates[0];
		// 	const previousLatitude = previousCoordinates[1];

		// 	const currentLongitude = currentCoordinates[0];
		// 	const currentLatitude = currentCoordinates[1];

		// 	const nextLongitude = nextCoordinates[0];
		// 	const nextLatitude = nextCoordinates[1];

		// 	const previousLongitudeLessThanCurrent = (previousLongitude < currentLongitude && currentLongitude < nextLongitude)? true : false;
		// 	const previousLongitudeGreaterThanCurrent = (previousLongitude > currentLongitude && currentLongitude > nextLongitude)? true : false;

		// 	const previousLatitudeLessThanCurrent = (previousLatitude < currentLatitude && currentLatitude < nextLatitude)? true : false;
		// 	const previousLatitudeGreaterThanCurrent = (previousLatitude > currentLatitude && currentLatitude > nextLatitude)? true : false;




		// 	// const pseudoNodeLongitudeIncreasing = (previousLongitude < pseudoNodeLongitude && pseudoNodeLongitude < currentLongitude)? true : false;

		// 	const pseudoNodeLongitudeIncreasing = (previousLongitude < pseudoNodeLongitude && pseudoNodeLongitude < currentCoordinates)? true : false;
		// 	const pseudoNodeLongitudeDecreasing = (previousLongitude > pseudoNodeLongitude && pseudoNodeLongitude > currentCoordinates)? true : false;


		// 	const pseudoNodeLongitudeBetweenPointsIncreasing = (previousLongitudeLessThanCurrent && pseudoNodeLongitudeIncreasing)? true : false;

		// 	const pseudoNodeLongitudeBetweenPointsDecreasing = (previousLongitudeGreaterThanCurrent && pseudoNodeLongitudeDecreasing)? true : false;


		// 	const pseudoNodeLongitudeBetweenPoints = (pseudoNodeLongitudeIncreasing || pseudoNodeLongitudeDecreasing)? true : false;





		// 	// const pseudoNodeLatitudeIncreasing = (previousLatitude < pseudoNodeLatitude && pseudoNodeLatitude < currentLatitude)? true : false;
		// 	// const pseudoNodeLatitudeDecreasing = (previousLatitude > pseudoNodeLatitude && pseudoNodeLatitude > currentLatitude)? true : false;

		// 	const pseudoNodeLatitudeIncreasing = (previousLatitude < pseudoNodeLatitude && pseudoNodeLatitude < currentCoordinates)? true : false;
		// 	const pseudoNodeLatitudeDecreasing = (previousLatitude > pseudoNodeLatitude && pseudoNodeLatitude > currentCoordinates)? true : false;



		// 	const pseudoNodeLatitudeBetweenPointsIncreasing = (previousLatitudeLessThanCurrent && pseudoNodeLatitudeIncreasing)? true : false;

		// 	const pseudoNodeLatitudeBetweenPointsDecreasing = (previousLatitudeGreaterThanCurrent && pseudoNodeLatitudeDecreasing)? true : false;



		// 	const pseudoNodeLatitudeBetweenPoints = (pseudoNodeLatitudeIncreasing || pseudoNodeLatitudeDecreasing)? true : false;

		// 	if(pseudoNodeLongitudeBetweenPoints && pseudoNodeLatitudeBetweenPoints) {
		// 		console.log("Current index: ", i - 1);
		// 		console.log("Pseudo Node insertion index found: ", currentCoordinates);

		// 		const laneSlice = (isStartLane)? originalCoordinates.slice(i) : originalCoordinates.slice(0, i);

		// 		if(isStartLane) {
		// 			laneSlice.unshift(pseudoNodeCoordinates);
		// 		} else {
		// 			laneSlice.push(pseudoNodeCoordinates);
		// 		}
				

		// 		console.log("laneSlice: ",  laneSlice);
		// 		return laneSlice;
		// 	}
		// }
		// return [];



	}
};


function getGalacticCoordinatesArray(coordinatesArray) {
	return coordinatesArray.map(coordinate => {
		const lng = coordinate[0];
		const lat = coordinate[1];
		const xGalactic = getGalacticXFromLongitude(lng);
		const yGalactic = getGalacticYFromLatitude(lat);
		return [xGalactic, yGalactic];
	});
}

function calculateLaneDistance(galacticCoordinates) {
	let laneDistane = 0;

	for(let i=0; i < galacticCoordinates.length - 1; i++) {

		const currentCoordinate = galacticCoordinates[i];
		const nextCoordinate = galacticCoordinates[i + 1];

		const distanceBetweenCoordinates = distance(currentCoordinate, nextCoordinate);
		laneDistane += distanceBetweenCoordinates;

	}
	return laneDistane;
}


function getGalacticYFromLatitude(latitude) {
  return  (-3.07e-19*(latitude**12)) + (-1.823e-18*(latitude**11)) + (4.871543e-15*(latitude**10)) + (4.1565807e-14*(latitude**9)) + (-2.900986202e-11 * (latitude**8)) + (-1.40444283864e-10*(latitude**7)) + (7.9614373223054e-8*(latitude**6)) + (7.32976568692443e-7*(latitude**5)) + (-0.00009825374539548058*(latitude**4)) + (0.005511093818675318*(latitude**3)) + (0.04346753629461727 * (latitude**2)) + (111.30155374684914 * latitude);
};

function getGalacticXFromLongitude(longitude) {
  return (111.3194866138503 * longitude);
};


function randomPseudoLaneId() { return Math.floor(Math.random()*90000) + 10000; }


module.exports = HyperSpacePseudoLane;