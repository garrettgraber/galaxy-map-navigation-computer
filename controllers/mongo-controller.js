

const mongoose = require('mongoose');
const DatabaseLinks = require('docker-links').parseLinks(process.env);
const Planet = require('../data-classes/classes.js').Planet;
const HyperSpaceLane = require('../data-classes/classes.js').HyperSpaceLane;
const Alphabets = require('../data-classes/alphabets.js');
const Schema = mongoose.Schema;



console.log("DatabaseLinks: ", DatabaseLinks);
console.log("NODE_ENV: ", process.env.NODE_ENV);
const isDeveloping = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
console.log("isProduction: ", isProduction);


if(DatabaseLinks.hasOwnProperty('mongo') && isDeveloping) {
  	var MONGO = 'mongodb://' + DatabaseLinks.mongo.hostname + ':' + DatabaseLinks.mongo.port;
} else if (isProduction) {
	var MONGO = 'mongodb://172.31.40.234:27017/test';
} else {
	// var TILES = 'http://localhost:8110/tiles-leaflet-new/{z}/{x}/{y}.png';
	console.log("mongo failure!!!!");
}




console.log("MONGO: ", MONGO);



function connectToDatabase(cb) {

	mongoose.connect(MONGO);

	const db = mongoose.connection;
	db.on('error', function(error) {
		console.error.bind(console, 'connection error:');
		cb(error, {status: false, database:{}});
	});
	db.once('open', function() {
	  // we're connected!
	  	console.log("connected to mongo database ");


	  	cb(null, {
	  		status: true,
	  		database: db,
	  	});
	});
};




const PlanetSchema = new Schema({
    system         : String,
    sector         : { type : Array , "default" : [] },
    region         : String,
    coordinates    : String,
    xGalactic      : Number,
    yGalactic      : Number,
    xGalacticLong  : Number,
    yGalacticLong  : Number,
    hasLocation    : { type : Boolean, "default": false },
    LngLat         : { type : Array , "default" : [] },
    lng            : { type : Number , "default" : null },
    lat            : { type : Number , "default" : null },
    zoom		   : Number,
    link           : String
});

PlanetSchema.set('autoIndex', true);

const PlanetModel = mongoose.model('PlanetModel', PlanetSchema);




const HyperspaceNodeSchema = new Schema({
    system         : String,
    lng            : { type : Number , "default" : null },
    lat            : { type : Number , "default" : null },
    yGalacticLong  : { type : Number , "default" : null },
    xGalacticLong  : { type : Number , "default" : null },
    hyperspaceLanes: { type : Array , "default" : [] },
    nodeId         : { type : Number, "default" : null },
    loc            : { type : Array, "default" : [] }
});

HyperspaceNodeSchema.set('autoIndex', true);
HyperspaceNodeSchema.index({ loc: '2d' });

const HyperspaceNodeModel = mongoose.model('HyperspaceNodeModel', HyperspaceNodeSchema);




const CoordinateSchema = new Schema({
	coordinates: String,
});

CoordinateSchema.set('autoIndex', true);

const CoordinateModel = mongoose.model('CoordinateModel', CoordinateSchema);


const SectorSchema = new Schema({
	name: String,
});

SectorSchema.set('autoIndex', true);

const SectorModel = mongoose.model('SectorModel', SectorSchema);


// const HyperLaneSchema = new Schema({
// 	name: String,
// 	hyperspaceHash: String,
// 	start: String,
// 	end: String,
// 	startCoordsLngLat: { type : Array , "default" : [] },
// 	endCoordsLngLat: { type : Array , "default" : [] },
// 	length: Number,
// 	link: String
// });


const HyperLaneSchema = new Schema({
	name: String,
	hyperspaceHash: String,
	start: String,
	end: String,
	startCoordsLngLat: { type : Array , "default" : [] },
	endCoordsLngLat: { type : Array , "default" : [] },
	length: Number,
	link: String,
	startNodeId: { type : Object, "default" : {} },
	endNodeId: { type : Object, "default" : {} },
	coordinates: [
		[Number, Number]
	]
});

HyperLaneSchema.set('autoIndex', true);

const HyperLaneModel = mongoose.model('HyperLaneModel', HyperLaneSchema);


