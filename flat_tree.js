"use strict";

var async = require('async');
var fs = require("fs");
var path = require("path");
var _ = require('underscore');
var assert = require('assert');
// get all package.json as individual nodes in an array
//	name, version, dependencies
//	only when root has package.json and follow subdirectory node_modules
// build a tree of dependent -> dependencies
// move leafs of tree to top-level (depth 0), replacing dependencies by symlinks

//modules = findAllModules('/usr/lib/node_modules')

// for(module in modules.keys()) {
// 	for(dependency in module.dependencies) {
// 		module.dependencies_link = modules[dependency.name];
// 	}	
// }

var dir = '/usr/lib/node_modules';
var generate_candidates = function(dir, candidate_dir) {
	assert.ok(dir);
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	console.log("reading " + file);
	try {
		var parsed = JSON.parse(fs.readFileSync(file));
		parsed.location = file;
		return parsed;
	} catch(e) {
		return null;	
	}
	
};

var load_packages = function(dir) {
	var candidates; // temporary variable to zip candidates and stat file
	var packages = _.chain(fs.readdirSync(dir))
			.map(generate_candidates.bind(this, dir))
			.map(read_package)
			.filter(function(v) {return v;})
			.value();

	console.log(_.pluck(packages, 'location'));
}

// var doNotExit = function (){
//         return true;
// };
// setInterval(doNotExit, 500);

load_packages(dir);
console.log('finished!');