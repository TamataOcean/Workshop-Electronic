/* Manage Script to 
- Listen to Mqtt Broker
- On message
- Analyse message Type ( Sensor, jetpack, ConfigSys, RtcConfig... )
- Request for save on Mongo
- Request for save on InFlux
- If Internet connected, send to Cloud Mqtt Broker
- Winston Logger to get last actions... ( Debug process )
*/
var DEBUG = true;

var jsonfile = require('jsonfile')
jsonfile.spaces = 4;

var mqtt = require('mqtt'); //includes mqtt server 

/* Library to use InfluxDB database */
const TamataInfluxDB = require('./TamataInflux')

/* Config JSON indent mode */
var configFile = "config.json";
var jsonConfig ;

/* Configure CoolBoard Sensor Client for Mqtt */
var sensorType = "TamataWorm";
var database = ""
var influx;

//---------------------
//get config
//---------------------
jsonfile.readFile(configFile, function(err, data) {
		jsonConfig = data;

		if (err) throw err;
		mqttTopic = jsonConfig.system.mqttTopic + '/update';
		mqttServer = jsonConfig.system.mqttServer;
		mqttAWS = jsonConfig.system.mqttAWS;
		user = jsonConfig.system.user;
		database = jsonConfig.system.influxDB.database;
		begin();
});

function begin() {
	if (DEBUG) {
		//console.log('Function Begin(jsonConfig) : '+JSON.stringify(jsonConfig) );
		console.log('Config');
		console.log('MqttServer ='+ jsonConfig.system.mqttServer);
		console.log('MqttTopic ='+ jsonConfig.system.mqttTopic);
		console.log('Mongo Config ='+ JSON.stringify(jsonConfig.system.mongoDB) ) ;
		console.log('Influx Config ='+ JSON.stringify(jsonConfig.system.influxDB) ) ;
	}
   
	client = mqtt.connect('mqtt://'+ jsonConfig.system.mqttServer );
    client.subscribe( jsonConfig.system.mqttTopic + "/update"); 
    client.on('connect', () => { console.log('Mqtt connected to ' + jsonConfig.system.mqttServer + "/ Topic : " + jsonConfig.system.mqttTopic  )} )
    client.on('message', insertEvent );
}

function insertEvent(topic,message) {
	var parsedMessage = JSON.parse(message);

	if (DEBUG) console.log('************************');
	if (DEBUG) console.log('Mqtt Message received : ');
	if (DEBUG) console.log('Insert Message : ' + JSON.stringify(parsedMessage) ) ;

	// Checking Message 
	const promiseMeasurement = new Promise( (resolve, reject) => {
		return resolve();
	})
	// Then Connect to InfluxDB 
	.then( getMeasurement(parsedMessage)
		.then(  (measurement) => {
			if (measurement !== "unManaged") {	
				if (DEBUG) console.log('Begin saving... measurement = ' + measurement );
				influx = new TamataInfluxDB( jsonConfig.system.influxDB, measurement );
				influx.save( parsedMessage, measurement, database );
			}
			else {
				if (DEBUG) console.log('UnManaged measurement = ' + measurement );
			}
		})
	);

	// Then Internet Check & Close DBs
	promiseMeasurement.then( () => {
		if (DEBUG) console.log('Last actions... ');
	});

} // End Insert Event


/*********************************************
- function getMeasurement(parsedMessage)
Return a Promise with measurement type 
sensor, jetpack, coolboardconfig, rtcconfig... 
*/
function getMeasurement(parsedMessage) {
	return new Promise(  (resolve, reject) => {
		return resolve();
	}).then( () => {
		if (DEBUG) {console.log('Function getMeasurement start... ');}
		var measurement;

		if ( parsedMessage.state.reported.user === sensorType ) { 
			if (DEBUG) { console.log('sensor message detected') }
			measurement = "sensor";
			return measurement;
		} 
		else if ( parsedMessage.state.reported.Act0 !== null ){//&& parsedMessage.state.reported.user === null ) {
			if (DEBUG) { console.log('jetpack message detected') }
			measurement = "jetpack"
			return measurement;
		}
		else {
			return "unManaged";
		}
	});


}
