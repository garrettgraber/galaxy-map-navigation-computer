const  _ = require('lodash'),
	hash = require('string-hash');


class HyperSpacePath {
	constructor(start, end, length, jumps, nodes, hashValue = '', numberOfJumps = null) {
		this.start = start;
		this.end = end;
		this.length = length;
		this.jumps = jumps;
		this.nodes = nodes;
		this.hashValue = hashValue;
		this.numberOfJumps = numberOfJumps;
	}

	createArrayOfHyperspaceLanes(totalLanesInCollection) {
		const hyperspaceLanesArray = [];
		for(let id of this.jumps) {
			let foundLaneData = _.find(totalLanesInCollection, {_id : id});
			hyperspaceLanesArray.push(foundLaneData);
		}
		return hyperspaceLanesArray;
	}

	createArrayOfHyperspaceNodes(totalNodesInCollection) {
		const hyperspaceNodesArray = [];
		for(let id of this.nodes) {
			let foundNodeData = _.find(totalNodesInCollection, {_id : id});
			hyperspaceNodesArray.push(foundNodeData);
		}
		return hyperspaceNodesArray;
	}

	getReversedHyperLanes(totalLanesInCollection, totalNodesInCollection) {
		let reverseLanesSet = new Set();
		let correctLanesSet = new Set();
		for(let i=0; i < this.jumps.length; i++) {
			const jumpLaneId = this.jumps[i];
			let JumpLane = _.find(totalLanesInCollection, { '_id': jumpLaneId });
			const start = this.nodes[i];
			const end = this.nodes[i + 1];
			if(start !== JumpLane._start) {
				reverseLanesSet.add(JumpLane._id);
				this.jumps[i] =  (JumpLane._id > 2000)? (JumpLane._id) : -(JumpLane._id);
			} else {
				correctLanesSet.add(JumpLane._id);
			}
			let intersection = new Set([...reverseLanesSet].filter(x => correctLanesSet.has(x)));
		}
		const reversedLanes = [...reverseLanesSet];
		return reversedLanes;
	}

	generateHashNumber(totalLanesInCollection) {
		let sumOfHashes = '|';
		for(let i=0; i < this.jumps.length; i++) {
			const jumpLaneId = this.jumps[i];
			let JumpLane = _.find(totalLanesInCollection, { '_id': jumpLaneId });
			const jumpLaneHash = JumpLane.hyperspaceHash;
			sumOfHashes += jumpLaneHash + '|';
		}
		const jumpHash = hash(sumOfHashes);
		return jumpHash;
	}

	validateJump(totalLanesInCollection, totalNodesInCollection) {
		if(this.jumps.length + 1 === this.nodes.length) {
			for(let i=0; i < this.jumps.length; i++) {
				const jumpLaneId = this.jumps[i];
				let JumpLane = _.find(totalLanesInCollection, { '_id': jumpLaneId });
				const startId = this.nodes[i];
				let StartNode = _.find(totalNodesInCollection, { 'nodeId': startId });
				const endId = this.nodes[i + 1];
				let EndNode = _.find(totalNodesInCollection, { 'nodeId': endId });
				const jumpStartCoordinates = JumpLane.startCoordsLngLat;
				const jumpEndCoordinates = JumpLane.endCoordsLngLat;
				const firstCoordinates = JumpLane.coordinates[0];
				const secondCoordinates = JumpLane.coordinates[JumpLane.coordinates.length - 1];
				const startSystemIsInvalid = StartNode.system !== JumpLane.start;
				const endSystemIsInvalid = EndNode.system !== JumpLane.end;
				const startCoordsLngLatIsInvalid = !_.isEqual(jumpStartCoordinates, firstCoordinates);
				const endCoordsLngLatIsInvalid = !_.isEqual(jumpEndCoordinates, secondCoordinates);
				
				// const jumpInvalid = startSystemIsInvalid || endSystemIsInvalid || startCoordsLngLatIsInvalid || endCoordsLngLatIsInvalid;

				const jumpInvalid = startCoordsLngLatIsInvalid || endCoordsLngLatIsInvalid;

				// const startIsInvalid = (
				// 	StartNode.system !== JumpLane.start ||
				// 	!_.isEqual(jumpStartCoordinates, firstCoordinates)
				// );
				// const endIsInvalid = (
				// 	EndNode.system !== JumpLane.end ||
				// 	!_.isEqual(jumpEndCoordinates, secondCoordinates)
				// );
				
				if(jumpInvalid) {
					console.log("Invalid jump lane: ", JumpLane);
					console.log("StartNode: ", StartNode);
					console.log("EndNode: ", EndNode);
					console.log("startSystemIsInvalid: ", startSystemIsInvalid);
					console.log("endSystemIsInvalid: ", endSystemIsInvalid);
					console.log("startCoordsLngLatIsInvalid: ", startCoordsLngLatIsInvalid);
					console.log("endCoordsLngLatIsInvalid: ", endCoordsLngLatIsInvalid);
					return false;
				}
			}
			return true;
		} else {
			return false;
		}
	}
};

module.exports = HyperSpacePath;