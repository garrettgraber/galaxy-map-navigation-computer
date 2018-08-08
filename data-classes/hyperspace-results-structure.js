const _ = require('lodash');
const generateStarPathCollection = require('../factories/generate-star-path-collection.js');


class HyperSpaceResultsStructure {
	constructor(Options) {
		this.start = Options.start;
		this.end = Options.end;
		this.lanes = Options.lanes;
		this.nodes = Options.nodes;
		this.distance = Options.distance;
		this.StartPseudoNode = Options.StartPseudoNode;
		this.StartPseudoLane = Options.StartPseudoLane;
		this.EndPseudoNode = Options.EndPseudoNode;
		this.EndPseudoLane = Options.EndPseudoLane;


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

		const hyperspaceLanes = this.lanes;
		const hyperspaceNodes = this.nodes;
		


		if(!_.isEmpty(this.StartPseudoNode)) {
			hyperspaceNodes.unshift(this.StartPseudoNode.nodeId);
			hyperspaceLanes.unshift(this.StartPseudoLane._id);
		}

		if(!_.isEmpty(this.EndPseudoNode)) {
			hyperspaceNodes.push(this.EndPseudoNode.nodeId);
			hyperspaceLanes.push(this.EndPseudoLane._id);
		}


		let lanesSet = new Set(hyperspaceLanes);
		let nodesSet = new Set(hyperspaceNodes);
		hyperspaceLanesSet = new Set([...hyperspaceLanesSet, ...lanesSet]);
		hyperspaceNodesSet = new Set([...hyperspaceNodesSet, ...nodesSet]);
		hyperspaceRoutesLength.push(distance);


		hyperspaceRoutesNodes.push(hyperspaceNodes);
		hyperspaceRoutes.push(hyperspaceLanes);


		// console.log("hyperspaceRoutesNodes: ", hyperspaceRoutesNodes);
		// console.log("hyperspaceRoutes: ", hyperspaceRoutes);

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
			hyperspaceRoutesNodes: this.hyperspaceRoutesNodes,
			PseudoStartNode: this.StartPseudoNode,
			PseudoStartLane: this.StartPseudoLane,
			PseudoEndNode: this.EndPseudoNode,
			PseudoEndLane: this.EndPseudoLane
		};
	}

	async generateStarPathCollection(db) { 
		return await generateStarPathCollection(this.pathCollectionOptions(), db);
	}
};


module.exports = HyperSpaceResultsStructure;
