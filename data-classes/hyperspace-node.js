class HyperSpaceNode {
	constructor(system, lng, lat, hyperspaceLanes, nodeId, xGalacticLong, yGalacticLong) {
		this.system = system;
		this.lng = lng;
		this.lat = lat;
		this.hyperspaceLanes = hyperspaceLanes;
		this.nodeId = nodeId;
		this.xGalacticLong = xGalacticLong;
		this.yGalacticLong = yGalacticLong;
	}
};

module.exports = HyperSpaceNode;