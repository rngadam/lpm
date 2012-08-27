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
var generate_candidates = function(candidate_dir) {
	assert.ok(dir);
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	console.log("reading " + file);
	return JSON.parse(fs.readFileSync(file));
};

var load_packages = function(dir) {
	var entries = fs.readdirSync(dir);
	var candidates = _.map(entries, generate_candidates);
	var stats = _.map(candidates, fs.statSync);
	var candidates_stats = _.zip(candidates, stats);
	var valid_candidates =_.filter(candidates_stats, function(candidate_stat) {return candidate_stat[1].isFile();});
	console.log(valid_candidates);
	var filtered_candidates = _.pluck(valid_candidates, "0");
	console.log(filtered_candidates);
	var packages = filtered_candidates.map(read_package);
	console.log(packages);
}

// var doNotExit = function (){
//         return true;
// };
// setInterval(doNotExit, 500);

load_packages(dir);
console.log('finished!');