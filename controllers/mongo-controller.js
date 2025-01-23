const mongoose = require('mongoose');
const Promise = require('bluebird');
mongoose.Promise = Promise;
const DatabaseLinks = require('docker-links').parseLinks(process.env);
const Planet = require('../data-classes/planet.js');
const HyperSpaceLane = require('../data-classes/hyperspace-lane.js');
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
	// var MONGO = 'mongodb://172.31.79.220:27017/test';
	var MONGO = 'mongodb://172.31.79.220:27017/test';
} else {
	// var TILES = 'http://localhost:8110/tiles-leaflet-new/{z}/{x}/{y}.png';
	console.log("mongo failure!!!!");
}


console.log("MONGO: ", MONGO);


function connectToDatabase(cb) {

	mongoose.connect(MONGO);

	const db = mongoose.connection;
	db.on('error', function(error) {
		console.log('connection error:', error);
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

const connectToMongo = Promise.promisify(connectToDatabase);



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
    zoom		   		 : Number,
    link           : String
});
PlanetSchema.set('autoIndex', true);
const PlanetModel = mongoose.model('PlanetModel', PlanetSchema);

const HyperspaceNodeSchema = new Schema({
  system         : String,
  lng            : { type : Number , "default" : null },
  lat            : { type : Number , "default" : null },
	xGalactic      : { type : Number , "default" : null },
	yGalactic      : { type : Number , "default" : null },
  yGalacticLong  : { type : Number , "default" : null },
  xGalacticLong  : { type : Number , "default" : null },
  hyperspaceLanes: { type : Array , "default" : [] },
  nodeId         : { type : Number, "default" : null },
  loc            : { type : Array, "default" : [] },
  geoHash        : String,
  zoom					 : Number,
  emptySpace     : Boolean
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
	coordinates: { type : Array , "default" : [] },
	link: { type : String , "default" : '' }
});
SectorSchema.set('autoIndex', true);
const SectorModel = mongoose.model('SectorModel', SectorSchema);

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
	],
	laneId: Number
});
HyperLaneSchema.set('autoIndex', true);
const HyperLaneModel = mongoose.model('HyperLaneModel', HyperLaneSchema);