const createHyperspaceNode = (HyperspaceNodeCurrent, cb) => {

	HyperspaceNodeModel.find({lat: HyperspaceNodeCurrent.lat, lng: HyperspaceNodeCurrent.lng}, function(err, docs) {

	 	if(err) {

	 		cb(err, null);

	 	} else if(docs.length == 0) {

			HyperspaceNodeModel.create(HyperspaceNodeCurrent, function(error, result) {

				if(error) {
					console.log("error adding hyperspace node to database: ", error);
					cb(error, null);
				} else {
					// console.log("hyperspace node added successfully to database: ", HyperspaceNodeCurrent.system);
					cb(null, null);
				}
			});

		} else {

			const result = docs[0];
			const foundHyperspaceLane = HyperspaceNodeCurrent.hyperspaceLanes[0];
			let updatedHyperlanes = [];

			if(!result.hyperspaceLanes.includes(foundHyperspaceLane)) {

				updatedHyperlanes = HyperspaceNodeCurrent.hyperspaceLanes.concat(result.hyperspaceLanes);

				HyperspaceNodeModel.findOneAndUpdate({system: result.system}, {hyperspaceLanes: updatedHyperlanes}, {new: true}, function(errLaneAdd, docLaneAdd){
					if(errLaneAdd) {
						console.log("errLaneAdd: ", errLaneAdd);
						cb(errLaneAdd, null);
					} else {
						// console.log("Hyperspace Node has added hyperspace lane: ", docLaneAdd);
						cb(null, null);
					}
				});

			} else {

				if(result.system !== HyperspaceNodeCurrent.system) {

					console.log("\nresult.system: ", result.system);
					console.log("HyperspaceNodeCurrent.system: ", HyperspaceNodeCurrent.system);
					cb(null, result.system);


				} else {

					cb(null, null);

				}

			}

		}

	});

};




const findHyperspaceNodeAndUpdate = (SearchItem, UpdateItem, cb) => {

	HyperspaceNodeModel.findOneAndUpdate(SearchItem, UpdateItem, {new: true}, function(err, doc){
		if(err) {
			// console.log("err: ", err);
			cb(err, {});
		} else {
			// console.log("System has added coordinates: ", doc);
			cb(null, doc);
		}
	});		
};



const findOneHyperspaceNode = (SearchItem, cb) => {

	HyperspaceNodeModel.findOne(SearchItem,function(err, doc){

		if(err) {

			cb(err, {status: false, doc: null});

		} else if(doc === null) {

			cb(null, {status: false, doc: doc});

		} else {

			cb(null, {status: true, doc: doc});

		}

	});		
};



const getAllHyperspaceNodes = (cb) => {

	HyperspaceNodeModel.find({}, function (err, docs) {
	  // docs.forEach
		if(err) {
			console.log("error getting all hyperspace nodes: ", err);
			cb(err, {});
		} else {
			cb(null, docs);
		}

	});
};




const totalHyperspaceNodes = () => {

	HyperspaceNodeModel.count({}, function(err, count) {

		console.log("Total Hyperspace Nodes in Database: ", count);

	});
};



const emptyCollections = () => {

	console.log("emptyCollections has fired..");

	PlanetModel.remove({}, function (err, result) {
		if (err) {
			console.log("error emptying collection: ", err);
		} else {
			// console.log("PlanetModel: ", result);
		}
		// removed!
	});

	CoordinateModel.remove({}, function (err, result) {
		if (err) {
			console.log("error emptying collection: ", err);
		} else {
			// console.log("CoordinateModel: ", result);
		}
		// removed!
	});

	HyperLaneModel.remove({}, function (err, result) {
		if (err) {
			console.log("error emptying collection: ", err);
		} else {
			// console.log("CoordinateModel: ", result);
		}
		// removed!
	});

	SectorModel.remove({}, function (err, result) {
		if (err) {
			console.log("error emptying collection: ", err);
		} else {
			// console.log("CoordinateModel: ", result);
		}
		// removed!
	});	
};


const totalPlanets = () => {

	PlanetModel.count({}, function(err, count) {

		console.log("Total Planets in Database: ", count);

	});
};

const totalPlanetsHasLocation = () => {

	PlanetModel.count({hasLocation: true}, function(err, count) {

		console.log("Total Planets with Lng and Lat in Database: ", count);

	});	
};

