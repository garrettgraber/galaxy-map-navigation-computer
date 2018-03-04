class HyperSpaceNode {
	constructor(system, lng, lat, hyperspaceLanes, nodeId, xGalacticLong, yGalacticLong, geoHash, zoom, emptySpace) {
		this.system = system;
		this.lng = lng;
		this.lat = lat;
		this.hyperspaceLanes = hyperspaceLanes;
		this.nodeId = nodeId;
		this.xGalacticLong = xGalacticLong;
		this.yGalacticLong = yGalacticLong;
		this.geoHash = geoHash;
		this.zoom = zoom;
		this.emptySpace = emptySpace;
	}
};

module.exports = HyperSpaceNode;