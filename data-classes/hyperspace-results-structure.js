const generateStarPathCollection = require('../factories/generate-star-path-collection.js');


class HyperSpaceResultsStructure {
	constructor(start, end, lanes, nodes, distance) {
		this.start = start;
		this.end = end;
		this.lanes = lanes;
		this.nodes = nodes;
		this.distance = distance;
	}

	totalJumps() { return this.lanes.length }

	hyperspaceSingleJump() {
		let hyperspaceNodesSet = new Set();
		let hyperspaceLanesSet = new Set();
		const hyperspaceRoutes = [];
		const hyperspaceRoutesLength = [];
		const hyperspaceRoutesNodes = [];
		const distance = this.distance;

		console.log("Distance: ", distance);
		console.log("Total Jumps: ", this.totalJumps());

		hyperspaceRoutes.push(this.lanes);
		hyperspaceRoutesNodes.push(this.nodes);
		let lanesSet = new Set(this.lanes);
		let nodesSet = new Set(this.nodes);
		hyperspaceLanesSet = new Set([...hyperspaceLanesSet, ...lanesSet]);
		hyperspaceNodesSet = new Set([...hyperspaceNodesSet, ...nodesSet]);
		hyperspaceRoutesLength.push(distance);

		this.hyperspaceLanesSet = hyperspaceLanesSet;
		this.hyperspaceNodesSet = hyperspaceNodesSet;
		this.hyperspaceRoutes = hyperspaceRoutes;
		this.hyperspaceRoutesLength = hyperspaceRoutesLength;
		this.hyperspaceRoutesNodes = hyperspaceRoutesNodes;
	}

	pathCollectionOptions() {
		return {
			start: this.start,
			end: this.end,
			hyperspaceLanesSet: this.hyperspaceLanesSet,
			hyperspaceNodesSet: this.hyperspaceNodesSet,
			hyperspaceRoutes: this.hyperspaceRoutes,
			hyperspaceRoutesLength: this.hyperspaceRoutesLength,
			hyperspaceRoutesNodes: this.hyperspaceRoutesNodes
		};
	}

	async generateStarPathCollection(db) { 
		return await generateStarPathCollection(this.pathCollectionOptions(), db);
	}
};


module.exports = HyperSpaceResultsStructure;
