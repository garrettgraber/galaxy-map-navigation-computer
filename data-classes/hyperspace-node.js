class HyperSpaceNode {
	constructor(system, lng, lat, hyperspaceLanes, nodeId, xGalacticLong, yGalacticLong, geoHash) {
		this.system = system;
		this.lng = lng;
		this.lat = lat;
		this.hyperspaceLanes = hyperspaceLanes;
		this.nodeId = nodeId;
		this.xGalacticLong = xGalacticLong;
		this.yGalacticLong = yGalacticLong;
		this.geoHash = geoHash;
	}
};

module.exports = HyperSpaceNode;