
const fs = require('fs'),
	_ = require('lodash'),
    async = require('async'),
    neo4j = require('neo4j-driver').v1;

const express = require('express');
const cors = require('cors');
const ip = require('ip');
const bodyParser = require('body-parser');

const NeoController = require('./controllers/neo4j-controller.js');

console.log("NeoController: ", NeoController);

const serverPort = 8117;
const app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const utcTimeZoneOffset = -7;

app.use(function(req, res, next) {

	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});




// app.use(cors());
// const corsOptions = {
//   origin: api
// }

// app.use(cors(corsOptions))

app.get('/', function(req, res) {

	console.log("navi-computer server...");
	       
	res.sendStatus(200);

});



app.post('/hyperspace-jump/calc-shortest', function(req, res) {

	console.log("calculate hyperspace jump: ", req.body);

	const JumpData = req.body;

	NeoController.findShortestHyperspacePath(JumpData, (error, result) => {
	    if(error) {
			console.log("error: ", error);
			res.sendStatus(500);
	    } else {
	    	console.log("Shortest hyperspace paths results!!: ");
				// res.sendStatus(200);
			res.json(result);
	    }
	});
	       
});




app.post('/hyperspace-jump/calc-many', function(req, res) {

	console.log("calculate hyperspace jump: ", req.body);

	const JumpData = req.body;

	NeoController.findManyHyperspacePaths(JumpData, (error, result) => {
	    if(error) {
				console.log("error: ", error);
				res.sendStatus(500);
	    } else {
	    	// console.log("Many hyperspace paths result!!: ", result);

	    	// let laneSet = new Set();

	    	// for(let path of result.paths) {

	    	// 	let reversedHyperspaceLanes = path.validateJumpAndSend(result.lanes, result.nodes);

	    	

	    	// }

	    	// console.log("path start: ", result.start);
	    	// console.log("path end: ", result.end);

	    	// console.log("laneSet size: ", laneSet.size);

				// res.sendStatus(200);
			res.json(result);
	    }
	});
	       
});



app.listen(serverPort, ip.address(), function () {

	console.log('Example app listening on port http://' + ip.address() + ':' +  serverPort + '!');

});

