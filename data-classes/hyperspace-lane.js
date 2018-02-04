class HyperSpaceLane {
	constructor(
		name,
		hyperspaceHash,
		start,
		end,
		startCoordsLngLat,
		endCoordsLngLat,
		length,
		link,
		_start,
		_end,
		coordinates,
		_id = 0
		) {
		this.name = name || "No Name";
		this.hyperspaceHash = hyperspaceHash;
		this.start = start;
		this.end = end;
		this.startCoordsLngLat = this.coordinateStringToArray(startCoordsLngLat);
		this.endCoordsLngLat = this.coordinateStringToArray(endCoordsLngLat);
		this.length = length;
		this.link = link || "No Link";
		this._start = _start;
		this._end = _end;
		this.coordinates = this.coordinateStringToArray(coordinates);
		this._id = _id;
	}

	coordinateStringToArray(coordinates) {
		if(Array.isArray(coordinates)) {
			return coordinates;
		} else {
			let jsonJumpCoordinates = JSON.parse("[" + coordinates + "]");
			return jsonJumpCoordinates[0];			
		}
	}
};


module.exports = HyperSpaceLane;