const createHyperspaceNode = (HyperspaceNodeCurrent, cb) => {
	HyperspaceNodeModel.find({lat: HyperspaceNodeCurrent.lat, lng: HyperspaceNodeCurrent.lng}).exec()
		.then(hyperspaceNodeData => {
			if(hyperspaceNodeData.length == 0) {
				HyperspaceNodeModel.create(HyperspaceNodeCurrent).exec()
					.then(hyperspaceNodeCreationResult => {
						cb(null, null);
					}).catch(errorCreatingNode => {
						console.log("error adding hyperspace node to database: ", errorCreatingNode);
						cb(error, null);
					});
			} else {
				const result = hyperspaceNodeData[0];
				const foundHyperspaceLane = HyperspaceNodeCurrent.hyperspaceLanes[0];
				let updatedHyperlanes = [];
				if(!result.hyperspaceLanes.includes(foundHyperspaceLane)) {
					updatedHyperlanes = HyperspaceNodeCurrent.hyperspaceLanes.concat(result.hyperspaceLanes);
					HyperspaceNodeModel.findOneAndUpdate({system: result.system}, {hyperspaceLanes: updatedHyperlanes}, {new: true}).exec().then(nodeAddedData => {
							console.log("Hyperspace Node has added hyperspace lane: ", nodeAddedData);
							cb(null, null);
					}).catch(errNodeAdd => {
							console.log("error adding node: ", errNodeAdd);
							cb(errNodeAdd, null);
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
		}).catch(hyperspaceNodeError => {
			cb(err, null);
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

const findOneHyperspaceNodeAsync = async (SearchItem) => {
	try {
		return await HyperspaceNodeModel.findOne(SearchItem).exec();
	} catch(err) {
		console.log("error updating hyperspace node: ", err);
		throw new Error(400);
	}
};

const findOnePlanet = async (SearchItem) => {
	try {
		const PlanetPromise = await PlanetModel.findOne(SearchItem).exec();
		PlanetPromise.then(planetData => {
			if(planetData === null) {
				return {status: false, doc: null};
			} else {
				return {status: true, doc: planetData};
			}
		});
	} catch(err) {
		console.log("error updating planet: ", err);
		throw new Error(400);
	}
};

const emptyCollections = async () => {
	console.log("emptyCollections has fired..");
	const databasePromiseArray = [
		await PlanetModel.remove({}).exec(),
		await CoordinateModel.remove({}).exec(),
		await HyperLaneModel.remove({}).exec(),
		await SectorModel.remove({}).exec(),
		await HyperspaceNodeModel.remove({}).exec()
	];
	Promise.all(databasePromiseArray).then(() => {
    console.log("all the collections were cleared");
	}).catch(error => {
	  console.log("error clearing all the collections");
	});	
};

const findHyperspaceNodeAndUpdate = async (SearchItem, UpdateItem) => {
	try {
		return await HyperspaceNodeModel.findOneAndUpdate(SearchItem, UpdateItem, {new: true}).exec();
	} catch(err) {
		console.log("error updating hyperspace node: ", err);
	}
};

const getAllHyperspaceNodes = async () => {
	try {
		return await HyperspaceNodeModel.find({}).exec();
	} catch(err) {
		console.log("error getting all hyperspace nodes: ", err);
	}
};

const getAllPlanets = async () => {
	try {
		return await PlanetModel.find({}).exec();
	} catch(err) {
		console.log("error getting all planets: ", err);
	}
};

const findPlanetAndUpdate = async (SearchItem, UpdateItem) => {
	try {
		return await PlanetModel.findOneAndUpdate(SearchItem, UpdateItem, {new: true}).exec();
	} catch(err) {
		console.log("error getting all planets: ", err);
	}
};

const findHyperspaceLaneAndUpdate = async (SearchItem, UpdateItem) => {
	try {
		return await HyperLaneModel.findOneAndUpdate(SearchItem, UpdateItem, {new: true}).exec();
	} catch(err) {
		console.log("error uploading hyperspace: ", error);
	}
};

const createHyperspaceLane = async (HyperSpaceLaneCurrent) => {
	try {
		return await HyperLaneModel.create(HyperSpaceLaneCurrent).exec();
	} catch(err) {
		console.log("error uploading hyperspace: ", error);
	}
};

const getAllHyperspaceLanes = async () => {
	try {
		return await HyperLaneModel.find({}).exec();
	} catch(err) {
		console.log("error getting all hyperspace lanes: ", err);
	}
};

const totalHyperspaceNodes = async () => {
	try {
		return await HyperspaceNodeModel.count({}).exec();
	} catch(err) {
		console.log("error getting total hyperspace nodes: ", err);
	}
};

const totalPlanets = async () => {
	try {
		return await PlanetModel.count({}).exec();
	} catch(err) {
		console.log("error getting total planets: ", err);
	}
};

const totalPlanetsHasLocation = async () => {
	try {
		return await PlanetModel.count({hasLocation: true}).exec();
	} catch(err) {
		console.log("error getting total planets with a location: ", err);
	}
};

const createPlanet = async (PlanetCurrent) => {
	try {
		return await PlanetModel.create(PlanetCurrent).exec();
	} catch(err) {
		console.log("error adding planet to database: ", err);
	}
};

const totalHyperspaceLanes = async () => {
	try {
		return await HyperLaneModel.count({}).exec();
	} catch(err) {
		console.log("error getting total hyperspace lanes: ", err);
	}
};

const createSector = async (sector) => {
	try {
		return await SectorModel.create({name: sector}).exec();
	} catch(err) {
		console.log("error adding sector to database: ", err);
	}
};

const totalSectors = async () => {
	try {
		return await SectorModel.count({}).exec();
	} catch(err) {
		console.log("error getting total sectors from the database: ", err);
	}
};

const createCoordinate = async (coordinateValue) => {
	try {
		return await CoordinateModel.create({coordinates: coordinateValue}).exec();
	} catch(err) {
		console.log("error adding coordinates to database: ", err);
	}
};

const totalCoordinates = async () => {
	try {
		return await CoordinateModel.count({}).exec();
	} catch(err) {
		console.log("error getting total coordinates: ", err);
	}
};

const searchCoordinate = async (currentCoordinates) => {
	try {
		return await PlanetModel.find({coordinates: currentCoordinates}).exec();
	} catch(err) {
		console.log("error searching coordinates: ", err);
	}
};


module.exports = {
	connectToDatabase: connectToDatabase,
	connectToMongo: connectToMongo,
	createHyperspaceNode: createHyperspaceNode,
	totalHyperspaceNodes: totalHyperspaceNodes,
	findHyperspaceNodeAndUpdate: findHyperspaceNodeAndUpdate,
	findOneHyperspaceNode: findOneHyperspaceNode,
	findOneHyperspaceNodeAsync: findOneHyperspaceNodeAsync,
	emptyCollections: emptyCollections,
	totalPlanets: totalPlanets,
	totalCoordinates: totalCoordinates,
	totalSectors: totalSectors,
	getAllPlanets: getAllPlanets,
	getAllHyperspaceNodes: getAllHyperspaceNodes,
	searchCoordinate: searchCoordinate,
	findPlanetAndUpdate: findPlanetAndUpdate,
	findOnePlanet: findOnePlanet,
	findHyperspaceLaneAndUpdate: findHyperspaceLaneAndUpdate,
	totalPlanetsHasLocation: totalPlanetsHasLocation,
	createPlanet: createPlanet,
	createHyperspaceLane: createHyperspaceLane,
	totalHyperspaceLanes: totalHyperspaceLanes,
	getAllHyperspaceLanes: getAllHyperspaceLanes,
	createSector: createSector,
	createCoordinate: createCoordinate
};

