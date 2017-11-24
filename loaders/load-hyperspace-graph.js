

const NeoController = require('../controllers/neo4j-controller.js');

console.log("NeoController in load-hyperspace-graph: ", NeoController);

console.log("Building hyperspace graph");


NeoController.buildNeo4jDatabase(function(error, buildStatus) {
	if(error) {
		console.log("buildNeo4jDatabase error: ", error);
	} else {
		console.log("status of build: ", buildStatus);

		process.exit();

		// NeoController.testNeo4jDatabase(function(testError, testResult) {
		// 	console.log("testResult: ", testResult);
		// 	process.exit();
		// });
	}
});

