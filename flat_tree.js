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
	return path.join(dir, path.join(candidate_dir, 'package.json'));
};

var read_package = function(file) {
	try {
		var parsed = JSON.parse(fs.readFileSync(file));
		console.log("read " + file);
		parsed.location = file;
		return parsed;
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error!";
	}
	
};

var prepostfix = function(dir, filename, subdir) { 
	return path.join(dir, path.join(subdir, filename)); 
};

var postfix = function(value, dir) {
	console.log(arguments);
	var dir = path.dirname(dir);
	return path.join(dir, value); 	
};

var load_packages = function(dir) {
	try {
		var packages = _.chain(fs.readdirSync(dir))
				.map(prepostfix.bind(this, dir, 'package.json'))
				.map(read_package)
				.filter(function(v) {return v;})
				.value();
		return packages;
	} catch(e) {
		if(e.code == 'ENOENT')
			return null;	
		throw "Uncaught error!";
	}
}

// var doNotExit = function (){
//         return true;
// };
// setInterval(doNotExit, 500);

var packages = load_packages(dir);

var output_packages = _.chain(packages)
	.pluck('location')
	.map(postfix.bind(this, 'node_modules'))
	.map(load_packages)
	.filter(function(v) {return v;})	
	.value();

console.log('finished!');