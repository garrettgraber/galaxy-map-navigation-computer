const _ = require('lodash'),
	uuidv4 = require('uuid/v4');

const HyperSpaceLane = require('./hyperspace-lane.js');
const HyperSpacePath = require('./hyperspace-path.js');

class HyperSpacePathCollection {
	constructor(start, end, lanes, nodes, hyperspaceRoutes, hyperspaceRoutesLength, hyperspaceRoutesNodes) {
		this.start = start;
		this.end = end;
		this.paths = [];
		this.lanes = lanes;
		this.nodes = nodes;
		this.hyperspaceRoutes = hyperspaceRoutes;
		this.hyperspaceRoutesLength = hyperspaceRoutesLength;
		this.hyperspaceRoutesNodes = hyperspaceRoutesNodes;
	}

	generatePaths() {
		for(let i=0; i < this.hyperspaceRoutes.length; i++) {
	    let routes = this.hyperspaceRoutes[i];
	    let distance = this.hyperspaceRoutesLength[i];
	    let nodes = this.hyperspaceRoutesNodes[i];
	    const StarPath = new HyperSpacePath(this.start, this.end, distance, routes, nodes, '', routes.length);
	    this.paths.push(StarPath);
	  }
	}

	linkHyperspacePaths() {
		let laneSet = new Set([...this.lanes]);
		let indexSet = new Set();
  	for(let path of this.paths) {
  		let reversedHyperspaceLanes = path.getReversedHyperLanes(this.lanes, this.nodes);
  		for(let reversedLaneId of reversedHyperspaceLanes) {
  			const index = _.findIndex(this.lanes, {_id: reversedLaneId});
  			indexSet.add(index);
  		}
  	}
		for(let index of indexSet) {
			const JumpLane = this.lanes[index];
			const reversedJumpId = -Math.abs(JumpLane._id);
			const jumpCoordinatesReversed = JumpLane.coordinates.slice().reverse();
			const hyperspaceHash = uuidv4();
			const ReversedHyperspaceLane = new HyperSpaceLane(
				JumpLane.name,
				hyperspaceHash,
				JumpLane.end,
				JumpLane.start,
				JumpLane.endCoordsLngLat,
				JumpLane.startCoordsLngLat,   
				JumpLane.length,
				JumpLane.link,
				JumpLane._end,
				JumpLane._start,
				jumpCoordinatesReversed,
				reversedJumpId
			);
  		this.lanes.push(ReversedHyperspaceLane);
  		const newIndex = _.findIndex(this.lanes, {_id: reversedJumpId});
		}
		this.validateJumps();
	}

	validateJumps() {
		console.log("\n\nValidating all jumps  **************");
		for(let path of this.paths) {
			const pathIsValid = path.validateJump(this.lanes, this.nodes);
			const jumpHashValue = (pathIsValid)? path.generateHashNumber(this.lanes) : '';
			console.log("path is valid: ", pathIsValid);
			path.hashValue = jumpHashValue;
		}
	}
};

module.exports = HyperSpacePathCollection;