const getAllPlanets = (cb) => {

	PlanetModel.find({}, function (err, docs) {
	  // docs.forEach
		if(err) {
			console.log("error getting all planets: ", err);
			cb(err, {});
		} else {
			cb(null, docs);
		}

	});
};

const searchCoordinate = (currentCoordinates) => {

	// console.log("req.query: ", req.query);

	// var system = req.params('system');
	// var region = req.params('region');
	// var sector = req.params('sector');
	// var coordinates = req.params('coordinates');

	PlanetModel.find({coordinates: currentCoordinates}, function(err, docs) {
	  // docs.forEach
	 	// console.log("hidden coordinates: ", docs);
	});
};

const createPlanet = (PlanetCurrent) => {

	PlanetModel.create(PlanetCurrent, function(error, result) {

		if(error) {
			console.log("error adding planet to database: ", error);
		} else {
			// console.log("planet added successfully to database: ", result);
		}
	});
};

const findPlanetAndUpdate = (SearchItem, UpdateItem, cb) => {

	PlanetModel.findOneAndUpdate(SearchItem, UpdateItem, {new: true}, function(err, doc){
		if(err) {
			// console.log("err: ", err);
			cb(err, {});
		} else {
			// console.log("System has added coordinates: ", doc);
			cb(null, doc);
		}
	});		
};

const findOnePlanet = (SearchItem, cb) => {

	PlanetModel.findOne(SearchItem, function(err, doc) {

		if(err) {

			cb(err, {status: false, doc: null});

		} else if(doc === null) {

			cb(null, {status: false, doc: null});

		} else {

			cb(null, {status: true, doc: doc});

		}

	});
};

const createHyperspaceLane = (HyperSpaceLaneCurrent, cb) => {

	HyperLaneModel.create(HyperSpaceLaneCurrent, function(error, result) {

		if(error) {
			console.log("error uploading hyperspace: ", error);
			cb(error, {});
		} else {
			// console.log("\nhyperspace lane created: ", result);
			cb(null, result);
		}

	});
};



const getAllHyperspaceLanes = (cb) => {

	HyperLaneModel.find({}, function (err, docs) {
	  // docs.forEach
		if(err) {
			console.log("error getting all hyperspace lanes: ", err);
			cb(err, {});
		} else {
			cb(null, docs);
		}

	});
};




const totalHyperspaceLanes = () => {

	HyperLaneModel.count({}, function(err, count) {

		console.log("Total Hyperspace Lanes in Database: ", count);

	});
};


const createSector = (sector) => {

	SectorModel.create({name: sector}, function(error, result) {

		if(error) {
			console.log("error adding sector to database: ", error);
		} else {
			// console.log("sector added successfully to database: ", result);

			
		}
	});
};

const totalSectors = () => {

	SectorModel.count({}, function(err, count) {

		console.log("Number of sectors in database: ", count);

	});
};

const createCoordinate = (coordinateValue) => {

	CoordinateModel.create({coordinates: coordinateValue}, function(error, result) {

		if(error) {

			console.log("error adding coordinates to database: ", error);

		} else {

			// console.log("coordinates added to database: ", result);
		}

	});
};

const totalCoordinates = () => {

	CoordinateModel.count({}, function(err, count) {

		console.log("Total Coordinates in Database: ", count);

	});
};



module.exports = {
	connectToDatabase: connectToDatabase,
	createHyperspaceNode: createHyperspaceNode,
	totalHyperspaceNodes: totalHyperspaceNodes,
	findHyperspaceNodeAndUpdate: findHyperspaceNodeAndUpdate,
	findOneHyperspaceNode: findOneHyperspaceNode,
	emptyCollections: emptyCollections,
	totalPlanets: totalPlanets,
	totalCoordinates: totalCoordinates,
	totalSectors: totalSectors,
	getAllPlanets: getAllPlanets,
	getAllHyperspaceNodes: getAllHyperspaceNodes,
	searchCoordinate: searchCoordinate,
	findPlanetAndUpdate: findPlanetAndUpdate,
	findOnePlanet: findOnePlanet,
	totalPlanetsHasLocation: totalPlanetsHasLocation,
	createPlanet: createPlanet,
	createHyperspaceLane: createHyperspaceLane,
	totalHyperspaceLanes: totalHyperspaceLanes,
	getAllHyperspaceLanes: getAllHyperspaceLanes,
	createSector: createSector,
	createCoordinate: createCoordinate
};

