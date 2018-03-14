class HyperSpaceNode {
	constructor(Options) {
		this.system = Options.system;
		this.lng = Options.lng;
		this.lat = Options.lat;
		this.hyperspaceLanes = Options.hyperspaceLanes;
		this.nodeId = Options.nodeId;
		this.xGalacticLong = Options.xGalacticLong;
		this.yGalacticLong = Options.yGalacticLong;
		this.xGalactic = Options.xGalactic;
		this.yGalactic = Options.yGalactic;
		this.geoHash = Options.geoHash;
		this.zoom = Options.zoom;
		this.emptySpace = Options.emptySpace;
	}
};

module.exports = HyperSpaceNode;