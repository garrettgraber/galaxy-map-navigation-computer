const NeoController = require('../controllers/neo4j-controller.js');

console.log("Building hyperspace graph");

NeoController.buildNeo4jDatabaseAsync().then(buildStatus => {
	console.log("status of build: ", buildStatus);
	process.exit();
}).catch(error => {
	console.log("buildNeo4jDatabase error: ", error);
});
